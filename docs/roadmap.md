# Roadmap（残余账本）

> 排序判据：先骨架后血肉；每期以可真机验收为界。一行一条、注明来源；下一期开工 = 取条目重走 spec 门。

1. **codegraph 四刀批次**：刀 1 schema v2 术语迁移（domains→subsystems + migrate 子命令）→ 刀 2 领域图（机械层 creator/writer + 声明层职责/不变式/状态机）→ 刀 3 图 diff 对账（anti-漏建）→ 刀 4 fitness 判据进 check。来源：handoff 仓 `docs/2026-08-22-codegraph-batch-handover.md`（待拍板七条在文内）；前置刀 0 已完成（`graph/v0.1.0`），批次落本仓 `graph/`。
2. **B173 尾部（handoff 侧）——裁决已跑完，待合并**：target.json 重标定在 handoff 分支 `feat/b173-contract` @ d673869e3 完成（check 0 fails/20 warns、44 包全绿、变异三连验闸门；判据 = entries 只认门面类型，散调锁 legacyBudget），**合并归用户**。合并后本仓 breakdown T4⑥ 的「16 条钉死」口径自动失效（归零）。来源：B173 卡 note seq 83。
3. **codegraph 门控增强 v0.2.1**：B173 会话再清 13 条假边（4537→4524）实证两个盲区——①包级函数 callee 须调用**文件**亲自 import 被调包（方法调用仍包粒度，不退回误杀）；②callee 首字母小写（未导出）跨包必假。两判据已逐条查证不误伤，建议进 `CheckEdges` 发 v0.2.1。来源：B173 卡 note seq 83（2026-08-22 晚），待用户拍板开卡。顺带核销：review M3（release.yml 缓存路径修复）的生效验证随下次 tag 触发一并看。
4. **刀 0 真机部署门 3 条**：#4 无 Go 设备 install.sh（需另一台设备）；#7 执行机 SessionStart hook、#8 Web 控制台渲染（均需 handoff 二进制升级部署 + agentd 重启，归用户排期）。来源：刀 0 真机清单。
5. **graph check 报告输出顺序非确定**：map 迭代序导致同库同参两次运行 fails/warns 排序不同，破坏输出可 diff 性。来源：刀 0 真机清单 1 实测（2026-08-22）；宜随刀 3/4 一并修（输出前排序）。
6. **`handoff graph` 别名移除时点**：deprecated 观察期后另行裁决。来源：刀 0 契约 §4。
7. **charter 修法配套（工具落地后）**：architecture-law 术语节销账、integrate/acceptance 补图 diff 对账条款、spec/plan 补领域图引用。来源：四刀批次交接文档 Out of Scope 第 1 条。
