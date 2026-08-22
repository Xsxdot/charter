# 独立审查：codegraph 搬迁（刀 0）+ B173 门控移植

> 2026-08-22。审查者 = 独立 subagent（不继承实现会话史），锚点 charter master 120e7ca / handoff main 1334ba9fb。取证 47 次工具调用，代表性命令见审查记录（本文末注）。处置状态由协调者回填，acceptance 按本卡逐条核销。

## 裁决表

| 维度 | verdict |
|---|---|
| plan 覆盖完整性 | 缺项 1（T4⑥「check 通过」判据过期，→I1）；其余 T1~T4 验收项逐条复核通过 |
| scope drift | 有（受控）：计划外 = B173 移植（有 plan of record + ledger + 独立复验，契约欠回写→C1）、v0.2.0 发版；说了没做 = 真机 4/7/8（已声明开放） |
| 架构法合规 | 通过（单包+cli+薄壳与 §1 一致；跨模块只走 module 导出面；cli 导出面恰 `New`） |
| 测试有牙 | 已验（edgegate 金样本+reason 映射、cli edgeIssues 键锁、deps 白名单；28 支随迁测试与源字节等价全绿） |
| 日志与注释覆盖 | 通过（八个新文件头+导出注释全覆盖；codegraph 包不打日志为 plan 明文约束） |
| 序列化边界 | 有穿透断言（EdgeIssue JSON keys 金样本锁；validate edgeIssues 穿真实编码路径回归测试） |
| 冻结物触碰 | 审查时**未回写（阻塞）**→ C1，已修 |

机械核验亮点：28 迁移文件与源逐一字节等价；edgegate 两文件与 `8dad9f07d` diff 为空；CLI 接线 hunk 与老家零差异；合并取别名版（diff 为空）、edgegate 孤儿零残留、收敛零测试丢失；别名与 canonical 对同仓 `sym` 输出逐字节一致（审查者独立复验）。

## Findings 与处置

| # | 级别 | 内容 | 处置（2026-08-22 本节点内） |
|---|---|---|---|
| C1 | Critical | 契约冻结物未随 B173 增量回写（§2 51→53、§6-4 零增删、§4 行为） | ✅ 已修：契约补修订 **R6**，§2/§4/§6-4 同步更新 |
| I1 | Important | T4⑥「check 通过」从未成立（main 长红 16 条，B173 既有）；判据未回写则门禁失去增量拦截力 | ✅ 已修：breakdown T4⑥ 改「fails 集合钉死 16 条、新增即缺陷」口径；根治挂 handoff B173 卡（target.json 重标定） |
| M1 | Minor | 账本 T1 记「原 18 支」CLI 测试，实测 17 | ✅ 已勘误（账本 T1） |
| M2 | Minor | deps_test 只锁路径不锁版本，§6-6 cobra v1.10.2 冻结无牙 | ✅ 已修：deps_test 增 pinned 版本断言；变异复验（钉死值改 v9.9.9 → 红，还原 → 绿） |
| M3 | Minor | release.yml setup-go 缺 cache-dependency-path，缓存恢复告警 | ✅ 已修：补 `cache-dependency-path: graph/go.sum`（生效验证留待下次 tag 触发） |

## 审查记录出处

完整报告（含 §6 十五条逐条对账表、§2/§4/§5 核验、四卡对账、14 条代表性取证命令）产出于独立审查 subagent，本文为落卡摘要 + 处置回填。§6-4 在 R6 前按字面 FAIL 系流程性欠账（C1），代码本身无错。
