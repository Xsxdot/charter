# Roadmap（残余账本）

> 排序判据：先骨架后血肉；每期以可真机验收为界。一行一条、注明来源；下一期开工 = 取条目重走 spec 门。

1. ~~codegraph 刀 3+4 批次~~ **已完成（2026-08-23）**：漏建对账三类（`dead-entry`/`dead-interface`/`dead-contract`，fail 档）+ fitness 判据两条（`prefix-family`/`oversized-package`，warn 档）+ `legacyBudget` 棘轮（git 与主线比对、理由字段降档）+ **`Diff.containersAdded` 修根因**（分支视图此前无法引入新容器，contract 的「骨架符号入图」与 recon 的「补齐视图 diff」对新容器场景一直是空的）。真机 8 条全执行：真机 1 首次运行即抓到 handoff 真缺陷（见 handoff 卡 B206）。spec/契约(R1~R10)/breakdown/plan/review/ledger 全部入库。
1a. **领域声明铺满**：机制与 2 份样板（d_coordination_task / d_workspace）已随刀 1+2 落地，**余 17 域按卡增量补写声明**；生命周期数据面已铺满（127 条入库，无需重扫）。来源：刀 1+2 spec OOS。
1b. **Web 控制台 lifecycle/声明展示**（handoff 侧）：baseline 附加段与 domains/*.json 的 UI 消费。来源：刀 1+2 spec OOS。
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
7. **charter 修法配套（工具落地后）**：architecture-law 术语节销账、integrate/acceptance 补图 diff 对账条款、spec/plan 补领域图引用。来源：四刀批次交接文档 Out of Scope 第 1 条。
