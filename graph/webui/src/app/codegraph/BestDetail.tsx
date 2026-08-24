// BestDetail —— 理想子系统的右侧详情。
//
// 与 DomainDetail 平行但不混用语义：这里的领域和容器来自 best，应然归属；
// misplaced 行再把 baseline 的现状领域接上，明确显示「现在在」与「应归」。
import type { CgBest, CgCheckReport, CgGraph } from '../../api/types'
import { bestSubsystems, groupContainersBySubdomain, subsystemOf } from './besttree'

interface BestDetailProps {
  best: CgBest
  baseline: CgGraph
  report?: CgCheckReport
  subsystemId: string
}

// 容器多到需要折叠时才默认收起；小分组保持展开，避免每看一眼都要点开。
const GROUP_OPEN_LIMIT = 12

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

export function BestDetail({ best, baseline, report, subsystemId }: BestDetailProps) {
  const shell = 'w-[340px] shrink-0 overflow-y-auto border-l p-3.5 text-sm'
  const subsystem = bestSubsystems(best).find((item) => item.id === subsystemId)
  if (!subsystem) return <aside data-best-detail className={shell} />

  const groups = groupContainersBySubdomain(best, subsystemId)
  const assignedCount = groups.find((group) => group.depth === 0)?.totalCount ?? 0

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
      </h3>
      <div className="mb-2.5 font-mono text-[11px] text-muted-foreground">理想子系统 · {subsystem.responsibility}</div>

      <Section label="子领域嵌套">
        {subsystem.descendantIds.length ? (
          <div data-best-domains>
            {subsystem.descendantIds.map((id) => (
              <div key={id} data-best-domain={id} className="py-0.5">
                {bestDomainPath(best, id).map((ancestor) => bestLabel(best, ancestor)).join(' · ')}
              </div>
            ))}
          </div>
        ) : <div className="text-xs text-muted-foreground">无嵌套子领域</div>}
      </Section>

      <Section label={`归属容器 · ${assignedCount}`}>
        {groups.length ? (
          <div data-best-containers>
            {groups.map((group) => (
              <details
                key={group.domainId}
                data-best-container-group={group.domainId}
                open={group.containerIds.length > 0 && group.containerIds.length <= GROUP_OPEN_LIMIT}
                style={{ marginLeft: group.depth * 10 }}
                className="py-0.5"
              >
                <summary className="cursor-pointer list-none text-xs">
                  <span className="mr-1 text-muted-foreground">{group.containerIds.length ? '▸' : '·'}</span>
                  {group.label}
                  <span className="ml-1.5 text-[11px] text-muted-foreground">
                    {group.containerIds.length}
                    {group.totalCount !== group.containerIds.length ? ` / ${group.totalCount}` : ''}
                  </span>
                </summary>
                {group.containerIds.map((containerId) => (
                  <div
                    key={containerId}
                    data-best-container={containerId}
                    className="py-0.5 pl-4 font-mono text-xs"
                  >
                    {baseline.containers[containerId]?.label ?? containerId}
                  </div>
                ))}
              </details>
            ))}
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
