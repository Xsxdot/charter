// types.ts —— Go codegraph JSON wire 的 viewer 镜像。
// 边界：只描述 provider 返回的数据，不转换 optional 字段或引入宿主类型。
export interface CgMeta { project: string; branch: string; commit: string; scannedAt: string; generator: string }
export interface CgTestRef { name: string; file: string }
export interface CgDomain { label: string; kind: string; summary?: string; desc?: string; parent?: string }
export interface CgContainer { label: string; kind: string; entry?: boolean; domain?: string }
export interface CgNode {
  kind: 'entry' | 'func' | 'model'; container: string; order?: number; name: string; file: string; line: number
  signature?: string; signatureOld?: string; params?: string[][]; returns?: string; summary?: string
  tests?: CgTestRef[]; fields?: string[][]; unscanned?: boolean; projScanned?: boolean
}
export interface CgLifecycleRef { who: string; model: string; kind: 'creator' | 'writer'; field?: string }
export interface CgGraph {
  meta: CgMeta; domains?: Record<string, CgDomain>; containers: Record<string, CgContainer>; nodes: Record<string, CgNode>
  edges: [string, string][]; implements?: [string, string][]; projections?: [string, string, string][]; lifecycle?: CgLifecycleRef[]
  /** 包摘要段（目录 → 包 doc 摘要），v0.6.0 additive-only 键（B231）；消费归三期。 */
  packages?: Record<string, { summary: string }>
}
export interface CgDiff {
  view: string; base?: string; summary?: string; containersAdded?: Record<string, CgContainer>
  nodesAdded?: Record<string, CgNode>; nodesModified?: Record<string, CgNode>; nodesDeleted?: string[]
  edgesAdded?: [string, string][]; edgesDeleted?: [string, string][]
  implementsAdded?: [string, string][]; implementsDeleted?: [string, string][]
  projectionsAdded?: [string, string, string][]; projectionsDeleted?: [string, string, string][]
  lifecycleAdded?: CgLifecycleRef[]; lifecycleDeleted?: CgLifecycleRef[]
}
export interface CgStaleNode { id: string; file: string; line: number; reason: string }
// —— C1.3 对照数据三键：graph v0.5.0 库类型的逐字镜像（契约 C5，见
// charter docs/contracts/2026-08-24-codegraph-viewer-compare-contract.md）。
// 字段名与库 JSON tag 一致；三键可选，缺席即分级降级（契约 C2/C6）。

/** CgBestDomain 理想树领域：parent 为空即顶层子系统。 */
export interface CgBestDomain { label: string; responsibility: string; parent?: string; type?: string }

/** CgBest 最优图：理想结构树 + 现状容器归属映射。 */
export interface CgBest {
  meta: { version: number; project: string }
  domains: Record<string, CgBestDomain>
  containers: Record<string, string>
}

/** CgContract 契约面单方向：预算为直调数棘轮，entries 是合法窄缝。 */
export interface CgContract {
  from: string
  to: string
  entries?: string[]
  interfaces?: string[]
  legacyBudget?: number
  legacyBudgetNote?: string
}

/** CgTarget 契约图 v3：只剩契约面，结构树住 CgBest。 */
export interface CgTarget {
  meta: { version: number; project: string }
  assembly?: string[]
  contracts?: CgContract[]
}

/** CgFinding 执法发现：kind 词表见契约 C7，未知 kind 必须走缺省渲染。 */
export interface CgFinding { kind: string; from?: string; to?: string; edge?: [string, string]; detail: string }

/** CgBestCoverage 归属覆盖读数。 */
export interface CgBestCoverage {
  assignedContainers: number
  viewContainers: number
  crossDomainEdges: number
  misplacedSkipped: number
}

/** CgCheckReport 宿主算好的执法报告（baseline 口径，契约 C3）。 */
export interface CgCheckReport {
  fails: CgFinding[]
  warns: CgFinding[]
  legacyHits?: Record<string, number>
  bestCoverage?: CgBestCoverage
}

export interface CodegraphResp {
  baseline: CgGraph
  views: Record<string, CgDiff>
  stale: CgStaleNode[]
  best?: CgBest
  target?: CgTarget
  report?: CgCheckReport
}
export interface CgSourceResp { file: string; from: number; lines: string[] }
