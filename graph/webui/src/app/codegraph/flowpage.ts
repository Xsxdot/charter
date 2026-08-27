// flowpage —— C12 行为轴的唯一视图模型派生器。
//
// 流程图只消费 baseline.flows；流程数据缺席时，机械可达序列仍可供 agent 读取，
// 但绝不伪装成人看的有序、有分支流程图。接口实现清单永远从 implements join。
import type { CgEntryChannel, CgFlowStep, CgGraph, CgNode } from '../../api/types'

export type FlowOwnershipState = 'single' | 'multiple' | 'unknown'
export type FlowShape = 'rect' | 'diamond' | 'loop' | 'return' | 'unknown'

export interface FlowPageInput {
  baseline: CgGraph
  entryNodeId: string
}

export interface FlowImplementation {
  id: string
  name: string
  file: string
  line: number
}

export interface FlowStepModel {
  id: string
  order: number
  kind: string
  line: number
  to?: string
  cond?: string
  then?: string[]
  else?: string[]
  body?: string[]
  iface: boolean
  shape: FlowShape
  domainId: string
  nestedEntry: boolean
  guardSide: 'main' | 'side'
  implementations: FlowImplementation[]
  implementationIds: string[]
  explicitUnknownKind: boolean
}

export interface FlowOwnership {
  state: FlowOwnershipState
  candidates: string[]
  labels: string[]
  text: string
}

export interface FlowRegistration {
  files: string[]
  fileCount: number
  entryCount: number
  concentrated: boolean
  text: string
}

export interface FlowFamily {
  key: string
  channel?: CgEntryChannel
  label: string
  entryIds: string[]
  touchedDomainCount: number
}

export interface MechanicalCallChain {
  sequence: string[]
  nodes: CgNode[]
  unordered: true
  unbranched: true
  notice: string
}

export interface FlowPageModel {
  entryNodeId: string
  entry?: CgNode
  degraded: boolean
  degradedReason?: string
  steps: FlowStepModel[]
  flowSteps: FlowStepModel[]
  ownership: FlowOwnership
  entryOwnership: FlowOwnership
  registration: FlowRegistration
  family: string
  families: FlowFamily[]
  channel?: CgEntryChannel
  touchedDomainCount: number
  mechanicalSequence: string[]
  callChain: MechanicalCallChain
  sequenceIsUnordered: true
  noBehavior: boolean
  nestedEntryIds: string[]
}

function live(node: object | undefined): boolean {
  return !!node && (node as { status?: string }).status !== 'deleted'
}

function adjacency(graph: CgGraph): Record<string, string[]> {
  const out: Record<string, string[]> = {}
  for (const [from, to] of graph.edges) {
    if (!live(graph.nodes[from]) || !live(graph.nodes[to])) continue
    ;(out[from] ??= []).push(to)
  }
  return out
}

function domainOf(graph: CgGraph, id: string): string {
  const node = graph.nodes[id]
  return node ? graph.containers[node.container]?.domain ?? '' : ''
}

function rootOf(graph: CgGraph, id: string): string {
  let current = id
  const seen = new Set<string>()
  while (current && !seen.has(current)) {
    seen.add(current)
    const parent = graph.domains?.[current]?.parent ?? ''
    if (!parent) return current
    current = parent
  }
  return ''
}

function mechanicalSequence(graph: CgGraph, entryId: string): string[] {
  const out = adjacency(graph)
  const result: string[] = []
  const queue = [entryId]
  const seen = new Set<string>()
  while (queue.length) {
    const id = queue.shift()!
    if (seen.has(id)) continue
    seen.add(id)
    result.push(id)
    queue.push(...(out[id] ?? []).sort())
  }
  return result
}

function firstCrossDomainTargets(graph: CgGraph, entryId: string): string[] {
  const out = adjacency(graph)
  const sourceDomain = domainOf(graph, entryId)
  const queue: Array<{ id: string; distance: number }> = [{ id: entryId, distance: 0 }]
  const seen = new Set<string>()
  let firstDistance = -1
  const found = new Set<string>()
  while (queue.length) {
    const current = queue.shift()!
    if (seen.has(current.id)) continue
    seen.add(current.id)
    if (firstDistance >= 0 && current.distance > firstDistance) break
    for (const targetId of out[current.id] ?? []) {
      const targetDomain = domainOf(graph, targetId)
      const targetNode = graph.nodes[targetId]
      const targetContainer = targetNode ? graph.containers[targetNode.container] : undefined
      const isNoise = targetContainer?.kind === '函数组' || targetContainer?.kind === 'TypeScript 函数组'
      if (targetDomain && targetDomain !== sourceDomain && !isNoise) {
        firstDistance = current.distance + 1
        found.add(targetDomain)
        continue
      }
      if (firstDistance < 0) queue.push({ id: targetId, distance: current.distance + 1 })
    }
  }
  return [...found].sort()
}

function familyFor(node: CgNode | undefined): string {
  if (!node) return '未命名入口'
  if (node.channel === 'http') {
    const match = node.name.match(/^(?:GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+([^\s?]+)/i)
    if (match) return match[1].replace(/\/:[^/]+/g, '').replace(/\/\*.*$/, '') || '/'
  }
  const tokens = node.name.trim().split(/\s+/).filter(Boolean)
  if (node.channel === 'cli' && tokens.length > 1) return tokens[1]
  return tokens[0] ?? '未命名入口'
}

function knownChannel(channel: string | undefined): channel is CgEntryChannel {
  return channel === 'cli' || channel === 'http' || channel === 'ws' || channel === 'web'
}

function allEntryFamilies(graph: CgGraph): FlowFamily[] {
  const entries = Object.entries(graph.nodes).filter(([, node]) => node.kind === 'entry' && live(node)).sort(([a], [b]) => a.localeCompare(b))
  const groups = new Map<string, FlowFamily>()
  for (const [id, node] of entries) {
    const family = familyFor(node)
    const channelKey = knownChannel(node.channel) ? node.channel : 'unmarked'
    const key = `${channelKey}:${family}`
    const current = groups.get(key) ?? {
      key, label: family, entryIds: [], touchedDomainCount: 0,
      ...(knownChannel(node.channel) ? { channel: node.channel } : {}),
    }
    current.entryIds.push(id)
    const touched = new Set(current.entryIds.map((entryId) => rootOf(graph, domainOf(graph, entryId))).filter(Boolean))
    current.touchedDomainCount = touched.size
    groups.set(key, current)
  }
  return [...groups.values()].sort((a, b) => a.key.localeCompare(b.key))
}

function registrationFor(graph: CgGraph, entryId: string): FlowRegistration {
  const entryDomain = rootOf(graph, domainOf(graph, entryId))
  const entries = Object.entries(graph.nodes).filter(([id, node]) => {
    if (node.kind !== 'entry' || !live(node)) return false
    if (!entryDomain) return true
    return rootOf(graph, domainOf(graph, id)) === entryDomain
  })
  const files = [...new Set(entries.map(([, node]) => node.file).filter(Boolean))].sort()
  const concentrated = files.length === 1 && entries.length > 3
  return {
    files, fileCount: files.length, entryCount: entries.length, concentrated,
    text: concentrated ? `集中注册：${entries.length} 个入口都在 ${files[0]}` : `${files.length} 个注册文件 · ${entries.length} 个入口`,
  }
}

function implementationsFor(graph: CgGraph, ifaceId: string | undefined): FlowImplementation[] {
  if (!ifaceId) return []
  return (graph.implements ?? []).filter(([, iface]) => iface === ifaceId).map(([id]) => {
    const node = graph.nodes[id]
    return { id, name: node?.name ?? id, file: node?.file ?? '', line: node?.line ?? 0 }
  }).sort((a, b) => a.id.localeCompare(b.id))
}

function stepModel(graph: CgGraph, raw: CgFlowStep, allSteps: Map<string, CgFlowStep>): FlowStepModel {
  const kind = raw.kind as string
  const known = kind === 'call' || kind === 'branch' || kind === 'loop' || kind === 'return'
  const target = raw.to ? graph.nodes[raw.to] : undefined
  const targetDomain = raw.to ? domainOf(graph, raw.to) : ''
  const branchSide = kind === 'branch' && ((raw.then ?? []).some((id) => allSteps.get(id)?.kind === 'return') || (raw.else ?? []).some((id) => allSteps.get(id)?.kind === 'return'))
  const implementations = raw.iface ? implementationsFor(graph, raw.to) : []
  return {
    id: raw.id, order: raw.order, kind, line: raw.line, to: raw.to, cond: raw.cond,
    then: raw.then, else: raw.else, body: raw.body, iface: raw.iface === true,
    shape: !known ? 'unknown' : kind === 'call' ? 'rect' : kind === 'branch' ? 'diamond' : kind,
    domainId: targetDomain, nestedEntry: target?.kind === 'entry', guardSide: branchSide ? 'side' : 'main',
    implementations, implementationIds: implementations.map((implementation) => implementation.id), explicitUnknownKind: !known,
  }
}

export function deriveFlowPage(input: FlowPageInput): FlowPageModel {
  const entry = input.baseline.nodes[input.entryNodeId]
  const sequence = mechanicalSequence(input.baseline, input.entryNodeId)
  const nodes = sequence.map((id) => input.baseline.nodes[id]).filter((node): node is CgNode => !!node)
  const candidates = entry ? firstCrossDomainTargets(input.baseline, input.entryNodeId) : []
  const labels = candidates.map((domainId) => input.baseline.domains?.[domainId]?.label ?? domainId)
  const ownership: FlowOwnership = candidates.length === 1
    ? { state: 'single', candidates, labels, text: labels[0] }
    : candidates.length > 1
      ? { state: 'multiple', candidates, labels, text: `多值归属：${labels.join('、')}` }
      : { state: 'unknown', candidates: [], labels: [], text: '无行为' }
  const rawFlow = input.baseline.flows?.[input.entryNodeId]
  const rawSteps = rawFlow?.steps ?? []
  const allSteps = new Map(rawSteps.map((step) => [step.id, step]))
  const steps = rawFlow ? [...rawSteps].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id)).map((step) => stepModel(input.baseline, step, allSteps)) : []
  const families = allEntryFamilies(input.baseline)
  const family = familyFor(entry)
  const domainRoots = new Set(sequence.map((id) => rootOf(input.baseline, domainOf(input.baseline, id))).filter(Boolean))
  const degraded = !entry || input.baseline.flows?.[input.entryNodeId] === undefined
  const degradedReason = !entry ? `入口 ${input.entryNodeId} 不在 baseline.nodes` : degraded ? '缺少 baseline.flows；扫描器补齐承重函数流程数据后可生成流程图' : undefined
  return {
    entryNodeId: input.entryNodeId, ...(entry ? { entry } : {}), degraded,
    ...(degradedReason ? { degradedReason } : {}), steps, flowSteps: steps,
    ownership, entryOwnership: ownership, registration: registrationFor(input.baseline, input.entryNodeId), family, families,
    ...(knownChannel(entry?.channel) ? { channel: entry.channel } : {}), touchedDomainCount: domainRoots.size,
    mechanicalSequence: sequence, callChain: {
      sequence, nodes, unordered: true, unbranched: true, notice: '无次序无分支：这是给 agent 的机械可达序列，不是流程图',
    }, sequenceIsUnordered: true, noBehavior: ownership.state === 'unknown',
    nestedEntryIds: steps.filter((step) => step.nestedEntry && step.to).map((step) => step.to!),
  }
}
