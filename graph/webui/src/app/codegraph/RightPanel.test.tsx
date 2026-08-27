import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { ScopePageModel } from './scopepage'
import { RightPanel } from './RightPanel'

const model: ScopePageModel = {
  scopeId: 'svc', organization: 'current', organizationAvailable: true,
  nodes: [{
    id: 'methods', kind: 'container', label: '方法', type: '类型方法', isolated: false,
    childCount: 0, containerCount: 1, symbolCount: 2, fileCount: 1, oversized: false, dir: 'svc',
    ports: [], entries: [{ id: 'e_cli', name: 'CLI run', channel: 'cli' }],
    responsibility: { state: 'no-subject' }, entryDispersion: null, invariants: null, debt: null,
  }],
  edges: [],
  inboundSeams: [
    { nodeId: 'm_run', name: 'Runner.Run', containerId: 'methods', containerLabel: '方法', containerKind: '类型方法', kindClass: 'real-kernel', reuse: 1, folded: false, callerDomains: ['api'] },
    { nodeId: 'm_noise', name: 'Noise.Run', containerId: 'methods', containerLabel: '方法', containerKind: '函数组', kindClass: 'fallback', reuse: 10, folded: true, callerDomains: ['api'] },
  ],
  externalOut: [],
  empty: { noDeclaration: false, noEntities: false, noInboundSeams: false },
}

function renderPanel() {
  const onOpenSubject = vi.fn()
  const onHighlightEntry = vi.fn()
  const view = render(<RightPanel {...{ model, selectedNodeId: 'methods', onOpenSubject, onHighlightEntry }} />)
  return { ...view, onOpenSubject, onHighlightEntry }
}

describe('C17 RightPanel：入缝可开、程序入口只读', () => {
  it('inboundSeamOpensMethodSubjectAndFoldedSeamNeedsExpansion', () => {
    const { onOpenSubject } = renderPanel()
    fireEvent.click(screen.getByRole('tab', { name: '对外面' }))
    fireEvent.click(screen.getByRole('button', { name: /Runner\.Run/ }))
    expect(onOpenSubject).toHaveBeenCalledWith('m_run')
    expect(screen.queryByRole('button', { name: 'Noise.Run' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /已折叠/ }))
    fireEvent.click(screen.getByRole('button', { name: /Noise\.Run/ }))
    expect(onOpenSubject).toHaveBeenLastCalledWith('m_noise')
  })

  it('entryButtonsHighlightOnlyAndCopyDistinguishesSeamsFromChannels', () => {
    const { onOpenSubject, onHighlightEntry } = renderPanel()
    expect(screen.getByRole('tab', { name: '基本信息' })).toBeTruthy()
    expect(screen.queryByText(/每个通道一张主图/)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'CLI run' }))
    expect(onOpenSubject).not.toHaveBeenCalled()
    expect(onHighlightEntry).toHaveBeenCalledWith('e_cli')
    fireEvent.click(screen.getByRole('tab', { name: '对外面' }))
    expect(screen.getByText(/对外入缝/)).toBeTruthy()
    expect(screen.getByText(/到达通道/)).toBeTruthy()
  })
})
