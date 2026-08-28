import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { CgGraph } from '../../api/types'
import { FlowPageView } from './FlowPageView'

const baseline: CgGraph = {
  meta: { project: 'c17', branch: 'main', commit: 'c', scannedAt: 'now', generator: 'test' },
  domains: { api: { label: 'API', kind: 'boundary' }, svc: { label: '服务', kind: 'logic' } },
  containers: {
    entries: { label: '入口', kind: '入口', domain: 'api' },
    methods: { label: '方法', kind: '类型方法', domain: 'svc' },
  },
  nodes: {
    e: { kind: 'entry', container: 'entries', name: 'CLI', file: 'cmd.go', line: 1, channel: 'cli' },
    a: { kind: 'func', container: 'methods', name: 'A.Run', file: 'a.go', line: 2 },
    b: { kind: 'func', container: 'methods', name: 'B.Run', file: 'b.go', line: 3 },
    c: { kind: 'func', container: 'methods', name: 'C.Run', file: 'c.go', line: 4 },
    iface: { kind: 'func', container: 'methods', name: 'Store.Put', file: 'store.go', line: 5 },
    impl: { kind: 'func', container: 'methods', name: 'Memory.Put', file: 'memory.go', line: 6 },
  },
  edges: [['e', 'a'], ['a', 'b'], ['b', 'a'], ['c', 'a'], ['a', 'iface']],
  implements: [['impl', 'iface']],
  flows: {
    a: { steps: [{ id: 'a-to-b', order: 1, kind: 'call', to: 'b', line: 2 }] },
    b: { steps: [{ id: 'b-to-a', order: 1, kind: 'call', to: 'a', line: 3 }] },
    c: { steps: [{ id: 'c-return', order: 1, kind: 'return', line: 4 }] },
  },
}

function renderView(overrides: Record<string, unknown> = {}) {
  const onBackToStructure = vi.fn()
  const view = render(<FlowPageView {...{
    baseline,
    initial: { subjectId: 'a', originScopeId: 'svc', originScopeLabel: '服务', originOpenableSubjectIds: ['a'] },
    onBackToStructure,
    ...overrides,
  }} />)
  return { ...view, onBackToStructure }
}

describe('C17 FlowPageView：方法栈、关系栏与返回', () => {
  it('rendersMethodSubjectAndPermanentRelations', () => {
    const { container } = renderView()
    expect(container.querySelector('[data-flow-page]')?.getAttribute('data-current-subject')).toBe('a')
    expect(screen.getByText('A.Run')).toBeTruthy()
    expect(container.querySelector('[data-flow-channels]')).toBeTruthy()
    expect(container.querySelector('[data-flow-implementations]')).toBeTruthy()
    expect(container.querySelector('[data-flow-callers]')).toBeTruthy()
    expect(container.querySelectorAll('[data-flow-back]').length).toBe(1)
    expect(container.querySelectorAll('[data-caller]').length).toBe(3)
  })

  it('pushesAndPopsMethodStackWithoutDeduplication', () => {
    const { container } = renderView()
    fireEvent.click(container.querySelector('[data-step="a-to-b"]')!)
    expect(container.querySelector('[data-flow-page]')?.getAttribute('data-current-subject')).toBe('b')
    fireEvent.click(container.querySelector('[data-step="b-to-a"]')!)
    expect(container.querySelector('[data-flow-page]')?.getAttribute('data-current-subject')).toBe('a')
    expect(container.querySelector('[data-flow-depth]')?.textContent).toBe('3')
    expect(container.querySelectorAll('[data-flow-breadcrumb]').length).toBe(3)
    fireEvent.click(container.querySelector('[data-flow-back]')!)
    expect(container.querySelector('[data-flow-page]')?.getAttribute('data-current-subject')).toBe('b')
    expect(container.querySelector('[data-flow-depth]')?.textContent).toBe('2')
  })

  it('channelHighlightDoesNotChangeSubjectOrStack', () => {
    const { container } = renderView()
    const channel = container.querySelector('[data-channel="e"]')!
    fireEvent.click(channel)
    expect(container.querySelector('[data-flow-page]')?.getAttribute('data-current-subject')).toBe('a')
    expect(channel.getAttribute('data-highlighted')).toBe('true')
    expect(container.querySelector('[data-flow-depth]')?.textContent).toBe('1')
    expect(container.querySelector('[data-selected]')).toBeNull()
  })

  it('selectedInterfaceCallShowsTargetImplementations', () => {
    const { container } = renderView({
      baseline: {
        ...baseline,
        flows: {
          ...baseline.flows,
          a: { steps: [{ id: 'a-to-iface', order: 1, kind: 'call', to: 'iface', line: 2, iface: true }] },
        },
      },
    })
    fireEvent.click(container.querySelector('[data-step="a-to-iface"]')!)
    expect(container.querySelector('[data-flow-page]')?.getAttribute('data-current-subject')).toBe('a')
    expect(container.querySelector('[data-step="a-to-iface"]')?.getAttribute('data-selected')).toBe('true')
    expect(container.querySelector('[data-implementation="impl"]')).toBeTruthy()
  })

  it('breadcrumbTruncatesAndRootBackPreservesOrigin', () => {
    const { container, onBackToStructure } = renderView()
    fireEvent.click(container.querySelector('[data-step="a-to-b"]')!)
    fireEvent.click(container.querySelector('[data-flow-breadcrumb="a"]')!)
    expect(container.querySelector('[data-flow-page]')?.getAttribute('data-current-subject')).toBe('a')
    expect(container.querySelectorAll('[data-flow-breadcrumb]').length).toBe(1)
    fireEvent.click(container.querySelector('[data-flow-back]')!)
    expect(onBackToStructure).toHaveBeenCalledTimes(1)
    expect(onBackToStructure).toHaveBeenCalledWith()
  })

  it('degradedPageShowsMissingWithoutMechanicalSteps', () => {
    const { container } = renderView({ baseline: { ...baseline, flows: undefined } })
    expect(container.querySelector('[data-flow-degraded]')).toBeTruthy()
    expect(container.querySelector('[data-flow-chart]')).toBeNull()
    expect(container.querySelector('[data-step]')).toBeNull()
  })
})
