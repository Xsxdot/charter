---
name: recon
description: 图对账——合并前核对本分支代码改动与视图 diff 一致，缺漏补齐、矛盾裁 fail。横切纪律，不占流程位：作为 handoff charter 流「图对账」列的纪律块源头；无卡分支由 finish 第 4 步引用同一判据人工核对。
---

# Recon：图对账

**位置**：合并前最后一站（integrate/验收之后、finish 之前）。**角色**：可派执行者；absorb 与合并不归本节点——那是 finish 的活。

对账兜的是「法上无人」的缝：视图 diff 的产出散在 contract（骨架符号）与 implement（实现期改动）手里，谁漏了，这里拦住；这里不拦，漏建叠着陈旧基线一路合进主线，absorb 从此对不上。

## 判定顺序

1. **无图项目**：仓库没有 `codegraph/` 目录 → 直接裁 pass，notes 写「无图项目，对账不适用」。不 commit、不建目录——对账节点没有建图职权。
2. **取改动面**：BASE..HEAD 的 diff（BASE = 本分支的基线提交）。列出：新增/删除/改签名的导出符号、新增跨包调用、新增 model 类型。
3. **逐项对账**：对照 `codegraph/diffs/<分支>.json`（文件不存在时视为空视图）：
   - 代码新增的符号，视图里有吗？缺 → 补；
   - 代码删除的符号，视图记了删除吗？缺 → 补；
   - 视图或基线记了代码里不存在的符号/边 → **矛盾，裁 fail**，findings 逐条列明——不许顺手删了事，假边的根因要人看；
   - 本分支确实没有图应记的改动 → 裁 pass，notes 写「本分支合法无视图」，不造空文件。
4. **补齐纪律**：按项目扫描配方（如 handoff `docs/codegraph-scan-recipe.md`）与边解析纪律：creator 必须是返回该类型的真构造点、writer 必须是对状态类字段的真写入，**禁裸名撞库**；**宁缺勿假**——拿不准的不入图，记进 notes 留给人。
5. **自检**：`codegraph validate` 通过（它校验基线与全部视图的引用完整性）；抽查 2~3 个新符号 `codegraph sym <符号> --view <分支>` 命中。
6. **提交**：补齐的视图 diff 提交到工作分支——只动 `codegraph/diffs/`，一次 commit。

## 红线

- **只动 `codegraph/diffs/<分支>.json`**：不动 `baseline.json`（absorb 归 finish）、不动 `target.json` 与 `best.json`（前者是契约冻结物、后者是应然结构树，动哪个都要重走 contract）、不动业务代码。
- 对账不是重扫：只核对本分支改动面，不做全量重扫——基准靠流程副产物保鲜。
- 无法机械补齐的矛盾裁 fail 等下一轮或人裁，不硬编结论。
