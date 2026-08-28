import { describe, expect, it } from 'vitest'
import type { CgFlowStep } from '../../api/types'
import { layoutFlowSteps } from './flowlayout'

const step = (id: string, kind: CgFlowStep['kind'], extra: Partial<CgFlowStep> = {}): CgFlowStep => ({ id, order: Number(id.replace(/\D/g, '') || 0), kind, line: 1, ...extra })

describe('C17 flowlayout：流程形态与蛇形折列', () => {
  it('layoutFlowStepsKeepsGuardReturnsOffLinear', () => {
    const layout = layoutFlowSteps([
      step('branch', 'branch', { cond: 'err', then: ['guard'], else: ['next'] }),
      step('guard', 'return'),
      step('next', 'call', { to: 'done' }),
      step('done', 'return'),
    ] as never, 900)
    expect(layout.nodes.find((node) => node.id === 'guard')?.guardReturn).toBe(true)
    expect(layout.sequence).not.toContain('guard')
    expect(layout.childEdges).toContainEqual({ from: 'branch', to: 'guard', label: '是' })
  })

  it('layoutFlowStepsProducesSnakeColumns', () => {
    const steps = Array.from({ length: 12 }, (_, index) => step(`s${index}`, 'call', { to: `t${index}` }))
    const first = layoutFlowSteps(steps, 600)
    const second = layoutFlowSteps(steps, 600)
    expect(second).toEqual(first)
    expect(first.cols).toBeGreaterThan(1)
    const byCol = first.nodes.filter((node) => !node.guardReturn)
    expect(Math.max(...byCol.map((node) => node.col))).toBeGreaterThan(0)
    const odd = byCol.find((node) => node.col === 1)
    const even = byCol.find((node) => node.col === 0)
    expect(odd?.y).not.toBe(even?.y)
    expect(first.wraps.length).toBeGreaterThan(0)
    expect(Object.keys(first).some((key) => key.toLowerCase().includes('label'))).toBe(false)
  })

  it('layoutFlowStepsMapsAllKinds', () => {
    const layout = layoutFlowSteps([
      step('call', 'call'), step('branch', 'branch', { cond: 'x', then: [] }),
      step('loop', 'loop', { cond: 'x', body: [] }), step('return', 'return'),
      { ...step('unknown', 'call'), kind: 'future' as never },
    ] as never, 900)
    expect(Object.fromEntries(layout.nodes.map((node) => [node.id, node.shape]))).toMatchObject({
      call: 'rect', branch: 'diamond', loop: 'loop', return: 'terminal', unknown: 'unknown',
    })
  })
})
