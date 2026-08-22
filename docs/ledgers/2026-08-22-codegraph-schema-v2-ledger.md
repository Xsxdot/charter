# codegraph schema v2（刀 1+2）执行 ledger

- 分支：`feat/codegraph-schema-v2`
- 起点：`31bf88b788007ab78f56960b3b107e8e6a01e401`
- 范围：仅本仓 `graph/` 的 T1、T2、T3；不含 T4、存量补扫、发版。

## 进度记录

| 时间/卡 | 记录 | commit 范围 |
|---|---|---|
| T1 修复轮 1 | 按红测修正 target v2 API、版本门、严格未知键解码、migrate 原子写；补齐 CLI 迁移/版本门/命令计数测试；将 Check 人读文案改为“子系统”。 | T1 工作树（待本卡提交） |
| T1 完成 | 双裁决通过：spec 覆盖 target 三处改名、version=2、LoadTarget 指向 `codegraph migrate`、migrate v1/v2/缺失/未知键、14 个业务子命令；代码质量通过 `git diff --check`、gofmt、build、vet、全量测试。 | T1 本次提交 |
| T2 修复轮 1 | 补 lifecycle 的 Validate/ValidateDiff 引用与枚举检查、Absorb clone/merge、Merge View 状态、baseline/diff JSON 夹具；修复红测中新增节点端点夹具，并补删除状态断言。 | T2 工作树（待本卡提交） |
| T2 完成 | 双裁决通过：spec 覆盖 lifecycle 四类 Validate 问题、增删/去重/死端点/空 diff 保全、Merge added/deleted 状态与 additive-only 键集；代码质量通过全量测试、build、vet、gofmt、diff check。 | T2 本次提交 |
| T3 修复轮 1 | 落地平铺声明加载、ResolveAnchor/testRef 三查、entity lifecycle/声明摘要、domains target 派生与软依赖；补齐真实 fixture 声明/测试函数、坏锚/注释假测试/跨子系统/三键 omitempty 测试。 | T3 工作树（待本卡提交） |
| T3 完成 | 双裁决通过：spec 覆盖声明三查、validate `[decl id]` 与 `domainDecls`、entity 三键及无数据省略、domains 单/跨子系统与 target 缺失/v1 软依赖；代码质量通过全量测试、build、vet、gofmt、diff check。 | T3 本次提交 |

## T1 验证证据

- `cd graph && go test ./... -count=1`：`cli`、`codegraph` 全部 `ok`，cmd 无测试。
- `cd graph && go build ./... && go vet ./... && test -z "$(gofmt -l .)"`：命令成功，gofmt 无输出。
- `rg -n 'TargetDomain|DomainOf' graph --glob '*.go'`：无命中。
- `LoadTarget` 对 v1、v3 的 CLI `check` 与 `contract set` 测试均要求错误包含 `codegraph migrate`。
- migrate 测试锁定：v1 输出 2 空格缩进+尾换行并逐字节比对；v2 字节不变；未知键拒绝；target 缺失/不支持版本拒绝。

## 冻结清单 1~14（终审填写）

| # | 状态 | 证据指针 |
|---:|---|---|
| 1 | ✓ | `target.json` v2 + `migrate_test.go` 字节金样本 |
| 2 | ✓ | `target.go#LoadTarget` + T1 版本门 CLI 测试 |
| 3 | ✓ | `rg TargetDomain|DomainOf graph --glob '*.go'` 无命中 |
| 4 | ✓ | `check_test.go` 保持 `new-direction`/`over-budget` kind |
| 5 | ✓ | `decl.go#LifecycleRef` + `validateLifecycle` 枚举/Model 检查 |
| 6 | ✓ | `types.go#Graph/Diff` lifecycle json tag + wire 测试 |
| 7 | ✓ | `merge_test.go#TestGraphJSONKeysAreAdditiveForLifecycle` |
| 8 | ✓ | `validate_test.go#TestValidateLifecycleRefs/TestValidateDiffLifecycleRefs` |
| 9 | ✓ | `absorb_test.go` 与 `merge_test.go` 增删/死端点/状态/保全断言 |
| 10 | ✓ | `decl.go` 类型 + `decls.go#LoadDomainDecls` 三类加载错误测试 |
| 11 | ✓ | `decls.go#ValidateDecls` + CLI `[decl id]`/`domainDecls` 测试 |
| 12 | ✓ | `migrate.go` 三态/未知键/原子写测试 + 14 业务命令断言 |
| 13 | ✓ | `entity.go` lifecycle 分桶/声明摘要/omitempty 测试 |
| 14 | ✓ | `domains.go` 单/跨子系统派生 + target 缺失/v1 软依赖测试 |

## 整分支终审

- 审查范围：起点 `31bf88b788007ab78f56960b3b107e8e6a01e401` 到 T1/T2/T3 全部提交；未发现超出 T1~T3 范围的代码变更。
- `cd graph && go test ./... -count=1`：`cli`、`codegraph` 全部 `ok`，cmd 无测试。
- `cd graph && go build ./...`、`go vet ./...`、`gofmt -l .`：成功；gofmt 无输出。
- 交叉构建：`CGO_ENABLED=0` 下 linux/amd64、darwin/arm64、windows/amd64 均成功且无输出。
- 终审结论：无需修复波次，T1~T3 完成；未执行 push。

## 协调者段（审核与流程游标，2026-08-22 晚）

> 以上为执行者（codex@linux-01，任务 c43f4a83）自记；以下由协调者会话续记。

### T1~T3 审核（review，零修正项归档）

独立复验（协调者本地 review worktree @9a4cef8，全部本轮跑出）：
- 全量测试/gofmt/vet/三平台 CGO=0 复跑绿；26 变更文件全部在卡面边界内、0 越界文件；`TargetDomain|DomainOf` 零残留；14 业务子命令。
- 深检逐项在场：migrate 金样本+幂等+未知键拒绝；`TestAbsorbLifecycleMergeAndPreserve`（空 diff 保全+增删+死端点+去重）；`TestGraphJSONKeysAreAdditiveForLifecycle`；testRef 走 go/parser 且**注释同名串反面测试在**（decl_test.go 注释假测试 case）；`[decl <id>] ` 前缀在 CLI 层拼装（cli.go:127）且有专测 `TestGraphValidateDomainDeclIssuePrefix`；domains 软依赖双 case（target 缺失/v1）派生字段省略 + stderr 提示（P6）；entity 三键 omitempty 断言。
- **审阅 Important-1（域存在红测试）实质已核销**：卡面漏项，但 codex 按契约 §3-2① 自行实现（decls.go 域存在检查 + `d_missing` 红测试）——契约冗余救了卡面缺漏，无需 continue。
- 归档：`handoff done` @2026-08-22 21:46，note 全文见任务事件流。任务尾部再现 completed 后假 turn_failed（EOF），codex 变体证据已追加 B180 卡。

### 合并与发版（协调者步，DAG 中段）

- 合并：feat/codegraph-schema-v2 @9a4cef8 → charter master @7056764（--no-ff，合并后结果树新鲜全量绿 + vet/gofmt 零输出）；
- tag `graph/v0.3.0` 已推，release run 绿（.github#2）；
- **真机 1 ✅**：六平台资产 + checksums 齐（codegraph_v0.3.0_{darwin,linux}_{amd64,arm64}.tar.gz + windows_{amd64,arm64}.zip）；本机 `go install .../graph/cmd/codegraph@v0.3.0` 成功，`codegraph version` = v0.3.0，14 业务子命令在位。注意：模块版本串是 `@v0.3.0`（子 module tag `graph/v0.3.0` 的 go 版本映射），`@graph/v0.3.0` 是非法版本串。

### T4 派发（进行中）

- 任务 f60d3c19（codex@linux-01，分支 feat/codegraph-v030-consume，base 4d908dd9b，纪律块=内置:single-context）；plan 内联 T4 卡面全文（handoff 仓读不到 charter docs）+ 声明 schema + P5 领域（d_coordination_task/d_workspace）。
- 派发前置插曲：handoff 本地 main 落后一步是 B175 会话刚合未推的 merge（4d908dd9b）——协调者本地 build+契约闸验绿后代推，再派发（基线校验通过）。
- 待 T4 落地后：真机 2（跨版本对账，用本稿钉死读数 fails 0/warns 20）、真机 3（坏锚+testRef 变异）在协调者本地执行；真机 4~7 与补扫（P1=C 混合）依 DAG 后续。

### T4 审核与真机核销（2026-08-22 深夜）

- **T4 零修正归档**（任务 f60d3c19，codex 28 分钟，4 提交 @dce612c0）：验收 6 条全对上——①原子提交内 go.mod v0.3.0 + migrate（无手改 JSON）；②根全量协调者本地复跑 exit 0 零 FAIL；③前后 check JSON 留档、0 fails/20 warns；④配方 lifecycle 段+creator/writer 反裸名纪律+subsystems[].paths 改引；⑤d_coordination_task（4 不变式全带真 testRef + 12 条状态机）与 d_workspace（4 不变式）声明，validate 绿 domainDecls=2，锚逐一 grep 实证；⑥help deprecated 在场、summary 单行无污染。
- **Minor 记账两笔**：migrate 对空 `assignments` 走 omitempty 丢键（T1 出厂行为，LoadTarget 后 nil 与空切片语义等价，非缺陷）；派发 plan 示例命令 `go run ./cmd/handoff` 有误（本仓入口在根），执行者如实纠偏并留原始 stderr——plan 出稿时没核入口路径，记一笔出稿纪律。
- **真机 2 ✅**：v0.3.0 对升级后仓 check = 0 fails / 19 legacy + 1 dead-assembly，与本稿钉死的 v0.2.1 基准逐项一致（Counter 比对）。
- **真机 3 ✅**：坏锚（lifecycle.from 指向不存在符号）→ validate exit 1 带 `[decl d_workspace]` 前缀 → 还原绿；假 testRef → exit 1 → 还原绿。
- **真机 5 ✅**：`codegraph domains` crossSubsystem 恰 4 域，与预测集合逐一相符（d_coordination_task/d_runtime_config/d_runtime_maintenance/d_workspace）。
- **合并**：feat/codegraph-v030-consume → handoff main @65011eade（合并前 main 已被 B176 会话推进，结果树全量零 FAIL 后推送）。任务尾部第三次出现 completed 后假 turn_failed（EOF），已在 B180 记录。

### P1 小样 + 真机 4（同夜）

- 小样两条（宁缺毋滥裁剪：`CreateTask` 只持久化传入对象不构造，弃）：creator = `n_agentd_Manager_Dispatch`（manager.go:863 字面量构造）、writer = `n_store_Store_UpdateTaskState`（field=state，全部迁移的 CAS 收口）。
- 全链路：视图 diff → validate 绿 → **先合并后 absorb** @65011eade → baseline lifecycle 2 条 → 视图消费清空 → absorb 后 validate 仍绿 → 推送 985f37135。
- **真机 4 ✅（全景终验）**：`entity Task` 出 creators/writers/domainDecl 三键齐（breakdown 措辞的「lifecycle 段」在 T3 冻结实现中即分桶进 creators/writers，语义达成，措辞差记此一笔）。
- **全量补扫已派发**（P1=C 后半）：任务 a0764a76，codex@linux-01，分支 data/lifecycle-backfill，产物限定视图 diff + ledger、不 absorb；协调者审后合并再回灌。
- **余项**：真机 6（Web 控制台渲染）、真机 7（执行机 hook）与部署门三条同因同解，等用户定发版窗口。
