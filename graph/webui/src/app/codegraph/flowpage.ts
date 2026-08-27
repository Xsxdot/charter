// flowpage —— C17 行为轴纯派生入口。
//
// 职责：把 CgGraph 与当前泳道主语 id 投影为方法 subject、flow 步骤、直接 caller、
// implements 实现和反向可达 entry 通道。边界：只读纯函数，不访问 DOM、URL、网络或
// localStorage，不调用 chain/tree；entry 是到达通道事实，不因 kind 自动成为主语。
import type { CgEntryChannel, CgFlowStep, CgGraph } from '../../api/types'

/** 行为轴页内导航所需的结构轴来源；不是 CgGraph wire 字段。 */
export interface FlowOpenRequest {
  subjectId: string
  originScopeId: string | null
  originScopeLabel: string
  originOpenableSubjectIds: string[]
}

/** 行为轴页面展示的节点引用；openable 只表示 UI 是否允许打开下一张方法图。 */
export interface FlowNodeRef {
  id: string
  name: string
  kind: 'entry' | 'func' | 'model'
  file: string
  line: number
  domain?: string
  container?: string
  channel?: CgEntryChannel
  openable: boolean
}

export interface FlowPageInput {
  baseline: CgGraph
  /** C12 遗留字段名；C17 语义是当前泳道主语 id，不是程序入口 id。 */
  entryNodeId: string
}

/** 兼容结构轴现有模型的散度类型；C17 FlowPageModel 不再携带该字段。 */
export interface RegistrationDispersion {
  domainId: string
  entries: number
  files: number
  concentrated: boolean
}

/** C17 冻结的行为轴模型：方法主语、流程步骤和三组关系。 */
export interface FlowPageModel {
  subject: FlowNodeRef
  degraded: boolean
  missing?: string
  steps: CgFlowStep[]
  callers: FlowNodeRef[]
  implementations: FlowNodeRef[]
  channels: FlowNodeRef[]
}

function isDeleted(value: unknown): boolean {
  return typeof value === 'object' && value !== null && (value as { status?: string }).status === 'deleted'
}

function sortIds(ids: Iterable<string>, baseline: CgGraph): string[] {
  return [...new Set(ids)].filter((id) => {
    const node = baseline.nodes[id]
    return node !== undefined && !isDeleted(node)
  }).sort((a, b) => {
    const left = baseline.nodes[a]!
    const right = baseline.nodes[b]!
    return left.name.localeCompare(right.name) || a.localeCompare(b)
  })
}

function nodeRef(baseline: CgGraph, id: string, openable: boolean): FlowNodeRef {
  const node = baseline.nodes[id]
  if (!node) {
    return { id, name: id, kind: 'func', file: '', line: 0, openable: false }
  }
  const container = baseline.containers[node.container]
  return {
    id,
    name: node.name,
    kind: node.kind,
    file: node.file,
    line: node.line,
    ...(container?.domain === undefined ? {} : { domain: container.domain }),
    ...(node.container === '' ? {} : { container: node.container }),
    ...(node.channel === undefined ? {} : { channel: node.channel }),
    openable,
  }
}

function sortRefs(refs: FlowNodeRef[]): FlowNodeRef[] {
  return refs.sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id))
}

/**
 * 从 graph 构造当前泳道主语的行为模型。缺少 flows 或空步骤是成功降级并保留
 * missing；不存在的主语也只返回可显示的 degraded 结果，不从邻接边猜测主语。
 */
export function deriveFlowPage(input: FlowPageInput): FlowPageModel {
  const { baseline, entryNodeId: subjectId } = input
  const subjectNode = baseline.nodes[subjectId]
  const subject = nodeRef(baseline, subjectId, subjectNode !== undefined && !isDeleted(subjectNode) && subjectNode.kind !== 'entry')
  const active = (id: string): boolean => {
    const node = baseline.nodes[id]
    return node !== undefined && !isDeleted(node)
  }
  const forward = new Map<string, string[]>()
  const reverse = new Map<string, string[]>()
  for (const edge of baseline.edges) {
    const [from, to] = edge
    if (!active(from) || !active(to) || isDeleted(edge)) continue
    const forwardList = forward.get(from) ?? []
    forwardList.push(to)
    forward.set(from, forwardList)
    const reverseList = reverse.get(to) ?? []
    reverseList.push(from)
    reverse.set(to, reverseList)
  }

  const callerIds = sortIds(reverse.get(subjectId) ?? [], baseline)
  const callers = sortRefs(callerIds.map((id) => {
    const node = baseline.nodes[id]!
    return nodeRef(baseline, id, node.kind !== 'entry' && baseline.flows?.[id] !== undefined)
  }))

  const implementationIds = sortIds(
    (baseline.implements ?? [])
      .filter((edge) => edge[1] === subjectId && active(edge[0]) && active(edge[1]) && !isDeleted(edge))
      .map((edge) => edge[0]),
    baseline,
  )
  const implementations = sortRefs(implementationIds.map((id) => nodeRef(baseline, id, true)))

  const channelIds = new Set<string>()
  if (subjectNode?.kind === 'entry') channelIds.add(subjectId)
  const seen = new Set<string>([subjectId])
  const queue = [subjectId]
  while (queue.length > 0) {
    const current = queue.shift()!
    for (const callerId of reverse.get(current) ?? []) {
      if (seen.has(callerId)) continue
      seen.add(callerId)
      if (baseline.nodes[callerId]?.kind === 'entry') channelIds.add(callerId)
      queue.push(callerId)
    }
  }
  const channels = sortRefs(sortIds(channelIds, baseline).map((id) => nodeRef(baseline, id, false)))

  const flow = active(subjectId) ? baseline.flows?.[subjectId] : undefined
  const hasSteps = flow !== undefined && flow.steps.length > 0
  if (!hasSteps) {
    return {
      subject,
      degraded: true,
      missing: subjectNode === undefined || isDeleted(subjectNode)
        ? `找不到方法主语 ${subjectId}`
        : `缺少 ${subjectId} 的 flows 步骤`,
      steps: [],
      callers,
      implementations,
      channels,
    }
  }
  return {
    subject,
    degraded: false,
    steps: [...flow.steps],
    callers,
    implementations,
    channels,
  }
}
