// flowlayout —— 行为轴流程图的蛇形折列布局（K5 组件层消费的纯函数）。
//
// 职责：把 FlowPageModel.steps（wire 透传 + 目标派生读数）变成可绘制的几何：
// 每个步骤的列号与坐标、四种步骤图形（call=rect / branch=diamond / loop=loop /
// return=terminal，词表外=unknown）、卫语句返回终点（甩主干一侧）、分支/循环
// 子干缩进、折列接续对（wraps）。蛇形两步法：先普通自上而下多列布局，再对奇数
// 列整列上下翻转（n.y = TOP + BOT - (n.y + n.h)）——于是第 1 列自上而下、第 2 列
// 自下而上、第 3 列再自上而下。所有边锚点由组件绘制时按坐标现算，本模块不预存
// 边的方向。
//
// 边界：纯函数、零随机数（同一份数据每次打开必须长得一样）；只消费缝 2 的
// FlowStepView（图形归属是画布关注点，flowpage.ts 文件头明文移交 K5），不重算
// 任何债读数/归属判据；不访问 DOM、零 console。视觉质量（走线好不好看、菱形
// 摆放、中文折行）机内不可断言，归真机清单；本模块只保证确定性、翻转正确性、
// 折列接续对的奇偶方向这些可机检性质。
import type { CgFlowStep } from '../../api/types'

/** 步骤图形词表：kind 四值 → 四种图形，词表外 → unknown 显式降级节点。 */
export type FlowShape = 'rect' | 'diamond' | 'loop' | 'terminal' | 'unknown'

export const FLOW_NODE_W = 190
export const FLOW_NODE_H = 52
export const FLOW_ROW_H = 84        // 主干行距：节点高 + 呼吸空隙
export const FLOW_INDENT = 28       // 子干每层横向缩进
export const FLOW_COL_GAP = 72      // 列间走廊宽：蛇形连线从这里拐
export const FLOW_TOP = 46          // 顶部预留带：折列上带（不留会画出 viewBox）
export const FLOW_BAND = 30         // 底部预留带：折列下带——实测坑：不留表现为「下面的线是断的」
export const FLOW_MAX_COLS = 4
const GUARD_DX = 24                 // 卫语句返回终点相对菱形的右侧偏移
const GUARD_DY = 18                 // 卫语句返回终点相对菱形的纵向偏移
const BALANCE_STEPS = 9             // 列高均衡候选数（k = 0..8）：没有它末列会因没有折点而拖尾很长

/** 一个步骤节点的绘制盒：坐标为左上角（翻转后的最终值）。 */
export interface FlowNodeBox {
  id: string
  col: number
  x: number
  y: number
  w: number
  h: number
  /** 子干缩进层级：0 = 主干 */
  depth: number
  shape: FlowShape
  /** 卫语句返回终点：甩在所属菱形一侧，不占主干行、不做折列端点。 */
  guardReturn: boolean
}

/** 分支/循环子干边：label 是语义边签（是/否/循环体），不是「接上列」式的线替代品。 */
export interface FlowChildEdge {
  from: string
  to: string
  label: '' | '是' | '否' | '循环体'
}

/**
 * 折列接续对：源列朝下（down=true）走下带、朝上走上带；down 与源列奇偶一致
 * （偶数列自上而下 → 从底部接进下列）。path 字符串由组件按两端坐标现算。
 */
export interface FlowWrapEdge {
  from: string
  to: string
  down: boolean
}

export interface FlowLayout {
  /** 全部节点盒（含卫语句终点），绘制序 = 主干 DFS 序。 */
  nodes: FlowNodeBox[]
  /** 主干顺序链（不含卫语句终点）：组件沿它连顺序边与折列边。 */
  sequence: string[]
  childEdges: FlowChildEdge[]
  wraps: FlowWrapEdge[]
  cols: number
  top: number
  band: number
  /** 翻转后内容底（= 翻转前最大底），画布高度的下缘基准。 */
  bot: number
  /** = bot + band。必须从预留带算，不能从节点最大 y 算。 */
  height: number
  width: number
}

function shapeOf(step: CgFlowStep): FlowShape {
  switch (step.kind) {
    case 'call': return 'rect'
    case 'branch': return 'diamond'
    case 'loop': return 'loop'
    case 'return': return 'terminal'
    default: return 'unknown'
  }
}

/**
 * 蛇形折列布局主入口。确定性：同一输入两次调用逐位相同（零随机数、遍历只按
 * wire 原序与模型已排序的 steps 序）。共享子干（同一步骤被两个父引用）只在首次
 * 出现处放置节点、其余补边不重复放盒；悬空引用（danglingChildRefs）不产生节点。
 */
export function layoutFlowSteps(steps: readonly CgFlowStep[], width: number): FlowLayout {
  const byId = new Map(steps.map((s) => [s.id, s]))

  const referenced = new Set<string>()
  for (const s of steps) {
    for (const ref of [...(s.then ?? []), ...(s.else ?? []), ...(s.body ?? [])]) referenced.add(ref)
  }

  const placed = new Set<string>()
  const boxes: FlowNodeBox[] = []
  const linear: FlowNodeBox[] = []
  const childEdges: FlowChildEdge[] = []
  const guardAnchor = new Map<string, string>()

  const place = (step: CgFlowStep, depth: number, guard: boolean, anchorId: string): void => {
    placed.add(step.id)
    const box: FlowNodeBox = {
      id: step.id,
      col: 0,
      x: 0,
      y: 0,
      w: FLOW_NODE_W,
      h: FLOW_NODE_H,
      depth,
      shape: shapeOf(step),
      guardReturn: guard,
    }
    boxes.push(box)
    if (guard) {
      guardAnchor.set(step.id, anchorId)
    } else {
      linear.push(box)
    }
  }

  const visit = (ids: readonly string[], depth: number, fromId: string, label: FlowChildEdge['label'], forceGuard: boolean): void => {
    for (const id of ids) {
      const step = byId.get(id)
      if (!step) continue
      if (placed.has(id)) {
        // 共享子干 / 二次引用：只补语义边，不重复放盒
        if (fromId !== '') childEdges.push({ from: fromId, to: id, label })
        continue
      }
      const guard = forceGuard && step.kind === 'return'
      place(step, depth, guard, fromId)
      if (fromId !== '') childEdges.push({ from: fromId, to: id, label })
      if (!guard) expandArms(step, depth)
    }
  }

  const arm = (ids: readonly string[] | undefined, depth: number, fromId: string, label: FlowChildEdge['label']): void => {
    if (!ids || ids.length === 0) return
    const members = ids.map((id) => byId.get(id)).filter((s) => s !== undefined)
    // 卫语句臂：成员全部是 return 才甩侧；混合臂照常当子干展开
    const allReturn = members.length > 0 && members.every((m) => m!.kind === 'return')
    visit(ids, depth, fromId, label, allReturn)
  }

  const expandArms = (step: CgFlowStep, depth: number): void => {
    if (step.kind === 'branch') {
      arm(step.then, depth + 1, step.id, '是')
      arm(step.else, depth + 1, step.id, '否')
    } else if (step.kind === 'loop') {
      arm(step.body, depth + 1, step.id, '循环体')
    }
  }

  const roots = steps.filter((s) => !referenced.has(s.id))
  visit(roots.map((s) => s.id), 0, '', '', false)

  const cols = Math.max(1, Math.min(FLOW_MAX_COLS, Math.floor(width / (FLOW_NODE_W + FLOW_COL_GAP))))

  // 列高均衡：试 9 个候选上限，取整体最矮的那个（并列取更小 k）。没有这一步，
  // 最后一列会因为没有折点而把尾巴拖得极长。填充规则与最终布点同一份：超出上限
  // 就换下一列，但最后一列吸收剩余（列数必须恒等于 cols，否则 wrap 会跨列跳跃）。
  const colContentHeight = (count: number): number => count * FLOW_ROW_H - (FLOW_ROW_H - FLOW_NODE_H)
  const fillCounts = (cap: number): number[] => {
    const counts: number[] = []
    let col = 0
    let count = 0
    for (let i = 0; i < totalRows; i += 1) {
      const bottom = count * FLOW_ROW_H + FLOW_NODE_H
      if (bottom > cap && count > 0 && col < cols - 1) {
        counts.push(count)
        col += 1
        count = 0
      }
      count += 1
    }
    counts.push(count)
    return counts
  }

  const totalRows = linear.length
  let bestK = 0
  let bestTallest = Number.POSITIVE_INFINITY
  for (let k = 0; k < BALANCE_STEPS; k += 1) {
    const cap = Math.max(FLOW_ROW_H * 2, Math.ceil((totalRows * FLOW_ROW_H) / cols) * (1 + k * 0.06))
    const tallest = Math.max(...fillCounts(cap).map(colContentHeight))
    if (tallest < bestTallest) {
      bestTallest = tallest
      bestK = k
    }
  }

  const cap = Math.max(FLOW_ROW_H * 2, Math.ceil((totalRows * FLOW_ROW_H) / cols) * (1 + bestK * 0.06))
  const counts = fillCounts(cap)
  const colOf: number[] = []
  const rowOf: number[] = []
  for (let c = 0; c < counts.length; c += 1) {
    for (let r = 0; r < counts[c]!; r += 1) {
      colOf.push(c)
      rowOf.push(r)
    }
  }

  // 翻转前布点 → BOT → 奇数列整列上下翻转
  let bot = FLOW_TOP
  linear.forEach((box, i) => {
    box.col = colOf[i]!
    const preY = FLOW_TOP + rowOf[i]! * FLOW_ROW_H
    bot = Math.max(bot, preY + box.h)
    box.x = colOf[i]! * (FLOW_NODE_W + FLOW_COL_GAP) + box.depth * FLOW_INDENT
    box.y = preY
  })
  for (const box of linear) {
    if (box.col % 2 === 1) box.y = FLOW_TOP + bot - (box.y + box.h)
  }

  // 卫语句终点挂在锚点菱形侧旁（用翻转后的锚点坐标现算；底部夹进内容区）
  for (const box of boxes) {
    if (!box.guardReturn) continue
    const anchor = boxes.find((cand) => cand.id === guardAnchor.get(box.id))
    if (!anchor) continue
    box.col = anchor.col
    box.x = anchor.x + anchor.w + GUARD_DX
    box.y = Math.min(anchor.y + GUARD_DY, bot - box.h)
  }

  const wraps: FlowWrapEdge[] = []
  for (let i = 1; i < linear.length; i += 1) {
    const prev = linear[i - 1]!
    const cur = linear[i]!
    if (prev.col !== cur.col) wraps.push({ from: prev.id, to: cur.id, down: prev.col % 2 === 0 })
  }

  return {
    nodes: boxes,
    sequence: linear.map((b) => b.id),
    childEdges,
    wraps,
    cols,
    top: FLOW_TOP,
    band: FLOW_BAND,
    bot,
    height: bot + FLOW_BAND,
    width: cols * (FLOW_NODE_W + FLOW_COL_GAP),
  }
}
