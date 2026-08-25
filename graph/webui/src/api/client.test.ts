import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchCodegraph, fetchCodegraphSource } from './client'

const jsonResponse = (value: unknown) => new Response(JSON.stringify(value), { status: 200, headers: { 'Content-Type': 'application/json' } })

/** rejectionOf 取出 promise 的失败对象，供逐字检查错误文案。
 *  用 then 的双回调而不是 .catch()：.catch() 的返回类型会并进成功分支的类型，
 *  拿到 `T | Error` 后访问 .message 过不了 tsc（build 会红，vitest 不会）。
 *  promise 意外成功时这里抛错，测试照样红，不会静默放行。 */
const rejectionOf = (p: Promise<unknown>): Promise<Error> =>
  p.then(
    () => { throw new Error('期望请求失败，实际却成功返回了') },
    (err: unknown) => (err instanceof Error ? err : new Error(String(err))),
  )

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

  it('additive-only 消费 decls：缺席、空对象和未知声明字段都不阻塞响应', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const base = {
      baseline: {
        meta: { project: 'demo', branch: 'main', commit: 'c', scannedAt: 'now', generator: 'test' },
        containers: {}, nodes: {}, edges: [],
      },
      views: {}, stale: [],
    }
    fetchMock.mockResolvedValueOnce(jsonResponse(base))
    const absent = await fetchCodegraph('demo')
    expect(absent.decls).toBeUndefined()

    fetchMock.mockResolvedValueOnce(jsonResponse({
      ...base,
      decls: {
        d_target: {
          domain: 'd_target', responsibility: '职责',
          invariants: [{ text: '规矩' }],
          lifecycle: { from: 'x.go#X', to: 'x.go#X' },
          stateMachine: [{ from: 'ready', to: 'done', anchor: 'x.go#X' }],
          futureProviderField: 'ignored by old consumers',
        },
      },
    }))
    const present = await fetchCodegraph('demo')
    expect(present.decls?.d_target).toMatchObject({
      domain: 'd_target', responsibility: '职责', invariants: [{ text: '规矩' }],
      lifecycle: { from: 'x.go#X', to: 'x.go#X' },
      stateMachine: [{ from: 'ready', to: 'done', anchor: 'x.go#X' }],
    })
    expect((present.decls?.d_target as unknown as { futureProviderField?: string }).futureProviderField).toBe('ignored by old consumers')

    fetchMock.mockResolvedValueOnce(jsonResponse({ ...base, decls: {} }))
    const empty = await fetchCodegraph('demo')
    expect(empty.decls).toEqual({})
  })

  // 401 文案会原样显示在错误态里（CodegraphPage 照抄 error 原文）。这个包挂在
  // 任意宿主下，文案里出现某个宿主专用的兑换命令，等于让其它宿主的用户照着
  // 敲一条本机没有的命令。保留「会话失效、重新登录」这层可观察性即可。
  it('401 文案宿主无关：说清是会话失效，不点名任何宿主的兑换命令', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    fetchMock.mockResolvedValueOnce(new Response('{}', { status: 401 }))
    await expect(fetchCodegraph('demo')).rejects.toThrow(/未授权/)

    fetchMock.mockResolvedValueOnce(new Response('{}', { status: 401 }))
    const err = await rejectionOf(fetchCodegraph('demo'))
    expect(err.message.toLowerCase()).not.toContain('handoff')
    expect(err.message).toContain('会话')
  })

  it('非 401 错误照抄服务端 error 原文，不改写不吞掉', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ error: '项目 aio 未生成代码图' }), { status: 404 }))
    await expect(fetchCodegraph('aio')).rejects.toThrow('项目 aio 未生成代码图')
  })

  // 兜底文案（服务端没给 error、或压根没连上）同样会显示给用户，同样不能点名
  // 某个宿主的进程名——「agentd」只是 handoff 那边守护进程的名字。
  it('兜底错误文案宿主无关：不点名任何宿主的进程名', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    fetchMock.mockResolvedValueOnce(new Response('not json', { status: 500, statusText: 'Internal Server Error' }))
    const httpErr = await rejectionOf(fetchCodegraph('demo'))
    expect(httpErr.message).not.toContain('agentd')
    expect(httpErr.message).toContain('500')

    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    const netErr = await rejectionOf(fetchCodegraph('demo'))
    expect(netErr.message).not.toContain('agentd')
    expect(netErr.message).toContain('Failed to fetch')
  })
})
