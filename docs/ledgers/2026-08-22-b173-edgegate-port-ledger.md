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

## 交棒（2026-08-22 晚收敛后更新）

收敛已完成（handoff main = 1334ba9fb，本会话协调执行）：B173 分支在收敛前已被整体合入 main（含代码提交），故「挑提交」失效，改为**合并 extraction 时取别名版 cmd/graph.go + 显式 git rm edgegate 孤儿两文件**；go.mod 已升 v0.2.0；absorb 后 validate 全绿，check 16 红（list 16 = unique 14 + d_release→d_remote ×3），与沙箱预演逐条一致。

**唯一残余**：target.json 重标定（2 唯一方向 + 12 预算）按 B173 plan 走 `charter:contract` 裁决，挂 handoff 仓 B173 卡。

## v0.2.1 门控增强（2026-08-22 晚，用户拍板「1 和 3 你直接做」）

范围：CheckEdges 判据三（unexported，`exportedName` 只看末段不看 receiver）+ 判据四（包级函数文件粒度 import，`fileCache`/`goFileImports`；方法保持包粒度）；Reason wire 值增 `"unexported"`；契约修订 R7。
验证（全部本轮）：TDD 双红（改写包粒度测试语义 + 新 TestCheckEdgesUnexported，实现前 FAIL）→ 实现转绿；两判据各永假化变异 → 各自测试红、还原绿；全模块测试/vet/gofmt 绿。**真机**：对 handoff main 清洗后基线（4524 边）跑出 2 条手工清洗漏网假边（update.go 的 `url.Values.Encode` 撞 `relay.Encode`；grok/resume.go 对 turn 零 import 零提及），逐条源码查证均为真假边、零误伤——B173 会话「升级后应仍 0」的预言差 2 条，差的方向是工具更强。

**独立复验（B173 会话，2026-08-22 晚，handoff B173 卡 note seq 75）**：对 origin/main 数据独立跑判据，全部命中（基线 3564/4537、check 16=4 方向+12 预算、edgegate 两文件确不存在）。18→16 消失的 2 条 over-budget（d_cli→d_contract、d_controlplane→d_contract）定性为**真实结构变化**：d_contract paths 移除 `internal/codegraph/**` 后入边不再计入，两版 target.json 的 legacyBudget 数字逐条比对零改动——不是调数字修红。
