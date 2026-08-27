import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CodegraphResp } from '../../api/types'
import { CodegraphPage } from './CodegraphPage'

const response: CodegraphResp = {
  baseline: {
    meta: { project: 'demo', branch: 'main', commit: 'abc', scannedAt: '', generator: 'test' },
    domains: { api: { label: 'API', kind: 'boundary' }, store: { label: '存储', kind: 'logic' } },
    containers: { c_api: { label: 'API', kind: '入口', domain: 'api', entry: true }, c_store: { label: 'Store', kind: '实体', domain: 'store' } },
    nodes: { entry: { kind: 'entry', container: 'c_api', name: 'demo task list', file: 'cmd/main.go', line: 1, channel: 'cli' }, store: { kind: 'model', container: 'c_store', name: 'Task', file: 'store/task.go', line: 1, modelKind: 'entity' } },
    edges: [['entry', 'store']],
  },
  views: {}, stale: [],
}

vi.mock('./useCodegraph', () => ({ useCodegraph: () => ({ data: response, error: '', loading: false, reload: vi.fn() }) }))

describe('CodegraphPage', () => {
  beforeEach(() => { window.history.replaceState({}, '', '/?project=demo') })

  it('一次取数后默认显示结构轴根层', async () => {
    const { container } = render(<CodegraphPage />)
    await waitFor(() => expect(container.querySelector('[data-two-axis-page]')).toBeTruthy())
    expect(screen.getByText('结构轴')).toBeTruthy()
    expect(screen.getByText('API')).toBeTruthy()
    expect(screen.getByText('存储')).toBeTruthy()
  })

  it('双击领域进入下一层，双击容器只显示原子节点说明', async () => {
    const { container } = render(<CodegraphPage />)
    await waitFor(() => expect(container.querySelector('[data-scope-node="store"]')).toBeTruthy())
    fireEvent.doubleClick(container.querySelector('[data-scope-node="store"]')!)
    expect(container.querySelector('[data-scope-node="c_store"]')).toBeTruthy()
    fireEvent.doubleClick(container.querySelector('[data-scope-node="c_store"]')!)
    expect(screen.getByText(/容器没有下一层/)).toBeTruthy()
  })

  it('从右栏程序入口进入降级行为轴', async () => {
    const { container } = render(<CodegraphPage />)
    await waitFor(() => expect(container.querySelector('[data-scope-node="api"]')).toBeTruthy())
    fireEvent.click(container.querySelector('[data-program-entry="entry"]')!)
    expect(container.querySelector('[data-flow-page]')).toBeTruthy()
    expect(screen.getByText('流程图降级')).toBeTruthy()
  })
})
