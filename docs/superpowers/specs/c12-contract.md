# C12 契约增量：代码图查看器两轴重设计的 wire 契约与两条派生器缝

> **状态：已冻结（随本提交，2026-08-26）**
> 上游：`docs/specs/2026-08-25-codegraph-viewer-two-axis-spec.md`（已批准 2026-08-26，用户）+
> `docs/specs/2026-08-25-codegraph-scan-schema-draft.md`（随 spec 定稿）。
> 卡：C12；级别 L3 · 重档；跨三方：扫描侧（handoff 仓）↔ graph 库（charter `graph/codegraph`）↔ 查看器（charter `graph/webui`）。
> 架构形态：`graph/webui` 维持「纯函数派生层 + React 组件薄壳」两层，不新造分层；`graph/codegraph` 库维持「数据契约模型 + 算法、不产出数据、不做网络」。

## 1. 现状锚与基线差异

本文件只把能在当前工作树查到的签名写成代码事实；外部 checkout 与更新版本手仓的读数单独标注「未验证」。

| 现状符号 | 当前签名/形状 | 现状出处 |
|---|---|---|
| `CodegraphResp` | `baseline/views/stale` 必有 + `best/target/report/decls` 可选，七键 | `graph/webui/src/api/types.ts#CodegraphResp`（96 行文件 :87） |
| `CgDomainDecl.stateMachine` | `stateMachine?: CgTransition[]` 格位已在，全项目 0 条数据 | `graph/webui/src/api/types.ts#CgDomainDecl`（:17-20）、Go `graph/codegraph/decl.go#DomainDecl` |
| `Transition.Anchor` | `Anchor string json:"anchor,omitempty"` 已在 | `graph/codegraph/decl.go#Transition`（:41-46）；格式校验在 `graph/codegraph/decls.go`（:106 引用 `"stateMachine[%d].anchor"`） |
| `ValidateDecls` | `func ValidateDecls(v *View, best *Best, repoRoot string, decls map[string]DomainDecl) []string` | `graph/codegraph/decls.go#ValidateDecls`（:65，C1.10 条 24 已落地）；调用方 `graph/cli/cli.go`（:154） |
| 容器只挂叶子领域 | **已执法**：`hasChild[domainID]` → issue「容器 %s 挂在非叶子领域 %s」 | `graph/codegraph/best.go#ValidateBest`（:127-135），C1.8 dc567ce（2026-08-24）落地；cli.go :139/:260 调用 ValidateBest |
| `BestDomain.Responsibility` | `Responsibility string json:"responsibility"`，**无 omitempty**；ValidateBest 要求非空（:92-94）；`best_test.go:55-57` 钉空值也须出现的序列化 | `graph/codegraph/best.go#BestDomain`（:35）——删字段必然动 wire 形状与该测试，同刀规则由此而来 |
| responsibility 的 viewer 消费点 | 组件三处：`BestScopePanorama.tsx:207`、`BestDetail.tsx:125`、`BestDomainPage.tsx:40`；模型透传六处：`besttree.ts:11,:20,:83,:177,:201,:576` | schema 草案 §8.1 只列了前三处，**本契约把 besttree 六处补进同刀清单** |
| `deriveDomainPage` | `function deriveDomainPage(input: DomainPageInput): DomainPageModel`，注释自陈「C1.10 主缝」 | `graph/webui/src/app/codegraph/domainpage.ts#deriveDomainPage`（:270）；坏取法实际在 :281 `inboundEdges.slice(0, DOMAIN_FOCUS_QUOTA)`、常量 :17（spec 写 :283/:16 为行漂移，语义不变） |
| a11y 缺陷 | 一个 `role="tablist"` 混排语义/结构 tab 与组织切换按钮 | `graph/webui/src/app/codegraph/BestDomainPage.tsx`（:172-177） |
| 四档债务色词表 | `DirectionStatus = 'declared'|'over-budget'|'dead-contract'|'new-direction'` | `graph/webui/src/app/codegraph/besttree.ts#DirectionStatus`（:27） |
| viewer 取数 | `fetchCodegraph(project): Promise<CodegraphResp>`；request 无超时/重试；响应直接 `as T` 无运行时校验 | `graph/webui/src/api/client.ts`（:57-59、:43-53、:38） |

外部 checkout `/root/.handoff/repos/handoff`（HEAD 7adeb8f9，只读）核对：

- `codegraph/baseline.json` 顶层键 `{containers, domains, edges, implements, meta, nodes, projections}`——无 flows/packages/lifecycle，新增段确为增量。
- container kind 词表八值逐一核实与草案 §8.4 一致（`类型方法 100 · 函数组 44 · 实体 41 · TypeScript 模型 23 · React 组件/函数 21 · 入口 3 · TypeScript 函数组 4 · TypeScript 实体 1`）；entry 节点 118 个 channel 全缺。
- 该 checkout **无 `codegraph/best.json`**、**无 `web/src/app/codegraph/CodegraphFrame.tsx`**：spec 引用的宿主单向传参（CodegraphFrame.tsx:19）与 best/decl 双写文本差异两处读数为更新版本的手仓状态，**未验证**（handoff 侧交棒时以彼处 HEAD 复核）。
- `prototypes/codegraph-two-axis/` 不在本工作树也不在 git：`prototypes/.gitignore` 只放行 `base/`，基准站 README 已记明走查副本不入库、确认基准落在 `prototypes/base/README.md`——既定策略，非缺口。

存量无图判定（沿用 c1.10-contract §1 同一事实）：仓库根无 `codegraph/` 项目图，仅 `graph/codegraph/testdata/repo/` 测试夹具。**本契约文档即冻结物**；跳过项目图 target.json 与分支视图 diff，Ticket 0 新符号无图可入。

## 2. 冻结清单

每条编号都是独立可判 pass/fail 的断言。wire 三份：`codegraph/baseline.json` + `codegraph/best.json` + `codegraph/domains/*.json`，扫描侧/graph 库/webui 三方共用。

### 2.1 baseline 新增段（additive-only）

1. `baseline.json` 新增可选顶层键 `flows`，形状 `Record<承重函数id, { steps: FlowStep[] }>`；不删除、不改名任何既有顶层键。
2. `FlowStep` 字段集钉死：`id`(必有)、`order`(必有)、`kind`(必有)、`to`(`call` 必填)、`cond`(`branch`/`loop` 必填)、`line`(必有)、`then`/`else`/`body`(分支/循环必填)、`iface`(可选 bool)。TS 镜像为 `CgFlowStep`（types.ts 本轮已落）。
3. 步骤 `kind` 受控词表 `call|branch|loop|return`，四值之外非法；Go 常量 `FlowStepCall/Branch/Loop/Return` 本轮已落（types.go）。
4. `iface: true` 表示 `to` 是接口方法、该调用点是动态分派；实现清单从既有 `implements` 段 join（现状出处 types.go :111 `[实现, 接口]` 边列），**禁止在 flows 里复制实现清单**。
5. `flows` 只覆盖承重函数（跨域入缝符号、入口 handler、编排单元），不要求全节点覆盖；承重范围裁定归 roadmap 27/32。
6. entry 节点新增可选字段 `channel`，受控词表 `cli|http|ws|web`（Go 常量 `ChannelCLI/HTTP/WS/Web`、TS 镜像 `CgEntryChannel`，本轮已落）；入口清单按 channel 分组，禁止靠 id 前缀或名字形状猜。
7. 三个新键缺席时旧消费方行为不变（依据见 §3.1/§3.2）；查看器对新键缺席按**降级形态**处理，不得当传输失败。

### 2.2 best 与 decl 的职责正文归属（走甲裁决落地）

8. `best.json` 的 `domains[]` **移除** `responsibility` 字段；Go `BestDomain.Responsibility`（best.go :35）、其 ValidateBest 非空检查（:92-94）、`best_test.go:55-57` 序列化钉值、TS `CgBestDomain.responsibility` 四者**同一提交**删除，不留中间态。
9. 职责正文的唯一所有者是 `codegraph/domains/<id>.json` 的 `DomainDecl.responsibility`；`best` 从此只留结构（id/label/parent/type）。
10. viewer 读数点统一改读 `decls`：组件三处（§1 表）+ `besttree.ts` 六处透传，与第 8 条**同一提交**。
11. 领域无声明文件时界面显示「未声明」并给出写入路径 `codegraph/domains/<最优领域id>.json`；**禁止回退到任何兜底文本**（不得到 best 树上找补）。
12. 迁移不丢字：现存 best 内 responsibility 正文逐条搬进对应 decl 文件作初稿；两处都有的以 decl 为准、best 那段作废。数据在 handoff 仓，动作交棒（§6.2-1）。
13. 「容器只挂叶子领域」不变式保持由 `ValidateBest` 执法（best.go :127-135 现状即满足草案 §8.2 的裁决意图）；不得删除或弱化该检查。
14. 容器 `kind` 钉死受控词表八值：`类型方法|函数组|实体|TypeScript 模型|React 组件/函数|入口|TypeScript 函数组|TypeScript 实体`；「兜底桶」≡ `{函数组, TypeScript 函数组}` 两值，判据引用兜底桶时以词表为准不以字符串前缀为准。
15. 未知容器 kind 必须显式报错、不得静默降级；该校验随扫描侧新基线同批开启（roadmap 27/32），开启前现有八值数据全在词表内（§1 外部核对）。
16. `stateMachine[].anchor` 约定冻结：值为 `file#Symbol` 符号锚，指向写这次迁移的符号；互证闸（每条迁移边的 anchor 出现在该域某条 flow 的 call 步骤 ∧ 该符号是对应实体的 lifecycle writer，三处对不上即不符）随 flows 数据齐备后开启。格位本轮已在（decl.go Transition.Anchor、decls.go :106、types.ts CgTransition.anchor），**本轮零代码改动**。

### 2.3 缝 1：结构轴视图模型派生器

17. 模块路径 `graph/webui/src/app/codegraph/scopepage.ts`；导出面仅供 codegraph 应用模块内组件层消费，不导出到应用外。
18. 缝地址冻结：`function deriveScopePage(input: ScopePageInput): ScopePageModel`（Ticket 0 壳已落码）；内部模型形状归 plan 细化，模块路径与入口函数名不可变。
19. `ScopePageInput` 字段钉死：`baseline`、`best?`、`decls?`、`target?`、`organization: 'best'|'current'`、`scopeId: string|null`；`scopeId === null` 即根层子系统连线图。
20. 递归同构：每一层（根/领域/叶子领域的容器层）返回同一形状模型；层数不定，到容器为止；容器是原子节点，双击容器无动作、界面说明它没有下一层。
21. 组织切换（按最优树/按现状领域）是结构轴内部正交维度：控件不得与其它控件组混排同一个 `tablist`（机械消解 BestDomainPage.tsx :172 缺陷）。
22. 四类债读数全部由现有数据算出并经缝 1 输出断言覆盖：兜底桶占比（跨域入边中落兜底桶容器的比例）、复用度（入缝符号可被多少程序入口可达）、真假共享内核（高复用落实体/类型方法=真、落兜底桶=假）、触达域散度（入口族触达领域数）。
23. 噪声折叠判据替换 `slice(0, DOMAIN_FOCUS_QUOTA)` 坏取法：跨域入缝符号落在兜底桶容器 **且** 复用度 ≥ 10 → 折叠为可展开块、不占名额；阈值常量只存在于派生器模块，不进 URL/localStorage/env/用户配置。
24. 大容器如实报：超 40 符号的容器正面显示符号数、文件数、「无声明职责」并标债务色；视图层不做折叠圆场（永不做项，spec Out of Scope 9）。
25. 空态显式：无声明、无实体、无入缝各自文案指明缺什么与去哪补；数据缺失的格位不得渲染成看似完整的假读数。
26. 容器职责唯一合法推导 = 同名类型节点的 doc 注释且**按包匹配**（全局取首个同名会张冠李戴）；「函数组」「实体」容器显示「无职责主体」，不硬凑。
27. 孤立子系统如实呈现：Web 控制台等因禁建跨语言调用边而孤立的子系统旁标注原因；`projections` twin/typed 画第二类边并明确标注「不是调用边」（现状出处 types.go #Projection 注释、types.ts :24）。

### 2.4 缝 2：行为轴视图模型派生器

28. 模块路径 `graph/webui/src/app/codegraph/flowpage.ts`；导出面同缝 1。
29. 缝地址冻结：`function deriveFlowPage(input: FlowPageInput): FlowPageModel`（Ticket 0 壳已落码）；内部形状归 plan。
30. `FlowPageInput` 字段钉死：`baseline`、`entryNodeId`；一条程序入口一张流程图。
31. `baseline.flows` 缺该入口时输出必须带显式降级标记（Ticket 0 壳已钉 `degraded: boolean`，双向断言见 ticket0.passthrough.test.ts）；禁止拿机械可达序列冒充流程图——该序列改放右栏「调用链（给 agent）」tab 并如实标注无次序无分支。
32. 入口归属判据：从入口出发第一次遇到的跨域调用目标所在子系统（排除兜底桶噪声）；输出单值 / 多值（显示全部候选并标注）/ 判不出（标「无行为」，如 Cobra 分组命令）三态。
33. 入口注册散度：子系统的入口分布文件数；集中在 1 个文件且入口数 > 3 判「集中注册」标红。
34. 入口族分组从入口节点名算出（CLI 命令族 / HTTP 资源族），**不依赖**入口容器按服务领域拆分（Out of Scope 2 未做）。
35. 流程图形态断言：矩形=一次调用（左色条=所属领域）、菱形=分支、卫语句甩一侧不占主干、装不下折列且列间画蛇形连线（禁止文字标签代替线）、紫框 ▸=下层入口可递归下钻、双线框=接口调用且右栏列出全部实现、每个实现的入口即其流程图起点。
36. 术语三分不得混用：**程序入口**（CLI/HTTP/WS 外部入口，右栏基本信息 tab 底部，点它进流程图）、**对外入缝**（跨层边界被调进来的符号=契约面，「对外面」tab）、**泳道**（流程图的一条，一条程序入口一条泳道，只在流程图页）；「对外面」tab 内必须有一句显式区分两者。

### 2.5 退役与退场

37. `domainpage.ts` 的 `deriveDomainPage` 随重设计退役；其仍然成立的跨域端口聚合并入缝 1；退役与其消费组件改造**同一提交**，不得留下双派生器并存中间态。
38. 面向人的调用链视图退场：`DomainCascadeDrawer`、`CallTree`、`FocusGraph` 从界面移除，焦点链不保留（永不做项）；调用链能力保留在 CLI 与 agent 取数路径。
39. C1.9 四条点状修并入：迁移清单从常驻左栏改为按需抽屉带计数徽标、四档债务色板图例（词表现状出处 §1 DirectionStatus）、读数按层分档三态配色、嵌套层补虚线 frame。
40. 防漂判据：新增交互控件必须有非空 className（机械检查）；禁止断言具体 class 值的原有纪律不变。

## 3. 依赖库既成行为查证

1. Go `encoding/json` 默认忽略未知键（仅在显式 `Decoder.DisallowUnknownFields` 时报错）：`flows`/`channel` 对旧 Go 消费方是安全增量；`LoadBest`/`LoadDomainDecls` 均未启用 DisallowUnknownFields（c1.10-contract §3 同一结论，本轮复核未变）。
2. `LoadBest` 文件不存在返回 `(nil, nil)`（best.go :57-61）：best 半径的改动只影响有 best.json 的项目，存量项目零感知。
3. `BestDomain.Responsibility` 无 omitempty 且测试钉了空值序列化（best.go :35、best_test.go :55-57）：删它必然改变 wire 字节形状——这是第 8 条强制同刀的技术依据，不是流程洁癖。
4. viewer `request` 用 `fetch(path, { credentials: 'same-origin' })`，不加超时/重试/轮询（client.ts :43-53）；`parseResponse` 成功后直接 `as T` 无运行时 schema 校验（:26-41）：新可选键由 TS 可选类型表达缺席，运行时零校验是既有设计，第 7 条的降级语义建立在其上。
5. `json.Unmarshal` 到 `map[string]Flow`：键集开放、值缺 `steps` 时得零值切片——扫描侧产出前的降级形态消费不会 panic。
6. vitest/tsc 工具链：`npm test` = `vitest run`、typecheck = `tsc -b`（webui package.json scripts）；Ticket 0 与直通的绿证据见 §4.2。

## 4. 可执行冻结与测试落点

### 4.1 Ticket 0 已落码（骨架提交 946ab79）

- `graph/codegraph/types.go`：`FlowStep`/`Flow` 类型、`Graph.Flows`、`Node.Channel`、两组受控词表常量。纯声明零行为（校验行为随数据齐备开启，见 §2.1-15、§2.2-16 的时机注记）。
- `graph/webui/src/api/types.ts`：`CgFlowStepKind`/`CgFlowStep`/`CgFlow`/`CgEntryChannel` 类型镜像、`CgGraph.flows?`、`CgNode.channel?`。
- 缝壳：`scopepage.ts#deriveScopePage`、`flowpage.ts#deriveFlowPage`（含 `degraded` 判定位）。模块路径与入口函数名即 §2.3/§2.4 冻结的缝地址。
- charter 仓无项目图，不创建 `codegraph/diffs/<分支>.json`（合法无视图）。

### 4.2 直通竖切（重档法定步骤，已执行）

- 测试：`graph/webui/src/app/codegraph/ticket0.passthrough.test.ts`——缝 1 一次真实调用（根 scope 接线回声）+ 缝 2 两次真实调用（flows 缺席→degraded=true、命中→false）。
- 「一次真实调用」取义：spec 主缝是两条平行派生器缝，无嵌套关系，单次调用无法同时穿过两者；故按每缝一次落在一支测试文件，钉在 spec 测试决定声明的主缝上，不为直通新造对外面。
- 本轮证据：`cd graph && go build ./... && go vet ./codegraph/` → GO_BUILD_OK/VET_OK（退出码 0）；`cd graph/webui && npm test` → **Test Files 21 passed (21)，Tests 136 passed (136)**（基线 20/133 + 新增 1 文件 3 支）；`npm run typecheck` → 退出码 0。
- plan 落地派生行为后，passthrough 标记与本测试文件由各缝正式断言取代。

### 4.3 implement 必须新增的测试（最低集）

- 缝 1：四层各自模型形状、兜底桶占比与复用度读数、折叠判据命中/不命中、大容器如实报字段、三类空态、组织切换可用性（best 缺席时不可用）。
- 缝 2：入口归属三态、注册散度判红、入口族分组、触达域散度、递归下层域入口解析、flows 缺席/命中降级双向。
- 变异：把复用度阈值 10 改 9 必须转红；把 degraded 反转必须转红；把「未知 kind 显式报错」改成静默跳过必须转红（校验器开启后）。
- 同刀回归：responsibility 删除提交必须全量 webui 测试 + `go test ./...` 全绿（best_test.go 序列化钉值同步改写）。

## 5. 拍板记录（三重闸门命中）

**职责正文唯一所有权归 decl 文件，best 删字段（走甲）。**难逆转：动的是三方共用的 best wire 形状 + Go 库类型/校验/序列化测试 + viewer 三组件六透传，回头要同时触及三个子系统。无上下文会惊讶：后人看到 best 领域没有职责字段、界面上 21 个域「未声明」，第一反应会是「把字段补回去圆场」。真取舍：乙方案（保留但降级为定位句+声明优先）被否——那等于把双写漂移合法化。被否方案与「不做」：不做兜底文本回退，不做过渡双轨。

**接口调用点展示接口本身，实现清单从 implements join、不在 flows 复制。**难逆转：flows step 的 `iface` 字段形状是三方 wire，复制实现清单一旦发生就成了第二个必烂的数据源，清理要动扫描侧与查看器两侧。无上下文会惊讶：后人会觉得「右栏反正要实现清单，step 里顺手带上多方便」。真取舍：用 CHA 解析出具体实现集再画图的方案被否（schema §7 第 1 项据此收窄）——图上替运行期猜实现是把动态事实伪装成静态事实。

**不给 best 加节点级入口映射。**难逆转：一旦加了，每个归属消费方都要处理容器级+节点级两条粒度路径，撤除要横扫全部消费方。无上下文会惊讶：122/162 入口的逻辑归属明明是错的，后人看到会想「加个映射修正一下」。真取舍：节点级映射方案被否，修复归扫描配方自洽（删配方内互相打架的第二条规则），代码零改动。

**噪声折叠判据（兜底桶 ∧ 复用度≥10）替换 slice(0,5) 入缝取法。**难逆转：判据 key 在容器 kind 词表与复用度计算上，与真假共享内核、兜底桶占比三处同源，改动牵动三条债读数。无上下文会惊讶：界面上被折叠的 writeJSON/isForwarded 看着像性能优化，后人可能当 bug「修」掉。真取舍：「按调用量排序取前五」「保持 slice(0,5) 加排序」均被否——它们保不住真契约入口（Store.GetTask 等）进名额。

## 6. 目标图、视图与交棒欠账

### 6.1 目标图与 Ticket 0 视图

存量无图项目（fresh 证据见 §1 与台账）：契约增量文档即冻结物，随本提交冻结。目标图更新：**跳过**。Ticket 0 新符号无项目图可入视图 diff：**合法无视图**。

### 6.2 交棒欠账（逐条显式认账）

1. handoff 仓动作三项，不在本仓工作树：① best 内现存 responsibility 正文逐条搬运进 decl 文件（§2.2-12）；② 扫描配方自相矛盾修复（入口挂服务域 vs 入口分三容器，草案 §8.3/§5.1，配方文件在 handoff `docs/codegraph-scan-recipe.md`）；③ 宿主 CodegraphFrame 单向传参核验与 best.json 双写文本差异复核（本侧 checkout 版本落后，未验证）。
2. 扫描器实现与 flows 真数据、kind 校验器扩展、stateMachine 互证闸开启：roadmap 27/32 后续卡，本轮显式不做（Out of Scope 1）。
3. 缝 1/缝 2 的内部模型形状与富化签名：归 plan（spec 明文「签名归 plan 落地」）；本契约只冻缝地址与输入字段。
4. Ticket 0 壳中 `deriveScopePage` 仅接线回声、`deriveFlowPage` 仅 degraded 判定：后者已有能变红的双向测试锁住（ticket0.passthrough.test.ts），前者无可观测行为，不存在「已实现但零测试」欠账。

### 6.3 金样本与无命中项

- 哈希、密钥派生、编码格式：**无命中**——本卡 wire 是 JSON 结构契约，无字节级金样本向量；一致性由 §4.3 的结构与变异测试锁定。
- 三重闸门之外需要留痕的流程顺序裁决：**无命中**（直通竖切的「一次调用」取义属过程记录，在 §4.2 与台账）。

## 7. 移交 plan 附区（非冻结条目，plan 出稿时吸收）

- 布局算法选型（贪心排序/货架装箱目标长宽比/相邻交换轮数、SCC 缩点实现、缩放居中）是实现策略，spec 已给判据（空白最少、交叉最少），具体做法归 plan。
- 右栏宽度拖动持久化的存储键名、抽屉动画细节、蛇形连线的 SVG 路径算法：实现选择。
- `scopepage.ts` 吸收 `domainpage.ts` 端口聚合时的私有辅助函数处置（edgeContexts/callerDomainsByNode 等去留）：单包实现选择。
- 本区条目目前 3 条，远小于冻结清单本体，无倾倒场信号。

## 8. 修订记录

- 2026-08-26：初版冻结。纠正三处上游陈述：①草案 §8.2「容器挂叶子没人写过没查过」相对 HEAD 过时（best.go :127-135 已执法）；②responsibility 消费点补齐 besttree 六处；③spec 引用的 domainpage 行号漂移（:283/:16 → 实际 :281/:17）。
- 2026-08-26（breakdown 节点核对，冻结条目文字不改）：第 8 条同刀清单补遗——删 `BestDomain.Responsibility` 编译强制另触及 `context.go#contextVocabulary`（:370 Summary 取该字段）与 `migrate.go`（迁移写入占位符 + migrationNotes 提示行）及 `check_test.go`/`gap_test.go`/`context_test.go` 带字段字面量，随同一提交处置；channel 分组对存量全缺数据的「通道未标注」降级桶是第 7 条降级语义的应用实例；scopepage/flowpage 导出面属 webui 应用包内部 API，不属宿主契约面。详见 c12-breakdown.md §二【释 1-3】。
