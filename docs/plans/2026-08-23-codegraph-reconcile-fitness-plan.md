# 实现计划：codegraph 刀 3+4（漏建对账 + fitness 判据）

> L3 轻档单轮实现。六卡串行：**T0 → TC → T1 → T2 → T3 → T4**。
> 全部落在本仓 `graph/` module 内（另加你自己的 ledger）。

## 范围与红线

**做**：T0~T4 六张卡（清单见下），外加 ledger 文件。
**不做**：handoff 仓任何文件（含扫描配方）、打 tag/发版、absorb、动 `skills/`、动既有 docs（除新建 ledger）。
**真机清单归协调者，不派发**——本计划末尾的「真机清单」8 条你一条都不要执行，也不要因为它们没做而认为卡未完成。

## 法定输入（动手前通读，全在本仓）

1. **契约（法律）**：`docs/contracts/2026-08-23-codegraph-reconcile-fitness-contract.md`——§4 冻结清单 1~22 与 §7 增补 23~38 共 **38 条**逐条是硬判据；§5 拍板记录与 §7 修订 R1~R9 是已裁决约束，**不得推翻**。凡本计划与契约冲突，以契约为准并停下提问。
2. **拆解稿（卡面即验收）**：`docs/breakdowns/2026-08-23-codegraph-reconcile-fitness-breakdown.md`——尤其末尾「拍板结果」节（P1~P7 裁决 + TC 卡全文 + 调整后 DAG）。
3. 上游 spec：`docs/specs/2026-08-23-codegraph-reconcile-fitness-spec.md`（背景与用户故事）。
4. **现状锚**：Ticket 0 已落 `graph/codegraph/fitness.go`（三组 kind 常量、三个阈值常量、`CheckBudgetRatchet` 空壳）、`target.go#Contract.LegacyBudgetNote`、`types.go#Diff.ContainersAdded`——**类型与 json 键形已冻结，勿改语义**。

## 现状基线读数（本计划出稿时实跑，你动手前应能复现）

| 读数 | 值 |
|---|---|
| `codegraph check --repo graph/codegraph/testdata/repo` | **fails 0 / warns 0** |
| 夹具 target | subsystems `d_svc`/`d_cmd`/`d_web`；唯一契约 `d_cmd→d_svc`，`entries=["svc.Server"]`，`legacyBudget=0`；`assembly=["cmd/run.go"]` |
| 夹具 baseline 容器 | `c_cli`(Label「CLI 命令」,d_cli)、`k_svc`(Label「svc.Server」,d_svc/api)、`k_ent`(Label「store 实体」,d_svc/store) |
| 夹具唯一跨子系统 call 边 | `n_runE`(cmd/run.go)→`n_do`(svc/server.go)，**因 `cmd/run.go` 在 assembly 而被豁免** |
| 夹具 implements 边 | `n_do`→`m_notifier` |
| 包内测试 harness | `check_test.go#mkView(nodes map[string][2]string, edges, impls [][2]string) *View`（nodes 值为 `[容器id, 文件]`，Label 取容器 id，Node.Name 取节点 id）与 `#twoDomainTarget(entries []string, budget int) *Target`（`d_a`→`d_b`，paths `a/**`、`b/**`） |
| CLI 测试 harness | `cli/cli_test.go#runGraph`（合并输出）与 `#runGraphSeparate`（stdout/stderr 分离，**stderr 断言照抄它**） |
| 全量基线 | `cd graph && go build ./... && go vet ./... && gofmt -l .` 全净；`go test ./... -count=1` 两包 ok |

## 全局纪律

- **TDD 铁律**：每步先写测试看红（确认红因是功能缺失、不是 typo），再落最小实现转绿。
- **测试范围最小化**：卡内循环只跑触及包（`go test ./codegraph -run <TestName>` 或 `./cli -run <TestName>`）；每卡收尾跑 `cd graph && go build ./... && go vet ./... && gofmt -l .` + 触及包全测。**全量测试只在整分支终审跑一次**。
- **既有测试不许删改语义**：18+ 支包测试与 20 支 CLI 测试是外部尺。任何一支因你的改动变红，先判断是「判据正确、夹具需更新」还是「你写错了」，**前者也必须在 ledger 写明为什么该测试的期望变了**。
- **每卡一提交**，提交信息写清卡号与做了什么。
- **可观测性的形态说明（重要，不是省略）**：`codegraph` 包按契约是 stdlib-only 的纯函数库，**全仓无 logger、禁 print**（`cli/deps_test.go` 的依赖白名单锁死只有 cobra）。因此本刀的可观测性落点是两处，**每卡的「注释与可观测性」步骤按此执行**：①每条 `Finding.Detail` 必须自带完整定位信息（谁、在哪、期望什么、实测什么），它就是这个库的「日志」；②CLI 层的错误与降级提示走 stderr 并带上下文（T4）。**不要引入任何日志库**。

---

## T0：`sortFindings` 补 tiebreak（必须最先）

**为什么最先**：后续五卡会大量制造同 `Kind` 的 finding（一个仓可能有多条 `dead-entry`），撞键概率陡增；不先修，后面所有卡的输出断言都可能间歇性抖动，你会把时间浪费在排查假失败上。

**契约引用**：§3-3；冻结 21。

**文件集（2 个）**：`graph/codegraph/check.go`、`graph/codegraph/check_test.go`。

**Interfaces**：Produces 无对外签名变化（`sortFindings` 是包内未导出函数）。Consumes 无。

**步骤**：

1. 在 `check_test.go` 写红测试 `TestSortFindingsIsTotalOrder`：构造**同一批** finding（≥6 条，其中至少 3 条 `Kind` 与 `Detail` 完全相同、仅 `From`/`To` 不同），做成两个不同的输入排列，各自跑一遍 `sortFindings`，断言两次结果**逐字段相等**。
   - 红因必须是「顺序不同」，不是编译错误。若偶然通过，加大撞键条数（`slices.SortFunc` 是不稳定排序，撞键条目多时必现差异）。
2. 跑红：`cd graph && go test ./codegraph -run TestSortFindingsIsTotalOrder -count=1`。
3. 最小实现：`check.go#sortFindings` 的比较器在 `Kind`、`Detail` 之后依次追加 `From`、`To`，再追加 `Edge`（`Edge` 为指针，nil 排在非 nil 前；非 nil 时先比 `Edge[0]` 再比 `Edge[1]`）。
4. 跑绿；再跑 `go test ./codegraph ./cli -count=1` 确认既有测试零破坏。
5. **注释与可观测性**：在 `sortFindings` 的注释里补一句「为什么需要 From/To/Edge tiebreak」——写根因（`slices.SortFunc` 不稳定、撞键即输出不可 diff），不要写「按多字段排序」这种复述代码的话。
6. 提交。

**验收**（逐条独立可判）：
① `TestSortFindingsIsTotalOrder` 绿，且把 tiebreak 三行删掉后该测试转红（变异自验，还原）。
② `go test ./codegraph ./cli -count=1` 全绿。
③ `sortFindings` 注释含「为什么」。

---

## TC：`Diff.containersAdded` 全链路

**契约引用**：§7-R1；冻结 23~29。

**意图**：让分支视图能表达新建容器。这不是刀 3 专用——contract 节点「骨架符号入图」与 `charter:recon`「补齐视图 diff」对新容器场景今天就不可满足。**照 lifecycle 段的四处落点模式做**（`absorb.go#mergeProjections` 与 lifecycle 的既有写法是逐字模式源，读它再动手）。

**文件集（4 个 + 各自测试）**：`graph/codegraph/types.go`（字段已落，勿再改）、`merge.go`、`validate.go`、`absorb.go`。

**Interfaces**：
- Consumes：`Diff.ContainersAdded map[string]Container`（已落 `types.go#Diff`，json 键 `containersAdded,omitempty`）。
- Produces：`Merge` 后的 `View.Containers` 含新容器；`Absorb` 后的 `baseline.Containers` 含新容器。无新导出函数。

**步骤**：

1. 先读 `absorb.go` 里 lifecycle/projections 的合并写法与 `merge.go#Merge` 的容器赋值处（`Containers: g.Containers`）——你要照的就是这两处的模式。
2. 写红测试（`merge_test.go`）：带 `ContainersAdded` 的 diff 经 `Merge` 后 `View.Containers` 应含该容器且 Label 正确。跑红。
3. 实现 `Merge`：`View.Containers` = baseline 容器 ∪ `d.ContainersAdded`。**注意不能就地改 `g.Containers`**（会污染基线，与既有 clone 纪律一致——读一眼 `Merge` 现有的 map 拷贝写法照做）。跑绿。
4. 写红测试（`validate_test.go`）四支，逐支跑红再实现：
   - `NodesAdded` 引用只存在于 `ContainersAdded` 的容器 → `ValidateDiff` **不报问题**（当前实现必报「引用不存在的容器」，这就是红因）；
   - `ContainersAdded` 的 id 已存在于 baseline → 报问题（措辞含该 id）；
   - `ContainersAdded` 的容器 `Domain` 为空 → 报问题；
   - `ContainersAdded` 的容器 `Domain` 不在 baseline 的 domains 里 → 报问题。
5. 实现 `ValidateDiff` 对应四条。**门禁不许放宽过头**：只对 `ContainersAdded` 里的 id 放宽，引用真正未知容器时仍必须报——既有测试里该断言必须保持绿。
6. 写红测试（`absorb_test.go`）：`Absorb` 后 `baseline.Containers` 含新容器；再跑一次 `Validate(baseline)` 应无 issue。跑红→实现→绿。
7. **序列化边界回归**：在 `merge_test.go` 的既有「JSON 键集合 additive-only」断言（`TestGraphJSONKeysAreAdditiveForLifecycle` 是同款样板）旁，补一支断言 `Diff` 序列化后含 `containersAdded` 键且空值时省略（`omitempty` 生效）。
8. **注释与可观测性**：`Merge`/`ValidateDiff`/`Absorb` 三处新增逻辑各写一句「为什么」注释；四条 issue 措辞必须自带容器 id 与原因（例：`新增容器 k_x 已存在于基线，containersAdded 只接受新容器`）。
9. 提交。

**验收**：
① 上述步骤 2/4/6/7 的全部测试绿，且每支都经历过「先红后绿」（ledger 记红因）。
② 引用真正未知容器仍报问题（既有断言保持绿）。
③ `go test ./codegraph ./cli -count=1` 全绿。
④ `Diff` 空 `ContainersAdded` 时序列化不出现该键。

---

## T1：漏建三类判据

**契约引用**：§1；§7-R2、R3；冻结 1~6、29~32。

**文件集（4 个）**：`graph/codegraph/check.go`、`fitness.go`（kind 常量已在，直接用）、`check_test.go`、必要时 `graph/codegraph/testdata/repo/codegraph/target.json`。

**Interfaces**：
- Consumes：`KindDeadEntry`/`KindDeadInterface`/`KindDeadContract`（已落 `fitness.go`）；`Check(t *Target, v *View) *Report`（签名**不得改动**，冻结 13）。
- Produces：三类 finding 进 `Report.Fails`（冻结 5）。

**判定语义（按 R2/R3，逐字执行）**：
- `dead-entry`：对每条契约的每个 `entries` 条目 E——若**不存在**这样的容器：其 `Label == E` 且它至少有一个非 deleted 节点归属该契约的 `to` 子系统，则报。**例外（冻结 29）**：若该容器落在本视图的 `ContainersAdded` 来源中则视为已建成，不报。
  - 实现提示：`Check` 只拿到 `*View`，拿不到 diff。**因此本条例外的落地方式是：TC 已让 `ContainersAdded` 的容器进入 `View.Containers`，所以「容器存在」这一半自动成立**；剩下「至少一个节点归属 to 子系统」对新容器同样成立（骨架符号随 diff 一起进 `NodesAdded`）。你**不需要**给 `Check` 加任何 diff 参数——若你发现必须加，停下提问，不要自行改签名。
- `dead-interface`：对每条契约的每个 `interfaces` 条目 I——若不存在名为 I 且归属该契约 `from` 子系统的非 deleted 节点，则报。
- `dead-contract`：对每条声明的契约方向——若该方向的 **call 边 ∪ implements 边 ∪ 组装点豁免边**全为空，则报。注意豁免边也算「活」（R3），**不要只数 `new-direction` 那一遍未被 continue 的边**。

**步骤**：

1. **判据先在基线跑**：先跑 `~/go/bin/codegraph check --repo graph/codegraph/testdata/repo`（或 `go run ./cmd/codegraph check --repo …`），确认现状 fails 0 / warns 0；记进 ledger。这是「零噪声上线」的本地对照物。
2. 写红测试（`check_test.go`，harness 用 `mkView` + `twoDomainTarget`）逐支跑红再实现：
   - entries 写了一个视图里没有的 Label → 报 `dead-entry`；
   - entries 的 Label 存在但其节点全在**别的**子系统 → 报 `dead-entry`（这是 R2 收窄的靶子，全局口径下会漏报）；
   - entries 的 Label 存在且有节点在 `to` 子系统 → **不报**；
   - interfaces 写了不存在的名字 → 报 `dead-interface`；interfaces 的节点在 `from` 子系统 → 不报；
   - 声明方向零边 → 报 `dead-contract`；只有 implements 边 → **不报**；只有组装点豁免边 → **不报**（这两条是 R3 的靶子，字面口径下会误报）；
   - 全部三类均进 `Fails` 不进 `Warns`。
3. 实现三条判据。放在 `check.go#Check` 内、既有边扫描之后（你需要边扫描的统计结果）。
4. 跑绿；再跑 `go test ./codegraph ./cli -count=1`——**特别注意 `cli_test.go#TestGraphCheck` 与 `check_test.go#TestCheckImplements` 必须仍绿**（它们正是 R3 字面口径会打红的两支，绿即证明你实现的是 R3 而非字面）。
5. **注释与可观测性**：三类 Detail 必须自带完整定位——契约方向、条目原文、以及「期望在哪个子系统找到」。例：`契约 d_a→d_b 声明的入口 "svc.Server" 在 d_b 中不存在（无同 Label 容器或其节点均不属 d_b）`。判据函数写「为什么」注释，重点写 R2/R3 两条收窄/放宽的理由，**并注明契约条款号**（后人想「优化」时能查到出处）。
6. 提交。

**验收**：
① 步骤 2 的全部断言绿且都经历先红后绿。
② `cli_test.go#TestGraphCheck`、`check_test.go#TestCheckImplements` 保持绿。
③ 夹具仓 check 仍为 fails 0 / warns 0（零噪声）。
④ 三类 Detail 均含契约方向与条目原文。
⑤ `Check` 签名逐字未变。

---

## T2：fitness 判据 1/2

**契约引用**：§2-1、§2-3；冻结 7~12。

**文件集（3 个）**：`graph/codegraph/fitness.go`、`check.go`（接线）、`check_test.go` 或新建 `fitness_test.go`。

**Interfaces**：
- Consumes：`KindPrefixFamily`/`KindOversizedPackage`、`prefixFamilyMinShared=4`、`prefixFamilyMinMembers=5`、`oversizedPackageFiles=40`（均已落 `fitness.go`）。
- Produces：两类 finding 进 `Report.Warns`（冻结 10）。

**判定语义**：
- 输入是**视图文件集**：`View.Nodes` 中非 deleted 节点的 `File` 去重（冻结 11，**不读文件系统**）。
- `prefix-family`：按目录分组；同目录内，文件名（去扩展名）**共享前 4 字符**的一组，成员 ≥5 即命中。Detail 必须给该组**真实最长公共前缀**，不是 4 字符截断（冻结 8）。
- `oversized-package`：同目录文件数 ≥40，且视图文件集中不存在以该目录为前缀的更深层目录，即命中。

**步骤**：

1. 写红测试（先红后绿，逐支）：
   - 6 个同目录文件共享前 5 字符 → 命中一条 `prefix-family`，Detail 含该 5 字符前缀（**不是 4 字符**）；
   - 4 个共享前 4 字符 → 不命中（成员不足）；
   - 5 个只共享前 3 字符 → 不命中（这是滤掉 `use*` 类惯例前缀的靶子）；
   - 5 个同前缀但分处两个目录 → 不命中（跨目录不算一族）；
   - 40 个文件的目录且无子目录 → 命中 `oversized-package`；
   - 40 个文件的目录但存在子目录文件 → 不命中；
   - 39 个文件 → 不命中；
   - 两类均进 `Warns` 不进 `Fails`。
2. 实现两条判据（放 `fitness.go`，纯函数，输入 `*View`），在 `check.go#Check` 内调用并把结果 append 进 `rep.Warns`。
3. 跑绿；跑 `go test ./codegraph ./cli -count=1`。
4. **注释与可观测性**：`prefix-family` 的 Detail 形如 `目录 internal/agentd 下前缀族 "work" 有 6 个源文件（阈值 5）——架构法第三条：必须回答「还能圈出有界文件集吗」`；`oversized-package` 同款带目录、文件数、阈值。函数注释写清「为什么阈值是 4」（惯例前缀 use/get/set/new 都 ≤3 字符，要求共享 4 字符自动滤掉它们——这是实测结论，注明契约 §2-1）与「为什么只看图内文件集」（保 `Check` 纯函数性，注明契约 §2-3 与拍板记录三）。
5. 提交。

**验收**：
① 步骤 1 的八条断言全绿且经历先红后绿。
② 夹具仓 check 仍 fails 0 / warns 0（夹具无 ≥5 家族、无 ≥40 目录，实测确认）。
③ Detail 含真实最长公共前缀（用 5 字符共享的用例正面断言）。
④ 两类判据零文件系统访问（代码里不出现 `os.ReadDir`/`filepath.Walk` 等）。

---

## T3：棘轮纯函数

**契约引用**：§2-2；§7-R4、R6、R7；冻结 14、16、33、34、36、37。

**文件集（2 个）**：`graph/codegraph/fitness.go`、`fitness_test.go`。

**Interfaces**：
- Produces：`func CheckBudgetRatchet(cur, base *Target) []Finding`（签名已落 `fitness.go`，**逐字不得改**）。
- Consumes：`Contract.LegacyBudgetNote`（已落 `target.go`）；`KindBudgetRaised`。
- **本函数只产出 findings，不判档**——是 Fails 还是 Warns 由 T4 的调用方按 `cur` 侧 `LegacyBudgetNote` 分流（R6）。

**判定语义**：
- `base == nil` → 返回 nil（冻结 14）。
- 逐契约按 `from->to` 配对；base 中缺席的契约，其基准预算视同 **0**（R4/冻结 33）。
- `cur.LegacyBudget > base 预算` 即产出一条 `KindBudgetRaised`。
- **措辞分两种**（冻结 34）：base 缺席时写「新增契约携带存量预算 N」；两边都有时写「预算 M→N 上涨」。
- 产出顺序按 `cur.Contracts` 切片序（确定性）。

**步骤**：

1. 写红测试（逐支先红后绿）：
   - `base == nil` → 返回 nil；
   - 预算 2→3 → 一条 finding，Detail 含 `2` 与 `3` 且措辞为「上涨」类；
   - 预算 5→5 → 零 finding；预算 5→2 → 零 finding（下降不报）；
   - base 缺席该契约、cur 预算 4 → 一条 finding，措辞为「新增契约携带存量预算」类（**断言它与上涨类措辞不同**）；
   - base 缺席该契约、cur 预算 0 → 零 finding；
   - 多契约时产出顺序等于 `cur.Contracts` 顺序；
   - Kind 恒为 `KindBudgetRaised`。
2. 实现。
3. **`TrimSpace` 断言（R7/冻结 37）归属说明**：降档逻辑在 T4，但「`" "` 不算理由」这条判据必须有测试。**放在 T4 的 CLI 测试里**（因为分档发生在 CLI）——T3 只负责产出 finding，不读 Note。
4. 跑绿；跑 `go test ./codegraph -count=1`。
5. **注释与可观测性**：函数注释补齐「为什么 base 缺席视同 0」（新增存量债同样要有理由，注明 R4）与「为什么不在这里判档」（分档要读 cur 侧 Note 且要落进 Report，是调用方的事，注明 R6）。两种 Detail 措辞各自自带契约方向与数值。
6. 提交。

**验收**：
① 步骤 1 的八条断言全绿且经历先红后绿。
② 两种措辞的字符串**互不包含**（用断言锁死，防日后被合并成一句）。
③ `CheckBudgetRatchet` 签名逐字未变。
④ `fitness.go` 内零 `os/exec`、零 git、零文件读取（冻结 15）。

---

## T4：CLI 接线

**契约引用**：§3-2、§7-R5、R9；冻结 20、35、38；以及 R6/R7 的分档落地。

**文件集（2 个）**：`graph/cli/cli.go`、`graph/cli/cli_test.go`。

**Interfaces**：
- Consumes：`codegraph.CheckBudgetRatchet(cur, base *Target) []Finding`；`codegraph.Target`（直接 `json.Unmarshal`，**不新增导出 API**，R9）。
- Produces：无新导出符号；`check` 子命令行为增量。

**机制（R9，逐条执行）**：
1. **基准取值**：`--base <rev>` 显式指定优先；缺省 = `git merge-base HEAD <默认分支>`，默认分支依次探 `refs/remotes/origin/HEAD` → `origin/main` → `origin/master` → `main` → `master`。
2. **取文件**：`git -C <repo> show <rev>:<prefix>codegraph/target.json`，其中 `<prefix>` 来自 `git -C <repo> rev-parse --show-prefix`（冒号后路径相对 git 顶层，不加前缀在子目录仓会取错文件）。
3. **解析**：直接 `json.Unmarshal` 进 `codegraph.Target`，**不走 `LoadTarget` 的版本门**（基准可能是 schema v1，R5）。解析结果**只取 `Contracts` 段**喂 `CheckBudgetRatchet`，不得用于任何其他执法输入。
4. **分档**：对每条 `budget-raised`，查 `cur` 侧同 `from->to` 契约的 `LegacyBudgetNote`，`strings.TrimSpace` 后非空 → append 进 `rep.Warns`，否则 append 进 `rep.Fails`（R6/R7）。
5. **降级**：上述任一步失败（无 git、探不到默认分支、`git show` 失败、解析失败）→ **不报错、不中断 check**，向 **stderr 打一行明示提示**说明棘轮判据已跳过及原因，stdout 的 JSON 零污染。
6. 顺序：先 `codegraph.Check(t, v)` 拿 rep，再 append 棘轮 findings，再打印，再按 `len(rep.Fails) > 0` 决定退出码（既有单点，不新增退出路径）。

**步骤**：

1. **判据先在基线跑**：在本仓跑一次 `git merge-base HEAD master` 与 `git rev-parse --show-prefix`，确认命令形态与输出（本仓 `--show-prefix` 为空字符串，子目录场景需你自己造夹具验证）。记进 ledger。
2. 写红测试（`cli_test.go`，stderr 断言照抄 `runGraphSeparate`）逐支跑红再实现：
   - 基准不可得（用 `t.TempDir()` 造一个**非 git 仓**的 repo）→ `check` 退出码不变（该仓其余判据决定），stderr 含「棘轮」「跳过」类提示，**stdout 能被 `json.Unmarshal` 解析**（零污染断言）；
   - `--base` 指向一个预算更低的旧版 target → 出现 `budget-raised` 且进 `Fails`、退出码非零；
   - `--base` 指向预算更低的旧版 target、且 `cur` 侧该契约 `legacyBudgetNote` 填了非空白文字 → `budget-raised` 进 `Warns`、退出码为 0；
   - `--base` 指向预算更低的旧版 target、且 `cur` 侧该契约 `legacyBudgetNote` 为 `"   "`（纯空白）→ 仍进 `Fails`、退出码非零（R7 靶子）；
   - 基准 target 为 **schema v1**（`{"meta":{"version":1},"domains":[...],"contracts":[...]}`）→ 棘轮**照常比对**、不跳过（R5/冻结 35 靶子）。
   - 造旧版 target 的办法：在测试用临时 git 仓里 `git init` + 两次提交，或直接用 `--base` 指向一个 rev；**具体做法自定，但必须真的走 `git show` 路径**，不许 mock 掉 git。
3. 实现。
4. 跑绿；跑 `go test ./cli ./codegraph -count=1`。
5. **注释与可观测性**：
   - 宽松解析处**必须**写注释说明这是对「`meta.version` 白名单在 `LoadTarget` 单点收口」的**有意例外**、理由（基准可能是 v1，v1/v2 的 contracts 段形态相同）、以及**约束**（只取 contracts 段），注明契约 R5；
   - 降级提示的措辞要让人能自己修（含具体原因，如「未探测到默认分支」而非「基准不可用」）；
   - 默认分支探测顺序写注释说明为什么是这个顺序。
6. 提交。

**验收**：
① 步骤 2 的五条断言全绿且经历先红后绿。
② 降级路径下 stdout 仍是合法 JSON（正面断言）。
③ 宽松解析处有注释且注明契约条款号。
④ `cli.go` 中棘轮 findings 走既有 `len(rep.Fails) > 0` 退出点，无新增 `os.Exit`。
⑤ `go test ./... -count=1` 全绿。

---

## 四项检查（本计划自审）

**1. 缺陷族对抗审查**（结论已分散进各卡验收，此处汇总）

| 族 | 回答 |
|---|---|
| 生命周期/状态机中断 | 无新增守护进程/持久状态。唯一写盘路径是 `Absorb`（TC 卡触及），它已有临时文件+rename 原子写，本刀不改该机制 |
| 静默失败/误导报错 | 三处：①T4 降级**必须**明示 stderr 且 stdout 保持合法 JSON（T4②）；②`budget-raised` 对新契约用「上涨」措辞是误导报错，故 R4 强制分措辞并用「两种措辞互不包含」断言锁死（T3②）；③三类漏建的 Detail 必须写明「期望在哪个子系统找到」，否则用户不知道该改 target 还是改代码（T1④） |
| 跨平台假设 | 判据 1/2 用路径分隔处理：视图里的 File 一律是 `/` 分隔的仓库相对路径（既有约定），**不要用 `filepath.Dir`**（Windows 上会按 `\` 处理），用 `path.Dir`/`strings.LastIndex(f,"/")`。T4 的 git 调用继承既有 `os/exec` 形态，零新增平台假设 |
| 假红/假绿测试 | 三把外部尺：①T0 的两排列等价断言（不稳定排序必现差异，不是靠运气）；②T2 用「共享 5 字符」的用例正面锁死「Detail 给真实 LCP」，若实现回退成 4 字符截断即红；③T3 的「两种措辞互不包含」。另每卡都要求先红后绿并在 ledger 记红因——**红因是编译错误的不算数** |
| 门禁绕过 | 两处：①TC 放宽 `ValidateDiff` 容器检查，**只对 `containersAdded` 内的 id 放宽**，引用真正未知容器仍必须报（TC②）；②`LegacyBudgetNote` 的空白串是零成本绕过口，R7 用 `TrimSpace` 堵死并有专测（T4 第 4 支断言） |
| 序列化边界 | 新增字段两个：`Diff.ContainersAdded`（链路 diff→Merge→View→Absorb→baseline，TC①⑤⑦逐处断言 + additive-only 键集断言）、`Contract.LegacyBudgetNote`（链路 target.json→LoadTarget→分档，T4 第 3/4 支断言穿真实文件读取）。六个新 kind 走 `Report`→CLI JSON，T1/T2/T3 的断言均读 JSON 字段而非内存结构 |
| 枚举新值过白名单 | 六个新 kind 在本仓与跨仓**均无 switch 消费方**（拆解稿实测），无白名单需扩。`LegacyBudgetNote` 是空/非空二值不是枚举，其「枚举面」由 R7 的 TrimSpace 收口。`meta.version` 白名单在 `LoadTarget` 单点——T4 的基准解析**有意绕开**它，故 R5 加了「只取 contracts 段」的硬约束与强制注释 |
| 承重安全属性 | 无 token/权限/隔离类属性。承重不变式三条及其锁：`Check` 签名不变（T1⑤ 断言）、`codegraph` 包零 git 零 fs（T3④ + T2④ 断言）、baseline additive-only（TC⑦ 沿用既有键集锁） |

**2. 序列化边界设问**：见上表该行，两个新字段的每一处手写投影都已列进对应卡的验收。

**3. 上下文预算检查**：六卡文件集分别为 2/4+测试/4/3/2/2 个文件，全部圈得出有界集合，无需插竖切卡。

**4. 类型标注**：本刀六卡全部落在 charter/graph 单一模块内，均为**逻辑型**（接缝对面是自有代码，测试可闭环）。跨仓行为事实（handoff 真仓零噪声、v1 基准窗口）已全部归入下方真机清单。

## 占位符例外声明

本计划**未使用**「断言列表代替完整测试代码」以外的任何简写。使用该例外的位置：T0/TC/T1/T2/T3/T4 的测试步骤均以**逐条可判 pass/fail 的断言清单**给出，而非完整测试代码——理由是测试必须复用既有 harness（`check_test.go#mkView`/`#twoDomainTarget`、`cli_test.go#runGraphSeparate`），其形态因包而异，照抄 harness 比照抄我写的代码更不容易错。**harness 文件名已在每处指认。** 占位符扫描已跑（`grep -nE "TBD|待定|同上|适当处理"`）：出稿时命中的三处相对指代已就地展开为自足描述，现存命中仅为本节自身的文字引用。

## 收尾（整分支终审前）

1. `cd graph && go test ./... -count=1` 全绿；`gofmt -l .` 空；`go vet ./...` 零输出；
2. `CGO_ENABLED=0` 三平台 build 过：linux/amd64、darwin/arm64、windows/amd64；
3. **契约 38 条冻结清单逐条自查打勾表进 ledger**（每条带证据指针：测试名或文件:行）；
4. ledger 落 `docs/ledgers/2026-08-23-codegraph-reconcile-fitness-ledger.md`：逐卡记录范围/验证/偏差，每支测试的**红因**必须在场。

## 真机清单（8 条，**归协调者，不派发——你不要执行**）

1. 新 CLI 二进制对 handoff 真仓跑 `check`，三类新 fail 为 **0**（零噪声上线断言，契约冻结 4）。
2. 新 CLI 二进制对 handoff 真仓跑 `check`，`prefix-family` 应命中 4 组、真实 LCP 分别为 `project`/`work`/`proc`/`Machine`；`oversized-package` 应命中 2 处（`internal/agentd` 61 文件、`cmd` 41 文件）。
3. handoff 真仓的棘轮：从主线拉分支、调高一个 `legacyBudget` → 非零退出；补 `legacyBudgetNote` → 退出 0。
4. 从 handoff 一个 2026-08-22 前的提交（target 为 schema v1）拉分支跑 check，断言棘轮**照常比对**（R5/冻结 35）。
5. 子目录仓场景：`--repo` 指向 git 仓的子目录，`git show` 前缀拼接正确。
6. 无 git 环境（`env -i` 或非 git 目录）→ stderr 明示、stdout 合法 JSON、退出码由其余判据决定。
7. 新容器类入口在分支内可清零：造一个带 `containersAdded` 的真实分支 diff，`check --view <分支>` 的 `dead-entry` 为 0（R1/冻结 29）。
8. `codegraph check` 两次运行输出逐字节一致（冻结 21，T0 的真仓复验）。

## 自审三查（出稿者本轮自查记录）

**一、spec 用户故事逐条归属**（指不到卡的就是没人做）：

| 故事 | 归属 |
|---|---|
| 1 实现者看到「声明了但没建成」并逐条清零 | **T1**（三类判据）+ **TC**（新容器类入口在分支内可清零，否则故事 1 在最需要它的场景失效） |
| 2 拆解者不必人工数文件 | **T2**（两条 fitness 判据，warn 档=要求回答不要求修复） |
| 3 审查者看到调高预算被拦下、理由留在冻结物里 | **T3**（产出 finding）+ **T4**（分档落地） |
| 4 重扫的正当上涨写一句理由即放行为 warn | **T4** 第 4 条机制（cur 侧 Note + TrimSpace） |
| 5 无 git 环境明示跳过而非静默放过 | **T4** 第 5 条机制 + T4 验收① 的降级断言与 ② 的 stdout 合法性断言 |

**二、占位符扫描**：见上节，已清零（例外已声明）。

**三、跨 task 签名一致性**（逐字比对）：
- `CheckBudgetRatchet(cur, base *Target) []Finding`——T3 Produces 与 T4 Consumes 逐字符一致，且与 Ticket 0 已落的 `fitness.go` 逐字一致；
- `Diff.ContainersAdded map[string]Container`（json `containersAdded,omitempty`）——TC Produces 与 T1 判定语义中的引用一致，且与 Ticket 0 已落的 `types.go` 逐字一致；
- `Check(t *Target, v *View) *Report`——T1/T2 均声明不改，与冻结 13 一致；
- 六个 kind 常量名与 `fitness.go` 已落定义逐字一致（`KindDeadEntry`/`KindDeadInterface`/`KindDeadContract`/`KindPrefixFamily`/`KindOversizedPackage`/`KindBudgetRaised`）。

**四、派发前自审**：本计划无任何需要驱动 handoff/派发系统自身的验收步骤（真机 8 条全部标注归协调者且不进派发范围），与执行者纪律块的「不派发、不调 handoff CLI」无冲突。
