# 契约增量：CodegraphResp 对照数据三键（C1.3 一期）

> **状态：已冻结（随本提交，2026-08-24）**
> 上游：`docs/specs/2026-08-24-codegraph-viewer-compare-spec.md`（已批准 2026-08-24）。
> 接缝：handoff agentd（产出方）↔ charter graph/webui（消费方），跨仓 wire 契约，单侧冻结。

## 冻结清单（逐条可独立判 pass/fail）

**C1 传输形态：透传库类型，不做投影。**响应在既有 `{baseline, views, stale}` 之外新增三个可选键，值为 graph **v0.5.0** 库类型的 JSON 序列化原文：
- `best` ← `codegraph.Best`（graph/codegraph/best.go:44-48；`meta{version,project}` / `domains{label,responsibility,parent?,type?}` / `containers{容器id→领域id}`，tag 出处 best.go:23-48）
- `target` ← `codegraph.Target`（graph/codegraph/target.go:37-41；`meta` / `assembly?` / `contracts[{from,to,entries?,interfaces?,legacyBudget?,legacyBudgetNote?}]`，tag 出处 target.go:15-33）
- `report` ← `codegraph.Report`（graph/codegraph/check.go:30-35；`fails[]` / `warns[]` / `legacyHits?{"from->to"→int}` / `bestCoverage?{assignedContainers,viewContainers,crossDomainEdges,misplacedSkipped}`；Finding = `{kind,from?,to?,edge?,detail}`，Edge 序列化为 `[from,to]` 二元组（types.go:86）；tag 出处 check.go:21-35、gap.go:11-16）

**C2 缺席语义（每键独立尽力而为）：**
- C2a 项目无 `codegraph/best.json`：`LoadBest` 返回 `(nil, nil)`（库既成行为，best.go:59-61）→ 三键**全部缺席**，HTTP 200，老三样语义不变。
- C2b `best` 载成但 `target` 或 decls 加载失败：失败者与 `report` 缺席，`best` 照传；Warn 日志，不 500（先例：坏视图跳过，internal/agentd/codegraph.go 视图循环）。
- C2c 键缺席用「map 不放键」实现，不传 null。

**C3 报告口径：**`codegraph.Check(target, best, Merge(g, nil), decls)`——与仓库契约闸逐参一致（先例 cmd/graph_gate_test.go#TestRepoContractGate）。视图叠加不参与（一期语义：对照面向主线）。

**C4 归一化：**`report.fails` / `report.warns` 为 nil 时宿主归一为 `[]`，不传 null（先例：stale 归一，internal/agentd/codegraph.go#handleProjectCodegraph）。

**C5 消费方镜像：**`graph/webui/src/api/types.ts` 新增 `CgBest` / `CgTarget` / `CgCheckReport`（含 `CgFinding` / `CgBestCoverage` / `CgContract` / `CgBestDomain`），字段名与库 JSON tag **逐字一致**；`CodegraphResp` 三键均为可选（`?:`）。

**C6 兼容性：**三键纯增量。旧查看器（不认新键）行为不变；新查看器分级降级——三键全缺席→现状域全景（今日形态）；有 `best` 无 `report` →理想树全景照画、执法读数区显示无数据态。

**C7 kind 词表冻结（消费方着色依据，graph v0.5.0 现值）：**fails 侧 `dead-contract` / `dead-entry` / `dead-interface` / `new-direction` / `off-interface` / `over-budget` / `budget-raised`（后者 CLI 棘轮层产出，wire 上不出现——库级 Check 不含）；warns 侧 `legacy` / `container-misplaced` / `container-unplaced` / `domain-empty` / `best-dangling` / `anchor-off-domain` / `anchor-off-graph` / `prefix-family` / `oversized-package`。出处 graph/codegraph/fitness.go:15-43。消费方对未知 kind 必须走缺省渲染（词表可增，不可依赖穷尽）。

## 依赖库既成行为查证（与签名同等承重）

1. `LoadBest` 文件缺失返回 `(nil, nil)` 非错误——best.go:59-61。C2a 的根据。
2. `LoadDomainDecls` 与 `LoadTarget` 的失败形态为普通 error（decls.go:18、target.go 的 LoadTarget）——C2b 按 error 分支降级。
3. `Edge [2]string` 序列化为 JSON 数组二元组——types.go:86。TS 侧镜像为 `[string, string]`。
4. 库级 `Check` 不产出 `budget-raised`（棘轮在 CLI 层拿 merge-base 对比）——2026-08-24 真机对照：同一数据 CLI check 32 条 budget-raised、库级闸 0 fails。C7 的根据。

## 拍板记录（三重闸门命中一条）

**透传库类型而非裁剪投影**。难逆转：wire 一旦被消费方按库 tag 镜像，改投影要同步两仓；无上下文会惊讶：11b（响应体瘦身）会诱使后人「顺手」把三键裁成投影，破坏「库 JSON tag 即契约」的单一事实源；真取舍：投影可省流量（handoff report 约几十 KB，相对 baseline 1.7MB 占比小，不值得为此建投影层）。被否方案：DTO 投影层。若 11b 落地做瘦身，须重走 contract 节点整体定投影，不许单键偷改。

## Ticket 0 骨架

- 消费方：`graph/webui/src/api/types.ts` 新增 C5 的接口与三个可选键——**纯类型，零行为**，`tsc --noEmit` 编译判据。
- 产出方：零新类型（透传库类型即契约本体），handler 行为改动归 implement。
- 视图 diff：charter 仓无 codegraph/（无图项目），跳过；handoff 侧 Ticket 0 无新符号，合法无视图。

## 交棒欠账

无——Ticket 0 无越壳行为；金样本类条目无命中（JSON 形态由 C1/C5 的编译期镜像 + implement 期 httptest 锁定，无哈希/派生类向量）。

## 修订记录

- 2026-08-24（breakdown 边界澄清，结论「不退回 contract」）：查看器为渲染定义的聚合类型（子系统卡模型、方向读数模型等）是 `graph/webui` 包内 API，**不属 C5 镜像面**；C5 只冻结 wire 的逐字镜像（`CgBest` / `CgTarget` / `CgCheckReport` 及其成员）。渲染层类型可自由演进，不构成契约变更。
