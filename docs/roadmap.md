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
10. **查看器刀（讨论中称刀 6，吸收 1b；卡 `C1.3`，被 C1.1/C1.4 阻塞）**：形态基准 = handoff `prototypes/codegraph-subsystem/` 副本 + `pages/order-flow-demo.html` 订单样例——首层架构全景按子系统（类型徽标/领域 chips/聚合边）、主属规则（领域只在主属子系统立卡，他处 ⧉ 引用卡）、组织可切按子系统/按领域、领域页双 tab（语义 = 职责/不变式测试锚/状态机流程图/生命周期锚+机械层实体表/主调用链；结构 = 流程泳道式（订单样例）+ 调用链级联面板 + 焦点链）、视图语法三条（只画行为、外部领域一域一节点、高扇入工具收桩）；**终态新增「目标 vs 现状对照」视图**（按目标图排布、现状映射、违规高亮，依赖第 8 条）；走查否决项：DFS 调用链长墙、容器级聚合作主视图。**本条已拆两半（2026-08-23）**：CLI 去噪与装配器下放独立成第 12 条（卡 `C1.5`）。**2026-08-24 再拆两期**：一期（理想树全景 + 对照 + gap 读数上墙）spec 已出（`docs/specs/2026-08-24-codegraph-viewer-compare-spec.md`，主视角=理想树、报告宿主算、缺席即回退三裁决在内）；**二期残余**=领域页双 tab（语义/结构）、订单样例泳道、级联调用链面板、1b 声明 UI 消费、组织切换，留在本条排队；**一期已合并（2026-08-24，charter master a3990d26 + handoff main 1d1df6701，原型基准已回流）**。**二期已完成（2026-08-24，卡 C1.9）**：嵌套同构下钻 + 迁移视角对照 + 欠账读数，A 组顺延三期。**三期 spec 已批准（2026-08-24，卡 `C1.10`；状态更正于 2026-08-25，C9 个案销账）**：`docs/specs/2026-08-24-codegraph-viewer-semantics-spec.md`——领域页语义/结构双 tab、泳道锚改「入缝」而非 `entry`（实测 21/23 个域 entry 为 0）、级联抽屉深度 3 级、组织切换、宿主响应新增 `decls` 段；形态基准 `handoff/prototypes/codegraph-phase3/`（真数据派生）。二期新增候选（2026-08-24 一期走查）：欠账读数醒目化——预算顶格的 N/N 显示成绿看不出「602 笔直调债待还」的距离感，窄缝覆盖率/直调余额要做成欠账读数。来源：同上。

10b. **嵌套层内边与圈外卡依赖子域级契约数据**（C1.9 真机读数，非缺陷）：契约面今天只到子系统级（36 条方向全在顶层），子系统内部层的层内边与圈外占位卡因此为空——查看器如实不画，不造示意值。B233 绞杀式逐边立 client 时子域级 entries/预算会自然出现，查看器无需改动即上墙。来源：C1.9 acceptance 真机。

10a. **扫描补职责面（handoff 侧，二期数据依赖）**：二期要展示「这一组是干什么的 / 每个容器职责与边界」，但 baseline 无 `packages` 节（包 doc 注释零数据源）、容器仅 `label/kind/domain/entry` 四字段、`model` 节点 summary 覆盖仅 32%（类型 doc 未抓）。需改扫描配方 + baseline schema，与 B220 扫描盲区（cmd/ 漏 9 文件）同族，宜合并一趟重扫。来源：2026-08-24 一期走查（用户问「这一组是干什么的」无数据可答）。
11. **前端搬迁刀（讨论中称刀 5，排第 10 条动工前；卡 `C1.4`）**：codegraph 查看器前端源码入 charter 仓（`graph/webui/`，构建产物 go:embed 成独立包），handoff 升 go.mod 同源挂载 + iframe 嵌入（契约面收窄为两条只读 API + `?project=`）；顺带修 `/codegraph` 不在 Shell fullPageRoute 白名单的现存挤压 bug；`codegraph serve` 独立命令另议（涉契约 §5「不发网络」不变式修订，不混入本刀）。**spec 已出（2026-08-23，卡 C1.4，待批准）**：`docs/specs/2026-08-23-codegraph-webui-extraction-spec.md`——构建产物**提交进 charter 仓**（跨 module 消费下 go:embed 只能拿到已提交文件，handoff 的 build tag + gitignore 形态不成立）+ CI 防漂移门；宿主契约面 = 两条只读 API + 同源挂载 + iframe URL 的 `?project=`（**措辞更正**：两条 API 保持路径参数 `{name}` 不动，`?project=` 是给查看器的不是给 API 的）；本刀是**等价搬迁不改像素**，形态改造全归第 10 条。来源：同上。
11f. **handoff 宿主侧挂载（卡 `C1.7`）spec 已出（2026-08-24，待批准）**：handoff `docs/superpowers/specs/2026-08-24-codegraph-host-mount-spec.md`——照 C1.4 plan T4 全文执行，三处更正：①升的不是 v0.4.0 而是含二期 webui 的新 tag（master 相对 graph/v0.6.0 有 19 文件 webui 增量）；②验收从「等价搬迁不改像素」改为「换代到二期形态 + 逐屏可用」；③删除文件清单按当轮工作树重数。真机需重打包 handoff 并重启 agentd，须避开在飞派发。
11a. **404 语义结构化**：前端按中文文案 `'未生成代码图'` 匹配 404 分支（`CodegraphPage.tsx` 的 `NOT_SCANNED` 与 `internal/agentd/codegraph.go` 两处 grep 联动），跨仓之后更脆。本刀原样保留。来源：C1.4 spec OOS。
11b. **两条只读 API 的响应体瘦身**：今天一次性返回整份 baseline + 全部视图 diff + stale（handoff 量级 3564 节点 / 1.7MB），合并渲染全在前端。第 10 条若要按域取数/分页再议。来源：C1.4 spec OOS。
11c. **charter 前端子工程的完整质量门**：一期 CI 只做 test + build + 防漂移比对，eslint/typecheck 全套后补。来源：C1.4 spec OOS。
11d. **两条 API 的项目参数是否从路径参数改 `?project=`**：本刀裁定不动（改它要动 handoff 的路由与 `forwardIfRequested` 转发逻辑）。来源：C1.4 spec OOS。
12. **CLI 去噪与上下文装配器（卡 `C1.5`，从第 10 条拆出）**：`chain` 默认瘦身 + `--full` 兜底、`--fold-external` / `--collapse-util` 默认开、`--with-source`（`ReAnchor` 本就把整文件读成行数组再丢掉）、`--max-tokens` 默认 30000 且截断必须显式报 `truncated`、新子命令 `codegraph context <领域>` 一击式领域包。**spec 已出（2026-08-23，待批准）**：`docs/specs/2026-08-23-codegraph-context-assembler-spec.md`。实测账：`chain` 默认 depth 2 从真实 hub 出发吐 **56006 字节 ≈ 18.7k token**，其中 36~42% 是 `tests` 数组，`params`/`returns` 与 `signature` 完全冗余。顺手修三件：`--stale` 只对结果子集跑（今天对全图 3564 节点跑）、`Edges` 输出漏过滤 `deleted`、删死字段 `TestRef.Snippet`（1518 条全空无写入方）。**skill 文档同步是交付物之一**。**2026-08-24 复活并复核修订**（spec 文末「2026-08-24 复核修订」节）：读数重测——`chain` 默认输出从 56006 涨到 **81409 字节 ≈ 27k token**（B231 把 summary 覆盖率从 48% 拉到 82.5%），拟裁字段合计占 **48.4%**；四处裁决更新——`TestRef.Snippet` 现有渲染方（webui 三处）故删除范围变大、`context` 取视图词表而非最优词表（两套 id 只交集 11 个，给错词表须报出差异）、实体表的 C1.2 依赖已兑现、`context` 净增包 doc 摘要段。不被结构性阻塞，与第 9 条是收益依赖（领域画错则 `context` 打包的是噪声包）。来源：原第 10 条后半。
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
15. **纪律块版本化与跨机分发**：charter 的 7 个纪律块今天无版本、无审计、无分发通道，已实测跨机 md5 漂移（linux-01 与本机不同），agentd 版本也不同批。归 **handoff 卡 B229（高优先）**。C4+C6 本期只做仓内真源与本机安装，不碰多机同步——没有真源，同步无从谈起，顺序不能倒。来源：2026-08-24 charter 自举 spec 的 OOS-3。
15a. **「账本 vs 仓」比对能否进 CI**：不能直接进——该比对需要本机 handoff 账本，GitHub runner 上没有。可进 CI 的是另一件事：仓内自洽性检查（`skills/` 正文经 regen 后的纪律块是否与已提交产物一致），但那要求把纪律块产物提交进仓，是一个独立决定（与 C1.4 把 `dist` 提交进仓同族），本期不开。来源：同上，OOS-4。
15b. **`skills/` 与 `scripts/` 的 CI 覆盖**：今日 `.github/workflows/ci.yml` 的 paths 过滤只含 `graph/**`，方法论正文与脚本无任何 CI 门，charter 自举脚本的测试本期只在本地跑。仓里已有可照抄的门形态（ci.yml 的「Reject stale committed dist」：rebuild → diff → 拒绝）。来源：同上，OOS-5。
15c. **acceptance 节点是否该有纪律块**：`scripts/regen_discipline.py` 的 compose 映射含七个派发节点，不含 acceptance（它是人工列、不派发），导致写在 acceptance 的纪律执行者永远读不到——「变异必须编译得过」就这样落在了现场够不着的地方。本期用「正文移到 implement + acceptance 改引用」绕过；根治要给人工列也发纪律块，那是改流程形状，另议。来源：同上，OOS-6。
16. **`regen_discipline.py` 的原子写**：今天逐文件写（`scripts/regen_discipline.py:36-41`），写到第 4 个失败会留下 3 新 + 4 旧的半装纪律块，且无退出码语义。改临时文件 + rename。来源：2026-08-24 C4+C6 拆解稿缺陷族「生命周期」族。
16a. **从 handoff 配置发现 discipline 目录**：`regen_discipline.py:9` 硬编码 `~/.handoff/discipline`，而 handoff 的 DataDir 是可配的（`internal/config/config.go:46`，配置文件而非环境变量）。DataDir 非默认时 regen 会**装错地方且无告警**。本期只给手动覆盖口（`--out`），自动发现留后。来源：同上，「跨平台假设」族。
16b. **「改仓再装」的绕过入口无法技术性封堵**：改流程有两条路——改仓跑 install（合规）与直接 `handoff workflow put`（绕过）。charter 侧堵不住第二条（handoff 是通用工具、不认识 charter），唯一防线是 `check` 事后发现 + 单向纪律写进文档。**本期明确保留此敞口，不假装已解决。**来源：同上，「门禁绕过」族。

17. **不变式测试锚的执行态**：查看器三期把不变式与它的 `testRef` 上了墙，但「那支测试上次是绿是红」图里没有数据源。要做得引入测试结果数据面（CI 产物或本地跑测记录）。来源：C1.10 spec OOS。
17a. **状态机与结构 tab 互相印证**：声明的每条迁移边应能高亮到结构 tab 里那个「✎ 写状态」的步骤。依赖 `lifecycle.field` 的准确性，而它今天不校验（见第 9a 条）——两条一起做才有意义。来源：C1.10 spec OOS。
17b. **级联走出域边界**：三期的级联抽屉止于本域，跨域看的是端口列。真要跨域级联，得先定「跨到外域之后按什么粒度收桩」，否则又是长墙。来源：C1.10 spec OOS。
17c. **领域声明词表的归属裁决**（C1.10 spec 第四条推荐 A / 备选 B）：声明键今天在**视图**领域词表上（覆盖 2/20），而查看器画布是**最优树**，两套 id 只交集 11 个，`d_coordination_task` 的容器实测散在 7 个最优域。推荐把声明迁到最优词表（应然文本挂应然结构），代价是 charter 改一处校验 + handoff 两份声明重写（其中一份必须拆写）。**已裁决（用户 2026-08-24）：取 A**——声明键迁到最优词表，与 `ValidateDecls` 改校 best 同刀做完；`d_workspace` 直接改键，`d_coordination_task` 重写为 `d_orchestration` 而**不机械拆成 7 份**（声明是承诺，拆出来的是假承诺），落在其他域内的不变式删掉并归入第 1a 条。本条随 C1.10 落地销账。来源：C1.10 spec 事实调查。
18. **handoff 仓 b185-contract 欠账补核对**：该契约文档缺 Ticket 0 骨架、编译证据与交棒声明证据表（「待实现清单（本轮不落码）」形态，2026-08-25 审计具名，同期其余 5 份 contract 全合规）——跨仓事项，归 handoff 卡处理（宜在 handoff 账本立卡）。来源：C9 载体法 spec OOS-1。
18a. **拍板独立性观察项**：两份拆解稿（schema-v2 六岔口、viewer-compare 五岔口）协调者裁决全按出稿倾向，快速盖章形态——不立法，先攒事故样本；真出裁决质量事故再议是否立「拍板理由不得复述出稿原文」类条款。来源：C9 载体法 spec OOS-2。
18b. **载体条款的机械执法**：lint 文档头部状态行格式、冻结清单条目数/原子性检查——载体法本期纯文本立法，工具化等条款跑过几张真卡再定形态。来源：C9 载体法 spec OOS-3。
18c. **C9 载体法生效检查（观察条目）**：各条款跑过 ≥3 张真卡后或下次文档对齐审计（先到为准），按 C9 spec「生效判据与负优化信号」节逐条核——breakdown 状态行零失真、契约清单窄接缝、spec 无内部落点/读数进台账、台账有真实过程内容；命中负优化信号（移交区变第二清单、contract 频繁退 spec 索名、台账空转、判例表僵化）即回炉对应条款。检查时顺手清本文件残留的状态短语失真（C9 review Minor-1 具名 ≥4 处：第 8/9/11/12 条的 C1.1/C1.2/C1.4/C1.5 仍写「待批准」而各 spec 头部均已批准；C1.7 在 handoff 仓未核）。检查结论回写本条销账。来源：C9 载体法 spec G 条款自持 + C9 review Minor-1。
18d. **「法条零案例」原则是否补自仓先例出口**：C9 review Minor-3——spec 定级表 L1 条引「先例：seam-budget、C9 载体法」、README 第七条引「2026-08-25 审计」，与「法条零案例……不引任何真实项目路径」存在张力。协调者裁决（2026-08-25，记 C9 台账）：charter 仓自身的修法先例是法的判例（同「判据数字即先例」），不构成违反；是否在该原则里写显式出口，留下次修法一并定。来源：C9 review Minor-3。
18e. **provision check 测试耦合本机安装态**：`test_charter_provision.py` 的 `test_check_never_writes_ledger` 走真实 `check()`，其纪律块比对段读真实 `~/.handoff/discipline`——任何「仓已修法、线上未装」的窗口（新分支、新机器）必红（C9 finish 实测：mock 了账本读、没 mock 块目录）。宜给 check 注入 out 目录或测试内自装临时块。来源：C9 finish 第 1 步实测。
19. **`context` 的 token 预算只管主链、不管整包**（C1.5 验收实测）：`--max-tokens 30000` 圈的是主调用链，包摘要/接口清单/实体表不在预算内。实测 `context d_coordination` 主链 29438 token 撞上限并如实报 `truncated{atDepth:3,droppedNodes:16}`，但整包 119015 字节 ≈ 40k token——读数诚实，总量仍可能超出调用方预期。要么给整包加第二层预算，要么在报文里显式给出整包估算。契约本就把预算圈在主链上，故这不是缺陷，是下一期的形态问题。来源：2026-08-25 C1.5 acceptance 真机。
20. **两条流程缺陷已立卡，见账本**：`C7`（charter 仓内真源的派发模板 `target` 为空，自举安装把可派发的 v4 覆盖成必然失败的 v5，而漂移检查报「一致」——检查的是一致不是可用）、`C8`（review 节点越轨：审阅轮改了 401 行代码并自审自批，`charter-review.md:38` 的只读纪律今天只有文字、无机械执法）。两条都是 2026-08-25 推 C1.5 时实测撞上的。来源：C1.5 推进实录。
21. **查看器原型与源码分居两仓**：查看器源码在 charter（`graph/webui`），其形态基准原型在 handoff（`prototypes/codegraph-phase3/`）。charter 侧的 review 执行者结构上看不见原型，于是每一轮都重复报「原型副本缺失、逐屏对照未验证」——C1.10 为此白费了两轮。两条出路：把查看器原型移到 charter（形态基准跟着源码走），或把「跨仓原型对照」显式写成协调者职责并从 review 纪律里摘掉。来源：C1.10 review 第一、二轮实测。
22. **入库 dist 被 tailwind 自扫，构建产物自我污染**：`graph/webui/dist/` 入库，而 tailwind v4 的自动源探测会扫仓库里的 dist 自身，于是每次构建都从上一版 bundle 里「捡」回一批源码根本没用到的类名（实测 `.hidden`/`.blur`/`.resize`），CSS 只增不减。修法是把 dist 排除出源探测。来源：C1.10 合并前 dist 可复现性核查（干净树重建 CSS 比入库版小 1264 B）。
23. ~~领域页 `no-inbound-seams` 空态未写样式~~ **已销账（2026-08-27，C12 实现轮）**：旧 `BestDomainPage` 已退役；新结构轴容器/领域空态有显式 className 与文案。来源：C1.10 真机复验。
24. ~~`semantic.empty.noDeclaration` 在纯函数单测层没被锁死~~ **已销账（2026-08-27，C12 实现轮）**：新 `deriveScopePage` 输出 `noDeclaration`，并由 scopepage 纯函数夹具覆盖声明缺席与路径提示。来源：C1.10 补断言轮的变异查因。
25. ~~C1.10 的「K>=3 收桩」标记真机未目击~~ **已销账（2026-08-27，C12 实现轮）**：旧级联抽屉与领域页载体已退役；新行为轴只保留明确的流程/机械链降级格位，旧标记不再适用。来源：C1.10 真机验收。
26. **`codegraph` 其余子命令仍按现状词表**：C10 只把 `context` 转向最优树词表，`chain` / `who-calls` / `sym` / `entity` 等仍按现状词表工作。是否也该转向、以及转向后如何与现状视图共存，本期不做。来源：C10 spec 的 Out of Scope。
27. **扫描侧产出真流程数据（刀 6）**：现有图 4728 条边全部是长度为 2 的无序数组，节点字段无任何控制流信息，`lifecycle` 只有 creator/writer——**图里不存在先后与分支**。原型 `order-flow-demo.html` 的 `LANES` 是手写假数据（`steps` 线性、无分支），其头部注释自陈是在等「刀 6 流程视图（函数级）」产出真数据。C12 查看器已能消费 `flows` 命中形态，并在缺席时显式降级为入口机械可达序列（标注「无次序无分支」）；扫描侧仍待刀 6 产出真数据，届时只换内容不改格位。用户另提的 switch/if 分支展示比原型还多一档，一并归此条。来源：C12 spec 的 Out of Scope-1。
28. **入口容器按服务的领域拆分**：扫描配方两条规则打架——`docs/codegraph-scan-recipe.md:314` 规定「入口分 CLI/HTTP/WS 三容器」，`:257` 又要求「入口容器挂到它服务的领域上」。一个 `c_http` 只能挂一个域，于是 72 个端点（`/api/tasks`→任务编排、`/api/projects`→项目与工作区、`/api/pty`→终端会话、`/api/machines`→跨机连接、`/api/discipline`→运行策略、`/api/update`→安装与换版，至少 6 个域）全部记在 `d_gateway` 名下。**改配方即可修，代码零改动**，但需全量重扫，故压在 B228 上。C12 的行为轴入口族从入口节点名分组算出，不依赖此项。来源：C12 spec 的 Out of Scope-2。
29. **视觉对照闸门**：C12 卡诉求的「拦住『结构对、样式无』这一族」的重判据——对着基准原型做截图或 DOM 结构比对。C12 本期只补轻判据（新增交互控件必须有非空 className；禁止断言具体 class 值的原有纪律不变）。轻判据拦不住「形态没做 / 形态做反」那两层，重判据仍缺。来源：C12 spec 的 Out of Scope-5 与 C12 卡第一条更正。
30. ~~第 21 条的紧迫度因 C12 上升~~ **已解（2026-08-25）**：用户裁决「原型跟着源码走」，charter 建站完成（`prototypes/base/` + `.gitignore`，只 base 入库），C12 的分支副本落 `prototypes/codegraph-two-axis/`。**第 21 条随之销账**——charter 侧的 review 执行者从此结构上看得见原型。残留一条归 handoff 卡：handoff 仓那几份 `prototypes/codegraph-*`（phase2/phase3/subsystem）是否清理或标注为历史。来源：C12 spec 载体裁决。
31. ~~第 23、24、25 条可能随 C12 销账~~ **已销账（2026-08-27，C12 实现轮）**：原 `BestDomainPage`/`DomainCascadeDrawer`/旧领域派生器已整体退役；新结构轴模型覆盖无声明、无实体、无入缝及复用折叠的纯函数断言，旧载体不再存在。来源：C12 spec 的退场裁决。
32. **Go 工具链扫描器（机械层工具化）**：`go/ast` + `go/types` + `x/tools/go/ssa` 取代 AI 扫机械层，产出节点清单、精确调用边与 `flows` 控制流段；AI 只留语义层（领域归属、职责、不变式、状态机）。收益有实测账：AI 扫实测 `cmd/` 50 个文件里 9 个零节点、`handoff card` 族 24 个命令全漏而 validate 全绿、下游 gap 少报约 18%，且被迫长出两道人工完整性自检。迁移四步（并行对照轮 → 机械层切工具 → flows 按承重函数增量 → 状态机随卡补）见 `docs/specs/2026-08-25-codegraph-scan-schema-draft.md` §6。C12 已落消费侧 `flows`/`channel`/受控 kind 的显式模型与校验；扫描器、真 flows 数据和状态机互证闸仍待后续卡。来源：C12 spec 的 Out of Scope-1 与 schema 草案。
33. **状态机 ≙ 流程 ✎ 步骤的互证闸**：schema 草案给 `CgDomainDecl.stateMachine[]` 加 `anchor`（`file#Symbol`）后，可机械执法「每条迁移边的 anchor 必须出现在该域某条 flow 的 call 步骤里，且在 `lifecycle` 中是对应实体的 writer」。今天两边数据都缺（状态机 0 条、flows 不存在），闸上不了；数据齐备后开启。来源：C12 spec 实现决定「状态机」。
34. **查看器布局判据落成可复核的实现约束**：C12 走查定下四条——方向靠箭头不靠位置；摆放以「能看见全部节点时空白最少、连线交叉最少」为准（连接权重贪心排序 + 货架装箱且目标长宽比贴合画布 + 相邻交换降交叉）；分层只用于节点本身就是聚合单位的层，孤立节点不进分层图；容器层按包聚成群组、边接到具体容器。这四条今天是原型里的实现，尚未成为可机械复核的约束——将来若查看器再漂，靠什么拦住它，与第 29 条（视觉对照重判据）同源，一并另议。来源：C12 原型走查（2026-08-25）。

35. **handoff 裁决块解析对内嵌引号无防御**（2026-08-26 实测，C12.1 plan 轮）。执行者在
    ```handoff-verdict``` 的 `notes` 字段里引用 JSON 原文（`序列化探针实锤 {"label":"","responsibility":""}`）
    时未转义内层双引号，外层 JSON 当场断裂，节点判为「裁决解析失败」并打 `needs_human`，
    卡停摆等人。**内容完全达标（verdict 写的是 pass），纯报文格式事故。**
    这条会复发——凡执行者想在 notes 里贴 JSON 原文就会踩。可选处置：解析端对
    ```handoff-verdict``` 块做容错（提取到最外层花括号配对），或纪律块显式禁止在 notes
    里放未转义引号。归 handoff 仓，与 charter 无关，此处只记账。

36. **`handoff machines` 的「可达」读数会骗人：探活通过不代表数据面通**（2026-08-26 实测，
    C12.4 plan 轮收尾）。relay 到 linux-01 的数据面配额用尽后，`handoff pull` / `handoff diff`
    双双失败并报 `relay connect rejected node=linux-01 code=QUOTA_EXCEEDED`，而同一时刻
    `handoff machines` 仍把 linux-01 列为「**可达**，延迟 82ms」。协调者若按可达读数判断，
    会误以为是任务侧问题而去查 task、改派、甚至重跑一轮。
    根因是两条路径的判据不同：machines 的探活走的是轻量心跳，pull/diff 走的是 relay
    数据面并受配额约束；**前者通不蕴含后者通**。
    可选处置：machines 的状态列区分「心跳可达 / 数据面可用」两档，或在配额受限时把该机
    标成降级态而不是「可达」。另外错误文案里的 `Get "http://localhost/api/tasks/..."`
    也有误导性——`localhost` 是 relay 隧道内的地址，读起来像本机故障。
    归 handoff 仓，与 charter 无关，此处只记账。
    附带一条运维事实：linux-01 在 `~/.handoff/config.yaml` 里是 **relay-only**（无直连
    `addr`，只有 `wss://handoff.chanliu.net/relay`），所以配额一断就没有任何绕过路径；
    mac-02 与本机有直连 addr。派发选型时值得把这一点算进可用性。

37. ~~C12 acceptance：结构轴真机路径未执行~~ **已销账（2026-08-27，finish 真机验收）**：双侧隔离实例（本机 + linux-01）各 14/14 步走通「根→领域→容器」，逐屏对照 `prototypes/base/README.md` 确认形态一致；容器原子、三 tab、降级显式标注均实测通过。观察项转第 48 条。来源：C12 集成报告 §6-1。
38. ~~C12 acceptance：行为轴真机路径未执行~~ **已销账（2026-08-27，finish 真机验收）**：「入口→流程图」路径双侧走通；流程图页在无 flows 数据时按设计显式降级（标注「无次序无分支」），无双线框/紫框数据可验——有数据形态的复核随第 42 条。来源：C12 集成报告 §6-2。
39. **C12 acceptance：浏览器交互与降级——部分执行（2026-08-27）**：右栏分隔条拖宽（360→482）双侧实测生效；清 storage/隐私模式降级、键盘/读屏 a11y 未验，仍欠。来源：C12 集成报告 §6-3。
40. **C12 acceptance：大图性能——部分执行（2026-08-27）**：真实 3636 节点 / 232 容器图（c12data 项目）下双侧交互无卡死、console error=0、失败请求=0；页面耗时精确计时未做，仍欠。来源：C12 集成报告 §6-4。
41. **C12 acceptance：handoff 宿主联调未执行**（2026-08-27 integrate 交棒）：需核对 iframe 的 `?project=` 传参、宿主 CodegraphFrame 单向传参和 best/decl 双写差异；宿主不在 charter，本轮只能登记交棒。来源：C12 集成报告 §6-5。
42. **C12 acceptance：真 flows/162 入口与状态机互证未执行**（2026-08-27 integrate 交棒）：需在真 flows 到达后复现 162 个入口的归属三态、注册散度、入口族、接口实现 join 与 stateMachine.anchor 互证；缺席时只验显式降级（2026-08-27 双侧已验 4 处降级格位零假读数）。扫描器与数据面仍对应既有条目 27、32、33。来源：C12 集成报告 §6-6。
43. **C12 handoff：best responsibility 正文搬运未执行**（2026-08-27 integrate 交棒）：best 已在 charter 删除职责字段，但旧正文逐条搬入 handoff `codegraph/domains/<id>.json`、并核对双写差异仍属 handoff 仓动作，不能由 viewer 侧 `decls` 类型通过替代。来源：C12 contract §6.2-1①、集成报告 §3 条 12/§6-5。
44. **C12 handoff：扫描配方自洽修复未执行**（2026-08-27 integrate 交棒）：入口按 CLI/HTTP/WS 分容器与按服务领域挂载两规则仍需在 handoff 配方裁决并全量重扫；查看器按入口名分族不依赖该缺口。来源：C12 contract §6.2-1②、既有 roadmap 28。
45. **C12 scanner：未知 kind/channel 与承重 flows 校验未执行**（2026-08-27 integrate 交棒）：viewer 已有八值 kind/四值 channel 的消费与显式未知态，扫描侧拒绝器、承重范围和真 flows 产出需在后续扫描卡开启；不得把 viewer 类型联合当作扫描校验完成。来源：C12 contract §2.1-5/§2.1-15、既有 roadmap 27/32。
46. **C12 scanner：stateMachine.anchor 互证闸未执行**（2026-08-27 integrate 交棒）：需在真实 flows、lifecycle writer 与声明迁移边齐备后执行 `file#Symbol` 三方互证；当前仅有字段和 UI 显式未接入格位。来源：C12 contract §2.1-16、既有 roadmap 33。
47. ~~C12 集成基线引用记录不一致~~ **已销账（2026-08-27，finish 合并）**：`894d02281` 不可达的根因已查明——它是 base 分支的**本地未推提交**（`docs(roadmap): 收第 36 条`），executor 在 linux-01 自然够不到；非记录错误，无需改卡面。该提交现已随 finish 合并进入 base 分支本地链（merge 368253707），push 后远端亦可达。来源：C12 集成报告 §1。
48. **容器层 scope 外部虚线端口节点布局重叠**（2026-08-27 C12 真机验收观察项）：容器层视图中顶部外部端口卡片（虚线节点）堆叠重叠，见验收截图 local-05-container.png。布局质量项，非契约违背；归第 34 条「布局判据落成可复核的实现约束」同一族，届时一并处置。
49. **C12 实现形态与确认原型（fork 页面）的偏差清单**（2026-08-27 用户真机复核发现，协调者 DOM 取证核实，隔离实例 c12data 真实数据）：
    ① **根层拓扑分层未实现**——spec 布局判据第 3 条（2026-08-25 用户裁决）冻结「根层子系统按调用方向拓扑分层、SCC 缩点、环内同层红色标出、孤立节点单列一行写明原因」；`scopelayout.ts` 无分层/SCC 任何代码，实测画面无层、2 环 3 双向边无红标、孤立子系统（协调者命令面/Web 控制台）混在图里且被裁出视口。
    ② **摆放判据未达**——「能看见全部节点时空白最少、交叉最少」实测未达：根层 12 卡有 2 张被裁出视口右/下缘，连线大面积穿卡打结；领域层大片空白 + 外部端口列重叠（与第 48 条同族）。
    ③ **容器卡面 doc 职责缺席**——用户故事 5 + 契约 §2.3-26：类型方法容器应显示同名 model 节点 doc 摘要（原型卡面有，如 agentd.Server 的「Server 是 agentd 的 HTTP/WS 服务端…」）；实现卡面只剩超大徽章，推导代码在（scopepage.ts:503）但真数据上没出文本，需查推导失败还是渲染缺席。
    ④ **子系统卡面入口数徽标缺席**——原型有「43 入口·集中」橙标；实现卡面只有 kind/容器/符号计数，入口散度现只在右栏「程序入口」分桶，契约 §2.3-33「集中注册标红」的落点待核。
    ⑤ **流程债（验收判据漏洞）**——C12 验收对照的是 `prototypes/base/README.md` 的形态要点摘要，而非其明文指定的最终基准「fork 页面本身」；视觉重判据欠账（第 29 条）的实害首次显现。教训：形态类验收必须逐屏对拍原型页面，不是核摘要。
    不偏离的项（取证后如实记）：工具条四件、右栏三 tab、四档方向图例、失鲜徽标、孤立原因卡面标注均在；根层 37 条 call 边全 declared，边色单一为数据正确。
    来源：用户截图两张 + 协调者 puppeteer DOM 取证（2026-08-27）。处置归后续卡，spec/契约条目号已在上文给出。
    **已销账（C14，2026-08-27）**：①–④ 同数据同视口对拍 fork 原型通过（卡 C14 seq 5853）；⑤ 流程债仍归第 29 条。残余 Minor 转第 50 条。
50. **C14 对拍遗留 Minor**（2026-08-27 验收不阻塞）：
    ① 真实页包群组框无包名标签（原型框左上包名 + 右上「N 容器」；`packageFrames` 历来只渲染 rect 无文字）。
    ② 容器层孤立卡摆在群组框内顶部、孤立区标题在页顶（plan「最低点之下」是领域层语义；原型 mock 容器层无 deg 0 容器无参照形态）。
    来源：C14 卡 seq 5852。
51. **「二解测试 + 行为闭环」修法生效检查（观察项）**：跑过 3 张 L3 真卡或下次 skills 对齐审计（先到为准）后复核。生效判据：contract/breakdown 不再因未裁的承重语义退回，integrate 新发现的「无触发者 / 无载体 / 无消费者 / 无归属卡」缺口为 0。负优化信号：spec 在只剩一种承重解释后仍追问局部可逆实现、行为闭环表膨胀到内部方法、问题数量上涨却未减少下游退回；命中即回炉收窄对应条款。来源：B156.2 两组盲测与 integrate 四条跨卡缺口，用户 2026-08-26 明确授权「同意，改吧」。主线在 C14/C15 飞行期间写入原第 27 条；C12 已占用 27 号（扫描侧真流程），合入时改落第 51 条以免撞号。
52. **查看器「调用链（给 agent）」tab 是否退役**：C17 把 agent 看「怎么走」的主路径改到 CLI `flow`，该 tab 仍是 C12 冻结的机械下游、本期不删。`flow` 落地后若无人再点，再议退役。来源：C17 spec OOS。
53. **全函数 `flows` 覆盖**：C17 只要求对外入缝 ∪ 紫框下钻目标 ∪ 右栏实现方法有流程图；其余符号 CLI `flow` 显式 degraded。要覆盖到任意方法，取决于扫描器本体（既有第 27/32 条），不在查看器/CLI 侧现场生成 CFG。来源：C17 spec OOS。
54. **被谁调用在 UI 展开 depth > 1**：C17 右栏只列直接调用方；更深走 `who-calls --depth`。来源：C17 spec OOS。
55. **C17 S3 真 flows 仍缺席**：2026-08-28 acceptance 读真实 handoff `codegraph/baseline.json`：3636 节点 / 4735 边 / **0 flows** / 7 implements / 162 entry。canonical `codegraph flow` 对真实仓与 testdata 均成功返回 `degraded=true`、`missing=基线没有 flows 段`、`steps=[]`。entry handler 不因 `kind=entry` 自动成为承重主语（`flow Server` 锚定到 model `m_agentd_Server` 后仍降级，不画入口图）。卫语句子列引用无法在真实扫描产物上核——没有 steps 树。交棒既有第 27/32/45/53 条扫描配方，不在本卡补扫。来源：C17 plan §8.2-1/2、breakdown 真机 1–2。
56. **C17 `handoff graph` 别名尚未挂 `flow`/`tree`**：本机 `handoff graph --help` 子命令表无 flow/tree；`handoff graph summary` 菜单仍是 `sym/who-calls/chain/domains`。同机 canonical `graph/cmd/codegraph` 已挂二者，且 summary 文案含 `flow`/`tree`。等 handoff 升 charter graph 版本并重建别名（与第 1i、第 6 条同族）。来源：C17 plan §8.2-9、breakdown 真机 7。
57. **C17 原型 fork 文案仍写「入口流程图」**：gitignored `prototypes/codegraph-two-axis/pages/behav-flow.html` 标题/导航仍是 C12「入口」词汇；产品 UI 已改为「正在看方法主语」。对拍差异已记录，不在本卡改 gitignore 副本。`prototypes/base/README.md` 行为轴行已按 C17 主语纠正。来源：C17 plan §8.2-3、finish 文档对齐。
58. **C17 真机观察：菱形左缘被 overflow 裁切**：acceptance 截图 `03-flow-run.png` 中 `err` 菱形左侧文字被流程图滚动容器切掉；蛇形折列与卫语句侧甩本身通过。布局质量项，不阻塞。来源：C17 acceptance 2026-08-28。

