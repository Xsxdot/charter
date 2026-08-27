// ScopeCanvas —— 结构图画布：卡片、连线、选中态、平移缩放。
//
// 职责：把 ScopePageModel 的拓扑事实画出来——布局坐标来自 scopelayout 纯函数；
// 单击选中（相连高亮 + 不相连压暗同时生效）、双击领域下钻 / 双击容器显原子说明、
// 空白拖动平移、⌘/Ctrl+滚轮缩放、双击空白复位。
// 边界：只消费模型与装配层注入的直调债四档色映射（edgeStatus，R2 备案的装配
// join）；选中高亮/压暗是运行期选择状态对 model.edges 的直接投影，不是模型读数
// 重算。wheel 缩放与拖拽平移的浏览器兼容归真机清单 1，机内只断言事件驱动状态变化
// （data-zoom / data-transform）。禁 snapshot，全部 data-* 行为查询。
import { useEffect, useMemo, useRef, useState } from 'react'
import type { JSX } from 'react'
import type { DirectionStatus } from './besttree'
import type { ScopeNode, ScopePageModel } from './scopepage'
import { CARD_H, CARD_W, CONTAINER_H, EXT_H, EXT_W, layoutScopeCards } from './scopelayout'

/** 直调债四档色板词表（besttree.DirectionStatus 同源，禁止第二份字面量）。 */
const DIRECTION_STATUSES: readonly DirectionStatus[] = ['declared', 'over-budget', 'dead-contract', 'new-direction']
const STATUS_LABELS: Record<DirectionStatus, string> = {
  'declared': '已声明',
  'over-budget': '直调超预算',
  'dead-contract': '死契约',
  'new-direction': '新增方向',
}

/** 边键 → 四档色（装配层由 assembleDirections(target, report) 投影而来）。 */
export type EdgeStatusMap = Record<string, DirectionStatus>

export interface ScopeCanvasProps {
  model: ScopePageModel
  edgeStatus?: EdgeStatusMap
  selectedNodeId: string
  onSelect: (nodeId: string) => void
  /** 双击领域卡（含域外引用卡，剥 ext: 前缀）换 scope；容器卡不会触发。 */
  onOpenScope: (scopeId: string, label: string) => void
}

const ZOOM_MIN = 0.4
const ZOOM_MAX = 2.5

function cardSize(node: ScopeNode): [number, number] {
  if (node.external) return [EXT_W, EXT_H]
  return node.kind === 'container' ? [CARD_W, CONTAINER_H] : [CARD_W, CARD_H]
}

export function ScopeCanvas({ model, edgeStatus, selectedNodeId, onSelect, onOpenScope }: ScopeCanvasProps): JSX.Element {
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [atomicNote, setAtomicNote] = useState('')
  const wrap = useRef<HTMLDivElement>(null)

  const layout = useMemo(() => layoutScopeCards(model.nodes, model.edges), [model])

  // 选中态投影（验收 9）：邻居=与选中卡共享任一条模型边的卡；高亮与压暗同一次渲染算定，
  // 「只压暗不高亮」在结构上不可能出现。
  const { highlightIds, projectionNeighborIds } = useMemo(() => {
    const highlights = new Set<string>()
    const projections = new Set<string>()
    if (selectedNodeId) {
      for (const edge of model.edges) {
        const other = edge.from === selectedNodeId ? edge.to : edge.to === selectedNodeId ? edge.from : null
        if (!other || other === selectedNodeId) continue
        if (edge.kind === 'projection') projections.add(other)
        else highlights.add(other)
      }
    }
    return { highlightIds: highlights, projectionNeighborIds: projections }
  }, [model, selectedNodeId])

  // 换 scope 或换选中即收掉容器原子说明——说明只描述最近一次双击的语境
  useEffect(() => {
    setAtomicNote('')
  }, [model.scopeId, selectedNodeId])

  // ⌘/Ctrl+滚轮缩放：native listener 才能 preventDefault（React 合成事件拦不住页面缩放）；
  // 普通滚轮交给浏览器。真机清单 1 只承接视觉/手感，这里锁事件→状态。
  useEffect(() => {
    const el = wrap.current
    if (!el) return
    const onWheel = (ev: WheelEvent) => {
      if (!(ev.ctrlKey || ev.metaKey)) return
      ev.preventDefault()
      setZoom((z) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z * Math.exp(-ev.deltaY * 0.0035))))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  const onPanStart = (ev: React.MouseEvent) => {
    if ((ev.target as HTMLElement).closest('[data-node]')) return
    const sx = ev.clientX
    const sy = ev.clientY
    const origin = pan
    const onMove = (e: MouseEvent) => setPan({ x: origin.x + e.clientX - sx, y: origin.y + e.clientY - sy })
    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    ev.preventDefault()
  }

  const onBlankDoubleClick = (ev: React.MouseEvent) => {
    if ((ev.target as HTMLElement).closest('[data-node]')) return
    setPan({ x: 0, y: 0 })
    setZoom(1)
  }

  const onCardDoubleClick = (node: ScopeNode, ev: React.MouseEvent) => {
    ev.stopPropagation()
    if (node.kind === 'container') {
      console.info('[codegraph] container double click blocked (atomic)', { containerId: node.id })
      setAtomicNote('容器没有下一层：结构轴到容器为止')
      return
    }
    const targetId = node.external ? node.id.slice(4) : node.id
    console.info('[codegraph] scope enter', { from: model.scopeId, to: targetId, label: node.label })
    setAtomicNote('')
    onOpenScope(targetId, node.label)
  }

  const centerOf = (node: ScopeNode): [number, number] => {
    const p = layout.positions[node.id] ?? [0, 0]
    const size = cardSize(node)
    return [p[0] + size[0] / 2, p[1] + size[1] / 2]
  }

  let width = 1200
  let height = 620
  for (const node of model.nodes) {
    const [x, y] = layout.positions[node.id] ?? [0, 0]
    const size = cardSize(node)
    width = Math.max(width, x + size[0] + 200)
    height = Math.max(height, y + size[1] + 160)
  }

  return (
    <section
      ref={wrap}
      data-scope-canvas
      data-zoom={zoom}
      data-transform={`translate(${pan.x},${pan.y})`}
      onMouseDown={onPanStart}
      onDoubleClick={onBlankDoubleClick}
      className="relative min-w-0 flex-1 overflow-hidden"
    >
      {!model.organizationAvailable && (
        <div data-org-unavailable role="status" className="absolute left-3 top-3 z-30 rounded border bg-background px-3 py-1.5 text-xs text-muted-foreground shadow-sm">
          按最优树不可用：本图没有 best.json——切「按现状领域」，或先补扫生成最优树
        </div>
      )}
      <div
        className="relative"
        style={{ width, height, transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: '0 0' }}
      >
        <svg width={width} height={height} className="pointer-events-none absolute inset-0">
          <defs>
            <marker id="cg-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" className="fill-current text-neutral-500" />
            </marker>
          </defs>
          {layout.packageFrames.map((frame) => (
            <rect
              key={frame.dir || '(no-dir)'}
              data-package-frame={frame.dir}
              x={frame.x}
              y={frame.y}
              width={frame.w}
              height={frame.h}
              rx={14}
              fill="#8a8a8a"
              fillOpacity={0.04}
              stroke="#c4c4c4"
              strokeWidth={1.2}
            />
          ))}
          {model.edges.map((edge) => {
            const from = model.nodes.find((n) => n.id === edge.from)
            const to = model.nodes.find((n) => n.id === edge.to)
            if (!from || !to) return null
            const [x1, y1] = centerOf(from)
            const [x2, y2] = centerOf(to)
            const status = edgeStatus?.[`${edge.from}->${edge.to}`]
            return (
              <line
                key={edge.key}
                data-edge-key={edge.key}
                data-edge-kind={edge.kind}
                {...(edge.projectionType !== undefined ? { 'data-projection-type': edge.projectionType } : {})}
                {...(status !== undefined ? { 'data-direction-status': status } : {})}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                markerEnd="url(#cg-arrow)"
                strokeWidth={edge.weight >= 8 ? 3 : edge.weight >= 3 ? 2 : 1}
                className={edge.kind === 'projection' ? 'stroke-purple-400' : status === 'dead-contract' || status === 'over-budget' ? 'stroke-amber-500' : 'stroke-neutral-400'}
                strokeDasharray={edge.kind === 'projection' ? '6 4' : undefined}
                fill="none"
              />
            )
          })}
        </svg>

        {model.nodes.map((node) => {
          const [x, y] = layout.positions[node.id] ?? [0, 0]
          const size = cardSize(node)
          const isSelected = node.id === selectedNodeId
          const isNeighbor = highlightIds.has(node.id) || projectionNeighborIds.has(node.id)
          const related = isSelected || isNeighbor
          return (
            <div
              key={node.id}
              data-node={node.id}
              data-node-kind={node.kind}
              {...(node.external ? { 'data-external': 'true' } : {})}
              {...(node.isolated ? { 'data-isolated': 'true' } : {})}
              {...(node.kind === 'domain' && node.childCount > 0 ? { 'data-nested': 'true' } : {})}
              {...(node.oversized ? { 'data-oversized': 'true' } : {})}
              {...(isSelected ? { 'data-selected': 'true' } : {})}
              {...(isNeighbor && !isSelected ? { 'data-highlight': 'true' } : {})}
              {...(!related ? { 'data-dimmed': 'true' } : {})}
              onClick={() => {
                setAtomicNote('')
                onSelect(node.id)
              }}
              onDoubleClick={(ev) => onCardDoubleClick(node, ev)}
              style={{ left: x, top: y, width: size[0], height: size[1] }}
              className={'absolute cursor-pointer rounded-xl border-2 bg-background p-2 shadow-sm '
                + (node.kind === 'domain' && node.childCount > 0 ? 'border-dashed ' : '')
                + (isSelected ? 'border-primary outline outline-2 outline-primary/60 z-10 ' : isNeighbor ? 'border-primary/70 z-[9] ' : 'opacity-50 border-neutral-300 ')}
            >
              <div className="truncate text-sm font-semibold">{node.label}</div>
              <div className="truncate font-mono text-[11px] text-muted-foreground">
                {node.type}{node.containerCount > 0 ? ` · ${node.containerCount} 容器` : ''}
                {node.symbolCount > 0 ? ` · ${node.symbolCount} 符号` : ''}
              </div>
              {node.oversized && (
                <div data-debt-mark className="mt-1 rounded bg-amber-100 px-1.5 py-0.5 text-[10.5px] leading-tight text-amber-800">
                  超大容器 · {node.symbolCount} 符号 / {node.fileCount} 文件 · 无声明职责如实报
                </div>
              )}
              {node.isolated && (
                <div data-isolated-reason className="mt-1 text-[10.5px] leading-tight text-muted-foreground">
                  {canvasIsolationReason(node, model)}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {atomicNote && (
        <div data-atomic-note role="status" className="absolute bottom-3 left-3 z-30 rounded border bg-background px-3 py-1.5 text-xs shadow-sm">
          {atomicNote}
        </div>
      )}
      <div data-direction-legend className="absolute right-3 bottom-3 z-30 flex flex-wrap items-center gap-2 rounded-full border bg-background px-3 py-1 text-[11px] shadow-sm">
        {DIRECTION_STATUSES.map((status) => (
          <span key={status} data-status-chip={status} className="inline-flex items-center gap-1">
            <i data-chip-color={status} className={'inline-block h-2.5 w-2.5 rounded-sm '
              + (status === 'declared' ? 'bg-emerald-500' : status === 'over-budget' ? 'bg-amber-500' : status === 'dead-contract' ? 'bg-red-500' : 'bg-sky-500')} />
            {STATUS_LABELS[status]}
          </span>
        ))}
        <span data-projection-legend className="text-muted-foreground">紫虚线＝projections 投影边，不是调用边</span>
        <span data-nested-legend className="text-muted-foreground">虚线框＝还有下层领域</span>
      </div>
    </section>
  )
}

/**
 * 孤立原因文案（§2.3-27）：只认模型已算定的拓扑事实——有 projection 关联边的孤立卡
 * 说明它不是漏建调用边而是跨语言投影关联；其余孤立卡如实说没有跨域调用入边。
 */
function canvasIsolationReason(node: ScopeNode, model: ScopePageModel): string {
  const hasProjection = model.edges.some(
    (edge) => edge.kind === 'projection' && (edge.from === node.id || edge.to === node.id),
  )
  return hasProjection
    ? '无跨域调用入边：仅有跨语言投影关联（twin/typed），不是调用边'
    : '无跨域调用入边（call 口径）'
}
