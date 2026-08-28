# C11 实现计划：charter_provision 纪律块改用 handoff 账本

- **卡**：C11
- **标题**：charter_provision 的纪律块比对不再读取 B229 已退役的本地目录
- **状态**：实现计划；本节点只产出本文件与过程台账，不实现 Python 代码。
- **输入**：docs/superpowers/specs/c11.md（已批准，L2）、docs/contracts/2026-08-24-charter-provisioning-contract.md、docs/reviews/c11-spec-review.md。
- **本节点基线**：当前分支 cards/C11-charter，HEAD 4250d1b docs(C11): spec r1 — provision 纪律块改对账本。spec 中记录的 fix/c11-provision-ledger 是历史工作树，不是本轮切换目标；执行者只在当前分支工作。
- **法定产出**：docs/superpowers/plans/c11-plan.md。
- **过程台账**：docs/ledgers/2026-08-28-c11-plan-ledger.md；每个新事实、命令及原始结果都追加到该文件。
- **范围**：只改 scripts/charter_provision.py、scripts/test_charter_provision.py、scripts/regen_discipline.py 的指定段落、docs/contracts/2026-08-24-charter-provisioning-contract.md、docs/roadmap.md。不得改 handoff 仓、skills/ 正文、flows/*.json、docs/superpowers/specs/c11.md、审查文件。
- **图**：仓内没有项目级 codegraph/，且 spec 已说明 scripts/ 不在 charter graph/ 扫描范围内；本卡无图覆盖债，不调用 codegraph。

## 1. 基线、冻结事实与外部边界

### 1.1 已在动手前实际复核的基线判据

本节点已在当前 HEAD 运行以下命令；原始结果已追加至台账：

~~~text
python3 -m unittest discover -s scripts -p 'test_*.py'
~~~

结果为退出码 1：.....F..............，Ran 20 tests in 0.015s，FAILED (failures=1)；唯一失败是 test_check_never_writes_ledger 的 AssertionError: 1 != 0 : 与账本一致时应报 0。当前 helper 只模拟 workflow/template，生产 check 第三段仍读 regen_discipline.OUT，所以该失败正好暴露待修的假绿缝。

另外已实际复核：

~~~text
python3 -m py_compile scripts/charter_provision.py scripts/regen_discipline.py scripts/test_charter_provision.py
git diff --check
~~~

两条均退出码 0、原始输出为空。两个真源的 JSON 顶层键分别是 charter.workflow.json: ['nodes'] 与 charter-default.template.json: ['executor', 'target', 'purpose', 'branch_prefix', 'prompt', 'discipline']。

### 1.2 对侧行为事实及出处

本节点不调用 handoff CLI；下列行为来自已冻结的 C11 spec 与契约，其对侧源码出处也保留在冻结物中。实现者不得把这些行为改成另一种形态；若真机与冻结事实不符，停止并把原始报错写入台账。

| 行为 | 冻结出处 | 计划中的使用 |
|---|---|---|
| discipline get <name> 成功 stdout 是版本行 {name} v{N} 后接正文；正文无尾换行时 CLI 补一行 | docs/superpowers/specs/c11.md:35-39,73-81；对侧 cmd/discipline.go:64-70 | load_discipline_body 只去掉命中的版本头，其后的全部文本参与逐字比较 |
| get 非零且 stderr 含 记录不存在 是缺块；其他非零是账本不可用 | docs/superpowers/specs/c11.md:41-43、docs/contracts/2026-08-24-charter-provisioning-contract.md:378-400 | check 缺块返回 1 并报漂移；install 缺块进入 put；其他失败返回 2 且不写 |
| discipline put 的第二个位置参数是文件路径，不是 --file；每次写入新增版本 | docs/superpowers/specs/c11.md:45-49；对侧 cmd/discipline.go:74-94、internal/ledger/disciplines.go:43-66 | install 使用 ['handoff','discipline','put',name,tmp_path]；相同正文先 skip |
| 空/空白正文、超过 64 KiB、含路径分隔符的名字由对侧拒绝 | docs/superpowers/specs/c11.md:45-49；对侧 internal/ledger/disciplines.go:17-20,32-51 | charter 不截断、不改名、不吞 put 失败；错误硬失败 |
| B229 后 agentd 不读写 <DataDir>/discipline 文件，改由 discipline CLI 读写账本 | docs/superpowers/specs/c11.md:35-39；对侧 internal/agentd/discipline.go:1-12,30-35,105-127 | charter_provision.py 不再读 regen_discipline.OUT；F-8 不看本地同名文件 |

以上是跨进程边界的已冻结输入，不是本节点亲跑的 handoff 结果；真机清单见第 8 节，均标记为协调者执行、当前节点未验证。

## 2. 任务依赖、文件集与接口

### 2.1 DAG

~~~text
T1 测试/harness 红灯
   └──> T2 discipline get/put + install/check 最小实现
             └──> T3 冻结物与 roadmap 回写
                       └──> T4 全量回归、变异复验、收口提交
~~~

T1 与 T2 是锁声明缝的红绿周期；T3 是纯文档映射，不单独配红绿周期；T4 是唯一全量测试和收口位置。没有 handoff 子卡、没有并行 executor、没有新接缝。

### 2.2 允许修改的有界文件集

| task | 可修改文件 | 只读依赖 | 声明缝 |
|---|---|---|---|
| T1 | scripts/test_charter_provision.py | scripts/charter_provision.py、scripts/regen_discipline.py、flows/*.json | check()、install()，经 mock subprocess.run 观察真实调用链 |
| T2 | scripts/charter_provision.py | T1 harness、regen_discipline.regen、冻结的对侧 CLI 语义 | check()、install()；共享解析符号 load_discipline_body 必须被两者调用 |
| T3 | scripts/regen_discipline.py 文件头、契约 C-7/C-9/R-4/R-5、docs/roadmap.md 第 18e/62 条 | C11 spec 原文 | 无代码接缝；是冻结物回写和状态条目修正 |
| T4 | T1/T2/T3 已列文件 | 全部本卡产物 | check()/install() 集成命令；真机 handoff 只由协调者执行 |

### 2.3 精确接口（Consumes / Produces）

实现者必须保持这些名字和参数语义；私有辅助函数按后文代码块落地，不另造第二个 get 解析器。

~~~python
# scripts/regen_discipline.py（既有接口，签名不改）
def compose_map() -> dict[str, list[str]]
def regen(out: str = OUT) -> dict[str, int]

# scripts/charter_provision.py
def load_repo_def(path: str) -> dict
def load_ledger_def(kind: str, name: str) -> dict
def load_discipline_body(name: str) -> str
def nodes_equivalent(repo_def: dict, ledger_def: dict) -> tuple[bool, list[str]]
def install() -> int
def check() -> int
~~~

| 符号 | Consumes | Produces |
|---|---|---|
| regen_discipline.regen(out) | skills/*/SKILL.md、输出目录 | <out>/charter-{name}.md 七份正文和 {name: byte_count}；不改变 compose 映射 |
| load_ledger_def(kind, name) | handoff {kind} show {name} 的 JSON .Def 输出 | workflow/template Def dict；NotInstalled 或 LedgerUnavailable |
| load_discipline_body(name) | handoff discipline get name 的文本头+正文 stdout、stderr、returncode | 版本头之后的正文 str；NotInstalled 或 LedgerUnavailable |
| install() | 两份 JSON 真源、regen 临时文件、账本 get/put | 账本新版本或 skip；返回 0/2/put 失败码；不回写 skills/ |
| check() | 两份 JSON 真源、regen 临时文件、账本 show/get | stdout findings；返回 0=一致、1=漂移/缺块、2=账本不可用；绝不发 put/list |

### 2.4 最薄路径

check() 和 install() 今天已经存在并可从 CLI 入口调用；缺的是它们对纪律账本的真实 get/put 链路。T1 直接在这两个声明缝上改 harness 并写反向行为断言，当前基线会红，因此不需要另插点亮 task。load_discipline_body 是两条生产调用方共用的解析落点，不用无调用方纯函数占缝。

## 3. T1：锁定真实 check/install 接缝并先跑红

### 3.1 测试范围声明

本 task 只运行：

~~~text
python3 -m unittest scripts.test_charter_provision.TestCheckIsReadOnly scripts.test_charter_provision.TestCheckFindings scripts.test_charter_provision.TestInstall -v
~~~

该命令只触及 scripts/test_charter_provision.py 的 charter_provision 测试，不跑全仓。

### 3.2 harness 完整替换代码块

在 scripts/test_charter_provision.py 保留现有 imports、node、_ledger_stdout 和 regen 测试；用下列完整 helper 替换 _run_check_with_ledger，并新增 _discipline_bodies、_discipline_stdout。helper 必须按 cmd[1] 明确区分 workflow/template/discipline，禁止再把 discipline 当成 template JSON：

~~~python
def _discipline_stdout(name, body, version=7):
    """造 handoff discipline get 的文本形状；版本头前可有日志，正文原样保留。"""
    return ("2026/08/28 20:00:00 INFO 账本库已打开\n"
            f"{name} v{version}\n" + body)


def _discipline_bodies():
    """在临时目录生成当前仓七份正文，供 mock get 回放真实 regen 结果。"""
    with tempfile.TemporaryDirectory() as tmp:
        rd.regen(tmp)
        return {
            f"charter-{name}": open(
                os.path.join(tmp, f"charter-{name}.md"), encoding="utf-8"
            ).read()
            for name in rd.compose_map()
        }


def _run_check_with_ledger(workflow_def=None, template_def=None, calls=None,
                           discipline_bodies=None, missing_discipline=None,
                           unavailable_discipline=None):
    """跑真实 check 路径；workflow/template 用 JSON，discipline 用文本头+正文。"""
    if workflow_def is None:
        workflow_def = cp.load_repo_def(cp.WORKFLOW_FILE)
    if template_def is None:
        template_def = cp.load_repo_def(cp.TEMPLATE_FILE)
    if discipline_bodies is None:
        discipline_bodies = _discipline_bodies()
    missing_discipline = set(missing_discipline or ())
    unavailable_discipline = set(unavailable_discipline or ())

    def fake_run(cmd, *a, **kw):
        if calls is not None:
            calls.append(cmd)
        if cmd[1] == "workflow":
            return mock.Mock(returncode=0, stdout=_ledger_stdout(workflow_def),
                             stderr="")
        if cmd[1] == "template":
            return mock.Mock(returncode=0, stdout=_ledger_stdout(template_def),
                             stderr="")
        if cmd[1] == "discipline" and cmd[2] == "get":
            name = cmd[3]
            if name in unavailable_discipline:
                return mock.Mock(returncode=1, stdout="",
                                 stderr="dial tcp 127.0.0.1:7777: connection refused")
            if name in missing_discipline or name not in discipline_bodies:
                return mock.Mock(returncode=1, stdout="",
                                 stderr=f"Error: 纪律块 {name} v0: ledger: 记录不存在")
            return mock.Mock(
                returncode=0,
                stdout=_discipline_stdout(name, discipline_bodies[name]),
                stderr="",
            )
        return mock.Mock(returncode=0, stdout="", stderr="")

    out, err = io.StringIO(), io.StringIO()
    with mock.patch.object(cp.subprocess, "run", side_effect=fake_run), \
         contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
        rc = cp.check()
    return rc, out.getvalue() + err.getvalue()
~~~

_discipline_bodies() 使用既有 rd.regen(tmp)，不把 regen mock 成空映射；它只生成临时 fixture，不写 rd.OUT。文件读取使用 encoding=utf-8，因为比较的是正文文本而不是当前平台默认编码。

### 3.3 check 接缝测试完整代码块

在 TestCheckIsReadOnly 中把现有 test_check_never_writes_ledger 替换为：

~~~python
def test_check_never_writes_ledger(self):
    """check 必须完整走完 workflow/template/discipline get，且全程只读。"""
    calls = []
    rc, _ = _run_check_with_ledger(calls=calls)
    expected = ["workflow", "template"] + ["discipline"] * len(rd.compose_map())
    self.assertEqual([c[1] for c in calls], expected,
                     "check 必须读完两份定义和七份纪律块")
    self.assertEqual(rc, 0, "账本正文与 regen 正文一致时应报 0")
    for cmd in calls:
        self.assertNotIn("put", cmd, f"check 发出了写命令: {cmd}")
        self.assertNotIn("list", cmd, f"check 不得用 list 判断纪律块: {cmd}")
~~~

在 TestCheckFindings 中保留 workflow/template 三值测试，并新增或替换为以下完整方法。旧的 patch(rd.OUT) 版本必须删除；测试入口改为 check()，假 ledger 的正文通过 get stdout 进入真实解析和比对路径：

~~~python
def test_discipline_block_mismatch_is_reported(self):
    bodies = _discipline_bodies()
    bodies["charter-plan"] = "这不是本仓正文\n"
    rc, out = _run_check_with_ledger(discipline_bodies=bodies)
    self.assertEqual(rc, 1)
    self.assertIn("charter-plan", out)
    self.assertIn("与本仓正文不一致", out)


def test_discipline_block_missing_is_drift_not_unavailable(self):
    rc, out = _run_check_with_ledger(missing_discipline={"charter-plan"})
    self.assertEqual(rc, 1)
    self.assertIn("charter-plan", out)
    self.assertIn("账本中不存在", out)


def test_discipline_get_unavailable_returns_2(self):
    rc, out = _run_check_with_ledger(
        unavailable_discipline={"charter-plan"}
    )
    self.assertEqual(rc, 2)
    self.assertIn("账本不可用", out)
    self.assertNotIn("discipline put", out)


def test_dispatch_override_uses_ledger_not_local_directory(self):
    """账本缺块即报错；本机 OUT 中有同名文件也不能让它通过。"""
    with tempfile.TemporaryDirectory() as fake_out:
        with open(os.path.join(fake_out, "charter-plan.md"), "w",
                  encoding="utf-8") as f:
            f.write("本地旧文件不是账本记录\n")
        with mock.patch.object(rd, "OUT", fake_out):
            rc, out = _run_check_with_ledger(
                missing_discipline={"charter-plan"}
            )
    self.assertEqual(rc, 1)
    self.assertIn("节点 plan", out)
    self.assertIn("charter-plan", out)
    self.assertIn("账本中不存在", out)
    self.assertNotIn(fake_out, out)
~~~

test_discipline_get_unavailable_returns_2 是错误传播锁；它不把“未安装”错误当成不可用。test_dispatch_override_uses_ledger_not_local_directory 的入口仍是 check()，不是直接测私有集合；它锁住 F-8 的真实消费面和 B229 目录退役。

### 3.4 install 接缝测试完整代码块

在 TestInstall 内加入以下 fixture helper；它只读临时 regen 产物，绝不读或写本机 rd.OUT：

~~~python
def _install_discipline_get(self, bodies, calls, missing=(), unavailable=(), drift=()):
    missing = set(missing)
    unavailable = set(unavailable)
    drift = set(drift)

    def fake_run(cmd, *a, **kw):
        calls.append(cmd)
        if cmd[1] == "discipline" and cmd[2] == "get":
            name = cmd[3]
            if name in unavailable:
                return mock.Mock(returncode=1, stdout="",
                                 stderr="连接 handoff 失败")
            if name in missing:
                return mock.Mock(returncode=1, stdout="",
                                 stderr=f"纪律块 {name}: ledger: 记录不存在")
            body = "旧正文\n" if name in drift else bodies[name]
            return mock.Mock(
                returncode=0,
                stdout=_discipline_stdout(name, body, version=11),
                stderr="",
            )
        return mock.Mock(returncode=0, stdout="", stderr="")

    return fake_run
~~~

在 TestInstall 中用以下完整方法替换只断言 workflow/template 的幂等和顺序用例，并新增旧块/缺块/不可用用例：

~~~python
def test_template_put_strictly_before_workflow_and_discipline_put(self):
    calls = []

    def fake_run(cmd, *a, **kw):
        calls.append(cmd)
        if cmd[1] == "discipline" and cmd[2] == "get":
            return mock.Mock(returncode=1, stdout="",
                             stderr="纪律块不存在: ledger: 记录不存在")
        return mock.Mock(returncode=0, stdout="", stderr="")

    with mock.patch.object(cp, "load_ledger_def",
                           side_effect=cp.NotInstalled("首装")), \
         mock.patch.object(cp.subprocess, "run", side_effect=fake_run), \
         contextlib.redirect_stdout(io.StringIO()):
        rc = cp.install()
    self.assertEqual(rc, 0)
    puts = [c for c in calls if "put" in c]
    self.assertEqual(
        [c[1] for c in puts],
        ["template", "workflow"] + ["discipline"] * len(rd.compose_map()),
    )
    discipline_puts = [c for c in puts if c[1] == "discipline"]
    self.assertTrue(discipline_puts)
    for cmd in discipline_puts:
        self.assertEqual(len(cmd), 5)
        self.assertNotIn("--file", cmd)
        self.assertTrue(cmd[4].endswith(f"/{cmd[3]}.md"), cmd)


def test_idempotent_skips_put_when_identical_discipline_is_in_ledger(self):
    bodies = _discipline_bodies()
    calls = []

    def fake_run(cmd, *a, **kw):
        calls.append(cmd)
        if cmd[1] == "discipline" and cmd[2] == "get":
            return mock.Mock(
                returncode=0,
                stdout=_discipline_stdout(cmd[3], bodies[cmd[3]], version=11),
                stderr="",
            )
        return mock.Mock(returncode=0, stdout="", stderr="")

    with mock.patch.object(cp, "load_ledger_def",
                           side_effect=self._fake_ledger(same=True)), \
         mock.patch.object(cp.subprocess, "run", side_effect=fake_run), \
         contextlib.redirect_stdout(io.StringIO()):
        rc = cp.install()
    self.assertEqual(rc, 0)
    self.assertEqual([c for c in calls if "put" in c], [])
    self.assertEqual(
        [c[3] for c in calls if c[1] == "discipline" and c[2] == "get"],
        sorted(bodies),
    )


def test_old_discipline_body_is_put_with_positional_path(self):
    bodies = _discipline_bodies()
    calls = []
    fake_run = self._install_discipline_get(
        bodies, calls, drift={"charter-plan"}
    )
    with mock.patch.object(cp, "load_ledger_def",
                           side_effect=self._fake_ledger(same=True)), \
         mock.patch.object(cp.subprocess, "run", side_effect=fake_run), \
         contextlib.redirect_stdout(io.StringIO()):
        rc = cp.install()
    self.assertEqual(rc, 0)
    puts = [c for c in calls if c[1] == "discipline" and c[2] == "put"]
    self.assertEqual(len(puts), 1)
    self.assertEqual(puts[0][0:4],
                     ["handoff", "discipline", "put", "charter-plan"])
    self.assertNotIn("--file", puts[0])
    self.assertTrue(puts[0][4].endswith("/charter-plan.md"))


def test_missing_discipline_body_is_put(self):
    bodies = _discipline_bodies()
    calls = []
    fake_run = self._install_discipline_get(
        bodies, calls, missing={"charter-plan"}
    )
    with mock.patch.object(cp, "load_ledger_def",
                           side_effect=self._fake_ledger(same=True)), \
         mock.patch.object(cp.subprocess, "run", side_effect=fake_run), \
         contextlib.redirect_stdout(io.StringIO()):
        rc = cp.install()
    self.assertEqual(rc, 0)
    puts = [c for c in calls if c[1] == "discipline" and c[2] == "put"]
    self.assertEqual(len(puts), 1)
    self.assertEqual(puts[0][3], "charter-plan")


def test_discipline_ledger_unavailable_returns_2_without_put(self):
    bodies = _discipline_bodies()
    calls = []
    fake_run = self._install_discipline_get(
        bodies, calls, unavailable={"charter-plan"}
    )
    buf = io.StringIO()
    with mock.patch.object(cp, "load_ledger_def",
                           side_effect=self._fake_ledger(same=True)), \
         mock.patch.object(cp.subprocess, "run", side_effect=fake_run), \
         contextlib.redirect_stdout(io.StringIO()), \
         contextlib.redirect_stderr(buf):
        rc = cp.install()
    self.assertEqual(rc, 2)
    self.assertIn("账本不可用", buf.getvalue())
    self.assertEqual(
        [c for c in calls if c[1] == "discipline" and c[2] == "put"], []
    )
~~~

已有 test_half_install_message_says_retry_is_safe、test_regen_failure_is_hard_failure_and_named、test_ledger_unavailable_is_not_a_naked_stacktrace、test_prints_repo_path 继续运行，但 fake subprocess 需返回 stdout=""、stderr=""，且不得再把 regen mock 成空映射来证明纪律第三段。test_regen_* 两支仍是内部可测性锁，保留对 rd.OUT 的只读/mtime 检查；只有旧的纪律块 mismatch 测试不得再 patch rd.OUT。

### 3.5 T1 红灯步骤

1. 写入 3.2～3.4 的测试/harness，先不改生产脚本。
2. 运行 3.1 的 focused 命令；预期看到纪律正文 mismatch、missing、install discipline 解析失败或只读调用序列相关失败。若某支意外先绿，记录原始输出并检查它是否真的通过 check()/install() 调到了目标命令；不得把未触及声明缝的内部直测作为替代。
3. 确认测试入口：check 测试调用 cp.check()，install 测试调用 cp.install()；测试不得直接调用 _strip_zeros、新 parser 或手写 OUT 判据。
4. 把红灯命令与原始输出追加台账，再进入 T2。

## 4. T2：最小实现 get/put 与 check/install

### 4.1 测试范围声明

实现过程中只运行：

~~~text
python3 -m unittest scripts.test_charter_provision.TestCheckIsReadOnly scripts.test_charter_provision.TestCheckFindings scripts.test_charter_provision.TestInstall -v
~~~

T2 绿后才进入 T3；全量 discover 属于 T4。

### 4.2 导入、日志与共享外部调用器

在 scripts/charter_provision.py import 区加入 import logging、import re，并在常量区加入：

~~~python
LOGGER = logging.getLogger("charter_provision")
~~~

新增 _run_handoff，所有新旧 handoff subprocess 调用都经此函数；它负责入口参数、调用返回码和异常上下文日志。现有 print 是稳定的 CLI 用户界面，继续输出阶段结果；不得用新的 print 代替日志。

~~~python
def _run_handoff(cmd):
    """运行一个 handoff CLI 命令并记录边界信息。

    参数：cmd —— 完整 argv，首项必须是 handoff。
    返回：subprocess.CompletedProcess；非零返回码交给调用方按命令语义分诊。
    抛出：LedgerUnavailable —— handoff 不在 PATH 或进程无法启动。
    注意：不使用 check=True；show/get 的非零码需要由调用方区分缺记录和不可用。
    """
    LOGGER.info("handoff 调用开始", extra={"argv": cmd})
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True)
    except FileNotFoundError as exc:
        LOGGER.error("handoff 命令不存在", extra={"argv": cmd, "error": str(exc)})
        raise LedgerUnavailable(
            f"找不到 handoff 命令，请确认它在 PATH 中：{exc}"
        ) from exc
    LOGGER.info(
        "handoff 调用结束",
        extra={
            "argv": cmd,
            "returncode": proc.returncode,
            "stdout_bytes": len((proc.stdout or "").encode("utf-8")),
            "stderr_bytes": len((proc.stderr or "").encode("utf-8")),
        },
    )
    return proc
~~~

### 4.3 load_ledger_def 与 discipline parser 完整代码

用下列完整函数替换现有 load_ledger_def；保留 C-1/C-3 的 JSON .Def 投影和原有异常语义，只把外部调用接到 _run_handoff 并补日志：

~~~python
def load_ledger_def(kind, name):
    """读 workflow/template 账本定义并取 .Def 子树。

    参数：kind 为 workflow 或 template；name 为账本定义名。
    返回：Def dict，不包含 Name/Version/CreatedAt 外层噪声。
    抛出：NotInstalled 表示 stderr 含“记录不存在”；其余读失败为 LedgerUnavailable。
    """
    cmd = ["handoff", kind, "show", name]
    proc = _run_handoff(cmd)
    stderr = proc.stderr or ""
    if proc.returncode != 0:
        if "记录不存在" in stderr:
            LOGGER.warning("账本定义不存在", extra={"kind": kind, "name": name})
            raise NotInstalled(f"{kind} {name} 不在账本中")
        LOGGER.error(
            "账本定义读取失败",
            extra={"kind": kind, "name": name, "returncode": proc.returncode,
                   "stderr": stderr.strip()},
        )
        raise LedgerUnavailable(
            f"读 {kind} {name} 失败（退出码 {proc.returncode}）：{stderr.strip()}"
        )
    for line in reversed((proc.stdout or "").strip().splitlines()):
        try:
            value = json.loads(line)
            return value["Def"]
        except (json.JSONDecodeError, KeyError):
            continue
    LOGGER.error("账本定义没有可解析 JSON", extra={"kind": kind, "name": name})
    raise LedgerUnavailable(f"{kind} show {name} 没有可解析的 JSON 输出")


def load_discipline_body(name):
    """读取账本纪律块正文，去掉版本头后保留全部正文文本。

    参数：name 为请求的裸账本记录名，例如 charter-plan。
    返回：命中 name v数字 行之后的全部 stdout 文本，包含正文尾换行。
    抛出：NotInstalled 表示 stderr 含“记录不存在”；其余失败为 LedgerUnavailable。
    注意：版本头前允许日志行；不解析 JSON、不 strip 正文、不读取 regen_discipline.OUT。
    """
    cmd = ["handoff", "discipline", "get", name]
    proc = _run_handoff(cmd)
    stderr = proc.stderr or ""
    if proc.returncode != 0:
        if "记录不存在" in stderr:
            LOGGER.warning("纪律块账本记录不存在", extra={"name": name})
            raise NotInstalled(f"纪律块 {name} 不在账本中")
        LOGGER.error(
            "纪律块账本读取失败",
            extra={"name": name, "returncode": proc.returncode,
                   "stderr": stderr.strip()},
        )
        raise LedgerUnavailable(
            f"读纪律块 {name} 失败（退出码 {proc.returncode}）：{stderr.strip()}"
        )

    stdout = proc.stdout or ""
    header = re.compile(rf"(?m)^{re.escape(name)} v[0-9]+\r?\n")
    match = header.search(stdout)
    if match is None:
        LOGGER.error("纪律块 stdout 缺少可解析版本头", extra={"name": name})
        raise LedgerUnavailable(f"discipline get {name} 没有可解析的版本头")
    body = stdout[match.end():]
    LOGGER.info(
        "纪律块读取成功",
        extra={"name": name, "body_bytes": len(body.encode("utf-8"))},
    )
    return body


def _put_discipline(name, path):
    """把临时生成的纪律正文写入账本。

    参数：name 为裸账本记录名；path 为 regen 生成的完整文件路径。
    返回：handoff discipline put 的退出码。
    注意：path 是位置参数，不得改成 --file；调用方负责处理非零码。
    """
    cmd = ["handoff", "discipline", "put", name, path]
    proc = _run_handoff(cmd)
    if proc.returncode != 0:
        LOGGER.error(
            "纪律块写入失败",
            extra={"name": name, "path": path, "returncode": proc.returncode,
                   "stderr": (proc.stderr or "").strip()},
        )
    else:
        LOGGER.info("纪律块写入成功", extra={"name": name, "path": path})
    return proc.returncode
~~~

load_discipline_body 的正则只识别请求名对应的版本行；版本头前的任何日志被跳过，命中后的正文不再裁剪。NotInstalled 和正文 str 是两个不同状态，不能以空字符串代表缺块；正文比较也不能 strip、hash 或只比长度。

### 4.4 install 完整替换代码

用下列完整 install() 替换现有函数。前两步仍按 INSTALL_ORDER 写 workflow/template；第三步在同一个临时目录生成七份正文，对每个 charter-{compose_map key} 先 get 再决定 skip/put。每个外部调用前后已由 _run_handoff 记录；每个错误分支都点名阶段、块名和返回码。

~~~python
def install():
    """按 C-7 的 template→workflow→discipline 顺序安装并保持幂等。

    返回：0=全部成功；2=账本不可用；其它非零值为具体 put 失败码或生成失败。
    注意：纪律块正文先 get 比对，只有缺块或正文不同才新增账本版本。
    """
    LOGGER.info("charter 安装开始", extra={"repo": REPO})
    print(f"仓：{REPO}")
    for kind, name, path in INSTALL_ORDER:
        repo_def = load_repo_def(path)
        try:
            ledger_def = load_ledger_def(kind, name)
        except NotInstalled:
            print(f"{kind} {name}: 账本中不存在，安装")
            needs_put = True
        except LedgerUnavailable as exc:
            LOGGER.error("定义安装前账本不可用",
                         extra={"kind": kind, "name": name, "error": str(exc)})
            print(f"账本不可用：{exc}。未继续写入；已完成步骤保留，重跑本命令是安全的。", file=sys.stderr)
            return 2
        else:
            if kind == "workflow":
                same, diffs = nodes_equivalent(repo_def, ledger_def)
            else:
                diffs = _defs_diff(
                    _strip_zeros(repo_def), _strip_zeros(ledger_def),
                    f"{kind} {name}"
                )
                same = not diffs
            needs_put = not same
            if same:
                print(f"{kind} {name}: 已是最新，跳过")
                continue
            print(f"{kind} {name}: 与账本不一致，安装（{len(diffs)} 处差异）")

        try:
            proc = _run_handoff(["handoff", kind, "put", name, "--file", path])
        except LedgerUnavailable as exc:
            LOGGER.error("定义写入时账本不可用",
                         extra={"kind": kind, "name": name, "error": str(exc)})
            print(f"账本不可用：{exc}。未继续写入；已完成步骤保留，重跑本命令是安全的。", file=sys.stderr)
            return 2
        if proc.returncode != 0:
            print(
                f"{kind} {name}: 安装失败（退出码 {proc.returncode}）。"
                "已完成的步骤保留在账本里；重跑本命令是安全的——"
                "put 只新增版本、不改旧版，不会写坏已有定义。",
                file=sys.stderr,
            )
            return proc.returncode
        LOGGER.info("定义写入成功",
                    extra={"kind": kind, "name": name, "path": path,
                           "needs_put": needs_put})

    try:
        with tempfile.TemporaryDirectory() as tmp:
            sizes = regen_discipline.regen(tmp)
            LOGGER.info("纪律块生成完成",
                        extra={"count": len(sizes), "directory": tmp})
            for name in sorted(sizes):
                block = f"charter-{name}"
                path = os.path.join(tmp, f"{block}.md")
                try:
                    with open(path, encoding="utf-8") as f:
                        generated = f.read()
                except OSError as exc:
                    LOGGER.error("纪律块生成产物读取失败",
                                 extra={"name": block, "path": path,
                                        "error": str(exc)})
                    print(f"纪律块 {block} 生成产物读取失败：{exc}", file=sys.stderr)
                    return 1
                try:
                    installed = load_discipline_body(block)
                except NotInstalled:
                    print(f"纪律块 {block}: 账本中不存在，安装")
                except LedgerUnavailable as exc:
                    LOGGER.error("纪律块安装前账本不可用",
                                 extra={"name": block, "error": str(exc)})
                    print(f"账本不可用：{exc}。未继续写入；已完成步骤保留，重跑本命令是安全的。", file=sys.stderr)
                    return 2
                else:
                    if installed == generated:
                        print(f"纪律块 {block}: 已是最新，跳过")
                        continue
                    print(f"纪律块 {block}: 与本仓正文不一致，安装")
                try:
                    rc = _put_discipline(block, path)
                except LedgerUnavailable as exc:
                    LOGGER.error("纪律块写入时账本不可用",
                                 extra={"name": block, "error": str(exc)})
                    print(f"账本不可用：{exc}。未继续写入；已完成步骤保留，重跑本命令是安全的。", file=sys.stderr)
                    return 2
                if rc != 0:
                    print(
                        f"纪律块 {block}: 安装失败（退出码 {rc}）。"
                        "已完成的步骤保留在账本里；重跑本命令是安全的。",
                        file=sys.stderr,
                    )
                    return rc
                print(f"纪律块 {block}: 已入账")
    except Exception as exc:
        LOGGER.error("纪律块生成失败", extra={"repo": REPO, "error": str(exc)})
        print(f"纪律块生成失败：{exc}。前两步已完成，重跑本命令是安全的。",
              file=sys.stderr)
        return 1

    print(f"纪律块：{len(sizes)} 个已处理")
    print("提示：在途卡仍钉着旧版本号，需要时用 handoff workflow migrate 迁移。")
    LOGGER.info("charter 安装完成",
                extra={"repo": REPO, "discipline_count": len(sizes)})
    return 0
~~~

实现者需删除旧的 regen_discipline.regen() 无参调用；regen(tmp) 的 tmp 生命周期必须覆盖全部 get/put 调用，使 put 看到的路径在命令返回前仍存在。needs_put 只用于成功日志，不改变分支；若 lint 发现它仅用于日志，保留该字段以说明定义 put 确实发生在对应路径。

### 4.5 check 完整替换代码

用下列完整 check() 替换现有函数。第三段只遍历临时 regen 结果并调用 load_discipline_body；checked_blocks/available_blocks 让 F-8 复用已取结果，对不在七份生成映射中的自定义 override 才额外发一次 get。任何 discipline list、rd.OUT、本地 .md 存在性都不得出现。

~~~python
def check():
    """比对仓内真源与账本，返回 0=一致、1=漂移、2=未安装或账本不可用。

    本函数只读：只调用 workflow/template show 与 discipline get，绝不调用任何 put/list。
    """
    LOGGER.info("charter check 开始", extra={"repo": REPO})
    print(f"仓：{REPO}")
    findings = []
    try:
        repo_wf = load_repo_def(WORKFLOW_FILE)
        ledger_wf = load_ledger_def("workflow", WORKFLOW_NAME)
        ok, diffs = nodes_equivalent(repo_wf, ledger_wf)
        print(f"workflow {WORKFLOW_NAME}: {'一致' if ok else '漂移'}")
        findings += diffs

        repo_tpl = load_repo_def(TEMPLATE_FILE)
        ledger_tpl = load_ledger_def("template", TEMPLATE_NAME)
        tpl_diffs = _defs_diff(
            _strip_zeros(repo_tpl), _strip_zeros(ledger_tpl),
            f"template {TEMPLATE_NAME}",
        )
        print(f"template {TEMPLATE_NAME}: {'一致' if not tpl_diffs else '漂移'}")
        findings += tpl_diffs
    except NotInstalled as exc:
        LOGGER.warning("check 发现定义未安装", extra={"error": str(exc)})
        print(f"未安装：{exc}。跑 python3 scripts/charter_provision.py install。",
              file=sys.stderr)
        return 2
    except LedgerUnavailable as exc:
        LOGGER.error("check 发现账本不可用", extra={"error": str(exc)})
        print(f"账本不可用：{exc}", file=sys.stderr)
        return 2

    block_findings = []
    checked_blocks = set()
    available_blocks = set()
    with tempfile.TemporaryDirectory() as tmp:
        try:
            generated = regen_discipline.regen(tmp)
        except Exception as exc:
            LOGGER.error("check 纪律块生成失败",
                         extra={"directory": tmp, "error": str(exc)})
            print(f"纪律块生成失败，本段未比对：{exc}", file=sys.stderr)
            return 2
        LOGGER.info("check 纪律块生成完成",
                    extra={"count": len(generated), "directory": tmp})
        for name in sorted(generated):
            block = f"charter-{name}"
            path = os.path.join(tmp, f"{block}.md")
            try:
                with open(path, encoding="utf-8") as f:
                    fresh = f.read()
            except OSError as exc:
                LOGGER.error("check 纪律块产物读取失败",
                             extra={"name": block, "path": path, "error": str(exc)})
                print(f"纪律块 {block} 生成产物读取失败：{exc}", file=sys.stderr)
                return 2
            checked_blocks.add(block)
            try:
                installed = load_discipline_body(block)
            except NotInstalled:
                LOGGER.warning("check 发现纪律块缺失", extra={"name": block})
                block_findings.append(f"纪律块 {block}: 账本中不存在")
                continue
            except LedgerUnavailable as exc:
                LOGGER.error("check 读取纪律块时账本不可用",
                             extra={"name": block, "error": str(exc)})
                print(f"账本不可用：{exc}", file=sys.stderr)
                return 2
            available_blocks.add(block)
            if installed != fresh:
                LOGGER.warning("check 发现纪律块正文漂移", extra={"name": block})
                block_findings.append(f"纪律块 {block}: 与本仓正文不一致")
        total_blocks = len(generated)
    print(f"纪律块：{total_blocks - len(block_findings)}/{total_blocks} 一致")
    findings += block_findings

    # F-8 只验证节点明确写出的 override；模板缺省 charter-must-override 是哨兵，不查它。
    for n in repo_wf.get("nodes", []):
        if not n.get("dispatch"):
            continue
        block = (n.get("override") or {}).get("discipline")
        if not block:
            findings.append(
                f"节点 {n.get('name')}: dispatch 节点未写 override.discipline，"
                "派发时会落到模板缺省值"
            )
            continue
        if block not in checked_blocks:
            checked_blocks.add(block)
            try:
                load_discipline_body(block)
            except NotInstalled:
                LOGGER.warning("F-8 发现 override 纪律块不在账本",
                               extra={"node": n.get("name"), "name": block})
            except LedgerUnavailable as exc:
                LOGGER.error("F-8 读取 override 纪律块时账本不可用",
                             extra={"node": n.get("name"), "name": block,
                                    "error": str(exc)})
                print(f"账本不可用：{exc}", file=sys.stderr)
                return 2
            else:
                available_blocks.add(block)
        if block not in available_blocks:
            findings.append(
                f"节点 {n.get('name')}: 纪律块 {block} 不在账本中"
            )

    for finding in findings:
        print(f"  - {finding}")
    LOGGER.info("charter check 完成",
                extra={"finding_count": len(findings)})
    return 1 if findings else 0
~~~

这里的“缺块”是 findings/退出 1，不是早退 2；“账本不可用”是立即退出 2，并且在 install 侧不进入对应 put。F-8 对七个标准块复用第三段结果；对未知 override 名仅调用 get，不调用 list，也不读取本地目录。

### 4.6 T2 绿灯与实现注释步骤

1. 按 4.2～4.5 落实现，不修改测试预期来让测试通过。
2. 运行 4.1 focused 命令；预期所有 check/install 接缝测试通过。若失败，记录原始 Python traceback/断言文本到台账，修实现，不放宽断言。
3. 给 scripts/charter_provision.py 文件头补职责边界：权威副本是 handoff 纪律账本，regen_discipline.OUT 仅是调试生成落点；check/install 只经 discipline get/put。不要把“文件系统仍可写”写成安装成功条件。
4. 给新增/修改的导出函数及解析/put 辅助函数保留 4.3～4.5 的 docstring；复杂分支旁写清为什么“记录不存在”进入 1/put，而其它非零进入 2/不写，以及为什么 F-8 不检查哨兵。
5. 在 scripts/regen_discipline.py 文件头把旧的 resolver 现读盘说明改为下面内容；不改变 compose_map、body、retitle、regen 的生成行为：

~~~python
# 注意：B229 起纪律块的权威副本在 handoff 账本；charter_provision 的 install
# 通过 handoff discipline put 入账，check 通过 handoff discipline get 比对。
# 本脚本无参运行仍可把调试正文写到 OUT，但写 OUT 不代表已安装，也不是 check 判据。
~~~

## 5. T3：回写冻结物与 roadmap（纯映射步骤）

### 5.1 测试范围声明

本 task 只做文档 diff 核对，不运行全量测试；T4 负责把文档和脚本一起收口。核对命令为：

~~~text
git diff --check -- scripts/regen_discipline.py docs/contracts/2026-08-24-charter-provisioning-contract.md docs/roadmap.md
~~~

### 5.2 C-7 完整替换段

在 docs/contracts/2026-08-24-charter-provisioning-contract.md 用以下全文替换旧 C-7 段落；保留 C-6 的十条校验表：

~~~markdown
### C-7 安装顺序被 C-6 第 5 条钉死：模板必须先于工作流，纪律块随后入账本

charter.workflow.json 的 12 个节点中有 7 个 dispatch: true，全部引用模板
charter-default。安装顺序固定为：

1. handoff template put charter-default --file flows/charter-default.template.json
2. handoff workflow put charter --file flows/charter.workflow.json
3. 对 compose_map() 的每个 charter-{name} 执行 handoff discipline get charter-{name}：
   get 成功且正文与本次 regen(tmp) 完全相同则 skip；缺记录或正文不同则执行
   handoff discipline put charter-{name} temp_file_path，其中 temp_file_path 是位置参数，
   不是 --file。

顺序颠倒（先 workflow）在空账本上会因 dispatch 节点引用的模板尚不存在而失败。
纪律块使用 get-before-put 保证 provision 客户端幂等；对侧 PutDiscipline 每次 put
都会新增版本，本契约不改变该库语义。
~~~

### 5.3 C-9 完整替换段

用以下全文替换旧的“解析三段式” C-9。C-10 名字限制保留在其原位置，但要明确它约束账本 CLI 使用的裸名：

~~~markdown
### C-9 discipline 的权威副本是 handoff 账本，旧本地目录三段式已退役

TemplateDef.Discipline 仍是纪律块的账本记录名。B229 起 agentd 不再读取或写入
<DataDir>/discipline/<name>.md；该目录不是 charter provision 的安装目标，也不是
check 的比对基准。charter 的七个 charter-* 块必须通过 handoff CLI 进入账本。

读取规则：handoff discipline get <name> 成功时 stdout 是可选日志行、随后一行
<name> v<N>、再随后为正文；版本行不属于正文，版本行之后的全部文本（含尾换行）
才是比对值。stderr 含 记录不存在 的非零 get 表示账本中缺块；其它非零表示账本
不可用。check 对缺块报漂移并返回 1，install 对缺块执行 put；不可用两者均返回 2
且不盲写。

写入规则：handoff discipline put record_name file_path 的文件路径是位置参数。install 只
在 get 缺块或正文逐字不同的时候 put；正文相同不新增版本。put 的库层大小、空白正文
和名字校验保持由 handoff 负责，charter 不截断正文、不复刻对侧校验器。

因此旧表述“先查 <DataDir>/discipline，再回退内置块，最后报错”在 B229 后标记为
已退役；本卡不让 handoff 恢复该读取路径。
~~~

### 5.4 R-4 完整替换段

在契约修订记录中把 R-4 的运行期推导改为 B229 的 ledger lookup；不要再从已退役的文件三段式解释哨兵：

~~~markdown
### R-4（C11 回写）：charter-must-override 的哨兵含义改由账本 lookup 定义

模板 charter-default 的 discipline 值 charter-must-override 是非空哨兵，不在
compose_map() 的七个生成块中，也不应写入 handoff 纪律账本。B229 后 dispatch 的
纪律解析由 ResolveDispatch 对账本记录名做 lookup；lookup 失败时返回“未知纪律块名字”
类错误。该哨兵故意失败，提示新增 dispatch 节点必须写 override.discipline。

charter 的 check 只检查节点显式 override.discipline：通过 discipline get 成功或
复用已成功读取的名字集合确认账本存在；不读取模板缺省值，不读取
<DataDir>/discipline，不调用 discipline list。现役七个 dispatch 节点分别覆盖
charter-contract、charter-breakdown、charter-plan、charter-implement、
charter-review、charter-integrate、charter-recon，所以哨兵不在现役工作流中被解析。
~~~

### 5.5 R-5 完整追加段

在现有 R-5 之后追加以下读取侧依赖说明，保持 workflow/template show 和 discipline get 的分诊口径一致：

~~~markdown
### R-5a（C11 追加）：discipline get 复用“记录不存在”缺块文案

load_discipline_body 对 handoff discipline get <name> 的非零结果仍以 stderr 含
“记录不存在”判定缺块；该子串来自对侧纪律记录不存在错误（对侧 cmd/discipline.go
与 internal/ledger/disciplines.go）。缺块在 check 中是漂移/退出 1，在 install 中是
允许 put 的首装状态；其它非零统一归 LedgerUnavailable，退出 2 且不写。若对侧未来
改变该文案，应先更新冻结依赖与真机断言，不得把所有非零 get 静默变成缺块。
~~~

### 5.6 roadmap 18e 完整替换行

把 docs/roadmap.md:81 的旧 18e 替换为：

~~~markdown
18e. ~~provision check 测试耦合本机安装态~~ **已销账（2026-08-28，C11）**：check 的纪律段已改为经 handoff discipline get 读取账本正文并与临时 regen 结果逐字比较；测试 mock get 文本，不再读取本机 ~/.handoff/discipline。账本真实联调仍由 C11 acceptance 真机清单负责。
~~~

不要改 roadmap 16/16a/16b 的未完成语义：本卡只把 OUT 从消费判据降为调试落点；regen 原子写、DataDir 自动发现和直接 handoff put 绕过仍是后续事项。

## 6. T4：收口、变异复验与真机交棒

### 6.1 本 task 测试范围

这是本卡唯一全量位置，运行：

~~~text
python3 -m py_compile scripts/charter_provision.py scripts/regen_discipline.py scripts/test_charter_provision.py
python3 -m unittest discover -s scripts -p 'test_*.py' -v
git diff --check
~~~

预期：py_compile 和 diff check 退出码 0；unittest 全绿，测试总数必须以实际输出为准，不在计划中预写计数。全量若失败，回到对应 T1/T2 入口修复，不在 T4 增加未列文件。

### 6.2 静态范围与旧判据扫描

实现后运行以下只读核对，并把原始输出追加台账：

~~~text
rg -n "regen_discipline\.OUT|os\.path\.exists\(.*OUT|discipline.*list|\[\"handoff\", \"discipline\", \"put\"" scripts/charter_provision.py scripts/test_charter_provision.py
rg -n "handoff.*discipline.*put|--file" scripts/charter_provision.py scripts/test_charter_provision.py
git diff --name-only
~~~

判读：charter_provision.py 不得命中 regen_discipline.OUT、本地纪律文件存在性或 discipline list；新 discipline put 命令只能是位置参数形式。workflow/template 的既有 --file 合法，不得用宽泛 grep 把它误判成 discipline argv。文件名输出只能属于本卡允许文件集。

### 6.3 编译通过且命中唯一的变异复验

实现者按 skills/implement/SKILL.md 的变异纪律做三次临时变异；每次先确认唯一锚点和编译，再跑行为断言，再恢复源码。变异不进入提交：

1. 在 check() 纪律正文比较的唯一 if installed != fresh: 处临时改为 if installed == fresh:；先运行 python3 -m py_compile scripts/charter_provision.py，再运行 python3 -m unittest scripts.test_charter_provision.TestCheckFindings.test_discipline_block_mismatch_is_reported -v，该负向假绿锁必须失败，失败必须点名 charter-plan 或相应正文断言。恢复后 focused 测试应回绿。
2. 在 _put_discipline 唯一 argv 处临时加入 "--file"，先 py_compile，再运行 python3 -m unittest scripts.test_charter_provision.TestInstall.test_old_discipline_body_is_put_with_positional_path -v；该测试必须失败，证明位置参数是调用方依赖而不是内部注释。恢复后 focused 测试应回绿。
3. 在 F-8 唯一账本存在性判断处临时改回 os.path.exists(os.path.join(regen_discipline.OUT, ...))；先 py_compile，再运行 python3 -m unittest scripts.test_charter_provision.TestCheckFindings.test_dispatch_override_uses_ledger_not_local_directory -v；该测试必须失败。恢复后 focused 测试应回绿。

每次变异若编译失败，不计为测试锁，改为可编译的比较符/默认值变异后重做；若行为不变，先检查唯一锚点是否打中，不得写成“测试无效”。变异命中数和原始失败输出写入台账。

### 6.4 协调者真机清单（本 task 由协调者执行，不派发；本节点不运行 handoff CLI）

下列项目需要 disposable handoff 账本和真实 handoff/agentd 环境；它们不是本地 unittest 的替代，也不允许用本机 OUT 代替。每项都要记录命令、退出码、stdout/stderr 原文和账本版本变化：

1. 在临时账本上生成当前七份正文，第一次 install：template put 必须先于 workflow put；七个纪律块分别执行 get 后 put，真实 get 正文穿过版本头切除后与 regen 正文逐字相等。
2. 在 disposable checkout 中只改 skills/plan/SKILL.md 一行，不 install，运行 python3 scripts/charter_provision.py check：退出 1，finding 点名 charter-plan，不得报 7/7 一致；探针结束恢复该行，不把 acceptance 改动带入本卡提交。
3. 随后运行 install：只对 charter-plan put 一个新版本，其余六块 skip；再 check 退出 0。立刻再次 install：七块全部 skip，七块版本号不变。
4. 在账本删除或不创建一个 override 名，同时在旧的本机 ~/.handoff/discipline/{name}.md 放同名文件：check 仍以 get 缺块报节点 finding，不能因本地文件存在而绿。
5. 观察 check 的全部外部调用：必须有 workflow/template show 和七个以上 discipline get，不能有 discipline list、discipline put、workflow put 或 template put。
6. 让 handoff 账本不可用：install/check 都返回 2；install 不发对应 discipline put，不产生新账本版本。
7. 对一份超过 64 KiB、空白正文或非法名的临时 put 观察原始失败；charter 不截断、不重命名、不把失败报告成成功。该项只验证对侧库门，若 fixture 无法安全制造，记录“未验证”及原始阻塞，不改实现来绕过。

## 7. 五项自审

### 7.1 缺陷族对抗审查

按 skills/defect-families/SKILL.md:10-24 逐族回答，结论已经落入 T1/T2/T4 验收：

| 缺陷族 | 对抗结论与锁 |
|---|---|
| 生命周期 / 状态机中断 | install 在定义 put 或七块 put 之间被杀时会留下不可回滚的追加版本/半装账本；版本追加无 delete，重跑会逐项 get/skip/put 收敛，前序步骤保留且报“重跑安全”。纪律生成在 TemporaryDirectory 中，进程退出由上下文回收；regen_discipline.py 逐文件写的原子性欠账不在本卡假装修复，roadmap 16 保留。真机中途重启属于协调者清单，未验证。 |
| 静默失败 / 误导报错 | get 缺块与账本不可用按 stderr 子串分成 1/put 与 2/no-write；版本头缺失也归不可用；put 非零硬失败并点名块/退出码；check 的缺块、正文漂移和节点 override 都点名。旧 OUT 不参与判据，避免“7/7 一致但账本旧”。 |
| 跨平台假设 | 生成和临时文件使用 os.path.join/TemporaryDirectory；get 使用 text=True 并兼容 CRLF 版本头，正文不做平台依赖的 strip。handoff 仍依赖 PATH，~/.handoff 仅保留 regen 调试默认值，非消费目标；Windows 的权限/expanduser 语义仍是本期不承诺项，真机清单不宣称已验证。 |
| 假红 / 假绿测试 | 负向 mismatch 从 check() 的 mocked get 正文进入真实 parser/compare，旧 patch(rd.OUT) 测试退役；install 幂等测试使用真实 rd.regen(tmp)，不以空映射跳过第三段；只读测试先断言七次 discipline get 再断言无 put/list；T4 三个可编译、唯一锚点变异必须分别转红。mock 的 handoff 文本形状对应真机第 1 项，未用 mock 结果冒充真机通过。 |
| 门禁绕过 | 唯一新写路径是 handoff discipline put，位置参数交给对侧 CLI 的名字/大小/正文门；charter 不 import handoff 内部、不复刻库校验。check 全程无 put/list；get→put 存在并发 TOCTOU，最坏是额外追加版本而非覆盖旧版，接受该边界并由 get-before-put 测试/真机版本核对锁住。直接手工 handoff workflow/template put 的绕过仍是 roadmap 16b，不扩大本卡。 |
| 序列化边界 | 新链路逐处列入 7.2：skill 文本→regen 文件、put argv、账本存储→get 文本、版本头切除、正文逐字比较、F-8 名字存在性。每处由 check/install 接缝断言或 disposable 真机 roundtrip 覆盖，不把 JSON show 的 .Def parser 复用于文本 get。 |
| 枚举新值过既有白名单 | 本卡不引入状态/kind/event 枚举；七个块名动态来自既有 compose_map()，charter-must-override 保持哨兵且不进入 compose/账本。对侧名字、大小和正文规则继续由 discipline CLI 校验，真机第 7 项检查门没有被 charter 侧吞掉。 |
| 承重安全属性有测试锁住 | 幂等“正文相同不 put”由 install() 接缝锁；check 只读由真实调用序列锁；账本不可用不写由 check/install 两支锁；put 版本不变和中断收敛由协调者 disposable 账本清单验证。每个属性都有反向失败或真机项目，不以计数代替行为。 |

### 7.2 序列化边界清单

本卡没有新的 JSON 数据字段，故“字段缺失 vs 零值”不适用；缺记录用 NotInstalled 异常区分，正文即使是空字符串也不等于缺记录。新增文本链路的每一处手写投影如下：

| 边界 | 手写动作 | 覆盖断言 |
|---|---|---|
| skills/*/SKILL.md → regen | body() 去 frontmatter、retitle()、分隔符合并、写入 charter-{name}.md | 既有 TestRegenParameterized；T4 真机第 1 项 |
| 临时文件 → put CLI | install 组装 ["handoff","discipline","put",name,path] | test_template_put_strictly_before_workflow_and_discipline_put、test_old_discipline_body_is_put_with_positional_path |
| get stdout → 正文 | load_discipline_body 搜索精确版本头，去掉头之前所有日志和版本行，保留之后全部文本 | mismatch/identical check/install 接缝；前缀日志由 _discipline_stdout 回放 |
| get returncode/stderr → 状态 | 记录不存在→NotInstalled；其它非零→LedgerUnavailable | check missing=1、install missing=put、两侧 unavailable=2 |
| 正文 → check finding | installed != fresh 逐字比较，保留尾换行和正文顺序 | test_discipline_block_mismatch_is_reported；T4 比较符变异 |
| workflow override → 账本存在性 | F-8 复用 available_blocks，未知名再 get；不读 OUT/list | test_dispatch_override_uses_ledger_not_local_directory；T4 OUT 变异 |

必须有一条穿过真实序列化边界的回归：协调者第 6.4 节第 1 项在 disposable 账本上执行 regen→put→get→parser→逐字 compare；本地 mock 测试只证明调用方契约，不把 mock 当成 SQLite/CLI roundtrip 已通过。

### 7.3 上下文预算与类型标注

- 每个 task 都有有界文件集；最大实现 task 只触及两个 Python 脚本和一个测试脚本，文档回写单独列文件，无需架构法竖切。
- 本卡接触 handoff 账本、CLI 进程和本机文件系统，是边界型子系统；所有真实账本行为写成协调者真机清单，当前均为未验证，不以本地 unittest 的 mock 结果代替。
- load_discipline_body 返回 str，缺块通过 NotInstalled，不可用通过 LedgerUnavailable；不存在把正文空串当作存在，避免缺失/零值混淆。

### 7.4 接缝覆盖双向核对

spec 的接缝清单只有以下生产入口：

| 接缝 | 入口符号 | 至少一支锁 |
|---|---|---|
| check 入口 | cp.check() | test_check_never_writes_ledger、mismatch、missing、unavailable、F-8 local directory |
| install 入口 | cp.install() | 顺序/argv、identical skip、old/missing put、unavailable no-put |
| get parser 共享落点 | load_discipline_body()，由 check/install 调用 | 上述 check/install 的 stdout 回放穿过它；不写无调用方 parser 直测 |

双向结果：

- 缝→测试：check 至少被只读、正文漂移、缺块、不可用和 F-8 五类接缝断言锁；install 至少被顺序、skip、旧块、缺块、不可用五类接缝断言锁；每条均是声明入口调用。
- 测试→缝：T1 所列每支方法入口都是 cp.check() 或 cp.install()；TestRegenParameterized 仅是已有内部可测性锁，不能替代两条主缝，并明确声明其合法理由是“主缝无法观测 regen 不污染 OUT”。
- 现有 TestNodesEquivalent 直接锁定既有契约 C-11 的 nodes_equivalent 行为，本卡不改其实现或断言；它不替代本卡 discipline 的 check/install 接缝测试。现有 TestRepoSources 也只保留为真源格式锁，不承担本卡新增行为。
- 没有条件退路会改变测试入口；计划不写“若先绿则直测 parser”的退路。若 parser 行为从主缝无法构造，必须由实现者在台账写清原因并保留主缝测试，不能自行换入口。

### 7.5 spec 用户故事归属

| 用户故事 | 计划归属 |
|---|---|
| 改 plan skill、不 install，check 报 charter-plan 漂移且不报 7/7 | T1 check mismatch + T2 check 临时 regen/get |
| install 对旧/缺块 put，其他相同块 skip，再 check 0 | T1 install old/missing/identical + T2 install get-before-put |
| 再次 install 七块全 skip、版本不变 | T1 identical argv 断言 + 协调者真机第 3 项 |
| 账本无 override 名、本地 OUT 有同名仍报 | T1 F-8 local directory + T2 available_blocks |
| check 不调用任何 put/list | T1 只读调用序列 + T2 check 无写路径 |
| 账本不可用返回 2、不写 | T1 check/install unavailable + T2 异常分诊 |
| C-9/C-7/R-4/R-5 回写 | T3 文档完整替换/追加段 |
| regen 无参仍可调试写 OUT，但不再是消费判据 | T2 文件头注释 + T3 roadmap/契约措辞；无参真机行为不在本节点验证 |

## 8. 占位符扫描、收口要求与执行者提交

### 8.1 占位符扫描自检

本计划没有未定占位、伪任务引用或笼统错误处理描述作为步骤。每个新增测试方法、helper、生产函数和文档替换段均给出完整代码/完整 prose block；只保留的既有测试通过文件名和方法名明确指认。测试复用既有 unittest + mock subprocess + tempfile harness，且 3.2～3.4 已把必要形态完整列出，因此不启用骨架测试例外。

### 8.2 最终交付判据

实现者必须在 T4：

1. 完成 T1 红灯、T2 focused 绿灯，并将每次原始输出追加台账；
2. 完成 T3 文件回写，确认 C-9 不再描述本地目录为权威，C-7 第三步是 get-before-put，R-4 从 ledger lookup 推导，R-5 包含 discipline get 的缺块文案；
3. 运行 T4 全量命令和静态扫描；
4. 完成三次可编译唯一锚点变异，恢复所有临时变异后再跑一次全量；
5. 只在当前分支 cards/C11-charter 执行 git add 和 git commit，不 push。提交应包含本卡实现、测试、冻结物回写、roadmap 和台账，不得包含本节点计划以外的文件。

本计划节点自身的法定收尾是计划文档和计划台账已落盘并通过本节点自审；实现级 pass 只能由后续 T4 的真实测试/构建输出和协调者真机清单裁决。
