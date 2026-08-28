# C11 acceptance 台账

- 2026-08-28 review 轮 `cards/C11-review-1` 相对 implement 只多 `docs/ledgers/2026-08-28-c11-plan-ledger.md` +4 行。无生产/测试代码。opening 把自己当实现者，但 git 事实是台账。不把 review 提交合进主线。
- 2026-08-28 复跑 implement `8ea67ad7`：`python3 -m unittest discover -s scripts -p 'test_*.py' -v` → `Ran 26 tests in 0.088s OK`。
- 2026-08-28 M1 唯一：`if installed != fresh:` → `if False and installed != fresh:`。`test_discipline_block_mismatch_is_reported` FAIL `0 != 1`。回滚复绿。
- 2026-08-28 M2 唯一：put argv 插入 `--file`。`test_old_discipline_body_is_put_with_positional_path` FAIL `'--file' unexpectedly found`。回滚复绿。
- 2026-08-28 M3 唯一：`if block not in available_blocks:` → `if False and ...`。`test_dispatch_override_uses_ledger_not_local_directory` FAIL（不再报「节点 plan」）。回滚复绿。
- 2026-08-28 真机只读 `python3 scripts/charter_provision.py check` 退出 1：workflow/template 一致，纪律块 4/7，点名 breakdown/integrate/plan 与账本不一致。这是假绿根因被修好后的预期：check 看账本。未对该活账本 `discipline put`。
- 无代码图、无原型。跳过图对账与原型回灌。
