import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ScopePageModel } from './scopepage'
import { RightPanel } from './RightPanel'

// 夹具纪律：本文件直接构造 ScopePageModel 字面量（DOM 契约缝的单元面），
// 经真实 deriveScopePage 的穿线断言归 TwoAxisPage.test.tsx。期望文本硬编码。
// 查询纪律：一律按本卡 data-* 契约属性选择（q 助手），不用渲染实现细节。

function q<T extends Element = HTMLElement>(selector: string, root: ParentNode = document): T {
  const el = root.querySelector(selector)
  if (!el) throw new Error(`element not found: ${selector}`)
  return el as T
}

function seam(overrides: Partial<ScopePageModel['inboundSeams'][number]> & { nodeId: string }): ScopePageModel['inboundSeams'][number] {
  return {
    name: overrides.nodeId,
    containerId: 'c1',
    containerLabel: '容器一',
    containerKind: '类型方法',
    kindClass: 'real-kernel',
    reuse: 3,
    folded: false,
    callerDomains: ['d_caller'],
    ...overrides,
  }
}

function modelFixture(overrides: Partial<ScopePageModel> = {}): ScopePageModel {
  return {
    scopeId: 'leaf_b',
    organization: 'best',
    organizationAvailable: true,
    nodes: [
      {
        id: 'c_store',
        kind: 'container',
        label: 'Store',
        type: '类型方法',
        external: false,
        isolated: false,
        childCount: 0,
        containerCount: 0,
        symbolCount: 12,
        fileCount: 3,
        oversized: false,
        dir: 'a/store',
        ports: [],
        entries: [
          { id: 'e_cli', name: 'k4 run', channel: 'cli' },
          { id: 'e_http', name: 'GET /k4', channel: 'http' },
          { id: 'e_ws', name: 'ws k4', channel: 'ws' },
          { id: 'e_web', name: 'web k4', channel: 'web' },
          { id: 'e_bare', name: 'bare cmd' },
        ],
        responsibility: { state: 'declared', text: '键值存取的应然职责' },
        invariants: null,
        debt: null,
      },
      {
        id: 'c_junk',
        kind: 'container',
        label: '杂活',
        type: '函数组',
        external: false,
        isolated: false,
        childCount: 0,
        containerCount: 0,
        symbolCount: 45,
        fileCount: 5,
        oversized: true,
        dir: '',
        ports: [],
        entries: [],
        responsibility: { state: 'no-subject' },
        invariants: null,
        debt: null,
      },
      {
        id: 'd_leaf',
        kind: 'domain',
        label: '乙叶子',
        type: 'logic',
        external: false,
        isolated: false,
        childCount: 0,
        containerCount: 2,
        symbolCount: 57,
        fileCount: 8,
        oversized: false,
        dir: '',
        ports: [],
        entries: [],
        responsibility: { state: 'undeclared' },
        invariants: {
          state: 'present',
          items: [
            { text: '叶子域的承重不变式', testRef: 'TestLeafInvariant' },
            { text: '没有测试锚的不变式' },
          ],
        },
        debt: { inboundCrossDomain: 15, fallbackBucket: 13, unknownKind: 2, ratio: 13 / 15 },
      },
    ],
    edges: [],
    inboundSeams: [
      seam({ nodeId: 's_live', name: 'Store.Get', reuse: 3 }),
      seam({ nodeId: 's_dead', name: 'Ghost.Call', kindClass: 'other', reuse: 0 }),
      seam({ nodeId: 's_noise', name: 'writeJSON', containerLabel: '杂活', containerKind: '函数组', kindClass: 'fallback', reuse: 73, folded: true }),
    ],
    empty: { noDeclaration: false, noEntities: false, noInboundSeams: false },
    ...overrides,
  }
}

function renderPanel(model = modelFixture(), selectedNodeId = '') {
  const onOpenEntry = vi.fn()
  const view = render(<RightPanel model={model} selectedNodeId={selectedNodeId} onOpenEntry={onOpenEntry} />)
  return { ...view, onOpenEntry }
}

afterEach(() => {
  window.localStorage.clear()
})

describe('C12.4 右栏三 tab 结构与切换', () => {
  it('三个 tab 依次可切：aria-selected 随点击移动，tab 体随之更换', () => {
    renderPanel()
    expect(screen.getByRole('tab', { name: '基本信息' }).getAttribute('aria-selected')).toBe('true')
    expect(q('[data-tab-body="info"]')).toBeTruthy()
    fireEvent.click(screen.getByRole('tab', { name: '对外面' }))
    expect(screen.getByRole('tab', { name: '对外面' }).getAttribute('aria-selected')).toBe('true')
    expect(q('[data-tab-body="seams"]')).toBeTruthy()
    expect(document.querySelector('[data-tab-body="info"]')).toBeNull()
    fireEvent.click(screen.getByRole('tab', { name: '状态机' }))
    expect(q('[data-tab-body="state-machine"]')).toBeTruthy()
  })

  it('组织切换控件不在本组件出现：右栏内无 data-organization（§2.3-21 隔离判据的右栏半边）', () => {
    const { container } = renderPanel()
    expect(container.querySelector('[data-right-panel] [data-organization]')).toBeNull()
  })
})

describe('C12.4 基本信息 tab（§2.2-11/§2.3-24/-25）', () => {
  it('职责三态互斥可辨：declared 显正文；undeclared 显未声明+写入路径且不含兜底文本；no-subject 显无职责主体', () => {
    const model = modelFixture()
    const declared = renderPanel(model, 'c_store')
    expect(q('[data-responsibility]').textContent).toContain('键值存取的应然职责')

    declared.unmount()
    const noSubject = renderPanel(model, 'c_junk')
    expect(screen.getByText(/无职责主体（函数组）/)).toBeTruthy()
    expect(document.querySelector('[data-empty="no-declaration"]')).toBeNull()

    noSubject.unmount()
    renderPanel(model, 'd_leaf')
    const undeclared = q('[data-empty="no-declaration"]')
    expect(undeclared.textContent).toContain('codegraph/domains/d_leaf.json')
    // 反面断言（§2.2-11 兜底回退即红）：undeclared 态不得出现 best/label 来源正文
    expect(undeclared.textContent).not.toContain('乙叶子')
  })

  it('选中项读数逐字段投影：符号数/文件数/包目录；容器卡不渲染领域专属行', () => {
    renderPanel(modelFixture(), 'c_store')
    expect(q('[data-readout="symbols"]').textContent).toBe('12')
    expect(q('[data-readout="files"]').textContent).toBe('3')
    expect(q('[data-readout="dir"]').textContent).toBe('a/store')
    expect(document.querySelector('[data-readout="containers"]')).toBeNull()

    renderPanel(modelFixture(), 'd_leaf')
    expect(q('[data-readout="containers"]').textContent).toBe('2')
    expect(q('[data-readout="children"]').textContent).toBe('0')
  })

  it('大容器卡：oversized 标记 + 正面符号数/文件数 + 明示不折叠圆场（§2.3-24）', () => {
    renderPanel(modelFixture(), 'c_junk')
    expect(q('[data-oversized-mark]').textContent).toContain('45 符号 / 5 文件')
    expect(q('[data-oversized-mark]').textContent).toContain('不做折叠圆场')
    expect(document.querySelector('[data-folded-toggle]')).toBeNull()
  })

  it('领域债读数四字段数值化投影；ratio=null 显示「无跨域入边」而非 0%（§2.3-22/-25）', () => {
    const first = renderPanel(modelFixture(), 'd_leaf')
    expect(q('[data-debt="inbound"]').textContent).toBe('15')
    expect(q('[data-debt="fallback"]').textContent).toBe('13')
    expect(q('[data-debt="unknown-kind"]').textContent).toBe('2')
    // 13/15 = 86.67% → round 87%；硬编码期望，不从常量推导
    expect(q('[data-debt="ratio"]').textContent).toBe('87%')
    first.unmount()

    renderPanel(
      modelFixture({
        nodes: modelFixture().nodes.map((n) => (
          n.id === 'd_leaf' ? { ...n, debt: { inboundCrossDomain: 0, fallbackBucket: 0, unknownKind: 0, ratio: null } } : n
        )),
      }),
      'd_leaf',
    )
    expect(q('[data-debt="ratio-none"]').textContent).toBe('无跨域入边')
    expect(document.querySelector('[data-debt="ratio"]')).toBeNull()
  })

  it('程序入口按 channel 分组；channel 全缺时只剩「通道未标注」单桶（【释2】）', () => {
    const model = modelFixture()
    const first = renderPanel(model, 'c_store')
    for (const bucket of ['cli', 'http', 'ws', 'web']) {
      expect(document.querySelector(`[data-channel-group="${bucket}"]`)).toBeTruthy()
    }
    expect(q('[data-channel-group="unlabeled"]').textContent).toContain('通道未标注')
    first.unmount()

    const allBare = modelFixture({
      nodes: modelFixture().nodes.map((n) => (
        n.id === 'c_store'
          ? { ...n, entries: [{ id: 'x1', name: 'only bare one' }, { id: 'x2', name: 'another bare' }] }
          : n
      )),
    })
    renderPanel(allBare, 'c_store')
    for (const bucket of ['cli', 'http', 'ws', 'web']) {
      expect(document.querySelector(`[data-channel-group="${bucket}"]`)).toBeNull()
    }
    expect(document.querySelectorAll('[data-channel-group="unlabeled"]').length).toBe(1)
    expect(q('[data-channel-group="unlabeled"]').textContent).toContain('another bare')
  })

  it('点程序入口：回调携带入口 id 且按钮有可见反馈（无死控件）；容器卡无入口显空态', () => {
    const first = renderPanel(modelFixture(), 'c_store')
    fireEvent.click(screen.getByRole('button', { name: 'k4 run' }))
    expect(first.onOpenEntry).toHaveBeenCalledTimes(1)
    expect(first.onOpenEntry).toHaveBeenCalledWith('e_cli')
    expect(q('[data-entry="e_cli"]').getAttribute('data-entry-active')).toBe('true')

    fireEvent.click(screen.getByRole('button', { name: 'bare cmd' }))
    expect(first.onOpenEntry).toHaveBeenCalledWith('e_bare')
    first.unmount()

    renderPanel(modelFixture(), 'c_junk')
    expect(q('[data-empty="no-entries"]').textContent).toContain('没有程序入口')
  })
})

// C12.4 协调者修订 R3：不变式从「未接线指针」改为真渲染——text 与 testRef 都要带出来，
// 「该域无 decl」与「有 decl 但未写不变式」两种空态必须可区分，容器卡没有声明格位。
describe('C12.4 不变式区（R3 接线：三态真渲染 + 双空态互斥）', () => {
  it('present 态逐条渲染 text 与 testRef，且不再带 data-unwired 标记', () => {
    renderPanel(modelFixture(), 'd_leaf')
    const section = q('[data-section="invariants"]')
    expect(section.getAttribute('data-unwired')).toBeNull()
    const items = section.querySelectorAll('[data-invariant]')
    expect(items.length).toBe(2)
    expect(items[0]!.textContent).toContain('叶子域的承重不变式')
    expect(items[0]!.querySelector('[data-invariant-test]')!.textContent).toContain('TestLeafInvariant')
    // 第二条声明未带测试锚：如实不渲染测试锚位，也不冒充
    expect(items[1]!.textContent).toContain('没有测试锚的不变式')
    expect(items[1]!.querySelector('[data-invariant-test]')).toBeNull()
  })

  it('unwritten 态（有 decl 无条目）：显式空态指向 decl 文件的 invariants 字段，且不出现条目、不混入 no-decl', () => {
    const model = modelFixture({
      nodes: modelFixture().nodes.map((n) => (
        n.id === 'd_leaf' ? { ...n, invariants: { state: 'unwritten' as const } } : n
      )),
    })
    renderPanel(model, 'd_leaf')
    const empty = q('[data-empty="no-invariants"]')
    expect(empty.textContent).toContain('codegraph/domains/d_leaf.json')
    expect(empty.textContent).toContain('invariants')
    expect(document.querySelector('[data-invariant]')).toBeNull()
    // 三态互斥的反面断言：另一种空态标记不得同时在场
    expect(document.querySelector('[data-empty="no-decl"]')).toBeNull()
  })

  it('no-decl 态（该域无声明文件）：独立空态指明先建声明文件——与 unwritten 属性值可辨', () => {
    const model = modelFixture({
      nodes: modelFixture().nodes.map((n) => (
        n.id === 'd_leaf' ? { ...n, invariants: { state: 'no-decl' as const } } : n
      )),
    })
    renderPanel(model, 'd_leaf')
    const empty = q('[data-empty="no-decl"]')
    expect(empty.textContent).toContain('codegraph/domains/d_leaf.json')
    expect(empty.textContent).toContain('声明文件')
    expect(document.querySelector('[data-invariant]')).toBeNull()
    expect(document.querySelector('[data-empty="no-invariants"]')).toBeNull()
  })

  it('容器卡没有声明格位：不变式区块整体不在场（沿 debt 区块同款条件渲染）', () => {
    renderPanel(modelFixture(), 'c_store')
    expect(document.querySelector('[data-section="invariants"]')).toBeNull()
  })
})

describe('C12.4 对外面 tab（§2.3-23/-25）', () => {
  it('显式区分「对外入缝」与「程序入口」的文案在场（§2.4-36 的本 tab 附加落点；K5 的三词定义句不在此顶替）', () => {
    renderPanel(modelFixture())
    fireEvent.click(screen.getByRole('tab', { name: '对外面' }))
    expect(q('[data-seams-disclaimer]').textContent).toContain('对外入缝')
    expect(q('[data-seams-disclaimer]').textContent).toContain('程序入口')
  })

  it('未折叠入缝逐条渲染：kind-class 标记、复用数、死契约标记、来源域', () => {
    renderPanel(modelFixture())
    fireEvent.click(screen.getByRole('tab', { name: '对外面' }))
    const live = q('[data-inbound-seam="s_live"]')
    expect(live.getAttribute('data-kind-class')).toBe('real-kernel')
    expect(live.textContent).toContain('复用 3')
    expect(live.textContent).toContain('来自 d_caller')
    const dead = q('[data-inbound-seam="s_dead"]')
    expect(dead.getAttribute('data-kind-class')).toBe('other')
    expect(dead.querySelector('[data-dead-contract]')!.textContent).toBe('死契约')
  })

  it('折叠噪声默认隐藏且不占名额；展开后带 folded 标记；再点收起（§2.3-23 视图半边）', () => {
    renderPanel(modelFixture())
    fireEvent.click(screen.getByRole('tab', { name: '对外面' }))
    expect(document.querySelector('[data-inbound-seam="s_noise"]')).toBeNull()
    const toggle = q<HTMLButtonElement>('[data-folded-toggle]')
    expect(toggle.textContent).toContain('已折叠 1 条噪声')
    expect(toggle.textContent).toContain('不占名额')
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(toggle)
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    const unfolded = q('[data-inbound-seam="s_noise"]')
    expect(unfolded.getAttribute('data-folded')).toBe('true')
    expect(unfolded.textContent).toContain('复用 73')
    fireEvent.click(toggle)
    expect(document.querySelector('[data-inbound-seam="s_noise"]')).toBeNull()
  })

  it('无入缝空态：指明缺什么、去哪补（§2.3-25）', () => {
    renderPanel(modelFixture({ inboundSeams: [], empty: { noDeclaration: false, noEntities: false, noInboundSeams: true } }))
    fireEvent.click(screen.getByRole('tab', { name: '对外面' }))
    expect(q('[data-empty="no-inbound-seams"]').textContent).toContain('baseline.json')
  })
})

describe('C12.4 状态机 tab（§2.2-16 空态如实；R3-A 维持指针处置）', () => {
  it('指针文案指向 decl 文件的 stateMachine 字段，不渲染假迁移表', () => {
    renderPanel(modelFixture(), 'd_leaf')
    fireEvent.click(screen.getByRole('tab', { name: '状态机' }))
    const note = q('[data-state-machine-unwired]')
    expect(note.textContent).toContain('codegraph/domains/d_leaf.json')
    expect(note.textContent).toContain('stateMachine')
    expect(document.querySelector('[data-transition]')).toBeNull()
  })
})

describe('C12.4 拖宽分隔条（验收 10 + 真机清单 3 机内侧）', () => {
  it('拖动只改本地宽度状态（data-width 与 style 同步），不发起请求不改模型', () => {
    const { container } = render(<RightPanel model={modelFixture()} selectedNodeId="" />)
    const panel = q<HTMLDivElement>('[data-right-panel]', container)
    const before = Number(panel.getAttribute('data-width'))
    fireEvent.mouseDown(q('[data-resize-handle]'), { clientX: 500, clientY: 10 })
    fireEvent.mouseMove(window, { clientX: 440, clientY: 10 })
    fireEvent.mouseUp(window)
    expect(panel.getAttribute('data-width')).toBe(String(before + 60))
    expect(panel.style.width).toBe(`${before + 60}px`)
  })

  it('宽度持久化到 localStorage，重挂载读回夹取；写入抛错不崩溃（隐私模式降级）', () => {
    window.localStorage.setItem('codegraph.scope.rightWidth', '420')
    const first = render(<RightPanel model={modelFixture()} selectedNodeId="" />)
    expect(first.container.querySelector('[data-right-panel]')!.getAttribute('data-width')).toBe('420')
    first.unmount()

    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded')
    })
    const second = render(<RightPanel model={modelFixture()} selectedNodeId="" />)
    expect(() => {
      fireEvent.mouseDown(q('[data-resize-handle]'), { clientX: 400, clientY: 10 })
      fireEvent.mouseMove(window, { clientX: 300, clientY: 10 })
      fireEvent.mouseUp(window)
    }).not.toThrow()
    // 420 + (400 - 300) = 520：写入抛错只留 warn，宽度状态照常更新
    expect(second.container.querySelector('[data-right-panel]')!.getAttribute('data-width')).toBe('520')
    spy.mockRestore()
  })

  it('越界拖动被夹取到 [280, 720]', () => {
    const { container } = render(<RightPanel model={modelFixture()} selectedNodeId="" />)
    const panel = q<HTMLDivElement>('[data-right-panel]', container)
    const handle = q('[data-resize-handle]')
    // 手柄在左缘：向左拖加宽（360 + (400-(-2000)) → 夹取上限），向右拖收窄
    fireEvent.mouseDown(handle, { clientX: 400, clientY: 10 })
    fireEvent.mouseMove(window, { clientX: -2000, clientY: 10 })
    fireEvent.mouseUp(window)
    expect(panel.getAttribute('data-width')).toBe('720')
    fireEvent.mouseDown(handle, { clientX: 400, clientY: 10 })
    fireEvent.mouseMove(window, { clientX: 2000, clientY: 10 })
    fireEvent.mouseUp(window)
    expect(panel.getAttribute('data-width')).toBe('280')
  })
})
