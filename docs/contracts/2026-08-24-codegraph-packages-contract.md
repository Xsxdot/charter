# 契约增量：baseline `packages` 节（B231，graph v0.6.0）

> 状态：随本提交冻结（分支 cards/B231-contract）
> 上游：handoff `docs/superpowers/specs/2026-08-24-codegraph-scan-responsibility-spec.md`（已批准 2026-08-24）

## 冻结条目（原子化）

1. `Graph` 新增可选顶层键 `packages`，JSON 名 `packages`，`omitempty`——缺席时不得出现在 wire 上（`graph/codegraph/types.go#Graph`）。
2. 值类型 `map[string]Package`；key 为包目录路径，与 `Node.File` 的目录部分（最后一个 `/` 之前）同构。
3. `Package` 仅含 `Summary string`（JSON `summary`）；摘要只许转录源码包 doc 注释，无注释即空串——生成式概括是配方红线。
4. 旧消费方兼容依赖 Go `encoding/json` 的既成行为：Unmarshal 忽略未知键（标准库语义，`json.Unmarshal` 文档「unmatched keys are ignored」）——additive-only 与 lifecycle（v0.3.0）同款先例。
5. `Validate` 对悬空键判硬红：packages 的 key 不是图中任何节点文件的目录 → 报「packages 键 %s 不是图中任何节点的目录」（`graph/codegraph/validate.go#validatePackages`）。
6. 「有目录没条目」**刻意不执法**——validate 全体系无分档，硬红会在补录期逼出删条目拐杖；完整性归扫描配方自检（真机清单）。此为对 spec「warn 档」措辞的落地澄清：validate 无 warn 位，软方向改为不执法，与 roadmap 第 9 条①（锚归属判据不进 validate）同一先例。
7. webui 镜像：`graph/webui/src/api/types.ts#CgGraph` 增可选 `packages?: Record<string, { summary: string }>`；消费归三期，本刀零渲染改动。
8. 版本：charter graph 库合入主线后打 tag `graph/v0.6.0`；handoff go.mod 在实现轮随配方增补一并钉版。

## 可执行冻结

- 悬空键判红：`TestValidatePackagesDanglingKey`（变异复验：判据反转即红，2026-08-24 本轮跑过）。
- 缺席合法 + omitempty + round-trip：`TestValidatePackagesAbsentAndMissingEntryAreLegal`、`TestPackagesRoundTripAndOmitempty`。

## 拍板记录（三重闸门命中一条）

**预算一次性重定标（用户 2026-08-24）**：B231 重扫消化 B220 盲区后，实测直调突破旧预算的方向，按新实测值上调 `legacyBudget`，理由字段统一「B220 测量修正」，`budget-raised` 留痕。被否方案：逐条人工过堂（盲区文件全为存量代码，几乎必然全是测量修正；不重定标则 check 永久红，棘轮失效）。为什么难逆转：预算上调后无法区分「测量修正」与「趁乱混入的新债」，故本次重定标必须一次性、成批、带统一理由——此后任何上调恢复常规禁令。

## 修订记录

- 2026-08-24（B231 breakdown 边界澄清一，协调者拍板）：条目 2 的目录口径明确为**含 TS 目录**——凡出现在任一节点 `file` 上的目录都必须有条目，TS 目录 summary 为空串（TS 无包 doc 惯例，不编造）。「条目数 = 图中目录数」的真机判据因此无需白名单。不改变条目 6 的不执法语义。
- 2026-08-24（B231 验收后回写，协调者）：**「预算一次性重定标」授权已过期未动用**。B231-2 重扫收口后实测：33 个契约方向的直调数与现有 `legacyBudget` **逐条相等**（总计 602 不变，`check` fails 0），无任何方向突破预算——B220 盲区的测量修正在更早的 B223 调用图轮就已落地，本轮是摘要/packages 富化轮，未改拓扑（nodes 3657→3655、edges 4744→4740，均为删除失效符号）。故本次未上调任何预算、未写入「B220 测量修正」理由、未留 `budget-raised` 痕。上文拍板记录保留作历史，但**该一次性授权就此作废**：此后任何预算上调一律回到常规禁令，需重新走 contract。
