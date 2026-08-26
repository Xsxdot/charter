import { fireEvent, render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { MigrationGroup } from './besttree'
import { MigrationDrawer } from './MigrationDrawer'

// 夹具纪律：MigrationGroup 字面量直造；期望硬编码。
function q<T extends Element = HTMLElement>(selector: string, root: ParentNode = document): T {
  const el = root.querySelector(selector)
  if (!el) throw new Error(`element not found: ${selector}`)
  return el as T
}

const groups: MigrationGroup[] = [
  {
    expectedDomainId: 'd_target',
    expectedDomainLabel: '目标域',
    count: 2,
    items: [
      {
        containerId: 'c_one',
        containerLabel: '容器一',
        currentDomainId: 'd_now_a',
        currentDomainLabel: '现状甲',
        expectedDomainId: 'd_target',
        expectedDomainLabel: '目标域',
        expectedSubsystemId: 'd_target',
      },
      {
        containerId: 'c_two',
        containerLabel: '容器二',
        currentDomainId: 'd_now_b',
        currentDomainLabel: '现状乙',
        expectedDomainId: 'd_target',
        expectedDomainLabel: '目标域',
        expectedSubsystemId: 'd_target',
      },
    ],
  },
]

function renderDrawer(groupsProp = groups, open = false) {
  const onToggle = vi.fn()
  const onSelectContainer = vi.fn()
  const view = render(
    <MigrationDrawer groups={groupsProp} open={open} onToggle={onToggle}
      selectedContainer="" onSelectContainer={onSelectContainer} />,
  )
  return { ...view, onToggle, onSelectContainer }
}

describe('C12.4 迁移抽屉（§2.5-39①）', () => {
  it('默认收起：触发钮在场且 aria-expanded=false，抽屉体不在 DOM', () => {
    renderDrawer(groups, false)
    expect(q('[data-migration-trigger]').getAttribute('aria-expanded')).toBe('false')
    expect(document.querySelector('[data-migration-drawer]')).toBeNull()
  })

  it('触发钮带计数徽标＝各组 count 之和（2+1=3 硬编码）', () => {
    renderDrawer([...groups, { ...groups[0], expectedDomainId: 'd_other', expectedDomainLabel: '其他域', count: 1, items: [groups[0].items[0]!] }])
    expect(q('[data-migration-count]').textContent).toBe('3')
  })

  it('点触发钮回调 onToggle；open 时按组渲染条目，点击条目回调原始 MigrationItem 并高亮选中', () => {
    const view = renderDrawer(groups, false)
    fireEvent.click(q('[data-migration-trigger]'))
    expect(view.onToggle).toHaveBeenCalledTimes(1)

    view.unmount()
    const openView = renderDrawer(groups, true)
    expect(openView.onToggle).toHaveBeenCalledTimes(0)
    expect(q('[data-migration-drawer]')).toBeTruthy()
    expect(q('[data-migration-group="d_target"]').textContent).toContain('目标域 · 2')
    fireEvent.click(q('[data-migration-item="c_two"]'))
    expect(openView.onSelectContainer).toHaveBeenCalledWith(groups[0].items[1])
    // 选中反馈：受控 selectedContainer 重渲染后带 data-selected
    openView.rerender(
      <MigrationDrawer groups={groups} open onToggle={openView.onToggle}
        selectedContainer="c_two" onSelectContainer={openView.onSelectContainer} />,
    )
    expect(q('[data-migration-item="c_two"]').getAttribute('data-selected')).toBe('true')
  })

  it('空清单：徽标为 0，展开显示「无待迁移件」而非空面板', () => {
    renderDrawer([], true)
    expect(q('[data-migration-count]').textContent).toBe('0')
    expect(q('[data-migration-none]').textContent).toContain('无待迁移件')
  })
})
