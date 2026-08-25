import { describe, expect, it } from 'vitest'
import type { CgBest, CgDomainDecls, CgGraph, CgNode } from '../../api/types'
import {
  DOMAIN_CASCADE_DEPTH,
  DOMAIN_FOCUS_QUOTA,
  DOMAIN_LEVEL_NODE_LIMIT,
  DOMAIN_SHARED_CALLER_DOMAINS,
  deriveDomainPage,
} from './domainpage'

function makeNode(id: string, container: string, overrides: Partial<CgNode> = {}): CgNode {
  return {
    kind: 'func',
    container,
    name: id,
    file: `${id}.go`,
    line: 1,
    ...overrides,
  }
}

function makeFixture() {
  const nodes: Record<string, CgNode> = {
    a1: makeNode('a1', 'c_a'),
    b1: makeNode('b1', 'c_b'),
    c1: makeNode('c1', 'c_c'),
    f1: makeNode('f1', 'c_target', { name: 'Focus one' }),
    f2: makeNode('f2', 'c_target', { name: 'Focus two' }),
    f3: makeNode('f3', 'c_target', { name: 'Focus three' }),
    f4: makeNode('f4', 'c_target', { name: 'Focus four' }),
    f5: makeNode('f5', 'c_target', { name: 'Focus five' }),
    f6: makeNode('f6', 'c_target', { name: 'Focus six' }),
    entity: makeNode('entity', 'c_target', { kind: 'model', modelKind: 'entity', name: 'Entity', file: 'svc/entity.go', summary: '实体' }),
    dto: makeNode('dto', 'c_target', { kind: 'model', modelKind: 'dto', name: 'DTO', file: 'svc/dto.go' }),
    config: makeNode('config', 'c_target', { kind: 'model', modelKind: 'config', name: 'Config', file: 'svc/config.go' }),
    creator: makeNode('creator', 'c_target', { name: 'Creator' }),
    writer: makeNode('writer', 'c_target', { name: 'Writer' }),
  }
  const edges: [string, string][] = [
    ['a1', 'f1'],
    ['a1', 'f2'], ['b1', 'f2'],
    ['a1', 'f3'], ['b1', 'f3'], ['c1', 'f3'],
    ['a1', 'f4'],
    ['b1', 'f5'],
    ['c1', 'f6'],
    ['entity', 'a1'],
  ]
  for (let index = 1; index <= 9; index += 1) {
    const levelOne = `l${index}`
    const levelTwo = `m${index}`
    const levelThree = `n${index}`
    nodes[levelOne] = makeNode(levelOne, 'c_target', { name: `Level one ${index}` })
    nodes[levelTwo] = makeNode(levelTwo, 'c_target', { name: `Level two ${index}` })
    nodes[levelThree] = makeNode(levelThree, 'c_target', { name: `Level three ${index}` })
    edges.push(['f1', levelOne], [levelOne, levelTwo], [levelTwo, levelThree])
  }

  const domains = {
    d_from_a: { label: 'From A', kind: 'logic' },
    d_from_b: { label: 'From B', kind: 'logic' },
    d_from_c: { label: 'From C', kind: 'logic' },
    d_target: { label: 'Current target', kind: 'logic' },
  }
  const baseline: CgGraph = {
    meta: { project: 'fixture', branch: 'main', commit: 'abc', scannedAt: '', generator: 'test' },
    domains,
    containers: {
      c_a: { label: 'A', kind: 'logic', domain: 'd_from_a' },
      c_b: { label: 'B', kind: 'logic', domain: 'd_from_b' },
      c_c: { label: 'C', kind: 'logic', domain: 'd_from_c' },
      c_target: { label: 'Target', kind: 'logic', domain: 'd_target' },
    },
    nodes,
    edges,
    lifecycle: [
      { who: 'creator', model: 'entity', kind: 'creator' },
      { who: 'writer', model: 'entity', kind: 'writer', field: 'status' },
    ],
    packages: {
      'svc': { summary: '实体与传输' },
      '': { summary: '根包' },
    },
  }
  const best: CgBest = {
    meta: { version: 1, project: 'fixture' },
    domains: {
      d_from_a: { label: 'Best A', responsibility: 'A', type: 'logic' },
      d_from_b: { label: 'Best B', responsibility: 'B', type: 'logic' },
      d_from_c: { label: 'Best C', responsibility: 'C', type: 'logic' },
      d_target: { label: 'Best target', responsibility: 'Target', type: 'logic' },
    },
    containers: { c_a: 'd_from_a', c_b: 'd_from_b', c_c: 'd_from_c', c_target: 'd_target' },
  }
  const decls: CgDomainDecls = {
    d_target: { domain: 'd_target', responsibility: '人写的目标声明', invariants: [{ text: '不可破', testRef: 'TestGuard' }] },
  }
  return { baseline, best, decls }
}

function makeEmptyInput() {
  const baseline: CgGraph = {
    meta: { project: 'empty', branch: 'main', commit: '', scannedAt: '', generator: 'test' },
    domains: { d_target: { label: 'Current target', kind: 'logic' } },
    containers: { c_target: { label: 'Target', kind: 'logic', domain: 'd_target' } },
    nodes: {},
    edges: [],
  }
  const best: CgBest = {
    meta: { version: 1, project: 'empty' },
    domains: { d_target: { label: 'Best target', responsibility: 'Target', type: 'logic' } },
    containers: { c_target: 'd_target' },
  }
  return { baseline, best }
}

describe('C1.10 domain page frozen thresholds', () => {
  it('pins the cascade depth to 3', () => {
    expect(DOMAIN_CASCADE_DEPTH).toBe(3)
  })

  it('pins the focus quota to 5', () => {
    expect(DOMAIN_FOCUS_QUOTA).toBe(5)
  })

  it('pins the per-level node limit to 8', () => {
    expect(DOMAIN_LEVEL_NODE_LIMIT).toBe(8)
  })

  it('pins shared caller domains to K=3', () => {
    expect(DOMAIN_SHARED_CALLER_DOMAINS).toBe(3)
  })
})

describe('deriveDomainPage', () => {
  it('keeps declaration semantics on the best key while switching the graph organization', () => {
    const { baseline, best, decls } = makeFixture()
    const bestModel = deriveDomainPage({ baseline, best, decls, organization: 'best', domainId: 'd_target' })
    expect(bestModel.organizationAvailable).toBe(true)
    expect(bestModel.semantic.label).toBe('Best target')
    expect(bestModel.semantic.declaration).toBe(decls.d_target)
    expect(bestModel.semantic.declaredDomainCount).toBe(1)
    expect(bestModel.semantic.totalDomainCount).toBe(4)
    expect(bestModel.semantic.entities.map((entity) => entity.id)).toEqual(['entity'])
    expect(bestModel.semantic.entities[0].creators).toEqual(['creator'])
    expect(bestModel.semantic.entities[0].writers).toEqual([{ id: 'writer', field: 'status' }])
    expect(bestModel.semantic.packages).toContainEqual({ dir: 'svc', summary: '实体与传输' })
    expect(bestModel.semantic.packages).toContainEqual({ dir: '', summary: '根包' })

    const currentModel = deriveDomainPage({ baseline, best, decls, organization: 'current', domainId: 'd_target' })
    expect(currentModel.semantic.label).toBe('Current target')
    expect(currentModel.semantic.declaration).toBe(decls.d_target)
    expect(currentModel.semantic.declaredDomainCount).toBe(1)
  })

  it('exposes each empty state and never invents lanes without inbound seams', () => {
    const { baseline, best } = makeEmptyInput()
    const noDeclaration = deriveDomainPage({ baseline, best, organization: 'best', domainId: 'd_target' })
    expect(noDeclaration.semantic.empty.noDeclaration).toBe(true)
    expect(noDeclaration.semantic.empty.noInvariants).toBe(true)
    expect(noDeclaration.semantic.empty.noEntities).toBe(true)
    expect(noDeclaration.semantic.empty.noInboundSeams).toBe(true)
    expect(noDeclaration.structure.lanes).toEqual([])
    expect(noDeclaration.structure.noInboundSeams).toBe(true)

    const noInvariant = deriveDomainPage({
      baseline,
      best,
      decls: { d_target: { domain: 'd_target', responsibility: '有声明但无规矩' } },
      organization: 'best',
      domainId: 'd_target',
    })
    expect(noInvariant.semantic.empty.noDeclaration).toBe(false)
    expect(noInvariant.semantic.empty.noInvariants).toBe(true)
  })

  it('preserves edge order, aggregates ports, applies focus quota, and exposes depth/level truncation', () => {
    const { baseline, best, decls } = makeFixture()
    const model = deriveDomainPage({ baseline, best, decls, organization: 'best', domainId: 'd_target' })
    expect(model.structure.inboundEdgeCount).toBe(9)
    expect(model.structure.inboundPorts).toEqual([
      { domainId: 'd_from_a', label: 'Best A', edgeCount: 4 },
      { domainId: 'd_from_b', label: 'Best B', edgeCount: 3 },
      { domainId: 'd_from_c', label: 'Best C', edgeCount: 2 },
    ])
    expect(model.structure.outboundPorts).toEqual([{ domainId: 'd_from_a', label: 'Best A', edgeCount: 1 }])
    expect(model.structure.focusTruncation).toEqual({ total: 9, shown: 5, reason: 'focus-quota' })
    expect(model.structure.lanes).toHaveLength(5)

    const firstLane = model.structure.lanes[0]
    expect(firstLane.focusNodeId).toBe('f1')
    expect(firstLane.columns.map((column) => column.depth)).toEqual([0, 1, 2, 3])
    expect(firstLane.columns[1].nodes).toHaveLength(8)
    expect(firstLane.columns[1].droppedNodes).toBe(1)
    expect(firstLane.columns[1].truncated).toBe(true)
    expect(firstLane.columns[3].depthLimit).toBe(true)

    const sharedLane = model.structure.lanes.find((lane) => lane.focusNodeId === 'f3')
    expect(sharedLane?.columns[0].nodes[0]).toMatchObject({ collapsed: true, collapseReason: 'shared-by-domains' })
    expect(sharedLane?.columns.slice(1).every((column) => column.nodes.length === 0)).toBe(true)

    const twoDomainLane = model.structure.lanes.find((lane) => lane.focusNodeId === 'f2')
    expect(twoDomainLane?.columns[0].nodes[0].collapsed).toBe(false)
  })

  it('counts caller domains instead of caller edges when deciding shared collapse', () => {
    const { baseline, best } = makeEmptyInput()
    const nodes: Record<string, CgNode> = {
      focus: makeNode('focus', 'c_target'),
    }
    const edges: [string, string][] = []
    for (let index = 0; index < 40; index += 1) {
      const caller = `caller-${index}`
      nodes[caller] = makeNode(caller, 'c_source')
      edges.push([caller, 'focus'])
    }
    const input: CgGraph = {
      ...baseline,
      containers: {
        c_source: { label: 'Source', kind: 'logic', domain: 'd_source' },
        c_target: { label: 'Target', kind: 'logic', domain: 'd_target' },
      },
      domains: {
        d_source: { label: 'Source', kind: 'logic' },
        d_target: { label: 'Target', kind: 'logic' },
      },
      nodes,
      edges,
    }
    const bestInput: CgBest = {
      ...best,
      domains: {
        d_source: { label: 'Source', responsibility: 'Source', type: 'logic' },
        d_target: { label: 'Target', responsibility: 'Target', type: 'logic' },
      },
      containers: { c_source: 'd_source', c_target: 'd_target' },
    }
    const model = deriveDomainPage({ baseline: input, best: bestInput, organization: 'best', domainId: 'd_target' })
    expect(model.structure.focusTruncation).toEqual({ total: 40, shown: 5, reason: 'focus-quota' })
    expect(model.structure.lanes[0].columns[0].nodes[0].collapsed).toBe(false)
  })

  it('does not present best as available when the best graph is absent', () => {
    const { baseline } = makeEmptyInput()
    const model = deriveDomainPage({ baseline, organization: 'best', domainId: 'd_target' })
    expect(model.organizationAvailable).toBe(false)
    expect(model.semantic.label).toBe('d_target')
  })
})
