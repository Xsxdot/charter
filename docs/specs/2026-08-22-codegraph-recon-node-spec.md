# Spec：charter 流加「图对账」列 + 视图 diff 产出归位

> 状态：已批准（2026-08-22，用户裁决：不走 plan/派发，协调者直接实现）
> 级别与档位：**L2**（charter 仓法条修订 + handoff 侧纯数据配置；零代码、不动 codegraph schema 与任何 wire 契约）→ plan → implement → review → acceptance → finish

## 问题陈述

视图 diff（`codegraph/diffs/<分支>.json`，`--view` 叠加查询的载体）在整条流程里**法上无人**：

- charter 的 contract/implement/plan 三个 skill 正文对「视图 diff 的产出」零提及（grep 实测）；搬迁 breakdown 里那条产出 task 是 plan 作者临场写的，不是节点纪律。
- 后果一：contract 的 Ticket 0 骨架引入新契约符号却不入图，breakdown/plan 的图查询命中不了新符号，只能记覆盖债。
- 后果二：合并前无人核对「图记的」与「代码实际改的」是否一致，漏建直到 absorb 才暴露（或永不暴露）。
- 合并后的 absorb 是唯一有法定位置的一环（charter:finish 第 4 步），不在本次问题内。

## 方案（含弃选与理由）

图活按时点归属，只节点化一处：

1. **骨架入图 → 归 contract 节点纪律，不加列**。视图 diff 是契约产出物的一部分，与骨架同一提交；产出者即契约执行者，上下文最全。
2. **合并前对账 → charter 流（handoff 工作流，当前 v2）加一列「图对账」**，插在 integrate 与 finish 之间。Dispatch+Verdict：核对 BASE..HEAD 与视图 diff 一致，缺漏由对账执行者补齐提交；无法机械补齐的矛盾裁决未过，停本列重试，超轮转等人。
3. **absorb → 留 finish 纪律不动**，「先合并后回灌」的顺序由同一执行者串行保证；finish 第 4 步补一句前置「absorb 前确认对账已过」，作为无卡（不走 handoff）分支的同纪律投影。

弃选：
- **前后各一列（对账 + 专职 absorb 列）**：absorb 列要在 main 上提交（外部可见、需 HumanBases 保护），与 charter:finish 第 4 步双源漂移，派发开销大于一条命令。
- **图对账塞进 review 裁决维度**：review 已双轴七维载重；其 OnFail 退实现列，图漏建误退整轮代价过重。
- **对账列兼管产出（plan 不再写产出 task）**：扫描者变成从 diff 反推意图的零上下文执行者，正是 B173 假边的来源；节点定位为兜底，不接管。
- **出厂流（feature/domain/bug）同步加列**：涉 handoff Go 代码（workflows.go seed），且出厂流服务无 codegraph 生态的通用用户；本期不做（见 OOS）。

## 用户故事

1. 卡走 charter 流，integrate 裁决通过后自动进「图对账」列；执行者按扫描配方核对 BASE..HEAD 与本分支视图 diff，补齐缺漏并提交到工作分支，裁决通过后卡进 finish。
2. 分支未引入新符号（纯改行为的修复）：执行者裁「本分支合法无视图」通过，不造空文件。
3. 项目无 `codegraph/` 目录：直接裁决通过（同一条流服务有图/无图项目，不拆流）。
4. 图与代码存在无法机械补齐的矛盾（如图记了代码里不存在的符号）：裁决未过，卡停在「图对账」列，重试超轮（2 轮）打等人标记，人来裁。
5. contract 执行者提交骨架时，同一提交含骨架符号的视图 diff；随后 breakdown/plan 用 `--view <分支>` 查图即命中新契约符号。

## 实现决定

**charter 仓（法条）**：
- `skills/contract/SKILL.md`：补条款——Ticket 0 骨架引入的符号必须以视图 diff 入图，与骨架同一提交；breakdown/plan 的图查询以 `--view <分支>` 叠加。
- `skills/finish/SKILL.md` 第 4 步：absorb 前置一句「图对账已过（有对账列的流看列裁决；无卡分支此刻人工核对）」。

**handoff 侧（纯数据，属「驱动 handoff 自身」的活，归审核者本地执行，不派发；实现时复核修订：charter 流 v2 的惯例是统一模板 `charter-default` + `override.discipline` 换 charter-* 纪律块，不是每节点独立模板，落地形态随之调整）**：
- 新纪律块 `charter-recon.md`（落协调侧与执行侧两处 `~/.handoff/discipline/`，Executor 沿用模板缺省 codex——对账补图要精确、防假边，稳重优先）：正文要点 = 无图项目直接裁 pass / 按扫描配方与 B173 边解析纪律核对补齐 / 「合法无视图」的裁定口径 / 无法机械补齐的矛盾裁 fail / 禁动 baseline 与业务代码。
- charter 流发布 v3：integrate 与 finish 之间插入节点 `{name: "图对账", template: "charter-default", override: {discipline: "charter-recon"}, dispatch: true, verdict: true, carry_card_context: true, max_rounds: 2, next: "finish", on_fail: ""}`（OnFail 空 = 停本列，`internal/ledgerstep/node.go:80-83` 现状语义；超轮等人 `node.go:139`）。无 Gate——Gate 只认卡附件不认文件系统（`internal/ledger/workflows.go:80` 注释，现状读数）。
- contract 列零改动：其纪律来自 `charter-contract.md` 纪律块（正文即 charter:contract skill 的执行者适配版），法条修订随纪律块同步生效，无独立模板 prompt 可改。

## 测试决定（接缝清单）

接缝一个：**「图对账」列的真机过流**。本改动为文档+配置，无单元测试面；验收 =
1. `handoff template put codegraph-recon` 成功、charter 流 v3 发布成功（工作流钉版本，存量卡不受影响，新卡走 v3）；
2. 下一张走 charter 流的真卡在 integrate 通过后确实派发对账轮，且五个用户故事中至少命中 1（有改动补齐）或 2/3（合法跳过）之一；
3. charter skills 修订过 review（文档对账：法条与模板 prompt 口径一致）。

## Out of Scope

- 出厂流 feature/domain/bug 加对账列（本期不做；若后续要做，涉 handoff 代码，另走流程）。
- 刀 3 `reconcile` 工具（已在 roadmap；落地后 codegraph-recon 模板 prompt 换成调工具，节点形态不变）。
- absorb 的任何位置或语义变更（明确不动）。
- codegraph schema、handoff Go 代码、Gate 机制扩展（如「认文件系统的门」——不做，对账用 Verdict 承载）。
- 无图项目拆独立流（用 prompt 守卫替代，不拆）。

## 备注

- 图覆盖债：本 spec 引用的 handoff 侧行号为 grep/读码实测（handoff 仓基线新鲜，`codegraph sym Workflow` 命中 `m_ledger_Workflow` 佐证）；charter 仓自身无图。
- 后续要做项已在 roadmap 的：刀 3 对账工具化（本列即其挂载点）。新增落账：无。
