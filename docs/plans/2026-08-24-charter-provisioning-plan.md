# 实现计划：charter 自举安装 + 变异/判据纪律补缺

- **卡**：C4、C6（合批）
- **上游**：spec（已批准 2026-08-24）/ 契约（已冻结，含 R-1~R-3）/ 拆解稿（已拍板，九条裁决见其「一之二」节）
- **级别**：L3 轻档 —— 单轮 implement，不扇出
- **写作者**：协调者（轻档不下放）
- **日期**：2026-08-24

**读者假设**：对本仓零上下文。凡本计划写「照抄」的地方都给了完整代码块，不要自行发挥。

---

## 基线复核（判据先在基线跑 —— 本轮实跑，非记忆）

| # | 事实 | 命令与读数 | 用在哪 |
|---|---|---|---|
| B-1 | `workflow show <不存在>` → **退出码 1**，错误文本走 **stderr**，stdout 为空 | `handoff workflow show does-not-exist-probe` → `Error: 工作流 does-not-exist-probe v0: ledger: 记录不存在`；`echo $?` = 1；stdout 去 INFO 日志后 0 行 | T7 的「未安装」分支、T6 的首装分支 |
| B-2 | `workflow show <存在>` → 退出码 0 | 同上换 `charter` → 0 | 同上 |
| B-3 | 账本侧节点**带空结构体键**：`{"name":"待办","override":{},"next":"spec","gate":{}}` | `handoff workflow show charter` 取 `.Def.nodes[0]` 实读 | **T5 剥零值的直接理由**（拍板 F-3） |
| B-4 | 仓侧真源顶层键 = `['nodes']`，12 个节点 | `python3 -c "json.load(...)"` 实读 | T5 的结构不对称处理 |
| B-5 | `stdout` 混入 agentd INFO 日志行（`2026/... INFO ...`） | 本轮所有 `handoff` 调用均可见 | `load_ledger_def` 已有的「取最后一行合法 JSON」策略成立 |

---

## 任务 DAG（已按拍板 F-4 (b) 幂等调整）

```
T1 (regen 参数化) ──> T5 (缝：nodes_equivalent) ──> T7 (check) ──> T6 (install) ──┐
                                                                                   ├──> T8 (收尾)
T2 (implement 正文) ── T3 (acceptance 正文) ── T4 (plan 正文) ────────────────────┘
```

硬依赖：T1→T7（check 要把 regen 打到临时目录）、T1→T5（测试 import regen）、T5→T7、**T7→T6**（幂等：install 先比对）、T2/T3/T4→T8、T6→T8、T7→T8。

**最薄路径条自检**：本卡要锁的行为（`nodes_equivalent` 返回可用判定）今天从声明缝调用会抛 `NotImplementedError`——**写下去就会红，且红因是功能缺失不是编译错**（缝符号已由 contract 的 Ticket 0 落地）。故 T5 本身即最薄可跑路径，**不需另插点亮 task**。

---

## Interfaces（跨 task 签名，逐字对齐）

本批只有一个模块，但执行者按 task 顺序推进时看不到后面的 task，故此处集中声明。

| 符号 | 签名 | Produces | Consumes |
|---|---|---|---|
| `regen_discipline.regen` | `regen(out: str = OUT) -> dict[str, int]` | T1 | T7（比对纪律块）、T6（安装第三步） |
| `charter_provision._strip_zeros` | `_strip_zeros(obj)` → 同型对象 | T5 | T5、`_defs_diff` |
| `charter_provision._defs_diff` | `_defs_diff(a: dict, b: dict, where: str) -> list[str]` | T5 | T5、T7（template 段） |
| `charter_provision.nodes_equivalent` | `nodes_equivalent(repo_def: dict, ledger_def: dict) -> tuple[bool, list[str]]` | T5（**本批唯一接缝**，签名由契约冻结，**一个字符都不许改**） | T7、T6 |
| `charter_provision.NotInstalled` | `class NotInstalled(RuntimeError)` | T7 | T6 |
| `charter_provision.load_ledger_def` | `load_ledger_def(kind: str, name: str) -> dict`，未安装时抛 `NotInstalled` | T7（改造既有骨架） | T6、T7 |
| `charter_provision.check` | `check() -> int`（0=一致 / 1=漂移 / 2=未安装或环境不可用） | T7 | T6、CLI |
| `charter_provision.install` | `install() -> int`（0=成功，非 0=失败） | T6 | CLI |

---

## T1 — `regen_discipline.py` 输出目录参数化

**裁决依据**：F-9 = (c)+(a) 组合。**硬约束：`python3 scripts/regen_discipline.py`（无参）的行为逐字不变**——全局 CLAUDE.md 与本仓多处文档在教这条命令。

**测试范围**：`python3 -m unittest scripts.test_charter_provision -k regen`（本 task 只跑 regen 相关用例）。

### 步骤

1. 打开 `scripts/regen_discipline.py`，把模块级的 `arch` / `defect` / `compose` / `for` 循环整体收进函数。**全文替换为**：

```python
#!/usr/bin/env python3
# 职责：从 skills/ 各节点正文重新生成 handoff 纪律块（charter-*.md）。
# 边界：只做「去 frontmatter + 附录拼接 + 0600 落盘」，不校验正文内容；组成映射改动在本文件里改。
# 注意：agentd 的 resolver 每次派发时现读盘，运行本脚本即全部生效，无需重启 agentd。
# 回退 skill 后必须重跑本脚本，否则纪律块仍是新版正文（两个消费端会漂移）。
#
# 本文件同时是库：charter_provision 直接 import regen() 把块生成到临时目录做比对，
# 故模块顶层不得有任何写盘副作用——import 只定义，不执行。
import argparse
import os
import re

SK = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "skills")
OUT = os.path.expanduser("~/.handoff/discipline")


def body(name):
    t = open(f"{SK}/{name}/SKILL.md").read()
    return re.sub(r'^---\n.*?\n---\n', '', t, flags=re.S).strip() + "\n"


def retitle(text, title):
    # 附录正文的一级标题换成「# 附：…」，避免与主体标题同级混淆
    return re.sub(r'^# .*$', f'# 附：{title}', text, count=1, flags=re.M)


def compose_map():
    """组成映射：breakdown 带缺陷族法、implement 带架构法、review 带两法，其余单体。

    返回 {块名: [正文段, ...]}。每次调用重读 skills/ 正文——调用方可能刚改完正文。
    """
    arch = retitle(body("architecture-law"), "架构法（子系统与领域章）")
    defect = retitle(body("defect-families"), "缺陷族法")
    return {
        "contract":  [body("contract")],
        "breakdown": [body("breakdown"), defect],
        "plan":      [body("plan")],
        "implement": [body("implement"), arch],
        "review":    [body("review"), arch, defect],
        "integrate": [body("integrate")],
        "recon":     [body("recon")],
    }


def regen(out=OUT):
    """把 skills/ 正文生成为纪律块，落到 out 目录。

    参数：out —— 落盘目录，缺省为本机 handoff 纪律块目录。目录必须已存在。
    返回：{块名: 字节数}，供调用方打印或断言。
    注意：逐文件写、非原子——中途失败会留下新旧混合的半装状态（已知欠账，见 roadmap 第 16 条）。
    """
    sizes = {}
    for name, parts in compose_map().items():
        path = f"{out}/charter-{name}.md"
        with open(path, "w") as f:
            f.write("\n---\n\n".join(parts))
        os.chmod(path, 0o600)
        sizes[name] = os.path.getsize(path)
    return sizes


def main(argv=None):
    p = argparse.ArgumentParser(description="从 skills/ 正文重新生成 charter 纪律块")
    p.add_argument("--out", default=OUT, help=f"落盘目录（缺省 {OUT}）")
    args = p.parse_args(argv)
    for name, size in regen(args.out).items():
        print(name, size)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
```

2. 跑 `python3 scripts/regen_discipline.py` 无参，肉眼确认输出仍是 7 行 `<名字> <字节数>`。

**验收**（逐条可判 pass/fail）：

1. `python3 scripts/regen_discipline.py` 无参跑完退出码 0，`~/.handoff/discipline/` 下 7 个 `charter-*.md` 全部刷新，权限仍 `0600`；输出仍为 7 行「名字 空格 字节数」；
2. `python3 scripts/regen_discipline.py --out <tmpdir>` 跑完，7 个文件落在 `<tmpdir>`；且 `~/.handoff/discipline/` 下 7 个文件的 mtime **未变**（跑前记录、跑后比对）；
3. 在临时 HOME 下 `import regen_discipline` **不产生任何文件**（断言该 HOME 下 `.handoff` 不存在）；
4. `regen(out)` 返回的字典键集合逐字为 `{contract, breakdown, plan, implement, review, integrate, recon}`。

**日志与注释**：本脚本无结构化 logger（纯 CLI 小工具，既有形态即 `print`），保持 `print`；**新增的两个函数都写了 docstring**（职责/参数/返回/注意事项），文件头职责与边界注释已更新说明「本文件同时是库」。

**入口指针**：`scripts/regen_discipline.py`（41 行，整体替换）。

---

## T2 — `skills/implement/SKILL.md` 新增「变异自验」段（C4 形态①②）

**测试范围**：无代码测试（纯正文）。验收走 T8 的 regen 后文本断言。

### 步骤

1. 打开 `skills/implement/SKILL.md`，在「## 测试三段律」小节**之后**插入下面整段（不要改动任何既有段落）：

```markdown
## 变异自验：确认测试真的有牙

改完之后做变异，是为了回答「测试拦不拦得住我」。这件事有两种失败方式，两次都会让你
得到一个长得像结论的假读数——**两次都必须先排除，再解释读数**。

**① 变异必须编译得过。**删掉一行代码常常连带让 import 或局部变量变成「未使用」，
在 Go / Rust / TS(noUnusedLocals) 这类语言里直接是编译错误。此时测试一支都没跑，
`grep -c "^--- FAIL"` 得到的是 **0**——它和「变异存活 = 测试是摆设」长得一模一样。
所以变异脚本必须**两段判定**：先确认编译通过（`go build ./...`，或检查输出里没有
`build failed` / `cannot` / `undefined`），再数失败数。编译不过的那一发**不算数**，
必须整块替换成可编译的等价变异后重做。

配套手法：**变异要改语义，不要改「有没有用到」**。优先取反、改边界值、改比较符，
而不是整行删除——删除天然容易牵连 import 与变量声明。

**② 变异必须打中唯一。**同一段文本在文件里出现两次时，`replace(old, new, 1)` 打中的
是第一处，而你要测的守卫可能在第二处。这一种比 ① 隐蔽得多：**编译通过、测试真的跑了、
报 0 红**，从任何输出上都看不出异常。所以变异前必须**断言命中唯一**（`count(old) == 1`），
命中多处就要求更长的上下文锚。

变异后**先做一次行为断言**（哪怕只跑一条最相关的用例，确认它变红或变绿），确认这一发
真的改变了行为，再去数全量失败数。

**「变异后一切如常」永远先怀疑变异没生效，而不是先下「测试是摆设」的结论。**
如果变异真的生效，行为必须变；行为没变说明没打中，不说明没人看着。
```

2. 不改 `skills/architecture-law/SKILL.md`（它是 implement 纪律块的附录，本 task 不触碰）。

**验收**：

1. T8 跑 `regen --out <tmp>` 后，`<tmp>/charter-implement.md` **同时含**字符串「变异」「编译」「唯一」——三者缺一不通过；
2. 同文件仍含原有四个段标题（TDD 铁律 / 测试三段律 / 日志与注释 / 修复熔断）——**新增不得挤掉存量**；
3. `<tmp>/charter-implement.md` 字节数 **< 65536**（handoff `maxBlockSize` 上限，`internal/discipline/resolver.go:23`；本轮实测现值 13520，余量 79%——本条是回归防线不是风险点）；
4. `git diff --stat skills/architecture-law/SKILL.md` 为空。

**判据为何不写「新增 ≥N 行」**：那正是形态③的代理指标型假达标——补 N 行空话即可满足。本 task 的判据**自我适用**本 task 要落的纪律。

**入口指针**：`skills/implement/SKILL.md`（43 行）。

---

## T3 — `skills/acceptance/SKILL.md` 形态①改引用式（不重写）

**测试范围**：无代码测试。**注意：acceptance 不在 regen 的 compose 映射里**（`scripts/regen_discipline.py` 的 `compose_map()` 七个键不含它），故本 task 的落地证据**无法由 check 的纪律块比对覆盖**，只能文本级验收——这条与 spec 第 216-217 行的表述不同，已在卡 C4 记账。

### 步骤

1. 打开 `skills/acceptance/SKILL.md`，把第 2 节里以「**变异必须编译得过。**」开头的那一条，**整条替换**为：

```markdown
- **变异必须编译得过、必须打中唯一**——两条的展开与手法见 implement 的「变异自验」段，
  此处不重复正文。协调者复验时按那一段执法：编译不过的那一发不算数，「变异后一切如常」
  先怀疑没打中。
```

2. 该节其余两条（变异点选**本次交付的承重行为**、转红须含**声明缝上的那支**）**逐字保留**——它们是协调者复验侧的判据，不属形态①。

3. 红旗表第 43 行「变异删掉整段实现，测试红了 → 若红的是编译错误，证据无效，重做保编译的变异」**保留**。

4. **按拍板 F-7**，在红旗表**紧随其后**补一行（这是协调者显式批准的范围扩张）：

```markdown
| 「变异后行为一模一样，测试也不红」 | 先怀疑变异没打中（同名文本命中了别处），而不是先判「没人看着」。变异真生效则行为必变。 |
```

5. **不得**改 `scripts/regen_discipline.py` 的 `compose_map()`——给 acceptance 加纪律块是 spec Out of Scope 第 6 条。

**验收**：

1. `skills/acceptance/SKILL.md` 第 2 节**不再出现**「删出一个编译错误不是证据」这类展开表述，改为一行指向 implement 的指针；
2. 该节其余两条逐字保留（diff 只显示被替换的那一条）；
3. 红旗表含**两行**变异相关红旗（原第 43 行 + F-7 新增行）；
4. `git diff scripts/regen_discipline.py` 中 `compose_map` 的键集合未变。

**入口指针**：`skills/acceptance/SKILL.md:18-24`（第 2 节）、`:38-44`（红旗表）。

---

## T4 — `skills/plan/SKILL.md` 判据段扩写（C4 形态③④）

**测试范围**：无代码测试。验收走 T8 的 regen 后文本断言。

### 步骤

1. 打开 `skills/plan/SKILL.md`，在「每个实现类 task 必含的步骤」第 1 条（`判据先在基线跑`）**那一条的正文末尾**追加下面两段。**不要新起顶级章节**——它们是第 1 条的两个具体化。

```markdown
   **判据要钉住行为，不钉住计数。**写下一条计数型判据（「文件数 41→50」「覆盖率 ≥80%」
   「新增 ≥N 行」）之前先自问：**满足它的最省力方式是什么，那个方式达成目标了吗。**
   实测反例：判据写「cmd/ 图内文件数 41→50」，执行者补了 40 个**零边**节点，文件数精确
   达标，而 who-calls / chain 查这些命令依然一无所获——判据要代理的是「命令进图可查」，
   它钉住的却是「文件名出现过」。计数是可数的、可满足的，且与目标往往只有相关性没有因果性。

   **跨仓判据落笔前，先确认目标仓钉的依赖版本里真有这个能力。**尤其是自己刚在上游加、
   尚未发版的东西，最容易想当然。实测反例：判据写「anchor-off-\* warn = 14」，而目标仓
   钉的依赖版本里根本没有这个类型，执行者查证后如实标「未验证」——处置正确，错在判据。
```

2. 「五项检查」「跨卡审计」「派发前自审」「红线」「自审三查」五节**逐字不动**。

**验收**：

1. T8 跑 `regen --out <tmp>` 后，`<tmp>/charter-plan.md` 含「最省力方式」（形态③的自问句式）**且**同时含「目标仓」与「版本」（形态④）；
2. `skills/plan/SKILL.md` 的顶级 `##` 标题集合与改动前**逐字相同**（判据：`grep '^## ' ` 前后 diff 为空）；
3. 上述五节的 diff 为空；
4. `<tmp>/charter-plan.md` 字节数 < 65536（现值 7113）。

**入口指针**：`skills/plan/SKILL.md:18-27`。

---

## T5 — 接缝：`nodes_equivalent` 先红后绿

**本批唯一接缝。**签名由契约冻结（`nodes_equivalent(repo_def, ledger_def) -> (bool, list[str])`），**一个字符都不许改**。

**契约引用**：C-11（只比 nodes，必要且充分）、C-12（噪声已由 `load_ledger_def` 剥离）、C-13（解析后对象比较）、**D-2（禁止复刻 `withStatesFromNodes`）**、拍板 F-3(b)（递归剥零值）。

**测试范围**：`python3 -m unittest discover -s scripts -p 'test_*.py'`（本批测试文件只有一个，全跑即最小范围）。

### 步骤（红绿模板 —— 本 task 是锁缝断言的步骤，套用）

1. **写失败测试**。新建 `scripts/test_charter_provision.py`，全文如下：

```python
#!/usr/bin/env python3
# 职责：charter_provision 的缝级断言与 regen 参数化的行为断言。
# 边界：不碰真账本、不写 ~/.handoff——一切外部调用走 mock 或 tmpdir。
#       真机验证（真的 put 一次）归 acceptance 的真机清单，不在这里假装。
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

        with mock.patch.object(cp.subprocess, "run", side_effect=fake_run):
            cp.check()
        for cmd in calls:
            self.assertNotIn("put", cmd, f"check 发出了写命令: {cmd}")


if __name__ == "__main__":
    unittest.main()
```

2. **跑红**：`python3 -m unittest discover -s scripts -p 'test_*.py'`。
   预期：`TestNodesEquivalent` 四条全部 **ERROR（`NotImplementedError`）**——红因是**功能缺失**，不是拼写错。
   `TestCheckIsReadOnly` 也红（`check` 尚未实现）。**确认红因后再往下**。

3. **最小实现**。在 `scripts/charter_provision.py` 中，把 `nodes_equivalent` 的 `raise NotImplementedError(...)` 替换为实现，并在其**上方**新增两个私有帮手：

```python
# JSON 侧的零值集合。剥掉它们是因为对侧 Go 结构体几乎全字段带 omitempty——
# 「字段缺失」与「值为零」在 wire 上已被抹平（契约 C-2 字段面 + 拍板 F-3）。
# 反过来说：本机要求区分它们，等于要求区分一个不可区分的差别。
# 注意 struct 字段的 omitempty 在 Go 里不生效，故账本侧会出现 "override":{} / "gate":{}
# 这类空对象（本轮实读确认），剥零值正是为它们准备的。
_ZEROS = ("", 0, False, None, {}, [])


def _strip_zeros(obj):
    """递归剥掉 JSON 零值，返回同型对象。

    参数：obj —— 任意 JSON 可表达对象。
    返回：剥净的同型对象；dict 里值为零的键被删除，list 逐元素递归。
    注意：这是**通用 JSON 规范化**，不是对侧投影逻辑的复刻（D-2 禁的是后者）。
    """
    if isinstance(obj, dict):
        out = {}
        for k, v in obj.items():
            sv = _strip_zeros(v)
            if not any(sv is z or sv == z for z in _ZEROS):
                out[k] = sv
        return out
    if isinstance(obj, list):
        return [_strip_zeros(v) for v in obj]
    return obj


def _defs_diff(a, b, where):
    """逐字段比较两个已剥零值的 dict，返回人读的差异行。

    参数：a 仓侧、b 账本侧、where 差异行的前缀（如 "节点 plan"）。
    返回：差异行列表；无差异时空列表。每行同时含位置与字段名——
          「知道漂了但不知道漂在哪」是 B229 与 C6 都吃过的亏。
    """
    diffs = []
    for key in sorted(set(a) | set(b)):
        if key not in a:
            diffs.append(f"{where}: 仓内缺少字段 {key}（账本为 {b[key]!r}）")
        elif key not in b:
            diffs.append(f"{where}: 账本缺少字段 {key}（仓内为 {a[key]!r}）")
        elif a[key] != b[key]:
            diffs.append(f"{where}: 字段 {key} 不同（仓内 {a[key]!r} / 账本 {b[key]!r}）")
    return diffs
```

   然后 `nodes_equivalent` 的函数体（保留既有 docstring，只换 `raise` 那一行）：

```python
    repo_nodes = _strip_zeros(repo_def.get("nodes", []))
    ledger_nodes = _strip_zeros(ledger_def.get("nodes", []))

    repo_names = [n.get("name") for n in repo_nodes]
    ledger_names = [n.get("name") for n in ledger_nodes]

    diffs = []
    if repo_names != ledger_names:
        only_repo = [n for n in repo_names if n not in ledger_names]
        only_ledger = [n for n in ledger_names if n not in repo_names]
        for name in only_repo:
            diffs.append(f"节点 {name}: 仓内有、账本没有")
        for name in only_ledger:
            diffs.append(f"节点 {name}: 账本有、仓内没有")
        if not only_repo and not only_ledger:
            # 集合相同而序列不同 = 顺序变了。states 投影按 nodes 顺序取名，故顺序承载语义。
            diffs.append(f"节点顺序不同（仓内 {repo_names} / 账本 {ledger_names}）")

    by_ledger = {n.get("name"): n for n in ledger_nodes}
    for rn in repo_nodes:
        ln = by_ledger.get(rn.get("name"))
        if ln is not None:
            diffs.extend(_defs_diff(rn, ln, f"节点 {rn.get('name')}"))

    return (not diffs), diffs
```

4. **跑绿**：同 2 的命令，`TestNodesEquivalent` 四条全绿（`TestCheckIsReadOnly` 仍红，归 T7）。

5. **变异复验**（本 task 自我适用 T2 刚落的纪律，是本批的狗粮点）：
   - 先断言命中唯一：`grep -c 'repo_def.get("nodes", \[\])' scripts/charter_provision.py` 必须为 **1**（形态②）；
   - 变异：把 `repo_def.get("nodes", [])` 改成 `repo_def`、`ledger_def.get("nodes", [])` 改成 `ledger_def`（**保编译、改语义、非整行删除**，符合形态①的手法）；
   - 跑测试：**断言 1 与断言 4 必须转红**（仓侧无 `states` 键、账本侧有）。**只红一条说明变异没打全，重做**；
   - 还原回绿，确认四条全绿。

**验收**：四条缝级断言全绿 + 变异复验中断言 1 与 4 确实转红（贴命令输出）。

**日志**：本模块的用户界面是 stdout 报文（CLI 小工具，无结构化 logger），差异清单本身即输出；`nodes_equivalent` 是纯函数，不打日志。
**注释**：两个新帮手都有 docstring（参数/返回/注意事项），`_ZEROS` 上方写了「为什么」。

**入口指针**：`scripts/charter_provision.py:61-73`（缝骨架与 D-2 禁令注释）。

---

## T6 — `install()` 实现（幂等）

**裁决依据**：F-4 = (b) 幂等；F-6 = 哨兵名 `charter-must-override`；C-7 顺序 template→workflow→regen。

**测试范围**：同 T5 的一条命令。

### 步骤

1. **先改真源**（F-6）：把 `flows/charter-default.template.json` 的 `"discipline": "implement"` 改为 `"discipline": "charter-must-override"`。
   **JSON 无注释，故含义必须写在别处**——本步骤同时在契约文档的修订记录里加一条 R-4（见 T8 步骤 3）。

2. 在 `scripts/charter_provision.py` 里实现 `install`（替换 `raise NotImplementedError`）：

```python
    print(f"仓：{REPO}")          # 从哪个 checkout 装的，事后可追（worktree 与 master 会不同）
    for kind, name, path in INSTALL_ORDER:
        repo_def = load_repo_def(path)
        try:
            ledger_def = load_ledger_def(kind, name)
        except NotInstalled:
            print(f"{kind} {name}: 账本中不存在，安装")
        else:
            if kind == "workflow":
                same, diffs = nodes_equivalent(repo_def, ledger_def)
            else:
                diffs = _defs_diff(_strip_zeros(repo_def), _strip_zeros(ledger_def),
                                   f"{kind} {name}")
                same = not diffs
            if same:
                print(f"{kind} {name}: 已是最新，跳过")
                continue
            print(f"{kind} {name}: 与账本不一致，安装（{len(diffs)} 处差异）")
        rc = subprocess.run(["handoff", kind, "put", name, "--file", path]).returncode
        if rc != 0:
            print(f"{kind} {name}: 安装失败（退出码 {rc}）。"
                  f"已完成的步骤保留在账本里；重跑本命令是安全的——"
                  f"put 只新增版本、不改旧版，不会写坏已有定义。", file=sys.stderr)
            return rc
    try:
        sizes = regen_discipline.regen()
    except Exception as exc:                       # 不吞：regen 失败是硬失败
        print(f"纪律块生成失败：{exc}。前两步已完成，重跑本命令是安全的。", file=sys.stderr)
        return 1
    print(f"纪律块：{len(sizes)} 个已刷新")
    print("提示：在途卡仍钉着旧版本号，需要时用 handoff workflow migrate 迁移。")
    return 0
```

3. 在文件顶部 import 区补 `import regen_discipline`（同目录模块，`charter_provision` 与它同在 `scripts/`）。

**验收**（判据全部行为化）：

1. **顺序不可颠倒（承重属性）**：mock `subprocess.run`，断言实际发出的命令序列中 `template put` **严格先于** `workflow put`。**只断言 `INSTALL_ORDER` 常量的次序不算数**——那锁的是常量，不是行为；
2. **幂等**：mock 让两侧 def 相等 → 断言**一条 `put` 都没发出**，且 stdout 含「已是最新，跳过」；
3. **半装报文**：mock 让 `workflow put` 返回非零 → `install()` 返回非 0，stderr **同时含**「安装失败」与「重跑本命令是安全的」；
4. **regen 失败是硬失败**：mock 让 `regen` 抛异常 → 返回非 0 且报文点名纪律块（**不得吞掉**）；
5. **仓路径可见**：成功路径 stdout 含 `REPO` 绝对路径。

**日志**：本模块以 stdout/stderr 为界面——入口打印仓路径、每步打印决策（装/跳过/失败）、每条错误分支带上下文、成功路径不静默（打印刷新数与迁移提示）。
**注释**：新增分支的「为什么」写在行内（仓路径为何要打印、重跑为何安全）。

**入口指针**：`scripts/charter_provision.py:76-78`、`:29-32`（`INSTALL_ORDER`）、`flows/charter-default.template.json`。

---

## T7 — `check()` 实现（三值退出码）

**裁决依据**：F-5 = (a) 三值；F-8 = (a) 核 discipline 文件、但**只覆盖 `nodes[*].override.discipline`**，且扩展到「dispatch 节点根本没写 override」也要报。

**测试范围**：同 T5。

### 步骤

1. 先改造 `load_ledger_def`，让「未安装」可分辨。在文件里新增异常类并改造该函数：

```python
class NotInstalled(RuntimeError):
    """账本里没有这个定义。与「账本够不着」区分开——两者的处置完全不同。"""


class LedgerUnavailable(RuntimeError):
    """账本读不到（agentd 不在、handoff 不在 PATH、鉴权失败等）。"""
```

   `load_ledger_def` 的 `subprocess.run(..., check=True)` 改为不 check、自行分诊：

```python
    proc = subprocess.run(["handoff", kind, "show", name],
                          capture_output=True, text=True)
    if proc.returncode != 0:
        # 基线实测（B-1）：不存在时退出码 1、错误走 stderr、stdout 为空。
        # 认不出「记录不存在」时一律归为「够不着」——失败方向是拒绝动作而非误装，
        # 这是刻意的 fail-safe：报文变了顶多多一次人工确认，误判成「没装」会白写一版。
        if "记录不存在" in proc.stderr:
            raise NotInstalled(f"{kind} {name} 不在账本中")
        raise LedgerUnavailable(f"读 {kind} {name} 失败（退出码 {proc.returncode}）："
                                f"{proc.stderr.strip()}")
    for line in reversed(proc.stdout.strip().splitlines()):
        ...  # 既有的「取最后一行合法 JSON」逻辑原样保留
```

2. 实现 `check`（替换 `raise NotImplementedError`）：

```python
    print(f"仓：{REPO}")
    findings = []
    try:
        # 第一段：workflow
        repo_wf = load_repo_def(WORKFLOW_FILE)
        ledger_wf = load_ledger_def("workflow", WORKFLOW_NAME)
        ok, diffs = nodes_equivalent(repo_wf, ledger_wf)
        print(f"workflow {WORKFLOW_NAME}: {'一致' if ok else '漂移'}")
        findings += diffs

        # 第二段：template（F-2 裁决：内联比较，复用同一差异引擎，不新增缝）
        repo_tpl = load_repo_def(TEMPLATE_FILE)
        ledger_tpl = load_ledger_def("template", TEMPLATE_NAME)
        tpl_diffs = _defs_diff(_strip_zeros(repo_tpl), _strip_zeros(ledger_tpl),
                               f"template {TEMPLATE_NAME}")
        print(f"template {TEMPLATE_NAME}: {'一致' if not tpl_diffs else '漂移'}")
        findings += tpl_diffs
    except NotInstalled as exc:
        print(f"未安装：{exc}。跑 `python3 scripts/charter_provision.py install`。",
              file=sys.stderr)
        return 2
    except LedgerUnavailable as exc:
        print(f"账本不可用：{exc}", file=sys.stderr)
        return 2

    # 第三段：纪律块（按当前仓正文重新生成到临时目录，逐文件比对已装的）
    with tempfile.TemporaryDirectory() as tmp:
        regen_discipline.regen(tmp)
        for name in sorted(os.listdir(tmp)):
            installed = os.path.join(regen_discipline.OUT, name)
            fresh = os.path.join(tmp, name)
            if not os.path.exists(installed):
                findings.append(f"纪律块 {name}: 本机未安装")
            elif open(installed).read() != open(fresh).read():
                findings.append(f"纪律块 {name}: 与本仓正文不一致")
    print(f"纪律块：{7 - len([f for f in findings if f.startswith('纪律块')])}/7 一致")

    # F-8：每个 dispatch 节点都必须点名一个存在的纪律块文件。
    # 只看 nodes[*].override.discipline，**不看模板缺省值**——缺省值是 F-6 的哨兵，
    # 故意没有对应文件，覆盖它等于让 check 永远报一个自己造出来的问题。
    for n in repo_wf.get("nodes", []):
        if not n.get("dispatch"):
            continue
        name = (n.get("override") or {}).get("discipline")
        if not name:
            findings.append(f"节点 {n.get('name')}: dispatch 节点未写 override.discipline，"
                            f"派发时会落到模板缺省值")
        elif not os.path.exists(os.path.join(regen_discipline.OUT, f"{name}.md")):
            findings.append(f"节点 {n.get('name')}: 纪律块 {name}.md 在 "
                            f"{regen_discipline.OUT} 下不存在")

    for f in findings:
        print(f"  - {f}")
    return 1 if findings else 0
```

3. 顶部 import 区补 `import tempfile`。

**验收**：

1. **一致路径**：在与账本一致的仓上跑 `check` → 退出码 0，三段各报一致。**本轮基线已实测该状态成立**（repo nodes == ledger v9 nodes 为 True）；
2. **漂移必指路**：临时改一份真源某节点的 `next` 取值 → 退出码 1，stdout 含节点名与字段名 `next`；
3. **未安装 ≠ 漂移**：mock 让 `show` 以「记录不存在」失败 → 退出码 **2**，报文含可行动指引（跑 install），**不得**裸抛 `CalledProcessError` 栈；
4. **【承重属性 · 单向性】`check` 绝不写账本**：mock `subprocess.run`，断言全程发出的命令中**没有任何 `put`**（测试已在 T5 写好：`TestCheckIsReadOnly`）；
5. **纪律块比对**：把已装的某个 `charter-*.md` 改一个字 → 报该块不一致并点名文件名；
6. **F-8 生效**：给真源临时加一个 `dispatch: true` 但无 `override.discipline` 的节点 → 报该节点。

**日志/注释**：同 T6——stdout 是界面，三段各报一行，findings 逐条缩进列出；两个新异常类与 F-8 分支都写了「为什么」注释。

**入口指针**：`scripts/charter_provision.py:41-58`（`load_ledger_def`）、`:81-83`（`check` 骨架）。

---

## T8 — 收尾：跑 regen + 全量自检 + 契约回写

**测试范围**：全量（本 task 是 implement 三段律的「收尾全量」，不属任何单个 task 的最小范围）。

### 步骤

1. `python3 -m py_compile scripts/charter_provision.py scripts/regen_discipline.py scripts/test_charter_provision.py`
2. `python3 -m unittest discover -s scripts -p 'test_*.py' -v`
3. **契约回写 R-4**：在 `docs/contracts/2026-08-24-charter-provisioning-contract.md` 的修订记录节追加一条，记明 F-6 的裁决与哨兵 `charter-must-override` 的**含义**（JSON 无注释，这是它唯一的落点）：拍板 D-3 本轮不改的决定被 breakdown 的 F-6 裁决取代，理由是 R-2 证明 CLI 强制非空、「无合理缺省」无法用留空表达。
4. `python3 scripts/regen_discipline.py`（无参，刷新本机纪律块，让 C4 的正文改动真正生效）
5. `python3 scripts/charter_provision.py check`

**验收**：

1. 步骤 1 退出码 0；
2. 步骤 2 全绿；
3. 步骤 4 输出 7 行、权限 `0600`；
4. **步骤 5 的 `check` 恰好报一处漂移，且是 template 段的 `discipline` 字段**
   （仓内 `charter-must-override` / 账本 `implement`），workflow 段与纪律块段报一致，退出码 1。

   > **协调者更正（review I-5，2026-08-24）**：本条初稿写的是「workflow 与 template 两段一致、
   > 纪律块段允许漂移」，**那个判据不可满足**——T6 步骤 1 把哨兵写进仓、而真机 install 被裁到
   > acceptance，template 段必然漂移；纪律块段则因步骤 4 的无参 regen 而必然一致。初稿把两段
   > 说反了。这正是本批 T4 新增纪律的反例（判据写下时对、隔几步就不对），出在自家 plan 上，
   > 照实记账不掩盖。完整三段全绿推迟到 finish 合并后由 acceptance 的 M-1 收口。
5. `flows/*.json` 仍是合法 JSON，`charter.workflow.json` 顶层键仍为 `['nodes']`。

**入口指针**：契约文档修订记录节。

---

## 五项检查（出稿自审）

### 1. 缺陷族对抗审查

已在拆解稿第五节逐族完成（通用五族 + 三条追加设问，两处「无，因为……」），结论已分配进各 task 验收栏：生命周期→T6 判据 3/4；静默失败→T7 判据 3；序列化边界→见下；假红假绿→T5 变异复验 + 反面断言成对存在；门禁绕过→已落 roadmap 16b。**本节不重复，指认为准。**

### 2. 序列化边界设问

新增链路的三处手写投影（拆解稿 P1/P2/P3）逐处有断言：P1→T8 判据 5；P2→T7 判据 3；P3→T5 四条断言。

**roundtrip 属性测试**：本批**不做机内 roundtrip**，因为它需要真的写一次账本而写入不可逆（账本无 delete）。它是**真机项 M-1 的断言形态**。**警告下游**：不要为了凑「roundtrip 属性测试」这件推荐武器去 mock 一个假的 handoff——那就是夹具编码了一个不存在的世界，本批的缺陷族审查专门点了这一条。

**可空类型区分「字段缺失」与「值为零」**：**本批刻意反向而行**——对侧 Go 全字段 `omitempty`，wire 上两者已被抹平，要求区分等于要求区分一个不可区分的差别（拍板 F-3 的决定性论证）。这是有意识的偏离，不是漏做。

### 3. 上下文预算检查

八条 task 的「入口指针」即其有界文件集，最大一条 T7 触及 2 个脚本文件。无一条需插竖切卡（`scripts/` 共 3 个文件，架构法第三条三个升格信号全部未命中）。

### 4. 类型标注

边界型子系统 S2（handoff 账本）**本期零修改**，其行为验收全部写成真机清单（拆解稿第六节 M-1~M-7），归协调者在 acceptance 执行。

### 5. 接缝覆盖（双向）

**清单（来自 spec 测试决定）**：唯一一条缝 = `nodes_equivalent`，调用方 `check()`。

- **缝 → 测试**：`nodes_equivalent` 被 T5 的四条缝级断言锁住 ✅
- **测试 → 缝**：逐支核入口符号——
  | 测试 | 入口符号 | 判定 |
  |---|---|---|
  | `TestNodesEquivalent` 四条 | `nodes_equivalent` | **在缝上** ✅ |
  | `TestCheckIsReadOnly` | `check` | 调用链穿过 `nodes_equivalent` ✅ |
  | T7 判据 1/2/5/6 的测试 | `check` | 同上 ✅ |
  | T6 判据 2 的测试（幂等跳过） | `install` | 调用链穿过 `nodes_equivalent`（幂等分支先比对）✅ |
  | `TestRegenParameterized` | `rd.regen` | **内部锁**，声明见下 |
  | T6 判据 1/3/4 的测试 | `install` | **内部锁**，声明见下 |

**内部锁自我声明（默认非法，逐条给「从声明缝构造不出」的理由）**：

1. **`TestRegenParameterized`（T1 的验收 2/4）** —— 从声明缝构造不出：`nodes_equivalent` 是纯函数，不碰文件系统；「regen 打到临时目录不污染本机」这条行为在缝上根本不可观测。它是 T1 的**可测性启用点**，spec 测试决定已把它归为「内部锁候选，不占接缝名额」。**附加，不顶替**——T1 的缝级覆盖由 T7/T8 经 `check` 的纪律块段承担。
2. **T6 判据 1（首装顺序）** —— 从声明缝构造不出：首装路径上账本里**没有定义可比**，`load_ledger_def` 抛 `NotInstalled` 后直接 put，**缝函数在这条路径上根本不被调用**。而「顺序不可颠倒」是 C-7 钉死的承重属性，必须有锁。
3. **T6 判据 3/4（半装报文、regen 硬失败）** —— 从声明缝构造不出：两者都是错误路径上的**报文与退出码**行为，缝函数不产生报文也不决定退出码。

**每个实现类 task 至少一条缝级断言**：T5 ✅（四条）；T6 ✅（判据 2 经 `install`→缝）；T7 ✅（判据 1/2 经 `check`→缝）。T1 是可测性启用点、T2/T3/T4 是纯正文 task 无代码接缝——**`skills/plan/SKILL.md` 的这一条对它们不适用**，此处显式声明，免得下游按闸门误判。

**退路同闸**：本计划步骤正文里**没有任何条件退路**（无「若意外先绿就改成……」句式）。零条待声明。

---

## 自审三查

**spec 覆盖**（逐条指到 task）：

| spec 用户故事 | 落在 |
|---|---|
| 1. 一条命令装齐，不凭记忆手搓 | T6 |
| 2. 改完仓与账本一致；漂了能一条命令知道漂在哪一样、哪个字段 | T7（三段结构=「哪一样」）+ T5（字段级=「哪个字段」） |
| 3. 执行者读得到「变异必须编译得过 / 打中唯一」 | T2（落正文）+ T8 步骤 4（跑 regen 让它生效） |
| 4. 协调者读得到「判据钉行为不钉计数 / 跨仓先验能力」 | T4 |

**占位符扫描**：全文无 TBD / 无「加适当的错误处理」/ 无「同 Task N」。所有代码块完整可粘贴。**正当出口未使用**（本批不复用既有测试 harness，测试文件是新建的完整代码）。

**跨 task 类型/签名一致性**：见「Interfaces」表；`nodes_equivalent` 的签名与契约冻结物、与 Ticket 0 骨架逐字符一致（`(repo_def, ledger_def) -> (bool, list[str])`）。`regen(out=OUT) -> dict[str,int]` 在 T1 产出、T6/T7 消费，签名一致。

**派发前自审**：本计划**没有**需要驱动派发系统自身的验收步骤（真机 M-5「真派发一次」归 acceptance 的真机清单，不在本计划的 task 里）。
