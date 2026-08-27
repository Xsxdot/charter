import { describe, expect, it } from 'vitest'
import type { CgGraph } from '../../api/types'
import { deriveFlowPage } from './flowpage'

const meta = { project: 'flow-fixture', branch: 'main', commit: 'test', scannedAt: '', generator: 'test' }

function graphFor(secondDomain = true, withFlow = true): CgGraph {
  const nodes: CgGraph['nodes'] = {
    entry: { kind: 'entry', container: 'c_entry', name: 'GET /tasks', file: 'cmd/register.go', line: 1, channel: 'http' },
    entry2: { kind: 'entry', container: 'c_entry', name: 'POST /tasks', file: 'cmd/register.go', line: 2, channel: 'http' },
    entry3: { kind: 'entry', container: 'c_entry', name: 'GET /health', file: 'cmd/register.go', line: 3, channel: 'http' },
    entry4: { kind: 'entry', container: 'c_entry', name: 'GET /ready', file: 'cmd/register.go', line: 4, channel: 'http' },
    local: { kind: 'func', container: 'c_local', name: 'local', file: 'api/local.go', line: 10 },
    iface: { kind: 'func', container: 'c_worker', name: 'Worker.run', file: 'worker/worker.go', line: 20 },
    implementation1: { kind: 'func', container: 'c_worker', name: 'WorkerA.run', file: 'worker/a.go', line: 30 },
    implementation2: { kind: 'func', container: 'c_worker', name: 'WorkerB.run', file: 'worker/b.go', line: 31 },
    other: { kind: 'func', container: 'c_other', name: 'other', file: 'other/other.go', line: 40 },
    nested: { kind: 'entry', container: 'c_nested', name: 'GET /nested', file: 'worker/nested.go', line: 5, channel: 'http' },
  }
  const edges: CgGraph['edges'] = [['entry', 'local'], ['local', 'iface']]
  if (secondDomain) edges.push(['local', 'other'])
  return {
    meta,
    domains: {
      api: { label: 'API', kind: 'boundary' },
      worker: { label: 'Worker', kind: 'domain' },
      other: { label: 'Other', kind: 'domain' },
    },
    containers: {
      c_entry: { label: '入口', kind: '入口', domain: 'api', entry: true },
      c_local: { label: '本地函数组', kind: '函数组', domain: 'api' },
      c_worker: { label: 'Worker', kind: 'TypeScript 实体', domain: 'worker' },
      c_other: { label: 'Other', kind: 'React 组件/函数', domain: 'other' },
      c_nested: { label: '嵌套入口', kind: '入口', domain: 'worker', entry: true },
    },
    nodes,
    edges,
    implements: [['implementation1', 'iface'], ['implementation2', 'iface'], ['other', 'not-an-iface']],
    ...(withFlow ? {
      flows: {
        entry: {
          steps: [
            { id: 's4', order: 4, kind: 'return', line: 40 },
            { id: 's2', order: 2, kind: 'call', line: 20, to: 'iface', iface: true },
            { id: 's5', order: 5, kind: 'call', line: 50, to: 'nested' },
            { id: 's3', order: 3, kind: 'loop', line: 30, cond: 'more', body: ['s4'] },
            { id: 's1', order: 1, kind: 'branch', line: 10, cond: 'ok', then: ['s2'], else: ['s3'] },
            { id: 'sx', order: 6, kind: 'future-kind' as never, line: 60 },
          ],
        },
      },
    } : {}),
  }
}

describe('deriveFlowPage', () => {
  it('按流程 schema 排序、保留蛇形所需分支数据、递归入口和 iface 实现 join', () => {
    const model = deriveFlowPage({ baseline: graphFor(), entryNodeId: 'entry' })
    expect(model.degraded).toBe(false)
    expect(model.steps.map((step) => step.id)).toEqual(['s1', 's2', 's3', 's4', 's5', 'sx'])
    expect(model.steps[0]).toEqual(expect.objectContaining({ shape: 'diamond', then: ['s2'], else: ['s3'] }))
    expect(model.steps.find((step) => step.id === 's3')).toEqual(expect.objectContaining({ shape: 'loop' }))
    expect(model.steps.find((step) => step.id === 's5')?.nestedEntry).toBe(true)
    expect(model.steps.find((step) => step.id === 'sx')).toEqual(expect.objectContaining({ shape: 'unknown', explicitUnknownKind: true }))
    expect(model.steps.find((step) => step.id === 's2')?.implementationIds).toEqual(['implementation1', 'implementation2'])
    expect(model.steps.find((step) => step.id === 's2')?.implementationIds).not.toContain('other')
    expect(model.nestedEntryIds).toEqual(['nested'])
  })

  it('区分单值、多值和未知归属，且注册集中度与入口族独立于容器', () => {
    const multiple = deriveFlowPage({ baseline: graphFor(true), entryNodeId: 'entry' })
    expect(multiple.ownership.state).toBe('multiple')
    expect(multiple.registration).toEqual(expect.objectContaining({ fileCount: 1, entryCount: 4, concentrated: true }))
    expect(multiple.family).toBe('/tasks')
    expect(multiple.families.find((family) => family.key === 'http:/tasks')?.entryIds).toEqual(['entry', 'entry2'])

    const single = deriveFlowPage({ baseline: graphFor(false), entryNodeId: 'entry' })
    expect(single.ownership.state).toBe('single')

    const threeEntries = graphFor(true)
    delete threeEntries.nodes.entry4
    const three = deriveFlowPage({ baseline: threeEntries, entryNodeId: 'entry' })
    expect(three.registration.concentrated).toBe(false)

    const unknownGraph = graphFor(false)
    unknownGraph.edges = [['entry', 'local']]
    const unknown = deriveFlowPage({ baseline: unknownGraph, entryNodeId: 'entry' })
    expect(unknown.ownership.state).toBe('unknown')
    expect(unknown.noBehavior).toBe(true)
  })

  it('流程段或入口缺席时显式降级，机械链不伪装成有序有分支图', () => {
    const missingFlow = deriveFlowPage({ baseline: graphFor(true, false), entryNodeId: 'entry' })
    expect(missingFlow.degraded).toBe(true)
    expect(missingFlow.degradedReason).toContain('缺少 baseline.flows')
    expect(missingFlow.callChain).toEqual(expect.objectContaining({ unordered: true, unbranched: true }))
    expect(missingFlow.callChain.notice).toContain('无次序无分支')

    const missingEntry = deriveFlowPage({ baseline: graphFor(), entryNodeId: 'does-not-exist' })
    expect(missingEntry.degraded).toBe(true)
    expect(missingEntry.degradedReason).toContain('不在 baseline.nodes')
    expect(missingEntry.noBehavior).toBe(true)
  })
})
