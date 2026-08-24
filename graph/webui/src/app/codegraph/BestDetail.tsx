// BestDetail —— 理想子系统的右侧详情。
//
// 与 DomainDetail 平行但不混用语义：这里的领域和容器来自 best，应然归属；
// misplaced 行再把 baseline 的现状领域接上，明确显示「现在在」与「应归」。
import { useMemo } from 'react'
import type { CgBest, CgCheckReport, CgGraph } from '../../api/types'
import type { ContainerFacts } from './besttree'
import { bestSubsystems, containerFacts, groupContainersBySubdomain, subsystemOf } from './besttree'

export interface BestDetailProps {
  best: CgBest
  baseline: CgGraph
  report?: CgCheckReport
  subsystemId: string
  selectedDomain?: string
  onEnterDomain?: (id: string) => void
  selectedContainer?: string
  onSelectContainer?: (id: string) => void
}

// 容器多到需要折叠时才默认收起；小分组保持展开，避免每看一眼都要点开。
const GROUP_OPEN_LIMIT = 12

// 包分组一律默认收起：它存在的理由就是把几十行容器换成一行组名，默认展开等于没分组。
function ContainerRow({ id, label, facts, selected, onSelect }: {
  id: string
  label: string
  facts?: ContainerFacts
  selected: boolean
  onSelect?: (id: string) => void
}) {
  return (
    <button type="button" data-best-container={id} data-selected={selected ? 'true' : undefined}
      onClick={() => onSelect?.(id)}
      className={'flex w-full justify-between gap-2 py-0.5 pl-4 text-left text-xs hover:bg-muted '
        + (selected ? 'bg-muted outline outline-1 outline-primary' : '')}>
      <span className="font-mono">{label}</span>
      {facts ? <span className="shrink-0 text-[11px] text-muted-foreground">{facts.nodeCount} 节点</span> : null}
    </button>
  )
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-3.5">
      <div className="mb-1 text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      {children}
    </div>
  )
}

function baselineRootDomain(baseline: CgGraph, domainId: string): string {
  let current = domainId
  let root = domainId
  const seen = new Set<string>()
  while (current && baseline.domains?.[current] && !seen.has(current)) {
    seen.add(current)
    root = current
    current = baseline.domains[current].parent ?? ''
  }
  return root
}

function bestDomainPath(best: CgBest, domainId: string): string[] {
  const path: string[] = []
  const seen = new Set<string>()
  let current = domainId
  while (current && best.domains[current] && !seen.has(current)) {
    seen.add(current)
    path.unshift(current)
    current = best.domains[current].parent ?? ''
  }
  return path
}

function bestLabel(best: CgBest, domainId: string): string {
  return best.domains[domainId]?.label ?? domainId
}

function baselineLabel(baseline: CgGraph, domainId: string): string {
  return baseline.domains?.[domainId]?.label ?? domainId
}

export function BestDetail({
  best, baseline, report, subsystemId, selectedDomain = '', onEnterDomain,
  selectedContainer = '', onSelectContainer,
}: BestDetailProps) {
  const shell = 'w-[340px] shrink-0 overflow-y-auto border-l p-3.5 text-sm'
  const subsystem = bestSubsystems(best).find((item) => item.id === subsystemId)
  if (!subsystem) return <aside data-best-detail className={shell} />

  const facts = useMemo(() => containerFacts(baseline), [baseline])
  const groups = groupContainersBySubdomain(best, subsystemId, facts)
  const assignedCount = groups.find((group) => group.depth === 0)?.totalCount ?? 0
  const containerLabel = (containerId: string) => baseline.containers[containerId]?.label ?? containerId

  const misplaced = (report?.warns ?? []).flatMap((finding) => {
    if (finding.kind !== 'container-misplaced' || !finding.from) return []
    const expectedDomain = best.containers[finding.from]
    if (!expectedDomain) return []
    const expectedSubsystem = subsystemOf(best, expectedDomain)
    const currentDomain = baseline.containers[finding.from]?.domain ?? ''
    const currentRoot = baselineRootDomain(baseline, currentDomain)
    const currentSubsystem = best.domains[currentRoot] ? currentRoot : ''
    if (expectedSubsystem !== subsystemId && currentSubsystem !== subsystemId) return []
    return [{
      id: finding.from,
      current: currentDomain ? baselineLabel(baseline, currentDomain) : '未归属',
      expected: bestLabel(best, expectedDomain),
    }]
  })

  return (
    <aside data-best-detail={subsystemId} className={shell}>
      <h3 className="font-mono text-sm font-semibold">
        {subsystem.label} <span className="font-sans text-[11px] font-normal text-muted-foreground">{subsystem.type || '未分类'}</span>
        {onEnterDomain ? (
          <button type="button" data-best-enter-subsystem={subsystemId} title="进入子系统内部（嵌套全景）"
            onClick={() => onEnterDomain(subsystemId)}
            className="ml-2 rounded border px-1.5 text-[10px] font-sans font-normal hover:bg-muted">
            进入 ▸
          </button>
        ) : null}
      </h3>
      <div className="mb-2.5 font-mono text-[11px] text-muted-foreground">理想子系统 · {subsystem.responsibility}</div>

      <Section label="子领域嵌套">
        {subsystem.descendantIds.length ? (
          <div data-best-domains>
            {subsystem.descendantIds.map((id) => (
              <div key={id} data-best-domain={id} className="py-0.5">
                {bestDomainPath(best, id).map((ancestor) => bestLabel(best, ancestor)).join(' · ')}
                {onEnterDomain ? (
                  <button type="button" title={`下钻到领域内部：${bestLabel(best, id)}`} onClick={() => onEnterDomain(id)}
                    className={'ml-2 rounded border px-1 text-[10px] hover:bg-muted '
                      + (selectedDomain === id ? 'border-primary text-primary' : '')}>
                    进入 ▸
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        ) : <div className="text-xs text-muted-foreground">无嵌套子领域</div>}
      </Section>

      <Section label={`归属容器 · ${assignedCount}`}>
        {groups.length ? (
          <div data-best-containers>
            {groups.map((group) => {
              const grouped = group.packages.length > 1
              return (
                <details
                  key={group.domainId}
                  data-best-container-group={group.domainId}
                  open={group.containerIds.length > 0 && (grouped || group.containerIds.length <= GROUP_OPEN_LIMIT)}
                  style={{ marginLeft: group.depth * 10 }}
                  className="py-0.5"
                >
                  <summary className="cursor-pointer list-none text-xs">
                    <span className="mr-1 text-muted-foreground">{group.containerIds.length ? '▸' : '·'}</span>
                    {group.label}
                    <span className="ml-1.5 text-[11px] text-muted-foreground">
                      {group.containerIds.length}
                      {group.totalCount !== group.containerIds.length ? ` / ${group.totalCount}` : ''}
                      {grouped ? ` · ${group.packages.length} 包` : ''}
                    </span>
                  </summary>
                  {grouped
                    ? group.packages.map((pkg) => (
                      <details key={pkg.dir} data-best-package-group={pkg.dir || '未归包'} className="ml-3 py-0.5">
                        <summary className="cursor-pointer list-none text-xs">
                          <span className="mr-1 text-muted-foreground">▸</span>
                          <span className="font-mono">{pkg.label}</span>
                          <span className="ml-1.5 text-[11px] text-muted-foreground">{pkg.containerIds.length}</span>
                          {pkg.dir ? <div className="pl-4 text-[11px] text-muted-foreground">{pkg.dir}</div> : null}
                        </summary>
                        {pkg.containerIds.map((containerId) => (
                          <ContainerRow key={containerId} id={containerId} label={containerLabel(containerId)} facts={facts[containerId]}
                            selected={selectedContainer === containerId} onSelect={onSelectContainer} />
                        ))}
                      </details>
                    ))
                    : group.containerIds.map((containerId) => (
                      <ContainerRow key={containerId} id={containerId} label={containerLabel(containerId)} facts={facts[containerId]}
                        selected={selectedContainer === containerId} onSelect={onSelectContainer} />
                    ))}
                </details>
              )
            })}
          </div>
        ) : <div className="text-xs text-muted-foreground">暂无归属容器</div>}
      </Section>

      <Section label="容器归属对照">
        {misplaced.length ? (
          <div data-best-misplaced>
            {misplaced.map((item) => (
              <div key={item.id} data-best-misplaced-item={item.id} className="border-t py-1 text-xs">
                <span className="font-mono">{item.id}</span>
                <div>现在在 {item.current} · 应归 {item.expected}</div>
              </div>
            ))}
          </div>
        ) : <div className="text-xs text-muted-foreground">无放错位容器</div>}
      </Section>
    </aside>
  )
}
