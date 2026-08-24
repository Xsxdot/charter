#!/usr/bin/env python3
# 职责：charter_provision 的缝级断言与 regen 参数化的行为断言。
# 边界：不碰真账本、不写 ~/.handoff——一切外部调用走 mock 或 tmpdir。
#       真机验证（真的 put 一次）归 acceptance 的真机清单，不在这里假装。
import contextlib
import copy
import io
import json
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


class TestRepoSources(unittest.TestCase):
    def test_workflow_source_is_nodes_only(self):
        """D-1：真源顶层只有 nodes。存 states 是改了不报错也不生效的编辑陷阱。

        没有这条断言，把顶层键改名成 states 全部测试照样绿——而 D-1 正是这条约定。
        """
        d = cp.load_repo_def(cp.WORKFLOW_FILE)
        self.assertEqual(list(d.keys()), ["nodes"])
        self.assertTrue(d["nodes"])

    def test_template_source_keeps_required_fields_nonempty(self):
        """R-2：CLI 层强制 executor / prompt / discipline 三者非空，空串会被当场拒。"""
        d = cp.load_repo_def(cp.TEMPLATE_FILE)
        for key in ("executor", "prompt", "discipline"):
            self.assertTrue(d.get(key), f"{key} 为空会被 handoff CLI 拒绝")


class TestRegenParameterized(unittest.TestCase):
    def test_regen_creates_missing_out_dir(self):
        """全新机器上纪律块目录并不存在——handoff 只建 DataDir，不建它的 discipline 子目录。

        没有这条，install 在头号场景（换机重装）必失败，而本机真机验证
        因为目录早就存在，结构性看不见它。
        """
        with tempfile.TemporaryDirectory() as base:
            target = os.path.join(base, "never-created", "discipline")
            sizes = rd.regen(target)
            self.assertTrue(sizes)
            self.assertTrue(os.path.isdir(target))

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


def _ledger_stdout(def_obj):
    """造一条 `handoff X show` 的真实形状输出：INFO 日志混行 + 完整对象 JSON。"""
    return ("2026/08/24 20:00:00 INFO 账本库已打开\n"
            + json.dumps({"Name": "x", "Version": 9, "Def": def_obj,
                          "CreatedAt": "2026-08-24T00:00:00Z"}, ensure_ascii=False))


def _run_check_with_ledger(workflow_def=None, template_def=None, calls=None):
    """跑一次真实路径的 check：只 mock subprocess，不 mock load_ledger_def。

    mock 掉 load_ledger_def 会让「check 不写账本」这条断言变成空转——
    那样 subprocess 根本不被调用，断言在空列表上恒真（本批审查抓到过一次）。
    """
    if workflow_def is None:
        workflow_def = cp.load_repo_def(cp.WORKFLOW_FILE)
    if template_def is None:
        template_def = cp.load_repo_def(cp.TEMPLATE_FILE)

    def fake_run(cmd, *a, **kw):
        if calls is not None:
            calls.append(cmd)
        which = workflow_def if cmd[1] == "workflow" else template_def
        return mock.Mock(returncode=0, stdout=_ledger_stdout(which), stderr="")

    out, err = io.StringIO(), io.StringIO()
    with mock.patch.object(cp.subprocess, "run", side_effect=fake_run), \
         contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
        rc = cp.check()
    return rc, out.getvalue() + err.getvalue()


class TestCheckIsReadOnly(unittest.TestCase):
    def test_check_never_writes_ledger(self):
        """承重属性的锁：check 全程不得发出任何 put。

        必须让 check 真的跑完三段——早退的 check 什么都没做，
        「没发 put」在它身上恒真而毫无意义。
        """
        calls = []
        rc, _ = _run_check_with_ledger(calls=calls)
        # 先证明这一趟真的走到了读账本那一步，否则下面的断言是空转
        self.assertGreaterEqual(len(calls), 2,
                                "check 没走到读账本就返回了，本断言会空转")
        self.assertEqual([c[1] for c in calls], ["workflow", "template"])
        self.assertEqual(rc, 0, "与账本一致时应报 0")
        for cmd in calls:
            self.assertNotIn("put", cmd, f"check 发出了写命令: {cmd}")


class TestCheckFindings(unittest.TestCase):
    """check 的四条承重行为。审查实测这些此前零覆盖——F-8 可整段删、
    纪律块比对可永远判一致、漂移可返回 0、三值退出码可作废，都不撞红任何东西。"""

    def test_drift_returns_1_and_names_node_and_field(self):
        wf = cp.load_repo_def(cp.WORKFLOW_FILE)
        drifted = copy.deepcopy(wf)
        drifted["nodes"][1]["next"] = "被改过的下一列"
        rc, out = _run_check_with_ledger(workflow_def=drifted)
        self.assertEqual(rc, 1, "漂移必须以 1 收场")
        self.assertIn(wf["nodes"][1]["name"], out)
        self.assertIn("next", out)

    def test_not_installed_returns_2_not_1(self):
        def fake_run(cmd, *a, **kw):
            return mock.Mock(returncode=1, stdout="",
                             stderr="Error: 工作流 charter v0: ledger: 记录不存在")

        out, err = io.StringIO(), io.StringIO()
        with mock.patch.object(cp.subprocess, "run", side_effect=fake_run), \
             contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
            rc = cp.check()
        self.assertEqual(rc, 2, "「未安装」与「漂了」的处置不同，不能压成同一个码")
        self.assertIn("install", err.getvalue(), "报文要可行动")

    def test_ledger_unavailable_returns_2(self):
        def fake_run(cmd, *a, **kw):
            return mock.Mock(returncode=1, stdout="",
                             stderr="dial tcp 127.0.0.1:7777: connect: connection refused")

        out, err = io.StringIO(), io.StringIO()
        with mock.patch.object(cp.subprocess, "run", side_effect=fake_run), \
             contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
            rc = cp.check()
        self.assertEqual(rc, 2)
        self.assertIn("账本不可用", err.getvalue())

    def test_dispatch_node_without_override_is_reported(self):
        # F-8：dispatch 节点没写 override.discipline → 必须报（它会落到模板缺省的哨兵上）
        real_load = cp.load_repo_def
        wf = copy.deepcopy(real_load(cp.WORKFLOW_FILE))
        wf["nodes"].append({"name": "新节点", "dispatch": True,
                            "template": cp.TEMPLATE_NAME})

        def fake_load(path):
            return wf if path == cp.WORKFLOW_FILE else real_load(path)

        with mock.patch.object(cp, "load_repo_def", side_effect=fake_load):
            rc, out = _run_check_with_ledger(workflow_def=wf)
        self.assertEqual(rc, 1)
        self.assertIn("新节点", out)
        self.assertIn("override.discipline", out)

    def test_discipline_block_mismatch_is_reported(self):
        # 纪律块比对：已装的块与本仓正文不一致 → 必须点名那个块
        with tempfile.TemporaryDirectory() as fake_out:
            for name in rd.compose_map():
                with open(os.path.join(fake_out, f"charter-{name}.md"), "w") as f:
                    f.write("这不是本仓正文")
            with mock.patch.object(rd, "OUT", fake_out):
                rc, out = _run_check_with_ledger()
        self.assertEqual(rc, 1)
        self.assertIn("与本仓正文不一致", out)


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

    def test_ledger_unavailable_is_not_a_naked_stacktrace(self):
        # 账本够不着时 install 必须给可读报文并返回非 0，而不是把异常裸抛出去。
        # 与「新机器」场景直接叠加：handoff 不在 PATH 就是这条路径。
        buf = io.StringIO()
        with mock.patch.object(cp, "load_ledger_def",
                               side_effect=cp.LedgerUnavailable("agentd 不在")), \
             mock.patch.object(cp.subprocess, "run",
                               return_value=mock.Mock(returncode=0)), \
             mock.patch.object(cp.regen_discipline, "regen", return_value={}), \
             contextlib.redirect_stderr(buf), \
             contextlib.redirect_stdout(io.StringIO()):
            rc = cp.install()          # 不得抛异常
        self.assertNotEqual(rc, 0)
        self.assertIn("账本不可用", buf.getvalue())

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
