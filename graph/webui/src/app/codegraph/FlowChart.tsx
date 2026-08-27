import type { FlowStepModel } from './flowpage'

export interface FlowChartProps {
  steps: FlowStepModel[]
  onEnterEntry: (id: string) => void
}

function shapeClass(step: FlowStepModel): string {
  if (step.shape === 'diamond') return 'rotate-45 border-purple-400 bg-purple-50'
  if (step.shape === 'loop') return 'rounded-full border-blue-400 bg-blue-50'
  if (step.shape === 'return') return 'rounded border-slate-400 bg-slate-50'
  if (step.shape === 'unknown') return 'rounded border-amber-500 bg-amber-50'
  return 'rounded border-sky-400 bg-sky-50'
}

function stepText(step: FlowStepModel): string {
  if (step.kind === 'branch' || step.kind === 'loop') return step.cond ?? '条件未标注'
  if (step.kind === 'return') return '提前返回'
  if (step.kind === 'call') return step.to ?? '调用目标缺失'
  return `未知步骤 kind：${step.kind}`
}

export function FlowChart({ steps, onEnterEntry }: FlowChartProps) {
  const columns: FlowStepModel[][] = []
  for (let index = 0; index < steps.length; index += 6) columns.push(steps.slice(index, index + 6))
  return <div data-flow-chart className="relative overflow-x-auto rounded-xl border bg-muted/20 p-5"><div className="mb-3 flex items-center gap-3 text-xs text-muted-foreground"><span data-flow-shape="rect" className="rounded border border-sky-400 px-2 py-1">调用</span><span data-flow-shape="diamond" className="px-2 py-1">◇ 分支</span><span className="border-double border-4 px-2 py-0.5">接口调用</span><span>紫框 ▸ 可递归下钻</span></div>
    {columns.length > 1 ? <svg data-snake-connectors className="pointer-events-none absolute left-5 top-20 h-[calc(100%-6rem)] w-[calc(100%-2.5rem)]" aria-hidden="true">{columns.slice(1).map((_, index) => <path key={index} data-flow-connector d={`M ${index * 260 + 230} 420 C ${index * 260 + 340} 470 ${index * 260 + 350} 80 ${index * 260 + 470} 120`} fill="none" stroke="#64748b" strokeWidth="2" markerEnd="url(#flow-arrow)" />)}<defs><marker id="flow-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L7,3 z" fill="#64748b" /></marker></defs></svg> : null}
    <div className="relative flex min-w-max gap-12">{columns.map((column, columnIndex) => <div key={columnIndex} data-flow-column={columnIndex} className="flex w-56 flex-col gap-3"><div className="text-[10px] uppercase tracking-wider text-muted-foreground">泳道列 {columnIndex + 1}</div>{column.map((step) => <div key={step.id} data-flow-step={step.id} data-shape={step.shape} data-kind={step.kind} data-iface={step.iface ? 'true' : undefined} data-guard-side={step.guardSide === 'side' ? 'side' : undefined} className={(step.iface ? 'border-double border-4 ' : 'border-2 ') + shapeClass(step) + (step.guardSide === 'side' ? ' ml-7 ' : '') + ' relative p-3 text-xs'}><span data-domain-color={step.domainId || 'unknown'} className="absolute inset-y-0 left-0 w-1 rounded-l bg-indigo-500" /><div className="pl-2"><div className="flex items-center justify-between gap-2"><b>{stepText(step)}</b><span className="text-[10px] text-muted-foreground">L{step.line}</span></div>{step.iface ? <span data-iface-mark className="mt-1 inline-block text-[10px] text-indigo-700">双线框 · 接口</span> : null}{step.nestedEntry && step.to ? <button type="button" data-nested-entry={step.to} className="mt-1 block rounded border border-purple-500 px-1.5 py-0.5 text-[10px] text-purple-700 hover:bg-purple-100" onClick={() => onEnterEntry(step.to!)}>▸ 进入下层入口流程</button> : null}{step.kind === 'branch' ? <div className="mt-1 text-[10px] text-muted-foreground">then {step.then?.join('、') || '—'} · else {step.else?.join('、') || '—'}</div> : null}{step.kind === 'loop' ? <div className="mt-1 text-[10px] text-muted-foreground">body {step.body?.join('、') || '—'}</div> : null}{step.explicitUnknownKind ? <div data-unknown-step className="mt-1 text-[10px] text-amber-800">未知步骤已显式降级</div> : null}</div></div>)}</div>)}</div>
    {!steps.length ? <p data-flow-empty className="py-8 text-center text-sm text-muted-foreground">流程主干没有步骤</p> : null}
  </div>
}
