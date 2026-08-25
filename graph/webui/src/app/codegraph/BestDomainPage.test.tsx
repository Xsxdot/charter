import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { CgBest, CgDomainDecls, CgGraph } from '../../api/types'
import { BestDomainPage } from './BestDomainPage'

vi.mock('../../api/client', () => ({
  fetchCodegraphSource: vi.fn(),
}))

function pageFixture(): { baseline: CgGraph; best: CgBest; decls: CgDomainDecls } {
  const baseline: CgGraph = {
    meta: { project: 'demo', branch: 'main', commit: 'abc', scannedAt: '', generator: 'test' },
    domains: {
      d_source: { label: '现状来源', kind: 'logic' },
      d_target: { label: '现状目标', kind: 'logic' },
    },
    containers: {
      c_source: { label: '来源容器', kind: 'logic', domain: 'd_source' },
      c_target: { label: '目标容器', kind: 'logic', domain: 'd_target' },
    },
    nodes: {
      source: { kind: 'func', container: 'c_source', name: 'Source', file: 'src/source.go', line: 3 },
      focus: { kind: 'func', container: 'c_target', name: 'Focus', file: 'src/focus.go', line: 7 },
      entity: { kind: 'model', modelKind: 'entity', container: 'c_target', name: 'Entity', file: 'src/entity.go', line: 2 },
      next: { kind: 'func', container: 'c_target', name: 'Next', file: 'src/next.go', line: 9 },
    },
    edges: [['source', 'focus'], ['focus', 'next'], ['entity', 'source']],
    lifecycle: [{ who: 'source', model: 'entity', kind: 'creator' }],
    packages: { src: { summary: '代码包' } },
  }
  const best: CgBest = {
    meta: { version: 1, project: 'demo' },
    domains: {
      d_source: { label: '最优来源', type: 'logic' },
      d_target: { label: '最优目标', type: 'logic' },
    },
    containers: { c_source: 'd_source', c_target: 'd_target' },
  }
  const decls: CgDomainDecls = {
    d_target: {
      domain: 'd_target',
      responsibility: '目标职责',
      invariants: [{ text: '不可破规则', testRef: 'TestGuard' }],
      lifecycle: { from: 'src/focus.go#Focus', to: 'src/focus.go#Focus' },
      stateMachine: [{ from: 'ready', to: 'running', anchor: 'src/focus.go#Focus' }],
    },
  }
  return { baseline, best, decls }
}

function renderPage(overrides: Partial<Parameters<typeof BestDomainPage>[0]> = {}) {
  const { baseline, best, decls } = pageFixture()
  return render(<BestDomainPage
    project="demo"
    baseline={baseline}
    best={best}
    decls={decls}
    domainId="d_target"
    migrationItems={[]}
    selectedContainer=""
    onSelectContainer={vi.fn()}
    {...overrides}
  />)
}

describe('BestDomainPage', () => {
  it('renders the semantic card subtitles and named port sections', () => {
    const { baseline } = pageFixture()
    baseline.edges = [['source', 'focus']]
    renderPage({ baseline })

    expect(screen.getByText('状态机')).toBeTruthy()
    expect(screen.getByText('合法迁移表')).toBeTruthy()
    expect(screen.getByText('生命周期')).toBeTruthy()
    expect(screen.getByText('创建 → 终结')).toBeTruthy()
    expect(screen.getByText('包职责')).toBeTruthy()
    expect(screen.getByText('机械层 · packages 段')).toBeTruthy()

    fireEvent.click(screen.getByRole('tab', { name: '结构' }))
    expect(screen.getByText('调进来（入边来源）')).toBeTruthy()
    expect(screen.getByText('调出去（出边去向）')).toBeTruthy()
    expect(screen.getByText('无跨域出边')).toBeTruthy()
  })

  it('shows focus quota and cascade level truncation in the page', () => {
    const { baseline } = pageFixture()
    for (let index = 1; index <= 6; index += 1) {
      const callerId = `extra-caller-${index}`
      baseline.nodes[callerId] = {
        kind: 'func', container: 'c_source', name: callerId, file: `src/${callerId}.go`, line: index,
      }
      baseline.edges.push([callerId, 'focus'])
    }
    for (let index = 1; index <= 9; index += 1) {
      const nodeId = `extra-callee-${index}`
      baseline.nodes[nodeId] = {
        kind: 'func', container: 'c_target', name: nodeId, file: `src/${nodeId}.go`, line: index,
      }
      baseline.edges.push(['focus', nodeId])
    }

    renderPage({ baseline })
    fireEvent.click(screen.getByRole('tab', { name: '结构' }))
    expect(screen.getByText('入缝 7 条，按配额显示前 5')).toBeTruthy()

    fireEvent.click(screen.getAllByTestId('domain-lane')[0])
    expect(screen.getByText(/本级已截断，丢弃 2 个节点/)).toBeTruthy()
  })

  it('renders semantic intent before mechanics, then switches to structure without a fetch', () => {
    renderPage()
    expect(screen.getByRole('tab', { name: '语义' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByTestId('semantic-intended')).toBeTruthy()
    expect(screen.getByTestId('semantic-mechanical')).toBeTruthy()
    expect(screen.getByText('目标职责')).toBeTruthy()
    expect(screen.getByText(/不可破规则/)).toBeTruthy()
    expect(screen.getByText(/ready → running/)).toBeTruthy()
    expect(screen.getByText(/Entity/)).toBeTruthy()
    expect(screen.getByText(/src · 代码包/)).toBeTruthy()

    fireEvent.click(screen.getByRole('tab', { name: '结构' }))
    expect(screen.getByRole('tab', { name: '结构' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByTestId('inbound-port-d_source').textContent).toContain('1')
    expect(screen.getByTestId('outbound-port-d_source').textContent).toContain('1')
    expect(screen.getByTestId('domain-lane')).toBeTruthy()
    expect(screen.queryByText('取代码图失败')).toBeNull()
  })

  it('shows actionable empty states instead of generic no-data text', () => {
    const { baseline, best } = pageFixture()
    baseline.nodes = {}
    baseline.edges = []
    baseline.lifecycle = []
    renderPage({ baseline, best, decls: undefined })
    expect(screen.getByText(/声明是人写的应然承诺，扫描器不生成/)).toBeTruthy()
    expect(screen.getByText(/没有不变式声明/)).toBeTruthy()
    expect(screen.getByText(/实体表只列 modelKind=entity/)).toBeTruthy()
    fireEvent.click(screen.getByRole('tab', { name: '结构' }))
    expect(screen.getByText(/本域没有跨域入边/)).toBeTruthy()
    expect(screen.queryByTestId('domain-lane')).toBeNull()
  })

  it('keeps declaration and coverage on the best key while switching to current organization', () => {
    renderPage()
    expect(screen.getByTestId('declared-coverage').textContent).toBe('声明覆盖 1/2')
    fireEvent.click(screen.getByRole('button', { name: '按现状领域' }))
    expect(screen.getByTestId('best-domain-page')).toHaveAttribute('data-organization', 'current')
    expect(screen.getByText('目标职责')).toBeTruthy()
    expect(screen.getByTestId('declared-coverage').textContent).toBe('声明覆盖 1/2')
  })

  it('disables best organization when the best graph is absent', () => {
    const { baseline, decls } = pageFixture()
    renderPage({ baseline, best: undefined, decls })
    expect(screen.getByRole('button', { name: '按最优树' })).toBeDisabled()
    expect(screen.getByTestId('best-domain-page')).toHaveAttribute('data-organization', 'current')
  })
})
