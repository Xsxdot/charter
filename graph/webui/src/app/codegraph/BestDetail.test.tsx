import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { CgBest, CgCheckReport, CgGraph } from '../../api/types'
import { BestDetail } from './BestDetail'

const best: CgBest = {
  meta: { version: 1, project: 'demo' },
  domains: {
    s_api: { label: 'API', responsibility: '对外服务', type: 'boundary' },
    s_api_read: { label: '读取', responsibility: '查询', parent: 's_api' },
    s_api_read_detail: { label: '详情', responsibility: '查询详情', parent: 's_api_read' },
    s_store: { label: '存储', responsibility: '持久化', type: 'logic' },
  },
  containers: { c_in: 's_api_read', c_out: 's_store' },
}
const baseline: CgGraph = {
  meta: { project: 'demo', branch: 'main', commit: 'abc', scannedAt: 'today', generator: 'test' },
  domains: {
    s_api: { label: '现状 API', kind: '服务' },
    s_api_inner: { label: '现状 API 内部', kind: '服务', parent: 's_api' },
    s_store: { label: '现状存储', kind: '存储' },
  },
  containers: {
    c_in: { label: '输入容器', kind: '服务', domain: 's_store' },
    c_out: { label: '输出容器', kind: '服务', domain: 's_api_inner' },
  },
  nodes: {},
  edges: [],
}
const report: CgCheckReport = {
  fails: [],
  warns: [
    { kind: 'container-misplaced', from: 'c_in', detail: '错位' },
    { kind: 'container-misplaced', from: 'c_out', detail: '错位' },
  ],
}

describe('BestDetail', () => {
  it('显示嵌套子领域与 best 归属容器清单', () => {
    render(<BestDetail best={best} baseline={baseline} report={report} subsystemId="s_api" />)
    expect(screen.getByText('API · 读取 · 详情')).toBeTruthy()
    expect(screen.getByText('输入容器')).toBeTruthy()
    expect(screen.getByText('读取')).toBeTruthy()
    expect(document.querySelectorAll('[data-best-domain]').length).toBe(2)
    expect(document.querySelector('[data-best-container="c_in"]')).toBeTruthy()
  })

  it('misplaced 双向都列出现在位置与应然位置', () => {
    const { container } = render(<BestDetail best={best} baseline={baseline} report={report} subsystemId="s_api" />)
    const rows = [...container.querySelectorAll('[data-best-misplaced-item]')].map((row) => row.textContent)
    expect(rows).toContain('c_in现在在 现状存储 · 应归 读取')
    expect(rows).toContain('c_out现在在 现状 API 内部 · 应归 存储')
  })

  it('未选择子系统时渲染稳定空壳', () => {
    const { container } = render(<BestDetail best={best} baseline={baseline} subsystemId="" />)
    expect(container.querySelector('[data-best-detail]')).toBeTruthy()
  })
})
