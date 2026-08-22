# codegraph schema v2（刀 1+2）执行 ledger

- 分支：`feat/codegraph-schema-v2`
- 起点：`31bf88b788007ab78f56960b3b107e8e6a01e401`
- 范围：仅本仓 `graph/` 的 T1、T2、T3；不含 T4、存量补扫、发版。

## 进度记录

| 时间/卡 | 记录 | commit 范围 |
|---|---|---|
| T1 修复轮 1 | 按红测修正 target v2 API、版本门、严格未知键解码、migrate 原子写；补齐 CLI 迁移/版本门/命令计数测试；将 Check 人读文案改为“子系统”。 | T1 工作树（待本卡提交） |
| T1 完成 | 双裁决通过：spec 覆盖 target 三处改名、version=2、LoadTarget 指向 `codegraph migrate`、migrate v1/v2/缺失/未知键、14 个业务子命令；代码质量通过 `git diff --check`、gofmt、build、vet、全量测试。 | T1 本次提交 |

## T1 验证证据

- `cd graph && go test ./... -count=1`：`cli`、`codegraph` 全部 `ok`，cmd 无测试。
- `cd graph && go build ./... && go vet ./... && test -z "$(gofmt -l .)"`：命令成功，gofmt 无输出。
- `rg -n 'TargetDomain|DomainOf' graph --glob '*.go'`：无命中。
- `LoadTarget` 对 v1、v3 的 CLI `check` 与 `contract set` 测试均要求错误包含 `codegraph migrate`。
- migrate 测试锁定：v1 输出 2 空格缩进+尾换行并逐字节比对；v2 字节不变；未知键拒绝；target 缺失/不支持版本拒绝。

## 冻结清单 1~14（终审填写）

| # | 状态 | 证据指针 |
|---:|---|---|
| 1 | 待终审 | T1/T2 |
| 2 | 待终审 | T1 |
| 3 | 待终审 | T1 |
| 4 | 待终审 | T1 |
| 5 | 待终审 | T2 |
| 6 | 待终审 | T2 |
| 7 | 待终审 | T2 |
| 8 | 待终审 | T2 |
| 9 | 待终审 | T2 |
| 10 | 待终审 | T3 |
| 11 | 待终审 | T3 |
| 12 | 待终审 | T1 |
| 13 | 待终审 | T3 |
| 14 | 待终审 | T3 |
