// BestLeafGraph —— best 叶子领域的容器/包视图。
//
// 职责：复用 besttree 的容器事实与包分组，展示叶子领域的代码容器、节点数和迁移未来态。
// 边界：不从容器 id 猜包、不删除 best 容器；选择回调只更新页面内存状态。
import { useMemo } from 'react'
import type { CgBest, CgCheckReport, CgGraph } from '../../api/types'
import type { ContainerFacts, MigrationItem } from './besttree'
import { bestContainerFacts, bestDomainLabel, containerFacts, groupContainersBySubdomain } from './besttree'

export interface BestLeafGraphProps {
  best: CgBest
  baseline: CgGraph
  report?: CgCheckReport
  scopeId: string
  selectedContainer: string
  migrationItems: MigrationItem[]
  onSelectContainer: (id: string) => void
}

interface PackageDisplay {
  dir: string
  label: string
  containerIds: string[]
}

/** 渲染叶子领域容器图；迁移目标与当前 best 不同的容器保留为幽灵待迁入。 */
export function BestLeafGraph({ best, baseline, report, scopeId, selectedContainer, migrationItems, onSelectContainer }: BestLeafGraphProps) {
  const facts = useMemo(() => bestContainerFacts(best, baseline, scopeId), [best, baseline, scopeId])
  const baselineFacts = useMemo(() => containerFacts(baseline), [baseline])
  const groups = useMemo(() => groupContainersBySubdomain(best, scopeId, facts), [best, scopeId, facts])
  const packages = useMemo(() => {
    const byDir = new Map<string, PackageDisplay>()
    for (const group of groups) {
      for (const pkg of group.packages) {
        const current = byDir.get(pkg.dir) ?? { dir: pkg.dir, label: pkg.label, containerIds: [] }
        current.containerIds.push(...pkg.containerIds)
        byDir.set(pkg.dir, current)
      }
    }
    for (const item of migrationItems) {
      if (item.expectedDomainId !== scopeId || best.containers[item.containerId] === scopeId) continue
      const fact = facts[item.containerId] ?? baselineFacts[item.containerId] ?? { dir: '', nodeCount: 0 }
      const dir = fact.dir
      const current = byDir.get(dir) ?? { dir, label: dir ? dir.split('/').at(-1) ?? dir : '未归包', containerIds: [] }
      if (!current.containerIds.includes(item.containerId)) current.containerIds.push(item.containerId)
      byDir.set(dir, current)
    }
    return [...byDir.values()].sort((a, b) => a.dir.localeCompare(b.dir))
      .map((pkg) => ({ ...pkg, containerIds: [...new Set(pkg.containerIds)].sort() }))
  }, [best, baselineFacts, facts, groups, migrationItems, scopeId])

  const containerFactsFor = (containerId: string): ContainerFacts => facts[containerId] ?? baselineFacts[containerId] ?? { dir: '', nodeCount: 0 }
  const labelFor = (containerId: string) => baseline.containers[containerId]?.label ?? containerId
  const ghostIds = new Set(migrationItems
    .filter((item) => item.expectedDomainId === scopeId && best.containers[item.containerId] !== scopeId)
    .map((item) => item.containerId))
  void report

  return (
    <section data-best-leaf className="min-w-0 flex-1 overflow-y-auto p-4">
      <h3 className="mb-3 text-sm font-semibold">{bestDomainLabel(best, scopeId)} · 容器视图</h3>
      {packages.length ? packages.map((pkg) => (
        <section key={pkg.dir} data-best-leaf-package={pkg.dir || '未归包'} className="mb-3 rounded border p-2">
          <div className="mb-1 text-xs font-semibold">
            <span className="font-mono">{pkg.label}</span>
            {pkg.dir ? <span className="ml-2 text-muted-foreground">{pkg.dir}</span> : null}
          </div>
          {pkg.containerIds.map((containerId) => {
            const ghost = ghostIds.has(containerId)
            const factsForContainer = containerFactsFor(containerId)
            return (
              <button key={containerId} type="button" data-best-leaf-container={containerId}
                data-ghost-container={ghost ? 'true' : undefined} data-selected={selectedContainer === containerId ? 'true' : undefined}
                onClick={() => onSelectContainer(containerId)}
                className={'flex w-full justify-between rounded px-2 py-1 text-left text-xs hover:bg-muted '
                  + (ghost ? 'border border-dashed border-orange-500 text-orange-700 ' : '')
                  + (selectedContainer === containerId ? 'bg-muted outline outline-1 outline-primary' : '')}>
                <span className="font-mono">{labelFor(containerId)}{ghost ? ' · 待迁入' : ''}</span>
                <span className="shrink-0 text-[11px] text-muted-foreground">{factsForContainer.nodeCount} 节点</span>
              </button>
            )
          })}
        </section>
      )) : <div className="text-xs text-muted-foreground">暂无归属容器</div>}
    </section>
  )
}
