# Roadmap（残余账本）

> 排序判据：先骨架后血肉；每期以可真机验收为界。一行一条、注明来源；下一期开工 = 取条目重走 spec 门。

1. **codegraph 四刀批次**：刀 1 schema v2 术语迁移（domains→subsystems + migrate 子命令）→ 刀 2 领域图（机械层 creator/writer + 声明层职责/不变式/状态机）→ 刀 3 图 diff 对账（anti-漏建）→ 刀 4 fitness 判据进 check。来源：handoff 仓 `docs/2026-08-22-codegraph-batch-handover.md`（待拍板七条在文内）；前置刀 0 已完成（`graph/v0.1.0`），批次落本仓 `graph/`。
2. **graph check 报告输出顺序非确定**：map 迭代序导致同库同参两次运行 fails/warns 排序不同，破坏输出可 diff 性。来源：刀 0 真机清单 1 实测（2026-08-22）；宜随刀 3/4 一并修（输出前排序）。
3. **`handoff graph` 别名移除时点**：deprecated 观察期后另行裁决。来源：刀 0 契约 §4。
4. **charter 修法配套（工具落地后）**：architecture-law 术语节销账、integrate/acceptance 补图 diff 对账条款、spec/plan 补领域图引用。来源：四刀批次交接文档 Out of Scope 第 1 条。
