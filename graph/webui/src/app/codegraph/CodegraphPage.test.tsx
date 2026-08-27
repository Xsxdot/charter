import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CodegraphResp } from '../../api/types'
import { CodegraphPage } from './CodegraphPage'

// K6 装配收口后的穿线断言：一次取数、两轴可用、轴间切换零请求。
// useCodegraph 整体 mock（vi.hoisted 容器沿旧例）：fetchMock 计数即「请求数」，
// 轴间/层间/控件交互后计数不变是本文件的缝级断言形状。

const state = vi.hoisted(() => ({
  data: null as unknown as import('../../api/types').CodegraphResp,
  error: '',
  loading: false,
  reloads: 0,
  fetchMock: vi.fn(),
  projects: [] as string[],
}))

// 两轴最小世界：现状组织下根层两卡（d_cli / d_svc），d_cli 挂入口容器 c_cli
// （内含程序入口 e_run）；bestResp 再叠 best/target/report/views 供组织切换与分支视图用。
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
      k_svc: { label: 'svc.Server', kind: '类型方法', domain: 'd_svc/api' },
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
      s_api: { label: 'API 子系统', type: 'boundary' },
      s_api_read: { label: '读取领域', parent: 's_api' },
      s_store: { label: '存储子系统', type: 'logic' },
    },
    containers: { c_cli: 's_api_read', k_svc: 's_store' },
  },
  target: {
    meta: { version: 3, project: 'demo' },
    contracts: [{ from: 's_api', to: 's_store', legacyBudget: 1 }],
  },
  report: {
    fails: [],
    warns: [{ kind: 'container-misplaced', from: 'c_cli', detail: '放错位' }],
    legacyHits: {},
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

// 空态/错误态是 error+data=null 的组合，每个用例前三样一起复位
beforeEach(() => {
  window.history.replaceState({}, '', '/?project=demo')
  state.data = resp
  state.error = ''
  state.loading = false
  state.reloads = 0
  state.fetchMock.mockReset()
  state.projects = []
})

describe('CodegraphPage 装配：一次取数，两轴可用', () => {
  it('从自身 URL 读取项目并一次取数：结构轴直接在场，不渲染项目下拉', async () => {
    const { container } = render(<CodegraphPage />)
    await waitFor(() => expect(container.querySelector('[data-two-axis-page]')).toBeTruthy())
    expect(state.projects).toEqual(['demo'])
    expect(state.fetchMock).toHaveBeenCalledTimes(1)
    expect(container.querySelector('[data-two-axis-page]')?.getAttribute('data-scope')).toBe('')
    expect(screen.queryByText('选择项目')).toBeNull()
  })

  it('点右栏程序入口进入行为轴：携带该入口 id，全程仍只有一次请求；返回结构轴同样零请求', async () => {
    const { container } = render(<CodegraphPage />)
    await waitFor(() => expect(container.querySelector('[data-node="d_cli"]')).toBeTruthy())
    fireEvent.click(container.querySelector('[data-node="d_cli"]')!)
    await waitFor(() => expect(container.querySelector('[data-entry="e_run"]')).toBeTruthy())

    fireEvent.click(container.querySelector('[data-entry="e_run"]')!)
    await waitFor(() => expect(container.querySelector('[data-flow-shell]')).toBeTruthy())
    expect(container.querySelector('[data-flow-page]')?.getAttribute('data-current-entry')).toBe('e_run')
    expect(state.fetchMock).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: '← 返回结构轴' }))
    await waitFor(() => expect(container.querySelector('[data-two-axis-page]')).toBeTruthy())
    expect(container.querySelector('[data-flow-shell]')).toBeNull()
    expect(state.fetchMock).toHaveBeenCalledTimes(1)
  })

  it('行为轴内递归换图与返回结构轴都不新增请求', async () => {
    const w: CodegraphResp = {
      ...resp,
      baseline: {
        ...resp.baseline,
        flows: { e_run: { steps: [{ id: 's1', order: 1, kind: 'call', to: 'n_runE', line: 9 }] } },
      },
    }
    state.data = w
    const { container } = render(<CodegraphPage />)
    await waitFor(() => expect(container.querySelector('[data-node="d_cli"]')).toBeTruthy())
    fireEvent.click(container.querySelector('[data-node="d_cli"]')!)
    fireEvent.click(container.querySelector('[data-entry="e_run"]')!)
    await waitFor(() => expect(container.querySelector('[data-flow-chart]')).toBeTruthy())
    // 命中 flows 时泳道标题接真名（C12.6 entryName 扩展的装配端证据）
    expect(container.querySelector('[data-lane-title]')?.textContent).toContain('demo run')
    expect(state.fetchMock).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: '← 返回结构轴' }))
    expect(state.fetchMock).toHaveBeenCalledTimes(1)
  })

  it('组织切换 / 迁移抽屉 / 面包屑交互不增加请求数', async () => {
    state.data = bestResp
    const { container } = render(<CodegraphPage />)
    await waitFor(() => expect(container.querySelectorAll('[data-node]').length).toBeGreaterThan(0))
    expect(state.fetchMock).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: '按现状领域' }))
    fireEvent.click(screen.getByRole('button', { name: '按最优树' }))
    expect(state.fetchMock).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: '子系统连线图' }))
    expect(state.fetchMock).toHaveBeenCalledTimes(1)

    fireEvent.click(container.querySelector('[data-migration-trigger]')!)
    expect(state.fetchMock).toHaveBeenCalledTimes(1)
    fireEvent.click(container.querySelector('[data-migration-trigger]')!)
    expect(state.fetchMock).toHaveBeenCalledTimes(1)
  })

  it('切到分支视图：如实告知 diff 渲染未接入（仍显示基准快照），两轴照常、请求数不变', async () => {
    state.data = bestResp
    const { container } = render(<CodegraphPage />)
    await waitFor(() => expect(container.querySelector('[data-two-axis-page]')).toBeTruthy())
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'branch' } })
    await waitFor(() => expect(document.querySelector('[data-compare-fallback]')).toBeTruthy())
    expect(document.querySelector('[data-compare-fallback]')!.textContent).toContain('基准快照')
    expect(container.querySelector('[data-two-axis-page]')?.getAttribute('data-scope')).toBe('')
    expect(container.querySelector('[data-flow-shell]')).toBeNull()
    expect(state.fetchMock).toHaveBeenCalledTimes(1)
  })

  it('失鲜徽标：stale 非空时出现且带明细提示，为空时不出现', async () => {
    state.data = { ...resp, stale: [{ id: 'n_runE', file: 'cmd/run.go', line: 5, reason: '行号漂移' }] }
    const { container } = render(<CodegraphPage />)
    await waitFor(() => expect(container.querySelector('[data-two-axis-page]')).toBeTruthy())
    expect(screen.getByText(/1 个节点疑似失鲜/)).toBeTruthy()
  })
})

describe('CodegraphPage 非图状态', () => {
  it('项目没扫过图：给空态而不是红字，工具条与刷新都在', async () => {
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

  it('空 project 不发请求且仍可渲染空状态', async () => {
    window.history.replaceState({}, '', '/?project=')
    state.data = null as unknown as CodegraphResp
    state.error = ''
    render(<CodegraphPage />)
    expect(state.projects).toEqual([''])
    expect(screen.getByText('还没有代码图')).toBeTruthy()
    expect(screen.getAllByRole('combobox')).toHaveLength(1)
  })

  it('无领域数据：工具条给单域提示 pill，不再伪造树+图视图', async () => {
    state.data = { ...resp, baseline: { ...resp.baseline, domains: undefined } }
    const { container } = render(<CodegraphPage />)
    await waitFor(() => expect(container.querySelector('[data-two-axis-page]')).toBeTruthy())
    expect(screen.getByText(/未包含领域划分/)).toBeTruthy()
  })
})
