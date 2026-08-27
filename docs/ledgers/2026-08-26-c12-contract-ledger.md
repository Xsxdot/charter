# C12 contract 节点台账

分支 `cards/C12-charter`（基线 a41b322）。产出物：`docs/superpowers/specs/c12-contract.md`。

## 查证事件

- spec 头部状态行核对：`docs/specs/2026-08-25-codegraph-viewer-two-axis-spec.md:4` =「已批准（2026-08-26，用户）」，上游状态位一致，直接引用。
- charter 仓存量无图复核 fresh：仓库根无 `codegraph/` 目录；全仓仅 `graph/codegraph/testdata/repo/codegraph/{best,target}.json` 测试夹具。沿用 c1.10-contract §1 同一判定：存量无图项目，契约文档即冻结物，跳过项目图与分支视图 diff。
- `graph/webui/src/api/types.ts:87` `CodegraphResp`（七键，best/target/report/decls 可选）——核实。
- `graph/webui/src/api/types.ts:17-20` `CgDomainDecl.stateMachine?: CgTransition[]`、`:16` `CgTransition.anchor?`——格位已在，核实。
- `graph/webui/src/api/types.ts:6` `CgContainer{label,kind,entry?,domain?}` 无职责字段——核实。
- `graph/webui/src/api/types.ts:7-12` `CgNode` 无 channel 字段——核实。
- `graph/webui/src/app/codegraph/domainpage.ts:270` `deriveDomainPage`（`:269` 注释自陈「C1.10 主缝」）；坏取法实际在 `:281` `inboundEdges.slice(0, DOMAIN_FOCUS_QUOTA)`，配额常量实际在 `:17`——spec 引用 `:283`/`:16` 为行漂移，语义不变。
- 双写漂移三处消费点核实：`BestScopePanorama.tsx:207` 读 `card.responsibility`、`BestDetail.tsx:125` 读 `subsystem.responsibility`、`BestDomainPage.tsx:40` 读 `declaration.responsibility`——与 schema 草案 §8.1 一致；另查出 besttree.ts 六处透传（`:11,:20,:83,:177,:201,:576`），草案未列，删字段同刀清单须含它。
- `graph/codegraph/best.go:35` `BestDomain.Responsibility string json:"responsibility"`（**无 omitempty**）；`:92-94` ValidateBest 要求非空；`best_test.go:55-57` 钉了空值也必须出现的序列化——删字段必然动 wire 与该测试，同刀规则由此而来。
- **schema 草案 §8.2 陈述过时（疑似漂移）**：「容器只挂叶子领域没人写过、没人查过」不成立——`best.go:127-135` 已执法（`hasChild` → 「容器 %s 挂在非叶子领域 %s」），由 C1.8 dc567ce（2026-08-24）落地，早于草案日期。现状事实以 best.go 为准。
- `graph/codegraph/types.go:101-120` `Graph` 无 flows 键；`:62-82` `Node` 无 Channel——新增段确为增量。
- `graph/codegraph/decl.go:41-46` `Transition{From,To,Anchor}` Anchor 已在；`decls.go:65` `ValidateDecls(v *View, best *Best, repoRoot string, decls map[string]DomainDecl)`（C1.10 条 24 已落地）；`decls.go:106` anchor 格式已校验——stateMachine.anchor 本轮零代码改动，只冻约定。
- `graph/cli/cli.go:139/:154/:260` ValidateBest 与 ValidateDecls 并排调用——§8.2「ValidateDecls 旁同级检查」的现状满足方式即 ValidateBest 本体。
- `graph/webui/src/api/client.ts:57-59` `fetchCodegraph(project)`、`:43-53` request 无超时/重试、`:38` 直接 `as T` 无运行时校验——新可选键缺席=降级，不当传输失败。
- a11y 缺陷定位：`BestDomainPage.tsx:172-177` 一个 `role="tablist"` 内混排语义/结构 tab 与按最优树/按现状领域按钮——spec「两组控件塞进同一个 tablist」核实。
- 四档债务色词表已在：`besttree.ts:27` `DirectionStatus = 'declared'|'over-budget'|'dead-contract'|'new-direction'`。
- handoff 外部 checkout `/root/.handoff/repos/handoff` HEAD 7adeb8f9 只读核对：`codegraph/baseline.json` 顶层键 `{containers,domains,edges,implements,meta,nodes,projections}`（无 flows/packages/lifecycle）；container kind 八值逐一核实与草案 §8.4 词表一致（计数 100/44/41/21/23/4/1/入口3）；entry 节点 118 个 channel 全缺；`target.json` 23 contracts / 15 带 entries。**该 checkout 无 `codegraph/best.json`、无 `web/src/app/codegraph/CodegraphFrame.tsx`**——spec 引用的宿主单向传参（CodegraphFrame.tsx:19）与 best/decl 双写文本差异两处读数为更新版本的手仓状态，本 checkout 未验证。
- `prototypes/codegraph-two-axis/` 不在本工作树也不在 git：`prototypes/.gitignore` 只放行 `base/`，README 记明走查副本不入库、回流 base/ 由 finish 执行、确认基准已落在 README——非缺口，是既定策略。

## 基线绿（改动前）

- `cd graph && go build ./...` → 退出码 0；`go test ./codegraph/` → `ok github.com/Xsxdot/charter/graph/codegraph 0.022s`。
- `cd graph/webui && npm install`（node_modules 缺失，装依赖）→ found 0 vulnerabilities；`npm test` → **Test Files 20 passed (20)，Tests 133 passed (133)**。

## Ticket 0 骨架落码（提交 1）

- `graph/codegraph/types.go`：新增 `FlowStep`/`Flow` 类型、`Graph.Flows map[string]Flow json:"flows,omitempty"`、`Node.Channel string json:"channel,omitempty"`、两组受控词表常量（`FlowStepCall/Branch/Loop/Return`、`ChannelCLI/HTTP/WS/Web`）。纯声明零行为。
- `graph/webui/src/api/types.ts`：镜像 `CgFlowStepKind`/`CgFlowStep`/`CgFlow`/`CgEntryChannel`；`CgGraph.flows?`、`CgNode.channel?`。纯类型增量。
- 新建缝壳 `graph/webui/src/app/codegraph/scopepage.ts#deriveScopePage`（缝 1）与 `flowpage.ts#deriveFlowPage`（缝 2）；模块路径与入口函数名即冻结的缝地址，内部模型形状归 plan。
- 编译证据：`cd graph && go build ./... && go vet ./codegraph/` → `GO_BUILD_OK` + `VET_OK`（退出码 0）。

## 直通竖切与冻结（提交 2）

- `graph/webui/src/app/codegraph/ticket0.passthrough.test.ts` 落码并跑绿：`npm test` → Test Files 21 passed (21)，Tests 136 passed (136)（基线 20/133 + 新增 1 文件 3 支）；`npm run typecheck` → 退出码 0。
- 契约文档落盘 `docs/superpowers/specs/c12-contract.md`：40 条冻结断言 + 4 条拍板记录 + 4 条交棒欠账 + 移交 plan 附区 3 条；随本提交冻结（存量无图，契约文档即冻结物）。
- 纠正上游三处：草案 §8.2 陈述过时（best.go:127-135 已执法）、responsibility 消费点补 besttree 六处、spec 的 domainpage 行号漂移。

## 放弃的尝试与判断

- 不把 responsibility 删除放进 Ticket 0：删字段破坏三组件 + besttree 六处编译，必须与 viewer 改读 decls 同刀（implement 轮），冻结条目写同刀规则。
- 不在 Ticket 0 给 Go 侧加 flows/kind/channel 校验行为：校验属可观测行为，需能变红的测试，而其执法时机 spec 明文随数据齐备开启（Out of Scope 1：本轮不实现扫描器）；Ticket 0 保持纯声明零行为。
- 直通竖切「一次调用」取义：spec 主缝是两条平行的派生器缝，单次调用无法同时穿过两者（不存在嵌套关系）；按每缝一次真实调用落在一支测试文件里，理由记入契约文档 §4.2。
