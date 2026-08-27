import type { ReactNode } from 'react'
import { isKnownContainerKind, type ScopeContainerItem, type ScopeDomainItem, type ScopeEdge, type ScopeItem, type ScopePageModel } from './scopepage'

export interface ScopeCanvasProps {
  model: ScopePageModel
  selectedId: string
  onSelect: (id: string) => void
  onEnter: (id: string) => void
  onContainerNotice: (message: string) => void
  migrationCount?: number
  migrationSlot?: ReactNode
}

function cardClass(item: ScopeItem, selected: boolean, connected: boolean, activeId: string): string {
  const dimmed = !!activeId && item.id !== activeId && !connected
  return 'rounded-xl border-2 bg-background p-3 text-left shadow-sm transition ' + (selected ? 'outline outline-2 outline-primary ' : '')
    + (connected ? 'ring-2 ring-sky-300 ' : '') + (dimmed ? 'opacity-40 ' : '')
    + (item.itemType === 'container' ? 'border-dashed ' : '')
}

function edgePath(edge: ScopeEdge, index: number): string {
  const from = 120 + index * 250
  const to = from + 170
  const bend = edge.kind === 'projection' ? 28 : -18
  return `M ${from} 118 Q ${(from + to) / 2} ${118 + bend} ${to} 118`
}

function domainCard(item: ScopeDomainItem, onSelect: () => void, onEnter: () => void, selected: boolean, connected: boolean, activeId: string) {
  return <button type="button" data-scope-node={item.id} data-scope-node-kind="domain" className={cardClass(item, selected, connected, activeId)} onClick={onSelect} onDoubleClick={onEnter}>
    <span className="flex items-center justify-between gap-2"><b>{item.label}</b><span className="text-[10px] text-muted-foreground">领域</span></span>
    <span className="mt-1 block text-xs text-muted-foreground">{item.responsibility || `未声明 · 写入 ${item.declarationPath}`}</span>
    <span className="mt-2 flex flex-wrap gap-2 border-t pt-2 text-[11px] text-muted-foreground"><span>容器 {item.containerCount}</span><span>实体 {item.entityCount}</span><span>入缝 {item.inboundCount}</span></span>
    {item.isolated ? <span data-isolated-reason className="mt-1 block text-[10px] text-amber-700">{item.isolationReason}</span> : null}
    {item.hasChildren ? <span className="mt-1 block text-[10px] text-primary">双击进入 {item.childCount} 个下层领域</span> : <span className="mt-1 block text-[10px] text-muted-foreground">叶子领域 · 双击查看容器</span>}
  </button>
}

function containerCard(item: ScopeContainerItem, onSelect: () => void, onEnter: () => void, selected: boolean, connected: boolean, activeId: string, onNotice: () => void) {
  return <button type="button" data-scope-node={item.id} data-scope-node-kind="container" data-debt-color={item.debtColor}
    className={cardClass(item, selected, connected, activeId)} onClick={onSelect} onDoubleClick={onEnter}>
    <span className="flex items-center justify-between gap-2"><b>{item.label}</b><span className="text-[10px] text-muted-foreground">{item.kind || 'kind 未标注'}</span></span>
    <span className="mt-1 block text-xs text-muted-foreground">{item.noSubject ? '无职责主体' : item.responsibility || '未声明容器职责'}</span>
    <span className="mt-2 flex flex-wrap gap-2 border-t pt-2 text-[11px] text-muted-foreground"><span>符号 {item.symbolCount}</span><span>文件 {item.fileCount}</span><span data-debt-mark>{item.debtColor}</span></span>
    {item.isOversized ? <span data-oversized className="mt-1 block text-[10px] text-amber-700">大容器：如实展示，不折叠圆场</span> : null}
    {item.collapsed ? <span data-collapsed-symbols className="mt-1 block text-[10px] text-muted-foreground">{item.collapsedSymbolIds.length} 个高复用工具已收起（可展开）</span> : null}
    {item.noEntities ? <span data-empty="no-entities" className="mt-1 block text-[10px] text-muted-foreground">无实体：未发现 modelKind=entity</span> : null}
    {item.noInboundSeams ? <span data-empty="no-inbound-seams" className="mt-1 block text-[10px] text-muted-foreground">无入缝：没有跨域调用进入</span> : null}
    {!isKnownContainerKind(item.kind) ? <span data-unknown-kind className="mt-1 block text-[10px] text-destructive">未知 kind：扫描闸门应报错</span> : null}
    <span className="mt-1 block text-[10px] text-muted-foreground" onClick={(event) => { event.stopPropagation(); onNotice() }}>容器是原子节点 · 双击无下一层</span>
  </button>
}

function connectedIds(edges: ScopeEdge[], selectedId: string): Set<string> {
  const out = new Set<string>()
  if (!selectedId) return out
  for (const edge of edges) if (edge.from === selectedId) out.add(edge.to); else if (edge.to === selectedId) out.add(edge.from)
  return out
}

export function ScopeCanvas({ model, selectedId, onSelect, onEnter, onContainerNotice, migrationCount = 0, migrationSlot }: ScopeCanvasProps) {
  const connected = connectedIds(model.edges, selectedId)
  const itemIndex = new Map(model.nodes.map((item, index) => [item.id, index]))
  return <section data-structure-canvas data-nested-frame={model.nestedFrame ? 'true' : undefined} className="relative min-h-0 min-w-0 flex-1 overflow-auto p-4">
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><div><h2 data-scope-title className="text-base font-semibold">{model.title}</h2><p className="text-xs text-muted-foreground">根 → 领域 → 容器 · 单击看右栏 · 双击领域下钻</p></div>
      <div className="flex items-center gap-2"><div data-debt-legend className="flex gap-1 text-[10px]"><span data-debt-color="declared" className="rounded bg-emerald-100 px-1.5 py-0.5">已声明</span><span data-debt-color="over-budget" className="rounded bg-red-100 px-1.5 py-0.5">超预算</span><span data-debt-color="dead-contract" className="rounded bg-gray-200 px-1.5 py-0.5">死契约</span><span data-debt-color="new-direction" className="rounded bg-amber-100 px-1.5 py-0.5">新方向</span></div>{migrationSlot ?? <span data-migration-count>{migrationCount}</span>}</div>
    </div>
    {!model.available ? <div data-scope-unavailable className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm">{model.unavailableReason}</div> : null}
    {model.degradedReason ? <div data-scope-degraded className="mb-3 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">降级：{model.degradedReason}</div> : null}
    <div className="relative min-h-[520px] rounded-xl border bg-muted/20 p-5" data-scope-frame>
      <svg data-scope-edges className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true"><defs><marker id="scope-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L7,3 z" fill="currentColor" /></marker></defs>{model.edges.map((edge, index) => <path key={edge.id} data-scope-edge={edge.id} data-edge-kind={edge.kind} d={edgePath(edge, index)} fill="none" stroke={edge.nonCall ? '#9333ea' : '#94a3b8'} strokeDasharray={edge.nonCall ? '6 4' : undefined} strokeWidth={Math.max(1.5, Math.min(8, edge.count / 2))} markerEnd="url(#scope-arrow)" />)}</svg>
      <div className="relative grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">{model.nodes.map((item) => {
        const selected = item.id === selectedId
        const itemConnected = connected.has(item.id)
        return item.itemType === 'domain'
          ? domainCard(item, () => onSelect(item.id), () => onEnter(item.id), selected, itemConnected, selectedId)
          : containerCard(item, () => onSelect(item.id), () => onContainerNotice('容器没有下一层：它是结构轴的原子节点'), selected, itemConnected, selectedId, () => onContainerNotice('容器没有下一层：它是结构轴的原子节点'))
      })}</div>
      {!model.nodes.length ? <p data-scope-empty className="py-10 text-center text-sm text-muted-foreground">当前层没有可显示节点</p> : null}
      {model.edges.filter((edge) => edge.nonCall).map((edge) => <span key={`${edge.id}-label`} data-projection-label className="absolute left-3 bottom-3 rounded border border-purple-300 bg-purple-50 px-2 py-1 text-[10px] text-purple-800">{edge.label ?? '不是调用边'}</span>)}
    </div>
    <div className="mt-3 grid gap-2 text-xs md:grid-cols-3"><div className="rounded border bg-background p-2">兜底桶占比：{model.readouts.fallbackBucketPercentage === null ? '无数据' : `${model.readouts.fallbackBucketPercentage}%`}（{model.readouts.fallbackBucketShare.numerator}/{model.readouts.fallbackBucketShare.denominator}）</div><div className="rounded border bg-background p-2">复用度：{model.readouts.trueSharedKernelNodes.length} 真共享 / {model.readouts.falseSharedKernelNodes.length} 工具复用 · 不可达 {model.readouts.unreachableNodes.length}</div><div className="rounded border bg-background p-2">触达领域散度：{model.readouts.touchedDomainCount} · 未知 kind 边 {model.readouts.unknownKindEdges}</div></div>
    <div className="sr-only">{[...itemIndex.keys()].join(',')}</div>
  </section>
}
