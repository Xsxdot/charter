import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CodegraphPage } from './CodegraphPage'

const jsonResponse = (value: unknown) => new Response(JSON.stringify(value), { status: 200, headers: { 'Content-Type': 'application/json' } })

function wireWorld(withFlows: boolean): Record<string, unknown> {
  return {
    baseline: {
      meta: { project: 'c17', branch: 'main', commit: 'c', scannedAt: 'now', generator: 'test' },
      domains: { api: { label: 'API', kind: 'boundary' }, svc: { label: '服务', kind: 'logic' } },
      containers: { entries: { label: '入口', kind: '入口', domain: 'api' }, methods: { label: '方法', kind: '类型方法', domain: 'svc' } },
      nodes: {
        e_cli: { kind: 'entry', container: 'entries', name: 'CLI', file: 'cmd.go', line: 1, channel: 'cli' },
        m_run: { kind: 'func', container: 'methods', name: 'Runner.Run', file: 'run.go', line: 0 },
      },
      edges: [['e_cli', 'm_run']],
      ...(withFlows ? { flows: { m_run: { steps: [{ id: 'return', order: 1, kind: 'return', line: 0 }] } } } : {}),
    },
    views: {}, stale: [],
  }
}

function openWireMethod(container: HTMLElement) {
  fireEvent.doubleClick(container.querySelector('[data-node="svc"]')!)
  fireEvent.click(container.querySelector('[data-node="methods"]')!)
  fireEvent.click(screen.getByRole('tab', { name: '对外面' }))
  fireEvent.click(screen.getByRole('button', { name: /Runner\.Run/ }))
}

beforeEach(() => {
  window.history.replaceState({}, '', '/?project=c17')
  vi.unstubAllGlobals()
})

describe('C17 Response JSON → CgGraph → deriveFlowPage → DOM', () => {
  it('flowsAndZeroLineSurviveTheRealResponseBoundary', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(wireWorld(true)))
    vi.stubGlobal('fetch', fetchMock)
    const { container } = render(<CodegraphPage />)
    await waitFor(() => expect(container.querySelector('[data-two-axis-page]')).toBeTruthy())
    openWireMethod(container)
    await waitFor(() => expect(container.querySelector('[data-flow-page]')).toBeTruthy())
    expect(container.querySelector('[data-flow-page]')?.getAttribute('data-degraded')).toBe('false')
    expect(container.querySelector('[data-flow-page]')?.getAttribute('data-current-subject')).toBe('m_run')
    expect(container.querySelector('[data-subject-line="0"]')).toBeTruthy()
    expect(container.querySelector('[data-step-line="0"]')).toBeTruthy()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('missingFlowsIsDegradedNotTransportFailure', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(wireWorld(false)))
    vi.stubGlobal('fetch', fetchMock)
    const { container } = render(<CodegraphPage />)
    await waitFor(() => expect(container.querySelector('[data-two-axis-page]')).toBeTruthy())
    openWireMethod(container)
    await waitFor(() => expect(container.querySelector('[data-flow-degraded]')).toBeTruthy())
    expect(container.querySelector('[data-flow-page]')?.getAttribute('data-degraded')).toBe('true')
    expect(container.querySelector('[data-flow-chart]')).toBeNull()
    expect(screen.queryByText('取代码图失败')).toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
