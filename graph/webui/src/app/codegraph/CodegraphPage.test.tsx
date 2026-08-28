import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CodegraphResp } from '../../api/types'
import { CodegraphPage } from './CodegraphPage'

const state = vi.hoisted(() => ({ data: null as CodegraphResp | null, error: '', loading: false, requests: 0 }))

const response: CodegraphResp = {
  baseline: {
    meta: { project: 'c17', branch: 'main', commit: 'c', scannedAt: 'now', generator: 'test' },
    domains: { api: { label: 'API', kind: 'boundary' }, svc: { label: '服务', kind: 'logic' } },
    containers: { entries: { label: '入口', kind: '入口', domain: 'api' }, methods: { label: '方法', kind: '类型方法', domain: 'svc' } },
    nodes: {
      e: { kind: 'entry', container: 'entries', name: 'CLI', file: 'cmd.go', line: 1, channel: 'cli' },
      m: { kind: 'func', container: 'methods', name: 'Runner.Run', file: 'run.go', line: 0 },
    },
    edges: [['e', 'm']],
    flows: { m: { steps: [{ id: 'return', order: 1, kind: 'return', line: 0 }] } },
  },
  views: {}, stale: [],
}

vi.mock('./useCodegraph', () => ({
  useCodegraph: () => ({ data: state.data, error: state.error, loading: state.loading, reload: () => { state.requests += 1 } }),
}))

beforeEach(() => {
  window.history.replaceState({}, '', '/?project=c17')
  state.data = response
  state.error = ''
  state.loading = false
  state.requests = 0
})

function openMethod(container: HTMLElement) {
  fireEvent.doubleClick(container.querySelector('[data-node="svc"]')!)
  fireEvent.click(container.querySelector('[data-node="methods"]')!)
  fireEvent.click(screen.getByRole('tab', { name: '对外面' }))
  fireEvent.click(screen.getByRole('button', { name: /Runner\.Run/ }))
}

describe('C17 CodegraphPage：轴间装配与单一返回入口', () => {
  it('opensMethodSubjectAndReturnsToSameScope', async () => {
    const { container } = render(<CodegraphPage />)
    await waitFor(() => expect(container.querySelector('[data-two-axis-page]')).toBeTruthy())
    openMethod(container)
    await waitFor(() => expect(container.querySelector('[data-flow-page]')).toBeTruthy())
    expect(container.querySelector('[data-flow-page]')?.getAttribute('data-current-subject')).toBe('m')
    expect(container.querySelector('[data-flow-shell]')).toBeTruthy()
    expect(screen.queryByText(/程序入口流程图/)).toBeNull()
    expect(container.querySelectorAll('[data-flow-back]').length).toBe(1)
    fireEvent.click(container.querySelector('[data-flow-back]')!)
    expect(container.querySelector('[data-two-axis-page]')?.getAttribute('data-scope')).toBe('svc')
  })

  it('viewChangeClearsFlowStackWithoutRequest', async () => {
    const { container } = render(<CodegraphPage />)
    await waitFor(() => expect(container.querySelector('[data-two-axis-page]')).toBeTruthy())
    openMethod(container)
    await waitFor(() => expect(container.querySelector('[data-flow-page]')).toBeTruthy())
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'baseline' } })
    expect(container.querySelector('[data-flow-page]')).toBeNull()
    expect(state.requests).toBe(0)
  })
})
