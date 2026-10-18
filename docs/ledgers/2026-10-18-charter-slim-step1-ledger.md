# 台账：charter 瘦身第一步（2026-10-18）

spec：`docs/specs/2026-10-18-charter-slim-step1-spec.md`。分支 `charter-slim-step1`，切自 `claude/competent-lalande-a0570f`（偏离块，`1dece20`）。

## 事实与读数（方案前调查）

- `handoff card list --all --json` 按项目：handoff 365、charter 32、benchmarking 20、ai-hub 13、cloth 10、erp 8、tk 6；总 460（已完成 359、终止 95）。
- charter 仓提交按月：2026-08 322、09 4、10 11；触及 `graph/` 111 次、`skills/` 42 次、`docs/` 247 次。
- 有 `codegraph/` 目录的项目仓：handoff（diffs 2，最近 2026-10-17）、cloth（diffs 0，最近 2026-09-10）；tk、erp 无。
- erp 自 2026-08-20 提交 167 次、卡 8 张；tk 提交 30 次、卡 6 张、近两月改动文档 19 份零篇引用架构法。
- C12 集成报告（`docs/ledgers/2026-08-27-c12-integrate-report.md`）：契约冻结 40 条，plan 预测零冲突，实际合并冲突 8+ 文件；40 条中 7 条移交/部分。

## 判断

- 代码图在产品仓没有消费者，用户裁决彻底删除而非剥离。
- 「图对账」列随 recon 一起删；流定义只删节点，格式不变，仍是 v13 的 put（账本版本号由 handoff 分配）。
- 台账纪律五份副本已各自漂移出细微差异，收成网关一份、纪律块附录注入。

## 命令与原始输出

```
$ git rm -r -q graph prototypes skills/recon install.sh .github/workflows/ci.yml .github/workflows/release.yml
$ python3 -m unittest scripts.test_charter_provision
Ran 33 tests in 0.053s
OK
$ python3 scripts/regen_discipline.py --out <scratch>/blocks
contract 7077 / breakdown 11401 / plan 8096 / implement 15657 / review 20331 / integrate 3739
$ grep -rnE "codegraph|图对账|best\.json|target\.json|recon" skills/ README.md flows/charter.workflow.json hooks/ scripts/regen_discipline.py scripts/charter_provision.py | grep -v 2026-10-18
（零命中）
```

```
$ python3 scripts/charter_provision.py install --shared
template charter-story-default: 已是最新，跳过
workflow charter: 与账本不一致，安装（3 处差异）
纪律块 breakdown/contract/implement/integrate/plan/review: 与本仓正文不一致，安装 → 已入账（6 个）
$ python3 scripts/charter_provision.py check --shared
workflow charter: 一致 / template charter-story-default: 一致 / 纪律块：6/6 一致   rc=0
```

在飞卡钉在原版本；账本里的 `charter-story-recon` 块未删（handoff 的 discipline 无 delete，且 v13 旧卡的「图对账」列仍可能引用），留待 B436 一并清。
