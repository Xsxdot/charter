# B191 视图标识双形态执行 ledger

- 分支：`cards/B191-charter`
- 起点：`1682381`
- 范围：仅 `graph/` 的 Task 1；不改 handoff 仓。

## 进度记录

| 时间/任务 | 记录 | commit 范围 |
|---|---|---|
| Task 1 修复轮 1（红测） | 补齐 LoadDiff 文件名、view 字段回退、歧义、未知清单、非不存在错误与 CLI 双形态端到端测试。修前 `TestLoadDiffFallsBackToViewField` 原始失败如下。 | Task 1 工作树（待提交） |
| Task 1 修复轮 1（实现） | 双裁决通过：LoadDiff 文件名优先、仅 `IsNotExist` 回退、歧义列候选、未知清单超过 20 条截断并标总数；Diff 携带非 JSON 回退提示，由 CLI 写入 stderr；5 条包测与 CLI 端到端覆盖齐全。 | Task 1 工作树（待提交） |
| Task 1 完成 | 通过 `go test ./...`、`go build ./...`、`go vet ./...`、`gofmt -l .` 无输出、`git diff --check`；未改 handoff 仓。 | 本次 Task 1 提交 |

## 修前红测原文

```
--- FAIL: TestLoadDiffFallsBackToViewField (0.00s)
    load_test.go:54: 按 view 字段回退读取: 读取视图 /root/.handoff/tasks/59982a4b-80a1-4936-9f9f-03aa3ee45db9/tmp/TestLoadDiffFallsBackToViewField420037327/001/codegraph/diffs/branch:x.json: open /root/.handoff/tasks/59982a4b-80a1-4936-9f9f-03aa3ee45db9/tmp/TestLoadDiffFallsBackToViewField420037327/001/codegraph/diffs/branch:x.json: no such file or directory
FAIL
FAIL	github.com/Xsxdot/charter/graph/codegraph	0.002s
FAIL
```
