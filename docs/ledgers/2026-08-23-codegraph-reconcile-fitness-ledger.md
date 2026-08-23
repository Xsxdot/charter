# codegraph 刀 3+4 实现账本

## T0：sortFindings 全序

- 范围：`graph/codegraph/check.go`、`graph/codegraph/check_test.go`；补 `From`/`To`/`Edge` tiebreak 与稳定性测试。
- 红因：`TestSortFindingsIsTotalOrder` 在仅按 `Kind+Detail` 时因 `slices.SortFunc` 不稳定而失败，报为两种排列结果不同；不是编译错误。
- 变异复验：暂时移除 tiebreak 后同测试再次失败，恢复后通过。
- 验证：`go test ./codegraph -run TestSortFindingsIsTotalOrder -count=1`、`go test ./codegraph ./cli -count=1`、`go build ./...`、`go vet ./...`、`gofmt -l .` 均通过。
- 双裁决：规格符合（只改排序全序及其测试）；代码质量通过（nil Edge 排序与非 nil 两端均有确定比较，注释说明根因）。
- commit 范围：`35dddd42e3e9`（T0 实现，ledger 在本卡提交中补入）。
