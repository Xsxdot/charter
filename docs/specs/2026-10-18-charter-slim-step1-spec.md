# charter 瘦身第一步：删除代码图、去重正文、测试纪律收敛

> 状态：**已批准（2026-10-18，用户显式指令）**——「同意账本降为可选：handoff 和多子卡 L3 走卡，产品仓 L1/L2 允许无卡直接走 skill。按三步迁移路径推进，先做第一步纯文本瘦身」；随后改令「反正有 git，直接把代码图彻底删除，handoff 里面的功能也删除，可以说我几乎没看过代码图」。
> 级别：L2（单仓 charter；流定义只删一个节点，格式未变）。用户裁决跳 plan 直接实现（先例：seam-budget、C9）。
> 台账：`docs/ledgers/2026-10-18-charter-slim-step1-ledger.md`

## 问题陈述

charter 两个月 337 次提交，账本 460 张卡中 365 张属 handoff、32 张属 charter 自身，全部产品仓合计 37 张；erp 近两月 167 次提交只走了 8 张卡。套件的复杂度来自纪律层、账本层、工具层三层互相嵌入正文：八个 skill 嵌着 codegraph 命令说明，同一段「边干边落台账」复制五份，流定义 14 列中六列只服务从未在产品仓发生过的 L3 重档。用户只要两件事：架构干净、注意力集中（Agent 的自主决定对人可见）。代码图在产品仓几乎无人消费（cloth 有图但零视图 diff、最近更新 2026-09-10；tk/erp 无图），用户自述「几乎没看过，看了也是一团浆糊」。

## 方案（本步范围）

1. **彻底删除代码图**：`graph/`（CLI + webui，13k 行 Go）、`prototypes/`（只有查看器原型）、`install.sh`、两条 CI 流水线、`skills/recon`；流定义去掉「图对账」列（最终验收直接 → finish）；全部 skill 正文与 README 去图相关条款；全局 `~/.claude/CLAUDE.md` 删「有图先查图」；`product-backlog` 驾驶手册去「图对账」。handoff 消费侧另立卡 **B436**。
   - 弃选「剥离成独立 codegraph skill」：用户裁定没有消费者，保留即维护负担。
2. **台账纪律单一副本**：正文只在 `using-charter`「台账纪律」节；`regen_discipline.compose_map` 把该节作附录注入 contract/breakdown/plan/implement 四个纪律块，节点正文只留一行指针。
3. **测试纪律按已收敛口径改写**（implement）：只为竖切与核心方法写测试、只测当前组件、先红后绿；变异自验从 implement 移出，全流程只在 acceptance 做一次。
4. **并行降为例外、账本可选**写进网关与 README。
5. 不改节点数、不改列名（图对账除外）、不动 handoff 引擎——那是第二步（roadmap 69）。

## 必交故事

- S1 `python3 scripts/charter_provision.py install --shared && check`：纪律块 6/6 一致，workflow 与 template 一致。
- S2 `python3 -m unittest scripts.test_charter_provision` 全绿。
- S3 `grep -rE "codegraph|图对账|best\.json|target\.json" skills/ README.md flows/charter.workflow.json` 零命中。
- S4 新建一张 handoff 卡能走到最终验收 → finish，不经图对账（由下一张真实卡验证，本步不造假卡）。

## Out of Scope

- 节点合并（14 → 5）、流缩六列、正文预算压缩：第二步（roadmap 69、69c）。
- handoff 消费侧删除：B436。cloth / handoff 仓内 `codegraph/` 数据目录：roadmap 69b。
- docs/ 下 99 份含 codegraph 的历史文档：历史记录，不改写。
- `flows/charter.v12.snapshot.json`：回退源，第三步观察后再定（roadmap 69a）。

## 备注

偏离块（交回物首节「偏离与自主决定」）在分支 `claude/competent-lalande-a0570f` 提交 `1dece20`，本步分支 `charter-slim-step1` 从它切出，合并时一并进 master。
