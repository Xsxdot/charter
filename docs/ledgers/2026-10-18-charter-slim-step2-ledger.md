# 台账：charter 瘦身第二步（2026-10-18）

spec：`docs/specs/2026-10-18-charter-slim-step2-spec.md`。分支 `charter-slim-step2`，切自 master f55ee45。

## 判断

- integrate 的内容归 review（父卡最终验收）而非 finish：子卡在各自 finish 合入父卡分支，父卡 review 时分支已是集成树，全量与生产闭环对账在那里才有意义；finish 只剩合主线。
- plan 列不设门：bug 流无 spec 附件，v13 的「spec 或 breakdown 附件」门对它是拦路石。
- 旧纪律块 contract/breakdown/integrate/recon 留在账本：无 delete 手段，v13 在飞卡仍引用。

## 命令与原始输出

```
$ git rm -r -q skills/contract skills/breakdown skills/debug skills/acceptance skills/integrate
$ python3 -m unittest scripts.test_charter_provision
Ran 29 tests ... OK
$ python3 scripts/regen_discipline.py --out <scratch>/blocks2
plan 9397 / implement 17753 / review 23458
```

```
$ python3 scripts/charter_provision.py install --shared
workflow charter: 与账本不一致，安装（13 处差异）
纪律块 implement/plan/review: 与本仓正文不一致，安装 → 已入账（3 个）
$ python3 scripts/charter_provision.py check --shared
workflow charter: 一致 / template charter-story-default: 一致 / 纪律块：3/3 一致   rc=0
```

在飞卡 B435（contract）、B436（待办→spec）钉 v13，按旧列序走完；旧纪律块 contract/breakdown/integrate/recon 留账本。
