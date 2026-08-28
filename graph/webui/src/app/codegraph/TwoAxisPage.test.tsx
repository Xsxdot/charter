import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { CgGraph } from '../../api/types'
import { TwoAxisPage } from './TwoAxisPage'

const baseline: CgGraph = {
  meta: { project: 'c17', branch: 'main', commit: 'c', scannedAt: 'now', generator: 'test' },
  domains: { api: { label: 'API', kind: 'boundary' }, svc: { label: '服务', kind: 'logic' } },
  containers: {
    entries: { label: '入口', kind: '入口', domain: 'api' },
    methods: { label: '方法', kind: '类型方法', domain: 'svc' },
  },
  nodes: {
    e: { kind: 'entry', container: 'entries', name: 'CLI run', file: 'cmd.go', line: 1, channel: 'cli' },
    m: { kind: 'func', container: 'methods', name: 'Runner.Run', file: 'run.go', line: 2 },
  },
  edges: [['e', 'm']],
}

function renderPage() {
  const onOpenSubject = vi.fn()
  const view = render(<TwoAxisPage {...{ baseline, onOpenSubject }} />)
  return { ...view, onOpenSubject }
}

describe('C17 TwoAxisPage：结构轴到方法行为轴的装配', () => {
  it('inboundSeamCarriesMethodAndOriginContext', () => {
    const { container, onOpenSubject } = renderPage()
    fireEvent.doubleClick(container.querySelector('[data-node="svc"]')!)
    fireEvent.click(container.querySelector('[data-node="methods"]')!)
    fireEvent.click(screen.getByRole('tab', { name: '对外面' }))
    fireEvent.click(screen.getByRole('button', { name: /Runner\.Run/ }))
    expect(onOpenSubject).toHaveBeenCalledWith({
      subjectId: 'm', originScopeId: 'svc', originScopeLabel: '服务', originOpenableSubjectIds: ['m'],
    })
  })

  it('entryCardRemainsReadOnlyWhenSelected', () => {
    const { container, onOpenSubject } = renderPage()
    fireEvent.doubleClick(container.querySelector('[data-node="api"]')!)
    fireEvent.click(container.querySelector('[data-node="entries"]')!)
    fireEvent.click(screen.getByRole('button', { name: 'CLI run' }))
    expect(onOpenSubject).not.toHaveBeenCalled()
    expect(container.querySelector('[data-entry="e"]')?.getAttribute('data-entry-active')).toBe('true')
  })
})
