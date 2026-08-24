// BestScopePanorama —— best 嵌套领域的同构全景。
//
// 职责：把当前 scope 的直接子领域、圈外横跳和迁移覆盖层画成一层画布。
// 边界：只读 best/target/report 与迁移条目；下钻、选择和迁移点击通过回调交给页面，不改 URL 或响应数据。
import { useEffect, useMemo, useRef, useState } from 'react'
import { layoutDomains } from './domainlayout'
import type { DomainAgg, DomainCard, DomainEdge } from './domains'
import type { ViewEdge } from './graphmath'
import type { CgBest, CgCheckReport, CgTarget } from '../../api/types'
import type { BestScopeGraph, MigrationItem } from './besttree'
import { bestScopeGraph } from './besttree'

const CARD_W = 252
const CARD_H = 112
const EXT_W = 176

export interface BestScopePanoramaProps {
  best: CgBest
  target?: CgTarget
  report?: CgCheckReport
  scopeId: string
  selectedDomain: string
  selectedEdge: string
  migrationItems: MigrationItem[]
  onSelectDomain: (id: string) => void
  onSelectEdge: (key: string) => void
  onEnter: (id: string) => void
  onSelectMigration: (item: MigrationItem) => void
}

function layoutAggregate(graph: BestScopeGraph): DomainAgg {
  const cards: Record<string, DomainCard> = {}
  for (const card of graph.cards) {
    cards[card.id] = { id: card.id, ext: card.external, containers: [], entries: [], nodes: [] }
  }
  const edges = new Map<string, DomainEdge>()
  for (const edge of graph.edges) {
    const pair: ViewEdge = { from: '', to: '', status: '' }
    edges.set(edge.key, {
      from: edge.from,
      to: edge.to,
      pairs: Array.from({ length: Math.max(1, Math.min(edge.directCalls, 4)) }, () => pair),
    })
  }
  return { cards, edges, ifaces: {} }
}

/** 渲染一个嵌套 best scope；实卡/圈外卡点击都会进入下一层或横跳目标。 */
export function BestScopePanorama(props: BestScopePanoramaProps) {
  const {
    best, target, report, scopeId, selectedDomain, selectedEdge, migrationItems,
    onSelectDomain, onSelectEdge, onEnter, onSelectMigration,
  } = props
  const graph = useMemo(() => bestScopeGraph(best, target, report, scopeId), [best, target, report, scopeId])
  const agg = useMemo(() => layoutAggregate(graph), [graph])
  const ids = useMemo(() => graph.cards.map((card) => card.id).sort(), [graph.cards])
  const [pos, setPos] = useState<Record<string, [number, number]>>({})
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const wrap = useRef<HTMLDivElement>(null)

  useEffect(() => {
    console.debug('[codegraph] best scope render', {
      scopeId, cardCount: graph.cards.length, edgeCount: graph.edges.length, leaf: graph.leaf,
    })
  }, [scopeId, graph.cards.length, graph.edges.length, graph.leaf])

  useEffect(() => {
    const next = layoutDomains(agg, ids)
    setPos(next)
    const el = wrap.current
    if (!el || !ids.length) {
      setPan({ x: 0, y: 0 })
      setZoom(1)
      return
    }
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
    for (const id of ids) {
      const p = next[id]
      if (!p) continue
      const width = agg.cards[id]?.ext ? EXT_W : CARD_W
      x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1])
      x1 = Math.max(x1, p[0] + width); y1 = Math.max(y1, p[1] + CARD_H)
    }
    if (!Number.isFinite(x0)) return
    const padX = 24, padTop = 44, padBottom = 24
    const vw = el.clientWidth - padX * 2
    const vh = el.clientHeight - padTop - padBottom
    if (vw < 80 || vh < 80) {
      setPan({ x: 0, y: 0 })
      setZoom(1)
      return
    }
    const z = Math.max(0.3, Math.min(1, vw / (x1 - x0), vh / (y1 - y0)))
    setZoom(z)
    setPan({
      x: padX + (vw - (x1 - x0) * z) / 2 - x0 * z,
      y: padTop + (vh - (y1 - y0) * z) / 2 - y0 * z,
    })
  }, [agg, ids])

  useEffect(() => {
    const el = wrap.current
    if (!el) return
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      if (event.ctrlKey || event.metaKey) {
        const rect = el.getBoundingClientRect()
        const mx = event.clientX - rect.left
        const my = event.clientY - rect.top
        setZoom((oldZoom) => {
          const nextZoom = Math.min(2.5, Math.max(0.3, oldZoom * Math.exp(-event.deltaY * 0.0035)))
          setPan((oldPan) => ({
            x: mx - (mx - oldPan.x) * (nextZoom / oldZoom),
            y: my - (my - oldPan.y) * (nextZoom / oldZoom),
          }))
          return nextZoom
        })
      } else {
        setPan((oldPan) => ({ x: oldPan.x - event.deltaX, y: oldPan.y - event.deltaY }))
      }
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  const onPan = (event: React.MouseEvent) => {
    if ((event.target as HTMLElement).closest('[data-best-scope-card],[data-best-scope-edge],[data-best-scope-relayout],[data-migration-item]')) return
    const sx = event.clientX
    const sy = event.clientY
    const origin = pan
    const move = (nextEvent: MouseEvent) => setPan({ x: origin.x + nextEvent.clientX - sx, y: origin.y + nextEvent.clientY - sy })
    const up = () => {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
    event.preventDefault()
  }

  const center = (id: string): [number, number] => {
    const p = pos[id] ?? [0, 0]
    const width = agg.cards[id]?.ext ? EXT_W : CARD_W
    return [p[0] + width / 2, p[1] + CARD_H / 2]
  }
  const W = Math.max(1200, ...ids.map((id) => (pos[id]?.[0] ?? 0) + 420))
  const H = Math.max(620, ...ids.map((id) => (pos[id]?.[1] ?? 0) + 300))
  const directIds = new Set(graph.cards.filter((card) => !card.external).map((card) => card.id))
  const trayItems = migrationItems.filter((item) => !item.currentDomainId || item.currentDomainId !== scopeId)
  const arrowItems = migrationItems.filter((item) => directIds.has(item.expectedDomainId))

  return (
    <div ref={wrap} className="relative min-w-0 flex-1 cursor-grab overflow-hidden" onMouseDown={onPan}>
      <button data-best-scope-relayout onClick={() => setPos(layoutDomains(agg, ids, pos))}
        className="absolute right-3 top-2.5 z-30 rounded border bg-background px-2 py-0.5 text-xs" title="重新布局">重新布局</button>
      <div className="relative" style={{ width: W, height: H, transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: '0 0' }}>
        <svg width={W} height={H} className="absolute inset-0" aria-hidden="true">
          {graph.edges.map((edge) => {
            if (!pos[edge.from] || !pos[edge.to]) return null
            const [x1, y1] = center(edge.from)
            const [x2, y2] = center(edge.to)
            return <line key={edge.key} x1={x1} y1={y1} x2={x2} y2={y2} stroke={selectedEdge === edge.key ? '#171717' : '#a8a8a8'} strokeWidth={1.5 + Math.min(edge.directCalls, 8) * 0.45} />
          })}
        </svg>
        {graph.edges.map((edge) => {
          if (!pos[edge.from] || !pos[edge.to]) return null
          const [x1, y1] = center(edge.from)
          const [x2, y2] = center(edge.to)
          return (
            <button key={edge.key} type="button" data-best-scope-edge={edge.key}
              onClick={(event) => { event.stopPropagation(); onSelectEdge(edge.key) }}
              className={'absolute z-10 -translate-x-1/2 -translate-y-1/2 rounded-full border bg-background px-2 py-0.5 font-mono text-[10.5px] '
                + (selectedEdge === edge.key ? 'border-primary text-primary' : '')}
              style={{ left: (x1 + x2) / 2, top: (y1 + y2) / 2 }}>
              欠 {edge.directCalls}
            </button>
          )
        })}
        {graph.cards.map((card) => {
          const [left, top] = pos[card.id] ?? [0, 0]
          const selected = selectedDomain === card.id
          return (
            <div key={card.id} data-best-scope-card={card.id} data-external={card.external ? 'true' : 'false'}
              onClick={() => {
                if (card.external) onEnter(card.id.slice(4))
                else { onSelectDomain(card.id); onEnter(card.id) }
              }}
              className={'absolute z-20 cursor-pointer select-none rounded-xl border-2 bg-background text-xs shadow-md '
                + (card.external ? 'border-dashed ' : '') + (selected ? 'outline outline-2 outline-primary ' : '')}
              style={{ left, top, width: card.external ? EXT_W : CARD_W }}>
              <div className="flex items-center gap-1.5 px-3.5 pb-1 pt-2 text-[13.5px] font-bold">
                {card.label}
                <span className="text-[10.5px] font-normal text-muted-foreground">{card.type || '未分类'}</span>
              </div>
              <div className="px-3.5 pb-2 text-[11.5px] leading-relaxed text-muted-foreground">{card.responsibility}</div>
              <div className="flex flex-wrap gap-2 border-t px-3.5 py-1.5 text-[11px] text-muted-foreground">
                <span>归属容器 {card.containerCount}</span>
                <span>放错位 {card.misplacedCount}</span>
                {card.childCount ? <span>子领域 {card.childCount}</span> : null}
              </div>
            </div>
          )
        })}
      </div>
      {trayItems.length ? (
        <aside data-unplaced-tray className="absolute bottom-3 left-3.5 z-30 max-w-[420px] rounded border bg-background/95 p-2 text-xs shadow-sm">
          <div className="mb-1 font-semibold">未归位</div>
          {trayItems.map((item) => (
            <button key={item.containerId} type="button" data-migration-item={item.containerId}
              data-selected={selectedDomain === item.expectedDomainId ? 'true' : undefined}
              onClick={() => onSelectMigration(item)} className="mr-1 rounded px-1.5 py-0.5 text-left hover:bg-muted">
              {item.containerLabel} · 应归 {item.expectedDomainLabel}
            </button>
          ))}
        </aside>
      ) : null}
      {arrowItems.map((item) => (
        <div key={item.containerId} data-migration-arrow data-container={item.containerId}
          data-current={item.currentDomainId} data-expected={item.expectedDomainId}
          className="absolute right-3.5 top-14 z-30 rounded border border-dashed border-orange-500 bg-background px-2 py-1 text-[11px] text-orange-700">
          {item.containerLabel} → {item.expectedDomainLabel}
        </div>
      ))}
    </div>
  )
}
