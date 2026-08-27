import { useEffect, useMemo, useState } from 'react'
import type { CgBest, CgCheckReport, CgDomainDecls, CgGraph, CgTarget } from '../../api/types'
import { deriveScopePage } from './scopepage'
import { ScopeCanvas } from './ScopeCanvas'
import { RightPanel } from './RightPanel'
import { FlowPageView } from './FlowPageView'
import { MigrationDrawer, type MigrationDrawerItem } from './MigrationDrawer'

export interface TwoAxisPageProps {
  baseline: CgGraph
  best?: CgBest
  decls?: CgDomainDecls
  target?: CgTarget
  report?: CgCheckReport
}

function migrationItems(best: CgBest | undefined, baseline: CgGraph, report?: CgCheckReport): MigrationDrawerItem[] {
  if (!best) return []
  return (report?.warns ?? []).filter((finding) => finding.kind === 'container-misplaced' && !!finding.from).map((finding) => {
    const id = finding.from!
    const expected = best.containers[id] ?? '未映射目标'
    return { id, label: baseline.containers[id]?.label ?? id, current: baseline.containers[id]?.domain ?? '未归属', expected: best.domains[expected]?.label ?? expected }
  }).sort((a, b) => a.id.localeCompare(b.id))
}

export function TwoAxisPage({ baseline, best, decls, target, report }: TwoAxisPageProps) {
  const [axis, setAxis] = useState<'structure' | 'behavior'>('structure')
  const [organization, setOrganization] = useState<'best' | 'current'>(best ? 'best' : 'current')
  const [scopeId, setScopeId] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState('')
  const [flowEntryId, setFlowEntryId] = useState('')
  const [containerNotice, setContainerNotice] = useState('')
  const [migrationOpen, setMigrationOpen] = useState(false)
  const model = useMemo(() => deriveScopePage({ baseline, best, decls, target, organization, scopeId }), [baseline, best, decls, target, organization, scopeId])
  const migrations = useMemo(() => migrationItems(best, baseline, report), [best, baseline, report])

  useEffect(() => {
    if (selectedId && !model.nodes.some((node) => node.id === selectedId)) setSelectedId('')
    setContainerNotice('')
  }, [model.nodes, selectedId])

  const enterScope = (id: string) => {
    if (!model.nodes.some((node) => node.id === id)) return
    setScopeId(id); setSelectedId(''); setContainerNotice('')
  }
  const enterSelectedContainer = () => setContainerNotice('容器没有下一层：它是结构轴的原子节点')
  const switchOrganization = (next: 'best' | 'current') => {
    if (next === 'best' && !best) return
    setOrganization(next); setScopeId(null); setSelectedId(''); setFlowEntryId('')
  }

  return <section data-two-axis-page className="flex h-full min-h-0 flex-col"><header className="flex flex-wrap items-center gap-3 border-b px-4 py-3"><div><h1 className="text-base font-semibold">代码图 · 两轴查看器</h1><p className="text-xs text-muted-foreground">首层是子系统连线图；行为从程序入口进入</p></div><div data-axis-tabs role="tablist" aria-label="查看器轴"><button type="button" role="tab" aria-selected={axis === 'structure'} className="rounded px-2 py-1 text-xs" onClick={() => { setAxis('structure'); setFlowEntryId('') }}>结构轴</button><button type="button" role="tab" aria-selected={axis === 'behavior'} className="rounded px-2 py-1 text-xs" onClick={() => setAxis('behavior')}>行为轴</button></div><div data-organization-switch className="ml-auto flex items-center gap-1 rounded border p-1"><span className="px-1 text-[11px] text-muted-foreground">组织</span><button type="button" data-organization="best" className="rounded px-2 py-1 text-xs" disabled={!best} aria-pressed={organization === 'best'} onClick={() => switchOrganization('best')}>最优树</button><button type="button" data-organization="current" className="rounded px-2 py-1 text-xs" aria-pressed={organization === 'current'} onClick={() => switchOrganization('current')}>现状领域</button></div></header>{axis === 'behavior' && flowEntryId ? <FlowPageView baseline={baseline} entryNodeId={flowEntryId} onBack={() => { setFlowEntryId(''); setAxis('structure') }} onEnterEntry={setFlowEntryId} /> : <div className="flex min-h-0 flex-1">{axis === 'behavior' ? <section data-behavior-entry-picker className="min-w-0 flex-1 overflow-auto p-6"><h2 className="mb-3 text-base font-semibold">选择程序入口进入流程图</h2><p className="mb-4 text-sm text-muted-foreground">程序入口挂在右栏基本信息；从任意结构层点击入口即可进入行为轴。</p><div className="grid gap-2 sm:grid-cols-2">{Object.entries(baseline.nodes).filter(([, node]) => node.kind === 'entry').map(([id, node]) => <button type="button" key={id} className="rounded border p-3 text-left text-sm hover:bg-muted" onClick={() => setFlowEntryId(id)}>{node.name}<span className="mt-1 block text-xs text-muted-foreground">{node.channel ?? '通道未标注'}</span></button>)}</div></section> : <><ScopeCanvas model={model} selectedId={selectedId} onSelect={(id) => { setSelectedId(id); setContainerNotice('') }} onEnter={enterScope} onContainerNotice={enterSelectedContainer} migrationCount={migrations.length} migrationSlot={<MigrationDrawer items={migrations} open={migrationOpen} onToggle={() => setMigrationOpen((open) => !open)} onSelect={(id) => { setSelectedId(id); setMigrationOpen(false) }} />} /><RightPanel model={model} baseline={baseline} best={best} decls={decls} target={target} selectedId={selectedId} organization={organization} onOrganizationChange={switchOrganization} onSelectEntry={(id) => { setFlowEntryId(id); setAxis('behavior') }} /></>}</div>}{containerNotice ? <div data-container-notice role="status" className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded border bg-background px-3 py-2 text-xs shadow">{containerNotice}</div> : null}</section>
}
