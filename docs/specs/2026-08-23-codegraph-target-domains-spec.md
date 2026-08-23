# Spec：codegraph 目标图刀（target 增目标领域节 + gap 判据与棘轮）

> 状态：**已批准**（2026-08-23，用户批准：「开吧」）
> 级别与档位：**L3 轻档**（动 wire 契约：target.json 新增 `subsystems[].domains[]` 段 + check 报告新增 finding kind）→ contract → breakdown → 单轮 implement → review → acceptance → finish
> 卡：`C1.1`（父卡 `C1` 代码图批次二）
> 来源：`docs/roadmap.md` 第 8 条；2026-08-23 roadmap 前置讨论（原型走查四轮，形态基准 handoff `prototypes/codegraph-subsystem/`）

## 问题陈述

**代码图今天只有现状，没有终态，因此「差距」不可测。**

四轮原型走查的结论不是「图画得不好看」，是「架构烂了」：任务生命周期域 512 个成员、217 个所谓对外接口、终端会话与鉴权会话混在同一个域里。用户对此的裁决是方向性的——**不给烂架构装拐杖**（把现状图排序、聚合、折叠到"能看懂"），而是**给一份最优图，逐步迁移重构**。

要能"逐步迁移"，缺的三样东西正是本刀的范围：

1. **终态没有落点。** `target.json` 今天只有子系统（`paths` 执法分区）与子系统间契约，没有任何地方能写下"这个子系统内部应该分成哪几个领域"。最优图无处冻结，就只能活在讨论记录里。
2. **差距不可机械测量。** `baseline.json` 的 `domains` 段是扫描产出的**现状**划分，与目标无从对照。今天回答"agentd 那 61 个文件的竖切还债进展到哪了"只能靠人读目录。
3. **没有棘轮，进度会倒退。** 现有 `legacyBudget` 只管契约违规边，管不到"未落位文件"这类结构债；没有只减不增的约束，迁移期新增的文件会继续往大包里塞。

一句话：**现状图的职责是诚实，目标图的职责是指路，今天只有前者。**

## 现状读数（2026-08-23 实测，contract 节点须对当轮工作树复核）

| 读数 | 值 | 出处 |
|---|---|---|
| target schema 顶层 | `meta` / `subsystems` / `assignments` / `assembly` / `contracts` | `graph/codegraph/target.go#Target` |
| 子系统字段 | `id` / `name` / `type`(logic\|boundary) / `paths[]` / `note?`，**无 parent、无领域相关字段** | `graph/codegraph/target.go#TargetSubsystem` |
| 版本硬门 | `meta.version` 必须 == 2，否则拒载并要求 migrate | `graph/codegraph/target.go#LoadTarget` |
| 路径规则形态 | 仅两种：精确路径、`dir/**`；裸 `**` 与 `[]?{}` 被拒 | `graph/codegraph/target.go#validPathRule` |
| 归属算法 | assignments 精确 > paths 规则（声明序**首次匹配**）> 空串（图外） | `graph/codegraph/target.go#SubsystemOf` |
| 子系统 paths **重叠不检测** | 已确认缺口，重叠时静默按声明序裁决 | `graph/codegraph/target.go#ValidateTarget`（无此查） |
| 现状领域段 | `Graph.Domains map[id]Domain{label,kind,summary,desc,parent}`；**成员与 interfaces 都是派生的，不落盘** | `graph/codegraph/types.go#Domain`、`graph/codegraph/domains.go#domainTree` |
| 容器挂域 | `Container.Domain` 必须是**叶子**领域；diff **不得新建领域** | `graph/codegraph/validate.go#validateDomains`、`graph/codegraph/merge.go#View.Domains` |
| 领域→子系统派生 | 成员文件 × `SubsystemOf` 取并集，`crossSubsystem = len(subsystems) > 1` | `graph/codegraph/domains.go#DomainTreeWithTarget` |
| check 报告结构 | `Report{Fails, Warns, LegacyHits map[string]int}`，**Finding 无 severity 字段**，档位靠落在哪个 slice | `graph/codegraph/check.go#Report`、`#Finding` |
| 预算形态 | 不是独立段：`contracts[].legacyBudget int` + `legacyBudgetNote string` | `graph/codegraph/target.go#Contract` |
| 棘轮判据 | 纯函数只产 finding，**不判档** | `graph/codegraph/fitness.go#CheckBudgetRatchet` |
| 降档在 CLI 层 | note 非空→Warns，空→Fails；**追加发生在 `sortFindings` 之后** | `graph/cli/cli.go#appendBudgetRatchet` |
| 由此产生的既存缺陷 | `budget-raised` 追加在排序后，破坏 check 输出确定性（roadmap 第 5 条刚销的账） | 同上，实读 |
| handoff 子系统数 | 10 条；`d_controlplane` 带 note「待竖切：61 文件平铺包」 | `handoff/codegraph/target.json` |
| handoff 现状领域数 | 19 条，与子系统 id 集**只有 3 个重名**（两套正交分区） | `handoff/codegraph/baseline.json` |
| handoff 契约预算 | 23 条契约，18 条带非零 `legacyBudget`，**无一条带 note**（任何上涨都会 fail） | 同上 |
| 重灾区规模 | `internal/agentd` 61 文件、`cmd` 41 文件（fitness `oversized-package` 命中） | 刀 3+4 实测 |

## 方案（含弃选与理由）

### 一、目标领域**嵌在子系统下**，不是平行的第三层

```jsonc
{ "id": "d_controlplane", "name": "控制面 API 域", "type": "logic",
  "paths": ["internal/agentd/**", "internal/webui/**"],
  "unplacedBudget": 61,
  "unplacedBudgetNote": "竖切前整包未落位，按 1f 迁移卡逐批清零",
  "domains": [
    { "id": "d_task", "name": "任务编排",
      "responsibility": "任务的建立、状态迁移与终结，持有任务状态机",
      "paths": ["internal/task/**"] },
    { "id": "d_terminal", "name": "终端与回放",
      "responsibility": "终端会话的建立、帧流转发与回放", "paths": ["internal/terminal/**"] }
  ] }
```

**这个嵌套形态本身就是一条设计裁决**：目标图里，一个领域**结构上不可能跨子系统**——它写在哪个子系统下就属于哪个子系统。用户第一轮走查问的「一个领域不应该只在子系统内部吗」，答案在目标侧是"是"，在现状侧是"⧉ 是警示不是错误"。跨子系统 ⧉ 从此只可能出现在现状图，且语义收敛为一句话：**离目标还有距离**。

**弃选：**
- **顶层 `targetDomains[]` + `subsystem` 外键**：能表达同样的关系，但把"一个领域只属于一个子系统"从结构不变式降级为需要校验的约束，还多一处引用完整性要查。
- **独立文件 `codegraph/target-domains.json`**：目标图与执法分区分居两处，冻结时序会漂；且 contract 节点冻结的是 target 这一个文件，多一个文件多一处遗漏。
- **复用 `codegraph/domains/*.json`（领域声明）**：那是现状领域的语义补充（职责/不变式/状态机/生命周期锚），主语是"现在这个域"；目标域主语是"应该有的域"，混在一起会让 `validate` 的锚核验对着不存在的代码报错。

### 二、归属规则 = 路径规则（与子系统同构）

这是 spec 阶段唯一被点名"开工先掰"的问题，裁决如下：**目标领域的归属规则就是路径规则**，形态与子系统 `paths` 完全一致（精确路径 / `dir/**`），复用 `validPathRule`。

理由是竖切的终态定义：**一个目标领域 = 一个包目录**。迁移完成时，"这个函数属于哪个域"由它所在的目录直接回答，不需要第二套机制。而迁移**之前**，文件还躺在 `internal/agentd/` 大包里，命中不了任何目标域规则——这不是判据失灵，**这恰恰就是 gap 本身**。

**弃选：**
- **符号/容器清单**（目标域列出应有的容器 label）：人写量大，且清单会随重命名腐烂；更糟的是它诱导"把现状容器改名去对齐目标"这类拐杖动作。
- **文件级 assignment 例外表**（迁移期逐文件指派目标域）：等于把迁移工作在元数据里先做一遍，做完了代码还在原地——**图上落位、代码没动**是最坏的一种自欺。
- **语义规则 / AI 判归属**：不可复算，两次运行两个 gap 数字，棘轮失去意义。

### 三、gap 判据三条 + 棘轮，全部并入 `check`

只对**声明了 `domains` 段的子系统**执法；未声明 = 尚未立目标图 = 整体跳过（与 `validateDomains` 在 domains 为空时跳过同款的渐进铺开设计）。

| 判据 | 档位 | 语义 |
|---|---|---|
| `unplaced` | warn | 该子系统 in-graph 文件中，未命中本子系统任一目标域 `paths` 的数量（≤ 预算）。detail 带 `n/budget` 与若干样例文件 |
| `unplaced-over-budget` | **fail** | 同上，但超出 `unplacedBudget` |
| `domain-empty` | warn | 某目标域的 `paths` 在图内零命中——它还没开工，是进度指示 |
| `budget-raised`（扩展） | note 空→fail / 有 note→warn | `unplacedBudget` 相对主线上涨即命中，与契约级 `legacyBudget` 棘轮同款 |

聚合口径按**子系统**出一条 finding，不逐文件刷屏（handoff 的 61 文件否则就是 61 条）。计数与 `Report.LegacyHits` 同款落进报告，供查看器与 acceptance 取数。

**弃选：**
- **逐文件 fail**：迁移期第一次跑就是几百条红，闸门直接不可用。
- **`codegraph gap` 独立子命令**：输入与 `check` 完全相同（target + 视图），独立命令等于把加载与归域逻辑复制一遍——刀 3 已经就同一个问题裁决过一次（"reconcile 独立命令"被弃），遵循先例。
- **算「落错域」**（文件命中目标域 A 但现状属于 baseline 域 B）：两套 id 空间不对齐，要算就得再引入一张映射表，而映射表本身会成为下一个要维护、要腐烂的东西。竖切的定义就是"搬到目标目录下"，**落位即正确**，不需要第二个判据。

### 四、降档判定下沉，顺手修确定性缺陷

现有降档（note 非空→warn）写在 `graph/cli/cli.go#appendBudgetRatchet`，且**追加发生在 `sortFindings` 之后**——这是 roadmap 第 5 条刚销账的输出确定性缺陷的复发面。本刀要给第二类预算加棘轮，不下沉就要在 CLI 里复制第二段同样的代码。

裁决：**降档判定下沉进 `codegraph` 包的纯函数**，CLI 只负责 git 取数（`loadBudgetBase`）与调用；排序在所有 finding 都进报告之后统一发生。既消除复制，又顺手修掉确定性缺陷，还让测试缝从三个收回两个。

### 五、handoff 作为第一个案例，一期只切两个重灾区

目标图内容（不是机制）由 **AI 出稿 → 用户拍板 → 冻结**。一期范围收在 `d_controlplane`（61 文件）与 `d_cli`（41 文件）——它们既是 fitness `oversized-package` 的两个命中点，也正是 roadmap 1f 竖切还债的对象。其余 8 个子系统**留空**（不声明 domains = 不执法），等各自被真实的迁移需求触发。

**弃选：一次给 10 个子系统全出目标图。**出稿容易，拍板贵——用户要逐条判 40+ 个目标域的职责切分，而其中 8 个子系统近期不会有人去迁移。先骨架后血肉。

## 用户故事

1. 作为架构师，我在 `target.json` 的子系统下写目标领域树（id / 名字 / 职责一句话 / 路径规则），经拍板后冻结，它从此是这个子系统的宪法。
2. 作为架构师，我跑 `codegraph check` 就能看到每个子系统还有多少文件没落位、哪些目标域还空着，不需要读目录数文件。
3. 作为迁移执行者（1f 竖切还债），我把一批文件搬进目标包路径，`unplaced` 数字自动下降——这就是我这张卡的 acceptance 判据，不需要另造一套。
4. 作为守门人，任何人调高 `unplacedBudget` 都会被棘轮拦成 fail，除非写明理由降为 warn 留痕。
5. 作为 handoff 项目负责人，我拿到 AI 出稿的控制面 / CLI 两个子系统的目标领域树，拍板冻结后，1f 照它搬而不是照谁的临场判断搬。
6. 作为查看器的下游（C1.3），我能从 check 报告里取到"目标 vs 现状"的对照数据，不必自己再算一遍归属。

## 契约语义与接缝（L3）

**新增的 wire 契约面：`target.json` 的 `subsystems[].domains[]` 段。**两仓共享（charter/graph 定义与执法，handoff 提供数据），contract 节点负责冻结精确字段名与类型。

语义层的决定（签名归 contract）：

- **归属唯一性**：目标领域由嵌套关系决定所属子系统，不设外键、不设多归属。
- **子集不变式**：目标域的每条路径规则必须被其所属子系统的 `paths` 覆盖；否则两套分区打架，文件会被别的子系统按声明序抢走，形成永远清不掉的 gap。→ `ValidateTarget` 新查。
- **同级不重叠**：同一子系统内的目标域路径规则互不覆盖。（**注意不对称**：子系统之间的 paths 重叠今天不检测，是既存缺口；目标域是新地基，不背这个包袱。缺口本身另立卡，不在本刀。）
- **id 命名空间约定**：目标域 id **与终态的 baseline 领域 id 同名**——迁移完成时两者应当重合。一期**不执法**这条一致性，只作命名约定写进契约；执法会立刻诱导"改扫描归属去凑 id"的拐杖行为。
- **执法方向单向**：`check` 只读 target 与视图，纯函数，不写文件；目标图永远由人写、AI 出稿，**扫描者不得产出或修改 `domains` 段**（配方需明写，否则 AI 扫描者会"顺手补全"）。
- **向后兼容**：新字段全部 `omitempty`，`meta.version` **不 bump**。缺 domains 段的旧 target 照常工作（不执法目标图）。老版本二进制读新 target 会静默忽略该段——这与 roadmap 1i 是同一笔升版欠账，不额外处理。
- **历史包袱提醒**：v1 target 顶层曾用 `domains` 作为子系统段的旧名（`graph/codegraph/migrate.go#migrateV1Target`）。本刀的 `domains` 是**子系统内层**的新段，与之无关；contract 节点须确认 migrate 路径不受影响。

**接缝**：本刀不新增跨进程接缝。charter/graph ↔ handoff 之间的接缝就是 target.json 这一个文件，已存在。

## 实现决定

- schema 落 `graph/codegraph/target.go`（`TargetSubsystem` 增 `Domains`，新类型 `TargetDomain`）；结构校验并入 `#ValidateTarget`。
- gap 判据落**新文件**（`fitness.go` 是先例：判据与阈值独立成文件，阈值写死在包内不进配置）；报告结构复用 `Report`，新 kind 常量与既有 `Kind*` 同处。
- 棘轮扩展 `#CheckBudgetRatchet` 覆盖第二类预算；降档判定下沉为包内纯函数，CLI 只留 git 取数。
- CLI 侧改动面已知为四处：`cli.go` 的 RunE / `init` 注册 / `graphResetState` / 包注释里的命令计数，另有 `cli_test.go#TestGraphCommandCountIncludesMigrate` 的硬编码断言——**本刀不新增子命令，预期只碰前述降档下沉那一段**。
- handoff 侧交付物：`codegraph/target.json` 增两个子系统的目标域树（AI 出稿 + 用户拍板）；扫描配方补一节「target.json 的 domains 段不是扫描产出物」。

## 测试决定（接缝清单）

**最高的可测缝是 `graph/codegraph` 的两个纯函数，测试预算全部落在这里：**

1. **`codegraph.Check`**（主缝）：表驱动覆盖 unplaced 计数与预算分档、domain-empty、未声明 domains 段整体跳过、diff 视图下新文件落位使计数下降、findings 排序确定性（含新 kind 与下沉后的 budget-raised）。
2. **`codegraph.ValidateTarget`**（次缝）：目标域 id 唯一、路径规则合法、子集不变式、同级不重叠、responsibility 非空、预算非负。

不新增集成测试、不新增 CLI 层测试（降档下沉后 CLI 只剩 git 取数，已有覆盖）。真机验收 = handoff 真仓跑 `check`，unplaced 数字与人工数目录的结果逐个核对。

## Out of Scope

**永不做：**
- **「逻辑域」第三层概念**——本轮讨论明确否决：层级只有 子系统 → 领域，语义重划一律落目标侧。
- **给现状图装可读性拐杖**（容器级聚合作主视图、217 个接口排序分页）——四轮走查的否决项，方向已反。
- **按语义批量拆现状容器/域去凑目标图**——那是 C1.2 同样否决的动作；现状图的职责是诚实。

**本期不做、后续要做（逐条落 roadmap）：**
- 目标领域的**关键契约面**字段（roadmap 第 8 条原文列了它）：领域级契约执法是另一整刀，放一个不执法的字段会诱导人填了以为有效。→ 落 roadmap，待领域级契约执法立项时一并设计。
- 目标领域**嵌套**（`parent`，二级目标域树）：一期平铺，等真实案例。
- 「落错域」判据与 baseline↔target 的 id 映射表。
- **子系统之间 paths 重叠不检测**这个既存缺口（本刀只给目标域补了同级不重叠）。→ 另立卡。
- 专门的 gap 报告命令 / JSON 导出（查看器 C1.3 若需要结构化取数，届时再定形态）。
- 其余 8 个子系统的目标领域树。
- handoff 侧 go.mod 升版消费本刀（与 roadmap 1i 同批）。

## 备注

- **本刀不动一行业务代码**，交付物是工具判据与两份目标图数据。这是它排在批次第一的原因：C1.2（配方刀）保证它测的数不撒谎，C1.3（查看器刀）消费它的对照数据，1f（竖切还债）照它的目标域树搬。
- 顺手修的既存缺陷一条：`budget-raised` 追加破坏 check 输出确定性（`graph/cli/cli.go#appendBudgetRatchet`），随降档下沉一并解决，review 时须确认 roadmap 第 5 条的确定性断言仍绿。
- 图覆盖债：charter 仓自身**没有** `codegraph/`（工具未自托管），本 spec 的现状读数全部来自读码，符号锚已逐条标注，contract 节点须对当轮工作树复核。
