import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CgGraph } from '../../api/types'
import type { DomainLane } from './domainpage'
import { DomainCascadeDrawer } from './DomainCascadeDrawer'
import { fetchCodegraphSource } from '../../api/client'

vi.mock('../../api/client', () => ({
  fetchCodegraphSource: vi.fn(),
}))

const sourceMock = vi.mocked(fetchCodegraphSource)

const baseline: CgGraph = {
  meta: { project: 'demo', branch: 'main', commit: 'abc', scannedAt: '', generator: 'test' },
  domains: {},
  containers: { c_target: { label: 'Target', kind: 'logic', domain: 'd_target' } },
  nodes: {
    focus: { kind: 'func', container: 'c_target', name: 'Focus', file: 'src/focus.go', line: 7 },
    shared: { kind: 'func', container: 'c_target', name: 'Shared', file: 'src/shared.go', line: 8 },
    deep: { kind: 'func', container: 'c_target', name: 'Deep', file: 'src/deep.go', line: 9 },
  },
  edges: [],
}

const lane: DomainLane = {
  key: 'd_source->d_target:source->focus:0',
  fromDomainId: 'd_source',
  focusNodeId: 'focus',
  columns: [
    { depth: 0, nodes: [{ id: 'focus', depth: 0, name: 'Focus', collapsed: false }], droppedNodes: 0, truncated: false, depthLimit: false },
    { depth: 1, nodes: [{ id: 'shared', depth: 1, name: 'Shared', collapsed: true, collapseReason: 'shared-by-domains' }], droppedNodes: 1, truncated: true, depthLimit: false },
    { depth: 2, nodes: [{ id: 'deep', depth: 2, name: 'Deep', collapsed: false }], droppedNodes: 0, truncated: false, depthLimit: false },
    { depth: 3, nodes: [], droppedNodes: 0, truncated: false, depthLimit: true },
  ],
}

function renderDrawer(selectedNodeId = '', onSelectNode = vi.fn()) {
  return render(<DomainCascadeDrawer
    project="demo"
    baseline={baseline}
    lane={lane}
    selectedNodeId={selectedNodeId}
    onSelectNode={onSelectNode}
  />)
}

describe('DomainCascadeDrawer', () => {
  beforeEach(() => {
    sourceMock.mockReset()
  })

  it('renders four columns, visible collapse/truncation markers, and selection callbacks', () => {
    const onSelectNode = vi.fn()
    renderDrawer('', onSelectNode)
    expect(screen.getAllByTestId(/cascade-column-/)).toHaveLength(4)
    expect(screen.getByText(/共享工具，已收桩/)).toBeTruthy()
    expect(screen.getByText(/本级已截断，丢弃 1 个节点/)).toBeTruthy()
    expect(screen.getByText(/再深是 CLI 的活/)).toBeTruthy()
    expect(screen.getByText('codegraph chain --with-source')).toBeTruthy()
    fireEvent.click(screen.getByTestId('cascade-node-focus'))
    expect(onSelectNode).toHaveBeenCalledWith('focus')
  })

  it('reads source through the existing client with span 40 and displays success', async () => {
    sourceMock.mockResolvedValue({ file: 'src/focus.go', from: 7, lines: ['func Focus() {}'] })
    const { rerender } = renderDrawer()
    rerender(<DomainCascadeDrawer project="demo" baseline={baseline} lane={lane} selectedNodeId="focus" onSelectNode={vi.fn()} />)
    await waitFor(() => expect(sourceMock).toHaveBeenCalledWith('demo', 'src/focus.go', 7, 40))
    expect(await screen.findByTestId('source-window')).toHaveTextContent('func Focus() {}')
  })

  it('shows source failure and never renders stale success content', async () => {
    sourceMock.mockRejectedValue(new Error('source unavailable'))
    renderDrawer('focus')
    expect(await screen.findByTestId('source-error')).toHaveTextContent('source unavailable')
    expect(screen.queryByTestId('source-window')).toBeNull()
  })

  it('renders nothing without a selected lane', () => {
    const { container } = render(<DomainCascadeDrawer project="demo" baseline={baseline} lane={null} selectedNodeId="" onSelectNode={vi.fn()} />)
    expect(container.firstChild).toBeNull()
  })
})
