// flowpage —— C12 行为轴视图模型派生器（缝 2，c12-contract §2.4-28~36）。
//
// 职责：把行为轴的全部读数收敛进这一个纯函数——一条程序入口一张流程图（§2.4-30）：
// 流程主干步骤视图（wire 透传 + 目标派生读数，§2.4-35 的数据面）、入口归属三态
// （§2.4-32）、入口注册散度（§2.4-33）、入口族分组与触达域散度（§2.4-34 +
// 契约修订 R1 把触达域散度归缝 2）、接口实现的 implements join（§2.1-4，禁止在
// flows 里复制实现清单）、degraded 双向与「调用链（给 agent）」机械序列数据位
// （§2.4-31）。
//
// 边界：纯函数层——不请求网络、不访问 DOM、零 console；诊断一律走模型显式字段
// （degraded / entryFound / ownership='none' / unknownKind / danglingChildRefs /
// registrationDispersion=null），与 scopepage 同一约定。兜底桶词表常量复用缝 1
// 导出（两卡不得各写一份字面量，C12.2 plan §1 跨卡签名交接）。导出面仅供
// codegraph 应用模块内组件层消费，不导出到应用外（§2.4-28）。蛇形折列等画布
// 布局是消费侧关注点（K5），本模块不输出坐标。
//
// 判定口径（契约未钉、由本 plan 细化并经夹具钉死的部分）：
// - 归属＝从入口沿调用出边 BFS，「最近一层」上同时出现的全部合格跨域目标的
//   顶层子系统去重（spec 现状读数 122 单值/24 双值/2 三值的成因即同一最近前沿
//   有多个目标；若只看直连边，先调同域 handler 的 HTTP 入口会被整体误判成
//   无行为）。合格＝目标可解析到顶层子系统 ∧ 异于入口自身顶层 ∧ 目标容器
//   kind ∉ 兜底桶。邻接表按 id 排序构造，边序扰动不改结果。
// - 注册散度按「归属单值」在全图聚合入口（multi/none 不计入任何单一子系统，
//   不假装归属）；文件取入口节点的 file 字段；集中注册＝files===1 ∧
//   entries>3（§2.4-33 的字面边界）。
// - 族切分是名字形状识别器（非 wire 词表）：HTTP 形态＝「方法词+空格+/路径」
//   或裸 /路径，族 id＝路径前两段；其余按空白切分、去末段为 CLI 命令族。
//   该假设已由夹具固化；真实 162 入口分布的复核归真机项（breakdown §四.6）。
// - 触达域散度＝族内全部成员入口的机械可达顶层子系统去重数（含各自老家）。
// - 机械可达序列永远单独住在 callChain，其 sequenced/conditional 是类型级恒
//   false 的诚实标注——结构上不可能混入 steps 主干冒充流程图（§2.4-31）。
import type { CgFlowStepKind, CgGraph } from '../../api/types'
import { FALLBACK_BUCKET_KINDS } from './scopepage'

/** 流程步骤 kind 四值的运行时镜像（satisfies 与 api/types 的联合类型钉同步）。 */
const FLOW_STEP_KINDS = ['call', 'branch', 'loop', 'return'] as const satisfies readonly CgFlowStepKind[]

/**
 * HTTP 方法词识别——仅用于入口名的族形态识别（§2.4-34 从名字算族），
 * 不是 wire 受控词表；通道真数据到达后如需改按 channel 分组属契约增量。
 */
const HTTP_FAMILY_PATTERN = /^(?:GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)\s+\/(.*)$/

export interface FlowPageInput {
  baseline: CgGraph
  entryNodeId: string
}

/** 入口归属三态（§2.4-32）：单值 / 多值（全部候选升序）/ 判不出＝无行为。 */
export type EntryOwnership =
  | { state: 'single'; domainId: string }
  | { state: 'multi'; candidates: string[] }
  | { state: 'none' }

/**
 * 入口注册散度（§2.4-33）：归属某子系统的全部入口（全图口径，不只当前入口）
 * 的注册文件分布。concentrated＝files===1 ∧ entries>3，判红依据由视图渲染。
 */
export interface RegistrationDispersion {
  domainId: string
  /** 归属该子系统的入口总数（仅单值归属计入）。 */
  entries: number
  /** 这些入口注册文件的去重数。 */
  files: number
  /** 集中注册判红（§2.4-33 字面边界：1 个文件且入口数 >3）。 */
  concentrated: boolean
}

/** 接口调用的一个实现：implements 段 join 结果（§2.1-4 单一数据源）。 */
export interface InterfaceImplementation {
  /** 实现符号节点 id。 */
  nodeId: string
  name: string
  /**
   * 该实现的流程图起点＝实现所在容器内的程序入口（spec：每个实现的入口即其
   * 流程图起点）；实现容器没有入口时空串如实标注，不猜。
   */
  entryNodeId: string
}

/** 流程步骤视图：wire 七类字段透传 + 派生读数。可选字段缺席即键缺席（不补零值）。 */
export interface FlowStepView {
  id: string
  order: number
  /** wire 原样透传；词表外值不崩溃，见 unknownKind。 */
  kind: CgFlowStepKind
  line: number
  /** call 步骤的目标节点/接口 id；wire 缺席即键缺席。 */
  to?: string
  /** branch/loop 的条件表达式；wire 缺席即键缺席。 */
  cond?: string
  /** 子干步骤 id 引用列，原样透传不重排；悬空引用另行汇总在模型 danglingChildRefs。 */
  then?: string[]
  else?: string[]
  body?: string[]
  /** 派生：目标节点名；to 缺席或悬空（不在 nodes 里）时为 null。 */
  targetName: string | null
  /** 派生：目标顶层子系统 id（baseline.domains 口径，左色条数据）；未知为空串。 */
  targetDomain: string
  /** 派生：目标是程序入口（紫框 ▸ 可递归下钻的数据依据）。 */
  targetIsEntry: boolean
  /** wire 原样透传；true 表示动态分派点。 */
  iface?: boolean
  /** iface=true 时为 implements join 结果（可能为空＝无实现记录）；否则恒 []。 */
  implementations: InterfaceImplementation[]
  /** 词表外 kind 显式标注（四值之外的数据不崩溃、不冒充合法步骤）。 */
  unknownKind: boolean
}

/** 「调用链（给 agent）」tab 的机械可达序列数据位（§2.4-31）。 */
export interface AgentCallChain {
  /** 从入口沿调用出边 BFS 的节点 id 序列（含入口自身；邻接按 id 排序保证确定性）。 */
  nodeIds: string[]
  /** 类型级恒 false：机械序列没有次序语义，视图必须如实标注「无次序」。 */
  sequenced: false
  /** 类型级恒 false：机械序列没有分支语义。 */
  conditional: false
}

/** 入口族（§2.4-34）：从节点名算出，不依赖入口容器的服务领域拆分。 */
export interface EntryFamily {
  familyId: string
  kind: 'cli' | 'http'
  /** 展示名（CLI <命令族> / HTTP <资源路径前缀>）。 */
  label: string
  /** 全图同族入口数。 */
  members: number
  /** 触达域散度（契约修订 R1 归缝 2）：族内全部成员可达顶层子系统的去重数。 */
  reachDomains: number
}

/** 缝 2 输出：顶层九键恒定；degraded 双向语义见 §2.4-31。 */
export interface FlowPageModel {
  entryNodeId: string
  /** 入口 id 在 baseline.nodes 中不存在时为 false（幽灵入口显式降级，不静默空页）。 */
  entryFound: boolean
  /** true＝baseline.flows 缺席或该入口无流程数据；界面按降级空态渲染。 */
  degraded: boolean
  ownership: EntryOwnership
  /** 归属非单值（multi/none）时为 null——没有唯一归属就不发散发度读数。 */
  registrationDispersion: RegistrationDispersion | null
  /** 幽灵入口为 null。 */
  family: EntryFamily | null
  /** 按 order 升序（同 order 按 id 稳定排序）；degraded 时恒 []。 */
  steps: FlowStepView[]
  /** 恒携带（与 degraded 无关）：机械可达序列只住这里，永不进 steps 主干。 */
  callChain: AgentCallChain
  /** 子干引用指向不存在步骤 id 的去重清单（升序）——引用完整性执法随扫描侧开启前的诚实标注。 */
  danglingChildRefs: string[]
}

/**
 * 缝 2 主入口（§2.4-29 地址冻结）：组件层对一条程序入口调用一次；输入只读，
 * 返回可渲染模型。flows 缺该入口输出显式 degraded（Ticket 0 判定位的正式化），
 * 机械可达序列单独住 callChain 并带恒假的次序/分支标注——绝不冒充流程图。
 */
export function deriveFlowPage(input: FlowPageInput): FlowPageModel {
  const { baseline } = input
  const nodesById = baseline.nodes
  const containersDef = baseline.containers
  const domains = baseline.domains ?? {}

  // 邻接表：去重 + 按 id 排序——后续一切遍历（BFS 层序、可达序、归属候选序）
  // 都由此获得确定性，edges 原序扰动不改任何输出。
  const adjacency = new Map<string, string[]>()
  for (const [from, to] of baseline.edges) {
    const list = adjacency.get(from)
    if (list) list.push(to)
    else adjacency.set(from, [to])
  }
  for (const [from, list] of adjacency) adjacency.set(from, [...new Set(list)].sort((a, b) => a.localeCompare(b)))

  const isFallbackKind = (kind: string) => (FALLBACK_BUCKET_KINDS as readonly string[]).includes(kind)

  // 顶层子系统解析：node → container.domain（叶）→ domains.parent 链上溯。
  // 断链/环安全终止返回空串；空串＝不可归属，归属判据里直接跳过（数据缺陷
  // 归扫描侧执法，与 scopepage 悬空端点整条忽略同一先例）。
  const topOfNode = (nodeId: string): string => {
    const node = nodesById[nodeId]
    if (!node) return ''
    const leaf = containersDef[node.container]?.domain ?? ''
    if (!leaf) return ''
    let current = leaf
    const seen = new Set<string>()
    while (current && domains[current] !== undefined && !seen.has(current)) {
      seen.add(current)
      const parent = domains[current]?.parent ?? ''
      if (!parent) return current
      current = parent
    }
    return ''
  }

  const reachableFrom = (startId: string): { order: string[]; depth: Map<string, number> } => {
    const order: string[] = [startId]
    const depth = new Map<string, number>([[startId, 0]])
    for (let head = 0; head < order.length; head += 1) {
      const cur = order[head]!
      for (const next of adjacency.get(cur) ?? []) {
        if (depth.has(next)) continue
        depth.set(next, depth.get(cur)! + 1)
        order.push(next)
      }
    }
    return { order, depth }
  }

  const ownershipFor = (entryId: string): EntryOwnership => {
    const entryTop = topOfNode(entryId)
    const { order, depth } = reachableFrom(entryId)
    const candidates = new Set<string>()
    let frontier = -1
    for (const nid of order) {
      const d = depth.get(nid)!
      if (frontier >= 0 && d > frontier) break
      if (nid === entryId) continue
      const node = nodesById[nid]
      if (!node) continue
      const top = topOfNode(nid)
      if (!top || top === entryTop) continue
      if (isFallbackKind(containersDef[node.container]?.kind ?? '')) continue
      frontier = d
      candidates.add(top)
    }
    if (candidates.size === 0) return { state: 'none' }
    const sorted = [...candidates].sort((a, b) => a.localeCompare(b))
    return candidates.size === 1 ? { state: 'single', domainId: sorted[0]! } : { state: 'multi', candidates: sorted }
  }

  // —— 全图入口清单与逐入口派生。成本口径与 scopepage 的复用度逐入口 BFS 同一
  // 先例（入口数×边数）；真实大图性能已在 breakdown §四.4 登记，夹具不外推。——
  const entriesAll = Object.keys(nodesById)
    .filter((id) => nodesById[id]?.kind === 'entry')
    .sort((a, b) => a.localeCompare(b))
  const ownershipByEntry = new Map<string, EntryOwnership>()
  const reachByEntry = new Map<string, { order: string[] }>()
  for (const id of entriesAll) {
    ownershipByEntry.set(id, ownershipFor(id))
    reachByEntry.set(id, { order: reachableFrom(id).order })
  }

  // 注册散度（§2.4-33）：仅单值归属计入——multi/none 不属于任何单一子系统，
  // 计入任何一个都是编造归属。
  const dispAcc = new Map<string, string[]>()
  for (const id of entriesAll) {
    const own = ownershipByEntry.get(id)
    if (own?.state !== 'single') continue
    const list = dispAcc.get(own.domainId)
    if (list) list.push(id)
    else dispAcc.set(own.domainId, [id])
  }
  const dispersionOf = (domainId: string): RegistrationDispersion => {
    const ids = dispAcc.get(domainId) ?? []
    const files = new Set(ids.map((id) => nodesById[id]?.file ?? ''))
    return {
      domainId,
      entries: ids.length,
      files: files.size,
      concentrated: files.size === 1 && ids.length > 3,
    }
  }

  // 入口族（§2.4-34）：名字形状识别器，规则见文件头「判定口径」；假设由夹具固化。
  const classifyFamily = (name: string): { kind: 'cli' | 'http'; familyId: string; label: string } => {
    const trimmed = name.trim()
    const methodMatch = HTTP_FAMILY_PATTERN.exec(trimmed)
    const path = methodMatch ? `/${methodMatch[1]}` : trimmed.startsWith('/') ? trimmed : null
    if (path !== null) {
      const segments = path.split('/').filter(Boolean)
      const familyId = `/${segments.slice(0, 2).join('/')}`
      return { kind: 'http', familyId, label: `HTTP ${familyId}` }
    }
    const words = trimmed.split(/\s+/).filter(Boolean)
    const stem = words.length <= 1 ? words.join(' ') : words.slice(0, -1).join(' ')
    return { kind: 'cli', familyId: stem, label: `CLI ${stem}` }
  }
  const familyMembers = new Map<string, string[]>()
  const familyMeta = new Map<string, { kind: 'cli' | 'http'; label: string }>()
  for (const id of entriesAll) {
    const f = classifyFamily(nodesById[id]?.name ?? '')
    familyMeta.set(f.familyId, { kind: f.kind, label: f.label })
    const list = familyMembers.get(f.familyId)
    if (list) list.push(id)
    else familyMembers.set(f.familyId, [id])
  }
  const familyOf = (familyId: string): EntryFamily => {
    const members = familyMembers.get(familyId) ?? []
    const tops = new Set<string>()
    for (const m of members) {
      for (const nid of reachByEntry.get(m)?.order ?? []) {
        const top = topOfNode(nid)
        if (top) tops.add(top)
      }
    }
    const meta = familyMeta.get(familyId) ?? { kind: 'cli' as const, label: `CLI ${familyId}` }
    return { familyId, kind: meta.kind, label: meta.label, members: members.length, reachDomains: tops.size }
  }

  const node = nodesById[input.entryNodeId]
  const entryFound = node !== undefined
  const flow = baseline.flows?.[input.entryNodeId]
  const rawSteps = flow?.steps ?? []

  // 子干引用完整性：Validate 执法随 flows 真数据同批开启（types.go 注释原文），
  // 开启前悬空引用在此显式收集，不静默丢弃也不崩溃。
  const stepsById = new Map(rawSteps.map((s) => [s.id, s]))
  const dangling = new Set<string>()
  for (const s of rawSteps) {
    for (const ref of [...(s.then ?? []), ...(s.else ?? []), ...(s.body ?? [])]) {
      if (!stepsById.has(ref)) dangling.add(ref)
    }
  }

  // 实现的流程图起点：实现所在容器内的程序入口（spec 用户故事 14）。容器没有
  // 入口就返回空串如实标注——「每个实现必有入口」今天不是数据事实，不硬凑。
  const containerEntryOf = (symbolId: string): string => {
    const cid = nodesById[symbolId]?.container
    if (!cid) return ''
    return entriesAll.find((eid) => nodesById[eid]?.container === cid) ?? ''
  }

  const steps: FlowStepView[] = [...rawSteps]
    .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))
    .map((s) => {
      const target = s.to !== undefined ? nodesById[s.to] : undefined
      // 实现清单唯一来源是 implements 段（§2.1-4）：flows 步骤里塞进来的实现
      // 数组（扫描侧违约形态）在这里结构性被忽略。
      const implementations =
        s.iface === true && s.to !== undefined
          ? (baseline.implements ?? [])
              .filter(([, ifaceId]) => ifaceId === s.to)
              .map(([implId]) => ({
                nodeId: implId,
                name: nodesById[implId]?.name ?? implId,
                entryNodeId: containerEntryOf(implId),
              }))
          : []
      return {
        id: s.id,
        order: s.order,
        kind: s.kind,
        line: s.line,
        ...(s.to === undefined ? {} : { to: s.to }),
        ...(s.cond === undefined ? {} : { cond: s.cond }),
        ...(s.then === undefined ? {} : { then: s.then }),
        ...(s.else === undefined ? {} : { else: s.else }),
        ...(s.body === undefined ? {} : { body: s.body }),
        targetName: target?.name ?? null,
        targetDomain: s.to !== undefined ? topOfNode(s.to) : '',
        targetIsEntry: target?.kind === 'entry',
        ...(s.iface === undefined ? {} : { iface: s.iface }),
        implementations,
        unknownKind: !(FLOW_STEP_KINDS as readonly string[]).includes(s.kind),
      }
    })

  const ownership: EntryOwnership = entryFound
    ? ownershipByEntry.get(input.entryNodeId) ?? ownershipFor(input.entryNodeId)
    : { state: 'none' }

  return {
    entryNodeId: input.entryNodeId,
    entryFound,
    degraded: flow === undefined,
    ownership,
    registrationDispersion: ownership.state === 'single' ? dispersionOf(ownership.domainId) : null,
    family: entryFound ? familyOf(classifyFamily(node.name).familyId) : null,
    steps,
    callChain: {
      nodeIds: entryFound ? reachableFrom(input.entryNodeId).order : [],
      sequenced: false,
      conditional: false,
    },
    danglingChildRefs: [...dangling].sort((a, b) => a.localeCompare(b)),
  }
}
