import { fireEvent, render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { CgBest, CgCheckReport, CgTarget } from '../../api/types'
import type { MigrationItem } from './besttree'
import { BestScopePanorama } from './BestScopePanorama'

const best: CgBest = {
  meta: { version: 1, project: 'demo' },
  domains: {
    ss_api: { label: 'API 子系统', responsibility: '服务', type: 'boundary' },
    api_read: { label: '读取领域', responsibility: '查询', parent: 'ss_api' },
    api_read_detail: { label: '读取详情', responsibility: '详情', parent: 'api_read' },
    ss_store: { label: '存储子系统', responsibility: '存储', type: 'logic' },
  },
  containers: { c_api: 'api_read' },
}
const nestedTarget: CgTarget = {
  meta: { version: 3, project: 'demo' },
  contracts: [
    { from: 'api_read', to: 'api_read_detail', entries: ['detail'] },
    { from: 'api_read', to: 'ss_store', entries: ['store'] },
  ],
}
const report: CgCheckReport = { fails: [], warns: [], legacyHits: {} }
const item: MigrationItem = {
  containerId: 'c_api', containerLabel: 'API 容器', currentDomainId: 'old', currentDomainLabel: '现状旧域',
  expectedDomainId: 'api_read', expectedDomainLabel: '读取领域', expectedSubsystemId: 'ss_api',
}

describe('BestScopePanorama', () => {
  it('嵌套页保持同构：直接子领域实卡、圈外虚线卡、迁移托盘和横跳', () => {
    const onEnter = vi.fn()
    const onSelectMigration = vi.fn()
    const { container } = render(<BestScopePanorama best={best} target={nestedTarget} report={report}
      scopeId="ss_api" selectedDomain="" selectedEdge="" migrationItems={[item]}
      onSelectDomain={vi.fn()} onSelectEdge={vi.fn()} onEnter={onEnter} onSelectMigration={onSelectMigration} />)
    expect(container.querySelector('[data-best-scope-card="api_read"]')).toBeTruthy()
    expect(container.querySelector('[data-best-scope-card="ext:ss_store"][data-external="true"]')).toBeTruthy()
    expect(container.querySelector('[data-best-scope-edge="api_read->ext:ss_store"]')).toBeTruthy()
    expect(container.querySelector('[data-unplaced-tray]')).toBeTruthy()
    expect(container.querySelector('[data-migration-arrow][data-expected="api_read"]')).toBeTruthy()
    fireEvent.click(container.querySelector('[data-best-scope-card="api_read"]')!)
    expect(onEnter).toHaveBeenCalledWith('api_read')
    fireEvent.click(container.querySelector('[data-best-scope-card="ext:ss_store"]')!)
    expect(onEnter).toHaveBeenCalledWith('ss_store')
    fireEvent.click(container.querySelector('[data-migration-item="c_api"]')!)
    expect(onSelectMigration).toHaveBeenCalledWith(item)
  })
})
