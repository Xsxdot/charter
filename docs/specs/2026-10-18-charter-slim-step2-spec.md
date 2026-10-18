# charter 瘦身第二步：节点并五、流缩六列

> 状态：**已批准（2026-10-18，用户显式指令「OK，做吧」，针对本会话提出的「直接做第二步，一次到位」）**
> 级别：L2（单仓 charter；流定义换形状但仍是 handoff 已有的 workflow def 格式，不新增契约）。用户裁决跳 plan 直接实现。
> 台账：`docs/ledgers/2026-10-18-charter-slim-step2-ledger.md`
> 前置：第一步（`docs/specs/2026-10-18-charter-slim-step1-spec.md`，master f55ee45）。

## 问题陈述

第一步删掉代码图后，14 个节点里 contract、breakdown、integrate、阶段验收、待批次、最终验收六个只服务 L3 重档并行，而重档在产品仓从未发生；acceptance 与 review 是同一次「拿证据裁决」的两半；debug 与 implement 的失败处置重复。用户只要架构干净与注意力集中，节点数本身不产生这两样。

## 方案

**节点 14 → 5 + 2 部法**：

| 新 skill | 吸收 |
|---|---|
| spec | 原 spec 压缩：承重歧义、故事清单、对话纪律、L3 架构边界、定级选档、骨架、收尾与批准回写 |
| plan | 原 plan + breakdown 的「拆分与接缝」（L3 段）+ contract 降为「需冻结的外部承诺」一节 |
| implement | 原 implement + debug 作「排查」节（bug 入口与撞失败横切） |
| review | 原 review + acceptance（复跑 → 变异一次 → 真机 → 阶段/最终裁决）+ integrate 的父卡最终验收（全量、生产闭环对账、缺陷记账、回旋镖对账） |
| finish | 原 finish；子卡合入父卡分支、父卡合主线的裁决归人 |
| architecture-law / defect-families | 原样保留为横切法 |

**流 14 列 → 6 列**：`待办 → spec → plan → implement → review → finish → 已完成`。派发列 plan / implement / review；门只留一道：implement 列要 `plan:` 附件（L1 同一份 spec 挂 `plan:`）；finish 列要全部子卡完结。L3 用父子卡：子卡各走同一列序并在 finish 合入父卡分支，父卡在全部子卡合入后 review 一次（全部故事核销 + 全量），再 finish 合主线。plan 节点保留 `produces` 自动挂附件。

**并行是例外**：只在既有边界上扇出、一批不超过两张子卡、新缝先串行长出。

**账本可选的判据改为「要不要放手」**：聊透后想离开电脑或预计跨会话的活走卡；坐在旁边一起做的小活无卡（本会话建议，用户未单独否决，随本步落地，可一句话回退）。

## 必交故事

- S1 `install --shared` 后 `check`：workflow 一致、template 一致、纪律块 3/3 一致。
- S2 provision 测试全绿。
- S3 `ls skills/` 恰为 architecture-law defect-families finish implement plan review spec using-charter。
- S4 下一张新卡落 v14 列序；在飞的 B435（contract）、B436（待办）钉 v13 不受影响，需要时逐张 `workflow migrate`。

## Out of Scope

- handoff 引擎：不加入场门、不删 contract/breakdown/integrate/recon 旧纪律块（无 delete 手段，v13 卡仍引用）。
- v12 快照：第三步观察后再定（roadmap 69a）。
- docs/ 历史文档不改写。

## 备注

旧节点正文全部在 git 历史（第一步后最后一版 d84d457）。
