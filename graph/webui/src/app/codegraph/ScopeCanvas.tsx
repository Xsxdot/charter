// ScopeCanvas —— 结构图画布：卡片、连线、选中态、平移缩放。
//
// 职责：把 ScopePageModel 的拓扑事实画出来——布局来源为 scopelayout 移植分层+装箱；
// 单击选中（有选中才压暗无关项；再点已选中卡取消）、双击领域下钻 / 双击容器显原子说明、
// 空白拖动平移、⌘/Ctrl+滚轮缩放、双击空白回到 fit 态。
// 边界：只消费模型与装配层注入的直调债四档色映射（edgeStatus，R2 备案的装配
// join）；选中高亮/压暗是运行期选择状态对 model.edges 的直接投影，不是模型读数
// 重算。wheel 缩放与拖拽平移的浏览器兼容归真机清单 1，机内只断言事件驱动状态变化
// （data-zoom / data-transform）。ext 卡已退役，跨层调出走 externalOut 图例。
// 禁 snapshot，全部 data-* 行为查询。
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { JSX } from 'react'
import type { DirectionStatus } from './besttree'
import type { ScopeNode, ScopePageModel } from './scopepage'
import { CARD_H, CARD_W, CONTAINER_H, layoutScopeCards, scopeEdgeAnchors, scopeEdgePath } from './scopelayout'

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
  /** 双击领域卡换 scope；容器卡不会触发。 */
  onOpenScope: (scopeId: string, label: string) => void
}

const ZOOM_MIN = 0.4
const ZOOM_MAX = 2.5
const TOP_LAYER_FALLBACK = 30

function cardSize(node: ScopeNode): [number, number] {
  return node.kind === 'container' ? [CARD_W, CONTAINER_H] : [CARD_W, CARD_H]
}

export function ScopeCanvas({ model, edgeStatus, selectedNodeId, onSelect, onOpenScope }: ScopeCanvasProps): JSX.Element {
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [atomicNote, setAtomicNote] = useState('')
  const wrap = useRef<HTMLDivElement>(null)

  const layout = useMemo(() => layoutScopeCards(model.nodes, model.edges), [model])
  const fitToBounds = useCallback(() => {
    const viewportWidth = wrap.current?.clientWidth || 1200
    const viewportHeight = wrap.current?.clientHeight || 620
    const boundsWidth = Math.max(layout.bounds.w, 1)
    const boundsHeight = Math.max(layout.bounds.h, 1)
    const nextZoom = Math.min(viewportWidth / boundsWidth, viewportHeight / boundsHeight, 1)
    const nextPan = {
      x: Math.max(0, (viewportWidth - boundsWidth * nextZoom) / 2),
      y: Math.max(0, (viewportHeight - boundsHeight * nextZoom) / 2),
    }
    console.info('[codegraph] scope fit', { scopeId: model.scopeId, zoom: nextZoom, bounds: layout.bounds })
    setZoom(nextZoom)
    setPan(nextPan)
  }, [layout.bounds.h, layout.bounds.w, model.scopeId])

  // 首次渲染与 scope 切换才重算 fit；选中、拖动、滚轮不会被模型对象变化重置。
  useEffect(() => {
    fitToBounds()
  }, [fitToBounds, model.scopeId])

  // 选中态投影（验收 9）：空选中全不透明。有选中时邻居=与选中卡共享任一条模型边的卡；
  // 高亮与压暗同一次渲染算定，「只压暗不高亮」在结构上不可能出现。
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
    fitToBounds()
  }

  const onCardDoubleClick = (node: ScopeNode, ev: React.MouseEvent) => {
    ev.stopPropagation()
    if (node.kind === 'container') {
      console.info('[codegraph] container double click blocked (atomic)', { containerId: node.id })
      setAtomicNote('容器没有下一层：结构轴到容器为止')
      return
    }
    const targetId = node.id
    console.info('[codegraph] scope enter', { from: model.scopeId, to: targetId, label: node.label })
    setAtomicNote('')
    onOpenScope(targetId, node.label)
  }

  const rectOf = (node: ScopeNode) => {
    const p = layout.positions[node.id] ?? [0, 0]
    const size = cardSize(node)
    return { x: p[0], y: p[1], w: size[0], h: size[1] }
  }

  let width = 1200
  let height = 620
  for (const node of model.nodes) {
    const [x, y] = layout.positions[node.id] ?? [0, 0]
    const size = cardSize(node)
    width = Math.max(width, x + size[0] + 200)
    height = Math.max(height, y + size[1] + 160)
  }

  const isolatedIds = new Set(layout.isolatedIds)
  const cyclicIds = new Set(layout.cyclicNodeIds)
  const renderCard = (node: ScopeNode) => {
    const [x, y] = layout.positions[node.id] ?? [0, 0]
    const size = cardSize(node)
    const isSelected = node.id === selectedNodeId
    const isNeighbor = highlightIds.has(node.id) || projectionNeighborIds.has(node.id)
    const related = isSelected || isNeighbor
    const dimmed = Boolean(selectedNodeId) && !related
    const duty = node.responsibility.state === 'declared'
      ? node.responsibility.text
      : node.responsibility.state === 'no-subject'
        ? `无职责主体（${node.type || '未知类型'}）`
        : '未声明职责'
    return (
      <div
        key={node.id}
        data-node={node.id}
        data-node-kind={node.kind}
        {...(node.isolated ? { 'data-isolated': 'true' } : {})}
        {...(node.kind === 'domain' && node.childCount > 0 ? { 'data-nested': 'true' } : {})}
        {...(node.oversized ? { 'data-oversized': 'true' } : {})}
        {...(isSelected ? { 'data-selected': 'true' } : {})}
        {...(isNeighbor && !isSelected ? { 'data-highlight': 'true' } : {})}
        {...(dimmed ? { 'data-dimmed': 'true' } : {})}
        onClick={() => {
          setAtomicNote('')
          onSelect(isSelected ? '' : node.id)
        }}
        onDoubleClick={(ev) => onCardDoubleClick(node, ev)}
        style={{ left: x, top: y, width: size[0], height: size[1] }}
        className={'pointer-events-auto absolute cursor-pointer rounded-xl border-2 bg-background p-2 shadow-sm '
          + (node.kind === 'domain' && node.childCount > 0 ? 'border-dashed ' : '')
          + (isSelected ? 'border-primary outline outline-2 outline-primary/60 z-10 '
            : isNeighbor ? 'border-primary/70 z-[9] '
              : dimmed ? 'opacity-50 border-neutral-300 '
                : 'border-neutral-300 ')}
      >
        <div className="truncate text-sm font-semibold">{node.label}</div>
        <div className="truncate font-mono text-[11px] text-muted-foreground">
          {node.type}{node.containerCount > 0 ? ` · ${node.containerCount} 容器` : ''}
          {node.symbolCount > 0 ? ` · ${node.symbolCount} 符号` : ''}
        </div>
        {node.kind === 'container' && (
          /* 原型 graph.js:248-260 把职责放进容器卡；这里保留其卡面职责位置，另如实区分三态。 */
          <div data-duty className={'mt-1 text-[10.5px] leading-tight '
            + (node.responsibility.state === 'declared' ? 'line-clamp-2 text-neutral-600' : 'italic text-muted-foreground')}>
            {duty}
          </div>
        )}
        {node.kind === 'domain' && model.scopeId === null && node.entryDispersion && node.entryDispersion.entries > 0 && (
          /* 原型 index.html:103-106、114-118 只在根层给领域卡放入口徽标；散度已由模型层算定，视图只投影。 */
          <div
            data-entry-badge
            {...(node.entryDispersion.concentrated ? { 'data-entry-badge-concentrated': 'true' } : {})}
            className={'mt-1 inline-block rounded px-1.5 py-0.5 text-[10px] leading-tight '
              + (node.entryDispersion.concentrated ? 'bg-amber-100 text-amber-800' : 'bg-muted text-muted-foreground')}
          >
            ▣ {node.entryDispersion.entries} 入口{node.entryDispersion.concentrated ? ' · 集中' : ''}
          </div>
        )}
        {cyclicIds.has(node.id) && (
          <span data-cyclic="true" className="absolute right-2 top-1 rounded-full bg-red-100 px-1 text-[10px] text-red-600">⟲</span>
        )}
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
  }
  const layerNumbers = [...new Set(Object.values(layout.layers))].sort((a, b) => a - b)
  const isolatedNodes = model.nodes.filter((node) => isolatedIds.has(node.id))
  const linkedNodes = model.nodes.filter((node) => !isolatedIds.has(node.id))

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
          {layerNumbers.map((layer) => {
            const first = model.nodes.find((node) => layout.layers[node.id] === layer)
            const y = first ? (layout.positions[first.id]?.[1] ?? TOP_LAYER_FALLBACK) + 15 : 15
            return <text key={layer} data-layer-label={`L${layer}`} x={4} y={y} className="fill-neutral-400 text-[11px]">L{layer}</text>
          })}
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
            const kind = layout.backEdgeKeys.includes(edge.key)
              ? 'back'
              : layout.layers[edge.from] !== undefined && layout.layers[edge.from] === layout.layers[edge.to]
                ? 'sibling'
                : 'forward'
            const { x1, y1, x2, y2 } = scopeEdgeAnchors(rectOf(from), rectOf(to), kind)
            const status = edgeStatus?.[`${edge.from}->${edge.to}`]
            const edgeRelated = !selectedNodeId || edge.from === selectedNodeId || edge.to === selectedNodeId
            const edgeDimmed = Boolean(selectedNodeId) && !edgeRelated
            // 原型 graph.js:54-64 按行方向区分正向/回边；同层环内边在此优先走回边折返，而非原型下沿浅弧，保持环红标可辨。
            return (
              <path
                key={edge.key}
                data-edge-key={edge.key}
                data-edge-kind={edge.kind}
                {...(edge.projectionType !== undefined ? { 'data-projection-type': edge.projectionType } : {})}
                {...(status !== undefined ? { 'data-direction-status': status } : {})}
                {...(edgeDimmed ? { 'data-dimmed': 'true' } : {})}
                d={scopeEdgePath(x1, y1, x2, y2, kind)}
                markerEnd="url(#cg-arrow)"
                strokeWidth={edge.weight >= 8 ? 3 : edge.weight >= 3 ? 2 : 1}
                className={(edge.kind === 'projection' ? 'stroke-purple-400' : layout.backEdgeKeys.includes(edge.key) ? 'stroke-red-600' : status === 'dead-contract' || status === 'over-budget' ? 'stroke-amber-500' : 'stroke-neutral-400')
                  + (edgeDimmed ? ' opacity-20' : '')}
                strokeDasharray={edge.kind === 'projection' ? '6 4' : layout.backEdgeKeys.includes(edge.key) ? '6 3' : undefined}
                {...(layout.backEdgeKeys.includes(edge.key) ? { 'data-back-edge': 'true' } : {})}
                fill="none"
              />
            )
          })}
        </svg>

        {linkedNodes.map(renderCard)}
        {isolatedNodes.length > 0 && (
          /* 原型 graph.js:70-80、index.html:123-126 将 call 度为 0 节点移出分层；单列孤立区避免把它们误报为 L0 调用方。 */
          <div data-isolated-row className="pointer-events-none absolute inset-0">
            <div className="absolute left-2 top-0 text-[11px] text-muted-foreground">孤立节点（本层内既不调用别人也不被调用）</div>
            {isolatedNodes.map(renderCard)}
          </div>
        )}
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
        {model.externalOut.length > 0 && (
          <span data-external-out className="text-muted-foreground">
            调出到本层之外：{model.externalOut.map((item, index) => (
              <span key={item.neighborId}>
                {index > 0 ? ' · ' : ''}
                <button type="button" data-external-out-item={item.neighborId} className="underline" onClick={() => onOpenScope(item.neighborId, item.label)}>
                  {item.label} {item.weight}
                </button>
              </span>
            ))}
          </span>
        )}
      </div>
    </section>
  )
}

/**
 * 孤立原因文案（§2.3-27）：只认模型已算定的拓扑事实——call 入边与出边都为空（deg 0）。
 * 有 projection 关联边的孤立卡说明它不是漏建调用边而是跨语言投影关联；其余如实说明
 * call 度为 0。
 */
function canvasIsolationReason(node: ScopeNode, model: ScopePageModel): string {
  const hasProjection = model.edges.some(
    (edge) => edge.kind === 'projection' && (edge.from === node.id || edge.to === node.id),
  )
  return hasProjection
    ? 'call 度为 0（无跨域调用入边/出边）：仅有跨语言投影关联（twin/typed），不是调用边'
    : 'call 度为 0（无跨域调用入边/出边）'
}
