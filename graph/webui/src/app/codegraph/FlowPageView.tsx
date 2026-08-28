// FlowPageView —— 行为轴方法页面壳与页内导航。
//
// 职责：调用 deriveFlowPage，持有方法栈/选中步骤/通道高亮，装配 FlowChart 和永久
// 关系栏。边界：不发网络请求、不依赖 iframe/浏览器后退、不把 callers 画成第二棵树；
// entry 关系只作通道高亮，方法和有流程 caller/实现才可进入下一张图。
import { useEffect, useMemo, useState } from 'react'
import type { JSX } from 'react'
import type { CgGraph } from '../../api/types'
import { FlowChart } from './FlowChart'
import { deriveFlowPage, type FlowNodeRef, type FlowOpenRequest } from './flowpage'

/** 行为轴页的基线、结构轴入口上下文和唯一的栈底返回回调。 */
export interface FlowPageViewProps {
  baseline: CgGraph
  initial: FlowOpenRequest
  onBackToStructure: () => void
}

interface StackEntry {
  subjectId: string
  label: string
}

function refLabel(ref: FlowNodeRef): string {
  return ref.name || ref.id
}

function RelationButton({ ref, attribute, onClick }: { ref: FlowNodeRef; attribute: string; onClick: () => void }): JSX.Element {
  return (
    <button type="button" {...{ [attribute]: ref.id }} className="block w-full rounded border px-2 py-1 text-left text-xs hover:bg-muted" onClick={onClick}>
      <span className="font-mono">{refLabel(ref)}</span>
      <span className="ml-1 text-[10px] text-muted-foreground">{ref.kind === 'entry' ? '到达通道' : ref.openable ? '' : '无流程图'}</span>
    </button>
  )
}

function emptyRelation(label: string): JSX.Element {
  return <p className="text-xs text-muted-foreground">无{label}</p>
}

/** 渲染方法主语行为页，维护页内栈并把栈底返回原结构轴 scope。 */
export function FlowPageView({ baseline, initial, onBackToStructure }: FlowPageViewProps): JSX.Element {
  const initialLabel = baseline.nodes[initial.subjectId]?.name ?? initial.subjectId
  const [stack, setStack] = useState<StackEntry[]>([{ subjectId: initial.subjectId, label: initialLabel }])
  const [selectedStepId, setSelectedStepId] = useState('')
  const [highlightedChannel, setHighlightedChannel] = useState('')
  const current = stack[stack.length - 1]!
  const model = useMemo(() => deriveFlowPage({ baseline, entryNodeId: current.subjectId }), [baseline, current.subjectId])
  const selectedStep = model.steps.find((step) => step.id === selectedStepId)
  const selectedImplementations = useMemo(() => {
    if (selectedStep?.kind !== 'call' || selectedStep.iface !== true || selectedStep.to === undefined) {
      return model.implementations
    }
    // 接口调用的 to 才是动态分派的契约主语；实现清单必须从该接口 join，
    // 不能沿用当前泳道主语的实现清单。
    return deriveFlowPage({ baseline, entryNodeId: selectedStep.to }).implementations
  }, [baseline, model.implementations, selectedStep])
  useEffect(() => {
    if (model.degraded) {
      console.warn('[codegraph] flow page degraded', { subjectId: model.subject.id, missing: model.missing })
    }
  }, [model.degraded, model.missing, model.subject.id])
  const openableSubjectIds = useMemo(() => {
    const ids = new Set(initial.originOpenableSubjectIds)
    for (const id of Object.keys(baseline.flows ?? {})) {
      const node = baseline.nodes[id]
      if (node && node.kind !== 'entry') ids.add(id)
    }
    for (const ref of [...model.implementations, ...model.callers]) {
      if (ref.openable) ids.add(ref.id)
    }
    return ids
  }, [baseline, initial.originOpenableSubjectIds, model.implementations, model.callers])

  const pushSubject = (subjectId: string, source: string) => {
    const label = baseline.nodes[subjectId]?.name ?? subjectId
    console.info('[codegraph] flow subject drill', { from: current.subjectId, to: subjectId, source, depth: stack.length })
    setStack((entries) => [...entries, { subjectId, label }])
    setSelectedStepId('')
    setHighlightedChannel('')
  }

  const back = () => {
    console.info('[codegraph] flow back', { current: current.subjectId, depth: stack.length, scope: initial.originScopeId })
    if (stack.length > 1) {
      setStack((entries) => entries.slice(0, -1))
      setSelectedStepId('')
      setHighlightedChannel('')
      return
    }
    onBackToStructure()
  }

  const selectBreadcrumb = (index: number) => {
    const target = stack[index]
    if (!target) return
    console.info('[codegraph] flow breadcrumb', { current: current.subjectId, target: target.subjectId, depth: index + 1 })
    setStack((entries) => entries.slice(0, index + 1))
    setSelectedStepId('')
    setHighlightedChannel('')
  }

  const highlightChannel = (channel: FlowNodeRef) => {
    console.info('[codegraph] flow channel highlight', { current: current.subjectId, channel: channel.id, depth: stack.length })
    setHighlightedChannel(channel.id)
    const firstMatchingStep = model.steps.find((step) => step.kind === 'call' && step.to === channel.id)
    setSelectedStepId(firstMatchingStep?.id ?? '')
  }

  return (
    <section data-flow-page data-current-subject={model.subject.id} data-degraded={model.degraded ? 'true' : 'false'} className="flex min-h-0 flex-1 flex-col">
      <header className="flex items-center gap-2 border-b px-3 py-1.5 text-sm">
        <button type="button" data-flow-back onClick={back} className="rounded border px-2 py-0.5 text-xs hover:bg-muted">← 上一层</button>
        <span data-flow-structure className="text-xs text-muted-foreground">结构轴</span>
        <span className="text-muted-foreground">▸</span>
        <nav aria-label="行为轴面包屑" className="flex items-center gap-1">
          {stack.map((entry, index) => (
            <span key={`${entry.subjectId}:${index}`} className="flex items-center gap-1">
              {index > 0 && <span className="text-muted-foreground">▸</span>}
              <button type="button" data-flow-breadcrumb={entry.subjectId} onClick={() => selectBreadcrumb(index)} className={index === stack.length - 1 ? 'rounded bg-muted px-1.5 py-0.5 font-semibold' : 'rounded px-1.5 py-0.5 hover:bg-muted'}>{entry.label}</button>
            </span>
          ))}
        </nav>
        <span data-flow-depth className="ml-auto text-[10px] text-muted-foreground">{stack.length}</span>
      </header>
      <div className="flex min-h-0 flex-1 flex-col gap-2 p-3">
        <div data-lane-title className="flex items-baseline gap-2">
          <h2 className="font-mono text-sm font-semibold">正在看方法主语：{refLabel(model.subject)}</h2>
          <span data-subject-id className="font-mono text-[10px] text-muted-foreground">{model.subject.id}</span>
          <span data-subject-line={model.subject.line} className="font-mono text-[10px] text-muted-foreground">:{model.subject.line}</span>
          {model.degraded && <span data-flow-degraded className="rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800">降级：{model.missing}</span>}
        </div>
        <div className="flex min-h-0 flex-1 gap-3">
          <div className="flex min-w-0 flex-1 flex-col">
            {!model.degraded ? (
              <FlowChart model={model} baseline={baseline} openableSubjectIds={openableSubjectIds} width={900} selectedStepId={selectedStepId} onSelectStep={setSelectedStepId} onOpenSubject={(id) => pushSubject(id, 'flow-step')} />
            ) : (
              <div data-flow-degraded className="rounded border border-dashed p-4 text-xs text-muted-foreground">没有可绘制的流程步骤：{model.missing}</div>
            )}
          </div>
          <aside data-flow-relations className="w-72 shrink-0 space-y-3 overflow-y-auto border-l pl-3 text-sm">
            <section data-flow-channels>
              <h3 className="mb-1 font-semibold">到达通道</h3>
              {model.channels.length === 0 ? emptyRelation('到达通道') : model.channels.map((channel) => <button key={channel.id} type="button" data-channel={channel.id} data-highlighted={highlightedChannel === channel.id ? 'true' : undefined} className="block w-full rounded border px-2 py-1 text-left text-xs hover:bg-muted" onClick={() => highlightChannel(channel)}>{refLabel(channel)} <span className="text-muted-foreground">{channel.channel ?? '未标注'}</span></button>)}
            </section>
            <section data-flow-implementations>
              <h3 className="mb-1 font-semibold">实现</h3>
              {selectedImplementations.length === 0 ? emptyRelation('实现') : selectedImplementations.map((ref) => <RelationButton key={ref.id} ref={ref} attribute="data-implementation" onClick={() => pushSubject(ref.id, 'implementation')} />)}
            </section>
            <section data-flow-callers>
              <h3 className="mb-1 font-semibold">被谁调用</h3>
              {model.callers.length === 0 ? emptyRelation('直接调用方') : model.callers.map((ref) => <RelationButton key={ref.id} ref={ref} attribute="data-caller" onClick={() => ref.openable ? pushSubject(ref.id, 'caller') : ref.kind === 'entry' ? highlightChannel(ref) : undefined} />)}
            </section>
            <section data-flow-agent-chain className="rounded border bg-muted/30 p-2 text-xs text-muted-foreground">
              <h3 className="font-semibold text-foreground">调用链（给 agent）</h3>
              <p>机械下游能力摘要；无次序与分支语义，不在此页绘制第二棵调用树。</p>
            </section>
          </aside>
        </div>
      </div>
    </section>
  )
}
