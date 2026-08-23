# Review：codegraph 刀 3+4（漏建对账 + fitness 判据）

> 日期：2026-08-23 | 审对象：`feat/codegraph-reconcile-fitness`（rebase 到 origin/master 后的 7 提交，14 文件 +1119/-37）
> 上游：契约 `docs/contracts/2026-08-23-codegraph-reconcile-fitness-contract.md`（冻结 1~38）、plan `docs/plans/2026-08-23-codegraph-reconcile-fitness-plan.md`

## 前置：派发基线事故与抢救（协调者自记）

派发时协调者在主仓（当时停在他人分支 `docs/b170-view-plan`）执行 `handoff dispatch`，基线取成 `8d525639`，**不含 Ticket 0**。执行者开工即如实报告落差并按冻结内容补建骨架——**未静默猜测**。协调者复核其补建物与冻结版**逐字一致**（六个 kind 字符串、三个阈值、两个 json 键、`CheckBudgetRatchet` 签名），随后 `git rebase --onto origin/master 8d525639` 搬正；三处冲突均为「两侧写了同一字段/文件、仅注释文字不同」，取冻结版注释 + 执行者版实现。搬正后 `gofmt`/`build`/`vet`/两包测试全绿，分支相对 master 干净、未夹带 b170 内容。

## 契约轴

| 维度 | verdict | 证据指针 |
|---|---|---|
| plan 覆盖完整性 | **通过** | 六卡各一提交（`c32fb9ca` T0 / `644f69c5` TC / `4d9dc6ba` T1 / `66460dbb` T2 / `531d3989` T3 / `39b9221a` T4 / `d6fec8b8` ledger）；28 支新测试与 plan 各卡断言清单逐条对应；ledger「冻结清单 1~38 逐条自查」段每条带证据指针 |
| scope drift | **无（双向）** | `git diff --name-only origin/master HEAD` = 14 文件，与 plan 各卡声明文件集逐一吻合、零越界；plan 每项均有落点 |
| 冻结物触碰 | **无触碰** | `check.go:38` 签名逐字未变；六 kind + 三阈值 + 两 json 键与冻结版逐字一致 |

**承重冻结项实证**：13 ✓ 签名未变；14 ✓ `fitness.go:39` `base == nil`；11/15 ✓ `fitness.go`/`check.go` 对 `os.`/`exec.` 命中数为 0；20 ✓ 降级实跑（非 git 仓）stderr 给出可自修原因、stdout 合法 JSON、退出码 0；38 ✓ `cli.go:287` 以 `&codegraph.Target{Contracts: target.Contracts}` 物理保证只取 contracts 段。

## 规范轴

| 维度 | verdict | 证据指针 |
|---|---|---|
| 架构法合规 | **通过** | 依赖方向不变式守住：git 调用只在 `graph/cli`，`codegraph` 包零新增 exec/fs |
| 测试有牙 | **已验（三处变异，本轮跑出）** | ① `cli.go:251` 去 `TrimSpace` → `TestGraphCheckBudgetRatchetWhitespaceNoteStillFails` 红；② `check.go:80` 记活永假化 → `TestCheckTable`/`TestCheckDeadContractReconciliationCountsAllLiveEdges`/`TestGraphCheck` 三红；③ `sortFindings` 三级 tiebreak 全废 → `TestSortFindingsIsTotalOrder` 红；三者还原均回绿 |
| 日志与注释覆盖 | **通过** | R5 强制注释在场且注明条款号（`cli.go:281-283`）；`fitness.go` 头注释写清 stdlib-only 与不碰 git/fs 的边界 |
| 序列化边界 | **有穿透断言** | `TestDiffContainersAddedJSONKeyIsAdditiveAndOmittable`（真实序列化）、`TestAbsorbContainersAddedAndValidate`（diff→Merge→Absorb→baseline 全链路）、T4 五支穿真实 `git show` 与文件读取 |

**实现亮点（备查）**：R3 把 `liveDirections[from+"->"+to] = true` 放在组装点豁免 `continue` **之前**（`check.go:80-82`），一行位置同时满足「豁免边不参与 `new-direction` 执法」与「豁免边算缝已建成」；变异复验证明该位置承重。

## Findings

**零 Critical、零 Important。** 以下三条 Minor 记账不阻塞，acceptance 逐条核销。

| # | 级别 | 位置 | 内容与建议 |
|---|---|---|---|
| **M1** | Minor | `graph/codegraph/types.go:122` | 死字段 `loadNotice string \`json:"-"\`` 挂在契约冻结的 `Diff` 结构体上，全仓 grep **零读零写**。无 wire 影响，但会让后人误以为有用途。**建议删除** |
| **M2** | Minor | `graph/cli/cli.go:211` | `SilenceUsage: true` 是 plan 外的行为改动。为满足冻结 20「stdout JSON 零污染」而加，理由成立且在 T4 文件集内；但它同时抑制 `check` **所有**错误路径（含参数错误）的 usage 输出，是一处 plan 未预告的用户可见变化。**记账，不改** |
| **M3** | Minor | `graph/codegraph/check_test.go:181` | `TestSortFindingsIsTotalOrder` 的用例每条 finding 的 `Edge` 均不同，故只废 From/To 两级时仍绿——它验「比较器整体是全序」，不能定位缺哪一级。按 plan 验收原文（「tiebreak 三行删掉」）它有牙，不算缺陷；**建议补一组 `Edge` 全 nil、仅 From/To 不同的用例**使其更锋利 |

## 真机清单（归 acceptance 执行，8 条）

见 plan 末节；其中冻结 4（handoff 真仓三类 fail=0）在 ledger 中已诚实标注「未验证」，由 acceptance 核销。
