# Plan：C1.2 配方刀（charter 侧）

> 卡 `C1.2`｜L3 轻档，实现归一轮｜契约：`docs/contracts/2026-08-23-codegraph-recipe-honesty-contract.md`（30 条，已冻结）
> 分支 `cards/C1.2-contract`（基线 `feat/codegraph-batch-two`）｜Ticket 0 已落（提交 `b1aa9547`）

**本文档刻意写短。** 设计已在契约里冻死，此处只排任务序、指文件、钉每个任务自己的验收判据。
不复述契约条文，不写伪代码——C1.1/C1.4 的 plan 分别 526/1140 行，是本批次「越搞越大」的主因（卡 `C3`）。
**契约是唯一事实源；本文与契约冲突时以契约为准。**

## 范围

charter `graph/` 侧三件事。handoff 侧的三件交付物（全量重扫 baseline、配方文档修订、`d_workspace` 声明处置留痕）**不在本卡**——一张卡的 `--project` 只绑一个仓，按 C1.1→C1.6 的先例另开卡。

## 任务

### T1 `Validate` 侧 modelKind 执法

- 文件：`graph/codegraph/validate.go`（`Validate` 是引用完整性的家）；测试进 `validate_test.go`。
- 判据：契约 **21–24**。三条报 issue（枚举外、挂在非 model 上、dto 却有 writer），一条**不**报（entity 无 lifecycle，只计数）。
- 自验：四条各一个用例；第 24 条要有「确实没进 issues 列表」的反向断言，不能只测计数。

### T2 锚归属两条判据

- 文件：**新建** `graph/codegraph/anchor.go`（与 `gap.go`/`fitness.go` 同构，一判据一文件）；测试进 `anchor_test.go`。
- 接线：`Check` 内调用，位置在 gap 判据之后、fitness 之前；`sortFindings` 已在最后统一重排，不要自己排。
- 判据：契约 **4–9、14–20**。
- **红线（契约 13）**：只准用 `resolveGraphAnchor`。出现 `ResolveAnchor`、`repoRoot`、`os.` 任一即判 fail。
- 自验：正例（锚在本域且在图内 → 零 finding）、`anchor-off-domain`、`anchor-off-graph`、四条跳过分支（域不在图中 / 锚格式非法 / 容器缺失 / 容器 Domain 空）、同一锚只出一条、重复锚不去重、遍历序确定性。

### T3 CLI 接线 decls

- 文件：`graph/cli/cli.go` — `graphCheckCmd` 内 `codegraph.Check(t, v, nil)` 的 `nil` 换成真加载。
- 抄 `graphValidateCmd`（`cli.go:117`）的现成形态：`LoadDomainDecls(graphRepo)` + err 直接返回。
- 判据：契约 **25**（失败返回 err，不静默降级）。
- 自验：CLI 层集成用例，仓里有 `codegraph/domains/*.json` 时判据生效；目录不存在时 `LoadDomainDecls` 返回空 map 不报错（既有行为，别改）。

## 全任务共同的收口

- TDD：每个任务先写红测试并贴红色输出，再实现。
- **变异自验**（C1.1 的教训：三发核心变异原本全绿）：T2 至少对「域相等比较」和「NodeID 空判定」各做一发变异，确认有测试报红。
- `go vet` 0 / `gofmt` 净 / `go test ./...` 全绿。
- 中文注释解释「为什么」；两个新 kind 的注释已在 Ticket 0 写好，不重复。

## 不做

- 不抽 `Node.Kind` 三值常量（契约 29）。
- 不给 `ValidateDecls` 引入分档。
- 不动 handoff 仓任何文件。
- 不新增第三方依赖（契约 28，`deps_test.go` 白名单不变）。

## 验收（acceptance 节点用，此处只记指标出处）

真机四个数字在契约 §5-5，全部要等 handoff 侧重扫落地后才能验——**本卡的 acceptance 只覆盖 charter 侧单测与 CLI 集成**，真机数字随 handoff 卡验收。
