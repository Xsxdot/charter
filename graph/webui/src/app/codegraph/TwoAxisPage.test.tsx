import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { CgBest, CgCheckReport, CgDomainDecls, CgGraph, CgTarget } from '../../api/types'
import { TwoAxisPage } from './TwoAxisPage'

// 本文件是缝 1 消费面的穿线断言：渲染 TwoAxisPage 即对 deriveScopePage 的真实调用
// （夹具是 §2.3-19 六字段输入的图数据），组件树里看到的一切读数都来自模型。
// 期望值全部硬编码、手工可核。

vi.mock('../../api/client', () => ({
  fetchCodegraph: vi.fn(),
  fetchCodegraphSource: vi.fn(),
}))

const meta = { project: 'k4', branch: 'main', commit: 'c', scannedAt: 'now', generator: 'test' }

function k4World(): {
  baseline: CgGraph
  best: CgBest
  decls: CgDomainDecls
  target: CgTarget
  report: CgCheckReport
} {
  const nodes: CgGraph['nodes'] = {
    e1: { kind: 'entry', container: 'cA_entry', name: 'k4 run', file: 'a/cmd.go', line: 1, channel: 'cli' },
    e2: { kind: 'entry', container: 'cA_entry', name: 'GET /k4', file: 'a/http.go', line: 1, channel: 'http' },
    e3: { kind: 'entry', container: 'cA_entry', name: 'bare cmd', file: 'a/bare.go', line: 1 },
    s1: { kind: 'func', container: 'cA_type', name: 'Store.Get', file: 'a/store.go', line: 2 },
    m_store: { kind: 'model', container: 'cA_type', name: 'Store', file: 'a/store.go', line: 1, summary: '键值存取' },
    w1: { kind: 'func', container: 'cB_ent', name: 'Widget.Render', file: 'b/w.go', line: 1 },
    utilHigh: { kind: 'func', container: 'cB_fn', name: 'writeLots', file: 'b/hot.go', line: 1 },
    x1: { kind: 'func', container: 'cIso', name: 'Iso.Comp', file: 'c/x.tsx', line: 1 },
  }
  for (let i = 1; i <= 12; i += 1) {
    nodes[`er_${i}`] = { kind: 'entry', container: 'cA_entry', name: `noise run ${i}`, file: `r/n${i}.go`, line: i }
  }
  for (let i = 1; i <= 45; i += 1) {
    nodes[`fn_${i}`] = { kind: 'func', container: 'cB_fn', name: `util${i}`, file: `b/u${i % 5}.go`, line: i }
  }
  const edges: CgGraph['edges'] = [
    ['e1', 's1'],
    ['e1', 'fn_1'],
    ['e2', 'w1'],
    ['s1', 'w1'],
  ]
  for (let i = 1; i <= 12; i += 1) edges.push([`er_${i}`, 'utilHigh'])

  const baseline: CgGraph = {
    meta,
    domains: {
      topA: { label: '甲系统', kind: 'boundary' },
      subA: { label: '甲内部', kind: 'logic', parent: 'topA' },
      leafB: { label: '乙叶子', kind: 'logic' },
      isoC: { label: '孤岛丙', kind: 'boundary' },
    },
    containers: {
      cA_entry: { label: '甲入口', kind: '入口', domain: 'subA' },
      cA_type: { label: 'Store', kind: '类型方法', domain: 'subA' },
      cB_fn: { label: '杂活', kind: '函数组', domain: 'leafB' },
      cB_ent: { label: 'Widget', kind: '实体', domain: 'leafB' },
      cIso: { label: '孤岛容器', kind: 'React 组件/函数', domain: 'isoC' },
    },
    nodes,
    edges,
    projections: [['x1', 's1', 'twin']],
  }

  const best: CgBest = {
    meta: { version: 1, project: 'k4' },
    domains: {
      topA: { label: '甲系统', type: 'boundary' },
      subA: { label: '甲内部', parent: 'topA', type: 'logic' },
      leafB: { label: '乙叶子', type: 'logic' },
      isoC: { label: '孤岛丙', type: 'boundary' },
    },
    containers: {
      cA_entry: 'subA',
      cA_type: 'subA',
      cB_fn: 'leafB',
      cB_ent: 'leafB',
      cIso: 'isoC',
    },
  }

  const decls: CgDomainDecls = {
    topA: {
      domain: 'topA',
      responsibility: '甲系统的应然职责',
      // R3 接线穿线用：一条带测试锚的真不变式（text+testRef 都要在 DOM 可见）
      invariants: [{ text: '甲系统的承重不变式', testRef: 'TestTopAInvariant' }],
    },
  }

  const target: CgTarget = {
    meta: { version: 3, project: 'k4' },
    contracts: [{ from: 'topA', to: 'leafB', legacyBudget: 2 }],
  }

  const report: CgCheckReport = { fails: [], warns: [], legacyHits: { 'topA->leafB': 5 } }

  return { baseline, best, decls, target, report }
}

function renderPage(overrides: Partial<Parameters<typeof TwoAxisPage>[0]> = {}) {
  const world = k4World()
  const onOpenEntry = vi.fn()
  const view = render(
    <TwoAxisPage
      baseline={world.baseline}
      best={world.best}
      decls={world.decls}
      target={world.target}
      report={world.report}
      onOpenEntry={onOpenEntry}
      {...overrides}
    />,
  )
  return { ...view, onOpenEntry, world }
}

function q<T extends Element = HTMLElement>(selector: string, root: ParentNode = document): T {
  const el = root.querySelector(selector)
  if (!el) throw new Error(`element not found: ${selector}`)
  return el as T
}

describe('C12.4 页面装配：根层与组织切换（§2.3-19/-21）', () => {
  it('根层渲染三张顶层领域卡；右栏空选提示在场（穿线：读数来自真实 deriveScopePage）', () => {
    renderPage()
    expect(screen.getByText('甲系统')).toBeTruthy()
    expect(screen.getByText('乙叶子')).toBeTruthy()
    expect(screen.getByText('孤岛丙')).toBeTruthy()
    expect(q('[data-two-axis-page]').getAttribute('data-scope')).toBe('')
    expect(q('[data-no-selection]').textContent).toContain('单击图上的卡片')
  })

  it('§2.3-21 反面判据：组织切换控件不在 role=tablist 子树内，且两个控件都在场可用', () => {
    renderPage()
    expect(document.querySelector('[role="tablist"] [data-organization]')).toBeNull()
    expect(q('[data-organization="best"]')).toBeTruthy()
    expect(q('[data-organization="current"]')).toBeTruthy()
  })

  it('best 缺席：组织默认 current、按最优树禁用、不拿 current 冒充 best（§2.3-19）', () => {
    const { world } = renderPage({ best: undefined, target: undefined, report: undefined })
    expect(q('[data-two-axis-page]').getAttribute('data-organization')).toBe('current')
    expect(q('[data-organization="best"]')).toHaveProperty('disabled', true)
    expect(world.baseline.meta.project).toBe('k4')
  })

  it('切到按现状领域后 data-organization 更新且选中态被清空', () => {
    renderPage()
    fireEvent.click(q('[data-node="topA"]'))
    expect(q('[data-right-panel]').getAttribute('data-selected')).toBe('topA')
    fireEvent.click(q('[data-organization="current"]'))
    expect(q('[data-two-axis-page]').getAttribute('data-organization')).toBe('current')
    expect(q('[data-right-panel]').getAttribute('data-selected')).toBe('')
  })
})

describe('C12.4 页面装配：scope 下钻与容器原子（§2.3-20）', () => {
  it('双击领域卡换 scope：data-scope 更新、面包屑出现、选中清空；点根面包屑回根', () => {
    renderPage()
    fireEvent.doubleClick(q('[data-node="topA"]'))
    expect(q('[data-two-axis-page]').getAttribute('data-scope')).toBe('topA')
    expect(q('[data-breadcrumbs]').textContent).toContain('甲系统')
    expect(q('[data-right-panel]').getAttribute('data-selected')).toBe('')
    // 下钻后同形态：子领域卡由同一个派生器产出（递归同构的装配侧证据）
    fireEvent.doubleClick(q('[data-node="subA"]'))
    expect(q('[data-two-axis-page]').getAttribute('data-scope')).toBe('subA')

    fireEvent.click(q('[data-breadcrumb="root"]'))
    expect(q('[data-two-axis-page]').getAttribute('data-scope')).toBe('')
  })

  it('双击容器卡：scope 不变（状态断言非弹窗猜测）+「容器没有下一层」说明出现', () => {
    renderPage()
    fireEvent.doubleClick(q('[data-node="leafB"]'))
    expect(q('[data-two-axis-page]').getAttribute('data-scope')).toBe('leafB')
    fireEvent.doubleClick(q('[data-node="cB_fn"]'))
    expect(q('[data-two-axis-page]').getAttribute('data-scope')).toBe('leafB')
    expect(q('[data-atomic-note]').textContent).toContain('容器没有下一层')
  })

  it('叶子领域的容器卡经真实模型带 oversized 标记（46 符号 > 40）', () => {
    renderPage()
    fireEvent.doubleClick(q('[data-node="leafB"]'))
    expect(q('[data-node="cB_fn"]').getAttribute('data-oversized')).toBe('true')
    expect(q('[data-debt-mark]').textContent).toContain('46 符号')
  })
})

describe('C12.4 页面装配：空态横幅与债色 join（R2）', () => {
  it('无声明横幅带写入路径；无实体横幅各自显形（§2.3-25）', () => {
    renderPage()
    fireEvent.doubleClick(q('[data-node="leafB"]'))
    expect(q('[data-scope-empty="declaration"]').textContent).toContain('codegraph/domains/leafB.json')
    expect(q('[data-scope-empty="entities"]')).toBeTruthy()
  })

  it('直调债四档色映射上画布边：root 层 topA→leafB 边标 over-budget（5>2 手工可核）', () => {
    renderPage()
    expect(q('[data-edge-key="topA->leafB"]').getAttribute('data-direction-status')).toBe('over-budget')
  })

  it('孤立子系统标注与 projection 第二类边在整页中可见（§2.3-27 穿线）', () => {
    renderPage()
    expect(q('[data-node="isoC"]').getAttribute('data-isolated')).toBe('true')
    expect(q('[data-isolated-reason]').textContent).toContain('投影')
    expect(q('[data-edge-kind="projection"]').getAttribute('data-projection-type')).toBe('twin')
    expect(q('[data-projection-legend]').textContent).toContain('不是调用边')
  })

  it('R3 不变式接线穿线：decls.topA.invariants 经缝 1 到右栏 DOM，text 与 testRef 都在场', () => {
    renderPage()
    fireEvent.click(q('[data-node="topA"]'))
    const section = q('[data-section="invariants"]')
    expect(section.getAttribute('data-unwired')).toBeNull()
    expect(section.textContent).toContain('甲系统的承重不变式')
    expect(q('[data-invariant-test]').textContent).toContain('TestTopAInvariant')
  })
})

describe('C12.4 页面装配：程序入口回调与网络零请求（验收 10）', () => {
  it('下钻到 subA 后选中入口容器卡，右栏点程序入口：onOpenEntry 携带入口 id', () => {
    const { onOpenEntry } = renderPage()
    fireEvent.doubleClick(q('[data-node="topA"]'))
    fireEvent.doubleClick(q('[data-node="subA"]'))
    // 程序入口区属于选中卡的右栏：先单击入口容器卡
    fireEvent.click(q('[data-node="cA_entry"]'))
    fireEvent.click(screen.getByRole('button', { name: 'k4 run' }))
    expect(onOpenEntry).toHaveBeenCalledTimes(1)
    expect(onOpenEntry).toHaveBeenCalledWith('e1')
  })

  it('本卡不发起任何网络请求：mount + 全交互后 client mock 计数恒 0', async () => {
    const client = await import('../../api/client')
    renderPage()
    fireEvent.click(q('[data-organization="current"]'))
    fireEvent.doubleClick(q('[data-node="leafB"]'))
    fireEvent.click(q('[data-node="cB_fn"]'))
    fireEvent.click(q('[data-migration-trigger]'))
    fireEvent.wheel(q('[data-scope-canvas]'), { ctrlKey: true, deltaY: -120 })
    expect(vi.mocked(client.fetchCodegraph)).not.toHaveBeenCalled()
    expect(vi.mocked(client.fetchCodegraphSource)).not.toHaveBeenCalled()
  })
})

describe('C12.4 页面装配：迁移抽屉接线（§2.5-39①）', () => {
  it('触发钮计数徽标在场（本世界 warn 空 → 0），展开显示无待迁移件', () => {
    renderPage()
    expect(q('[data-migration-count]').textContent).toBe('0')
    fireEvent.click(q('[data-migration-trigger]'))
    expect(q('[data-migration-none]').textContent).toContain('无待迁移件')
  })
})
