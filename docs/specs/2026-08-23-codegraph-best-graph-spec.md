# Spec：codegraph 最优图（best.json）

**卡**：C1.8（父卡 C1）
**级别与档位**：**L3 轻档**。跨仓：`target.json` 与新增 `best.json` 都是 charter `graph` 模块与 handoff 之间的文件格式契约，改 schema 即动契约层。工作量集中在 `graph/codegraph` 单包，远低于流程固定成本阈值，故轻档：contract → breakdown → 单轮 implement。
**状态**：核心裁决**已获用户批准（2026-08-23）**——用户选定「best.json 接管整棵结构树」并指示「开吧，不等了」。**contract 期对棘轮落点做了一处自我修正（见「实现决定」第 3 条），已收口：该修正随 C1.8 契约批准与实现合并生效，2026-08-25 经 C9 载体法 spec 批准一并确认过目。**
**补写说明**：本 spec 补写于 contract 之后。用户直接指令开 contract，设计对话发生在会话里而非 spec 文档里；补写是为了让判决、Out of Scope 与残余落账有落点，不是走形式。

---

## 问题陈述

代码图今天读不懂，根因是**架构问题不是显示问题**——所以处方是「给一张最优图逐步迁移」，不是「给烂架构装拐杖」（用户在批次二立项时的奠基裁决）。

C1.1 造的目标图机制用 `TargetDomain.Paths` 表达领域归属。用户明确更正：

> 「对于目标域=一个包目录，这个我从未说过。我期望的目标图，或者应该说叫最优图，就是基于当下代码实现的功能，最优的子系统/领域结构应该是什么样子的，比如现在的基准是 baseline.json，那这个最优图应该叫 best.json」

**路径规则能表达的「应然」上限只有「把文件挪进这个目录」**，因此它无法表达任何不与目录同形的职责划分——这与项目配方自己的教条「领域是职责，不是目录」（`docs/codegraph-scan-recipe.md`:142）直接冲突。

## 方案

**选定：best.json 接管整棵结构树，target.json 瘦成契约面。**

- `best.json`：最优的子系统 + 领域 + 每个容器的归属。`baseline.json` 的姊妹文件。
- `target.json`：只剩 `contracts`（允许的依赖方向 + `legacyBudget`）与 `assembly`；`subsystems[].paths` 与 `TargetDomain` 删除。
- 归属决议从「文件 → 路径规则」改为「容器 → 领域 → 子系统」，用图不用路径规则。

**弃选一：best.json 只加领域层，target.json 保留 subsystems 与 paths。** 改动面最小，但子系统那一层继续用目录当职责的代理，「领域是职责不是目录」只在下半层生效。用户明确否决。

**弃选二：按节点归属。** 3564 个决策，人不可审。实测容器 100% 子系统纯，细到节点零收益。

### 实测支撑（handoff 重扫前 baseline：3564 节点 / 237 容器 / 4522 边）

1. 231 个有文件的容器中，**跨子系统的 0 个、跨目录的 0 个** → 容器是正确的归属粒度。
2. 231 容器分布在 65 个目录，**59/65 含多个容器** → 容器比包更细，best.json 能把一个包切进两个领域。这就是相对路径规则的全部增益。
3. 13 个叶子域对 10 个子系统，**9 个已 1:1 干净**；脏的只有 4 个，最脏那个（`d_coordination_task` 横跨 4 子系统）正被 B223 拆掉。
4. **归属等价性**：只要最优树至少与子系统分区同样细，新旧 `SubsystemOf` 逐字相同，20 条 `legacyBudget` 无需重标定。

## 实现决定

1. **子系统就是顶层领域。** baseline 的领域已是带 `Parent` 的树；target.json 的 subsystems 是另一套顶层分组。两套词汇并存正是图读不懂的病根之一，合并成一棵树。
2. **归属粒度是容器**，由人编写、不由扫描产出。
3. **四条 gap 判据全部 warn，不新增棘轮。**〔**contract 期自我修正**〕会话中曾提议「棘轮套 `container-misplaced` 当迁移进度条」。查证时发现 C1.1 拍板记录二明确否决过容器清单原语，理由是「会把『图上落位、代码没动』变成可通过的自欺」——**该反对意见成立**。容器错位靠改标签即可消解，设为 fail 等于给改标签发进度奖。不可伪造的进度条是**边的合法性**，已由既有 `new-direction`/`over-budget`/`legacyBudget` 棘轮承担，本刀只换它们的归属输入。`unplacedBudget` 整条删除，改动因此比原提议更小。
4. **`codegraph migrate` 从 v2 target + baseline 机械生成 best 初版**（扁平、只有顶层、`Responsibility` 是显式占位符）。所以 C1.6 不是手写 239 条归属，是在初版上编辑。
5. **`best == nil` 时连契约执法一起跳过，且 CLI 必须显式喊出**。两个 nil 入参后果不对称：`decls == nil` 只关锚判据，`best == nil` 关主判据。

## 契约语义与接缝（L3）

- **接缝只有一个**：`Check` 的归属决议入口。今天是 `Target.SubsystemOf(file)`，改后是 `容器 → Best.DomainOfContainer → Best.SubsystemOf`。四个调用点（`check.go:64/140/160`、`domains.go:133`）全部收口在此。
- 跨仓 wire：`best.json` v1 与 `target.json` v3 两个文件格式。handoff 是唯一消费方。
- 允许的新依赖方向：无。`graph/codegraph` 不引入新第三方依赖。

## 测试决定

- **主接缝**：归属决议。一支**等价性测试**锁死它——拿 handoff 的 v2 target + migrate 生成的 best 初版，断言两套 `SubsystemOf` 对全部节点给出相同答案。这一支同时是「20 条 legacyBudget 不用重标定」这个论断的执法者。
- `best.json` wire 形状：JSON 金样本（**contract 期已落，含变异复验**）。
- 四条 gap 判据：各一支最小用例；`Best.SubsystemOf` 的环保护单独一支。

## Out of Scope

**永不做**：

- 按节点归属（弃选二）。
- 为 `best.json` 保留一套「路径规则回落」——保留它，路径规则就永远死不掉，本刀等于白做。

**本期不做、后续要做**（已落 `docs/roadmap.md`）：

- 写 handoff 的 `best.json` 正文（= C1.6，需用户拍板树内容；被 B223 阻塞，因为归属按容器 id 声明而重扫正在增删容器）。
- `ValidateTarget` 无法自校验 `contracts[].from/to` 是否指向存在的最优图子系统（它读不到 best）。本期下沉为 check 期的既有 `dead-contract` 行为，独立的引用完整性校验留后。
- best.json 的编辑体验（查看器里改归属、批量重挂）——C1.3 已搁置，此项与之同族。

## 备注

C1.1 的产出不是全废：棘轮机制、findings 接进 `Check` 的接线、`sortFindings`、判据的三段形态全部存活。死的是 `TargetDomain.Paths` 这一个原语及其路径规则函数族。**作废成本此刻为零**——handoff 的 target.json 至今未写过任何 `domains` 条目。
