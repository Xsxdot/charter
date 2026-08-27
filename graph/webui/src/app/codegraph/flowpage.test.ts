import { describe, expect, it } from 'vitest'
import type { CgFlowStep, CgGraph } from '../../api/types'
import { deriveFlowPage } from './flowpage'

const meta = { project: 'c17', branch: 'main', commit: 'c', scannedAt: 'now', generator: 'test' }

function methodWorld(flows: CgGraph['flows'] = {}): CgGraph {
  return {
    meta,
    domains: { api: { label: 'API', kind: 'boundary' }, svc: { label: '服务', kind: 'logic' } },
    containers: {
      entries: { label: '入口', kind: '入口', domain: 'api' },
      methods: { label: '方法', kind: '类型方法', domain: 'svc' },
    },
    nodes: {
      e_cli: { kind: 'entry', container: 'entries', name: 'charter run', file: 'cmd.go', line: 1, channel: 'cli' },
      e_http: { kind: 'entry', container: 'entries', name: 'GET /items', file: 'http.go', line: 2, channel: 'http' },
      e_ws: { kind: 'entry', container: 'entries', name: 'WS /items', file: 'ws.go', line: 3, channel: 'ws' },
      m_run: { kind: 'func', container: 'methods', name: 'Runner.Run', file: 'run.go', line: 0 },
      m_next: { kind: 'func', container: 'methods', name: 'Runner.Next', file: 'next.go', line: 8 },
      m_iface: { kind: 'func', container: 'methods', name: 'Store.Put', file: 'store.go', line: 10 },
      impl_a: { kind: 'func', container: 'methods', name: 'Memory.Put', file: 'memory.go', line: 12 },
      impl_b: { kind: 'func', container: 'methods', name: 'SQL.Put', file: 'sql.go', line: 14 },
      caller: { kind: 'func', container: 'methods', name: 'Caller.Call', file: 'caller.go', line: 4 },
      helper: { kind: 'func', container: 'methods', name: 'Helper.Call', file: 'helper.go', line: 5 },
      second_hop: { kind: 'func', container: 'methods', name: 'Second.Hop', file: 'second.go', line: 6 },
      dead: { kind: 'func', container: 'methods', name: 'Dead.Call', file: 'dead.go', line: 7, ...({ status: 'deleted' } as object) },
    },
    edges: [
      ['e_cli', 'm_run'], ['e_http', 'helper'], ['helper', 'm_run'], ['caller', 'm_run'],
      ['second_hop', 'caller'], ['dead', 'm_run'], ['e_ws', 'm_next'],
    ],
    implements: [['impl_b', 'm_iface'], ['impl_a', 'm_iface'], ['ghost', 'm_iface']],
    flows,
  }
}

const methodSteps: CgFlowStep[] = [
  { id: 's_call', order: 7, kind: 'call', to: 'm_next', line: 3, iface: true },
  { id: 's_branch', order: 2, kind: 'branch', cond: 'err != nil', line: 2, then: ['s_guard'], else: ['s_call'] },
  { id: 's_guard', order: 3, kind: 'return', line: 0 },
  { id: 's_loop', order: 8, kind: 'loop', cond: 'more', line: 4, body: ['s_call'] },
]

describe('C17 deriveFlowPage：方法主语与关系投影', () => {
  it('derivesMethodSubjectAndRelations', () => {
    const model = deriveFlowPage({ baseline: methodWorld({ m_run: { steps: methodSteps } }), entryNodeId: 'm_run' })
    expect(model.subject).toMatchObject({ id: 'm_run', name: 'Runner.Run', kind: 'func', file: 'run.go', line: 0, openable: true })
    expect(model.steps).toEqual(methodSteps)
    expect(model.degraded).toBe(false)
    expect(model.channels.map((node) => node.id)).toEqual(['e_cli', 'e_http'])
    expect(model.callers.map((node) => node.id)).toEqual(['caller', 'e_cli', 'helper'])
    expect(model.callers.find((node) => node.id === 'e_cli')?.openable).toBe(false)
    expect(model.callers.find((node) => node.id === 'helper')?.openable).toBe(false)
    expect(model.callers.find((node) => node.id === 'caller')?.openable).toBe(false)
  })

  it('entryIsChannelNotSubject', () => {
    const model = deriveFlowPage({ baseline: methodWorld({ e_cli: { steps: [{ id: 'legacy', order: 1, kind: 'call', to: 'm_run', line: 1 }] } }), entryNodeId: 'e_cli' })
    expect(model.subject).toMatchObject({ id: 'e_cli', kind: 'entry', openable: false })
    expect(model.channels.every((channel) => channel.openable === false)).toBe(true)
    expect(Object.keys(model).sort()).toEqual(['callers', 'channels', 'degraded', 'implementations', 'steps', 'subject'].sort())
  })

  it('flowHitPassesThroughSteps', () => {
    const model = deriveFlowPage({ baseline: methodWorld({ m_run: { steps: methodSteps } }), entryNodeId: 'm_run' })
    expect(model.steps).toEqual(methodSteps)
    expect(model.steps.find((step) => step.id === 's_branch')?.then).toEqual(['s_guard'])
    expect(model.steps.find((step) => step.id === 's_loop')?.body).toEqual(['s_call'])
  })

  it('flowMissingAndEmptyAreExplicitDegraded', () => {
    for (const baseline of [methodWorld(), methodWorld({ m_run: { steps: [] } }), methodWorld({ other: { steps: methodSteps } })]) {
      const model = deriveFlowPage({ baseline, entryNodeId: 'm_run' })
      expect(model.degraded).toBe(true)
      expect(model.steps).toEqual([])
      expect(model.missing).toBeTruthy()
      expect(model.steps.some((step) => step.id === 'm_next')).toBe(false)
    }
    const zero = deriveFlowPage({ baseline: methodWorld({ m_run: { steps: [{ id: 'zero', order: 1, kind: 'return', line: 0 }] } }), entryNodeId: 'm_run' })
    expect(zero.subject.line).toBe(0)
    expect(zero.missing).toBeUndefined()
  })

  it('callersAreDirectAndActiveOnly', () => {
    const model = deriveFlowPage({ baseline: methodWorld({ m_run: { steps: methodSteps }, caller: { steps: [] } }), entryNodeId: 'm_run' })
    expect(model.callers.map((node) => node.id)).toEqual(['caller', 'e_cli', 'helper'])
    expect(model.callers.find((node) => node.id === 'second_hop')).toBeUndefined()
    expect(model.callers.find((node) => node.id === 'dead')).toBeUndefined()
  })

  it('implementationsComeFromImplementsJoin', () => {
    const flow = { steps: [{ id: 'iface', order: 1, kind: 'call' as const, to: 'm_iface', line: 1, ...({ implementations: ['fake'] } as object) }] }
    const model = deriveFlowPage({ baseline: methodWorld({ m_iface: flow }), entryNodeId: 'm_iface' })
    expect(model.implementations.map((node) => node.id)).toEqual(['impl_a', 'impl_b'])
    expect(model.implementations.every((node) => node.openable)).toBe(true)
  })

  it('channelsAreReverseReachableEntries', () => {
    const model = deriveFlowPage({ baseline: methodWorld(), entryNodeId: 'm_next' })
    expect(model.channels.map((node) => [node.id, node.channel])).toEqual([['e_ws', 'ws']])
    expect(model.channels[0]?.openable).toBe(false)
  })
})
