import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchCodegraph, fetchCodegraphSource } from './client'

const jsonResponse = (value: unknown) => new Response(JSON.stringify(value), { status: 200, headers: { 'Content-Type': 'application/json' } })

describe('codegraph JSON transport', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('保留新增 wire 字段，并区分缺失 from 与 from=0', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    fetchMock.mockResolvedValueOnce(jsonResponse({
      baseline: {
        meta: { project: 'demo', branch: 'main', commit: 'c', scannedAt: 'now', generator: 'test' },
        containers: {},
        nodes: { n: { kind: 'func', container: 'c', name: 'N', file: 'x.go', line: 1 } },
        edges: [],
        implements: [['impl', 'iface']],
        projections: [['p', 'm', 'typed']],
        lifecycle: [{ who: 'creator', model: 'M', kind: 'creator' }],
      },
      views: { branch: {
        view: 'branch',
        containersAdded: { c2: { label: 'C2', kind: 'svc' } },
        implementsAdded: [['impl2', 'iface2']], implementsDeleted: [['impl0', 'iface0']],
        projectionsAdded: [['p2', 'm2', 'handroll']], projectionsDeleted: [['p0', 'm0', 'twin']],
        lifecycleAdded: [{ who: 'writer', model: 'M', kind: 'writer', field: 'state' }],
        lifecycleDeleted: [{ who: 'old', model: 'M', kind: 'writer' }],
      } },
      stale: [],
    }))
    const graph = await fetchCodegraph('a/b 中文')
    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/projects/a%2Fb%20%E4%B8%AD%E6%96%87/codegraph', { credentials: 'same-origin' })
    expect(graph.baseline.implements).toEqual([['impl', 'iface']])
    expect(graph.baseline.projections).toEqual([['p', 'm', 'typed']])
    expect(graph.baseline.lifecycle?.[0]?.kind).toBe('creator')
    expect(graph.baseline.nodes.n.projScanned).toBeUndefined()
    expect(graph.views.branch.containersAdded?.c2.label).toBe('C2')
    expect(graph.views.branch.implementsAdded).toEqual([['impl2', 'iface2']])
    expect(graph.views.branch.projectionsAdded).toEqual([['p2', 'm2', 'handroll']])
    expect(graph.views.branch.lifecycleAdded?.[0]?.field).toBe('state')

    fetchMock.mockResolvedValueOnce(jsonResponse({ file: 'x.go', lines: [] }))
    const missing = await fetchCodegraphSource('demo', 'x.go', 0)
    expect((missing as unknown as { from?: number }).from).toBeUndefined()
    fetchMock.mockResolvedValueOnce(jsonResponse({ file: 'x.go', from: 0, lines: [] }))
    const zero = await fetchCodegraphSource('demo', 'x.go', 0)
    expect(zero.from).toBe(0)
    expect(fetchMock).toHaveBeenNthCalledWith(3, '/api/projects/demo/codegraph/source?file=x.go&line=0&span=40', { credentials: 'same-origin' })
  })
})
