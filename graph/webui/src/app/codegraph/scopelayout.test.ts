import { describe, expect, it } from 'vitest'
import type { ScopeEdge, ScopeNode } from './scopepage'
import { CARD_H, CARD_W, CONTAINER_H, EXT_H, EXT_W, layoutScopeCards } from './scopelayout'

// 夹具纪律（沿 K2/K3 同款）：断言只走 layoutScopeCards 一个入口；期望值硬编码。
function domainNode(id: string, overrides: Partial<ScopeNode> = {}): ScopeNode {
  return {
    id,
    kind: 'domain',
    label: id,
    type: 'logic',
    external: false,
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
    invariants: { state: 'no-decl' },
    debt: null,
    ...overrides,
  }
}

function containerNode(id: string, overrides: Partial<ScopeNode> = {}): ScopeNode {
  return domainNode(id, { kind: 'container', type: '函数组', dir: 'p/one', invariants: null, ...overrides })
}

describe('C12.4 scopelayout：确定性与覆盖', () => {
  it('同一输入两次调用逐位相同（零随机数纪律）', () => {
    const nodes = [domainNode('a'), domainNode('b'), containerNode('c')]
    const edges: ScopeEdge[] = [{ key: 'a->b', from: 'a', to: 'b', weight: 3, kind: 'call' }]
    expect(layoutScopeCards(nodes, edges)).toEqual(layoutScopeCards(nodes, edges))
  })

  it('每张输入卡都有坐标；空输入返回空布局不崩溃', () => {
    const nodes = [domainNode('a'), domainNode('b'), domainNode('ext:x', { external: true }), domainNode('iso', { isolated: true })]
    const layout = layoutScopeCards(nodes, [])
    expect(Object.keys(layout.positions).sort()).toEqual(['a', 'b', 'ext:x', 'iso'])
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
        const aw = nodes[i].external ? EXT_W : CARD_W
        const ah = nodes[i].kind === 'container' ? CONTAINER_H : nodes[i].external ? EXT_H : CARD_H
        const bw = nodes[j].external ? EXT_W : CARD_W
        const bh = nodes[j].kind === 'container' ? CONTAINER_H : nodes[j].external ? EXT_H : CARD_H
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

  it('域外引用卡摆在本层内容外圈：整体在内部包围盒之外', () => {
    const nodes = [
      domainNode('a'),
      domainNode('b'),
      domainNode('ext:y', { external: true }),
      domainNode('ext:z', { external: true }),
    ]
    const edges: ScopeEdge[] = [
      { key: 'a->b', from: 'a', to: 'b', weight: 1, kind: 'call' },
      { key: 'a->ext:y', from: 'a', to: 'ext:y', weight: 1, kind: 'call' },
    ]
    const { positions } = layoutScopeCards(nodes, edges)
    const innerX0 = Math.min(positions.a![0], positions.b![0])
    const innerX1 = Math.max(positions.a![0] + CARD_W, positions.b![0] + CARD_W)
    const innerY0 = Math.min(positions.a![1], positions.b![1])
    const innerY1 = Math.max(positions.a![1] + CARD_H, positions.b![1] + CARD_H)
    for (const id of ['ext:y', 'ext:z']) {
      const [x, y] = positions[id]!
      const outside = x + EXT_W < innerX0 - 8 || x > innerX1 + 8 || y + EXT_H < innerY0 - 8 || y > innerY1 + 8
      expect({ id, outside }).toEqual({ id, outside: true })
    }
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
