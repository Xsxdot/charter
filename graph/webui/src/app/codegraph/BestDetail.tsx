// BestDetail —— 理想子系统的右侧详情。
//
// 与 DomainDetail 平行但不混用语义：这里的领域和容器来自 best，应然归属；
// misplaced 行再把 baseline 的现状领域接上，明确显示「现在在」与「应归」。
import type { CgBest, CgCheckReport, CgGraph } from '../../api/types'
import { bestSubsystems, subsystemOf } from './besttree'

interface BestDetailProps {
  best: CgBest
  baseline: CgGraph
  report?: CgCheckReport
  subsystemId: string
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

export function BestDetail({ best, baseline, report, subsystemId }: BestDetailProps) {
  const shell = 'w-[340px] shrink-0 overflow-y-auto border-l p-3.5 text-sm'
  const subsystem = bestSubsystems(best).find((item) => item.id === subsystemId)
  if (!subsystem) return <aside data-best-detail className={shell} />

  const assigned = Object.entries(best.containers)
    .filter(([, domainId]) => subsystemOf(best, domainId) === subsystemId)
    .sort(([a], [b]) => a.localeCompare(b))

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

      <Section label="归属容器">
        {assigned.length ? (
          <div data-best-containers>
            {assigned.map(([containerId, domainId]) => (
              <div key={containerId} data-best-container={containerId} className="flex justify-between gap-2 py-0.5 text-xs">
                <span className="font-mono">{baseline.containers[containerId]?.label ?? containerId}</span>
                <span className="text-muted-foreground">{bestLabel(best, domainId)}</span>
              </div>
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
