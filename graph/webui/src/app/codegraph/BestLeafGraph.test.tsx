import { fireEvent, render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { CgBest, CgCheckReport, CgGraph } from '../../api/types'
import type { MigrationItem } from './besttree'
import { BestLeafGraph } from './BestLeafGraph'

const best: CgBest = {
  meta: { version: 1, project: 'demo' },
  domains: {
    ss_api: { label: 'API', responsibility: '服务' },
    api_read: { label: '读取', responsibility: '查询', parent: 'ss_api' },
    api_read_detail: { label: '详情', responsibility: '详情查询', parent: 'api_read' },
  },
  containers: { c_api: 'api_read', c_api_detail: 'api_read_detail' },
}
const baseline: CgGraph = {
  meta: { project: 'demo', branch: 'main', commit: 'abc', scannedAt: 'today', generator: 'test' },
  domains: { old: { label: '旧域', kind: 'logic' } },
  containers: {
    c_api: { label: 'API 容器', kind: 'service', domain: 'old' },
    c_api_detail: { label: '详情容器', kind: 'service', domain: 'old' },
  },
  nodes: {
    n_api: { kind: 'func', container: 'c_api', name: 'Api', file: 'internal/api/api.ts', line: 1 },
    n_detail: { kind: 'func', container: 'c_api_detail', name: 'Detail', file: 'internal/api/detail/detail.ts', line: 2 },
  },
  edges: [],
}
const report: CgCheckReport = { fails: [], warns: [], legacyHits: {} }
const item: MigrationItem = {
  containerId: 'c_api', containerLabel: 'API 容器', currentDomainId: 'old', currentDomainLabel: '旧域',
  expectedDomainId: 'api_read_detail', expectedDomainLabel: '详情', expectedSubsystemId: 'ss_api',
}

describe('BestLeafGraph', () => {
  it('叶子图按包分组显示节点数，错位容器显示幽灵待迁入标', () => {
    const onSelectContainer = vi.fn()
    const { container } = render(<BestLeafGraph best={best} baseline={baseline} report={report}
      scopeId="api_read_detail" selectedContainer="c_api" migrationItems={[item]} onSelectContainer={onSelectContainer} />)
    expect(container.querySelector('[data-best-leaf]')).toBeTruthy()
    expect(container.querySelector('[data-best-leaf-package="internal/api/detail"]')).toBeTruthy()
    expect(container.querySelector('[data-best-leaf-container="c_api"][data-ghost-container="true"]')).toBeTruthy()
    expect(container.querySelector('[data-best-leaf-container="c_api"]')?.textContent).toContain('1 节点')
    fireEvent.click(container.querySelector('[data-best-leaf-container="c_api"]')!)
    expect(onSelectContainer).toHaveBeenCalledWith('c_api')
  })
})
