# C16：charter skill 对齐 C12——流程图与调用链的查图纪律

**卡**：C16 · **级别**：L1 · **档位**：快道
**状态**：**已批准（2026-08-27，用户）**——本会话指令「charter 侧开卡，派发扫描时并行做」即开工授权；方案沿用上一轮已陈述的四条补丁，本文件收口。
**台账**：过程读数并入本页备注；无独立实验。

## 问题陈述

C12 把「人看流程图、agent 看调用链」写进了查看器契约，但 charter skill 仍把 `codegraph chain` / `context` 的主链写成「主链」，没有声明它无次序、无分支。扫描还在 linux-01 跑，`flows` 数据此刻可能缺席。skill 若改成「去查流程图」而没有命令、没有数据，执行者会拿 BFS 冒充流程。

## 级别与档位

**L1。**单子系统（charter 方法论正文）、不动契约、plan 增量三行写完、验收是读 skill 正文一眼可核。

## 方案

在已有「有图先查图」段上补一条术语纪律，不新增 CLI、不改 `context` 焦点配额。

选定：

1. **一个事实一个家**：完整纪律写在 spec 与 plan 的「有图先查图」段（两处本就是同步副本，C1.5 起如此；本期不拆第三份全文）。
2. debug 节点读不到 plan，所以 debug 只留操作句，不复制整段。
3. using-charter 网关只加一句指针，避免第三份全文。
4. 有 `baseline.flows` 时行为事实以它为准；没有时继续用 chain，并标明无次序无分支。

弃选：把 `codegraph flow` 写进 skill 当已有命令（命令不存在，会诱导编造）；把 context 的 top-5 入缝配额改掉（那是 `graph/codegraph/context.go` 的代码卡，不是 skill 卡）。

## 用户故事

1. spec/plan 执行者能区分「谁能调到谁」和「这个入口实际怎么走」。
2. 无 flows 时仍能用 chain，且不会把邻居列表写成流程图。
3. debug 排查影响面时会先查图，且不会把 chain 当控制流。

## 实现决定

改四个 skill 正文。`codegraph summary`、`context` 配额、`codegraph flow` 子命令不在本期。

## 测试决定

无代码接缝。验收 = 读四处正文：spec/plan 含「调用链 ≠ 流程图」且仍保留 `context`/`chain` 用法；debug 有操作句；using-charter 有指针、无第三份全文。允许否定句「没有 codegraph flow 子命令」；禁止出现作为用法的 `codegraph flow <入口>`。

## Out of Scope

- `codegraph flow` CLI 与 `context` 焦点改用 C12 折叠判据（后续卡，依赖 graph 库）。
- 全局开发规范 / 用户规则里那份 `sym / who-calls / chain / entity / domains` 菜单（不在 charter 仓）。
- linux-01 纪律块分发（roadmap 15）；本期只 regen 本机。
- 扫描器、真 flows 数据（并行的 handoff 重扫，不在本卡）。

## 备注 / plan（L1 三行）

1. 改 `skills/{spec,plan,debug,using-charter}/SKILL.md`：spec/plan 同步补术语段；debug 补操作句；using-charter 补指针。
2. 跑 `python3 scripts/regen_discipline.py`，本机纪律块与 plan 正文一致。
3. 验收：`rg` 四处命中「调用链 ≠ 流程图」；`rg "codegraph flow <" skills/` 为空。
