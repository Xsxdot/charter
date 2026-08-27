import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CodegraphPage } from './CodegraphPage'

// 穿线回归（breakdown K6 序列化边界族）：真实 Response JSON 解析 → types →
// 缝 1 / 缝 2 派生 → 两轴 DOM，全链一次走通。与 CodegraphPage.test.tsx 的差别：
// 本文件不 mock useCodegraph，fetch 层喂真实 Response——序列化边界上的
// 「字段缺失 ≠ 值为零」由这条链负责，分段断言替代不了它。

const jsonResponse = (value: unknown) => new Response(JSON.stringify(value), { status: 200, headers: { 'Content-Type': 'application/json' } })

function wireWorld(withFlows: boolean): Record<string, unknown> {
  return {
    // futureKey：parseResponse 直接 as T 无运行时校验（contract §3-4），未知键容忍是既有设计
    futureKey: { anything: true },
    baseline: {
      meta: { project: 'demo', branch: 'main', commit: 'abc', scannedAt: '2026-08-21', generator: 'test' },
      domains: {
        d_cli: { label: 'cli', kind: '命令层', summary: '命令入口' },
        d_svc: { label: 'svc', kind: '服务端', summary: '服务与实体' },
        'd_svc/api': { label: 'api', kind: '服务端', summary: '对外方法', parent: 'd_svc' },
      },
      containers: {
        c_cli: { label: 'CLI 命令', kind: '入口', entry: true, domain: 'd_cli' },
        k_svc: { label: 'svc.Server', kind: '类型方法', domain: 'd_svc/api' },
      },
      nodes: {
        e_run: { kind: 'entry', container: 'c_cli', name: 'demo run', file: 'cmd/run.go', line: 3 },
        n_runE: { kind: 'func', container: 'k_svc', name: 'runE', file: 'cmd/run.go', line: 5 },
      },
      edges: [['e_run', 'n_runE']],
      ...(withFlows ? { flows: { e_run: { steps: [{ id: 's1', order: 1, kind: 'call', to: 'n_runE', line: 9 }] } } } : {}),
    },
    views: {},
    stale: [],
    best: {
      meta: { version: 1, project: 'demo' },
      domains: {
        s_api: { label: 'API 子系统', type: 'boundary' },
        s_store: { label: '存储子系统', type: 'logic' },
      },
      containers: { c_cli: 's_api', k_svc: 's_store' },
    },
  }
}

beforeEach(() => {
  window.history.replaceState({}, '', '/?project=demo')
  vi.restoreAllMocks()
})

describe('CodegraphPage 穿线回归：wire JSON → 模型 → 两轴 DOM 全链一次', () => {
  it('真实 Response 解析后两轴可用；点入口进流程图，泳道标题显示 wire 节点名（entryName 全链）', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    fetchMock.mockResolvedValue(jsonResponse(wireWorld(true)))
    const { container } = render(<CodegraphPage />)

    await waitFor(() => expect(container.querySelector('[data-two-axis-page]')).toBeTruthy())
    // 默认组织＝最优树（best 在场）：先验 best 卡真从 wire 渲染，再切现状组织走入口链
    await waitFor(() => expect(container.querySelector('[data-node="s_api"]')?.textContent).toContain('API 子系统'))
    expect(fetchMock).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: '按现状领域' }))
    await waitFor(() => expect(container.querySelector('[data-node="d_cli"]')).toBeTruthy())

    fireEvent.click(container.querySelector('[data-node="d_cli"]')!)
    await waitFor(() => expect(container.querySelector('[data-entry="e_run"]')).toBeTruthy())
    fireEvent.click(container.querySelector('[data-entry="e_run"]')!)
    await waitFor(() => expect(container.querySelector('[data-flow-chart]')).toBeTruthy())
    // nodes[].name 经 wire 解析进模型 entryName 再上标题：缺失与零值可辨的链路由本断言锁住
    expect(container.querySelector('[data-flow-page]')?.getAttribute('data-degraded')).toBe('false')
    expect(container.querySelector('[data-lane-title]')?.textContent).toContain('demo run')
    expect(screen.queryByText('取代码图失败')).toBeNull()
  })

  it('flows 键整体缺席的 wire：结构轴照常渲染，行为轴显式降级而非传输失败', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    fetchMock.mockResolvedValue(jsonResponse(wireWorld(false)))
    const { container } = render(<CodegraphPage />)

    await waitFor(() => expect(container.querySelector('[data-two-axis-page]')).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: '按现状领域' }))
    await waitFor(() => expect(container.querySelector('[data-node="d_cli"]')).toBeTruthy())
    fireEvent.click(container.querySelector('[data-node="d_cli"]')!)
    await waitFor(() => expect(container.querySelector('[data-entry="e_run"]')).toBeTruthy())
    fireEvent.click(container.querySelector('[data-entry="e_run"]')!)
    await waitFor(() => expect(container.querySelector('[data-flow-degraded]')).toBeTruthy())
    expect(container.querySelector('[data-flow-page]')?.getAttribute('data-degraded')).toBe('true')
    expect(document.querySelector('[data-flow-chart]')).toBeNull()
    expect(screen.queryByText('取代码图失败')).toBeNull()
  })
})
