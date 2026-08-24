# 拆解稿：codegraph 目标图刀（目标领域、gap 判据与棘轮）

> 卡：`C1.1`（父卡 `C1`）  
> 节点：breakdown  
> 状态：**待协调者拍板**  
> 输入：`docs/specs/2026-08-23-codegraph-target-domains-spec.md`（已批准）、`docs/contracts/2026-08-23-codegraph-target-domains-contract.md`（已冻结）  
> 本稿性质：提案；不实现代码、不生成 handoff 目标图、不建卡、不派发。

## 一、待拍板清单

1. **handoff 目标图交付是否与 charter 逻辑实现同一轮收口。**
   - 方案 A（本稿建议）：逻辑实现完成后，由协调者在 handoff 侧另开边界执行，写入 `d_controlplane` 与 `d_cli` 两棵目标领域树，再跑真机 `check`。优点是跨仓行为证据完整；代价是本卡不能仅凭 charter 测试归档。
   - 方案 B：本轮只交 charter 逻辑实现，handoff 目标图延期到下一轮。优点是本仓可独立收口；代价是 C1.1 的第一案例和 `gap` 真机证据断开，必须在 roadmap 留残余。
   - **待拍板**：两者都不改变冻结契约；选择 B 时必须把 §五真机清单 1~4 作为未完成交棒，而不是宣称 C1.1 全部完成。

2. **逻辑实现的子卡边界是否按“模型/验证 → gap → 棘轮/CLI”三段拆分。**
   - 方案 A（本稿建议）：三张逻辑子卡，文件集小、依赖清晰、每卡可独立验收。
   - 方案 B：模型/验证与 gap 合成一张，减少提交数，但会让 `target.go`、`check.go`、两套测试共同成为一张较宽的卡。
   - **待拍板**：若选择 B，仍不得把 handoff 数据或扫描配方混入逻辑卡。

3. **目标域重叠判定是否一期只做同一子系统内的字面路径集合检查。**
   - 本稿按契约 §2-1、§3-2、冻结 14 提案：是；父子系统覆盖采用两种已冻结路径规则的字面关系，不引入 glob、语义或文件系统扫描。
   - 若要扩大到子系统之间 paths 重叠，需退回 contract 另立增量；本稿不自行扩大。
   - **待拍板**：确认不把既存的跨子系统 paths 重叠缺口塞进 C1.1。

## 二、触及子系统清单与派卡资格核对

本仓没有自托管 `codegraph/target.json`，因此不存在可冒充权威的本仓 `domains` 数组。以下清单按已冻结的跨仓接缝与现有入口提出；handoff 侧目标图中的 `d_controlplane`、`d_cli` 只作为目标数据对象，不反向充当 charter 仓的现状子系统清单。

### S1：`charter-graph-codegraph`（逻辑型）

- **类型理由**：接缝对面是本仓自有 Go 代码与 CLI；`ValidateTarget`、`Check`、`CheckBudgetRatchet` 是纯函数/本地 JSON 处理，测试可闭环。`graph/cli` 是同一逻辑实现面的命令壳，不单独升格为跨仓子系统。
- **有界文件集**：`graph/codegraph/target.go`、`graph/codegraph/check.go`、`graph/codegraph/fitness.go` 及其测试 `target_test.go`、`check_test.go`、`fitness_test.go`；CLI 接线仅限 `graph/cli/cli.go`、`graph/cli/cli_test.go`。
- **契约面可枚举**：现有 `Target` JSON、`Report` JSON；包内签名 `ValidateTarget`、`Check`、`CheckBudgetRatchet` 由同一 module 消费，新增 kind 通过既有 `Finding.Kind` 承载。
- **依赖 DAG**：S1 内部为 target 模型/验证 → Check gap → 棘轮与 CLI 收口，无新增同级回调环。
- **生命周期**：不独立持有 handoff 工单、进程、临时目录；运行结束由调用 CLI 的宿主负责，故归逻辑型而非边界型。

### S2：`handoff-target-graph-data`（边界型）

- **类型理由**：接缝对面是 handoff 真仓的文件树、扫描产物与真实 `codegraph check` 运行环境；charter 机内只能验 JSON 契约形状，不能证明 61/41 文件真实归域或 gap 数字正确。
- **有界文件集（跨仓入口指针）**：handoff 侧 `codegraph/target.json` 与 `docs/codegraph-scan-recipe.md`（相对 handoff 仓根）。前者写两棵目标树，后者新增“`target.json` 的 `subsystems[].domains[]` 不是扫描产出物”的说明；目标数据范围只含 `d_controlplane`、`d_cli`，其余 8 个子系统不声明 domains。
- **契约面可枚举**：既有 `target.json` 文件接缝，新增字段为 `subsystems[].domains[]`、`unplacedBudget`、`unplacedBudgetNote`；无新网络端点、无新跨进程协议。
- **DAG 位置**：依赖 S1 的 JSON/Check 实现；交付后进入真机清单，不反向改变 S1 的算法。
- **行为边界**：所有“handoff 某路径实际命中某领域”“预算数字与真实目录人工核对一致”的结论均为**未验证，需真机**，归协调者执行。

### 派卡资格四条总核

| 子系统 | 有界文件集 | 契约面可枚举 | 依赖可排 DAG | 类型标注 | 结论 |
|---|---|---|---|---|---|
| S1 `charter-graph-codegraph` | 通过，上列 8 个 Go 入口文件集 | 通过，Target/Report 与既有包签名 | 通过，模型→gap→棘轮/CLI | 逻辑型 | 具备派卡资格 |
| S2 `handoff-target-graph-data` | 通过，`codegraph/target.json` + `docs/codegraph-scan-recipe.md`；charter 不代写 | 通过，既有 target.json 接缝 | 通过，S1→真机数据核对 | 边界型 | 具备边界验收资格；不得用机内测试代替 |

## 三、契约增量核对

### 上游状态核对

- spec 头部为“已批准（2026-08-23，用户批准：开吧）”，状态位有效。
- contract 头部为“已冻结（2026-08-23，随本提交）”，状态位有效。
- contract HEAD 为 `a005fc2`；其中 Ticket 0 已落 `TargetDomain`、三个子系统字段、三个 finding kind 与 JSON 金样本，未实现 gap 行为。本文不把空壳当实现。
- 本稿不发现新跨仓接缝：所有新增字段仍在既有 `target.json` 中，报告仍复用既有 `Report` JSON；因此不退回 contract。
- 本节点做出的边界澄清已回写 contract §7：S1 的包内 API 不构成新跨子系统缝；预算 note 与实际 over-budget 的档位分离；handoff 数据是既有 target.json 接缝上的边界消费者。

### 冻结清单逐条对账

| 冻结项 | 本稿承接子卡 | 逐条结论 |
|---:|---|---|
| 1 | C1.1-V | `TargetDomain` 字段维持 `ID`、`Name`、`Responsibility`、`Paths`，不增字段。 |
| 2 | C1.1-V | JSON 键维持 `id`、`name`、`responsibility`、`paths`。 |
| 3 | C1.1-V | `TargetSubsystem.Domains` 维持 `[]TargetDomain` + `omitempty`。 |
| 4 | C1.1-V | `UnplacedBudget` 维持 `int` + `omitempty`。 |
| 5 | C1.1-V | `UnplacedBudgetNote` 维持 `string` + `omitempty`。 |
| 6 | C1.1-V | 目标域只靠嵌套归属，不新增 `subsystem` 外键。 |
| 7 | C1.1-V | 不新增 `parent`，目标域一期平铺。 |
| 8 | C1.1-V | `meta.version` 仍为 2，既有拒载文案不改。 |
| 9 | C1.1-G | 缺失/空 domains 的子系统整体跳过目标域执法。 |
| 10 | C1.1-V | 全 target 文档目标域 id 重复必须返回 ValidateTarget 问题。 |
| 11 | C1.1-V | responsibility 为空必须返回问题。 |
| 12 | C1.1-V | 复用精确路径或 `dir/**`，非法 wildcard 必须拒绝。 |
| 13 | C1.1-V | 目标域 paths 必须被父子系统 paths 覆盖。 |
| 14 | C1.1-V | 只拒绝同一子系统内目标域 paths 重叠；不扩展到既存跨子系统重叠。 |
| 15 | C1.1-V | `UnplacedBudget < 0` 必须返回问题。 |
| 16 | C1.1-G | `Check(t *Target, v *View) *Report` 签名不变。 |
| 17 | C1.1-G | unplaced 只使用非 deleted 视图节点文件去重集合。 |
| 18 | C1.1-G | 只计入当前子系统归属且未命中其目标域 paths 的文件。 |
| 19 | C1.1-G | `n <= budget` 时按子系统聚合一条 warn `unplaced`。 |
| 20 | C1.1-G | `n > budget` 时按子系统聚合一条 fail `unplaced-over-budget`。 |
| 21 | C1.1-G | 每个零命中目标域产生一条 warn `domain-empty`。 |
| 22 | C1.1-G | 不按未落位文件逐条刷 finding。 |
| 23 | C1.1-G | gap finding 的 From 为子系统 id，To 省略。 |
| 24 | C1.1-G | unplaced 两类 Detail 带 n/budget 与字典序样例，样例不制造额外 finding。 |
| 25 | C1.1-G | domain-empty Detail 带目标域 id。 |
| 26 | C1.1-R | `CheckBudgetRatchet(cur, base *Target) []Finding` 签名不变。 |
| 27 | C1.1-R | 同时比较 contract legacyBudget 与声明 domains 子系统的 unplacedBudget。 |
| 28 | C1.1-R | 基准缺席的契约/子系统预算按 0 比较。 |
| 29 | C1.1-R | 仅 current > base 产出 budget-raised；相等/下降不产出。 |
| 30 | C1.1-R | 目标域预算上涨 From 为子系统 id，To 省略。 |
| 31 | C1.1-R | note 用当前 target，TrimSpace 后非空才降为 warn。 |
| 32 | C1.1-R | budget-raised 分档不得改变 unplaced-over-budget 的 fail。 |
| 33 | C1.1-R | 不新增 gap 子命令，不把归属算法复制到 CLI。 |
| 34 | C1.1-R | 所有 finding（含棘轮）进入报告后再统一排序。 |
| 35 | C1.1-R | graph/codegraph 仍 stdlib-only、无网络端点。 |
| 36 | C1.1-H | handoff 只写批准后的 d_controlplane/d_cli；charter 不伪造跨仓数据。 |
| 37 | C1.1-V | JSON 金样本锁字段顺序、键名、omitempty 与回读结构。 |

结论：本稿无新增契约面，不退回 contract；新增的三条边界澄清已落 contract §7。若协调者要改变目标域命名、引入 baseline 映射、增加领域级契约字段或扩展跨子系统 paths 重叠检查，均超出本稿，必须先回 contract。

## 四、子卡清单与依赖 DAG

### 依赖 DAG

```text
 C1.1-V 目标模型与结构门 ──→ C1.1-G gap Check ──→ C1.1-R 棘轮/排序/CLI
        └──────────────────────────────→ C1.1-H handoff 目标图与配方说明
 C1.1-R + C1.1-H ──→ C1.1-M 真机 check 与人工目录核对（协调者）
```

`C1.1-H` 可在 `C1.1-V` 通过后准备数据，但其行为验收必须等待 `C1.1-R` 与 handoff 真仓视图就绪。`C1.1-M` 是协调者真机门，不是派给当前 executor 的实现子卡。

### C1.1-V【S1·逻辑型】目标模型与结构门

① **契约引用**

- contract §2-1、§3-2、§4 冻结 1~15、37；既有 `TargetDomain`/`TargetSubsystem` Ticket 0 形状。
- 约束：版本门、字段名与 omitempty 不变；`ValidateTarget` 只读 target，不读 baseline、View 或文件系统。

② **意图与为什么**

把目标领域的结构不变式集中在 target 入口，避免 gap 判据接收一棵已经越界、重叠或预算为负的目标树。目标域嵌套关系本身承担唯一归属，不增加外键；路径规则沿用已有 target 规则，保证迁移完成后目录位置仍是唯一事实。

③ **验收**

- 运行 `cd graph && go test ./codegraph -run 'TestTargetDomainJSONGolden|TestValidateTarget' -count=1` 返回 PASS；金样本逐字段断言新增键、顺序、omitempty、回读结构。
- 运行新增的 ValidateTarget 表驱动测试，分别传入重复目标域 id、空 responsibility、非法 wildcard、未被父 paths 覆盖的路径、同级重叠路径、负 unplacedBudget；每项返回包含目标位置与原因的 issue。
- 运行兼容用例：缺失 domains 的旧 target 经过 `LoadTarget` 后可用，且后续 `Check` 不产生目标域 finding；`meta.version != 2` 仍返回原拒载文案。
- 生命周期/状态机中断：无，因为本卡只校验内存 target；宿主重启不会留下进程、工单或临时目录，文件读取错误由 `LoadTarget` 显式向上返回。
- 静默失败/误导报错：无，因为目标图缺失、JSON 解析失败、版本错误仍是显式错误；每个新增结构问题包含子系统/目标域/path 与原因，不允许把非法目标图当成“无 gap”。
- 跨平台假设：无新增，因为路径是仓内 `/` 形态并沿用字符串规则；不使用宿主 `filepath` 做归域。Windows/Unix 的文件系统分隔符差异不改变 wire 字符串。
- 假红/假绿测试：反面断言覆盖“旧 target 不触发目标域执法”、同级路径重叠与跨子系统重叠不混淆；JSON roundtrip 通过真实 `encoding/json` 边界。夹具无法证明 handoff 实际目录，见 §五「未验证，需真机」。
- 门禁绕过：无写路径、无执行路径、无权限检查入口；`ValidateTarget` 在 CLI `Check` 前执行，结构非法不能绕过到 gap 计算。无 TOCTOU，因为本卡不读外部文件集。
- 序列化边界：`TargetDomain`、三个 `TargetSubsystem` 新字段和既有 `Target` 是唯一手写/声明投影；`TestTargetDomainJSONGolden` 必须同时断言字段缺失与零值（空 domains、预算 0 不输出），并回读区分缺失和零值可用性。
- 枚举新值过既有白名单：本卡不新增状态/事件枚举；`domains` 是 JSON 字段，`logic/boundary` 仍使用既有校验器。若实现引入新的 finding kind，不得在本卡接线，归 C1.1-G 并核对所有 kind 消费方。
- 承重安全属性：目标域 id 全局唯一、路径子集、同级隔离和非负预算各有能变红的 ValidateTarget 测试；无 token/一次性安全属性，因为本卡不处理 token。

④ **入口指针（有界文件集）**

- `graph/codegraph/target.go#TargetDomain`
- `graph/codegraph/target.go#TargetSubsystem`
- `graph/codegraph/target.go#ValidateTarget`
- `graph/codegraph/target.go#validPathRule`
- `graph/codegraph/target_test.go#TestTargetDomainJSONGolden`
- `graph/codegraph/target_test.go#TestValidateTarget`

### C1.1-G【S1·逻辑型】gap 判据接入 Check

① **契约引用**

- contract §3-1、§4 冻结 9、16~25；`KindUnplaced`、`KindUnplacedOverBudget`、`KindDomainEmpty` 现有 Ticket 0 常量。
- `Check` 签名、View 非 deleted 文件口径、Report/Finding 形状全部冻结，不增顶层字段。

② **意图与为什么**

让目标图成为可重复的迁移体温计：只统计属于已声明目标域子系统、但未命中其任一目标域路径的唯一文件，按子系统聚合；目标域零命中作为 warn 指示尚未开工。未声明 domains 的子系统跳过，保持渐进铺开而不是一轮把全仓变红。

③ **验收**

- 运行 `cd graph && go test ./codegraph -run 'TestCheck.*(Unplaced|DomainEmpty|Gap|Deleted|Sort)' -count=1` 返回 PASS；若测试命名不同，必须逐项执行等价表驱动测试并保留原文输出。
- 表驱动输入覆盖：预算内产生一条 warn `unplaced`；超预算产生一条 fail `unplaced-over-budget`；零命中目标域产生 `domain-empty` warn；未声明 domains 整体无目标域 finding；deleted 节点不计数；同一文件多个节点只计一次；diff 视图把文件移入目标路径后 n 下降。
- 反面断言：图外文件不计入 unplaced；属于另一子系统的文件不计入当前子系统；目标域命中不产生 unplaced；同一子系统多目标域命中不产生 domain-empty；一组 61 个文件只产生一条聚合 finding，不产生 61 条 finding。
- Detail 独立可验：`unplaced` 两类包含 `n/budget` 与按 `/` 路径字典序的样例，`domain-empty` 包含目标域 id，From 为子系统 id、To 为空。
- 运行 `cd graph && go test ./codegraph -run TestCheck -count=1` 返回 PASS，并确认既有契约 finding、dead-rule、outside-file、fitness finding 的档位未被 gap 接线改写；所有 findings 进入后由同一排序函数排序。
- 生命周期/状态机中断：无，因为 `Check` 是纯函数，只读内存 View，不创建进程/工单/临时目录；宿主重启只会丢弃本次报告，不会留下待回收资源。若 CLI 读取基线中断，归 C1.1-R 的显式错误/跳过路径。
- 静默失败/误导报错：无，因为 `Check` 返回 finding 而非吞错；零文件时不报 unplaced 是合法 n=0，不得把“未声明 domains”伪装成“已全部落位”。Detail 必须让用户区分未落位数量、预算与空目标域。
- 跨平台假设：无新增，因为 View 文件路径按仓内 `/` 处理，算法不访问宿主目录；夹具不代表 Windows checkout 或 symlink 行为，真实扫描路径仍列入真机清单。
- 假红/假绿测试：测试必须断言反面（另一子系统、图外、deleted、重复节点、零命中），不能只看 finding 数；diff 迁移下降用真实 `Merge` 后 View 作为输入。负载/并发不改变纯函数结果，但 handoff 真实扫描并发一致性未验证，需真机。
- 门禁绕过：无写/执行路径；所有目标域 finding 从同一 `Check` 入口产生，不能由 CLI 另造 gap 算法绕过。ValidateTarget 结构门与 Check 行为门分层，检查/动作之间没有修改动作，故无 TOCTOU。
- 序列化边界：gap finding 只通过既有 `Finding`/`Report` JSON 出口；新增 kind 必须穿过 `Report.Fails`/`Warns` 的真实 JSON 回归测试，区分 `unplaced` 与 `unplaced-over-budget`，不能仅测内部 struct。
- 枚举新值过既有白名单：登记并搜索 `KindUnplaced`、`KindUnplacedOverBudget`、`KindDomainEmpty` 的生产发出、排序、JSON 测试和后续查看器消费；当前 CLI 不应 switch 丢弃未知 kind，查看器按字符串透传。若发现既有白名单，必须在同卡补登记测试。
- 承重安全属性：按子系统聚合、deleted 排除、文件去重、预算分档和 From/To 形状各有能变红测试；隔离属性体现为“错误子系统文件不计入”，须保留一支专门的反向测试。

④ **入口指针（有界文件集）**

- `graph/codegraph/check.go#Check`
- `graph/codegraph/check.go#sortFindings`
- `graph/codegraph/fitness.go#viewFiles`
- `graph/codegraph/fitness.go#KindUnplaced`
- `graph/codegraph/fitness.go#KindUnplacedOverBudget`
- `graph/codegraph/fitness.go#KindDomainEmpty`
- `graph/codegraph/check_test.go`
- `graph/codegraph/fitness_test.go`

### C1.1-R【S1·逻辑型】预算棘轮、降档与统一排序

① **契约引用**

- contract §3-3、§3-4、§4 冻结 26~35；既有 `CheckBudgetRatchet`、`KindBudgetRaised`、CLI `loadBudgetBase`/`appendBudgetRatchet`。
- 预算 note 分档下沉到 codegraph 纯函数；CLI 只保留 git merge-base/show 取数和结果输出；不新增命令、不新增第三方依赖。

② **意图与为什么**

让契约预算与目标域预算共享同一只减不增的棘轮，并修复所有 finding 统一排序的确定性窗口。理由 note 只解释预算上涨，不会把实际 gap 超预算降档；基准取数失败要向 stderr 明示跳过，避免 stdout JSON 看似成功而用户不知道棘轮未运行。

③ **验收**

- 运行 `cd graph && go test ./codegraph ./cli -run 'Test.*(BudgetRatchet|Sort|Check)' -count=1` 返回 PASS；并运行 `go build ./...` 返回成功。
- 纯函数测试覆盖：base nil 返回 nil；contract/目标域预算 2→3 报一条 `budget-raised`；基准缺席按 0；相等/下降不报；目标域预算 From=子系统 id 且 To 为空；契约预算仍沿用 From/To；当前 target note 取值而不是 base note。
- 分档测试通过真实 CLI：非空 note 进 Warns，`strings.TrimSpace` 后为空进 Fails；同一报告中 `unplaced-over-budget` 仍留 Fails；所有 findings（含棘轮）追加后再次统一排序，重复运行 JSON 字节序稳定。
- 基准读取测试覆盖显式 `--base` 优先、默认分支探测顺序、子目录 `rev-parse --show-prefix`、基准 schema v1 宽松解析只取 Contracts；非 git/基准不可得时 stderr 含“棘轮/跳过”，stdout 可独立 `json.Unmarshal`，不得报成功而无提示。
- 生命周期/状态机中断：git show/merge-base 中途宿主重启只留下无持久写入的子进程/管道，由 CLI 的 `exec.Command` 等待返回并释放；验收须在命令失败时确认没有临时 target 文件、工单或后台进程。handoff executor 工单回收归协调者，不由此卡实现。
- 静默失败/误导报错：基准不可得不能把“未执行棘轮”当成“棘轮通过”；stderr 明示跳过且既有 Check 报告仍输出。基准 JSON 解析失败携带 revision/path 上下文；git 非零退出不吞掉。
- 跨平台假设：git 命令、revision、路径前缀和 stderr 断言需使用平台无关的参数拼接，不假设 `/bin/sh`、默认分支仅为 main 或 Unix 路径；真实 Windows/macOS/Linux git 行为列入协调者真机清单。codegraph 包不得引入 OS 特定依赖。
- 假红/假绿测试：CLI 测试必须断言 stdout 可解析 JSON、stderr 与退出码分离，并以条件永假化方式变异 `>`/TrimSpace/排序后再次排序使测试变红；不能只断言 finding 存在。多 finding 的 From/To/Edge 全相同撞键场景需锁全序，避免旧测试因 Edge 偶然不同而假绿。
- 门禁绕过：只有 `graph check` 既有入口能追加棘轮，CLI 不提供旁路 gap 命令；`loadBudgetBase` 只读 git，不写工作树。预算 note 只由当前 target 读取，不能通过基准或 CLI flag 临时降档；无并发写入，TOCTOU 不适用。
- 序列化边界：`Report` 中 Fails/Warns 的 `budget-raised`、`unplaced-over-budget` JSON 输出必须有 CLI 端到端断言；`unplacedBudgetNote` 缺失、空串、纯空白与非空值须能区分。基准 JSON 的手写宽松投影只取 Contracts，必须有 v1 回归测试，不能靠两端各自单测。
- 枚举新值过既有白名单：`budget-raised` 复用既有 kind；三种 gap kind 由 C1.1-G 登记。检查 CLI/查看器/排序是否存在按 kind 的白名单或 switch，未知 kind 不得被静默丢弃；新增 kind 的消费方若不在本仓，交给 handoff 真机验证。
- 承重安全属性：预算只减不增、基准缺席按 0、理由降档与实际超预算 fail 隔离、排序全序各有可变红测试；无 token/唯一性安全属性，因为本卡只做只读预算比较。变异删除 `TrimSpace`、目标域预算分支或末尾重排必须让对应测试失败。

④ **入口指针（有界文件集）**

- `graph/codegraph/fitness.go#CheckBudgetRatchet`
- `graph/codegraph/check.go#sortFindings`
- `graph/cli/cli.go#graphCheckCmd`
- `graph/cli/cli.go#appendBudgetRatchet`
- `graph/cli/cli.go#loadBudgetBase`
- `graph/cli/cli_test.go`
- `graph/codegraph/fitness_test.go`

### C1.1-H【S2·边界型】handoff 第一案例目标图与配方说明

① **契约引用**

- contract §2-1、§4 冻结 36、§6 欠账声明；spec “handoff 作为第一个案例”与扫描配方交付物。
- 仅写用户批准后的 `d_controlplane`、`d_cli` 目标领域树；charter 仓不创建 handoff target 数据，不把 AI 草稿当冻结事实。

② **意图与为什么**

把已批准的终态蓝图落到真正消费它的 handoff 仓，给 C1.1-G 的 gap 判据提供第一份真实输入。配方文档必须明确 domains 是人/AI 出稿并经用户拍板的 target 数据，不是扫描器“顺手补全”的现状产物，避免夹具制造假目标。

③ **验收**

- 在 handoff 真仓运行 `codegraph validate --repo <handoff-repo>` 返回 0，并运行 `jq -e '[.subsystems[] | select((.domains // []) | length > 0) | .id] | sort == ["d_cli","d_controlplane"]' <handoff-repo>/codegraph/target.json` 返回 `true`；确认 `meta.version` 仍为 2。此条**未验证，需真机**，归协调者执行。
- 人工逐项审阅两棵树的 domain id、职责和 paths；确认每条 domain path 被所属 subsystem paths 覆盖、同级 paths 不重叠、目标域责任非空、预算为非负。此条**未验证，需真机**，归协调者执行。
- 运行 `rg -n 'domains.*扫描产出物|domains.*不是扫描' <handoff-repo>/docs/codegraph-scan-recipe.md` 返回至少一行，再运行真实扫描流程并对比 `codegraph/target.json` 的 domains 段未被改写；这是跨进程行为，**未验证，需真机**，归协调者执行。
- 运行 handoff 真仓 `check`，记录 `unplaced`、`unplaced-over-budget`、`domain-empty`、`budget-raised` 的完整 JSON，并与人工统计 `internal/agentd` 61 文件、`cmd` 41 文件及目标路径命中数逐项核对。所有数字与档位均**未验证，需真机**，归协调者执行。
- 生命周期/状态机中断：target 文件写入不是运行时工单；若协调者/工具进程中断，必须确认只留下可回滚的 git 工作树变更，无 handoff executor、临时目录或孤儿工单。归协调者按 handoff CLI 状态机收尾。
- 静默失败/误导报错：目标文件缺失、JSON 错误、paths 越界必须显式失败；真实 `check` 若基准不可得或 domains 缺失必须报告跳过/未声明，而不能把零 finding 解释为迁移完成。**未验证，需真机**。
- 跨平台假设：handoff 路径、Windows checkout、权限与扫描器运行环境可能改变文件集合；不能用 charter Linux 夹具推断真实域归属。**未验证，需真机**，至少在协调者指定真机环境跑一次。
- 假红/假绿测试：目标树静态 JSON 通过不证明 61/41 文件已落位；必须以真仓 `check` 输出和人工文件清单双重断言，并记录负例（故意把一个文件移出目标域时 unplaced 增长，恢复后下降）。**未验证，需真机**。
- 门禁绕过：只有用户批准的 target 数据才能冻结；扫描器不得写 domains，任何调高预算必须带 note 且实际超预算仍 fail。协调者需审阅 git diff，确认没有第二入口或生成脚本绕过 `ValidateTarget`/`Check`；并发写入/TOCTOU **未验证，需真机**。
- 序列化边界：真实 handoff `target.json` 是 charter Go `Target` 的跨仓 wire 边界；至少做一次 encode/decode 或加载实跑，区分 domains 缺失、空数组、预算 0 与非零值。配方文档是另一文本消费面，需 grep/扫描回归，不能只测 charter roundtrip。
- 枚举新值过既有白名单：handoff 的查看器/扫描器/校验器若按 finding kind、type 或域字段 switch，逐处确认 `unplaced`、`unplaced-over-budget`、`domain-empty` 与 `logic/boundary` 不被挡掉；具体行为**未验证，需真机**。
- 承重安全属性：目标域唯一归属、同级隔离、预算棘轮只减不增和“扫描器不写目标段”必须各有可变红的真机/脚本断言；当前 charter 测试不能替代 handoff 行为证据。

④ **入口指针（边界文件集）**

- handoff 仓 `codegraph/target.json`（当前 charter 工作树不可见，不伪造路径内容）
- handoff 仓 `docs/codegraph-scan-recipe.md`（当前 charter 工作树不可见，不伪造文件内容）
- handoff 真仓 `check` 命令与其输出 JSON（仅作验收入口，不在本仓编辑）

## 五、真机清单（未验证，需真机；归协调者执行）

1. 在 handoff 真仓加载实际 `codegraph/target.json`，确认 `meta.version=2`、仅 `d_controlplane`/`d_cli` 声明 domains，旧 target 其余子系统不误触发目标域执法。
2. 用 handoff 真实视图运行 `check`，记录所有 gap finding 的 kind、From、To、Detail、Fails/Warns 档位；不能用 charter fixture 代替。
3. 将 `unplaced` 计数、样例路径、`domain-empty` 目标域与人工 `internal/agentd`/`cmd` 文件清单逐项核对；至少做一次“移动文件→n 下降、移回→n 恢复”的反面验证。
4. 检查目标图 paths 的父子集、同级不重叠和预算 note；故意提高预算无 note 应使 `budget-raised` 进 Fails，补非空 note 仅降为 Warns，实际 over-budget 仍为 Fails。
5. 在真实扫描配方执行一次，确认扫描器不生产、不修改 `subsystems[].domains[]`，并记录其失败/跳过信息是否可行动。
6. 在协调者指定的至少一个非 Linux 或不同 checkout 环境复跑路径归属/JSON 读取，确认仓内 `/` 路径与 CLI 输出不因平台分隔符改变。
7. 检查宿主/协调者中断后的 handoff 状态：无孤儿 executor、工单、临时目录；若是 handoff CLI 任务，按 show → done/stop 状态机收尾，不手删目录。
8. 重复真实 `check` 至少三次，对输出做字节级 hash/diff，确认包含 budget-raised 的报告顺序稳定；同时验证 stdout 纯 JSON、stderr 只承载跳过/诊断。

## 六、跨卡缺陷族对抗审查汇总

本节把各卡验收栏中的答案再集中列出，便于协调者检查没有漏族。结论中凡依赖真实 handoff 行为均明确标注“未验证，需真机”。

| 缺陷族 | S1 逻辑型结论 | S2 边界型结论 |
|---|---|---|
| 生命周期 / 状态机中断 | 无，因为 S1 纯函数/本地 CLI 不持有工单或临时目录；git 子进程失败由 CLI 回收并返回。 | 未验证，需真机：确认 handoff 协调者/扫描器中断不留 executor、工单、临时目录；按 handoff 状态机回收。 |
| 静默失败 / 误导报错 | 无，因为 Load/Validate/Check/基准读取分别有显式错误、finding 或 stderr 跳过信号，stdout JSON 不冒充棘轮已执行。 | 未验证，需真机：确认 target 缺失、扫描跳过、真实 check 失败都给出可行动信息，不把零 finding 解释成已迁移。 |
| 跨平台假设 | 无新增，因为算法只处理仓内 `/` 字符串且 codegraph 不读宿主文件系统；CLI git 探测的跨平台行为仍需真机。 | 未验证，需真机：确认真实 checkout、权限、扫描器与非 Linux 路径不会改变归域或输出语义。 |
| 假红 / 假绿测试 | 无，因为测试含负面断言、真实 JSON 边界、deleted/重复/错误子系统场景和保编译变异；夹具世界以真机清单隔离。 | 未验证，需真机：静态 JSON/夹具绿不等于 handoff 文件已落位，须真实 check、人工清单和重复输出复核。 |
| 门禁绕过 | 无，因为新增判据只从既有 Check/ValidateTarget 入口产生，无写/执行旁路，无并发动作窗口。 | 未验证，需真机：确认只有用户批准目标图可冻结、扫描器不能写 domains、预算 note 不能压低实际 over-budget fail，且没有第二入口。 |
| 序列化边界 | 有，因为 Target/Report roundtrip 和 CLI 端到端测试穿过真实 JSON，区分缺失与零值；基准 v1 投影只取 Contracts。 | 未验证，需真机：charter Go ↔ handoff target.json、配方文本与查看器/扫描器消费链需各穿一次真实边界。 |
| 枚举新值过既有白名单 | 有，因为三种新 kind 在生产发出、排序、JSON 和消费点逐处登记，不能只测两侧。 | 未验证，需真机：确认 handoff 查看器/扫描器/校验器没有 switch/白名单挡掉新 kind 或域类型。 |
| 承重安全属性有测试锁住 | 有，因为唯一性、路径覆盖、隔离、预算单调性、档位隔离、全序和 deleted 排除均要求能变红的测试；无 token 属性，因为范围不命中。 | 未验证，需真机：目标域唯一归属、扫描器只读 domains、预算棘轮及真实 gap 下降必须有变红的现场断言。 |

## 七、出稿自检

- [x] 触及子系统清单已带逻辑型/边界型，且逐项核过派卡资格四条。
- [x] 契约状态位已核对；37 项冻结物逐条给出子卡归属与不越界结论。
- [x] 新边界澄清已回写 contract §7；未发现新接缝，未把新接缝混入拆解。
- [x] 子卡均含契约引用、意图与为什么、行为化验收、入口指针；每张有界文件集已列明，handoff 配方路径按 roadmap 已知路径固定。
- [x] 缺陷族通用五族、序列化边界、枚举白名单、承重安全属性均逐族回答；不适用处写明“无，因为……”。
- [x] 待拍板岔口集中在稿首。
- [x] 所有机内无法证明的 handoff 行为均汇总为“未验证，需真机”，并归协调者执行。
- [x] 未写实现代码、未建卡、未派发。
