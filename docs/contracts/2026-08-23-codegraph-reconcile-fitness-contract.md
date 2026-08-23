# 契约：codegraph 刀 3+4（漏建对账 + fitness 判据）

> 状态：**已冻结**（2026-08-23，随本提交）
> 上游：`docs/specs/2026-08-23-codegraph-reconcile-fitness-spec.md`（已批准 2026-08-23）
> 起点版本：`graph/v0.3.0`；本增量全部 additive，无既有语义变更
> 冻结物形态：charter/graph 仓自身无代码图，**本文档即冻结物**（存量无图项目口径），review 节点按 §4 逐条对账

## §1 漏建对账（刀 3）

### 1-1 三类 finding（fail 侧），kind 为 wire 值

| kind | 判定 | 判据对象 |
|---|---|---|
| `dead-entry` | 某契约 `entries` 里的某条容器 label 在视图容器集中不存在 | `View.Containers[*].Label`（出处 `graph/codegraph/merge.go#View`，字段 `Containers map[string]Container`） |
| `dead-interface` | 某契约 `interfaces` 里的某条接口名在视图节点名集中不存在 | `View.Nodes[*].Name` |
| `dead-contract` | 某声明的契约方向零实际跨子系统边 | 与既有 `new-direction` 同一遍边扫描的统计结果 |

**判定对象取自视图**（`Merge` 后），与既有 check 判据同源，不另读 baseline。出处：`graph/codegraph/check.go#Check` 签名 `func Check(t *Target, v *View) *Report`。

**匹配语义逐字对齐既有实现**：`entries` 比的是被调方**容器的 Label**，不是节点 id、不是节点名——出处 `check.go#Check` 中 `label = v.Containers[callee.Container].Label` 后 `inList(c.Entries, label)`；`interfaces` 比的是**接口节点的 Name**，出处同函数 `ifaceName = n.Name` 后 `inList(c.Interfaces, ifaceName)`。对账判据必须复用同一取值口径，否则「对账过了但 check 仍判违规」。

### 1-2 不重复造的部分

子系统漏建（`paths` 规则未命中任何节点）已由既有 `dead-rule` warn 覆盖（出处 `check.go#Check`），本刀不新增、不改其档位。

### 1-3 现状读数（2026-08-23 实测，implement 阶段须对当轮工作树复核）

handoff 真仓：`entries` 0/26 落空、`interfaces` 0/0 落空、`dead-contract` 0/23。**三类新 fail 上线后 handoff 契约闸仍为 0 fails**——这是本刀「零噪声上线」的可验证断言，落 §4 冻结清单第 4 条。

## §2 fitness 判据（刀 4）

### 2-1 三类 finding

| kind | 档位 | 判定 |
|---|---|---|
| `prefix-family` | warn | 同一目录内、文件名共享**前 4 字符**且成员 **≥5** 个源文件 |
| `oversized-package` | warn | 单目录源文件 **≥40** 且无子目录出现在图文件集中 |
| `budget-raised` | fail／warn | 某契约 `legacyBudget` 相对基准 target 上涨 |

前两条取 warn 档的依据是架构法第三条原文「命中判据不等于必须拆，但必须回答；沉默即违法」——它要求的是回答，不是修复（出处 `~/.claude/skills/charter/skills/architecture-law/SKILL.md` 第三条）。

**阈值写死为不可配置常量**：`prefixFamilyMinShared=4`、`prefixFamilyMinMembers=5`、`oversizedPackageFiles=40`（已落 `graph/codegraph/fitness.go`，随本提交冻结）。

**报文要求**：`prefix-family` 的 Detail 必须给出该组**真实最长公共前缀**，不得只回显 4 字符截断值。

### 2-2 棘轮的降档语义

`budget-raised` 缺省进 Fails；当该契约的 `LegacyBudgetNote` 非空时改进 Warns。分流由**调用方**执行（`CheckBudgetRatchet` 只产出 findings，不判档，见 §3-1）。它只影响本条判据，**不影响 `over-budget`（实际 > 预算）的既有执法**——两者互不替代。

新增字段（已落 `graph/codegraph/target.go#Contract`，随本提交冻结）：

```go
LegacyBudgetNote string `json:"legacyBudgetNote,omitempty"`
```

**向后兼容已查实**：`LoadTarget` 用非严格 `json.Unmarshal`（出处 `target.go#LoadTarget`，无 `DisallowUnknownFields`），故新字段对旧二进制是静默忽略、对旧 target 是零值——双向 additive，不需要 schema version 升级。

### 2-3 判据 1/2 的文件集口径（局限须明写）

判据 1/2 统计的是**视图文件集**（`View.Nodes[*].File` 去重），不是文件系统实际内容。后果：图未覆盖的文件不计入，一个 45 文件的包若只有 20 个进图则不触发。这是为保住 `Check` 的纯函数性（不读 fs、不需 repo root）付出的代价，见 §5 拍板记录三。

## §3 接缝与依赖方向

### 3-1 `Check` 签名不变，棘轮走独立纯函数

```go
func Check(t *Target, v *View) *Report                    // 签名不变（既有，出处 check.go:37）
func CheckBudgetRatchet(cur, base *Target) []Finding      // 新增（已落 fitness.go，随本提交冻结）
```

- **`Check` 的签名是跨仓契约面**：handoff 的 `cmd/graph_gate_test.go#TestRepoContractGate` 直接调 `codegraph.Check(tg, codegraph.Merge(g, nil))` 两参（本轮实读）。改签名 = 破坏跨仓消费方，且**本仓测试不会有任何一支变红**。
- 因此漏建三类与 fitness 判据 1/2 落在 `Check` 内（零参数变更，handoff 契约闸自动获得新执法）；棘轮因需要基准 target，走独立函数。
- **依赖方向不变式：`codegraph` 包不得直接调 git 或读文件系统取基准。**基准 target 由 CLI 层取出后注入。既有 git 调用只在 `graph/cli/cli.go#gitHead`、`#gitBranch`（本轮实读），本刀不把它下沉。

### 3-2 基准取值与降级（CLI 层语义）

- 基准 = 本分支相对**主线**，缺省取与默认分支的 merge-base，可显式指定；与 `charter:recon` 的 BASE 语义一致，不另立一套。
- 取不到基准（无 git / 未 fetch 主线 / detached HEAD / 首次提交）时，`CheckBudgetRatchet` 收到 `base == nil` 返回 nil，**CLI 必须明示提示该判据已跳过**。静默跳过是被禁的——「判据失效」与「判据通过」不可区分正是本条存在的理由。

### 3-3 顺带了结项

修 `check.go#sortFindings` 比较器：现只按 `Kind`+`Detail`，`slices.SortFunc` 不稳定，撞键即排序抖动（roadmap 第 5 条）。补 `From`/`To`/`Edge` 作为 tiebreak，使输出全序确定。

## §4 冻结清单（逐条可独立判 pass/fail）

1. `dead-entry` 判定：`entries` 条目取值口径 = 视图容器 Label，与 `check.go` 既有 `inList(c.Entries, label)` 逐字一致。
2. `dead-interface` 判定：`interfaces` 条目取值口径 = 视图节点 Name，与既有 `inList(c.Interfaces, ifaceName)` 逐字一致。
3. `dead-contract` 判定：声明方向零实际跨子系统边即命中；deleted 状态的节点/边不参与（与既有 check 同）。
4. 三类新 fail 对 handoff 真仓的实测结果为 **0 条**（零噪声上线断言）。
5. 三类漏建 finding 全部进 `Report.Fails`。
6. 既有 `dead-rule` 的 warn 档位不变、语义不变。
7. `prefix-family` 判定：同目录、共享前 4 字符、成员 ≥5。
8. `prefix-family` 的 Detail 含该组真实最长公共前缀。
9. `oversized-package` 判定：单目录源文件 ≥40 且图文件集中无更深层目录。
10. 判据 1/2 全部进 `Report.Warns`。
11. 判据 1/2 的统计输入为视图文件集，不读文件系统。
12. 三个阈值为包内不可配置常量，不出现在任何 JSON schema 中。
13. `Check` 的签名保持 `func Check(t *Target, v *View) *Report` 不变。
14. `CheckBudgetRatchet(cur, base *Target) []Finding` 在 `base == nil` 时返回 nil。
15. `codegraph` 包内零 `os/exec`、零 git 调用、零基准文件读取。
16. `budget-raised` 在对应契约 `LegacyBudgetNote` 为空时进 Fails、非空时进 Warns。
17. `over-budget`（实际 > 预算）的既有判定与档位不变。
18. `Contract.LegacyBudgetNote` 的 JSON 键为 `legacyBudgetNote` 且 `omitempty`。
19. 旧 target（无该字段）经 `LoadTarget` 读入后该字段为零值，不报错。
20. CLI 在基准不可得时输出明示提示，不静默跳过。
21. `sortFindings` 补 From/To/Edge tiebreak 后，同输入两次运行输出逐字节一致。
22. 六个新 kind 字符串与既有七个不冲突、不复用。

## §5 拍板记录（三重闸门）

**一、`Check` 签名冻结不动，棘轮另开函数。**
难逆转：签名是跨仓消费面，改了要协调 handoff 版本升级（刀 1+2 的 T4 就是这个代价）。会惊讶：后人看到「棘轮为什么不在 Check 里」会想顺手合并进去。真取舍：被否方案是 `Check(t, v, base)` 三参——它更内聚，但会破坏 `handoff/cmd/graph_gate_test.go#TestRepoContractGate`，而**本仓不会有任何一支测试变红**，破坏只在跨仓集成时暴露。这正是「反过来写不会有任何测试变红」的决定，故必须留记录。

**二、棘轮基准取 git 主线版，不取 baseline.json 快照。**
难逆转：换参照物要动 schema 与 absorb 职责。会惊讶：后人会觉得「baseline 里存个快照多简单，何必依赖 git」。真取舍：被否方案是 absorb 时把预算快照写进 baseline——零 git 依赖很诱人，但 **baseline 是可整体重建的实测文件，一次全量重扫即把棘轮基准重置、历史涨幅静默洗白**，而重扫恰是最需要棘轮盯住的时刻（handoff 实测 `d_controlplane->d_contract: 27→192` 那笔就是重扫场景）。次生成本：快照要么让扫描配方手抄 target 数字（违反「能派生的绝不手抄」），要么把 absorb 从「合并实测差异」变成「兼管契约快照」。

**三、fitness 判据 1/2 只看图内文件集，不读文件系统。**
难逆转：改成 fs 扫描要给 `Check` 传 repo root，等于动签名（撞记录一）。会惊讶：「我这个包明明 45 个文件，check 怎么不报」——这是可预见的困惑，故明写局限。真取舍：被否方案是判据落 CLI 层做 fs 扫描——数字更准，但判据就脱离了 `Check` 这唯一测试接缝，且 handoff 契约闸（直接调 `Check`）拿不到它。

**四、漏建三类沿用 `dead-*` 命名族但判 fail。**
难逆转：kind 是 wire 值，Web 控制台按 kind 分流展示，改名要跨仓同步。会惊讶：既有 `dead-rule`/`dead-assembly` 都是 warn，后人看到同族的 `dead-entry` 判 fail 会以为写错了。真取舍：被否方案是 `missing-*` 前缀区分档位——但那会让「声明了但图里没有」这同一个概念裂成两个命名族；档位在 JSON 里已由 fails/warns 数组显式承载，不需要靠名字暗示。

## §6 交棒声明

- **欠账：无。** Ticket 0 只落了空壳（三组 kind 常量、三个阈值常量、`CheckBudgetRatchet` 返回 nil 的函数壳、`Contract.LegacyBudgetNote` 字段），零可观测行为，故无需测试锁死。
- **本轮编译证据**：`cd graph && gofmt -w … && go build ./... && go vet ./...` 全部退出码 0；`go test ./... -count=1` 两包 ok（既有测试零破坏）。
- **可执行冻结**：无命中（本刀无哈希/密钥派生/编码格式类条目）。
- **视图 diff**：charter/graph 仓无代码图，跳过。
- **交棒**：breakdown。
