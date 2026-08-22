# Roadmap（残余账本）

> 排序判据：先骨架后血肉；每期以可真机验收为界。一行一条、注明来源；下一期开工 = 取条目重走 spec 门。

1. **codegraph 四刀批次**：刀 1 schema v2 术语迁移（domains→subsystems + migrate 子命令）→ 刀 2 领域图（机械层 creator/writer + 声明层职责/不变式/状态机）→ 刀 3 图 diff 对账（anti-漏建）→ 刀 4 fitness 判据进 check。来源：handoff 仓 `docs/2026-08-22-codegraph-batch-handover.md`（待拍板七条在文内）；前置刀 0 已完成（`graph/v0.1.0`），批次落本仓 `graph/`。
2. ~~B173 尾部（handoff 侧）~~ **已完成（2026-08-22 晚）**：`feat/b173-contract` 已并 main（efd8345a6），契约闸自 B173 落红后首次全绿（0 fails/20 warns）；breakdown T4⑥「16 条钉死」口径随之归零。
3. ~~codegraph 门控增强 v0.2.1~~ **已完成（2026-08-22 晚，契约 R7、tag graph/v0.2.1）**：判据三/四落地（TDD+变异复验），真机再揪 2 条手工漏网假边（基线 4524→4522），handoff 已升版全绿；M3 生效验证同轮核销（release run 零缓存告警）。
4. **刀 0 真机部署门 3 条**：#4 无 Go 设备 install.sh（需另一台设备）；#7 执行机 SessionStart hook、#8 Web 控制台渲染（均需 handoff 二进制升级部署 + agentd 重启，归用户排期）。来源：刀 0 真机清单。
5. **graph check 报告输出顺序非确定**：map 迭代序导致同库同参两次运行 fails/warns 排序不同，破坏输出可 diff 性。来源：刀 0 真机清单 1 实测（2026-08-22）；宜随刀 3/4 一并修（输出前排序）。
6. **`handoff graph` 别名移除时点**：deprecated 观察期后另行裁决。来源：刀 0 契约 §4。
7. **charter 修法配套（工具落地后）**：architecture-law 术语节销账、integrate/acceptance 补图 diff 对账条款、spec/plan 补领域图引用。来源：四刀批次交接文档 Out of Scope 第 1 条。
