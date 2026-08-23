# 契约：codegraph 最优图（best.json 接管结构树，gap 改为两图 diff）

**卡**：C1.8（父卡 C1「代码图批次二：目标图驱动的架构迁移」）
**级别与档位**：L3 轻档。跨仓：`codegraph/target.json` 与新增的 `codegraph/best.json` 都是 charter `graph` 模块与 handoff 之间的文件格式契约，本侧改 schema 即动契约层。工作量集中在 `graph/codegraph` 单包，远低于扇出阈值，故轻档：contract → breakdown → 单轮 implement。
**无 spec**：用户直接指令开 contract（2026-08-23）。设计裁决与实测支撑在卡 C1.8 的 comment 里，本文档的 §1 复述其结论并补齐落地精度。
**状态**：**已批准（2026-08-23）**。用户看完全文并确认 §1-3 那处自我修正（棘轮不套 `container-misplaced`，C1.1 拍板记录二成立），同批准 §11 的边界矩阵回写。

---

## §1 裁决与作废范围

### 1-1 用户定义

> 「我期望的目标图，或者应该说叫最优图，就是基于当下代码实现的功能，最优的子系统/领域结构应该是什么样子的，比如现在的基准是 baseline.json，那这个最优图应该叫 best.json」

并明确更正：**「目标域 = 一个包目录」是实现方引进的假设，用户从未提出**。

### 1-2 作废什么

C1.1（`2026-08-23-codegraph-target-domains-contract.md`）用 `TargetDomain.Paths` 表达领域归属。**路径规则只能复述今天的目录布局**——它能表达的「应然」上限就是「把文件挪进这个目录」，因此它无法表达任何不与目录同形的职责划分。这与项目自己的配方教条（`docs/codegraph-scan-recipe.md`:142「领域是职责，不是目录」）直接冲突。

作废：`TargetDomain`、`TargetSubsystem.Paths`、`TargetSubsystem.UnplacedBudget`、`TargetSubsystem.UnplacedBudgetNote`、`targetDomainFindings` 及其三条判据、`targetRuleMatchesFile`、`validPathRule`、`targetPathCovers`、`targetPathsOverlap`、`cutTargetRule`、`Assignment`。
存活：`Contract`（含 `LegacyBudget` 与其棘轮）、`Assembly`、findings 接进 `Check` 的接线、`sortFindings`、`CheckBudgetRatchet` 的契约预算那一半。

**作废成本此刻为零**：handoff 的 `codegraph/target.json` 至今没有写过任何一个 `domains` 条目（实测：`subsystems[]` 只出现 `id/name/type/paths/note` 五个键），无存量数据需要迁移。

### 1-3 直面 C1.1 拍板记录二的反对意见

C1.1 拍板记录二否决过「容器清单」作为归属原语，理由是它「会把『图上落位、代码没动』变成可通过的自欺」。**该反对意见成立，本契约不推翻它，而是接受它并改变判据的用途**：

- `container-misplaced`（现状域 ≠ 最优域）**不是迁移进度条，不上棘轮**。它衡量的是「扫描器的分组与架构师的意图不一致」，靠改标签即可消解，而消解它本身是合法的（B223 把 111 个 proto model 从 `d_coordination_task` 迁到 `d_protocol`，零代码改动，图变得更诚实而非更虚假）。
- **真正不可伪造的迁移进度条是边的合法性**：在最优树下跨域且 `target.json` 未声明方向的边。重贴容器标签不会让一条非法边消失，只有真的解耦才会。这条执法已经存在（`new-direction` / `over-budget` / `legacyBudget` 棘轮），本契约只是把它的归属输入从路径规则换成最优树。

因此本刀**不新增任何棘轮**，`unplacedBudget` 整条死掉，棘轮回落到既有的契约 `legacyBudget` 一条。

---

## §2 best.json 的形状

### 2-1 结构裁决：子系统就是顶层领域

baseline 的 `Domains` 已经是带 `Parent` 的树（实测 handoff：`d_coordination` → `d_coordination_api` / `d_coordination_cli` / …）。target.json 的 `subsystems` 是**另一套**顶层分组，两套词汇并存正是今天读不懂图的原因之一。

本契约合并二者：**`Parent == ""` 的领域即子系统**。`target.json` 的 `contracts[].from/to` 引用的就是这些顶层领域 id。

副产物：C1.1 需要的「目标域路径必须被父子系统路径覆盖」「同级目标域路径不得重叠」两条校验**结构性消失**——树本身让越界不可表达。

### 2-2 可编译 Go 形状

```go
// BestMeta 最优图的来源信息。
type BestMeta struct {
	Version int    `json:"version"`
	Project string `json:"project"`
}

// BestDomain 最优图里的一个领域。
// Parent 为空即顶层领域，顶层领域就是子系统——本图不设第二套分组概念。
// Type 只对顶层领域有意义，取值 logic / boundary，与 TargetSubsystem.Type 同义。
type BestDomain struct {
	Label          string `json:"label"`
	Responsibility string `json:"responsibility"`
	Parent         string `json:"parent,omitempty"`
	Type           string `json:"type,omitempty"`
}

// Best 是 codegraph/best.json 的顶层结构：应然结构。
// Containers 是容器 id → 叶子领域 id 的归属表，是本图的正文——
// 它由人编写，不由扫描产出，这正是它能表达「不与目录同形的职责划分」的原因。
type Best struct {
	Meta       BestMeta              `json:"meta"`
	Domains    map[string]BestDomain `json:"domains"`
	Containers map[string]string     `json:"containers"`
}
```

### 2-3 为什么归属粒度是容器（实测支撑）

对 handoff 重扫前 baseline（3564 节点 / 237 容器）实测：

| 量 | 值 | 含义 |
|---|---|---|
| 有文件的容器数 | 231 | 人可审的规模 |
| 跨子系统的容器 | **0** | 不存在「半个容器要迁走」的表达困境 |
| 跨目录的容器 | **0** | 容器不会横跨包 |
| 容器所在目录数 | 65 | 平均 3.6 容器/目录 |
| 含 >1 容器的目录 | **59 / 65** | 容器**比包更细**——best.json 能把一个包切进两个领域 |

最后一行是本设计相对路径规则的全部增益所在：`internal/agentd` 有 16 个容器，路径规则只能把它整包塞进一个域，容器归属能把它拆开。

**2026-08-23 回写——B223 全量重扫后复核，结论稳定。** 上表取自重扫前基线，而 B223
的重扫改动了容器与节点（3564→3656 节点、237→239 容器），故对新基线（提交
`96ee9510`，真机 `validate` issues/edgeIssues 均 null）重算了一遍：

| 量 | 重扫前 | 重扫后 |
|---|---|---|
| 有文件的容器数 | 231 | **233** |
| 跨子系统的容器 | 0 | **0** |
| 跨目录的容器 | 0 | **0** |
| 容器所在目录数 | 65 | **66** |
| 含 >1 容器的目录 | 59 / 65 | **60 / 66** |

两条承重判断都不受重扫影响：容器仍然 100% 子系统纯（归属永不含糊），且仍然比包更细
（一个包可切进两个领域）。**这一复核本身是必要的**——本节是「容器是正确归属粒度」这
个裁决的全部证据，证据基于一份会变的基线，不复核就等于让契约挂在一个过期数字上。

---

## §3 加载与校验

### 3-1 LoadBest

```go
func LoadBest(repoRoot string) (*Best, error)
```

读 `repoRoot/codegraph/best.json`。

- **文件不存在返回 `(nil, nil)`**，不是错误——最优图是自愿加入的，存量项目没有它。
- 解析失败、`meta.version != 1` 一律显式错误（反静默）。
- 反静默的代价由 CLI 承担：`best == nil` 时 `check` 必须在报告里显式输出一行「无 codegraph/best.json，最优图判据整体跳过」。**静默跳过等同于伪绿**。

### 3-2 ValidateBest

```go
func ValidateBest(b *Best) []string
```

纯函数，不读 baseline、不读视图、不碰文件系统——「这个容器在当前代码里存不存在」是 `Check` 的事（沿用 C1.1 §3-2 的分工，该分工不作废）。

返回问题（空 slice 才表示合法）：

1. `Domains` 的某个 `Parent` 指向不存在的领域 id；
2. `Parent` 链成环（含自指）；
3. 顶层领域（`Parent == ""`）的 `Type` 不是 `logic` 或 `boundary`；
4. 非顶层领域声明了非空 `Type`；
5. 任一领域的 `Responsibility` 去空白后为空；
6. `Containers` 的某个值指向不存在的领域 id；
7. `Containers` 的某个值指向**非叶子**领域（该领域是别的领域的 `Parent`）——与 `Container.Domain` 的既有叶子约束同义（`types.go#Container`）；
8. `Meta.Project` 去空白后为空。

### 3-3 归属决议

```go
// SubsystemOf 沿 Parent 链上溯到顶层领域，返回子系统 id；domainID 不存在时返回 ""。
func (b *Best) SubsystemOf(domainID string) string

// DomainOfContainer 返回容器的最优领域 id，未归属返回 ""。
func (b *Best) DomainOfContainer(containerID string) string
```

`SubsystemOf` 必须自带环保护（`ValidateBest` 已拒环，但 `Check` 不得假设调用方跑过 validate——一个环会让上溯死循环）。

节点到子系统的完整链路：`node.Container` → `DomainOfContainer` → `SubsystemOf`。链路任一环缺失即「图外」，沿用既有 `outside-file` 语义。

---

## §4 gap 判据（四条，全部 warn）

| kind | 档 | From/To | 判定 |
|---|---|---|---|
| `container-misplaced` | warn | `From` = 容器 id，`To` 省略 | baseline 视图里该容器的 `Domain` 非空，且 ≠ best 的归属 |
| `container-unplaced` | warn | `From` = 容器 id，`To` 省略 | 视图里存在该容器且有非 deleted 节点，但 `Best.Containers` 无此 key |
| `domain-empty` | warn | `From` = 领域 id，`To` 省略 | best 声明的**叶子**领域，`Best.Containers` 中零个容器指向它 |
| `best-dangling` | warn | `From` = 容器 id，`To` 省略 | `Best.Containers` 的 key 在当前视图中不存在，或其全部节点均为 deleted |

四条都不进 `Fails`。理由见 §1-3：它们衡量的是最优图与现状分类的一致性，靠编辑 JSON 即可消解；把可靠编辑消解的东西设为 fail，等于给「改标签」发进度奖。真正的红线仍然是既有的 `new-direction` / `off-interface` / `over-budget`，它们现在按最优树归属重新判定。

**逐条出 finding，不按子系统聚合**——这与 C1.1 §5 拍板记录三相反，理由是数量级不同：C1.1 担心的是 61 个未落位**文件**，本刀的对象是 231 个**容器**，其中错位者实测量级在个位到十位数（现状 13 个叶子域里 9 个已与子系统 1:1 干净，脏的只有 4 个）。逐容器出 finding 才可行动——「子系统 X 有 7 个容器错位」无法直接改，「容器 `k_proto_Task` 应在 `d_protocol` 而现在 `d_coordination_task`」可以。

`domain-empty` 的 kind 字面量与 C1.1 相同但**判定完全不同**（从「路径零命中文件」变成「零容器指向」）。沿用同一字面量是有意的：它回答的是同一个问题「这个域是不是空想出来的」，换名字只会让历史报告不可比。

---

## §5 target.json 瘦身

### 5-1 存活的形状

```go
// Target 是 codegraph/target.json 的顶层结构：契约面。
// 结构（子系统与领域）已移交 best.json，本文件只回答「允许哪些依赖方向」。
type Target struct {
	Meta      TargetMeta `json:"meta"`
	Assembly  []string   `json:"assembly,omitempty"`
	Contracts []Contract `json:"contracts,omitempty"`
}
```

`TargetMeta.Version` 升到 **3**。`LoadTarget` 拒载 version≠3 的文案沿用现有形态（指向 `codegraph migrate`）。

`Contract` 结构一字不改。`contracts[].from/to` 现在引用 best.json 的顶层领域 id；`ValidateTarget` 无法自校验该引用（它读不到 best），故该引用完整性下沉为 `Check` 期的既有 `new-direction` 行为——引用了不存在的子系统，就没有边会归到它，等价于该契约条目死掉，由既有 `dead-contract` 判据报出。

### 5-2 migrate：从 paths 生成 best.json 初版

`codegraph migrate` 增加一步：读 v2 的 `target.json` 与 `codegraph/baseline.json`，产出 `codegraph/best.json` 初版并把 `target.json` 降到 v3 形状。

初版的构造规则（机械，无判断）：

1. 每个 v2 子系统成为一个顶层 `BestDomain`（`Label` 取 `name`，`Type` 取 `type`，`Responsibility` 取 `note`，`note` 为空时填 `"（迁移生成，待填写）"`）；
2. baseline 的每个容器，按其**首个节点文件**用 v2 的 `SubsystemOf` 语义（含 `assignments` 优先）决议子系统，写进 `Containers`，值为该顶层领域 id；
3. 决议为空串的容器**不写进 `Containers`**——它们在新判据下会如实报 `container-unplaced`，而不是被塞进某个域假装已归属。

**初版的领域树是扁平的**（只有顶层，没有叶子层级），这是有意的：迁移工具不该发明架构。人拿到初版后编辑出真正的领域层级，这就是 C1.6 的工作。

三条限制必须写进 migrate 的输出提示：初版**只是今天结构的机械翻译，不是最优结构**；`Responsibility` 多半是占位符；`container-misplaced` 在初版下恒为 0（因为归属就是从现状推出来的），这不代表没有 gap。

### 5-3 调用点重接清单

`Target.SubsystemOf(file)` 的三个非测试调用点全部改走容器链路：

| 位置 | 现状 | 改后 |
|---|---|---|
| `graph/codegraph/check.go:64` | `d := t.SubsystemOf(n.File)` | `d := bestSubsystemOfNode(b, v, id)` |
| `graph/codegraph/check.go:140` | `t.SubsystemOf(n.File) != c.To` | 同上，比较结果不变 |
| `graph/codegraph/check.go:160` | `t.SubsystemOf(n.File) == c.From` | 同上 |
| `graph/codegraph/domains.go:133` | `target.SubsystemOf(n.File)` | 同上 |

`Check` 签名扩为：

```go
func Check(t *Target, b *Best, v *View, decls map[string]DomainDecl) *Report
```

`b == nil` 时：四条 gap 判据整体跳过，且**契约执法整体跳过**（无归属来源，一切边都判不了）——此时 `Check` 只产出 `outside-file` 之外的空报告，CLI 按 §3-1 打印跳过行。这是 `b == nil` 与 `decls == nil` 的关键差异：后者只关掉锚判据，前者关掉主判据，因此必须喊出来。

### 5-4 归属等价性（实测反证，必须留档）

本刀最大的风险是「换归属算法会重洗 20 条 `legacyBudget` 的标定」。实测结论：**只要 best.json 的领域树至少与子系统分区同样细，新旧归属逐字相同**，因为容器是子系统纯的（§2-3：0 个跨子系统容器）。

反证留档：用**今天的 baseline 领域**当 best 的代理算过一遍，跨子系统边 692 → 377（-45%），一度像是设计有问题。根因是 `d_coordination_task` 一个域横跨 4 个子系统，多数票把 proto / ledger / localint 全吞进 `d_controlplane`。**那是代理的锅，不是设计的锅**——它衡量的是今天领域划分的脏，不是新算法的错。记下来是为了不再算错第二遍。

实现期必须有一支等价性测试锁住这条：拿 handoff 的 v2 target + migrate 生成的 best 初版，断言两套 `SubsystemOf` 对全部节点给出相同答案。

---

## §6 冻结清单（逐条可独立判 pass/fail）

1. `BestMeta` 的 Go 字段恰为 `Version int`、`Project string`；JSON 键恰为 `version`、`project`。
2. `BestDomain` 的 Go 字段恰为 `Label`、`Responsibility`、`Parent`、`Type`，均为 `string`。
3. `BestDomain` 的 JSON 键恰为 `label`、`responsibility`、`parent`、`type`；`parent` 与 `type` 带 `omitempty`，`label` 与 `responsibility` 不带。
4. `Best` 的 Go 字段恰为 `Meta BestMeta`、`Domains map[string]BestDomain`、`Containers map[string]string`；JSON 键恰为 `meta`、`domains`、`containers`。
5. `Best.Containers` 的值是领域 id，不是领域对象；不引入反向的 `domain → []container` 表达。
6. `Parent == ""` 即顶层领域；不新增独立的 `subsystems` 段。
7. `LoadBest` 在文件不存在时返回 `(nil, nil)`。
8. `LoadBest` 在 JSON 解析失败时返回非 nil error。
9. `LoadBest` 在 `meta.version != 1` 时返回非 nil error。
10. `ValidateBest` 是纯函数：不读 baseline、不读视图、不访问文件系统。
11. `Parent` 指向不存在领域时 `ValidateBest` 返回问题。
12. `Parent` 链成环（含自指）时 `ValidateBest` 返回问题。
13. 顶层领域 `Type` 非 `logic`/`boundary` 时 `ValidateBest` 返回问题。
14. 非顶层领域 `Type` 非空时 `ValidateBest` 返回问题。
15. 任一领域 `Responsibility` 去空白为空时 `ValidateBest` 返回问题。
16. `Containers` 值指向不存在领域时 `ValidateBest` 返回问题。
17. `Containers` 值指向非叶子领域时 `ValidateBest` 返回问题。
18. `Meta.Project` 去空白为空时 `ValidateBest` 返回问题。
19. `Best.SubsystemOf` 对含环输入不死循环，返回 `""`。
20. `Best.SubsystemOf` 对顶层领域 id 返回其自身 id。
21. `Best.DomainOfContainer` 对未归属容器返回 `""`。
22. `Check` 签名恰为 `func Check(t *Target, b *Best, v *View, decls map[string]DomainDecl) *Report`。
23. `b == nil` 时 `Check` 跳过四条 gap 判据。
24. `b == nil` 时 `Check` 跳过全部契约执法（`new-direction` / `off-interface` / `over-budget` / `legacy` / `dead-contract` 均不产出）。
25. `b == nil` 时 CLI 的 `check` 输出含显式跳过行，不静默。
26. `container-misplaced` 的 kind 字面量恰为 `container-misplaced`，进 `Warns`，`From` 为容器 id，`To` 省略。
27. `container-unplaced` 的 kind 字面量恰为 `container-unplaced`，进 `Warns`，`From` 为容器 id。
28. `domain-empty` 判定改为「零容器指向」，kind 字面量不变，`From` 为领域 id。
29. `best-dangling` 的 kind 字面量恰为 `best-dangling`，进 `Warns`，`From` 为容器 id。
30. 四条 gap 判据都不进 `Fails`。
31. 四条 gap 判据逐容器/逐领域出 finding，不按子系统聚合。
32. 只对有非 deleted 节点的容器判 `container-misplaced` 与 `container-unplaced`。
33. `container-misplaced` 只在视图容器的 `Domain` 非空时判定；`Domain` 为空的旧扫描数据不产出该 finding。
34. `Target` 的 Go 字段恰为 `Meta`、`Assembly`、`Contracts`；`Subsystems` 与 `Assignments` 字段删除。
35. `TargetMeta.Version` 为 3；`LoadTarget` 拒载 version≠3。
36. `Contract` 结构与 JSON 键一字不改。
37. `TargetDomain`、`Assignment` 两个类型从包内删除。
38. `TargetSubsystem` 类型从包内删除。
39. `validPathRule`、`targetPathCovers`、`targetPathsOverlap`、`cutTargetRule`、`targetRuleMatchesFile`、`targetPrefixRuleSuffix` 全部删除。
40. `Target.SubsystemOf(file string)` 方法删除；包内不再存在按文件路径决议子系统的函数。
41. `TargetSubsystem.UnplacedBudget` / `UnplacedBudgetNote` 删除；`CheckBudgetRatchet` 只比较契约 `legacyBudget`。
42. `KindUnplaced`、`KindUnplacedOverBudget` 两个常量删除。
43. `CheckBudgetRatchet` 签名保持 `func CheckBudgetRatchet(cur, base *Target) []Finding`。
44. `codegraph migrate` 能把 v2 `target.json` + `baseline.json` 产出 v3 `target.json` 与 v1 `best.json`。
45. migrate 生成的 best 初版只有顶层领域，`Domains` 中无任何 `Parent` 非空的条目。
46. migrate 对 v2 决议为空串的容器不写入 `Containers`。
47. migrate 的输出提示包含「初版是现状的机械翻译，不是最优结构」。
48. 归属等价性测试通过：v2 `Target.SubsystemOf(node.File)` 与新链路对 handoff 全部节点给出相同答案。
49. `check` 报告的全部 finding 仍在统一 `sortFindings` 后输出，重复运行顺序稳定。
50. `graph/codegraph` 不引入新第三方依赖，不产生网络端点。
51. best.json 的 JSON 金样本测试通过：键名、`omitempty` 行为、回读结构均锁定。

---

## §7 拍板记录（三重闸门命中项）

**一、子系统就是顶层领域，不设第二套分组概念。** 难逆转：`contracts[].from/to` 的 id 空间、扫描配方、查看器、handoff 的 target.json 会同时钉死这个词汇；无上下文会惊讶：后人看到 best.json 里没有 `subsystems` 段会想补一个；真取舍：否决了「best.json 里子系统与领域两段并列」（保留了今天两套词汇并存的病根，而那正是图读不懂的原因之一）与「子系统留在 target.json、领域在 best.json」（结构声明分裂在两个文件里，`domains[].parent` 会跨文件引用）。

**二、归属原语是容器，不是路径，也不是文件。** 难逆转：这是 best.json 正文的形状，改了等于重写整个文件；无上下文会惊讶：C1.1 的拍板记录二明确否决过容器清单，后人读到会认为本刀推翻了它；真取舍：见 §1-3——**该否决意见成立且未被推翻**，改变的是判据用途（容器错位不做进度条、不上棘轮），不是反对意见的效力。同时否决「按节点归属」（3564 个决策，人不可审，且容器实测 100% 纯，细到节点毫无收益）。

**三、四条 gap 判据全部是 warn，本刀不新增棘轮。** 难逆转：判据档位一旦进 CI 就成了别人的红线；无上下文会惊讶：「最优图迁移」这么重的事居然一条 fail 都没有；真取舍：否决「`container-misplaced` 上棘轮当迁移进度条」——那正是 C1.1 拍板记录二警告的自欺（重贴标签即可刷分）。不可伪造的进度条是边的合法性，它已由既有 `new-direction`/`over-budget`/`legacyBudget` 棘轮承担，本刀只换它的归属输入。

**四、`b == nil` 时连契约执法一起跳过，并且必须喊出来。** 难逆转：这是「无基准不得当通过」这条反静默约定在新文件上的落点；无上下文会惊讶：`decls == nil` 只关锚判据，而 `b == nil` 关掉主判据，两个 nil 的后果不对称；真取舍：否决「`b == nil` 时回落到 v2 路径规则」（要求永久保留两套归属算法，路径规则就永远死不掉，本刀等于白做）与「`b == nil` 直接报错」（会让所有还没建最优图的项目的 check 立刻变红，把自愿加入变成强制迁移）。

**五、migrate 生成的初版只有顶层领域。** 反过来写不会有任何测试变红，故必须记：让 migrate 按包名或按 baseline 的现状领域生成层级，是最省事也最有害的选项——伪造出来的层级会被人和 agent 当成真实架构读（与 `types.go#Graph.Domains` 的「不得按包名伪造领域」是同一条纪律）。初版扁平且 `Responsibility` 是显式占位符，是为了让「这里还没有人做过架构决定」这件事在文件里看得见。

---

## §8 Ticket 0 骨架范围

落空壳、编译通过、不实现行为：

- `graph/codegraph/best.go`：`BestMeta` / `BestDomain` / `Best` 三个类型，`LoadBest` / `ValidateBest` / `Best.SubsystemOf` / `Best.DomainOfContainer` 四个函数的签名与文件头注释；函数体返回零值并带 `// TODO(C1.8): 见契约 §3`。
- `graph/codegraph/fitness.go`：**新增** `KindContainerMisplaced` / `KindContainerUnplaced` / `KindBestDangling` 三个常量。
- `Check` 签名扩参，`b` 暂不使用（编译期即暴露全部调用点，调用方一律先传 `nil`）。

**不进 Ticket 0**（留给 implement）：删除 `TargetDomain`/`TargetSubsystem`/`Assignment`/路径规则函数族、删除 `KindUnplaced`/`KindUnplacedOverBudget`、`migrate` 新步骤、四条判据的实现、调用点重接。

理由：删除是破坏性的，一次做完才能保证编译绿。尤其 `KindUnplaced`/`KindUnplacedOverBudget` 现被 `gap.go#targetDomainFindings` 引用，在 `gap.go` 整体删除之前先删常量会直接编译失败——**骨架阶段只加不减**。

---

## §9 对 C1.1 契约的回写

以下条目在 `2026-08-23-codegraph-target-domains-contract.md` §4 中被本契约取代。回写在该文件就地标注，不改原文编号。

- **条 1~7、9~15**（`TargetDomain` 的字段/JSON 键/嵌套/校验六条）：取代。归属改由 `best.json` 的 `Containers` 表达，路径规则族整体删除。
- **条 16**（`Check` 签名）：再次取代。C1.2 已把它改为三参，本刀改为四参 `func Check(t *Target, b *Best, v *View, decls map[string]DomainDecl) *Report`。
- **条 17~25**（`unplaced` / `unplaced-over-budget` / `domain-empty` 的统计与 Detail）：取代。前两者删除，`domain-empty` 判定改为「零容器指向」。
- **条 27、28、30~32**（棘轮覆盖目标域预算）：取代。`unplacedBudget` 删除，棘轮只剩契约 `legacyBudget`。
- **条 36**（handoff 侧写入目标域树）：取代。改为 handoff 侧写入 `codegraph/best.json`，仍由用户批准后写入，charter 本提交不伪造该跨仓数据。
- **条 37**（`TestTargetDomainJSONGolden`）：取代。金样本改锁 `best.json` 形状。
- **不受影响**：条 8（version 语义，值由 2 改 3 但「version 不匹配即拒载」的语义不变）、条 26（`CheckBudgetRatchet` 签名）、条 29（严格比较）、条 33（CLI 不新增 gap 子命令）、条 34（统一排序）、条 35（无新依赖）。
- **C1.1 拍板记录二不被推翻**，见 §1-3。

同时回写 `2026-08-23-codegraph-reconcile-fitness-contract.md` 的 R11：该条把「基准宽松解析」的约束定为「产物只许流向 `CheckBudgetRatchet`/`ApplyBudgetRatchet`，永不得传 `Check`」。本刀删除 `unplacedBudget` 后，宽松解析的产物只需承载 `contracts` 段，**R11 的约束继续成立且变得更容易满足**，无需修改。

---

## §10 图覆盖债

本文档引用的现状符号全部命中（`graph/codegraph/target.go#TargetDomain`、`#TargetSubsystem`、`#Target.SubsystemOf`、`gap.go#targetDomainFindings`、`check.go#Check`、`fitness.go#CheckBudgetRatchet`、`types.go#Container`、`types.go#Graph`）。charter 仓自身尚无 `codegraph/`，故本节为人工核对，非 `codegraph resolve` 产出。

---

## §11 回写（2026-08-23）：跨领域边矩阵

用户批准新增。本节是对 §6 冻结清单的**增量**，条目编号续 52 起；上文各节不改。

### 11-1 为什么要它

写 best.json 是回答 231 次「这堆符号是干什么的」——那是职责判断，看容器标签与成员名即可。
但树画完之后有一个问题只有数据能答：**这条边界切得动吗。** 把两簇代码分进两个领域，
如果它们之间有几百条双向边，那条边界就是幻想。

这个读数是写 best.json 时**唯一真正需要的外部输入**，而且它是「不可伪造的进度条」
（§1-3）的可读形态：迁移推进时这些数字下降，而重贴容器标签不会让它们动一分。

实测（handoff，B223 重扫后基线 `96ee9510`，4744 条边）：跨领域边仅 **847** 条，
其中 **435 条（51%）压在 `d_coordination_api ~ d_coordination_task` 一条边界上**，
且是 409/26 的悬殊单向（handler 调 Manager 是正常分层，真正的味道在那 26 条反向边）；
其余边界全部 ≤57 条且多为纯单向（57/0、42/0、38/0、32/0）。结论：**handoff 今天
没有一条真正纠缠的边界**——这正是「开工前不必手写调用链/流程图」的依据，那些图会
画出一大片本来就没问题的东西。

### 11-2 形态：`domains` 的一个 flag，不是新子命令

```
codegraph domains --repo . --edges
```

**不新增子命令**，因此 C1.1 冻结条 33「CLI 不新增 gap 子命令，不复制 gap 归属算法」
**原样存活、不被本回写取代**。挂在 `domains` 上也是更正确的设计：矩阵是领域树的一个
读数，不是一个独立概念；而算法调包内既有归属函数，不是复制。

输出内容：

1. **现状矩阵**：按 baseline 视图容器的 `Domain` 归属统计的跨领域有序对。
2. **最优矩阵**：`best.json` 存在时**额外**输出一份，按 best 归属统计。
   两份并列即「这次树编辑让哪条边界变贵/变便宜」的前后对照——这是本读数的主用法。
   `best == nil` 时只输出现状矩阵，且显式说明最优矩阵已跳过（沿用 §3-1 的反静默）。

每条记录是 `(from 领域, to 领域, 条数)` 的**有序对**，不做无向合并——方向是判断
「正常分层」还是「双向纠缠」的全部依据，合并掉就把 409/26 和 217/218 变成同一个数。

### 11-3 冻结清单增量

52. `domains` 命令新增 `--edges` 布尔 flag；**不新增任何子命令**。
53. `--edges` 输出的记录是有序对 `(from, to, count)`，不做无向合并。
54. 只统计 `from != to` 且两端归属均非空的边；两端任一无归属的边不计入，也不另报。
55. 只统计非 deleted 的节点与边，与 `Check` 的既有口径一致。
56. 排序确定性：按 `count` 降序、`from` 升序、`to` 升序三级排序，重复运行输出逐字节相同。
57. `best != nil` 时输出现状与最优两份矩阵，键名可区分。
58. `best == nil` 时只输出现状矩阵，并显式输出最优矩阵已跳过的说明。
59. `--edges` 不产生任何 `Finding`、不进 `Report`、不参与 fail 判定、不上棘轮——它是读数不是判据。
60. `--edges` 调用包内既有归属函数，不在 CLI 层复制归属算法（条 33 的语义延续）。

### 11-4 拍板记录

**六、边界矩阵是读数，不是判据。** 难逆转：一旦它进了 `Report` 就成了别人 CI 里的红线，
再想降级要动所有消费方；无上下文会惊讶：整个批次的主题是「用判据驱动迁移」，而这个最
承重的数字偏偏不是判据；真取舍：否决「把跨领域边数做成带预算的 fail 判据」——那等于
给每条边界设一个数字上限，而边界该不该存在是架构判断，不是阈值判断；真正的执法已经
由 `new-direction`（方向未声明即红）承担，它比任何计数阈值都准。

---

## §12 回写（2026-08-24）：breakdown 裁决落点

breakdown（`docs/breakdowns/2026-08-23-codegraph-best-graph-breakdown.md`）挖出一处
**契约内部自相矛盾**与十条边界空白。裁决已定（待拍板 1 由用户拍板，其余由协调者拍板），
本节是对 §6 的增量，编号续 61 起。**上文各节除下列显式取代外一律不改。**

### 12-1 取代：`container-misplaced` 收窄（修自相矛盾）

**矛盾**：§4 的判定是 baseline 容器 `Domain` 与 best 归属的**字符串比较**，而 §5-2 让初版
best 的领域 id 取自 v2 子系统 id、baseline 容器的 `Domain` 取自扫描领域 id——**两个 id
空间必然不等**，初版下每个已归域容器各报一条（handoff 233 条）。而 §5-2 写着「初版下
恒为 0」。**那句话在原判定下是假的。**

**裁决（用户）**：收窄判定——只有当容器的 baseline 域 id **也是 `Best.Domains` 的一个 key**
时才比较。词汇未对齐即不判。§5-2「初版下恒为 0」由此自然成立且诚实：无从比较，不是没问题。

沉默路径必须堵：跳过的容器数要显式报出（条 63）。

### 12-2 取代：条 48 等价性测试的形态

条 48 原文要求「对 handoff **全部节点**给出相同答案」。charter 仓没有 handoff 数据，
且自家夹具 3 个容器有 2 个跨子系统（`k_svc`、`k_ent`），天然违反前提。

**裁决**：拆成两半。CI 里是**属性测试**（证一般性质：容器子系统纯 ⇒ 两套归属等价，
并含负例：不纯容器 ⇒ 等价性破裂）；handoff 全量节点的等价性是**一次性真机验证**，
挪进 acceptance 真机清单。条 48 按此取代。

否决快照进仓（MB 级 blob 会过期——B223 当天就让基线变过一次）与 env+skip
（可跳过的测试在 CI 里是稳定假绿，正是 C4 记的族）。

### 12-3 冻结清单增量

61. `container-misplaced` 只在容器的 baseline 域 id ∈ `Best.Domains` 时判定；不在时不产出该 finding。
62. 判定被跳过的容器**不产出任何其他 finding 顶替**（不得改报 `container-unplaced`）。
63. `check` 输出显式报出因词汇未对齐跳过错位判定的容器数；该数 > 0 时不得静默。
64. `outside-file` 的判定改为「节点的 `Container` 不在视图 `Containers` 里」；容器存在但未获 best 归属**只**产出 `container-unplaced`，不再产出 `outside-file`。
65. `check` 输出归属覆盖读数：已归属容器数 / 视图容器数，以及参与契约执法的跨域边数。该读数**不是 Finding**，不进 `Fails`/`Warns`。
66. `b != nil` 但归属覆盖为 0 时，条 65 的读数必须出现且显示 0，不得静默通过。
67. `ValidateBest` 的调用方是 `check` 与 `validate` 两条命令：`check` 在调用 `Check` 前跑，不通过即**拒绝执行**并非零退出（与 `ValidateTarget` 的既有处置同形）；`validate` 把 best 的问题并进 `issues`。
68. `LoadBest` 返回 nil 时不跑 `ValidateBest`，也不因此报错。
69. `migrate` 写盘前对自己生成的 best 跑 `ValidateBest`，不通过即中止且不留下半份产物。
70. `migrate` 的写序是**先写 `best.json`，再改 `target.json`**。
71. `best.json` 已存在时 `migrate` 拒绝执行并报错，不覆盖。
72. `baseline.json` 缺失或不可解析时 `migrate` 报错，不产出 `Containers` 为空的 best。
73. `migrate` 保留 v1→v2→v3 两跳；v1 输入仍可迁移。
74. `migrate.go` 自带**私有、冻结**的 v2 结构体与 v2 路径决议（含后缀解析），它**永不参与执法**、不得被 `Check` 或其调用链引用。
75. 条 39、条 40 的作用域限定为**执法路径**：`Check` 及其调用链上不再存在按文件路径决议子系统的函数；条 74 的迁移专用私有副本不在此限。
76. `migrate` 决议容器归属时取「该容器全部非 deleted 节点中，**节点 id 字典序最小**的那一个」的文件，不依赖 map 遍历序。
77. 条 47 的三条限制提示落在 `MigrateResult.Notes []string`，CLI 再打到 stderr；Notes 内容可被测试断言。
78. `dead-rule` kind 与 `ruleHitsAny` 随 `Subsystems[].Paths` 一并删除；`check.go` 的 `Finding` 文档注释同步。
79. `DomainTreeWithTarget` 改名 `DomainTreeWithBest(v *View, b *Best)`；CLI 的降级提示文案改为 best.json 口径。
80. `DomainStat.MarshalJSON` 的 presence 开关语义从「target 加载成功」改为「best 加载成功」。
81. `LoadTarget` 拒载非 v3 的文案同时说明 `migrate` 需要 `baseline.json` 在位。
82. 归属等价性在 CI 里是属性测试：先断言前提（容器子系统纯），再断言两套归属逐节点相同，并含「不纯容器 ⇒ 等价性破裂」的负例。
83. `ValidateTarget` 瘦身后不再校验 `contracts[].from/to` 的存在性；一支**反向断言**测试把这一点钉死，防后人当漏实现补回。
84. `contract set` **不**加载 best.json 校验 `from`/`to`。
85. `DomainStat.Subsystems` / `CrossSubsystem` 两个 wire 字段**保留不动**（确属零消费者死字段，但删 wire 字段超出本刀范围，已落 roadmap）。
86. 不新增「容器节点横跨多个最优子系统」告警——容器实测 100% 纯，为不存在的问题造判据。

### 12-4 拍板记录

**七、migrate 保留一份永不执法的 v2 决议副本。** 难逆转：它是条 39/40「路径规则全删」这条
纪律的**唯一豁免**，豁免一旦开口，后人很容易把它接回执法路径；无上下文会惊讶：包里明明
写着「不再存在按路径决议子系统的函数」，却躺着一个；真取舍：否决「用 baseline 现状领域
代替 v2 决议」——§5-4 的实测反证已证明那条路会让跨子系统边 692→377、等价性直接失败。
**豁免的边界写死为「永不被 `Check` 或其调用链引用」**，这是可 grep 可执法的形式。

**八、`outside-file` 与 `container-unplaced` 不重复报同一个事实。** 反过来写不会有任何测试
变红（两条判据各自都对，只是加起来吵），故必须记：容器才是可行动单位，同一个未归属容器
再按文件铺 N 条，CLI 输出会差一个数量级，而多出来的那一个数量级不含任何新信息。

**九、等价性执法用属性测试，不用真实数据快照。** 难逆转：快照一旦进仓就会被当成基准，
而它固化的是某一刻的 handoff；无上下文会惊讶：条 48 字面写着「handoff 全部节点」，CI 里
却找不到 handoff 的数据；真取舍：否决快照（会过期，B223 当天就让基线变过一次）与
env+skip（稳定假绿）。**handoff 全量的那一次验证不取消，它挪到 acceptance 真机清单**——
换的是执法位置，不是执法本身。
