import { fireEvent, render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { CgCheckReport, CgTarget } from '../../api/types'
import type { BestScopeEdge, MigrationGroup } from './besttree'
import { BestEdgeDetail, DebtBanner, MigrationSidebar } from './BestOverlays'

const target: CgTarget = {
  meta: { version: 3, project: 'demo' },
  contracts: [
    { from: 'ss_api', to: 'ss_store', entries: ['read'], legacyBudget: 2 },
    { from: 'ss_store', to: 'ss_api', entries: [], legacyBudget: 0 },
  ],
}
const report: CgCheckReport = {
  fails: [],
  warns: [],
  legacyHits: { 'ss_api->ss_store': 3, 'ss_store->ss_api': 0 },
}
const groups: MigrationGroup[] = [{
  expectedDomainId: 'api_read', expectedDomainLabel: '读取领域', count: 1,
  items: [{
    containerId: 'c_api', containerLabel: 'API 容器', currentDomainId: 'old', currentDomainLabel: '旧域',
    expectedDomainId: 'api_read', expectedDomainLabel: '读取领域', expectedSubsystemId: 'ss_api',
  }],
}]
const edge: BestScopeEdge = {
  key: 'ss_api->ss_store', from: 'ss_api', to: 'ss_store', directCalls: 3,
  directions: ['ss_api->ss_store', 'ss_store->ss_api'],
}

describe('C1.9 best overlays', () => {
  it('债务横幅明确无数据与 target 缺席的窄缝占位', () => {
    const { container, rerender } = render(<DebtBanner readout={{
      fails: 1, directCalls: 3, coveredDirections: 1, totalDirections: 2,
      misplaced: 2, bidirectionalPairs: 1, targetAvailable: true,
    }} />)
    expect(container.querySelector('[data-debt="fails"]')?.textContent).toBe('fails 1')
    expect(container.querySelector('[data-debt="coverage"]')?.textContent).toBe('窄缝覆盖 1/2')
    rerender(<DebtBanner readout={{
      fails: 0, directCalls: 3, coveredDirections: 0, totalDirections: 0,
      misplaced: 2, bidirectionalPairs: 0, targetAvailable: false,
    }} />)
    expect(container.querySelector('[data-debt="coverage"]')?.textContent).toBe('窄缝覆盖 —')
    rerender(<DebtBanner readout={null} />)
    expect(container.querySelector('[data-debt="none"]')?.textContent).toContain('无数据')
  })

  it('迁移侧栏分组计数、空态与点击回调稳定', () => {
    const onSelectContainer = vi.fn()
    const { container, rerender } = render(<MigrationSidebar groups={groups} selectedContainer="c_api"
      onSelectContainer={onSelectContainer} />)
    expect(container.querySelector('[data-migration-group]')?.textContent).toContain('读取领域 1')
    expect(container.querySelector('[data-migration-item="c_api"]')?.textContent)
      .toContain('API 容器 · 现在在 旧域 → 应归 读取领域')
    expect(container.querySelector('[data-migration-item="c_api"]')?.getAttribute('data-selected')).toBe('true')
    fireEvent.click(container.querySelector('[data-migration-item="c_api"]')!)
    expect(onSelectContainer).toHaveBeenCalledWith(groups[0].items[0])
    rerender(<MigrationSidebar groups={[]} selectedContainer="" onSelectContainer={onSelectContainer} />)
    expect(container.querySelector('[data-migration-none]')?.textContent).toBe('无待迁移件')
  })

  it('方向明细显示窄缝、零值预算和双向对端，空边有稳定提示', () => {
    const { container, rerender } = render(<BestEdgeDetail edge={edge} target={target} report={report} />)
    expect(container.querySelector('[data-best-edge-detail]')?.textContent).toContain('实测 3')
    expect(container.querySelector('[data-best-edge-detail]')?.textContent).toContain('窄缝 read')
    expect(container.querySelector('[data-best-edge-detail]')?.textContent).toContain('预算 0')
    expect(container.querySelector('[data-best-edge-detail]')?.textContent).toContain('双向对端：ss_store->ss_api')
    rerender(<BestEdgeDetail edge={null} />)
    expect(container.querySelector('[data-best-edge-detail]')?.textContent)
      .toContain('选择一条边查看方向明细')
  })
})
