// besttree —— 理想树对照的纯算法层。
//
// 职责：只读 best/target/report，投影出查看器所需的稳定读数。
// 边界：不读 DOM、不发请求、不写入数据；组件只负责渲染和交互。
//       唯一读 baseline 节点的地方是 containerFacts——它只取文件目录与节点计数这两个事实。
import type { CgBest, CgBestDomain, CgCheckReport, CgDomainDecls, CgFinding, CgGraph, CgTarget } from '../../api/types'

export interface BestSubsystem {
  id: string
  label: string
  responsibility: string
  type: string
  childIds: string[]
  descendantIds: string[]
}

export interface BestCardReadout {
  id: string
  label: string
  responsibility: string
  type: string
  containerCount: number
  misplacedCount: number
  subdomainCount: number
}

export type DirectionStatus = 'declared' | 'over-budget' | 'dead-contract' | 'new-direction'

export interface DirectionReadout {
  key: string
  from: string
  to: string
  declared: boolean
  directCalls: number
  legacyBudget?: number
  overBudget: boolean
  deadContract: boolean
  newDirection: boolean
  status: DirectionStatus
}

export interface DebtReadout {
  fails: number
  directCalls: number
  coveredDirections: number
  totalDirections: number
  misplaced: number
  bidirectionalPairs: number
  targetAvailable: boolean
}

export interface MigrationItem {
  containerId: string
  containerLabel: string
  currentDomainId: string
  currentDomainLabel: string
  expectedDomainId: string
  expectedDomainLabel: string
  expectedSubsystemId: string
}

export interface MigrationGroup {
  expectedDomainId: string
  expectedDomainLabel: string
  items: MigrationItem[]
  count: number
}

export interface BestDirectionDetail {
  key: string
  from: string
  to: string
  directCalls: number
  legacyBudget?: number
  narrowEntries: string[]
  counterpartKey?: string
  bidirectional: boolean
}

export interface BestScopeCard {
  id: string
  label: string
  responsibility: string
  type: string
  external: boolean
  containerCount: number
  misplacedCount: number
  childCount: number
}

export interface BestScopeEdge {
  key: string
  from: string
  to: string
  directCalls: number
  directions: string[]
}

export interface BestScopeGraph {
  scopeId: string | null
  cards: BestScopeCard[]
  edges: BestScopeEdge[]
  leaf: boolean
}

export interface EnforcementReadout {
  fails: number
  misplaced: number
  unplaced: number
}

export type FindingClass = 'fail' | 'misplaced' | 'unplaced' | 'warning' | 'unknown'

/** 顶层 parent 为空的领域就是理想树的子系统，按 id 给 UI 稳定顺序。 */
export function topLevelSubsystemIds(best: CgBest): string[] {
  return Object.entries(best.domains)
    .filter(([, domain]) => !domain.parent)
    .map(([id]) => id)
    .sort()
}

/** 沿 parent 链解析顶层子系统；未知领域、断链和环都返回空串。 */
export function subsystemOf(best: CgBest | undefined, domainId: string): string {
  if (!best || !best.domains[domainId]) return ''
  let currentId = domainId
  const seen = new Set<string>()
  while (true) {
    if (seen.has(currentId)) return ''
    seen.add(currentId)
    const current = best.domains[currentId]
    if (!current) return ''
    if (!current.parent) return currentId
    currentId = current.parent
  }
}

/** 把 best 的容器→叶领域映射 join 成容器→顶层子系统映射。 */
export function containerSubsystems(best: CgBest): Record<string, string> {
  const result: Record<string, string> = {}
  for (const [containerId, domainId] of Object.entries(best.containers)) {
    const subsystemId = subsystemOf(best, domainId)
    if (subsystemId) result[containerId] = subsystemId
  }
  return result
}

/** 返回指定领域的直接子领域；未知 parent 返回空数组并按 id 排序。 */
export function childBestDomainIds(best: CgBest, parentId: string): string[] {
  return Object.entries(best.domains)
    .filter(([, domain]) => domain.parent === parentId)
    .map(([id]) => id)
    .sort()
}

function descendantDomainIds(best: CgBest, parentId: string): string[] {
  const result: string[] = []
  const queue = childBestDomainIds(best, parentId)
  const seen = new Set<string>()
  while (queue.length) {
    const id = queue.shift()!
    if (seen.has(id)) continue
    seen.add(id)
    result.push(id)
    queue.push(...childBestDomainIds(best, id))
  }
  return result.sort()
}

/** 枚举顶层子系统及其嵌套领域，供卡片和详情共用。 */
export function bestSubsystems(best: CgBest, decls?: CgDomainDecls): BestSubsystem[] {
  return topLevelSubsystemIds(best).map((id) => {
    const domain = best.domains[id]
    const descendants = descendantDomainIds(best, id)
    return {
      id,
      label: domain.label,
      responsibility: decls?.[id]?.responsibility ?? '',
      type: domain.type ?? '',
      childIds: childBestDomainIds(best, id),
      descendantIds: descendants,
    }
  })
}

/** 按最佳归属侧聚合卡片读数；每个 misplaced finding 算一次命中。 */
export function aggregateBestCards(best: CgBest, report?: CgCheckReport, decls?: CgDomainDecls): Record<string, BestCardReadout> {
  const byContainer = containerSubsystems(best)
  const misplacedBySubsystem: Record<string, number> = {}
  for (const finding of report?.warns ?? []) {
    if (finding.kind !== 'container-misplaced' || !finding.from) continue
    const subsystemId = byContainer[finding.from]
    if (subsystemId) misplacedBySubsystem[subsystemId] = (misplacedBySubsystem[subsystemId] ?? 0) + 1
  }

  const result: Record<string, BestCardReadout> = {}
  for (const subsystem of bestSubsystems(best, decls)) {
    const containerCount = Object.values(byContainer).filter((id) => id === subsystem.id).length
    result[subsystem.id] = {
      id: subsystem.id,
      label: subsystem.label,
      responsibility: subsystem.responsibility,
      type: subsystem.type,
      containerCount,
      misplacedCount: misplacedBySubsystem[subsystem.id] ?? 0,
      subdomainCount: subsystem.descendantIds.length,
    }
  }
  return result
}

export interface ContainerFacts {
  dir: string
  nodeCount: number
}

export interface BestPackageGroup {
  dir: string
  label: string
  containerIds: string[]
}

export interface BestContainerGroup {
  domainId: string
  label: string
  depth: number
  containerIds: string[]
  packages: BestPackageGroup[]
  totalCount: number
}

/**
 * 容器的两个事实读数：所在包目录与节点数。
 * 包目录取容器内节点的文件目录；同一容器的节点分散在多个目录时留空——不猜一个出来。
 */
export function containerFacts(graph: CgGraph | undefined): Record<string, ContainerFacts> {
  const dirs: Record<string, Set<string>> = {}
  const counts: Record<string, number> = {}
  for (const node of Object.values(graph?.nodes ?? {})) {
    if (!node.container) continue
    counts[node.container] = (counts[node.container] ?? 0) + 1
    if (!node.file) continue
    const slash = node.file.lastIndexOf('/')
    ;(dirs[node.container] ??= new Set()).add(slash < 0 ? '' : node.file.slice(0, slash))
  }
  const result: Record<string, ContainerFacts> = {}
  for (const containerId of Object.keys(graph?.containers ?? {})) {
    const seen = dirs[containerId]
    result[containerId] = {
      dir: seen && seen.size === 1 ? [...seen][0] : '',
      nodeCount: counts[containerId] ?? 0,
    }
  }
  return result
}

/** 包目录折成展示名：取最后一段，未知包统一叫「未归包」。 */
function packageLabel(dir: string): string {
  if (!dir) return '未归包'
  const slash = dir.lastIndexOf('/')
  return slash < 0 ? dir : dir.slice(slash + 1)
}

function groupByPackage(containerIds: string[], facts: Record<string, ContainerFacts>): BestPackageGroup[] {
  const byDir: Record<string, string[]> = {}
  for (const containerId of containerIds) {
    (byDir[facts[containerId]?.dir ?? ''] ??= []).push(containerId)
  }
  return Object.keys(byDir).sort().map((dir) => ({ dir, label: packageLabel(dir), containerIds: byDir[dir] }))
}

/**
 * 把子系统下的归属容器按所属领域折成前序分组树，depth 即嵌套层级（0 为子系统本身），
 * 每个领域内再按包目录折一级——包是代码事实（目录），不是应然结构，所以只活在这里，不进 best。
 * 整棵子树都没有容器的领域不出现——它在容器视角下没有读数，列出来只会增加噪音。
 */
export function groupContainersBySubdomain(
  best: CgBest,
  subsystemId: string,
  facts: Record<string, ContainerFacts> = {},
): BestContainerGroup[] {
  if (!best.domains[subsystemId]) return []
  const byDomain: Record<string, string[]> = {}
  for (const [containerId, domainId] of Object.entries(best.containers)) {
    (byDomain[domainId] ??= []).push(containerId)
  }
  for (const ids of Object.values(byDomain)) ids.sort((a, b) => a.localeCompare(b))

  const out: BestContainerGroup[] = []
  const seen = new Set<string>()
  const walk = (domainId: string, depth: number): number => {
    if (seen.has(domainId)) return 0
    seen.add(domainId)
    const own = byDomain[domainId] ?? []
    const index = out.length
    const group: BestContainerGroup = {
      domainId,
      label: best.domains[domainId]?.label ?? domainId,
      depth,
      containerIds: own,
      packages: groupByPackage(own, facts),
      totalCount: own.length,
    }
    out.push(group)
    let total = own.length
    for (const childId of childBestDomainIds(best, domainId)) total += walk(childId, depth + 1)
    group.totalCount = total
    if (total === 0) out.splice(index, 1)
    return total
  }
  walk(subsystemId, 0)
  return out
}

function directionKey(from: string, to: string): string {
  return `${from}->${to}`
}

function parseDirectionKey(key: string): [string, string] | null {
  const split = key.indexOf('->')
  if (split <= 0 || split + 2 >= key.length) return null
  return [key.slice(0, split), key.slice(split + 2)]
}

function findingDirection(finding: CgFinding): [string, string] | null {
  if (!finding.from || !finding.to) return null
  if (finding.kind !== 'new-direction') return null
  return [finding.from, finding.to]
}

/**
 * 装配纯 target/report 方向集合：不读取 baseline.edges，也不从前端重新聚合边。
 * legacyHits 的数值就是直调数；合法 entries 不会被本函数凭 baseline 边重新计入。
 */
export function assembleDirections(target?: CgTarget, report?: CgCheckReport): DirectionReadout[] {
  const contracts = new Map<string, { from: string; to: string; legacyBudget?: number }>()
  for (const contract of target?.contracts ?? []) {
    const key = directionKey(contract.from, contract.to)
    if (!contracts.has(key)) contracts.set(key, { from: contract.from, to: contract.to, legacyBudget: contract.legacyBudget })
  }

  const directionKeys = new Set(contracts.keys())
  for (const key of Object.keys(report?.legacyHits ?? {})) {
    if (parseDirectionKey(key)) directionKeys.add(key)
  }
  for (const finding of report?.fails ?? []) {
    const direction = findingDirection(finding)
    if (direction) directionKeys.add(directionKey(direction[0], direction[1]))
  }

  const result = [...directionKeys].map((key): DirectionReadout | null => {
    const parsed = parseDirectionKey(key)
    if (!parsed) return null
    const [from, to] = parsed
    const contract = contracts.get(key)
    const directCalls = report?.legacyHits?.[key] ?? 0
    const reportedOverBudget = (report?.fails ?? []).some(
      (finding) => finding.kind === 'over-budget' && finding.from === from && finding.to === to,
    )
    const overBudget = contract?.legacyBudget !== undefined
      ? directCalls > contract.legacyBudget || reportedOverBudget
      : reportedOverBudget
    const deadContract = (report?.fails ?? []).some((finding) => finding.kind === 'dead-contract' && finding.from === from && finding.to === to)
    const newDirection = (report?.fails ?? []).some((finding) => finding.kind === 'new-direction' && finding.from === from && finding.to === to)
    const status: DirectionStatus = newDirection
      ? 'new-direction'
      : deadContract
        ? 'dead-contract'
        : overBudget
          ? 'over-budget'
          : 'declared'
    return {
      key,
      from,
      to,
      declared: !!contract,
      directCalls,
      legacyBudget: contract?.legacyBudget,
      overBudget,
      deadContract,
      newDirection,
      status,
    }
  })
  return result.filter((direction): direction is DirectionReadout => direction !== null)
    .sort((a, b) => a.key.localeCompare(b.key))
}

/** kind 词表可扩展；未知值走中性缺省分类，不抛异常。 */
export function classifyFinding(kind: string): FindingClass {
  if (kind === 'container-misplaced') return 'misplaced'
  if (kind === 'container-unplaced') return 'unplaced'
  if (kind === 'new-direction' || kind === 'dead-contract' || kind === 'dead-entry'
    || kind === 'dead-interface' || kind === 'off-interface' || kind === 'over-budget') return 'fail'
  if (kind === 'legacy' || kind === 'domain-empty' || kind === 'best-dangling'
    || kind === 'anchor-off-domain' || kind === 'anchor-off-graph' || kind === 'prefix-family'
    || kind === 'oversized-package') return 'warning'
  return 'unknown'
}

/** 横幅读数与 CLI 的三个总数同口径；缺 report 返回 null 以便 UI 显示无数据态。 */
export function enforcementReadout(report?: CgCheckReport): EnforcementReadout | null {
  if (!report) return null
  return {
    fails: report.fails.length,
    misplaced: report.warns.filter((finding) => finding.kind === 'container-misplaced').length,
    unplaced: report.warns.filter((finding) => finding.kind === 'container-unplaced').length,
  }
}

/**
 * 汇总欠账四件套；report 缺席返回 null，target 缺席只影响窄缝与双向环的目标侧读数。
 * legacyHits 中明确的 0 会被保留为有效直调数。
 */
export function debtReadout(target: CgTarget | undefined, report: CgCheckReport | undefined): DebtReadout | null {
  if (!report) return null
  const contracts = target?.contracts ?? []
  const contractKeys = new Set(contracts.map((contract) => directionKey(contract.from, contract.to)))
  const bidirectional = new Set<string>()
  for (const key of contractKeys) {
    const parsed = parseDirectionKey(key)
    if (!parsed || parsed[0] === parsed[1]) continue
    const reverse = directionKey(parsed[1], parsed[0])
    if (!contractKeys.has(reverse)) continue
    bidirectional.add([parsed[0], parsed[1]].sort().join('<->'))
  }
  return {
    fails: report.fails.length,
    directCalls: Object.values(report.legacyHits ?? {}).reduce((sum, hits) => sum + hits, 0),
    coveredDirections: contracts.filter((contract) => (contract.entries ?? []).length > 0).length,
    totalDirections: contracts.length,
    misplaced: report.warns.filter((finding) => finding.kind === 'container-misplaced').length,
    bidirectionalPairs: bidirectional.size,
    targetAvailable: !!target,
  }
}

/** 从 best/现状报告派生迁移清单；未知 best 目标保留在「未映射目标」组。 */
export function migrationGroups(
  best: CgBest,
  baseline: CgGraph,
  report: CgCheckReport | undefined,
): MigrationGroup[] {
  const groups = new Map<string, MigrationGroup>()
  for (const finding of report?.warns ?? []) {
    if (finding.kind !== 'container-misplaced' || !finding.from) continue
    const containerId = finding.from
    const currentDomainId = baseline.containers[containerId]?.domain ?? ''
    const expectedDomainId = best.containers[containerId] ?? ''
    const currentDomainLabel = currentDomainId && baseline.domains?.[currentDomainId]
      ? baseline.domains[currentDomainId].label
      : '未归属'
    const expectedDomainLabel = expectedDomainId
      ? best.domains[expectedDomainId]?.label ?? expectedDomainId
      : '未映射目标'
    const item: MigrationItem = {
      containerId,
      containerLabel: baseline.containers[containerId]?.label ?? containerId,
      currentDomainId,
      currentDomainLabel,
      expectedDomainId,
      expectedDomainLabel,
      expectedSubsystemId: expectedDomainId ? subsystemOf(best, expectedDomainId) : '',
    }
    const group = groups.get(expectedDomainId) ?? {
      expectedDomainId,
      expectedDomainLabel,
      items: [],
      count: 0,
    }
    group.items.push(item)
    group.count = group.items.length
    groups.set(expectedDomainId, group)
  }
  return [...groups.values()]
    .map((group) => ({
      ...group,
      items: [...group.items].sort((a, b) => a.containerId.localeCompare(b.containerId)),
    }))
    .sort((a, b) => a.expectedDomainId.localeCompare(b.expectedDomainId))
}

/** 精确读取一个 target/report 方向及其反向 contract；未知方向返回 null。 */
export function directionDetail(
  key: string,
  target: CgTarget | undefined,
  report: CgCheckReport | undefined,
): BestDirectionDetail | null {
  const direction = assembleDirections(target, report).find((candidate) => candidate.key === key)
  if (!direction) return null
  const contract = (target?.contracts ?? []).find((candidate) => directionKey(candidate.from, candidate.to) === key)
  const parsed = parseDirectionKey(key)
  if (!parsed) return null
  const counterpartKey = directionKey(parsed[1], parsed[0])
  const counterpart = (target?.contracts ?? []).some(
    (candidate) => directionKey(candidate.from, candidate.to) === counterpartKey,
  )
  return {
    key,
    from: parsed[0],
    to: parsed[1],
    directCalls: direction.directCalls,
    legacyBudget: contract?.legacyBudget,
    narrowEntries: [...(contract?.entries ?? [])],
    ...(counterpart ? { counterpartKey, bidirectional: true } : { bidirectional: false }),
  }
}

/** 返回从领域到根的 best 路径；未知领域或成环返回已知前缀，不抛异常。 */
export function bestDomainPath(best: CgBest, domainId: string): string[] {
  const path: string[] = []
  const seen = new Set<string>()
  let current = domainId
  while (current && best.domains[current] && !seen.has(current)) {
    seen.add(current)
    path.unshift(current)
    current = best.domains[current].parent ?? ''
  }
  return current && !best.domains[current] ? [] : path
}

/** 判断领域是否存在且没有直接子领域；未知 id 不是叶子。 */
export function isBestLeaf(best: CgBest, domainId: string): boolean {
  return !!best.domains[domainId] && childBestDomainIds(best, domainId).length === 0
}

/** 读取 best 领域展示名；未知 id 回退为 id，避免图卡静默消失。 */
export function bestDomainLabel(best: CgBest, domainId: string): string {
  return best.domains[domainId]?.label ?? domainId
}

/** 返回直接归属该领域的容器 id，按稳定顺序排列。 */
export function bestDomainContainerIds(best: CgBest, domainId: string): string[] {
  return Object.entries(best.containers)
    .filter(([, assignedDomainId]) => assignedDomainId === domainId)
    .map(([containerId]) => containerId)
    .sort()
}

/** 返回指定 best 领域的容器事实；缺失 baseline 事实时使用零节点空包占位。 */
export function bestContainerFacts(
  best: CgBest,
  baseline: CgGraph,
  domainId: string,
): Record<string, ContainerFacts> {
  const facts = containerFacts(baseline)
  const result: Record<string, ContainerFacts> = {}
  for (const containerId of bestDomainContainerIds(best, domainId)) {
    result[containerId] = facts[containerId] ?? { dir: '', nodeCount: 0 }
  }
  return result
}

function subtreeDomainIds(best: CgBest, rootId: string): Set<string> {
  const result = new Set<string>()
  if (!best.domains[rootId]) return result
  const queue = [rootId]
  while (queue.length) {
    const current = queue.shift()!
    if (result.has(current) || !best.domains[current]) continue
    result.add(current)
    queue.push(...childBestDomainIds(best, current))
  }
  return result
}

function scopeCard(best: CgBest, report: CgCheckReport | undefined, domainId: string, external: boolean): BestScopeCard {
  const domainIds = subtreeDomainIds(best, domainId)
  const containerCount = Object.values(best.containers).filter((assignedDomainId) => domainIds.has(assignedDomainId)).length
  const misplacedCount = (report?.warns ?? []).filter(
    (finding) => finding.kind === 'container-misplaced' && !!finding.from && domainIds.has(best.containers[finding.from] ?? ''),
  ).length
  const domain = best.domains[domainId]
  return {
    id: external ? `ext:${domainId}` : domainId,
    label: domain?.label ?? domainId,
    responsibility: '',
    type: domain?.type ?? '',
    external,
    containerCount,
    misplacedCount,
    childCount: childBestDomainIds(best, domainId).length,
  }
}

interface ProjectedScopeEndpoint {
  id: string
  external: boolean
  domainId: string
}

function scopeEndpoint(best: CgBest, scopeId: string | null, domainId: string): ProjectedScopeEndpoint | null {
  if (!best.domains[domainId]) return null
  if (scopeId === null) {
    const rootId = subsystemOf(best, domainId)
    return rootId ? { id: rootId, external: false, domainId: rootId } : null
  }
  if (!best.domains[scopeId]) return null

  let current = domainId
  const seen = new Set<string>()
  while (current && best.domains[current] && !seen.has(current)) {
    if (current === scopeId) return null
    seen.add(current)
    const parentId: string = best.domains[current].parent ?? ''
    if (parentId === scopeId) return { id: current, external: false, domainId: current }
    current = parentId
  }

  const rootId = subsystemOf(best, domainId)
  return rootId ? { id: `ext:${rootId}`, external: true, domainId: rootId } : null
}

/**
 * 把当前 scope 投影成直接子领域卡与聚合边；圈外端点折成 ext 卡，保留横跳可见性，
 * 避免嵌套页丢失跨域边。未知 scope 返回空图，不把坏数据变成伪卡。
 */
export function bestScopeGraph(
  best: CgBest,
  target: CgTarget | undefined,
  report: CgCheckReport | undefined,
  scopeId: string | null,
): BestScopeGraph {
  if (scopeId !== null && !best.domains[scopeId]) {
    return { scopeId, cards: [], edges: [], leaf: false }
  }
  const visibleIds = scopeId === null ? topLevelSubsystemIds(best) : childBestDomainIds(best, scopeId)
  const cardDomains = new Set(visibleIds)
  const edges = new Map<string, BestScopeEdge>()
  for (const direction of assembleDirections(target, report)) {
    const from = scopeEndpoint(best, scopeId, direction.from)
    const to = scopeEndpoint(best, scopeId, direction.to)
    if (!from || !to || from.id === to.id || (from.external && to.external)) continue
    if (from.external) cardDomains.add(from.domainId)
    if (to.external) cardDomains.add(to.domainId)
    const key = `${from.id}->${to.id}`
    const edge = edges.get(key) ?? { key, from: from.id, to: to.id, directCalls: 0, directions: [] }
    edge.directCalls += direction.directCalls
    edge.directions.push(direction.key)
    edges.set(key, edge)
  }

  const cards = [...cardDomains]
    .map((domainId) => scopeCard(best, report, domainId, !visibleIds.includes(domainId)))
    .sort((a, b) => a.id.localeCompare(b.id))
  return {
    scopeId,
    cards,
    edges: [...edges.values()]
      .map((edge) => ({ ...edge, directions: [...new Set(edge.directions)].sort() }))
      .sort((a, b) => a.key.localeCompare(b.key)),
    leaf: scopeId !== null && isBestLeaf(best, scopeId),
  }
}

/** 读取理想领域元数据；此 helper 让详情组件不必复制字段默认值。 */
export function bestDomain(best: CgBest, id: string): CgBestDomain | undefined {
  return best.domains[id]
}
