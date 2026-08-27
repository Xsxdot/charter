// scopepage —— C12 结构轴视图模型派生器（缝 1，c12-contract §2.3-17~27）。
//
// 职责：把「一个页面按 scope 变」的全部读数收敛进这一个纯函数——递归同构（根/
// 领域/叶子领域的容器层返回同一形状模型，容器是原子节点，§2.3-20）、组织切换
// （best/current 只是输入维度，§2.3-19）、兜底桶占比/复用度/真假共享内核三类债
// 读数（§2.3-22）、噪声折叠判据（§2.3-23，替换 domainpage 的 slice(0, quota) 坏取法）、
// 大容器如实报（§2.3-24）、三类空态（§2.3-25）、容器职责唯一合法推导（§2.3-26）、
// 孤立子系统（call deg 0）与 projections 第二类边（§2.3-27）。
//
// 边界：纯函数层——不请求网络、不访问 DOM、零 console；诊断一律走模型显式字段
// （debt.unknownKind、kindClass='unknown'、ratio=null、organizationAvailable=false、
// 未知 scope 空图），与 besttree/domainpage 同一约定。阈值常量只存在于本模块，
// 禁止从 URL/localStorage/env/用户配置覆盖（§2.3-23）。导出面仅供 codegraph 应用
// 模块内组件层消费，不导出到应用外（§2.3-17）。触达域散度归缝 2（spec《测试决定》
// 缝 2 覆盖清单 + breakdown K3 验收 5），本模块不实现入口族分组与入口归属判据。
// 布局说明：本模块只供拓扑事实（节点/边/weight/direction）；坐标计算是画布关注
// 点，落点在消费侧页面组件（K4），缝 1 不输出坐标。
import type { CgBest, CgDomainDecls, CgEntryChannel, CgGraph, CgTarget } from '../../api/types'
import {
  childBestDomainIds,
  containerFacts,
  topLevelSubsystemIds,
} from './besttree'
import type { RegistrationDispersion } from './flowpage'

/** 容器 kind 八值词表（C12 契约 §2.2-14，值随扫描侧冻结）。 */
export const CONTAINER_KINDS = [
  '类型方法', '函数组', '实体', 'TypeScript 模型', 'React 组件/函数', '入口',
  'TypeScript 函数组', 'TypeScript 实体',
] as const
export type ContainerKind = (typeof CONTAINER_KINDS)[number]

/** 兜底桶二值（§2.2-14）：跨语言两套函数组桶。判据以词表为准，不做前缀猜测。 */
export const FALLBACK_BUCKET_KINDS = ['函数组', 'TypeScript 函数组'] as const

/** 真共享内核容器 kinds（spec 实现决定：高复用落实体/类型方法=真）。 */
export const REAL_KERNEL_KINDS = ['类型方法', '实体'] as const

/** 噪声折叠阈值（§2.3-23）：兜底桶 ∧ 复用度≥10 → 折叠。只存在于本模块。 */
export const NOISE_FOLD_REUSE_THRESHOLD = 10

/** 大容器阈值（§2.3-24）：符号数超过即正面如实报并标债务色。只存在于本模块。 */
export const OVERSIZE_CONTAINER_SYMBOLS = 40

export type ScopeOrganization = 'best' | 'current'

export interface ScopePageInput {
  baseline: CgGraph
  best?: CgBest
  decls?: CgDomainDecls
  target?: CgTarget
  organization: ScopeOrganization
  scopeId: string | null
}

/** 职责格位三分（§2.2-11/§2.3-26）：三态互斥可区分，不存在空串伪装的有职责态。 */
export type ResponsibilityState =
  | { state: 'declared'; text: string }
  | { state: 'undeclared' }
  | { state: 'no-subject' }

/** 单条领域不变式（decl 原样透传）；testRef=锁住这条不变式的测试名，缺席即声明未带测试锚。 */
export interface ScopeInvariantRef {
  text: string
  testRef?: string
}

/**
 * 不变式格位三分（C12.4 协调者修订 R3）：「该域无声明文件」「有声明文件但未写不变式」
 * 「有不变式」三态互斥可辨——禁止同一个空态把「没写」与「没有声明文件」糊成一片。
 * 仅领域卡携带；容器卡没有声明格位，恒 null（沿 debt:null 同一约定）。
 */
export type ScopeInvariants =
  | { state: 'present'; items: ScopeInvariantRef[] }
  | { state: 'unwritten' }
  | { state: 'no-decl' }

/** 程序入口引用；channel 原样透传，undefined 即通道未标注（降级桶由视图渲染）。 */
export interface ScopeEntryRef {
  id: string
  name: string
  channel?: CgEntryChannel
}

/**
 * 子系统/领域层的债读数（§2.3-22 三类）。ratio 分母为 0 时是 null 而不是 0——
 * 无入边≠0%，不得伪装成完整读数（§2.3-25）。
 */
export interface ScopeDebtReadout {
  inboundCrossDomain: number
  fallbackBucket: number
  unknownKind: number
  ratio: number | null
}

/** 端口：当前视图内与相邻卡的连线聚合，weight=原始边数（画布线宽的输入）。 */
export interface ScopePort {
  neighborId: string
  direction: 'in' | 'out'
  weight: number
}

/** 一张结构卡：领域卡或容器卡。容器卡是原子节点（childCount 恒 0，§2.3-20）。 */
export interface ScopeNode {
  id: string
  kind: 'domain' | 'container'
  label: string
  type: string
  /** 当前视图内 call 无入边且无出边（projection 不算——第二类边不是调用边）。 */
  isolated: boolean
  childCount: number
  containerCount: number
  symbolCount: number
  fileCount: number
  /** 仅容器卡可为 true：symbolCount > OVERSIZE_CONTAINER_SYMBOLS（§2.3-24 债务色依据）。 */
  oversized: boolean
  /** 包目录（containerFacts 口径：节点跨多目录时为空串——不猜）。 */
  dir: string
  ports: ScopePort[]
  entries: ScopeEntryRef[]
  responsibility: ResponsibilityState
  /** 入口注册散度（§2.4-33）：仅领域卡携带子树聚合，容器卡恒 null。 */
  entryDispersion: RegistrationDispersion | null
  /** 领域声明的不变式投影（C12.4 R3）：仅领域卡携带；容器卡恒 null。 */
  invariants: ScopeInvariants | null
  debt: ScopeDebtReadout | null
}

/**
 * 符号粒度跨域入缝（右栏「对外面」的数据源）。folded 按 §2.3-23 判据在此一次性
 * 算定，视图层只渲染不重算——折叠事实的唯一口径。
 */
export interface InboundSeam {
  nodeId: string
  name: string
  containerId: string
  containerLabel: string
  /** 容器 kind 原样透传（词表外值原样出现，分类见 kindClass）。 */
  containerKind: string
  kindClass: 'fallback' | 'real-kernel' | 'other' | 'unknown'
  /** 可达程序入口数；0=死契约，如实保留不丢弃。 */
  reuse: number
  folded: boolean
  /** 跨域调用方的顶层子系统 id，去重排序。 */
  callerDomains: string[]
}

/** 结构边。call 与 projection 都只带拓扑事实；直调债四档色需要 report（legacyHits/fails），
 *  它不在 §2.3-19 冻结的六字段输入里——债色的 join 归消费侧装配（K4 用既有 assembleDirections）。 */
export interface ScopeEdge {
  key: string
  from: string
  to: string
  weight: number
  kind: 'call' | 'projection'
  /** 仅 projection 边：twin | typed（types.go:138 三元组第三位）。 */
  projectionType?: 'twin' | 'typed'
}

/** 调出到本层之外的顶层领域聚合（ext 卡退役后的图例数据源）。 */
export interface ScopeExternalOut {
  /** 邻居顶层领域 id，不带 ext: 前缀。 */
  neighborId: string
  /** 组织视图解析的展示名。 */
  label: string
  /** 本层到邻居的 call 边聚合权重。 */
  weight: number
}

/** 缝 1 输出：每一层同一形状（§2.3-20 递归同构），顶层八键恒定。 */
export interface ScopePageModel {
  scopeId: string | null
  organization: ScopeOrganization
  /** false 即「按最优树」但 best 缺席：nodes/edges 恒空，绝不拿 current 冒充。 */
  organizationAvailable: boolean
  nodes: ScopeNode[]
  edges: ScopeEdge[]
  /** 符号粒度对外面；根层恒空数组（系统外无调用方）。 */
  inboundSeams: InboundSeam[]
  /** 调出到本层之外；按邻居顶层领域 id 升序，根层恒空数组。 */
  externalOut: ScopeExternalOut[]
  empty: {
    noDeclaration: boolean
    noEntities: boolean
    noInboundSeams: boolean
  }
}

/** 组织抽象：best 树与现状领域树的同构读数面，派生逻辑只写一份。 */
interface OrgView {
  domainExists(id: string): boolean
  allDomainIds(): string[]
  topIds(): string[]
  childrenOf(id: string): string[]
  parentOf(id: string): string
  labelOf(id: string): string
  typeOf(id: string): string
  /** 容器挂叶子领域：返回叶领域 id；未归属容器返回空串。 */
  containerDomain(containerId: string): string
}

function bestOrgView(best: CgBest): OrgView {
  return {
    domainExists: (id) => best.domains[id] !== undefined,
    allDomainIds: () => Object.keys(best.domains).sort(),
    topIds: () => topLevelSubsystemIds(best),
    childrenOf: (id) => childBestDomainIds(best, id),
    parentOf: (id) => best.domains[id]?.parent ?? '',
    labelOf: (id) => best.domains[id]?.label ?? id,
    typeOf: (id) => best.domains[id]?.type ?? '',
    containerDomain: (cid) => best.containers[cid] ?? '',
  }
}

function currentOrgView(baseline: CgGraph): OrgView {
  const domains = baseline.domains ?? {}
  return {
    domainExists: (id) => domains[id] !== undefined,
    allDomainIds: () => Object.keys(domains).sort(),
    topIds: () => Object.entries(domains).filter(([, d]) => !d.parent).map(([id]) => id).sort(),
    childrenOf: (id) => Object.entries(domains).filter(([, d]) => d.parent === id).map(([id]) => id).sort(),
    parentOf: (id) => domains[id]?.parent ?? '',
    labelOf: (id) => domains[id]?.label ?? id,
    typeOf: (id) => domains[id]?.kind ?? '',
    containerDomain: (cid) => baseline.containers[cid]?.domain ?? '',
  }
}

/** 沿 parent 链上溯判断归属；断链与环都安全终止。 */
function inSubtree(view: OrgView, rootId: string, domainId: string): boolean {
  let current = domainId
  const seen = new Set<string>()
  while (current && view.domainExists(current) && !seen.has(current)) {
    if (current === rootId) return true
    seen.add(current)
    current = view.parentOf(current)
  }
  return false
}

/** 上溯到顶层子系统；未知领域、断链和环都返回空串。 */
function topOf(view: OrgView, domainId: string): string {
  let current = domainId
  const seen = new Set<string>()
  while (current && view.domainExists(current) && !seen.has(current)) {
    seen.add(current)
    const parent = view.parentOf(current)
    if (!parent) return current
    current = parent
  }
  return ''
}

function packageDir(file: string): string {
  const slash = file.lastIndexOf('/')
  return slash < 0 ? '' : file.slice(0, slash)
}

function bareTypeName(label: string): string {
  return label.split('.').pop() ?? label
}

function blankModel(scopeId: string | null, organization: ScopeOrganization, organizationAvailable: boolean): ScopePageModel {
  return {
    scopeId,
    organization,
    organizationAvailable,
    nodes: [],
    edges: [],
    inboundSeams: [],
    externalOut: [],
    empty: { noDeclaration: false, noEntities: false, noInboundSeams: false },
  }
}

/**
 * 缝 1 主入口（§2.3-18 地址冻结）：由组件层按当前 scope 调用；输入只读，返回
 * 可渲染模型。未知 scope 返回空图（besttree.bestScopeGraph 同一先例），best 缺席
 * 的 best 组织返回显式不可用，两者都不伪装成有数据的页面。
 */
export function deriveScopePage(input: ScopePageInput): ScopePageModel {
  const best = input.organization === 'best' ? input.best : undefined
  if (input.organization === 'best' && best === undefined) {
    return blankModel(input.scopeId, input.organization, false)
  }
  const view = best ? bestOrgView(best) : currentOrgView(input.baseline)
  const { baseline } = input
  const nodesById = baseline.nodes
  const containersDef = baseline.containers

  const scopeId = input.scopeId
  if (scopeId !== null && !view.domainExists(scopeId)) {
    return blankModel(scopeId, input.organization, true)
  }

  // —— 全局一次的机械事实（与组织相关者经 view 取）——
  const facts = containerFacts(baseline)
  const nodesByContainer = new Map<string, string[]>()
  const nodeLeafDomain = new Map<string, string>()
  const nodeTop = new Map<string, string>()
  const entityIds = new Set<string>()
  const entries: ScopeEntryRef[] = []
  for (const [id, node] of Object.entries(nodesById)) {
    const list = nodesByContainer.get(node.container) ?? []
    if (!nodesByContainer.has(node.container)) nodesByContainer.set(node.container, list)
    list.push(id)
    if (node.kind === 'model' && node.modelKind === 'entity') entityIds.add(id)
    if (node.kind === 'entry') {
      entries.push({ id, name: node.name, ...(node.channel === undefined ? {} : { channel: node.channel }) })
    }
    const leaf = view.containerDomain(node.container)
    nodeLeafDomain.set(id, leaf)
    nodeTop.set(id, leaf ? topOf(view, leaf) : '')
  }
  entries.sort((a, b) => a.id.localeCompare(b.id))

  // 复用度（spec 实现决定）：每个符号可被多少程序入口可达。逐入口沿调用出边 BFS；
  // 入口数×边数对真实图规模可接受，机内夹具不外推性能（真机项归 breakdown §四.4）。
  const adjacency = new Map<string, string[]>()
  for (const [from, to] of baseline.edges) {
    const list = adjacency.get(from) ?? []
    if (!adjacency.has(from)) adjacency.set(from, list)
    list.push(to)
  }
  const reuseCount = new Map<string, number>()
  for (const entry of entries) {
    const seen = new Set<string>([entry.id])
    const queue = [entry.id]
    while (queue.length) {
      const cur = queue.shift()!
      for (const next of adjacency.get(cur) ?? []) {
        if (seen.has(next)) continue
        seen.add(next)
        queue.push(next)
        reuseCount.set(next, (reuseCount.get(next) ?? 0) + 1)
      }
    }
  }

  // 跨域入边按目标节点分类：兜底桶命中入分子；词表外 kind 显式计数不入分子
  // （§2.2-15 校验器开启前的诚实形态）；悬空端点整条忽略（数据缺陷归扫描侧执法）。
  const isFallbackKind = (kind: string) => (FALLBACK_BUCKET_KINDS as readonly string[]).includes(kind)
  const isInVocabulary = (kind: string) => (CONTAINER_KINDS as readonly string[]).includes(kind)
  const inboundByNode = new Map<string, { total: number; fallback: number; unknown: number }>()
  for (const [from, to] of baseline.edges) {
    const fromNode = nodesById[from]
    const toNode = nodesById[to]
    if (!fromNode || !toNode) continue
    const fromLeaf = nodeLeafDomain.get(from) ?? ''
    const toLeaf = nodeLeafDomain.get(to) ?? ''
    if (!fromLeaf || !toLeaf || fromLeaf === toLeaf) continue
    const hit = inboundByNode.get(to) ?? { total: 0, fallback: 0, unknown: 0 }
    hit.total += 1
    const kind = containersDef[toNode.container]?.kind ?? ''
    if (isInVocabulary(kind)) {
      if (isFallbackKind(kind)) hit.fallback += 1
    } else {
      hit.unknown += 1
    }
    inboundByNode.set(to, hit)
  }

  // —— scope 解析：非叶子领域看子领域卡，叶子领域看容器卡（§2.3-20 到容器为止）——
  const scopeSubtree = new Set<string>()
  if (scopeId === null) {
    for (const id of view.allDomainIds()) scopeSubtree.add(id)
  } else {
    const queue = [scopeId]
    while (queue.length) {
      const cur = queue.shift()!
      if (scopeSubtree.has(cur)) continue
      scopeSubtree.add(cur)
      for (const child of view.childrenOf(cur)) queue.push(child)
    }
  }
  const childDomainIds = scopeId === null ? view.topIds() : view.childrenOf(scopeId)
  const mode: 'domains' | 'containers' = scopeId !== null && childDomainIds.length === 0 ? 'containers' : 'domains'
  const scopeContainerIds = Object.keys(containersDef).filter((cid) => {
    const leaf = view.containerDomain(cid)
    return leaf !== '' && (scopeId === null || scopeSubtree.has(leaf))
  }).sort()
  const visibleContainerSet = new Set(mode === 'containers' ? scopeContainerIds : [])

  // 边端点投影：域内折到可见卡（domains 模式=scope 直接子领域；containers 模式=
  // 所在容器），域外保留 ext:<顶层子系统> 作为内部聚合键；ext 不再生成节点。
  const projectEndpoint = (nodeId: string): string | null => {
    const leaf = nodeLeafDomain.get(nodeId) ?? ''
    if (!leaf) return null
    const inScope = scopeId === null || scopeSubtree.has(leaf)
    if (mode === 'containers') {
      const cid = nodesById[nodeId]?.container ?? ''
      if (inScope && visibleContainerSet.has(cid)) return cid
    } else if (inScope) {
      let cur = leaf
      const seen = new Set<string>()
      while (cur && view.domainExists(cur) && !seen.has(cur)) {
        seen.add(cur)
        const parent = view.parentOf(cur)
        if (scopeId === null ? !parent : parent === scopeId) return cur
        cur = parent
      }
      return null
    }
    const top = nodeTop.get(nodeId) ?? ''
    if (!top) return null
    return `ext:${top}`
  }

  const callAgg = new Map<string, { from: string; to: string; weight: number }>()
  const externalCallAgg = new Map<string, { from: string; to: string; weight: number }>()
  const externalOutAgg = new Map<string, ScopeExternalOut>()
  for (const [from, to] of baseline.edges) {
    const a = projectEndpoint(from)
    const b = projectEndpoint(to)
    if (!a || !b || a === b) continue
    if (a.startsWith('ext:') || b.startsWith('ext:')) {
      const externalKey = `${a}->${b}`
      const external = externalCallAgg.get(externalKey) ?? { from: a, to: b, weight: 0 }
      external.weight += 1
      externalCallAgg.set(externalKey, external)
      if (scopeId !== null && !a.startsWith('ext:') && b.startsWith('ext:')) {
        const neighborId = b.slice(4)
        const previous = externalOutAgg.get(neighborId)
        externalOutAgg.set(neighborId, {
          neighborId,
          label: view.labelOf(neighborId),
          weight: (previous?.weight ?? 0) + 1,
        })
      }
      continue
    }
    const key = `${a}->${b}`
    const agg = callAgg.get(key) ?? { from: a, to: b, weight: 0 }
    agg.weight += 1
    callAgg.set(key, agg)
  }

  // projections 第二类边（§2.3-27）：twin/typed 各自成边，明确「不是调用边」——
  // 故不带直调债 status、不算进孤立判据的调用入边。词表外投影类型今天不存在
  // （contract §1 外部核对），出现即扫描侧违约，此处不静默造边，执法随校验器开启。
  const projAgg = new Map<string, { from: string; to: string; weight: number; projectionType: 'twin' | 'typed' }>()
  for (const [from, to, kind] of baseline.projections ?? []) {
    if (kind !== 'twin' && kind !== 'typed') continue
    const a = projectEndpoint(from)
    const b = projectEndpoint(to)
    if (!a || !b || a === b) continue
    const key = `${a}->${b}:${kind}`
    const agg = projAgg.get(key) ?? { from: a, to: b, weight: 0, projectionType: kind }
    agg.weight += 1
    projAgg.set(key, agg)
  }

  // —— 卡片构建 ——
  interface CardSeed { id: string; kind: 'domain' | 'container'; domainId: string }
  const seeds: CardSeed[] = []
  if (mode === 'domains') {
    for (const id of childDomainIds) {
      seeds.push({ id, kind: 'domain', domainId: id })
    }
  } else {
    for (const cid of scopeContainerIds) {
      seeds.push({ id: cid, kind: 'container', domainId: view.containerDomain(cid) })
    }
  }

  const subtreeContainersOf = (domainId: string): string[] =>
    Object.keys(containersDef).filter((cid) => {
      const leaf = view.containerDomain(cid)
      return leaf !== '' && inSubtree(view, domainId, leaf)
    })

  const statsOver = (cids: string[]) => {
    let symbolCount = 0
    const files = new Set<string>()
    for (const cid of cids) {
      symbolCount += facts[cid]?.nodeCount ?? 0
      for (const nid of nodesByContainer.get(cid) ?? []) {
        const file = nodesById[nid]?.file
        if (file) files.add(file)
      }
    }
    return { symbolCount, fileCount: files.size }
  }

  const debtOver = (cids: string[]): ScopeDebtReadout => {
    const cset = new Set(cids)
    let total = 0
    let fallback = 0
    let unknown = 0
    for (const [nid, hit] of inboundByNode) {
      const node = nodesById[nid]
      if (!node || !cset.has(node.container)) continue
      total += hit.total
      fallback += hit.fallback
      unknown += hit.unknown
    }
    return {
      inboundCrossDomain: total,
      fallbackBucket: fallback,
      unknownKind: unknown,
      ratio: total === 0 ? null : fallback / total,
    }
  }

  const entriesOver = (cids: string[]): ScopeEntryRef[] => {
    const cset = new Set(cids)
    return entries.filter((entry) => cset.has(nodesById[entry.id]?.container ?? ''))
  }

  const dispersionOver = (domainId: string, cids: string[]): RegistrationDispersion => {
    const domainEntries = entriesOver(cids)
    const files = new Set(domainEntries.map((entry) => nodesById[entry.id]?.file).filter(Boolean))
    return {
      domainId,
      entries: domainEntries.length,
      files: files.size,
      concentrated: files.size === 1 && domainEntries.length > 3,
    }
  }

  const domainResponsibility = (domainId: string): ResponsibilityState => {
    // 与 besttree.declaredResponsibilityOf 同一口径：空串正文视同未声明，禁兜底回退。
    const text = input.decls?.[domainId]?.responsibility
    return text ? { state: 'declared', text } : { state: 'undeclared' }
  }

  // 不变式投影（R3）：「无 decl 文件」「有文件但零条」「有条目」是三个独立事实，
  // 三态互斥；testRef 缺席的条目不带该键（沿 entries.channel 的键缺席语义）。
  const domainInvariants = (domainId: string): ScopeInvariants => {
    const decl = input.decls?.[domainId]
    if (!decl) return { state: 'no-decl' }
    const items = decl.invariants ?? []
    return items.length
      ? {
          state: 'present',
          items: items.map((inv) => ({
            text: inv.text,
            ...(inv.testRef === undefined ? {} : { testRef: inv.testRef }),
          })),
        }
      : { state: 'unwritten' }
  }

  // 容器职责唯一合法推导（§2.3-26）：只有「类型方法」容器可推导——同名**类型**节点
  // （kind='model'）的 doc 摘要，且候选节点的文件目录必须落在容器自身成员的目录集合内；
  // 全局取首个同名会张冠李戴（spec 走查实录：opencode.Adapter 拿到过 claudecode 的注释）。
  // 同名 = label 最后一个 `.` 之后的类型段；2026-08-27 实测教训是真数据 label 带包前缀时，裸名匹配恒不匹配。
  // 其余 kind 没有职责主体 → no-subject，不硬凑；类型方法匹配失败 → undeclared。
  const containerResponsibility = (containerId: string): ResponsibilityState => {
    const def = containersDef[containerId]
    if (!def || def.kind !== '类型方法') return { state: 'no-subject' }
    const dirs = new Set((nodesByContainer.get(containerId) ?? []).map((nid) => packageDir(nodesById[nid]?.file ?? '')))
    let matched: { id: string; text: string } | null = null
    for (const [nid, node] of Object.entries(nodesById)) {
      if (node.kind !== 'model' || node.name !== bareTypeName(def.label)) continue
      if (!dirs.has(packageDir(node.file))) continue
      if (!matched || nid < matched.id) matched = { id: nid, text: node.summary ?? '' }
    }
    return matched && matched.text ? { state: 'declared', text: matched.text } : { state: 'undeclared' }
  }

  const nodes: ScopeNode[] = seeds.map((seed) => {
    const cids = seed.kind === 'domain' ? subtreeContainersOf(seed.domainId) : [seed.id]
    const { symbolCount, fileCount } = statsOver(cids)
    const responsibility = seed.kind === 'domain'
      ? domainResponsibility(seed.domainId)
      : containerResponsibility(seed.id)
    return {
      id: seed.id,
      kind: seed.kind,
      label: seed.kind === 'domain' ? view.labelOf(seed.domainId) : containersDef[seed.id]?.label ?? seed.id,
      type: seed.kind === 'domain' ? view.typeOf(seed.domainId) : containersDef[seed.id]?.kind ?? '',
      isolated: false,
      childCount: seed.kind === 'domain' ? view.childrenOf(seed.domainId).length : 0,
      containerCount: cids.length,
      symbolCount,
      fileCount,
      oversized: seed.kind === 'container' && symbolCount > OVERSIZE_CONTAINER_SYMBOLS,
      dir: seed.kind === 'container' ? facts[seed.id]?.dir ?? '' : '',
      ports: [],
      entries: entriesOver(cids),
      responsibility,
      entryDispersion: seed.kind === 'domain' ? dispersionOver(seed.domainId, cids) : null,
      invariants: seed.kind === 'domain' ? domainInvariants(seed.domainId) : null,
      debt: seed.kind === 'domain' ? debtOver(cids) : null,
    }
  })
  nodes.sort((a, b) => a.id.localeCompare(b.id))

  const edges: ScopeEdge[] = []
  for (const [key, agg] of callAgg) {
    edges.push({ key, from: agg.from, to: agg.to, weight: agg.weight, kind: 'call' })
  }
  for (const agg of projAgg.values()) {
    edges.push({
      key: `${agg.from}->${agg.to}:${agg.projectionType}`,
      from: agg.from, to: agg.to, weight: agg.weight,
      kind: 'projection', projectionType: agg.projectionType,
    })
  }
  edges.sort((a, b) => a.key.localeCompare(b.key))

  // 孤立与端口：孤立只认 call 入/出边（projection 不抵孤立）；端口含两类边——画布要画全部连线。
  const inboundCallWeight = new Set<string>()
  const outboundCallWeight = new Set<string>()
  const portAcc = new Map<string, Map<string, ScopePort>>()
  const addPort = (cardId: string, neighborId: string, direction: 'in' | 'out', weight: number) => {
    const ports = portAcc.get(cardId) ?? new Map<string, ScopePort>()
    if (!portAcc.has(cardId)) portAcc.set(cardId, ports)
    const portKey = `${direction}:${neighborId}`
    const prev = ports.get(portKey)
    ports.set(portKey, { neighborId, direction, weight: (prev?.weight ?? 0) + weight })
  }
  for (const edge of edges) {
    if (edge.kind === 'call') {
      inboundCallWeight.add(edge.to)
      outboundCallWeight.add(edge.from)
    }
    addPort(edge.from, edge.to, 'out', edge.weight)
    addPort(edge.to, edge.from, 'in', edge.weight)
  }
  for (const edge of externalCallAgg.values()) {
    addPort(edge.from, edge.to, 'out', edge.weight)
    addPort(edge.to, edge.from, 'in', edge.weight)
  }
  for (const node of nodes) {
    node.isolated = !inboundCallWeight.has(node.id) && !outboundCallWeight.has(node.id)
    node.ports = [...(portAcc.get(node.id)?.values() ?? [])]
      .sort((a, b) => a.neighborId.localeCompare(b.neighborId) || a.direction.localeCompare(b.direction))
  }

  // 符号粒度对外面：目标在 scope 子树、调用方在子树外的跨域边按被调符号聚合。
  // 根层自然为空（系统外无调用方）；折叠判据（§2.3-23）在此一次算定。
  const classifyKind = (kind: string): InboundSeam['kindClass'] => {
    if (!isInVocabulary(kind)) return 'unknown'
    if (isFallbackKind(kind)) return 'fallback'
    if ((REAL_KERNEL_KINDS as readonly string[]).includes(kind)) return 'real-kernel'
    return 'other'
  }
  const seamAgg = new Map<string, Set<string>>()
  for (const [from, to] of baseline.edges) {
    const fromLeaf = nodeLeafDomain.get(from) ?? ''
    const toLeaf = nodeLeafDomain.get(to) ?? ''
    if (!fromLeaf || !toLeaf || fromLeaf === toLeaf) continue
    if (!(scopeId === null || scopeSubtree.has(toLeaf))) continue
    if (scopeSubtree.has(fromLeaf)) continue
    const callers = seamAgg.get(to) ?? new Set<string>()
    callers.add(nodeTop.get(from) ?? '')
    seamAgg.set(to, callers)
  }
  const inboundSeams: InboundSeam[] = [...seamAgg.entries()].map(([nodeId, callers]) => {
    const node = nodesById[nodeId]
    const containerId = node?.container ?? ''
    const containerKind = containersDef[containerId]?.kind ?? ''
    const kindClass = classifyKind(containerKind)
    const reuse = reuseCount.get(nodeId) ?? 0
    return {
      nodeId,
      name: node?.name ?? nodeId,
      containerId,
      containerLabel: containersDef[containerId]?.label ?? containerId,
      containerKind,
      kindClass,
      reuse,
      folded: kindClass === 'fallback' && reuse >= NOISE_FOLD_REUSE_THRESHOLD,
      callerDomains: [...callers].filter(Boolean).sort(),
    }
  }).sort((a, b) => b.reuse - a.reuse || a.nodeId.localeCompare(b.nodeId))

  const noEntities = !scopeContainerIds.some(
    (cid) => (nodesByContainer.get(cid) ?? []).some((nid) => entityIds.has(nid)),
  )

  return {
    scopeId,
    organization: input.organization,
    organizationAvailable: true,
    nodes,
    edges,
    inboundSeams,
    externalOut: [...externalOutAgg.values()].sort((a, b) => a.neighborId.localeCompare(b.neighborId)),
    empty: {
      // 根层没有单一职责格位，noDeclaration 恒 false；领域层的声明格位缺席必须显形。
      noDeclaration: scopeId !== null && !input.decls?.[scopeId]?.responsibility,
      noEntities,
      noInboundSeams: inboundSeams.length === 0,
    },
  }
}
