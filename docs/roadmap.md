# Roadmap（残余账本）

> 排序判据：先骨架后血肉；每期以可真机验收为界。一行一条、注明来源；下一期开工 = 取条目重走 spec 门。

1. ~~codegraph 刀 3+4 批次~~ **已完成（2026-08-23）**：漏建对账三类（`dead-entry`/`dead-interface`/`dead-contract`，fail 档）+ fitness 判据两条（`prefix-family`/`oversized-package`，warn 档）+ `legacyBudget` 棘轮（git 与主线比对、理由字段降档）+ **`Diff.containersAdded` 修根因**（分支视图此前无法引入新容器，contract 的「骨架符号入图」与 recon 的「补齐视图 diff」对新容器场景一直是空的）。真机 8 条全执行：真机 1 首次运行即抓到 handoff 真缺陷（见 handoff 卡 B206）。spec/契约(R1~R10)/breakdown/plan/review/ledger 全部入库。
1a. **领域声明铺满**：机制与 2 份样板（d_coordination_task / d_workspace）已随刀 1+2 落地，**余 17 域按卡增量补写声明**；生命周期数据面已铺满（127 条入库，无需重扫）。来源：刀 1+2 spec OOS。
1b. **Web 控制台 lifecycle/声明展示**（handoff 侧）：baseline 附加段与 domains/*.json 的 UI 消费。来源：刀 1+2 spec OOS。**（2026-08-23 并入第 10 条查看器刀，不再单列。）**
1c. **扫描配方文档 canonical 化**（是否移 charter 仓与法工具同居）：另议。来源：刀 1+2 spec OOS。
1d. **charter 修法配套（刀 3+4 落地后）**：integrate/acceptance 引用漏建对账、architecture-law 标注哪几条判据已机械化。来源：刀 3+4 spec OOS-1（与第 7 条同源，工具落地后一并做）。
1e. **「预算必须紧贴现实」判据**：`legacyBudget` 远高于实际命中数时报「松弛过大，应调低」——与棘轮互补的另一半。来源：刀 3+4 spec OOS-2。
1f. **命中 fitness 判据后的实际整改**：`internal/agentd`（61 文件）、`cmd`（41 文件）的竖切还债，判据交付后按卡排期。来源：刀 3+4 spec OOS-3 与本轮实测。
1g. **dead-rule 与新增漏建判据的档位是否统一**：前者 warn、后者 fail，语义确有差别（规则没命中文件 vs 声明的东西没建成），是否对齐另议。来源：刀 3+4 spec OOS-4。
1h. **handoff 扫描配方新增 `containersAdded` 段说明**：刀 3+4 的契约 §7-R1 给 `Diff` 加了容器增量段，配方（`handoff/docs/codegraph-scan-recipe.md`）需同步说明，否则 AI 扫描者不会产出该段。来源：刀 3+4 契约 R1 交棒欠账（与 lifecycle 那次同款）。
1i. **handoff 消费侧升到刀 3+4 版本**：`go.mod` 从 `charter/graph v0.3.0` 升到新 tag，handoff 自身契约闸才获得漏建/fitness 执法。按 P7=B 与部署门第 4 条同批发版，省一次发版周期。来源：刀 3+4 breakdown P7 裁决。
1j. **`TestSortFindingsIsTotalOrder` 补更锋利的用例**：现用例每条 finding 的 `Edge` 均不同，只废 From/To 两级时仍绿——补一组 `Edge` 全 nil、仅 From/To 不同的用例可定位到级。来源：刀 3+4 review M3（Minor，不阻塞）。
2. ~~B173 尾部（handoff 侧）~~ **已完成（2026-08-22 晚）**：`feat/b173-contract` 已并 main（efd8345a6），契约闸自 B173 落红后首次全绿（0 fails/20 warns）；breakdown T4⑥「16 条钉死」口径随之归零。
3. ~~codegraph 门控增强 v0.2.1~~ **已完成（2026-08-22 晚，契约 R7、tag graph/v0.2.1）**：判据三/四落地（TDD+变异复验），真机再揪 2 条手工漏网假边（基线 4524→4522），handoff 已升版全绿；M3 生效验证同轮核销（release run 零缓存告警）。
3a. ~~codegraph 刀 1+2（schema v2 + 领域图）~~ **机内与数据面已完成（2026-08-22 深夜，tag graph/v0.3.0）**：T1~T4 零修正归档、handoff 消费侧过桥（target v2 + 配方 lifecycle + 2 份样板声明）、真机 1~5 核销、全量补扫 127 条回灌 baseline（handoff main 408cd9125）。余部署门见第 4 条。契约 `docs/contracts/2026-08-22-codegraph-schema-v2-domains-contract.md`、账本 `docs/ledgers/2026-08-22-codegraph-schema-v2-ledger.md`。
4. **部署门（刀 0 + 刀 1+2 合并，同因同解）**：需从 handoff main（≥408cd9125）发新 tag → `handoff upgrade --now --target linux-01` → agentd/fleet 重启（归用户排期）。待验：刀 0 #7 执行机 SessionStart hook、#8 Web 控制台渲染复验；刀 1+2 真机 6（lifecycle/声明落库后控制台三段照常渲染）、真机 7（升级后 hook 注入照常）。刀 0 #4（无 Go 设备 install.sh）已于 2026-08-22 晚在 linux-01 干净环境实测通过。来源：刀 0 与刀 1+2 真机清单。
5. ~~graph check 报告输出顺序非确定~~ **已完成（2026-08-23，随刀 3+4 T0）**：`sortFindings` 比较器补 From/To/Edge 三级 tiebreak，`TestSortFindingsIsTotalOrder` 守护；真机 8 复验三次运行输出同一 md5。
6. **`handoff graph` 别名移除时点**：deprecated 观察期后另行裁决。来源：刀 0 契约 §4。
7. **charter 修法配套（工具落地后）**：architecture-law 术语节销账、integrate/acceptance 补图 diff 对账条款、spec/plan 补领域图引用；**增补 ⧉ 跨子系统领域判决三选一条款**（故意共享内核→写进领域声明留痕 / 扫描归属错→改配方 / target 划分错→重划路径）与「现状图职责=诚实、目标图职责=指路」原则。来源：四刀批次交接文档 Out of Scope 第 1 条；⧉ 条款来源：2026-08-23 roadmap 前置讨论。
8. **目标图刀（子系统→领域终态，图批次第一优先）**：target schema 增「目标领域」节；handoff 最优目标图 AI 出稿、用户拍板、冻结入 target；gap 判据与棘轮（baseline 对照目标域计违规，`legacyBudget` 同款只减不增）。**原则：先终态后差分**——迁移 diff 按卡从 target 反推，acceptance = gap 下降；产出直接给 1f（agentd 竖切还债）当蓝图。概念裁决：「逻辑域」不设，层级仍是 子系统→领域，语义重划一律落目标侧。**spec 已出（2026-08-23，卡 C1.1，待批准）**：`docs/specs/2026-08-23-codegraph-target-domains-spec.md`——目标领域嵌在子系统下（结构上不可能跨子系统）、归属规则=路径规则、gap 三判据并入 check、一期只切 `d_controlplane`/`d_cli` 两个重灾区。来源：2026-08-23 roadmap 前置讨论（原型副本 handoff `prototypes/codegraph-subsystem/`）。
8a. **目标领域的「关键契约面」字段**：本条原文列了它，spec 裁决砍出本期——领域级契约执法是另一整刀，放一个不执法的字段会诱导人填了以为有效。待领域级契约执法立项时一并设计。来源：C1.1 spec OOS。
8b. **目标领域嵌套（`parent`，二级目标域树）**：一期平铺（子系统下一层），等真实案例。来源：C1.1 spec OOS。
8c. **「落错域」判据与 baseline↔target 的 id 映射表**：一期只算「未落位」，落位即正确；要算落错就得引入映射表，而映射表本身会腐烂。来源：C1.1 spec OOS。
8d. **专门的 gap 报告命令 / JSON 导出**：一期只出 check findings；查看器（第 10 条）若需结构化取数，届时再定形态。来源：C1.1 spec OOS。
8e. **其余 8 个子系统的目标领域树**：一期只切两个重灾区，其余等各自的迁移需求触发（未声明 = 不执法）。来源：C1.1 spec OOS。
8f. **子系统之间 paths 规则重叠不检测**（既存缺口，非本期新增）：`ValidateTarget` 无此查，`SubsystemOf` 按声明序首次匹配静默裁决。C1.1 只给新增的目标领域补了同级不重叠判据。**已立卡 `C2`**。来源：C1.1 spec 事实调查。
9. **配方刀（瘦身版，服务 gap 测量诚实性）**：model 分种 entity/dto/config；声明锚归属判据；proto wire 类型建「协议契约」域 `d_protocol` 归还契约子系统。**不做**「把现状域拆好看」——那是拐杖，方向已否。**spec 已出（2026-08-23，卡 C1.2，待批准）**：`docs/specs/2026-08-23-codegraph-recipe-honesty-spec.md`。两处相对讨论的更正：①锚归属判据从 validate 改放 **check 的 warn 档**（validate 全体系无分档，硬红会逼出「改声明迁就现状」的拐杖；handoff 今天就有 14 条：2 条锚不在本域 + 12 条锚不在图内）；②领域划分**没有增量通道**（diff 明确不改 domains），故 `d_protocol` 走**全量重扫**落地，与 modelKind 存量打底同一趟。实测数据更正：全仓 707 model 仅 **53** 有生命周期（「194/11」是 `d_coordination_task` 域内口径）；`d_contract` 子系统主属领域数 **0**。来源：同第 8 条讨论。
9a. **`lifecycle.field` 不校验**：creator 多填 field、writer 漏填 field 都静默（`validate.go#validateLifecycle`）。独立小判据。来源：C1.2 spec OOS。
9b. **节点 `kind` 三值抽常量**：`entry`/`func`/`model` 今天是全仓裸字符串字面量（8 个文件），机械重构，与配方刀正交故不顺手做。来源：C1.2 spec OOS。
9c. **扫描配方是否覆盖 `codegraph/domains/*.json`**：领域声明是人写的语义承诺，让扫描者生成会得到一堆正确但空洞的话；将来若要走派发产出再议。来源：C1.2 spec OOS。
9d. **`web/src/api/**` 的 119 个 TS 类型是否独立成域**：目前混在 `d_web`；先分种（dto），成域与否等目标图。来源：C1.2 spec OOS。
9e. **`entity` 无 lifecycle 从「统计」升格为执法的时点**：等 1a 领域声明铺满到一定比例。来源：C1.2 spec OOS。
10. **查看器刀（讨论中称刀 6，吸收 1b；卡 `C1.3`，被 C1.1/C1.4 阻塞）**：形态基准 = handoff `prototypes/codegraph-subsystem/` 副本 + `pages/order-flow-demo.html` 订单样例——首层架构全景按子系统（类型徽标/领域 chips/聚合边）、主属规则（领域只在主属子系统立卡，他处 ⧉ 引用卡）、组织可切按子系统/按领域、领域页双 tab（语义 = 职责/不变式测试锚/状态机流程图/生命周期锚+机械层实体表/主调用链；结构 = 流程泳道式（订单样例）+ 调用链级联面板 + 焦点链）、视图语法三条（只画行为、外部领域一域一节点、高扇入工具收桩）；**终态新增「目标 vs 现状对照」视图**（按目标图排布、现状映射、违规高亮，依赖第 8 条）；走查否决项：DFS 调用链长墙、容器级聚合作主视图。**本条已拆两半（2026-08-23）**：CLI 去噪与装配器下放独立成第 12 条（卡 `C1.5`）。**2026-08-24 再拆两期**：一期（理想树全景 + 对照 + gap 读数上墙）spec 已出（`docs/specs/2026-08-24-codegraph-viewer-compare-spec.md`，主视角=理想树、报告宿主算、缺席即回退三裁决在内）；**二期残余**=领域页双 tab（语义/结构）、订单样例泳道、级联调用链面板、1b 声明 UI 消费、组织切换，留在本条排队；**一期已合并（2026-08-24，charter master a3990d26 + handoff main 1d1df6701，原型基准已回流）**。二期新增候选（2026-08-24 一期走查）：欠账读数醒目化——预算顶格的 N/N 显示成绿看不出「602 笔直调债待还」的距离感，窄缝覆盖率/直调余额要做成欠账读数。来源：同上。

10b. **嵌套层内边与圈外卡依赖子域级契约数据**（C1.9 真机读数，非缺陷）：契约面今天只到子系统级（36 条方向全在顶层），子系统内部层的层内边与圈外占位卡因此为空——查看器如实不画，不造示意值。B233 绞杀式逐边立 client 时子域级 entries/预算会自然出现，查看器无需改动即上墙。来源：C1.9 acceptance 真机。

10a. **扫描补职责面（handoff 侧，二期数据依赖）**：二期要展示「这一组是干什么的 / 每个容器职责与边界」，但 baseline 无 `packages` 节（包 doc 注释零数据源）、容器仅 `label/kind/domain/entry` 四字段、`model` 节点 summary 覆盖仅 32%（类型 doc 未抓）。需改扫描配方 + baseline schema，与 B220 扫描盲区（cmd/ 漏 9 文件）同族，宜合并一趟重扫。来源：2026-08-24 一期走查（用户问「这一组是干什么的」无数据可答）。
11. **前端搬迁刀（讨论中称刀 5，排第 10 条动工前；卡 `C1.4`）**：codegraph 查看器前端源码入 charter 仓（`graph/webui/`，构建产物 go:embed 成独立包），handoff 升 go.mod 同源挂载 + iframe 嵌入（契约面收窄为两条只读 API + `?project=`）；顺带修 `/codegraph` 不在 Shell fullPageRoute 白名单的现存挤压 bug；`codegraph serve` 独立命令另议（涉契约 §5「不发网络」不变式修订，不混入本刀）。**spec 已出（2026-08-23，卡 C1.4，待批准）**：`docs/specs/2026-08-23-codegraph-webui-extraction-spec.md`——构建产物**提交进 charter 仓**（跨 module 消费下 go:embed 只能拿到已提交文件，handoff 的 build tag + gitignore 形态不成立）+ CI 防漂移门；宿主契约面 = 两条只读 API + 同源挂载 + iframe URL 的 `?project=`（**措辞更正**：两条 API 保持路径参数 `{name}` 不动，`?project=` 是给查看器的不是给 API 的）；本刀是**等价搬迁不改像素**，形态改造全归第 10 条。来源：同上。
11a. **404 语义结构化**：前端按中文文案 `'未生成代码图'` 匹配 404 分支（`CodegraphPage.tsx` 的 `NOT_SCANNED` 与 `internal/agentd/codegraph.go` 两处 grep 联动），跨仓之后更脆。本刀原样保留。来源：C1.4 spec OOS。
11b. **两条只读 API 的响应体瘦身**：今天一次性返回整份 baseline + 全部视图 diff + stale（handoff 量级 3564 节点 / 1.7MB），合并渲染全在前端。第 10 条若要按域取数/分页再议。来源：C1.4 spec OOS。
11c. **charter 前端子工程的完整质量门**：一期 CI 只做 test + build + 防漂移比对，eslint/typecheck 全套后补。来源：C1.4 spec OOS。
11d. **两条 API 的项目参数是否从路径参数改 `?project=`**：本刀裁定不动（改它要动 handoff 的路由与 `forwardIfRequested` 转发逻辑）。来源：C1.4 spec OOS。
12. **CLI 去噪与上下文装配器（卡 `C1.5`，从第 10 条拆出）**：`chain` 默认瘦身 + `--full` 兜底、`--fold-external` / `--collapse-util` 默认开、`--with-source`（`ReAnchor` 本就把整文件读成行数组再丢掉）、`--max-tokens` 默认 30000 且截断必须显式报 `truncated`、新子命令 `codegraph context <领域>` 一击式领域包。**spec 已出（2026-08-23，待批准）**：`docs/specs/2026-08-23-codegraph-context-assembler-spec.md`。实测账：`chain` 默认 depth 2 从真实 hub 出发吐 **56006 字节 ≈ 18.7k token**，其中 36~42% 是 `tests` 数组，`params`/`returns` 与 `signature` 完全冗余。顺手修三件：`--stale` 只对结果子集跑（今天对全图 3564 节点跑）、`Edges` 输出漏过滤 `deleted`、删死字段 `TestRef.Snippet`（1518 条全空无写入方）。**skill 文档同步是交付物之一**。不被结构性阻塞，与第 9 条是收益依赖（领域画错则 `context` 打包的是噪声包）。来源：原第 10 条后半。
12a. **`who-calls` 与 `chain` 的双向合并**：`Neighborhood` 本就支持同时给 up/down，今天没有命令用。来源：C1.5 spec OOS。
12b. **按 kind / 域 / 文件前缀过滤查询结果**（`--kind` / `--domain`）：先看去噪默认够不够。来源：C1.5 spec OOS。
12c. **查询结果缓存 / 索引加速**：今天每次全量加载 baseline（handoff 量级 1.7MB 尚可）。来源：C1.5 spec OOS。
12d. **`summary` 命令与 SessionStart 的接线名实不符**：它注释自称「供 SessionStart hook 注入会话上下文」，实测 hook 注入的是 `using-charter` 全文，**从未调用它**。来源：C1.5 spec 事实调查。
11e. **JS 侧依赖白名单测试**（对标 `graph/cli/deps_test.go#TestModuleDependencyAllowlist`）：C1.4 拍板前端 manifest 走最小依赖集（只留查看器真 import 的包，版本照抄 handoff 现用值），但没有机械门防它以后悄悄长胖。charter 是公共工具仓，依赖面要能一眼看完。来源：2026-08-23 C1.4 拆解稿 P2 拍板。
12e. **agent 轮次的量化统计**（ledger 侧统计同类任务的查询轮次）：C1.5 用字节数做硬判据，轮次作观察项。来源：C1.5 spec OOS。
13. **最优图 best.json（卡 `C1.8`，实现完成 2026-08-24）**：用户对「目标图」的定义更正——真正要的是**最优图 `best.json`**，「基于当下代码实现的功能，最优的子系统/领域结构应该是什么样」，作为 `baseline.json` 的姊妹文件。契约已冻结并按回写扩展至条 1~86：`docs/contracts/2026-08-23-codegraph-best-graph-contract.md`。形态：best.json 接管整棵结构树（**子系统即顶层领域**），target.json 瘦成 v3 契约面（`contracts` + `assembly`），归属决议改走容器→领域→子系统；四条 gap 判据全部 warn、不新增棘轮，真正不可伪造的进度条由最优图下的边合法性与 `legacyBudget` 承担，`unplacedBudget` 删除。实现包含 T1~T10：Check/CLI 已接管 best，T7 完成 target v3 门禁，migrate 分两跳生成 v2/v3 与 best 双产物，`domains --edges` 输出现状/最优跨领域边矩阵；T11 文档对齐随本提交完成。来源：2026-08-23 用户更正与 C1.8 实现。
13a. **`contracts[].from/to` 的引用完整性无独立校验**：`ValidateTarget` 读不到 best.json，无法自校验方向引用的子系统是否存在；本期下沉为 check 期既有 `dead-contract` 行为（引用不存在的子系统 = 没有边归到它 = 该条目死掉）。独立校验留后。来源：C1.8 spec OOS。
13b. **best.json 的编辑体验**（查看器里改归属、批量重挂）：239 条容器归属靠手改 JSON 可行但不好用。与已搁置的 C1.3 查看器刀同族，一并再议。来源：C1.8 spec OOS。
13c. **`DomainStat.Subsystems` / `CrossSubsystem` 是零消费者死字段**：C1.8 拆解实测——`graph/webui/src` 对这两个 wire 字段全部零命中（C1.4 把前端搬进 charter 后，它就是唯一消费方）。删它是跨仓可见的 wire 变更，超出 C1.8 范围，故 C1.8 冻结条 85 明写「保留不动」。与 C1.5 记的 `TestRef.Snippet`（1518 条全空）同族，将来一并清。来源：C1.8 breakdown 待拍板 5。


13d. **`misplacedSkipped` 是 C1.6 的进度读数**：C1.8 acceptance 真机实测——用 migrate 机械翻译出的 best.json 跑 handoff 全量图，`bestCoverage` 报 `misplacedSkipped: 125`。成因是两套领域词表并存：视图侧 20 个领域（来自 `codegraph/domains/` 声明），best 侧只有 10 个（机械翻译自旧 target 的子系统）；容器的视图领域不在 best 词表里时按冻结条 61 跳过比较，不产 `container-misplaced`。**这个数就是「best.json 还没真正覆盖结构」的刻度**：C1.6 手写 handoff 的 best.json 时它应显著下降，降不下来说明词表仍未统一。同期读数：`assignedContainers 232 / viewContainers 233`（未认领的是 `c_main`）、`crossDomainEdges 775`。来源：2026-08-24 C1.8 acceptance 真机。

13e. **换 best.json 的词表 = 必须同刀重写 target.json 的 contracts**（C1.6 的硬前置，2026-08-24 实测发现）：契约面是用**子系统 id** 表达的，best.json 换一套顶层领域 id，target 的 `contracts[].from/to` 就集体悬空。实测——把 fable-5 出的草案（12 个顶层领域）放进 handoff 跑 check：**953 条 fail**（907 `new-direction` + 22 `dead-contract` + 24 `dead-entry`），而机械翻译版（沿用旧 10 个 id）是 0 fail。根因不是草案质量差，是它的 12 个 id 与 contracts 引用的 9 个旧 id **只交集 2 个**（`d_cli`/`d_ledger`）：边界一挪，原本跨子系统的边要么落进新方向（无契约条目→`new-direction`）、要么缩回域内（老条目没边了→`dead-contract`、入口没跨域入边了→`dead-entry`）。**结论：C1.6 不是「写一个 best.json」，是「写 best.json + 按新词表重写 contracts + 重定 legacyBudget」三件一体**，分开做中间态必然全红。与 13a（`contracts[].from/to` 无独立引用完整性校验）同源——那条校验若存在，这个耦合会在 validate 期就报出来，而不是等到 check 吐 953 条。来源：2026-08-24 C1.8 acceptance 之后的 C1.6 垫底实测。
14. **内部锁量化上限**：接缝预算执法上线后，「内部锁」（测试不指回声明缝、声明理由后合法的例外）暂无每卡数量上限——先让两张真卡过流程攒出内部锁的真实分布，再决定要不要设上限与阈值。来源：2026-08-24 接缝预算执法 spec 的 Out of Scope。
