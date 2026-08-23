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

---

## §7 修订记录（2026-08-23，breakdown 拍板回写）

拆解节点核对中发现一条结构性缺口与六条边界歧义，按纪律**退回本节点**处理。以下修订与 §1~§5 同等效力，随修订提交冻结。

### R1（P1=C）：`Diff` 新增 `containersAdded` 段——修根因，非本刀专用

**发现的事实**（本轮三处实读）：①`types.go#Diff` 原无任何容器段；②`merge.go#Merge` 的 `View.Containers` 全量取自 baseline；③`validate.go#ValidateDiff` 对「新增节点引用不存在的容器」直接报问题。**结论：分支视图无法引入新容器。**

**影响面大于刀 3**：contract 节点「骨架符号随同一提交入视图 diff」的纪律、`charter:recon` 节点「补齐视图 diff」的职责，对新容器场景**今天就是不可满足的**——只是此前无人发现。刀 3 的 `dead-entry` 在分支上报红并非误报，图里确实没有那条声明的缝；沉默它等于粉饰。

**增量**（additive，照 刀 1+2 lifecycle 段的成功先例）：

```go
ContainersAdded map[string]Container `json:"containersAdded,omitempty"`   // 已落 types.go#Diff，随本修订冻结
```

语义四条：
- **Merge**：`View.Containers` = baseline 容器 ∪ `ContainersAdded`；
- **ValidateDiff**：`NodesAdded` 的 container 可落在 baseline ∪ `ContainersAdded`；`ContainersAdded` 中 id 已存在于 baseline 的报问题（**不静默覆盖**——「新增」就该是新的）；每个新容器必须带 `domain` 且该领域在 baseline 中存在；
- **Absorb**：并入 `baseline.Containers`，与既有 `NodesAdded` 同款；
- **dead-entry**：入口容器落在 `ContainersAdded` 中即视为已建成，分支内可清零。

**连带欠账（不在本刀，落 roadmap）**：handoff 的扫描配方 `docs/codegraph-scan-recipe.md` 需新增 `containersAdded` 段说明（与 lifecycle 那次同款），否则 AI 扫描者不会产出该段。

### R2（P2=B）：`dead-entry`/`dead-interface` 的存在性按子系统收窄

§1-1 原文的「视图容器集/节点名集」是**全局**存在性，但既有 check 的消费口径是**域内**的（call 边的 label 取自 callee 节点的容器，callee 必在 `to` 域；implements 的 ifaceName 必在 `from` 域）。全局口径下，`entries` 写一个存在于别的子系统的同名 label 会造出「对账过了但 check 仍判违规」——正是 §1-1 明文要避免的失败模式。

**收窄为**：`dead-entry` 要求该 Label 的容器至少有一个非 deleted 节点归属 `to` 子系统；`dead-interface` 要求该 Name 的节点归属 `from` 子系统。实测代价为零（handoff 26 条 entries 两种口径均 0 落空）。

### R3（P3=B）：`dead-contract` 的「实际跨子系统边」含 implements 边与组装点豁免边

§1-1 原文「与既有 `new-direction` 同一遍边扫描」的字面读法只数非豁免 call 边。**该读法在库里即转红**：夹具仓唯一的跨子系统边正是组装点豁免边，`cli_test.go#TestGraphCheck` 与 `check_test.go#TestCheckImplements` 双双变红。语义上也站不住——DI 绑定边恰恰是「缝建成了」的证据，只为回调接口声明的契约（有 interfaces、零 call 边）会被误判死。

**判定改为**：该方向的 call 边 ∪ implements 边 ∪ 组装点豁免边，任一非空即「活」。实测代价为零（handoff 两种口径均 0/23 死契约）。

### R4（P4=A）：基准中缺席的契约视同预算 0，且报文分措辞

§4-16 只规定了分档，未规定比对集合。**定为**：基准 target 中不存在的契约，其基准预算视同 0——新契约携带 `legacyBudget > 0` 即命中 `budget-raised`（新增存量债同样要有理由；handoff 历史确有此类事件）。但报文**必须区分措辞**：「新增契约携带存量预算 N」 vs 「预算 M→N 上涨」，否则「上涨」二字对新契约是误导报错。

### R5（C4/P5②）：基准 target 允许 schema v1，走宽松解析

§3-2 只规定了「取不到基准」的降级，未覆盖实测存在的第三态：**取到了但版本旧**（handoff 2026-08-22 前的 target 全是 v1）。**定为**：基准 target 不走 `LoadTarget` 的版本门，由 CLI 直接 `json.Unmarshal` 进 `codegraph.Target`（v1/v2 的 `contracts` 段形态与 `legacyBudget` 语义完全相同，本轮比对确认）。

**约束两条**：该宽松路径**只用于取 `contracts` 段**，不得用它喂任何其他执法输入；代码注释必须写明这是对「`meta.version` 白名单在 `LoadTarget` 单点收口」的**有意例外**及其理由。

### R6（C5）：分档读 `cur` 侧的 `LegacyBudgetNote`

§2-2 的「该契约的 `LegacyBudgetNote`」未指明取 cur 还是 base。**定为 cur**——涨预算的人在新 target 里写理由，基准侧的旧理由不得用于给新涨幅降档。

### R7（C6）：`LegacyBudgetNote` 的「非空」= `strings.TrimSpace` 后非空

§4-16 字面的「非空」意味着 `" "` 也能降档，是零成本的绕过口。**定为**：`TrimSpace` 后非空才算填了理由。

### R8：更正 §5 拍板记录四的立法理由

拍板记录四原写「Web 控制台按 kind 分流展示」作为「kind 是 wire 值、改名要跨仓同步」的理由。**该事实经实测不成立**：`Check` 在 handoff 侧的唯一消费者是 `cmd/graph_gate_test.go`（只读 `f.Kind` 拼错误信息），agentd 只消费 baseline/views/stale，Web 前端零命中。

**裁决不变**（`dead-*` 命名族沿用、kind 不复用），但理由更正为：kind 是 CLI 的 JSON 输出面、是未来消费方的分流依据，且同一概念不应裂成两个命名族。§4-22（六个新 kind 不冲突不复用）照旧执行。

### R9（P5①③④、P6①②）：CLI 机制细节确认在冻结边界内，不新增接缝

- 默认基准 = `git merge-base HEAD <默认分支>`，默认分支依次探 `refs/remotes/origin/HEAD` → `origin/main` → `origin/master` → `main` → `master`，全失败即走 §3-2 降级（`charter:recon` 正文只给了 BASE 概念、无机械算法，本条是新定义）。
- 基准解析在 CLI 内直接 `json.Unmarshal` 进已导出的 `codegraph.Target`，**不新增导出 API**。
- `git -C <repo> show <rev>:codegraph/target.json` 的冒号后路径相对 git 顶层，须先 `rev-parse --show-prefix` 拼前缀，否则子目录仓取错文件。
- 棘轮 findings 由 CLI append 进 `rep.Fails`/`rep.Warns` 后打印，走既有「fails 非空 → 非零退出」单点，**零 wire 结构变更**。
- 降级提示走 **stderr 一行**，stdout JSON 零污染。§3-2 要求的是「明示提示」而非「机器可读」，且当前无 check JSON 的机器消费方。

### §7 冻结清单增补（接 §4 编号）

23. `Diff.ContainersAdded` 的 JSON 键为 `containersAdded` 且 `omitempty`。
24. `Merge` 后 `View.Containers` = baseline 容器 ∪ diff 的 `ContainersAdded`。
25. `ValidateDiff` 接受 `NodesAdded` 的 container 落在 baseline ∪ `ContainersAdded`。
26. `ValidateDiff` 对「`ContainersAdded` 的 id 已存在于 baseline」报问题。
27. `ValidateDiff` 对「`ContainersAdded` 的容器无 domain 或 domain 不在 baseline」报问题。
28. `Absorb` 把 `ContainersAdded` 并入 `baseline.Containers`。
29. 入口容器落在 `ContainersAdded` 中时 `dead-entry` 不报（分支内可清零）。
30. `dead-entry` 要求该 Label 的容器至少有一个非 deleted 节点归属 `to` 子系统。
31. `dead-interface` 要求该 Name 的节点归属 `from` 子系统。
32. `dead-contract` 的「活」判定 = call 边 ∪ implements 边 ∪ 组装点豁免边，任一非空。
33. 基准缺席的契约按基准预算 0 参与比对。
34. 新契约携带存量预算与既有契约预算上涨的报文措辞不同。
35. 基准 target 为 schema v1 时棘轮照常比对，不跳过。
36. 降档读的是 `cur` 侧的 `LegacyBudgetNote`。
37. `LegacyBudgetNote` 经 `strings.TrimSpace` 后为空则不降档（`" "` 不算理由）。
38. 基准宽松解析路径只用于取 `contracts` 段。

### §7 收尾自检（本轮新鲜证据）

- Ticket 0 增补本轮编译通过：`gofmt -w` → `go build ./...` 退出码 0 → `go vet ./...` 退出码 0 → `go test ./... -count=1` 两包 ok（既有测试零破坏）。
- 可执行冻结：无新命中。
- 拍板记录：R1 命中三重闸门（难逆转=wire 增量且牵动扫描配方；会惊讶=后人会问「为什么 diff 能加容器却不能加领域」；真取舍=被否的 A「接受局限」与 D「分支降 warn」都是绕过根因），已在 R1 正文完整记录，不另起段。R2~R9 属边界澄清与机制确认，不命中三重闸门。
- 欠账：一条，**handoff 扫描配方新增 `containersAdded` 段说明**——不在本刀范围（handoff 仓文件），已在 R1 写明并落 roadmap。

### R10（acceptance 回写）：冻结 4 的零噪声断言按实测更正

冻结 4 原文断言「三类新 fail 对 handoff 真仓的实测结果为 0」。该读数在契约冻结时（2026-08-23 早）成立，**acceptance 真机复测时为 2**——但经查证 **2 条均为真实缺陷，非工具误报**：

`dc00cf163`（handoff 侧另一会话的 `contract(b192)` 冻结）向 `codegraph/target.json` 的两条契约写入了 entry `client.DispatchOpts.local_base_branch`。该串是**字段路径而非容器 label**，baseline 的 containers 中不存在此 label（实测确认）。旧版 check 对匹配不到的 entry 静默，故该哑条目此前零信号；`dead-entry` 判据首次运行即让它可见。已落 handoff 卡 **B206**。

**冻结 4 改述为**：三类新 fail 只在「target.json 声明的契约面确有未建成项」时非零；对 2026-08-23 早的 handoff 真仓快照实测为 0，对含 B192 哑条目的当前快照实测为 2 且两条均可归因到真实缺陷。**判据的正确性由「每条 fail 都能归因到真实缺陷」验证，不由「fail 恒为 0」验证**——后者会把「工具没发现问题」与「代码没问题」混为一谈。
