# C12 breakdown 节点台账

分支 `cards/C12-charter-2`（基线骨架 946ab79 + 契约冻结 3080f5c）。产出物：`docs/superpowers/specs/c12-breakdown.md`。

## 查证事件

- 上游状态位核对：spec `docs/specs/2026-08-25-codegraph-viewer-two-axis-spec.md:4` =「已批准（2026-08-26，用户）」；contract `docs/superpowers/specs/c12-contract.md:3` =「已冻结（随本提交，2026-08-26）」——两枚状态位均已回写文件头，直接引用。
- 存量无图 fresh 复核：仓库根 `ls codegraph` 不存在（仅 `graph/codegraph/testdata/repo/` 测试夹具）；沿用 c1.10/c12-contract 同一判定，子系统清单走人工接缝降档，不冒充项目图读数。
- 形态基准核对：`prototypes/base/README.md`『C12 形态确认（2026-08-26）』在库；用户逐屏走查完毕、确认形态即最终验收基准——spec 的「先原型走查才许实现」硬门已过。fork 副本不入库是既定策略（`prototypes/.gitignore` 只放行 `base/`），非缺口。
- Ticket 0 壳现状：`scopepage.ts#deriveScopePage` 仅接线回声（`passthrough: true`）；`flowpage.ts#deriveFlowPage` 仅 degraded 判定；`ticket0.passthrough.test.ts` 三支断言在库。
- **同刀清单补遗（contract §2.2-8 四条之外，编译强制）**：
  - `graph/codegraph/context.go:370` `Summary: domain.Responsibility`——Go 库内第五处 BestDomain.Responsibility 读数；`AssembleContext` 已持有 repoRoot 且 :127 已 `LoadDomainDecls(repoRoot)`，但 `contextVocabulary(v, best, domainID)` 未收 decls 参数。
  - `graph/codegraph/migrate.go` v2→v3 迁移写入 `Responsibility: "（迁移生成，待填写）"` 占位符（:185 一带），`migrationNotes()` 含「Responsibility 是占位符，请逐项补写」提示行——删字段后该路径与提示行同刀失效。
  - 测试夹具带字段字面量（编译强制同刀）：`best_test.go`（:21/:51/:60/:108-115/:185/:212-213）、`check_test.go:39`、`gap_test.go:30/:92`、`context_test.go:186`；`domains_test.go:175` 为空字面量 `{}` 不受影响。
- decl 侧不随刀：`decl.go:23`、`decls.go:45/:55`、`entity.go:72` 的 Responsibility 属 `DomainDecl`（声明文件结构），是职责正文的**新所有者**，保持不动。
- TS 词表缺口：`types.ts#CgContainer.kind` 是自由 `string`，八值受控词表与兜底桶二值常量在 TS 侧尚无镜像——缝 1 落地时需新增常量表达 contract §2.2-14 冻结的词表（词表值已冻结，加常量是其实现，非新契约）。
- channel 缺席现状：外部核对 entry 节点 channel 全缺（contract §1）；§2.1-6 按通道分组在重扫前对存量数据无值可分——按 §2.1-7 降级形态呈现（澄清，非退回）。
- 架构法第三条信号实测：`graph/webui/src/app/codegraph/` 非测试源文件 21 个、无子包（<40，信号 2 未命中）；`Best*` 前缀家族 6 个源文件 ≥5（信号 1 **命中**，须显式回答——本轮退役后家族消散，见拆解稿 §一）。
- 旧组件 props 核对：`BestScopePanorama`/`BestDetail` 现不接收 `decls` prop（CodegraphPage 只传 best/target/report/baseline）——同刀切 decls 读数需穿线。

## 基线绿（改动前，本节点亲跑）

- `cd graph && go build ./... && go vet ./codegraph/` → GO_BUILD_OK + VET_OK（退出码 0）。
- `cd graph && go test ./codegraph/ ./cli/` → 两包均 `ok`。
- `cd graph/webui && npm install`（node_modules 缺失补装，168 packages）→ `npm test` → **Test Files 21 passed (21)，Tests 136 passed (136)**；`npm run typecheck` → 退出码 0。

## 放弃的尝试与判断

- 不给缝 1/缝 2 的内部模型形状定字段：contract §6.2-3 明文归 plan，拆解越权会跟 plan 打架；子卡验收只锁冻结行为。
- 不把布局算法选型当岔口拍板：contract §7 移交附区明文归 plan，本稿只锁判据与防漂判据。
- 不插竖切还债卡：五张提案全部圈得出有界文件集，第三条命中由退役+命名纪律消解（拆解稿 §一 显式回答），无需还债前置。

## 收尾事件

- 拆解稿落盘 `docs/superpowers/specs/c12-breakdown.md`（待拍板岔口 P1～P5 集中稿首；六张子卡 K1～K6 四段式；缺陷族 8×6 逐族作答；真机清单 6 条）。
- 边界澄清三条回写 `docs/superpowers/specs/c12-contract.md` §8 修订记录（同刀补遗 / channel 降级桶 / 缝导出面归属），冻结条目文字未改。
- `codegraph resolve --doc` 符号锚自检**未执行**：本仓存量无项目图（台账首节 fresh 复核），无图可决议——非跳过，是前置不成立。
- 提交内容：c12-breakdown.md + c12-contract.md 修订行 + 本台账。无代码改动。
