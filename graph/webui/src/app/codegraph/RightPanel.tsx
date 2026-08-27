import { useEffect, useMemo, useState } from 'react'
import type { CgBest, CgDomainDecls, CgGraph, CgTarget } from '../../api/types'
import type { ScopePageModel } from './scopepage'

export type RightPanelTab = 'basic' | 'outside' | 'state'

export interface RightPanelProps {
  model: ScopePageModel
  baseline: CgGraph
  best?: CgBest
  decls?: CgDomainDecls
  target?: CgTarget
  selectedId: string
  onSelectEntry: (id: string) => void
  organization: 'best' | 'current'
  onOrganizationChange: (organization: 'best' | 'current') => void
}

function safeWidth(): number {
  try {
    const raw = window.localStorage.getItem('codegraph:right-panel-width')
    const width = raw ? Number(raw) : 360
    return Number.isFinite(width) ? Math.min(620, Math.max(280, width)) : 360
  } catch {
    return 360
  }
}

function domainParent(graph: CgGraph, best: CgBest | undefined, organization: 'best' | 'current', id: string): string {
  if (organization === 'best') return best?.domains[id]?.parent ?? ''
  return graph.domains?.[id]?.parent ?? ''
}

function inDomain(graph: CgGraph, best: CgBest | undefined, organization: 'best' | 'current', assigned: string, root: string): boolean {
  let current = assigned
  const seen = new Set<string>()
  while (current && !seen.has(current)) {
    if (current === root) return true
    seen.add(current)
    current = domainParent(graph, best, organization, current)
  }
  return false
}

function entryGroups(graph: CgGraph, best: CgBest | undefined, model: ScopePageModel, organization: 'best' | 'current', selectedId: string) {
  const selected = model.nodes.find((node) => node.id === selectedId)
  const scope = selected?.itemType === 'domain'
    ? selected.id
    : selected?.itemType === 'container' ? selected.domainId : model.scopeId
  const entries = Object.entries(graph.nodes).filter(([, node]) => {
    if (node.kind !== 'entry' || (node as { status?: string }).status === 'deleted') return false
    if (!scope || model.level === 'root') return true
    const assigned = organization === 'best'
      ? best?.containers[node.container] ?? ''
      : graph.containers[node.container]?.domain ?? ''
    return inDomain(graph, best, organization, assigned, scope)
  }).sort(([a], [b]) => a.localeCompare(b))
  const groups = new Map<string, { label: string; ids: string[] }>()
  for (const [id, node] of entries) {
    const key = node.channel === 'cli' || node.channel === 'http' || node.channel === 'ws' || node.channel === 'web' ? node.channel : 'unmarked'
    const label = key === 'unmarked' ? '通道未标注' : key.toUpperCase()
    const group = groups.get(key) ?? { label, ids: [] }
    group.ids.push(id)
    groups.set(key, group)
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, group]) => ({ key, ...group }))
}

function selectedLabel(model: ScopePageModel, selectedId: string): string {
  return model.nodes.find((node) => node.id === selectedId)?.label ?? model.title
}

export function RightPanel(props: RightPanelProps) {
  const { model, baseline, best, decls, target, selectedId, onSelectEntry, organization, onOrganizationChange } = props
  const [tab, setTab] = useState<RightPanelTab>('basic')
  const [width, setWidth] = useState(safeWidth)
  const [resizing, setResizing] = useState(false)
  const selectedNode = model.nodes.find((node) => node.id === selectedId)
  const domainId = selectedNode?.itemType === 'container'
    ? selectedNode.domainId
    : selectedId || model.scopeId || undefined
  const declaration = domainId ? decls?.[domainId] : undefined
  const groups = useMemo(() => entryGroups(baseline, best, model, organization, selectedId), [baseline, best, model, organization, selectedId])

  useEffect(() => {
    try { window.localStorage.setItem('codegraph:right-panel-width', String(width)) } catch { /* 隐私模式仍保持内存宽度 */ }
  }, [width])

  useEffect(() => {
    if (!resizing) return
    const move = (event: MouseEvent) => setWidth((old) => Math.min(620, Math.max(280, old - event.movementX)))
    const up = () => setResizing(false)
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
    return () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up) }
  }, [resizing])

  return <aside data-right-panel className="relative shrink-0 overflow-y-auto border-l bg-background p-4 text-sm" style={{ width }}>
    <div data-resize-handle role="separator" aria-label="拖动调整右栏宽度" className="absolute inset-y-0 left-0 w-1 cursor-col-resize bg-transparent hover:bg-primary/30" onMouseDown={() => setResizing(true)} />
    <div className="mb-3 flex items-center justify-between gap-2"><div><h2 className="font-semibold">{selectedLabel(model, selectedId)}</h2><p className="text-[11px] text-muted-foreground">结构轴 · {model.level}</p></div><div className="flex gap-1"><button type="button" data-organization="best" className="rounded border px-1.5 py-0.5 text-[11px]" disabled={!best} aria-pressed={organization === 'best'} onClick={() => onOrganizationChange('best')}>按最优树</button><button type="button" data-organization="current" className="rounded border px-1.5 py-0.5 text-[11px]" aria-pressed={organization === 'current'} onClick={() => onOrganizationChange('current')}>按现状</button></div></div>
    <div data-right-tabs role="tablist" aria-label="结构轴详情"><button type="button" role="tab" aria-selected={tab === 'basic'} className="mr-1 rounded px-2 py-1 text-xs" onClick={() => setTab('basic')}>基本信息</button><button type="button" role="tab" aria-selected={tab === 'outside'} className="mr-1 rounded px-2 py-1 text-xs" onClick={() => setTab('outside')}>对外面</button><button type="button" role="tab" aria-selected={tab === 'state'} className="rounded px-2 py-1 text-xs" onClick={() => setTab('state')}>状态机</button></div>
    {tab === 'basic' ? <section data-panel-tab="basic" className="mt-4 space-y-3">
      <div className="rounded border p-3"><h3 className="mb-1 text-xs font-semibold">职责</h3>{declaration ? <p data-declaration>{declaration.responsibility}</p> : <p data-empty="no-declaration" className="text-xs text-muted-foreground">未声明 · 写入 codegraph/domains/{domainId ?? model.scopeId ?? '当前领域'}.json</p>}</div>
      <div className="rounded border p-3"><h3 className="mb-1 text-xs font-semibold">读数</h3><p>入缝 {model.inboundPorts.reduce((sum, port) => sum + port.count, 0)}</p><p>兜底桶占比 {model.readouts.fallbackBucketPercentage === null ? '无数据' : `${model.readouts.fallbackBucketPercentage}%`}</p>{model.noEntities ? <p data-empty="no-entities" className="text-xs text-muted-foreground">无实体：未发现 modelKind=entity</p> : null}{model.noInboundSeams ? <p data-empty="no-inbound-seams" className="text-xs text-muted-foreground">无入缝：没有跨域调用进入</p> : null}</div>
      <div data-program-entries className="rounded border p-3"><h3 className="mb-1 text-xs font-semibold">程序入口</h3>{groups.length ? groups.map((group) => <section key={group.key} data-entry-channel={group.key} className="mt-2"><h4 className="text-[11px] font-semibold">{group.label}</h4>{group.ids.map((id) => <button type="button" key={id} data-program-entry={id} className="mt-1 block w-full rounded border px-2 py-1 text-left text-xs hover:bg-muted" onClick={() => onSelectEntry(id)}>{baseline.nodes[id]?.name ?? id}</button>)}</section>) : <p data-empty="no-entry" className="text-xs text-muted-foreground">暂无程序入口</p>}</div>
    </section> : null}
    {tab === 'outside' ? <section data-panel-tab="outside" className="mt-4 space-y-3"><div className="rounded border p-3"><h3 className="mb-1 text-xs font-semibold">对外面</h3><p className="text-xs text-muted-foreground">对外入缝是跨层边界被调进来的符号；程序入口是 CLI/HTTP/WS 外部入口，两者不是同一读数。</p>{model.inboundPorts.length ? model.inboundPorts.map((port) => <div key={port.domainId} className="flex justify-between border-t py-1 text-xs"><span>{port.label}</span><b>{port.count}</b></div>) : <p data-empty="no-inbound-seams" className="text-xs text-muted-foreground">无入缝：没有跨域调用进入本层</p>}{model.outboundPorts.length ? <div className="mt-2 border-t pt-2">{model.outboundPorts.map((port) => <div key={port.domainId} className="flex justify-between py-1 text-xs"><span>→ {port.label}</span><b>{port.count}</b></div>)}</div> : null}</div></section> : null}
    {tab === 'state' ? <section data-panel-tab="state" className="mt-4 rounded border p-3"><h3 className="mb-1 text-xs font-semibold">状态机</h3>{declaration?.stateMachine?.length ? declaration.stateMachine.map((transition) => <div key={`${transition.from}-${transition.to}`} data-transition className="border-t py-1.5 text-xs">{transition.from} → {transition.to}{transition.anchor ? ` · ${transition.anchor}` : ''}</div>) : <p data-empty="no-state-machine" className="text-xs text-muted-foreground">没有状态机声明（anchor 缺席，不显示假读数）</p>}{target ? <p className="mt-2 text-[11px] text-muted-foreground">契约方向 {target.contracts?.length ?? 0}</p> : null}</section> : null}
  </aside>
}
