import { describe, expect, it } from 'vitest'
import type { CgFlowStep, CgGraph } from '../../api/types'
import { deriveFlowPage } from './flowpage'

// —— 夹具纪律（沿 C12.2 同款）：边界期望值全部硬编码（4/3、36/12、reachDomains 4），
// 不从模块常量推导；所有断言只走 deriveFlowPage 这一个缝入口。——
//
// 缝 2 无组织树输入（§2.4-30 两字段钉死），领域归属一律走 baseline.domains 的
// parent 链 + containers[].domain；夹具用平铺领域（无 parent）即顶层自指。

const meta = { project: 'k3', branch: 'main', commit: 'c', scannedAt: 'now', generator: 'test' }

function blankGraph(): CgGraph {
  return { meta, containers: {}, nodes: {}, edges: [] }
}

// W1 多值世界：e 直连两个异域合格目标（biz/other），外加一个更近的兜底桶噪声
// （noisy 域的函数组容器）——候选恰为 ['biz','other']，噪声不入候选。
function multiWorld(): CgGraph {
  return {
    ...blankGraph(),
    domains: { home: { label: '老巢', kind: 'boundary' }, biz: { label: '业务甲', kind: 'logic' }, other: { label: '业务乙', kind: 'logic' }, noisy: { label: '噪声域', kind: 'logic' } },
    containers: {
      c_home: { label: '入口', kind: '入口', domain: 'home' },
      c_b: { label: 'Biz', kind: '类型方法', domain: 'biz' },
      c_o: { label: 'Other', kind: '类型方法', domain: 'other' },
      c_fb: { label: '杂活', kind: '函数组', domain: 'noisy' },
    },
    nodes: {
      e: { kind: 'entry', container: 'c_home', name: 'dual cmd', file: 'r/e.go', line: 1 },
      b1: { kind: 'func', container: 'c_b', name: 'Biz.Do', file: 'b/x.go', line: 1 },
      o1: { kind: 'func', container: 'c_o', name: 'Other.Do', file: 'o/x.go', line: 1 },
      nz: { kind: 'func', container: 'c_fb', name: 'utilNoise', file: 'n/u.go', line: 1 },
    },
    edges: [
      ['e', 'nz'],
      ['e', 'b1'],
      ['e', 'o1'],
    ],
  }
}

// W2 单值世界：e→helper（同域中转）→svc（biz）；e 还有直达的兜底桶噪声 nz
// （距离更近）和一条悬空边 helper→ghost。最近合格跨域层＝biz → 单值，
// 同时证明：同域中转不计、兜底桶更近也排除、悬空边忽略。
function singleWorld(edgeOrder: 'normal' | 'reversed'): CgGraph {
  const edges: CgGraph['edges'] = [
    ['e', 'nz'],
    ['e', 'helper'],
    ['helper', 'svc'],
    ['helper', 'ghost'],
  ]
  return {
    ...blankGraph(),
    domains: { home: { label: '老巢', kind: 'boundary' }, biz: { label: '业务甲', kind: 'logic' }, noisy: { label: '噪声域', kind: 'logic' } },
    containers: {
      c_home: { label: '入口', kind: '入口', domain: 'home' },
      c_help: { label: 'helpers', kind: '函数组', domain: 'home' },
      c_s: { label: 'Svc', kind: '类型方法', domain: 'biz' },
      c_fb: { label: '杂活', kind: '函数组', domain: 'noisy' },
    },
    nodes: {
      e: { kind: 'entry', container: 'c_home', name: 'solo cmd', file: 'r/e.go', line: 1 },
      helper: { kind: 'func', container: 'c_help', name: 'helperFn', file: 'h/h.go', line: 1 },
      svc: { kind: 'func', container: 'c_s', name: 'Svc.Do', file: 'b/s.go', line: 1 },
      nz: { kind: 'func', container: 'c_fb', name: 'utilNoise', file: 'n/u.go', line: 1 },
    },
    edges: edgeOrder === 'normal' ? edges : [...edges].reverse(),
  }
}

// W3 Cobra 分组命令世界：无出边入口 → 「无行为」，族照常从名字解析。
function cobraWorld(): CgGraph {
  return {
    ...blankGraph(),
    domains: { home: { label: '老巢', kind: 'boundary' } },
    containers: { c_home: { label: '入口', kind: '入口', domain: 'home' } },
    nodes: { e_cg: { kind: 'entry', container: 'c_home', name: 'handoff service', file: 'r/cg.go', line: 1 } },
    edges: [],
  }
}

// W4 散度边界世界：四个被归属子系统各踩判据一侧——red=1 文件 4 入口（红）、
// three=1 文件 3 入口（不红）、spread=36 入口 12 文件（不红）、twofile=4 入口
// 2 文件（不红）。全部入口物理上挤在同一个入口容器，归属只由调用边决定。
function dispWorld(): CgGraph {
  const nodes: CgGraph['nodes'] = {}
  const edges: CgGraph['edges'] = []
  const containers: CgGraph['containers'] = { c_home: { label: '入口', kind: '入口', domain: 'home' } }
  const domains: NonNullable<CgGraph['domains']> = { home: { label: '老巢', kind: 'boundary' } }
  const groups: Array<{ stem: string; count: number; fileOf: (i: number) => string }> = [
    { stem: 'red act', count: 4, fileOf: () => 'reg/red.go' },
    { stem: 'three act', count: 3, fileOf: () => 'reg/three.go' },
    { stem: 'spread act', count: 36, fileOf: (i) => `reg/s${String(Math.ceil(i / 3)).padStart(2, '0')}.go` },
    { stem: 'twofile act', count: 4, fileOf: (i) => (i <= 2 ? 'reg/t_a.go' : 'reg/t_b.go') },
  ]
  for (const g of groups) {
    const top = g.stem.split(' ')[0]
    domains[top] = { label: g.stem, kind: 'logic' }
    containers[`c_${top}`] = { label: g.stem, kind: '类型方法', domain: top }
    for (let i = 1; i <= g.count; i += 1) {
      const eid = `${top}_e${i}`
      const fid = `${top}_f${i}`
      nodes[eid] = { kind: 'entry', container: 'c_home', name: `${g.stem} ${i}`, file: g.fileOf(i), line: i }
      nodes[fid] = { kind: 'func', container: `c_${top}`, name: `${top}.Do${i}`, file: `x/${top}${i}.go`, line: i }
      edges.push([eid, fid])
    }
  }
  return { ...blankGraph(), domains, containers, nodes, edges }
}

// W5 族世界：同名族两成员分处不同容器、不同领域——分组与容器归属无关（验收 4）；
// 触达域散度＝族成员可达顶层去重数（验收 5）：dep run 族 {ha,hc,hb,hd}=4，solo 族=1。
function familyWorld(): CgGraph {
  return {
    ...blankGraph(),
    domains: { ha: { label: '甲', kind: 'logic' }, hb: { label: '乙', kind: 'logic' }, hc: { label: '丙', kind: 'logic' }, hd: { label: '丁', kind: 'logic' } },
    containers: {
      c_a: { label: '容器甲', kind: '类型方法', domain: 'ha' },
      c_b: { label: '容器乙', kind: '入口', domain: 'hb' },
      c_c: { label: '容器丙', kind: '类型方法', domain: 'hc' },
      c_d: { label: '容器丁', kind: '类型方法', domain: 'hd' },
    },
    nodes: {
      x1: { kind: 'entry', container: 'c_a', name: 'dep run one', file: 'p/a.go', line: 1 },
      x2: { kind: 'entry', container: 'c_b', name: 'dep run two', file: 'q/b.go', line: 2 },
      y: { kind: 'entry', container: 'c_a', name: 'solo', file: 'p/y.go', line: 3 },
      t1: { kind: 'func', container: 'c_c', name: 'C.Do', file: 'c/c.go', line: 1 },
      t2: { kind: 'func', container: 'c_d', name: 'D.Do', file: 'd/d.go', line: 2 },
    },
    edges: [
      ['x1', 't1'],
      ['x2', 't2'],
    ],
  }
}

// W6 主干世界：六步覆盖四种合法 kind + 词表外 kind、子干悬空引用、iface join
// （含 flows 里塞实现数组的 §2.1-4 反面夹具）、下层入口目标（紫框 ▸ 数据）。
function flowWorld(): CgGraph {
  const steps: CgFlowStep[] = [
    { id: 's_branch', order: 1, kind: 'branch', line: 10, cond: 'err != nil', then: ['s_call', 's_ghost'], else: ['s_ret'] },
    { id: 's_call', order: 2, kind: 'call', line: 20, to: 'sub_e' },
    { id: 's_ret', order: 3, kind: 'return', line: 30 },
    { id: 's_loop', order: 4, kind: 'loop', line: 40, cond: 'range items', body: ['s_call'] },
    // implementations 不是 wire 字段（§2.1-4 禁止复制）；这里经 as-cast 塞入伪造
    // 实现数组模拟违约数据（运行期 wire 无校验，contract §3-4），断言 join 只认 implements 段。
    {
      id: 's_iface',
      order: 5,
      kind: 'call',
      line: 50,
      to: 'iface.X',
      iface: true,
      implementations: [{ nodeId: 'FAKE', name: '伪造', entryNodeId: '' }],
    } as CgFlowStep,
    // 词表外 kind 同样经 as-cast 模拟未校验 wire。
    { id: 's_bad', order: 6, kind: 'jump' as unknown as CgFlowStep['kind'], line: 60, to: 't' },
  ]
  return {
    ...blankGraph(),
    domains: { home: { label: '老巢', kind: 'boundary' }, biz: { label: '业务', kind: 'logic' } },
    containers: {
      c_home: { label: '入口', kind: '入口', domain: 'home' },
      c_t: { label: 'T', kind: '类型方法', domain: 'biz' },
      c_ia: { label: 'AdapterA', kind: '类型方法', domain: 'biz' },
      c_ib: { label: 'AdapterB', kind: '类型方法', domain: 'biz' },
      c_sub: { label: '下层入口', kind: '入口', domain: 'biz' },
    },
    nodes: {
      e: { kind: 'entry', container: 'c_home', name: 'flow cmd', file: 'r/e.go', line: 1 },
      t: { kind: 'func', container: 'c_t', name: 'T.Do', file: 'b/t.go', line: 5 },
      sub_e: { kind: 'entry', container: 'c_sub', name: 'sub cmd', file: 'b/s.go', line: 2 },
      ia: { kind: 'func', container: 'c_ia', name: 'A.Start', file: 'b/ia.go', line: 3 },
      ib: { kind: 'func', container: 'c_ib', name: 'B.Start', file: 'b/ib.go', line: 4 },
      ea: { kind: 'entry', container: 'c_ia', name: 'A serve', file: 'b/ia.go', line: 1 },
    },
    edges: [['e', 't']],
    implements: [
      ['ia', 'iface.X'],
      ['ib', 'iface.X'],
      ['ix', 'iface.Y'],
    ],
    flows: { e: { steps } },
  }
}

// W7 降级双向基座：flows 缺席 / 键在但该入口缺席 / 命中三态共用。
function degradeBase(flows?: CgGraph['flows']): CgGraph {
  return {
    ...blankGraph(),
    domains: { home: { label: '老巢', kind: 'boundary' }, biz: { label: '业务', kind: 'logic' } },
    containers: {
      c_home: { label: '入口', kind: '入口', domain: 'home' },
      c_b: { label: 'B', kind: '类型方法', domain: 'biz' },
    },
    nodes: {
      n_entry: { kind: 'entry', container: 'c_home', name: 'n cmd', file: 'r/n.go', line: 1 },
      f1: { kind: 'func', container: 'c_b', name: 'B.Do', file: 'b/f.go', line: 2 },
    },
    edges: [['n_entry', 'f1']],
    ...(flows === undefined ? {} : { flows }),
  }
}

describe('C12.3 缝 2：入口归属三态（§2.4-32）', () => {
  it('多值：同一最近前沿的两个异域目标全部升序呈现，兜底桶噪声不入候选；multi 归属不发散发度读数', () => {
    const m = deriveFlowPage({ baseline: multiWorld(), entryNodeId: 'e' })
    expect(m.ownership).toEqual({ state: 'multi', candidates: ['biz', 'other'] })
    // 归属非单值时没有唯一归属就不发散发度（flowpage.ts 判定口径），与 none/幽灵两支同锁一个 null。
    expect(m.registrationDispersion).toBeNull()
  })

  it('单值：最近合格跨域层判单值；更近的兜底桶与同域中转都不改判；悬空边忽略', () => {
    const m = deriveFlowPage({ baseline: singleWorld('normal'), entryNodeId: 'e' })
    expect(m.ownership).toEqual({ state: 'single', domainId: 'biz' })
  })

  it('稳定性：edges 原序扰动不改变归属结果与可达序列', () => {
    const a = deriveFlowPage({ baseline: singleWorld('normal'), entryNodeId: 'e' })
    const b = deriveFlowPage({ baseline: singleWorld('reversed'), entryNodeId: 'e' })
    expect(b.ownership).toEqual(a.ownership)
    expect(b.callChain.nodeIds).toEqual(a.callChain.nodeIds)
  })

  it('领域链上溯：归属比较在顶层子系统层面进行（同树跨层不算跨域）', () => {
    const w: CgGraph = {
      ...blankGraph(),
      domains: {
        root_a: { label: '顶甲', kind: 'boundary' },
        mid_a: { label: '中甲', kind: 'logic', parent: 'root_a' },
        leaf_a: { label: '叶甲', kind: 'logic', parent: 'mid_a' },
        root_b: { label: '顶乙', kind: 'boundary' },
      },
      containers: {
        c_leaf: { label: '入口容器', kind: '入口', domain: 'leaf_a' },
        c_mid_fn: { label: '中域函数', kind: '类型方法', domain: 'mid_a' },
        c_b: { label: '乙容器', kind: '类型方法', domain: 'root_b' },
      },
      nodes: {
        e: { kind: 'entry', container: 'c_leaf', name: 'deep cmd', file: 'r/d.go', line: 1 },
        mf: { kind: 'func', container: 'c_mid_fn', name: 'Mid.Do', file: 'm/m.go', line: 1 },
        bf: { kind: 'func', container: 'c_b', name: 'B.Do', file: 'b/b.go', line: 1 },
      },
      edges: [
        ['e', 'mf'],
        ['mf', 'bf'],
      ],
    }
    const m = deriveFlowPage({ baseline: w, entryNodeId: 'e' })
    expect(m.ownership).toEqual({ state: 'single', domainId: 'root_b' })
  })

  it('判不出：Cobra 式无出边入口标「无行为」，族照常解析为 CLI handoff', () => {
    const m = deriveFlowPage({ baseline: cobraWorld(), entryNodeId: 'e_cg' })
    expect(m.ownership).toEqual({ state: 'none' })
    expect(m.registrationDispersion).toBeNull()
    expect(m.family).toEqual({ familyId: 'handoff', kind: 'cli', label: 'CLI handoff', members: 1, reachDomains: 1 })
  })
})

describe('C12.3 缝 2：注册散度边界（§2.4-33）', () => {
  it('四侧边界：1 文件 4 入口红；1 文件 3 入口不红；36 入口 12 文件不红；4 入口 2 文件不红', () => {
    const w = dispWorld()
    const q = (id: string) => deriveFlowPage({ baseline: w, entryNodeId: id })
    expect(q('red_e1').ownership).toEqual({ state: 'single', domainId: 'red' })
    expect(q('red_e1').registrationDispersion).toEqual({ domainId: 'red', entries: 4, files: 1, concentrated: true })
    expect(q('three_e1').registrationDispersion).toEqual({ domainId: 'three', entries: 3, files: 1, concentrated: false })
    expect(q('spread_e1').registrationDispersion).toEqual({ domainId: 'spread', entries: 36, files: 12, concentrated: false })
    expect(q('twofile_e4').registrationDispersion).toEqual({ domainId: 'twofile', entries: 4, files: 2, concentrated: false })
  })
})

describe('C12.3 缝 2：族分组与触达域散度（§2.4-34 + R1）', () => {
  it('族从名字算出、跨容器跨域成员照常聚合；触达域散度数值化（4 与 1）', () => {
    const w = familyWorld()
    const dep = deriveFlowPage({ baseline: w, entryNodeId: 'x1' }).family
    expect(dep).toEqual({ familyId: 'dep run', kind: 'cli', label: 'CLI dep run', members: 2, reachDomains: 4 })
    expect(deriveFlowPage({ baseline: w, entryNodeId: 'y' }).family).toEqual({
      familyId: 'solo',
      kind: 'cli',
      label: 'CLI solo',
      members: 1,
      reachDomains: 1,
    })
  })

  it('HTTP 形态按路径前两段成族（方法词剥离）；全字段值级锁定含 reachDomains', () => {
    const w: CgGraph = {
      ...familyWorld(),
      nodes: {
        h1: { kind: 'entry', container: 'c_a', name: 'GET /api/tasks/{id}/branches', file: 'p/h.go', line: 1 },
        h2: { kind: 'entry', container: 'c_b', name: 'POST /api/tasks', file: 'q/h.go', line: 2 },
        lone: { kind: 'entry', container: 'c_a', name: 'GET /machines', file: 'p/m.go', line: 3 },
      },
      edges: [],
    }
    expect(deriveFlowPage({ baseline: w, entryNodeId: 'h1' }).family).toEqual({
      familyId: '/api/tasks',
      kind: 'http',
      label: 'HTTP /api/tasks',
      members: 2,
      reachDomains: 2,
    })
    expect(deriveFlowPage({ baseline: w, entryNodeId: 'lone' }).family).toEqual({
      familyId: '/machines',
      kind: 'http',
      label: 'HTTP /machines',
      members: 1,
      reachDomains: 1,
    })
  })

  it('裸路径（无方法词）同样按路径前两段成族；reachDomains 值级锁定', () => {
    const w: CgGraph = {
      ...familyWorld(),
      nodes: {
        b1: { kind: 'entry', container: 'c_a', name: '/api/tasks', file: 'p/b.go', line: 1 },
        b2: { kind: 'entry', container: 'c_b', name: '/api/tasks/export', file: 'q/b.go', line: 2 },
        b3: { kind: 'entry', container: 'c_a', name: '/health', file: 'p/h.go', line: 3 },
      },
      edges: [],
    }
    expect(deriveFlowPage({ baseline: w, entryNodeId: 'b1' }).family).toEqual({
      familyId: '/api/tasks',
      kind: 'http',
      label: 'HTTP /api/tasks',
      members: 2,
      reachDomains: 2,
    })
    expect(deriveFlowPage({ baseline: w, entryNodeId: 'b3' }).family).toEqual({
      familyId: '/health',
      kind: 'http',
      label: 'HTTP /health',
      members: 1,
      reachDomains: 1,
    })
  })
})

describe('C12.3 缝 2：流程主干模型（§2.4-31/-35 数据面）', () => {
  it('steps 按 order 升序稳定排序；子干引用完整透传；悬空引用显式收集', () => {
    const m = deriveFlowPage({ baseline: flowWorld(), entryNodeId: 'e' })
    expect(m.degraded).toBe(false)
    expect(m.steps.map((s) => s.id)).toEqual(['s_branch', 's_call', 's_ret', 's_loop', 's_iface', 's_bad'])
    const branch = m.steps.find((s) => s.id === 's_branch')
    expect(branch?.cond).toBe('err != nil')
    expect(branch?.then).toEqual(['s_call', 's_ghost'])
    expect(branch?.else).toEqual(['s_ret'])
    expect(m.steps.find((s) => s.id === 's_loop')?.body).toEqual(['s_call'])
    expect(m.danglingChildRefs).toEqual(['s_ghost'])
  })

  it('步骤派生读数：目标名/顶层域/紫框▸标记逐字段可断言；词表外 kind 显式 unknownKind', () => {
    const m = deriveFlowPage({ baseline: flowWorld(), entryNodeId: 'e' })
    const call = m.steps.find((s) => s.id === 's_call')
    expect(call?.targetName).toBe('sub cmd')
    expect(call?.targetDomain).toBe('biz')
    expect(call?.targetIsEntry).toBe(true)
    const bad = m.steps.find((s) => s.id === 's_bad')
    expect(bad?.targetName).toBe('T.Do')
    expect(bad?.targetIsEntry).toBe(false)
    expect(bad?.unknownKind).toBe(true)
    expect(m.steps.filter((s) => !s.unknownKind)).toHaveLength(5)
    const ret = m.steps.find((s) => s.id === 's_ret')
    expect(Object.prototype.hasOwnProperty.call(ret, 'to')).toBe(false)
    expect(ret?.targetName).toBeNull()
    expect(ret?.targetDomain).toBe('')
  })

  it('iface 实现清单＝implements join（[实现,接口] 方向）；flows 里塞的实现数组被忽略（§2.1-4 反面）', () => {
    const m = deriveFlowPage({ baseline: flowWorld(), entryNodeId: 'e' })
    const iface = m.steps.find((s) => s.id === 's_iface')
    expect(iface?.implementations).toEqual([
      { nodeId: 'ia', name: 'A.Start', entryNodeId: 'ea' },
      { nodeId: 'ib', name: 'B.Start', entryNodeId: '' },
    ])
    const plain = m.steps.find((s) => s.id === 's_branch')
    expect(Object.prototype.hasOwnProperty.call(plain, 'iface')).toBe(false)
    expect(plain?.implementations).toEqual([])
  })

  it('同 order 平局按 id 升序稳定排序：steps 数组原序扰动不改输出序（沿 singleWorld edgeOrder 双向手法）', () => {
    // 同 order(7) 的两步按 id 逆序放入数组——若 tie-break 失效，稳定排序会保留 z 在 a 前。
    const mkSteps = (): CgFlowStep[] => [
      { id: 'z_tie', order: 7, kind: 'call', line: 2, to: 'f1' },
      { id: 'a_tie', order: 7, kind: 'call', line: 1, to: 'f1' },
      { id: 'm_mid', order: 6, kind: 'return', line: 3 },
    ]
    const ma = deriveFlowPage({ baseline: degradeBase({ n_entry: { steps: mkSteps() } }), entryNodeId: 'n_entry' })
    const mb = deriveFlowPage({ baseline: degradeBase({ n_entry: { steps: [...mkSteps()].reverse() } }), entryNodeId: 'n_entry' })
    expect(ma.steps.map((s) => s.id)).toEqual(['m_mid', 'a_tie', 'z_tie'])
    expect(mb.steps.map((s) => s.id)).toEqual(ma.steps.map((s) => s.id))
  })

  it('iface=true 但 implements join 零命中：implementations 是显式空态 [] 而非 undefined/被吞', () => {
    const w = degradeBase({
      n_entry: { steps: [{ id: 's_iface_empty', order: 1, kind: 'call', line: 7, to: 'f1', iface: true }] },
    })
    const m = deriveFlowPage({ baseline: w, entryNodeId: 'n_entry' })
    const step = m.steps.find((s) => s.id === 's_iface_empty')
    expect(Object.prototype.hasOwnProperty.call(step, 'implementations')).toBe(true)
    expect(step?.implementations).toEqual([])
  })

  it('机械序列恒住 callChain 不进主干；模型顶层九键冻结；散度与族在命中态照常输出', () => {
    const m = deriveFlowPage({ baseline: flowWorld(), entryNodeId: 'e' })
    expect(m.callChain).toEqual({ nodeIds: ['e', 't'], sequenced: false, conditional: false })
    expect(Object.keys(m).sort()).toEqual([
      'callChain',
      'danglingChildRefs',
      'degraded',
      'entryFound',
      'entryNodeId',
      'family',
      'ownership',
      'registrationDispersion',
      'steps',
    ])
    expect(m.ownership).toEqual({ state: 'single', domainId: 'biz' })
    expect(m.registrationDispersion).toEqual({ domainId: 'biz', entries: 1, files: 1, concentrated: false })
    expect(m.family).toEqual({ familyId: 'flow', kind: 'cli', label: 'CLI flow', members: 1, reachDomains: 2 })
  })
})

describe('C12.3 缝 2：降级双向与幽灵入口（§2.4-31、ticket0 值级断言的后继）', () => {
  it('flows 键整体缺席 → degraded=true；序列只进 callChain、steps 主干恒空（冒充被结构锁死）', () => {
    const m = deriveFlowPage({ baseline: degradeBase(), entryNodeId: 'n_entry' })
    expect(m.entryNodeId).toBe('n_entry')
    expect(m.degraded).toBe(true)
    expect(m.entryFound).toBe(true)
    expect(m.steps).toEqual([])
    expect(m.callChain).toEqual({ nodeIds: ['n_entry', 'f1'], sequenced: false, conditional: false })
    expect(m.danglingChildRefs).toEqual([])
  })

  it('flows 在但该入口缺席 → degraded=true（双向第二侧）', () => {
    const w = degradeBase({
      other: { steps: [{ id: 'z1', order: 1, kind: 'call', line: 1, to: 'f1' }] },
    })
    const m = deriveFlowPage({ baseline: w, entryNodeId: 'n_entry' })
    expect(m.degraded).toBe(true)
    expect(m.steps).toEqual([])
    expect(m.ownership).toEqual({ state: 'single', domainId: 'biz' })
  })

  it('flows 命中该入口 → degraded=false（值级后继：ticket0 :29 断言正式化）', () => {
    const w = degradeBase({
      n_entry: {
        steps: [
          { id: 's1', order: 2, kind: 'call', line: 9, to: 'f1' },
          { id: 's2', order: 1, kind: 'branch', line: 8, cond: 'ok', then: ['s1'] },
        ],
      },
    })
    const m = deriveFlowPage({ baseline: w, entryNodeId: 'n_entry' })
    expect(m.degraded).toBe(false)
    expect(m.steps.map((s) => s.id)).toEqual(['s2', 's1'])
  })

  it('幽灵入口显式降级：entryFound=false、全家字段如实、不崩溃', () => {
    const m = deriveFlowPage({ baseline: blankGraph(), entryNodeId: 'ghost' })
    expect(m.entryFound).toBe(false)
    expect(m.degraded).toBe(true)
    expect(m.ownership).toEqual({ state: 'none' })
    expect(m.registrationDispersion).toBeNull()
    expect(m.family).toBeNull()
    expect(m.steps).toEqual([])
    expect(m.callChain).toEqual({ nodeIds: [], sequenced: false, conditional: false })
    expect(m.danglingChildRefs).toEqual([])
  })
})
