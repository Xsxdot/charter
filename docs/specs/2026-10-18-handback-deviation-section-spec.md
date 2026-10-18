# 交回物首节「偏离与自主决定」铁律

- **状态**：**已批准（2026-10-18）**。授权来源：用户卡结论经协调会话转达为显式指令（原话：「不加节点、不加机制，只加一条交回格式铁律，把偏离与自主决定固定放在交回物第一节，并让 review 第一步核对它」）；本 spec 是该指令的留痕，不另开批准回合。
- **级别与档位**：**L1**（单子系统：charter 仓 `skills/` 正文；不动 handoff 引擎、不动流定义、不动模板 JSON）。plan 增量为零——实现决定三行写完（见末节），本文件同时挂 `spec:` 与 `plan:`；验收一眼可核（四处正文含同一段铁律 + review 首步 + provision check 一致）。
- **台账**：`docs/ledgers/2026-10-18-handback-deviation-section-ledger.md`

## 一、问题陈述

大型任务里执行者会替用户做决定而不通知，或者把决定写在几千字报告的编号列表里被淹没。现状读数：`docs/ledgers/2026-08-27-c12-integrate-report.md` 第 1 节——合并冲突与「零冲突」预测不符、整棵 `graph/` 树被恢复为子卡分支、用户给的基线名不存在改用远端引用，三处自主决定全部埋在「合分支与祖先证据」的编号列表里，报告首段结论只写「集成分支就绪」。

用户要的只有两件事：架构干净、注意力集中。注意力集中的具体含义：**偏离与自主决定必须出现在交回物顶部，读者不翻正文就能看到。**

## 二、方案

**只加一条交回格式铁律，不加节点、不加机制。**

- 交回物（implement 的台账、review 的裁决表、integrate 的报告、acceptance 的验收记录）第一节固定标题「偏离与自主决定」。逐条列：与已批准 plan 或 spec 不一致之处；执行者自行拍板的内容与理由；每条是否落在 plan「决策权限」节授权范围内。没有偏离时写「无」，不得省略。
- review 第一步改为核对该节：与 plan 决策权限对照是否一致，对照 diff 抽查是否漏报；漏报或越权未披露直接 fail，不进入两轴裁决。
- plan「决策权限」行补一句：这一节是交回物「偏离与自主决定」的对照基准。

**弃选**：

- 新增「偏离申报」节点或 handoff 机器门——用户明令不加节点不加机制；且 handoff 引擎暂无入场/证据门（roadmap 67），机器化是另一张卡的事。
- 只在 integrate 加——偏离在 implement 就发生，review 是第一道能对照 diff 的人眼，四个节点缺一处就有一处能埋。

## 三、必交用户故事

| ID | 谁 / 入口 | 期望观察 | 关键失败 | 验证 |
|---|---|---|---|---|
| S1 | 执行者按 implement/integrate/acceptance 纪律块交回 | 交回物首节即「偏离与自主决定」，无偏离写「无」 | 该节缺失或沉在正文 | 读四份 SKILL.md；regen 后纪律块含该段 |
| S2 | 审查者按 review 纪律块开审 | 第一步核对该节，漏报/越权未披露直接 fail | 审查者跳过该节直接两轴 | 读 review SKILL.md 与纪律块 |
| S3 | 协调者写 plan | 决策权限行标明它是该节的对照基准 | 执行者不知道拿什么对照 | 读 plan SKILL.md |
| S4 | 共享账本 | `charter_provision.py check` 报一致 | 漂移 | 本机 install --shared 后 check |

## 四、实现决定（即 plan）

1. 同一段铁律原文落入 `skills/implement/SKILL.md`（结论纪律）、`skills/review/SKILL.md`（审查者自身的交回物）、`skills/integrate/SKILL.md`（交棒）、`skills/acceptance/SKILL.md`（验收记录），措辞逐字一致；review 另加「第一步」节置于双轴之前；plan 决策权限行补对照基准一句。
2. `docs/` 下无 ledger / review 报告模板文件（grep「模板|template」只命中正文引用），无可同步项。
3. 跑 `python3 scripts/charter_provision.py install --shared` 再 `check`；acceptance 不在 `regen_discipline.compose_map` 里，它的改动只经插件（协调者侧）生效，不入账本。

## 五、测试决定

- `python3 scripts/test_charter_provision.py` 全绿（regen 读的就是改后正文）。
- `check` 返回 0。
- 生效观察项落 roadmap（修法三件套第②件）。

## 六、Out of Scope

- **永不做（本卡）**：handoff 机器门、新节点、模板 JSON 改动、`using-charter` 节点地图改写。
- **本期不做、后续要做**：无新增；机器门已在 roadmap 67。

## 七、备注

决策权限节此前只是 plan 五件事之一，没有任何下游节点引用它作对照——这条铁律让它第一次有了消费者。
