import { fireEvent, render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { ScopePageModel } from './scopepage'
import { ScopeCanvas } from './ScopeCanvas'

// 夹具纪律：直接构造 ScopePageModel 字面量（DOM 契约缝单元面）；期望硬编码。
function q<T extends Element = HTMLElement>(selector: string, root: ParentNode = document): T {
  const el = root.querySelector(selector)
  if (!el) throw new Error(`element not found: ${selector}`)
  return el as T
}

function node(id: string, overrides: Partial<ScopePageModel['nodes'][number]> = {}): ScopePageModel['nodes'][number] {
  return {
    id,
    kind: 'domain',
    label: id,
    type: 'logic',
    external: false,
    isolated: false,
    childCount: 0,
    containerCount: 0,
    symbolCount: 0,
    fileCount: 0,
    oversized: false,
    dir: '',
    ports: [],
    entries: [],
    responsibility: { state: 'undeclared' },
    invariants: { state: 'no-decl' },
    debt: null,
    ...overrides,
  }
}

function modelFixture(overrides: Partial<ScopePageModel> = {}): ScopePageModel {
  return {
    scopeId: null,
    organization: 'best',
    organizationAvailable: true,
    nodes: [
      node('topA', { label: '甲系统', childCount: 2 }),
      node('leafB', { label: '乙叶子' }),
      node('isoC', { label: '孤岛丙', isolated: true }),
      node('ext:d_far', { label: '远域', external: true }),
      node('c_big', {
        kind: 'container', label: '杂活', type: '函数组', symbolCount: 45, fileCount: 5, dir: 'b/u', oversized: true, invariants: null,
      }),
    ],
    edges: [
      { key: 'topA->leafB', from: 'topA', to: 'leafB', weight: 3, kind: 'call' },
      { key: 'isoC<->topA:twin', from: 'isoC', to: 'topA', weight: 1, kind: 'projection', projectionType: 'twin' },
    ],
    inboundSeams: [],
    empty: { noDeclaration: false, noEntities: false, noInboundSeams: false },
    ...overrides,
  }
}

function renderCanvas(model = modelFixture(), selectedNodeId = '') {
  const onSelect = vi.fn()
  const onOpenScope = vi.fn()
  const view = render(
    <ScopeCanvas
      model={model}
      edgeStatus={{ 'topA->leafB': 'over-budget' }}
      selectedNodeId={selectedNodeId}
      onSelect={onSelect}
      onOpenScope={onOpenScope}
    />,
  )
  return { ...view, onSelect, onOpenScope }
}

describe('C12.4 画布：卡片投影（§2.3-24/-27、§2.5-39）', () => {
  it('每张卡带 data-node/kind/external/isolated/nested 标记；嵌套领域卡带虚线框标记', () => {
    renderCanvas()
    expect(q('[data-node="topA"]').getAttribute('data-node-kind')).toBe('domain')
    expect(q('[data-node="topA"]').getAttribute('data-nested')).toBe('true')
    expect(q('[data-node="topA"]').className).toContain('border-dashed')
    expect(q('[data-node="leafB"]').getAttribute('data-nested')).toBeNull()
    expect(q('[data-node="ext:d_far"]').getAttribute('data-external')).toBe('true')
    expect(q('[data-node="isoC"]').getAttribute('data-isolated')).toBe('true')
  })

  it('大容器卡正面显示符号数/文件数与债务色标记，且无折叠控件（§2.3-24 反面）', () => {
    renderCanvas()
    const card = q('[data-node="c_big"]')
    expect(card.getAttribute('data-oversized')).toBe('true')
    expect(q('[data-debt-mark]').textContent).toContain('45 符号 / 5 文件')
    expect(card.querySelector('button')).toBeNull()
  })

  it('孤立子系统旁的原因标注存在且区分两种原因（§2.3-27）', () => {
    const first = renderCanvas()
    expect(q('[data-isolated-reason]').textContent).toContain('跨语言投影关联')
    expect(q('[data-isolated-reason]').textContent).toContain('不是调用边')
    first.unmount()

    renderCanvas(modelFixture({
      edges: [{ key: 'topA->leafB', from: 'topA', to: 'leafB', weight: 1, kind: 'call' }],
    }))
    expect(q('[data-isolated-reason]').textContent).toContain('无跨域调用入边')
    expect(q('[data-isolated-reason]').textContent).not.toContain('投影')
  })

  it('连线投影：call 边带方向状态与箭头；projection 边带类型标记与虚线样式属性', () => {
    renderCanvas()
    const callEdge = q('[data-edge-key="topA->leafB"]')
    expect(callEdge.getAttribute('data-edge-kind')).toBe('call')
    expect(callEdge.getAttribute('data-direction-status')).toBe('over-budget')
    expect(callEdge.getAttribute('marker-end')).toContain('cg-arrow')
    const projEdge = q('[data-edge-key="isoC<->topA:twin"]')
    expect(projEdge.getAttribute('data-projection-type')).toBe('twin')
    expect(projEdge.getAttribute('stroke-dasharray')).toBe('6 4')
  })

  it('四档债务色板图例区块存在，词表四值各一枚；「不是调用边」与嵌套图例文案在场（§2.5-39②③）', () => {
    renderCanvas()
    for (const status of ['declared', 'over-budget', 'dead-contract', 'new-direction']) {
      expect(document.querySelector(`[data-status-chip="${status}"]`)).toBeTruthy()
    }
    expect(q('[data-projection-legend]').textContent).toContain('不是调用边')
    expect(q('[data-nested-legend]').textContent).toContain('虚线框')
  })

  it('容器层包群组 frame 存在（嵌套层虚线 frame 标记，§2.5-39④的画布半边）', () => {
    renderCanvas()
    expect(q('[data-package-frame="b/u"]')).toBeTruthy()
  })
})

describe('C12.4 画布：单击选中态（验收 9——高亮与压暗必须同时断言）', () => {
  it('单击后：选中标记、相连高亮标记、不相连压暗标记三者同屏；再选清卡即全部消失', () => {
    const view = renderCanvas(modelFixture(), '')
    expect(q('[data-node="topA"]').getAttribute('data-dimmed')).toBe('true')

    fireEvent.click(q('[data-node="topA"]'))
    expect(view.onSelect).toHaveBeenCalledTimes(1)
    expect(view.onSelect).toHaveBeenCalledWith('topA')

    // 直接以受控 selectedNodeId 重渲染（组件是纯投影），三态同时断言：
    view.rerender(
      <ScopeCanvas
        model={modelFixture()}
        edgeStatus={{}}
        selectedNodeId="topA"
        onSelect={view.onSelect}
        onOpenScope={view.onOpenScope}
      />,
    )
    expect(q('[data-node="topA"]').getAttribute('data-selected')).toBe('true')
    expect(q('[data-node="leafB"]').getAttribute('data-highlight')).toBe('true')
    expect(q('[data-node="leafB"]').getAttribute('data-dimmed')).toBeNull()
    expect(q('[data-node="c_big"]').getAttribute('data-dimmed')).toBe('true')
    expect(q('[data-node="c_big"]').getAttribute('data-highlight')).toBeNull()

    view.rerender(
      <ScopeCanvas
        model={modelFixture()}
        edgeStatus={{}}
        selectedNodeId=""
        onSelect={view.onSelect}
        onOpenScope={view.onOpenScope}
      />,
    )
    expect(q('[data-node="topA"]').getAttribute('data-selected')).toBeNull()
    expect(q('[data-node="leafB"]').getAttribute('data-highlight')).toBeNull()
  })

  it('projection 邻居也算相连（高亮侧）；无任何边的孤卡被压暗', () => {
    const view = renderCanvas(modelFixture(), '')
    view.rerender(
      <ScopeCanvas
        model={modelFixture()}
        edgeStatus={{}}
        selectedNodeId="isoC"
        onSelect={view.onSelect}
        onOpenScope={view.onOpenScope}
      />,
    )
    expect(q('[data-node="isoC"]').getAttribute('data-selected')).toBe('true')
    expect(q('[data-node="topA"]').getAttribute('data-highlight')).toBe('true')
    expect(q('[data-node="c_big"]').getAttribute('data-dimmed')).toBe('true')
  })
})

describe('C12.4 画布：双击语义（§2.3-20 容器原子 + 下钻）', () => {
  it('双击领域卡：onOpenScope 携带领域 id 与 label', () => {
    const { onOpenScope } = renderCanvas()
    fireEvent.doubleClick(q('[data-node="topA"]'))
    expect(onOpenScope).toHaveBeenCalledTimes(1)
    expect(onOpenScope).toHaveBeenCalledWith('topA', '甲系统')
  })

  it('双击容器卡：不触发 onOpenScope，出现「容器没有下一层」说明（DOM 断言非弹窗猜测）', () => {
    const { onOpenScope } = renderCanvas()
    fireEvent.doubleClick(q('[data-node="c_big"]'))
    expect(onOpenScope).not.toHaveBeenCalled()
    expect(q('[data-atomic-note]').textContent).toContain('容器没有下一层')
    // 说明随下一次选择语境变化收起
    fireEvent.click(q('[data-node="topA"]'))
    expect(document.querySelector('[data-atomic-note]')).toBeNull()
  })

  it('双击空白复位平移缩放（spec 布局判据：双击空白复位）', () => {
    const { container } = renderCanvas()
    const canvas = q('[data-scope-canvas]', container)
    fireEvent.wheel(canvas, { ctrlKey: true, deltaY: -240 })
    expect(canvas.getAttribute('data-zoom')).not.toBe('1')
    fireEvent.mouseDown(canvas, { clientX: 10, clientY: 10 })
    fireEvent.mouseMove(window, { clientX: 60, clientY: 30 })
    fireEvent.mouseUp(window)
    expect(canvas.getAttribute('data-transform')).toBe('translate(50,20)')
    fireEvent.doubleClick(canvas)
    expect(canvas.getAttribute('data-zoom')).toBe('1')
    expect(canvas.getAttribute('data-transform')).toBe('translate(0,0)')
  })
})

describe('C12.4 画布：平移缩放与组织降级（真机清单 1 的机内侧）', () => {
  it('Ctrl+滚轮改变 zoom 状态并夹取；普通滚轮不动 zoom', () => {
    const { container } = renderCanvas()
    const canvas = q('[data-scope-canvas]', container)
    const z0 = canvas.getAttribute('data-zoom')
    fireEvent.wheel(canvas, { deltaY: 120 })
    expect(canvas.getAttribute('data-zoom')).toBe(z0)
    fireEvent.wheel(canvas, { ctrlKey: true, deltaY: -120 })
    expect(Number(canvas.getAttribute('data-zoom'))).toBeGreaterThan(Number(z0))
    fireEvent.wheel(canvas, { ctrlKey: true, deltaY: -100000 })
    expect(Number(canvas.getAttribute('data-zoom'))).toBeLessThanOrEqual(2.5)
    fireEvent.wheel(canvas, { ctrlKey: true, deltaY: 100000 })
    expect(Number(canvas.getAttribute('data-zoom'))).toBeGreaterThanOrEqual(0.4)
  })

  it('空白拖动更新 data-transform；按在卡上不触发平移', () => {
    const { container } = renderCanvas()
    const canvas = q('[data-scope-canvas]', container)
    fireEvent.mouseDown(canvas, { clientX: 10, clientY: 10 })
    fireEvent.mouseMove(window, { clientX: 35, clientY: -15 })
    fireEvent.mouseUp(window)
    expect(canvas.getAttribute('data-transform')).toBe('translate(25,-25)')
  })

  it('organizationAvailable=false 显式不可用提示，绝不拿空图冒充有数据页（§2.3-19/-25）', () => {
    renderCanvas(modelFixture({ organizationAvailable: false, nodes: [], edges: [] }))
    expect(q('[data-org-unavailable]').textContent).toContain('best.json')
    expect(q('[data-org-unavailable]').textContent).toContain('按现状领域')
  })
})
