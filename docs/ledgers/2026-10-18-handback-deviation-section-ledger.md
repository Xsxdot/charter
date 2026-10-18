# 台账：交回物首节「偏离与自主决定」铁律

对应 spec：`docs/specs/2026-10-18-handback-deviation-section-spec.md`

## 偏离与自主决定

- spec 批准回合未单独进行：授权来自用户卡结论经协调会话转达的显式指令，本台账与 spec 头部留痕；若用户认为仍需批准回合，撤回提交即可，账本侧只增版本不覆盖。
- `install --shared` 从本工作树（分支 `claude/competent-lalande-a0570f`）读正文写共享账本，先于合并 master。原因：任务要求装进账本；账本纪律块按名字取最新版，合并前派发即拿到新正文。若分支被否决，需用 master 正文重跑 install 回写。
- 其余按任务清单执行，无自行拍板。

## 读数

- 2026-10-18 `grep -rn "模板\|template" docs/*.md skills/*/SKILL.md`：无 ledger / review 报告模板文件，只有正文里的「模板」一词引用。docs/ 无可同步模板。
- 2026-10-18 `scripts/regen_discipline.py compose_map`：块只有 contract/breakdown/plan/implement/review/integrate/recon，**无 acceptance**——acceptance 正文改动不入账本，只经 `~/.claude/skills/charter -> ~/workspace/charter` 符号链接（master 检出）生效。
- 2026-10-18 `~/.claude/skills/charter` 是指向主检出的符号链接，本工作树的改动在合并 master 前插件侧看不到。
- 2026-10-18 改前 `python3 scripts/charter_provision.py check`（本工作树，改正文之前）：`workflow charter: 一致 / template charter-story-default: 一致 / 纪律块：7/7 一致`，退出码 0——基线无漂移。
- 2026-10-18 `python3 scripts/test_charter_provision.py`：`Ran 33 tests … OK`。
- 2026-10-18 `python3 scripts/charter_provision.py install --shared`，退出码 0。原始输出（节选）：

  ```text
  template charter-story-default: 已是最新，跳过
  workflow charter: 已是最新，跳过
  纪律块 charter-story-implement: 与本仓正文不一致，安装 → 已入账
  纪律块 charter-story-integrate: 与本仓正文不一致，安装 → 已入账
  纪律块 charter-story-plan: 与本仓正文不一致，安装 → 已入账
  纪律块 charter-story-review: 与本仓正文不一致，安装 → 已入账
  纪律块 charter-story-breakdown / contract / recon: 已是最新，跳过
  纪律块：7 个已处理
  ```
- 2026-10-18 改后 `python3 scripts/charter_provision.py check`：`workflow charter: 一致 / template charter-story-default: 一致 / 纪律块：7/7 一致`，退出码 0。
