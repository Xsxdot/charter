import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CodegraphResp } from '../../api/types'
import { CodegraphPage } from './CodegraphPage'

// vi.mock 的工厂会被提升到文件顶部执行，直接引用普通的顶层 let 会踩
// 「Cannot access before initialization」。用 vi.hoisted 造一个可变容器，
// 每个用例改它就能换数据，不必 resetModules + 动态 import。
const state = vi.hoisted(() => ({
  data: null as unknown as import('../../api/types').CodegraphResp,
  error: '',
  loading: false,
  reloads: 0,
  fetchMock: vi.fn(),
  projects: [] as string[],
}))

const resp: CodegraphResp = {
  baseline: {
    meta: { project: 'demo', branch: 'main', commit: 'abc', scannedAt: '2026-08-21', generator: 'test' },
    domains: {
      d_cli: { label: 'cli', kind: '命令层', summary: '命令入口' },
      d_svc: { label: 'svc', kind: '服务端', summary: '服务与实体' },
      'd_svc/api': { label: 'api', kind: '服务端', summary: '对外方法', parent: 'd_svc' },
    },
    containers: {
      c_cli: { label: 'CLI 命令', kind: '入口', entry: true, domain: 'd_cli' },
      k_svc: { label: 'svc.Server', kind: '服务端', domain: 'd_svc/api' },
    },
    nodes: {
      e_run: { kind: 'entry', container: 'c_cli', name: 'demo run', file: 'cmd/run.go', line: 3 },
      n_runE: { kind: 'func', container: 'k_svc', name: 'runE', file: 'cmd/run.go', line: 5 },
    },
    edges: [['e_run', 'n_runE']],
  },
  views: {},
  stale: [],
}

const bestResp: CodegraphResp = {
  ...resp,
  best: {
    meta: { version: 1, project: 'demo' },
    domains: {
      s_api: { label: 'API 子系统', responsibility: '对外服务', type: 'boundary' },
      s_api_read: { label: '读取领域', responsibility: '查询', parent: 's_api' },
      s_api_read_detail: { label: '读取详情', responsibility: '详情查询', parent: 's_api_read' },
      s_store: { label: '存储子系统', responsibility: '持久化', type: 'logic' },
    },
    containers: { c_cli: 's_api_read', k_svc: 's_store' },
  },
  target: {
    meta: { version: 3, project: 'demo' },
    contracts: [{ from: 's_api', to: 's_store', legacyBudget: 1 }],
  },
  report: {
    fails: [{ kind: 'over-budget', from: 's_api', to: 's_store', detail: '超预算' }],
    warns: [
      { kind: 'container-misplaced', from: 'c_cli', detail: '放错位' },
      { kind: 'container-unplaced', from: 'c_missing', detail: '未归属' },
    ],
    legacyHits: { 's_api->s_store': 2 },
  },
  views: { branch: { view: 'branch:demo' } },
}

vi.mock('./useCodegraph', () => ({
  useCodegraph: (project: string) => {
    const firstRequest = !state.projects.includes(project)
    state.projects.push(project)
    if (firstRequest) state.fetchMock(project)
    return {
    data: state.data,
    error: state.error,
    loading: state.loading,
    reload: () => { state.reloads += 1; state.fetchMock(project) },
    }
  },
}))

vi.mock('../../api/client', () => ({
  fetchCodegraphSource: vi.fn().mockResolvedValue({ file: 'src/focus.go', from: 7, lines: [] }),
}))

// 只在 data 上做用例区分不够：空态/错误态是 error+data=null 的组合，
// 每个用例前必须把这三样一起复位，否则前一个用例的 error 会漏到下一个
beforeEach(() => {
  window.history.replaceState({}, '', '/?project=demo')
  state.data = resp
  state.error = ''
  state.loading = false
  state.reloads = 0
  state.fetchMock.mockReset()
  state.projects = []
})

describe('CodegraphPage 三态下钻', () => {
  it('从自身 URL 读取项目，不渲染项目下拉', () => {
    render(<CodegraphPage />)
    expect(state.projects).toEqual(['demo'])
    expect(screen.getAllByRole('combobox')).toHaveLength(1)
  })

  it('默认落在领域全景', async () => {
    const { container } = render(<CodegraphPage />)
    await waitFor(() => expect(container.querySelectorAll('[data-domain]').length).toBe(2))
    expect(screen.getByText('领域全景')).toBeTruthy()
  })
  it('进入有子领域的领域 → 再出一层全景；面包屑可逐级返回', async () => {
    const { container } = render(<CodegraphPage />)
    await waitFor(() => expect(container.querySelector('[data-domain="d_svc"]')).toBeTruthy())
    fireEvent.click(screen.getByTitle('下钻到领域内部：svc'))
    await waitFor(() => expect(container.querySelector('[data-domain="d_svc/api"]')).toBeTruthy())
    fireEvent.click(screen.getByText('◀ 领域全景'))
    await waitFor(() => expect(container.querySelector('[data-domain="d_cli"]')).toBeTruthy())
  })
  it('进入叶子领域 → 切到树+图视图', async () => {
    const { container } = render(<CodegraphPage />)
    await waitFor(() => expect(container.querySelector('[data-domain="d_cli"]')).toBeTruthy())
    fireEvent.click(screen.getByTitle('下钻到领域内部：cli'))
    await waitFor(() => expect(container.querySelectorAll('[data-node]').length).toBeGreaterThan(0))
    expect(container.querySelector('[data-domain]')).toBeNull()
  })
  it('进入叶子领域：默认焦点取本域的根，不是全图第一个入口', async () => {
    const { container } = render(<CodegraphPage />)
    await waitFor(() => expect(container.querySelector('[data-domain="d_svc"]')).toBeTruthy())
    fireEvent.click(screen.getByTitle('下钻到领域内部：svc'))
    await waitFor(() => expect(container.querySelector('[data-domain="d_svc/api"]')).toBeTruthy())
    fireEvent.click(screen.getByTitle('下钻到领域内部：api'))
    await waitFor(() => expect(container.querySelectorAll('[data-node]').length).toBeGreaterThan(0))
    // 焦点越界的症状：左树列的是本域的根，焦点图与右详情却停在域外节点上，
    // 两栏在讲两个不同领域的事。demo run 属于 d_cli，不能成为 d_svc/api 的默认焦点。
    expect(container.querySelector('h3')?.textContent).toBe('runE')
  })
  it('无领域数据：降级为单领域视图并给出提示', async () => {
    state.data = { ...resp, baseline: { ...resp.baseline, domains: undefined } }
    const { container } = render(<CodegraphPage />)
    await waitFor(() => expect(container.querySelectorAll('[data-node]').length).toBeGreaterThan(0))
    expect(container.querySelector('[data-domain]')).toBeNull()
    expect(screen.getByText(/未包含领域划分/)).toBeTruthy()
  })

  it('有 best 时 baseline 主视角切到理想树，并显示 gap 与执法读数', async () => {
    state.data = bestResp
    const { container } = render(<CodegraphPage />)
    await waitFor(() => expect(container.querySelectorAll('[data-best-subsystem]').length).toBe(2))
    expect(screen.getByText('理想树全景')).toBeTruthy()
    expect(container.querySelector('[data-gap="containers"]')).toBeTruthy()
    expect(container.querySelector('[data-debt="fails"]')?.textContent).toBe('fails 1')
    expect(container.querySelector('[data-domain]')).toBeNull()
  })

  it('有 best 无 report 时理想树照画且执法横幅显示无数据', async () => {
    state.data = { ...bestResp, report: undefined }
    const { container } = render(<CodegraphPage />)
    await waitFor(() => expect(container.querySelectorAll('[data-best-subsystem]').length).toBe(2))
    expect(container.querySelector('[data-debt="none"]')?.textContent).toBe('无数据')
  })

  it('点击理想子系统卡后接出理想详情面板', async () => {
    state.data = bestResp
    const { container } = render(<CodegraphPage />)
    await waitFor(() => expect(container.querySelector('[data-best-subsystem="s_api"]')).toBeTruthy())
    fireEvent.click(container.querySelector('[data-best-subsystem="s_api"]')!)
    await waitFor(() => expect(container.querySelector('[data-best-detail="s_api"]')).toBeTruthy())
    expect(container.querySelector('[data-best-domain="s_api_read"]')).toBeTruthy()
  })

  it('真实 JSON roundtrip 不混淆缺席与零值，零债务方向仍可见', async () => {
    const wire = JSON.parse(JSON.stringify({
      ...bestResp,
      target: { meta: { version: 3, project: 'demo' }, contracts: [
        { from: 's_api', to: 's_store', entries: [], legacyBudget: 0 },
      ] },
      report: { fails: [], warns: [], legacyHits: { 's_api->s_store': 0 } },
    })) as CodegraphResp
    state.data = wire
    const { container, rerender } = render(<CodegraphPage />)
    await waitFor(() => expect(container.querySelector('[data-best-direction="s_api->s_store"]')).toBeTruthy())
    expect(container.querySelector('[data-best-direction="s_api->s_store"]')?.textContent).toContain('欠 0')
    expect(container.querySelector('[data-debt="coverage"]')?.textContent).toBe('窄缝覆盖 0/1')
    state.data = JSON.parse(JSON.stringify({ ...wire, report: undefined })) as CodegraphResp
    rerender(<CodegraphPage />)
    await waitFor(() => expect(container.querySelector('[data-debt="none"]')).toBeTruthy())
    expect(container.querySelector('[data-debt="directCalls"]')).toBeNull()
  })

  it('迁移条目跳到应然子系统下钻并高亮容器，面包屑可逐级返回', async () => {
    state.data = bestResp
    const { container } = render(<CodegraphPage />)
    await waitFor(() => expect(container.querySelector('[data-migration-item="c_cli"]')).toBeTruthy())
    fireEvent.click(container.querySelector('[data-migration-item="c_cli"]')!)
    await waitFor(() => expect(container.querySelector('[data-best-scope-card="s_api_read"]')).toBeTruthy())
    expect(container.querySelector('[data-migration-item="c_cli"][data-selected="true"]')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '理想树全景' }))
    await waitFor(() => expect(container.querySelectorAll('[data-best-subsystem]').length).toBe(2))
  })

  it('best root → nested → leaf 逐层互斥，边选择显示方向详情', async () => {
    state.data = bestResp
    const { container } = render(<CodegraphPage />)
    await waitFor(() => expect(container.querySelector('[data-best-subsystem="s_api"]')).toBeTruthy())
    fireEvent.click(container.querySelector('[data-best-direction="s_api->s_store"]')!)
    await waitFor(() => expect(container.querySelector('[data-best-edge-detail]')).toBeTruthy())
    fireEvent.click(container.querySelector('[data-best-subsystem="s_api"]')!)
    await waitFor(() => expect(container.querySelector('[data-best-detail="s_api"]')).toBeTruthy())
    fireEvent.click(container.querySelector('[data-best-domain="s_api_read"] button')!)
    await waitFor(() => expect(container.querySelector('[data-best-scope-card="s_api_read_detail"]')).toBeTruthy())
    expect(container.querySelector('[data-best-subsystem]')).toBeNull()
    fireEvent.click(container.querySelector('[data-best-scope-card="s_api_read_detail"]')!)
    await waitFor(() => expect(container.querySelector('[data-best-domain-page="s_api_read_detail"]')).toBeTruthy())
    expect(container.querySelector('[data-best-scope-card]')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '理想树全景' }))
    await waitFor(() => expect(container.querySelectorAll('[data-best-subsystem]').length).toBe(2))
  })

  it('best 叶子接入领域页，decls 缺席显示声明空态而不是传输失败', async () => {
    state.data = { ...bestResp, decls: undefined }
    const { container } = render(<CodegraphPage />)
    await waitFor(() => expect(container.querySelector('[data-best-subsystem="s_api"]')).toBeTruthy())
    fireEvent.click(container.querySelector('[data-best-subsystem="s_api"]')!)
    await waitFor(() => expect(container.querySelector('[data-best-domain="s_api_read"] button')).toBeTruthy())
    fireEvent.click(container.querySelector('[data-best-domain="s_api_read"] button')!)
    await waitFor(() => expect(container.querySelector('[data-best-scope-card="s_api_read_detail"]')).toBeTruthy())
    fireEvent.click(container.querySelector('[data-best-scope-card="s_api_read_detail"]')!)
    await waitFor(() => expect(container.querySelector('[data-best-domain-page="s_api_read_detail"]')).toBeTruthy())
    expect(screen.getByText(/声明是人写的应然承诺，扫描器不生成/)).toBeTruthy()
    expect(screen.queryByText('取代码图失败')).toBeNull()
  })

  it('成功响应 decls 为空对象时显示声明空态而不是通用无数据或传输失败', async () => {
    state.data = { ...bestResp, decls: {} }
    const { container } = render(<CodegraphPage />)
    await waitFor(() => expect(container.querySelector('[data-best-subsystem="s_api"]')).toBeTruthy())
    fireEvent.click(container.querySelector('[data-best-subsystem="s_api"]')!)
    await waitFor(() => expect(container.querySelector('[data-best-domain="s_api_read"] button')).toBeTruthy())
    fireEvent.click(container.querySelector('[data-best-domain="s_api_read"] button')!)
    await waitFor(() => expect(container.querySelector('[data-best-scope-card="s_api_read_detail"]')).toBeTruthy())
    fireEvent.click(container.querySelector('[data-best-scope-card="s_api_read_detail"]')!)
    await waitFor(() => expect(container.querySelector('[data-best-domain-page="s_api_read_detail"]')).toBeTruthy())
    expect(screen.getByText(/声明是人写的应然承诺，扫描器不生成/)).toBeTruthy()
    expect(screen.queryByText('暂无数据')).toBeNull()
    expect(screen.queryByText('取代码图失败')).toBeNull()
  })

  it('成功响应含未知声明字段时仍渲染领域页', async () => {
    state.data = {
      ...bestResp,
      decls: {
        s_api_read_detail: {
          domain: 's_api_read_detail',
          responsibility: '详情查询',
          futureProviderField: 'ignored by old consumers',
        },
      },
    } as unknown as CodegraphResp
    const { container } = render(<CodegraphPage />)
    await waitFor(() => expect(container.querySelector('[data-best-subsystem="s_api"]')).toBeTruthy())
    fireEvent.click(container.querySelector('[data-best-subsystem="s_api"]')!)
    await waitFor(() => expect(container.querySelector('[data-best-domain="s_api_read"] button')).toBeTruthy())
    fireEvent.click(container.querySelector('[data-best-domain="s_api_read"] button')!)
    await waitFor(() => expect(container.querySelector('[data-best-scope-card="s_api_read_detail"]')).toBeTruthy())
    fireEvent.click(container.querySelector('[data-best-scope-card="s_api_read_detail"]')!)
    await waitFor(() => expect(container.querySelector('[data-best-domain-page="s_api_read_detail"]')).toBeTruthy())
    expect(container.querySelector('[data-best-domain-page="s_api_read_detail"]')).toBeTruthy()
  })

  it('领域页切 tab、组织、泳道和级联节点都不重复请求代码图', async () => {
    const requestResp: CodegraphResp = {
      ...bestResp,
      baseline: {
        ...bestResp.baseline,
        containers: {
          ...bestResp.baseline.containers,
          c_source: { label: 'source', kind: 'logic', domain: 'd_svc' },
          c_focus: { label: 'focus', kind: 'logic', domain: 'd_svc' },
        },
        nodes: {
          ...bestResp.baseline.nodes,
          source: { kind: 'func', container: 'c_source', name: 'Source', file: 'src/source.go', line: 3 },
          focus: { kind: 'func', container: 'c_focus', name: 'Focus', file: 'src/focus.go', line: 7 },
          next: { kind: 'func', container: 'c_focus', name: 'Next', file: 'src/next.go', line: 9 },
        },
        edges: [...bestResp.baseline.edges, ['source', 'focus'], ['focus', 'next']],
      },
      best: {
        ...bestResp.best!,
        containers: {
          ...bestResp.best!.containers,
          c_source: 's_store',
          c_focus: 's_api_read_detail',
        },
      },
    }
    state.data = requestResp
    const { container } = render(<CodegraphPage />)
    await waitFor(() => expect(container.querySelector('[data-best-subsystem="s_api"]')).toBeTruthy())
    expect(state.fetchMock).toHaveBeenCalledTimes(1)

    fireEvent.click(container.querySelector('[data-best-subsystem="s_api"]')!)
    await waitFor(() => expect(container.querySelector('[data-best-domain="s_api_read"] button')).toBeTruthy())
    fireEvent.click(container.querySelector('[data-best-domain="s_api_read"] button')!)
    await waitFor(() => expect(container.querySelector('[data-best-scope-card="s_api_read_detail"]')).toBeTruthy())
    fireEvent.click(container.querySelector('[data-best-scope-card="s_api_read_detail"]')!)
    await waitFor(() => expect(container.querySelector('[data-best-domain-page="s_api_read_detail"]')).toBeTruthy())

    fireEvent.click(screen.getByRole('tab', { name: '结构' }))
    expect(state.fetchMock).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('domain-lane')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: '按现状领域' }))
    expect(state.fetchMock).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: '按最优树' }))
    expect(state.fetchMock).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByTestId('domain-lane'))
    expect(state.fetchMock).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByTestId('cascade-node-focus'))
    expect(state.fetchMock).toHaveBeenCalledTimes(1)
  })

  it('选中分支视图时回落现状域全景并显示主线对照说明', async () => {
    state.data = bestResp
    const { container } = render(<CodegraphPage />)
    await waitFor(() => expect(container.querySelectorAll('[data-best-subsystem]').length).toBe(2))
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'branch' } })
    await waitFor(() => expect(container.querySelector('[data-domain="d_cli"]')).toBeTruthy())
    expect(container.querySelector('[data-best-subsystem]')).toBeNull()
    expect(screen.getByText(/分支视图暂用现状域全景/)).toBeTruthy()
  })
})

// 空态/错误态：内容区换掉，工具条必须留着。
// why 单独一组：这里验的不是「显示了什么文案」，而是「出错后还能不能换项目」
// ——原实现在 error 时整页 return，选中一个没扫过图的项目就再也换不回去了。
describe('CodegraphPage 非图状态', () => {
  it('项目没扫过图：给空态而不是红字，且只保留视图下拉', async () => {
    state.data = null as unknown as CodegraphResp
    state.error = '项目 aio 未生成代码图（无 codegraph/baseline.json）'
    render(<CodegraphPage />)
    await waitFor(() => expect(screen.getByText(/还没有代码图/)).toBeTruthy())
    expect(screen.getAllByRole('combobox')).toHaveLength(1)
    expect(screen.getByRole('button', { name: '刷新' })).toBeTruthy()
    // 「没扫过」不是故障，不该出现报错原文
    expect(screen.queryByText(/取代码图失败/)).toBeNull()
  })

  it('真出错：照抄报错原文并可重试，工具条同样留着', async () => {
    state.data = null as unknown as CodegraphResp
    state.error = 'agentd 不可达: connection refused'
    render(<CodegraphPage />)
    await waitFor(() => expect(screen.getByText('取代码图失败')).toBeTruthy())
    expect(screen.getByText(/connection refused/)).toBeTruthy()
    expect(screen.getAllByRole('combobox').length).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole('button', { name: '重试' }))
    expect(state.reloads).toBe(1)
  })

  it('加载中只说加载中，不提前判空', async () => {
    state.data = null as unknown as CodegraphResp
    state.loading = true
    render(<CodegraphPage />)
    await waitFor(() => expect(screen.getByText('加载中…')).toBeTruthy())
    expect(screen.queryByText(/还没有代码图/)).toBeNull()
  })

  // 这个包要发给任意宿主：空态是唯一一处「告诉用户下一步怎么办」的正文，
  // 一旦点名某个仓才有的文档路径，别的宿主用户点过去就是死链。
  it('空态措辞宿主无关：不点名任何具体仓的文档，也不提 handoff', async () => {
    state.data = null as unknown as CodegraphResp
    state.error = '项目 aio 未生成代码图（无 codegraph/baseline.json）'
    render(<CodegraphPage />)
    await waitFor(() => expect(screen.getByText(/还没有代码图/)).toBeTruthy())
    const copy = document.body.textContent ?? ''
    expect(copy).not.toMatch(/\.md\b/)
    expect(copy.toLowerCase()).not.toContain('handoff')
    // 去掉死链不等于去掉指引：产物落点必须还在，否则空态变成一句废话
    expect(copy).toContain('codegraph/baseline.json')
    expect(copy).toContain('刷新')
  })

  it('空 project 不发请求且仍可渲染空状态', () => {
    window.history.replaceState({}, '', '/?project=')
    state.data = null as unknown as CodegraphResp
    state.error = ''
    render(<CodegraphPage />)
    expect(state.projects).toEqual([''])
    expect(screen.getByText('还没有代码图')).toBeTruthy()
    expect(screen.getAllByRole('combobox')).toHaveLength(1)
  })
})
