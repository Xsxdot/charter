# C1.9 实现计划：查看器二期——嵌套同构下钻、迁移视角对照、欠账读数

## 0. 交付边界与已核事实

本计划只覆盖 charter `graph/webui`，不修改宿主、`graph/codegraph`、`graph/webui/src/api/types.ts`、wire 字段或路由依赖。输入是已批准的 `docs/specs/2026-08-24-codegraph-viewer-migration-spec.md`；一期冻结物是 `docs/contracts/2026-08-24-codegraph-viewer-compare-contract.md`。

已核事实：

- spec 第 4 行规定 L2 单子系统，只动 `graph/webui`，消费 C1.3 三个可选字段。
- spec 第 30~34 行规定欠账四件套、迁移清单、嵌套同构、叶子领域图和回退不变；第 38~40 行规定纯函数派生、复用 BestDetail 分组逻辑、不加路由。
- spec 第 44~46 行规定纯函数缝、组件缝和一期回归。
- `docs/contracts/2026-08-24-codegraph-viewer-compare-contract.md:9-27` 冻结 `best`、`target`、`report` 的 JSON 形状、缺席语义和未知 `kind` 缺省渲染；`graph/webui/src/api/types.ts:30-83` 已逐字镜像，计划不改该文件。
- `graph/webui/src/app/codegraph/besttree.ts:51-348` 已有顶层子系统、容器归属、方向、执法读数和容器分组纯函数；`BestPanorama.tsx:79-224` 已有理想树布局/平移/缩放；`BestDetail.tsx:71-175` 已有 best 容器分组与 misplaced 双侧文字；`CodegraphPage.tsx:26-203` 已有视图回退、现状下钻和 best/现状分流。
- `graph/webui/package.json` 的验收入口是 `npm run typecheck`、`npm test`、`npm run build`。
- phase2 原型目录在当前仓库不存在（台账已记）；视觉细节以 spec 明文和 C1.3 现有组件为准，布局可读性列入真机走查，不伪造原型像素判据。

基线判据已先于本计划落笔运行：

- `npm run typecheck && npm test`（工作目录 `graph/webui`）退出 0；TypeScript 无输出；Vitest `Test Files 14 passed (14)`、`Tests 89 passed (89)`。
- `npm run build`（工作目录 `graph/webui`）退出 0；Vite `✓ 42 modules transformed`、`✓ built in 621ms`。
- 依赖安装记录：`npm ci --cache /root/.handoff/tmp/762e73d2/npm-cache` 退出 0，`added 168 packages, and audited 169 packages in 4s`、`found 0 vulnerabilities`。

## 1. 跨 task 冻结接口与口径

以下接口只在 `graph/webui/src/app/codegraph/besttree.ts` 内新增/导出；它们是 webui 包内渲染 API，不属于 C1.3 wire 镜像。实现者必须逐字使用这些名字和参数顺序。

```ts
import type { CgBest, CgCheckReport, CgGraph, CgTarget } from '../../api/types'

export interface DebtReadout {
  fails: number
  directCalls: number
  coveredDirections: number
  totalDirections: number
  misplaced: number
  bidirectionalPairs: number
  targetAvailable: boolean
}

export interface MigrationItem {
  containerId: string
  containerLabel: string
  currentDomainId: string
  currentDomainLabel: string
  expectedDomainId: string
  expectedDomainLabel: string
  expectedSubsystemId: string
}

export interface MigrationGroup {
  expectedDomainId: string
  expectedDomainLabel: string
  items: MigrationItem[]
  count: number
}

export interface BestDirectionDetail {
  key: string
  from: string
  to: string
  directCalls: number
  legacyBudget?: number
  narrowEntries: string[]
  counterpartKey?: string
  bidirectional: boolean
}

export interface BestScopeCard {
  id: string
  label: string
  responsibility: string
  type: string
  external: boolean
  containerCount: number
  misplacedCount: number
  childCount: number
}

export interface BestScopeEdge {
  key: string
  from: string
  to: string
  directCalls: number
  directions: string[]
}

export interface BestScopeGraph {
  scopeId: string | null
  cards: BestScopeCard[]
  edges: BestScopeEdge[]
  leaf: boolean
}

export function debtReadout(target: CgTarget | undefined, report: CgCheckReport | undefined): DebtReadout | null
export function migrationGroups(best: CgBest, baseline: CgGraph, report: CgCheckReport | undefined): MigrationGroup[]
export function directionDetail(key: string, target: CgTarget | undefined, report: CgCheckReport | undefined): BestDirectionDetail | null
export function bestScopeGraph(best: CgBest, target: CgTarget | undefined, report: CgCheckReport | undefined, scopeId: string | null): BestScopeGraph
export function bestDomainPath(best: CgBest, domainId: string): string[]
export function childBestDomainIds(best: CgBest, parentId: string): string[]
export function isBestLeaf(best: CgBest, domainId: string): boolean
export function bestDomainLabel(best: CgBest, domainId: string): string
export function bestDomainContainerIds(best: CgBest, domainId: string): string[]
export function bestContainerFacts(best: CgBest, baseline: CgGraph, domainId: string): Record<string, ContainerFacts>
```

固定口径：

1. `debtReadout` 在 `report` 缺席时返回 `null`；组件显示「无数据」，不把缺席伪装成零。`report` 存在而 `target` 缺席时返回 `targetAvailable:false`，直调/放错位仍读 report，窄缝显示 `—` 而不是 `0/0`。
2. `directCalls` 是 `Object.values(report.legacyHits ?? {})` 的总和；单边直调值缺席与明确的 `0` 都保留为可渲染的 `欠 0`。`coveredDirections` 是 `target.contracts` 中 `entries` 非空的方向数，`totalDirections` 是 contracts 数；缺失 `entries` 与空数组都不是窄缝覆盖。contract 顺序不是语义，输出按稳定 key 排序。
3. `bidirectionalPairs` 对 `target.contracts` 的精确 `from->to` 键做去重，再统计同时存在反向键的无向对；`a->a` 不计环对，重复 contract 不重复计数。
4. `migrationGroups` 只消费 `report.warns` 中 `kind === 'container-misplaced'` 且 `from` 存在的项；按 `best.containers[containerId]` 的应然领域分组，容器 id、组内项目均升序。baseline 领域缺失显示「未归属」；best 归属缺失进入 `expectedDomainId: ''`、`expectedDomainLabel: '未映射目标'` 组，不能静默丢掉 finding。
5. `directionDetail` 通过精确 key 查 target contract 和 `report.legacyHits`，保留 `entries ?? []` 的窄缝清单；反向 contract 存在时填 `counterpartKey` 与 `bidirectional:true`，不存在时二者分别为 `undefined`/`false`。
6. `bestScopeGraph` 的 `scopeId:null` 投影 top-level parent 为空的 domain；非空 scope 只投影其直接子领域。scope 外但被本层 contract 触及的领域折成 `ext:<top-level-id>` 虚线卡；两端都在圈外的边不画；scope 内部与圈外之间的边保留；同一投影边的 `directCalls` 求和、`directions` 按原始方向 key 排序。`leaf` 由 `isBestLeaf(best, scopeId)` 决定，未知 scope 返回空卡/空边而不抛错。

## 2. Task 1：纯函数欠账/迁移/递归投影层

### 文件范围

- 修改：`graph/webui/src/app/codegraph/besttree.ts`
- 修改：`graph/webui/src/app/codegraph/besttree.test.ts`
- 不得修改：`graph/webui/src/api/types.ts`、`graph/codegraph/**`、任一宿主文件。

### Interfaces

Consumes：`CgBest`、`CgTarget`、`CgCheckReport`、`CgGraph`，以及现有 `subsystemOf`、`assembleDirections`、`containerFacts`、`groupContainersBySubdomain`。

Produces：第 1 节的 `DebtReadout`、`MigrationGroup[]`、`BestDirectionDetail`、`BestScopeGraph` 和 helper，供 Task 2/3/4 消费；不向 wire 增加字段。

### 基线判据（已跑）

动手前已在当前 HEAD 执行：`npm run typecheck && npm test` -> `exit 0; Test Files 14 passed (14); Tests 89 passed (89)`；`npm run build` -> `exit 0; ✓ 42 modules transformed; ✓ built in 621ms`。

### 2~5 分钟动作序列

1. 在 `besttree.test.ts` 现有 fixture 后新增失败测试；保留现有 describe，不复制 `types.ts` 镜像。

```ts
describe('C1.9 debt and migration projections', () => {
  it('区分 report 缺席、target 缺席和明确零值，并计算四件套', () => {
    const targetWithEntries: CgTarget = { ...target, contracts: [
      { from: 'ss_api', to: 'ss_store', entries: ['read'], legacyBudget: 2 },
      { from: 'ss_store', to: 'ss_api', entries: ['write'], legacyBudget: 0 },
      { from: 'ss_api', to: 'ss_api_read', entries: [], legacyBudget: 1 },
    ] }
    const reportWithZero: CgCheckReport = { ...report,
      fails: [...report.fails, { kind: 'over-budget', from: 'ss_api', to: 'ss_store', detail: '超预算' }],
      legacyHits: { 'ss_api->ss_store': 3, 'ss_store->ss_api': 0 },
    }
    expect(debtReadout(targetWithEntries, reportWithZero)).toEqual({
      fails: 3, directCalls: 3, coveredDirections: 2, totalDirections: 3,
      misplaced: 2, bidirectionalPairs: 1, targetAvailable: true,
    })
    expect(debtReadout(undefined, reportWithZero)).toMatchObject({
      directCalls: 3, coveredDirections: 0, totalDirections: 0, targetAvailable: false,
    })
    expect(debtReadout(targetWithEntries, undefined)).toBeNull()
  })

  it('按应然领域分组全部 misplaced，稳定排序并保留未知目标组', () => {
    const baselineWithDomains: CgGraph = { ...graph,
      domains: { old: { label: '现状旧域', kind: 'logic' }, current: { label: '现状域', kind: 'logic' } },
      containers: { ...graph.containers,
        c_api: { ...graph.containers.c_api, domain: 'old' },
        c_api_detail: { ...graph.containers.c_api_detail, domain: 'current' },
      },
    }
    const groups = migrationGroups(best, baselineWithDomains, report)
    expect(groups.map((group) => [group.expectedDomainId, group.count])).toEqual([
      ['api_read', 1], ['api_read_detail', 1],
    ])
    expect(groups[0].items[0]).toMatchObject({
      containerId: 'c_api', containerLabel: 'API 容器', currentDomainLabel: '现状旧域',
      expectedDomainLabel: '读取领域', expectedSubsystemId: 'ss_api',
    })
  })

  it('方向详情保留窄缝、明确零值和反向对端', () => {
    const targetWithEntries: CgTarget = { ...target, contracts: [
      { from: 'ss_api', to: 'ss_store', entries: ['read'], legacyBudget: 2 },
      { from: 'ss_store', to: 'ss_api', entries: [], legacyBudget: 0 },
    ] }
    expect(directionDetail('ss_store->ss_api', targetWithEntries, report)).toEqual({
      key: 'ss_store->ss_api', from: 'ss_store', to: 'ss_api', directCalls: 0,
      legacyBudget: 0, narrowEntries: [], counterpartKey: 'ss_api->ss_store', bidirectional: true,
    })
    expect(directionDetail('missing->direction', targetWithEntries, report)).toBeNull()
  })

  it('递归投影只给直接子领域，圈外折成 ext 卡，叶子可判定', () => {
    const nestedTarget: CgTarget = { ...target, contracts: [
      { from: 'api_read', to: 'api_read_detail', entries: ['detail'] },
      { from: 'api_read', to: 'ss_store', entries: ['store'] },
    ] }
    const nested = bestScopeGraph(best, nestedTarget, report, 'ss_api')
    expect(nested.leaf).toBe(false)
    expect(nested.cards.map((card) => [card.id, card.external])).toEqual([
      ['api_read', false], ['ext:ss_store', true],
    ])
    expect(nested.edges).toEqual([
      { key: 'api_read->ext:ss_store', from: 'api_read', to: 'ext:ss_store', directCalls: 0, directions: ['api_read->ss_store'] },
    ])
    expect(bestScopeGraph(best, nestedTarget, report, 'api_read').leaf).toBe(false)
    expect(isBestLeaf(best, 'api_read_detail')).toBe(true)
  })
})
```

2. 运行失败测试：`npx vitest run src/app/codegraph/besttree.test.ts`；预期新增断言失败，未实现前不得写绿。
3. 在 `besttree.ts` 增加第 1 节接口和函数。复用现有 `subsystemOf`、`childDomainIds`、`assembleDirections`、`containerFacts`；把 `childDomainIds` 改为导出 `childBestDomainIds` 的唯一实现，避免同名算法分叉。所有 parent/contract/finding 遍历使用 `Set` 防坏数据环，所有结果按 id/key 排序。
4. 为纯函数补注释：文件头写「只读 best/target/report 投影，不读 DOM、不发请求」职责和边界；每个导出函数写参数/返回/缺席语义；在 `bestScopeGraph` 投影圈外端点的分支旁写明“保留横跳可见性，避免嵌套页丢跨域边”的原因。
5. 纯函数没有外部调用、持久资源或错误传播路径，因此不在函数内打印日志（否则破坏纯性）；在 Task 2/4 的唯一渲染/交互入口使用项目既有 `console.debug/info/warn` 对象参数记录投影规模、下钻与缺失目标。
6. 运行绿色最小验收：`npx vitest run src/app/codegraph/besttree.test.ts && npm run typecheck`；预期新增与原有 besttree 用例全部通过，TypeScript 无输出。
7. 运行 `git diff --check`；退出 0 后把命令原始摘要追加到 `docs/ledgers/2026-08-24-codegraph-viewer-migration-ledger.md`。

### Task 1 验收与反面断言

- `report` 缺席必须得到 `null`，不能得到四个 0。
- 明确 `legacyHits[key] = 0` 必须保留方向详情和 `欠 0` 所需的方向 key；不存在的 key 不得被凭空创建。
- 反向 contract 只计一个 bidirectional pair；自环和重复项不计多次。
- 未知 finding kind 不抛异常；未知 domain/断链/环不死循环。
- migration group 总数等于所有可归组 `container-misplaced` finding 数；未知目标进入可见组，不静默丢失。

## 3. Task 2：欠账横幅、债务边和迁移清单覆盖层

### 文件范围

- 修改：`graph/webui/src/app/codegraph/BestPanorama.tsx`
- 修改：`graph/webui/src/app/codegraph/BestPanorama.test.tsx`
- 新增：`graph/webui/src/app/codegraph/BestOverlays.tsx`
- 新增：`graph/webui/src/app/codegraph/BestOverlays.test.tsx`

### Interfaces

Consumes：

```ts
BestPanoramaProps = {
  best: CgBest
  target?: CgTarget
  report?: CgCheckReport
  selectedSubsystem: string
  selectedEdge: string
  onSelectSubsystem: (id: string) => void
  onSelectEdge: (key: string) => void
}

export interface DebtBannerProps { readout: DebtReadout | null }
export function DebtBanner(props: DebtBannerProps): JSX.Element

export interface MigrationSidebarProps {
  groups: MigrationGroup[]
  selectedContainer: string
  onSelectContainer: (item: MigrationItem) => void
}
export function MigrationSidebar(props: MigrationSidebarProps): JSX.Element

export interface BestEdgeDetailProps {
  edge: BestScopeEdge | null
  target?: CgTarget
  report?: CgCheckReport
}
export function BestEdgeDetail(props: BestEdgeDetailProps): JSX.Element
```

Produces：`BestPanorama` 输出 `[data-best-debt]`、`[data-best-direction]`、`[data-best-edge-detail]`；`DebtBanner` 输出 `[data-debt="directCalls|coverage|misplaced|bidirectional|fails"]`；`MigrationSidebar` 输出 `[data-migration-sidebar]`、`[data-migration-group]`、`[data-migration-item]`；Task 4 只通过 callback 消费，不读取 DOM 文本。

### 基线判据（已跑）

沿用第 0 节已跑的 `npm run typecheck && npm test`（14/89）和 `npm run build`（42 modules）。本 task 只跑新增/触及文件测试，不把全量测试归入单 task。

### 2~5 分钟动作序列

1. 在 `BestPanorama.test.tsx` 扩展现有 fixture（把 import 改为包含 `fireEvent`），先写红测试：横幅四件套、fails 红色优先、边 `欠 N`、零值、未知 kind 不崩、点击边调用 `onSelectEdge`；在 `BestOverlays.test.tsx` 写侧栏分组/计数/空态/点击回调和 edge detail 的窄缝/反向警示。

```tsx
it('横幅显示欠账四件套，fails 置于最前且 report 缺席不是零', () => {
  const { container, rerender } = render(<BestPanorama best={best} target={target} report={report}
    selectedSubsystem="" selectedEdge="" onSelectSubsystem={vi.fn()} onSelectEdge={vi.fn()} />)
  expect(container.querySelector('[data-debt="fails"]')?.textContent).toBe('fails 2')
  expect(container.querySelector('[data-debt="directCalls"]')?.textContent).toBe('直调余额 2')
  expect(container.querySelector('[data-debt="coverage"]')?.textContent).toBe('窄缝覆盖 0/1')
  expect(container.querySelector('[data-debt="misplaced"]')?.textContent).toBe('放错位 1')
  expect(container.querySelector('[data-debt="bidirectional"]')?.textContent).toBe('双向环 0')
  rerender(<BestPanorama best={best} target={target} selectedSubsystem="" selectedEdge=""
    onSelectSubsystem={vi.fn()} onSelectEdge={vi.fn()} />)
  expect(container.querySelector('[data-debt="none"]')?.textContent).toContain('无数据')
  expect(container.querySelector('[data-debt="directCalls"]')).toBeNull()
})

it('边标签为欠账数、按债务级别着色，点击选择原始方向 key', () => {
  const onSelectEdge = vi.fn()
  const { container } = render(<BestPanorama best={best} target={target} report={report}
    selectedSubsystem="" selectedEdge="" onSelectSubsystem={vi.fn()} onSelectEdge={onSelectEdge} />)
  const edge = container.querySelector('[data-best-direction="ss_api->ss_store"]') as HTMLElement
  expect(edge.dataset.debt).toBe('2')
  expect(edge.textContent).toContain('欠 2')
  expect(edge.dataset.debtLevel).toMatch(/^(0|[1-9]|10)$/)
  fireEvent.click(edge)
  expect(onSelectEdge).toHaveBeenCalledWith('ss_api->ss_store')
})
```

2. 运行 `npx vitest run src/app/codegraph/BestPanorama.test.tsx src/app/codegraph/BestOverlays.test.tsx`；预期新增断言红、现有测试可能因 props 增加而编译红。
3. 在 `BestOverlays.tsx` 写文件头职责/边界和三个导出组件。`DebtBanner` 只渲染 `DebtReadout`，`targetAvailable:false` 时只把 coverage 渲染成 `窄缝覆盖 —`；`report:null` 渲染显式 `无数据`。fails 使用 `text-destructive` 和 DOM 顺序第一。
4. 在 `BestPanorama.tsx` 将现有 `EnforcementBanner` 替换为 `DebtBanner`，保留 `layoutDomains`、wheel cleanup、空白平移和 relayout 逻辑。方向 stroke 使用固定线性插值 `#dbeafe -> #1d4ed8`，级别为 `Math.round(directCalls / maxDirectCalls * 10)`；超预算/未声明/未建成只叠加状态 dash/border，不覆盖债务梯度。标签始终包含 `欠 ${directCalls}`，再附预算/状态。
5. `BestEdgeDetail` 对 `BestScopeEdge.directions` 升序渲染每条原始方向：`实测 ${directCalls}`、`预算 ${legacyBudget ?? '—'}`、`窄缝 ${entries.length ? entries.join('、') : '无'}`；`bidirectional` 为真时显示「双向对端：${counterpartKey}」。`edge:null` 渲染稳定空壳和「选择一条边查看方向明细」。
6. `MigrationSidebar` 按 `MigrationGroup[]` 顺序渲染组头 `expectedDomainLabel + count`；条目显示 `containerLabel · 现在在 ${currentDomainLabel} → 应归 ${expectedDomainLabel}`；空数组只显示「无待迁移件」。点击只回调原始 `MigrationItem`，不直接修改 best/target。
7. 在 `BestPanorama.tsx` 新增导出函数注释并加 `console.debug('[codegraph] render best panorama', { subsystemCount: ids.length, directionCount: directions.length, hasReport: !!report })`；不得使用 `print` 或未结构化字符串拼接日志。关键错误/缺席由 `DebtBanner` 明示，不吞异常。
8. 运行最小绿验收：`npx vitest run src/app/codegraph/BestPanorama.test.tsx src/app/codegraph/BestOverlays.test.tsx && npm run typecheck`；预期触及用例全绿、TypeScript 无输出。
9. 运行 `git diff --check`，把原始输出和测试摘要追加台账。

### Task 2 验收与反面断言

- `report` 缺席不能出现 `直调余额 0`、`窄缝覆盖 0/0` 或 `放错位 0`。
- `legacyHits` 明确为 0 的边必须有 `[data-best-direction]` 且文字为 `欠 0`；边集合不得来自 baseline.edges。
- 最大债务边与零债务边的 `data-debt-level` 不相同；超预算/未声明状态仍可区分。
- 侧栏总条目数与横幅 misplaced 数一致；空侧栏不是空白而是「无待迁移件」。
- 组件无写路径、无请求、无路由；点击仅回调。

## 4. Task 3：嵌套同构全景与叶子容器图

### 文件范围

- 新增：`graph/webui/src/app/codegraph/BestScopePanorama.tsx`
- 新增：`graph/webui/src/app/codegraph/BestScopePanorama.test.tsx`
- 新增：`graph/webui/src/app/codegraph/BestLeafGraph.tsx`
- 新增：`graph/webui/src/app/codegraph/BestLeafGraph.test.tsx`
- 复用但不修改：`besttree.ts` 的 `bestScopeGraph`、`bestContainerFacts`、`groupContainersBySubdomain`。

### Interfaces

Consumes：

```ts
export interface BestScopePanoramaProps {
  best: CgBest
  target?: CgTarget
  report?: CgCheckReport
  scopeId: string
  selectedDomain: string
  selectedEdge: string
  migrationItems: MigrationItem[]
  onSelectDomain: (id: string) => void
  onSelectEdge: (key: string) => void
  onEnter: (id: string) => void
  onSelectMigration: (item: MigrationItem) => void
}
export function BestScopePanorama(props: BestScopePanoramaProps): JSX.Element

export interface BestLeafGraphProps {
  best: CgBest
  baseline: CgGraph
  report?: CgCheckReport
  scopeId: string
  selectedContainer: string
  migrationItems: MigrationItem[]
  onSelectContainer: (id: string) => void
}
export function BestLeafGraph(props: BestLeafGraphProps): JSX.Element
```

Produces：`BestScopePanorama` 的实卡 `[data-best-scope-card]`、外部卡 `[data-best-scope-card][data-external="true"]`、边 `[data-best-scope-edge]`、托盘 `[data-unplaced-tray]`、迁移箭头 `[data-migration-arrow]`、面包屑入口 `[data-best-breadcrumb]`；`BestLeafGraph` 的容器 `[data-best-leaf-container]`、包组 `[data-best-leaf-package]`、幽灵容器 `[data-ghost-container]`。Task 4 负责 scope state 和 callback，不由组件自行改 URL。

### 基线判据（已跑）

基线 `npm run typecheck && npm test` 已通过 14/89；现有 `DomainPanorama.test.tsx` 已真实断言现状下钻的实卡/虚线卡，计划只新增 best 语义测试，最终由整包回归确认现状不红。

### 2~5 分钟动作序列

1. 在 `BestScopePanorama.test.tsx` 先写嵌套 fixture 测试：直接子领域实卡、圈外虚线卡、层内边、迁移托盘、迁移箭头、点击实卡/外卡/迁移条目；在 `BestLeafGraph.test.tsx` 先写包分组、节点数、幽灵容器和 selected callback。

```tsx
it('嵌套页保持同构：直接子领域实卡、圈外虚线卡、迁移托盘和横跳', () => {
  const onEnter = vi.fn()
  const onSelectMigration = vi.fn()
  const item: MigrationItem = {
    containerId: 'c_api', containerLabel: 'API 容器', currentDomainId: 'old', currentDomainLabel: '现状旧域',
    expectedDomainId: 'api_read', expectedDomainLabel: '读取领域', expectedSubsystemId: 'ss_api',
  }
  const { container } = render(<BestScopePanorama best={best} target={nestedTarget} report={report}
    scopeId="ss_api" selectedDomain="" selectedEdge="" migrationItems={[item]}
    onSelectDomain={vi.fn()} onSelectEdge={vi.fn()} onEnter={onEnter} onSelectMigration={onSelectMigration} />)
  expect(container.querySelector('[data-best-scope-card="api_read"]')).toBeTruthy()
  expect(container.querySelector('[data-best-scope-card="ext:ss_store"][data-external="true"]')).toBeTruthy()
  expect(container.querySelector('[data-best-scope-edge="api_read->ext:ss_store"]')).toBeTruthy()
  expect(container.querySelector('[data-unplaced-tray]')).toBeTruthy()
  expect(container.querySelector('[data-migration-arrow][data-expected="api_read"]')).toBeTruthy()
  fireEvent.click(container.querySelector('[data-best-scope-card="api_read"]')!)
  expect(onEnter).toHaveBeenCalledWith('api_read')
  fireEvent.click(container.querySelector('[data-best-scope-card="ext:ss_store"]')!)
  expect(onEnter).toHaveBeenCalledWith('ss_store')
  fireEvent.click(container.querySelector('[data-migration-item="c_api"]')!)
  expect(onSelectMigration).toHaveBeenCalledWith(item)
})

it('叶子图按包分组显示节点数，错位容器显示幽灵待迁入标', () => {
  const item: MigrationItem = {
    containerId: 'c_api', containerLabel: 'API 容器', currentDomainId: 'old', currentDomainLabel: '现状旧域',
    expectedDomainId: 'api_read_detail', expectedDomainLabel: '读取详情', expectedSubsystemId: 'ss_api',
  }
  const { container } = render(<BestLeafGraph best={best} baseline={baseline} report={report}
    scopeId="api_read_detail" selectedContainer="c_api" migrationItems={[item]} onSelectContainer={vi.fn()} />)
  expect(container.querySelector('[data-best-leaf]')).toBeTruthy()
  expect(container.querySelector('[data-best-leaf-package="internal/api/detail"]')).toBeTruthy()
  expect(container.querySelector('[data-best-leaf-container="c_api"][data-ghost-container="true"]')).toBeTruthy()
  expect(container.querySelector('[data-best-leaf-container="c_api"]')?.textContent).toContain('节点')
})
```

2. 运行 `npx vitest run src/app/codegraph/BestScopePanorama.test.tsx src/app/codegraph/BestLeafGraph.test.tsx`；预期新测试红。
3. 实现 `BestScopePanorama`：调用 `bestScopeGraph`；沿用 `BestPanorama` 的 `layoutDomains`、`useEffect` 尺寸守卫、wheel `passive:false` 与 cleanup、空白平移；卡片内容使用 `BestScopeCard` 的 label/responsibility/type/gap。内部卡片点击调用 `onEnter(id)`，`ext:` 卡片去掉前缀后调用 `onEnter(rootId)`，卡片和边不混淆。
4. 渲染当前层 migration overlay：`migrationItems` 中 `currentDomainId` 为空或不在当前 scope 的项目进 `未归位` 托盘；`expectedDomainId` 在本层直接子域时画一个 `[data-migration-arrow]`，属性 `data-container`、`data-current`、`data-expected` 逐字等于 ids；托盘条目点击回调原始 item。
5. 实现 `BestLeafGraph`：调用 `bestContainerFacts` 和已有 `groupContainersBySubdomain(best, scopeId, facts)`；沿 BestDetail 的包分组逻辑展示目录最后段、每组容器和节点数。`migrationItems` 中 expectedDomainId 等于 leaf 且 containerId 在错位 finding 中时，容器仍显示但加 `data-ghost-container="true"`、虚线样式和「待迁入」文字；这是未来态，不从 best.containers 删除。
6. 新文件头写职责与边界；导出组件写 props/回调注意事项；在“圈外折卡”和“幽灵容器保留 best 未来态”处写 why 注释。组件入口加 `console.debug('[codegraph] best scope render', { scopeId, cardCount: graph.cards.length, edgeCount: graph.edges.length, leaf: graph.leaf })`；不在纯投影层重复日志。
7. 运行最小绿验收：`npx vitest run src/app/codegraph/BestScopePanorama.test.tsx src/app/codegraph/BestLeafGraph.test.tsx && npm run typecheck`；再运行 `git diff --check` 并台账追加原始摘要。

### Task 3 验收与反面断言

- 每层只显示直接子领域实卡；不把孙领域平铺成同层卡。
- 圈外边不能因为两端都在圈外而出现；一端圈外时必须有虚线占位卡和可点击横跳。
- 叶子领域没有子领域卡时必须有容器/包/节点数视图，不显示空白全景。
- 错位容器不能从未来态删除；幽灵标必须与 `container-misplaced` 对应，非错位容器不能误标幽灵。
- 组件卸载必须清理 wheel/mouse listener；不引入 route、fetch、写文件或修改响应对象。

## 5. Task 4：页面状态、面包屑、迁移跳转与一期回退接线

### 文件范围

- 修改：`graph/webui/src/app/codegraph/CodegraphPage.tsx`
- 修改：`graph/webui/src/app/codegraph/CodegraphPage.test.tsx`
- 修改：`graph/webui/src/app/codegraph/BestDetail.tsx`
- 修改：`graph/webui/src/app/codegraph/BestDetail.test.tsx`

### Interfaces

Consumes：

```ts
BestPanorama({
  best: CgBest, target?: CgTarget, report?: CgCheckReport,
  selectedSubsystem: string, selectedEdge: string,
  onSelectSubsystem: (id: string) => void, onSelectEdge: (key: string) => void,
})

BestScopePanorama({
  best: CgBest, target?: CgTarget, report?: CgCheckReport, scopeId: string,
  selectedDomain: string, selectedEdge: string, migrationItems: MigrationItem[],
  onSelectDomain: (id: string) => void, onSelectEdge: (key: string) => void,
  onEnter: (id: string) => void, onSelectMigration: (item: MigrationItem) => void,
})

BestLeafGraph({
  best: CgBest, baseline: CgGraph, report?: CgCheckReport, scopeId: string,
  selectedContainer: string, migrationItems: MigrationItem[],
  onSelectContainer: (id: string) => void,
})

BestDetail({
  best: CgBest, baseline: CgGraph, report?: CgCheckReport, subsystemId: string,
  selectedDomain: string, onEnterDomain: (id: string) => void,
  selectedContainer: string, onSelectContainer: (id: string) => void,
})

MigrationSidebar({
  groups: MigrationGroup[], selectedContainer: string,
  onSelectContainer: (item: MigrationItem) => void,
})
```

Produces：页面只在 baseline 且 `data.best` 存在时渲染 best 根视角；best 下钻使用组件内 state 和 breadcrumb；非 baseline 继续渲染现状 `DomainPanorama`/`DomainDetail` 与既有 `data-compare-fallback`；缺 best 继续走现状/单图回退；迁移点击只更新 scope/container selection。

### 基线判据（已跑）

现有 `CodegraphPage.test.tsx` 已覆盖页面状态/回退用例，`BestDetail.test.tsx` 已覆盖嵌套容器与 misplaced 双侧列示；基线全包 14/89、build 42 modules 已通过。Task 4 先跑触及测试，最后由协调者执行全量三段验收。

### 2~5 分钟动作序列

1. 在 `CodegraphPage.test.tsx` 先写失败用例：root → nested → leaf → breadcrumb 返回；迁移侧栏 click 进入 expected subsystem scope 并高亮 container；edge click 显示 edge detail；`JSON.parse(JSON.stringify(...))` wire roundtrip 后 `legacyBudget:0`/`legacyHits[key]=0` 仍显示 `欠 0`，report 缺席仍无数据；branch 视图和无 best 旧用例不红。

```tsx
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
```

2. 运行 `npx vitest run src/app/codegraph/CodegraphPage.test.tsx src/app/codegraph/BestDetail.test.tsx`；预期新用例红，现有回退用例作为不变基线。
3. 在 `CodegraphPage.tsx` 新增独立状态：`bestScope: string | null`（根为 null）、`bestEdge: string`、`bestContainer: string`、`bestHistory: string[]`。`goBestScope(next)` 只更新 best 状态并清空不属于新层的 selection；不要复用现状 `scope`，避免切 best/branch 时把现状叶子状态带入理想树。
4. 计算 `bestPano = viewName === 'baseline' && !!data.best && bestScope === null`；`bestScope` 非空时用 `bestDomainPath` 判断 breadcrumb 和 `isBestLeaf` 判断 `BestScopePanorama`/`BestLeafGraph`。根页用 `BestPanorama`，根详情仍用 `BestDetail`；嵌套页显示 `BestScopePanorama`，叶页显示 `BestLeafGraph`。迁移侧栏由 `migrationGroups(data.best, data.baseline, data.report)` 生成，所有 best 层都可见。
5. 在 `BestDetail.tsx` 的每个 descendant domain 行增加 `进入 ▸` button，调用 `onEnterDomain(id)`；容器行增加 selected class/`data-selected`，调用 `onSelectContainer(id)`。保留现有 `containerFacts`、包分组、misplaced 双侧文本，不复制逻辑。
6. 迁移侧栏点击处理 `onMigration(item)`：先 `console.info('[codegraph] best migration select', { containerId: item.containerId, expectedDomainId: item.expectedDomainId, currentDomainId: item.currentDomainId })`；若 expected domain 非空则 `goBestScope(item.expectedSubsystemId)`，把 `bestHistory` 设为 `[item.expectedSubsystemId]`、`setBestContainer(item.containerId)`，让对应子系统下钻页的托盘条目和箭头保持高亮；不自动跳过中间层，用户仍按嵌套卡逐级下钻。若 expected domain 为空则 `console.warn('[codegraph] best migration target missing', { containerId: item.containerId })`，停留在根页并保留条目可见。
7. 处理边选择：`console.debug('[codegraph] best edge select', { scopeId: bestScope, key })`，设置 `bestEdge`、清空 domain/container selection；把 `BestEdgeDetail` 放到 best 右侧面板。处理 breadcrumb：根按钮回到 `bestScope:null`；祖先按钮只截断 `bestHistory`，不改现状 `scope`。
8. 切换 `viewName` 时调用现有 `goScope(null)`，并额外清理 `bestScope`、`bestEdge`、`bestContainer`、`bestHistory`；保留非 baseline `branchCompareFallback` 原文和 `DomainPanorama` 现状行为。无 best 时完全不挂载 best 组件。
9. 在页面入口加 `console.debug('[codegraph] best scope render', { scopeId: bestScope, leaf: !!data?.best && bestScope !== null && isBestLeaf(data.best, bestScope) })`；所有 `useEffect` 的 window listener 必有 cleanup；无新增请求/路由/写路径。
10. 运行触及测试绿验收：`npx vitest run src/app/codegraph/CodegraphPage.test.tsx src/app/codegraph/BestDetail.test.tsx src/app/codegraph/DomainPanorama.test.tsx src/app/codegraph/DomainDetail.test.tsx && npm run typecheck`；预期新增、一期 best、一期现状下钻均通过。
11. 运行 `git diff --check`，把测试原始摘要追加台账。Task 4 不运行全量测试；全量由收口三段验收执行。

### Task 4 验收与反面断言

- root best、嵌套 best、叶子 best 三种视图互斥；不出现同时挂载现状 DomainPanorama 和 best panorama 的双画布。
- breadcrumb 返回只改变 best scope，不污染现状 `scope`、foci、history；切换 branch 后 best DOM 不存在且原有 fallback 文案存在。
- migration item 点击后 selected container 只在目标页高亮；未知目标不跳到伪造 domain。
- `best` 缺席、`report` 缺席、`legacyHits[key]=0` 三态分别可见且互不冒充。
- 页面仍只消费同一个 `CodegraphResp`，不新增 JSON map、DTO、HTTP path 或路由。

## 6. 交叉边界审计与四项自审

### Spec 故事覆盖

| spec 故事 | 落点 |
|---|---|
| 1 欠账横幅 | Task 1 `debtReadout`；Task 2 `DebtBanner`；Task 4 roundtrip 页面测试 |
| 2 债务边/方向明细 | Task 1 `directionDetail`/`bestScopeGraph`；Task 2 `BestPanorama`/`BestEdgeDetail` |
| 3 迁移清单侧栏 | Task 1 `migrationGroups`；Task 2 `MigrationSidebar`；Task 4 跳转/高亮 |
| 4 嵌套同构、叶子领域图、迁移覆盖层 | Task 1 scope projection；Task 3 两个组件；Task 4 breadcrumb/state |
| 5 回退不变 | Task 4 `CodegraphPage` 现有 best/branch/no-best 用例与现状回归 |

### 序列化边界清单

本刀不新增 wire 字段；新增 `DebtReadout`、`MigrationGroup`、`BestScopeGraph` 是 webui 内部投影。仍按真实边界审计：

- 入口边界：`graph/webui/src/api/types.ts:76-83` 的 `CodegraphResp` 可选字段，禁止改镜像或把 `undefined` 改成 `null`。
- 纯投影边界：`graph/webui/src/app/codegraph/besttree.ts` 的 `target/report/best -> DebtReadout/MigrationGroup/BestScopeGraph`，Task 1 单元断言缺席/零值/空数组。
- DOM 投影边界：`BestPanorama.tsx`、`BestOverlays.tsx`、`BestScopePanorama.tsx`、`BestLeafGraph.tsx` 的 `data-*` 与文字；Task 2/3 逐项行为断言。
- 真实 roundtrip：`CodegraphPage.test.tsx` 用 `JSON.stringify` + `JSON.parse` 后再渲染，断言缺席 report 与 `legacyBudget:0`/`legacyHits[key]=0` 不混淆。无手写 Go/CLI/跨语言 serializer。

### 跨 task 签名逐字核对

- Task 1 Produces `debtReadout(target: CgTarget | undefined, report: CgCheckReport | undefined): DebtReadout | null`，Task 2 `DebtBanner` 只消费 `DebtReadout | null`；两端的 `targetAvailable` 与 null 语义一致。
- Task 1 Produces `migrationGroups(best: CgBest, baseline: CgGraph, report: CgCheckReport | undefined): MigrationGroup[]`，Task 2 `MigrationSidebar.groups` 与 Task 4 页面派生值均为 `MigrationGroup[]`；条目 callback 逐字为 `(item: MigrationItem) => void`。
- Task 1 Produces `bestScopeGraph(best: CgBest, target: CgTarget | undefined, report: CgCheckReport | undefined, scopeId: string | null): BestScopeGraph`，Task 3 `BestScopePanorama` 使用非空 `scopeId: string`，Task 4 只在 `bestScope !== null` 时调用；根页由 `BestPanorama` 使用 null 投影。
- Task 1 Produces `directionDetail(key: string, target: CgTarget | undefined, report: CgCheckReport | undefined): BestDirectionDetail | null`，Task 2 `BestEdgeDetail` 通过 `BestScopeEdge.directions: string[]` 逐条取同一 key；Task 4 的 `selectedEdge: string` 不改 key 编码。
- C1.3 frozen consumer remains `CodegraphResp.best?: CgBest`、`target?: CgTarget`、`report?: CgCheckReport`（`types.ts:76-83`），本卡没有 Produces 端或跨仓签名变更。

### 缺陷族对抗审查

- 生命周期/状态机中断：页面 state 是内存态；best 组件卸载时清理 wheel/mouse listener，切层/切视图清空旧 selection，不落盘、不起进程、无孤儿资源。该行为由 Task 3/4 测试和真机卸载走查验证。
- 静默失败/误导报错：report 缺席显示「无数据」；target 缺席 coverage 显示 `—`；未知目标进入「未映射目标」组；未知 finding/type/kind 走已有缺省分类，不把异常吞成 0。
- 跨平台假设：不新增路径、权限、进程、反代或路由；只沿现有浏览器 wheel/mouse 事件，`passive:false` 与 cleanup 沿既有组件；不同浏览器的视觉/手势列真机清单。
- 假红/假绿测试：纯函数测试包含反面断言（report 缺席、零值、环/重复对偶、圈外双端不画、幽灵仅错位）；组件使用 `data-*` 行为查询而非快照；roundtrip 测试穿过 JSON 边界；真实大数据布局不在 jsdom 伪称通过。
- 门禁绕过：本刀零写路径、零新请求、零新路由、零鉴权入口；所有交互只更新 React 内存 state，沿现有 `useCodegraph` 数据通道。
- 序列化边界：上表列出 `types.ts`、besttree 投影、DOM 映射和 roundtrip 测试；新增内部字段不出 wire。
- 枚举新值过白名单：`kind`/`type`/`status` 的分类全部保留 default；测试 `some-future-kind`、未知 type 和未知目标，不能使用穷举 switch 作为唯一安全。
- 承重安全属性：本刀不引入 token、唯一性、隔离或权限凭据，因此无新增安全属性；只读交互不改变 best/target 文件。

### 类型标注的真机清单

以下不由 vitest 伪造通过，交给协调者/验收节点实机核对，并在验收记录中保留原始结果：

1. 真实 `?project=handoff` 数据下，首层欠账四件套、放错位容器分组、边 `欠 N` 和双向环读数与 CLI/响应原文逐数对照。
2. 真实嵌套 best 下连续进入至少两层、圈外横跳、breadcrumb 逐级返回；叶子领域显示包分组、节点数和幽灵待迁入标。
3. 真实浏览器下拖拽、平移、⌘/Ctrl 滚轮缩放、边/卡/托盘点击互不误触；组件卸载后不再响应旧 listener。
4. best 无 report、target 缺席、legacyHits 明确 0、无 best、非 baseline branch 五种降级/回退路径。
5. 真实规模渲染性能和 phase2 原型视觉可读性；原型目录当前缺失，未验证前不得写视觉 pass。

## 7. 收口步骤（协调者执行，不派发）

1. 逐 task 检查台账是否已经记录命令原始输出、失败尝试和判断；缺失先补台账。
2. 在所有实现 task 完成后运行整包验收：

```bash
cd graph/webui
npm run typecheck
npm test
npm run build
cd ../..
git diff --check
```

预期：typecheck/build 无 TypeScript 错误；Vitest 全部测试文件通过；Vite 构建成功；`git diff --check` 无输出。构建若改写 tracked `dist`，只恢复本次构建生成的 dist 变更，不把生成物纳入本卡计划提交，且把原始恢复命令写台账。

3. 运行范围扫描：`git diff --name-only HEAD` 必须只包含本计划列出的 webui 文件和本卡计划/台账；`graph/webui/src/api/types.ts`、`graph/codegraph/**`、宿主目录、路由依赖不得出现。
4. 占位符扫描：`rg -n "TBD|TODO|同 Task|适当的错误处理|待定" docs/plans/2026-08-24-codegraph-viewer-migration-plan.md | rg -v "占位符扫描"` 必须无输出。本计划允许且已明确标注的「未验证」只用于真机行为，不是实现占位符；测试均复用既有夹具并逐条列出 pass/fail 断言。
5. 计划提交前只提交计划文档与台账；不写实现代码、不起 executor、不调用 handoff CLI、不切分支、不 push。
