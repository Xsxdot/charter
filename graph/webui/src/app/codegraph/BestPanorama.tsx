// BestPanorama —— best.json 理想树的首层全景。
//
// 它与 DomainPanorama 并列：前者回答「应该怎样组织」，后者继续回答「现在怎样组织」。
// 这样没有 best 的项目可以沿用老组件，降级路径不需要在老组件里混入第二套语义。
import { useEffect, useMemo, useRef, useState } from 'react'
import { layoutDomains } from './domainlayout'
import {
  aggregateBestCards,
  assembleDirections,
  enforcementReadout,
} from './besttree'
import type { DirectionReadout } from './besttree'
import type { DomainAgg, DomainCard, DomainEdge } from './domains'
import type { CgBest, CgCheckReport, CgTarget } from '../../api/types'
import type { ViewEdge } from './graphmath'

const CARD_W = 252
const CARD_H = 112

interface BestPanoramaProps {
  best: CgBest
  target?: CgTarget
  report?: CgCheckReport
  selectedSubsystem: string
  onSelectSubsystem: (id: string) => void
}

function layoutAggregate(
  cards: ReturnType<typeof aggregateBestCards>,
  directions: DirectionReadout[],
): DomainAgg {
  const layoutCards: Record<string, DomainCard> = {}
  for (const id of Object.keys(cards)) {
    layoutCards[id] = { id, ext: false, containers: [], entries: [], nodes: [] }
  }
  const edges = new Map<string, DomainEdge>()
  for (const direction of directions) {
    if (!layoutCards[direction.from] || !layoutCards[direction.to] || direction.from === direction.to) continue
    // layoutDomains 只用 pairs.length 作为弹簧权重；这里的权重直接来自
    // report.legacyHits，绝不从 baseline.edges 重新聚合。
    const weight = Math.max(1, Math.min(direction.directCalls, 4))
    const pair: ViewEdge = { from: '', to: '', status: '' }
    edges.set(direction.key, { from: direction.from, to: direction.to, pairs: Array.from({ length: weight }, () => pair) })
  }
  return { cards: layoutCards, edges, ifaces: {} }
}

function directionColor(direction: DirectionReadout): { stroke: string; dash?: string } {
  if (direction.status === 'new-direction') return { stroke: '#d97706', dash: '8 5' }
  if (direction.status === 'over-budget') return { stroke: '#dc2626' }
  if (direction.status === 'dead-contract') return { stroke: '#6b7280', dash: '4 4' }
  return { stroke: '#2563eb' }
}

function directionText(direction: DirectionReadout): string {
  if (direction.status === 'new-direction') return `未声明 · 直调 ${direction.directCalls}`
  if (direction.status === 'dead-contract') return `未建成 · 直调 ${direction.directCalls}/${direction.legacyBudget ?? '—'}`
  return `直调 ${direction.directCalls}/${direction.legacyBudget ?? '—'}`
}

/** 全局执法横幅；report 缺席时明确是无数据，不把缺席伪装成三个零。 */
export function EnforcementBanner({ report }: { report?: CgCheckReport }) {
  const readout = enforcementReadout(report)
  return (
    <div data-enforcement-banner role="status"
      className="absolute left-3.5 top-12 z-30 inline-flex items-center gap-3 rounded-full border bg-background px-3.5 py-1 text-xs shadow-sm">
      <b>执法读数</b>
      {readout ? (
        <>
          <span data-enforcement="fails">fails {readout.fails}</span>
          <span data-enforcement="misplaced">放错位 {readout.misplaced}</span>
          <span data-enforcement="unplaced">未归属 {readout.unplaced}</span>
        </>
      ) : <span data-enforcement="none" className="text-muted-foreground">无数据</span>}
    </div>
  )
}

export function BestPanorama(props: BestPanoramaProps) {
  const { best, target, report, selectedSubsystem, onSelectSubsystem } = props
  const cards = useMemo(() => aggregateBestCards(best, report), [best, report])
  const directions = useMemo(() => assembleDirections(target, report), [target, report])
  const ids = useMemo(() => Object.keys(cards).sort(), [cards])
  const agg = useMemo(() => layoutAggregate(cards, directions), [cards, directions])
  const [pos, setPos] = useState<Record<string, [number, number]>>({})
  const wrap = useRef<HTMLDivElement>(null)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)

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
      x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1])
      x1 = Math.max(x1, p[0] + CARD_W); y1 = Math.max(y1, p[1] + CARD_H)
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
    const onWheel = (ev: WheelEvent) => {
      ev.preventDefault()
      if (ev.ctrlKey || ev.metaKey) {
        const r = el.getBoundingClientRect()
        const mx = ev.clientX - r.left
        const my = ev.clientY - r.top
        setZoom((z) => {
          const nz = Math.min(2.5, Math.max(0.3, z * Math.exp(-ev.deltaY * 0.0035)))
          setPan((p) => ({ x: mx - (mx - p.x) * (nz / z), y: my - (my - p.y) * (nz / z) }))
          return nz
        })
      } else {
        setPan((p) => ({ x: p.x - ev.deltaX, y: p.y - ev.deltaY }))
      }
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  const onPan = (ev: React.MouseEvent) => {
    if ((ev.target as HTMLElement).closest('[data-best-subsystem],[data-best-direction],[data-best-relayout]')) return
    const sx = ev.clientX
    const sy = ev.clientY
    const origin = pan
    const move = (e: MouseEvent) => setPan({ x: origin.x + e.clientX - sx, y: origin.y + e.clientY - sy })
    const up = () => {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
    ev.preventDefault()
  }

  const W = Math.max(1200, ...ids.map((id) => (pos[id]?.[0] ?? 0) + 420))
  const H = Math.max(620, ...ids.map((id) => (pos[id]?.[1] ?? 0) + 300))
  const center = (id: string): [number, number] => {
    const p = pos[id] ?? [0, 0]
    return [p[0] + CARD_W / 2, p[1] + CARD_H / 2]
  }
  const visibleDirections = directions.filter((direction) => pos[direction.from] && pos[direction.to])

  return (
    <div ref={wrap} className="relative min-w-0 flex-1 cursor-grab overflow-hidden" onMouseDown={onPan}>
      <EnforcementBanner report={report} />
      <button data-best-relayout onClick={() => setPos(layoutDomains(agg, ids, pos))}
        className="absolute right-3 top-2.5 z-30 rounded border bg-background px-2 py-0.5 text-xs"
        title="重新布局理想树">重新布局</button>
      <div className="relative" style={{ width: W, height: H, transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: '0 0' }}>
        <svg width={W} height={H} className="absolute inset-0" aria-hidden="true">
          {visibleDirections.map((direction) => {
            const [x1, y1] = center(direction.from)
            const [x2, y2] = center(direction.to)
            const color = directionColor(direction)
            return (
              <line key={direction.key} x1={x1} y1={y1} x2={x2} y2={y2}
                stroke={color.stroke} strokeDasharray={color.dash} strokeWidth={1.5 + Math.min(direction.directCalls, 8) * 0.45} />
            )
          })}
        </svg>
        {visibleDirections.map((direction) => {
          const [x1, y1] = center(direction.from)
          const [x2, y2] = center(direction.to)
          return (
            <div key={direction.key} data-best-direction={direction.key} data-direction-status={direction.status}
              onClick={() => onSelectSubsystem(direction.to)}
              className={'absolute z-10 -translate-x-1/2 -translate-y-1/2 cursor-pointer rounded-full border bg-background px-2 py-0.5 font-mono text-[10.5px] '
                + (direction.status === 'over-budget' ? 'border-red-600 text-red-600 '
                  : direction.status === 'new-direction' ? 'border-amber-600 text-amber-700 '
                    : direction.status === 'dead-contract' ? 'border-gray-500 text-gray-600' : '')}
              style={{ left: (x1 + x2) / 2, top: (y1 + y2) / 2 }}>
              {directionText(direction)}
            </div>
          )
        })}
        {ids.map((id) => {
          const card = cards[id]
          const selected = selectedSubsystem === id
          return (
            <div key={id} data-best-subsystem={id} onClick={() => onSelectSubsystem(id)}
              className={'absolute z-20 cursor-pointer select-none rounded-xl border-2 bg-background text-xs shadow-md '
                + (selected ? 'outline outline-2 outline-primary ' : '')}
              style={{ left: pos[id]?.[0] ?? 0, top: pos[id]?.[1] ?? 0, width: CARD_W }}>
              <div className="flex items-center gap-1.5 px-3.5 pb-1 pt-2 text-[13.5px] font-bold">
                {card.label}
                <span data-best-type className="text-[10.5px] font-normal text-muted-foreground">{card.type || '未分类'}</span>
              </div>
              <div className="px-3.5 pb-2 text-[11.5px] leading-relaxed text-muted-foreground">{card.responsibility}</div>
              <div data-best-gap className="flex flex-wrap gap-2 border-t px-3.5 py-1.5 text-[11px] text-muted-foreground">
                <span data-gap="containers">归属容器 {card.containerCount}</span>
                <span data-gap="misplaced">放错位 {card.misplacedCount}</span>
                {card.subdomainCount ? <span data-gap="subdomains">子领域 {card.subdomainCount}</span> : null}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
