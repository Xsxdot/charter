# codegraph 刀 3+4 实现账本

## T0：sortFindings 全序

- 范围：`graph/codegraph/check.go`、`graph/codegraph/check_test.go`；补 `From`/`To`/`Edge` tiebreak 与稳定性测试。
- 红因：`TestSortFindingsIsTotalOrder` 在仅按 `Kind+Detail` 时因 `slices.SortFunc` 不稳定而失败，报为两种排列结果不同；不是编译错误。
- 变异复验：暂时移除 tiebreak 后同测试再次失败，恢复后通过。
- 验证：`go test ./codegraph -run TestSortFindingsIsTotalOrder -count=1`、`go test ./codegraph ./cli -count=1`、`go build ./...`、`go vet ./...`、`gofmt -l .` 均通过。
- 双裁决：规格符合（只改排序全序及其测试）；代码质量通过（nil Edge 排序与非 nil 两端均有确定比较，注释说明根因）。
- commit 范围：`f5bc6a0c2329`（T0 实现，ledger 在本卡提交中补入）。

## TC：Diff.containersAdded 全链路

- 范围：`types.go`、`merge.go`、`validate.go`、`absorb.go` 及对应测试；补字段、视图合并、diff 门禁、基线回灌和 JSON 边界。
- 红因：`TestMergeContainersAdded` 先因 `View.Containers` 不含 `k_new` 失败；四个 ValidateDiff 测试分别先因未放行新增容器、未检查冲突/空 domain/未知 domain 失败；`TestAbsorbContainersAddedAndValidate` 先因 Absorb 未回灌容器失败。
- 验证：上述红测均以功能缺失失败后转绿；`TestValidateDiffStillRejectsNodeInUnknownContainer` 保持未知容器报错；`go test ./codegraph ./cli -count=1`、`go build ./...`、`go vet ./...`、`gofmt -l .` 均通过。
- 双裁决：规格符合（仅允许 baseline 或 containersAdded 的引用，新增容器需新 id 且归属 baseline domain）；代码质量通过（Merge/Absorb 均复制容器表，不污染入参，issue 含 id 与原因）。
- commit 范围：`e34cf80f1427`（TC 实现，ledger amend 后纳入本卡提交）。

## T1：漏建三类判据

- 范围：`check.go`、`fitness.go`、`check_test.go`；补 `dead-entry`、`dead-interface`、`dead-contract`，并补当前分支缺失的 Ticket 0 kind/阈值/签名骨架。
- 红因：三个 reconciliation 测试组先因 Check 没有对应 finding 失败；失败均为功能缺失。`TestCheckTable` 的“域内边不检查”夹具改为不声明跨域契约，因为新判据下声明方向零边是真阳性；这是夹具语义修正，不是放宽判据。
- 验证：三类 finding 全部进 Fails；implements 与 assembly 豁免边均计为活；`go run ./cmd/codegraph check --repo ./codegraph/testdata/repo` 实测输出 `fails: []`、`warns: []`；`go test ./codegraph -count=1`、`go test ./cli -count=1`、`go build ./...`、`go vet ./...`、`gofmt -l .` 均通过。
- 双裁决：规格符合（R2 按目标子系统收窄、R3 合并 call/implements/assembly 活边，Check 签名未变）；代码质量通过（Finding.Detail 含方向、原文条目与期望子系统，deleted 节点/边不参与）。
- commit 范围：`fffe081b74fc`（T1 实现，ledger amend 后纳入本卡提交）。

## T2：fitness 判据 1/2

- 范围：`fitness.go`、`check.go`、`fitness_test.go`；实现 `prefix-family` 与 `oversized-package`，从 `Check` 追加到 Warns。
- 红因：空的 prefix/oversized 纯函数及未接线的 Check 先使共享五字符、40 文件和 Warn 档测试失败；失败为功能缺失，不是编译错误。
- 验证：真实最长公共前缀、成员不足、前三字符、跨目录、40+子目录、39 文件和 Warn/Fails 分流测试均通过；`rg` 未发现 `os.ReadDir`、`filepath.Walk`、git 或 `os/exec`；夹具 check 仍为 `fails: []`、`warns: []`；`go test ./codegraph ./cli -count=1`、`go build ./...`、`go vet ./...`、`gofmt -l .` 均通过。
- 双裁决：规格符合（仅消费非 deleted 视图文件集、使用 `/` 路径和真实 LCP，阈值不可配置）；代码质量通过（排序确定、无文件系统副作用、Detail 含目录/数量/阈值及架构法回答提示）。
- commit 范围：`14a0cb1c2713`（T2 实现，ledger amend 后纳入本卡提交）。

## T3：棘轮纯函数

- 范围：`fitness.go`、`fitness_test.go`、`target.go`；实现 `CheckBudgetRatchet(cur, base *Target) []Finding`，补 `LegacyBudgetNote` 冻结字段。
- 红因：stub 在预算上涨、基准缺席新契约和当前顺序测试中返回空切片；失败为功能缺失。等值/下降、nil 基准、零预算和 Kind/措辞断言随后通过。
- 验证：既有契约与新增契约两种 Detail 互不包含，产出顺序跟随 `cur.Contracts`；`go test ./codegraph -count=1`、`go test ./cli -count=1`、`go build ./...`、`go vet ./...`、`gofmt -l .` 均通过。
- 双裁决：规格符合（base 缺席按 0、只产 findings、不读 Note/不判档、签名逐字保持）；代码质量通过（按方向建基准索引、Detail 含方向与数值、无 git/fs 依赖）。
- commit 范围：`7074c6715961`（T3 实现，ledger amend 后纳入本卡提交）。

## T4：CLI 棘轮接线

- 范围：`graph/cli/cli.go`、`graph/cli/cli_test.go`；新增 `--base`、默认分支探测、merge-base/show 读取、v1 宽松 contracts 解析、Note 分档和 stderr 降级。
- 红因：初始 CLI 无 `--base`，非 git 路径没有棘轮跳过提示；功能接线后临时 git 测试先暴露测试夹具预算替换/版本替换问题，修正夹具后五条行为断言全部通过。棘轮失败时 Cobra usage 曾污染 stdout，改为 check 子命令 `SilenceUsage` 后 JSON 纯净。
- 验证：临时 git 仓真实走 `git show`；预算上涨无理由进 fails、非空 Note 进 warns、纯空白 Note 仍 fails、schema v1 基准照常比对；非 git 路径 stderr 含“棘轮/跳过”且 stdout 可 `json.Unmarshal`；`git merge-base HEAD master` 输出 `31bf88b788007ab78f56960b3b107e8e6a01e401`，`git rev-parse --show-prefix` 输出空；`go test ./cli ./codegraph -count=1`、`go build ./...`、`go vet ./...`、`gofmt -l .` 均通过。
- 双裁决：规格符合（显式 base 优先、默认分支顺序固定、只取 contracts、TrimSpace 分档、既有 fails 退出点）；代码质量通过（错误带具体命令/路径上下文，stdout/stderr 信道分离，无新增退出路径）。
- commit 范围：`c380c4a01b86`（T4 实现，ledger amend 后纳入本卡提交）。

## 整分支终审

- 审查范围：相对分支起点 `8d52563` 的完整 diff；发现并在唯一修复波中处理两项非承重问题：更新 `ValidateDiff` 注释以反映 `baseline ∪ containersAdded`，补 `TestCheckDeadEntryAcceptsMergedAddedContainer` 锁冻结 29。
- 全量验证：`go test ./... -count=1` 通过（cli、codegraph 通过，cmd 无测试）；`go build ./...`、`go vet ./...`、`gofmt -l .` 均无输出；`CGO_ENABLED=0` 的 linux/amd64、darwin/arm64、windows/amd64 三平台 `go build ./...` 均通过。
- 误执行命令原始输出：`go test ./graph/codegraph -run TestCheckDeadEntryAcceptsMergedAddedContainer -count=1`（工作目录已是 graph）→ `go: go.mod file not found in current directory or any parent directory; see 'go help modules'`；随后在正确目录运行 `go test ./codegraph -run TestCheckDeadEntryAcceptsMergedAddedContainer -count=1` 通过。
- 双裁决：终审复核未发现承重缺陷；修改波已收敛，当前代码与测试、注释、wire 键和退出/降级信道一致。

## 冻结清单 1~38 逐条自查

1. `dead-entry` 比视图容器 Label：`TestCheckDeadEntryReconciliation`、`check.go#Check`。
2. `dead-interface` 比视图节点 Name：`TestCheckDeadInterfaceReconciliation`、`check.go#Check`。
3. `dead-contract` 只对活跃跨域边计数，deleted 不参与：`TestCheckDeadContractReconciliationCountsAllLiveEdges`、`check.go#Check`。
4. handoff 真仓三类 fail=0：未验证；真机清单 #1 归协调者执行。
5. 三类漏建均进 `Report.Fails`：`TestCheckReconciliationFindingsAreFails`。
6. 既有 `dead-rule` warn 语义不变：`TestCheckExemptionsAndWarns`、`check.go#Check`。
7. prefix-family 同目录共享前 4 字符且成员≥5：`TestPrefixFamilyFindings`、`fitness.go#prefixFamilyFindings`。
8. prefix-family Detail 给真实 LCP：`TestPrefixFamilyFindings/六个同目录文件共享前五字符`。
9. oversized-package ≥40 且无更深目录：`TestOversizedPackageFindings`、`fitness.go#oversizedPackageFindings`。
10. 判据 1/2 进 Warns：`TestFitnessFindingsAreWarnings`。
11. 判据 1/2 只读去重视图文件集：`fitness.go#viewFiles`、`TestFitnessFindingsAreWarnings`。
12. 三阈值为包内常量：`fitness.go` 的 `prefixFamilyMinShared`、`prefixFamilyMinMembers`、`oversizedPackageFiles`。
13. `Check(t *Target, v *View) *Report` 未改：`check.go#Check`、`TestGraphCheck`。
14. `base==nil` 返回 nil：`TestCheckBudgetRatchetNilBase`。
15. 棘轮纯函数不碰 git/fs：`fitness.go#CheckBudgetRatchet`，`rg` 未命中 `os/exec`/git/文件读取调用。
16. Note 空进 Fails、非空进 Warns：`TestGraphCheckBudgetRatchetFailsFromExplicitBase`、`TestGraphCheckBudgetRatchetNoteDowngradesToWarning`。
17. 既有 over-budget 执法不变：`TestCheckTable/越界超预算=fail`、`check.go` 预算结算段。
18. `LegacyBudgetNote` JSON 键和 omitempty：`target.go#Contract`、T4 临时 target JSON 测试。
19. 无新字段的旧 target 仍可加载：`TestGraphCheck` 使用未含 Note 的 fixture target。
20. 基准不可得明示跳过：`TestGraphCheckSkipsRatchetWithActionableWarning`。
21. sortFindings 全序：`TestSortFindingsIsTotalOrder` 及其变异复验。
22. 六个新 kind 不复用既有 kind：`fitness.go` 六常量及 `TestCheckReconciliationFindingsAreFails`/fitness 测试。
23. `containersAdded` 键与 omitempty：`TestDiffContainersAddedJSONKeyIsAdditiveAndOmittable`。
24. Merge 后容器为基线并集增量：`TestMergeContainersAdded`。
25. 新节点可引用新增容器：`TestValidateDiffAllowsNodeInAddedContainer`。
26. 新容器 id 冲突报错：`TestValidateDiffRejectsAddedContainerConflict`。
27. 新容器 domain 为空或未知报错：`TestValidateDiffRejectsAddedContainerWithoutDomain`、`TestValidateDiffRejectsAddedContainerUnknownDomain`。
28. Absorb 回灌新增容器：`TestAbsorbContainersAddedAndValidate`。
29. 新增容器入口不报 dead-entry：`TestCheckDeadEntryAcceptsMergedAddedContainer`。
30. dead-entry 节点必须落 to 域：`TestCheckDeadEntryReconciliation/同_Label_但节点在错误子系统`。
31. dead-interface 节点必须落 from 域：`TestCheckDeadInterfaceReconciliation`。
32. dead-contract 活边并集含 call/implements/assembly：`TestCheckDeadContractReconciliationCountsAllLiveEdges`。
33. 基准缺席预算按 0：`TestCheckBudgetRatchetReportsNewContractDebt`。
34. 新契约与既有契约措辞分离：`TestCheckBudgetRatchetReportsNewContractDebt`。
35. schema v1 基准照常比对：`TestGraphCheckBudgetRatchetAcceptsSchemaV1Base`。
36. 分档读取 cur 侧 Note：`TestGraphCheckBudgetRatchetNoteDowngradesToWarning`，`codegraph.ApplyBudgetRatchet`。<sup>†</sup>
37. `TrimSpace` 收紧空白 Note：`TestGraphCheckBudgetRatchetWhitespaceNoteStillFails`。
38. 宽松基准解析的产物只流向棘轮比较（`legacyBudget` 与 `unplacedBudget` 两个预算字段），不得传给 `Check`：`loadBudgetBase` 注释（R11，取代 R5「只取 contracts 段」的原表述）与 `TestGraphCheckBudgetRatchetAcceptsSchemaV1Base`、`TestGraphCheckSubsystemRatchetAgainstTrueSchemaV1Base`。<sup>†</sup>

<sup>†</sup> **2026-08-23 C1.1 更正**：第 36 条原锚 `appendBudgetRatchet` 是 CLI 私有函数，已在 C1.1 中删除，分档下沉为 `graph/codegraph/fitness.go#ApplyBudgetRatchet`。第 38 条原文「宽松基准解析只取 contracts」在 C1.1 中不再成立——棘轮要比对基准侧 `subsystems[].unplacedBudget`，该段随之投影；约束改为按**流向**成立，见契约 `2026-08-23-codegraph-reconcile-fitness-contract.md` 的 **R11** 回写。
