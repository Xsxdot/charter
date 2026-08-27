# C17 plan 节点台账

> 节点：C17；产出物：`docs/superpowers/plans/c17-plan.md`；本轮只写计划与台账，不实现 S1/S2 代码。

| 时间 | 类型 | 事实 / 原始结果 / 判断 |
|---|---|---|
| 2026-08-28 | 分支 | `git status --short --branch`：`## cards/C17-charter-3`；工作树初始干净。 |
| 2026-08-28 | 拍板提交 | 本地初查 `git cat-file -t 24d86ed3` 原文：`fatal: Not a valid object name 24d86ed3`；按输入要求执行 `git fetch origin cards/C17-charter-2`，原文显示 `* [new branch] cards/C17-charter-2 -> origin/cards/C17-charter-2`，随后 `git cat-file -t 24d86ed3` 输出 `commit`。`git log --oneline origin/cards/C17-charter-2 -1`：`24d86ed docs(C17): 拍板拆解稿——轻档单轮实现，不扇出`。 |
| 2026-08-28 | 范围 | `docs/superpowers/specs/c17-breakdown.md` §五将实现包限为 S1 `graph/codegraph` + `graph/cli` 和 S2 `graph/webui` 文件集；S3 handoff 扫描配方无本仓文件集，保持交棒。 |
| 2026-08-28 | 图前置 | 仓库根目录没有项目级 `codegraph/`；只有 `graph/codegraph/testdata/repo/codegraph/` 夹具。按 contract §5.1 不创建项目 `best.json`/`target.json`/diff，也不运行项目图 `context`。 |
| 2026-08-28 | 基线 | 在 `graph` 执行 `go build ./...`，退出码 `0`，stdout 为空。 |
| 2026-08-28 | 基线 | 在 `graph` 执行 `go test ./codegraph/ ./cli/ -count=1`，退出码 `0`；原文：`ok  github.com/Xsxdot/charter/graph/codegraph 0.025s`、`ok  github.com/Xsxdot/charter/graph/cli 0.159s`。 |
| 2026-08-28 | 基线 | 在 `graph/webui` 执行 `npm run typecheck`，退出码 `127`；原文：`> codegraph-webui@0.0.0 typecheck`、`> tsc -b`、`sh: 1: tsc: not found`。因此 WebUI typecheck 本轮基线未验证。 |
| 2026-08-28 | 基线 | 在 `graph/webui` 执行拆解 §五指定 Vitest 命令，退出码 `127`；原文：`> codegraph-webui@0.0.0 test`、`> vitest run ...`、`sh: 1: vitest: not found`。因此指定 WebUI 测试本轮基线未验证。 |
| 2026-08-28 | 依赖事实 | `graph/go.mod` 直接依赖 Cobra `v1.10.2`；`graph/cli/deps_test.go#TestModuleDependencyAllowlist` 锁定允许依赖。contract §3.4-§3.7 还给出 Cobra/pflag 行为出处；计划不新增依赖。 |
| 2026-08-28 | 现状签名 | `graph/codegraph/flow.go#LookupFlow` 当前签名为 `func LookupFlow(v *View, g *Graph, repoRoot, query, id string) (*FlowLookupResult, error)`；`tree.go#BuildCallTree` 当前签名为 `func BuildCallTree(v *View, opts TreeOptions) (*TreeResult, error)`；均与 contract §2.4-35/§2.5-44 一致，但现状实现仍需按冻结 JSON/行为新增锁缝测试复核。 |
| 2026-08-28 | 现状缺口 | 当前 viewer `flowpage.ts` 的 `FlowPageModel` 仍以 `entryNodeId/entryName/ownership/family/callChain` 为主；`FlowPageView.tsx` 仍将程序入口作为泳道主语；`RightPanel.tsx` 的程序入口按钮仍可打开流程图；`CodegraphPage.tsx` 仍有“返回结构轴”外层切换。计划将这些作为 S2 改动点，未在本轮实现。 |
| 2026-08-28 | 现状形态 | 当前 `FlowChart.tsx` 以 `step.targetIsEntry` 决定紫框/下钻；contract §2.1-4 改为 `call.to` 命中承重主语集合，`kind=entry` 通道不得自动成为紫框目标。计划为此加入 `FlowPageModel` 主语集合和反面锁。 |
| 2026-08-28 | 现状形态 | 当前 `flowlayout.ts#layoutFlowSteps` 已将全 return 分支臂排除出 `sequence`、映射 branch 为 `diamond`；contract 要求实现轮以接缝断言锁住这些行为，并补充真实 DOM 几何/guard 反面断言。 |
| 2026-08-28 | 决定 | C17 计划只覆盖 S1/S2；不改 handoff 扫描配方、不创建项目图、不扩展 breakdown 第五节文件集、不把 S3 真机行为写成已验证。 |
| 2026-08-28 | 计划基线复核 | 按计划第 5.1 的完整 S2 文件列表执行 `npm test -- src/app/codegraph/flowpage.test.ts src/app/codegraph/FlowChart.test.tsx src/app/codegraph/flowlayout.test.ts src/app/codegraph/FlowPageView.test.tsx src/app/codegraph/RightPanel.test.tsx src/app/codegraph/TwoAxisPage.test.tsx src/app/codegraph/CodegraphPage.test.tsx src/app/codegraph/CodegraphPage.wire.test.tsx`；退出码 `127`，原文：`sh: 1: vitest: not found`。该判据基线未验证，计划不写成通过。 |
| 2026-08-28 | 计划自检 | `wc -l docs/superpowers/plans/c17-plan.md` 输出 `631`；`git diff --check -- docs/superpowers/plans/c17-plan.md docs/ledgers/2026-08-28-c17-plan-ledger.md` 无输出；占位符扫描 `rg -n "TBD|TODO|同 Task|适当的|占位符"` 无命中。 |
| 2026-08-28 | 原型边界 | `find /root/.handoff -path '*/prototypes/codegraph-two-axis/pages/behav-flow.html' -print` 与 `/root` 同目标查找均无输出；用户确认这是 gitignore fork 副本、远端工作树本来没有。计划只采用冻结 contract、第四稿 spec、`prototypes/base/README.md` 形态摘要，原型逐屏对拍移入 acceptance。 |
| 2026-08-28 | 放弃尝试 | 首次一次性追加完整计划的 `apply_patch` 未应用，工具返回 patch 校验失败；工作树未产生计划文件。随后拆成分段 patch 成功，不把失败尝试当作产出。 |
| 2026-08-28 | 计划修订 | 自检发现 `flows[entryId]` 遗留通道若直接并入 openable 集合会违反 contract §2.1-5/6；计划已明确只并入存在且 `kind != entry` 的 flows id，并加入 entry target 紫框反面断言。 |
| 2026-08-28 | 暂存自检 | `git add docs/superpowers/plans/c17-plan.md docs/ledgers/2026-08-28-c17-plan-ledger.md` 后，`git diff --cached --check` 无输出；`git diff --cached --name-only` 仅为本计划与本台账；占位符扫描无命中。 |
| 2026-08-28 | 提交 | `git commit -m "docs(C17): add implementation plan"` 成功，原文：`[cards/C17-charter-3 794c4e1] docs(C17): add implementation plan`；提交包含计划与台账，共 `706 insertions(+)`。提交后 `git status --short --branch` 原文：`## cards/C17-charter-3`，工作树干净。 |
| 2026-08-28 | 提交修订 | 为把提交事实写入同批台账，执行 `git commit --amend --no-edit` 成功；该次 amend 产生提交 `d2ef9666d2bcfb4f6729981bcd8f18834ed32c02`，包含计划与台账，共 `707 insertions(+)`。 |
