# 契约增量：codegraph 搬迁（刀 0，冻结物）

> 日期：2026-08-22 | 状态：**已冻结**（随本提交冻结）
> 上游：`docs/specs/2026-08-22-codegraph-extraction-spec.md`（已批准）
> 本仓（charter）无 `codegraph/target.json`——存量无图项目，**本文件即冻结物**，review 节点按 §6 冻结清单人工对账。
> 现状事实源头：handoff 仓 **@ 573149364**（下列 文件:行 均指该提交的工作树）。

## 修订记录（2026-08-22，breakdown 核对回写，随拆解拍板一并冻结）

| # | 修订 |
|---|---|
| R1 | 事实勘误：§2 头部计数改为 **14 个非测试源文件、51 个导出符号（22 func + 29 type）、14 个测试文件**——表格本身逐行核对无误，头部计数笔误（spec 备注同源勘误） |
| R2 | §1 增 CLI 布局条目：module 内含可导入 CLI 包 `graph/cli`（导出面仅命令构造函数），`graph/cmd/codegraph` 与 handoff 别名同挂此构造——「别名行为一致」由构造保证；§5-2「cmd 壳依赖仅 cobra」涵盖此包 |
| R3 | §3 补第 4 个消费入口：`internal/agentd/codegraph_test.go`（Diff/Graph/StaleNode 3 符号），其夹具硬编码读 `../codegraph/testdata/repo`，删包后夹具须随迁 |
| R4 | §4 子命令数 12→**13**（新增 `version`）；「别名行为一致」语义澄清 = alias≡canonical **同版本等价**，非对搬迁前输出的逐字节冻结（summary 文案随 canonical 更名） |
| R5 | 私仓依赖矛盾用户拍板：**charter 转公开**（时点：T1 合并、打 `graph/v0.1.0` 之前）——§6-12/15 语义不变，install 裸 curl 通道成立，无需 vendor |

## §1 module 契约

- module 路径：`github.com/Xsxdot/charter/graph`（嵌套 module，charter 仓根**不设** go.mod）
- 包导入路径：`github.com/Xsxdot/charter/graph/codegraph`，包名 `codegraph`——消费方代码里 `codegraph.LoadGraph` 等调用点**零文本变化**，只改 import 行
- CLI 壳：`graph/cmd/codegraph/`，二进制名 `codegraph`
- go 指令：`1.26.1`（与 handoff `go.mod:3` 一致，消费方无 toolchain 抬升）
- 版本面：嵌套 module tag 形如 `graph/vX.Y.Z`（首 tag `graph/v0.1.0`），handoff go.mod 钉 tag 消费，提交内零 `replace` 指令
- CLI 布局（R2）：`graph/cli` 可导入 CLI 包（导出面仅命令构造函数），`graph/cmd/codegraph` 与 handoff 别名同挂此构造
- 架构形态声明：graph module = 单包（`codegraph/`）+ CLI 包（`cli/`）+ cmd 薄壳，平铺无分层

## §2 导出面（原样迁移，零增删改；14 个非测试源文件，51 个导出符号：22 func + 29 type——R1）

搬迁等价性的可执行对账 = 包内既有测试（14 个测试文件，1244 行）随迁全绿。

| 文件 | 导出符号（出处行号） |
|---|---|
| `types.go` | Meta(16) Container(25) Domain(39) TestRef(48) Node(56) Edge(75) Projection(80) Graph(84) Diff(99) |
| `load.go` | LoadGraph(18) LoadDiff(32) ListViews(47) |
| `merge.go` | ViewNode(13) ViewEdge(19) ViewProjection(26) View(34) Merge(46) |
| `absorb.go` | Absorb(22) SaveGraph(91) |
| `check.go` | Finding(20) Report(29) Check(37) |
| `target.go` | TargetMeta(17) TargetDomain(23) Assignment(32) Contract(41) Target(50) LoadTarget(61) ValidateTarget(87) |
| `contractset.go` | SetContract(14) SetContractWithPresence(21) |
| `validate.go` | Validate(14) ValidateDiff(100) |
| `query.go` | ResultNode(14) Result(23) Resolve(34) Neighborhood(63) |
| `sym.go` | SymMatch(14) SymResult(25) SymLookup(35) ReAnchor(118) |
| `entity.go` | EntityResult(14) ProjSite(26) EntityLookup(32) |
| `resolve.go` | AnchorResult(17) ResolveAnchor(27) CheckDocAnchors(86) |
| `domains.go` | DomainStat(16) DomainTree(36) |
| `stale.go` | StaleNode(18) CheckStale(30) |

## §3 消费面（handoff 侧，改 import 后必须编译通过的三个入口）

- `internal/agentd/codegraph.go`：LoadGraph、ListViews、LoadDiff、CheckStale、`Diff`、`StaleNode`（6 符号）
- `cmd/graph_gate_test.go`：LoadTarget、ValidateTarget、LoadGraph、Check、Merge（5 符号）
- `cmd/graph.go`（改写为委托别名前的现状消费）：28 符号（§2 全集的子集，逐个见 `grep -o 'codegraph\.[A-Za-z]*' cmd/graph.go`）
- `internal/agentd/codegraph_test.go`（R3）：Diff、Graph、StaleNode（3 符号）；夹具 `codegraphFixtureRepo` 硬编码读 `../codegraph/testdata/repo`，删包后夹具随迁至 agentd 自有 testdata

## §4 CLI 契约

canonical 入口 `codegraph`，子命令与现 `handoff graph` 一致（`cmd/graph.go` 各 `Use:` 行）：
`validate`(91) `check`(145) `absorb <view>`(173) `views`(242) `chain`(304) `who-calls`(311) `domains`(319) `sym`(341) `entity`(360) `resolve [file#Symbol]`(378) `contract set`(425,430) `summary`(467)，另新增 `version`（R4，共 13 个；`go install` 构建下版本信息优先走 `runtime/debug.ReadBuildInfo`，release 构建以 ldflags 覆盖）。

别名契约：`handoff graph <args>` 与 `codegraph <args>` 行为一致——语义为**同版本等价**（委托同一构造，R4），非对搬迁前输出的逐字节冻结；帮助文本（Short/Long）标 deprecated，**禁用 cobra 的 Deprecated 字段**（它会向 stdout 打运行时告警，污染 JSON 消费管道与 SessionStart hook）。

## §5 不变式（冻结）

1. `codegraph` 包 import 仅 Go 标准库（现状即如此：`types.go:9-11` 包注释「不依赖 handoff 任何内部包……必须能原样搬进任何工具」）；
2. cmd 壳第三方依赖仅 `spf13/cobra v1.10.2`（handoff `go.mod:9` 同版本）;
3. 全 module 零 CGO，六平台 `CGO_ENABLED=0` 交叉编译；
4. 不发网络请求、不依赖 agentd 存活（`cmd/graph.go:9-12` 文件头约束随迁保留）;
5. 数据契约（`codegraph/*.json` schema）本卡零改动。

## §6 冻结清单（review/acceptance 逐条打勾，一条一断言）

1. `graph/go.mod` 第 1 行 = `module github.com/Xsxdot/charter/graph`
2. `graph/go.mod` go 指令 = `1.26.1`
3. 包路径 `graph/codegraph`、包名 `codegraph`
4. 导出面与 §2 清单逐符号相符（51 符号），零增删（`go doc ./codegraph` 对账）
5. `codegraph` 包 import 块仅标准库
6. module 第三方依赖仅 cobra v1.10.2
7. `CGO_ENABLED=0 go build ./...` 六平台矩阵通过（至少 linux/amd64、darwin/arm64、windows/amd64 三个抽查）
8. 随迁测试全绿（`go test ./...` 于 graph module）
9. 13 个子命令名（含 version）与 §4 一致（`codegraph --help` 对账）
10. handoff 仓 `internal/codegraph/` 目录不存在
11. handoff `cmd/graph.go` 为委托别名且帮助文本含 deprecated 标注
12. handoff go.mod 含 `github.com/Xsxdot/charter/graph` 钉 tag 版本
13. §3 三个消费入口改 import 后 handoff 全量编译通过
14. 同一仓库上 `handoff graph sym/check/entity` 与 `codegraph sym/check/entity` 输出一致（真机，归协调者）
15. `graph/vX.Y.Z` tag 存在且 handoff `go mod download` 可解析

## §7 拍板记录（三重闸门）

- **落点 = charter 仓嵌套 module**（难逆：handoff 依赖方向定死后回头要动两仓；惊讶：执法工具住在法典仓里，后人会想「拆成独立仓」；真取舍：独立仓与留守 handoff 均被否，理由见 spec 方案段）。**将来想拆独立仓，必须重走 contract 节点**，不存在「顺手换个 module 路径」。
- **先搬家、后动 schema**（刀 0 先于刀 1~4）：反过来写不会有任何测试变红——纯顺序裁决，无拍板记录时一次「顺手先做刀 1」就能无声推翻；被否方案「先 schema v2 再搬」多付一轮跨仓同步。

## §8 可执行冻结核对

无哈希/密钥派生/编码格式类条目，金样本**无命中**。搬迁等价性的可执行锁 = §6-8（随迁测试全绿）与 §6-14（别名真机比对）。

## Ticket 0 范围声明

本卡为整体搬迁：类型形状原样随迁，契约错配风险不在类型（不重写）而在 **module 身份**（路径、go 版本、包路径）。故 Ticket 0 = `graph/go.mod` + `graph/codegraph/doc.go`（包注释承载职责与边界），锚定 module 身份并编译通过；cmd 壳与代码搬入归实现轮。**欠账：无**——骨架未越过空壳，无「已实现但零测试」条目。
