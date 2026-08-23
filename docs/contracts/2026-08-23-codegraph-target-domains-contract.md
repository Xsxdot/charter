# 契约：codegraph 目标图刀（目标领域、gap 判据与棘轮）

> 状态：**已冻结**（2026-08-23，随本提交）
> 上游：`docs/specs/2026-08-23-codegraph-target-domains-spec.md`（已批准 2026-08-23）
> 起点：`graph/v0.3.0`；本增量 additive，`meta.version` 不变
> 冻结物：本仓没有自托管的 `codegraph/target.json`；本文档是目标图契约冻结物，handoff 侧数据由后续跨仓节点落盘

## §1 查证基线与边界

本轮工作树的现状事实如下，均以符号锚为准：

| 契约面 | 当前事实 | 出处 |
|---|---|---|
| target 顶层 | `Target{Meta, Subsystems, Assignments, Assembly, Contracts}`，schema 版本由 `LoadTarget` 硬门锁定为 2 | `graph/codegraph/target.go#Target`、`graph/codegraph/LoadTarget` |
| 子系统 | `TargetSubsystem{ID, Name, Type, Paths, Note}`，本提交增 `Domains`、`UnplacedBudget`、`UnplacedBudgetNote` | `graph/codegraph/target.go#TargetSubsystem` |
| 目标域骨架 | `TargetDomain{ID, Name, Responsibility, Paths}`，嵌套在 `TargetSubsystem` 内，无外键 | `graph/codegraph/target.go#TargetDomain` |
| 路径语法 | 精确路径或 `dir/**`；空串、`[]?{}`、裸 `**` 等非法 | `graph/codegraph/target.go#validPathRule` |
| 文件归属 | `assignments` 精确匹配优先，其次按子系统 `paths` 声明序首次匹配，未命中返回空串 | `graph/codegraph/target.go#Target.SubsystemOf` |
| 主执法缝 | `func Check(t *Target, v *View) *Report`，输入合并后的视图，deleted 节点/边不参与 | `graph/codegraph/check.go#Check`、`graph/codegraph/merge.go#Merge` |
| 报告 | `Report{Fails, Warns, LegacyHits}`；档位由 finding 落在哪个 slice 表达，无 severity 字段 | `graph/codegraph/check.go#Finding`、`graph/codegraph/check.go#Report` |
| 预算棘轮 | `func CheckBudgetRatchet(cur, base *Target) []Finding`，当前只比较契约 `legacyBudget` | `graph/codegraph/fitness.go#CheckBudgetRatchet` |
| CLI 调用序 | `LoadTarget` → `ValidateTarget` → `Check` → `loadBudgetBase` → `ApplyBudgetRatchet` → JSON 输出；本刀不增子命令 | `graph/cli/cli.go#graphCheckCmd`、`graph/codegraph/fitness.go#ApplyBudgetRatchet` |

> **2026-08-23 C1.1 实况更正**：上表「CLI 调用序」一行原写 `graph/cli/cli.go#appendBudgetRatchet`。该符号已在本刀实现中**删除**——按 §3-3 的要求，note 查找与分档下沉成了 `codegraph` 包的 `ApplyBudgetRatchet`（内部调 `CheckBudgetRatchet` 并收尾重排），CLI 只剩 `loadBudgetBase` 的 git 取数与一次调用。锚点已按实况改写。

本仓顶层没有 `codegraph/` 目录，故本轮不伪造 handoff 的 `baseline.json`、`target.json` 或目标域树；`d_controlplane` / `d_cli` 的具体职责与路径属于 handoff 侧已批准 spec 的数据交付，不在 charter 仓凭空补写。

## §2 Wire schema：`target.json`

### 2-1 新类型与字段

以下是已落入 `graph/codegraph/target.go#TargetDomain` 和 `#TargetSubsystem` 的可编译 Go 形状：

```go
type TargetDomain struct {
	ID             string   `json:"id"`
	Name           string   `json:"name"`
	Responsibility string   `json:"responsibility"`
	Paths          []string `json:"paths"`
}

type TargetSubsystem struct {
	ID                 string         `json:"id"`
	Name               string         `json:"name"`
	Type               string         `json:"type"`
	Paths              []string       `json:"paths"`
	Note               string         `json:"note,omitempty"`
	UnplacedBudget     int            `json:"unplacedBudget,omitempty"`
	UnplacedBudgetNote string         `json:"unplacedBudgetNote,omitempty"`
	Domains            []TargetDomain `json:"domains,omitempty"`
}
```

原子字段约束：

1. `TargetSubsystem.Domains` 是唯一目标域入口；目标域结构上只属于声明它的子系统，不设 `subsystem` 外键，不设 `parent`。
2. `TargetDomain.ID` 在整个 target 文档内唯一，并沿用终态 baseline 领域 id 的命名约定；本期不执法它是否已存在于 baseline。
3. `TargetDomain.Responsibility` 必须非空；`ID`、`Name` 的非空语义不在本期新增校验中，避免凭空扩大 schema 约束。
4. `TargetDomain.Paths` 与父子系统的 `Paths` 使用同一规则形态：精确路径或 `dir/**`，复用 `validPathRule` 的既有语义。
5. 每条目标域路径必须被所属子系统至少一条路径覆盖。覆盖关系只按两种路径规则的字面集合关系计算，不使用 `assignments`、符号名或语义推断。
6. 同一子系统内任意两个目标域的路径集合不得重叠；不同子系统之间既有 `paths` 重叠缺口不在本刀新增执法范围。
7. `UnplacedBudget >= 0`，缺省零表示无容忍预算；`UnplacedBudgetNote` 只给预算上涨棘轮降档使用，不改变实际 `unplaced-over-budget` 的 fail 判定。
8. `Domains`、`UnplacedBudget`、`UnplacedBudgetNote` 均为 additive 字段并使用 `omitempty`；缺失 `domains` 的旧 target 仍可被旧二进制读取，且不触发目标领域执法。
9. `meta.version` 仍必须为 2；本刀不改 `LoadTarget` 的版本门，也不改 `migrateV1Target` 的顶层 v1 `domains`→`subsystems` 改写语义。v2 严格迁移读取通过新增字段；v1 迁移输入不接受本期新增的 v2 内层字段。

### 2-2 报告 wire 值

新 finding kind 只增加以下三个；既有 `budget-raised` 复用，不另造同义 kind：

| kind | 档位 | `From` / `To` | 原子判定 |
|---|---|---|---|
| `unplaced` | warn | `From=子系统 id`，`To` 省略 | 该子系统的图内文件中，未命中本子系统任一目标域路径的唯一文件数 `n`，且 `n <= UnplacedBudget` |
| `unplaced-over-budget` | fail | `From=子系统 id`，`To` 省略 | 同一 `n` 严格大于 `UnplacedBudget` |
| `domain-empty` | warn | `From=子系统 id`，`To` 省略 | 该目标域的路径在当前视图非 deleted 节点文件集合中零命中 |

新增常量骨架已经落在 `graph/codegraph/fitness.go#KindUnplaced`、`#KindUnplacedOverBudget`、`#KindDomainEmpty`。本轮它们仍是 Ticket 0 符号，`rg` 查证暂无生产发出方或消费方，故按纪律标为「疑似漂移（待 implement 接线）」；implement 必须让 `Check` 发出，CLI JSON 原样承载，后续查看器按 `kind` 分流。`KindBudgetRaised` 由 `#CheckBudgetRatchet` 产出，按当前 target 的 note 分档，CLI 测试直接消费该 wire 值。

> **2026-08-23 C1.1 实况更正**：上段原写「CLI 的 `#appendBudgetRatchet` 按当前 target 的 note 分档」。该符号已删除，分档现由 `graph/codegraph/fitness.go#ApplyBudgetRatchet` 在 `codegraph` 包内完成（与 §1 的更正同源）。同段「三个 kind 仍是 Ticket 0 符号、暂无发出方」的读数也已被本刀 implement 推翻：三者现由 `graph/codegraph/gap.go#targetDomainFindings` 经 `Check` 发出。两处均为冻结时点的现状快照，此处按实况留痕，判据本身不变。

`Detail` 是人读字符串，但以下信息是契约，不得省略：

- `unplaced` / `unplaced-over-budget` 必须带 `n/budget`，并带按仓内 `/` 路径字典序取前若干条的样例文件；样例不得逐文件生成 finding。
- `domain-empty` 必须带目标域 id。
- `budget-raised` 对子系统预算上涨时 `From=子系统 id`、`To` 省略；对契约预算上涨时沿用既有 `From`/`To`。

## §3 算法与接缝

### 3-1 `Check`：gap 判据并入既有主缝

`Check` 的跨仓签名保持不变：

```go
func Check(t *Target, v *View) *Report // 现状出处：graph/codegraph/check.go:38
```

实现阶段在既有归域与报告组装流程中追加目标域判据，最终仍由 `Check` 返回单个 `Report`；不新增 `codegraph gap` 子命令，不新增报告顶层字段，不把判据复制到 CLI。

执行口径固定为：

1. 只对 `len(subsystem.Domains) > 0` 的子系统执法；未声明 `domains` 的子系统整体跳过，包括 `unplaced`、`domain-empty` 与目标领域预算棘轮。
2. 文件集合取 `View.Nodes` 中 `Status != "deleted"` 的节点文件去重，沿用 `fitness.go#viewFiles` 的图内口径，不访问文件系统。
3. `unplaced` 的 `n` 只统计 `Target.SubsystemOf(file) == subsystem.ID` 且没有命中该子系统任一 `TargetDomain.Paths` 的唯一文件；图外文件仍由既有 `outside-file` 单独处理。
4. `domain-empty` 对每个零命中的目标域产生一条 warn；命中只看当前视图文件集合，不按 baseline 领域、不按容器 `Domain`、不按 AI 语义归域。
5. 每个子系统最多产生一条 `unplaced` 或 `unplaced-over-budget`；计数为零不产生 finding。目标域可产生多条 `domain-empty`，因为每条都是独立可判定的目标缺口。
6. 所有 gap finding 与既有 finding 一起进入 `sortFindings`；预算棘轮追加后必须再次统一排序，不能复现当前 CLI「先排序、后追加」造成的顺序漂移。

### 3-2 `ValidateTarget`：加载期结构门

签名保持：

```go
func ValidateTarget(t *Target) []string // 现状出处：graph/codegraph/target.go:106
```

在既有子系统、assignment、契约校验后增加以下独立问题：目标域全局 id 重复、`responsibility` 为空、目标域路径规则非法、目标域路径不被父子系统路径覆盖、同级目标域路径重叠、`unplacedBudget < 0`。问题清单仍是字符串 slice，空 slice 才表示合法；不在 `ValidateTarget` 中读 baseline、视图或文件系统。

### 3-3 `CheckBudgetRatchet`：两类预算共用棘轮

签名保持：

```go
func CheckBudgetRatchet(cur, base *Target) []Finding // 现状出处：graph/codegraph/fitness.go:38
```

它继续是无 I/O 纯函数，新增比较对象为声明了目标领域的子系统：

- 当前 target 有该子系统、基准 target 无该子系统时，基准 `unplacedBudget` 按 0；当前值大于 0 即 `budget-raised`。
- 当前值严格大于基准值才产 finding；相等或下降不产 finding。
- 契约预算仍按 `From->To` 比较，语义不变。
- 目标域预算上涨的 note 取当前子系统 `UnplacedBudgetNote`；契约预算上涨的 note 取当前契约 `LegacyBudgetNote`。
- note 经 `strings.TrimSpace` 后为空才算无理由；无理由进 `Report.Fails`，有理由进 `Report.Warns`。该降档判断必须下沉到 `codegraph` 包的纯函数，CLI 只负责 `loadBudgetBase` 的 git 取数与调用。
- `unplaced-over-budget` 是当前实际 gap 超预算，永远独立进 `Fails`；预算上涨的 `budget-raised` 是棘轮事件，两者不得互相替代或合并。

当前 `graph/cli/cli.go#appendBudgetRatchet` 的现状签名为：

```go
func appendBudgetRatchet(rep *codegraph.Report, cur, base *codegraph.Target) // graph/cli/cli.go:242
```

implement 必须把其中的 note 查找和分档移入 `codegraph` 纯函数，并保持 CLI 的 git 读取边界；`graphCheckCmd` 的 `LoadTarget`、`ValidateTarget`、`Check`、输出 JSON 与「`Fails` 非空转非零」语义不变。具体 helper 保持包内私有，不新增跨仓 API。

### 3-4 依赖库既成行为

本刀命中的是本地 JSON 与纯函数，没有读限、超时、保活、握手或网络端点；`graph/codegraph` 不引入依赖，CLI 仍只钉 `github.com/spf13/cobra v1.10.2`（`graph/go.mod:3-5`）。相关库行为已查证：

- `LoadTarget` 使用 `encoding/json.Unmarshal`（`graph/codegraph/target.go:84`）；Go 标准库默认忽略未知对象键（`/usr/local/go/src/encoding/json/encode.go:36-40`），所以旧二进制会静默忽略新增的内层 `domains`，这是本刀声明的向后兼容边界。
- 新字段的 `omitempty` 行为由 Go 标准库定义：零值 `int`、空 slice、空 string 会从编码结果省略（`/usr/local/go/src/encoding/json/encode.go:100-110`）。因此未声明目标领域的旧 target 不会被反序列化后再写出空段，除非调用方显式填值。
- 不得把 `Decoder.DisallowUnknownFields` 的严格行为误套到 `LoadTarget`；该行为只存在于 `migrate.go#decodeStrict`（`graph/codegraph/migrate.go:98-101`），迁移与常规加载边界保持现状。
- `SubsystemOf` 继续依赖 `strings.CutSuffix` 的「匹配返回去掉后缀的前缀、否则返回原串和 false」行为（`/usr/local/go/src/strings/strings.go:1285-1290`）。目标域路径匹配必须复用同一精确路径 / `dir/**` 规则，不能引入 glob 库。
- `sortFindings` 使用 `slices.SortFunc`；比较器必须满足严格弱序（`/usr/local/go/src/slices/sort.go:24-32`），并在所有 finding 进入报告后再排序。

## §4 冻结清单（逐条可独立判 pass/fail）

1. `TargetDomain` 的 Go 字段恰为 `ID string`、`Name string`、`Responsibility string`、`Paths []string`。
2. `TargetDomain` 的 JSON 键恰为 `id`、`name`、`responsibility`、`paths`。
3. `TargetSubsystem.Domains` 类型为 `[]TargetDomain`，JSON 键为 `domains` 且 `omitempty`。
4. `TargetSubsystem.UnplacedBudget` 类型为 `int`，JSON 键为 `unplacedBudget` 且 `omitempty`。
5. `TargetSubsystem.UnplacedBudgetNote` 类型为 `string`，JSON 键为 `unplacedBudgetNote` 且 `omitempty`。
6. 目标域只通过嵌套关系归属子系统，不新增 `subsystem` 外键。
7. 目标域不新增 `parent`，本期目标域树为平铺结构。
8. `meta.version` 仍为 2，`LoadTarget` 的 version≠2 拒载文案不变。
9. 缺失或空 `domains` 的子系统整体跳过目标领域执法。
10. 目标域 id 在整个 target 文档内重复时 `ValidateTarget` 返回问题。
11. 目标域 `responsibility` 为空时 `ValidateTarget` 返回问题。
12. 目标域路径复用精确路径 / `dir/**` 规则，非法 wildcard 形态被拒。
13. 目标域路径未被所属子系统 `paths` 覆盖时 `ValidateTarget` 返回问题。
14. 同一子系统内任意两目标域路径重叠时 `ValidateTarget` 返回问题。
15. `UnplacedBudget < 0` 时 `ValidateTarget` 返回问题。
16. `Check` 签名保持 `func Check(t *Target, v *View) *Report`。
17. `unplaced` 统计非 deleted 视图节点文件去重后的唯一文件。
18. `unplaced` 只统计当前子系统归属且未命中其任一目标域路径的文件。
19. `unplaced <= UnplacedBudget` 时产生一条 warn，kind 恰为 `unplaced`。
20. `unplaced > UnplacedBudget` 时产生一条 fail，kind 恰为 `unplaced-over-budget`。
21. 每个零命中目标域产生一条 warn，kind 恰为 `domain-empty`。
22. gap 判据按子系统聚合，不按未落位文件逐条刷 finding。
23. gap finding 的 `From` 为所属子系统 id，`To` 省略。
24. `unplaced` / `unplaced-over-budget` Detail 带 `n/budget` 与稳定排序样例。
25. `domain-empty` Detail 带目标域 id。
26. `CheckBudgetRatchet` 签名保持 `func CheckBudgetRatchet(cur, base *Target) []Finding`。
27. `CheckBudgetRatchet` 同时比较 contract `legacyBudget` 与已声明目标域子系统的 `unplacedBudget`。
28. 基准缺席的契约或目标域预算按 0 参与上涨比较。
29. 预算上涨严格比较 `current > base`；相等或下降不命中。
30. 目标域预算上涨的 `budget-raised` 使用 `From=子系统 id`、省略 `To`。
31. 预算上涨 note 取当前 target，`TrimSpace` 后非空才降为 warn。
32. `budget-raised` 的降档不改变 `unplaced-over-budget` 的 fail。
33. CLI 不新增 gap 子命令，不复制 gap 归属算法。
34. 所有 finding（含 budget-raised）进入报告后才统一排序，重复运行输出顺序稳定。
35. `graph/codegraph` 不引入新第三方依赖，不产生网络端点。
36. handoff 侧仅由用户批准后的 `d_controlplane` 与 `d_cli` 目标域树写入其 `codegraph/target.json`；charter 本提交不伪造该跨仓数据。
37. `graph/codegraph/target_test.go#TestTargetDomainJSONGolden` 的 JSON 金样本测试通过，新增键名、顺序、`omitempty` 与回读结构均锁定。

## §5 拍板记录（三重闸门命中项）

**一、目标领域嵌套在子系统下。** 难逆转：目标域是 handoff 竖切的跨仓 wire 依据，改成平行表会同时动 graph、扫描配方、查看器和迁移卡；无上下文会惊讶：后人会想给领域补 `subsystem` 外键或跨子系统复用；真取舍：否决顶层 `targetDomains[] + subsystem`（把结构不变式降成运行时校验）和独立 `target-domains.json`（冻结物分裂）。本期不做目标域 `parent`。

**二、目标域归属只用路径规则。** 难逆转：竖切完成后目录即是归属事实，第二套映射会让目标图与代码位置分叉；无上下文会惊讶：迁移前大包文件命不中目标域，看起来像“判据没工作”；真取舍：否决文件 assignment、容器清单和 AI 语义归属，因为它们会把“图上落位、代码没动”变成可通过的自欺。本期不做目标域语义判归属。

**三、gap 并入 `Check` 且按子系统聚合。** 难逆转：`Check` 是现有跨仓 gate 与查看器的唯一对照入口，另造命令会分裂加载、视图与排序语义；无上下文会惊讶：61 个未落位文件不会得到 61 条红线；真取舍：否决逐文件 finding（迁移首轮不可用）和独立 `codegraph gap`（重复 `target + View` 归域）。本期不新增 gap JSON 顶层结构。

**四、预算棘轮继续以 git 基线比较，并覆盖目标域预算。** 难逆转：棘轮参照物改变会影响所有迁移批次与 acceptance；无上下文会惊讶：目标域预算上涨和契约预算上涨共用 `budget-raised`，但目标域使用 `From`、省略 `To`；真取舍：否决把预算快照写进 baseline（全量重扫会洗掉历史涨幅）和在 CLI 复制第二套分档。`legacyBudget`/`unplacedBudget` 上涨有理由可降 warn，但实际超预算不降档。

## §6 Ticket 0 与交棒声明

- **本轮落码**：仅新增 `TargetDomain` 类型、`TargetSubsystem` 的三个 additive 字段和三个 finding kind 常量空壳；没有实现 gap 可观测行为，没有修改 CLI 行为，没有写 handoff 目标数据。
- **Ticket 0 测试账**：新增符号均为空壳/直通数据形状，未实现可观测判据；因此不以零测试冒充已实现语义。implement 节点必须先补红绿测试，再接入 `Check`、`ValidateTarget`、预算棘轮和 CLI 排序。
- **目标图**：本仓无 `codegraph/target.json`，目标图数据与分支视图 diff 按存量无图项目规则跳过；handoff 侧两个目标域树是下游跨仓交付，不能在此仓伪造。
- **可执行冻结**：命中 JSON 编码格式；金样本测试 `graph/codegraph/target_test.go#TestTargetDomainJSONGolden` 已锁定新增字段名、字段顺序、`omitempty` 形态与回读结构，并已在本轮通过。无哈希或密钥派生条目。
- **欠账（显式）**：handoff 侧 `d_controlplane` / `d_cli` 的用户批准目标域树、`codegraph/target.json` 写入及真机 `check` 复核不在当前仓权限与本节点范围内，交由 implement/acceptance 节点处理；不存在“charter 已写入目标图”的假声明。
- **交棒**：breakdown。

## §7 拆解节点边界澄清（2026-08-23）

- `graph/codegraph` 与 `graph/cli` 属同一逻辑型实现面；`Check`、`ValidateTarget`、`CheckBudgetRatchet` 是包内/本仓 API，不新增跨子系统契约面，真正的 wire 面仍只有 `target.json` 与既有 `Report` JSON。
- `unplacedBudgetNote` 只影响预算上涨 `budget-raised` 的 Fails/Warns 分档；实际 gap 超预算的 `unplaced-over-budget` 永远是 fail，两者不合并。
- handoff 的 `codegraph/target.json` 与扫描配方是既有跨仓 target.json 接缝上的数据/文档消费者；本轮不新增接缝，charter 仓不伪造 handoff 文件，行为结论归协调者真机核验。
