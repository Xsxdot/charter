# Breakdown：codegraph 刀 1+2——schema v2 术语迁移 + 领域图

> 日期：2026-08-22 | 状态：**出稿待拍板**（出稿 subagent，岔口零自批）
> 上游状态位（出稿时实读核对）：spec 头部「已批准（2026-08-22，用户指令『并行进 contract』）」✓；契约头部「随本提交冻结」✓，冻结提交 5eed80c 在库 ✓；Ticket 0 骨架已落 `graph/codegraph/decl.go` 且当前树 `go build && go test ./...` 全绿（本轮实跑）。
> 现状读数出自本 worktree graph/ module 与 handoff 仓 @ 7adeb8f 的直接复核。

## 待拍板清单（拍板者按此裁决，散落正文的引用只是展开）

| # | 岔口 | 方案与取舍 |
|---|---|---|
| P1 | **存量补扫怎么安排**（AI 会话产出数据，不是代码卡） | A=协调者本地会话分批产出（可控、烧本地上下文，707 个 model 节点量大）；B=handoff 派发 executor 按扩展后配方跑（配方本身就是「派发给 AI executor 的 plan 模板」，量大适派发；数据质量靠 validate 边门控+引用完整性机械闸兜底）；C=混合：本地先做 1 个领域的小样验证配方新规则，再派发全量。任一方案都必须在 T4 之后（配方扩展与 v0.3.0 工具先落地）、产物走视图 diff（lifecycleAdded）→ 合并后 absorb 回灌 |
| P2 | **migrate 对 schema 外未知键的策略** | A=结构体往返（与 `graph/codegraph/contractset.go#SetContract` 写路径一致——它今天就整写 target，未知键静默丢弃）；B=`DisallowUnknownFields` 拒迁报错（反静默：有未知键说明 target 被手工加过料，让人先处理再迁）。两者对 handoff 真实 target（纯 schema 键，本轮实读）行为相同 |
| P3 | **C1 澄清的定性**：ValidateDiff 是否覆盖 lifecycleAdded/Deleted | 契约 §6-8 只点名 `Validate`；不补 ValidateDiff 则含坏 lifecycle 引用的视图能通过 absorb 前置检查併进基线、事后才由 Validate 变红——违背 absorb 拒收门的既有语义（`graph/cli/cli_test.go#TestGraphAbsorbRejectsFakeEdges` 先例）。A=按边界澄清处理（复用「基线∪nodesAdded」既有模式，非新接缝，拍板后回写契约修订记录）；B=定性为契约增量退回 contract |
| P4 | **领域 id 含 `/` 时声明文件族无法平铺**：契约 §3「文件名=Domain 字段」未覆盖此边缘（graph 夹具真实存在 `d_svc/api` 这样的 id；handoff 真实 19 域均无 `/`） | A=平铺 glob + 此类 id 判为「不可声明」（真要声明先改领域 id；限制随 P3 一并回写契约修订）；B=支持子目录递归（`codegraph/domains/d_svc/api.json`），换来 glob/校验复杂度与 Windows 路径歧义 |
| P5 | **样板声明选哪 1~2 个领域**（冻结 16） | 必选 `d_coordination_task`（spec 故事 3 点名；Task 状态机是全仓最富的状态类实体）；第二份建议从真实跨子系统四域（本轮派生实测：d_coordination_task / d_runtime_config / d_workspace / d_runtime_maintenance）里挑一个（倾向 d_workspace），顺带给故事 4 的警示喂真机读数 |
| P6 | **domains 命令对 target 缺失/v1 是否加 stderr 人读提示** | 契约冻结 14 规定「省略字段且不报错」，但纯静默会让 v1 仓用户误把「看不到 subsystems」读成「无跨子系统」。A=stderr 加一行提示（stdout JSON 零污染，不违「不报错」）；B=严格照契约字面零输出 |

## 拍板结果（2026-08-22 协调者，拍板即提交）

| # | 裁决 | 备注 |
|---|---|---|
| P1 | **C 混合**：本地先做 1 个领域小样验证配方新规则，再派发全量 | 时序钉死：T4 之后；产物走视图 diff → absorb |
| P2 | **B 拒迁报错**（DisallowUnknownFields） | 反静默法理；对真实 target 行为无差、选严零成本 |
| P3 | **A 边界澄清**：ValidateDiff 覆盖 lifecycle 增删 | 回写契约修订 R1；absorb 拒收门语义完整性要求，非新接缝 |
| P4 | **A 平铺 + 含 `/` 的 id 判不可声明** | 回写契约修订 R2；handoff 真实 19 域均无 `/`，不为夹具风格背复杂度 |
| P5 | **d_coordination_task + d_workspace** | 后者跨 3 子系统，给故事 4 警示喂真机读数 |
| P6 | **A 加 stderr 提示** | stdout JSON 零污染，不违冻结 14 |

六条均为技术性岔口（无产品级/不可逆取舍），协调者按出稿倾向全数裁定；用户如异议可在 review 前翻案。

## 一、触及子系统清单（架构法第一条·派卡资格四条逐个核）

- **S1 = charter/graph**（codegraph 工具，canonical 家）：**逻辑型**——接缝对面是自有代码（cli_test/codegraph 包测试 + 夹具仓闭环）。四条：有界文件集 `graph/**` ✓；契约面可枚举（冻结清单 16 条、14 子命令、§2/§3 类型族）✓；对 S2 零依赖（依赖方向 handoff→graph 单向）✓；类型已标 ✓。**发版切面**（tag `graph/v0.3.0` → release workflow 六平台资产）是刀 0 T2 已建成通道的**复用**，本期零代码改动——不成卡，纯真机清单项。
- **S2 = handoff**（消费侧 + 数据侧）：**逻辑型**——go.mod 升级、migrate 执行、配方文档扩展、样板声明入库都在 handoff 仓内由全量测试 + `TestRepoContractGate` + `codegraph validate` 闭环（`cmd/graph_gate_test.go#TestRepoContractGate`）。四条核对 ✓（文件集见 T4）。**机内/真机切分**：migrate 执行与样板声明的「validate 绿」在卡内机内闭环；**跨版本对账**（v0.2.1 读数 vs v0.3.0 读数逐条一致）与**坏锚变异**是行为事实，归真机清单；**存量补扫**是 AI 会话产出数据、不是代码活，不成卡，安排见 P1。

## 二、契约增量核对

**结论：拆解未越界、无新接缝需退回 contract；两处边界澄清（C1/C4）建议随拍板回写契约修订记录（定性归 P3/P4 裁决）。**

冻结清单 16 条逐条分配：1/2/3/4/12 → T1；5/6/7/8/9 → T2（类型骨架已落 decl.go，校验/合并/保全归 T2）；10/11/13/14 → T3；15/16 → T4（15 的跨版本对账半边 + 16 的变异半边归真机清单）。

澄清与实现自由度（不动冻结物）：

- **C1**（归 P3 裁决）：ValidateDiff 对 lifecycleAdded/Deleted 做端点检查——理由见 P3。
- **C2**（不越界，无需回写）：entity 消费 lifecycle 需 `Merge` 后的 View 承载 lifecycle（含 diff 状态）。View 是包内 API 非 wire 契约——本轮 grep 复核：agentd 只用 `LoadGraph/ListViews/LoadDiff/CheckStale`（`internal/agentd/codegraph.go`），不序列化 View；Web 前端消费的是 Graph JSON。
- **C3**（实现自由度，归 plan）：migrate 不得走 `LoadTarget` 读输入——版本门会把 v1 拒之门外，migrate 需要自己的 raw 读路径（先探 `meta.version` 再按 v1 形态解析）。
- **C4**（归 P4 裁决）：领域 id 含 `/` 的声明文件命名，见 P4。
- **现状陷阱记录**：`graph/codegraph/absorb.go#Absorb` 的显式字段克隆**不含 Lifecycle**——Ticket 0 落了 Graph.Lifecycle 字段但 Absorb 会把基线已有 lifecycle 静默清空。这不是契约违约（冻结 9 本就分给 implement），但它是「反向改写不立刻红测试」的现行实例，T2 验收必须有 roundtrip 保全断言。

## 三、子卡清单 + 依赖 DAG

### T1【S1·逻辑型】刀 1 原子卡：target v2 改名 + 版本门 + migrate + 夹具/文案随迁

- **契约引用**：§1 全部、§4-1、§5-6、§6-1/2/3/4/12；spec 裁决 1/5。
- **意图**：一次原子变更消掉「domains 字段装子系统」的术语债并立反静默版本门。原子性是契约 Ticket 0 明文（「target 改名不进骨架——它与 migrate、夹具改写是同一原子变更」）：改名+版本门落地的瞬间 v1 夹具全红，必须同卡完成夹具升 v2 与 migrate 通道，主线不出现红测试窗口。
- **行为化验收**（机内）：
  1. `cd graph && go build ./... && go vet ./... && go test ./... -count=1` 全绿；
  2. `grep -rn "TargetDomain\|DomainOf" graph/ --include='*.go'` 零命中（冻结 3「不复存在」；本轮实测现有命中点：`target.go`、`target_test.go`、`check.go#Check`、`check_test.go`）；
  3. 夹具 `graph/codegraph/testdata/repo/codegraph/target.json` 升 v2：含 `"subsystems"` 键与 `"version": 2`，target 夹具内 `"domains"` 键零命中；
  4. 版本门：对 v1 夹具跑 `codegraph check` 非零退出且错误文案含 `codegraph migrate`；version=3 同样拒绝；`contract set` 对 v1 同样拒绝（版本门在 `LoadTarget` 单点收口，所有入口共享同一道门）；
  5. migrate 三态：v1 输入 → stdout `{"migrated":true,"from":1,"to":2}` 且写盘结果与 v2 金样本**逐字节**相等（2 空格缩进+尾 newline，冻结 12）；v2 输入 → `{"migrated":false}` 且文件**字节零改动**（前后 sha 相等的正面断言，防「重写同内容仍报 false」假绿）；无 target.json → 非零退出报错；migrate 写盘走临时文件+rename 原子写（照 `graph/codegraph/absorb.go#SaveGraph` 模式，防截断留残——生命周期族）；
  6. `codegraph --help` 子命令总数 14 且含 migrate（冻结 12）；
  7. check 的 wire 键锁：违规夹具断言 `fails[].kind` 字面仍为 `new-direction`/`over-budget`（冻结 4）；Detail 人读文案「域」→「子系统」有正面断言；既有 `TestGraphCheck`/`TestGraphContractSet` 等迁移前写就的测试不改语义地保持绿（= spec 故事 1「行为不变」的夹具级外部尺）；
  8. 未知键策略按 P2 裁决落地并有对应断言。
- **入口指针**（有界）：`graph/codegraph/target.go`、`target_test.go`、`check.go`（`t.Subsystems`/`SubsystemOf` 改名点+文案）、`check_test.go`、`contractset_test.go`、`testdata/repo/codegraph/target.json`、新 `migrate.go`+`migrate_test.go`（落 codegraph 包或 cli 层归 plan）、migrate 金样本夹具（testdata 新目录）、`graph/cli/cli.go`（挂载+计数注释）、`cli/cli_test.go`。

### T2【S1·逻辑型】刀 2 机械层数据面：lifecycle 校验 / 合并 / 保全

- **契约引用**：§2-1/2/3、§5-5、§6-5/6/7/8/9；§7 拍板「独立段而非扩 Edge」；C1（按 P3 裁决口径）。
- **意图**：让 lifecycle 成为一等图数据：进得来（diff）、合得进（absorb/merge）、错得出（validate）、**丢不了**（clone 保全——修掉 §二记录的 Absorb 静默清空陷阱）。
- **行为化验收**（机内）：
  1. `Validate`：Who 缺失 / Model 缺失 / Model 非 model / Kind 枚举外四种坏数据各出 issue（冻结 8）；干净夹具 0 issue；
  2. `ValidateDiff` 对 lifecycleAdded/Deleted 做「基线∪nodesAdded」端点检查（照 diff 投影模式；P3=B 则本条移出本卡退回 contract）；absorb 前置检查因此把坏 lifecycle 视图拒之门外——拒收后 diff 文件保留、基线不动（照 `TestGraphAbsorbRejectsFakeEdges` 语义）；
  3. `Absorb`：加 added、剔 deleted、剔 dead 端点、去重，逐字照 `graph/codegraph/absorb.go#mergeProjections` 模式（冻结 9）；**空 diff absorb 后基线 lifecycle 逐条保留**（roundtrip 保全断言——本卡的承重反向断言）；
  4. `Merge` 后 View 承载 lifecycle 及 added/deleted 状态（C2 形态归 plan），供 T3 的 entity 消费；
  5. additive-only 可执行锁：对 Graph 序列化的 JSON 键集合做断言——相对 v0.2.1 键集恰多 `lifecycle` 一键（冻结 7 从「review 口头对账」升为能变红的测试）；
  6. 夹具 baseline 增 m_task 的 creator/writer 条目 + 一个含 lifecycleAdded 的视图夹具，`codegraph validate` 绿。
- **入口指针**（有界）：`graph/codegraph/validate.go`、`validate_test.go`、`absorb.go`、`absorb_test.go`、`merge.go`、`merge_test.go`、`decl.go`（注释级）、`testdata/repo/codegraph/baseline.json`、`testdata/repo/codegraph/diffs/**`、`graph/cli/cli_test.go`（validate 键锁）。

### T3【S1·逻辑型】刀 2 声明层 + 查询面：decls 三查执法 + entity/domains 增段

- **契约引用**：§3 全部、§4-2/3、§5-7、§6-10/11/13/14；spec 故事 2/3/4；依赖 T1（`SubsystemOf` + target v2 软加载）、T2（View 携带 lifecycle）。
- **意图**：把人工声明接进执法与查询：`LoadDomainDecls`/`ValidateDecls` 落地并接 `validate` 命令；entity 拼出「谁创建/谁写/声明摘要」完整语义半边；domains 派生领域↔子系统映射与跨子系统警示（零手抄）。
- **行为化验收**（机内）：
  1. 加载：文件名≠Domain 字段、JSON 非法、Responsibility 为空 → 错误；`codegraph/domains/` 目录缺失 → 空 map 零错误（声明渐进铺）；领域 id 含 `/` 按 P4 裁决处理并有断言；
  2. 三态执法（spec 测试决定 2）：声明齐全 → `codegraph validate` 绿且输出含 `"domainDecls": <n>`；坏锚（vanished/file_missing）→ 非零且 issue 前缀 `[decl <领域id>] `；「moved」不算坏锚（锚活着，resolve 语义）；testRef 指向不存在的测试函数 → 非零；**testRef 同名串只出现在注释里 → 仍非零**（go/parser 非 grep 的反面正断言——假绿温床的正面锁）；
  3. entity 键锁：有 lifecycle+声明的夹具输出含 `creators`/`writers`/`domainDecl` 三键（按 node 带 file:line 再锚定展示）；无数据时三键省略（omitempty 双向断言，同 EdgeIssue 金样本模式）；Kind 枚举外的 lifecycle 条目 entity 宽容跳过（照 `entity.go#appendProjSite` 先例）、Validate 负责报红——同一枚举两处消费不分裂；
  4. domains 增段：夹具构造跨子系统领域 → `"subsystems"` 列出 ≥2 且 `"crossSubsystem": true`；单子系统领域 → false；**target 缺失与 target v1 两种情况**下 domains 照常出树、两键省略、退出 0（冻结 14 软依赖——版本门只在显式 LoadTarget 的命令生效）；stderr 提示按 P6 裁决；
  5. 派生零手抄（§5-7）：DomainDecl/DomainStat 的 JSON 键集合断言不含任何手抄归属字段（subsystems 只出现在派生输出、不出现在输入 schema）。
- **入口指针**（有界）：`graph/codegraph/decl.go`（扩加载/校验，或新文件归 plan）、`entity.go`、`entity_test.go`、`domains.go`、`domains_test.go`、`resolve.go`（只读复用 `ResolveAnchor`）、`graph/cli/cli.go`（validate/entity/domains 三命令接线）、`cli/cli_test.go`、夹具 `testdata/repo/codegraph/domains/*.json`（新）+ 夹具仓 `svc/*_test.go`（新，供 go/parser testRef 核验——testdata 不参与编译，纯文本即可）。

### T4【S2·逻辑型】handoff 消费侧升级：v0.3.0 + migrate + 配方扩展 + 样板声明

- **契约引用**：§2-4、§6-15/16；§5-6；spec 故事 1/3/5；依赖：`graph/v0.3.0` tag 已推（串行等 tag，提交内零 replace——刀 0 D 裁决同款）。
- **意图**：全网唯一 v1 消费者一次性过桥。**原子性（冻结 15）**：go.mod 升 v0.3.0 与 `codegraph migrate` 改写 target.json 必须同一提交——分开则中间提交上新库拒读 v1，`TestRepoContractGate` 与一切走 LoadTarget 的路径红掉。配方扩展与样板声明同卡：都是 handoff 仓文件、都是补扫与真机验收的前置。
- **行为化验收**（机内=handoff 仓内）：
  1. 同一提交内：go.mod 含 `charter/graph v0.3.0` 且 `grep -c '^replace' go.mod` = 0；`codegraph/target.json` 的 `meta.version`=2、顶层键 `subsystems`、`assignments`（现为空数组）语义照旧；
  2. handoff 根 `go build ./... && go vet ./... && go test ./... -count=1` 全绿（含 `cmd/graph_gate_test.go#TestRepoContractGate`——当前主线该闸为绿：本轮实测 check fails=0）；
  3. 升级后 `codegraph check --repo .` 读数与升级前基准一致：fails 0 条、warns 20 条（19 legacy + 1 dead-assembly，2026-08-22 本轮 v0.2.1 实测读数）——执行者在卡内记录前后 JSON；**逐条 diff 对账的跨版本半边归真机清单 2**（执行者机内只能跑新版本）；
  4. 配方 `docs/codegraph-scan-recipe.md`：baseline 表增 lifecycle 段、diff 表增 lifecycleAdded/lifecycleDeleted、新增 creator/writer 产出纪律（沿 B173 反裸名撞库措辞：creator 必须是「返回该 model 类型」的真构造点、writer 必须是对状态类字段的真写入、定不出宁缺毋滥）、第 20 行 `domains[].paths` 引用改 `subsystems[].paths`；
  5. 样板声明（P5 裁决的领域）落 `codegraph/domains/`：`codegraph validate --repo .` 绿且 `domainDecls` ≥ 1；锚全部指向真实代码位（Task 生命周期与状态机照真代码写，不编造）；
  6. `handoff graph --help` 照常含 deprecated 文案、`handoff graph summary` 输出照常且 stdout 无告警污染（SessionStart hook 依赖；别名同构造同版本等价条款照旧）。
- **入口指针**（有界）：`handoff/go.mod`、`go.sum`、`codegraph/target.json`、`codegraph/domains/*.json`（新）、`docs/codegraph-scan-recipe.md`、`cmd/graph_gate_test.go`（只读复核，不改）。

### 依赖 DAG

```
T1 ──┬──→ T3 ──┐
T2 ──┘         ├─→ [协调者：合并主线 → tag graph/v0.3.0 → 真机 1 发版资产] ──→ T4
               ┘                                                              │
                                    [P1 裁决的补扫（数据产出）→ 合并后 absorb 回灌] ←┘
                                                │
                              [真机 3~7：对账 / 变异 / 全景 / Web / hook]
```

T1 与 T2 无相互依赖（改名不碰 lifecycle 文件集，反之亦然）；轻档单执行者建议顺序 T1 → T2 → T3，T4 等 tag。T3 依赖两者（domains 软加载要 v2 语义、entity 要 View lifecycle）。

## 四、缺陷族对抗审查（结论已进各卡验收栏，此表供把关）

| 族 | 回答 |
|---|---|
| 生命周期/状态机中断 | migrate 写盘半途中断会留截断 target、bricked 整仓闸——T1⑤ 要求临时文件+rename 原子写（SaveGraph 同款）；absorb 原子写已有；其余全是无状态 CLI 与纯函数，无守护进程、无孤儿资源 |
| 静默失败/误导报错 | 四点：①版本门错误文案含 migrate 指引（冻结 2，T1④ 正面断言）；②**Absorb 静默清空 lifecycle 是现行缺陷**（§二陷阱记录）——T2③ roundtrip 保全断言正面锁死；③domains 对 v1 的契约性静默（冻结 14）有误读风险——P6 岔口交拍板；④migrate 对 v2「零改动」用 sha 前后相等断言，防「重写同内容仍报 false」 |
| 跨平台假设 | 零 CGO 六平台是继承不变式（deps_test 在锁）；go/parser 属标准库不破 stdlib-only；新险点唯一：**声明文件名=领域 id 在 id 含 `/`（夹具实例 d_svc/api）或 Windows 非法字符时不成立**——P4 岔口交拍板，落地卡带断言；migrate/decl 的路径处理沿用 filepath.Join 惯例 |
| 假红/假绿测试 | 外部尺三把：migrate 金样本逐字节比对（T1⑤）、Graph JSON 键集合 additive-only 断言（T2⑤，冻结 7 从口头对账升为可红测试）、跨版本 check 对账（真机 2，v0.2.1 读数已在本稿钉死：fails 0 / warns 20）。反面断言：testRef 注释同名串仍红（T3②）、crossSubsystem 单子系统为 false（T3④）、omitempty 无数据省略（T3③）。夹具世界的 lifecycle 数据真实性机内验不了 → 真机 4 |
| 门禁绕过 | 版本门在 LoadTarget 单点收口，check/contract set/migrate 之外无第二读径（T1④ 断言多入口同门）；absorb 拒收门对 lifecycle 的覆盖依赖 C1/P3——不补即绕过路径，已作为岔口置顶；无新增权限面、无网络、无 agentd 依赖 |
| 序列化边界 | lifecycle 全链路：AI 补扫 diff → ValidateDiff → Absorb → baseline → LoadGraph → Merge(View) → entity JSON，每处新手写投影（Absorb clone、Merge 状态标注、entity creators/writers 分桶、domainDecl 摘要拼装）都有对应断言（T2③④、T3③）；穿真实序列化边界的回归 = T2⑤ 键集合 + T3③ 金样本；LifecycleRef.Field 的 omitempty「缺失 vs 空串」同形——writer 展示字段可接受，契约本就定为可选 |
| 枚举新值过白名单 | 新枚举三处：`meta.version=2` 只流经 LoadTarget 白名单（单点）；`LifecycleRef.Kind` 流经 Validate 白名单与 entity 分桶 switch 两处——T3③ 断言两处口径一致（枚举外 Validate 红、entity 宽容跳过）；锚点状态消费白名单（vanished/file_missing 为坏、moved 为好）在 ValidateDecls 正面定义（T3②），与 resolve 命令的既有退出语义对齐 |
| 承重安全属性 | 无 token/一次性/隔离类属性。承重不变式四条及其锁：stdlib-only+仅 cobra（deps_test 既有锁）；baseline additive-only（T2⑤ 新锁）；target v1 拒读反静默（§5-6，T1④ 锁）；归属只许派生零手抄（§5-7，T3⑤ 键集合锁） |

## 五、真机清单（归协调者/用户；「未验证，需真机」条目全集）

1. **发版通道**：T1~T3 合并主线后推 tag `graph/v0.3.0`，观察 release workflow 六平台资产 + checksums 齐（刀 0 T2 通道复用，无代码改动）；协调者本机 `go install .../graph/cmd/codegraph@v0.3.0` 可用。
2. **冻结 15 跨版本对账**：用升级前 v0.2.1 二进制（或本稿钉死的读数：fails 0 / warns 20 = 19 legacy + 1 dead-assembly）与 T4 后 v0.3.0 的 `codegraph check --repo ~/workspace/handoff` 输出做**逐条** diff，集合一致（0=0、20=20）。夹具证不了真仓，此为行为事实。
3. **冻结 16 变异复验**（acceptance 纪律）：handoff 真仓样板声明坏锚变异——改坏一个锚 → `codegraph validate` 非零 → 还原 → 绿；testRef 变异——改指向不存在函数 → 非零 → 还原 → 绿（spec 故事 3）。
4. **补扫产出落库**（P1 裁决后执行）：产物过 `codegraph validate`（引用完整性 + 边门控）→ 视图 diff → **先合并分支后 absorb** 回灌（finish 纪律）；absorb 后 `codegraph entity Task --repo ~/workspace/handoff` 显示 creators/writers/lifecycle/declaration 四段齐（spec 故事 2 的全景终验）。
5. **故事 4 真机读数**：`codegraph domains --repo ~/workspace/handoff` 预期恰 4 个领域 `crossSubsystem: true`（d_coordination_task / d_runtime_config / d_workspace / d_runtime_maintenance——本轮用与 SubsystemOf 同逻辑的派生脚本实测）；多于或少于此数须查明（target 漂移或派生 bug），不许照单全收。
6. **附加段无破坏的行为半边**：lifecycle 落库后 handoff Web 控制台 codegraph 页三段照常渲染、agentd 两 API 照常（机内只验了「旧消费方只碰既有键」的 API 事实，渲染是行为事实）。
7. **hook 行为**：执行机 handoff 升级后 SessionStart 的 `handoff graph summary` 照常注入、stdout 无告警污染。

## 六、图覆盖债

charter/graph 仓无图——本稿 charter 侧引用一律 `file#Symbol` 锚并经直接实读核验（target.go/check.go/absorb.go/merge.go/validate.go/entity.go/domains.go/decl.go/contractset.go/cli.go/cli_test.go 全文实读）。handoff 侧引用（`cmd/graph_gate_test.go#TestRepoContractGate`、`internal/agentd/codegraph.go`、`docs/codegraph-scan-recipe.md`、target.json/baseline.json 读数）经实读与脚本实测。**本稿为混仓文档**：`codegraph resolve --doc` 单仓语义会把另一仓的锚报 file_missing，机械复核不适用，自检以实读为准。新增未命中符号：无。
