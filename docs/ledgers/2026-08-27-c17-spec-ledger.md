# C17 spec 台账（2026-08-27）

本文只放过程与原始读数；裁决与结论在 `docs/specs/2026-08-27-flow-subject-is-contract-spec.md`。

## 读数 1：C12 实现里导航与实现下钻已经有一半

`FlowPageView` 现状（master / C17 工作树同源）：

- 页内 `stack` + `goBack`，「← 返回上一张（第 N 层）」仅在 `stack.length > 1` 时出现。
- 装配层 `CodegraphPage` 另有「← 返回结构轴」。
- 祖先链 `data-flow-trail` 只展示、不可点。
- 实现列表挂在「选中步骤且 `iface=true`」里，按钮文案「看它的流程图」，`openEntry(impl.entryNodeId)`；`entryNodeId` 空则「无入口记录」。
- 右栏两 tab：基本信息 / 调用链（给 agent）。没有被谁调用，没有到达通道段。

C12 契约 §2.4-35 已写「每个实现的入口即其流程图起点」；C12 原型 `behav-flow.html` 已有实现下钻链接和「← 回到调用它的接口那一层」。缺口是主语被理解成 CLI/HTTP，以及谁调用、CLI `flow` 两条从未做。

## 读数 2：CLI 没有 flow

`graph/cli/cli.go` 根命令挂载：validate / check / absorb / views / chain / who-calls / context / domains / sym / entity / resolve / contract / summary / version / migrate。无 `flow`。

`summary` 开局文案（同文件）只提 `sym` / `who-calls` / `chain` / `domains`。

本卡会话亲跑：`go run ./cmd/codegraph flow` 与 `flows` 均为 unknown command，exit 1。

## 读数 3：近 12 小时会话实际跑过的图命令

口径：只计 `run_terminal_command` / 台账里亲跑的 CLI；skill、纪律块、`card show` 正文、对文档的 grep 一律不算。窗口约 2026-08-27 11:13 → 当晚。探索子 agent `01a043c9-14cf-7cd3-a8bb-e8a9f0407824`。`~/.claude` 无近期 transcript 命中。近 12h `frames.jsonl` 的「【命令】」行没有 `codegraph` / `graph <sub>`。

### 本机

| 会话 | 命令 | 目的 |
|---|---|---|
| `01a042a1`（本卡，repo `/tmp/handoff-c12scan`） | `version` / `validate` / `summary` / `sym Manager.Dispatch` ×2 / `chain Manager.Dispatch` / `context d_orchestration` / `views` / `domains` / `who-calls Store.CreateCard` / `entity Task` / `check` / `flow` / `flows` | 摸 CLI 与流程图。`flow`/`flows` unknown。`chain` 27 nodes / 35 edges，无 branch/loop 次序。看流程图走的是 HTTP 查看器 + python 读 `baseline.flows`。 |
| `01a04352`（B156.2/B156.3 收尾） | `graph check --view cards-B156.2-charter-4` ×2 / `graph validate` | 契约闸，不是探索。 |
| `01a0426f` | 只打 `/api/projects/*/codegraph` HTTP | 没跑 CLI。 |
| `01a0436c` / `811b06d9` | 读 skill | 没跑图命令。 |

### 远程台账（B273 plan，linux-01）

入口是 `go run github.com/Xsxdot/charter/graph/cmd/codegraph@v0.9.0`：

- `context`：`d_ledger` / `d_protocol` / `d_gateway --max-tokens 4000` / `d_web`
- `sym` 四个符号（`waitForTurnEnd` / `ParseVerdict` / `ProtocolRules` / `ledgerNodeWire`）全 miss
- `who-calls waitForTurnEnd` / `ParseVerdict` miss
- `chain --with-source StepRunner.awaitNode` / `Server.handleFlowGet` miss
- 然后回落 grep / 读源码，记成图覆盖债

### 次数（本机 tool 调用；括号内含远程台账）

| subcommand | 本机 | +远程 | 典型目的 |
|---|---:|---:|---|
| check | 3 | 3 | 契约闸 |
| validate | 4 | 4 | 基线完整性 |
| help / version | ~3+ | 同 | 摸有没有 flow |
| summary | 1 | 1 | 开局菜单 |
| views / domains | 1 / 1 | 1 / 1 | 列视图、领域树 |
| context | 2 | 6 | 先按领域打包（B273 主入口） |
| sym | 2 | 6 | 已有名字再定位；B273 全 miss |
| chain | 1 | 3 | 下游邻域；想当「怎么走」不够用 |
| who-calls | 1 | 3 | 烟测；B273 miss |
| entity | 1 | 1 | 烟测 Task |
| flow / flows | 2（失败） | 2 | 要控制流，命令不存在 |
| absorb / resolve / contract | 0 | 0 | — |

结论写进 spec「Agent 怎么用图」节：第一跳经常是 `context`，不是行号；行号已由 `sym` 给；缺的是 `flow`。

## 读数 4：原型增量（本卡第二稿，不入库）

从 `/tmp/c12-proto` 拷到工作树 `prototypes/codegraph-two-axis/`（gitignore）。`behav-flow.html` 加了：

- 顶栏「← 上一层」（实现页回到接口图，其它页回到结构轴）
- 面包屑 `结构轴 ▸ 对外面 ▸ …`
- 右栏常驻「到达通道」「被谁调用」
- `flowmock.js` 三条手抽流程补了 `channels` / `callers`

file:// 直开路径：`prototypes/codegraph-two-axis/pages/behav-flow.html`（默认 CLI 命令图）和 `?e=e_http_post_api_tasks`（Dispatch，右栏有实现和被谁调用）、`?e=e_impl_claudecode_start`（实现图，上一层回接口）。

## 放弃的尝试

- 用本机 python grep 扫 12h 会话找 `codegraph`：命中大量纪律块 / 卡标题 / 配方正文，不是亲跑命令。改派 explore 子 agent 按 tool 调用口径重扫。
- 第三轮全量 AI 重扫：C12 后已否决，本卡不重开。

## 读数 5：调用树 vs chain（第三稿）

用户问收益是否等于 chain。对照实现（本卡先落 CLI）：

- 菱形 A→B、A→C、B→D、C→D：`Neighborhood` 里 D 出现 1 次；`BuildCallTree` 里 D 出现 2 次。把 `Once` 强制为 true 的变异让该断言红（2026-08-27，`go test ./codegraph -run TestCallTreeDownDiamondRepeatsSharedCallee` FAIL：「得到 1；若为 1 就是 chain 换皮」）。
- 向上走廊 `--through B --from A` 丢掉 C 支。只给 `--from` 失败。
- 夹具 `e_run` 无 flows：`codegraph flow e_run` 成功返回 `degraded=true` 且 `steps=[]`。

结论：向下真树 + 向上走廊 ≠ chain。`--once` 才接近 chain，所以缺省关。

## 读数 6：独立审查第四稿回写（2026-08-28）

子 agent `01a043ef` 只读审查，Critical ×3 全收：紫框机械判据、被谁调用排除 `kind=entry`、结构轴程序入口只读。Important：§2.4-35 改列入废止、§2.1-5 承重集合回写、§2.4-33/34 降级、`--through` 单独用保留 U 之上祖先（与已落码一致）、tree 子节点按名字不读 flows、砍掉 spec 里未落地的 `--with-source`/折叠同套、一颗上一层按钮、CLI 先落码记流程债。用户授权修订后推进到 finish。

## 判断

- L3 轻档不改：跨查看器 + graph CLI + 扫描配方语义，不扇出。
- 「实现的入口」= 实现方法本身，不是实现容器里的 `kind=entry`。这是第一稿没写清、会让下游再走一遍 C12 误解的承重点。
- 被谁调用 depth 1 即可；更深是已有 CLI，不必在 UI 再造一棵上游树。
- 「调用链（给 agent）」tab 本期不删，避免和 C12 冻结项缠成第二张卡。
