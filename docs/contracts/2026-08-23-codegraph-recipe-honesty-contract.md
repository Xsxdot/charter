# Contract：codegraph 配方刀（model 分种 / 协议契约域 / 声明锚归属）

> 卡：`C1.2`（父卡 `C1`）｜级别：**L3 轻档**｜spec：`docs/specs/2026-08-23-codegraph-recipe-honesty-spec.md`（已批准）
> 基线分支：`feat/codegraph-batch-two`（批次基线，已含 C1.1 目标图刀与 C1.4 前端搬迁刀）
> 状态：**已冻结**（2026-08-23）

---

## §1 查证基线与边界

本节的每一条都在**当轮工作树**（`feat/codegraph-batch-two`，HEAD `55d1f947`）与 handoff 真基线上复核过，不是照抄 spec。

### 1-1 代码事实（charter `graph/` 侧）

| 事实 | 复核结果 | 符号锚 |
|---|---|---|
| `Node` 无任何 model 子分类字段 | 确认。12 个字段，最后两个是 `Unscanned` / `ProjScanned` | `graph/codegraph/types.go#Node` |
| `Node.Kind` 三值裸字符串，无常量 | 确认 | `graph/codegraph/types.go#Node` |
| `Check` 现签名 | `func Check(t *Target, v *View) *Report` | `graph/codegraph/check.go#Check` |
| `Report` 三字段 | `Fails` / `Warns` / `LegacyHits`，**无 severity 字段**（档位＝落在哪个切片） | `graph/codegraph/check.go#Report` |
| `ValidateDecls` 无分档 | 确认，返回 `[]string`，任一条即非零退出 | `graph/codegraph/decls.go#ValidateDecls` |
| `LoadDomainDecls` 签名 | `func LoadDomainDecls(repoRoot string) (map[string]DomainDecl, error)` | `graph/codegraph/decls.go#LoadDomainDecls` |
| CLI 侧已有 decls 加载先例 | `graphValidateCmd` 内 `LoadDomainDecls` + `Merge(g, nil)`，可照抄 | `graph/cli/cli.go:117` |
| `graphCheckCmd` 接线点 | `codegraph.Check(t, v)` 单点调用，其后是棘轮 | `graph/cli/cli.go:226` |
| 锚的两级解析 | `ResolveAnchor` 先 `resolveGraphAnchor`（**纯**，只读 View），未命中才读文件做词边界兜底 | `graph/codegraph/resolve.go#ResolveAnchor`、`#resolveGraphAnchor` |
| 锚解析产物 | `AnchorResult{Ref,File,Line,Anchor,NodeID}`，`NodeID` 空＝图内未命中 | `graph/codegraph/resolve.go#AnchorResult` |
| 节点→领域的映射链 | `ViewNode.Container` → `Container.Domain`，全在 View 内，无需 I/O | `graph/codegraph/types.go#Container` |
| 领域划分无增量通道 | `View.Domains` 注释逐字写「diff 只改节点与边，不改领域划分」 | `graph/codegraph/merge.go:45` |
| 现有 Finding kind 常量家 | `graph/codegraph/fitness.go:15-27`，九个常量 | 同左 |

### 1-2 数据事实（handoff 真基线，本节点独立复算，非引用 spec）

| 读数 | spec 声称 | 本节点实测 | 结论 |
|---|---|---|---|
| 节点 kind 分布 | entry 118 / model 707 / func 2739 | 同 | ✅ |
| 有 lifecycle 的 model | 53（creator 51 / writer 21 / 兼有 19） | 同 | ✅ |
| `d_coordination_task` 的 model 数 | 194 | 194 | ✅ |
| `k_proto_model` 容器 model 数 | 111（挂在 `d_coordination_task`） | 同 | ✅ |
| 迁走后 `d_coordination_task` model 数 | 83 | 194−111＝83 | ✅ |
| `d_contract` 主属领域数 | 0 | 0 | ✅ |
| 领域主属分布 | 13 领域主属到 9 子系统 | 13 → 9 | ✅ |
| `anchor-off-domain` | 2（均为 `d_workspace` → `d_coordination_task`） | 2，逐条同 | ✅ |
| `anchor-off-graph` | 12（全属 `d_coordination_task`） | 12，全属同一域 | ✅ |

**十项全中，spec 的现状读数整体可信**，验收判据可直接引用其数字。

### 1-3 本刀不做（契约边界）

- 不抽 `Node.Kind` 三值常量（波及 8 文件的机械重构，与本刀无关）。
- 不拆现状大容器（被否决的拐杖，方向归 C1.1 目标图 + 迁移卡）。
- 不给 `ValidateDecls` 引入分档体系。
- 不动一行业务代码。

---

## §2 Wire schema

### 2-1 `Node.ModelKind`（新字段）

```go
type Node struct {
	Kind      string `json:"kind"`
	// … 既有字段不变 …
	ModelKind string `json:"modelKind,omitempty"` // 仅 kind=="model" 有意义
}
```

取值枚举，落 `graph/codegraph/types.go` 包级常量（新值无存量包袱，与「不抽 Kind 常量」不矛盾）：

```go
const (
	ModelKindEntity = "entity"
	ModelKindDTO    = "dto"
	ModelKindConfig = "config"
)
```

**空值语义冻结**：空＝**未分种**，不是「未知实体」。消费侧一律不得把空值当 `entity` 处理；统计实体数时空值不计入。

### 2-2 新增两个 Report kind（落 `fitness.go` 既有常量家）

```go
KindAnchorOffDomain = "anchor-off-domain"
KindAnchorOffGraph  = "anchor-off-graph"
```

两者**都进 `Warns`**，永不进 `Fails`。Finding 字段用法冻结：

| kind | `From` | `To` | `Detail` |
|---|---|---|---|
| `anchor-off-domain` | 声明方领域 id（`DomainDecl.Domain`） | 锚实际所属领域 id | 含锚原文 `file#Symbol` |
| `anchor-off-graph` | 声明方领域 id | **空串** | 含锚原文 `file#Symbol` |

---

## §3 算法与接缝

### 3-1 `Check` 签名变更（**取代 C1.1 契约冻结条 16**）

```go
func Check(t *Target, v *View, decls map[string]DomainDecl) *Report
```

> **对 C1.1 契约的取代声明**：`docs/contracts/2026-08-23-codegraph-target-domains-contract.md` 冻结条 16 写「`Check` 签名保持 `func Check(t *Target, v *View) *Report`」。该条**自本契约冻结之日起被本条取代**。取代理由：C1.1 冻结那条时，decls 尚不进 check（当时 check 不管声明），条 16 记录的是彼时的稳定承诺；本刀把「声明锚归属」这条判据纳入 check，入参扩张是判据范围扩张的必然结果，不是随意破坏。C1.1 契约须挂一条带日期的回写注记指向本条——**该回写是本刀 Ticket 0 的一部分，不得留到 implement 之后**。

`decls` 为 `nil` 或空 map 时，两条锚判据**整体跳过**，`Check` 的其余行为与今天逐字节相同（此为向后兼容的冻结判据，须有测试）。

### 3-2 纯函数约束不变——并据此更正 spec 的一处隐含设计

spec §三 说 `Check` 增 decls 入参且「纯函数，仍不做 I/O」，但未察觉：判定锚归属若走 `ResolveAnchor`，它会为文本兜底而 `os.ReadFile`，**纯函数当场破功**。

**冻结解法**：`Check` **不调用 `ResolveAnchor`**，只用 `resolveGraphAnchor(v, file, symbol)` 这条纯路径。由此：

- `anchor-off-graph` 的判据口径冻结为「**该锚在视图内无非 deleted 节点**」，而非 spec 措辞的「只能靠纯文本搜索兜底命中」。
- 两者的差集是「文本里也搜不到的锚」（`vanished` / `file_missing`）。这部分**不丢信号**：存在性本就是 `validate` 的职责（spec 自己划的分工「validate 管存在性，check 管正确性」），check 再报一次是重复。
- 代价与收益：check 侧无法区分「图外但存在」与「彻底消失」。这是有意的——要区分就得读盘，读盘就得给 `Check` 传 `repoRoot`，那会把 codegraph 唯一的纯判据函数变成 I/O 函数，为一个 validate 已经覆盖的信号付整个架构约束的代价。

### 3-3 两条锚判据的判定序（逐步冻结）

对每个 `decl`（按 `Domain` 字典序遍历，保证输出确定性）：

1. `decl.Domain` 不在 `v.Domains` 中 → **整个 decl 跳过**（域不存在是 `validate` 的硬 issue，此处不重复报）。
2. 收集该 decl 的全部锚：`Lifecycle.From`、`Lifecycle.To`、每条 `StateMachine[].Anchor`。空串跳过。
3. 锚**格式非法**（不含 `#`，或 `#` 两侧任一为空）→ **跳过**（格式是 `validate` 的职责，不重复报）。
4. `resolveGraphAnchor` 命中 → 取该节点的 `Container` → 取容器的 `Domain`：
   - 容器不存在或 `Domain` 为空 → 跳过（旧扫描数据的降级形态，不是声明作者的错）。
   - 该域 == `decl.Domain` → 无 finding。
   - 该域 != `decl.Domain` → 一条 `anchor-off-domain`。
5. `resolveGraphAnchor` 未命中 → 一条 `anchor-off-graph`。

**同一个锚最多产出一条 finding**（4 与 5 互斥）。同一个 decl 的多个锚各自独立判定；重复的锚原文**不去重**（声明里写两遍就是两条，去重会掩盖声明本身的冗余）。

### 3-4 `Validate` 侧的 modelKind 执法

落 `graph/codegraph/validate.go`（引用完整性的家），三条：

1. `ModelKind` 非空且不在枚举内 → issue（硬）。
2. `ModelKind` 非空但 `Kind != "model"` → issue（硬）。字段只对 model 有意义，挂在 func/entry 上是扫描者出错。
3. `ModelKind == "dto"` 却在 `lifecycle` 段里有 `writer` 条目 → issue（硬）。自相矛盾。

**不执法**：`ModelKind == "entity"` 却无 lifecycle 条目——只统计计数，沿用 validate 已有的「统计 unscanned entry 数量但不报 issue」先例。

### 3-5 领域划分的变更通道（把隐含约束显式化）

冻结为契约条文：**领域划分（`domains` 段与容器的 `domain` 归属）只能通过整份 baseline 重扫回灌变更，diff 永远不改领域划分。** 不得为一次性数据修订新增 `domainsAdded` / `containersModified` 之类的 schema 后门，也不得新增只用一次的修订命令。

容器改挂的语义边界一并冻结：**只有当容器的全部成员在语义上都不属于当前域时才改挂，不做部分拆分。**

### 3-6 配方对账义务

`graph/codegraph/types.go` 的 wire 字段表与 handoff `docs/codegraph-scan-recipe.md` 必须逐字段对齐。历史上 `lifecycle` 与 `containersAdded` 两次都漏了同步，本契约把它变成成文义务：**任何改动 wire schema 的刀，其 contract 节点必须列出配方需同步的字段清单；acceptance 未核对配方即不得归档。**

本刀需同步进配方的四项：`containersAdded` 段说明（roadmap 1h 销账）、`projections`/`projectionsAdded`/`projectionsDeleted` 与 `projScanned`、`modelKind` 判据表、`target.json` 的 `domains` 段不是扫描产出物。

---

## §4 冻结清单（逐条可独立判 pass/fail）

1. `Node` 增字段 `ModelKind string`，json tag 为 `modelKind,omitempty`。
2. 包级常量 `ModelKindEntity`/`ModelKindDTO`/`ModelKindConfig` 三个，值分别为 `entity`/`dto`/`config`。
3. `ModelKind` 空值语义为「未分种」；消费侧不得当 `entity` 处理。
4. 新常量 `KindAnchorOffDomain = "anchor-off-domain"`。
5. 新常量 `KindAnchorOffGraph = "anchor-off-graph"`。
6. 两条锚 finding 一律进 `Warns`，任何情况下不进 `Fails`。
7. `anchor-off-domain` 的 `From` 是声明方领域 id，`To` 是锚实际所属领域 id。
8. `anchor-off-graph` 的 `To` 为空串。
9. 两条 finding 的 `Detail` 均含锚原文 `file#Symbol`。
10. `Check` 签名为 `func Check(t *Target, v *View, decls map[string]DomainDecl) *Report`。
11. C1.1 契约冻结条 16 已挂带日期的取代回写注记（Ticket 0 内完成）。
12. `decls` 为 nil 或空时，`Check` 输出与本刀实现前逐字节相同。
13. `Check` 不得调用 `ResolveAnchor`，不得接受 `repoRoot`，不得做任何文件 I/O。
14. `decl.Domain` 不在 `v.Domains` 中时整个 decl 跳过，不产出任何 finding。
15. 锚格式非法（无 `#` 或两侧空）时跳过，不产出 finding。
16. 锚命中节点但容器缺失或容器 `Domain` 为空时跳过，不产出 finding。
17. 同一个锚最多一条 finding。
18. 同一 decl 内重复的锚原文不去重。
19. decl 遍历按 `Domain` 字典序，输出确定性。
20. 锚判据的 finding 与既有 finding 一同经 `sortFindings` 重排（沿用 C1.1 冻结的排序在最后追加之后执行）。
21. `Validate` 报 issue：`ModelKind` 非空且不在枚举内。
22. `Validate` 报 issue：`ModelKind` 非空但 `Kind != "model"`。
23. `Validate` 报 issue：`ModelKind == "dto"` 且该 model 在 lifecycle 段有 `writer` 条目。
24. `Validate` **不报** issue：`ModelKind == "entity"` 而无 lifecycle 条目（只计数）。
25. `graphCheckCmd` 加载 decls 的失败处置与 `graphValidateCmd` 一致（返回 err，不静默降级）。
26. 领域划分只能整份 baseline 重扫变更；本刀不新增任何 diff 段或一次性修订命令。
27. 容器改挂只在「全部成员都不属于当前域」时进行。
28. 本刀不新增任何第三方依赖（`graph/cli/deps_test.go#TestModuleDependencyAllowlist` 保持不变）。
29. 不抽 `Node.Kind` 三值常量。
30. 配方四项同步清单（§3-6）在 acceptance 前逐项核对完毕。

---

## §5 拍板记录

1. **`Check` 保持纯函数，锚解析只走图内**（§3-2）。这是本契约对 spec 的唯一实质性更正：spec 要求纯函数但其隐含设计会破功。取舍已写明——不为一个 validate 已覆盖的信号，把唯一的纯判据函数变成 I/O 函数。
2. **取代 C1.1 冻结条 16 走带日期回写，且回写落在 Ticket 0**。C1.1 review 的教训是「批偏离时没查前序契约」，本刀反过来：先查、先声明取代、先落回写，再动实现。
3. **锚判据一律 warn**。handoff 今天就有 14 条命中，硬红会逼出「改声明迁就现状」这一最坏拐杖。
4. **`d_workspace` 那两条锚不改声明**，认作 target gap 入迁移预算——它们在 agentd 大杂烩包里，1f 竖切本来就要搬走，现在做节点级改判是给即将作废的东西抛光。
5. **验收数字直接引用 spec**（本节点十项复核全中）：`d_contract` 主属 0→1、`d_coordination_task` model 194→83、全仓 entity ≈53、`anchor-off-*` warn 数＝14。

---

## §6 Ticket 0 与交棒

**Ticket 0（骨架，implement 前必须先落，且不含任何判据逻辑）**：

1. `Node` 加 `ModelKind` 字段 + 三个枚举常量（纯 schema，无执法）。
2. `fitness.go` 加两个 kind 常量（纯常量，无判据）。
3. `Check` 签名扩为三参，新入参**暂不使用**；全部调用点（`cli.go`、既有测试）同步改为传 `nil`。此步单独一提交，保证「签名变更」与「判据实现」可分别回滚。
4. **C1.1 契约挂取代回写注记**（冻结条 11）。

**交棒**：contract 冻结 → `charter:breakdown`。轻档，实现归一轮。

**与 C1.1 的数据时序（重申 spec 备注，contract 确认）**：两刀代码可并行，但 **handoff 侧数据落地必须串行**——先本刀全量重扫回灌（含 `d_protocol` 与 modelKind 打底），再跑 C1.1 的 gap 基数标定，否则 `unplacedBudget` 要重标两次。C1.1 已闭合但其 handoff 侧案例（C1.6）尚未开工，时序天然满足；C1.6 开工前须确认本刀的重扫已回灌。
