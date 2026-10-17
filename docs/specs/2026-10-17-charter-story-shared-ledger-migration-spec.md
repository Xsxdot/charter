# 新法入共享账本：charter 原名升版 v13

- **状态**：r4 **已批准**（用户，2026-10-17）。裁决：方案 B；v13 带上 v12 的 `squad` 与 `board`；E2.1–E2.3 在 v12 上移到「已完成」，只迁 E2、E2.4、E2.5。
- **级别与档位**：L3 轻档。跨三处：charter 仓（流定义、安装脚本）、驾驶手册（`product-backlog`、`handoff` skill、全局 CLAUDE.md 的一条指针）、共享账本状态。不新增接缝（workflow def 格式与 `workflow migrate` 都是 handoff 既有公开面），**不进 contract**。
- **台账**：`docs/ledgers/2026-10-17-charter-story-shared-ledger-migration-ledger.md`
- **上游**：`docs/specs/2026-09-22-charter-story-spine-and-staged-contract-spec.md`（r3 批准，r4 翻案 §4.2）、`docs/charter-story-pilot.md`、roadmap 第 66、67 条。

## 一、问题陈述

新法已合入 master：故事驱动、条件 contract、阶段验收与最终验收分列，r4 起首故事做第一张子卡。共享账本里只有 `charter v12`。v12 在两处从机器层面挡住新法：

1. **breakdown 门要 contract 附件**（现状读数：共享账本 `handoff workflow show charter` 的 Def，breakdown `gate.require_attachment = "contract"`）。新法里，没有新接缝的 L3 卡会跳过 contract，在 v12 上就只能造空附件过门，而 r3 明令禁止这样做。
2. **只有一列 `acceptance`**。integrate 没有「全部子卡完结」门，成功边是 `review→acceptance→integrate→图对账`。

**2026-10-17 的新事实**改变了取舍：

- mac-02 不再使用，共享账本只剩本机一个使用者。
- 当天已按用户指示清理在飞卡：B407 及非待办卡共 16 张移到「已完成」，另 7 张待办卡「搁置」。在飞的只剩 E2 与 E2.1–E2.5，6 张全在「待办」，全部钉在 v12。

方案 A（并存第二条流）原先的理由是保护 mac-02 的选择权和大量在飞卡，这两个理由都已不在了。A 的代价却是永久的：handoff 没有删流命令，账本会永远是双流，此后每个建卡入口都必须显式写流。B 让账本始终只有一条流，建卡命令一行不改。

## 二、方案

### 采用：B. 新法写成 `charter` 的 v13

- **仓**：`flows/charter.workflow.json` 的内容换成新法定义，即现 `flows/charter-story.workflow.json` 的列与门，外加第四节的对齐项。旧定义以账本 v12 为准：仓里历史版本缺 v12 的 `squad`，与 v12 不等价，所以第 3 步之前先把 `handoff workflow show charter --version 12` 的 Def 只读导出，入仓为 `flows/charter.v12.snapshot.json`，作为回退 v14 的唯一来源。
- **账本**：`workflow put charter` 得到 v13，新卡自动落到 v13。
- **E2 组**：E2.1–E2.3 已实现并合入 main，且各有 `acceptance_recorded`（E2 评论 seq 23692），但仍停在「待办」。推荐在 v12 上先把这三张 move 到「已完成」（第九节第 2 问），然后只把 E2、E2.4、E2.5 三张逐张 `workflow migrate --workflow charter --column 待办` 到 v13。migrate 必须在**任何一张 E2 卡 split 或推进之前**做完，原因在下一条。
- **为什么要 migrate**：`SplitCard` 只传流名，取的是最新版（`merge.go:118`，`prepareCard` 调 `GetWorkflow(name, 0)`）。v12 父卡在升版后 split 出来的子卡是 v13，同一棵树就会混两套列。隔离账本已复现：v1 父卡升版后 split，得到 `workflow_version:2` 的子卡。
- **纪律块与模板沿用 `charter-story-*` 名字**，只有流名用 `charter`。理由：派发时纪律块按名字取**最新版**，不跟工作流版本钉住（纪律块名取自卡钉住版本的 `node.Override.Discipline`，见 `ledgerstep/runner.go:350`；正文由 `agentd/cardstep.go:348-353` 闭包里的 `GetDiscipline(n, 0)` 取最新版，经 `discipline/dispatch.go:80` 的 `ResolveDispatch` 注入。模板同理，见 `ledgerstep/dispatch.go:236,566` 的 `GetTemplate(name, 0)`）。新法若复用 `charter-*` 名字写新版本，旧法正文就被覆盖成历史版。将来回退到「内容等于 v12」的 v14 时，派发拿到的仍会是新法正文，回退不干净。沿用 `charter-story-*`，v14 引用的 `charter-*` 仍是旧法正文，回退干净；仓里的纪律块前缀、安装脚本、测试也不用改名。

### 弃选

- **A. 并存第二条流 `charter-story`**（r2 推荐）：理由见第一节，用户已裁决弃选。
- **C. handoff 加「缺省工作流」配置键**：单流以后没有歧义可消，不再需要。

## 三、全部必交用户故事

| ID | 谁 / 入口 | 期望观察 | 关键失败呈现 | 验证环境 |
|---|---|---|---|---|
| S1 | 本机协调者按 `product-backlog` 建顶层新卡（不写 `--workflow`） | 卡落在 `charter` v13「待办」；手册的推进表与 v13 的列一一对应 | 落在 v12；或手册让人推往 v13 没有的列（如 `acceptance`） | 共享账本 |
| S2 | 给 v13 卡 `card split` | 子卡也是 v13 | 子卡版本与父卡不同 | 共享账本 |
| S3 | E2 组处理后 | E2.1–E2.3 在 v12 上为「已完成」；E2、E2.4、E2.5 为 v13、仍在「待办」；事件流、`split_from` 关系与 E2.3→E2.4→E2.5 阻塞边都保留，迁移的卡多一条 `workflow_migrated` 事件 | 漏迁一张在飞卡（树内混版本）；关系或阻塞边丢失 | 隔离账本先演练，再在共享账本执行并核对 |
| S4 | L3 且无新接缝的卡 | 不挂 contract 也能进 breakdown；子卡无附件进不了 plan；父卡在子卡全完结前进不了 integrate 与最终验收 | 被门误挡或误放 | 隔离账本演练；共享账本首卡 |
| S5 | 控制台建卡对话框 | 单流，缺省即 `charter`，建出的卡为 v13 | 落在 v12 | 本机控制台 |
| S6 | 回退 | `workflow put charter --file flows/charter.v12.snapshot.json` 写入 v14 后，新卡落 v14、走旧法列，派发取到旧法 `charter-*` 纪律正文；此时 `check` 报漂移属预期 | 回退后派发仍拿到新法正文；v14 与 v12 不等价 | 只在隔离账本演练，不在共享账本预演 |

## 四、目标架构与语义

- **真源与方向不变**：仓是流定义与纪律正文的唯一真源，`charter_provision.py` 只做仓→账本单向安装。派发时的纪律正文取自账本，本机 `~/.handoff/discipline` 只是 regen 产物。
- **安装脚本**：
  - 管理的流名由 `charter-story` 改为 `charter`；模板与纪律块名不变。
  - 默认配置拒装这道闸（`scripts/charter_provision.py:502-508`）保留，加显式开关 `--shared` 表示「确知是共享账本」。
  - 只改常量（`WORKFLOW_NAME`/`WORKFLOW_FILE`，`provision:25,27`）install 就能写出 v13：已存在但节点不同时会走 `workflow put`，而 put 只新增版本。收尾提示（`:377`「试点新卡须显式 `--workflow charter-story`」）要跟着改。
  - `check` 对比「仓里 charter 定义 ↔ 账本 charter 最新版」。`nodes_equivalent` 只比 `nodes` 不比 `board`；带 board 时要把 board 纳入比对，否则只改 board 时 install 会跳过、check 却报一致。
- **入账前对齐账本现实**：仓里的新法定义比账本 v12 少两样，带不带由用户裁决（第九节第 1 问），定了就回写到仓里，不在账本上手补：
  - `board`：缺了不坏，控制台回落 `DefaultBoardLayout`，新增列都归「进行中」（`workflows.go:21-35`）；
  - 各派发节点的 `override.squad`：v12 是 `pro`/`runner`，缺了 `Receiver` 为空（`runner.go:347`），路由会变。
- **建卡规则**：单流，`card add` 不写 `--workflow` 即可；给已有卡建子卡优先用 `card split`。手册里「唯一的流」「缺省就是 charter」这些表述在 B 下仍然成立，**不改**。
- **手册要改的是列，不是流名**：
  - `product-backlog` 的推进章节（`:166-183,226,248-256` 等写 `acceptance` 列、L3 必走 contract 的段落）改成 v13 的列：待办→spec→[contract]→breakdown→plan→implement→review→阶段验收→[待批次]→integrate→最终验收→图对账→finish→已完成。
  - 写明越列规则：L2/bug 从 review 进最终验收；子卡从阶段验收进 finish（隔离演练证实必需）。
  - r4 首故事子卡法沿用现有「L3 重档：扇出子卡」节。
  - 全局 CLAUDE.md §2「改完跑 `scripts/regen_discipline.py` 同步纪律块」改为指向 `charter_provision.py install --shared` + `check`，只留指针。

## 五、实施顺序

0. **v12 快照与版本下限（只读）**：导出 v12 Def 入仓为 `flows/charter.v12.snapshot.json`；本机 handoff CLI 与 agentd 须含 a91eec75（`require_children_done`）和 9c2c147e（`require_attachment_any`），否则 v13 的这两道门会被静默忽略。
1. **仓内修正**：
   - `flows/charter.workflow.json` 换成新法定义；`flows/charter-story.workflow.json` 删除或改为指向前者的说明，避免出现两个真源。
   - 按第九节第 1 问补 `board`/`squad`。
   - 安装脚本改流名并加 `--shared`；测试跟改。
   - `docs/charter-story-pilot.md` 与 roadmap 第 66、67 条改为「已转正为 charter v13」的状态说明。
   - 演练脚本收进仓，增补以下探针：同名升版、旧版卡 split 得新版子卡、父子卡树 migrate、回退 v14 后派发纪律名（S6）。
   - 用隔离配置另起 agentd，补测 dispatch、produces 自动挂附件、`max_rounds` 重试。
2. **手册改稿**：`product-backlog`、`handoff` skill、CLAUDE.md 指针。改稿先就绪但**不早于第 3 步生效**，因为手册与 v13 必须同时切换。
3. **入账（同一时段内连续完成）**：
   - 先跑 `install --shared`：模板与 7 个纪律块已同名同文时跳过，否则写入；`charter` 写入 v13。再跑 `check` 一致。
   - install 之前，按第九节第 2 问的裁决处理 E2.1–E2.3（推荐在 v12 上 move 到「已完成」）。
   - install 之后紧接着依次 migrate E2、E2.4、E2.5 到 v13「待办」，逐张 `card show` 核版本、关系、阻塞边（S3）。
   - 最后让第 2 步的手册改稿生效。
4. **首卡观察**：E2.4/E2.5 仍阻塞于外部裁决（Q02/Q12/Q19），所以新建一张 L3 轻档、无新接缝的卡来验证 S4。

**回退**：`workflow put charter --file flows/charter.v12.snapshot.json` 写入 v14，手册改回，已建的 v13 卡按需 migrate 到 v14。这条路依赖第二节的纪律块分名，所以分名不能省。回退不在共享账本预演。

## 六、实现决定

- **用户可见的名字**：流名 `charter`；模板 `charter-story-default` 与纪律块 `charter-story-*` 保持试点命名；安装开关 `--shared`。
- **旧纪律块 `charter-*` 冻结在账本中**，不删、不再写新版本，作为 v12 与回退 v14 的正文。仓内 regen 只产出 `charter-story-*`。
- **账本 v12 的 squad 漂移**（账本有、旧仓定义没有）不回补旧定义；新定义按第九节第 1 问的裁决处理。

## 七、测试决定

- **隔离账本（SQLite，`ledger.dsn` 留空）**：
  - 正向路由与反向门（已有：36/37，唯一 FAIL 是预期写错）；
  - 同名升版 + 旧版卡 split 混版本（已复现）；
  - 父子卡树 migrate 保留事件、关系、阻塞边（已通过）；
  - 用 v12 快照回退 v14 与派发纪律名（待测，需要 agentd）。
- **共享账本**：只做第 3 步的写入与只读核对，加第 4 步首卡；不做探针。

## 八、Out of Scope

| 条目 | 分类 |
|---|---|
| handoff 节点入场、阶段证据顺序、禁止跳列的机械门（roadmap 67①） | 本期不做、后续要做（已在 roadmap） |
| 已「已完成 / 搁置」的卡迁 v13 | 永不做（搁置卡 revive 时再按需 migrate） |
| 纪律块与模板改名回 `charter-*` | 永不做（会破坏回退，见第二节） |
| 跨机纪律块分发（B229） | 不属于本期；mac-02 已退役 |

## 九、待用户裁决（按序）

1. **v13 带不带 v12 的 `squad` 覆写和 `board` 布局？** 推荐都带，并回写仓。不带 squad 会改变派发路由；不过你目前用本地 subagent、不走远程派发，影响较小。
2. **E2.1–E2.3（已合入 main、已有验收记录、仍在待办）怎么处理？** 推荐在 v12 上直接 move 到「已完成」，只迁 E2、E2.4、E2.5；否则迁到 v13 后它们要越列到 finish，E2 才能过 integrate 门。

## 修订记录

- r1（2026-10-17）：初稿，推荐方案 A。
- r2（2026-10-17）：按独立审阅修订 A（不可逆步骤硬前置、手册双流分节、`--parent` 消歧等）。
- r3（2026-10-17）：mac-02 退役、在飞卡清理到只剩 E2 组后，用户裁决改走方案 B。
  - 新法写成 `charter` v13，E2 组 migrate；
  - 纪律块与模板保留 `charter-story-*` 名，以保住回退；
  - 删去 A 专属的显式化、双流分节、mac-02 前置；
  - 补隔离账本对升版与 migrate 的实测。
- r4（2026-10-17）：按第二轮独立审阅修订。
  - 回退来源改为入仓的 v12 快照（仓里历史版本缺 squad，与 v12 不等价）；
  - 写明 E2.1–E2.3 实况与处理，首卡改为新建；
  - 写明安装脚本只改常量即可、需同步改的提示与 board 比对；
  - 写明回退后 check 报漂移属预期；
  - 修正纪律块与模板取最新版的出处。
