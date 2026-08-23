# Breakdown：codegraph 刀 3+4——漏建对账 anti-漏建 + fitness 判据进 check

> 日期：2026-08-23 | 状态：**出稿待拍板**（出稿 subagent，岔口零自批）
> 定级：L3 轻档（拆解与契约冻结照做，实现归一轮）
> 上游状态位（出稿时实读核对）：spec 头部「**已批准**（2026-08-23，用户批准）」✓；契约头部「**已冻结**（2026-08-23，随本提交）」✓，冻结提交 `6578ce48` 在库 ✓；Ticket 0 骨架已落 `graph/codegraph/fitness.go`（三组 kind 常量、三个阈值常量、`CheckBudgetRatchet` 空壳）与 `graph/codegraph/target.go#Contract.LegacyBudgetNote` ✓；当前工作树干净，`go build ./... && go vet ./... && go test ./... -count=1` 全绿（本轮实跑，cli / codegraph 两包 ok）。
> 现状读数出自本 worktree `graph/` module 与 `~/workspace/handoff` @ 主线的直接实读与脚本实测。

---

## 待拍板清单（拍板者按此裁决，散落正文的引用只是展开）

| # | 岔口 | 方案与取舍 |
|---|---|---|
| **P1** | **`dead-entry` 与分支 diff 的结构性冲突：新容器进不了视图** | 本轮实读三处硬事实：①`types.go#Diff` **无 containers 字段**——diff 只能加节点/边，加不了容器；②`merge.go:57` 的 `View.Containers` 全量取自 baseline，diff 一个字都改不动；③`validate.go:111` 的 `ValidateDiff` 对「新增节点引用不存在的容器」**直接报错**。后果：分支上新建的入口结构体（= 新容器）根本进不了 `--view <分支>`，`check` 必报 `dead-entry` 且**在分支内无法清零**——恰是 spec 用户故事 1（「契约冻结后的实现者逐条清零」）的正主场景。A=照冻结实现，接受「新容器类入口要等主线重扫/absorb 后才清零」，在报文里明写该局限并落 roadmap（零 schema 改动）；B=判据放宽为「Label 存在 ∪ 任一非 deleted 节点的容器 **id** 命中该 entry 串」（不解决根因，且引入 id/label 第二套口径，与冻结 1「逐字一致」冲突）；C=给 Diff 加 `containersAdded`（wire/schema 增量 → **退回 contract**，超出本刀 additive 范围）。**倾向 A + 报文明示 + 落 roadmap** |
| **P2** | **`dead-entry`/`dead-interface` 的存在性判据是否按子系统归属收窄** | 冻结 §4-1/2 字面是「视图**容器集**/**节点名集**」= 全局存在性。但既有 check 的消费口径是**域内**的：call 边循环里 label 取自 callee 节点的容器（callee 必在 `to` 域），implements 循环里 ifaceName 必在 `from` 域。全局口径下，`entries` 写了一个存在于**别的子系统**的同名 label 会「对账过了但 check 仍判违规」——正是契约 §1-1 明文要避免的失败模式。A=照字面全局存在性；B=收窄为「该 Label 的容器至少有一个非 deleted 节点归属 `to` 子系统」/「该 Name 的节点归属 `from` 子系统」。**代价已实测为零**：handoff 真仓 26 条 entries 在两种口径下均 0 落空（本轮脚本双跑），选 B 不引入任何新噪声。**倾向 B（属边界澄清，建议回写契约修订记录）** |
| **P3** | **`dead-contract` 把哪些边算作「实际跨子系统边」** | 冻结 §1-1 写「与既有 `new-direction` 同一遍边扫描的统计结果」——`new-direction` 的发射点在**组装点豁免 `continue` 之后**，字面读法（A）= 只数非豁免的 call 边。**A 的代价在库里就能看见**：夹具仓 `codegraph/testdata/repo` 唯一一条跨子系统边 `n_runE→n_do` 正好是组装点豁免边（`cmd/run.go` 在 assembly），选 A 则声明的 `d_cmd→d_svc` 立刻变死契约，`cli_test.go#TestGraphCheck`（断言 check 应通过）与 `check_test.go#TestCheckImplements`（只有 implements 边、零 call 边）**双双转红**。语义上也站不住：DI 绑定边恰恰是「缝建成了」的证据，只为回调接口而声明的契约（有 interfaces、零 call 边）会被误判死。A=照字面；B=`call 边 ∪ 该方向 implements 边 ∪ 组装点豁免边` 都算「活」。handoff 真仓两种口径下均 0/23 死契约（本轮脚本双跑），**倾向 B（边界澄清，建议回写）** |
| **P4** | **棘轮对「基准里不存在的契约」怎么算** | A=缺席视同预算 0，新契约带 `legacyBudget>0` 即命中 `budget-raised`（新增存量债同样要有理由；handoff 历史实测这类事件确有：`d_executor->d_host` 首现即 4、`d_release->d_localint` 首现即 1）；B=只比对两边都存在的契约，新契约一律不报。选 A 须要求报文**区分措辞**（「新增契约携带存量预算 N」vs「预算 M→N 上涨」），否则「上涨」二字对新契约是误导报错。**倾向 A + 分措辞** |
| **P5** | **CLI 取基准的四个机制细节**（建议一并裁） | ① **默认基准算法**：契约 §3-2 说「与 `charter:recon` 的 BASE 语义一致」，但 recon skill 正文的 BASE 是「本分支的基线提交」，**没有给机械算法**（本轮实读 `~/.claude/skills/charter/skills/recon/SKILL.md`）——此处无现成算法可复用，必须自定。A=`git merge-base HEAD <默认分支>`，默认分支依次探 `refs/remotes/origin/HEAD` → `origin/main` → `origin/master` → `main` → `master`，全失败即降级；B=只认显式 `--base`，不给默认（省事但违背「缺省取 merge-base」的冻结文字）。**倾向 A**。② **基准 target 的版本门**：`git show <rev>:codegraph/target.json` 取到的旧版很可能是 **schema v1**（handoff 2026-08-22 前的 target 版本全是 1，本轮逐版本实测），而 `LoadTarget` 的版本门会拒 v1。A=宽松解析（`json.Unmarshal` 进 `codegraph.Target`；v1/v2 的 `contracts` 段形态与 `legacyBudget` 语义完全相同，本轮比对确认）；B=严格走版本门，v1 基准视同不可得（在「主线刚 migrate 完」的窗口期整片跳过棘轮）。**倾向 A**。③ **解析代码放哪**：A=CLI 内直接 `json.Unmarshal` 进已导出的 `codegraph.Target`（零新 API，不动契约面）；B=新增导出 `codegraph.ParseTarget([]byte)`（更内聚，但**是新接缝 → 退回 contract**）。**倾向 A**。④ **子目录仓**：`git -C <repo> show <rev>:codegraph/target.json` 冒号后的路径相对 **git 顶层**而非 `-C` 目录，`--repo` 指向子目录时会取错文件或 not found。A=先 `git -C <repo> rev-parse --show-prefix` 拼前缀；B=不处理，子目录场景直接走降级。**倾向 A** |
| **P6** | **`budget-raised` 的落点与降级提示的信道** | ① **findings 落哪**：A=CLI 把它们 append 进 `rep.Fails`/`rep.Warns` 后再打印（走既有「fails 非空 → 非零退出」单点，零 wire 结构变更；顺序确定性靠 `CheckBudgetRatchet` 按 `cur.Contracts` 切片序产出——`sortFindings` 未导出，CLI 无法重排全表，append 在尾部本身是确定的）；B=另开 JSON 段（**wire 增量，冻结清单未列 → 退回 contract**）。**倾向 A**。② **降级提示信道**：A=仅 stderr 一行（stdout JSON 零污染，沿 absorb 的既有信道惯例，`cli_test.go#runGraphSeparate` 已有分离断言样板）；B=同时在 Report JSON 里加机器可读的 skip 标记（**wire 增量 → 退回 contract**）。**倾向 A**，但须知代价：选 A 则「判据已跳过」对**机器消费方**仍不可见，只有人能看见 stderr——若拍板认为闸门消费方必须机读，本条就是 B 且必须退回 contract |
| **P7** | **handoff 消费侧升版是否属本刀范围** | handoff `go.mod` 钉 `github.com/Xsxdot/charter/graph v0.3.0` 且**无 replace**（本轮实读）。因此：新 CLI 二进制跑 `codegraph check --repo ~/workspace/handoff` 能立刻验零噪声（不需要动 handoff 一个字），但 handoff 自己的契约闸 `cmd/graph_gate_test.go#TestRepoContractGate` **要等 go.mod 升到新 tag 才获得新执法**。spec 与契约都没提这张卡（刀 1+2 的 T4 是同款活）。A=本刀含一张 S2 卡（tag `graph/v0.4.0` → handoff 升 go.mod → 全量绿），冻结 4 的两半都在本刀销账；B=本刀只交付工具与 CLI 侧真机验证，handoff 升版落 roadmap（与部署门第 4 条同批发版，省一次发版）。**倾向 B**，但这直接决定卡数与真机清单，必须协调者裁 |

> 七条中 P1/P2/P3/P4 是**语义**岔口（影响判据本身对不对），P5/P6 是**机制与 wire**岔口（P5③、P6① B、P6② B 三个选项会触发退回 contract），P7 是**范围**岔口。出稿方对每条给了倾向但一条未自批。

---

## 一、触及子系统清单（架构法第一条·派卡资格四条逐个核）

- **S1 = charter/graph**（codegraph 工具，canonical 家）：**逻辑型**——接缝对面全是自有代码，`codegraph` 包测试 + `cli` 包测试 + `testdata/repo` 夹具仓闭环。四条核：有界文件集 `graph/**` ✓；契约面可枚举（本刀冻结清单 22 条 + `Check`/`CheckBudgetRatchet` 两个签名 + 六个 kind 字面值）✓；对 S2 零依赖（依赖方向 handoff→graph 单向）✓；类型已标 ✓。
  - **卡内含一处边界型接缝**：T4 的 git 交互（`git merge-base` / `git show` / `rev-parse`）接缝对面是外部现实（git 仓状态、远端是否 fetch 过、是否 detached）。机内只验**注入点**（假值驱动）与**降级路径**，真实 git 行为归真机清单——这是 spec「测试决定」明文（「git 本身不进测试，不造 git 仓夹具」）。
  - **发版切面**（tag `graph/v0.4.0` → release workflow 六平台资产）是刀 0 T2 已建通道的复用，零代码改动，不成卡，纯真机清单项。
- **S2 = handoff**（跨仓消费侧）：**逻辑型**（若 P7=A 才成卡）——`go.mod` 升版后由 handoff 全量测试 + `cmd/graph_gate_test.go#TestRepoContractGate` 闭环。文件集 `go.mod`/`go.sum` 两个文件，极小。**若 P7=B 则本子系统本刀零卡**，只留真机清单一条（用新 CLI 对真仓跑读数）。

**跨子系统接缝只有一条**：`func Check(t *Target, v *View) *Report` 的签名（冻结 13）。它是 S1→S2 的唯一契约面，本刀**一个字不许动**——改了 S1 本仓不会有任何一支测试变红，破坏只在 S2 集成时暴露（契约 §5 拍板记录一的原话）。

---

## 二、契约增量核对

**结论：拆解未越界、无必须退回 contract 的新接缝——前提是 P5③、P6①、P6② 三处均按倾向选 A。** 任一处选 B（新增导出函数 / Report 新增 JSON 段）即为契约增量，必须退回 contract 走冻结变更，不许边拆边加。P1 选 C 同理（Diff schema 增量）。

### 冻结清单 22 条逐条分配

| 冻结条 | 归属卡 | 备注 |
|---|---|---|
| 1（dead-entry 取值口径）、2（dead-interface 取值口径）、3（dead-contract 判定）、5（三类进 Fails）、6（dead-rule 档位不变） | **T1** | 1/2 的口径细节受 P2 裁决，3 受 P3 裁决 |
| 4（handoff 真仓零噪声） | **真机清单 1**（机内半边落 T1 的真仓形态夹具） | 跨仓行为事实，机内夹具证不了真仓 |
| 7（prefix-family 判定）、8（Detail 含真实 LCP）、9（oversized-package 判定）、10（判据 1/2 进 Warns）、11（统计输入为视图文件集）、12（阈值不进 JSON schema） | **T2** | — |
| 13（Check 签名不变）、15（codegraph 包零 exec/git/基准读取） | **T1+T2+T3 共同守，review 逐条核** | 15 有可执行读法：`grep -rn "os/exec" graph/codegraph/` 零命中（本轮实测当前为零） |
| 14（base==nil 返回 nil）、18（JSON 键 + omitempty）、19（旧 target 零值不报错） | **T3** | — |
| 16（note 空 → Fails、非空 → Warns） | **产出半边 T3 / 分档半边 T4** | 分档由调用方执行是 §2-2 明文 |
| 17（over-budget 既有判定与档位不变） | **T1/T2/T3 的回归断言** | 正面回归：既有 `TestCheckTable` 的 over-budget/legacy 用例不改语义地保持绿 |
| 20（基准不可得时明示提示，不静默） | **T4** | 承重条款，配反静默正面断言 |
| 21（sortFindings 全序确定） | **T0** | — |
| 22（六个新 kind 与既有七个不冲突不复用） | **T1+T2 断言** | 既有七个实读为：fail 侧 `new-direction`/`off-interface`/`over-budget`，warn 侧 `legacy`/`outside-file`/`dead-rule`/`dead-assembly` |

### 边界澄清（不动冻结物；建议随拍板回写契约修订记录）

- **C1（归 P2 裁决）**：`dead-entry`/`dead-interface` 的存在性是否按子系统收窄。选 B 即比冻结文字更严，必须回写一行。
- **C2（归 P3 裁决）**：`dead-contract` 的「实际跨子系统边」是否含 implements 边与组装点豁免边。选 B 必须回写。
- **C3（归 P4 裁决）**：基准中缺席的契约算不算涨。无论 A/B 都建议回写一行——冻结 16 只规定了分档，没规定比对集合。
- **C4（归 P5②）**：基准 target 允许 schema v1。契约 §3-2 只说「取不到基准」的降级，没说「取到了但版本旧」——这是实测存在的第三态（handoff 2026-08-22 前全是 v1），必须给出明确处置并回写。
- **C5（新，建议回写一行）**：分档读的是**哪一侧**的 `LegacyBudgetNote`。契约 §2-2 写「该契约的 `LegacyBudgetNote`」未指明 cur/base。语义上只能是 **cur**（涨预算的人在新 target 里写理由），但文字有歧义，值得钉死。
- **C6（新，建议回写一行）**：`LegacyBudgetNote` 的「非空」是否含纯空白串。冻结 16 字面「非空」意味着 `" "` 也能降档——这是零成本的绕过口。建议 `strings.TrimSpace` 后非空才算，并回写。
- **C7（不越界，无需回写契约，但建议更正 spec 事实基础）**：spec §契约语义 2 称「消费方（handoff agentd 两条只读 API、Web 控制台）按 kind 分流」——**本轮实测不成立**：handoff 侧 `codegraph.Check` 的唯一在库消费者是 `cmd/graph_gate_test.go`（按数组遍历打印，不看 kind）；`internal/agentd/codegraph.go` 只消费 `LoadGraph/ListViews/CheckStale`；Web 前端对 `fails`/`warns` 零命中。冻结 22（新 kind 不与既有冲突）本身仍然成立且照做，但**其立法理由的事实基础需更正**，免得后人按「存在 kind 分流消费方」做出更强假设。
- **C8（实现自由度，归 plan）**：`View.Containers[cid]` 对不存在的 cid 返回零值 `Container{}`，Label 为 `""`——与「取不到 label」同形。`entries` 里若出现空串，必须明确报 `dead-entry` 而不是静默命中。
- **现状陷阱记录（非契约问题，但承重）**：`contractset.go#setContract` 走结构体拷贝（`updated := old`），因此 `contract set --budget` **会保留**既有 `LegacyBudgetNote`——即「写一次理由，此后经 CLI 涨预算永远只是 warn」。这不是违约（冻结 16 明文如此），但它是可预见的门禁绕过通道，T3 需要一条正面回归断言把这个行为钉住（而不是让它成为无人知晓的副作用），并建议落 roadmap（与 1e「预算必须紧贴现实」同批）。

### 现状读数复核（契约 §1-3 要求 implement 阶段对当轮工作树复核，本稿提前做完）

| 读数 | 契约记载 | 本轮复核 | 口径 |
|---|---|---|---|
| handoff `entries` 落空 | 0/26 | **0/26** ✓ | 全局口径与域内口径（P2 的 A/B）**双跑一致** |
| handoff `interfaces` 落空 | 0/0 | **0/0** ✓ | 真仓 interfaces 总数为 0；跨子系统 implements 边亦为 0 |
| handoff 死契约 | 0/23 | **0/23** ✓ | 只数 call 边与含 implements/豁免边（P3 的 A/B）**双跑一致** |
| fitness 判据 1 命中 | 4 组 | **4 组** ✓ | `internal/agentd`(bucket `proj`,5) / `internal/agentd`(`work`,6) / `internal/prochost`(`proc`,5) / `web/src/app/machines`(`Mach`,6) |
| fitness 判据 1 的真实 LCP | 「必须给真实最长公共前缀」 | **实测值：`project` / `work` / `proc` / `Machine`** | `Machine`（7 字符）与 `project`（7 字符）是冻结 8 的可验证靶子——截断实现只会输出 `Mach`/`proj` |
| fitness 判据 2 命中 | 2 个 | **2 个** ✓ | `cmd`(41) / `internal/agentd`(61) |
| 复现口径 | — | **文件集 = 全部非 deleted 节点的 `File` 去重，不按子系统过滤、不按扩展名过滤** | 按子系统过滤会漏掉 `web/src/app/machines` 那组；本口径与 spec 记载的 4 组/2 包逐条吻合 |

**推论（重要）**：P2 与 P3 的 A/B 选择**对 handoff 真仓零噪声断言（冻结 4）没有任何影响**——两种口径下三类新 fail 均为 0。所以这两条可以按语义正确性自由裁，不必为噪声让步。

---

## 三、子卡清单 + 依赖 DAG

> 五张卡（T5 视 P7 裁决启用）。落点高度集中在 `check.go` + `fitness.go` + `cli.go` 三个文件，轻档单执行者**串行**执行；卡的边界按「判据族」切，不按文件切，故同文件多卡是有意为之——顺序即冲突消解。

### T0【S1·逻辑型】`sortFindings` 全序 tiebreak（顺带了结项，必须排第一）

- **契约引用**：§3-3、冻结 21；roadmap 第 5 条。
- **意图与为什么**：现比较器只按 `Kind`+`Detail`，`slices.SortFunc` 不稳定，撞键即输出抖动。**必须排在 T1/T2 之前**：本刀新增的六类 finding 会大量制造 Kind+Detail 撞键（最典型的是同一方向多条边的 `new-direction`——Detail 是 `跨子系统方向 X→Y 无契约条目`，同方向逐字相同，只有 Edge 不同，这一撞键**今天就可达**），先修排序，T1/T2 的顺序敏感断言才站得住；反过来先加判据，会用不确定的输出去做金样本，假红假绿两头都可能。
- **行为化验收**（机内）：
  1. 构造同方向 ≥3 条 `new-direction`（Kind+Detail 逐字相同、Edge 不同）的夹具，`Check` 连跑两次，`json.Marshal(rep)` 结果**逐字节相等**；
  2. **外部尺**（不是同一次运行比自己）：把同一份输入的 `v.Edges` 反序后再跑，输出仍与正序结果**逐字节相等**——只有真的补了 From/To/Edge tiebreak 才能过，仅靠「恰好稳定」过不了；
  3. `go test ./... -count=1` 全绿，既有 `TestCheckTable`/`TestCheckExemptionsAndWarns`/`TestCheckDeadAssembly` 语义零改动。
- **入口指针（有界）**：`graph/codegraph/check.go#sortFindings`、`graph/codegraph/check_test.go`。

### T1【S1·逻辑型】漏建对账三类进 `Check`

- **契约引用**：§1 全部、冻结 1/2/3/5/6/13/15/17/22；spec 用户故事 1。依赖 T0。
- **意图与为什么**：让 `check` 回答第二个问题——「说好要建的缝建成没有」。判定对象取自视图、与既有判据同源（不另读 baseline），是为了让 handoff 契约闸这类**直接调 `Check` 两参**的消费方零改动获得新执法。三类均判 fail 是交接文档原文「漏建即非零退出」。
- **行为化验收**（机内，逐条可独立判）：
  1. `dead-entry`：某契约 `entries` 含图中不存在的 label → **恰 1 条** fail（条数断言，防「把所有 entries 都报一遍」这种实现，照 `TestCheckDeadAssembly` 先例），Detail 同时含该 label 与所属契约方向；同 target 中存在的 label 不产生任何 finding；
  2. `dead-entry` 的 deleted 语义：entry 容器的节点全部 `Status="deleted"` 时的处置按 P2 裁决落地并有断言（照 `TestCheckDeadAssemblyIgnoresDeletedNodes` 的先例口径）；空串 entry 报 `dead-entry` 而非静默命中（C8）；
  3. `dead-interface`：同款三条（不存在 → 恰 1 条；存在 → 不报；Detail 含接口名与契约方向）；
  4. `dead-contract`：声明方向零「实际跨子系统边」→ fail，Detail 含 `from→to`；有边 → 不报。**「实际边」的集合按 P3 裁决**：选 B 则须有三条正面断言——只有 implements 边的方向算活、只有组装点豁免边的方向算活、两者皆无才判死；
  5. 三类全部进 `rep.Fails`、`rep.Warns` 里零命中（冻结 5）；
  6. 既有 `dead-rule` 的条数、档位、文案零变化（冻结 6 的正面回归）；`over-budget`/`legacy`/`new-direction`/`off-interface`/`outside-file`/`dead-assembly` 六者同样零变化（冻结 17 与 22 的回归半边）；
  7. kind 字面值断言：三条 finding 的 `Kind` 逐字等于 `fitness.go` 的 `KindDeadEntry`/`KindDeadInterface`/`KindDeadContract`，且与既有七个字面值集合**无交集**（冻结 22）；
  8. `Check` 签名逐字不变（冻结 13）——本卡不得新增参数，review 逐字核；
  9. **零噪声正面断言**（冻结 4 的机内半边）：造一份真仓形态夹具（多子系统 + 多契约 + entries 全部命中真实容器 label + 每个声明方向都有实际边）跑出 **0 条新增 fail**——这是「判据没有把好人当坏人」的唯一机内证据；
  10. **既有绿测试会变红的三处，本卡负责处置，处置方式是改夹具不改断言语义，且每处在提交信息或注释里写明为什么原夹具本就该报/不该报**：
      - `cli/cli_test.go#TestGraphCheck`（夹具仓唯一跨域边 `n_runE→n_do` 是组装点豁免边，P3=A 时死契约 → 红；P3=B 时保持绿）；
      - `codegraph/check_test.go#TestCheckTable` 的「域内边不检查」用例（`twoDomainTarget` 声明了 `d_a→d_b` 但只给了域内边 `b1→b2`，零跨域边 → 无论 P3 选 A 还是 B 都会报 `dead-contract`）——**这条是判据的真阳性，处置是把该用例的 target 改成不声明契约，不是给 dead-contract 开后门**；
      - `codegraph/check_test.go#TestCheckImplements`（只有 implements 边、零 call 边；P3=A 时红，P3=B 时绿）。
- **入口指针（有界）**：`graph/codegraph/check.go`（`Check` 内新增对账段 + `Finding` 文档注释补新 kind）、`graph/codegraph/fitness.go`（判定函数落此文件或 check.go，归 plan）、`graph/codegraph/check_test.go`、`graph/codegraph/testdata/repo/codegraph/target.json` + `baseline.json`（夹具处置）、`graph/cli/cli_test.go`（`TestGraphCheck` 处置）。

### T2【S1·逻辑型】fitness 判据 1/2 进 `Check`

- **契约引用**：§2-1、§2-3、冻结 7/8/9/10/11/12/13/15；spec 用户故事 2。依赖 T0；与 T1 无逻辑依赖，但同改 `check.go`，串行在 T1 之后。
- **意图与为什么**：把架构法第三条里两条**可机械化**的判据从人工核对里解放出来。取 warn 档是因为法条要求的是「必须回答」而非「必须修复」。只看图内文件集是为了保住 `Check` 的纯函数性——代价（图未覆盖的文件不计入）已在契约 §2-3 明写，本卡必须在报文里把这个局限**说给用户听**，不能只留在文档里。
- **行为化验收**（机内）：
  1. `prefix-family` 阈值双面：同目录 5 个共享前 4 字符的文件 → **恰 1 条 warn**；同条件 4 个 → **零条**（`≥5` 的边界正反两面）；共享 3 字符的 5 个文件 → 零条（`≥4` 的边界）；
  2. **分目录**：同前缀但分处两个目录，各 3 个 → 零条（判据是「同一目录内」）；
  3. basename 短于 4 字符的文件不参与分组、不 panic（边界）；
  4. **冻结 8 的唯一有效锁**：夹具组的真实 LCP 必须**严格长于 4 字符**（如 `Machine*.tsx` 六个文件），断言 Detail 含 `Machine` 且**不**等于/不止于 `Mach`——LCP 恰为 4 的夹具证不了「没回显截断值」；
  5. `oversized-package`：某目录 40 个文件且图文件集中无更深层目录 → 恰 1 条 warn；39 个 → 零条；40 个但文件集中存在该目录的子目录文件 → 零条；
  6. 文件集口径：`Status="deleted"` 的节点的文件**不计入**（与既有 `allFiles` 收集口径一致）；**图外文件计入**（不按子系统过滤——否则真仓复现不出 `web/src/app/machines` 那一组，见 §二读数表）；
  7. 两类只进 `rep.Warns`，`rep.Fails` 零命中（冻结 10）；
  8. 不读文件系统（冻结 11）：判定函数入参只有 `*View`（或其文件集），测试在 `t.TempDir()` 之外的空环境下照跑；
  9. 阈值不出现在任何 JSON（冻结 12）：`Target` 序列化的键集合断言无阈值字段；Report 序列化里也不回显阈值为独立字段（可出现在人读 Detail 文案中）；
  10. kind 字面值等于 `KindPrefixFamily`/`KindOversizedPackage`，与既有七个无交集（冻结 22）；
  11. `Check` 签名不变（冻结 13）；`grep -rn "os/exec" graph/codegraph/` 仍零命中（冻结 15）。
- **入口指针（有界）**：`graph/codegraph/fitness.go`（判定函数）、`graph/codegraph/check.go`（调用点）、新 `graph/codegraph/fitness_test.go`、`graph/codegraph/check_test.go`。

### T3【S1·逻辑型】`CheckBudgetRatchet` 纯函数 + 理由字段行为

- **契约引用**：§2-2、§3-1、冻结 14/15/16（产出半边）/18/19；spec 用户故事 3。与 T1/T2 无依赖，可并可串。
- **意图与为什么**：`legacyBudget` 今天只执法「实际 ≤ 预算」，不执法「预算不得增长」——涨预算是绕过一切约束的现成后门。棘轮因为需要基准 target 而走独立函数，不动 `Check` 签名（契约 §5 拍板记录一）。基准由调用方注入，是为了让本函数保持纯函数、让 `codegraph` 包保持零 git。
- **行为化验收**（机内）：
  1. `base == nil` → 返回 `nil`（冻结 14，字面断言 nil 而非空切片）；
  2. 某契约预算 `3 → 8` → 恰 1 条 finding，`Kind == KindBudgetRaised`，Detail 含 `from→to` 与旧值、新值两个数字；
  3. 持平、下降 → 零条；base 有而 cur 无的契约（契约被删）→ 零条；
  4. base 中缺席的契约按 P4 裁决落地并有断言；选 A 时**措辞区分**须有正面断言（新增契约的 Detail 与既有契约上涨的 Detail 文案可区分）；
  5. **「不判档」正面断言**：函数返回的所有 finding 同属一个 Kind，函数**不读** `LegacyBudgetNote` 做任何分流——构造「涨了且有 note」与「涨了且无 note」两份输入，断言函数返回结果**完全相同**（防实现顺手把分档做进包里，违反 §2-2 与冻结 15 的职责切分）；
  6. **产出顺序确定**：按 `cur.Contracts` 切片序遍历（不遍历 map），同输入两次调用返回切片逐条相等；
  7. `Contract.LegacyBudgetNote` 的 JSON 键为 `legacyBudgetNote` 且 `omitempty`（冻结 18）：空值序列化后该键**不出现**、非空值出现，双向断言；
  8. 旧 target（无该字段）经 `LoadTarget` 读入 → 该字段零值、零错误（冻结 19）；
  9. 空白串处置按 C6 裁决（若定 `TrimSpace`，须有 `" "` 不算理由的断言）；
  10. **现状陷阱回归**：写了 note 的契约经 `contract set --budget` 改预算后，note 仍在（钉住 `contractset.go#setContract` 的结构体拷贝行为，让「一次理由永久降档」成为可见的、被测试记录的事实，而非无人知晓的副作用）；
  11. `grep -rn "os/exec" graph/codegraph/` 零命中（冻结 15）。
- **入口指针（有界）**：`graph/codegraph/fitness.go#CheckBudgetRatchet`、新/扩 `graph/codegraph/fitness_test.go`、`graph/codegraph/target_test.go`（omitempty 与旧 target 兼容）、`graph/codegraph/contractset_test.go`（陷阱回归）。

### T4【S1·逻辑型 + 边界型接缝】CLI 基准取值、注入、分档与降级

- **契约引用**：§3-2、冻结 16（分档半边）/20；spec 用户故事 4/5、测试决定「次缝」。依赖 T3。
- **意图与为什么**：棘轮的另一半在 CLI：取基准（git）、注入、按 `LegacyBudgetNote` 分档、以及**取不到时明示降级**。降级明示是承重条款——「判据失效」与「判据通过」不可区分正是本条存在的理由。git 交互是边界型接缝：机内只验注入点与降级路径，真实 git 行为归真机。
- **行为化验收**：
  - **机内**（注入点用假值驱动，不造 git 仓夹具）：
    1. 「取基准」是一个可在测试中替换的包内接缝（函数变量/小接口，形态归 plan），测试直接喂假 `*Target`；
    2. 有基准 + 上涨 + `LegacyBudgetNote` 为空 → finding 出现在输出 JSON 的 `fails` 数组，`check` **非零退出**（冻结 16 前半）；
    3. 同输入但 note 非空 → 出现在 `warns` 数组，退出码 **0**（冻结 16 后半）；
    4. 取不到基准 → **stdout 仍是合法 Report JSON 且不含 `budget-raised`**，**stderr 含明示提示**（按 P6② 裁决的信道），退出码由其余 fails 决定；用 `runGraphSeparate` 做 stdout/stderr 分离断言，正面锁 stdout 零污染（既有样板 `cli/cli_test.go#runGraphSeparate`）；
    5. **反静默正面断言**：降级且无其他 fails（退出 0）的场景下，stderr **必须非空**——这条专门挡住「跳过 = 静默通过」；
    6. `git show` 等失败时的错误原因进得了提示文案（不吞原因）；
    7. `--base <rev>` 显式指定生效（假注入层面验「显式值优先于默认推导」）；
    8. **flag 状态复位**：新增 flag 进 `graphResetState()`——cobra 测试同进程复用命令树，漏复位则上一次的 `--base` 泄漏到下一次；断言「连跑两次、第二次不带 `--base` 时走默认路径」；
    9. 既有 CLI 行为回归全绿：`TestGraphCheck`、`TestGraphCheckMissingTargetFails`（无 target 仍拒绝执行）、`TestGraphTargetVersionGate`（v1/v3 仍指向 migrate）、`TestGraphCommandCountIncludesMigrate`（**命令总数仍 14，本刀不新增子命令**——契约弃选「reconcile 独立子命令」的可执行锁）；
    10. `cli/deps_test.go` 保持绿（零新第三方依赖；`os/exec` 是标准库）。
  - **未验证，需真机**（归真机清单）：默认分支推导（`origin/HEAD` 探测）、`merge-base` 计算、`git show <rev>:<prefix>codegraph/target.json` 的子目录前缀、detached HEAD / 未 fetch 主线 / 首次提交 / 非 git 目录四种真实降级触发。
- **入口指针（有界）**：`graph/cli/cli.go`（`graphCheckCmd` 的 RunE、新增基准取值函数与 flag 注册、`graphResetState`；git 调用与既有 `gitHead`/`gitBranch` 同处）、`graph/cli/cli_test.go`。

### T5【S2·逻辑型】handoff 消费侧升版（**视 P7 裁决启用；P7=B 则本卡不存在**）

- **契约引用**：冻结 4（跨仓半边）。依赖：T0~T4 合并主线 + tag `graph/v0.4.0` 推成（协调者动作）。
- **意图与为什么**：handoff 的契约闸 `TestRepoContractGate` 直接调 `Check` 两参，升版即自动获得三类漏建执法与两类 fitness warn，零代码改动。
- **行为化验收**（机内 = handoff 仓内）：
  1. `go.mod` 含 `github.com/Xsxdot/charter/graph v0.4.0` 且 `grep -c '^replace' go.mod` = 0；
  2. handoff 根 `go build ./... && go vet ./... && go test ./... -count=1` 全绿，含 `cmd/graph_gate_test.go#TestRepoContractGate`；
  3. `codegraph check --repo .` 读数：**fails 0**，**warns 26**（= 既有 19 legacy + 1 dead-assembly + 新增 4 prefix-family + 2 oversized-package；刀 1+2 记录的基准是 20 warns）；执行者把前后 JSON 记进 ledger。
- **入口指针（有界）**：`handoff/go.mod`、`handoff/go.sum`、`handoff/cmd/graph_gate_test.go`（只读复核，不改）。

### 依赖 DAG

```
T0（排序 tiebreak，必须最先）
 ├──→ T1（漏建三类）──┐
 └──→ T2（fitness 1/2）┤   （T1/T2 同改 check.go，串行；彼此无逻辑依赖）
                        ├──→ [协调者：合并主线 → tag graph/v0.4.0 → 真机 1~5]
T3（棘轮纯函数）──→ T4（CLI 取基准/分档/降级）──┘                    │
                                                                    └──→ T5（视 P7=A 启用）
```

轻档单执行者建议顺序：**T0 → T1 → T2 → T3 → T4**。T3/T4 与 T1/T2 文件集不相交（`fitness.go`+`cli.go` vs `check.go`），若将来改重档可并行两条线，但 T0 对两条线都是前置。

---

## 四、缺陷族对抗审查（结论已进各卡验收栏，此表供把关）

| 族 | 回答 |
|---|---|
| **生命周期/状态机中断** | 本刀**零写盘路径**（check 只读，棘轮只读 git），无守护进程、无孤儿资源、无原子写需求。唯一真状态是 **CLI 包级 flag 单例**：新增 `--base` 必须进 `graphResetState()`，漏了则同进程连跑两次 check 时上次的 `--base` 泄漏——cobra 测试正是同进程复用命令树（`cli.go#graphResetState` 的既有注释就是为此写的）。锁在 T4⑧ |
| **静默失败/误导报错** | 六点：①降级明示（冻结 20）是本族头号条款，T4④⑤ 正反两面断言；②`git show`/`merge-base` 失败的原因不得吞掉（T4⑥）；③**P6① 若选 A，「判据已跳过」对机器消费方仍不可见**——已置顶为岔口，不由出稿方消化；④dead-* 报文必须点名是哪条契约的哪个声明值，否则「声明了但没建成」无从定位（T1①③④）；⑤`View.Containers[未知 cid].Label` 返回 `""`，与「取不到 label」同形，空串 entry 须显式处置（C8，T1②）；⑥P4 选 A 时「新契约首现即带预算」若也说成「上涨」是误导报错，须分措辞（T3④） |
| **跨平台假设** | 四点：①`git show <rev>:<path>` 冒号后的路径**恒用 `/`**，不得用 `filepath.Join` 拼——Windows 下拼出 `\` 而 git 不认（P5④ 落地时的具体陷阱）；②图数据里的文件路径是 `/` 分隔的仓内相对路径（`target.go#SubsystemOf` 注释明文「不做 filepath 转换」），fitness 的目录/basename 切分必须用 `path` 包而非 `path/filepath`，否则 Windows 上 `internal/agentd` 切不出目录；③前缀家族取「前 4 字符」按 **rune** 不按 byte——非 ASCII 文件名（中文/emoji）按字节切会切碎 UTF-8，Detail 里出现乱码。真仓 449 个文件全 ASCII（本轮实测），故这条是防御性要求，需夹具正面覆盖；④零 CGO 六平台不变式与 `cli/deps_test.go` 既有锁不受影响（`os/exec` 是标准库） |
| **假红/假绿测试** | 八点：①T0② 的**乱序输入外部尺**（不是同一次运行比自己）；②T1① 的**条数断言**（防「把所有声明都报一遍」照样绿）；③T2 的阈值**正反两面**（5 报 / 4 不报、40 报 / 39 不报、共享 3 字符不报）；④**T2④ 是冻结 8 的唯一有效锁**——夹具 LCP 必须严格长于 4 字符（`Machine`），否则「回显 4 字符截断」的错误实现照样绿；⑤T3⑤ 的「不判档」正面断言（构造两份只差 note 的输入，断言返回完全相同）；⑥T4⑤ 的「降级退出 0 时 stderr 必须非空」；⑦**T1⑩ 点名了三处会由绿转红的既有测试**，处置纪律是**改夹具不改断言语义、每处写明理由**——否则「把测试改绿」就成了掩盖判据错误的通道，而这三处里 `TestCheckTable/域内边不检查` 恰恰是判据的**真阳性**；⑧夹具世界证不了真仓，零噪声（冻结 4）与 fitness 真仓读数一律进真机清单 |
| **门禁绕过** | 五点：①`LegacyBudgetNote` 是**永久降档**——写一次理由，此后该契约预算可一路上涨且永远只是 warn，且 `contract set --budget` 会保留 note（`contractset.go#setContract` 结构体拷贝，本轮实读）。这是冻结 16 明文，本刀照做，但 T3⑩ 要把它钉成可见事实，并建议落 roadmap（与 1e「预算必须紧贴现实」同批）；②降级路径本身是绕过通道——无 git 环境下棘轮恒跳过，只有 stderr 提示拦着（P6 的实质）；③三类新 fail 全部走既有 `len(rep.Fails)>0 → 非零退出` **单点**，不另开退出路径（T1⑤ + T4②）；④本刀**不新增子命令**（命令总数仍 14，T4⑨），杜绝「多一个要记得调用的地方」；⑤**handoff 契约闸要等 go.mod 升版才获得新执法**（P7）——在此之前真仓执法只发生在人手动跑 CLI 时，这是范围岔口而非实现缺陷 |
| **序列化边界** | 四点：①Report JSON 新增的是六个 **kind 值**（值不是键），旧消费方按数组遍历不受影响——本轮实测 handoff 侧无按 kind 分流的消费者（见 C7），故风险实为零，但冻结 22 的「不冲突不复用」仍要断言；②`LegacyBudgetNote` 的 omitempty 双向断言（冻结 18/19，T3⑦⑧）——「缺失 vs 空串」在此同形且语义相同（都不降档），可接受；③`contract set` 整写 target（`json.MarshalIndent` 全量重写），新字段经它往返不得丢失（T3⑩）；④棘轮的基准 target 经 `git show` 拿到的是**原始字节**，穿的是真实序列化边界——P5② 的版本门决定了 v1 字节能否解析，这是本刀唯一一处「跨版本反序列化」，须有明确处置 |
| **枚举新值过白名单** | 六个新 kind 在本仓与跨仓**都没有 switch 消费方**（本轮实测），故无白名单需要扩；`Finding.Kind` 本身无校验白名单，这是既有形态，本刀不改。真正的「枚举面」是 `LegacyBudgetNote` 的**空/非空二值**——它不是枚举，任意非空串（含 `" "`）都降档，见 C6 与 T3⑨。另：schema `meta.version` 白名单（只认 2）在 `LoadTarget` 单点，本刀的基准解析若绕开它（P5② 选 A）**等于给基准 target 开了第二条读径**——这是有意为之的例外，须在代码注释里写明理由，并且**只用于取 `contracts` 段**，不得用该路径喂任何执法输入 |
| **承重安全属性** | 无 token / 一次性凭据 / 隔离面。承重不变式四条及其锁：①**`Check` 签名冻结**（冻结 13）——跨仓消费面，唯一在库消费者 `handoff/cmd/graph_gate_test.go#TestRepoContractGate`，改了本仓零测试变红，review 必须逐字核；②**`codegraph` 包零 git / 零 exec / 零基准文件读取**（冻结 15）——可执行读法 `grep -rn "os/exec" graph/codegraph/` 零命中（当前实测为零），棘轮基准只经参数注入；③**stdlib-only + 仅 cobra**（`cli/deps_test.go` 既有锁）——本刀零新依赖；④**输出确定性**（冻结 21）——T0 |

---

## 五、真机清单（归协调者/用户；「未验证，需真机」条目全集）

1. **零噪声上线断言（冻结 4，跨仓行为事实）**：T0~T4 合并后用新二进制跑 `codegraph check --repo ~/workspace/handoff`，断言 **`dead-entry`/`dead-interface`/`dead-contract` 三类 fail 各 0 条、fails 总数仍为 0**。机内夹具证不了真仓；本稿已用脚本预推为 0（且在 P2/P3 两种口径下双跑一致），但**脚本不是被测代码**，须以真二进制为准。
2. **fitness 真仓读数复核**：同一次运行断言 `prefix-family` **恰 4 条**（`internal/agentd`×2、`internal/prochost`、`web/src/app/machines`）、`oversized-package` **恰 2 条**（`cmd` 41、`internal/agentd` 61），且四条 Detail 里的真实 LCP 分别为 `project`/`work`/`proc`/`Machine`。多于或少于此数须查明（口径 bug 或基线漂移），不许照单全收。warns 总数应由 20 → **26**。
3. **棘轮真实 git 路径（T4 的边界型半边）**：在 handoff 仓造一个改了 `legacyBudget` 的临时分支 → `codegraph check --repo ~/workspace/handoff` 断言 `budget-raised` 命中且非零退出 → 给该契约加 `legacyBudgetNote` → 断言降为 warn 且退出 0 → 还原（**变异复验**，acceptance 纪律）。
4. **四种真实降级触发**：①非 git 目录、②detached HEAD、③未 fetch 主线（`origin/HEAD` 不可解析）、④首次提交（无 merge-base）——四种都断言 **stderr 有明示提示、stdout 是合法 Report JSON、退出码不因跳过而变成 0 的假通过**。第 ③ 种可用 `git clone --depth 1` 或删 remote 制造。
5. **v1 基准的真实窗口（C4/P5②）**：从 handoff 一个 2026-08-22 前的提交（target 为 schema v1，本轮逐版本实测确认存在）拉分支跑 check，断言按 P5② 裁决的行为（选 A：棘轮照常比对；选 B：明示跳过）。这条不做，v1 窗口的行为就是纯推测。
6. **发版通道**：合并主线后推 tag `graph/v0.4.0`，观察 release workflow 六平台资产 + checksums 齐（刀 0 T2 通道复用，零代码改动）；协调者本机 `go install .../graph/cmd/codegraph@graph/v0.4.0` 可用。**注意**：本机 `~/go/bin/codegraph` 的版本须先确认，别拿旧版冒充新版验读数（刀 1+2 真机 2 踩过这个坑）。
7. **（P7=A 时）handoff 升版后的闸门行为**：`go test ./... -count=1` 全绿且 `TestRepoContractGate` 在新执法下仍 0 fails——这是「新执法真的接进了跨仓闸门」而非「CLI 单机能跑」的唯一证据。

---

## 六、图覆盖债

charter/graph 仓自身无代码图，本稿 charter 侧引用一律 `file#Symbol` 锚并经**直接实读**核验：`graph/codegraph/check.go`（`Check`/`sortFindings`/`inList`/`ruleHitsAny` 全文）、`fitness.go`（全文）、`target.go`（全文）、`types.go`（`Node`/`Container`/`Graph`/`Diff` 全文）、`merge.go`（`View`/`Merge`）、`absorb.go`（`Absorb` 容器克隆）、`validate.go`（容器引用检查两处）、`contractset.go`（全文）、`migrate.go`（v1 形态）、`check_test.go`（全文）、`cli/cli.go`（`graphCheckCmd`/`gitHead`/`gitBranch`/`graphResetState`/`init`）、`cli/cli_test.go`（harness 与 check 相关用例）、`cli/deps_test.go`（全文）。handoff 侧引用（`cmd/graph_gate_test.go#TestRepoContractGate`、`internal/agentd/codegraph.go`、`go.mod`、`codegraph/target.json`、`codegraph/baseline.json`、`docs/codegraph-scan-recipe.md`）经实读与脚本实测；`~/.claude/skills/charter/skills/recon/SKILL.md` 全文实读（P5① 的依据）。

**本稿为混仓文档**：`codegraph resolve --doc` 的单仓语义会把另一仓的锚报 file_missing，机械复核不适用，自检以实读为准。新增未命中符号：无。

---

## 交稿自检

1. **产出四样齐全**：触及子系统清单（§一）✓ / 契约增量核对（§二，22 条逐条分配 + 8 条边界澄清 + 现状读数复核）✓ / 子卡清单 + 依赖 DAG（§三，5 张卡四段式齐）✓ / 缺陷族对抗审查（§四，8 族逐族正面回答，无一句「无风险」带过）✓。
2. **「待拍板」岔口集中列成清单放稿首** ✓（7 条，含各自的实测代价与倾向，零自批）。
3. **「未验证，需真机」条目已汇总成真机清单** ✓（§五，7 条）。
4. **每张子卡的有界文件集核过** ✓：T0（2 文件）、T1（6 文件）、T2（4 文件）、T3（4 文件）、T4（2 文件）、T5（3 文件，其中 1 只读）。

---

## 拍板结果（协调者，2026-08-23）

出稿质量核过：上游状态位实读、每条岔口带实测代价、零自批、有界文件集逐卡核过。七条岔口裁决如下，**全部已回写契约 §7（提交 `57a7d335`），下游以契约为准**。

| 岔口 | 裁决 | 理由 |
|---|---|---|
| **P1** | **C（退回 contract，给 Diff 加 `containersAdded`）** | 协调者独立复核三处代码属实，且问题比出稿描述更大：contract 节点「骨架符号入图」与 recon「补齐视图 diff」对新容器场景**今天就不可满足**。`dead-entry` 在分支报红不是误报——图里确实没有那条缝，沉默它等于粉饰。A（接受局限）会让 fail 级闸门长期报红、终被忽略或关掉。已按 R1 落 additive 增量（照 lifecycle 先例），Ticket 0 已补字段并编译通过 |
| **P2** | **B（按子系统收窄）** | 全局口径会造出「对账过了但 check 仍判违规」，正是契约 §1-1 点名要避免的失败模式；实测零代价。→ R2 |
| **P3** | **B（call ∪ implements ∪ 组装点豁免边都算活）** | 字面读法在库里即转红两支既有测试，且 DI 绑定边恰是「缝建成了」的证据；实测零代价。→ R3 |
| **P4** | **A + 分措辞** | 新增存量债同样要有理由；但「上涨」二字对新契约是误导报错，报文必须区分。→ R4 |
| **P5** | **①A ②A ③A ④A** | ③ 选 A 正是为了不新增导出 API、不再触发退回；② 的 v1 宽松解析加了两条约束（只取 contracts 段、注释写明是版本门的有意例外）。→ R5、R9 |
| **P6** | **①A ②A** | ② 核过契约原文：§3-2 要求「明示提示」而非「机器可读」，且当前无 check JSON 的机器消费方。→ R9 |
| **P7** | **B（handoff 升版落 roadmap）** | 零噪声断言用新 CLI 二进制直接跑 handoff 仓即可验证，不需动 handoff 一个字；go.mod 升版与部署门同批发版，省一次发版周期 |

**三条契约张力的处置**：张力 1（`dead-entry` 分支冲突）→ P1=C 修根因；张力 2（P3 字面读法转红）→ P3=B；张力 3（「消费方按 kind 分流」实测无实例）→ 裁决不变、**理由已更正**（R8）。六条边界澄清 C1~C6 已分别落 R2/R3/R4/R5/R6/R7。

### 卡清单调整（因 P1=C）

原 T0~T4 保持，**新插一张 TC 卡**，位于 T0 之后、T1 之前（`dead-entry` 的分支可清零依赖它）：

**TC【容器增量】`Diff.containersAdded` 全链路**
- **契约引用**：§7-R1；冻结 23~28、29。
- **意图**：让分支视图能表达新建容器。这不是刀 3 专用——它同时补上 contract 节点骨架入图与 recon 补齐职责对新容器场景的空洞。照 刀 1+2 lifecycle 段的四处落点模式做。
- **验收**（行为化，逐条独立可验）：
  1. 带 `containersAdded` 的 diff 经 `Merge` 后，`View.Containers` 含该容器（金样本断言 id 与 Label）；
  2. `NodesAdded` 引用只存在于 `containersAdded` 的容器时 `ValidateDiff` **不报问题**（红测试先落：当前实现必报「引用不存在的容器」）；
  3. `containersAdded` 的 id 已在 baseline 存在时 `ValidateDiff` 报问题（不静默覆盖）；
  4. `containersAdded` 的容器无 domain、或 domain 不在 baseline 时 `ValidateDiff` 报问题；
  5. `absorb` 后该容器进 baseline.Containers，视图消费清空，`validate` 仍绿；
  6. Graph/Diff 的 JSON 键集合 additive-only 断言不破（沿 刀 1+2 T2⑤ 的既有外部尺）。
- **入口指针**（有界，4 文件）：`graph/codegraph/types.go`、`merge.go`、`validate.go`、`absorb.go`（＋各自 `_test.go`）。
- **缺陷族补答**：序列化边界——`containersAdded` 走 diff→Merge→View→absorb→baseline 全链路，每处新投影都要断言（验收 1/5/6 即是）；假红假绿——验收 2 必须先看红且红因是「功能缺失」而非 typo；门禁绕过——本卡放宽的是 `ValidateDiff` 的容器检查，**只对 `containersAdded` 内的 id 放宽**，对真正未知的容器仍必须报（验收 2 与既有测试并存即证）。

**调整后 DAG**：`T0（sortFindings tiebreak）→ TC（容器增量）→ T1（漏建三类）→ T2（fitness 1/2）→ T3（棘轮纯函数）→ T4（CLI 接线）`；T5（handoff 升版）按 P7=B **不启用**，落 roadmap。

**真机清单**：出稿的 7 条照收，其中第 5 条（v1 基准窗口）按 P5②=A 断言「棘轮照常比对」。另因 P1=C 增补一条：**新容器类入口在分支内可清零**——造一个带 `containersAdded` 的真实分支 diff，`check --view <分支>` 的 `dead-entry` 应为 0。

**交棒**：plan（轻档单轮实现）。
