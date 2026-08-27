# C14 实现计划：查看器形态对齐 fork 原型

> 卡：C14（L2，单子系统 `graph/webui`）。spec：`docs/specs/2026-08-27-codegraph-viewer-form-alignment-spec.md`（已批准）。
> 上游契约：`docs/superpowers/specs/c12-contract.md`（§2.3 缝 1、§2.4-33）。台账：`docs/ledgers/2026-08-27-c14-plan-ledger.md`（取证全记录）。
> 级别：L2——plan 由协调者写，implement 单轮派发（本机 codex）。

## 读者假设与唯一形态基准

执行者零上下文。**形态基准不是本文文字，是 fork 原型代码本身**（用户裁决 2026-08-27）：

```
/Users/xushixin/workspace/charter/.claude/worktrees/system-architecture-redesign-d01c32/prototypes/codegraph-two-axis/
├── index.html          # 162 行：页面装配、卡面 boxOf 结构、孤立区、图例
└── shared/
    ├── graph.js        # 293 行：buildLayers/layout/edgePath/renderGraph/renderClusters
    ├── mock.js         # 真数据派生的 mock（window.CG；勿改）
    ├── style.css       # 卡面/图例/债务色样式词
    └── nav.js
```

本机派发，该路径执行者直接可读（spec 实现决定 1 的「force-add 携带」已更正为零 git 动作，见台账「派发前提修正」）。**移植 = 读原型指定行区间的行为，用 TS 纯函数在目标文件重现；原型与本文不一致时先停下来对照，仍冲突以本 plan §2 的实现决定为准。**

## 0. 基线复核（判据已在基线跑过）

工作树 `/Users/xushixin/workspace/charter/.claude/worktrees/system-architecture-redesign-d01c32/graph/webui`，2026-08-27 13:49 实跑：

- `npm test` → **Test Files 16 passed (16)，Tests 203 passed (203)**，2.63s。本卡全部红绿判据以此为基线。
- `npm run typecheck` = `tsc -b`；`npm run build` = `tsc -b && vite build`（package.json scripts）。
- Go 侧本卡零触碰（纯 webui 派生层+组件），无需 Go 判据。

既有 harness 指认（占位符例外自我声明：本 plan 测试步骤以「断言逐条列全 + 照抄既有 harness」给出）：

- `src/app/codegraph/scopepage.test.ts`——夹具 `bestOf/blankGraph/respWorld/bigWorld`（:136-163 一带），断言只走 `deriveScopePage` 单入口。新断言照抄此形态。
- `src/app/codegraph/scopelayout.test.ts`——夹具 `domainNode/containerNode`（:6-31），断言只走 `layoutScopeCards` 单入口、期望值硬编码。新断言照抄此形态。
- `src/app/codegraph/ScopeCanvas.test.tsx`——`render` + `data-*` 查询（如 :82 `q('[data-node="ext:d_far"]')`，该断言随 ext 退役改写，见 T3）。

## 1. 对齐清单 → 原型代码映射

| # | 偏差（roadmap 49/48） | 原型基准（必读行区间） | 落点 task |
|---|---|---|---|
| ① | 根层拓扑分层未实现（SCC 缩点/环红标/孤立单列） | graph.js `buildLayers` :3-32（Tarjan SCC → 缩点图最长路分层，环内同层，cyclic 集合）、`renderGraph` :72-123（孤立不进分层、L0.. 层标、回边红虚线+⟲、cyclic 节点 ⟲ 徽章） | T2/T3 |
| ② | 摆放未达「一屏见全部/交叉最少」 | graph.js `layout` :34-53（层内按被调量降序、超宽折行、行居中）、`renderClusters` :124-280（包群组框、群组级 buildLayers、连接权重贪心排序 :167-174、货架装箱 :177-186、相邻交换 4 轮降交叉 :196-204、fit/center 缩放取小居中 :273-276） | T2/T3 |
| ③ | 容器卡面 doc 职责缺席 | graph.js renderClusters 卡面职责段 :240-262（duty wrapText 22 字符×2 行；无职责斜体「无职责主体（kind）」）；**推导断点已查明：匹配键修复，见 T1-a（不移植原型 mock 的写死 duty）** | T1/T3 |
| ④ | 子系统卡面入口数徽标缺席 | index.html :105-106、:115-116（`▣ N 入口` / `▣ N 入口 集中`，集中时债务色；仅根层显示） | T1/T3 |
| 48 | 容器层外部虚线端口重叠 | **原型无此形态**——跨层调出只作图例文字列表「调出到本层之外：label N · …」（index.html :91，数据 `scopes[].ext=[{to,calls}]`）。对齐 = ext 卡退役 | T1/T3 |

## 2. 实现决定（含分歧记录）

1. **③ 的根因与修法（已实测定案，台账事实 1-2）**：`scopepage.ts` `containerResponsibility` 的匹配条件 `node.name !== def.label` 在真数据上恒假——容器 label 带包前缀（`agentd.Manager`），model 节点 name 是裸类型名（`Manager`），实测命中 0/100。修法 = 契约 §2.3-26 字面直译：同名 = **label 最后一个 `.` 之后的类型段**与 model `name` 相等；按包匹配 = 既有「model 文件目录 ∈ 容器成员目录集合」校验保留不动；确定性 tiebreak（候选取 id 最小）保留不动；无候选或 summary 空 → `undeclared`，非「类型方法」kind → `no-subject`，均不变。
2. **ext 外部引用卡退役**（48 条对齐，台账事实 5）：原型无此形态，契约 §2.3 未冻结 ext 卡。`scopepage` 不再生成 `external=true` 节点；跨层调出聚合进新模型字段 `externalOut`（图例文字列表的数据源）。`ScopeNode.external` 键、`scopelayout` 的 `EXT_W/EXT_H` 与 `ringOuter` 外圈、`ScopeCanvas` 的 ext 分支、`RightPanel.tsx:83` 剥前缀与 :229「本层之外引用卡」标注**随之全部删除**；既有测试 `scopepage.test.ts:261`（圈外端点折 ext 卡）、`ScopeCanvas.test.tsx:82`（data-external）、`scopelayout.test.ts` 三处 ext 夹具**点名授权改写**为新形态断言。横跳导航能力不丢：图例文字列表项可点击跳转邻居 scope（对齐原型 `<a href="?scope=...">`）。
3. **孤立口径取原型**（台账事实 6）：`ScopeNode.isolated` 从「无 call 入边」改为「**call 无入边 ∧ 无出边**（deg 0）」；projection 边不抵孤立不变。纯调用方（如 d_cli）从此进 L0 层当最外层调用方——原型 index.html :124 注释的语义。既有断言 `scopepage.test.ts:252`「纯调用方与孤岛都单列」**点名授权改写**为「纯调用方不孤立、孤岛孤立」。契约 §2.3-27（如实呈现+标注原因）不受影响。
4. **边色不动**（49 条「不偏离的项」，台账事实 7）：契约冻结的 DirectionStatus 四态与 `data-direction-status` 接线保持，**不**换成原型 budget 数值四档。本卡新增的边形态只有回边红虚线与 cyclic 徽章（①的分层产物）。
5. **④ 的数据口径**：`entries` = 既有 `entriesOver`（入口节点容器 ∈ 子树容器集，结构归属）；`files` = 这些入口节点 `baseline.nodes[id].file` 去重数；`concentrated` = `files===1 && entries>3`（§2.4-33 字面，与 flowpage.ts:59-66 同一判据注释）。类型复用 flowpage 导出的 `RegistrationDispersion`，不另造词。模型层全层算定（视图层只渲染不重算，scopepage.ts:129-131 既有纪律），组件仅根层显示。
6. **undeclared 卡面态延伸**：原型卡面只有「有 duty / 无职责主体」两态（mock 写死）。真实现 ResponsibilityState 有第三态 `undeclared`（类型方法但没推到 doc）——卡面渲染为斜体「未声明职责」，与 §2.3-24「如实报」同族；no-subject → 斜体「无职责主体（kind）」（原型原文）；declared → 正文截断 2 行（等价 wrapText 22×2，用 CSS `line-clamp-2`）。
7. **卡面既有读数保留**：第二行 `{type} · N 容器 · N 符号`、超大容器徽章、孤立原因行均不动——49 清单未点名，避免范围蔓延。对拍时这些差异如实记录为「真实现增量读数，非偏差」。
8. **不动 wire/API**（spec 实现决定 3）：`/api/projects/{name}/codegraph` 响应零变更；不动 besttree.ts、flowpage.ts（除复用其导出类型）、Go 侧任何文件。

## 3. Task DAG

```
T1 模型层三修（scopepage.ts + scopepage.test.ts）
   ↓ Produces: entryDispersion 字段 / externalOut 字段 / external 键删除 / isolated 新口径 / 职责键修复
T2 布局层重写（scopelayout.ts + scopelayout.test.ts）
   ↓ Produces: ScopeLayout 扩展（layers/cyclic/backEdges/isolatedIds/bounds）+ scopeEdgePath
T3 组件接线（ScopeCanvas.tsx、RightPanel.tsx + 各自测试）
   ↓
T4 收口（typecheck / 全量 / build / dist 重建）——真机对拍属 acceptance，协调者执行不派发
```

串行依据：T2 消费 T1 的模型形状（无 ext 卡、isolated 新口径）；T3 消费 T1+T2 全部 Produces；同一执行者同包文件，无并行收益。

---

## T1 模型层三修（scopepage）

**文件**：`graph/webui/src/app/codegraph/scopepage.ts`、`graph/webui/src/app/codegraph/scopepage.test.ts`

**Interfaces**

- Consumes：`flowpage.ts` 导出的 `RegistrationDispersion`（:59-66，形状 `{domainId, entries, files, concentrated}`）；`besttree.ts` 的 `childBestDomainIds/containerFacts/topLevelSubsystemIds`（现状不变）。
- Produces（给 T2/T3，逐字签名）：

```ts
// scopepage.ts
import type { RegistrationDispersion } from './flowpage'

export interface ScopeNode {
  // ……既有键中删除 external；新增：
  /** 入口注册散度（§2.4-33 同判据：files===1 ∧ entries>3 → concentrated）。
   *  仅领域卡携带（子树聚合）；容器卡恒 null（沿 debt/invariants 的 null 约定）。 */
  entryDispersion: RegistrationDispersion | null
}

export interface ScopeExternalOut {
  /** 邻居顶层领域 id（不带 ext: 前缀——ext 卡形态已退役）。 */
  neighborId: string
  /** 组织视图解析的展示名（best 的 labelOf / current 树同名口径）。 */
  label: string
  /** 本层 → 邻居的 call 边聚合权重（原始边数）。 */
  weight: number
}

export interface ScopePageModel {
  // ……既有七键之外新增第八键：
  /** 调出到本层之外：按邻居聚合（neighborId 升序）；根层恒空数组（系统外无调用方）。 */
  externalOut: ScopeExternalOut[]
}
```

`ScopeNode.isolated` 语义改：「当前视图内 call 无入边**且无出边**」（projection 不抵孤立不变）。`ScopeNode.external` 键删除——不再有任何节点带它。

**步骤**

1. **红：职责键真数据形态断言**（缝 2）。在 `respWorld` 所在 describe 新增两支，照抄既有夹具形态：
   - 「label 带包前缀命中」：容器 `c_st2: { label: 'pkga.Store', kind: '类型方法' }`，model 节点 `{ kind:'model', name:'Store', file:'pkga/store.go', summary:'甲侧存储注释' }` + 容器成员节点 file 同目录 → 断言 `responsibility` = `{ state:'declared', text:'甲侧存储注释' }`。
   - 「跨包同名不误配（带包前缀）」：另置 model `{ kind:'model', name:'Store', file:'pkgb/other.go', summary:'别家的存储注释' }`，容器成员目录集合只含 `pkga` → 断言取到的是甲侧注释而非别家。
   - 跑 `npx vitest run src/app/codegraph/scopepage.test.ts` 确认两支红（现实现 name===label 恒不匹配）。
2. **绿：修匹配键**。`containerResponsibility`（scopepage.ts:507-518）中 `node.name !== def.label` 改为 `node.name !== bareTypeName(def.label)`，新增模块内私有函数 `bareTypeName(label: string): string`（`label.split('.').pop() ?? label`——label 无 `.` 时退化为原串，既有裸名夹具行为不变）。目录校验、tiebreak、no-subject/undeclared 分支一行不动。跑两支新断言转绿 + 既有 :398/:404 两支保持绿。
3. **红：entryDispersion 断言**（缝 2）。新 describe「C14 缝 1：入口注册散度上卡」：
   - 根层领域卡：子树入口容器含 4 个入口节点同 file → `entryDispersion` = `{ entries:4, files:1, concentrated:true }`；3 入口 1 文件 → `concentrated:false`（>3 边界，§2.4-33 字面）；0 入口 → `{ entries:0, files:0, concentrated:false }`（不缺席、不伪装）。
   - 容器卡恒 `null`。
   - 既有键集断言（:389-394）更新：`keys` 期望清单删 `'external'`、增 `'entryDispersion'`（此断言随步骤 5 的删键一并改，本步先红）。
4. **绿：entryDispersion 推导**。`ScopeNode` 加键；`statsOver` 旁新增 `dispersionOver(cids)`：`entriesOver(cids)` 的结果集 + `baseline.nodes[entry.id]?.file` 去重计数；`concentrated = files===1 && entries>3`。领域卡赋值、容器卡 null。断言转绿。
5. **红：ext 退役与 isolated 口径断言**（缝 2）：
   - 改写既有 :261「中层看子领域卡、圈外端点折 ext 卡」→「中层看子领域卡、圈外端点**不产节点**、横跳权重聚合进 `externalOut`」：断言 nodes 无 `ext:` 前缀 id、`externalOut` 含 `{ neighborId, label, weight }` 聚合值、neighborId 升序。
   - 改写既有 :252 →「孤立=call deg 0：纯调用方（有出无入）不孤立、孤岛孤立、projection 不抵孤立」。
   - 新增：根层 `externalOut` 恒 `[]`。
6. **绿：ext 退役实现**。seeds 生成处删除 ext 节点分支（grep `external` 全模块：:108-109 注释、:531、:579 一带全部跟随）；`edges` 中 to/from 为圈外端点的 call 边不再保留为画布边，聚合进 `externalOut`（同邻居权重相加）；`isolated` 计算（:578-582）改 deg 0 口径（入边权重表之外再聚合出边表，或一次遍历两表）；`ports` 仍含两类边不变（右栏连线读数不动）。断言转绿。
7. **注释**：`ScopeNode.entryDispersion`/`ScopeExternalOut`/`externalOut`/改后的 `isolated` doc 注释逐条按上文 Produces 写法落；`containerResponsibility` 头注释补一句「同名 = label 类型段（真数据 label 带包前缀，裸名匹配恒不匹配的实测教训 2026-08-27）」；文件头职责注释的「孤立子系统与 projections 第二类边（§2.3-27）」一行补口径四字（call deg 0）。
8. **日志**：纯函数层零 console 纪律不变（文件头既有约定），本 task 不加日志——在测试断言失败信息里带上下文（`expect({pair, ...})` 同款形态）。

**测试范围声明**：只跑 `npx vitest run src/app/codegraph/scopepage.test.ts`。

**验收**：上述断言全绿；`git diff --stat` 只含两个目标文件。

---

## T2 布局层重写（scopelayout）

**文件**：`graph/webui/src/app/codegraph/scopelayout.ts`、`graph/webui/src/app/codegraph/scopelayout.test.ts`

**Interfaces**

- Consumes：T1 后的 `ScopeNode`（无 `external`、isolated=deg 0、`dir` 容器包目录）、`ScopeEdge`（kind/weight）；不再消费 `EXT_W/EXT_H`。
- Produces（给 T3，逐字签名）：

```ts
export interface ScopeLayout {
  positions: Record<string, [number, number]>
  packageFrames: ScopePackageFrame[]            // 形状不变（dir/nodeIds/x/y/w/h）
  /** 节点 → 层号（0 = 最外层调用方层）；孤立节点与容器层节点无条目。 */
  layers: Record<string, number>
  layerCount: number                            // 无分层（容器层）时为 0
  cyclicNodeIds: string[]                       // SCC 环成员，升序
  backEdgeKeys: string[]                        // 分层中指向上游的 call 边 key，升序
  isolatedIds: string[]                         // 孤立区成员，升序
  bounds: { w: number; h: number }              // 全部内容包围盒（含孤立区、包框、左边层标留白）
}
export function layoutScopeCards(
  nodes: ScopeNode[], edges: ScopeEdge[], opts?: { width?: number },
): ScopeLayout
/** 边 SVG path。forward=向下贝塞尔；back=回边右侧折返；sibling=同层（环内）下沿浅弧。 */
export function scopeEdgePath(
  x1: number, y1: number, x2: number, y2: number, kind: 'forward' | 'back' | 'sibling',
): string
```

- 删除：`EXT_W`/`EXT_H` 导出、力导向迭代、`separate()`、`ringOuter()`。纪律不变：零随机数、不访问 DOM、零 console、两次调用逐位相同（既有文件头注释保留并补「分层与装箱行为移植自 fork 原型 graph.js，行区间见各函数注释」）。

**移植指引（原型行区间，照其行为不照其语言）**

- `buildLayers`（graph.js :3-32）：Tarjan SCC 缩点 → 缩点图最长路分层；环内节点同层且入 `cyclicNodeIds`；指向同层或上游的 call 边入 `backEdgeKeys`。只认 `kind==='call'` 边（projection 不进分层，沿现状）。
- 领域层/根层摆放 `layout`（:34-53）：每层一行，y 由层号定（GAPY 原型 92，按 CARD_H=112 等比例放大为 ≥140，常量只存本模块）；行内按**被调量（call 入边权重和）降序**，并列按 id 升序；超宽折行 `perRow = max(2, floor((W+GAP)/(CARD_W+GAP)))`，W 取 `opts.width` 缺省 1200；行内居中。
- 孤立例外：isolatedIds 不进 layers；坐标 = 全部非孤立内容最低点之下一行，同行从左到右按 id 升序（既有孤立行语义保留，图形位置相对主体不变）。
- 容器层摆放 `renderClusters`（:124-280）：先按 `dir` 聚包群组（空串 dir 归空串群组，沿现状）；**群组内**容器再跑 buildLayers 分层摆（群组内层间距同领域层 GAPY）；**群组之间**三件套——①连接权重贪心排序（:167-174）②货架装箱：target = max（最宽群组宽， sqrt（总面积×aspect)），aspect = clamp（画布宽/高， 0.6, 3.2)，画布宽高取 `opts.width` 与其 ×0.62 的缺省高（:177-186）③相邻交换 4 轮降交叉，cost = Σ calls×欧氏距离（:196-204）。包框 = 群组内容包围盒外扩（现状 padding 语义保留）。
- `bounds` = 全部卡框+包框+孤立区+左侧层标留白（层标宽 40）的并集。
- `scopeEdgePath`：移植 `edgePath`（:54-64）三种形态；回边折返的右侧偏移量取本模块常量（原型 28）。

**步骤**

1. **红：分层断言**（缝 1，照抄既有 harness 单入口硬编码期望）：
   - 链 `a→b→c`：`layers` = `{a:0,b:1,c:2}`，`layerCount` 3；y 坐标严格递增。
   - 环 `x→y→x`：x/y 同层且 `cyclicNodeIds` 含两者；`x->y`/`y->x` 之一入 `backEdgeKeys`（按移植算法实际取舍断言其一，两支都接受不算——钉死算法输出后写死期望）。
   - 双向边（两节点互调）同环处理。
   - 孤立：deg 0 节点无 layers 条目、入 `isolatedIds`、y 大于全部非孤立卡最大 y。
   - projection 边不进分层（一条 projection 连两孤立节点，仍双双孤立）。
2. **绿：buildLayers + 领域层 layout 移植**。跑绿。
3. **红：容器层三件套断言**（缝 1）：
   - 包群组：两 dir 各 3 容器，`packageFrames` 两框各盖住本组成员（沿用既有 :120 断言形态）。
   - 装箱一屏性：12 容器 3 群组，`bounds.w <= opts.width`（传 1200）且所有坐标非负。
   - 降交叉：构造两组交叉连线，断言输出 cost ≤ 输入初始序 cost（cost 公式按 :196-204 移植后在测试内复算）。
4. **绿：容器层移植**。跑绿。
5. **红：确定性 + 删除项断言**：两次调用逐位相同（既有 :34 保留）；`layoutScopeCards` 导出面不再含 EXT_W/EXT_H（`import` 编译期消失由 typecheck 兜，测试层断言行：`positions` 键集等于输入节点 id 集）。
6. **绿 + 清理**：删力导向/separate/ringOuter/EXT_*；既有 scopelayout.test.ts 中含 ext 卡的三支夹具（:40-48、:50-77、:97-118）点名授权改写为无 ext 形态（期望键集删 `ext:` 项）。
7. **注释**：每个移植函数头注「移植自 prototypes/codegraph-two-axis/shared/graph.js :行-行（行为基准）+ 与本实现的差异点」；`scopeEdgePath` 三形态各一句为什么。
8. **日志**：零 console 纪律不变，不加日志。

**测试范围声明**：只跑 `npx vitest run src/app/codegraph/scopelayout.test.ts`。

**验收**：断言全绿；`grep -n "ringOuter\|separate\|EXT_W\|EXT_H\|ITER\|GRAVITY" scopelayout.ts` 无命中。

---

## T3 组件接线（ScopeCanvas / RightPanel）

**文件**：`graph/webui/src/app/codegraph/ScopeCanvas.tsx`、`graph/webui/src/app/codegraph/ScopeCanvas.test.tsx`、`graph/webui/src/app/codegraph/RightPanel.tsx`（仅两处删除，见步骤 6）、`graph/webui/src/app/codegraph/RightPanel.test.tsx`（若 :83/:229 删除波及断言则同步，否则不动）。

**Interfaces**

- Consumes：T1 的 `ScopeNode.entryDispersion` / `ScopePageModel.externalOut` / isolated 新口径；T2 的 `ScopeLayout` 扩展字段与 `scopeEdgePath`。
- Produces：无新导出——组件薄壳，行为全部走 `data-*` 断言。

**步骤**

1. **红：卡面读数断言**（薄壳，照抄既有 `render` + `q('[data-...]')` 形态）：
   - 容器卡 declared：卡面出现 `data-duty` 行且文本 = 职责正文；className 非空（§2.3-40 防漂判据）。
   - 容器卡 no-subject：`data-duty` 行文本 = `无职责主体（函数组）`（kind 原样嵌入），带斜体 class（断言非空 className，不断言具体值）。
   - 容器卡 undeclared：`data-duty` 行文本 = `未声明职责`。
   - 根层领域卡有入口：`data-entry-badge` 文本 = `▣ 4 入口`；集中时再含 `集中` 且出现债务色标记 `data-entry-badge-concentrated="true"`；非根层领域卡不渲染徽标（模型有值也不渲染）。
   - 0 入口领域卡无 `data-entry-badge`。
2. **绿：卡面接线**。容器卡：`node.kind==='container'` 时在统计行下渲染 duty 行（declared 时 `line-clamp-2` 截断；三态文案按实现决定 6）。领域卡：`model.scopeId === null && entryDispersion && entries>0` 时渲染徽标（`▣ {entries} 入口`，concentrated 追加 ` · 集中` + 债务色 class + data 标记）。
3. **红：分层与边形态断言**：
   - 层标：画布出现 `data-layer-label="L0"`（链式夹具下 L0/L1/L2 齐备）。
   - 回边：`data-edge-key` 对应元素为 `<path>`（不再是 `<line>`），回边带 `data-back-edge="true"` 与非空 strokeDasharray。
   - cyclic 徽章：环成员卡出现 `data-cyclic="true"` 徽标元素，文本含 `⟲`。
   - 孤立区：`data-isolated-row` 容器在全部非孤立卡下方，区头文案含「孤立节点」；孤立卡仍带 `data-isolated="true"` 与既有原因行。
4. **绿：边与徽章接线**。边渲染从 `<line>` 换 `<path d={scopeEdgePath(...)}>`：`backEdgeKeys` 命中 → `kind='back'` + 红虚线（`strokeDasharray` + 债务色 class）；两端同层 → `'sibling'`；其余 `'forward'`。箭头 marker 沿用。`data-direction-status`、projection 紫虚线、线宽=调用量三档（:196）原样保留。cyclic 徽章、层标列（x=0 起宽 40，卡坐标已由 T2 bounds 留白）、孤立区区头。
5. **红：图例 externalOut 断言**：`data-external-out` 图例行文本 = `调出到本层之外：{label} {weight}`（多邻居 ` · ` 连接、升序）；每项可点击触发 `onOpenScope(neighborId, label)`；根层（externalOut 恒空）不渲染该行。改写既有 `ScopeCanvas.test.tsx:82` ext 卡断言为此。
6. **绿：externalOut 图例 + ext 删除**。图例区（:258-268）加该行；删 `cardSize` 的 external 分支、`data-external`、双击剥 `ext:` 前缀（:116 改直取 node.id）；`RightPanel.tsx:83` 的 `ext:` 剥前缀改直返原 id、:229「本层之外引用卡」标注删除（model 已无 external 节点，两处成死码——删除而非保留）。
7. **fit/center**：首次渲染（或 `model.scopeId` 变化时）按 `layout.bounds` 与视口宽计算初始 zoom = `min(vw/bounds.w, vh/bounds.h, 1)`、pan 使内容水平居中；用户手动缩放/平移不重置；双击空白复位改为「回到 fit 态」而非回 zoom=1。jsdom 下 `clientWidth` 为 0 → 兜底 1200（与 T2 缺省一致）。断言：`data-zoom`/`data-transform` 在 fit 后期望值（夹具 bounds 已知，可硬编码）；scope 切换后重新 fit。原型基准：renderClusters :273-276（scale 取小并居中），根层同此处理（实现决定：原型根层靠折行控宽，fit 居中对各层统一，属②「一屏见全部」的直接兑现）。
8. **日志**：既有 `console.info('[codegraph] scope enter', ...)` 保留；新增 scope 切换 fit 一条 info（`{ scopeId, zoom, bounds }`）；ext 卡双击分支的 console.info 随删除移除。无新 warn/error 分支（本 task 无错误路径）。
9. **注释**：文件头职责注释更新（布局来源改「scopelayout 移植分层+装箱」、ext 卡退役一句）；duty 行/徽标/回边/孤立区 JSX 处各一句「为什么」（含原型行号出处）。

**测试范围声明**：`npx vitest run src/app/codegraph/ScopeCanvas.test.tsx src/app/codegraph/RightPanel.test.tsx`。

**验收**：断言全绿；`grep -n "external\|ext:" ScopeCanvas.tsx RightPanel.tsx` 无命中；TwoAxisPage.test.tsx 等邻接测试不因模型键变化翻红（若翻红说明漏了消费面，停下来报协调者，不自行扩大改动面）。

---

## T4 收口（构建与全量）

**文件**：只允许 `graph/webui/dist/`（构建产物，既有入库约定）与以上 task 已列文件；其它一律不碰。

**步骤**

1. `npm run typecheck` 零错。
2. `npm test` 全量绿（16 文件基线 + 本卡新增断言；失败回对应 task 修，不在本步补写实现）。
3. `npm run build`；`git status` 确认 `dist/` 变更；将 dist 变更与源码同批提交（C12 惯例：dist 入库，fdf50a1f2 先例）。
4. dist 可复现核查：记录构建前后 `dist/assets/*.css` 字节数差——roadmap 22 已知 tailwind 自扫污染未修，本卡只把增量记进卡 note，不修法。
5. 提交：`feat(C14): 查看器形态对齐 fork 原型——分层/摆放/容器职责/入口徽标/ext 退役`（或拆 T1~T4 各一笔，沿执行者惯例；提交信息含卡号）。

**测试范围声明**：本步跑全量（`npm test`），是三段律「集成全量」的法定位置（L2 单流，无 integrate 节点，收口并入此）。

**验收**：typecheck 零错 + 全量绿 + build 成功 + dist 已提交。

---

## 五项检查

1. **缺陷族对抗审查**（逐族设问结论）：
   - *边界/口径族*：职责键的「同名」从全串改尾段——label 无 `.` 退化原串（既有夹具护住）；带多 `.`（如 `a.b.C`）取最后段，TS 侧命名空间同名由目录校验收敛。`concentrated` 边界 >3 字面钉死（4 红 3 不红）。孤立 deg 0 与 deg-in-0 的行为差异由改写后的 :252 断言钉死。
   - *序列化/投影族*：本卡零 wire 变更；模型层新增 `entryDispersion`/`externalOut` 是内存结构，序列化边界只有一处——T3 组件消费，由薄壳断言覆盖（见检查 5）。
   - *生命周期/状态族*：fit 态在 `model.scopeId` 变化时重算、用户交互不重置、双击空白回 fit——三个转换点各有断言。
   - *并发/时序族*：纯函数层无态；组件 wheel listener 挂载/卸载沿用既有 effect 形态，本卡未新增 listener。
   - *错误/降级族*：`opts.width` 缺省与 jsdom `clientWidth=0` 双兜底同一常量 1200；`entryDispersion` 0 入口不缺席（`{0,0,false}`）不伪装完整读数（§2.3-25 同族）。
   - *兼容/回归族*：删除 `external` 键是破形变更——全消费面已盘点（台账事实 9：ScopeCanvas 两处、RightPanel 两处、测试三处），plan 逐一列出删除/改写点，无遗漏即无漂移。
   - *安全/注入族*：图例 label 来自数据，React 文本插值转义，无 dangerouslySetInnerHTML。
   - *确定性族*：布局两次调用逐位相同断言保留；排序全部显式（neighborId/id 升序）。
2. **序列化边界设问**：无新增 wire 字段（API 零变更，实现决定 8）。模型→组件一处投影由 T3 薄壳断言逐条覆盖；可空分辨：`entryDispersion=null`（容器卡）vs `{entries:0,...}`（领域卡无入口）两态断言齐备。
3. **上下文预算**：T1 两文件（640+542 行）同包；T2 两文件（244+140 行）；T3 四文件；各 task 文件集有界，无需竖切卡。
4. **类型标注**：组件薄壳 task（T3）行为验收已写成显式断言清单 + 真机清单（下节）。
5. **接缝覆盖双向**：
   - 缝 → 测试：缝 1（scopelayout）被 T2 全部断言入口（`layoutScopeCards` 单入口）锁住；缝 2（scopepage）被 T1 全部断言入口（`deriveScopePage` 单入口）锁住；组件薄壳由 T3 `data-*` 断言锁住。无缝落空。
   - 测试 → 缝：T1/T2 每支断言入口都在声明缝上；T3 全部走组件 render（缝的消费侧法定位置）。**内部锁零新增**；既有内部锁不增不减。
   - 退路声明：T2 步骤 1 环断言的「钉死算法输出后写死期望」不改变测试入口符号，非入口退路，无需内部锁声明。

## 真机清单（**本项由协调者执行，不派发**——验收重判据，spec 测试决定末节）

1. 隔离实例（本机 `localhost:17801`，c12data 3636 节点真实数据）与原型页（`file://` 直开 fork）同视口（1500×944）逐屏对拍三 scope：根层 / 领域层（含子领域的域）/ 容器层（如 agentd 域）。
2. 每 scope 并排截图 + 关键 DOM 在场断言（puppeteer）：根层 `data-layer-label` 齐备、12 卡全部在视口内（getBoundingClientRect 无出界）、孤立区文案在场；容器层 `data-duty` 行在「类型方法」卡出现真实文本（如 `agentd.Manager` 卡的职责句）、无职责容器斜体占位在场；根层领域卡 `data-entry-badge` 计数与右栏入口数一致；`data-external-out` 图例行与 prototype 图例行逐字对拍。
3. 环红标真机目击：真实数据根层 2 环 3 双向边（49① 取证值）的 `data-back-edge` 与 `data-cyclic` 在场。
4. 不接受核摘要式验收（roadmap 49⑤ 教训）；对拍差异逐条记卡：判偏差（修）或判增量（实现决定 7，留痕不返工）。

## 自审三查

- **spec 覆盖**：用户故事 1（①分层+孤立+一屏）→ T2/T3；故事 2（②摆放）→ T2/T3 + 真机 1；故事 3（③职责）→ T1-a/T3-2 + 真机 2；故事 4（④徽标）→ T1-b/T3-2 + 真机 2；故事 5（48 ext）→ T1-c/T3-6 + 真机 2。实现决定 1（fork 携带更正）→ 台账 + 卡 correction note。测试决定三条缝 → 五项检查 5。Out of Scope 五项 → 本 plan 未触碰。
- **占位符扫描**：测试步骤以「断言逐条列全 + 指认既有 harness」给出，属格式铁律允许的自我声明例外（harness 已在 §0 指认三处文件）；其余无 TBD/「同 Task N」。T2 步骤 1 的环断言期望需执行者先跑一次算法取实际值再钉死——这是「判据钉死行为」的正当操作（钉的是确定性输出，不是凑绿），已就地声明。
- **跨 task 签名一致性**：T1 Produces（entryDispersion/externalOut/isolated 口径/无 external 键）与 T2 Consumes 逐字一致；T2 Produces（ScopeLayout 扩展/scopeEdgePath）与 T3 Consumes 逐字一致；`RegistrationDispersion` 复用 flowpage 导出不另造。
