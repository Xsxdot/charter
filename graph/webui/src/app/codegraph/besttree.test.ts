import { describe, expect, it } from 'vitest'
import type { CgBest, CgCheckReport, CgTarget } from '../../api/types'
import {
  aggregateBestCards,
  assembleDirections,
  bestSubsystems,
  classifyFinding,
  containerSubsystems,
  enforcementReadout,
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
