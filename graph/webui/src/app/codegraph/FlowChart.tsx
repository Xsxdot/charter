// FlowChart —— 行为轴步骤模型到 SVG/DOM 的纯展示组件。
//
// 职责：消费 FlowPageModel.steps 与 baseline 目标节点，绘制步骤几何、顺序/子干/折列
// path，并按调用目标是否在 openableSubjectIds 中投影紫框。边界：不解析 chain/tree、
// 不从 entry kind 推导下钻、不发网络请求；degraded 页面由 FlowPageView 显示空态。
import type { JSX } from 'react'
import type { CgGraph } from '../../api/types'
import type { FlowPageModel } from './flowpage'
import { FLOW_BAND, FLOW_TOP, layoutFlowSteps, type FlowLayout, type FlowNodeBox } from './flowlayout'

export const FLOW_PAGE_WIDTH = 900

/** FlowChart 的纯展示输入；下钻集合由页面壳计算，不从节点 kind 猜测。 */
export interface FlowChartProps {
  model: FlowPageModel
  baseline: CgGraph
  openableSubjectIds: ReadonlySet<string>
  width: number
  selectedStepId: string
  onSelectStep: (stepId: string) => void
  onOpenSubject: (subjectId: string) => void
}

const DOMAIN_BAR_COLORS = ['bg-sky-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500', 'bg-violet-500', 'bg-teal-500']

function domainBarClass(domain: string): string {
  if (!domain) return 'bg-neutral-300'
  let hash = 0
  for (let index = 0; index < domain.length; index += 1) hash = (hash * 31 + domain.charCodeAt(index)) % 997
  return DOMAIN_BAR_COLORS[hash % DOMAIN_BAR_COLORS.length]!
}

function elbowV(a: FlowNodeBox, b: FlowNodeBox): string {
  const up = b.y + b.h / 2 < a.y + a.h / 2
  const ay = up ? a.y : a.y + a.h
  const by = up ? b.y + b.h : b.y
  const middle = (ay + by) / 2
  return `M ${a.x + a.w / 2},${ay} V ${middle} H ${b.x + b.w / 2} V ${by}`
}

function wrapPath(layout: FlowLayout, a: FlowNodeBox, b: FlowNodeBox): string {
  const down = a.col % 2 === 0
  const ay = down ? a.y + a.h : a.y
  const by = down ? b.y + b.h : b.y
  const guideY = down ? layout.bot + FLOW_BAND - 8 : FLOW_TOP - FLOW_BAND + 8
  return `M ${a.x + a.w / 2},${ay} V ${guideY} H ${b.x + b.w / 2} V ${by}`
}

const SHAPE_CLASSES: Record<string, string> = {
  rect: 'border-neutral-300 bg-background',
  diamond: 'border-amber-500 bg-amber-50',
  loop: 'rounded-md border-sky-500 bg-sky-50',
  terminal: 'rounded-full border-emerald-600 bg-emerald-50',
  unknown: 'rounded-md border-dashed border-red-400 bg-red-50',
}

function stepLabel(step: FlowPageModel['steps'][number], targetName?: string): string {
  switch (step.kind) {
    case 'call': return targetName ?? step.to ?? step.id
    case 'branch': return `分支：${step.cond ?? '条件未标注'}`
    case 'loop': return `循环：${step.cond ?? '条件未标注'}`
    case 'return': return '返回'
    default: return `未知步骤（${String(step.kind)}）`
  }
}

function isOpenableCall(step: FlowPageModel['steps'][number], openable: ReadonlySet<string>): boolean {
  return step.kind === 'call' && step.to !== undefined && openable.has(step.to)
}

/** 将已派生的流程步骤绘制为可选中、可下钻的 DOM/SVG 画布。 */
export function FlowChart({ model, baseline, openableSubjectIds, width, selectedStepId, onSelectStep, onOpenSubject }: FlowChartProps): JSX.Element {
  const layout = layoutFlowSteps(model.steps, width)
  const boxes = new Map(layout.nodes.map((node) => [node.id, node]))
  const stepsById = new Map(model.steps.map((step) => [step.id, step]))

  const onNodeClick = (id: string) => {
    const step = stepsById.get(id)
    if (!step) return
    if (isOpenableCall(step, openableSubjectIds)) {
      console.info('[codegraph] flow subject drill', { from: model.subject.id, to: step.to, kind: step.kind })
      onOpenSubject(step.to!)
      return
    }
    console.info('[codegraph] flow step select', { subject: model.subject.id, stepId: id, kind: step.kind })
    onSelectStep(id)
  }

  return (
    <section data-flow-chart data-cols={layout.cols} data-width={width} className="relative min-w-0 flex-1 overflow-auto">
      <div className="relative" style={{ width: layout.width, height: layout.height }}>
        <svg width={layout.width} height={layout.height} viewBox={`0 0 ${layout.width} ${layout.height}`} className="pointer-events-none absolute inset-0" data-flow-svg>
          <defs>
            <marker id="flow-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" className="fill-current text-neutral-500" />
            </marker>
          </defs>
          {layout.sequence.map((id, index) => {
            if (index === 0) return null
            const from = boxes.get(layout.sequence[index - 1]!)
            const to = boxes.get(id)
            if (!from || !to) return null
            const wrapped = from.col !== to.col
            return <path key={`sequence:${from.id}:${to.id}`} data-flow-edge={wrapped ? `wrap:${from.id}:${to.id}` : `seq:${from.id}:${to.id}`} d={wrapped ? wrapPath(layout, from, to) : elbowV(from, to)} fill="none" markerEnd="url(#flow-arrow)" strokeWidth={wrapped ? 2 : 1.5} className="stroke-neutral-400" />
          })}
          {layout.childEdges.map((edge) => {
            const from = boxes.get(edge.from)
            const to = boxes.get(edge.to)
            if (!from || !to) return null
            const guard = to.guardReturn && stepsById.get(edge.from)?.kind === 'branch'
            const d = guard ? `M ${from.x + from.w},${from.y + from.h / 2} H ${to.x}` : elbowV(from, to)
            return <path key={`child:${edge.from}:${edge.to}`} data-flow-edge={`child:${edge.from}:${edge.to}`} d={d} fill="none" markerEnd="url(#flow-arrow)" strokeWidth={1.5} strokeDasharray={guard ? '4 3' : undefined} className="stroke-neutral-400" />
          })}
        </svg>
        {layout.nodes.map((node) => {
          const step = stepsById.get(node.id)
          if (!step) return null
          const target = step.to === undefined ? undefined : baseline.nodes[step.to]
          const purple = isOpenableCall(step, openableSubjectIds)
          const selected = selectedStepId === step.id
          return (
            <button
              type="button"
              key={node.id}
              data-step={node.id}
              data-shape={node.shape}
              data-depth={node.depth}
              data-x={node.x}
              data-y={node.y}
              data-step-line={step.line}
              {...(node.guardReturn ? { 'data-guard-return': 'true' } : {})}
              {...(step.iface === true ? { 'data-iface': 'true' } : {})}
              {...(purple ? { 'data-subject-drill': step.to, 'data-purple': 'true' } : {})}
              {...(selected ? { 'data-selected': 'true' } : {})}
              onClick={() => onNodeClick(node.id)}
              style={{ left: node.x, top: node.y, width: node.w, height: node.h, ...(node.shape === 'diamond' ? { clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)' } : {}) }}
              className={'absolute flex flex-col items-start justify-center overflow-hidden border-2 px-2 text-left ' + (SHAPE_CLASSES[node.shape] ?? SHAPE_CLASSES.unknown!) + (step.iface === true ? ' outline outline-2 outline-offset-2 outline-neutral-400' : '') + (purple ? ' border-purple-600' : '') + (selected ? ' outline outline-2 outline-primary' : '')}
            >
              {node.shape === 'rect' && <span data-domain-bar={target?.container ?? ''} className={'absolute left-0 top-0 h-full w-1.5 ' + domainBarClass(baseline.containers[target?.container ?? '']?.domain ?? '')} />}
              <span data-step-label className="w-full truncate text-xs font-semibold">{purple ? '▸ ' : ''}{stepLabel(step, target?.name)}</span>
              <span className="font-mono text-[10px] text-muted-foreground">:{step.line}</span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
