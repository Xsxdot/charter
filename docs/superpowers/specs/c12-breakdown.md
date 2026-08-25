# C12 拆解提案：代码图查看器两轴重设计（charter 侧）

> 状态：**出稿待拍板（2026-08-26）**——本稿全部产出是提案，岔口不自批；拍板结果回写本行与 §待拍板清单后随裁决同批提交。
> 上游：`docs/specs/2026-08-25-codegraph-viewer-two-axis-spec.md`（已批准 2026-08-26）+
> `docs/superpowers/specs/c12-contract.md`（已冻结，HEAD 3080f5c）。
> 台账：`docs/ledgers/2026-08-26-c12-breakdown-ledger.md`。
> 定级：L3 · 重档；跨三方 wire 契约已在 contract 冻结，本轮拆解只覆盖 **charter 仓 implement 半边**。
> 仓界：charter；handoff 侧三项交棒欠账（responsibility 正文搬运、扫描配方自洽修复、宿主 CodegraphFrame 核验）不在本工作树，照 contract §6.2-1 移交，本稿不为其设卡。
> 当前读数：分支 `cards/C12-charter-2`，HEAD 3080f5c，工作树干净。基线绿亲跑证据见台账。
> 形态基准：`prototypes/base/README.md`『C12 形态确认』——spec 的「先原型走查才许实现」硬门**已过**（2026-08-26 用户逐屏走查完毕），实现验收对照该节。

## 待拍板清单

### P1：子卡扇出粒度

K1～K6 六张提案是**按独立子卡扇出派发**，还是**合并为同一轮 implement 的工作项**（c1.10 先例：用户明言不扇出）？两案都能跑：独立卡可并行 K2/K3 与 K4/K5、review 粒度小；合并轮省交接成本但单上下文承压重。本稿按「可扇出」形态写全四段式，合并时四段式即工作项验收，无损。

### P2：同刀（responsibility 迁移）的时序

契约只冻结「同一提交」（§2.2-8/-10），不冻结它落在重建之前还是之后：

- **A（推荐）：先切归属再重建页面。**K1 排最前：旧组件读数点当场切 decls、未声明空态立即显形，走甲裁决的意图（消灭双写漂移）最早兑现；代价是旧组件上的穿线改动随后会被重建删掉一部分（一次性丢弃工）。
- B：先重建页面、最后同刀收口。刀口更小（旧读数点多半已被退役删除），但从重建到收口的窗口里，幸存的旧视图继续展示 best 来源职责文本——漂移展示期拉长，且新页面上线时 Go/TS 类型还带着已裁决废弃的字段。

### P3：新两轴页面的文件落点

- A：新建 `TwoAxisPage.tsx`（或按概念拆几个组件文件）承载两轴页面壳，`CodegraphPage.tsx` 收敛为数据装配薄壳；回退边界清晰，旧页面文件在过渡期仍可对照。
- B：`CodegraphPage.tsx` 原地重写为两轴页面，不留新旧并存的装配层；文件数少，但重写提交大、review 面宽。
影响 K4/K5/K6 文件集的落点列；两案的有界文件集均已各自圈出。命名细节归 plan（contract §7）。

### P4：context.go / migrate.go 的同刀处置（拆解核对补遗，非契约原文）

删 `BestDomain.Responsibility` 编译强制触及 contract §2.2-8 四条之外的第五、六处：`context.go:370`（`Summary: domain.Responsibility`）与 `migrate.go`（占位符写入 + migrationNotes 提示行）。机械要求是编译绿同刀，语义处置两案：

- **A（推荐）：Summary 改读 decls。**`AssembleContext` 已持有 repoRoot 且 :127 已加载 decls，把 decls 传进 `contextVocabulary` 即可；agent 取数路径的领域摘要与 viewer 同源（架构法第五条精神），migrate.go 占位符改为不写字段、notes 行同步删除。
- B：Summary 置空、migrate.go 直接停写。改动最小，但 agent 上下文的领域摘要从此静默消失，与「未声明显形」的诚实原则相容却少了写入路径指引。

### P5：冻结退场名单之外的旧视图文件去留

§2.5-37/-38 点名退役 `deriveDomainPage`、`DomainCascadeDrawer`、`CallTree`、`FocusGraph`。以下文件不在点名内，但随「一页按 scope 变」失去全部调用方：`BestPanorama.tsx`、`BestScopePanorama.tsx`、`BestDetail.tsx`、`BestOverlays.tsx`、`DomainPanorama.tsx`、`DomainDetail.tsx`、`DetailPanel.tsx`、`BestLeafGraph.tsx` 及各自的 `.test.` 文件。

- **A（推荐）：无调用方即删，与装配切换同一提交。**死代码不留——留着必然在后续卡里被误当活路径引用；其中 besttree.ts 被缝 1 复用的纯函数部分**保留**（见 §一 S2 边界澄清）。
- B：仅删点名的四个，其余暂留等后续清理。违背「不留双派生器并存中间态」的同款逻辑（§2.5-37 对 deriveDomainPage 的处理方式），不建议。

---

## 一、触及子系统清单与派卡资格核对

charter 仓根**无项目图**（fresh 复核见台账），`codegraph/best.json` 的顶层领域清单不存在于本仓；按 using-charter 存量无图规则，本清单以**已冻结接缝**人工降档列出，handoff 数据图（23 领域 / 232 容器 / 162 入口）是消费的数据，不冒充 charter 项目子系统。测试夹具 `graph/codegraph/testdata/repo/` 不算子系统。

| id | 子系统 | 类型 | 有界文件集概貌 | 契约面 | 依赖 DAG | 资格结论 |
|---|---|---|---|---|---|---|
| S1 | graph/codegraph Go 图库（best wire 形状与执法） | **逻辑型**（接缝对面是自有 Go 测试） | `graph/codegraph/{best.go, best_test.go, context.go, migrate.go, check_test.go, gap_test.go, context_test.go}`（domains_test.go 空字面量预检不动） | `BestDomain` JSON tag、`ValidateBest` issue 清单、`ContextDomain.Summary`、迁移输出 | S1 → 无下游回调；wire 向上单向供给 S2/S3 | 四条齐：文件集一条路径规则圈得出；契约面 = 上述符号清单；无同级环；Go 测试闭环 |
| S2 | graph/webui 派生层（两缝 + 存量纯函数层） | **逻辑型**（纯函数，vitest 可闭环，不触 DOM） | `graph/webui/src/app/codegraph/{scopepage.ts, flowpage.ts, domainpage.ts(退役), besttree.ts(部分复用)}` + 各自测试 | 缝地址 `deriveScopePage`/`deriveFlowPage`（§2.3-17/-18、§2.4-28/-29）、输入字段钉死（-19/-30）、导出面限应用模块内 | S2 → S3 单向供给模型；S2 只读 api/types 镜像，不发请求 | 四条齐：缝地址与输入字段已冻结可枚举；纯函数无环；vitest 行为闭环 |
| S3 | graph/webui 组件与页面装配层 | **边界型**（机内验 DOM 契约形状；真实浏览器/宿主行为归真机清单） | 新两轴页面组件 + 测试、`CodegraphPage.tsx(+test)`、`api/types.ts`、退役组件族（P5 名单） | DOM data-* 契约、右栏三 tab 结构、防漂 className 判据（§2.5-40） | S3 消费 S2 模型 → 浏览器/handoff 宿主（真机） | 四条齐：组件文件可枚举；DOM 断言面可枚举；jsdom 可验形状，视觉质量走真机 |

**移交半边（非本仓子卡）**：扫描侧（handoff 配方与扫描器、flows/kind 校验器开启、stateMachine 互证闸开启）= 边界型·移交 roadmap 27/32；宿主三项 = contract §6.2-1。本轮对它们的全部义务是：viewer 侧降级形态正确（新键缺席不当错误）。

### 架构法附加核对

- **第三条升格判据显式回答**（沉默即违法）：信号 1 命中——`app/codegraph/` 内 `Best*` 前缀家族现有 6 个源文件 ≥5；信号 2 未命中（非测试源文件 21 < 40）。处置：命中家族恰在本轮退役名单内，K6 落地后家族消散；新两轴组件**按概念命名**（画布/右栏/流程图各归其名），若实现中任一新前缀家族长到 ≥5，触发竖切成子目录 + 唯一导出入口（TS 规则），落名归 plan。不插竖切还债卡：六张提案全部圈得出有界文件集，无需前置还债。
- 不触及 handoff 宿主 `internal/agentd`，不把外部现实误标成 charter 逻辑型。
- 阈值常量纪律沿 c1.10 同款：折叠阈值等只存在于派生器模块（§2.3-23 已冻），不进 URL/localStorage/env/配置。

## 二、契约增量核对（40 条冻结断言逐条）

上游状态位已落文件头（spec 已批准、contract 已冻结，出处见台账）。逐条结论分四档：【落】本轮子卡落地、【保】保持项零代码、【移】移交 handoff/后续卡、【释】边界澄清（不改冻结文字）。

| 冻结条 | 结论 |
|---:|---|
| §2.1-1 flows 顶层键 additive-only | 【保+落】Ticket 0 类型已落（CgGraph.flows?）；K3 只消费，不删不改既有键 |
| §2.1-2 FlowStep 字段集钉死 | 【保】types.ts#CgFlowStep 已镜像；K3 断言字段透传不丢 |
| §2.1-3 kind 四值词表 | 【保】Go 常量 + CgFlowStepKind 已落；K3 模型按四值分支，未知值显式降级不冒充步骤 |
| §2.1-4 iface 从 implements join、禁止复制 | 【落 K3】实现清单 join 自 baseline.implements；验收含反面断言（flows 夹具内塞实现清单必须被忽略/不出现） |
| §2.1-5 flows 只盖承重函数 | 【移】范围裁定归 roadmap 27/32；K3 对缺席入口走 degraded（-31） |
| §2.1-6 entry.channel 词表与分组 | 【落 K3/K4】按 channel 分组；存量数据全缺 channel → 【释 2】降级为「通道未标注」单桶显式呈现（§2.1-7 的应用） |
| §2.1-7 新键缺席=降级非传输失败 | 【落 K3/K4/K5】flows/channel 缺席双向断言（passthrough 测试由正式断言取代后保留双向） |
| §2.2-8 四者同刀删除 | 【落 K1】+【释 1】同刀清单补遗 context.go/migrate.go（编译强制，P4 定语义处置） |
| §2.2-9 职责正文唯一所有者 = decl | 【落 K1/K2】best 只留结构；缝 1 卡面职责一律 decl 或未声明 |
| §2.2-10 读数点改 decls 与 -8 同提交 | 【落 K1】三组件 + besttree 六处；props 穿线（现无 decls prop，台账已核） |
| §2.2-11 无声明显示「未声明」+ 写入路径、禁兜底 | 【落 K1/K2/K4】反面断言：把 best label/任何兜底文本拼进职责位必须红 |
| §2.2-12 迁移不丢字 | 【移】数据在 handoff 仓，交棒 §6.2-1① |
| §2.2-13 容器只挂叶子不变式保持 | 【保】ValidateBest :127-135 零改动；K1 变异确认该检查仍在执法 |
| §2.2-14 容器 kind 八值词表、兜底桶二值 | 【落 K2】TS 侧新增词表/兜底桶常量表达（值已冻结，加常量是实现）；判据以词表为准不以字符串前缀为准 |
| §2.2-15 未知 kind 显式报错、随扫描侧同批开启 | 【移+释】校验器开启归 roadmap 27/32 扫描侧；K2 在开启前的机内行为 = 词表外值不进兜底桶判据且如实标注（不静默计入占比） |
| §2.2-16 stateMachine.anchor 约定、互证闸后开 | 【保】本轮零代码（格位已在）；K4 状态机 tab 空态如实 |
| §2.3-17 scopepage 模块路径与导出面 | 【落 K2】仅供 codegraph 应用模块内消费【释 3】 |
| §2.3-18 缝地址 deriveScopePage 不可变 | 【落 K2】Ticket 0 壳上实装，签名不动 |
| §2.3-19 ScopePageInput 字段钉死 | 【落 K2】五字段照用；scopeId=null 即根层 |
| §2.3-20 递归同构、容器原子 | 【落 K2/K4】模型每层同形状；双击容器无动作在 K4 DOM 断言 |
| §2.3-21 组织切换控件不混排 tablist | 【落 K4】反面断言 role=tablist 后代无 organization 控件 |
| §2.3-22 四类债读数经缝 1 输出断言覆盖 | 【落 K2】兜底桶占比/复用度/真假共享内核/触达域散度数值化断言 |
| §2.3-23 折叠判据替换 slice(0,quota) 坏取法 | 【落 K2】阈值 10 边界两侧断言；变异 10→9 必红（§4.3） |
| §2.3-24 大容器如实报、视图层不折叠圆场 | 【落 K2/K4】正面显示符号数/文件数/无声明职责/债务色 |
| §2.3-25 三类空态显式 | 【落 K2/K4】无声明/无实体/无入缝各自文案指缺什么去哪补 |
| §2.3-26 容器职责唯一合法推导 = 同名类型节点 doc 注释按包匹配 | 【落 K2】按包匹配断言 + 函数组/实体容器「无职责主体」 |
| §2.3-27 孤立子系统如实呈现、projections 第二类边 | 【落 K2/K4】Web 控制台孤立原因标注；twin/typed 边标注「不是调用边」 |
| §2.4-28 flowpage 模块路径与导出面 | 【落 K3】【释 3】同 -17 |
| §2.4-29 缝地址 deriveFlowPage 不可变 | 【落 K3】 |
| §2.4-30 FlowPageInput 两字段钉死 | 【落 K3】 |
| §2.4-31 flows 缺席显式降级、机械序列只进 agent tab | 【落 K3/K5】degraded 双向；调用链 tab 如实标注无次序无分支 |
| §2.4-32 入口归属三态 | 【落 K3】单值/多值显示全部候选/判不出标「无行为」（Cobra 分组命令夹具） |
| §2.4-33 注册散度判红 | 【落 K3】1 文件且 >3 入口红；边界 3 入口不红、12 文件不红 |
| §2.4-34 入口族分组从名字算 | 【落 K3】CLI 命令族/HTTP 资源族；不依赖容器按服务领域拆分 |
| §2.4-35 流程图形态断言 | 【落 K3/K5】矩形左色条/菱形/卫语句侧甩/蛇形折列（path 元素非文字）/紫框 ▸/双线框 + 实现 join |
| §2.4-36 术语三分不得混用 | 【落 K5】三词定义句 + 「对外面」tab 区分句存在性断言 |
| §2.5-37 deriveDomainPage 退役并入缝 1 | 【落 K6】端口聚合进缝 1；退役与组件改造同提交，无双派生器中间态 |
| §2.5-38 调用链视图退场 | 【落 K6】三组件移除 + rg 零残留断言；CLI/agent 路径不动 |
| §2.5-39 C1.9 四条点状修并入 | 【落 K4/K6】抽屉带计数徽标、色板图例、三态配色、虚线 frame |
| §2.5-40 防漂 className 机械检查 | 【落 K6】新增交互控件非空 className 机械检查 + 变异必红 |

### 不退回 contract 的边界澄清（已回写契约文档 §8 修订记录）

1. **同刀清单补遗**：删 `BestDomain.Responsibility` 编译强制触及 `graph/codegraph/context.go#contextVocabulary`（Summary 取该字段）与 `graph/codegraph/migrate.go`（迁移写入占位符 + migrationNotes 提示行）及 `check_test.go`/`gap_test.go`/`context_test.go` 的带字段字面量——均随 §2.2-8 同一提交处置；冻结条 8 的「四者」文字不改，实际刀口以此澄清为准。
2. **channel 分组降级形态**：存量 entry 数据 channel 全缺（contract §1 外部核对），§2.1-6 的按通道分组在重扫前以「通道未标注」单桶显式呈现——这是 §2.1-7 降级语义的应用实例，不是新键也不是放宽词表。
3. **缝导出面归属**：`scopepage.ts`/`flowpage.ts` 的导出是 webui 应用包内部 API（§2.3-17/-28 已冻「不导出到应用外」），不属于宿主契约面；webui 组件重组（组件拆并、文件增删）只要缝地址与 DOM 行为契约不变，就不构成契约增量。

## 三、子卡提案与依赖 DAG

```
K1（responsibility 同刀迁移，S1+S3）
      │
      ├──────────────┐
K2（缝 1 结构轴派生器） K3（缝 2 行为轴派生器）     ← K2/K3 可并行
      │                │
K4（结构轴页面与右栏） K5（行为轴流程图页面）       ← K4/K5 可并行
      └───────┬────────┘
K6（装配切换、退役与整轮收口，S2+S3）
```

K1 最前（P2-A 时序下）：它改 types/besttree/组件夹具的字段形状，先行可让后续所有卡的夹具一次到位，避免中途换底。K2/K3 只依赖 K1 后的类型面，互相无依赖。K4/K5 各依赖对应缝的模型。K6 依赖 K4/K5 的组件入口，执行退役、装配切换、防漂检查与全量回归。若 P1 拍合并轮，则按 K1→K2→K3→K4→K5→K6 顺序在同一轮内推进，四段式照用。

### K1｜responsibility 同刀迁移（S1 Go 半边 + S3 TS 读数点 · 逻辑型闭环）

#### ①契约引用

contract §2.2-8/-9/-10/-11/-13、§3-3；【释 1】同刀补遗（context.go/migrate.go/三个测试夹具）；P4 定 Summary 语义处置。

#### ②意图与为什么

职责正文唯一所有权归 decl 文件，best 只留结构——消灭三方共用的双写漂移（走甲裁决）。删字段必须一刀切净：Go 字段/校验/钉值、TS 镜像、全部读数点同一个提交，不留「字段还在但没人读」或「有人还在读」的中间态。未声明领域当场显形为「未声明 + 写入路径」，那是真实债务的第一次如实呈现。

有界文件集（charter 侧全集，编译/grep 机械圈定）：

    graph/codegraph/best.go
    graph/codegraph/best_test.go
    graph/codegraph/context.go          （P4 处置）
    graph/codegraph/migrate.go          （P4 处置）
    graph/codegraph/check_test.go
    graph/codegraph/gap_test.go
    graph/codegraph/context_test.go
    graph/webui/src/api/types.ts        （CgBestDomain 删 responsibility）
    graph/webui/src/app/codegraph/besttree.ts（六处透传改 decls 源）
    graph/webui/src/app/codegraph/besttree.test.ts
    graph/webui/src/app/codegraph/BestScopePanorama.tsx(+test)
    graph/webui/src/app/codegraph/BestDetail.tsx(+test)
    graph/webui/src/app/codegraph/BestDomainPage.tsx(+test)
    graph/webui/src/app/codegraph/BestLeafGraph.test.tsx
    graph/webui/src/app/codegraph/BestPanorama.test.tsx
    graph/webui/src/app/codegraph/CodegraphPage.test.tsx（夹具换底）

#### ③验收

1. `cd graph && go build ./... && go test ./codegraph/ ./cli/ -count=1` 退出码 0；`grep -n "Responsibility" graph/codegraph/best.go` 无输出。
2. 序列化钉值反转：`json.Marshal(BestDomain{})` 的输出**不含** `"responsibility"` 键（原 best_test.go :51-57 断言取反重写）；原「responsibility required」用例反转为「空 responsibility 不再产 issue」。
3. 保持项反面断言：「容器挂在非叶子领域」issue 在构造违例夹具时**仍然产出**（§2.2-13 未被顺手弱化）。
4. P4-A 时：decls 有声明的领域 ContextDomain.Summary 等于声明正文、无声明为空串；P4-B 时恒空串。两种处置都不得 panic。
5. TS 侧：`cd graph/webui && npm run typecheck && npm test` 退出码 0（夹具换底后全量绿）；`rg "responsibility" graph/webui/src/api/types.ts` 仅剩 CgDomainDecl（声明结构保留）一处。
6. 读数点行为断言：decls 提供正文时三组件与 besttree 派生读数显示正文；decls 缺席时显示「未声明」+ `codegraph/domains/<id>.json` 写入路径；**反面断言**——构造 best.domains 带 label 的夹具，职责位置不出现 best 来源文本（兜底回退即红）。

缺陷族对抗审查：

| 族 | K1 结论 |
|---|---|
| 生命周期/状态机中断 | 无，因为本卡是纯内存类型/校验/读数改造，不起进程、不建临时资源；唯一持久效果是提交本身，中断重跑无害。 |
| 静默失败/误导报错 | 命中并锁定：删校验（-8）与保校验（-13）必须分开断言，防止「顺手多删」造成空 best 全绿假象；Summary 处置（P4）不得静默吞掉声明缺失，B 案须留注释指明摘要来源已迁 decls。 |
| 跨平台假设 | 无，因为不触路径拼接、进程、权限与 webview；JSON tag 变更对所有平台同形。 |
| 假红/假绿测试 | 命中并锁定：序列化断言从「必须出现」反转为「必须不出现」是行为反转不是删测试；-13 保持项用**正例违例夹具**锁（只有负例会稳定假绿）；TS 夹具换底后全量测试跑，不允许 skip。 |
| 门禁绕过 | 无，因为无新增写/执行入口；ValidateBest 调用点（cli.go :139/:260）不动，门的位置不变。 |
| 序列化边界 | 命中且有回归：Go marshal 钉值（第 2 条）+ TS 消费端夹具（第 5/6 条）两端各自断言，另有一条穿线断言——client.test.ts 真实 Response JSON 回放中 best 无 responsibility 键时页面正常渲染（区分「字段缺失」与「值为空串」）。 |
| 枚举新值过白名单 | 无，因为不新增枚举值；删的是字段不是词表项。 |
| 承重安全属性有测试锁住 | 无安全属性；承重的「单一所有权」属性由第 6 条反面断言（兜底回退即红）锁住，变异「把 best label 回填职责位」必须转红。 |

#### ④入口指针

`graph/codegraph/best.go#BestDomain`、`#ValidateBest`、`graph/codegraph/context.go#contextVocabulary`、`graph/codegraph/migrate.go#migrationNotes`、`graph/webui/src/api/types.ts#CgBestDomain`、`graph/webui/src/app/codegraph/besttree.ts#bestSubsystems`（透传样例 :177/:201/:576）、`graph/webui/src/app/codegraph/BestDetail.tsx:125`。

### K2｜缝 1 实装：deriveScopePage 结构轴视图模型（S2 · 逻辑型）

#### ①契约引用

contract §2.3-17～27、§2.2-14/-15（kind 词表与兜底桶）、-22～-27 债读数与折叠判据、§4.3 缝 1 测试最低集与变异要求；布局选型归 plan（§7），本卡不锁做法只锁判据相关模型事实。

#### ②意图与为什么

把「一个页面按 scope 变」的全部读数收敛进一个纯函数：递归同构（每层同一模型形状，层数不定到容器为止）、组织切换（best/current）只是输入维度、四类债读数与噪声折叠判据全部可从现有 baseline/target/report 机械算出。组件层不许出现第二套口径——这是替换坏 `slice(0, DOMAIN_FOCUS_QUOTA)` 取法的主战场，也是「容器粒度的债如实显形」的数据来源。

有界文件集：

    graph/webui/src/app/codegraph/scopepage.ts        （实装，缝地址不动）
    graph/webui/src/app/codegraph/scopepage.test.ts   （新建）
    （只读复用 besttree.ts/domains.ts/graphmath.ts 现有导出；如需修改其行为，改动归 K6 退役刀统一评审）

#### ③验收

1. `cd graph/webui && npm test -- src/app/codegraph/scopepage.test.ts && npm run typecheck` 退出码 0。
2. 递归同构：根（scopeId=null）、中层领域、叶子领域的容器层三种夹具返回的模型顶层键集相同（深度相等断言），容器层模型的容器是原子节点（无 children 字段或等价标记）。
3. 兜底桶占比数值化：构造已知边集（如 10 条跨域入边、7 条落兜底桶容器）断言模型输出 70%；词表外 kind 的边不计入分子且模型带显式计数（§2.2-15 开启前的诚实形态）。
4. 复用度数值化：构造两个入口、一个两入口皆可达的入缝符号，断言复用度=2；不可达符号复用度=0（死契约）不被静默丢弃。
5. 折叠判据边界：复用度 9 的兜底桶符号不折叠、复用度 10 折叠且不占名额；非兜底桶高复用符号（实体/类型方法）不折叠（真假共享内核另一分支各有断言）。
6. 大容器如实报：>40 符号容器的模型带符号数/文件数/无声明职责/债务色字段，且无任何「折叠建议」类字段（永不做项的反面断言）。
7. 三类空态布尔独立可验：无声明、无实体、无入缝各自为 true 且互不影响。
8. 容器职责推导：同名类型节点 doc 注释按包匹配命中；跨包同名不误配（张冠李戴反面夹具）；函数组/实体容器输出「无职责主体」标记而非空串伪装。
9. 组织切换：organization='current' 且 best 缺席可用；'best' 且 best 缺席返回显式不可用标记，不得拿 current 冒充。
10. 孤立子系统：无跨域入边的顶层领域模型带孤立标记；projections twin/typed 作为第二类边出现在模型中并带「非调用边」标记。
11. 变异复验（临时副本，验后恢复）：折叠阈值 10→9 必须至少一支测试转红；占比计算去掉词表过滤必须转红。
12. `passthrough` 直通标记从 ScopePageModel 移除，`ticket0.passthrough.test.ts` 中缝 1 用例由本测试取代。

缺陷族对抗审查：

| 族 | K2 结论 |
|---|---|
| 生命周期/状态机中断 | 无，因为纯函数无定时器、无订阅、无网络；宿主重启后模型随页面重算，无孤儿资源。 |
| 静默失败/误导报错 | 命中并锁定：三类空态、词表外 kind 计数、best 缺席不可用、复用度 0 死契约全部显式进模型；禁止用空数组/0 伪装「没有债」。 |
| 跨平台假设 | 无新增，因为只处理 JSON 数据与字符串 id，不用路径分隔符/进程/webview API；file#Symbol 原样透传。真实大数据量下的性能未验证，列真机。 |
| 假红/假绿测试 | 命中并锁定：数值断言用手工可验的小世界夹具（10 边 70% 这种一眼可核的数）；变异复验两条必须红；测试锁模型输出契约（调用方依赖），不锁内部 helper 名——换排序实现不该红。夹具无法证明真实 handoff 数据形态，真机清单承接。 |
| 门禁绕过 | 无，因为纯函数无写/执行路径；阈值不导出可变配置（§2.3-23），无用户可调旁路。 |
| 序列化边界 | 命中：baseline.edges 二元组→EdgeContext 投影、implements 二元组→实现清单 join、containers.kind 词表匹配均有字段级断言；K6 的 client 回放补 wire 端穿线，本卡断言「缺席与空数组不混淆」。 |
| 枚举新值过白名单 | 命中：kind 八值词表与兜底桶二值常量为本卡新增 TS 符号（-14 的实现），FlowStepKind 四值分支齐全，未知值走显式降级分支不崩溃；若实现需要第四种 step kind 或第九种容器 kind，先退回 contract。 |
| 承重安全属性有测试锁住 | 无安全属性；承重的「噪声折叠判据」「真假共享内核同源性」由边界+变异测试锁住（第 5/11 条）。 |

#### ④入口指针

`graph/webui/src/app/codegraph/scopepage.ts#deriveScopePage`（缝地址）、`graph/webui/src/api/types.ts#CgGraph`/#CgBest/#CgTarget/#CgContainer、复用参考 `besttree.ts#topLevelSubsystemIds`/#subsystemOf/#containerFacts、`domainpage.ts#edgeContexts`（端口聚合并入参考，§2.5-37）。

### K3｜缝 2 实装：deriveFlowPage 行为轴视图模型（S2 · 逻辑型）

#### ①契约引用

contract §2.4-28～36、§2.1-3/-4/-6/-7、§4.3 缝 2 测试最低集与变异要求。

#### ②意图与为什么

行为轴的全部读数从一个纯函数出来：入口归属三态、注册散度、入口族分组、触达域散度、流程步骤树到泳道主干的表达。flows 今天没有真数据（roadmap 27/32），所以降级形态是一等公民——degraded 必须是模型里的显式字段而不是渲染期猜测；接口调用点的实现清单从 implements join，不在 flows 复制第二份必烂数据源。

有界文件集：

    graph/webui/src/app/codegraph/flowpage.ts         （实装，缝地址不动）
    graph/webui/src/app/codegraph/flowpage.test.ts    （新建）
    （只读复用 domains.ts/graphmath.ts；baseline.implements/projections 消费在本卡）

#### ③验收

1. `cd graph/webui && npm test -- src/app/codegraph/flowpage.test.ts && npm run typecheck` 退出码 0。
2. 入口归属三态：单值（首次跨域调用目标唯一）→ 单归属；多值夹具 → 全部候选 + 多值标注；Cobra 式无出边入口 → 「无行为」标记。（排除兜底桶噪声的判定用 §2.2-14 词表，与 K2 同源常量。）
3. 注册散度：1 文件 4 入口 → 判红；1 文件 3 入口 → 不红；36 入口 12 文件 → 不红（边界三侧各有断言）。
4. 族分组：CLI 命令族与 HTTP 资源族从节点名聚合的断言；分组不依赖容器归属（把两个族的入口塞进同一容器的夹具不改变分组结果）。
5. 触达域散度：入口族触达领域数数值化断言。
6. 流程模型：steps 按 order 排序输出；branch 的 then/else/body 子干引用完整呈现；iface=true 步骤的实现清单等于 implements join 结果，且 flows 夹具里塞入实现数组时被忽略（-4 反面断言）。
7. 降级双向：flows 键整体缺席 → degraded=true；键在但该入口缺席 → degraded=true；命中 → false（passthrough 用例正式化，双向断言保留）。
8. degraded 模型同时携带该入口的机械可达序列数据位（供右栏「调用链（给 agent）」tab），并带「无次序无分支」标注字段——序列不得混入流程主干模型（-31 反面断言）。
9. 变异复验：degraded 判定反转必须至少一支测试转红（§4.3）。
10. `passthrough` 标记从 FlowPageModel 移除。

缺陷族对抗审查：

| 族 | K3 结论 |
|---|---|
| 生命周期/状态机中断 | 无，因为纯函数无副作用；flows 真数据到达后的再扫描不产生本卡管辖的持久资源。 |
| 静默失败/误导报错 | 命中并锁定：degraded 三态、「无行为」、多值候选全部显式；最大风险「拿可达序列冒充流程图」由第 8 条反面断言锁死。 |
| 跨平台假设 | 无新增，同 K2；入口名聚合是纯字符串操作，中文/斜杠命名的族名切分规则若有假设须在测试里固化（HTTP 方法前缀形态夹具），不靠运行环境。 |
| 假红/假绿测试 | 命中并锁定：三态各有正反夹具（尤其「无行为」不能靠空数组碰巧通过）；散度边界三侧断言防 off-by-one；变异 degraded 反转必红。测试锁输出契约不锁内部遍历顺序——edges 原序扰动不改变归属结果的稳定性断言要有。 |
| 门禁绕过 | 无，因为纯函数无权限面；不新增请求入口。 |
| 序列化边界 | 命中：FlowStep 七字段（to/cond/then/else/body 按 kind 的必填组合）透传断言逐字段做，缺失与零值可区分；implements `[string,string][]` join 有专断言。 |
| 枚举新值过白名单 | 命中：CgEntryChannel 四值用于分组，未知/缺席 channel 走「通道未标注」降级桶（【释 2】）；FlowStepKind 四值之外的数据不崩溃、显式标注。新增枚举先退回 contract。 |
| 承重安全属性有测试锁住 | 无安全属性；「flows 不复制实现清单」这一数据单源属性由第 6 条反面断言锁住。 |

#### ④入口指针

`graph/webui/src/app/codegraph/flowpage.ts#deriveFlowPage`（缝地址）、`graph/webui/src/api/types.ts#CgFlowStep`/#CgNode.channel/#CgGraph.implements、`ticket0.passthrough.test.ts`（被取代的双向断言基準）。

### K4｜结构轴页面组件与右栏三 tab（S3 · 边界型）

#### ①契约引用

contract §2.3-20/-21/-24/-25/-26/-27、§2.2-11、§2.5-39（四条点状修中的画布相关三条）、-40；形态基准 `prototypes/base/README.md`『C12 形态确认』。

#### ②意图与为什么

把 K2 模型变成可走查的结构轴页面：一页按 scope 变、单击右栏、双击下钻、容器原子。a11y 缺陷（两组控件混排同一 tablist）在此机械消解；空态与债务如实显形在此落到 DOM。视觉质量判据（空白最少、交叉最少、箭头方向感）机内不可断言，锁 DOM 契约形状，视觉归真机走查对照形态基准。

有界文件集（P3-A 落点示例；P3-B 则并入 CodegraphPage.tsx 重写集）：

    graph/webui/src/app/codegraph/TwoAxisPage.tsx(+test)      —— 页面壳与 scope 状态
    graph/webui/src/app/codegraph/ScopeCanvas.tsx(+test)      —— 结构图画布（布局调用方）
    graph/webui/src/app/codegraph/RightPanel.tsx(+test)       —— 三 tab 右栏 + 拖宽
    graph/webui/src/app/codegraph/MigrationDrawer.tsx(+test)  —— 迁移按需抽屉带计数徽标（§2.5-39①）
    （组件命名与是否再拆归 plan；P5-B 时旧组件文件暂留本卡不触碰）

#### ③验收

1. `npm test -- <上述测试>` 与 `npm run typecheck` 退出码 0。
2. 双击容器：无路由/状态变化，且出现「容器没有下一层」说明文案（DOM 断言）；双击领域：scope 更新事件可见（回调参数断言）。
3. 组织切换控件不在 `role="tablist"` 子树内（`container.querySelector('[role=tablist] [data-organization]')` 为 null 的反面断言）——机械消解 BestDomainPage.tsx:172 缺陷。
4. 三 tab 结构：基本信息（职责/选中项/不变式/对外面读数/程序入口）、对外面、状态机依次可切；「程序入口」区按 channel 分组渲染，channel 全缺时显示「通道未标注」单桶（【释 2】）。
5. 空态文案：无声明（含写入路径 codegraph/domains/<id>.json）、无实体、无入缝三种 DOM 各自出现，且不出现「看起来完整」的假读数占位。
6. 大容器卡正面显示符号数/文件数/债务色标记；无折叠圆场控件。
7. 孤立子系统旁的原因标注与 projections 第二类边（紫色虚线样式标记 + 「不是调用边」文案）存在性断言。
8. C1.9 点状修：迁移抽屉默认收起、触发钮带计数徽标；四档债务色板图例区块存在；嵌套层虚线 frame 标记存在。
9. 选中态：单击节点后相连节点高亮标记与不相连节点压暗标记同时出现（只压暗不高亮即红）。
10. 本卡不发起任何网络请求（mock client 计数不变断言）；右栏拖宽只改本地宽度状态。

缺陷族对抗审查：

| 族 | K4 结论 |
|---|---|
| 生命周期/状态机中断 | 无孤儿资源：组件局部 state 卸载即亡，无定时器/订阅；localStorage 拖宽持久化的键读写失败（隐私模式）不得崩溃——try/catch 包裹的行为断言列入实现。 |
| 静默失败/误导报错 | 命中并锁定：空态五处（第 5 条）、容器无下一层说明、组织切换 best 缺席禁用态各有反面断言；不存在「点击无反应」的死控件（每个可交互元素都有可见反馈断言）。 |
| 跨平台假设 | 命中并标真机：wheel 缩放/拖拽平移/拖宽分隔条的浏览器兼容与中文文案折行 jsdom 无法证明，列真机清单 1/3；机内只断言事件处理器挂载与状态变化。 |
| 假红/假绿测试 | 命中并锁定：全部用 data-* / role 行为查询，禁 snapshot；「双击容器无动作」必须断言 scope 状态未变而非只查无弹窗（否则任何渲染 bug 都可能假绿）；防漂 className 检查在 K6 收口，本卡组件先行遵守。 |
| 门禁绕过 | 无，因为无写路径无鉴权面；iframe URL ?project= 单向传参契约不触碰（宿主核验属交棒欠账③）。 |
| 序列化边界 | 命中：K2 模型 → DOM 的投影（数值→文本、枚举→样式标记）有字段级查询断言；不在 JSX 里重算读数（模型外的计算出现即违反缝纪律，code review 判据写入卡文）。 |
| 枚举新值过白名单 | 命中：tab 名三值、DirectionStatus 四档色板、channel 四值 + 未标注降级桶，全部来自 K2/K3 词表同源常量；未知 DirectionStatus 渲染走中性缺省（现状纪律延续）。 |
| 承重安全属性有测试锁住 | 无安全属性；「术语三分不混用」的 UI 表述属 K5，「组织切换控件隔离」这一 a11y 属性由第 3 条反面断言永久锁住。 |

#### ④入口指针

`graph/webui/src/app/codegraph/scopepage.ts#ScopePageModel`（唯一数据源）、`BestDomainPage.tsx:172`（被消解的缺陷现场）、`BestOverlays.tsx#MigrationSidebar`（被抽屉取代的现状）、`prototypes/base/README.md`（形态基准）。

### K5｜行为轴流程图页面（S3 · 边界型）

#### ①契约引用

contract §2.4-31/-32/-35/-36、§2.1-7、§4.2（passthrough 正式化后半边）；形态基准『C12 形态确认』行为轴要点。

#### ②意图与为什么

流程图是人看的那一半行为轴：矩形/菱形/卫语句侧甩/蛇形折列/紫框递归下钻/双线框接口调用。这格今天没有真数据（Out of Scope 1），因此降级形态与「调用链（给 agent）」tab 是同一天就要对的承诺。术语三分（程序入口/对外入缝/泳道）在此页完成最终表述。

有界文件集：

    graph/webui/src/app/codegraph/FlowChart.tsx(+test)        —— 流程图画布（蛇形折列渲染）
    graph/webui/src/app/codegraph/FlowPageView.tsx(+test)     —— 流程页壳：泳道、右栏基本信息/调用链 tab
    （组件命名与拆分归 plan；蛇形 SVG 路径算法归 plan §7）

#### ③验收

1. `npm test -- <上述测试>` 与 `npm run typecheck` 退出码 0。
2. 形态映射：call 步骤渲染矩形节点（data-shape="rect"，左侧色条标记=所属领域）、branch 渲染菱形（data-shape="diamond"）、卫语句型 branch（then 或 else 为 return）甩主干一侧渲染（位置标记断言，非像素）。
3. 蛇形折列：折列发生时列间存在 `<path>` 连线元素；**反面断言**——「接上列」之类文字标签出现即红（§2.4-35 禁止文字代线）。
4. 下钻：下层入口节点（紫框 ▸ 标记）点击触发携带该入口 id 的回调（进入它自己的流程图）；接口调用节点（双线框标记 data-iface）对应的右栏列出全部实现（mock implements join），每个实现的入口可点击换图。
5. 降级：degraded=true 时不渲染流程主干，显示显式降级空态（缺什么、数据何时会有——指向扫描侧 roadmap 语境的可行动文案）；「调用链（给 agent）」tab 展示可达序列并带「无次序无分支」标注。
6. 术语三分：页面内「程序入口」「对外入缝」「泳道」按定义使用；「对外面」tab 含一句显式区分两者的文案（存在性断言）。
7. 本卡不发起网络请求（除既有 client 外无新入口）。

缺陷族对抗审查：

| 族 | K5 结论 |
|---|---|
| 生命周期/状态机中断 | 无孤儿资源：无 effect 网络订阅；递归下钻的层级栈是组件内存，卸载即亡；换入口换图时旧图选择不泄漏（切换清空断言）。 |
| 静默失败/误导报错 | 命中并锁定：降级空态必须可行动（第 5 条），degraded 渲染成流程图是最大危害，反向断言锁死；iface 实现清单为空时显示「无实现记录」而非空面板。 |
| 跨平台假设 | 命中并标真机：SVG path 蛇形连线在不同画布宽度/DPR 下的视觉正确性、折列数随拖宽重排——jsdom 不可证，真机清单 2；机内只断言 path 元素存在与列结构。 |
| 假红/假绿测试 | 命中并锁定：形态映射用 data-shape/data-iface 结构标记断言而非坐标快照（换布局算法不应红）；「文字标签代线」反面断言直接锁 spec 明文禁令；flows 夹具覆盖 branch 无 else、loop 嵌套 call 的畸形合法形态。 |
| 门禁绕过 | 无，因为纯展示无写路径；下钻是页内状态流转，无路由/URL 契约变更。 |
| 序列化边界 | 命中：FlowPageModel（含 steps 树与实现清单 join 结果）→ DOM 标记的投影逐类断言；steps 引用悬空（then 指向不存在 id）时的容错行为归 plan 细化，本卡只要求不崩溃且有显式标注（畸形数据夹具）。 |
| 枚举新值过白名单 | 命中：step kind 四值→四种图形的映射 switch 齐全，未知 kind 走显式「未知步骤」降级节点；channel 词表沿用 K3。 |
| 承重安全属性有测试锁住 | 无安全属性；「人看界面不出现冒充流程图的机械序列」这一用户裁决属性由第 5 条反面断言锁住。 |

#### ④入口指针

`graph/webui/src/app/codegraph/flowpage.ts#FlowPageModel`（唯一数据源）、`ticket0.passthrough.test.ts:31-37`（被正式化的降级断言）、schema 草案 §2b（iface 语义）、`prototypes/base/README.md`（形态基准）。

### K6｜装配切换、退役与整轮收口（S2+S3 · 边界型）

#### ①契约引用

contract §2.5-37/-38/-39/-40、§4.2（passthrough 取代）、§4.3（同刀回归 + 变异集汇总）、§2.2-10（同刀回归口径）；P5 裁决定退役边界。

#### ②意图与为什么

两轴页面就位后，把页面装配从三态旧世界切到一页按 scope 变的新世界：退役 deriveDomainPage 与调用链三组件（永不做项落地）、清退失去调用方的旧视图族（P5-A）、防漂 className 机械检查上线、passthrough 直通标记彻底退场、全量回归证明 charter 仓绿。这是「不留双派生器并存中间态」的执行卡。

有界文件集：

    graph/webui/src/app/codegraph/CodegraphPage.tsx(+test)            —— 装配重接线（P3-B 时为重写本体）
    graph/webui/src/app/codegraph/domainpage.ts(+test)                 —— 删除（§2.5-37）
    graph/webui/src/app/codegraph/DomainCascadeDrawer.tsx(+test)       —— 删除（§2.5-38）
    graph/webui/src/app/codegraph/CallTree.tsx(+test)                  —— 删除（§2.5-38）
    graph/webui/src/app/codegraph/FocusGraph.tsx(+test)                —— 删除（§2.5-38）
    graph/webui/src/app/codegraph/ticket0.passthrough.test.ts          —— 删除（正式断言取代）
    graph/webui/src/app/codegraph/{DetailPanel,DomainPanorama,DomainDetail,BestPanorama,BestScopePanorama,BestOverlays}.tsx(+test)   —— P5-A 时删除
    scripts 或 vitest 内的防漂 className 机械检查                        —— 新增（落点归 plan）

#### ③验收

1. `cd graph/webui && npm run typecheck && npm test` 全绿（预期 ≥21 文件，含新增组件测试）；`cd graph && go build ./... && go test ./... -count=1` 全绿（同刀回归口径，§4.3）。
2. 退役零残留：`rg "deriveDomainPage|DomainCascadeDrawer|CallTree|FocusGraph|passthrough" graph/webui/src` 无匹配；P5-A 时旧视图组件文件已不在库。
3. 装配行为：页面一次 fetchCodegraph 后两轴全部可用；tab/组织/抽屉/下钻切换不增加请求数（fetch mock 计数断言）；views/stale/report 缺失等旧降级分支行为保持（404 未生成代码图文案、错误重试原样回归）。
4. 防漂检查：机械检查命令对新组件全量通过退出码 0；变异（抹掉某交互控件 className）必须转红后恢复。
5. §4.3 变异集汇总复核：复用度阈值、degraded 反转、未知 kind 静默化三条变异在本轮测试套件中各有一支能红（已在 K2/K3 各卡验证，此处汇总跑一遍防相互掩盖）。
6. git diff --check 干净；路径扫描确认未触及 internal/agentd、codegraph/domains/*、扫描器文件（交棒欠账未被越权代做）。

缺陷族对抗审查：

| 族 | K6 结论 |
|---|---|
| 生命周期/状态机中断 | 无孤儿资源：删除均为编译期符号，无运行时残留；切换期间页面 state 迁移（旧 foci/hist 状态作废）在新页面中不保留旧字段，无半旧状态窗口。 |
| 静默失败/误导报错 | 命中并锁定：退役后任何 import 残留都是编译红（TS 保证），不存在静默死代码；旧错误/未扫描分支回归断言保证「删视图」不误伤降级通路。 |
| 跨平台假设 | 命中并标真机：整页在真实宿主 iframe（?project= 单向传参）中的联调未验证——交棒欠账③，真机清单 5；本仓只验相对路径与 same-origin 形状不变。 |
| 假红/假绿测试 | 命中并锁定：rg 零残留是可机检的反面断言；变异集汇总跑防「单卡变异被他卡覆盖掩盖」；删除类改动以全量绿+typecheck 双闸证明无暗引用。 |
| 门禁绕过 | 无，因为不新增执行入口；NOT_SCANNED 跨仓字面量契约（CodegraphPage.tsx:331 注释）保持不动，grep 得到。 |
| 序列化边界 | 命中并有收口回归：client.test.ts 真实 Response JSON 回放覆盖 CodegraphResp 全七键（flows/channel 新键缺席与在场两态），穿 wire→types→模型→组件全链一次（补 K2-K5 各自分段断言的链路缺口）。 |
| 枚举新值过白名单 | 命中：全链词表（FlowStepKind/Channel/kind 八值/DirectionStatus/tab 三值）在收口回归里各有一支「未知值不崩溃」断言；通道分裂（两侧绿中间挡）由该汇总覆盖。 |
| 承重安全属性有测试锁住 | 无安全属性；「无双派生器并存」这一架构属性由第 2 条 rg 断言锁住，变异（恢复 deriveDomainPage 导出）必须使 rg 检查转红。 |

#### ④入口指针

`graph/webui/src/app/codegraph/CodegraphPage.tsx#CodegraphPage`、`useCodegraph.ts#useCodegraph`、`api/client.ts#fetchCodegraph`/#parseResponse、`domainpage.ts#deriveDomainPage`（退役对象）、`BestOverlays.tsx#MigrationSidebar`（被 §2.5-39① 取代）。

## 四、真机清单（未验证，需真机；归协调者执行）

1. 未验证，需真机：真实数据（12 子系统 / 37 顶层边 / 22 个超 40 符号容器）下结构轴画布的布局质量——空白最少、交叉最少、箭头方向感——对照 `prototypes/base/README.md` 形态基准逐屏走查；jsdom 无法证明视觉判据。
2. 未验证，需真机：流程图蛇形折列在真实浏览器宽度变化与拖动分隔条时的重排、列间走廊连线视觉连续性；DPR/缩放差异。
3. 未验证，需真机：右栏拖宽持久化在隐私模式/清 storage 后的降级行为；键盘导航与读屏下三 tab、组织切换控件分离的 a11y 实效。
4. 未验证，需真机：真实大图（4000+ 边）下两缝派生器的页面内耗时与交互流畅度；机内小世界夹具不能外推性能。
5. 未验证，需真机：handoff 宿主 iframe 内 `?project=` 单向传参联调 + 宿主 best.json 双写文本差异复核（contract §1 已标未验证的两处外部读数）——交棒欠账③。
6. 未验证，需真机：flows 真数据（roadmap 27/32）到达后，K3 归属三态/散度/族分组在真实 162 入口分布上复现 spec 的现状读数（75% 单值等）；夹具只证明判据机械正确，不证明真实数据形态。

## 五、交棒欠账与图覆盖

- charter 根无项目图（台账 fresh 复核）；Ticket 0 新符号与本轮新符号均无项目图可入视图 diff——合法无视图，不伪造 `codegraph/diffs/<分支>.json`。
- handoff 侧三项交棒欠账照 contract §6.2-1 原样移交：① responsibility 正文搬运 decl 文件；② 扫描配方自洽修复；③ 宿主传参与双写差异复核。本仓六张子卡均不代做。
- 扫描器实现、flows 真数据、kind 校验器扩展、stateMachine 互证闸开启 = roadmap 27/32，本轮显式不做。
- K6 第 6 条以路径扫描证明上述边界未被越权。

## 六、出稿自检

1. 四样齐全：§一 子系统清单三条均带类型 + 资格四条逐条核；§二 40 条冻结断言逐条结论 + 三条澄清回写契约 §8；§三 六张子卡全部四段式且判据行为化（命令+期望输出）；缺陷族八问×六卡逐族作答，「无」均带「因为」。✅
2. 待拍板岔口 P1～P5 集中列于稿首，正文无散落未标岔口；P4/P5 附推荐案与理由，未自批。✅
3. 「未验证，需真机」条目汇总于 §四（6 条）。✅
4. 六张子卡有界文件集逐一圈出；无硬塞——第三条升格信号已显式回答（Best* 家族退役消散 + 新前缀 ≥5 触发竖切条款），无需还债卡。✅
5. 未亲自跑到结果的结论为零：全部现状读数来自本节点 grep/read 实跑（台账留痕），契约绿证据另有本节点亲跑基线绿一组。✅
