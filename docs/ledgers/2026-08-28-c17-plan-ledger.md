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
| 2026-08-28 | 实现轮开始 | 当前分支 `cards/C17-charter-4`，工作树初始干净；已读取 handoff skill 与 C17 计划，按用户要求进入 T1→T4 实现轮。 |
| 2026-08-28 | 实现范围 | 计划 §3–§6 将本轮文件集限定为 `graph/codegraph`、`graph/cli` 与 `graph/webui` 指定 viewer 文件；不改扫描配方、chain/who-calls、项目图或新增依赖。 |
| 2026-08-28 | T1 红测 | 执行 `cd graph && go test ./codegraph/ ./cli/ -run 'Test(LookupFlow|CallTree|GraphFlow|GraphTree|GraphSummary|GraphCommand)' -count=1`；原始失败：`--- FAIL: TestLookupFlowNeighborsUseActiveEdges`，输出 `[{ID:ghost Name: File: Line:0 Kind: Channel:} {ID:caller-b Name:Same File: Line:0 Kind:func Channel:} {ID:helper Name:helper File: Line:0 Kind:func Channel:}]`；末尾 `FAIL github.com/Xsxdot/charter/graph/codegraph`，`ok github.com/Xsxdot/charter/graph/cli`。确认断言红来自悬空 caller 被纳入邻域。 |
| 2026-08-28 | T2 实现 | 仅修改 Go flow/tree 查询及对应测试：邻域过滤活跃端点/边，implements 按 View join，FlowRef 按 name/id 排序；未改扫描配方、chain/who-calls 或依赖。 |
| 2026-08-28 | T2 验证 | 执行 `cd graph && go test ./codegraph/ ./cli/ -run 'Test(LookupFlow|CallTree|GraphFlow|GraphTree|GraphSummary|GraphCommand)' -count=1`，原始输出：`ok github.com/Xsxdot/charter/graph/codegraph 0.003s`、`ok github.com/Xsxdot/charter/graph/cli 0.007s`。 |
| 2026-08-28 | T2 验证 | 执行 `cd graph && go test ./codegraph/ ./cli/ -count=1`，原始输出：`ok github.com/Xsxdot/charter/graph/codegraph 0.026s`、`ok github.com/Xsxdot/charter/graph/cli 0.176s`。 |
| 2026-08-28 | T2 验证 | 执行 `cd graph && go build ./...`，退出码 `0`，原始 stdout 为空。执行根目录 `git diff --check`，原始 stdout 为空。 |
| 2026-08-28 | WebUI 依赖 | 在 `graph/webui` 执行 `npm ci`；原始输出：`added 168 packages, and audited 169 packages in 1s`、`found 0 vulnerabilities`。 |
| 2026-08-28 | T3 红测 | 执行计划 §5.1 的完整 Vitest 文件命令；原始摘要：`Test Files 8 failed (8)`、`Tests 24 failed | 3 passed (27)`。关键原始失败包括 `expected undefined to match object { id: 'm_run', ... }`（旧模型无 subject）、`expected undefined to be truthy`（旧模型无 missing）、`TypeError: Cannot read properties of undefined (reading 'map')`（旧模型无 callers/implementations/channels）、`expected 1 to be greater than 1`（旧布局未按宽度形成多列），以及结构轴找不到 `role=button name=Runner.Run`。确认 T3 红测由旧入口主语模型/组件契约缺失触发，而非测试命令找不到依赖。 |
| 2026-08-28 | T4 环境复核 | 在仓库根目录误执行 `npm test ...` 与 `npm run typecheck`；两命令均退出 `254`，原始错误：`npm error enoent Could not read package.json: Error: ENOENT: no such file or directory, open '/root/.handoff/worktrees/c39ee34e/package.json'`。计划工作目录为 `graph/webui`，该结果不作为 WebUI 验证。 |
| 2026-08-28 | T4 首轮 | 在 `graph/webui` 执行指定 8 文件 Vitest；退出码 `1`，原始摘要：`Test Files 8 failed (8)`、`Tests 14 failed | 13 passed (27)`。失败含测试夹具排序/可选 missing/宽度与组件访问名；未将其写成通过。并行执行 `npm run typecheck` 退出码 `2`，原始错误：`TS2698: Spread types may only be created from object types`（FlowChart.test.tsx、FlowPageView.test.tsx、RightPanel.test.tsx、TwoAxisPage.test.tsx）。 |
| 2026-08-28 | T4 修正 | 按真实失败修正测试夹具：locale 排序、`missing` 可选键、折列宽度、祖先面包屑截断及组件可访问名；移除无必要的 `as never`。未改变扫描配方或 chain/who-calls。 |
| 2026-08-28 | T4 局部绿 | `npm run typecheck`（`graph/webui`）退出码 `0`，原始输出为 `> codegraph-webui@0.0.0 typecheck`、`> tsc -b`。`FlowPageView.test.tsx`：`Test Files 1 passed`、`Tests 5 passed`；`RightPanel.test.tsx`：`Test Files 1 passed`、`Tests 2 passed`；`TwoAxisPage.test.tsx`：`Test Files 1 passed`、`Tests 2 passed`。 |
| 2026-08-28 | T4 联测 | 在 `graph/webui` 执行计划指定 8 文件 Vitest，退出码 `0`；原始摘要：`Test Files 8 passed (8)`、`Tests 27 passed (27)`。 |
| 2026-08-28 | T4 静态自检 | `git diff --check` 无输出；受限文件名扫描未命中 `scan`/`chain`/`who-calls`；viewer 生产代码未命中 `console.log`。现有 `entryNodeId` 仅作为 C12 兼容输入命名保留，注释已明确其语义为当前方法主语。 |
| 2026-08-28 | 变异前置 | 选定 `flowpage.ts` 主语 openable 判据做取反变异；`rg -n -F "subjectNode.kind !== 'entry'" ... | wc -l` 原始输出 `1`，确认命中唯一。 |
| 2026-08-28 | 变异自验 | 将唯一主语判据取反为 `subjectNode.kind === 'entry'`；先执行 `npm run typecheck` 退出码 `0`。随后行为断言 `npm test -- --run src/app/codegraph/flowpage.test.ts` 原始摘要：`Tests 2 failed | 5 passed (7)`，失败明确为方法 openable 变 false、entry openable 变 true；确认变异生效。再跑指定 8 文件联测，原始摘要：`Test Files 1 failed | 7 passed (8)`、`Tests 2 failed | 25 passed (27)`。 |
| 2026-08-28 | 变异恢复 | 已恢复 `subjectNode.kind !== 'entry'` 原实现；未保留变异代码。 |
| 2026-08-28 | 通道反面红测 | 在 `FlowPageView.test.tsx` 增加“无对应路径不选中流程步”断言；首次执行 `npm test -- --run src/app/codegraph/FlowPageView.test.tsx` 退出码 `1`，原始摘要：`Tests 1 failed | 4 passed (5)`，失败节点为无条件选中的 `a-to-b`。 |
| 2026-08-28 | 通道修正绿测 | `highlightChannel` 改为仅匹配 `kind=call && to===channel.id` 的第一步，否则清空选中；同时为 degraded 页增加 `console.warn`。修正后 `FlowPageView.test.tsx` 原始摘要：`Test Files 1 passed (1)`、`Tests 5 passed (5)`；`npm run typecheck` 退出码 `0`。 |
| 2026-08-28 | 收尾验证 | 在 `graph/webui` 执行 `npm test -- --run`，退出码 `0`；原始摘要：`Test Files 16 passed (16)`、`Tests 136 passed (136)`。同目录 `npm run typecheck` 退出码 `0`，原始输出为 `> codegraph-webui@0.0.0 typecheck`、`> tsc -b`。 |
| 2026-08-28 | 收尾验证 | 在 `graph` 执行 `go test ./...`，退出码 `0`；原始输出：`ok github.com/Xsxdot/charter/graph/cli 0.434s`、`? github.com/Xsxdot/charter/graph/cmd/codegraph [no test files]`、`ok github.com/Xsxdot/charter/graph/codegraph 0.048s`、`ok github.com/Xsxdot/charter/graph/webui 0.004s`。同目录 `go build ./...` 退出码 `0`，stdout 为空。 |
| 2026-08-28 | 最终验证 | 注释补齐后再次执行 `graph/webui` 的 `npm test -- --run`，退出码 `0`，原始摘要：`Test Files 16 passed (16)`、`Tests 136 passed (136)`；`npm run typecheck` 退出码 `0`。 |
| 2026-08-28 | 最终验证 | 注释补齐后再次执行 `graph` 的 `go test ./...`，退出码 `0`；原始输出：`ok github.com/Xsxdot/charter/graph/cli (cached)`、`? github.com/Xsxdot/charter/graph/cmd/codegraph [no test files]`、`ok github.com/Xsxdot/charter/graph/codegraph (cached)`、`ok github.com/Xsxdot/charter/graph/webui (cached)`。`go build ./...` 退出码 `0`，`git diff --check` 无输出。 |
| 2026-08-28 | 提交 | `git add` 指定 21 个计划文件后 `git diff --cached --check` 无输出；`git commit -m "feat(C17): align flow viewer with contract methods"` 成功，原始输出：`[cards/C17-charter-4 83c7ab5] feat(C17): align flow viewer with contract methods`、`21 files changed, 1202 insertions(+), 2935 deletions(-)`。提交后分支为 `cards/C17-charter-4`，工作树干净。 |
