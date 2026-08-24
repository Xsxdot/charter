import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { CgBest, CgCheckReport, CgTarget } from '../../api/types'
import { BestPanorama } from './BestPanorama'

const best: CgBest = {
  meta: { version: 1, project: 'demo' },
  domains: {
    ss_api: { label: 'API 子系统', responsibility: '对外服务', type: 'boundary' },
    api_read: { label: '读取领域', responsibility: '查询', parent: 'ss_api' },
    ss_store: { label: '存储子系统', responsibility: '持久化', type: 'logic' },
  },
  containers: { c_api: 'api_read', c_store: 'ss_store' },
}
const target: CgTarget = {
  meta: { version: 3, project: 'demo' },
  contracts: [{ from: 'ss_api', to: 'ss_store', legacyBudget: 1 }],
}
const report: CgCheckReport = {
  fails: [
    { kind: 'over-budget', from: 'ss_api', to: 'ss_store', detail: '超预算' },
    { kind: 'new-direction', from: 'ss_store', to: 'ss_api', detail: '未声明' },
  ],
  warns: [
    { kind: 'container-misplaced', from: 'c_api', detail: '放错位' },
    { kind: 'container-unplaced', from: 'c_missing', detail: '未归属' },
  ],
  legacyHits: { 'ss_api->ss_store': 2 },
}

describe('BestPanorama', () => {
  it('渲染理想树卡片、职责/类型、gap 读数和执法横幅', () => {
    const { container } = render(<BestPanorama best={best} target={target} report={report}
      selectedSubsystem="" selectedEdge="" onSelectSubsystem={vi.fn()} onSelectEdge={vi.fn()} />)
    expect(container.querySelectorAll('[data-best-subsystem]')).toHaveLength(2)
    expect(screen.getByText('对外服务')).toBeTruthy()
    expect(screen.getByText('boundary')).toBeTruthy()
    expect(container.querySelector('[data-gap="containers"]')?.textContent).toBe('归属容器 1')
    expect(container.querySelector('[data-gap="misplaced"]')?.textContent).toBe('放错位 1')
    expect(container.querySelector('[data-gap="subdomains"]')?.textContent).toBe('子领域 1')
    expect(screen.getByText('fails 2')).toBeTruthy()
    expect(container.querySelector('[data-debt="misplaced"]')?.textContent).toBe('放错位 1')
    expect(container.querySelector('[data-debt="coverage"]')?.textContent).toBe('窄缝覆盖 0/1')
  })

  it('用 DOM 标记区分超预算和未声明方向', () => {
    const { container } = render(<BestPanorama best={best} target={target} report={report}
      selectedSubsystem="" selectedEdge="" onSelectSubsystem={vi.fn()} onSelectEdge={vi.fn()} />)
    expect(container.querySelector('[data-direction-status="over-budget"]')).toBeTruthy()
    expect(container.querySelector('[data-direction-status="new-direction"]')).toBeTruthy()
    expect(screen.getByText(/欠 0 · 未声明/)).toBeTruthy()
  })

  it('best 存在但 report 缺席时仍画理想树，并显示无数据态', () => {
    const { container } = render(<BestPanorama best={best} target={target}
      selectedSubsystem="" selectedEdge="" onSelectSubsystem={vi.fn()} onSelectEdge={vi.fn()} />)
    expect(container.querySelectorAll('[data-best-subsystem]')).toHaveLength(2)
    expect(screen.getByText('无数据')).toBeTruthy()
    expect(container.querySelector('[data-debt="none"]')).toBeTruthy()
  })

  it('横幅显示欠账四件套，fails 置于最前且 report 缺席不是零', () => {
    const { container, rerender } = render(<BestPanorama best={best} target={target} report={report}
      selectedSubsystem="" selectedEdge="" onSelectSubsystem={vi.fn()} onSelectEdge={vi.fn()} />)
    expect(container.querySelector('[data-debt="fails"]')?.textContent).toBe('fails 2')
    expect(container.querySelector('[data-debt="directCalls"]')?.textContent).toBe('直调余额 2')
    expect(container.querySelector('[data-debt="coverage"]')?.textContent).toBe('窄缝覆盖 0/1')
    expect(container.querySelector('[data-debt="misplaced"]')?.textContent).toBe('放错位 1')
    expect(container.querySelector('[data-debt="bidirectional"]')?.textContent).toBe('双向环 0')
    rerender(<BestPanorama best={best} target={target} selectedSubsystem="" selectedEdge=""
      onSelectSubsystem={vi.fn()} onSelectEdge={vi.fn()} />)
    expect(container.querySelector('[data-debt="none"]')?.textContent).toContain('无数据')
    expect(container.querySelector('[data-debt="directCalls"]')).toBeNull()
  })

  it('边标签为欠账数、按债务级别着色，点击选择原始方向 key', () => {
    const onSelectEdge = vi.fn()
    const { container } = render(<BestPanorama best={best} target={target} report={report}
      selectedSubsystem="" selectedEdge="" onSelectSubsystem={vi.fn()} onSelectEdge={onSelectEdge} />)
    const edge = container.querySelector('[data-best-direction="ss_api->ss_store"]') as HTMLElement
    expect(edge.dataset.debt).toBe('2')
    expect(edge.textContent).toContain('欠 2')
    expect(edge.dataset.debtLevel).toMatch(/^(0|[1-9]|10)$/)
    fireEvent.click(edge)
    expect(onSelectEdge).toHaveBeenCalledWith('ss_api->ss_store')
  })
})
