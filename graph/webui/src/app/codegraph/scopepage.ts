// scopepage —— C12 结构轴的唯一视图模型派生器。
//
// 一个页面按 scope 变：根是顶层领域（子系统），中间层是直接子领域，叶子层是
// 容器。所有层共用同一模型形状；组件只把模型投影成 DOM，不在 JSX 内重算读数。
import type {
  CgBest, CgContainer, CgDomain, CgDomainDecls, CgGraph, CgTarget,
} from '../../api/types'
import { CG_CONTAINER_KINDS, CG_FALLBACK_CONTAINER_KINDS } from '../../api/types'

export type ScopeOrganization = 'best' | 'current'
export type ScopeItemKind = 'domain' | 'container'
export type ScopeEdgeKind = 'call' | 'projection'
export type DebtColor = 'declared' | 'over-budget' | 'dead-contract' | 'new-direction'

export const FALLBACK_REUSE_THRESHOLD = 10
export const OVERSIZED_SYMBOL_THRESHOLD = 40

export interface ScopePageInput {
  baseline: CgGraph
  best?: CgBest
  decls?: CgDomainDecls
  target?: CgTarget
  organization: ScopeOrganization
  scopeId: string | null
}

export interface ScopeDomainItem {
  id: string
  label: string
  kind: 'domain'
  itemType: 'domain'
  organization: ScopeOrganization
  responsibility: string
  declarationPath?: string
  hasChildren: boolean
  childCount: number
  containerCount: number
  entityCount: number
  inboundCount: number
  outboundCount: number
  isolated: boolean
  isolationReason?: string
}

export interface ScopeContainerItem {
  id: string
  label: string
  kind: string
  itemType: 'container'
  nodeIds: string[]
  symbolCount: number
  fileCount: number
  files: string[]
  domainId: string
  responsibility: string
  noSubject: boolean
  noDeclaration: boolean
  noEntities: boolean
  noInboundSeams: boolean
  isOversized: boolean
  fallbackBucket: boolean
  collapsed: boolean
  collapsedSymbolIds: string[]
  visibleSymbolIds: string[]
  reuseDegree: number
  sharedKernel: 'true' | 'false' | 'not-shared'
  debtColor: DebtColor
}

export type ScopeItem = ScopeDomainItem | ScopeContainerItem

export interface ScopeEdge {
  id: string
  from: string
  to: string
  count: number
  kind: ScopeEdgeKind
  nonCall: boolean
  label?: string
}

export interface ScopePort {
  domainId: string
  label: string
  count: number
}

export interface ScopeReadouts {
  fallbackBucketPercentage: number | null
  fallbackBucketShare: { numerator: number; denominator: number; percentage: number | null }
  unknownKindEdges: number
  reuseByNode: Record<string, number>
  trueSharedKernelNodes: string[]
  falseSharedKernelNodes: string[]
  unreachableNodes: string[]
  touchedDomainCount: number
  fallbackBucketRatio: number | null
}

export interface ScopeEmptyState {
  noDeclaration: boolean
  noEntities: boolean
  noInboundSeams: boolean
}

export interface ScopePageModel {
  scopeId: string | null
  organization: ScopeOrganization
  available: boolean
  unavailableReason?: string
  degraded: boolean
  degradedReason?: string
  level: 'root' | 'domain' | 'containers'
  title: string
  nodes: ScopeItem[]
  domains: ScopeDomainItem[]
  containers: ScopeContainerItem[]
  edges: ScopeEdge[]
  projectionEdges: ScopeEdge[]
  inboundPorts: ScopePort[]
  outboundPorts: ScopePort[]
  readouts: ScopeReadouts
  empty: ScopeEmptyState
  noDeclaration: boolean
  noEntities: boolean
  noInboundSeams: boolean
  isolated: boolean
  isolationReason?: string
  nestedFrame: boolean
}

const KNOWN_KINDS = new Set<string>(CG_CONTAINER_KINDS)
const FALLBACK_KINDS = new Set<string>(CG_FALLBACK_CONTAINER_KINDS)

export function isKnownContainerKind(kind: string): boolean {
  return KNOWN_KINDS.has(kind)
}

export function isFallbackContainerKind(kind: string): boolean {
  return FALLBACK_KINDS.has(kind)
}

interface DomainTable {
  domains: Record<string, CgDomain>
  containerDomain: Record<string, string>
  responsibility: Record<string, string>
}

function tableFor(input: ScopePageInput): DomainTable | null {
  if (input.organization === 'best') {
    if (!input.best) return null
    const domains: Record<string, CgDomain> = {}
    const responsibility: Record<string, string> = {}
    for (const [id, domain] of Object.entries(input.best.domains)) {
      domains[id] = { label: domain.label, kind: domain.type ?? '', parent: domain.parent }
      responsibility[id] = input.decls?.[id]?.responsibility ?? ''
    }
    return { domains, containerDomain: { ...input.best.containers }, responsibility }
  }
  const domains = input.baseline.domains ?? {}
  const containerDomain: Record<string, string> = {}
  for (const [id, container] of Object.entries(input.baseline.containers)) {
    if (container.domain) containerDomain[id] = container.domain
  }
  const responsibility: Record<string, string> = {}
  for (const id of Object.keys(domains)) responsibility[id] = input.decls?.[id]?.responsibility ?? ''
  return { domains, containerDomain, responsibility }
}

function liveNode(node: object | undefined): boolean {
  return !!node && (node as { status?: string }).status !== 'deleted'
}

function domainForNode(input: ScopePageInput, table: DomainTable, nodeId: string): string {
  const node = input.baseline.nodes[nodeId]
  if (!node) return ''
  return table.containerDomain[node.container] ?? ''
}

function rootOf(domains: Record<string, CgDomain>, id: string): string {
  let current = id
  const seen = new Set<string>()
  while (current && domains[current] && !seen.has(current)) {
    seen.add(current)
    const parent = domains[current].parent ?? ''
    if (!parent) return current
    current = parent
  }
  return ''
}

function descendantsOf(domains: Record<string, CgDomain>, root: string): Set<string> {
  const out = new Set<string>()
  if (!domains[root]) return out
  const queue = [root]
  while (queue.length) {
    const id = queue.shift()!
    if (out.has(id) || !domains[id]) continue
    out.add(id)
    for (const [childId, domain] of Object.entries(domains)) {
      if (domain.parent === id) queue.push(childId)
    }
  }
  return out
}

function directChildren(domains: Record<string, CgDomain>, parent: string | null): string[] {
  return Object.entries(domains)
    .filter(([, domain]) => parent === null ? !domain.parent : domain.parent === parent)
    .map(([id]) => id)
    .sort()
}

function packageOf(file: string): string {
  const index = file.lastIndexOf('/')
  return index < 0 ? '' : file.slice(0, index)
}

function nodeNameMatches(container: CgContainer, nodeName: string): boolean {
  if (nodeName === container.label) return true
  const label = container.label.split('.').at(-1) ?? container.label
  return nodeName === label || nodeName.endsWith(`.${label}`)
}

function containerResponsibility(
  input: ScopePageInput,
  container: CgContainer,
  nodeIds: string[],
): { text: string; noSubject: boolean } {
  if (isFallbackContainerKind(container.kind) || container.kind === '实体') {
    return { text: '无职责主体', noSubject: true }
  }
  const containerPackages = new Set(nodeIds.map((id) => packageOf(input.baseline.nodes[id]?.file ?? '')).filter(Boolean))
  const typeNodes = Object.values(input.baseline.nodes)
    .filter((node) => node.kind === 'model' && nodeNameMatches(container, node.name) && !!node.summary)
  for (const node of typeNodes) {
    const nodePackage = packageOf(node.file)
    const samePackage = containerPackages.has(nodePackage)
    if (samePackage) return { text: node.summary ?? '', noSubject: false }
  }
  return { text: '', noSubject: false }
}

function adjacency(graph: CgGraph): Record<string, string[]> {
  const out: Record<string, string[]> = {}
  for (const [from, to] of graph.edges) {
    if (!liveNode(graph.nodes[from]) || !liveNode(graph.nodes[to])) continue
    ;(out[from] ??= []).push(to)
  }
  return out
}

function reuseDegrees(graph: CgGraph): Record<string, number> {
  const out = adjacency(graph)
  const entries = Object.entries(graph.nodes).filter(([, node]) => node.kind === 'entry' && liveNode(node))
  const reached = new Map<string, Set<string>>()
  for (const [entryId] of entries) {
    const queue = [entryId]
    const seen = new Set<string>()
    while (queue.length) {
      const id = queue.shift()!
      if (seen.has(id)) continue
      seen.add(id)
      let owners = reached.get(id)
      if (!owners) { owners = new Set<string>(); reached.set(id, owners) }
      owners.add(entryId)
      queue.push(...(out[id] ?? []))
    }
  }
  const result: Record<string, number> = {}
  for (const id of Object.keys(graph.nodes)) result[id] = reached.get(id)?.size ?? 0
  return result
}

function domainLabel(table: DomainTable, id: string): string {
  return table.domains[id]?.label ?? id
}

function endpointFor(
  table: DomainTable,
  scopeId: string | null,
  domainId: string,
  visibleDomains: Set<string>,
  visibleContainers: Set<string>,
  containerId: string,
): string {
  if (visibleContainers.has(containerId)) return containerId
  if (scopeId === null) return rootOf(table.domains, domainId)
  let current = domainId
  const seen = new Set<string>()
  while (current && !seen.has(current)) {
    if (visibleDomains.has(current)) return current
    seen.add(current)
    current = table.domains[current]?.parent ?? ''
  }
  return ''
}

function edgeProjection(
  input: ScopePageInput,
  table: DomainTable,
  scopeId: string | null,
  visibleDomains: Set<string>,
  visibleContainers: Set<string>,
): ScopeEdge[] {
  const counts = new Map<string, ScopeEdge>()
  for (const [fromNode, toNode, kind] of input.baseline.projections ?? []) {
    const fromDomain = domainForNode(input, table, fromNode)
    const toDomain = domainForNode(input, table, toNode)
    const from = endpointFor(table, scopeId, fromDomain, visibleDomains, visibleContainers, input.baseline.nodes[fromNode]?.container ?? '')
    const to = endpointFor(table, scopeId, toDomain, visibleDomains, visibleContainers, input.baseline.nodes[toNode]?.container ?? '')
    if (!from || !to || from === to) continue
    const id = `projection:${from}->${to}:${kind}`
    const current = counts.get(id)
    if (current) current.count += 1
    else counts.set(id, { id, from, to, count: 1, kind: 'projection', nonCall: true, label: `${kind} · 不是调用边` })
  }
  return [...counts.values()].sort((a, b) => a.id.localeCompare(b.id))
}

function directCallEdges(
  input: ScopePageInput,
  table: DomainTable,
  scopeId: string | null,
  visibleDomains: Set<string>,
  visibleContainers: Set<string>,
): ScopeEdge[] {
  const counts = new Map<string, ScopeEdge>()
  for (const [fromNode, toNode] of input.baseline.edges) {
    if (!liveNode(input.baseline.nodes[fromNode]) || !liveNode(input.baseline.nodes[toNode])) continue
    const fromDomain = domainForNode(input, table, fromNode)
    const toDomain = domainForNode(input, table, toNode)
    const from = endpointFor(table, scopeId, fromDomain, visibleDomains, visibleContainers, input.baseline.nodes[fromNode]?.container ?? '')
    const to = endpointFor(table, scopeId, toDomain, visibleDomains, visibleContainers, input.baseline.nodes[toNode]?.container ?? '')
    if (!from || !to || from === to) continue
    const id = `call:${from}->${to}`
    const current = counts.get(id)
    if (current) current.count += 1
    else counts.set(id, { id, from, to, count: 1, kind: 'call', nonCall: false })
  }
  return [...counts.values()].sort((a, b) => a.id.localeCompare(b.id))
}

function edgeCountsForDomain(input: ScopePageInput, table: DomainTable, domainId: string): { inbound: number; outbound: number } {
  const subtree = descendantsOf(table.domains, domainId)
  let inbound = 0
  let outbound = 0
  for (const [from, to] of input.baseline.edges) {
    if (!liveNode(input.baseline.nodes[from]) || !liveNode(input.baseline.nodes[to])) continue
    const fromDomain = domainForNode(input, table, from)
    const toDomain = domainForNode(input, table, to)
    if (fromDomain !== toDomain && subtree.has(toDomain)) inbound += 1
    if (fromDomain !== toDomain && subtree.has(fromDomain)) outbound += 1
  }
  return { inbound, outbound }
}

function debtColor(input: ScopePageInput, fromDomain: string, toDomain: string, calls: number): DebtColor {
  const contract = input.target?.contracts?.find((candidate) => candidate.from === fromDomain && candidate.to === toDomain)
  if (!contract) return input.target ? 'new-direction' : 'declared'
  if (contract.legacyBudget !== undefined && calls > contract.legacyBudget) return 'over-budget'
  return 'declared'
}

export function deriveScopePage(input: ScopePageInput): ScopePageModel {
  const table = tableFor(input)
  const unavailableReason = table ? undefined : '按最优树不可用：缺少 best.json；不会拿现状领域冒充最优树'
  const emptyReadouts: ScopeReadouts = {
    fallbackBucketPercentage: null,
    fallbackBucketShare: { numerator: 0, denominator: 0, percentage: null },
    unknownKindEdges: 0, reuseByNode: {}, trueSharedKernelNodes: [], falseSharedKernelNodes: [],
    unreachableNodes: [], touchedDomainCount: 0, fallbackBucketRatio: null,
  }
  const empty: ScopeEmptyState = { noDeclaration: false, noEntities: false, noInboundSeams: true }
  if (!table) {
    return {
      scopeId: input.scopeId, organization: input.organization, available: false,
      unavailableReason, degraded: true, degradedReason: unavailableReason,
      level: 'root', title: '最优树不可用', nodes: [], domains: [], containers: [], edges: [], projectionEdges: [],
      inboundPorts: [], outboundPorts: [], readouts: emptyReadouts, empty,
      noDeclaration: false, noEntities: false, noInboundSeams: true, isolated: false, nestedFrame: false,
    }
  }

  const domainIds = input.scopeId === null ? directChildren(table.domains, null) : directChildren(table.domains, input.scopeId)
  const childDomainItems: ScopeDomainItem[] = domainIds.map((id) => {
    const counts = edgeCountsForDomain(input, table, id)
    const hasChildren = directChildren(table.domains, id).length > 0
    const subtree = descendantsOf(table.domains, id)
    const containerCount = Object.values(table.containerDomain).filter((assigned) => subtree.has(assigned)).length
    const entityCount = Object.entries(input.baseline.nodes).filter(([nodeId, node]) => {
      return node.kind === 'model' && node.modelKind === 'entity' && subtree.has(domainForNode(input, table, nodeId))
    }).length
    const isolated = counts.inbound + counts.outbound === 0
    return {
      id, label: table.domains[id]?.label ?? id, kind: 'domain', itemType: 'domain', organization: input.organization,
      responsibility: table.responsibility[id] ?? '',
      ...(table.responsibility[id] ? {} : { declarationPath: `codegraph/domains/${id}.json` }),
      hasChildren, childCount: directChildren(table.domains, id).length, containerCount, entityCount,
      inboundCount: counts.inbound, outboundCount: counts.outbound, isolated,
      ...(isolated ? { isolationReason: '未发现跨域调用边（跨语言调用边被禁止建立）' } : {}),
    }
  })
  const containerMode = input.scopeId !== null && childDomainItems.length === 0
  const visibleContainers = new Set<string>()
  const containers: ScopeContainerItem[] = []
  const reuseByNode = reuseDegrees(input.baseline)
  if (containerMode) {
    for (const [id, container] of Object.entries(input.baseline.containers).sort(([a], [b]) => a.localeCompare(b))) {
      if (table.containerDomain[id] !== input.scopeId) continue
      visibleContainers.add(id)
      const nodeIds = Object.entries(input.baseline.nodes)
        .filter(([, node]) => node.container === id && liveNode(node)).map(([nodeId]) => nodeId).sort()
      const files = [...new Set(nodeIds.map((nodeId) => input.baseline.nodes[nodeId]?.file ?? '').filter(Boolean))].sort()
      const symbolIds = nodeIds.filter((nodeId) => input.baseline.nodes[nodeId]?.kind !== 'entry')
      const inboundSymbolIds = symbolIds.filter((nodeId) => input.baseline.edges.some(([from, to]) => {
        if (to !== nodeId) return false
        const fromDomain = domainForNode(input, table, from)
        const toDomain = domainForNode(input, table, to)
        return fromDomain !== toDomain && !!fromDomain && !!toDomain
      }))
      const maxReuse = symbolIds.reduce((max, nodeId) => Math.max(max, reuseByNode[nodeId] ?? 0), 0)
      const folded = isFallbackContainerKind(container.kind)
        ? inboundSymbolIds.filter((nodeId) => (reuseByNode[nodeId] ?? 0) >= FALLBACK_REUSE_THRESHOLD) : []
      const responsibility = containerResponsibility(input, container, nodeIds)
      const domainCalls = input.baseline.edges.filter(([from, to]) => {
        return domainForNode(input, table, from) !== domainForNode(input, table, to)
          && domainForNode(input, table, to) === input.scopeId && input.baseline.nodes[to]?.container === id
      }).length
      const sourceDomains = new Set(input.baseline.edges
        .filter(([, to]) => input.baseline.nodes[to]?.container === id)
        .map(([from]) => domainForNode(input, table, from)).filter(Boolean))
      const kindKnown = isKnownContainerKind(container.kind)
      const noEntities = !nodeIds.some((nodeId) => input.baseline.nodes[nodeId]?.kind === 'model' && input.baseline.nodes[nodeId]?.modelKind === 'entity')
      containers.push({
        id, label: container.label, kind: container.kind, itemType: 'container', nodeIds, symbolCount: symbolIds.length,
        fileCount: files.length, files, domainId: input.scopeId, responsibility: responsibility.text,
        noSubject: responsibility.noSubject, noDeclaration: !responsibility.text && !responsibility.noSubject,
        noEntities, noInboundSeams: inboundSymbolIds.length === 0, isOversized: symbolIds.length > OVERSIZED_SYMBOL_THRESHOLD,
        fallbackBucket: isFallbackContainerKind(container.kind), collapsed: folded.length > 0,
        collapsedSymbolIds: folded, visibleSymbolIds: symbolIds.filter((nodeId) => !folded.includes(nodeId)),
        reuseDegree: maxReuse, sharedKernel: maxReuse >= FALLBACK_REUSE_THRESHOLD
          ? (isFallbackContainerKind(container.kind) ? 'false' : 'true') : 'not-shared',
        debtColor: sourceDomains.size ? debtColor(input, [...sourceDomains][0], input.scopeId, domainCalls) : 'declared',
      })
      // Keep the unknown kind visible. The Go scanner gate reports the hard error;
      // the UI must not silently count it as a fallback bucket.
      void kindKnown
    }
  }
  const domains = childDomainItems
  const visibleDomainSet = new Set(domainIds)
  const callEdges = directCallEdges(input, table, input.scopeId, visibleDomainSet, visibleContainers)
  const projectionEdges = edgeProjection(input, table, input.scopeId, visibleDomainSet, visibleContainers)
  const unknownKinds = Object.entries(input.baseline.containers)
    .filter(([, container]) => !isKnownContainerKind(container.kind)).map(([id]) => id)
  const selectedSubtree = input.scopeId ? descendantsOf(table.domains, input.scopeId) : new Set(domainIds)
  const inboundPortsMap = new Map<string, number>()
  const outboundPortsMap = new Map<string, number>()
  let crossDomainEdges = 0
  let fallbackNumerator = 0
  let unknownKindEdges = 0
  const touched = new Set<string>()
  for (const [from, to] of input.baseline.edges) {
    if (!liveNode(input.baseline.nodes[from]) || !liveNode(input.baseline.nodes[to])) continue
    const fromDomain = domainForNode(input, table, from)
    const toDomain = domainForNode(input, table, to)
    if (!fromDomain || !toDomain || fromDomain === toDomain) continue
    crossDomainEdges += 1; touched.add(fromDomain); touched.add(toDomain)
    const fromIn = selectedSubtree.has(fromDomain)
    const toIn = selectedSubtree.has(toDomain)
    if (toIn && !fromIn) inboundPortsMap.set(fromDomain, (inboundPortsMap.get(fromDomain) ?? 0) + 1)
    if (fromIn && !toIn) outboundPortsMap.set(toDomain, (outboundPortsMap.get(toDomain) ?? 0) + 1)
    const callee = input.baseline.nodes[to]
    const container = callee ? input.baseline.containers[callee.container] : undefined
    if (container && isFallbackContainerKind(container.kind)) fallbackNumerator += 1
    if (container && !isKnownContainerKind(container.kind)) unknownKindEdges += 1
  }
  const percentage = crossDomainEdges ? Math.round((fallbackNumerator / crossDomainEdges) * 100) : null
  const trueSharedKernelNodes = Object.entries(reuseByNode).filter(([id, count]) => count >= FALLBACK_REUSE_THRESHOLD
    && !isFallbackContainerKind(input.baseline.containers[input.baseline.nodes[id]?.container ?? '']?.kind ?? '')).map(([id]) => id).sort()
  const falseSharedKernelNodes = Object.entries(reuseByNode).filter(([id, count]) => count >= FALLBACK_REUSE_THRESHOLD
    && isFallbackContainerKind(input.baseline.containers[input.baseline.nodes[id]?.container ?? '']?.kind ?? '')).map(([id]) => id).sort()
  const unreachableNodes = Object.entries(reuseByNode).filter(([, count]) => count === 0).map(([id]) => id).sort()
  const selectedInbound = [...inboundPortsMap.values()].reduce((sum, count) => sum + count, 0)
  const noDeclaration = input.scopeId !== null && !table.responsibility[input.scopeId]
  const noEntities = containerMode ? containers.every((container) => container.noEntities) : domains.every((domain) => domain.entityCount === 0)
  const isolated = input.scopeId !== null && callEdges.length === 0 && selectedInbound === 0 && domains.length > 0
  const degraded = unknownKinds.length > 0 || (input.scopeId === null && domainIds.length === 0)
  const degradedReason = unknownKinds.length
    ? `容器 kind 未知（${unknownKinds.join('、')}），扫描闸门应显式报错；查看器不静默归类`
    : input.scopeId === null && domainIds.length === 0 ? 'baseline 没有领域划分；不会按包名伪造领域' : undefined
  const readouts: ScopeReadouts = {
    fallbackBucketPercentage: percentage,
    fallbackBucketShare: { numerator: fallbackNumerator, denominator: crossDomainEdges, percentage },
    unknownKindEdges, reuseByNode, trueSharedKernelNodes, falseSharedKernelNodes, unreachableNodes,
    touchedDomainCount: touched.size, fallbackBucketRatio: percentage,
  }
  const emptyState: ScopeEmptyState = { noDeclaration, noEntities, noInboundSeams: selectedInbound === 0 }
  const title = input.scopeId === null ? '系统结构 · 子系统' : domainLabel(table, input.scopeId)
  return {
    scopeId: input.scopeId, organization: input.organization, available: true, degraded,
    ...(degradedReason ? { degradedReason } : {}),
    level: input.scopeId === null ? 'root' : containerMode ? 'containers' : 'domain',
    title, nodes: containerMode ? containers : domains, domains, containers,
    edges: [...callEdges, ...projectionEdges], projectionEdges,
    inboundPorts: [...inboundPortsMap.entries()].map(([id, count]) => ({ domainId: id, label: domainLabel(table, id), count }))
      .sort((a, b) => a.domainId.localeCompare(b.domainId)),
    outboundPorts: [...outboundPortsMap.entries()].map(([id, count]) => ({ domainId: id, label: domainLabel(table, id), count }))
      .sort((a, b) => a.domainId.localeCompare(b.domainId)),
    readouts, empty: emptyState, noDeclaration, noEntities, noInboundSeams: selectedInbound === 0,
    isolated,
    ...(isolated ? { isolationReason: '未发现跨域调用边（跨语言调用边被禁止建立）' } : {}),
    nestedFrame: input.scopeId !== null,
  }
}
