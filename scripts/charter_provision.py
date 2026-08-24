#!/usr/bin/env python3
# 职责：把 charter 流程的三样东西从本仓装进本机 handoff 账本（install），
#       以及回答「账本与仓漂了没有」（check）。
# 边界：仓是唯一真源，账本是安装目标——本脚本只做 仓→账本 单向；
#       不导出、不从账本回写仓。改流程一律改仓再装。
#       不碰跨机同步（归 handoff 卡 B229）。
# 契约：docs/contracts/2026-08-24-charter-provisioning-contract.md，条目号见各处 C-N 标注。
#
# Ticket 0 骨架：本文件只落签名、常量与 CLI 接线。比对函数（本批唯一接缝）
# 的实现留给 implement 按 TDD 先红后绿，此处显式 NotImplementedError。
import argparse
import json
import os
import subprocess
import sys
import tempfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import regen_discipline  # noqa: E402  同目录模块，安装第三步与纪律块比对都用它

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FLOWS = os.path.join(REPO, "flows")

WORKFLOW_NAME = "charter"
TEMPLATE_NAME = "charter-default"
WORKFLOW_FILE = os.path.join(FLOWS, "charter.workflow.json")
TEMPLATE_FILE = os.path.join(FLOWS, "charter-default.template.json")
REGEN = os.path.join(REPO, "scripts", "regen_discipline.py")

# 安装顺序由契约 C-7 钉死，不是任选：workflow 的 dispatch 节点在写入期会校验
# 所引模板已存在（handoff internal/ledger/workflows.go:121），先装 workflow
# 在空账本上必然失败。顺序落成常量，不散在函数体里。
INSTALL_ORDER = (
    ("template", TEMPLATE_NAME, TEMPLATE_FILE),
    ("workflow", WORKFLOW_NAME, WORKFLOW_FILE),
)


def load_repo_def(path):
    """读仓内真源。返回 put 可直接消费的 def 对象（契约 C-1：只是 Def，不含外层）。"""
    with open(path) as f:
        return json.load(f)


class NotInstalled(RuntimeError):
    """账本里没有这个定义。与「账本够不着」区分开——两者的处置完全不同。"""


class LedgerUnavailable(RuntimeError):
    """账本读不到（agentd 不在、handoff 不在 PATH、鉴权失败等）。"""


def load_ledger_def(kind, name):
    """读账本现存定义，取 .Def 子树。

    契约 C-3：`handoff <kind> show` 吐的是完整对象
    {"Name":…,"Version":…,"Def":{…},"CreatedAt":…}，put 只吃其中的 Def 内容。
    契约 C-12：Name/Version/CreatedAt 是账本自增自填的噪声，不参与比对。

    参数：kind 取 "workflow" / "template"；name 定义名。
    返回：Def 子树（dict）。
    抛出：NotInstalled（账本里没有）/ LedgerUnavailable（读不到）。
    """
    try:
        proc = subprocess.run(["handoff", kind, "show", name],
                              capture_output=True, text=True)
    except FileNotFoundError as exc:
        raise LedgerUnavailable(f"找不到 handoff 命令，请确认它在 PATH 中：{exc}") from exc
    if proc.returncode != 0:
        # 基线实测：不存在时退出码 1、错误走 stderr、stdout 为空。
        # 认不出「记录不存在」时一律归为「够不着」——失败方向是拒绝动作而非误装，
        # 这是刻意的 fail-safe：报文变了顶多多一次人工确认，误判成「没装」会白写一版。
        if "记录不存在" in proc.stderr:
            raise NotInstalled(f"{kind} {name} 不在账本中")
        raise LedgerUnavailable(f"读 {kind} {name} 失败（退出码 {proc.returncode}）："
                                f"{proc.stderr.strip()}")
    # agentd 的 INFO 日志会混进来，取最后一行合法 JSON
    for line in reversed(proc.stdout.strip().splitlines()):
        try:
            return json.loads(line)["Def"]
        except (json.JSONDecodeError, KeyError):
            continue
    raise LedgerUnavailable(f"{kind} show {name} 没有可解析的 JSON 输出")


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


def nodes_equivalent(repo_def, ledger_def):
    """判定两份 workflow def 是否实质等价，并指出差异所在。

    返回 (bool, list[str])：等价与否，以及人读的差异清单（不等价时非空）。

    判据取 nodes 子树一处，契约 C-11 已证明必要且充分：states/gates 是 nodes 的
    纯函数，由 handoff 在写入期自行投影（internal/ledger/workflows.go:20-43）。
    **禁止在此复刻投影逻辑**（拍板 D-2）：那会造出第二份会漂的实现，而本函数正是
    用来发现漂移的工具。

    契约 C-13：在解析后的对象上比，不做字节比对，键序不承载语义。
    """
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


def install():
    """按 C-7 的固定顺序装三样东西。返回退出码（0=成功）。

    幂等（拍板 F-4）：与账本一致的那一样跳过不装。理由是账本**没有 delete**，
    每一次 put 都是永久的一版；不跳过的话反复跑 install 会把版本号变成噪声堆，
    而且连跑两次会产生内容完全相同的两版，事后考古得翻内容才知道它们一样。
    """
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


def check():
    """比对账本与仓，报告漂移。

    返回退出码：0=三段全一致 / 1=有漂移 / 2=未安装或账本不可用。
    三值是刻意的（拍板 F-5）：「未安装」与「漂了」的处置动作完全不同，
    压成一个码等于把判断推给读报文的人。
    本函数**只读**——绝不发出任何 put（承重属性，由测试锁住）。
    """
    print(f"仓：{REPO}")
    findings = []
    try:
        repo_wf = load_repo_def(WORKFLOW_FILE)
        ledger_wf = load_ledger_def("workflow", WORKFLOW_NAME)
        ok, diffs = nodes_equivalent(repo_wf, ledger_wf)
        print(f"workflow {WORKFLOW_NAME}: {'一致' if ok else '漂移'}")
        findings += diffs

        # 第二段：template。拍板 F-2——内联比较、复用同一差异引擎，不新增缝。
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

    # 第三段：纪律块。按当前仓正文重新生成到临时目录，与已装的逐文件比对。
    block_findings = []
    with tempfile.TemporaryDirectory() as tmp:
        regen_discipline.regen(tmp)
        for fname in sorted(os.listdir(tmp)):
            installed = os.path.join(regen_discipline.OUT, fname)
            if not os.path.exists(installed):
                block_findings.append(f"纪律块 {fname}: 本机未安装")
                continue
            with open(installed) as a, open(os.path.join(tmp, fname)) as b:
                if a.read() != b.read():
                    block_findings.append(f"纪律块 {fname}: 与本仓正文不一致")
    total_blocks = len(regen_discipline.compose_map())
    print(f"纪律块：{total_blocks - len(block_findings)}/{total_blocks} 一致")
    findings += block_findings

    # 拍板 F-8：每个 dispatch 节点都必须点名一个存在的纪律块文件。
    # 只看 nodes[*].override.discipline，**不看模板缺省值**——缺省值是 F-6 的哨兵，
    # 故意没有对应文件，覆盖它等于让 check 永远报一个自己造出来的问题。
    # 这条编码的是 charter 自己的约定（本流全部节点都用 charter-* 覆盖文件），
    # 不是 handoff 的解析规则——故不构成 D-2 禁止的「复刻对侧逻辑」。
    for n in repo_wf.get("nodes", []):
        if not n.get("dispatch"):
            continue
        block = (n.get("override") or {}).get("discipline")
        if not block:
            findings.append(f"节点 {n.get('name')}: dispatch 节点未写 override.discipline，"
                            f"派发时会落到模板缺省值")
        elif not os.path.exists(os.path.join(regen_discipline.OUT, f"{block}.md")):
            findings.append(f"节点 {n.get('name')}: 纪律块 {block}.md 在 "
                            f"{regen_discipline.OUT} 下不存在")

    for f in findings:
        print(f"  - {f}")
    return 1 if findings else 0


def main(argv=None):
    p = argparse.ArgumentParser(description="charter 流程安装与漂移比对（仓→账本单向）")
    p.add_argument("mode", choices=("install", "check"),
                   help="install=装进本机账本；check=只比对不写")
    args = p.parse_args(argv)
    return install() if args.mode == "install" else check()


if __name__ == "__main__":
    sys.exit(main())
