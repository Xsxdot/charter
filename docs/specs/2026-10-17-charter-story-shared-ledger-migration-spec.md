# charter-story 装入共享账本：默认流迁移方案

- **状态**：草案 r2，待用户批准（2026-10-17）。批准前不动共享账本，也不改两机驾驶手册。r2 按独立审阅修订，修订记录见文末。
- **级别与档位**：L3 轻档。改动跨三处：charter 仓（流定义、安装脚本）、两机驾驶手册（`product-backlog`、`handoff` skill、全局 CLAUDE.md 的一条指针）、共享账本状态。不新增接缝：workflow def 格式和 `card add --workflow` 都是 handoff 既有的公开面，**不进 contract**。
- **台账**：`docs/ledgers/2026-10-17-charter-story-shared-ledger-migration-ledger.md`
- **上游**：`docs/specs/2026-09-22-charter-story-spine-and-staged-contract-spec.md`（r3 已批准，r4 翻案 §4.2）、`docs/charter-story-pilot.md`、roadmap 第 66、67 条。

## 一、问题陈述

新法已合入 master：故事驱动、contract 按条件进入、阶段验收与最终验收分列，r4 起首故事做第一张子卡。但共享账本（本机与 mac-02 共用的 Postgres）里只有 `charter v12`。真卡按新法走时，旧流会在机器层面挡住两处：

1. **跳过 contract 的路走不通。** v12 的 breakdown 门要求挂 `contract` 附件（现状读数：共享账本 `handoff workflow show charter` 的 Def，breakdown 节点 `gate.require_attachment = "contract"`）。r3/r4 规定没有新接缝时跳过 contract，但在 v12 上只能造一个空的 contract 附件去过门，而 r3 明令禁止这样做。
2. **验收没有分阶段。** v12 只有一个 `acceptance` 列，成功路径是 `review→acceptance→integrate→图对账`，integrate 节点也没有「全部子卡完结」门。

所以 roadmap 67 的 r4 补注说「不必装第二条流」，这句话只对 Wave 0 怎么承载成立，对上面两处不成立。

新流一装进共享账本，就会弄断现有的建卡路径。现状读数：handoff `internal/ledger/cards.go:143-163`，账本里有多条工作流时，省略 `--workflow` 的建卡直接报错。2026-10-17 已在隔离账本复现，见台账。受影响的入口：

| 入口 | 现状 | 两条流并存后 |
|---|---|---|
| `card add` 建顶层卡 | `product-backlog/SKILL.md:90` 不带 `--workflow`，`:91` 原文写「不带 `--workflow`，缺省就是 charter」；`:37`、`:57-63` 把 charter 当作「唯一的流」 | 报错 |
| `card add --parent` | `product-backlog/SKILL.md:302` 不带。流名在 `prepareCard` 里先解析（`cards.go:143`），之后才在 `:253`/`:334` 调父卡检查，检查只数同名流的嵌套层数，**不继承父卡的流** | 报错（隔离账本已复现）；如果显式写了新流名，会跟 v12 父卡混成两种流 |
| `card import` | `product-backlog/SKILL.md:352`、`handoff/SKILL.md:400-401` 中流参数是可选的 | 报错 |
| `handoff` skill 示例 | `handoff/SKILL.md:617` 是裸 `card add` | 报错 |
| HTTP `POST /api/cards` | `internal/agentd/ledgerapi.go:1111-1143`，workflow 字段可以不填；目前只有控制台调用 | 不填时报错 |
| 控制台建卡对话框 | 缺省选中第一条流（`web/src/app/cards/NewCardDialog.tsx:78,97`），流列表按名字升序（`workflows.go:287`） | 会静默选中 `charter`（旧流） |
| `card split` | 子卡继承父卡的流名，版本取该流的最新版（`merge.go:118`） | 不受影响 |

以上 `SKILL.md` 指的是本机 `~/.claude/skills/` 下的副本，mac-02 上的副本**还没核对**（见第五节第 0 步）。handoff 内部除 `SplitCard` 外没有别的自动建卡点；room、squad、脚本、charter 仓的 skills 与 scripts、CLAUDE.md 都不建卡（审阅已核）。

## 二、方案

### 推荐：A. 先把流名写显式，再装新流，然后两条流分节并存

1. 先改手册：所有建卡命令都写明流名。此时账本只有一条流，这一步可以单独上线，不改变任何行为。
2. 再装新流。
3. 最后把手册改成新旧两条流分节写：新开的顶层卡走 `charter-story`，旧卡及其子卡继续按 v12 推进。

旧流 v12 本身不动。在飞的卡钉在 v12 上：move 和 dispatch 都按卡上钉住的版本取流（`move.go:39`、`ledgerstep/runner.go:291`）。等旧流上的在飞卡清空，旧流**退役但不删除**，因为 handoff 没有删工作流的命令。

### 备选：B. 把新法写成 `charter` 的 v13（同名升版）

好处是账本里始终只有一条流，不会出现歧义，手册里的建卡命令一行都不用改。代价有四：

- v12 父卡在升版之后再 `card split`，子卡会取到 v13（`merge.go:118` 只传流名，`prepareCard` 调 `GetWorkflow(name, 0)` 取最新版）。同一棵卡树里会混着新旧两套列，父卡的 integrate 门对此不设防。
- mac-02 没有选择权：它的新卡会立刻进入新列，而它的手册还是旧的。
- 想回退只能再写一个内容等于 v12 的 v14。
- `docs/charter-story-pilot.md` 明文写着「不是把旧 `charter` 升版」。

**建议弃选**，但 B 的改动面最小，是否弃选由用户裁决（第九节第 1 问）。

### 弃选：C. 在 handoff 引擎加「缺省工作流」配置键

这能在引擎层消除歧义，但要改 handoff 引擎，两机的 CLI 和 agentd 都得升级。roadmap 第 15 条记录过两机的版本不是同一批。本期不做，记入 roadmap 候选。

## 三、全部必交用户故事

| ID | 谁 / 入口 | 期望观察 | 关键失败呈现 | 验证环境 |
|---|---|---|---|---|
| S1 | 本机协调者按 `product-backlog` 建顶层新卡 | 卡落在 `charter-story` 最新版的「待办」列；手册里有新流的推进表，协调者照表推到的每一列在新流里都存在 | 报「多条工作流」错误；或手册叫协调者推往 `acceptance` 这类新流里没有的列 | 共享账本 |
| S2 | 本机协调者给已有父卡建子卡 | 子卡与父卡同流、同版本（手册规定只用 `card split`；见第四节） | 报歧义错误；或子卡与父卡不同流 | 隔离账本复演；共享账本只读核对 |
| S3 | mac-02 协调者按它自己的手册建卡 | 按两机约定的流落卡，不报歧义 | 报歧义；或静默落到非约定的流 | 共享账本，mac-02 实机 |
| S4 | 任意一张在飞的 v12 卡 | 继续按 v12 的列和门推进到「已完成」；它 split 出的子卡仍是 v12 | 被迁移或换了版本；子卡换到了新流 | 隔离账本复演 split；共享账本只读核对卡的版本 |
| S5 | L3 且无新接缝的新卡 | 不挂 contract 附件也能进 breakdown；子卡没挂附件进不了 plan；子卡没全部完结时，父卡进不了 integrate 和最终验收 | 被门误挡，或被门误放 | 隔离账本复演 + 共享账本上的第一张真卡 |
| S6 | 在控制台建卡的人 | 手册写明：控制台缺省会选中 `charter`，建新卡时必须手动改选 `charter-story` | 手册没写这条提示 | 本机控制台实看，并核对手册原文 |
| S7 | 第 4 步之后回退 | 手册把新顶层卡改回 `--workflow charter` 后，新卡回到旧流；已建的 charter-story 卡照常推进 | 回退后仍有新卡落到新流 | 共享账本 |

## 四、目标架构与语义

- **真源与安装方向不变。** 仓是流定义与纪律正文的唯一真源，`charter_provision.py` 只做仓→账本的单向安装。纪律正文在派发时从账本取（handoff `internal/discipline/dispatch.go:80`），本机 `~/.handoff/discipline` 目录只是 regen 产物，不是派发来源。
- **安装脚本的闸要保留。** 现在不带配置、或配置指向默认配置时会拒绝安装（`scripts/charter_provision.py:502-508`）。这道闸不删，改为加一个显式开关 `--shared`，表示「我确知这是共享账本」。
- **流定义入账前先与账本现实对齐。** 仓里的 `flows/charter-story.workflow.json` 比共享账本上的 v12 少两样东西：
  - `board`：缺了不会坏，控制台会回落到 `DefaultBoardLayout`，新增的几列都归进「进行中」（`workflows.go:21-35`）；
  - 各派发节点的 `override.squad`：v12 里是 `pro`/`runner`，仓里两条流都没有。缺了会让派发时的 `Receiver` 为空（`runner.go:347`），路由会变。

  这两样带不带由用户裁决（第九节第 2 问），定了就回写到仓里，不在账本上手补。
- **建卡规则（消除 `--parent` 的歧义）：**
  - 顶层新卡写 `--workflow charter-story`；
  - 给已有卡建子卡**只用 `card split`**，它天然与父卡同流、同名；
  - 手册不再出现 `card add --parent`；确实非用不可时，必须写父卡的流名（从 `card show` 读）；
  - `card import` 必须显式写流。
- **流名约定的唯一出处是 `product-backlog`。** `handoff` skill 只写机制：「两条流并存时建卡必须显式写流」。全局 CLAUDE.md §2 里「改完跑 `scripts/regen_discipline.py` 同步纪律块」这一句已经不准确：regen 只写本机目录，派发读的是账本。这句改为指向 `charter_provision.py install --shared` 加 `check`，CLAUDE.md 只留这条指针。

## 五、实施顺序

只有第 3 步不可逆。账本装进第二条流之后会永久处于多流状态（handoff 没有删流命令），任何还没更新的建卡入口从此都会报歧义；「新流留着不用」并不能恢复单流时的行为。所以第 3 步之前设了硬闸。

0. **两机生效清单**（只读）：
   - 本机和 mac-02 的 handoff 版本。**下限**：必须包含 a91eec75（`require_children_done`）和 9c2c147e（`require_attachment_any`），否则新流的这两道门会被静默忽略。
   - mac-02 上 `product-backlog`、`handoff`、`charter` 三处 skill 的来源和同步方式。
   - mac-02 的 charter checkout 所在提交。

   这一步之所以排在最前：master 已于 2026-10-17 推送到 origin（fe717db），新法的 skill 正文都在里面。mac-02 只要拉一次 charter，它的节点 skill 就变成新法，而它的驾驶手册仍是旧的单流版本。这个风险本身需要先查清。
1. **仓内修正（入账前）。**
   - 按第九节第 2 问的裁决补齐 `board` / `squad`；
   - 安装脚本加 `--shared`；
   - 把隔离账本演练脚本收进仓，并补上 `--parent` 歧义、v12 卡 split 后子卡的版本两项探针；
   - 用隔离配置另起一个 agentd，补测 dispatch、produces 自动挂附件、`max_rounds` 重试、附件版本、恢复。
2. **两机手册显式化（可回退）。** 所有 `card add`、`card import` 都写上 `--workflow charter`；删掉「缺省就是 charter」「唯一的流」这类表述（`product-backlog/SKILL.md:37,57-63,91`）；`handoff` skill 的 `:400`、`:617` 补上「多流时必须显式写」。这时账本仍是单流，行为不变。
3. **装入共享账本（不可逆）。** 硬前置有三条：
   - 第 0 步两机版本达到下限；
   - 第 2 步在**两机**都已上线；
   - mac-02 已在实机按新手册建过一张卡，并确认带上了 `--workflow`。

   然后执行 `install --shared`，再跑 `check`，须 7/7 一致。共享账本上只做只读核对：在飞卡的 `workflow_version` 仍是 12。**不在共享账本上做 split 等探针**，因为建出来的卡删不掉；S4 的 split 验证放在隔离账本做。
4. **手册改为双流分节（可回退）。** `product-backlog` 分成两节：
   - 「旧流 charter v12（在飞卡与其子卡）」：保留现有正文，只改标题和适用范围；
   - 「新流 charter-story（新顶层卡）」：照新流的列写推进表，包括待办→spec→[contract]→breakdown→plan→implement→review→阶段验收→[待批次]→integrate→最终验收→图对账→finish；越列规则是 L2/bug 从 review 进最终验收、子卡从阶段验收进 finish；r4 的首故事子卡法沿用现有「L3 重档：扇出子卡」一节。

   同时写进 S6 要求的控制台提示，并改 CLAUDE.md 那条指针。mac-02 何时切换按第九节第 3 问的裁决。
5. **首卡观察。** 第一张真卡建议选 L3 轻档、没有新接缝的卡，用来验证 S5。

**回退**：第 2 步、第 4 步改回原样即可；第 4 步的回退就是 S7。第 3 步没有回退。万一出问题，止损办法是两机手册都保持显式写流，新流闲置；已建的新流卡原地走完，不做 migrate。

## 六、实现决定

- **用户可见的名字**：流名 `charter-story`、模板名 `charter-story-default`、纪律块前缀 `charter-story-*` 都沿用试点的命名，不改；安装开关叫 `--shared`。
- **旧流冻结**：旧流 `charter` 和旧的 `charter-*` 纪律块冻结，不再从仓里重装。仓里的 `flows/charter.workflow.json` 保留，作为在飞卡的历史定义。它与账本 v12 之间的 squad 漂移不回补，在台账里记为已知。
- **新流各列怎么用**，以 r4 和 `product-backlog`「L3 重档：扇出子卡」为准。越列规则见第五节第 4 步，隔离演练已证实这些越列是必需的。

## 七、测试决定

- **隔离账本复演**：用 `ledger.dsn` 留空的 SQLite 配置，跑仓内的演练脚本。覆盖正向路由、反向门探针、两条流时的建卡歧义、`--parent` 歧义、v12 卡 split 出的子卡的流名与版本；再加第五节第 1 步 agentd 那几项。
- **共享账本**：只做只读核对，再加第 5 步的第一张真卡。不做任何会留下删不掉的记录的探针。
- **mac-02**：S3 和第 3 步的硬前置都必须在 mac-02 实机验证，不能拿本机代替。

## 八、Out of Scope

| 条目 | 分类 |
|---|---|
| 在 handoff 加节点入场门、阶段证据顺序门、禁止跳列的机械门（roadmap 67①） | 本期不做、后续要做（已在 roadmap） |
| 引擎层的「缺省工作流」配置键（方案 C） | 本期不做、后续要做（记入 roadmap） |
| 控制台对话框缺省选中新流（系统层保证） | 本期不做、后续要做（并入方案 C）；本期只做手册提示（S6） |
| 把在飞的 v12 卡 migrate 到新流 | 永不做（原地走完） |
| 删除旧流、删除旧纪律块 | 永不做（没有删除命令，在飞卡也依赖它们） |
| 跨机纪律块分发（B229） | 不属于本期 |

## 九、待用户裁决（一次一问，按顺序）

1. **用方案 A 还是方案 B？** 推荐 A。
2. **新流入账时带不带 v12 的 `squad` 覆写和 `board` 布局？** 推荐都带，并回写到仓里。不带 squad 会改变派发路由。
3. **mac-02 什么时候切换新卡的缺省流？** 推荐与本机在第 4 步同时切换，前提是第 0 步已查清它的手册来源。

## 修订记录

- r1（2026-10-17）：初稿。
- r2（2026-10-17）：按独立审阅修订。
  - 第 3 步改标为不可逆，并加硬前置（两机都已显式化，且 mac-02 实测过）；
  - 第 4 步由「只换流名」改为手册双流分节；
  - 建子卡只用 `card split`，消除 `--parent` 的混流歧义；
  - 补上漏掉的入口（`product-backlog:37,57-63,91`、`handoff/SKILL.md:400,617`、`POST /api/cards`）；
  - 共享账本不做 split 探针；
  - S6 只保留一个判据；
  - CLAUDE.md 的 regen 指针纳入改动面；
  - 第 0 步加 handoff 版本下限；
  - 修正行号锚点。
