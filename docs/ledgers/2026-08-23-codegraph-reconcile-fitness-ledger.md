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
