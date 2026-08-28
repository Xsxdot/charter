# C16：charter skill 对齐 C12——流程图与调用链的查图纪律

**卡**：C16 · **级别**：L1 · **档位**：快道
**状态**：**已批准（2026-08-27，用户）**——本会话指令「charter 侧开卡，派发扫描时并行做」即开工授权；方案沿用上一轮已陈述的四条补丁，本文件收口。
**修订（2026-08-28）**：C17/`flow`+`tree` 与 B277 真 flows 已合主。原方案「今天没有 `codegraph flow`、没有就用 chain」作废。用户裁决仍改四处（spec/plan 全文、debug 操作句、using-charter 指针），不把全文只放网关。独立子 agent 审稿后按审稿落地。
**台账**：过程读数并入本页备注；无独立实验。

## 问题陈述

C12 把「人看流程图、agent 看调用链」写进了查看器契约，但 charter skill 把 `codegraph chain` / `context` 的主链写成「怎么走」。C17 已挂 `flow`/`tree`，B277 已写入 Go `flows`。若不改 skill，执行者仍会拿 BFS 冒充流程，或对 `GET /console` 这类通道跑 `flow`。

## 级别与档位

**L1。**单子系统（charter 方法论正文）、不动契约、plan 增量三行写完、验收是读 skill 正文一眼可核。

## 方案

在已有「有图先查图」段上换成 C17 分流表，保留 C1.5 的 context 词表 / `--full` / truncated。不改 `context` 焦点配额，不实现新 CLI。

选定：

1. **一个事实一个家**：完整纪律写在 spec 与 plan 的「有图先查图」段（两处本就是同步副本，C1.5 起如此；本期不拆第三份全文）。版式不同：spec 外层 bullet，plan 加粗段。
2. debug 节点读不到 plan，所以 debug 只留操作句，不复制整段。
3. using-charter 网关只加一句指针（点名五个命令），避免第三份全文。
4. 怎么走 → `codegraph flow`。无数据则 `degraded` 且 `steps` 空，然后读源码。**禁止拿 `chain` 冒充。** chain 仍用来碰过谁。
5. `flow` 的主语是对外契约方法，不是 CLI/HTTP/WS 通道。

弃选：把全文只放 using-charter（网关不进纪律块，L3 plan 执行者看不见）；把 `go run` module path 或已删除的 `handoff graph` 写进 skill；改 context 的 top-5 入缝配额。

## 用户故事

1. spec/plan 执行者能区分「谁能调到谁」和「这个方法实际怎么走」。
2. 无 flows 时 `flow` 显式 degraded，去读源码，不会把 chain 邻居列表写成流程图。
3. debug 排查影响面时会先查图，且不会把 chain 当控制流。

## 实现决定

改四个 skill 正文。`codegraph summary`（C17 已含 flow/tree）、`context` 配额、CLI 实现不在本期。改 plan 后 `python3 scripts/regen_discipline.py`。

## 测试决定

无代码接缝。验收 = 读四处正文：spec/plan 含「调用链 ≠ 流程图」和作为用法的 `codegraph flow`；debug 有操作句且指向 `flow`；using-charter 有指针、无第三份全文。`skills/` 不得再写「今天没有 `codegraph flow`」或「读 `baseline.json` 的 `flows[<id>]`」当手续。

## Out of Scope

- 实现或改 `codegraph flow`/`tree` CLI 本身（C17 已落地）。
- `context` 焦点改用 C12 折叠判据。
- 全局开发规范 / 用户规则里那份 `sym / who-calls / chain / entity / domains` 菜单（不在 charter 仓；建议另改）。
- linux-01 纪律块分发（roadmap 15）；本期只 regen 本机。
- 扫描器、补 TS flows。

## 备注 / plan（L1 三行）

1. 改 `skills/{spec,plan,debug,using-charter}/SKILL.md`：spec/plan 同步分流表；debug 操作句；using-charter 指针。
2. 跑 `python3 scripts/regen_discipline.py`，本机纪律块与 plan 正文一致。
3. 验收：`rg` 四处命中「调用链 ≠ 流程图」；spec/plan/debug 命中 `codegraph flow` 或「用 `flow`」；`skills/` 无「今天没有 `codegraph flow`」。
