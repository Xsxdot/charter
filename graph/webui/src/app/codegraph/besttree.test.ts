import { describe, expect, it } from 'vitest'
import type { CgBest, CgCheckReport, CgGraph, CgTarget } from '../../api/types'
import {
  aggregateBestCards,
  assembleDirections,
  bestSubsystems,
  bestScopeGraph,
  classifyFinding,
  containerFacts,
  containerSubsystems,
  debtReadout,
  directionDetail,
  enforcementReadout,
  groupContainersBySubdomain,
  isBestLeaf,
  migrationGroups,
  subsystemOf,
  topLevelSubsystemIds,
} from './besttree'

const best: CgBest = {
  meta: { version: 1, project: 'demo' },
  domains: {
    ss_api: { label: 'API 子系统', responsibility: '对外服务', type: 'boundary' },
    api_read: { label: '读取领域', responsibility: '查询', parent: 'ss_api' },
    api_read_detail: { label: '读取详情', responsibility: '详情查询', parent: 'api_read' },
    ss_store: { label: '存储子系统', responsibility: '持久化', type: 'logic' },
    store_db: { label: '数据库领域', responsibility: '数据库', parent: 'ss_store' },
  },
  containers: {
    c_api: 'api_read',
    c_api_detail: 'api_read_detail',
    c_store: 'store_db',
  },
}

const target: CgTarget = {
  meta: { version: 3, project: 'demo' },
  contracts: [
    { from: 'ss_api', to: 'ss_store', legacyBudget: 2 },
    { from: 'ss_store', to: 'ss_api', legacyBudget: 0 },
  ],
}

const report: CgCheckReport = {
  fails: [
    { kind: 'dead-contract', from: 'ss_api', to: 'ss_store', detail: '未建成' },
    { kind: 'new-direction', from: 'ss_store', to: 'ss_unknown', detail: '未声明' },
  ],
  warns: [
    { kind: 'container-misplaced', from: 'c_api', detail: '容器归属不一致' },
    { kind: 'container-misplaced', from: 'c_api_detail', detail: '容器归属不一致' },
    { kind: 'container-unplaced', from: 'c_missing', detail: '未归属' },
    { kind: 'some-future-kind', detail: '未来词' },
  ],
  legacyHits: {
    'ss_api->ss_store': 3,
    'ss_store->ss_api': 0,
  },
}

describe('besttree', () => {
  it('枚举顶层子系统、沿 parent 链上溯，并在成环时停止', () => {
    expect(topLevelSubsystemIds(best)).toEqual(['ss_api', 'ss_store'])
    expect(bestSubsystems(best).find((s) => s.id === 'ss_api')?.descendantIds)
      .toEqual(['api_read', 'api_read_detail'])
    expect(subsystemOf(best, 'api_read_detail')).toBe('ss_api')
    expect(subsystemOf(best, 'unknown')).toBe('')

    const cycle: CgBest = { ...best, domains: {
      a: { label: 'a', responsibility: 'a', parent: 'b' },
      b: { label: 'b', responsibility: 'b', parent: 'a' },
    } }
    expect(subsystemOf(cycle, 'a')).toBe('')
  })

  it('把 best 容器归属 join 到顶层子系统', () => {
    expect(containerSubsystems(best)).toEqual({ c_api: 'ss_api', c_api_detail: 'ss_api', c_store: 'ss_store' })
  })

  it('把 misplaced 计到应然归属侧，并聚合容器数与全部嵌套领域数', () => {
    const cards = aggregateBestCards(best, report)
    expect(cards.ss_api).toMatchObject({ containerCount: 2, misplacedCount: 2, subdomainCount: 2 })
    expect(cards.ss_store).toMatchObject({ containerCount: 1, misplacedCount: 0, subdomainCount: 1 })
  })

  it('方向只来自 target/report：直调数读 legacyHits，预算、未声明和未建成状态可区分', () => {
    const directions = assembleDirections(target, report)
    expect(directions).toEqual([
      expect.objectContaining({
        key: 'ss_api->ss_store', directCalls: 3, legacyBudget: 2,
        declared: true, overBudget: true, deadContract: true, status: 'dead-contract',
      }),
      expect.objectContaining({
        key: 'ss_store->ss_api', directCalls: 0, legacyBudget: 0,
        declared: true, status: 'declared',
      }),
      expect.objectContaining({
        key: 'ss_store->ss_unknown', directCalls: 0,
        declared: false, newDirection: true, status: 'new-direction',
      }),
    ])
  })

  it('未知 finding kind 走缺省分类，横幅读数按 fails/misplaced/unplaced 计数', () => {
    expect(classifyFinding('some-future-kind')).toBe('unknown')
    expect(() => aggregateBestCards(best, report)).not.toThrow()
    expect(enforcementReadout(report)).toEqual({ fails: 2, misplaced: 2, unplaced: 1 })
    expect(enforcementReadout()).toBeNull()
  })
})

describe('C1.9 debt and migration projections', () => {
  it('区分 report 缺席、target 缺席和明确零值，并计算四件套', () => {
    const targetWithEntries: CgTarget = { ...target, contracts: [
      { from: 'ss_api', to: 'ss_store', entries: ['read'], legacyBudget: 2 },
      { from: 'ss_store', to: 'ss_api', entries: ['write'], legacyBudget: 0 },
      { from: 'ss_api', to: 'ss_api_read', entries: [], legacyBudget: 1 },
    ] }
    const reportWithZero: CgCheckReport = { ...report,
      fails: [...report.fails, { kind: 'over-budget', from: 'ss_api', to: 'ss_store', detail: '超预算' }],
      legacyHits: { 'ss_api->ss_store': 3, 'ss_store->ss_api': 0 },
    }
    expect(debtReadout(targetWithEntries, reportWithZero)).toEqual({
      fails: 3, directCalls: 3, coveredDirections: 2, totalDirections: 3,
      misplaced: 2, bidirectionalPairs: 1, targetAvailable: true,
    })
    expect(debtReadout(undefined, reportWithZero)).toMatchObject({
      directCalls: 3, coveredDirections: 0, totalDirections: 0, targetAvailable: false,
    })
    expect(debtReadout(targetWithEntries, undefined)).toBeNull()
  })

  it('按应然领域分组全部 misplaced，稳定排序并保留未知目标组', () => {
    const baselineWithDomains: CgGraph = { ...graph,
      domains: { old: { label: '现状旧域', kind: 'logic' }, current: { label: '现状域', kind: 'logic' } },
      containers: { ...graph.containers,
        c_api: { ...graph.containers.c_api, domain: 'old' },
        c_api_detail: { ...graph.containers.c_api_detail, domain: 'current' },
      },
    }
    const groups = migrationGroups(best, baselineWithDomains, report)
    expect(groups.map((group) => [group.expectedDomainId, group.count])).toEqual([
      ['api_read', 1], ['api_read_detail', 1],
    ])
    expect(groups[0].items[0]).toMatchObject({
      containerId: 'c_api', containerLabel: 'API 容器', currentDomainLabel: '现状旧域',
      expectedDomainLabel: '读取领域', expectedSubsystemId: 'ss_api',
    })
  })

  it('双向环只由互逆 contract 对构成，单向方向不得冒充环对', () => {
    // 判别力夹具：1 对互逆 + 2 条无反向的单向。互逆判据反转时会把两条单向计成 2 对——必须红。
    const mutualAndOneWay: CgTarget = { ...target, contracts: [
      { from: 'ss_api', to: 'ss_store', entries: [] },
      { from: 'ss_store', to: 'ss_api', entries: [] },
      { from: 'ss_api', to: 'ss_x', entries: [] },
      { from: 'ss_store', to: 'ss_y', entries: [] },
    ] }
    expect(debtReadout(mutualAndOneWay, report)?.bidirectionalPairs).toBe(1)
  })

  it('方向详情保留窄缝、明确零值和反向对端', () => {
    const targetWithEntries: CgTarget = { ...target, contracts: [
      { from: 'ss_api', to: 'ss_store', entries: ['read'], legacyBudget: 2 },
      { from: 'ss_store', to: 'ss_api', entries: [], legacyBudget: 0 },
    ] }
    expect(directionDetail('ss_store->ss_api', targetWithEntries, report)).toEqual({
      key: 'ss_store->ss_api', from: 'ss_store', to: 'ss_api', directCalls: 0,
      legacyBudget: 0, narrowEntries: [], counterpartKey: 'ss_api->ss_store', bidirectional: true,
    })
    expect(directionDetail('missing->direction', targetWithEntries, report)).toBeNull()
  })

  it('递归投影只给直接子领域，圈外折成 ext 卡，叶子可判定', () => {
    const nestedTarget: CgTarget = { ...target, contracts: [
      { from: 'api_read', to: 'api_read_detail', entries: ['detail'] },
      { from: 'api_read', to: 'ss_store', entries: ['store'] },
    ] }
    const nested = bestScopeGraph(best, nestedTarget, report, 'ss_api')
    expect(nested.leaf).toBe(false)
    expect(nested.cards.map((card) => [card.id, card.external])).toEqual([
      ['api_read', false], ['ext:ss_store', true],
    ])
    expect(nested.edges).toEqual([
      { key: 'api_read->ext:ss_store', from: 'api_read', to: 'ext:ss_store', directCalls: 0, directions: ['api_read->ss_store'] },
    ])
    expect(bestScopeGraph(best, nestedTarget, report, 'api_read').leaf).toBe(false)
    expect(isBestLeaf(best, 'api_read_detail')).toBe(true)
  })
})

describe('groupContainersBySubdomain', () => {
  it('按嵌套层级前序折成分组，depth 与 totalCount 逐层累计', () => {
    const groups = groupContainersBySubdomain(best, 'ss_api')
    expect(groups.map((group) => [group.domainId, group.depth, group.containerIds, group.totalCount])).toEqual([
      ['ss_api', 0, [], 2],
      ['api_read', 1, ['c_api'], 2],
      ['api_read_detail', 2, ['c_api_detail'], 1],
    ])
  })

  it('整棵子树没有容器的领域不出现', () => {
    const barren: CgBest = {
      meta: { version: 1, project: 'demo' },
      domains: {
        ss_x: { label: 'X', responsibility: '' },
        x_empty: { label: '空领域', responsibility: '', parent: 'ss_x' },
        x_used: { label: '有容器', responsibility: '', parent: 'ss_x' },
      },
      containers: { c_one: 'x_used' },
    }
    expect(groupContainersBySubdomain(barren, 'ss_x').map((group) => group.domainId)).toEqual(['ss_x', 'x_used'])
  })

  it('子系统整体无容器或 id 未知时返回空数组', () => {
    expect(groupContainersBySubdomain(best, 'ss_unknown')).toEqual([])
  })
})

const graph: CgGraph = {
  meta: { project: 'demo', branch: 'main', commit: 'abc', scannedAt: 'today', generator: 'test' },
  containers: {
    c_api: { label: 'API 容器', kind: '类型方法' },
    c_api_detail: { label: '详情容器', kind: '类型方法' },
    c_store: { label: '存储容器', kind: '实体' },
    c_split: { label: '跨目录容器', kind: '函数组' },
  },
  nodes: {
    n1: { kind: 'func', container: 'c_api', name: 'A', file: 'internal/api/a.go', line: 1 },
    n2: { kind: 'func', container: 'c_api', name: 'B', file: 'internal/api/b.go', line: 1 },
    n3: { kind: 'func', container: 'c_api_detail', name: 'C', file: 'internal/api/detail/c.go', line: 1 },
    n4: { kind: 'model', container: 'c_store', name: 'D', file: 'internal/store/d.go', line: 1 },
    n5: { kind: 'func', container: 'c_split', name: 'E', file: 'internal/one/e.go', line: 1 },
    n6: { kind: 'func', container: 'c_split', name: 'F', file: 'internal/two/f.go', line: 1 },
  },
  edges: [],
}

describe('containerFacts', () => {
  it('目录唯一时给出包目录，并数出节点数', () => {
    const facts = containerFacts(graph)
    expect(facts.c_api).toEqual({ dir: 'internal/api', nodeCount: 2 })
    expect(facts.c_api_detail).toEqual({ dir: 'internal/api/detail', nodeCount: 1 })
  })

  it('同一容器跨目录时不猜包目录，留空', () => {
    expect(containerFacts(graph).c_split).toEqual({ dir: '', nodeCount: 2 })
  })

  it('零节点容器仍然出现在结果里', () => {
    const empty: CgGraph = { ...graph, nodes: {} }
    expect(containerFacts(empty).c_api).toEqual({ dir: '', nodeCount: 0 })
  })
})

describe('groupContainersBySubdomain 的包分层', () => {
  it('按包目录折出二级分组，标签取目录最后一段', () => {
    const nested: CgBest = {
      meta: { version: 1, project: 'demo' },
      domains: { ss_x: { label: 'X', responsibility: '' } },
      containers: { c_api: 'ss_x', c_api_detail: 'ss_x', c_store: 'ss_x' },
    }
    const groups = groupContainersBySubdomain(nested, 'ss_x', containerFacts(graph))
    expect(groups[0].packages.map((pkg) => [pkg.dir, pkg.label, pkg.containerIds])).toEqual([
      ['internal/api', 'api', ['c_api']],
      ['internal/api/detail', 'detail', ['c_api_detail']],
      ['internal/store', 'store', ['c_store']],
    ])
  })

  it('缺 facts 时全部落进单个未归包分组，不凭容器 id 猜包', () => {
    const groups = groupContainersBySubdomain(best, 'ss_api')
    const readDomain = groups.find((group) => group.domainId === 'api_read')!
    expect(readDomain.packages).toEqual([{ dir: '', label: '未归包', containerIds: ['c_api'] }])
  })
})
