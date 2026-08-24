// besttree —— 理想树对照的纯算法层。
//
// 职责：把 best/target/report 变成 BestPanorama 与 BestDetail 所需的稳定读数。
// 边界：不读 baseline 的边、不发请求、不碰 DOM；组件只负责渲染和交互。
//       唯一读 baseline 节点的地方是 containerFacts——它只取文件目录与节点计数这两个事实。
import type { CgBest, CgBestDomain, CgCheckReport, CgFinding, CgGraph, CgTarget } from '../../api/types'

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

function childDomainIds(best: CgBest, parentId: string): string[] {
  return Object.entries(best.domains)
    .filter(([, domain]) => domain.parent === parentId)
    .map(([id]) => id)
    .sort()
}

function descendantDomainIds(best: CgBest, parentId: string): string[] {
  const result: string[] = []
  const queue = childDomainIds(best, parentId)
  const seen = new Set<string>()
  while (queue.length) {
    const id = queue.shift()!
    if (seen.has(id)) continue
    seen.add(id)
    result.push(id)
    queue.push(...childDomainIds(best, id))
  }
  return result.sort()
}

/** 枚举顶层子系统及其嵌套领域，供卡片和详情共用。 */
export function bestSubsystems(best: CgBest): BestSubsystem[] {
  return topLevelSubsystemIds(best).map((id) => {
    const domain = best.domains[id]
    const descendants = descendantDomainIds(best, id)
    return {
      id,
      label: domain.label,
      responsibility: domain.responsibility,
      type: domain.type ?? '',
      childIds: childDomainIds(best, id),
      descendantIds: descendants,
    }
  })
}

/** 按最佳归属侧聚合卡片读数；每个 misplaced finding 算一次命中。 */
export function aggregateBestCards(best: CgBest, report?: CgCheckReport): Record<string, BestCardReadout> {
  const byContainer = containerSubsystems(best)
  const misplacedBySubsystem: Record<string, number> = {}
  for (const finding of report?.warns ?? []) {
    if (finding.kind !== 'container-misplaced' || !finding.from) continue
    const subsystemId = byContainer[finding.from]
    if (subsystemId) misplacedBySubsystem[subsystemId] = (misplacedBySubsystem[subsystemId] ?? 0) + 1
  }

  const result: Record<string, BestCardReadout> = {}
  for (const subsystem of bestSubsystems(best)) {
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
    for (const childId of childDomainIds(best, domainId)) total += walk(childId, depth + 1)
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

/** 读取理想领域元数据；此 helper 让详情组件不必复制字段默认值。 */
export function bestDomain(best: CgBest, id: string): CgBestDomain | undefined {
  return best.domains[id]
}
