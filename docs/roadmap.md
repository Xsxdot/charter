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
8. **目标图刀（子系统→领域终态，图批次第一优先）**：target schema 增「目标领域」节（每子系统下的领域树 + 职责一句话 + 归属规则 + 关键契约面）；handoff 最优目标图 AI 出稿、用户拍板、冻结入 target（走 spec/breakdown）；gap 判据与棘轮（baseline 对照目标域计违规，`legacyBudget` 同款只减不增）。**原则：先终态后差分**——迁移 diff 按卡从 target 反推，acceptance = gap 下降；产出直接给 1f（agentd 竖切还债）当蓝图。概念裁决：「逻辑域」不设，层级仍是 子系统→领域，语义重划一律落目标侧。来源：2026-08-23 roadmap 前置讨论（原型副本 handoff `prototypes/codegraph-subsystem/`）。
9. **配方刀（瘦身版，服务 gap 测量诚实性）**：model 分种 entity/dto/config（schema 小增量，lifecycle 标注辅助判定——实测 194 model 仅 11 个真实体）；声明锚必须落在本域（validate 新查，PrepareWorkspace 被 k_agentd_fn 认领致锚失联实测）；proto wire 类型建「协议契约」域归还契约子系统（实测契约域全景被掏空）。**不做**「把现状域拆好看」——那是拐杖，方向已否。来源：同第 8 条讨论。
10. **查看器刀（讨论中称刀 6，吸收 1b）**：形态基准 = handoff `prototypes/codegraph-subsystem/` 副本 + `pages/order-flow-demo.html` 订单样例——首层架构全景按子系统（类型徽标/领域 chips/聚合边）、主属规则（领域只在主属子系统立卡，他处 ⧉ 引用卡）、组织可切按子系统/按领域、领域页双 tab（语义 = 职责/不变式测试锚/状态机流程图/生命周期锚+机械层实体表/主调用链；结构 = 流程泳道式（订单样例）+ 调用链级联面板 + 焦点链）、视图语法三条（只画行为、外部领域一域一节点、高扇入工具收桩）；**终态新增「目标 vs 现状对照」视图**（按目标图排布、现状映射、违规高亮，依赖第 8 条）；**CLI 去噪与装配器下放**：`chain --fold-external --collapse-util --with-source --max-tokens`、`codegraph context <领域>`（agent 轮次 5~8→1，ledger 轮次统计做量化验收）。走查否决项：DFS 调用链长墙、容器级聚合作主视图。来源：同上。
11. **前端搬迁刀（讨论中称刀 5，排第 10 条动工前）**：codegraph 查看器前端源码入 charter 仓（`graph/webui/`，构建产物 go:embed 成独立包），handoff 升 go.mod 同源挂载 + iframe 嵌入（契约面收窄为两条只读 API + `?project=`）；顺带修 `/codegraph` 不在 Shell fullPageRoute 白名单的现存挤压 bug；`codegraph serve` 独立命令另议（涉契约 §5「不发网络」不变式修订，不混入本刀）。来源：同上。
