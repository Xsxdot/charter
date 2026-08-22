# Spec：codegraph 搬迁（图工具批次 · 刀 0）

> 日期：2026-08-22
> 状态：**已批准**（2026-08-22，用户批准后回写）
> 级别：**L3 轻档**（跨 charter/handoff 两仓契约；单侧工作量不超流程固定成本 → 轻档：契约冻结与拆解照做，实现归一轮）
> 上游：`~/workspace/handoff/docs/2026-08-22-codegraph-batch-handover.md`（刀 0 裁决已回写该文档 §三）

## 问题陈述

codegraph 是 charter 流程的执法工具（架构法附则的 graph check 硬闸、spec/plan/contract/breakdown 的图查询），却长在 handoff 体内——charter skills 写死 `handoff graph ...`，法与工具异仓，四刀 schema 批次在即，每次「法 + 工具」联动改都要跨仓同步一轮。同时按「判据归 charter、工具可替换」的剥离原则，流程的执法工具不应锁死在某个具体派发系统体内。搬迁窗口是最后时机：graph 目前 42 提交、占 handoff 非测试代码 3.4%，刀 1（schema v2）落地后消费者增多、搬迁成本单调上升。

## 方案（含弃选与理由）

- **A（选定）：charter 仓嵌套 Go module**。`charter/graph/`（module `github.com/Xsxdot/charter/graph`），二进制名 `codegraph`；handoff 单向依赖该 module（前端 loader + 薄别名）。理由：四刀全是法+工具联动改，同仓才有原子提交；charter 已是每台机必装，安装只多一条命令。
- **B（弃）：独立仓独立二进制**。工具身份最中立，但法与工具异仓漂移不减、新增一条 repo 更新链与安装步骤，对单人生态是纯开销。
- **C（弃）：留在 handoff 原地**。零搬迁成本，但法-工具漂移持续、工具与派发系统绑死，与本轮已定的剥离方向（product-backlog 账本退 handoff、判据留 charter）相悖。

## 用户故事

1. 有 Go 的开发机：clone charter 后一条 `go install`，`codegraph sym <符号>` 在任意有 `codegraph/` 的仓库可用，输出与搬迁前 `handoff graph sym` 一致。
2. 无 Go 但装有 handoff 的机器（执行机）：`handoff graph ...` 全部子命令照常工作，行为与搬迁前一致，零新增安装。
3. 无 Go 且无 handoff 的设备：从 charter 仓 release 下载预编译二进制（或 install 脚本）后 `codegraph` 可用。
4. handoff Web 控制台的 codegraph 页照常渲染（baseline/views/stale 三段数据不变）。
5. charter skills（spec/contract/breakdown/plan/using-charter 及全局 CLAUDE.md）中的图查询引用改为 canonical 的 `codegraph ...` 命令串。
6. handoff 仓不再存在 `internal/codegraph` 源码，`graph` 子命令成为委托别名并标注 deprecated。

## 契约语义与接缝（L3 段——定语义，不定签名）

- **module 面（新契约）**：`charter/graph` 的导出面 = 现 `internal/codegraph` 导出面原样迁移，语义零变化；精确符号清单归 contract 节点对现状代码查证。**不变式：该 module 仅依赖 Go 标准库（CLI 壳允许 cobra），零 CGO**——这是「可搬进任何工具」承诺的延续，作为契约条目冻结。
- **CLI 面**：canonical 入口 `codegraph`，12 个子命令（validate/check/absorb/views/chain/who-calls/domains/sym/entity/resolve/contract set/summary）语义不变；`handoff graph <args>` 为委托别名，行为与 `codegraph <args>` 一致，帮助文本标 deprecated。
- **数据契约（codegraph/*.json schema）本卡零改动**——schema 变更属刀 1，混入本卡即越界。
- **依赖方向**：handoff → `charter/graph` 单向（前端 loader、agentd 2 条只读 API、别名）；`charter/graph` 对 handoff 零依赖。
- **版本面**：嵌套 module 打 `graph/vX.Y.Z` tag，handoff go.mod 钉版本消费。

## 实现决定

- 搬迁物：`internal/codegraph/`（19 源文件 + 9 测试）整目录、`cmd/graph.go` + 两个测试文件，改 module 路径落 `charter/graph/`；charter 仓根不设 go.mod（module 收在 `graph/` 内，skills 目录不受影响）。
- 分发三通道：`go install`（有 Go）；`handoff graph` 别名（无 Go 有 handoff——handoff 的预编译分发链不需要目标机有 Go）；charter 仓 release 六平台 `CGO_ENABLED=0` 预编译 + install 脚本（无 Go 无 handoff；模式照抄 handoff `install.sh` 的探测/校验骨架，删掉用不上的部分）。
- `codegraph version` 内嵌 commit 哈希——缓解「装好的二进制 vs 仓库 HEAD」漂移，charter 更新后一条命令重装。
- darwin 二进制首版不做 codesign/notarize（`go install` 本地构建无 quarantine；curl 安装遇 Gatekeeper 记录 `xattr` 绕行说明），真痛再抄 handoff 的公证链。
- handoff 侧：删 `internal/codegraph`，`cmd/graph.go` 改写为对新 module 的委托（含 deprecated 标注），`internal/agentd/codegraph.go` 与 `cmd/graph_gate_test.go` 改 import。

## 测试决定（接缝清单）

接缝一个：**module 导出面**。测试全部压在它上：

1. 搬迁等价性：graph module 自带的全部既有测试（1244 行）在新家全绿；
2. 反向消费面：handoff 仓改依赖后全量编译 + `graph_gate_test`（对 handoff 自身 baseline 跑 check）全绿；
3. 别名等价性（真机清单，归协调者）：同一仓库上 `handoff graph sym/check/entity` 与 `codegraph sym/check/entity` 输出一致；
4. release 产物命名与六平台构建通过（workflow 内断言）。

## Out of Scope

- 刀 1~4（schema v2 术语迁移、领域图、图 diff 对账、fitness 判据）——承载物：交接文档 §三，刀 0 合并后继续开 spec；
- agentd 内嵌纪律块（`internal/discipline/builtin/`）中 `handoff graph` 文案的改名——别名长期可用，随刀 1~4 批次一并改；
- `handoff graph` 别名的最终移除时点——deprecated 观察期后另行裁决；
- darwin 签名/公证、codegraph 对外开源发布；
- 各项目仓 codegraph 数据与扫描配方（`codegraph-scan-recipe.md`）——数据契约不动，配方引用的派发命令不动。

## 备注

- 现状读数（2026-08-22 探索 agent 实测，contract 节点对工作树复核）：`internal/codegraph` 非测试 1848 行、仅 import 标准库，包注释明写可整体搬迁（`internal/codegraph/types.go:9-11`）；`cmd/graph.go` 498 行、依赖仅 cobra + 本包（`cmd/graph.go:15-25`）；反向耦合为 agentd 130 行 2 条只读路由（`internal/agentd/server.go:499-500`）+ 契约闸测试；graph 平台相关逻辑共 3 行，零 CGO、零解析器（图数据由 AI 扫描配方产出）。
- 图覆盖债：本 spec 引用的 handoff 侧行号出自探索 agent 的 grep 读数（未走图查询），contract 落地时以 `handoff graph resolve` / 实际读码复核。
