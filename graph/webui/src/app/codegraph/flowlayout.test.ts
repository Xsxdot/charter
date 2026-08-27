import { describe, expect, it } from 'vitest'
import type { CgFlowStepKind } from '../../api/types'
import type { FlowStepView } from './flowpage'
import {
  FLOW_BAND,
  FLOW_INDENT,
  FLOW_NODE_H,
  FLOW_NODE_W,
  FLOW_TOP,
  layoutFlowSteps,
} from './flowlayout'

// —— 夹具纪律（沿 K2/K3/K4 同款）：断言只走 layoutFlowSteps 一个入口；期望值
// 硬编码、手工可核。步骤字面量只需布局关心的字段（id/kind/then/else/body）。——

function step(id: string, kind: CgFlowStepKind, overrides: Partial<FlowStepView> = {}): FlowStepView {
  return {
    id,
    order: 0,
    kind,
    line: 1,
    targetName: null,
    targetDomain: '',
    targetIsEntry: false,
    implementations: [],
    unknownKind: false,
    ...overrides,
  }
}

function asUnknown(s: FlowStepView): FlowStepView {
  return { ...s, kind: 'jump' as unknown as CgFlowStepKind }
}

// 主夹具：与 flowpage.test.ts 的 W6 flowWorld 同构——branch(then 混合臂+悬空引用 /
// else 全 return 卫语句臂)、loop(body 复用 s_call)、iface call、词表外 kind。
function snakeWorld(): FlowStepView[] {
  return [
    step('s_branch', 'branch', { cond: 'err != nil', then: ['s_call', 's_ghost'], else: ['s_ret'] }),
    step('s_call', 'call', { to: 'sub_e', targetIsEntry: true }),
    step('s_ret', 'return'),
    step('s_loop', 'loop', { cond: 'range items', body: ['s_call'] }),
    step('s_iface', 'call', { to: 'iface.X', iface: true }),
    asUnknown(step('s_bad', 'call', { to: 't' })),
  ]
}

describe('C12.5 flowlayout：确定性与空输入', () => {
  it('同一输入两次调用逐位相同（零随机数纪律）', () => {
    expect(layoutFlowSteps(snakeWorld(), 900)).toEqual(layoutFlowSteps(snakeWorld(), 900))
  })

  it('空步骤：无节点无折列，高度只由预留带构成，不崩溃', () => {
    const layout = layoutFlowSteps([], 900)
    expect(layout.nodes).toEqual([])
    expect(layout.sequence).toEqual([])
    expect(layout.wraps).toEqual([])
    expect(layout.height).toBe(FLOW_TOP + FLOW_BAND)
    expect(layout.cols).toBe(3)
  })
})

describe('C12.5 flowlayout：单列与折列（蛇形两步法）', () => {
  it('窄画布 cols=1：全部主干节点同列、无 wrap、height=bot+band（从预留带算不从节点 y 算）', () => {
    const layout = layoutFlowSteps(snakeWorld(), 200)
    expect(layout.cols).toBe(1)
    const linear = layout.nodes.filter((n) => !n.guardReturn)
    expect(linear).toHaveLength(5)
    for (const n of linear) expect(n.col).toBe(0)
    expect(layout.wraps).toEqual([])
    // 5 行：bot = TOP + 4*84 + 52 = 434（手工可核）
    expect(layout.bot).toBe(FLOW_TOP + 4 * 84 + FLOW_NODE_H)
    expect(layout.height).toBe(layout.bot + FLOW_BAND)
  })

  it('宽画布折列：wrap 数 = 列跃迁数；每条 wrap 从源列最后非卫节点接到下一列第一个；down 与源列奇偶一致', () => {
    const layout = layoutFlowSteps(snakeWorld(), 900)
    expect(layout.cols).toBeGreaterThanOrEqual(2)
    const boxOf = new Map(layout.nodes.map((n) => [n.id, n]))
    let transitions = 0
    for (let i = 1; i < layout.sequence.length; i += 1) {
      if (boxOf.get(layout.sequence[i - 1]!)!.col !== boxOf.get(layout.sequence[i]!)!.col) transitions += 1
    }
    expect(layout.wraps).toHaveLength(transitions)
    expect(layout.wraps.length).toBeGreaterThanOrEqual(1)
    for (const wrap of layout.wraps) {
      const from = boxOf.get(wrap.from)!
      const to = boxOf.get(wrap.to)!
      expect(to.col).toBe(from.col + 1)
      expect(wrap.down).toBe(from.col % 2 === 0)
    }
  })

  it('蛇形翻转：偶数列自上而下（y 递增）、奇数列自下而上（y 递减）；7 步两列分布为 3/4、一条 wrap down=true', () => {
    const plain = Array.from({ length: 7 }, (_, i) => step(`p${i}`, 'call'))
    const layout = layoutFlowSteps(plain, 550)
    expect(layout.cols).toBe(2)
    const col0 = layout.nodes.filter((n) => n.col === 0).map((n) => n.y)
    const col1 = layout.nodes.filter((n) => n.col === 1).map((n) => n.y)
    expect(col0).toHaveLength(3)
    expect(col1).toHaveLength(4)
    for (let i = 1; i < col0.length; i += 1) expect(col0[i]!).toBeGreaterThan(col0[i - 1]!)
    for (let i = 1; i < col1.length; i += 1) expect(col1[i]!).toBeLessThan(col1[i - 1]!)
    // 翻转公式 y = TOP + BOT - (preY + h) 的手工核：偶数列首行贴顶；奇数列画序
    // 首位翻到内容区底部（BOT 由奇数列第 4 行的翻转前底 350 决定）
    expect(col0[0]).toBe(FLOW_TOP)
    expect(col1[0]).toBe(FLOW_TOP + layout.bot - (FLOW_TOP + FLOW_NODE_H))
    expect(layout.wraps).toEqual([{ from: 'p2', to: 'p3', down: true }])
  })

  it('子干缩进：depth>0 的节点 x = 同列主干 x + depth*INDENT', () => {
    const layout = layoutFlowSteps(snakeWorld(), 200)
    const branch = layout.nodes.find((n) => n.id === 's_branch')!
    const call = layout.nodes.find((n) => n.id === 's_call')!
    expect(branch.depth).toBe(0)
    expect(call.depth).toBe(1)
    expect(call.x).toBe(branch.x + FLOW_INDENT)
  })
})

describe('C12.5 flowlayout：形态映射与卫语句（§2.4-35 数据侧）', () => {
  it('kind 四值 → 四种图形齐全；词表外 → unknown 显式降级', () => {
    const layout = layoutFlowSteps(snakeWorld(), 900)
    const shapeOf = (id: string) => layout.nodes.find((n) => n.id === id)!.shape
    expect(shapeOf('s_call')).toBe('rect')
    expect(shapeOf('s_iface')).toBe('rect')
    expect(shapeOf('s_branch')).toBe('diamond')
    expect(shapeOf('s_loop')).toBe('loop')
    expect(shapeOf('s_ret')).toBe('terminal')
    expect(shapeOf('s_bad')).toBe('unknown')
  })

  it('卫语句甩侧：else 全 return 臂标 guardReturn、不进主干序、位置在锚点菱形右侧；混合臂不误标', () => {
    const layout = layoutFlowSteps(snakeWorld(), 200)
    const ret = layout.nodes.find((n) => n.id === 's_ret')!
    const branch = layout.nodes.find((n) => n.id === 's_branch')!
    const call = layout.nodes.find((n) => n.id === 's_call')!
    expect(ret.guardReturn).toBe(true)
    expect(ret.shape).toBe('terminal')
    expect(layout.sequence).not.toContain('s_ret')
    expect(ret.x).toBeGreaterThan(branch.x + branch.w)
    expect(ret.y).toBeGreaterThanOrEqual(FLOW_TOP)
    expect(call.guardReturn).toBe(false)
    expect(layout.childEdges).toContainEqual({ from: 's_branch', to: 's_ret', label: '否' })
  })

  it('then 臂全 return 时同样甩侧（卫语句不挑边）；普通分支体照常展开', () => {
    const world = [
      step('b', 'branch', { then: ['r1'], else: ['c1'] }),
      step('r1', 'return'),
      step('c1', 'call'),
    ]
    const layout = layoutFlowSteps(world, 400)
    const r1 = layout.nodes.find((n) => n.id === 'r1')!
    expect(r1.guardReturn).toBe(true)
    expect(layout.childEdges).toContainEqual({ from: 'b', to: 'r1', label: '是' })
    expect(layout.childEdges).toContainEqual({ from: 'b', to: 'c1', label: '否' })
  })
})

describe('C12.5 flowlayout：共享子干与悬空引用', () => {
  it('共享子干只放一个盒：s_call 被 branch.then 与 loop.body 双引用 → 节点唯一、语义边两条', () => {
    const layout = layoutFlowSteps(snakeWorld(), 900)
    expect(layout.nodes.filter((n) => n.id === 's_call')).toHaveLength(1)
    expect(layout.childEdges).toContainEqual({ from: 's_branch', to: 's_call', label: '是' })
    expect(layout.childEdges).toContainEqual({ from: 's_loop', to: 's_call', label: '循环体' })
  })

  it('悬空引用不产生节点也不崩溃（ghost 只存在于 wire 引用里）', () => {
    const layout = layoutFlowSteps(snakeWorld(), 900)
    expect(layout.nodes.some((n) => n.id === 's_ghost')).toBe(false)
    expect(layout.nodes.every((n) => Number.isFinite(n.x) && Number.isFinite(n.y))).toBe(true)
  })

  it('节点盒尺寸恒为常量（组件据此算锚点）', () => {
    const layout = layoutFlowSteps(snakeWorld(), 900)
    for (const n of layout.nodes) {
      expect(n.w).toBe(FLOW_NODE_W)
      expect(n.h).toBe(FLOW_NODE_H)
    }
  })
})
