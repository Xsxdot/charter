import { describe, expect, it } from 'vitest'
import type { CgBest, CgCheckReport } from '../../api/types'
import { aggregateBestCards, bestSubsystems, containerSubsystems } from './besttree'

const best: CgBest = {
  meta: { version: 1, project: 'besttree-fixture' },
  domains: {
    root: { label: '根', type: 'logic' },
    child: { label: '子域', parent: 'root' },
  },
  containers: { c: 'child' },
}

describe('besttree', () => {
  it('从领域声明读取职责，不从 best 结构读取已删除字段', () => {
    expect(bestSubsystems(best, { root: { domain: 'root', responsibility: '声明职责' } })).toEqual([
      expect.objectContaining({ id: 'root', responsibility: '声明职责', childIds: ['child'] }),
    ])
    expect(bestSubsystems(best)).toEqual([expect.objectContaining({ responsibility: '' })])
  })

  it('沿最优树归属容器并聚合迁移计数', () => {
    expect(containerSubsystems(best)).toEqual({ c: 'root' })
    const report: CgCheckReport = { fails: [], warns: [{ kind: 'container-misplaced', from: 'c', detail: 'move' }] }
    expect(aggregateBestCards(best, report, { root: { domain: 'root', responsibility: '声明职责' } }).root).toEqual(
      expect.objectContaining({ containerCount: 1, misplacedCount: 1 }),
    )
  })
})
