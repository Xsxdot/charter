#!/usr/bin/env python3
# 职责：charter_provision 的缝级断言与 regen 参数化的行为断言。
# 边界：不碰真账本、不写 ~/.handoff——一切外部调用走 mock 或 tmpdir。
#       真机验证（真的 put 一次）归 acceptance 的真机清单，不在这里假装。
import contextlib
import io
import os
import sys
import tempfile
import unittest
from unittest import mock

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import charter_provision as cp  # noqa: E402
import regen_discipline as rd   # noqa: E402


def node(name, **kw):
    """构造一个节点字典。kw 原样并入，用于制造差异。"""
    n = {"name": name}
    n.update(kw)
    return n


class TestNodesEquivalent(unittest.TestCase):
    """缝级断言：四条，一条不能少（前两条来自 spec，第三条同族，第四条是 D-2 的锁）。"""

    def test_noise_not_reported(self):
        # 断言1：语义等价、但键序不同 + 一侧显式零值一侧省略 → 判等价
        repo = {"nodes": [node("spec", next="contract")]}
        ledger = {"nodes": [{"next": "contract", "name": "spec",
                             "override": {}, "gate": {}, "dispatch": False,
                             "max_rounds": 0}]}
        ok, diffs = cp.nodes_equivalent(repo, ledger)
        self.assertTrue(ok, f"零值/键序被误报成漂移: {diffs}")
        self.assertEqual(diffs, [])

    def test_node_set_or_order_difference_named(self):
        # 断言2：节点多一个 / 顺序对调 → 判不等价，且清单点名
        repo = {"nodes": [node("spec"), node("plan")]}
        ledger = {"nodes": [node("spec"), node("plan"), node("review")]}
        ok, diffs = cp.nodes_equivalent(repo, ledger)
        self.assertFalse(ok)
        self.assertTrue(any("review" in d for d in diffs), diffs)

        repo2 = {"nodes": [node("plan"), node("spec")]}
        ledger2 = {"nodes": [node("spec"), node("plan")]}
        ok2, diffs2 = cp.nodes_equivalent(repo2, ledger2)
        self.assertFalse(ok2, "节点顺序变化必须判不等价——states 投影按顺序取名")
        self.assertTrue(diffs2)

    def test_gate_difference_named_with_field(self):
        # 断言3：某节点 gate 取值不同 → 判不等价，清单同时含节点名与字段名
        repo = {"nodes": [node("plan", gate={"require_attachment": "spec"})]}
        ledger = {"nodes": [node("plan", gate={"require_attachment": "contract"})]}
        ok, diffs = cp.nodes_equivalent(repo, ledger)
        self.assertFalse(ok)
        joined = " ".join(diffs)
        self.assertIn("plan", joined)
        self.assertIn("gate", joined)

    def test_states_contradiction_ignored(self):
        # 断言4【D-2 的锁】：nodes 完全相同、states/gates 键故意矛盾 → 仍判等价。
        # 这支测试的作用是让「顺手也比一下 states」必然变红。
        same = [node("spec", next="plan"), node("plan")]
        repo = {"nodes": same}
        ledger = {"nodes": same,
                  "states": ["完全", "对不上", "的", "东西"],
                  "gates": {"plan": {"require_attachment": "无中生有"}}}
        ok, diffs = cp.nodes_equivalent(repo, ledger)
        self.assertTrue(ok, f"比对越过了 nodes 子树，违反 D-2: {diffs}")
        self.assertEqual(diffs, [])


class TestRegenParameterized(unittest.TestCase):
    def test_regen_to_tmpdir_leaves_home_untouched(self):
        home_dir = rd.OUT
        before = {f: os.path.getmtime(os.path.join(home_dir, f))
                  for f in os.listdir(home_dir) if f.endswith(".md")}
        with tempfile.TemporaryDirectory() as tmp:
            sizes = rd.regen(tmp)
            self.assertEqual(set(sizes), {"contract", "breakdown", "plan",
                                          "implement", "review", "integrate", "recon"})
            for name in sizes:
                self.assertTrue(os.path.exists(os.path.join(tmp, f"charter-{name}.md")))
        after = {f: os.path.getmtime(os.path.join(home_dir, f))
                 for f in os.listdir(home_dir) if f.endswith(".md")}
        self.assertEqual(before, after, "regen --out 污染了本机纪律块目录")


class TestCheckIsReadOnly(unittest.TestCase):
    def test_check_never_writes_ledger(self):
        """承重属性的锁：check 全程不得发出任何 put。"""
        calls = []

        def fake_run(cmd, *a, **kw):
            calls.append(cmd)
            raise cp.NotInstalled("probe")

        with mock.patch.object(cp.subprocess, "run", side_effect=fake_run), \
             contextlib.redirect_stdout(io.StringIO()), \
             contextlib.redirect_stderr(io.StringIO()):
            cp.check()
        for cmd in calls:
            self.assertNotIn("put", cmd, f"check 发出了写命令: {cmd}")


class TestInstall(unittest.TestCase):
    """install 的行为断言。判据 1/3/4/5 是内部锁（plan 已逐条声明理由）；
    判据 2（幂等跳过）的调用链穿过 nodes_equivalent，在缝上。"""

    def _fake_ledger(self, same):
        """造一个 load_ledger_def 替身：same=True 时返回与仓内一致的 def。"""
        def loader(kind, name):
            path = TEMPLATE_FILE_MAP[kind]
            with open(path) as f:
                import json as _j
                d = _j.load(f)
            if same:
                return d
            return {"nodes": [node("完全不同的节点")]} if kind == "workflow" else {"executor": "x"}
        return loader

    def test_template_put_strictly_before_workflow_put(self):
        # 判据1（承重属性）：断言实际发出的命令序列，不是断言 INSTALL_ORDER 常量。
        cmds = []

        def fake_run(cmd, *a, **kw):
            cmds.append(cmd)
            return mock.Mock(returncode=0)

        with mock.patch.object(cp, "load_ledger_def",
                               side_effect=cp.NotInstalled("首装")), \
             mock.patch.object(cp.subprocess, "run", side_effect=fake_run), \
             mock.patch.object(cp.regen_discipline, "regen", return_value={}), \
             contextlib.redirect_stdout(io.StringIO()):
            rc = cp.install()
        self.assertEqual(rc, 0)
        puts = [c for c in cmds if "put" in c]
        kinds = [c[1] for c in puts]
        self.assertEqual(kinds, ["template", "workflow"],
                         f"安装顺序错，实际发出：{kinds}")

    def test_idempotent_skips_put_when_identical(self):
        # 判据2：两侧一致 → 一条 put 都不发。调用链穿过 nodes_equivalent。
        cmds = []

        def fake_run(cmd, *a, **kw):
            cmds.append(cmd)
            return mock.Mock(returncode=0)

        with mock.patch.object(cp, "load_ledger_def",
                               side_effect=self._fake_ledger(same=True)), \
             mock.patch.object(cp.subprocess, "run", side_effect=fake_run), \
             mock.patch.object(cp.regen_discipline, "regen", return_value={}), \
             contextlib.redirect_stdout(io.StringIO()):
            rc = cp.install()
        self.assertEqual(rc, 0)
        self.assertEqual([c for c in cmds if "put" in c], [],
                         "两侧一致却仍然发出了 put——幂等失效，账本会长出无谓的一版")

    def test_half_install_message_says_retry_is_safe(self):
        # 判据3：workflow put 失败 → 非 0，且报文说清重跑安全
        def fake_run(cmd, *a, **kw):
            return mock.Mock(returncode=0 if cmd[1] == "template" else 3)

        buf = io.StringIO()
        with mock.patch.object(cp, "load_ledger_def",
                               side_effect=cp.NotInstalled("首装")), \
             mock.patch.object(cp.subprocess, "run", side_effect=fake_run), \
             mock.patch.object(cp.regen_discipline, "regen", return_value={}), \
             contextlib.redirect_stderr(buf), \
             contextlib.redirect_stdout(io.StringIO()):
            rc = cp.install()
        self.assertNotEqual(rc, 0)
        self.assertIn("安装失败", buf.getvalue())
        self.assertIn("重跑本命令是安全的", buf.getvalue())

    def test_regen_failure_is_hard_failure_and_named(self):
        # 判据4：regen 抛异常 → 非 0 且点名纪律块，不得吞掉
        buf = io.StringIO()
        with mock.patch.object(cp, "load_ledger_def",
                               side_effect=cp.NotInstalled("首装")), \
             mock.patch.object(cp.subprocess, "run",
                               return_value=mock.Mock(returncode=0)), \
             mock.patch.object(cp.regen_discipline, "regen",
                               side_effect=OSError("磁盘满")), \
             contextlib.redirect_stderr(buf), \
             contextlib.redirect_stdout(io.StringIO()):
            rc = cp.install()
        self.assertNotEqual(rc, 0)
        self.assertIn("纪律块", buf.getvalue())
        self.assertIn("磁盘满", buf.getvalue())

    def test_prints_repo_path(self):
        # 判据5：打印本次安装所用的仓路径（worktree 与 master 会不同，事后要能追）
        buf = io.StringIO()
        with mock.patch.object(cp, "load_ledger_def",
                               side_effect=self._fake_ledger(same=True)), \
             mock.patch.object(cp.subprocess, "run",
                               return_value=mock.Mock(returncode=0)), \
             mock.patch.object(cp.regen_discipline, "regen", return_value={}), \
             contextlib.redirect_stdout(buf):
            cp.install()
        self.assertIn(cp.REPO, buf.getvalue())


TEMPLATE_FILE_MAP = {"workflow": cp.WORKFLOW_FILE, "template": cp.TEMPLATE_FILE}


if __name__ == "__main__":
    unittest.main()
