# codegraph 刀 3+4 实现账本

## T0：sortFindings 全序

- 范围：`graph/codegraph/check.go`、`graph/codegraph/check_test.go`；补 `From`/`To`/`Edge` tiebreak 与稳定性测试。
- 红因：`TestSortFindingsIsTotalOrder` 在仅按 `Kind+Detail` 时因 `slices.SortFunc` 不稳定而失败，报为两种排列结果不同；不是编译错误。
- 变异复验：暂时移除 tiebreak 后同测试再次失败，恢复后通过。
- 验证：`go test ./codegraph -run TestSortFindingsIsTotalOrder -count=1`、`go test ./codegraph ./cli -count=1`、`go build ./...`、`go vet ./...`、`gofmt -l .` 均通过。
- 双裁决：规格符合（只改排序全序及其测试）；代码质量通过（nil Edge 排序与非 nil 两端均有确定比较，注释说明根因）。
- commit 范围：`35dddd42e3e9`（T0 实现，ledger 在本卡提交中补入）。

## TC：Diff.containersAdded 全链路

- 范围：`types.go`、`merge.go`、`validate.go`、`absorb.go` 及对应测试；补字段、视图合并、diff 门禁、基线回灌和 JSON 边界。
- 红因：`TestMergeContainersAdded` 先因 `View.Containers` 不含 `k_new` 失败；四个 ValidateDiff 测试分别先因未放行新增容器、未检查冲突/空 domain/未知 domain 失败；`TestAbsorbContainersAddedAndValidate` 先因 Absorb 未回灌容器失败。
- 验证：上述红测均以功能缺失失败后转绿；`TestValidateDiffStillRejectsNodeInUnknownContainer` 保持未知容器报错；`go test ./codegraph ./cli -count=1`、`go build ./...`、`go vet ./...`、`gofmt -l .` 均通过。
- 双裁决：规格符合（仅允许 baseline 或 containersAdded 的引用，新增容器需新 id 且归属 baseline domain）；代码质量通过（Merge/Absorb 均复制容器表，不污染入参，issue 含 id 与原因）。
- commit 范围：`c8ba90389874`（TC 实现，ledger amend 后纳入本卡提交）。

## T1：漏建三类判据

- 范围：`check.go`、`fitness.go`、`check_test.go`；补 `dead-entry`、`dead-interface`、`dead-contract`，并补当前分支缺失的 Ticket 0 kind/阈值/签名骨架。
- 红因：三个 reconciliation 测试组先因 Check 没有对应 finding 失败；失败均为功能缺失。`TestCheckTable` 的“域内边不检查”夹具改为不声明跨域契约，因为新判据下声明方向零边是真阳性；这是夹具语义修正，不是放宽判据。
- 验证：三类 finding 全部进 Fails；implements 与 assembly 豁免边均计为活；`go run ./cmd/codegraph check --repo ./codegraph/testdata/repo` 实测输出 `fails: []`、`warns: []`；`go test ./codegraph -count=1`、`go test ./cli -count=1`、`go build ./...`、`go vet ./...`、`gofmt -l .` 均通过。
- 双裁决：规格符合（R2 按目标子系统收窄、R3 合并 call/implements/assembly 活边，Check 签名未变）；代码质量通过（Finding.Detail 含方向、原文条目与期望子系统，deleted 节点/边不参与）。
- commit 范围：`da761c7b9368`（T1 实现，ledger amend 后纳入本卡提交）。

## T2：fitness 判据 1/2

- 范围：`fitness.go`、`check.go`、`fitness_test.go`；实现 `prefix-family` 与 `oversized-package`，从 `Check` 追加到 Warns。
- 红因：空的 prefix/oversized 纯函数及未接线的 Check 先使共享五字符、40 文件和 Warn 档测试失败；失败为功能缺失，不是编译错误。
- 验证：真实最长公共前缀、成员不足、前三字符、跨目录、40+子目录、39 文件和 Warn/Fails 分流测试均通过；`rg` 未发现 `os.ReadDir`、`filepath.Walk`、git 或 `os/exec`；夹具 check 仍为 `fails: []`、`warns: []`；`go test ./codegraph ./cli -count=1`、`go build ./...`、`go vet ./...`、`gofmt -l .` 均通过。
- 双裁决：规格符合（仅消费非 deleted 视图文件集、使用 `/` 路径和真实 LCP，阈值不可配置）；代码质量通过（排序确定、无文件系统副作用、Detail 含目录/数量/阈值及架构法回答提示）。
- commit 范围：`1a64905c003d`（T2 实现，ledger amend 后纳入本卡提交）。
