// FlowChart —— 行为轴流程图画布：步骤节点、蛇形折列连线、卫语句甩侧、下层入口标记。
//
// 职责：把 layoutFlowSteps 的几何画出来——SVG 层只画线（顺序边、子干边、折列
// 接续 path），HTML 层放节点卡（call=rect / branch=diamond / loop=loop /
// return=terminal 四种图形与词表外 unknown 降级节点；矩形左色条=所属领域；
// 紫框 ▸=下层入口可递归下钻；双线框=接口调用）。所有边锚点在绘制时按坐标现算，
// 不为奇偶列写两套边逻辑——奇数列翻转后箭头自动翻向。
// 边界：唯一数据源是 FlowPageModel（经 flowpage 缝 2 派生）；本组件不重算任何
// 读数，只做模型事实 → 图形结构的投影（选中态、悬空引用归属标注是运行期/标注性
// 投影，见 c12.5-plan 合法投影声明）。degraded 时父级根本不渲染本组件——机械
// 可达序列绝不冒充流程图（§2.4-31）；折列处只有 path 连线，禁止任何「接上列」
// 文字标签（§2.4-35 反面判据）。视觉质量归真机清单（breakdown §四.2）。
import type { JSX } from 'react'
import type { FlowPageModel, FlowStepView } from './flowpage'
import type { FlowLayout, FlowNodeBox } from './flowlayout'
import {
  FLOW_BAND,
  FLOW_TOP,
  layoutFlowSteps,
} from './flowlayout'

/** 页面默认画布宽度（拖动分隔条重排归真机清单 2；机内用固定宽度保证确定性）。 */
export const FLOW_PAGE_WIDTH = 900

export interface FlowChartProps {
  model: FlowPageModel
  width: number
  selectedStepId: string
  onSelectStep: (stepId: string) => void
  /** 点击紫框 ▸ 下层入口：携带该入口 id，进入它自己的流程图。 */
  onOpenEntry: (entryNodeId: string) => void
}

/** 领域左色条色板：按领域 id 稳定散列取色（同一领域恒同色，视觉多样性归真机调）。 */
const DOMAIN_BAR_COLORS = [
  'bg-sky-500',
  'bg-emerald-500',
  'bg-amber-500',
  'bg-rose-500',
  'bg-violet-500',
  'bg-teal-500',
]

function domainBarClass(domain: string): string {
  if (!domain) return 'bg-neutral-300'
  let hash = 0
  for (let i = 0; i < domain.length; i += 1) hash = (hash * 31 + domain.charCodeAt(i)) % 997
  return DOMAIN_BAR_COLORS[hash % DOMAIN_BAR_COLORS.length]!
}

function stepLabel(step: FlowStepView): string {
  if (step.unknownKind) return `未知步骤（${String(step.kind)}）`
  switch (step.kind) {
    case 'call': return step.targetName ?? step.to ?? step.id
    case 'branch': return `分支：${step.cond ?? '条件未标注'}`
    case 'loop': return `循环：${step.cond ?? '条件未标注'}`
    case 'return': return '返回'
    default: return `未知步骤（${String(step.kind)}）`
  }
}

/** 悬空引用按引用父步归位（danglingChildRefs 是全模型清单；这里只做标注投影）。 */
function danglingByParent(steps: FlowStepView[]): Map<string, string[]> {
  const ids = new Set(steps.map((s) => s.id))
  const map = new Map<string, string[]>()
  for (const s of steps) {
    for (const ref of [...(s.then ?? []), ...(s.else ?? []), ...(s.body ?? [])]) {
      if (ids.has(ref)) continue
      const list = map.get(s.id)
      if (list) list.push(ref)
      else map.set(s.id, [ref])
    }
  }
  return map
}

/** 竖向肘形连线：上行/下行由两端中心 y 现算——翻转后自动换向。 */
function elbowV(a: FlowNodeBox, b: FlowNodeBox): string {
  const up = b.y + b.h / 2 < a.y + a.h / 2
  const ay = up ? a.y : a.y + a.h
  const by = up ? b.y + b.h : b.y
  const my = (ay + by) / 2
  const ax = a.x + a.w / 2
  const bx = b.x + b.w / 2
  return `M ${ax},${ay} V ${my} H ${bx} V ${by}`
}

/**
 * 折列接续 path：源列朝下走下带、朝上走上带，两端接同一侧（偶数列自上而下从
 * 底部接进下一列顶部对侧……翻转后自然成立）。TOP/BAND 预留带必须保留——不留
 * 这条线会画进 viewBox 外，表现为「下面的线是断的」。
 */
function wrapPath(layout: FlowLayout, a: FlowNodeBox, b: FlowNodeBox): string {
  const down = a.col % 2 === 0
  const ax = a.x + a.w / 2
  const ay = down ? a.y + a.h : a.y
  const bx = b.x + b.w / 2
  const by = down ? b.y + b.h : b.y
  const gy = down ? layout.bot + FLOW_BAND - 8 : FLOW_TOP - FLOW_BAND + 8
  return `M ${ax},${ay} V ${gy} H ${bx} V ${by}`
}

const SHAPE_CLASSES: Record<string, string> = {
  rect: 'rounded-md border-neutral-300 bg-background',
  diamond: 'rounded-sm border-amber-500 bg-amber-50',
  loop: 'rounded-md border-sky-500 bg-sky-50',
  terminal: 'rounded-full border-emerald-600 bg-emerald-50',
  unknown: 'rounded-md border-dashed border-red-400 bg-red-50',
}

export function FlowChart({ model, width, selectedStepId, onSelectStep, onOpenEntry }: FlowChartProps): JSX.Element {
  const layout = layoutFlowSteps(model.steps, width)
  const boxes = new Map(layout.nodes.map((n) => [n.id, n]))
  const stepById = new Map(model.steps.map((s) => [s.id, s]))
  const dangling = danglingByParent(model.steps)

  const onNodeClick = (node: FlowNodeBox) => {
    const step = stepById.get(node.id)
    if (step?.targetIsEntry && step.to !== undefined) {
      console.info('[codegraph] flow drill into sub entry', { from: model.entryNodeId, to: step.to })
      onOpenEntry(step.to)
      return
    }
    console.info('[codegraph] flow step select', { entry: model.entryNodeId, stepId: node.id, shape: node.shape })
    onSelectStep(node.id)
  }

  return (
    <section
      data-flow-chart
      data-cols={layout.cols}
      data-width={width}
      className="relative min-w-0 flex-1 overflow-auto"
    >
      <div className="relative" style={{ width: layout.width, height: layout.height }}>
        <svg
          width={layout.width}
          height={layout.height}
          viewBox={`0 0 ${layout.width} ${layout.height}`}
          className="pointer-events-none absolute inset-0"
          data-flow-svg
        >
          <defs>
            <marker id="flow-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" className="fill-current text-neutral-500" />
            </marker>
          </defs>
          {layout.sequence.map((id, i) => {
            if (i === 0) return null
            const prev = boxes.get(layout.sequence[i - 1]!)
            const cur = boxes.get(id)
            if (!prev || !cur) return null
            const isWrap = prev.col !== cur.col
            return (
              <path
                key={`${prev.id}->${cur.id}`}
                data-flow-edge={isWrap ? `wrap:${prev.id}:${cur.id}` : `seq:${prev.id}:${cur.id}`}
                d={isWrap ? wrapPath(layout, prev, cur) : elbowV(prev, cur)}
                fill="none"
                markerEnd="url(#flow-arrow)"
                strokeWidth={isWrap ? 2 : 1.5}
                className={isWrap ? 'stroke-neutral-500' : 'stroke-neutral-400'}
              />
            )
          })}
          {layout.childEdges.map((edge) => {
            const from = boxes.get(edge.from)
            const to = boxes.get(edge.to)
            if (!from || !to) return null
            const fromStep = stepById.get(edge.from)
            const isGuard = to.guardReturn && fromStep?.kind === 'branch'
            const d = isGuard
              ? `M ${from.x + from.w},${from.y + from.h / 2} H ${to.x}`
              : elbowV(from, to)
            return (
              <path
                key={`child:${edge.from}:${edge.to}`}
                data-flow-edge={`child:${edge.from}:${edge.to}`}
                d={d}
                fill="none"
                markerEnd="url(#flow-arrow)"
                strokeWidth={1.5}
                strokeDasharray={isGuard ? '4 3' : undefined}
                className="stroke-neutral-400"
              />
            )
          })}
        </svg>

        {layout.nodes.map((node) => {
          const step = stepById.get(node.id)
          if (!step) return null
          const selected = node.id === selectedStepId
          return (
            <button
              type="button"
              key={node.id}
              data-step={node.id}
              data-shape={node.shape}
              data-depth={node.depth}
              data-x={node.x}
              data-y={node.y}
              {...(step.targetDomain !== '' ? { 'data-domain': step.targetDomain } : {})}
              {...(step.iface === true ? { 'data-iface': 'true' } : {})}
              {...(step.targetIsEntry ? { 'data-sub-entry': 'true' } : {})}
              {...(node.guardReturn ? { 'data-guard-return': 'true' } : {})}
              {...(selected ? { 'data-selected': 'true' } : {})}
              onClick={() => onNodeClick(node)}
              style={{ left: node.x, top: node.y, width: node.w, height: node.h }}
              className={'absolute flex flex-col items-start justify-center overflow-hidden border-2 px-2 text-left '
                + (SHAPE_CLASSES[node.shape] ?? SHAPE_CLASSES.unknown!)
                + (step.iface === true ? ' outline outline-2 outline-offset-2 outline-neutral-400' : '')
                + (step.targetIsEntry ? ' border-purple-600' : '')
                + (selected ? ' outline outline-2 outline-primary' : '')}
            >
              {node.shape === 'rect' && (
                <span
                  data-domain-bar={step.targetDomain}
                  className={'absolute left-0 top-0 h-full w-1.5 ' + domainBarClass(step.targetDomain)}
                />
              )}
              <span data-step-label className="w-full truncate text-xs font-semibold">
                {step.targetIsEntry ? '▸ ' : ''}
                {stepLabel(step)}
              </span>
              <span data-step-line className="font-mono text-[10px] text-muted-foreground">:{step.line}</span>
              {(dangling.get(node.id) ?? []).map((ref) => (
                <span
                  key={ref}
                  data-dangling-ref={ref}
                  className="w-full truncate rounded bg-red-100 px-1 text-[10px] text-red-700"
                >
                  悬空引用 {ref}
                </span>
              ))}
            </button>
          )
        })}
      </div>
    </section>
  )
}
