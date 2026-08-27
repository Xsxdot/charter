import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { CgFlowStep, CgGraph } from '../../api/types'
import { FlowPageView } from './FlowPageView'

// 本文件是缝 2 消费面的穿线断言：渲染 FlowPageView 即对 deriveFlowPage 的真实调用
// （夹具是 §2.4-30 两字段输入的图数据）。期望值全部硬编码、手工可核。

vi.mock('../../api/client', () => ({
  fetchCodegraph: vi.fn(),
  fetchCodegraphSource: vi.fn(),
}))

const meta = { project: 'k5', branch: 'main', commit: 'c', scannedAt: 'now', generator: 'test' }

function flowWorld(withFlows = true): CgGraph {
  const steps: CgFlowStep[] = [
    { id: 's_branch', order: 1, kind: 'branch', line: 10, cond: 'err != nil', then: ['s_call', 's_ghost'], else: ['s_ret'] },
    { id: 's_call', order: 2, kind: 'call', line: 20, to: 'sub_e' },
    { id: 's_ret', order: 3, kind: 'return', line: 30 },
    { id: 's_loop', order: 4, kind: 'loop', line: 40, cond: 'range items', body: ['s_call'] },
    { id: 's_iface', order: 5, kind: 'call', line: 50, to: 'iface.X', iface: true },
  ]
  const w: CgGraph = {
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
  }
  if (withFlows) w.flows = { e: { steps } }
  return w
}

function multiWorld(): CgGraph {
  return {
    meta,
    domains: {
      home: { label: '老巢', kind: 'boundary' },
      biz: { label: '业务甲', kind: 'logic' },
      other: { label: '业务乙', kind: 'logic' },
    },
    containers: {
      c_home: { label: '入口', kind: '入口', domain: 'home' },
      c_b: { label: 'Biz', kind: '类型方法', domain: 'biz' },
      c_o: { label: 'Other', kind: '类型方法', domain: 'other' },
    },
    nodes: {
      m_e: { kind: 'entry', container: 'c_home', name: 'dual cmd', file: 'r/m.go', line: 1 },
      b1: { kind: 'func', container: 'c_b', name: 'Biz.Do', file: 'b/x.go', line: 1 },
      o1: { kind: 'func', container: 'c_o', name: 'Other.Do', file: 'o/x.go', line: 1 },
    },
    edges: [['m_e', 'b1'], ['m_e', 'o1']],
  }
}

function concentratedWorld(): CgGraph {
  const nodes: CgGraph['nodes'] = {}
  const edges: CgGraph['edges'] = []
  for (let i = 1; i <= 4; i += 1) {
    nodes[`r${i}`] = { kind: 'entry', container: 'c_home', name: `red act ${i}`, file: 'reg/red.go', line: i }
    nodes[`rf${i}`] = { kind: 'func', container: 'c_red', name: `Red.Do${i}`, file: `x/r${i}.go`, line: i }
    edges.push([`r${i}`, `rf${i}`])
  }
  return {
    meta,
    domains: {
      home: { label: '老巢', kind: 'boundary' },
      red: { label: '红域', kind: 'logic' },
    },
    containers: {
      c_home: { label: '入口', kind: '入口', domain: 'home' },
      c_red: { label: 'Red', kind: '类型方法', domain: 'red' },
    },
    nodes,
    edges,
  }
}

function q<T extends Element = HTMLElement>(selector: string, root: ParentNode = document): T {
  const el = root.querySelector(selector)
  if (!el) throw new Error(`element not found: ${selector}`)
  return el as T
}

function renderPage(baseline = flowWorld(), entryNodeId = 'e') {
  const view = render(<FlowPageView baseline={baseline} entryNodeId={entryNodeId} />)
  return view
}

describe('C12.5 页面壳：泳道与穿线（§2.4-29/-30）', () => {
  it('渲染即真实调用缝 2：flows 命中时泳道头 + 流程图画布在场，data-degraded=false', () => {
    renderPage()
    expect(q('[data-flow-page]').getAttribute('data-current-entry')).toBe('e')
    expect(q('[data-flow-page]').getAttribute('data-degraded')).toBe('false')
    expect(q('[data-lane-title]').textContent).toContain('泳道')
    expect(q('[data-lane-title]').textContent).toContain('CLI flow')
    expect(q('[data-flow-chart]')).toBeTruthy()
    expect(q('[data-step="s_call"]')).toBeTruthy()
  })

  it('术语三分定义句在场且含显式区分句（程序入口 / 对外入缝 / 泳道）', () => {
    renderPage()
    expect(q('[data-term-definition="program-entry"]').textContent).toContain('程序入口')
    expect(q('[data-term-definition="inbound-seam"]').textContent).toContain('对外入缝')
    expect(q('[data-term-definition="inbound-seam"]').textContent).toContain('不是程序入口')
    expect(q('[data-term-definition="lane"]').textContent).toContain('一条程序入口一条泳道')
  })
})

describe('C12.5 页面壳：降级空态（§2.4-31 最大危害的反面锁）', () => {
  it('degraded 时绝不渲染流程主干：[data-step] 为 null，机械序列只出现在右栏 chain tab 且带无次序无分支标注', () => {
    renderPage(flowWorld(false))
    const page = q('[data-flow-page]')
    expect(page.getAttribute('data-degraded')).toBe('true')
    expect(document.querySelector('[data-flow-degraded]')).toBeTruthy()
    // 三重反面：降级说明在场、流程图画布本体不在场、任何流程步骤节点都不存在——
    // 只断 [data-step] 会被「渲染了空画布」的形态空转放过（变异复验抓过这个假绿）。
    expect(document.querySelector('[data-flow-chart]')).toBeNull()
    expect(document.querySelector('[data-step]')).toBeNull()

    fireEvent.click(screen.getByRole('tab', { name: '调用链（给 agent）' }))
    // 序列照常可查（agent 用），但流程图画布与节点仍然一个都不存在
    expect(q('[data-chain-node="e"]')).toBeTruthy()
    expect(q('[data-chain-node="t"]')).toBeTruthy()
    expect(q('[data-chain-note]').textContent).toContain('无次序')
    expect(q('[data-chain-note]').textContent).toContain('无分支')
    expect(document.querySelector('[data-flow-chart]')).toBeNull()
    expect(document.querySelector('[data-step]')).toBeNull()
  })

  it('降级空态可行动：缺什么 / 为什么缺 / 何时会有 / 现在能做什么四字段逐条在场', () => {
    renderPage(flowWorld(false))
    expect(q('[data-degraded-missing]').textContent).toContain('flows')
    expect(q('[data-degraded-missing]').textContent).toContain('codegraph/baseline.json')
    expect(q('[data-degraded-why]').textContent).toContain('roadmap 27/32')
    expect(q('[data-degraded-eta]').textContent).toContain('重扫')
    expect(q('[data-degraded-hint]').textContent).toContain('调用链（给 agent）')
  })

  it('幽灵入口：显式 alert 而非空白页或崩溃', () => {
    renderPage(flowWorld(), 'ghost_x')
    expect(q('[data-entry-ghost]').textContent).toContain('ghost_x')
    expect(q('[data-flow-page]').getAttribute('data-degraded')).toBe('true')
    expect(document.querySelector('[data-step]')).toBeNull()
  })
})

describe('C12.5 页面壳：递归下钻（紫框 ▸）', () => {
  it('点下层入口压栈换图：current-entry 更新、层级标记、返回钮在场；返回恢复旧图', () => {
    renderPage()
    fireEvent.click(q('[data-step="s_call"]'))
    expect(q('[data-flow-page]').getAttribute('data-current-entry')).toBe('sub_e')
    expect(q('[data-flow-page]').getAttribute('data-depth')).toBe('1')
    expect(q('[data-flow-back]').textContent).toContain('返回上一张')

    fireEvent.click(q('[data-flow-back]'))
    expect(q('[data-flow-page]').getAttribute('data-current-entry')).toBe('e')
    expect(q('[data-flow-page]').getAttribute('data-depth')).toBe('0')
  })

  it('换图清空旧图选中态（选择不跨图泄漏）：先选中再下钻，新图无 data-selected', () => {
    renderPage()
    fireEvent.click(q('[data-step="s_iface"]'))
    expect(q('[data-step-detail="s_iface"]')).toBeTruthy()
    fireEvent.click(q('[data-step="s_call"]'))
    expect(document.querySelector('[data-selected]')).toBeNull()
    expect(q('[data-no-step-selection]')).toBeTruthy()
  })
})

describe('C12.5 页面壳：接口 → 实现（implements join 消费半边）', () => {
  it('选中 iface 步骤：右栏列出全部实现；有入口的实现可点击换图；无入口的如实标注', () => {
    renderPage()
    fireEvent.click(q('[data-step="s_iface"]'))
    expect(q('[data-iface-block]').textContent).toContain('接口调用')
    const items = document.querySelectorAll('[data-impl-list] [data-implementation]')
    expect(items).toHaveLength(2)
    expect(q('[data-implementation="ia"]').textContent).toContain('A.Start')
    expect(q('[data-impl-entry="ea"]')).toBeTruthy()
    expect(q('[data-implementation="ib"] [data-impl-no-entry]').textContent).toContain('无入口记录')

    fireEvent.click(q('[data-impl-entry="ea"]'))
    expect(q('[data-flow-page]').getAttribute('data-current-entry')).toBe('ea')
  })

  it('iface join 零命中：「无实现记录」显式空态而非空面板', () => {
    const w = flowWorld()
    w.implements = [['ix', 'iface.Y']]
    renderPage(w)
    fireEvent.click(q('[data-step="s_iface"]'))
    expect(q('[data-impl-none]').textContent).toContain('无实现记录')
    expect(document.querySelector('[data-impl-list]')).toBeNull()
  })
})

describe('C12.5 页面壳：归属三态与散度（§2.4-32/-33 视图半边）', () => {
  it('单值归属 + 集中注册红标（4 入口 1 文件）；悬空引用计数区块在场', () => {
    renderPage(concentratedWorld(), 'r1')
    expect(q('[data-ownership-single]').textContent).toContain('red')
    expect(q('[data-dispersion-concentrated]').textContent).toContain('集中注册')
    expect(document.querySelector('[data-dangling-count]')).toBeNull()
  })

  it('多值归属：全部候选升序呈现；散度位如实显示不发读数', () => {
    renderPage(multiWorld(), 'm_e')
    const multi = q('[data-ownership-multi]')
    expect(multi.textContent).toContain('biz')
    expect(multi.textContent).toContain('other')
    expect(q('[data-dispersion-none]').textContent).toContain('不发散发度读数')
  })

  it('判不出（Cobra 分组命令）：标「无行为」，族照常显示', () => {
    const cobra: CgGraph = {
      meta,
      domains: { home: { label: '老巢', kind: 'boundary' } },
      containers: { c_home: { label: '入口', kind: '入口', domain: 'home' } },
      nodes: { e_cg: { kind: 'entry', container: 'c_home', name: 'handoff service', file: 'r/cg.go', line: 1 } },
      edges: [],
    }
    renderPage(cobra, 'e_cg')
    expect(q('[data-ownership-none]').textContent).toContain('无行为')
    expect(q('[data-lane-title]').textContent).toContain('CLI handoff')
  })
})

describe('C12.5 页面壳：零请求与悬空引用', () => {
  it('本卡不发起任何网络请求：mount + 全交互后 client mock 计数恒 0', async () => {
    const client = await import('../../api/client')
    renderPage()
    fireEvent.click(q('[data-step="s_iface"]'))
    fireEvent.click(screen.getByRole('tab', { name: '调用链（给 agent）' }))
    fireEvent.click(q('[data-step="s_call"]'))
    fireEvent.click(q('[data-flow-back]'))
    expect(vi.mocked(client.fetchCodegraph)).not.toHaveBeenCalled()
    expect(vi.mocked(client.fetchCodegraphSource)).not.toHaveBeenCalled()
  })

  it('悬空引用计数进右栏（flowWorld 的 s_ghost），画布上有对应标注', () => {
    renderPage()
    expect(q('[data-dangling-count]').textContent).toContain('1 条悬空引用')
    expect(q('[data-dangling-ref="s_ghost"]')).toBeTruthy()
  })
})

describe('C12.6 页面壳：入口真名接线（FlowPageModel.entryName 纯输出侧扩展）', () => {
  it('泳道标题接真名：显示 entryName（flow cmd），不再以 mono id 占标题位', () => {
    renderPage()
    expect(q('[data-lane-title]').textContent).toContain('泳道')
    expect(q('[data-lane-title]').textContent).toContain('flow cmd')
    expect(q('[data-lane-title]').textContent).not.toContain('e')
  })

  it('幽灵入口（entryName 空串）时标题回退为 id 兜底呈现，不猜名字', () => {
    renderPage(flowWorld(), 'ghost_x')
    expect(q('[data-lane-title]').textContent).toContain('ghost_x')
  })

  it('下钻层级接真名：点下层入口后祖先链显示沿途入口名；到达层由当层 entryName 回填', () => {
    renderPage()
    fireEvent.click(q('[data-step="s_call"]'))
    expect(q('[data-flow-page]').getAttribute('data-current-entry')).toBe('sub_e')
    // 祖先链：出发层 e 的真名在点击瞬间已随 targetName 入表
    expect(q('[data-flow-trail-entry="e"]').textContent).toBe('flow cmd')
    // 当层 sub_e 的真名由它自己的模型 entryName 回填（标题同步显示）
    expect(q('[data-lane-title]').textContent).toContain('sub cmd')
    // 当前层不入祖先链：sub_e 只出现在标题，不出现在 trail
    expect(document.querySelector('[data-flow-trail-entry="sub_e"]')).toBeNull()

    fireEvent.click(q('[data-flow-back]'))
    expect(document.querySelector('[data-flow-trail]')).toBeNull()
  })
})
