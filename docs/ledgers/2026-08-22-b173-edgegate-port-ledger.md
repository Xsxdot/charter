# 实现账本：B173 调用边门控移植（handoff → charter/graph）

> 背景：handoff 仓 B173 排查会话按老世界（`internal/codegraph`）实现了调用边门控，与刀 0 搬迁（该包已删、`cmd/graph.go` 已改别名）撞车。处置：代码半移植到 canonical 家（本仓 `graph/`），数据半（基线清洗、配方纪律）留 handoff。plan of record = handoff 仓 `docs/superpowers/plans/2026-08-22-b173-edgegate.md`（分支 `claude/b173-investigation-886cbf`）。

## 移植内容（2026-08-22）

- `graph/codegraph/edgegate.go` + `edgegate_test.go`：自 handoff 分支 `8dad9f07d` 原样拷入（stdlib-only 约束在新家同样成立，零改动）。
- `graph/cli/cli.go`：validate 接 `CheckEdges`（基线 + 每视图合成节点集）、输出补 `edgeIssues` 字段；absorb 拒收含假边视图。四处 hunk 与老家 `cmd/graph.go` 接线逐字对齐。
- `graph/cli/cli_test.go`：新增 `TestGraphValidateEdgeIssues` 锁 wire 契约键（新行为新测试）。

## 验证（全部本轮跑出）

- TDD 红灯两次：包侧 `undefined: CheckEdges`（编译红）→ 拷实现转绿；CLI 侧 `TestGraphValidateEdgeIssues` 先落盘 FAIL（缺 `edgeIssues` 键）→ 接线转绿。
- `go test ./... -count=1` 全绿（cli + codegraph）；`gofmt -l .` 空；`go vet ./...` 零输出；`CGO_ENABLED=0 GOOS=linux` 编译过。
- **真机等价复验**（scratchpad 解包 handoff main 快照 + b173 worktree 只读）：
  - 未清洗基线（4748 边）：`edgeIssues` = 106（no-import 90 + cross-language 16）——与 B173 plan §0 判据 2 逐字一致；
  - 清洗后基线（4642 边）：validate 绿、`edgeIssues` = 0、`check` = 18 fails（new-direction 4 + over-budget 14）——与 §0 判据 3 逐字一致。

## 交棒（handoff 侧残余，待其合并刀 0 分支后做）

1. go.mod `charter/graph` 升 v0.2.0，取门控与 absorb 拒假边行为；
2. B173 分支只取文档/数据提交（跳过代码提交 `8dad9f07d`）；基线清洗 cherry-pick 撞冲突就用 v0.2.0 `validate` 重报假边重跑清洗（机械可复现）；
3. target.json 重标定（4 真方向 + 14 预算）按 B173 plan 走 `charter:contract` 裁决。
