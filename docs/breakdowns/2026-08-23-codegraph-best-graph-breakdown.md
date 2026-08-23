# 拆解：codegraph 最优图（best.json 接管结构树，gap 改为两图 diff）

**卡**：C1.8 · **档位**：L3 轻档（实现归一轮，不扇出子卡）
**契约**：`docs/contracts/2026-08-23-codegraph-best-graph-contract.md`（60 条冻结 + 6 条拍板）
**前序契约**：`docs/contracts/2026-08-23-codegraph-target-domains-contract.md`（§4 已整体回写为「被 C1.8 取代」）
**Ticket 0 已落**：提交 `ccc61efa`（`best.go` 三类型四空壳、三个 kind 常量、`Check` 扩四参、金样本两支）
**状态**：出稿，未拍板。以下「待拍板」全部未选。

---

## §0 待拍板清单（**七处**，出稿者不选）

> **协调者裁决（2026-08-24）——七处全部已定，下方各节保留原提案作为取舍留档。**
> 待拍板 1 由用户拍板，其余六处由协调者拍板。裁决要点如下，冻结落点写进契约 §12。
>
> | # | 裁决 | 理由 |
> |---|---|---|
> | **1** | **方案 B 收窄**（用户拍板） | 初版恒为 0 且是**诚实的 0**——词汇未对齐本就无从比较。方案 A 的 233 条刷屏正是 C1.1 拍板三当年否决的失败模式。沉默路径用「N 个容器因词汇未对齐跳过错位判定」的显式读数堵掉 |
> | **2** | **方案 B 属性测试进 CI；handoff 全量节点的等价性挪进 acceptance 真机清单** | 条 48 真正要保护的是「容器子系统纯 ⇒ 两套归属等价」这条**一般性质**，属性测试能证它、还能覆盖负例（不纯容器 ⇒ 等价性破裂），这是快照做不到的。A 的 MB blob 会过期，而我们今天刚亲眼看着基线变过一次；C 的 skip 是 C4 记的「稳定假绿」原型。条 48 字面要改，见 §12 |
> | **3a** | **方案 B：保留 v1→v2→v3 两跳** | A 的「请先用旧版二进制」对公共工具是个糟糕的失败出口；C 会复制一份 v2 生成逻辑。B 复用既有 v1→v2 代码，而 migrate.go 无论如何都要自带本地 v2 结构体（见 C1） |
> | **3b** | **`MigrateResult.Notes []string`，CLI 再打到 stderr** | 条 47 要求提示**包含**特定语句，那必须可断言；stderr 纯文本断言不了。Notes 结构化 + CLI 打印，两头都占 |
> | **3c** | **原样采纳三条**（先写 best 后改 target；best 已存在即拒；baseline 缺失即报错） | 出稿者的失败态不对称论证成立：反序的失败态是 `check` 走 `b == nil`、打印跳过行、**退出码 0**，即伪绿；正序的失败态是 `LoadTarget` 拒载、直接停，是安全失败 |
> | **4** | **方案 A：加归属覆盖率读数**（非 Finding） | `b != nil` 且 `Containers` 空 ⇒ 契约执法静默全跳过、`Fails` 空、退出码 0，与「全清白」不可区分。这正是本会话一整天在打的伪绿族。一行读数成本为零。需回写（§12） |
> | **5** | **方案 A：改名 `DomainTreeWithBest(v *View, b *Best)`** | 一个叫 `WithTarget` 却收 `*Best` 的函数会骗到每一个后来读它的人；diff 大小不是理由。CLI 提示文案同步改口径。**第三选项（删 `DomainStat.Subsystems`/`CrossSubsystem`）不做**——确属零消费者死字段，但删 wire 字段超出本刀范围，落 roadmap |
> | **6** | **方案 B：`outside-file` 只留给「容器不在视图 `Containers` 里」的真异常** | 同一个事实按两种粒度各报一遍是噪声，而容器才是可行动单位。B 让两条判据各自保有独立语义：未归属 = `container-unplaced`（人的债），容器不存在 = `outside-file`（数据完整性问题）。需回写 `outside-file` 的新定义 |
> | **7** | **方案 A：接受下沉 + 补反向断言测试** | B 要新增 `contractset → best` 依赖，去做一件 `dead-contract` 已经会抓的事。契约 §5-1 明写选了下沉。反向断言测试是防后人「顺手补回来」的那道锁 |
>
> **边界澄清 C1~C10 全部采纳**，逐条回写进契约 §12。其中 C1（条 39/40 的作用域限定到**执法路径**，
> migrate 自带私有、永不喂 `Check` 的 v2 决议）是本次拆解第二重要的发现——不澄清它，
> T7 与 T8 会在编译期正面撞车。
>
> **退回 contract 的四项（B1~B4）裁决**：B1 否（= 待拍板 7 选 A）、B2 **准**（= 待拍板 4 选 A）、
> B3 否（「容器横跨多个最优子系统」告警是新判据，且容器实测 100% 纯，属为不存在的问题造判据）、
> B4 否（死字段删除落 roadmap，不进本刀）。


> 凡「两种做法、选哪种取决于偏好」的岔口都在这里。正文里不再暗中选一个往下写。
> 其中 **1、2、3、4、7** 需要在 implement 开工前定；**5、6** 可以在实现中定但必须留痕。

### 待拍板 1 —— `container-misplaced` 在 migrate 初版下到底报几条（**契约内部自相矛盾，必回 contract**）

**事实**：§4 的判定是「baseline 视图里该容器的 `Domain` 非空，且 ≠ best 的归属」——这是**两个 id 空间的字符串比较**。而 §5-2 的初版构造规则让 best 的领域 id 取自 **v2 子系统 id**（`d_controlplane`），baseline 容器的 `Domain` 取自**扫描领域 id**（`d_coordination_task`）。两者必然不等，于是初版下**每个已归域容器各报一条** warn（handoff 233 条）。而 §5-2 白纸黑字写着「`container-misplaced` 在初版下恒为 0」。**这句话在当前判定下是假的。**

| 方案 | 做法 | 取舍 |
|---|---|---|
| **A 改文案** | 承认初版全量报，把 §5-2 第三条提示改写成「初版下每个已归域容器各一条，直到 best 的领域 id 与 baseline 对齐」 | 诚实，判据零改动；代价是 C1.6 第一次 `check` 收到 233 条 warn——这正是 C1.1 拍板记录三当年否决「逐文件 finding」的同一个理由（首轮不可用） |
| **B 收窄判据** | `container-misplaced` 只在**容器的 baseline 域 id 也出现在 `Best.Domains` 里**时判定；两套词汇尚未对齐时不判 | 初版恒为 0 自然成立，人把 id 对齐后判据自动生效；代价是多一条沉默路径，必须像 §3-1 那样显式喊出「N 个容器因词汇未对齐跳过错位判定」，否则又是伪绿 |
| **C 改 migrate 初版** | 初版 best 直接复制 baseline 的 `domains` 段与 `containers[].domain` 表 | 恒为 0 自然成立；但与拍板记录五「初版只有顶层领域、不得伪造层级」正面冲突，且 §5-4 的反证已实测这条路会把跨子系统边 692→377、条 48 等价性**直接失败** |

出稿者观察（不构成选择）：C 与条 45、条 48 硬冲突，基本出局；A 与 B 是真取舍——诚实刷屏 vs 沉默但可控。

### 待拍板 2 —— 条 48 归属等价性测试的**数据从哪来**

**事实一**：charter 仓没有 handoff 的 `target.json` / `baseline.json`。
**事实二（可 grep 核实）**：charter 自家夹具 `graph/codegraph/testdata/repo` 的 3 个容器里有 **2 个跨子系统**——`k_svc` 的节点横跨 `cmd/run.go`（v2 归 `d_cmd`）与 `svc/server.go`（归 `d_svc`）；`k_ent` 横跨 `svc/task.go`（`d_svc`）与 `web/task.ts`（`d_web`）。**夹具天然违反 §2-3 的「跨子系统容器 = 0」前提**，等价性在它上面必然失败。

| 方案 | 做法 | 取舍 |
|---|---|---|
| **A 快照进仓** | 把 handoff 的 v2 `target.json` + `baseline.json` 快照进 `testdata/handoff-v2/` | 唯一能在 CI 里真跑 handoff 全量节点的做法，密闭、可变异；代价是仓里多一份 MB 级、会过期的 blob，且它固化的是 B223 那一刻 |
| **B 属性测试** | 随机生成 v2 target（路径规则 + assignments）与 baseline（容器/节点），先断言前提「容器子系统纯」，再断言两套归属逐节点相同 | 密闭、能覆盖 handoff 数据碰不到的边界（含「不纯容器 → 等价性破裂」的负例）；代价是不满足条 48 字面的「handoff 全部节点」 |
| **C 环境变量指路** | 从 env 读 handoff 仓路径，缺席即 `t.Skip`，真机跑过一次写进 acceptance 清单 | 满足字面；代价是可跳过的测试在 CI 里长期是**稳定假绿** |

出稿者观察：B+C 组合能同时满足密闭执法与字面要求，A 是唯一能在 CI 真跑的做法。**无论选哪个，测试必须先断言前提（容器子系统纯度）**——前提一旦破裂，只断言结论的测试红了也说不出为什么。

### 待拍板 3 —— migrate 的产物形态、v1 存亡、写序

**先回答「现有 migrate 支不支持产出两个文件」：不支持，改造是结构性的，不是加个分支。** 核对 `graph/codegraph/migrate.go`：`MigrateTarget(repoRoot) (MigrateResult, error)` 只读 `target.json`、只写 `target.json`（`saveMigratedTarget` 是单文件 temp+rename）、`MigrateResult{Migrated,From,To}` 无产物清单、整个函数不碰 baseline。

**3a v1 的存亡**（三选一）：
- **A** v1 一律拒载，提示先用旧版二进制迁到 v2；
- **B** migrate.go 冻结一份本地 v2 结构体，保留 v1→v2→v3 两跳；
- **C** v1→v3 一跳（v1 也要读 baseline 生成 best）。

注意：**无论选哪个，migrate.go 都必须自带本地 v2 结构体**——`Target` 已不再有 `Subsystems` / `Assignments`，v1 分支现在的 `Target{Subsystems: …}` 写法在 T7 之后编译不过。

**3b 三条限制提示（条 47）的载体**：进 `MigrateResult.Notes []string`（结构化、可断言、可 diff），还是 stderr 文本（与 `absorb` 的 `已併入视图 …`、`check` 的 `预算棘轮判据已跳过：…` 这两处既有惯例一致）。

**3c 写序、幂等与两处前置**（出稿者有明确倾向，仍需拍）：
- **写序：先写 `best.json`，再改 `target.json`。** 失败态不对称——best 写成而 target 仍 v2 → `LoadTarget` 拒载 → `check` 直接拒绝执行（安全失败）；反过来 target 已 v3 而 best 缺失 → `check` 走 `b == nil`、打印跳过行、**退出码 0**，是伪绿。写序在这里不是风格问题。
- **`best.json` 已存在时 migrate 必须拒绝**——覆盖等于毁掉人工编辑过的最优图。
- **`baseline.json` 缺失时必须报错**，不得产出 `Containers` 为空的 best。空 Containers 比 `b == nil` **更危险**：`b != nil` 会让 CLI 不打跳过行，而所有边两端归属都是 `""` → 契约执法静默全跳过 → 报告全绿、退出码 0。

### 待拍板 4 —— `b != nil` 但归属覆盖为 0 / 极低时要不要喊

条 25 只管 `b == nil`。`b != nil` 而 `Containers` 为空或 key 全不在视图里时，四条 gap 判据会照报一堆 `container-unplaced`，但**契约执法静默全跳过**，`Fails` 为空、退出码 0。

- **A**：加一行输出（**不是 Finding**）「归属覆盖 N/M 容器，契约执法覆盖 X 条跨域边」。纯读数，但属新增输出 → **需回写契约**。
- **B**：不加，只在 plan 里记为已知伪绿入口。

### 待拍板 5 —— `domains` 子命令的 target 依赖如何退场

`DomainTreeWithTarget(v, target)` 的 `target` 参数在瘦身后**唯一用途消失**（它只用来调 `target.SubsystemOf(n.File)`，`domains.go:133`）。

- **A** 改名 `DomainTreeWithBest(v *View, b *Best)`，CLI 提示文案从「target.json 不可用，subsystems/crossSubsystem 已省略」改成 best.json 口径；
- **B** 保名换参 `DomainTreeWithTarget(v, b *Best)`（名字骗人，但 diff 小）。

附带事实（可 grep 核实）：`DomainStat.Subsystems` / `CrossSubsystem` 两个 wire 字段在 charter 自家 `graph/webui/src` 里**零消费者**。第三个选项是连字段一起删——但契约完全没提这两个字段，删它要退回 contract。

### 待拍板 6 —— `outside-file` 与 `container-unplaced` 的重复报告

新链路下，一个未归属容器会同时产出 **1 条 `container-unplaced`**（按容器）与 **N 条 `outside-file`**（按文件）。§3-3 说「链路任一环缺失即图外，沿用既有 `outside-file` 语义」，§4 又单独定义了 `container-unplaced`——两条讲的是同一件事的两种粒度。

- **A** 都留（文件名对人更可行动）；
- **B** `outside-file` 只留给「容器根本不在视图 `Containers` 里」这种真异常，未归属由 `container-unplaced` 独占。

不定就实现，两种都写得出来，而 CLI 输出条数会差一个数量级。

### 待拍板 7 —— `ValidateTarget` 瘦身后的残余，与 `contract set` 的写前门

瘦身后 `ValidateTarget` **只剩 `legacyBudget < 0` 一条**：子系统 id 唯一性、`type` 白名单、`paths` 语法、`assignments` 外键、`contracts[].from/to` 外键——全部随字段消失。于是 `contract set --from d_typo` 从此**写得进 target.json**，只在 check 期以 `dead-contract` 现形。

- **A 接受**（契约 §5-1 明写下沉，属已知代价），但必须新增一支**反向断言**测试把「不再报 from/to 不存在」钉死，否则后人当漏实现给加回来；
- **B `contract set` 加载 best.json 校验 from/to ∈ 顶层领域**——新增 `contractset → best` 依赖，是**新接缝，需退回 contract**。

---

## §1 触及子系统清单

charter 仓自身**没有** `codegraph/target.json`，故本节按代码结构人工划分，逐条给依据。

| # | 子系统 | 类型 | 划分依据 | 本刀触及 |
|---|---|---|---|---|
| S1 | `graph/codegraph`（图数据模型与算法） | **逻辑型** | 包注释（`types.go:8-12`）自陈三条硬边界：不依赖 handoff 内部包、不产出数据、不做网络。全部是纯函数 + 本地文件读写，接缝对面是自有代码，测试可闭环 | **主战场**：`best.go` / `gap.go` / `check.go` / `target.go` / `fitness.go` / `domains.go` / `migrate.go` |
| S2 | `graph/cli`（cobra 命令树） | **逻辑型为主，含边界面** | `cli.go:10-14` 自陈只读本地文件、不发网络、不依赖 agentd。但 `loadBudgetBase` / `findMergeBase` / `gitOutput` / `gitHead` / `gitBranch` 走 `exec.Command("git", …)`——**这一簇是边界型**，对面是外部 git 现实 | `check` 加载 best、`domains --edges` flag、`migrate` 输出、`loadBudgetBase` 的投影字段（**不动 git 交互本身**） |
| S3 | `codegraph/*.json` 文件格式（跨仓 wire 契约） | **边界型** | 对面是 handoff 仓的文件与**人手写的 best.json**。机内只能验形状（金样本 + roundtrip），验不了 handoff 那边读得对不对 | `target.json` v2→v3、**新增 `best.json` v1**；`baseline.json` 只读不改 |
| S4 | `graph/webui`（查看器） | 边界型（前端 ↔ CLI JSON） | `domains.go:6-7` 文件头明写「与前端 `web/src/app/codegraph/domains.ts` 的判定规则必须一致，两侧分叉就是 bug」 | **零触及**——grep `graph/webui/src` 对 `subsystems` / `crossSubsystem` / `unplaced` / gap kind **全部零命中**，本刀改的字段前端不消费 |
| S5 | `graph/cmd/codegraph` 二进制 + handoff 的 `graph` 别名 | 边界型（安装与挂载） | `cli.go:6-7`：`New(use)` 是两处挂载的唯一构造 | **零触及**（子命令数不变，`--edges` 是 flag 不是子命令，条 52） |

**跨子系统面只有一条**：S1 与 S3 之间的文件格式。S1↔S2 是同仓包内 API，不构成契约面（沿用 C1.1 §7 的既有澄清）。

---

## §2 契约增量核对

### 2-1 明确**不越界**（不需退回）

四条 gap 判据的实现、`Check` 四参接线、CLI 加载 best、`--edges` 挂 `domains` 的 flag、`Best` 四个函数的行为实现、夹具升级、测试改写——全部落在已冻结条目（1~60）之内，不新增接缝。

### 2-2 **需退回 contract**（新接缝，出稿者不自行添加）

| # | 事项 | 为什么是新接缝 |
|---|---|---|
| B1 | 待拍板 7 方案 B：`contract set` 校验 from/to ∈ best 顶层领域 | 新增 `contractset → best` 的加载依赖，契约明写该校验已「下沉为 Check 期的 dead-contract」 |
| B2 | 待拍板 4 方案 A：归属覆盖率读数 | 新增 CLI 输出面，条 25 只覆盖 `b == nil` |
| B3 | 「容器节点横跨多个最优子系统」告警 | 新判据，契约无此 kind（详见 §4 隐含前提一节） |
| B4 | 删除 `DomainStat.Subsystems` / `CrossSubsystem` 两个 wire 字段 | 契约完全没提这两个字段，删 wire 字段是跨仓可见变更 |

### 2-3 **边界澄清**（结论都是「不退回」，但**必须回写进契约**，否则实现者面前是空白）

| # | 澄清 | 结论 |
|---|---|---|
| C1 | **条 40 与 §5-2 直接冲突**：条 40 说「包内不再存在按文件路径决议子系统的函数」，而 §5-2 规则 2 要求 migrate「按首个节点文件用 v2 的 `SubsystemOf` 语义（含 assignments 优先）决议」，条 48 的等价性测试也需要一份 v2 决议 | 条 40 的本意是**执法路径上不再有路径归属**。migrate 需要一份**迁移专用、私有、永不喂给 `Check`** 的 v2 决议（连同 `cutTargetRule` 那层后缀解析一起搬进 `migrate.go` 作为冻结副本）。回写把条 39/40 的作用域限定到执法路径，并给这个私有函数命名留档。**这是唯一可行解**（另一条路——用 baseline 现状领域代替——已被 §5-4 的实测反证否决），故列澄清而非待拍板 |
| C2 | `dead-rule` 判据与 `ruleHitsAny` 的去留 | **随 `Subsystems[].Paths` 一起死**。它的唯一输入是子系统 paths。冻结清单没有任何一条提到 `dead-rule`，回写补一条：`dead-rule` kind 与 `ruleHitsAny` 删除，`check.go` 的 `Finding` 文档注释同步 |
| C3 | `ValidateBest` 的**调用方**是谁 | 契约冻结了 `ValidateBest` 的八条判定，却**没有一条说谁调它**——照这样落下去它会是一个零调用方的死函数，八支测试全绿。按 `ValidateTarget` 的既有对称处置：`check` 在跑 `Check` 前调用，不通过即拒绝执行（`cli.go:222` 同形）；`validate` 子命令一并把 best 的问题并进 `issues`。另一种做法（best 不合法只降级为 warn，因为 best 是自愿加入的）不成立——归属已经烂了，在烂归属上执法比停下来更糟。回写补两条冻结 |
| C4 | migrate 写盘前是否跑 `ValidateBest` | 跑。migrate 自己生成的也可能不合法（两个 v2 子系统 id 重名会让 `Domains` map 静默去重）。回写补一条 |
| C5 | migrate 的「**首个**节点文件」是哪个 | Go 的 map 遍历序不定，`Containers` 的产出必须确定。定为「该容器全部非 deleted 节点按**节点 id 字典序**取最小的那个」。容器纯时任取皆同，不纯时不确定序会让 migrate 每次输出不一样。回写补一条（与条 49、条 56 的确定性纪律同源） |
| C6 | `LoadTarget` 拒 v2 的文案 | 现文案指向 `codegraph migrate`（沿用），但 migrate 现在**还需要 `baseline.json`**。文案要一并说明，否则用户照提示跑 migrate 会撞第二个错——这是「误导报错」族的典型形状 |
| C7 | `DomainTreeWithTarget` 的新签名 | 契约的 §5-3 重接表把 `domains.go:133` 列进去了，却没有任何一条冻结这个导出函数的新签名。见待拍板 5，选定后回写 |
| C8 | `DomainStat.MarshalJSON` 的 presence 开关 | 私有布尔 `targetDerived` 控制 `subsystems` / `crossSubsystem` 两键出不出现。语义要从「target 加载成功」改成「best 加载成功」，否则会出现「best 缺失但仍输出 `subsystems:[]`」。回写一句 |
| C9 | 两套版本号并存 | `best.json` 的 `meta.version` 是 **1**（条 9），`target.json` 是 **3**（条 35）。不是笔误，是两个文件各自演进。文档里说清即可，无行为影响 |
| C10 | `check` / `validate` / `contract set` 之外，`codegraph migrate` 的 CLI `Short` 文案 | 现为「将 target.json 从 v1 机械迁移到 v2」，必改。琐碎，实现顺手改，不必单独回写 |

---

## §3 task 清单与依赖 DAG

### 3-1 依赖 DAG

```
                      T0 契约回写（§0 拍板 + §2-3 澄清）
                                  │
                                  ▼
                            T1 Best 行为实现
                                  │
            ┌─────────────────────┼──────────────────────┐
            ▼                     ▼                      ▼
      T3 拆除旧 gap        （T5 棘轮瘦身，独立）      T10 domains --edges
            │                     │                      │
            ▼                     │                      │
      T6 拆除 dead-rule           │                      │
            │                     │                      │
            ▼                     │                      │
      T2 归属重接 ────────────────┼──────────────────────┘
            │                     │
            ▼                     │
      T4 四条 gap 判据            │
            │                     │
            └──────────┬──────────┘
                       ▼
              T7 Target 瘦身 + v3 + 路径族删除
                       │
                       ▼
              T8 migrate v2→v3 双产物
                       │
                       ▼
              T9 归属等价性测试（条 48）
                       │
                       ▼
              T11 文档对齐
```

`T3 → T6 → T2 → T4` 之间没有编译依赖（除 T3/T4 共用 `gap.go` 路径），串行只是因为**四个 task 都改 `check.go`**，单轮内串行比并行改同一文件划算。`T10` 与主链完全解耦，可插在 T1 之后任意位置。

### 3-2 删除顺序：为什么必须是这个位置

先把**硬约束**列清楚（每条都是「不这样做就编译红」，注意 `go test` 会编译测试文件，所以**测试夹具与生产符号必须同步退场**）：

1. `KindUnplaced` / `KindUnplacedOverBudget` 删除 **≥** `gap.go` 删除——`gap.go#targetDomainFindings` 是它们的唯一使用者（契约 §8 已明记这条）。
2. `gap.go` 删除 **=** `check.go:224` 调用点移除（同一步，否则调用悬空）。
3. `Target.Subsystems` / `Assignments` 字段删除 **≥** 其**全部**读者退场：`gap.go`、`check.go` 的 dead-rule 循环、`fitness.go` 的棘轮子系统那一半、`domains.go:133`、`migrate.go` 的 v1 分支、`cli.go#loadBudgetBase` 的投影，外加 `check_test` / `target_test` / `fitness_test` / `anchor_test` / `cli_test` 里的全部夹具。
4. `Target.SubsystemOf` 删除 **≥** 4 处生产调用（check ×3、domains ×1）+ gap.go ×1 + `target_test` 的 2 支交叉验证测试退场。
5. 路径规则函数族删除 **≥** `ValidateTarget` 的对应分支删除 + `gap.go` 删除 + `ruleHitsAny` 删除 + `target_test` 的 2 支单点定义测试退场。
6. `LoadTarget` 版本门 2→3 **=** 夹具 `testdata/repo/codegraph/target.json` 升 v3（同一步）——否则 `TestLoadTarget` / `domains_test` / `contractset_test` / 全部 CLI 夹具测试同时红。
7. `migrate.go` 改用本地 v2 结构体 **=** `TargetSubsystem` / `Assignment` 删除（同一步）。
8. **Best 行为实现 ≥ 归属重接**——这条不是编译约束，是**假绿约束**：`LoadBest` 若还是返回 `(nil, nil)` 的空壳，重接后 `check` 会走 `b == nil` 路径、契约执法全跳过、所有既有测试的 `Fails` 变空而全部通过。这是本刀最危险的中间态。

由此得出的顺序与位置理由：

| 步 | 内容 | 为什么必须在这个位置 |
|---|---|---|
| **T1** | Best 四函数行为实现 | 纯增量、零删除，编译绿显然。放最前是硬约束 8：后面每一步重接都要它是真的 |
| **T3** | 删 `gap.go` + 删两个常量 + 摘 `check.go:222-226` | 约束 1+2 要求这三件事原子。放在重接之前是**为了让 `check.go` 先变小**——旧 gap 与新归属互不相干，先减后接，重接那一步的 diff 才读得懂。此刻 `Target.SubsystemOf` 仍在，编译绿 |
| **T6** | 删 dead-rule + `ruleHitsAny` | 这是 `check.go` 里 `t.Subsystems` 的**最后一个读者**。必须在 T7 之前；紧跟 T3 是因为两者都是 `check.go` 的纯减法，合并成一个「check.go 瘦身」相位 |
| **T2** | 归属重接（`bestSubsystemOfNode` + `b == nil` 语义 + CLI 加载 best + `domains.go`） | 约束 8 之后、约束 3/4 之前。此刻被删的符号都还在，编译绿；`Target.SubsystemOf` 变成只有 `migrate` 的 v1 分支和测试在用 |
| **T4** | 四条容器判据落地（**同名重建 `gap.go`**） | 依赖 T1 的 `DomainOfContainer` 与 T2 的 `bestSubsystemOfNode`。**同名重建而不是另起 `bestgap.go`**：「gap 判据住在 gap.go」这条定位常识不该因为换实现就漂走 |
| **T5** | 棘轮瘦身（`fitness.go` + `cli.go#loadBudgetBase`） | 与 T2/T3/T4 无耦合，但必须在 T7 之前——它是 `Subsystems` / `UnplacedBudget` 的另一簇读者（约束 3） |
| **T7** | Target 瘦身 + 三类型删除 + 六个路径函数删除 + `SubsystemOf` 删除 + v3 版本门 + 夹具升级 + migrate 本地结构体化 | **唯一一步「一次删完」**。字段、类型、函数、版本号、夹具、migrate 的本地类型**互为编译依赖**：删字段就要删类型，删类型 migrate 就编译不过，改版本门夹具就得同步，切成更小步一定在中间态留下编译红。约束 3~7 全部在这一步兑现 |
| **T8** | migrate v2→v3 + best 初版 | 依赖 T7 的本地 v2 结构体已就位、T1 的 `Best` 可写 |
| **T9** | 归属等价性测试 | 依赖 T8 产出初版 best |
| **T10** | `domains --edges` | 只依赖 T1/T2，与删除链无耦合 |
| **T11** | 文档对齐 | 依赖 T7/T8 定型 |

### 3-3 逐 task 四段式

---

#### T1 · Best 四函数行为实现

**① 契约条目**：7、8、9（`LoadBest`）；10~18（`ValidateBest` 八条 + 纯函数）；19、20（`SubsystemOf` 环保护与顶层自返）；21（`DomainOfContainer`）；51（金样本已在，本 task 只补 roundtrip）。

**② 意图与为什么**：把 Ticket 0 的四个空壳变成真实现。它是整刀的**归属唯一来源**，后面每一条判据、每一次重接、migrate 的产物、等价性测试都吃它。放在最前不是习惯，是因为空壳会让下游的「全绿」失去意义（§3-2 约束 8）。

**③ 验收（行为化，逐条可独立跑）**
- `LoadBest(t.TempDir())` 返回 `(nil, nil)`，**err 为 nil**（条 7）。
- 写一份坏 JSON → 返回非 nil error 且 error 文案含文件路径（条 8）。
- 写 `meta.version = 2` 的合法 best → 返回非 nil error（条 9）。
- `ValidateBest` 八支独立用例，每支只放一族违规，断言返回的 issue 文案里能定位到具体 id（条 11~18）。**特别包含**：给一个顶层领域挂上子领域之后，原本指向它的容器全部变成「指向非叶子」——这支锁的是条 17，也是人编辑 best 时最常撞的一次。
- **环保护是行为事实，必须能红**：构造 `a.Parent = b; b.Parent = a`，`SubsystemOf("a")` 在有限时间内返回 `""`。用 `-timeout` 兜底不算数——要断言返回值（条 19）。
- `ValidateBest` 纯函数性：在一个**只有 best、没有 `codegraph/` 目录**的临时目录里调用，不 panic、不产生任何文件（条 10）。
- roundtrip 属性：随机生成 `Best`（随机领域数、随机 parent 链、随机 containers），断言 `decode(encode(b))` 与原值 `reflect.DeepEqual`。一条属性覆盖「字段缺失 vs 值为零」整族。

**④ 入口指针**：`graph/codegraph/best.go`、`graph/codegraph/best_test.go`。

**缺陷族结论**：见 §4-A。

---

#### T3 · 拆除旧目标领域 gap

**① 契约条目**：42（删两个常量）；§1-2 的作废清单（`targetDomainFindings`）；§8「删除是破坏性的，一次做完才能保证编译绿」。

**② 意图与为什么**：`gap.go` 整个文件、两个 kind 常量、`check.go` 的调用点是一个不可分割的三角。先拆掉它，`check.go` 才有空间做归属重接。**这一步是纯减法，本轮不补任何替代品**——替代品在 T4，两者分开是为了让「旧判据消失」和「新判据出现」在 git 历史里各自可审。

**③ 验收**
- `graph/codegraph/gap.go` 不存在；`grep -rn "KindUnplaced\|KindUnplacedOverBudget\|targetDomainFindings\|targetGapSampleLimit" graph/` 零命中（含测试）。
- `go build ./... && go vet ./... && go test ./...` 三绿。
- `check` 对夹具仓的输出里不再出现 `unplaced` / `unplaced-over-budget` 两种 kind。
- **反向断言必须保留而不是删除**：`fitness_test.go#TestApplyBudgetRatchetKeepsUnplacedOverBudgetInFails` 锁的是「note 只降 `budget-raised` 的档，别的 fail 一律不降」。这条防线不能随 `KindUnplacedOverBudget` 一起消失——**改写成用一条现存的 fail kind（`over-budget`）做同样的断言**。直接删掉它，降档分支就从此裸奔，下一个人加 fail 判据时没有任何东西会红。
- `TestGraphCheckOutputStaysSortedAndByteStable`（`cli_test.go:479`）当前靠 `budget-raised` + `unplaced-over-budget` 两种 kind 验全序，后者消失后必须换成另一对 kind（如 `budget-raised` + `new-direction`），**不得降级成单 kind**——单 kind 验不了排序（条 49）。

**④ 入口指针**：`graph/codegraph/gap.go`（删）、`check.go:222-226`、`fitness.go:20-28`、`check_test.go:384-665`、`fitness_test.go:166-310`、`cli_test.go:479-560`。

**缺陷族结论**：见 §4-D（假绿）。

---

#### T6 · 拆除 dead-rule

**① 契约条目**：39（路径函数族删除的前置）；**契约未列，属 §2-3 C2 的澄清项**。

**② 意图与为什么**：`dead-rule` 的唯一输入是 `Subsystems[].Paths`，字段一没它就无法存在。它是 `check.go` 里 `t.Subsystems` 的最后一个读者，不拆掉 T7 编译不过。

**③ 验收**
- `grep -n "dead-rule\|ruleHitsAny" graph/` 零命中。
- `TestCheckDeadRuleRespectsDirectoryBoundary` 删除；`TestCheckExemptionsAndWarns` 的 `assertKinds(t, "warn", rep.Warns, []string{"outside-file", "dead-rule"})` 改为只断言 `outside-file`，**组装豁免与 deleted 边两条断言原样保留**。
- `dead-assembly` **不受影响**：它读的是 `t.Assembly`，`Assembly` 存活（§5-1）。跑一次 `TestCheckDeadAssembly` 与 `TestCheckDeadAssemblyIgnoresDeletedNodes` 确认仍绿——这两条是 `dead-rule` 的对称兄弟，很容易被顺手一起删掉。
- `check.go` 顶部 `Finding` 的 kind 文档注释同步删掉 `dead-rule` 那一项。

**④ 入口指针**：`graph/codegraph/check.go:15-20, 198-209, 249-262`、`check_test.go:106-151`。

---

#### T2 · 归属重接：容器链路接管子系统决议

**① 契约条目**：22（`Check` 签名）；23、24（`b == nil` 的两级跳过）；25（CLI 不静默）；§3-3（`node.Container → DomainOfContainer → SubsystemOf` 链路）；§5-3（四个调用点重接表）。

**② 意图与为什么**：这是整刀的**语义换心**——契约执法的输入从「文件路径匹配规则」换成「容器归属最优树」。执法结果**必须不变**（§5-4 的等价性论断就是这个意思），所以这一步的判据不是「新行为出现」，而是「旧行为在新输入下逐条复现」。`b == nil` 的两级跳过在这一步一并落地，因为它是同一个 if 的另一支。

**③ 验收**
- 包内新增 `bestSubsystemOfNode(b *Best, v *View, nodeID string) string`，链路任一环缺失返回 `""`。
- **既有契约用例全部原样通过，只换夹具**：`TestCheckTable` 五例、`TestCheckImplements`、dead-entry / dead-interface / dead-contract 那批——断言一字不改，夹具从 `Subsystems + paths` 换成 `Best{Domains, Containers}`。这批测试是「换算法不换执法结果」的唯一执法者。
- **`checkNoDecls` 这个 helper 必须一并改造**（`check_test.go:17`）：它今天是 `Check(t, nil, v, nil)`——**第二个 nil 就是 best**。重接之后它等于「关掉主判据」，20+ 处存量用例会静默变成空报告而全部通过。这是本 task 最大的单点假绿，改造 helper 是硬性验收项，不是风格建议。
- 条 23/24 的**反面断言成对出现**：同一份会报 `new-direction` 的视图，`b` 给对 → 报；`b = nil` → `Fails` 为空。只有后者是稳定假绿的温床。
- 条 25 在 **CLI 层**验：夹具仓删掉 `best.json` 跑 `check`，断言 (a) 输出里含显式跳过行，(b) 退出码 **0**。包内测试锁不住这条。
- `LoadBest` 返回 error 时 `check` 拒绝执行（与 `LoadDomainDecls` 的既有处置一致，`cli.go:232-235`）。
- `domains.go:133` 改走容器链路；`DomainStat.MarshalJSON` 的 presence 开关语义改为「best 加载成功」（§2-3 C8）。
- **夹具行为变化必须实测并留档**（见 §5 未验证清单 U1）：夹具的 `k_svc` 与 `k_ent` 是跨子系统容器，重接后 `n_runE`（`cmd/run.go`）与 `m_task_ts`（`web/task.ts`）的归属会变，夹具 `check` 的输出**会变**。实现者必须先跑一遍记下新基线，再改断言——不能反过来改断言去凑。

**④ 入口指针**：`graph/codegraph/check.go:50-79, 136-186`、`domains.go:73-146`、`graph/cli/cli.go:211-252, 492-515`、`check_test.go:11-33`、`domains_test.go:76-81`、`anchor_test.go:280-290`、新增 `graph/codegraph/testdata/repo/codegraph/best.json`。

**缺陷族结论**：见 §4-B、§4-D。

---

#### T4 · 四条容器 gap 判据

**① 契约条目**：26~33（四条判据的 kind / 档位 / From-To 形状 / deleted 与空 Domain 的边界）；30（一条都不进 Fails）；31（逐容器逐领域，不聚合）；49（统一排序）。**待拍板 1 直接决定 `container-misplaced` 的判定**。

**② 意图与为什么**：把「最优树与现状分类不一致」这件事变成可读的清单。四条全是 warn，因为它们靠编辑 JSON 就能消解（§1-3）；真正的进度条在边的合法性上，那由 T2 重接后的既有判据承担。逐容器出 finding 而不聚合，是因为对象从 61 个文件变成了 231 个容器里的个位数错位者——「容器 X 应在 Y」可行动，「子系统有 7 个错位」不可行动。

**③ 验收**
- 四条 kind 字面量逐字为 `container-misplaced` / `container-unplaced` / `domain-empty` / `best-dangling`（条 26~29）。
- **四条同时命中的夹具下 `rep.Fails` 为空**（条 30）。必须是同时命中——分四支各测一条，漏一条也全绿。
- `From` 为容器 id（前三条中的两条）或领域 id（`domain-empty`），`To` **在 JSON 里省略而不是 `"to":""`**（条 26、28、29）。这条断言在被删的 `TestCheckTargetDomainFindingsSurviveReportJSON:661-664` 里存在，**必须在新测试里原样保留**。
- 只对有非 deleted 节点的容器判前两条（条 32）：把容器全部节点标 deleted，两条 finding 都不出现。
- `Domain` 为空的旧扫描容器不产出 `container-misplaced`（条 33）。
- `domain-empty` 的新判定是「零容器指向」而非「路径零命中」（条 28）：一个叶子领域没有任何 `Containers` 值指向它 → 报；有一个指向它的容器即便该容器全是 deleted 节点 → **需要拍板 1 之外的一次明确**（本条与 `best-dangling` 相邻，实现时按「`Containers` 的 key 计数，不看视图」落，与条 28 字面一致）。
- 重复运行 `check` 输出逐字节相同（条 49）。
- **变异复验抓手**：每条判据的函数体改成 `return nil` 都要有对应测试变红。

**④ 入口指针**：`graph/codegraph/gap.go`（同名重建）、`check.go` 的接线点、`fitness.go:42-46`（常量已在）、`check_test.go`。

**缺陷族结论**：见 §4-D、§4-G。

---

#### T5 · 预算棘轮瘦身

**① 契约条目**：41（`UnplacedBudget` / `UnplacedBudgetNote` 删除，棘轮只比契约 `legacyBudget`）；43（`CheckBudgetRatchet` 签名保持 `func(cur, base *Target) []Finding`）；§9 对 R11 的回写（宽松解析只需承载 `contracts` 段，约束更容易满足）。

**② 意图与为什么**：本刀不新增棘轮，且删掉一半旧棘轮。签名保持不变是为了让 `ApplyBudgetRatchet` 的调用方与 CLI 的边界不动——只有内脏变小。

**③ 验收**
- `CheckBudgetRatchet` 签名逐字不变（条 43）。
- `grep -n "UnplacedBudget\|ratchetBudget" graph/` 零命中；`ratchetBudget` 类型随之删除。
- `budgetRatchetNote` 的 `finding.To == ""` 分流分支删除，**连同注释里那句「To 为空是目标领域预算上涨的形状标记」一起删干净**——四条新 gap 判据也都是 To 省略，留着这句注释会让下一个人以为两者串了（实际不串，见 §4-F）。
- `cli.go#loadBudgetBase` 的投影只留 `Contracts`；`cli.go:286-291` 那段「subsystems 必须与 contracts 一同投影」的注释整段删除并改写。
- 契约 `legacyBudget` 那一半的既有用例全绿：上涨→fail、有 note→warn、纯空白 note→fail、相等不响、基准缺席按 0。
- `TestGraphCheckSubsystemRatchetAgainstTrueSchemaV1Base`（`cli_test.go:317`）等四支子系统棘轮测试删除；**但真 v1 基准的宽松解析回归必须留一支**——它锁的是「基准可能是 v1/v2，宽松解析不过版本门」，这条在 T7 把版本门抬到 3 之后**更重要**，删掉等于把跨版本基准读取的唯一保护也删了。

**④ 入口指针**：`graph/codegraph/fitness.go:56-121, 151-169`、`graph/cli/cli.go:254-293`、`fitness_test.go:166-310`、`cli_test.go:296-478`。

---

#### T7 · Target 瘦身 · 路径规则族删除 · v3 版本门

**① 契约条目**：34（`Target` 三字段）；35（version 3 与拒载）；36（`Contract` 一字不改）；37、38（三个类型删除）；39（六个路径函数删除）；40（`SubsystemOf` 删除，作用域按 §2-3 C1 澄清）；§5-1。

**② 意图与为什么**：这是整刀的**一次性大删**。它必须是一步，理由在 §3-2：字段/类型/函数/版本号/夹具/migrate 本地类型互为编译依赖，任何更细的切法都会在中间态留下编译红。

**③ 验收**
- `Target` 的 Go 字段恰为 `Meta` / `Assembly` / `Contracts`（条 34）。**新增 `TestTargetV3JSONGolden`**：锁 v3 的 wire 形（三键；断言编码结果里**不出现** `subsystems` / `assignments`）。旧的 `TestTargetDomainJSONGolden` 被 `TestBestJSONGolden` 取代是契约 §9 条 37 的原话，但那只覆盖了 best 一侧——**target 瘦身这个 wire 变更本身会变成零金样本保护**，必须补。
- `LoadTarget` 拒载 version ≠ 3，文案指向 `codegraph migrate` **并说明需要 `baseline.json`**（条 35 + §2-3 C6）。
- `TestGraphTargetVersionGate`（`cli_test.go:644`）的循环从 `{1, 3}` 改为 `{1, 2}`——它今天断言的正是「v3 被拒」。
- `grep -rn "TargetDomain\|TargetSubsystem\|Assignment\|validPathRule\|targetPathCovers\|targetPathsOverlap\|targetRuleMatchesFile\|targetPrefixRuleSuffix" graph/` 在 `migrate.go` 之外零命中（`migrate.go` 的私有冻结副本按 §2-3 C1 留存，且命名带 `migrate` 前缀以示作用域）。
- `ValidateTarget` 只剩 `legacyBudget < 0`。**新增反向断言**：传入 `Contracts: [{From:"d_ghost", To:"d_ghost"}]` 断言**不报** issue——把「引用完整性已下沉」这件事钉死（待拍板 7 方案 A 的执法者）。
- 夹具 `testdata/repo/codegraph/target.json` 升 v3（去掉 `subsystems`，留 `meta` / `assembly` / `contracts`），配套 `best.json` 由 T2 建立。
- **测试逐类处置**（这是本 task 一半的工作量，逐条列出以免删除掩盖回归）：

| 测试 | 处置 | 理由 |
|---|---|---|
| `TestLoadTarget` | **改写** | 断言 `Version == 3` 且 `Contracts` 非空；不能再断言 `Subsystems` |
| `TestLoadTargetMissingIsError` | **留** | 反静默头号约定，不受影响 |
| `TestTargetDomainJSONGolden` | **删** | 契约 §9 条 37 明写取代 |
| `TestValidateTarget` | **改写** | 只剩 legacyBudget；加上文的反向断言 |
| `TestValidateTargetDomainRules`（13 子例） | **全删** | 校验对象整体消失 |
| `TestTargetDomainJSONPresenceAndZeroRoundTrip` | **删** | 保护对象 `unplacedBudget` / `unplacedBudgetNote` / `domains` 三键全没了 |
| `TestContractBudgetDefaultZero` | **留** | `Contract` 一字不改（条 36） |
| `TestCutTargetRuleParsesSuffixConvention` | **删**，语义**搬到** migrate 私有副本 | 后缀约定的单点定义仍活在 migrate 里，它今天是唯一的执法者 |
| `TestTargetRuleMatchesFileAgreesWithSubsystemOf` | **删** | 两处实现都进了 migrate，交叉验证对象消失 |
| `TestSubsystemOf` | **删，但用例表必须搬到 migrate 的私有 resolver 上** | 前缀整段匹配、assignments 优先、精确规则、图外——**这四条是 migrate 生成初版归属正确性的全部保护，也是条 48 等价性测试的另一半输入**。直接删掉，migrate 的归属决议就零测试，而它错了以后等价性测试会跟着一起错（两边用同一个坏函数，测出来是相等的）。**这是本次拆解里最容易被「删掉就算了」掩盖的一处回归。** |
| `TestValidateTargetDomainRules` 之外的 `anchor_test.go:280-290` 夹具 | **改写** | 带 `Subsystems` / `UnplacedBudget`，换成 best 夹具 |
| `contractset_test.go` | **改写夹具** | v2 → v3；`contractset.go` 本身不改 |
| `TestGraphContractSet`（`cli_test.go:850`） | **改写夹具** | 同上 |

**④ 入口指针**：`graph/codegraph/target.go`（全文）、`migrate.go:19-96`、`testdata/repo/codegraph/target.json`、`target_test.go`（全文）、`anchor_test.go:280-290`、`contractset_test.go`、`cli_test.go:644-667, 850-890`。

**缺陷族结论**：见 §4-C、§4-D、§4-F。

---

#### T8 · migrate：v2 target + baseline → v3 target + v1 best

**① 契约条目**：44（双产物）；45（初版只有顶层领域）；46（决议为空串的容器不写入）；47（输出提示含「机械翻译，不是最优结构」）；§5-2 三条构造规则。**待拍板 3 全部三个子项直接决定本 task 的形状。**

**② 意图与为什么**：C1.6 要在初版上编辑，而不是手写 239 条容器归属。migrate 的价值全在「机械、无判断」四个字上——它不该发明架构（拍板记录五），初版扁平且 `Responsibility` 是显式占位符，正是为了让「这里还没有人做过架构决定」在文件里看得见。

**③ 验收**
- 拿一份 v2 target + baseline 跑 migrate：产出 v3 target 与 v1 best 两个文件，`LoadTarget` 与 `LoadBest` 都能读回（条 44）。
- 初版 best 的 `Domains` 里**没有任何 `Parent` 非空的条目**（条 45）。
- v2 决议为空串的容器**不在** `Containers` 里，且随后 `check` 对它报 `container-unplaced`（条 46）——这条要连着验，否则「不写入」可能变成「被塞进某个域」。
- 输出提示含「机械翻译」「不是最优结构」「`Responsibility` 是占位符」「`container-misplaced` 初版下的预期条数」四层意思（条 47 + 待拍板 1 的结论）。
- `Responsibility` 在 v2 `note` 为空时填 `"（迁移生成，待填写）"`（§5-2 规则 1）——逐字。
- **确定性**：同一份输入跑两次，两个产物文件**逐字节相同**（§2-3 C5 的「首个节点按 id 字典序」）。这条不加，容器不纯时 map 遍历序会让输出飘。
- migrate 写盘前跑 `ValidateBest`，不通过即拒绝写（§2-3 C4）。
- **待拍板 3c 的三条失败态各一支**：`best.json` 已存在 → 拒绝且不改 target；`baseline.json` 缺失 → 报错且不改 target；写 best 成功但改 target 失败 → target 仍是 v2（于是 `check` 拒绝执行而不是伪绿）。
- `TestMigrateTargetV2IsIdempotent` **必须重写**——它今天断言「v2 输入不改文件」，与新行为正相反。`TestMigrateTargetRejectsMissingAndUnsupportedVersions` 断言 v3 被拒，也必须翻成「v3 幂等 no-op」。
- 私有 v2 resolver 继承 `TestSubsystemOf` 的四条用例（见 T7）。

**④ 入口指针**：`graph/codegraph/migrate.go`（全文重做）、`migrate_test.go`（四支全改）、`graph/cli/cli.go:198-209`、`cli_test.go:913-928`。

**缺陷族结论**：见 §4-A、§4-B、§4-E。

---

#### T9 · 归属等价性（条 48）

**① 契约条目**：48；§5-4（实测反证与「20 条 legacyBudget 不用重标定」的论断）。

**② 意图与为什么**：这是「换归属算法不会重洗 20 条 `legacyBudget` 标定」这个承重论断的**唯一执法者**。没有它，这个属性只在 handoff 当下数据里恰好为真，而 acceptance 的变异复验没有对应测试可红。

**③ 验收**
- **先断言前提**：所使用的数据里跨子系统容器数为 0。前提破裂时测试必须报「前提不成立」而不是报「归属不等价」——两者的修法完全不同。
- 再断言结论：对全部非 deleted 节点，v2 私有 resolver 的 `SubsystemOf(node.File)` 与 `SubsystemOf(DomainOfContainer(node.Container))` 逐字相同。
- **负例一支**：构造一个跨子系统容器，断言等价性**破裂**且破裂点可定位到那个容器。没有负例，这支测试永远是绿的空气。
- 数据来源按 **待拍板 2** 的结论落；若选方案 C（env 指路 + skip），必须在 acceptance 清单里留一条真机项，并在测试跳过时打印「本支已跳过」到 stderr（不能静默跳过）。

**④ 入口指针**：新增 `graph/codegraph/equivalence_test.go`；数据位置随待拍板 2。

**缺陷族结论**：见 §4-G。

---

#### T10 · `domains --edges` 跨领域边矩阵

**① 契约条目**：52~60（六条 + 「不进 Report」+ 「不复制归属算法」）；§11 全节。

**② 意图与为什么**：写 best.json 是 231 次职责判断，看容器标签就够；但「这条边界切不切得动」只有数据能答。它是「不可伪造的进度条」的可读形态——迁移推进时数字下降，重贴容器标签不会让它们动一分。

**③ 验收**
- `codegraph domains --repo . --edges`；`codegraph` 的业务子命令数**仍为 14**（条 52，`TestGraphCommandCountIncludesMigrate` 是现成的执法者）。
- 记录是有序对 `(from, to, count)`，不做无向合并（条 53）：构造 `A→B` 3 条、`B→A` 5 条，断言输出是两条记录而不是一条 8。
- 只统计 `from != to` 且两端归属均非空的边；一端无归属的边**不计入也不另报**（条 54）。
- 只统计非 deleted 节点与边（条 55）。
- 三级排序 count 降序 / from 升序 / to 升序（条 56）：夹具里必须有**两条 count 相同、from 不同**的记录，否则第二级 tiebreak 零保护——这正是变异复验的抓手。
- 重复运行输出**逐字节相同**（条 56）。
- `best != nil` 时输出两份矩阵、键名可区分（条 57）；`best == nil` 时只输出现状矩阵并显式说明最优矩阵已跳过（条 58）。
- `--edges` 的输出里**没有** `fails` / `warns` 键；`check` 的输出里**没有**矩阵（条 59）。
- 归属算法调包内既有函数（条 60）：矩阵的计算落在 `graph/codegraph/domains.go`，CLI 只传 flag 和打印。
- **进度条属性一支**（补 T3 删掉的用户故事）：把某个容器的 best 归属从 `d_x` 改到 `d_y`，断言最优矩阵里对应边界的计数下降。理由见 §4-D。

**④ 入口指针**：`graph/codegraph/domains.go`、`graph/cli/cli.go:492-515, 698-713`、`domains_test.go`、`cli_test.go:135-206`。

---

#### T11 · 文档对齐

**① 契约条目**：无直接冻结条；§2-3 C6、C10 的落点。

**② 意图与为什么**：仓里有已经过期的表述会直接误导下一个读者。

**③ 验收**
- `README.md:36` 的「目标图（`codegraph/target.json`，其 `domains` 数组承载子系统清单）」——**这句在 v2 时代就已过期**（v2 已改名 `subsystems`），v3 之后更错。改成「最优图 `codegraph/best.json` 承载子系统与领域结构，`target.json` 只承载契约面」。
- `graph/cli/cli.go:200` 的 migrate `Short` 文案。
- `docs/roadmap.md` 第 13 条的状态推进（契约冻结 → 实现完成）。
- `grep -rn "unplacedBudget\|TargetDomain" docs/` 命中的是历史 spec / breakdown / plan，**不改**——它们是当时的真实记录，改了就成了篡改历史；只在 `docs/contracts/2026-08-23-codegraph-target-domains-contract.md` 已有的回写块里确认覆盖到位。

**④ 入口指针**：`README.md:36`、`graph/cli/cli.go:198-209`、`docs/roadmap.md:49`。

---

## §4 缺陷族对抗审查

按 `charter:defect-families` 逐族正面回答。**无风险的写「无，因为……」。**

### 4-A 生命周期 / 状态机中断

**本操作中途宿主进程重启会怎样？**
- T1~T7、T9、T10：**无，因为**全部是纯函数与只读加载，进程死掉不留任何状态。
- **T8 是唯一命中项**：migrate 要写两个文件，中途崩溃会留下不一致的半迁移。这是待拍板 3c 的全部动机——写序不是风格问题：「best 写成 / target 未改」→ `LoadTarget` 拒载 → `check` 拒绝执行（安全）；「target 已 v3 / best 缺失」→ `check` 走 `b == nil`、打印跳过行、**退出码 0**（伪绿）。所以顺序只有一个方向是安全的。
- **孤儿资源**：`saveMigratedTarget` 的 temp 文件在自身失败路径有 cleanup；双文件版必须各自 cleanup，且 best 的 temp 文件在 target 写失败时**不该回滚**（best 已经是正确产物，重跑幂等覆盖即可）。
- **既有缺陷，本刀不引入但会被放大**：`contractset.go:71` 用 `os.WriteFile` 非原子写 target.json，与 migrate 的 temp+rename 不一致。T7 改 wire 形状后，一次半写会留下无法解析的 target.json。**建议单独立项，不在本刀扩大范围。**

### 4-B 静默失败 / 误导报错

这是本刀的主战场，逐条列传播契约：

| 路径 | 传播契约 | 用户看到什么 | 存在「报成功但没做」的窗口吗 |
|---|---|---|---|
| `LoadBest` 文件不存在 | `(nil, nil)` — **不是错误** | 由 CLI 打显式跳过行（条 25） | **有，且是设计出来的**：调用方不打那行就是伪绿。条 25 必须有 CLI 层测试（T2 验收） |
| `LoadBest` 解析失败 / version≠1 | 显式 error | check 拒绝执行 | 无 |
| `ValidateBest` 不通过 | `[]string` | **契约没规定谁调它** → 见 §2-3 C3，不回写就会落成死函数 | **有**：零调用方时八支测试全绿而线上无门 |
| `b != nil` 但归属覆盖 0 | 无任何信号 | 报告全绿、退出码 0 | **有** → 待拍板 4 |
| migrate 缺 baseline | 待拍板 3c 定为报错 | 若定成「产出空 Containers 的 best」则是最坏形态：`b != nil` 让 CLI 不打跳过行，执法却全静默 | 见左 |
| `LoadTarget` 拒 v2 | error 指向 `codegraph migrate` | **误导**：现文案没说 migrate 还需要 baseline，用户照做会撞第二个错 → §2-3 C6 | 无 |
| `--edges` 在 `best == nil` 时 | 只输出现状矩阵 + 显式说明（条 58） | 可行动 | 无，条 58 已覆盖 |

**结论**：本刀新增 **5 个**「报成功但没做」的候选窗口，其中 3 个已由冻结条覆盖（条 24/25/58），2 个待拍板（4 与 3c），1 个需回写（C3）。

### 4-C 跨平台假设

- **本刀净减少一处暴露面**：删掉的六个路径规则函数是整包唯一一处「把用户写的路径字面量当匹配规则」的地方。删了以后归属只比对容器 id 字符串，与文件系统语义脱钩。
- 残留假设逐条核过：
  - `filepath.Join(repoRoot, "codegraph", "best.json")` —— 与 `LoadTarget` / `LoadGraph` 同形，Windows 安全。
  - `fitness.go` 的 `path.Dir` / `path.Base` —— 用 `path` 而非 `filepath`，对图数据的 `/` 分隔正确（图数据一律仓内相对路径，`target.go:256` 原有注释明写「不做 filepath 转换」）。
  - migrate 的私有 v2 resolver 仍带 `dir/**` 整段匹配语义 —— **照抄不改**，它继承的是既有假设，不是新增的。
  - `os.CreateTemp` + `os.Rename` 同目录原子替换 —— 既有形态。
- **结论：本刀不新增任何跨平台假设。**

### 4-D 假红 / 假绿测试

**四处高危，逐一给对策：**

1. **`checkNoDecls` 的第二个 nil**（最高危）。`check_test.go:17` 是 `Check(t, nil, v, nil)`——第二个 nil 就是 best。T2 重接后它等于「关掉主判据」，**20+ 处存量契约用例会静默变成空报告并全部通过**。对策：T2 硬性验收项，helper 必须改造成显式传 best。
2. **空壳 `LoadBest` 的中间态**。若 T2 排在 T1 之前，或 T1 只落了签名，整轮 `check` 会全绿而什么都没查。对策：§3-2 硬约束 8，T1 必须先落真实现。
3. **「删掉的测试没有等价替代」**。`TestCheckTargetDomainUnplacedDropsAfterRealMerge` 是「真实迁移使数字下降」这个用户故事的唯一可执行判据。容器版的字面对应（改容器归属 → `container-misplaced` 归零）**恰恰是 §1-3 说的「靠改标签消解」，不能当进度条**。真正的等价替代是 **T10 的最优矩阵计数下降**（§11-1 明说它才是不可伪造的进度条）。**不补 T10 那一支，「迁移进度可观测」这件事在整刀之后零测试覆盖。**
4. **`TestApplyBudgetRatchetKeepsUnplacedOverBudgetInFails` 是反向断言**。它锁「note 只降 `budget-raised` 的档」，随 `KindUnplacedOverBudget` 一起删掉，降档分支就此裸奔。对策：改写成用 `over-budget` 做同样断言（T3 验收项）。

**负载 / 并发下会不会翻红**：无，因为整包是单进程只读纯函数，无并发路径。

**夹具里的行为假设有没有真机项对应**：有两处需要真机（§5 的 U1、U2）。

### 4-E 门禁绕过

- 本包无权限门。**写路径共三条**：`SetContract`（写 target.json）、`Absorb` / `SaveGraph`（写 baseline.json）、**新增 migrate 写 best.json**。三条都不过权限门——这是既有形态（本地只读工具 + 三个显式写命令），本刀不改变。
- 真正意义上的「门」是写前校验：
  - `contract set` 的门是 `ValidateTarget` → **T7 之后实质失效**（只剩 legacyBudget 一条），待拍板 7。
  - migrate 写 best 的门是 `ValidateBest` → 契约没要求，§2-3 C4 回写。
  - `check` 前的门是 `ValidateTarget`（既有）+ `ValidateBest`（→ C3）。
  - **同一规则的所有入口是否共享同一道门**：`Best` 有三个入口——人手写、migrate 生成、测试构造。前两个都要过 `ValidateBest` 才算共享；只在 `check` 处设门的话，migrate 能写出一份 check 会拒的文件，用户拿到的第一份 best 就是坏的。
- **TOCTOU**：`check` 依次读 target / best / baseline / decls 四份文件，之间无锁。本地单人 CLI，既有形态，本刀不新增窗口（从三份变四份，不改变性质）。

### 4-F 追加设问：枚举新值过既有白名单

三个新 kind（`container-misplaced` / `container-unplaced` / `best-dangling`）流经的**每一处** switch / 白名单：

| 白名单 | 结论 |
|---|---|
| `sortFindings`（`check.go:267`） | 按 Kind 字符串排序，**无白名单** ✓ |
| `ApplyBudgetRatchet` 的降档循环 | 只吃 `CheckBudgetRatchet` 的产物，新 kind 进不了那个循环 ✓ |
| CLI 的 `len(rep.Fails) > 0` 退出码判定 | 新 kind 全进 Warns，不影响退出码 ✓（条 30 要有测试，T4 验收） |
| **`budgetRatchetNote` 的 `finding.To == ""` 分流**（`fitness.go:154`） | **形状撞了但不串**：这个「To 为空」当作「子系统预算上涨」的形状标记，与四条新判据的「To 省略」是同一个形状。**不串的原因**是它只在 `ApplyBudgetRatchet` 里对 `CheckBudgetRatchet` 的产物调用，gap finding 永远进不去。但共用形状约定本身脆——T5 删掉子系统那一半时要把这条注释也删干净（T5 验收项） |
| `graph/webui` | grep 零命中，webui 不消费 `Report` ✓ |
| `Best.Type` 的 `logic` / `boundary` 白名单 | 与 `TargetSubsystem.Type` 同一套字面量；`ValidateTarget` 那一份随类型删除 → 白名单**从两处收敛到一处** ✓（是收敛不是分裂） |

**`TargetMeta.Version = 3` 这个新枚举值**流经的白名单：`LoadTarget`（T7 改）、`MigrateTarget` 的 switch（T8 改）、`cli.go#loadBudgetBase` 的宽松解析（**不看 version**，故 v1/v2/v3 基准都读得进；T5 后只投 `Contracts`，三个版本的 contracts 段同形 → R11 约束继续成立且更易满足，契约 §9 已记）、`TestGraphTargetVersionGate` 的 `{1,3}` 循环（T7 必改，它今天断言的正是「v3 被拒」）。

### 4-G 追加设问：序列化边界

**`Best` 从产生到消费的每一处手写序列化/投影**，逐处列文件：

| # | 位置 | 文件 | 断言 |
|---|---|---|---|
| 1 | `best.json` ↔ `LoadBest` | `graph/codegraph/best.go` | 金样本已在（`best_test.go`）+ T1 补 roundtrip 属性 |
| 2 | **migrate 写 best.json** | `graph/codegraph/migrate.go` | **第二个编码点**。缩进与换行须与 `saveMigratedTarget` 一致；`Containers` 是 map，`MarshalIndent` 对 map 按键排序 → 确定性成立 ✓（T8 的逐字节相同断言） |
| 3 | 四条新 kind 的 `Report` JSON | `check.go#Finding` | `To` 必须省略而不是 `"to":""`（T4 验收，断言从被删的测试里救回来） |
| 4 | **`--edges` 矩阵的 CLI JSON** | `graph/cli/cli.go` + `domains.go` | **全新输出形状，零既有断言** → T10 必须自带 wire 断言（键名、有序对形状、两份矩阵可区分） |
| 5 | **`DomainStat.MarshalJSON` 的自定义编码** | `graph/codegraph/domains.go:39-63` | 手写投影：私有布尔 `targetDerived` 控制两键 presence。语义换成 best 之后要有断言区分「best 缺失 → 两键不出现」与「best 存在但该领域零子系统 → `subsystems: []`」——这正是「字段缺失 vs 值为零」（§2-3 C8） |
| 6 | 跨仓另一侧：handoff 的 `best.json` 由**人手写** | 不在本仓 | 机内只能验形状；「handoff 那边读得对」是行为事实 → §5 的 U2 |

**推荐武器已采纳**：T1 的 roundtrip 属性测试一条覆盖整族缺失/零值分辨。

### 4-H 追加设问：承重安全属性有测试锁住吗

| 承重属性 | 执法者 | 状态 |
|---|---|---|
| 「20 条 `legacyBudget` 不用重标定」 | 条 48 等价性测试（T9） | **待拍板 2 未定则无执法者**。没有它，这条只在 handoff 当下数据里恰好为真 |
| `SubsystemOf` 环保护不死循环 | T1 的行为测试 | 必须能红；`ValidateBest` 拒环**不能代替**它——契约 §3-3 明写不得假设调用方跑过 validate |
| 四条判据一条都不进 Fails（条 30） | T4 的「四条同时命中」用例 | 必须同时命中，分四支各测一条则漏一条也全绿 |
| `b == nil` 不静默（条 25） | CLI 层测试 | 包内测试锁不住，必须在 `cli_test.go` |
| `--edges` 不进 Report（条 59） | T10 | 断言双向：`--edges` 输出无 `fails`/`warns`，`check` 输出无矩阵 |
| **「容器是子系统纯的」这个前提** | **无执法者** | §2-3 的 B3 —— 加告警是新判据要退回 contract。**当前状态：这是一条承重前提，靠 handoff 当下数据恰好为真，没有任何测试或判据锁着。** charter 自家夹具就已经违反它（2/3 个容器跨子系统），说明它不是结构不变式而是数据的偶然属性 |

---

## §5 未验证清单（行为事实，需真机）

| # | 结论 | 为什么不是 API 事实 | 怎么验 |
|---|---|---|---|
| **U1** | 重接后 charter 夹具仓的 `check` 输出会变（`n_runE` 从 `d_cmd` 变 `d_svc`、`m_task_ts` 从 `d_web` 变 `d_svc`、`d_web` 子系统变空、组装豁免边的 `liveDirections` 归属改变） | 归属变化可从数据推出，但**最终 Report 的条数与 kind 组合**取决于四条判据与既有判据的交互 | T2 落地后先跑一次 `codegraph check --repo graph/codegraph/testdata/repo` 记下新基线，再改断言 |
| **U2** | handoff 侧的 `best.json` 建立后，`check` 的 fail 集合与今天逐条相同（§5-4 的等价性论断在**真实报告层面**成立） | 条 48 只验归属函数相等，不验报告相等；两者之间还隔着四条判据与 `b == nil` 分支 | acceptance 阶段在 handoff 仓真机跑 `check` 前后对照 |
| **U3** | 待拍板 1 若选方案 A，初版下 `container-misplaced` 的真实条数（预期 = handoff 已归域容器数） | 依赖 handoff 当下 baseline 的容器数与归域率 | migrate 跑通后在 handoff 仓实测 |
| **U4** | migrate 双文件写在真实中断（`kill -9`）下的落盘形态 | 文件系统行为 | 手工中断复现一次，确认 §4-A 的两种失败态与预期一致 |
| **U5** | `--edges` 在 handoff 全量基线（4744 条边）上的输出规模与可读性 | §11-1 引用的 847/435 是 B223 那一刻的读数 | T10 落地后在 handoff 仓真机跑一次 |
| **U6** | 私有 v2 resolver 与被删的 `Target.SubsystemOf` **逐字等价** | 搬运时可能改写；两者不能同时存在，无法用测试交叉验证 | T7 搬运时用 `git diff` 逐行核对，并把 `TestSubsystemOf` 的四条用例原样接上 |

---

## §6 图覆盖债

charter 仓自身**无** `codegraph/`，本稿全部符号定位由 `grep` + 直读完成，非 `codegraph sym / resolve` 产出。

本稿引用的现状符号全部经 grep 核实存在：`target.go#TargetDomain` `#TargetSubsystem` `#Assignment` `#Target.SubsystemOf` `#validPathRule` `#targetPathCovers` `#targetPathsOverlap` `#cutTargetRule` `#targetPrefixRuleSuffix` `#ValidateTarget` `#LoadTarget`、`gap.go#targetDomainFindings` `#targetRuleMatchesFile` `#targetGapSampleLimit`、`check.go#Check` `#ruleHitsAny` `#sortFindings`、`fitness.go#CheckBudgetRatchet` `#ApplyBudgetRatchet` `#budgetRatchetNote` `#ratchetBudget` `#KindUnplaced` `#KindUnplacedOverBudget` `#KindDomainEmpty`、`domains.go#DomainTreeWithTarget` `#DomainStat.MarshalJSON` `#domainOfContainer`、`migrate.go#MigrateTarget` `#saveMigratedTarget` `#migrateV1Target`、`contractset.go#setContract`、`types.go#Container` `#Graph`、`best.go` 四空壳、`cli.go#graphCheckCmd` `#graphDomainsCmd` `#graphMigrateCmd` `#loadBudgetBase`。

**零命中记录**：`grep -rn "subsystems\|crossSubsystem\|unplaced\|domain-empty" graph/webui/src` —— 前端不消费本刀改动的任何字段（§1 S4 的依据）。
