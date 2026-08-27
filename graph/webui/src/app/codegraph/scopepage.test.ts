import { describe, expect, it } from 'vitest'
import type { CgBest, CgGraph } from '../../api/types'
import { deriveScopePage } from './scopepage'

const meta = { project: 'scope-fixture', branch: 'main', commit: 'test', scannedAt: '', generator: 'test' }

function graphFor(withUnknown = false): CgGraph {
  const nodes: CgGraph['nodes'] = {}
  for (let index = 1; index <= 10; index += 1) {
    nodes[`entry${index}`] = {
      kind: 'entry', container: 'c_source', name: `task ${index}`, file: 'cmd/main.go', line: index, channel: 'cli',
    }
  }
  for (let index = 1; index <= 9; index += 1) {
    nodes[`source${index}`] = { kind: 'func', container: 'c_source', name: `source${index}`, file: 'cmd/main.go', line: 20 + index }
  }
  nodes.shared10 = { kind: 'func', container: 'c_fallback', name: 'shared10', file: 'leaf/shared.go', line: 1 }
  nodes.fallback9 = { kind: 'func', container: 'c_fallback', name: 'fallback9', file: 'leaf/fallback.go', line: 1 }
  nodes.entity = {
    kind: 'model', container: 'c_entity', name: 'Task', file: 'leaf/task.go', line: 1, modelKind: 'entity',
    fields: Array.from({ length: 41 }, (_, index) => [`field${index}`, 'string']),
  }
  nodes.typeModel = {
    kind: 'model', container: 'c_entity', name: 'TaskView', file: 'leaf/task.go', line: 50, modelKind: 'dto', summary: '对外任务视图',
  }
  nodes.typeMethod = { kind: 'func', container: 'c_type', name: 'TaskView.render', file: 'leaf/view.go', line: 60 }
  nodes.wrongTypeModel = {
    kind: 'model', container: 'c_entity', name: 'TaskView', file: 'other/task.go', line: 50, modelKind: 'dto', summary: '错误包职责',
  }
  nodes.billing = { kind: 'model', container: 'c_billing', name: 'Invoice', file: 'billing/invoice.go', line: 1, modelKind: 'entity' }
  for (let index = 1; index <= 41; index += 1) {
    nodes[`large${index}`] = { kind: 'func', container: 'c_entity', name: `large${index}`, file: `leaf/large${index}.go`, line: index }
  }
  if (withUnknown) nodes.unknown = { kind: 'func', container: 'c_unknown', name: 'unknown', file: 'billing/unknown.go', line: 1 }

  const edges: CgGraph['edges'] = []
  for (let index = 1; index <= 10; index += 1) edges.push([`entry${index}`, 'source1'])
  for (let index = 1; index <= 9; index += 1) edges.push([`entry${index}`, 'source2'])
  for (let index = 2; index <= 8; index += 1) edges.push([`source${index}`, `source${index + 1}`])
  edges.push(['source1', 'shared10'])
  for (let index = 2; index <= 7; index += 1) edges.push([`source${index}`, 'fallback9'])
  edges.push(['source1', 'entity'], ['source2', 'entity'], ['source3', 'entity'])
  if (withUnknown) edges.push(['source4', 'unknown'])

  return {
    meta,
    domains: {
      root: { label: '根领域', kind: 'subsystem' },
      orders: { label: '订单', kind: 'domain', parent: 'root' },
      leaf: { label: '订单内核', kind: 'domain', parent: 'orders' },
      billing: { label: '账务', kind: 'domain', parent: 'root' },
    },
    containers: {
      c_source: { label: '入口组', kind: '入口', domain: 'root', entry: true },
      c_fallback: { label: '共享函数', kind: '函数组', domain: 'leaf' },
      c_entity: { label: '任务实体', kind: '实体', domain: 'leaf' },
      c_type: { label: 'TaskView', kind: 'TypeScript 模型', domain: 'leaf' },
      c_empty: { label: '空容器', kind: 'React 组件/函数', domain: 'leaf' },
      c_billing: { label: '账务实体', kind: '实体', domain: 'billing' },
      ...(withUnknown ? { c_unknown: { label: '未知容器', kind: 'future-kind', domain: 'billing' } } : {}),
    },
    nodes,
    edges,
    projections: [['entity', 'billing', 'read']],
  }
}

const best: CgBest = {
  meta: { version: 1, project: 'scope-fixture' },
  domains: {
    root: { label: '根领域', type: 'subsystem' },
    orders: { label: '订单', type: 'domain', parent: 'root' },
    leaf: { label: '订单内核', type: 'domain', parent: 'orders' },
    billing: { label: '账务', type: 'domain', parent: 'root' },
  },
  containers: {
    c_source: 'root', c_fallback: 'leaf', c_entity: 'leaf', c_type: 'leaf', c_empty: 'leaf', c_billing: 'billing',
  },
}

const decls = {
  root: { domain: 'root', responsibility: '系统根' },
  orders: { domain: 'orders', responsibility: '订单编排' },
  leaf: { domain: 'leaf', responsibility: '订单内核' },
}

function input(scopeId: string | null, organization: 'best' | 'current' = 'best', graph = graphFor()) {
  return { baseline: graph, best, decls, organization, scopeId }
}

describe('deriveScopePage', () => {
  it('保持根→领域→容器三层形状，容器是原子节点且职责只读声明', () => {
    const root = deriveScopePage(input(null))
    expect(root.level).toBe('root')
    expect(root.domains.map((domain) => domain.id)).toEqual(['root'])

    const domain = deriveScopePage(input('root'))
    expect(domain.level).toBe('domain')
    expect(domain.domains.map((item) => item.id)).toEqual(['billing', 'orders'])

    const leaf = deriveScopePage(input('leaf'))
    expect(leaf.level).toBe('containers')
    expect(leaf.containers.map((container) => container.id)).toEqual(['c_empty', 'c_entity', 'c_fallback', 'c_type'])
    expect(leaf.containers.find((container) => container.id === 'c_fallback')?.noSubject).toBe(true)
    expect(leaf.containers.find((container) => container.id === 'c_type')?.responsibility).toBe('对外任务视图')
    expect('children' in leaf.containers[0]).toBe(false)
  })

  it('按跨域调用边计算 fallback 读数、复用阈值和共享内核真假', () => {
    const model = deriveScopePage(input('leaf'))
    expect(model.readouts.fallbackBucketShare).toEqual({ numerator: 7, denominator: 10, percentage: 70 })
    expect(model.readouts.reuseByNode.shared10).toBe(10)
    expect(model.readouts.reuseByNode.fallback9).toBe(9)
    expect(model.readouts.trueSharedKernelNodes).not.toContain('shared10')
    expect(model.readouts.falseSharedKernelNodes).not.toContain('fallback9')
    expect(model.readouts.falseSharedKernelNodes).toContain('shared10')
    expect(model.containers.find((container) => container.id === 'c_fallback')?.collapsed).toBe(true)
    expect(model.containers.find((container) => container.id === 'c_fallback')?.collapsedSymbolIds).toEqual(['shared10'])

    const withoutThresholdHit = graphFor()
    delete withoutThresholdHit.nodes.shared10
    withoutThresholdHit.edges = withoutThresholdHit.edges.filter(([, to]) => to !== 'shared10')
    const nine = deriveScopePage(input('leaf', 'best', withoutThresholdHit))
    expect(nine.readouts.reuseByNode.fallback9).toBe(9)
    expect(nine.containers.find((container) => container.id === 'c_fallback')?.collapsed).toBe(false)
  })

  it('保留投影非调用标记、空态、超大符号和未知 kind 的显式读数', () => {
    const model = deriveScopePage(input('root'))
    expect(model.projectionEdges).toEqual([expect.objectContaining({ kind: 'projection', nonCall: true, label: 'read · 不是调用边' })])
    const leaf = deriveScopePage(input('leaf'))
    expect(leaf.containers.find((container) => container.id === 'c_entity')).toEqual(expect.objectContaining({ isOversized: true, symbolCount: 44 }))
    expect(leaf.containers.find((container) => container.id === 'c_empty')).toEqual(expect.objectContaining({ noDeclaration: true, noEntities: true, noInboundSeams: true }))

    const unknown = deriveScopePage(input('root', 'current', graphFor(true)))
    expect(unknown.degraded).toBe(true)
    expect(unknown.degradedReason).toContain('kind 未知')
    expect(unknown.readouts.unknownKindEdges).toBe(1)
    expect(unknown.readouts.fallbackBucketShare.denominator).toBe(11)
  })

  it('best 缺席时显式不可用，current 仍可按现状结构工作', () => {
    const graph = graphFor()
    const unavailable = deriveScopePage({ baseline: graph, decls, organization: 'best', scopeId: null })
    expect(unavailable.available).toBe(false)
    expect(unavailable.unavailableReason).toContain('缺少 best.json')
    const current = deriveScopePage({ baseline: graph, decls, organization: 'current', scopeId: null })
    expect(current.available).toBe(true)
    expect(current.domains.map((domain) => domain.id)).toEqual(['root'])
  })
})
