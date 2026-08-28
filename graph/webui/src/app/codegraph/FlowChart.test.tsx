import { fireEvent, render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { CgGraph } from '../../api/types'
import { deriveFlowPage } from './flowpage'
import { FlowChart } from './FlowChart'

const baseline: CgGraph = {
  meta: { project: 'c17', branch: 'main', commit: 'c', scannedAt: 'now', generator: 'test' },
  containers: {
    entry: { label: 'entry', kind: '入口', domain: 'api' },
    methods: { label: 'methods', kind: '类型方法', domain: 'svc' },
  },
  domains: { api: { label: 'API', kind: 'boundary' }, svc: { label: '服务', kind: 'logic' } },
  nodes: {
    method: { kind: 'func', container: 'methods', name: 'Run', file: 'run.go', line: 1 },
    open: { kind: 'func', container: 'methods', name: 'Open', file: 'open.go', line: 2 },
    entryNode: { kind: 'entry', container: 'entry', name: 'CLI', file: 'cmd.go', line: 3, channel: 'cli' },
    plain: { kind: 'func', container: 'methods', name: 'Plain', file: 'plain.go', line: 4 },
  },
  edges: [['entryNode', 'method']],
  flows: {
    method: {
      steps: [
        { id: 'branch', order: 1, kind: 'branch', cond: 'err', line: 1, then: ['guard'], else: ['open'] },
        { id: 'guard', order: 2, kind: 'return', line: 2 },
        { id: 'open', order: 3, kind: 'call', to: 'open', line: 3, iface: true },
        { id: 'entry-call', order: 4, kind: 'call', to: 'entryNode', line: 4 },
        { id: 'plain-call', order: 5, kind: 'call', to: 'plain', line: 5 },
      ],
    },
  },
}

describe('C17 FlowChart：形态、紫框与下钻', () => {
  it('rendersDiamondAndGuardSideEdge', () => {
    const model = deriveFlowPage({ baseline, entryNodeId: 'method' })
    const { container } = render(<FlowChart {...{ model, baseline, openableSubjectIds: new Set(['open']), width: 900, selectedStepId: '', onSelectStep: vi.fn(), onOpenSubject: vi.fn() }} />)
    expect(container.querySelector('[data-shape="diamond"]')).toBeTruthy()
    expect(container.querySelector('[data-shape="diamond"]')?.getAttribute('style')).toMatch(/clip-path|transform/)
    expect(container.querySelector('[data-guard-return="true"]')).toBeTruthy()
    expect(container.querySelector('[data-flow-edge="child:branch:guard"]')?.getAttribute('d')).toContain('H')
    expect(container.querySelector('[data-flow-chart]')?.textContent).not.toContain('接上列')
  })

  it('rendersSnakeWrapPath', () => {
    const many = Array.from({ length: 12 }, (_, index) => ({ id: `s${index}`, order: index, kind: 'call' as const, to: 'plain', line: index }))
    const model = deriveFlowPage({ baseline: { ...baseline, flows: { method: { steps: many } } }, entryNodeId: 'method' })
    const { container } = render(<FlowChart {...{ model, baseline, openableSubjectIds: new Set<string>(), width: 600, selectedStepId: '', onSelectStep: vi.fn(), onOpenSubject: vi.fn() }} />)
    const wrap = container.querySelector('path[data-flow-edge^="wrap:"]')
    expect(wrap?.getAttribute('d')).toBeTruthy()
    expect(container.textContent).not.toContain('接上列')
  })

  it('purpleOnlyForOpenableCallTargetsAndEntryDoesNotDrill', () => {
    const model = deriveFlowPage({ baseline, entryNodeId: 'method' })
    const onSelectStep = vi.fn()
    const onOpenSubject = vi.fn()
    const { container } = render(<FlowChart {...{ model, baseline, openableSubjectIds: new Set(['open']), width: 900, selectedStepId: '', onSelectStep, onOpenSubject }} />)
    const open = container.querySelector('[data-step="open"]')!
    expect(open.className).toContain('border-purple-600')
    expect(open.textContent).toContain('▸')
    const entry = container.querySelector('[data-step="entry-call"]')!
    expect(entry.className).not.toContain('border-purple-600')
    fireEvent.click(entry)
    expect(onOpenSubject).not.toHaveBeenCalled()
    expect(onSelectStep).toHaveBeenCalledWith('entry-call')
    expect(container.querySelector('[data-step="open"]')?.getAttribute('data-iface')).toBe('true')
  })

  it('degradedDoesNotRenderMechanicalChain', () => {
    const model = deriveFlowPage({ baseline, entryNodeId: 'entryNode' })
    const { container } = render(<FlowChart {...{ model, baseline, openableSubjectIds: new Set<string>(), width: 900, selectedStepId: '', onSelectStep: vi.fn(), onOpenSubject: vi.fn() }} />)
    expect(container.querySelector('[data-step]')).toBeNull()
  })
})
