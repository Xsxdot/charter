import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { CgBest, CgCheckReport, CgGraph } from '../../api/types'
import { BestDetail } from './BestDetail'

const best: CgBest = {
  meta: { version: 1, project: 'demo' },
  domains: {
    s_api: { label: 'API', type: 'boundary' },
    s_api_read: { label: '读取', parent: 's_api' },
    s_api_read_detail: { label: '详情', parent: 's_api_read' },
    s_store: { label: '存储', type: 'logic' },
  },
  containers: { c_in: 's_api_read', c_out: 's_store' },
}
const baseline: CgGraph = {
  meta: { project: 'demo', branch: 'main', commit: 'abc', scannedAt: 'today', generator: 'test' },
  domains: {
    s_api: { label: '现状 API', kind: '服务' },
    s_api_inner: { label: '现状 API 内部', kind: '服务', parent: 's_api' },
    s_store: { label: '现状存储', kind: '存储' },
  },
  containers: {
    c_in: { label: '输入容器', kind: '服务', domain: 's_store' },
    c_out: { label: '输出容器', kind: '服务', domain: 's_api_inner' },
  },
  nodes: {
    n_in: { kind: 'func', container: 'c_in', name: 'In', file: 'internal/read/in.go', line: 1 },
    n_in2: { kind: 'func', container: 'c_in', name: 'In2', file: 'internal/read/in2.go', line: 2 },
    n_out: { kind: 'model', container: 'c_out', name: 'Out', file: 'internal/store/out.go', line: 1 },
  },
  edges: [],
}
const report: CgCheckReport = {
  fails: [],
  warns: [
    { kind: 'container-misplaced', from: 'c_in', detail: '错位' },
    { kind: 'container-misplaced', from: 'c_out', detail: '错位' },
  ],
}

describe('BestDetail', () => {
  it('显示嵌套子领域与 best 归属容器清单', () => {
    render(<BestDetail best={best} baseline={baseline} report={report} subsystemId="s_api" />)
    expect(screen.getByText('API · 读取 · 详情')).toBeTruthy()
    expect(screen.getByText('输入容器')).toBeTruthy()
    expect(screen.getByText('读取')).toBeTruthy()
    expect(document.querySelectorAll('[data-best-domain]').length).toBe(2)
    expect(document.querySelector('[data-best-container="c_in"]')).toBeTruthy()
  })

  it('misplaced 双向都列出现在位置与应然位置', () => {
    const { container } = render(<BestDetail best={best} baseline={baseline} report={report} subsystemId="s_api" />)
    const rows = [...container.querySelectorAll('[data-best-misplaced-item]')].map((row) => row.textContent)
    expect(rows).toContain('c_in现在在 现状存储 · 应归 读取')
    expect(rows).toContain('c_out现在在 现状 API 内部 · 应归 存储')
  })

  it('一个领域跨多个包时折出包分组，默认收起且带目录', () => {
    const multi: CgBest = {
      meta: { version: 1, project: 'demo' },
      domains: { s_api: { label: 'API', type: 'boundary' } },
      containers: { c_in: 's_api', c_out: 's_api' },
    }
    const { container } = render(<BestDetail best={multi} baseline={baseline} subsystemId="s_api" />)
    const packages = [...container.querySelectorAll('[data-best-package-group]')]
    expect(packages.map((group) => group.getAttribute('data-best-package-group'))).toEqual(['internal/read', 'internal/store'])
    expect(packages.every((group) => !(group as HTMLDetailsElement).open)).toBe(true)
    expect(screen.getByText('internal/read')).toBeTruthy()
  })

  it('领域只有一个包时不加多余层级，容器直接列出', () => {
    const single: CgBest = {
      meta: { version: 1, project: 'demo' },
      domains: { s_api: { label: 'API' } },
      containers: { c_in: 's_api' },
    }
    const { container } = render(<BestDetail best={single} baseline={baseline} subsystemId="s_api" />)
    expect(container.querySelectorAll('[data-best-package-group]').length).toBe(0)
    expect(container.querySelector('[data-best-container="c_in"]')?.textContent).toContain('2 节点')
  })

  it('未选择子系统时渲染稳定空壳', () => {
    const { container } = render(<BestDetail best={best} baseline={baseline} subsystemId="" />)
    expect(container.querySelector('[data-best-detail]')).toBeTruthy()
  })

  it('子领域进入按钮与容器选择只回调页面状态', () => {
    const onEnterDomain = vi.fn()
    const onSelectContainer = vi.fn()
    const { container } = render(<BestDetail best={best} baseline={baseline} report={report} subsystemId="s_api"
      selectedDomain="" onEnterDomain={onEnterDomain} selectedContainer="c_in" onSelectContainer={onSelectContainer} />)
    fireEvent.click(container.querySelector('[data-best-domain="s_api_read"] button')!)
    expect(onEnterDomain).toHaveBeenCalledWith('s_api_read')
    fireEvent.click(container.querySelector('[data-best-container="c_in"]')!)
    expect(onSelectContainer).toHaveBeenCalledWith('c_in')
    expect(container.querySelector('[data-best-container="c_in"][data-selected="true"]')).toBeTruthy()
  })
})

describe('BestDetail 子系统级进入', () => {
  it('标题旁提供进入子系统嵌套层的按钮——原型基准：每层可入', () => {
    const onEnterDomain = vi.fn()
    const { container } = render(<BestDetail best={best} baseline={baseline} report={report}
      subsystemId="s_api" onEnterDomain={onEnterDomain} />)
    const btn = container.querySelector('[data-best-enter-subsystem="s_api"]') as HTMLElement
    expect(btn).toBeTruthy()
    fireEvent.click(btn)
    expect(onEnterDomain).toHaveBeenCalledWith('s_api')
  })
})

describe('C12.1 职责正文唯一所有权', () => {
  it('职责位显示 decls 正文；缺席时显示未声明+写入路径', () => {
    const decls: import('../../api/types').CgDomainDecls = {
      s_api: { domain: 's_api', responsibility: '人写的对外服务声明' },
    }
    const withDecl = render(<BestDetail best={best} baseline={baseline} report={report} decls={decls} subsystemId="s_api" />)
    expect(withDecl.container.querySelector('[data-declaration-text]')?.textContent).toContain('人写的对外服务声明')
    withDecl.unmount()

    const withoutDecl = render(<BestDetail best={best} baseline={baseline} report={report} subsystemId="s_api" />)
    expect(withoutDecl.container.querySelector('[data-declaration-text]')).toBeNull()
    const missing = withoutDecl.container.querySelector('[data-declaration-missing]')
    expect(missing?.textContent).toContain('未声明')
    expect(missing?.textContent).toContain('codegraph/domains/s_api.json')
  })
})
