# Spec：codegraph 配方刀（model 分种 / 协议契约域 / 声明锚归属）

> 状态：**已批准**（2026-08-23，用户批准：「开吧」）
> 级别与档位：**L3 轻档**（动 wire 契约：`Node` 增 `modelKind` + `Check` 签名增 decls 入参 + 扫描配方修订）→ contract → breakdown → 单轮 implement → review → acceptance → finish
> 卡：`C1.2`（父卡 `C1` 代码图批次二）
> 来源：`docs/roadmap.md` 第 9 条；2026-08-23 roadmap 前置讨论

## 问题陈述

**目标图刀（C1.1）要机械测量"现状离目标有多远"，而今天的现状数据在三个地方撒谎。**测量的前提是被测的东西诚实——本刀只做这一件事，不多做。

三条病，全部有真数据（本轮实测，见下表）：

1. **实体与 DTO 混为一谈。** 全仓 707 个 model 节点，只有 53 个在 lifecycle 段里有创建者或写入者——其余 654 个是传输结构、配置结构、wire 类型。它们挤在同一个 `kind: "model"` 里，于是 `codegraph entity` 查询、领域实体表、查看器的实体徽标全被淹没。用户第二轮走查问的「一个领域为什么有那么多实体，这正常吗」，答案是：**不正常，但病不在领域切错，在"实体"这个词今天指了两样东西**。
2. **协议契约子系统整个是空的。** `d_contract` 子系统主属 **0** 个领域——它的 111 个 proto model 全在 `k_proto_model` 一个容器里，而这个容器挂在 `d_coordination_task` 域下，那个域的主属子系统是 `d_controlplane`。结果是：契约子系统点开一片空白，任务生命周期域被塞进 111 个与任务生命周期无关的 wire 类型。
3. **声明锚可以指向别人家的符号，而工具不报。** `d_workspace` 声明的两个生命周期锚（`PrepareWorkspace` / `RemoveManagedWorktree`）实际都落在 `k_agentd_fn` 容器里，归属 `d_coordination_task` 域。声明说"这是我的生命周期起止点"，图说"这两个符号不属于你"，`validate` 全绿。锚失联无声。

## 现状读数（2026-08-23 实测，contract 节点须对当轮工作树复核）

| 读数 | 值 | 出处 |
|---|---|---|
| 节点 kind 取值 | 仅 `entry` / `func` / `model` 三种，**无常量定义**，全仓裸字符串字面量 | `graph/codegraph/types.go#Node`（注释「Kind 三选一」） |
| model 子分类 | **无任何字段**；只能靠 `projections[].kind`（`typed`/`handroll`/`twin`）间接推断 | `graph/codegraph/types.go#Node`、`#Projection` |
| handoff 节点规模 | entry 118 / model **707** / func 2739 | `handoff/codegraph/baseline.json` 实测 |
| 有生命周期的 model | **53**（creator 51 / writer 21，两者兼有 19） | 同上 |
| 域内口径（走查现场那个数字） | `d_coordination_task`：194 model，仅 **11** 有生命周期 | 同上 |
| model 最多的三个容器 | `k_proto_model` 111（域 `d_coordination_task`）、`k_web_api_types_model` 87（`d_web`）、`k_agentd_model` 62（`d_coordination_task`） | 同上 |
| `d_contract` 子系统主属领域数 | **0**（其 paths 覆盖 `internal/proto/**` 等四目录，但这些文件的容器都挂在别的域下） | 同上，按多数票主属规则计算 |
| 领域主属分布 | 13 个现状领域主属到 9 个子系统；跨子系统者 4 个（`d_coordination_task` 跨 4、`d_workspace` 跨 3、`d_runtime_maintenance` 跨 3、`d_runtime_config` 跨 2） | 同上 |
| lifecycle 条目结构 | `{who, model, kind: creator\|writer, field?}`；**`field` 完全不校验**（creator 填了不报、writer 漏填不报） | `graph/codegraph/decl.go#LifecycleRef`、`graph/codegraph/validate.go#validateLifecycle` |
| 声明锚核验路径 | `lifecycle.from/to` 与 `stateMachine[].anchor` 走 `ResolveAnchor`（先查基线索引，未命中**回落纯文本词边界搜索**）；`invariants[].testRef` 是裸测试函数名，走 go/parser 全仓遍历 | `graph/codegraph/decls.go#validateDeclAnchor`、`graph/codegraph/resolve.go#ResolveAnchor`、`graph/codegraph/decls.go#repoTestFunctions` |
| `validate` **无分档** | `ValidateDecls` 返回 `[]string`，任一条即非零退出；对比 `check` 的 `Report{Fails,Warns}` | `graph/codegraph/decls.go#ValidateDecls`、`graph/codegraph/check.go#Report` |
| 锚归属**不查** | 现有 issue 只有：域不在图中 / 锚无法解析 / 锚失效（`vanished`、`file_missing`；`moved` 静默放行）/ testRef 不存在 | `graph/codegraph/decls.go#ValidateDecls` |
| 实测锚不在本域 | `d_workspace` 的 2 个锚 → 容器 `k_agentd_fn` → 域 `d_coordination_task` | 本轮实测 |
| 实测锚不在图内 | `d_coordination_task` 的 **12 条** stateMachine anchor 全指向 `internal/proto/proto.go#transitTable`，该符号**图内无节点**（unexported 包级符号），12 条全靠文本兜底命中 | 本轮实测 |
| decls 不进 check | `LoadDomainDecls` 只接在 `validate` 与 `entity` 上 | `graph/cli/cli.go#graphValidateCmd`、`graph/codegraph/entity.go#EntityLookup` |
| 领域划分**无增量通道** | diff 不含 domains 段（"diff 只改节点与边，不改领域划分"）；`ValidateDiff` 要求 `containersAdded` 引用**基线已有**领域 | `graph/codegraph/merge.go#View.Domains`、`graph/codegraph/validate.go#ValidateDiff` |
| 配方与 schema 的缺口 | 配方 217 行，diff 字段表缺 **`containersAdded`**（roadmap 1h）、缺 `projections*`、nodes 表缺 `projScanned`；**全文不覆盖 `codegraph/domains/*.json` 声明** | `handoff/docs/codegraph-scan-recipe.md` |
| 实测后果 | handoff 现有两份 diff 顶层 key 只有 `view/base/summary/nodesAdded/nodesModified`，一条 `containersAdded` 都没有 | `handoff/codegraph/diffs/*.json` |

## 方案（含弃选与理由）

### 一、model 分种：schema 加一位，判据进配方，存量机械打底

`Node` 增 `ModelKind string`（json `modelKind,omitempty`），取值 `entity` / `dto` / `config`，**空 = 未分种**（存量兼容，查询侧按"未知"处理而非报错）。

配方给 AI 扫描者的判据，按优先级从上往下，命中即止：

| 序 | 判据 | 结论 | 机械度 |
|---|---|---|---|
| 1 | 该 model 在 lifecycle 段有 creator 或 writer | **entity** | 全机械 |
| 2 | 是 proto/wire 生成物，或位于跨进程传输结构目录 | **dto** | 路径规则可机械打底 |
| 3 | 构造后只读、从配置文件/env 装载 | **config** | 需语义判断 |
| 4 | 以上都不是 | **dto**（兜底） | — |

兜底选 dto 而不是"未知"，因为实测先验强烈：707 中只有 53 个真实体，**默认是 DTO** 是对的。

**存量 707 个不靠人一个个填**：一次性打底可覆盖大头——有 lifecycle 的 53 个直接 entity，`internal/proto/**`（111）与 `web/src/api/**`（119）直接 dto，其余交扫描者在下一次全量重扫时判。打底脚本是一次性的，不入库。

**执法（`validate` 侧，硬 issue）**：`modelKind` 取值必须在枚举内；`modelKind == "dto"` 却在 lifecycle 段里有 writer 条目 → 自相矛盾，报错。
**不执法**：`entity` 却无 lifecycle 条目——只统计计数（沿用 validate 已有的"统计 unscanned entry 数量但不报 issue"先例），这个数字顺带成为 roadmap 1a（领域声明铺满）的进度表。

**弃选：**
- **靠 `projections` 段推断，不加字段**：projections 只覆盖有投影关系的类型（378 条），且它回答的是"这个类型在别处有对应物"，不是"这个类型是不是实体"——两个问题。
- **四值或更细（entity/dto/config/vo/…）**：YAGNI。三值已经能让实体表干净，再细就要开始争论边界。
- **按目录规则自动判、不落字段**：规则会随目录调整腐烂，且查询侧每次都要重算；落字段是一次判定处处可用。

### 二、协议契约域：新增 `d_protocol`，走**全量重扫**落地

新增现状领域 `d_protocol`（协议契约），把 `internal/proto/**` 的容器改挂到它。派生随即生效：这些文件在 `d_contract` 子系统的 paths 下，于是 `d_contract` 主属领域从 0 变 1，契约子系统全景回血；`d_coordination_task` 甩掉 111 个 wire 类型。

**落地通道是本刀要正面回答的一个真问题**：领域划分**没有增量通道**——diff 不含 domains 段，`ValidateDiff` 明确拒绝引用基线不存在的领域。三条路：

1. **全量重扫**（选中）：扫描者按新配方产出整份 baseline，回灌。刀 1+2 的 lifecycle 全量补扫（127 条）就是这个先例。
2. 给 Diff 加 `domainsAdded` / `containersModified` 段：为一次性数据修订开一个长期的 schema 后门，且直接违反"diff 不改领域划分"这条既有设计约束。**弃。**
3. 专门的一次性修订命令改 baseline：多一个只用一次的命令要维护，且它绕过扫描者的一致性自检。**弃。**

选 1 还有一个顺带的好处：**modelKind 存量补标与领域调整是同一次重扫的产物**，两件事一趟办完，不用重扫两次。

**弃选（重要）：把 `k_agentd_fn`（211 方法）这类大容器按语义拆开。**这正是被否决的拐杖——现状图的职责是诚实，那口锅难看就该让它难看，拆它的方案由 C1.1 的目标图给、由 1f 的迁移卡执行。本刀对容器只做**一件事**：把归属明显错误的（wire 类型挂进业务域）改对，不做"看起来更好"的重划。判断边界写死为一句话：**只有当容器的所有成员在语义上都不属于当前域时才改挂，不做部分拆分。**

### 三、锚归属：新增两条判据，放 **check 的 warn 档**，不放 validate

上一轮讨论里我说的是"validate 新查"，读码后**更正**：`validate` 没有分档机制，任何 issue 都是硬红。而 handoff 今天就有 14 条锚落在别人家（`d_workspace` 2 条 + `d_coordination_task` 的 12 条图外锚），报成硬红会让 validate 当场不可用，逼出的处置只能是"改声明去迁就现状"——那是最坏的一种拐杖。

裁决：**两条判据都进 `check` 的 warn 档**：

| kind | 语义 |
|---|---|
| `anchor-off-domain` | 声明锚解析出的节点，其容器所属领域 ≠ 声明的领域 |
| `anchor-off-graph` | 声明锚在图内无节点，只能靠纯文本搜索兜底命中 |

分工由此清晰：**`validate` 管存在性（引用完整性），`check` 管正确性（归属与契约）。**这也顺带解释了为什么 decls 今天不进 check——因为 check 此前不管声明。本刀把 `LoadDomainDecls` 的结果作为入参传进 `Check`（纯函数签名变更，归 contract 冻结）。

判决三选一照 ⧉ 同款（roadmap 第 7 条修法条款）：**改声明锚 / 改扫描归属 / 认作 target gap 入预算等迁移**。对 `PrepareWorkspace` 这个实测案例，本 spec 的立场是**第三条**：它在 agentd 大杂烩包里，1f 竖切本来就要把它搬走；现在做节点级归属改判，等于给即将作废的东西抛光，而且"锚驱动的细粒度改判"正是拐杖的近亲。锚失联入预算，本身就是一条诚实的 gap 记录。

**弃选：**
- **给 `ValidateDecls` 引入分档体系**：validate 全体系无档，为一条判据引入两档是把架构改动塞进数据刀。
- **`anchor-off-graph` 直接报 fail**：图外锚有正当情形（unexported 符号本就不入图），逼人给 `transitTable` 造节点是让数据迁就判据。

### 四、扫描配方修订（本刀的第四份交付物）

配方今天与 schema 有四处不一致，其中一处已在 roadmap 1h 挂账。一并修订：

1. **补 `containersAdded` 段说明**（roadmap 1h 销账）——不补，AI 扫描者就永远产不出能引入新容器的 diff，刀 3+4 修好的通道等于没通。
2. **补 `projections` / `projectionsAdded` / `projectionsDeleted`** 与 nodes 表的 `projScanned` 字段。
3. **补 `modelKind` 判据表**（本刀一）与**协议契约域的划分规则**（本刀二）。
4. **明写「`target.json` 的 `domains` 段不是扫描产出物」**（C1.1 的契约要求）——否则 AI 扫描者会"顺手补全"目标图。

**不做**：把 `codegraph/domains/*.json`（领域声明）纳入配方、变成可派发产物。声明是人写的语义承诺（职责、不变式、状态机），让扫描者生成会得到一堆正确但空洞的话。→ 落 roadmap。

## 用户故事

1. 作为查看器用户，我打开任何一个领域，实体表里只有真实体（有创建/写入点的那些），DTO 与配置结构折进一行计数。
2. 作为 agent，我跑 `codegraph entity` 得到的是实体列表，不是 707 个结构体的字典。
3. 作为架构师，我点开契约子系统能看到协议契约域，而不是一片空白；任务生命周期域不再包含 111 个 wire 类型。
4. 作为领域声明的作者，我写错锚（指向别的域、或指向图外符号）会在 `check` 里看到 warn，而不是全绿放过。
5. 作为 C1.1 的下游，我算出来的 gap 数字建立在诚实的现状数据上——领域成员数、实体数、接口数都不再被容器归属错误污染。
6. 作为 AI 扫描者，我照配方产出的 diff 能声明新建容器，不会被 `ValidateDiff` 拒收。

## 契约语义与接缝（L3）

- **`Node.modelKind`**：新 wire 字段，三值枚举 + 空。空值语义是"未分种"，**不是** "未知实体"——查询侧不得把空值当 entity 处理。
- **`Check` 签名变更**：新增领域声明入参（纯函数，仍不做 I/O；加载仍在 CLI 层）。这是本刀唯一的 API 破坏性变更，contract 节点冻结形态。
- **领域划分的变更通道**：明确写进契约——**只能整份 baseline 重扫回灌，diff 永远不改领域划分**。这是把既有隐含约束显式化，防止后来者为省事开后门。
- **容器改挂的边界**：只在"容器全部成员都不属于当前域"时改挂，不做部分拆分。这条是语义约束，写进配方与契约备注。
- **配方是 AI 执行者的契约**：配方与 `graph/codegraph/types.go` 的字段表必须逐字段对齐；本刀补齐后，contract 节点须留一条"schema 变更时配方同步"的对账义务（历史上 lifecycle、containersAdded 两次都漏了）。
- **id 命名空间**：`d_protocol` 遵循 C1.1 定下的约定——目标域 id 与终态现状域 id 同名。

**接缝**：不新增跨进程接缝；charter/graph ↔ handoff 之间仍只有 baseline/target/diff 三类文件 + 配方文档。

## 实现决定

- `modelKind` 落 `graph/codegraph/types.go#Node`；枚举校验与 dto/writer 矛盾查落 `graph/codegraph/validate.go`（`Validate` 已是引用完整性的家）。
- 两条 anchor 判据落 check 侧新判据文件（与 `fitness.go` 同构）；`Check` 增 decls 入参，CLI 侧 `graphCheckCmd` 补 `LoadDomainDecls` 调用（`graphValidateCmd` 已有先例可抄）。
- `kind` 三值今天是全仓裸字符串——本刀**不顺手抽常量**（波及 8 个文件，与本刀无关，属于重构噪声）。→ 落 roadmap。
- handoff 侧交付物三件：全量重扫产出的新 baseline（含 `d_protocol` 与 modelKind 打底）、配方文档修订、`d_workspace` 声明的处置留痕（选第三条路 = 不动声明，check 报 warn 即预期状态）。

## 测试决定（接缝清单）

**最高的可测缝仍是 `graph/codegraph` 的纯函数，两个：**

1. **`codegraph.Check`**（主缝）：`anchor-off-domain` / `anchor-off-graph` 两条判据的表驱动用例，含正例（锚在本域且在图内 → 无 finding）、边界（锚解析失败时不重复报）、以及 decls 为空时整体跳过。
2. **`codegraph.Validate`**（次缝）：`modelKind` 枚举、dto 带 writer 的矛盾、空值放行、entity 无 lifecycle 只计数不报错。

不为一次性打底脚本写测试（它不入库）；不为配方文档写测试（文档对账靠 contract 节点的对账义务）。真机验收 = handoff 全量重扫后跑 `validate` + `check`，核对四个数字：`d_contract` 主属领域数 0→1、`d_coordination_task` 的 model 数 194→83、全仓 entity 数 ≈53、`anchor-off-*` warn 数 = 14。

## Out of Scope

**永不做：**
- **按语义批量拆现状容器/领域去凑一张好看的图**——被否决的拐杖，方向已反。
- **让 diff 能改领域划分**（`domainsAdded` 之类的 schema 后门）。
- **让扫描者生成领域声明**（`domains/*.json` 的语义承诺必须人写）。

**本期不做、后续要做（逐条落 roadmap）：**
- `lifecycle` 的 `field` 字段不校验（writer 漏填 field / creator 多填 field 都静默）——独立的小判据。
- 节点 `kind` 三值抽常量（波及 8 个文件的机械重构）。
- 配方覆盖 `codegraph/domains/*.json` 的可能性（若将来声明要走派发产出）。
- `web/src/api/**` 的 TS 类型是否要独立成域（119 个 model 目前混在 `d_web`）——先分种，成域与否等目标图。
- `entity` 无 lifecycle 的计数从"统计"升格为执法的时点（等 roadmap 1a 声明铺满到一定比例）。

## 备注

- **与 C1.1 的时序**：本刀会产出一份新的 baseline（全量重扫），而 C1.1 的 gap 判据读 baseline。两刀可并行开发（改的是不同文件），但 **handoff 侧的数据落地要串行**：先本刀重扫回灌，再跑 C1.1 的 gap 基数标定，否则预算数字要重标两次。
- 本刀同样**不动一行业务代码**：交付物是 schema 一位、两条判据、一份重扫数据、一份配方修订。
- 图覆盖债：charter 仓自身无 `codegraph/`，现状读数全部来自读码与对 handoff 真数据的脚本统计，符号锚已逐条标注。
