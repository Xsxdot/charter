# C17 拆解提案：行为轴泳道主语改为对外契约方法

> 状态：**已拍板（2026-08-28，协调者）**
> 上游 spec：`docs/specs/2026-08-27-flow-subject-is-contract-spec.md`（**已批准，2026-08-28**）
> 上游 contract：`docs/superpowers/specs/c17-contract.md`（**已冻结，2026-08-28，commit cb830c12**）
> 台账：`docs/ledgers/2026-08-27-c17-spec-ledger.md`
> 定级：L3 · 轻档；本节点只出拆解稿，**不实现、不建子卡、不派卡**。
> 仓界：charter；`handoff` 扫描配方是交棒欠账，本轮 charter 实现不改其正文。

## 待拍板清单

**无待拍板。** spec 第四稿已批准，contract 已冻结，且用户已指定 L3 轻档不扇出；本稿只把冻结语义映射到有界实现轮范围。`graph/webui` 纳入 charter 侧是对 contract §1.2 旧读数的边界澄清，不是新的语义选择，已回写 contract §6 修订记录。

**拍板（2026-08-28，协调者）**：采纳本稿。不扇出子卡；单轮实现按第五节 S1+S2 有界文件集走 plan→implement；S3 扫描配方保持交棒欠账，不在 charter 实现轮改 handoff 配方。真机清单归 acceptance。无岔口需改契约。

## 一、触及子系统清单与资格核对

charter 仓根没有项目级 `codegraph/best.json`；已亲跑的存在性核对为 `PROJECT_BEST_ABSENT`、`PROJECT_TARGET_ABSENT`。因此不能从项目最优图的 `domains` 顶层领域派生子系统 id，也不能把 `graph/codegraph/testdata/repo/codegraph/best.json` 当项目图。本节按 C17 contract 的三方接缝交棒列出人工降档清单。

| id | 子系统 | 类型 | 本轮职责 | 有界文件集 | 契约面 | 同级依赖 | 资格结论 |
|---|---|---|---|---|---|---|---|
| S1 | `graph/codegraph`（含 `graph/cli`） | **逻辑型**：Go 库与 CLI 的调用边/JSON 行为有本地测试闭环 | `flow` 查询、`tree` 查询、符号决议/错误通道、summary 菜单；不改扫描器 | `graph/codegraph/{flow.go,flow_test.go,tree.go,tree_test.go}`；`graph/cli/{cli.go,cli_test.go}` | contract §2.4～§2.6 的 Go/API/CLI JSON 与错误契约 | `S3 → S1`；S1 的冻结 JSON 被 S2 消费；无回边 | ①文件可按上述路径圈定；②函数/类型/CLI 命令可枚举；③DAG 无环；④类型明确为逻辑型。具备四条，但 L3 轻档不按此派卡 |
| S2 | `graph/webui` 查看器 | **边界型**：纯函数/DOM 可在 Vitest 闭环，浏览器、人和宿主行为仍属外部现实 | `deriveFlowPage` 主语模型、结构轴入缝入口、流程形态、实现/通道/caller、页内导航与装配 | `graph/webui/src/api/types.ts`；`src/app/codegraph/{flowpage.ts,flowpage.test.ts,FlowChart.tsx,FlowChart.test.tsx,flowlayout.ts,flowlayout.test.ts,FlowPageView.tsx,FlowPageView.test.tsx,RightPanel.tsx,RightPanel.test.tsx,TwoAxisPage.tsx,TwoAxisPage.test.tsx,CodegraphPage.tsx,CodegraphPage.test.tsx,CodegraphPage.wire.test.tsx}` | contract §2.1～§2.3、§2.7 的 viewer 模型与 DOM/导航行为；`flowpage.ts` 导出仍限应用包内 | `S1 → S2`；另受 `S3 → S2` 的 baseline wire 数据影响；无回边 | ①文件集可圈定；②`deriveFlowPage`/组件 props/DOM data-* 面可枚举；③依赖只消费 S1 契约，不回调用实现；④边界型。具备四条，但 L3 轻档不按此派卡 |
| S3 | `handoff` 扫描配方 | **边界型**：对面是扫描运行时与外部仓库现实 | 交棒：承重 `flows` 键集合、卫语句 `branch.then/else` 引用与 sequential root 约束；本仓不改配方正文 | 本仓没有 handoff 配方正文可圈定；仅以 contract §5.2-1 和本 spec「交棒欠账」指向协调者/hand-off owner | contract §2.1-1～§2.1-11 的扫描产物语义 | `S3 → S1`、`S3 → S2` | ①charter 侧无可界定文件集，故不具备本仓派卡资格；②契约条目可枚举；③数据供给 DAG 无环；④边界型。按交棒处理，不建 charter 子卡 |

### 架构法附加核对

- **第一条身份**：S1 以 Go/API/CLI 契约对外，独立测试且有 CLI、agent、S2 等消费者；S2 以 viewer 内部模型/DOM 行为对外，浏览器与人是消费者；S3 的配方接缝面对扫描运行时/外部仓库。三者是本卡所需的跨子系统接缝，而不是把 `controller/service` 或单个工具目录误升格。
- **派卡资格四条逐个核**：S1、S2 的文件边界、契约清单、DAG、类型均明确；S3 在当前 charter 仓没有文件集，不能派 charter 子卡。即使资格成立，用户已钉死 L3 轻档，故本节点不扇出。
- **竖切债务**：S1 和 S2 的本轮文件集均能圈出；没有出现“圈不出文件集”的信号，不插竖切还债卡。S2 的纯派生函数与 React 壳沿 C12 既有两层，不新增横向层。
- **组装点/透传**：`CodegraphPage.tsx#CodegraphPage` 是 viewer 轴间组装点；`RightPanel.tsx#RightPanel`、`FlowPageView.tsx#FlowPageView` 只消费模型并回调导航。Go CLI 经 `graphLoadView` 装配 View/Graph；不新增第二套 `chain` 或 flows 解析口径。

## 二、契约增量核对

上游状态位已从文件头核对：spec 明示「已批准（2026-08-28）」；contract 明示「已冻结（2026-08-28）」，冻结提交为 `cb830c12d13a777b5272062e0fdfab6bf8fd4e06d3`。以下逐条核对本轮是否越界；“实现轮”是后续单轮实现的归属，不表示本节点已经实现。

| 冻结条 | 本轮归属与边界结论 |
|---:|---|
| §2.1-1 | 【S2 + S3】泳道主语改为方法；扫描键集合由 S3 交棒维护；不新增 `flows` 顶层键。 |
| §2.1-2 | 【S1 + S2】继续消费 C12 `FlowStep` 字段；只做字段透传/投影，不改 wire。 |
| §2.1-3 | 【S1 + S2】沿用 `call|branch|loop|return`；未知值显式降级，不新增 kind。 |
| §2.1-4 | 【S1 + S2】实现清单只从 `implements` join；flows 内伪造实现数组必须被忽略。 |
| §2.1-5 | 【S3 交棒 + S2】入口 handler 不再因 `kind=entry` 入承重集合；viewer 只按冻结集合消费，不替扫描侧补数据。 |
| §2.1-6 | 【S1 + S2】`channel` 继续使用 C12 词表；未知/缺席以显式未标注降级，不扩词表。 |
| §2.1-7 | 【S1 + S2】缺键/缺段是成功降级；错误节点仍走 error，不能用空成功掩盖未命中。 |
| §2.1-8 | 【保】`baseline.flows` 仍为 `Record<string, { steps: FlowStep[] }>`，不复制/改名顶层键。 |
| §2.1-9 | 【S1 + S2】消费四种步骤和相应子步骤列；不由边遍历重建流程顺序。 |
| §2.1-10 | 【S3 交棒 + S2】卫语句 return 必须被 branch 子列引用，不成为未引用 sequential root；查看器验收只接受冻结形状。 |
| §2.1-11 | 【S1 + S2】`iface` 只表达动态分派；实现清单不复制进 flows。 |
| §2.2-12 | 【S2】缝地址保持 `graph/webui/src/app/codegraph/flowpage.ts#deriveFlowPage`；导出仅应用模块内消费。 |
| §2.2-13 | 【S2】`FlowPageInput` 两字段保持；`entryNodeId` 只作历史字段名，语义改为当前泳道主语 id。 |
| §2.2-14 | 【S2】模型字段改为冻结的 `subject/degraded/missing/steps/callers/implementations/channels` 与 `FlowNodeRef`；不把 `openable` 当成 baseline kind。 |
| §2.2-15 | 【S2】subject、步骤、通道、实现、直接 caller 由一个派生模型输出；通道不生成并列主图。 |
| §2.2-16 | 【S2】无 flows 或空段必须 `degraded=true`、`steps=[]`、`missing` 非空；禁止用 chain 补图。 |
| §2.2-17 | 【S2】命中 flows 时 `degraded=false`，步骤树按 wire 透传；不从边重建。 |
| §2.2-18 | 【S1 + S2】channels 只取活跃反向可达 `kind=entry`；文案统一为到达通道。 |
| §2.2-19 | 【S2】通道 `openable=false`，点击只高亮，不换图、不压栈；结构轴入口列表同样只读。 |
| §2.2-20 | 【S1 + S2】接口当前主语/接口调用步骤的实现来自 `implements`，每个实现方法直接作为下张图主语。 |
| §2.2-21 | 【S1 + S2】caller 只取直接活跃调用方，与 `who-calls --depth 1` 同口径；UI 不展开 depth>1。 |
| §2.2-22 | 【S2】caller 中 entry 只高亮；非 entry 仅在有 flows 时可打开，无 flows 保留名称并显式无图。 |
| §2.2-23 | 【S2】“对外面”区分入缝与到达通道；程序入口列表不再成为打开流程图的按钮。 |
| §2.2-24 | 【S2】入口归属/注册散度/入口族不再是行为轴必有段；若保留，只能作为通道注释，不套方法名。 |
| §2.3-25 | 【S2】call/branch/loop/return 的图形映射保留，branch 必为可识别菱形，不用圆角矩形冒充。 |
| §2.3-26 | 【S2 + S3】卫语句侧甩，不进入快乐路径 `linear`；扫描侧引用约束仍由 S3 交棒。 |
| §2.3-27 | 【S2】折列用真实 SVG path 连线；不以文字标签替代连线。 |
| §2.3-28 | 【S2】接口调用双线框，右栏实现方法可打开；不再寻找实现容器内 CLI/HTTP 入口。 |
| §2.3-29 | 【S2】紫框唯一依据为 `call.to` 命中承重主语集合；entry 通道永不成为紫框目标。 |
| §2.3-30 | 【S2】使用页内栈；首层来源是原 scope 的结构轴，不依赖 iframe/浏览器后退。 |
| §2.3-31 | 【S2】紫框/实现/caller 的可开项均压栈；主语重复时仍允许再次压栈，不做隐式去重。 |
| §2.3-32 | 【S2】只有一颗“上一层”；栈底回原 scope 结构轴并保留 scope。 |
| §2.3-33 | 【S2】面包屑可点祖先并截断后续栈项；显示真实来路。 |
| §2.3-34 | 【S2】不增加第二颗“跳过整栈回结构轴”按钮。 |
| §2.4-35 | 【S1】保持 `LookupFlow(v,g,repoRoot,query,id)` 可编译入口；id 由 CLI 先决议，query 原样保留。 |
| §2.4-36 | 【S1】`FlowRef` 字段与 JSON tag 按冻结形状；不另造定位协议。 |
| §2.4-37 | 【S1】`FlowLookupResult` 字段与 JSON tag 按冻结形状；数组空值必须是 `[]`。 |
| §2.4-38 | 【S1】subject 复用既有 `SymMatch` wire；不新造定位字段。 |
| §2.4-39 | 【S1】空 View、删除节点、未找到活跃 id 走 error，不降级成成功结果。 |
| §2.4-40 | 【S1】有非空 flows 返回非 degraded 步骤，邻域三段照常输出。 |
| §2.4-41 | 【S1】缺 flows 成功降级，steps 为空且 missing 可行动；不返回 chain 步骤。 |
| §2.4-42 | 【S1】callers/implementations/channels 分别按直接边、implements join、活跃 entry 反向可达计算。 |
| §2.4-43 | 【S1】删除节点/边过滤出邻域；空集合编码为 `[]` 而非 `null`。 |
| §2.5-44 | 【S1】保持 `BuildCallTree(v, TreeOptions)` 入口与七字段选项；CLI 先解析 Focus/Through/From。 |
| §2.5-45 | 【S1】TreeNode 的字段与上下方向 children 语义按冻结 wire。 |
| §2.5-46 | 【S1】TreeResult 与既有 Truncation 形状按冻结 wire；过大必须显式 truncated。 |
| §2.5-47 | 【S1】向下是真树；共享被调方按路径重复，不做 chain 全局去重。 |
| §2.5-48 | 【S1】子节点按 name、同名按 id 稳定排序；排序不读 flows。 |
| §2.5-49 | 【S1】自环显示一次后停止；entry 不作隐式刹车。 |
| §2.5-50 | 【S1】`--once` 缺省关闭；打开只显式改变展开去重，不改变缺省真树。 |
| §2.5-51 | 【S1】API depth<0 不限、0 只根；CLI 默认 2、CLI 0 映射为 API 不限。 |
| §2.5-52 | 【S1】向上沿反向活跃边展开，entry 不自动截断。 |
| §2.5-53 | 【S1】`--through` 只用于向上；单独使用仍保留 U 之上的祖先直到 depth。 |
| §2.5-54 | 【S1】`--from` 必须搭配 `--through`，只留 F→U 且 U 可达焦点的走廊。 |
| §2.5-55 | 【S1】错误模式/非祖先/断走廊返回非零错误，不返回伪造空成功。 |
| §2.5-56 | 【S1】tree 只读 View 调用边，不读 flows、不造 CFG、不复用 chain 折叠；截断走 truncated/once。 |
| §2.6-57 | 【S1】canonical `codegraph` 与 handoff `graph` 共享同一命令树；后者别名行为列真机。 |
| §2.6-58 | 【S1】flow 恰一位置参数，继承 repo/view，不提供 with-source。 |
| §2.6-59 | 【S1】id>Name>方法尾段决议；多义列 id 失败，未命中走 sym 错误通道。 |
| §2.6-60 | 【S1】tree 的向下/向上命令形状与 through/from 约束冻结；不另增模式。 |
| §2.6-61 | 【S1】成功 stdout 为换行结尾 JSON，错误非零且不包装成功；summary 菜单含 flow/tree。 |
| §2.6-62 | 【保】chain/who-calls 保留原语义；不加 chain pretty、不在 viewer 再画调用树。 |
| §2.7-63 | 【S2】结构轴旧程序入口打开路径退场；程序入口列表/到达通道只读高亮。 |
| §2.7-64 | 【S2 + S3】不为每个通道保留主图；handler 不回归默认主语；承重集合交棒 S3。 |
| §2.7-65 | 【S2】调用链 tab 保留，继续表示机械下游，不冒充流程图。 |
| §2.7-66 | 【S1 + S2】不做 flow with-source、tree chain 折叠、UI caller depth>1。 |
| §2.7-67 | 【S1 + S2】不加第二颗回结构轴按钮；flow/tree 不取代 chain/who-calls。 |

### 不退回 contract 的边界澄清

1. `graph/webui` 已在当前 charter 工作树被 `git ls-files` 亲自查到；contract §1.2 的缺席描述是旧读数。本稿按 C12 缝地址纳入 S2，且已在 `c17-contract.md` §6 留修订记录。冻结条文的 JSON、字段、语义未改，没有新接缝。
2. `flowpage.ts` 的 `deriveFlowPage` 是 webui 应用包内部 API，仍不向宿主/外部导出；S2 的 React/DOM 行为属于 viewer 实现边，不增加 wire 契约面。
3. S3 的 handoff 配方文件不在当前工作树，故只作交棒欠账；不通过猜路径、不把外部文件伪列入 charter 的有界文件集。
4. 当前 `skills/using-charter/SKILL.md` 没有旧“点程序入口进流程图”或 `flow/tree` 查询菜单本地命中；不新增不存在的文案文件。若外部 C16/handoff skill 仍有旧术语，由协调者在外部载体核对。

## 三、子卡清单与依赖 DAG

**子卡清单：无。**本节点按用户指定的 L3 轻档只出一份单轮实现提案，不建子卡、不派卡；以下 DAG 是协调者后续实现轮的依赖说明，不是 assignments。

```text
S3 扫描配方交棒（真实 flows / branch 引用）
├──→ S1 Go codegraph + CLI（查询与 JSON 契约）
└──→ S2 graph/webui（viewer 派生与导航）
S1 冻结查询/JSON 语义 ───→ S2 viewer 消费
```

- `S3 → S1`：真实扫描产物先满足承重键集合、步骤树和卫语句引用，Go 查询才能验收输入语义；S3 在本仓没有可派文件集，归协调者交棒。
- `S3 → S2`：viewer 的 `CgGraph`/`deriveFlowPage` 只能消费真实扫描字段，不能替扫描侧补造 flows；行为结论列入真机清单。
- `S1 → S2`：viewer 消费 Go/共享 wire 的同一字段语义，先锁定步骤、caller、implements、channel 的契约再验 DOM；实现轮仍须穿过真实 JSON 边界。
- DAG 无环；S2 不回调 Go 实现，S1 不读取 viewer 私有状态。单轮实现可按 S1 与 S2 的文件集并行准备，但合入前须完成 S3 交棒核对。

## 四、行为闭环核对

每行均是产品行为，不为内部 helper 单独造闭环；S3 相关行为若依赖真实扫描产物，验收明确列入真机清单。

| 触发者 | 权威事实/载体 | 消费者 | 可观察结果 | 归属 |
|---|---|---|---|---|
| 人点击结构轴“对外面”未折叠入缝 | `ScopePageModel.inboundSeams[].nodeId` 与 baseline 活跃 call 边 | `RightPanel#RightPanel` → `TwoAxisPage#TwoAxisPage` → `CodegraphPage#CodegraphPage` | 打开该方法主语的行为轴图，不打开 CLI/HTTP/WS 通道图 | S2 |
| 人点击已折叠块展开后的入缝 | 同一 `inboundSeams`，折叠判据仍由 `scopepage.ts#deriveScopePage` 输出 | RightPanel | 展开入缝可打开，折叠块未展开时不占默认泳道 | S2 |
| 人打开一张方法图 | `baseline.flows[subjectId]` | `flowpage.ts#deriveFlowPage` → `FlowPageView#FlowPageView` | 有数据画步骤；缺数据显示 `degraded`/`missing`，不把 chain 当流程图 | S2；流程数据由 S3 交棒 |
| 人点击 call 步骤 | `call.to` 是否属于默认入缝 ∪ 实现方法 ∪ 已有 flows 符号 | `FlowChart#FlowChart` | 命中则紫框、压栈换方法图；`kind=entry` 到达通道不紫、不换图 | S2 |
| 人点击右栏实现 | `implements` `[实现, 接口]` join | `FlowPageView#FlowPageView` | 以实现方法 id 开图，能按上一层回到真实来处 | S1 + S2 |
| 人查看右栏被谁调用 | View 的直接反向活跃 call 边 | Go `LookupFlow` 与 FlowPageView | callers 只是一跳；entry caller 只高亮，普通 caller 仅有 flows 时可打开 | S1 + S2 |
| 人查看到达通道 | View 反向可达的活跃 `kind=entry` 与 CgEntryChannel | FlowPageView | 通道列出并可高亮当前图第一步；不新增主图/栈层 | S1 + S2 |
| 人点击“上一层”或祖先面包屑 | FlowPageView 页内栈及其来源 | FlowPageView + CodegraphPage 装配 | 回真实来处；栈底回原 scope 结构轴且 scope 不丢；只存在一颗上一层 | S2 |
| agent 执行 `codegraph flow` | baseline flows + 合并 View + `SymLookup` 决议 | `graph/cli/cli.go#graphFlowCmd` → `codegraph.LookupFlow` | 一个 JSON 同时给定位、流程步骤、caller/implementation/channel；无 flows 为显式 degraded | S1 |
| agent 执行 `codegraph tree` 向下 | 合并 View 的活跃 call 边 | `graph/cli/cli.go#graphTreeCmd` → `BuildCallTree` | 嵌套真树保留路径，菱形共享节点按路径重复，稳定排序 | S1 |
| agent 执行 `tree --up --through/--from` | 反向祖先集、F→U 直接边与走廊可达性 | `BuildCallTree` | 只留指定走廊；只给 from、错误方向或断走廊非零失败 | S1 |
| 人/agent 使用 canonical 与 handoff alias | 同一 Cobra 命令树 | `graph/cmd/codegraph` 与 handoff 挂载 | 命令名、参数和 JSON 形状一致；alias 的真实挂载属于真机清单 | S1/S3 |

## 五、单轮实现包（非子卡，不派发）

L3 轻档不生成子卡；以下是协调者后续安排单轮实现时可直接采用的一个有界工作包。它不是子卡，也不授权本节点扇出。

### ①契约引用

以本稿第二节逐条核对为准，核心落点是 contract §2.1-1～11、§2.2-12～24、§2.3-25～34、§2.4-35～43、§2.5-44～56、§2.6-57～62、§2.7-63～67。实现轮不得新增跨子系统接缝；若发现缺字段、缺载体或新消费方，先退回 contract。

### ②意图与为什么

把“一个程序入口一张图”纠正为“一个对外契约方法一张图”，并让同一套承重语义贯穿扫描交棒、Go 查询和 viewer：方法是主语，CLI/HTTP/WS 是到达通道；实现方法、紫框目标和直接 caller 才是可下钻主语。`tree` 保留路径信息而不伪装成 `chain`；页内栈把“上一层”定义为真实来路。此包不重造结构轴、`flows` wire、chain/who-calls 或扫描器 CFG。

### ③验收

以下是后续实现轮的行为判据，不是本节点已经跑出的结果。

#### S1（逻辑型）

1. 在 `graph` 目录执行 `go build ./...`，退出码为 `0`；执行 `go test ./codegraph/ ./cli/ -count=1`，退出码为 `0`。
2. `flow` 对有 flows 的 fixture 输出 `degraded=false`、非空 `steps`，且 `callers`/`implementations`/`channels` 字段存在；对无 flows 的 fixture 退出码为 `0`，输出 `degraded=true`、`steps=[]`、非空 `missing`，输出中不得把 chain 节点写入 steps。
3. `flow` 对不存在/删除的 id 返回非零；错误路径不编码成成功 JSON；同级多义输出候选 id。
4. `tree` 向下 diamond fixture 中共享 D 在 JSON 树中出现两次；`--once` 只显式折叠一次；自环只出现一次并停止展开；同父子节点按 name 再 id 排序。
5. `tree --up --through U --from F` 的输出不含兄弟支；只给 `--through` 仍包含 U 之上祖先；只给 `--from`、向下带 corridor、非祖先或不连通走廊均非零失败。
6. 直接调用方、实现 join、到达通道均过滤删除节点/边；无结果输出 JSON 数组 `[]`，不是 `null`。
7. `summary` 的输出同时包含 `flow` 与 `tree`；不新增第三方依赖；`chain`/`who-calls` 原测试仍通过。

#### S2（边界型）

1. 在 `graph/webui` 执行 `npm run typecheck`，退出码为 `0`；执行 `npm test -- src/app/codegraph/flowpage.test.ts src/app/codegraph/FlowChart.test.tsx src/app/codegraph/flowlayout.test.ts src/app/codegraph/FlowPageView.test.tsx src/app/codegraph/RightPanel.test.tsx src/app/codegraph/TwoAxisPage.test.tsx src/app/codegraph/CodegraphPage.wire.test.tsx`，退出码为 `0`。
2. `deriveFlowPage` 对方法主语输出冻结的 subject/steps/callers/implementations/channels；无 flows 双向降级，缺失与空值可区分；实现数组只能来自 `implements` join。
3. 结构轴“对外面”入缝按钮回调方法 id；基本信息程序入口/到达通道不打开图；通道点击只有高亮，没有换图或压栈。
4. `FlowChart` 只有命中冻结承重集合的 call 步骤带紫框/▸；目标为 entry 的通道不能仅因 kind=entry 获得紫框；普通无 flows caller 保留名称并标“无流程图”。
5. `FlowPageView` 可展示到达通道、实现、直接 caller；实现和可开 caller 换图后返回真实来处；祖先面包屑可跳转并截断后续；首层上一层回原 scope 且 scope 不变；页面中只有一颗上一层按钮。
6. `layoutFlowSteps`/`FlowChart` 的 branch 具有 `data-shape="diamond"` 且视觉几何不是圆角矩形；guard return 不进入 `linear`，折列之间有 SVG path；不以“接上列”等文字代线。
7. `CodegraphPage.wire.test.tsx` 穿过真实 `Response JSON → CgGraph → deriveFlowPage → DOM`，验证 `flows` 缺席不是传输失败，也验证字段缺失与零值不混淆；不新增请求。

#### S3（边界型，交棒）

1. 由协调者在 handoff 配方所在仓确认承重 `flows` 键等于“对外入缝 ∪ 紫框目标 ∪ 实现方法”，不得因 entry handler 自动全量覆盖。
2. 由协调者在真实扫描输出中确认卫语句 return 只被 `branch.then/else` 引用，未形成未引用 sequential root；失败/缺数据能沿约定显式降级。
3. 本仓实现轮不编辑 handoff 配方正文；S3 的行为结论未在本机验证，必须列入真机清单。

### ④入口指针与有界文件集

#### S1：Go 库与 CLI

`graph/codegraph/flow.go#LookupFlow`、`#FlowRef`、`#FlowLookupResult`；`graph/codegraph/tree.go#BuildCallTree`、`#TreeOptions`、`#TreeNode`、`#TreeResult`；测试 `graph/codegraph/flow_test.go#TestLookupFlowHasSteps`、`#TestLookupFlowMissingIsDegradedNotChain`、`graph/codegraph/tree_test.go#TestCallTreeDownDiamondRepeatsSharedCallee`、`#TestCallTreeUpCorridorDropsSiblingBranch`；`graph/cli/cli.go#graphLoadView`、`#graphFlowCmd`、`#graphTreeCmd`、`#graphSummaryCmd`、`#graphUniqueID`、`#graphPrintJSON`、`#init`；测试 `graph/cli/cli_test.go#TestGraphFlowDegradedWhenNoFlows`、`#TestGraphTreeDownFixture`、`#TestGraphTreeFromRequiresThrough`。只读复用 `graph/codegraph/{types.go,load.go,sym.go,merge.go}`，不以复用文件扩张本轮修改边界。

#### S2：查看器

`graph/webui/src/api/types.ts#CgGraph`、`#CgFlowStep`、`#CgEntryChannel`；`graph/webui/src/app/codegraph/flowpage.ts#deriveFlowPage` 及 `flowpage.test.ts`；`FlowChart.tsx#FlowChart` 及 `FlowChart.test.tsx`；`flowlayout.ts#layoutFlowSteps` 及 `flowlayout.test.ts`；`FlowPageView.tsx#FlowPageView` 及 `FlowPageView.test.tsx`；`RightPanel.tsx#RightPanel` 及 `RightPanel.test.tsx`；`TwoAxisPage.tsx#TwoAxisPage` 及 `TwoAxisPage.test.tsx`；`CodegraphPage.tsx#CodegraphPage`、`CodegraphPage.test.tsx`、`CodegraphPage.wire.test.tsx`。`scopepage.ts#deriveScopePage` / `#InboundSeam` 只作为现有入缝模型入口核对，除非实现轮发现冻结字段不足，否则不扩大修改集。

#### S3：扫描配方交棒

本仓没有 handoff 配方文件；入口仅指向 contract §5.2-1、spec「扫描侧」和协调者维护的 handoff 配方。不可列虚构路径，不在 charter 提交中修改。

## 六、缺陷族对抗审查

以下按触及子系统分别作答；所有“无”均给出理由。对外部行为事实不凭夹具推断，明确列入真机清单。

### S1：`graph/codegraph`（含 CLI，逻辑型）

| 族 | 验收栏结论 |
|---|---|
| 生命周期 / 状态机中断 | 无，因为 `LookupFlow`/`BuildCallTree`/CLI 查询只读本地图并在内存构造结果，不启动子进程、不创建工单/临时目录；宿主重启最多丢弃本次查询，重跑可重建。S3 扫描进程的中断不归 S1，列真机交棒。 |
| 静默失败 / 误导报错 | 命中并锁定：空 View、删除/未命中 id、非法 corridor 必须非零错误；缺 flows 才是成功 degraded，且 `missing` 非空、`steps=[]`；成功 JSON 不得伪装 chain。验收包含错误 stdout 非成功 JSON与多义候选。 |
| 跨平台假设 | 命中并锁定：`repoRoot`/再锚定和 JSON 输出依赖本地文件系统、路径与行号；实现只保持既有 `SymMatch`/`graphPrintJSON` 契约，不新增进程组或平台 API。Windows 路径、权限和真实仓扫描输出未在机内验证，列真机清单。 |
| 假红 / 假绿测试 | 命中并锁定：diamond、self-loop、`--through` only、`--from` without `--through`、deleted filtering、degraded/steps 空反面都要有能变红的行为测试；测试锁调用方依赖的 JSON/错误行为，不锁私有遍历 helper。fixture 不能证明真实扫描键集合，交给 S3 真机项。 |
| 门禁绕过 | 无，因为本轮 S1 只读，不新增写/执行入口，也不改变 `graphLoadView` 的加载门；`--view` 仍先校验再合并。无 TOCTOU 写窗口。 |
| 序列化边界 | 命中并锁定：baseline JSON→Go `Graph`/`View`→`FlowLookupResult`/`TreeResult`→CLI stdout 是一条真实回归链；字段缺席与零值用可空/omitempty 形状分别断言；`[]` 与 `null` 反面断言；不以两端局部测试替代链路测试。 |
| 枚举新值过既有白名单 | 命中并锁定：`FlowStep.kind`、`Node.kind`、`channel` 与 tree flags 沿既有词表/解析器；未知步骤只能显式降级，entry 不成为紫框语义；本轮不新增枚举，若实现需要新增 kind/状态先退回 contract。 |
| 承重安全属性有测试锁住 | 无，因为本轮没有 token 一次性、唯一性或隔离等安全属性；删除节点过滤和错误不伪成功是数据边界行为，分别由可变红测试锁住。 |

### S2：`graph/webui` 查看器（边界型）

| 族 | 验收栏结论 |
|---|---|
| 生命周期 / 状态机中断 | 命中并锁定：页内栈、选中态和 scope 都是 React 本地状态，无网络订阅、进程、工单、临时目录；组件卸载/外部入口变化清空旧栈与选中态，不遗留资源。浏览器刷新后栈是否按宿主预期重置是外部行为，未验证，需真机。 |
| 静默失败 / 误导报错 | 命中并锁定：缺 flows 显示 degraded/missing，不渲染伪流程；无实现、无 caller、无 channel、无流程 caller 分别显式空态；通道和程序入口点击的“不换图”必须有可见高亮；结构轴入缝必须有可打开反馈。不存在“按钮报成功但未换图”的窗口。 |
| 跨平台假设 | 命中并列真机：SVG 菱形/蛇形 path、中文折行、不同 viewport/DPR、浏览器 pointer/键盘操作、宿主 iframe/file:// 后退均不由 jsdom 证明；机内只验 data-*、path、状态和回调，真实浏览器由协调者执行。 |
| 假红 / 假绿测试 | 命中并锁定：使用 data-*、role、回调参数和状态变化，不用像素/snapshot；反面断言包括 entry 不紫、通道不压栈、degraded 无 `[data-step]`、无 chain 冒充、仅一颗上一层、无文字代线；真实 Response wire 穿线测试承接夹具行为假设。测试锁 viewer 调用方依赖的行为，不锁 `FlowPageView` 内部 state helper。 |
| 门禁绕过 | 无，因为 viewer 只读展示/本地导航，不新增写入、权限或执行路径；点击行为仅改变内存栈，不改 URL、图文件或外部服务。localStorage 既有右栏宽度读写不属于 C17 新写路径，继续保持 try/catch。 |
| 序列化边界 | 命中并锁定：`Response JSON → CgGraph → deriveFlowPage → FlowChart/FlowPageView/RightPanel DOM` 一条 wire 回归必须存在；`flows` 缺失、`steps=[]`、`line=0` 与字段缺席分别断言；implements/channel/caller 的投影均不在 JSX 重新计算。 |
| 枚举新值过既有白名单 | 命中并锁定：FlowStep 四值映射到 rect/diamond/loop/terminal，未知 kind 可见降级；CgEntryChannel 四值和未标注桶穷尽且互斥；`openable` 是布尔行为，不扩 node kind；新增 tab/kind/channel 先退回 contract。 |
| 承重安全属性有测试锁住 | 无，因为本轮没有 token 一次性、唯一性或权限隔离安全属性；但“旧选择不泄漏到新图”“caller depth 不扩展”“通道不入栈”是状态隔离/范围属性，必须各有能变红测试，不能只靠实现恰好为真。 |

### S3：handoff 扫描配方（边界型、交棒）

| 族 | 验收栏结论 |
|---|---|
| 生命周期 / 状态机中断 | 未验证，需真机：扫描宿主重启时由 handoff 配方/扫描运行时负责进程、工单与临时目录回收；本仓不掌握其 owner/时序，不写成已收尾。 |
| 静默失败 / 误导报错 | 命中风险，需真机：必须确认扫描缺 flows、未覆盖方法与坏子干引用能被区分；viewer 只能按契约降级，不能证明配方是否把错误数据报成功。由协调者在真实扫描输出核对。 |
| 跨平台假设 | 未验证，需真机：扫描器的仓库路径、Go/TS AST、权限和外部进程模型不在当前工作树；本卡不据夹具推断 Linux 以外行为。 |
| 假红 / 假绿测试 | 命中风险，需真机：夹具可制造承重键、branch 引用与真实项目不一致的世界；必须用真实扫描产物核对 `flows` 键集合、卫语句引用和缺席降级，不能以 viewer 绿测替代。 |
| 门禁绕过 | 未验证，需真机：扫描配方写 baseline 的权限门、写入前后 TOCTOU 和所有入口是否共用门不在 charter 代码内；协调者核对 handoff 执行门。 |
| 序列化边界 | 命中，需真机：扫描输出→baseline JSON→S1 Go 解码→S2 CgGraph 的跨仓边界必须用真实样本核对字段缺席/零值、steps 树和 implements/channel；本仓不改配方正文。 |
| 枚举新值过既有白名单 | 命中，需真机：新主语集合本身不是新枚举，但 `FlowStep.kind`、channel、entry 语义会穿过扫描器/校验器/Go/TS 分支；协调者必须逐处核对，发现新 kind/状态先退回 contract。 |
| 承重安全属性有测试锁住 | 无，因为本卡没有新增 token/唯一性/隔离安全属性；承重集合与卫语句引用是完整性属性，不得仅以实现存在作为证明，需真实扫描变红复验。 |

## 七、真机清单（未验证，需真机）

以下项目均不得从本地 Vitest/Go fixture 推成结论，归协调者执行：

1. 在真实扫描项目上确认默认对外入缝、紫框目标、右栏实现方法三类主语的 `flows` 键覆盖；确认 entry handler 不因 `kind=entry` 自动承重。
2. 在真实扫描输出上确认 `if err { return }` 落在 branch 子列且没有未引用 sequential return root；确认坏引用/缺数据能被看见而不是静默成功。
3. 真实浏览器/宿主中点击“对外面”入缝，确认进入方法图；点击基本信息程序入口/到达通道，确认只读或高亮、不换图、不压栈。
4. 真实浏览器中确认紫框目标、接口实现、非 entry caller 的换图来源与“上一层”一致；允许 A→B→A 时栈不被去重；面包屑回祖先后后续栈被截断。
5. 从首层方法图回到结构轴，确认原 scope、组织选择和结构轴位置保留；确认页面只有一颗上一层按钮，不依赖 iframe/浏览器后退。
6. 真实浏览器在不同窗口宽度、DPR、中文长名和折列数量下确认菱形几何、卫语句侧甩、蛇形折列 path 和箭头没有视觉断裂；jsdom 的结构标记不替代这项检查。
7. 在真实 canonical `codegraph` 与 handoff `graph` 挂载上分别执行 flow/tree/summary，确认命令树、参数、JSON stdout 和错误退出一致；alias 行为本机未验证。
8. 在真实 baseline→CLI→viewer 全链路核对字段缺席与值为零的区别，以及删除节点/边不污染 callers/implementations/channels。
9. 核对手册/流程文案的外部 C16 skill 或 handoff discipline 是否残留“点程序入口进流程图”；当前 charter 仓 `skills/using-charter/SKILL.md` 未命中，不能代替外部载体核验。

## 八、交棒与越界声明

- 本轮只提交本拆解稿及过程台账；不改 handoff 扫描配方正文，不创建 `codegraph/best.json`、`target.json` 或分支 diff，不把测试夹具升级为项目图。
- `graph/codegraph` 已挂的 `flow`/`tree` 仅是现状流程债；实现轮必须按冻结契约复核字段与错误行为，不能因为现状源码存在就跳过测试。
- `graph/webui` 的纳入是已回写的事实边界澄清，不是把 `deriveFlowPage` 对外导出，也不是新增宿主 wire。
- 本节点不自动生成 assignments、不派发、不调用 handoff CLI；是否进入后续实现/审查由协调者拍板。

## 九、出稿自检

- [x] 子系统清单含逻辑型/边界型、项目无 best 的降档说明及四条资格核对。
- [x] contract §2.1-1～§2.7-67 逐条核对，无新增接缝；边界澄清已回写 contract §6。
- [x] L3 轻档不建子卡；以一个明确声明“非子卡”的单轮实现包给出有界文件集，且另列依赖 DAG 与四段式内容。
- [x] 每个触及子系统的通用五族、序列化、枚举白名单、承重安全属性均有正面结论。
- [x] 所有依赖外部行为的结论已汇总为“未验证，需真机”清单。
- [x] 代码引用使用 `file#Symbol` 锚；本仓无项目 best，`codegraph resolve --doc` 的前置图条件不成立，未把未执行命令写成结论。
