// domainpage —— C1.10 领域页语义/结构模型派生器。
//
// 纯函数层：不请求网络、不访问 DOM、不在组件内聚合；组件只消费本文件输出的
// 语义、端口、泳道和级联列模型。四个阈值是查看器与图算法之间的固定契约，不能
// 从响应、URL、本地存储、环境变量或用户配置覆盖。
import type {
  CgBest,
  CgDomainDecl,
  CgDomainDecls,
  CgGraph,
  CgNode,
} from '../../api/types'

export type DomainOrganization = 'best' | 'current'

export const DOMAIN_CASCADE_DEPTH = 3
export const DOMAIN_FOCUS_QUOTA = 5
export const DOMAIN_LEVEL_NODE_LIMIT = 8
export const DOMAIN_SHARED_CALLER_DOMAINS = 3

export interface DomainPageInput {
  baseline: CgGraph
  best?: CgBest
  decls?: CgDomainDecls
  organization: DomainOrganization
  domainId: string
}

export interface EmptyStates {
  noDeclaration: boolean
  noInvariants: boolean
  noEntities: boolean
  noInboundSeams: boolean
}

export interface EntityReadout {
  id: string
  node: CgNode
  creators: string[]
  writers: Array<{ id: string; field?: string }>
}

export interface PackageReadout {
  dir: string
  summary: string
}

export interface SemanticViewModel {
  domainId: string
  label: string
  declaration?: CgDomainDecl
  declaredDomainCount: number
  totalDomainCount: number
  entities: EntityReadout[]
  packages: PackageReadout[]
  empty: EmptyStates
}

export interface DomainPort {
  domainId: string
  label: string
  edgeCount: number
}

export interface FocusTruncation {
  total: number
  shown: number
  reason: 'focus-quota'
}

export interface CascadeNode {
  id: string
  depth: number
  name: string
  summary?: string
  collapsed: boolean
  collapseReason?: 'shared-by-domains'
}

export interface CascadeColumn {
  depth: number
  nodes: CascadeNode[]
  droppedNodes: number
  truncated: boolean
  depthLimit: boolean
}

export interface DomainLane {
  key: string
  fromDomainId: string
  focusNodeId: string
  columns: CascadeColumn[]
}

export interface StructureViewModel {
  domainId: string
  inboundPorts: DomainPort[]
  lanes: DomainLane[]
  outboundPorts: DomainPort[]
  inboundEdgeCount: number
  focusTruncation?: FocusTruncation
  noInboundSeams: boolean
}

export interface DomainPageModel {
  organization: DomainOrganization
  organizationAvailable: boolean
  semantic: SemanticViewModel
  structure: StructureViewModel
}

interface EdgeContext {
  from: string
  to: string
  index: number
  fromDomain: string
  toDomain: string
}

interface DomainLike {
  label: string
}

function domainTable(input: DomainPageInput): Record<string, DomainLike> {
  if (input.organization === 'best') return input.best?.domains ?? {}
  return input.baseline.domains ?? {}
}

function containerDomain(input: DomainPageInput, containerId: string): string {
  if (input.organization === 'best') return input.best?.containers[containerId] ?? ''
  return input.baseline.containers[containerId]?.domain ?? ''
}

function edgeContexts(input: DomainPageInput): EdgeContext[] {
  return input.baseline.edges.flatMap(([from, to], index) => {
    const fromNode = input.baseline.nodes[from]
    const toNode = input.baseline.nodes[to]
    if (!fromNode || !toNode) return []
    const fromDomain = containerDomain(input, fromNode.container)
    const toDomain = containerDomain(input, toNode.container)
    if (!fromDomain || !toDomain || fromDomain === toDomain) return []
    return [{ from, to, index, fromDomain, toDomain }]
  })
}

function callerDomainsByNode(input: DomainPageInput): Map<string, Set<string>> {
  const callers = new Map<string, Set<string>>()
  for (const [from, to] of input.baseline.edges) {
    const fromNode = input.baseline.nodes[from]
    const toNode = input.baseline.nodes[to]
    if (!fromNode || !toNode) continue
    const fromDomain = containerDomain(input, fromNode.container)
    if (!fromDomain) continue
    const domains = callers.get(to) ?? new Set<string>()
    domains.add(fromDomain)
    callers.set(to, domains)
  }
  return callers
}

function distinct<T>(values: T[]): T[] {
  return [...new Set(values)]
}

function portsFor(edges: EdgeContext[], side: 'fromDomain' | 'toDomain', table: Record<string, DomainLike>): DomainPort[] {
  const counts = new Map<string, number>()
  for (const edge of edges) {
    const domainId = edge[side]
    counts.set(domainId, (counts.get(domainId) ?? 0) + 1)
  }
  return [...counts].map(([domainId, edgeCount]) => ({
    domainId,
    label: table[domainId]?.label ?? domainId,
    edgeCount,
  }))
}

function packageDir(file: string): string {
  const slash = file.lastIndexOf('/')
  return slash < 0 ? '' : file.slice(0, slash)
}

function semanticModel(input: DomainPageInput, table: Record<string, DomainLike>, selectedContainers: Set<string>): SemanticViewModel {
  const declaration = input.decls?.[input.domainId]
  const vocabulary = input.best?.domains ?? input.baseline.domains ?? {}
  const selectedNodes = Object.entries(input.baseline.nodes)
    .filter(([, node]) => selectedContainers.has(node.container))
  const entities = selectedNodes
    .filter(([, node]) => node.kind === 'model' && node.modelKind === 'entity')
    .map(([id, node]) => ({
      id,
      node,
      creators: (input.baseline.lifecycle ?? [])
        .filter((ref) => ref.model === id && ref.kind === 'creator')
        .map((ref) => ref.who),
      writers: (input.baseline.lifecycle ?? [])
        .filter((ref) => ref.model === id && ref.kind === 'writer')
        .map((ref) => ({ id: ref.who, ...(ref.field === undefined ? {} : { field: ref.field }) })),
    }))
  const packageDirs = distinct(selectedNodes.map(([, node]) => packageDir(node.file))).sort()
  const packages = packageDirs
    .filter((dir) => input.baseline.packages?.[dir] !== undefined)
    .map((dir) => ({ dir, summary: input.baseline.packages?.[dir]?.summary ?? '' }))
  return {
    domainId: input.domainId,
    label: table[input.domainId]?.label ?? input.domainId,
    declaration,
    declaredDomainCount: Object.keys(vocabulary).filter((id) => input.decls?.[id] !== undefined).length,
    totalDomainCount: Object.keys(vocabulary).length,
    entities,
    packages,
    empty: {
      noDeclaration: declaration === undefined,
      noInvariants: declaration?.invariants?.length !== undefined ? declaration.invariants.length === 0 : true,
      noEntities: entities.length === 0,
      noInboundSeams: false,
    },
  }
}

function cascadeColumns(
  input: DomainPageInput,
  domainId: string,
  focusId: string,
  callerDomains: Map<string, Set<string>>,
): CascadeColumn[] {
  const columns: CascadeColumn[] = []
  const sameDomainEdges = input.baseline.edges.flatMap(([from, to]) => {
    const fromNode = input.baseline.nodes[from]
    const toNode = input.baseline.nodes[to]
    if (!fromNode || !toNode) return []
    if (containerDomain(input, fromNode.container) !== domainId || containerDomain(input, toNode.container) !== domainId) return []
    return [{ from, to }]
  })
  let candidateIds = [focusId]
  for (let depth = 0; depth <= DOMAIN_CASCADE_DEPTH; depth += 1) {
    const uniqueIds = distinct(candidateIds).filter((id) => input.baseline.nodes[id] !== undefined)
    const candidates = uniqueIds.map((id): CascadeNode => {
      const node = input.baseline.nodes[id]
      const collapsed = (callerDomains.get(id)?.size ?? 0) >= DOMAIN_SHARED_CALLER_DOMAINS
      return {
        id,
        depth,
        name: node.name,
        ...(node.summary === undefined ? {} : { summary: node.summary }),
        collapsed,
        ...(collapsed ? { collapseReason: 'shared-by-domains' as const } : {}),
      }
    })
    const nodes = candidates.slice(0, DOMAIN_LEVEL_NODE_LIMIT)
    columns.push({
      depth,
      nodes,
      droppedNodes: Math.max(0, candidates.length - nodes.length),
      truncated: candidates.length > nodes.length,
      depthLimit: depth === DOMAIN_CASCADE_DEPTH,
    })
    if (depth === DOMAIN_CASCADE_DEPTH) break
    const expandable = new Set(nodes.filter((node) => !node.collapsed).map((node) => node.id))
    const next: string[] = []
    for (const edge of sameDomainEdges) {
      if (expandable.has(edge.from) && !next.includes(edge.to)) next.push(edge.to)
    }
    candidateIds = next
  }
  return columns
}

/** C1.10 主缝：由组件层调用；输入图、最优树和声明只读，返回可渲染模型。 */
export function deriveDomainPage(input: DomainPageInput): DomainPageModel {
  const table = domainTable(input)
  const organizationAvailable = input.organization === 'current' || input.best !== undefined
  const selectedContainers = new Set(
    Object.keys(input.baseline.containers).filter((id) => containerDomain(input, id) === input.domainId),
  )
  const activeEdges = edgeContexts(input)
  const allCallerDomains = callerDomainsByNode(input)
  const inboundEdges = activeEdges.filter((edge) => edge.toDomain === input.domainId)
  const outboundEdges = activeEdges.filter((edge) => edge.fromDomain === input.domainId)
  const semantic = semanticModel(input, table, selectedContainers)
  const focusEdges = inboundEdges.slice(0, DOMAIN_FOCUS_QUOTA)
  const lanes: DomainLane[] = focusEdges.map((edge) => ({
    key: `${edge.fromDomain}->${input.domainId}:${edge.from}->${edge.to}:${edge.index}`,
    fromDomainId: edge.fromDomain,
    focusNodeId: edge.to,
    columns: cascadeColumns(input, input.domainId, edge.to, allCallerDomains),
  }))
  const structure: StructureViewModel = {
    domainId: input.domainId,
    inboundPorts: portsFor(inboundEdges, 'fromDomain', table),
    lanes,
    outboundPorts: portsFor(outboundEdges, 'toDomain', table),
    inboundEdgeCount: inboundEdges.length,
    ...(inboundEdges.length > DOMAIN_FOCUS_QUOTA ? {
      focusTruncation: { total: inboundEdges.length, shown: focusEdges.length, reason: 'focus-quota' as const },
    } : {}),
    noInboundSeams: inboundEdges.length === 0,
  }
  semantic.empty.noInboundSeams = structure.noInboundSeams
  return {
    organization: input.organization,
    organizationAvailable,
    semantic,
    structure,
  }
}
