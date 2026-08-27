import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { CgFlowStep, CgGraph } from '../../api/types'
import { deriveFlowPage, type FlowPageModel } from './flowpage'
import { FLOW_NODE_W } from './flowlayout'
import { FLOW_PAGE_WIDTH, FlowChart } from './FlowChart'

// 夹具纪律：经真实 deriveFlowPage 构造模型（缝 2 是本组件唯一数据源），期望硬编码。
// 蛇形/卫语句/形态断言全部走 data-* 与坐标标记（位置断言非像素），禁 snapshot。

const meta = { project: 'k5', branch: 'main', commit: 'c', scannedAt: 'now', generator: 'test' }

function flowWorld(): CgGraph {
  const steps: CgFlowStep[] = [
    { id: 's_branch', order: 1, kind: 'branch', line: 10, cond: 'err != nil', then: ['s_call', 's_ghost'], else: ['s_ret'] },
    { id: 's_call', order: 2, kind: 'call', line: 20, to: 'sub_e' },
    { id: 's_ret', order: 3, kind: 'return', line: 30 },
    { id: 's_loop', order: 4, kind: 'loop', line: 40, cond: 'range items', body: ['s_call'] },
    { id: 's_iface', order: 5, kind: 'call', line: 50, to: 'iface.X', iface: true },
    { id: 's_bad', order: 6, kind: 'jump' as unknown as CgFlowStep['kind'], line: 60, to: 't' },
  ]
  return {
    meta,
    domains: { home: { label: '老巢', kind: 'boundary' }, biz: { label: '业务', kind: 'logic' } },
    containers: {
      c_home: { label: '入口', kind: '入口', domain: 'home' },
      c_t: { label: 'T', kind: '类型方法', domain: 'biz' },
      c_sub: { label: '下层入口', kind: '入口', domain: 'biz' },
      c_ia: { label: 'AdapterA', kind: '类型方法', domain: 'biz' },
      c_ib: { label: 'AdapterB', kind: '类型方法', domain: 'biz' },
    },
    nodes: {
      e: { kind: 'entry', container: 'c_home', name: 'flow cmd', file: 'r/e.go', line: 1 },
      t: { kind: 'func', container: 'c_t', name: 'T.Do', file: 'b/t.go', line: 5 },
      sub_e: { kind: 'entry', container: 'c_sub', name: 'sub cmd', file: 'b/s.go', line: 2 },
      ia: { kind: 'func', container: 'c_ia', name: 'A.Start', file: 'b/ia.go', line: 3 },
      ib: { kind: 'func', container: 'c_ib', name: 'B.Start', file: 'b/ib.go', line: 4 },
      ea: { kind: 'entry', container: 'c_ia', name: 'A serve', file: 'b/ia.go', line: 1 },
    },
    edges: [['e', 't']],
    implements: [['ia', 'iface.X'], ['ib', 'iface.X'], ['ix', 'iface.Y']],
    flows: { e: { steps } },
  }
}

function hitModel(): FlowPageModel {
  return deriveFlowPage({ baseline: flowWorld(), entryNodeId: 'e' })
}

function degradedModel(): FlowPageModel {
  const w = flowWorld()
  delete (w as { flows?: unknown }).flows
  return deriveFlowPage({ baseline: w, entryNodeId: 'e' })
}

function q<T extends Element = HTMLElement>(selector: string, root: ParentNode = document): T {
  const el = root.querySelector(selector)
  if (!el) throw new Error(`element not found: ${selector}`)
  return el as T
}

function renderChart(model = hitModel(), width = FLOW_PAGE_WIDTH, selectedStepId = '') {
  const onSelectStep = vi.fn()
  const onOpenEntry = vi.fn()
  const view = render(
    <FlowChart model={model} width={width} selectedStepId={selectedStepId}
      onSelectStep={onSelectStep} onOpenEntry={onOpenEntry} />,
  )
  return { ...view, onSelectStep, onOpenEntry }
}

describe('C12.5 流程图画布：形态映射（§2.4-35）', () => {
  it('六步全部渲染且四种图形齐全、词表外走 unknown 降级节点（「未知步骤」显式标注）', () => {
    renderChart()
    for (const id of ['s_branch', 's_call', 's_ret', 's_loop', 's_iface', 's_bad']) {
      expect(q(`[data-step="${id}"]`)).toBeTruthy()
    }
    expect(q('[data-step="s_call"]').getAttribute('data-shape')).toBe('rect')
    expect(q('[data-step="s_iface"]').getAttribute('data-shape')).toBe('rect')
    expect(q('[data-step="s_branch"]').getAttribute('data-shape')).toBe('diamond')
    expect(q('[data-step="s_loop"]').getAttribute('data-shape')).toBe('loop')
    expect(q('[data-step="s_ret"]').getAttribute('data-shape')).toBe('terminal')
    expect(q('[data-step="s_bad"]').getAttribute('data-shape')).toBe('unknown')
    expect(q('[data-step="s_bad"] [data-step-label]').textContent).toContain('未知步骤')
  })

  it('矩形左色条=所属领域（targetDomain 透传）；行号投影在场', () => {
    renderChart()
    expect(q('[data-step="s_call"] [data-domain-bar]').getAttribute('data-domain-bar')).toBe('biz')
    expect(q('[data-step="s_call"] [data-step-line]').textContent).toBe(':20')
  })

  it('紫框 ▸ 下层入口：data-sub-entry 标记 + ▸ 符号；点击回调携带该入口 id', () => {
    const view = renderChart()
    const node = q('[data-step="s_call"]')
    expect(node.getAttribute('data-sub-entry')).toBe('true')
    expect(q('[data-step="s_call"] [data-step-label]').textContent).toContain('▸')
    fireEvent.click(node)
    expect(view.onOpenEntry).toHaveBeenCalledTimes(1)
    expect(view.onOpenEntry).toHaveBeenCalledWith('sub_e')
    expect(view.onSelectStep).not.toHaveBeenCalled()
  })

  it('接口调用双线框：data-iface 标记；点击选中（右栏实现清单由页面壳渲染）', () => {
    const view = renderChart()
    const node = q('[data-step="s_iface"]')
    expect(node.getAttribute('data-iface')).toBe('true')
    fireEvent.click(node)
    expect(view.onSelectStep).toHaveBeenCalledWith('s_iface')
    expect(view.onOpenEntry).not.toHaveBeenCalled()
  })

  it('普通调用节点点击只选中不下钻', () => {
    const view = renderChart()
    fireEvent.click(q('[data-step="s_bad"]'))
    expect(view.onSelectStep).toHaveBeenCalledWith('s_bad')
    expect(view.onOpenEntry).not.toHaveBeenCalled()
  })
})

describe('C12.5 流程图画布：蛇形折列与卫语句', () => {
  it('宽画布折列：列间存在 wrap path 连线元素；「接上列/接下列」文字标签出现即红（§2.4-35 反面）', () => {
    const { container } = renderChart(hitModel(), 900)
    expect(q('[data-flow-chart]').getAttribute('data-cols')).toBe('3')
    expect(document.querySelectorAll('path[data-flow-edge^="wrap:"]').length).toBeGreaterThanOrEqual(1)
    expect(/接上列|接下列/.test(container.textContent ?? '')).toBe(false)
    expect(screen.queryByText(/接上列|接下列/)).toBeNull()
  })

  it('窄画布单列：无 wrap path；顺序边照常连线', () => {
    renderChart(hitModel(), 200)
    expect(q('[data-flow-chart]').getAttribute('data-cols')).toBe('1')
    expect(document.querySelectorAll('path[data-flow-edge^="wrap:"]').length).toBe(0)
    expect(document.querySelectorAll('path[data-flow-edge^="seq:"]').length).toBeGreaterThanOrEqual(1)
  })

  it('卫语句甩侧：返回终点带 guard 标记且位置在菱形右侧（位置标记断言非像素）；虚线子干边在 SVG 层', () => {
    renderChart(hitModel(), 900)
    const ret = q('[data-step="s_ret"]')
    const branch = q('[data-step="s_branch"]')
    expect(ret.getAttribute('data-guard-return')).toBe('true')
    expect(Number(ret.getAttribute('data-x'))).toBeGreaterThan(Number(branch.getAttribute('data-x')) + FLOW_NODE_W)
    expect(document.querySelector('path[data-flow-edge="child:s_branch:s_ret"]')).toBeTruthy()
  })

  it('悬空引用显式标注在引用父步上，不崩溃也不造出幽灵节点', () => {
    renderChart()
    expect(q('[data-step="s_branch"] [data-dangling-ref="s_ghost"]')).toBeTruthy()
    expect(document.querySelector('[data-step="s_ghost"]')).toBeNull()
  })

  it('选中态受控：selectedStepId 对应节点带标记、其余不带', () => {
    const view = renderChart(hitModel(), FLOW_PAGE_WIDTH, '')
    view.rerender(
      <FlowChart model={hitModel()} width={FLOW_PAGE_WIDTH} selectedStepId="s_loop"
        onSelectStep={view.onSelectStep} onOpenEntry={view.onOpenEntry} />,
    )
    expect(q('[data-step="s_loop"]').getAttribute('data-selected')).toBe('true')
    expect(q('[data-step="s_call"]').getAttribute('data-selected')).toBeNull()
  })

  it('degraded 模型（steps 空）渲染空画布不崩溃——流程主干只能来自 flows 数据', () => {
    const { container } = renderChart(degradedModel())
    expect(container.querySelector('[data-step]')).toBeNull()
    expect(q('[data-flow-chart]')).toBeTruthy()
  })
})
