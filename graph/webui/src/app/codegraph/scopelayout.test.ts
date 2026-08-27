import { describe, expect, it } from 'vitest'
import type { ScopeEdge, ScopeNode } from './scopepage'
import type { ScopePackageFrame } from './scopelayout'
import { CARD_H, CARD_W, CONTAINER_H, layoutScopeCards, scopeEdgeAnchors, scopeEdgePath } from './scopelayout'

// 夹具纪律（沿 K2/K3 同款）：断言只走 layoutScopeCards 一个入口；期望值硬编码。
function domainNode(id: string, overrides: Partial<ScopeNode> = {}): ScopeNode {
  return {
    id,
    kind: 'domain',
    label: id,
    type: 'logic',
    isolated: false,
    childCount: 0,
    containerCount: 0,
    symbolCount: 0,
    fileCount: 0,
    oversized: false,
    dir: '',
    ports: [],
    entries: [],
    responsibility: { state: 'undeclared' },
    entryDispersion: null,
    invariants: { state: 'no-decl' },
    debt: null,
    ...overrides,
  }
}

function containerNode(id: string, overrides: Partial<ScopeNode> = {}): ScopeNode {
  return domainNode(id, { kind: 'container', type: '函数组', dir: 'p/one', invariants: null, ...overrides })
}

function packageDistanceCost(frames: ScopePackageFrame[], edges: ScopeEdge[]): number {
  const groupOf = new Map<string, string>()
  for (const frame of frames) for (const nodeId of frame.nodeIds) groupOf.set(nodeId, frame.dir)
  const centers = new Map(frames.map((frame) => [frame.dir, [frame.x + frame.w / 2, frame.y + frame.h / 2] as const]))
  return edges.reduce((sum, edge) => {
    if (edge.kind !== 'call') return sum
    const from = groupOf.get(edge.from)
    const to = groupOf.get(edge.to)
    if (from === undefined || to === undefined || from === to) return sum
    const a = centers.get(from)!
    const b = centers.get(to)!
    return sum + edge.weight * Math.hypot(a[0] - b[0], a[1] - b[1])
  }, 0)
}

describe('C12.4 scopelayout：确定性与覆盖', () => {
  it('同一输入两次调用逐位相同（零随机数纪律）', () => {
    const nodes = [domainNode('a'), domainNode('b'), containerNode('c')]
    const edges: ScopeEdge[] = [{ key: 'a->b', from: 'a', to: 'b', weight: 3, kind: 'call' }]
    expect(layoutScopeCards(nodes, edges)).toEqual(layoutScopeCards(nodes, edges))
  })

  it('每张输入卡都有坐标；空输入返回空布局不崩溃', () => {
    const nodes = [domainNode('a'), domainNode('b'), domainNode('iso', { isolated: true })]
    const layout = layoutScopeCards(nodes, [])
    expect(Object.keys(layout.positions).sort()).toEqual(['a', 'b', 'iso'])
    expect(layout.packageFrames).toEqual([])
    const empty = layoutScopeCards([], [])
    expect(empty.positions).toEqual({})
    expect(empty.packageFrames).toEqual([])
  })

  it('分离后非域外卡两两矩形无重叠（含容器加高与孤立行）', () => {
    const many = Array.from({ length: 9 }, (_, i) => (i % 2 === 0 ? domainNode(`n${i}`) : containerNode(`n${i}`)))
    const isolatedCard = domainNode('iso1', { isolated: true })
    const nodes = [...many, isolatedCard]
    const edges: ScopeEdge[] = [
      { key: 'n0->n1', from: 'n0', to: 'n1', weight: 2, kind: 'call' },
      { key: 'n1->n2', from: 'n1', to: 'n2', weight: 5, kind: 'call' },
    ]
    const { positions } = layoutScopeCards(nodes, edges)
    for (let i = 0; i < nodes.length; i += 1) {
      for (let j = i + 1; j < nodes.length; j += 1) {
        const a = positions[nodes[i].id]!
        const b = positions[nodes[j].id]!
        const aw = CARD_W
        const ah = nodes[i].kind === 'container' ? CONTAINER_H : CARD_H
        const bw = CARD_W
        const bh = nodes[j].kind === 'container' ? CONTAINER_H : CARD_H
        const ox = Math.min(a[0] + aw, b[0] + bw) - Math.max(a[0], b[0])
        const oy = Math.min(a[1] + ah, b[1] + bh) - Math.max(a[1], b[1])
        expect({ pair: `${nodes[i].id}|${nodes[j].id}`, ox, oy }).toEqual({
          pair: `${nodes[i].id}|${nodes[j].id}`,
          ox: expect.any(Number),
          oy: expect.any(Number),
        })
        expect(ox <= 0 || oy <= 0).toBe(true)
      }
    }
  })

  it('孤立卡单列一行：位于全部非孤立卡最低点之下，同行等高、按 id 升序从左到右', () => {
    const nodes = [
      domainNode('iso_b', { isolated: true }),
      domainNode('m1'),
      domainNode('m2'),
      domainNode('iso_a', { isolated: true }),
    ]
    const edges: ScopeEdge[] = [{ key: 'm1->m2', from: 'm1', to: 'm2', weight: 1, kind: 'call' }]
    const { positions } = layoutScopeCards(nodes, edges)
    let floorY = 0
    for (const id of ['m1', 'm2']) {
      floorY = Math.max(floorY, positions[id]![1] + CARD_H)
    }
    expect(positions['iso_a']![1]).toBeGreaterThan(floorY)
    expect(positions['iso_b']![1]).toBe(positions['iso_a']![1])
    expect(positions['iso_a']![0]).toBeLessThan(positions['iso_b']![0])
  })

  it('布局包围盒覆盖领域卡与孤立区，且所有坐标非负', () => {
    const nodes = [
      domainNode('a'),
      domainNode('b'),
      domainNode('iso', { isolated: true }),
    ]
    const edges: ScopeEdge[] = [
      { key: 'a->b', from: 'a', to: 'b', weight: 1, kind: 'call' },
    ]
    const layout = layoutScopeCards(nodes, edges)
    for (const node of nodes) {
      const [x, y] = layout.positions[node.id]!
      expect({ id: node.id, x, y }).toEqual({ id: node.id, x: expect.any(Number), y: expect.any(Number) })
      expect(x).toBeGreaterThanOrEqual(0)
      expect(y).toBeGreaterThanOrEqual(0)
    }
    expect(layout.bounds.w).toBeGreaterThanOrEqual(CARD_W)
    expect(layout.bounds.h).toBeGreaterThan(layout.positions.iso![1])
  })

  it('包群组框：容器按 dir 聚合、包围盒盖住全部成员、dir 缺席归入空串框；领域卡不成框', () => {
    const nodes = [
      containerNode('c1', { dir: 'p/one' }),
      containerNode('c2', { dir: 'p/two' }),
      containerNode('c3', { dir: 'p/one' }),
      containerNode('c4', { dir: '' }),
      domainNode('d1'),
    ]
    const { positions, packageFrames } = layoutScopeCards(nodes, [])
    expect(packageFrames.map((f) => f.dir)).toEqual(['', 'p/one', 'p/two'])
    const one = packageFrames.find((f) => f.dir === 'p/one')!
    expect(one.nodeIds).toEqual(['c1', 'c3'])
    expect(one.x).toBe(Math.min(positions.c1![0], positions.c3![0]) - 14)
    expect(one.w).toBeGreaterThanOrEqual(CARD_W + 28)
    for (const id of one.nodeIds) {
      const inside = positions[id]![0] >= one.x && positions[id]![0] + CARD_W <= one.x + one.w
        && positions[id]![1] >= one.y && positions[id]![1] + CONTAINER_H <= one.y + one.h
      expect({ id, inside }).toEqual({ id, inside: true })
    }
  })
})

describe('C14 容器层：包群组装箱与边路径', () => {
  it('两组包各自成 frame，frame 覆盖组内全部容器卡', () => {
    const nodes = [
      containerNode('a1', { dir: 'p/a' }), containerNode('a2', { dir: 'p/a' }), containerNode('a3', { dir: 'p/a' }),
      containerNode('b1', { dir: 'p/b' }), containerNode('b2', { dir: 'p/b' }), containerNode('b3', { dir: 'p/b' }),
    ]
    const layout = layoutScopeCards(nodes, [], { width: 1200 })
    expect(layout.packageFrames.map((frame) => frame.dir)).toEqual(['p/a', 'p/b'])
    for (const frame of layout.packageFrames) {
      for (const id of frame.nodeIds) {
        const [x, y] = layout.positions[id]!
        expect({ id, inside: x >= frame.x && y >= frame.y && x + CARD_W <= frame.x + frame.w && y + CONTAINER_H <= frame.y + frame.h })
          .toEqual({ id, inside: true })
      }
    }
  })

  it('12 个容器三组装箱保持单屏宽度与非负坐标', () => {
    const nodes = Array.from({ length: 12 }, (_, index) => containerNode(`c${index}`, { dir: `p/${index % 3}` }))
    const layout = layoutScopeCards(nodes, [], { width: 1200 })
    expect(layout.bounds.w).toBeLessThanOrEqual(1200)
    expect(Object.values(layout.positions).every(([x, y]) => x >= 0 && y >= 0)).toBe(true)
    expect(layout.layers).toEqual({})
    expect(layout.layerCount).toBe(0)
  })

  it('相邻交换后的群组 cost 不高于初始序：按节点边权×群组中心欧氏距离复算', () => {
    const nodes = [
      containerNode('a', { dir: 'p/a' }), containerNode('b', { dir: 'p/b' }),
      containerNode('c', { dir: 'p/c' }), containerNode('d', { dir: 'p/d' }),
    ]
    const edges: ScopeEdge[] = [
      { key: 'a->b', from: 'a', to: 'b', weight: 1, kind: 'call' },
      { key: 'a->c', from: 'a', to: 'c', weight: 1, kind: 'call' },
    ]
    const layout = layoutScopeCards(nodes, edges, { width: 1200 })
    const initialFrames = layout.packageFrames
      .slice()
      .sort((a, b) => a.dir.localeCompare(b.dir))
      .map((frame, index) => ({
        ...frame,
        x: 14 + (index % 2) * (frame.w + 30),
        y: 14 + Math.floor(index / 2) * (frame.h + 30),
      }))
    const initialCost = packageDistanceCost(initialFrames, edges)
    const arrangedCost = packageDistanceCost(layout.packageFrames, edges)
    expect({ arrangedCost, initialCost }).toEqual({
      arrangedCost: expect.any(Number),
      initialCost: expect.any(Number),
    })
    expect(arrangedCost).toBeLessThanOrEqual(initialCost)
  })

  it('edge path 三种形态均输出可绘制的 SVG path', () => {
    expect(scopeEdgePath(10, 20, 30, 160, 'forward')).toBe('M10,20 C10,52 30,128 30,160')
    expect(scopeEdgePath(30, 160, 10, 20, 'back')).toBe('M30,160 C58,160 58,20 10,20')
    expect(scopeEdgePath(10, 20, 30, 20, 'sibling')).toBe('M10,20 C10,43 30,43 30,20')
  })

  it('边框锚点三种形态落在矩形边框，不落中心', () => {
    const from = { x: 0, y: 0, w: CARD_W, h: CARD_H }
    const to = { x: 40, y: 200, w: CARD_W, h: CARD_H }
    expect(scopeEdgeAnchors(from, to, 'forward')).toEqual({
      x1: CARD_W / 2, y1: CARD_H, x2: 40 + CARD_W / 2, y2: 200,
    })
    expect(scopeEdgeAnchors(from, to, 'back')).toEqual({
      x1: CARD_W, y1: CARD_H / 2, x2: 40 + CARD_W, y2: 200 + CARD_H / 2,
    })
    expect(scopeEdgeAnchors(from, to, 'sibling')).toEqual({
      x1: CARD_W / 2, y1: CARD_H, x2: 40 + CARD_W / 2, y2: 200 + CARD_H,
    })
  })
})

describe('C14 缝 1：拓扑分层与孤立区', () => {
  it('调用链按源到目标分层：L0/L1/L2 坐标逐层向下', () => {
    const nodes = [domainNode('a'), domainNode('b'), domainNode('c')]
    const edges: ScopeEdge[] = [
      { key: 'a->b', from: 'a', to: 'b', weight: 1, kind: 'call' },
      { key: 'b->c', from: 'b', to: 'c', weight: 1, kind: 'call' },
    ]
    const layout = layoutScopeCards(nodes, edges)
    expect(layout.layers).toEqual({ a: 0, b: 1, c: 2 })
    expect(layout.layerCount).toBe(3)
    expect(layout.positions.a![1]).toBeLessThan(layout.positions.b![1])
    expect(layout.positions.b![1]).toBeLessThan(layout.positions.c![1])
    expect(layout.cyclicNodeIds).toEqual([])
    expect(layout.backEdgeKeys).toEqual([])
  })

  it('环内节点同层并标记回边：双向边的输出键序稳定', () => {
    const nodes = [domainNode('x'), domainNode('y')]
    const edges: ScopeEdge[] = [
      { key: 'x->y', from: 'x', to: 'y', weight: 1, kind: 'call' },
      { key: 'y->x', from: 'y', to: 'x', weight: 1, kind: 'call' },
    ]
    const layout = layoutScopeCards(nodes, edges)
    expect(layout.layers).toEqual({ x: 0, y: 0 })
    expect(layout.cyclicNodeIds).toEqual(['x', 'y'])
    expect(layout.backEdgeKeys).toEqual(['x->y', 'y->x'])
    expect(layout.positions.x![1]).toBe(layout.positions.y![1])
  })

  it('孤立节点不进层：projection 连接的两个孤立节点仍在底部孤立区', () => {
    const nodes = [
      domainNode('a'), domainNode('b'),
      domainNode('iso_b', { isolated: true }), domainNode('iso_a', { isolated: true }),
    ]
    const edges: ScopeEdge[] = [
      { key: 'a->b', from: 'a', to: 'b', weight: 1, kind: 'call' },
      { key: 'iso_a->iso_b:twin', from: 'iso_a', to: 'iso_b', weight: 1, kind: 'projection', projectionType: 'twin' },
    ]
    const layout = layoutScopeCards(nodes, edges)
    expect(layout.layers).toEqual({ a: 0, b: 1 })
    expect(layout.isolatedIds).toEqual(['iso_a', 'iso_b'])
    expect(layout.positions.iso_a![1]).toBeGreaterThan(layout.positions.b![1])
    expect(layout.positions.iso_a![1]).toBe(layout.positions.iso_b![1])
    expect(layout.positions.iso_a![0]).toBeLessThan(layout.positions.iso_b![0])
  })
})
