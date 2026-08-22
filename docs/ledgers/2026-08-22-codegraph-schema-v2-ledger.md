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
