# Spec：codegraph 刀 1+2——schema v2 术语迁移 + 领域图

> 状态：**已批准（2026-08-22，用户指令「并行进 contract」，批准即交棒）**
> 级别与档位：**L3 轻档**（动跨仓 wire 契约：codegraph JSON schema 是 charter/graph 工具与 handoff 消费方之间的契约；单子系统工作量集中在 graph 工具侧、两仓工作串行无并行面 → 契约冻结与拆解照做、实现归一轮）
> 输入：handoff 仓 `docs/2026-08-22-codegraph-batch-handover.md`（待拍板七条已于本 spec 对话逐条裁决）
> 前置：刀 0 搬迁 + B173 边治理已完成（graph/v0.2.1，基线 4522 边零假边，check 0 fails）

## 问题陈述

架构法术语节已定死「子系统 = 契约冻结单元、领域 = 子系统内业务聚合」，但 schema 还在用旧词：`target.json` 的 `domains` 字段装的其实是子系统。同时图的实体查询只有「字段/投影」半边（`entity` 输出 model/twins/typed/handroll 四段），缺「谁创建 / 谁写状态 / 生命周期与状态机」的语义半边——今天查 Task 生命周期只能 who-calls + grep 手工组合。

## 现状读数（2026-08-22 实测，contract 节点须对工作树复核）

- `target.json`（handoff 仓）：`domains` 数组 **10 条子系统**（d_ledger/d_controlplane/d_remote/d_executor/d_host/d_release/d_localint/d_cli/d_web/d_contract），`meta.version` = 1；结构见 `graph/codegraph/target.go#TargetDomain`、`#Target`。
- `baseline.json`（handoff 仓）：3564 节点 / 4522 边 / 237 容器 / **19 领域**；`graph/codegraph/types.go#Domain` 已有 `parent` 字段，**19 域中 10 个带 parent、顶层 9 个**（d_coordination、d_execution……）——两级树已是活数据。
- **两套切法只有 3 个 id 重合**（d_executor/d_ledger/d_web）：target 的 10 子系统与 baseline 的 9 顶层域是独立演化的两套分区。
- 消费方分布：baseline 形态被 Web 控制台 codegraph 页（`web/src/app/codegraph/DomainPanorama.tsx` 等）与 agentd API（`internal/agentd/codegraph.go#handleProjectCodegraph`）整图消费；**target.json 只有 check/validate/contract 工具自己消费**。
- 边是无类型二元组（`graph/codegraph/types.go#Edge`），语义上均为调用边；类型化关系已有先例：`projections`（`graph/codegraph/absorb.go#mergeProjections`）。
- handoff-server 仓**现无 codegraph/ 目录**（交接文档中的 4 子系统读数已不在场）——全网活着的 v1 target.json 仅 handoff 一家。
- 交接文档 3 个符号锚 `codegraph resolve --doc` 全 ok。

## 裁决记录（七条，2026-08-22 用户逐条拍板）

| # | 问题 | 裁决 |
|---|---|---|
| 7 | 分批 | **刀 1+2 本期；刀 3（图 diff 对账）+ 刀 4（fitness）+ 第 6 条（对账形态）下期**，留 roadmap |
| 1 | 命名终局 | **target 改名（domains→subsystems、version→2、出 migrate），baseline 不动**；领域↔子系统映射由工具按 assignments 派生展示，跨子系统领域作警示信息，不手抄不强制对齐 |
| 2 | 声明层载体 | **`codegraph/domains/*.json` 每领域一文件**（文件名 = 领域 id；人写的与机器重写的物理隔离） |
| 3 | 声明执法 | **锚保鲜必做**（resolve/validate，坏锚非零退出）**+ testRef 填了就验**（存在性核验）；「每条必挂测试」留下期 charter 修法定纪律，工具不硬拦 |
| 4 | 机械层来源 | **配方扩展 + AI 增量补扫入库**（跨语言可覆盖、全图消费方可见；弃「查询时现算」——只服务 entity 单出口） |
| 5 | 版本策略 | **migrate 强制一次性**：v0.3.0 只读 version 2，v1 报错指向 migrate；零双读债，旧版本由 go.mod 钉版隔离 |
| 6 | 对账形态 | 顺延刀 3（下期 spec 裁决） |

## 方案（含弃选）

**刀 1（schema v2）**：`target.json` 键 `domains`→`subsystems`、`meta.version` 1→2；工具内部同步改名（TargetDomain→TargetSubsystem 等，签名归 contract）；新增 `migrate` 子命令做机械改写；v0.3.0 读到 version 1 即报错并指引 migrate。baseline schema 键名零改动。
弃选：baseline 侧同步改名/重切（破坏 Web+agentd wire，且顶层域与子系统是两套合法分区）；双读兼容期（为不存在的多仓生态背债）。

**刀 2（领域图）**：
- **机械层**：扫描配方（handoff `docs/codegraph-scan-recipe.md`）新增 creator（返回该 model 类型的构造点）/ writer（对状态类字段的写入点）产出规则；入库形态为 **baseline 新增类型化段**（如 `lifecycle`，与 `projections` 同模式的附加段，`omitempty`）——**不混进无类型 edges 数组**（会污染调用边语义，who-calls/check 全遭殃）；附加字段对现有消费方是无破坏扩展。存量做一次定向补扫（只扫 model 类节点的构造与状态写，非全量重扫）。
- **声明层**：`codegraph/domains/<领域id>.json`，内容=职责一句话、不变式清单（每条可选 `testRef` 指向守护测试）、生命周期（创建→终结，`file#Symbol` 锚）、状态机迁移表。`resolve --doc` 语义扩展覆盖此类文件；`validate` 纳入：坏锚非零退出、填了 testRef 的核验测试函数真存在。
- **查询面**：`entity` 输出增 creators/writers/lifecycle/declaration 段；`domains` 输出增所属子系统派生映射与「跨子系统」警示。
弃选：声明内嵌 target.json（契约冻结物高频变动）或 baseline（重扫碾掉人工段）；check 静态校验状态写点∈迁移表（误报风险高，等机械层数据积累后下期评估）。

## 用户故事

1. 我在任何 codegraph 仓跑 `codegraph migrate`，v1 target.json 机械升 v2，check/validate 行为不变（fails/warns 集合前后一致）。
2. 我查 `codegraph entity Task`，除字段/投影外还能看到：谁创建它、谁写它的状态、声明的生命周期与状态机、以及声明文件里的职责与不变式。
3. 我给 `d_coordination_task` 写声明文件后，锚烂了 validate 变红；我给不变式挂了 testRef，测试函数被删时 validate 变红。
4. 我跑 `codegraph domains`，能看到每个领域按 assignments 派生的所属子系统；一个领域横跨多个子系统时有警示标记。
5. handoff 仓升级 v0.3.0 后旧 v1 文件报清晰错误而非静默错读；migrate 后全量测试与契约闸保持绿。

## 契约语义与接缝（L3：定语义不定签名）

- **wire 契约变更面**：target.json v2（键改名+版号）；baseline 附加 lifecycle 段（additive-only，旧消费方可忽略）；新文件族 `codegraph/domains/*.json`。三者的精确字段与类型归 contract 节点对现状代码查证冻结。
- **依赖方向不变**：handoff → charter/graph 单向；配方文档暂留 handoff（canonical 化另议，见 OOS）。
- **数据流**：AI 扫描（按配方）→ baseline.lifecycle；人工声明 → domains/*.json；两源在 entity/domains 查询时合流展示，validate 统一执法。
- **版本**：module tag `graph/v0.3.0`；handoff go.mod 升版与跑 migrate 在同一提交。

## 实现决定

- 领域↔子系统映射按「领域成员节点文件 × target assignments」派生，零手抄字段。
- migrate 幂等：对已是 v2 的文件零改动退出 0。
- 附加段与声明文件均走 edgegate 同款纪律：引用的符号/文件必须真实存在（validate 引用完整性覆盖）。

## 测试决定（接缝清单）

**最高可测缝 = CLI JSON 面**（延续 cli_test 模式），落点：
1. migrate：v1 夹具→v2 金样本逐字节比对 + 幂等性 + v1 拒读报错文案；
2. 声明执法：坏锚红 / testRef 缺失红 / 齐全绿（三态）；
3. entity/domains 新段的 JSON 键锁（wire 契约金样本，同 EdgeIssue 模式）；
4. 派生映射与跨子系统警示：夹具构造一个跨子系统领域断言警示出现；
5. handoff 侧真机：migrate 后 check fails/warns 集合前后逐条一致（0=0）+ 全量测试绿。

## Out of Scope

- **刀 3 图 diff 对账 + 刀 4 fitness 判据 + 对账形态裁决**——本期不做、下期要做（roadmap 1 号改写为刀 3+4 条目）。
- **charter 修法配套**（术语节销账、领域图引用进 spec/plan、testRef 必挂纪律）——工具落地后跟进（roadmap 7 号已有）。
- **领域声明的全量补写**：本期只交付机制 + 1~2 个样板领域声明（验收判据用）；19 域铺满按后续卡增量。
- **Web 控制台的 lifecycle/声明展示**：附加段不破坏前端即可，UI 消费属 handoff 侧后续卡。
- **check 静态校验状态写点∈迁移表**（重档执法）——等机械层数据积累后评估，永不做或下下期。
- **handoff-server 迁移执行**：该仓现无图；migrate 命令交付即覆盖其未来建图。
- **配方文档 canonical 化**（移 charter 仓）——另议，本期只在现址扩展。

## 备注

- 图覆盖债：无新增未命中符号（本 spec 引用锚均经 resolve/实测核验）。
- B173 治理是本期地基：补扫产出的新边天然过 v0.2.1 边门控，假边风险已有机械闸。
