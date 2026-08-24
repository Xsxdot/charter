// BestOverlays —— 理想树查看器的欠账、迁移和边详情覆盖层。
//
// 职责：只把 besttree 的纯函数读数映射为可测试的 DOM；不请求、不写入 best/target、不持有路由状态。
// 边界：选择事件只回调给页面组装点，缺席数据以明确文案呈现，不用零值掩盖缺席。
import type { JSX } from 'react'
import type { CgCheckReport, CgTarget } from '../../api/types'
import type { BestScopeEdge, DebtReadout, MigrationGroup, MigrationItem } from './besttree'
import { directionDetail } from './besttree'

export interface DebtBannerProps {
  readout: DebtReadout | null
}

/** 渲染欠账四件套；report 缺席时只显示「无数据」。 */
export function DebtBanner({ readout }: DebtBannerProps): JSX.Element {
  return (
    <div data-debt-banner role="status"
      className="absolute left-3.5 top-12 z-30 inline-flex items-center gap-3 rounded-full border bg-background px-3.5 py-1 text-xs shadow-sm">
      <b>欠账读数</b>
      {readout ? (
        <>
          <span data-debt="fails" className={readout.fails ? 'text-destructive' : ''}>fails {readout.fails}</span>
          <span data-debt="directCalls">直调余额 {readout.directCalls}</span>
          <span data-debt="coverage">窄缝覆盖 {readout.targetAvailable ? `${readout.coveredDirections}/${readout.totalDirections}` : '—'}</span>
          <span data-debt="misplaced">放错位 {readout.misplaced}</span>
          <span data-debt="bidirectional">双向环 {readout.bidirectionalPairs}</span>
        </>
      ) : <span data-debt="none" className="text-muted-foreground">无数据</span>}
    </div>
  )
}

export interface MigrationSidebarProps {
  groups: MigrationGroup[]
  selectedContainer: string
  onSelectContainer: (item: MigrationItem) => void
}

/** 按应然领域渲染迁移清单；点击只把原始条目交给页面，不修改图数据。 */
export function MigrationSidebar({ groups, selectedContainer, onSelectContainer }: MigrationSidebarProps): JSX.Element {
  return (
    <aside data-migration-sidebar className="w-[300px] shrink-0 overflow-y-auto border-r p-3.5 text-sm">
      <h3 className="mb-2 font-semibold">迁移清单</h3>
      {groups.length ? groups.map((group) => (
        <section key={group.expectedDomainId} data-migration-group={group.expectedDomainId} className="mb-3">
          <div className="mb-1 text-xs font-semibold">{group.expectedDomainLabel} {group.count}</div>
          <div className="space-y-0.5">
            {group.items.map((item) => (
              <button key={item.containerId} type="button" data-migration-item={item.containerId}
                data-selected={selectedContainer === item.containerId ? 'true' : undefined}
                onClick={() => onSelectContainer(item)}
                className={'block w-full rounded px-2 py-1 text-left text-xs hover:bg-muted '
                  + (selectedContainer === item.containerId ? 'bg-muted outline outline-1 outline-primary' : '')}>
                {item.containerLabel} · 现在在 {item.currentDomainLabel} → 应归 {item.expectedDomainLabel}
              </button>
            ))}
          </div>
        </section>
      )) : <div data-migration-none className="text-xs text-muted-foreground">无待迁移件</div>}
    </aside>
  )
}

export interface BestEdgeDetailProps {
  edge: BestScopeEdge | null
  target?: CgTarget
  report?: CgCheckReport
}

/** 显示一条投影边的原始方向细节；缺少方向契约时保留 key 并明示无数据。 */
export function BestEdgeDetail({ edge, target, report }: BestEdgeDetailProps): JSX.Element {
  return (
    <aside data-best-edge-detail className="w-[300px] shrink-0 overflow-y-auto border-l p-3.5 text-sm">
      {edge ? (
        <>
          <h3 className="mb-2 font-semibold">边详情</h3>
          <div className="mb-2 font-mono text-xs text-muted-foreground">{edge.key}</div>
          <div className="space-y-2">
            {edge.directions.map((key) => {
              const detail = directionDetail(key, target, report)
              if (!detail) {
                console.warn('[codegraph] best direction detail missing', { key, edge: edge.key })
                return <div key={key} data-best-direction-detail={key} className="border-t pt-1 text-xs text-muted-foreground">{key} · 无数据</div>
              }
              return (
                <div key={key} data-best-direction-detail={key} className="border-t pt-1 text-xs">
                  <div className="font-mono">{detail.key}</div>
                  <div>实测 {detail.directCalls} · 预算 {detail.legacyBudget ?? '—'}</div>
                  <div>窄缝 {detail.narrowEntries.length ? detail.narrowEntries.join('、') : '无'}</div>
                  {detail.bidirectional ? <div className="text-destructive">双向对端：{detail.counterpartKey}</div> : null}
                </div>
              )
            })}
          </div>
        </>
      ) : <div className="text-xs text-muted-foreground">选择一条边查看方向明细</div>}
    </aside>
  )
}
