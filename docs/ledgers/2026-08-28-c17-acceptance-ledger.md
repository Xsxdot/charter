# C17 acceptance 节点台账

> 节点：C17 acceptance；分支 `cards/C17-charter-5` @ `8ec74017`。协调者本机执行。无项目级 `codegraph/`，跳过图对账；L3 轻档跳过 integrate。

| 时间 | 类型 | 事实 / 原始结果 / 判断 |
|---|---|---|
| 2026-08-28 | 复跑 | `graph go test ./...` 退出码 0：`ok graph/cli`、`ok graph/codegraph`、`ok graph/webui`；`go build ./...` 退出码 0。 |
| 2026-08-28 | 复跑 | `graph/webui npm test -- --run`：`Test Files 16 passed (16)`、`Tests 138 passed (138)`；`npm run typecheck` 退出码 0。 |
| 2026-08-28 | 变异 | `FlowPageView.tsx` `selectedStep.iface !== true` 唯一命中 1；取反后 `tsc -b` 退出码 0；`selectedInterfaceCallShowsTargetImplementations` 红（`expected null to be truthy`）。`git checkout` 恢复后同测试绿。 |
| 2026-08-28 | 真机 CLI | canonical `go build ./cmd/codegraph` 后：`flow n_do` testdata `degraded=true missing=基线没有 flows 段`；`tree n_save --up --through n_do --from n_runE --depth 0` 走廊 `n_save→n_do→n_runE`；`tree e_run --depth 0` 不限深 5 节点；`summary` 菜单含 flow/tree。真实 handoff 仓 `summary` 3636/4735/20；`flow Server` 锚定 `m_agentd_Server` 后仍 degraded。 |
| 2026-08-28 | 真机 CLI 别名 | `handoff graph --help` 无 flow/tree；`handoff graph summary` 菜单仍是 chain/who-calls。落 roadmap 56。 |
| 2026-08-28 | 真机扫描 | handoff `baseline.json`：nodes 3636、flows 0、implements 7、edges 4735、entry 162。落 roadmap 55。 |
| 2026-08-28 | 真机浏览器 | C17 Vite `127.0.0.1:18789` + 合成图 mock（真实扫描无 flows，形态无法在 handoff 图上画）。Playwright Chromium 25/25：对外入缝打开方法主语、折叠噪声展开后 degraded、程序入口只高亮不换图、菱形+卫语句侧甩、紫框仅可打开方法、通道不换图、接口双线框选中后实现栏 `Memory.Put`、实现下钻与上一层、A→B→A 重复压栈 depth=4、面包屑截断、右栏三段+agent 摘要、栈底回原 methods scope、蛇形 wrap=2 且无「接上列」、原型 HTML 可打开。截图 `/tmp/c17-acceptance/shots/`。 |
| 2026-08-28 | 对拍差异 | 原型 fork 仍标题「入口流程图」；产品 UI「正在看方法主语」。落 roadmap 57。菱形左缘 overflow 裁切落 roadmap 58。 |
| 2026-08-28 | 审查 findings | 上一轮 4 条（iface 实现栏、CLI 声明缝、wire 缺席/零值、日志上下文）已由 `8ec74017` + 本轮复跑/变异/真机核销。 |
| 2026-08-28 | 图对账 | 本仓无项目级 `codegraph/`，对账不适用。 |
| 2026-08-28 | 结论 | S1/S2 验收通过。S3 扫描与 handoff 别名升级交棒。合并方式等人。 |
