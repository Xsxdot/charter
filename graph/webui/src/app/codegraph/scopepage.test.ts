import { describe, expect, it } from 'vitest'
import type { CgBest, CgDomainDecls, CgGraph } from '../../api/types'
import {
  CONTAINER_KINDS,
  FALLBACK_BUCKET_KINDS,
  REAL_KERNEL_KINDS,
  deriveScopePage,
} from './scopepage'

// —— 夹具纪律：边界期望值全部硬编码（9/10、7/10、41），不从模块常量推导，
// 保证变异复验（改常量）能真正转红。所有断言只走 deriveScopePage 这一个缝入口。——

const meta = { project: 'k2', branch: 'main', commit: 'c', scannedAt: 'now', generator: 'test' }

function blankGraph(): CgGraph {
  return { meta, containers: {}, nodes: {}, edges: [] }
}

function bestOf(domains: CgBest['domains'], containers: CgBest['containers']): CgBest {
  return { meta: { version: 1, project: 'k2' }, domains, containers }
}

// W1 组织切换与递归同构世界：3+1 子系统、1 个中层领域、跨系统 1 条 call 边 + 1 条 twin 投影。
function isoWorld() {
  const best = bestOf(
    {
      ss_a: { label: '甲子系统', type: 'boundary' },
      a_mid: { label: '甲中域', parent: 'ss_a' },
      ss_b: { label: '乙子系统', type: 'logic' },
      ss_c: { label: '丙孤岛', type: 'boundary' },
    },
    { c_fb: 'a_mid', c_store: 'ss_b', c_iso: 'ss_c' },
  )
  const baseline: CgGraph = {
    ...blankGraph(),
    containers: {
      c_fb: { label: '工具函数组', kind: '函数组' },
      c_store: { label: 'Store', kind: '类型方法' },
      c_iso: { label: '孤岛模型', kind: 'TypeScript 模型' },
    },
    nodes: {
      n_w: { kind: 'func', container: 'c_fb', name: 'writeJSON', file: 'p/w.go', line: 1 },
      n_e1: { kind: 'entry', container: 'c_fb', name: 'cmd run', file: 'p/w.go', line: 9, channel: 'cli' },
      n_m: { kind: 'func', container: 'c_store', name: 'Store.Get', file: 'p/s.go', line: 2 },
      n_e2: { kind: 'entry', container: 'c_store', name: 'GET /x', file: 'p/s.go', line: 5 },
      n_iso: { kind: 'model', container: 'c_iso', name: 'IsoDto', file: 'web/i.ts', line: 3, modelKind: 'dto' },
    },
    edges: [
      ['n_e1', 'n_m'],
      ['n_ghost', 'n_m'],
    ],
    projections: [['n_w', 'n_iso', 'twin']],
  }
  const decls: CgDomainDecls = { ss_b: { domain: 'ss_b', responsibility: '乙的声明正文' } }
  return { best, baseline, decls }
}

// W2 兜底桶占比世界：10 条跨域入边 = 7 兜底桶 + 2 类型方法 + 1 词表外神秘桶。
function ratioWorld() {
  const best = bestOf(
    { s: { label: '源系统', type: 'boundary' }, t: { label: '目标系统', type: 'logic' } },
    { c_src: 's', c_f: 't', c_g: 't', c_u: 't' },
  )
  const baseline: CgGraph = {
    ...blankGraph(),
    containers: {
      c_src: { label: '源头', kind: '入口' },
      c_f: { label: '工具桶', kind: '函数组' },
      c_g: { label: '正规军', kind: '类型方法' },
      c_u: { label: '神秘桶', kind: '神秘桶' },
    },
    nodes: {
      sg1: { kind: 'entry', container: 'c_src', name: 's1', file: 'o/s.go', line: 1 },
      sg2: { kind: 'entry', container: 'c_src', name: 's2', file: 'o/s.go', line: 2 },
      sg3: { kind: 'entry', container: 'c_src', name: 's3', file: 'o/s.go', line: 3 },
      sg4: { kind: 'entry', container: 'c_src', name: 's4', file: 'o/s.go', line: 4 },
      sg5: { kind: 'entry', container: 'c_src', name: 's5', file: 'o/s.go', line: 5 },
      sg6: { kind: 'entry', container: 'c_src', name: 's6', file: 'o/s.go', line: 6 },
      sg7: { kind: 'entry', container: 'c_src', name: 's7', file: 'o/s.go', line: 7 },
      sg8: { kind: 'entry', container: 'c_src', name: 's8', file: 'o/s.go', line: 8 },
      sg9: { kind: 'entry', container: 'c_src', name: 's9', file: 'o/s.go', line: 9 },
      sg10: { kind: 'entry', container: 'c_src', name: 's10', file: 'o/s.go', line: 10 },
      tf1: { kind: 'func', container: 'c_f', name: 'toolOne', file: 't/f.go', line: 1 },
      tf2: { kind: 'func', container: 'c_f', name: 'toolTwo', file: 't/f.go', line: 2 },
      tg1: { kind: 'func', container: 'c_g', name: 'Real.Do', file: 't/g.go', line: 1 },
      tu1: { kind: 'func', container: 'c_u', name: 'mystery', file: 't/u.go', line: 1 },
    },
    edges: [
      ['sg1', 'tf1'], ['sg2', 'tf1'], ['sg3', 'tf1'], ['sg4', 'tf1'],
      ['sg5', 'tf1'], ['sg6', 'tf1'], ['sg7', 'tf2'],
      ['sg8', 'tg1'], ['sg9', 'tg1'], ['sg10', 'tu1'],
    ],
  }
  return { best, baseline }
}

// W3 复用度与折叠世界：hot=10 可达（兜底桶→折叠）、warm=9（不折叠）、kernel=10
// （类型方法→真共享内核不折叠）、ui=1（React 组件/函数→other）、dead=0
// （调用方不可达自任何入口→死契约仍保留在对外面里）。
function foldWorld() {
  const best = bestOf(
    { src: { label: '调方', type: 'boundary' }, dst: { label: '受方', type: 'logic' } },
    { c_out: 'src', c_fb: 'dst', c_ty: 'dst', c_ui: 'dst' },
  )
  const nodes: CgGraph['nodes'] = {
    n_caller: { kind: 'func', container: 'c_out', name: 'caller', file: 'o/c.go', line: 99 },
    n_hot: { kind: 'func', container: 'c_fb', name: 'hot', file: 'd/h.go', line: 1 },
    n_warm: { kind: 'func', container: 'c_fb', name: 'warm', file: 'd/h.go', line: 2 },
    n_kernel: { kind: 'func', container: 'c_ty', name: 'Kernel.Do', file: 'd/k.go', line: 1 },
    n_ui: { kind: 'func', container: 'c_ui', name: 'Widget', file: 'd/w.tsx', line: 1 },
    n_dead: { kind: 'func', container: 'c_fb', name: 'dead', file: 'd/h.go', line: 3 },
  }
  const edges: CgGraph['edges'] = [['n_caller', 'n_dead']]
  for (let i = 1; i <= 10; i += 1) {
    nodes[`e${i}`] = { kind: 'entry', container: 'c_out', name: `cmd ${i}`, file: 'o/e.go', line: i }
    edges.push([`e${i}`, 'n_hot'])
    edges.push([`e${i}`, 'n_kernel'])
    if (i <= 9) edges.push([`e${i}`, 'n_warm'])
  }
  edges.push(['e1', 'n_ui'])
  const baseline: CgGraph = {
    ...blankGraph(),
    containers: {
      c_out: { label: '出口', kind: '入口' },
      c_fb: { label: '杂活函数组', kind: '函数组' },
      c_ty: { label: '内核服务', kind: '类型方法' },
      c_ui: { label: '界面件', kind: 'React 组件/函数' },
    },
    nodes,
    edges,
  }
  return { best, baseline }
}

// W4 容器职责世界：同名 Store 类型节点分处 pkga/pkgb，容器成员在 pkga——按包匹配只许命中 pkga。
function respWorld() {
  const best = bestOf(
    { r: { label: '职责域', type: 'logic' } },
    { c_st: 'r', c_prefixed: 'r', c_models: 'r', c_ghost: 'r', c_fn: 'r' },
  )
  const baseline: CgGraph = {
    ...blankGraph(),
    containers: {
      c_st: { label: 'Store', kind: '类型方法' },
      c_prefixed: { label: 'pkga.Store', kind: '类型方法' },
      c_models: { label: '模型桶', kind: 'TypeScript 模型' },
      c_ghost: { label: 'Ghost', kind: '类型方法' },
      c_fn: { label: '杂活', kind: '函数组' },
    },
    nodes: {
      m1: { kind: 'func', container: 'c_st', name: 'Store.Get', file: 'pkga/store.go', line: 1 },
      p1: { kind: 'func', container: 'c_prefixed', name: 'Store.Get', file: 'pkga/prefix/service.go', line: 2 },
      tA: { kind: 'model', container: 'c_models', name: 'Store', file: 'pkga/store.go', line: 10, modelKind: 'dto', summary: '甲侧存储注释' },
      tB: { kind: 'model', container: 'c_models', name: 'Store', file: 'pkgb/store.go', line: 11, modelKind: 'dto', summary: '别家的存储注释' },
      tPrefA: { kind: 'model', container: 'c_models', name: 'Store', file: 'pkga/prefix/model.go', line: 12, modelKind: 'dto', summary: '前缀甲侧存储注释' },
      tPrefB: { kind: 'model', container: 'c_models', name: 'Store', file: 'pkgb/model.go', line: 13, modelKind: 'dto', summary: '前缀别家存储注释' },
      gh: { kind: 'func', container: 'c_ghost', name: 'gh', file: 'pkgc/ghost.go', line: 1 },
      fn: { kind: 'func', container: 'c_fn', name: 'util', file: 'pkga/util.go', line: 1 },
    },
    edges: [],
  }
  return { best, baseline }
}

function entryWorld(files: string[]) {
  const best = bestOf({ r: { label: '入口域', type: 'logic' } }, { c_entries: 'r' })
  const nodes: CgGraph['nodes'] = {}
  files.forEach((file, index) => {
    const number = index + 1
    nodes[`entry${number}`] = {
      kind: 'entry', container: 'c_entries', name: `entry ${number}`, file, line: number,
    }
  })
  return {
    best,
    baseline: {
      ...blankGraph(),
      containers: { c_entries: { label: '入口容器', kind: '入口' } },
      nodes,
    },
  }
}

// W5 大容器世界：41 符号分两个文件；对照小容器 1 符号。
function bigWorld() {
  const best = bestOf({ big: { label: '大域', type: 'logic' } }, { c_big: 'big', c_tiny: 'big' })
  const nodes: CgGraph['nodes'] = {}
  for (let i = 1; i <= 41; i += 1) {
    nodes[`b${i}`] = { kind: 'func', container: 'c_big', name: `f${i}`, file: i <= 21 ? 'pkg/x/a.go' : 'pkg/x/b.go', line: i }
  }
  nodes.t1 = { kind: 'func', container: 'c_tiny', name: 'tiny', file: 'pkg/y/t.go', line: 1 }
  const baseline: CgGraph = {
    ...blankGraph(),
    containers: { c_big: { label: '巨无霸', kind: '函数组' }, c_tiny: { label: '小容器', kind: '函数组' } },
    nodes,
    edges: [],
  }
  return { best, baseline }
}

// W6 空态独立世界：四个叶子子系统各自恰好翻转一个布尔。
function emptyWorld() {
  const best = bestOf(
    {
      full: { label: '齐全域', type: 'logic' },
      nd: { label: '无声明域', type: 'logic' },
      ne: { label: '无实体域', type: 'logic' },
      ni: { label: '无入缝域', type: 'logic' },
      out: { label: '外部源', type: 'boundary' },
    },
    { c_full: 'full', c_nd: 'nd', c_ne: 'ne', c_ni: 'ni', c_out: 'out' },
  )
  const decls: CgDomainDecls = {
    full: { domain: 'full', responsibility: '齐全' },
    ne: { domain: 'ne', responsibility: '无实体但有声明' },
    ni: { domain: 'ni', responsibility: '无入缝但有声明' },
  }
  const baseline: CgGraph = {
    ...blankGraph(),
    containers: {
      c_full: { label: '齐全容器', kind: '函数组' },
      c_nd: { label: '无声明容器', kind: '函数组' },
      c_ne: { label: '无实体容器', kind: '函数组' },
      c_ni: { label: '无入缝容器', kind: '函数组' },
      c_out: { label: '外部出口', kind: '入口' },
    },
    nodes: {
      o1: { kind: 'entry', container: 'c_out', name: 'o', file: 'o/o.go', line: 1 },
      f1: { kind: 'model', container: 'c_full', name: 'FullEnt', file: 'f/f.go', line: 1, modelKind: 'entity' },
      d1: { kind: 'model', container: 'c_nd', name: 'NdEnt', file: 'n/n.go', line: 1, modelKind: 'entity' },
      e1: { kind: 'func', container: 'c_ne', name: 'plainFn', file: 'e/e.go', line: 1 },
      i1: { kind: 'model', container: 'c_ni', name: 'NiEnt', file: 'i/i.go', line: 1, modelKind: 'entity' },
    },
    edges: [['o1', 'f1'], ['o1', 'd1'], ['o1', 'e1']],
  }
  return { best, baseline, decls }
}

describe('C12.2 缝 1：词表常量（值随契约冻结，常量为实现）', () => {
  it('容器 kind 八值、兜底桶二值、真共享内核二值逐字冻结', () => {
    expect([...CONTAINER_KINDS]).toEqual([
      '类型方法', '函数组', '实体', 'TypeScript 模型', 'React 组件/函数', '入口',
      'TypeScript 函数组', 'TypeScript 实体',
    ])
    expect([...FALLBACK_BUCKET_KINDS]).toEqual(['函数组', 'TypeScript 函数组'])
    expect([...REAL_KERNEL_KINDS]).toEqual(['类型方法', '实体'])
  })
})

describe('C12.2 缝 1：递归同构与组织切换', () => {
  it('根/中/容器三层模型顶层键集相同，passthrough 直通标记退场', () => {
    const w = isoWorld()
    const root = deriveScopePage({ baseline: w.baseline, best: w.best, decls: w.decls, organization: 'best', scopeId: null })
    const mid = deriveScopePage({ baseline: w.baseline, best: w.best, decls: w.decls, organization: 'best', scopeId: 'ss_a' })
    const leaf = deriveScopePage({ baseline: w.baseline, best: w.best, decls: w.decls, organization: 'best', scopeId: 'a_mid' })
    const keys = (m: typeof root) => Object.keys(m).sort()
    expect(keys(root)).toEqual(keys(mid))
    expect(keys(mid)).toEqual(keys(leaf))
    expect(Object.keys(root.empty).sort()).toEqual(['noDeclaration', 'noEntities', 'noInboundSeams'])
    expect(Object.prototype.hasOwnProperty.call(root, 'passthrough')).toBe(false)
  })

  it('根层画子系统卡：call 边聚合权重、twin 是带标记的第二类边、悬空边被忽略', () => {
    const w = isoWorld()
    const m = deriveScopePage({ baseline: w.baseline, best: w.best, organization: 'best', scopeId: null })
    expect(m.nodes.map((n) => n.id)).toEqual(['ss_a', 'ss_b', 'ss_c'])
    expect(m.nodes.every((n) => n.kind === 'domain')).toBe(true)
    // n_ghost 不在任何容器 → 该边整体忽略，权重仍是 1
    expect(m.edges).toEqual([
      { key: 'ss_a->ss_b', from: 'ss_a', to: 'ss_b', weight: 1, kind: 'call' },
      { key: 'ss_a->ss_c:twin', from: 'ss_a', to: 'ss_c', weight: 1, kind: 'projection', projectionType: 'twin' },
    ])
  })

  it('孤立判据=call 入边与出边都为空：纯调用方不孤立，projection 不抵孤立', () => {
    const w = isoWorld()
    const m = deriveScopePage({ baseline: w.baseline, best: w.best, organization: 'best', scopeId: null })
    const byId = new Map(m.nodes.map((n) => [n.id, n]))
    expect(byId.get('ss_a')?.isolated).toBe(false)
    expect(byId.get('ss_b')?.isolated).toBe(false)
    expect(byId.get('ss_c')?.isolated).toBe(true)
  })

  it('中层看子领域卡、圈外端点不产节点、横跳权重聚合进 externalOut', () => {
    const w = isoWorld()
    const m = deriveScopePage({ baseline: w.baseline, best: w.best, decls: w.decls, organization: 'best', scopeId: 'ss_a' })
    expect(m.nodes.map((n) => n.id)).toEqual(['a_mid'])
    expect(m.nodes.every((node) => !Object.prototype.hasOwnProperty.call(node, 'external'))).toBe(true)
    expect(m.externalOut).toEqual([{ neighborId: 'ss_b', label: '乙子系统', weight: 1 }])
    expect(m.edges.map((e) => e.key)).toEqual(['a_mid->ext:ss_c:twin'])
    const root = deriveScopePage({ baseline: w.baseline, best: w.best, organization: 'best', scopeId: null })
    expect(root.externalOut).toEqual([])
  })

  it('externalOut 多邻居按 neighborId 升序输出，不沿 baseline 边的插入序泄漏', () => {
    const w = isoWorld()
    const best = bestOf(
      { ...w.best.domains, ss_d: { label: '丁子系统', type: 'logic' }, ss_e: { label: '戊子系统', type: 'logic' } },
      { ...w.best.containers, c_d: 'ss_d', c_e: 'ss_e' },
    )
    const baseline: CgGraph = {
      ...w.baseline,
      containers: { ...w.baseline.containers, c_d: { label: '丁容器', kind: '函数组' }, c_e: { label: '戊容器', kind: '函数组' } },
      nodes: {
        ...w.baseline.nodes,
        n_d: { kind: 'func', container: 'c_d', name: 'd', file: 'd/d.go', line: 1 },
        n_e: { kind: 'func', container: 'c_e', name: 'e', file: 'e/e.go', line: 1 },
      },
      edges: [...w.baseline.edges, ['n_e1', 'n_e'], ['n_e1', 'n_d']],
    }
    const m = deriveScopePage({ baseline, best, organization: 'best', scopeId: 'ss_a' })
    expect(m.externalOut).toEqual([
      { neighborId: 'ss_b', label: '乙子系统', weight: 1 },
      { neighborId: 'ss_d', label: '丁子系统', weight: 1 },
      { neighborId: 'ss_e', label: '戊子系统', weight: 1 },
    ])
  })

  it('叶子领域的容器层是原子节点：childCount 恒 0、入口引用带 channel 透传', () => {
    const w = isoWorld()
    const leafA = deriveScopePage({ baseline: w.baseline, best: w.best, organization: 'best', scopeId: 'a_mid' })
    expect(leafA.nodes.map((n) => n.id)).toEqual(['c_fb'])
    const fb = leafA.nodes.find((n) => n.id === 'c_fb')
    expect(fb?.kind).toBe('container')
    expect(fb?.childCount).toBe(0)
    expect(fb?.entries).toEqual([{ id: 'n_e1', name: 'cmd run', channel: 'cli' }])

    const leafB = deriveScopePage({ baseline: w.baseline, best: w.best, organization: 'best', scopeId: 'ss_b' })
    const store = leafB.nodes.find((n) => n.id === 'c_store')
    expect(store?.entries).toEqual([{ id: 'n_e2', name: 'GET /x' }])
    expect(Object.prototype.hasOwnProperty.call(store?.entries[0] ?? {}, 'channel')).toBe(false)
  })

  it("organization='current' 且 best 缺席可用：领域树取 baseline.domains", () => {
    const baseline: CgGraph = {
      ...blankGraph(),
      domains: {
        d_top: { label: '现甲', kind: 'boundary' },
        d_kid: { label: '现子', kind: 'logic', parent: 'd_top' },
      },
      containers: { c_cur: { label: '现容器', kind: '函数组', domain: 'd_kid' } },
      nodes: { n_c: { kind: 'func', container: 'c_cur', name: 'f', file: 'q/f.go', line: 1 } },
      edges: [],
    }
    const root = deriveScopePage({ baseline, organization: 'current', scopeId: null })
    expect(root.organizationAvailable).toBe(true)
    expect(root.nodes.map((n) => n.id)).toEqual(['d_top'])
    const kid = deriveScopePage({ baseline, organization: 'current', scopeId: 'd_top' })
    expect(kid.nodes.map((n) => n.id)).toEqual(['d_kid'])
    const leaf = deriveScopePage({ baseline, organization: 'current', scopeId: 'd_kid' })
    expect(leaf.nodes.map((n) => n.id)).toEqual(['c_cur'])
  })

  it("organization='best' 且 best 缺席 → 显式不可用，绝不拿 current 冒充", () => {
    const w = isoWorld()
    const m = deriveScopePage({ baseline: w.baseline, organization: 'best', scopeId: null })
    expect(m.organizationAvailable).toBe(false)
    expect(m.nodes).toEqual([])
    expect(m.edges).toEqual([])
    expect(m.inboundSeams).toEqual([])
  })

  it('未知 scope 返回空图：available 保持 true，不把坏数据变成伪卡', () => {
    const w = isoWorld()
    const m = deriveScopePage({ baseline: w.baseline, best: w.best, organization: 'best', scopeId: 'ghost' })
    expect(m.organizationAvailable).toBe(true)
    expect(m.nodes).toEqual([])
    expect(m.edges).toEqual([])
    expect(m.inboundSeams).toEqual([])
  })
})

describe('C12.2 缝 1：债读数与折叠判据', () => {
  it('兜底桶占比数值化：10 条跨域入边 7 落兜底桶 = 70%，词表外显式计数不入分子', () => {
    const w = ratioWorld()
    const m = deriveScopePage({ baseline: w.baseline, best: w.best, organization: 'best', scopeId: null })
    expect(m.nodes.find((n) => n.id === 't')?.debt).toEqual({
      inboundCrossDomain: 10, fallbackBucket: 7, unknownKind: 1, ratio: 0.7,
    })
  })

  it('无入边的子系统 ratio 是 null 而不是 0：缺数据不得伪装成完整读数', () => {
    const w = ratioWorld()
    const m = deriveScopePage({ baseline: w.baseline, best: w.best, organization: 'best', scopeId: null })
    expect(m.nodes.find((n) => n.id === 's')?.debt).toEqual({
      inboundCrossDomain: 0, fallbackBucket: 0, unknownKind: 0, ratio: null,
    })
  })

  it('复用度数值化：死契约 reuse=0 保留在对外面里，不被静默丢弃', () => {
    const w = foldWorld()
    const m = deriveScopePage({ baseline: w.baseline, best: w.best, organization: 'best', scopeId: 'dst' })
    const dead = m.inboundSeams.find((s) => s.nodeId === 'n_dead')
    expect(dead?.reuse).toBe(0)
    expect(dead?.folded).toBe(false)
    expect(dead?.callerDomains).toEqual(['src'])
    expect(m.inboundSeams.length).toBe(5)
  })

  it('折叠判据边界：复用 10 的兜底桶折叠、9 不折叠、类型方法高复用是真共享内核不折叠', () => {
    const w = foldWorld()
    const m = deriveScopePage({ baseline: w.baseline, best: w.best, organization: 'best', scopeId: 'dst' })
    const byNode = new Map(m.inboundSeams.map((s) => [s.nodeId, s]))
    expect(byNode.get('n_hot')).toMatchObject({ reuse: 10, folded: true, kindClass: 'fallback' })
    expect(byNode.get('n_warm')).toMatchObject({ reuse: 9, folded: false, kindClass: 'fallback' })
    expect(byNode.get('n_kernel')).toMatchObject({ reuse: 10, folded: false, kindClass: 'real-kernel' })
    expect(byNode.get('n_ui')).toMatchObject({ reuse: 1, folded: false, kindClass: 'other' })
  })

  it('折叠的不占主名单名额：主名单=未被折叠的 4 条，排序稳定（reuse 降序、id 升序）', () => {
    const w = foldWorld()
    const m = deriveScopePage({ baseline: w.baseline, best: w.best, organization: 'best', scopeId: 'dst' })
    expect(m.inboundSeams.filter((s) => !s.folded).map((s) => s.nodeId)).toEqual(['n_kernel', 'n_warm', 'n_ui', 'n_dead'])
    expect(m.inboundSeams.map((s) => s.nodeId)).toEqual(['n_hot', 'n_kernel', 'n_warm', 'n_ui', 'n_dead'])
    expect(m.empty.noInboundSeams).toBe(false)
  })

  it('词表外 kind 的入缝符号如实标 unknown，不冒充任何一类也不计入折叠判据', () => {
    const w = ratioWorld()
    const m = deriveScopePage({ baseline: w.baseline, best: w.best, organization: 'best', scopeId: 't' })
    expect(m.inboundSeams.find((s) => s.nodeId === 'tu1')).toMatchObject({
      containerKind: '神秘桶', kindClass: 'unknown', reuse: 1, folded: false,
    })
  })
})

describe('C12.2 缝 1：大容器如实报与容器职责推导', () => {
  it('超 40 符号容器正面报符号数/文件数/债务标记，且模型没有任何折叠建议类字段', () => {
    const w = bigWorld()
    const m = deriveScopePage({ baseline: w.baseline, best: w.best, organization: 'best', scopeId: 'big' })
    const bigCard = m.nodes.find((n) => n.id === 'c_big')
    expect(bigCard).toMatchObject({ kind: 'container', symbolCount: 41, fileCount: 2, oversized: true })
    expect(m.nodes.find((n) => n.id === 'c_tiny')).toMatchObject({ symbolCount: 1, fileCount: 1, oversized: false })
    const keys = Object.keys(bigCard ?? {}).sort()
    expect(keys).toEqual([
      'childCount', 'containerCount', 'debt', 'dir', 'entries', 'entryDispersion', 'fileCount', 'id',
      'invariants', 'isolated', 'kind', 'label', 'oversized', 'ports', 'responsibility',
      'symbolCount', 'type',
    ])
    expect(keys.every((k) => !/fold|collapse/i.test(k))).toBe(true)
  })

  it('容器职责唯一合法推导：同名类型节点按包匹配命中；跨包同名不误配', () => {
    const w = respWorld()
    const m = deriveScopePage({ baseline: w.baseline, best: w.best, organization: 'best', scopeId: 'r' })
    expect(m.nodes.find((n) => n.id === 'c_st')?.responsibility).toEqual({ state: 'declared', text: '甲侧存储注释' })
  })

  it('容器职责匹配：容器 label 带包前缀时按最后类型段命中 model doc', () => {
    const w = respWorld()
    const m = deriveScopePage({ baseline: w.baseline, best: w.best, organization: 'best', scopeId: 'r' })
    expect(m.nodes.find((n) => n.id === 'c_prefixed')?.responsibility).toEqual({
      state: 'declared', text: '前缀甲侧存储注释',
    })
  })

  it('容器职责匹配：带包前缀的同名 model 跨包时仍只命中容器成员目录', () => {
    const w = respWorld()
    const m = deriveScopePage({ baseline: w.baseline, best: w.best, organization: 'best', scopeId: 'r' })
    expect(m.nodes.find((n) => n.id === 'c_prefixed')?.responsibility).toEqual({
      state: 'declared', text: '前缀甲侧存储注释',
    })
    expect(m.nodes.find((n) => n.id === 'c_prefixed')?.responsibility).not.toEqual({
      state: 'declared', text: '前缀别家存储注释',
    })
  })

  it('类型方法无同名匹配=undeclared；函数组/TypeScript 模型=no-subject，不硬凑', () => {
    const w = respWorld()
    const m = deriveScopePage({ baseline: w.baseline, best: w.best, organization: 'best', scopeId: 'r' })
    const byId = new Map(m.nodes.map((n) => [n.id, n]))
    expect(byId.get('c_ghost')?.responsibility).toEqual({ state: 'undeclared' })
    expect(byId.get('c_fn')?.responsibility).toEqual({ state: 'no-subject' })
    expect(byId.get('c_models')?.responsibility).toEqual({ state: 'no-subject' })
  })

  it('领域卡职责来自 decls；空串正文与缺席同样归为未声明（K1 口径延续）', () => {
    const w = respWorld()
    const bare = deriveScopePage({ baseline: w.baseline, best: w.best, organization: 'best', scopeId: null })
    expect(bare.nodes.find((n) => n.id === 'r')?.responsibility).toEqual({ state: 'undeclared' })
    const withEmpty = deriveScopePage({
      baseline: w.baseline, best: w.best,
      decls: { r: { domain: 'r', responsibility: '' } },
      organization: 'best', scopeId: null,
    })
    expect(withEmpty.nodes.find((n) => n.id === 'r')?.responsibility).toEqual({ state: 'undeclared' })
    const withText = deriveScopePage({
      baseline: w.baseline, best: w.best,
      decls: { r: { domain: 'r', responsibility: '人写的职责正文' } },
      organization: 'best', scopeId: null,
    })
    expect(withText.nodes.find((n) => n.id === 'r')?.responsibility).toEqual({ state: 'declared', text: '人写的职责正文' })
  })
})

describe('C14 缝 1：入口注册散度上卡', () => {
  it('根层领域卡报告入口数/文件数/集中注册边界，容器卡保持 null', () => {
    const four = deriveScopePage({
      ...entryWorld(['entry/routes.go', 'entry/routes.go', 'entry/routes.go', 'entry/routes.go']),
      organization: 'best', scopeId: null,
    })
    expect(four.nodes.find((node) => node.id === 'r')?.entryDispersion).toEqual({
      domainId: 'r', entries: 4, files: 1, concentrated: true,
    })

    const three = deriveScopePage({
      ...entryWorld(['entry/routes.go', 'entry/routes.go', 'entry/routes.go']),
      organization: 'best', scopeId: null,
    })
    expect(three.nodes.find((node) => node.id === 'r')?.entryDispersion).toEqual({
      domainId: 'r', entries: 3, files: 1, concentrated: false,
    })

    const zero = deriveScopePage({ ...entryWorld([]), organization: 'best', scopeId: null })
    expect(zero.nodes.find((node) => node.id === 'r')?.entryDispersion).toEqual({
      domainId: 'r', entries: 0, files: 0, concentrated: false,
    })

    const leaf = deriveScopePage({
      ...entryWorld(['entry/routes.go', 'entry/routes.go', 'entry/routes.go', 'entry/routes.go']),
      organization: 'best', scopeId: 'r',
    })
    expect(leaf.nodes.find((node) => node.id === 'c_entries')?.entryDispersion).toBeNull()
  })
})

describe('C12.2 缝 1：空态独立与根层格位语义', () => {
  it('三类空态互相独立：四个 scope 各自恰好翻转一个布尔', () => {
    const w = emptyWorld()
    const q = (scopeId: string) =>
      deriveScopePage({ baseline: w.baseline, best: w.best, decls: w.decls, organization: 'best', scopeId }).empty
    expect(q('full')).toEqual({ noDeclaration: false, noEntities: false, noInboundSeams: false })
    expect(q('nd')).toEqual({ noDeclaration: true, noEntities: false, noInboundSeams: false })
    expect(q('ne')).toEqual({ noDeclaration: false, noEntities: true, noInboundSeams: false })
    expect(q('ni')).toEqual({ noDeclaration: false, noEntities: false, noInboundSeams: true })
  })

  it('根层没有单一职责格位：noDeclaration 恒 false，不渲染假读数', () => {
    const w = emptyWorld()
    const m = deriveScopePage({ baseline: w.baseline, best: w.best, organization: 'best', scopeId: null })
    expect(m.empty.noDeclaration).toBe(false)
  })
})

// —— C12.4 协调者修订 R3：decls[domainId].invariants 投影进缝 1 输出。——
// 铁律：三态互斥可辨（无 decl 文件 / 有 decl 未写不变式 / 有不变式），禁止同一空态糊过；
// text 与 testRef 都要透传（testRef 是「承重安全属性有测试锁」的现场证据）。
describe('C12.4 R3：invariants 投影（三态互斥 + testRef 逐字透传）', () => {
  it('同一次派生里三态并存可辨：有不变式=present、有 decl 无条目=unwritten、无 decl=no-decl', () => {
    const w = isoWorld()
    const m = deriveScopePage({
      baseline: w.baseline,
      best: w.best,
      decls: {
        ss_b: {
          domain: 'ss_b',
          responsibility: '乙的声明正文',
          invariants: [{ text: '并发状态更新使用旧状态做 CAS，过期快照不能覆盖先发生的迁移。', testRef: 'TestUpdateTaskStateCAS' }],
        },
        ss_c: { domain: 'ss_c', responsibility: '丙的声明正文' },
      },
      organization: 'best',
      scopeId: null,
    })
    const byId = new Map(m.nodes.map((n) => [n.id, n]))
    expect(byId.get('ss_b')?.invariants).toEqual({
      state: 'present',
      items: [{ text: '并发状态更新使用旧状态做 CAS，过期快照不能覆盖先发生的迁移。', testRef: 'TestUpdateTaskStateCAS' }],
    })
    expect(byId.get('ss_c')?.invariants).toEqual({ state: 'unwritten' })
    expect(byId.get('ss_a')?.invariants).toEqual({ state: 'no-decl' })
  })

  it('invariants 为空数组与字段缺席同归 unwritten：不把「写了零条」谎报成「有内容」也不混入 no-decl', () => {
    const w = isoWorld()
    const emptyArr = deriveScopePage({
      baseline: w.baseline, best: w.best,
      decls: { ss_c: { domain: 'ss_c', responsibility: '丙', invariants: [] } },
      organization: 'best', scopeId: null,
    })
    expect(emptyArr.nodes.find((n) => n.id === 'ss_c')?.invariants).toEqual({ state: 'unwritten' })
    expect(emptyArr.nodes.find((n) => n.id === 'ss_b')?.invariants).toEqual({ state: 'no-decl' })
  })

  it('多条目逐条透传 text+testRef；未带 testRef 的条目不存在该键（沿 channel 键缺席语义）', () => {
    const w = isoWorld()
    const m = deriveScopePage({
      baseline: w.baseline, best: w.best,
      decls: {
        ss_b: {
          domain: 'ss_b',
          responsibility: '乙',
          invariants: [
            { text: '工作区请求的 branch/new-branch 选项互斥。', testRef: 'TestPrepareWorkspaceMutualExclusionAndInjection' },
            { text: '没有测试锚的不变式如实保留。' },
          ],
        },
      },
      organization: 'best', scopeId: null,
    })
    const inv = m.nodes.find((n) => n.id === 'ss_b')?.invariants
    expect(inv).toEqual({
      state: 'present',
      items: [
        { text: '工作区请求的 branch/new-branch 选项互斥。', testRef: 'TestPrepareWorkspaceMutualExclusionAndInjection' },
        { text: '没有测试锚的不变式如实保留。' },
      ],
    })
    if (!inv || inv.state !== 'present' || !inv.items[1]) throw new Error('expected present invariants with ≥2 items')
    expect(Object.prototype.hasOwnProperty.call(inv.items[1], 'testRef')).toBe(false)
  })

  it('圈外调出不生成引用卡：横跳数据改由 externalOut 承载', () => {
    const w = isoWorld()
    const m = deriveScopePage({
      baseline: w.baseline, best: w.best,
      decls: { ss_b: { domain: 'ss_b', responsibility: '乙', invariants: [{ text: '乙域承重不变式', testRef: 'TestLeafB' }] } },
      organization: 'best', scopeId: 'ss_a',
    })
    expect(m.nodes.find((n) => n.id === 'ext:ss_b')).toBeUndefined()
    expect(m.externalOut).toEqual([{ neighborId: 'ss_b', label: '乙子系统', weight: 1 }])
    expect(m.nodes.find((n) => n.id === 'a_mid')?.invariants).toEqual({ state: 'no-decl' })
  })

  it('容器卡没有声明格位：invariants 恒 null（沿 debt:null 同一约定）', () => {
    const w = isoWorld()
    const m = deriveScopePage({
      baseline: w.baseline, best: w.best,
      decls: { ss_b: { domain: 'ss_b', responsibility: '乙', invariants: [{ text: '乙域承重不变式' }] } },
      organization: 'best', scopeId: 'ss_b',
    })
    expect(m.nodes.find((n) => n.id === 'c_store')?.kind).toBe('container')
    expect(m.nodes.find((n) => n.id === 'c_store')?.invariants).toBeNull()
  })
})
