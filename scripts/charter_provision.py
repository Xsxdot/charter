#!/usr/bin/env python3
# 职责：把 charter 流程的三样东西从本仓装进本机 handoff 账本（install），
#       以及回答「账本与仓漂了没有」（check）。
# 边界：仓是流程与纪律正文的唯一真源，handoff 账本是安装目标——本脚本只做 仓→账本 单向；
#       不导出、不从账本回写仓。纪律块经 discipline get/put 对账和安装，不读取本机 OUT。
#       改流程一律改仓再装。
#       不碰跨机同步（归 handoff 卡 B229）。
# 契约：docs/contracts/2026-08-24-charter-provisioning-contract.md，条目号见各处 C-N 标注。
#
import argparse
import json
import logging
import os
import re
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
LOGGER = logging.getLogger("charter_provision")

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


def _run_handoff(cmd):
    """运行 handoff CLI 并记录边界信息。

    参数：cmd —— 完整 argv，首项必须是 handoff。
    返回：subprocess.CompletedProcess；非零返回码交给调用方分诊。
    抛出：LedgerUnavailable —— handoff 不在 PATH 或进程无法启动。
    注意：不使用 check=True；show/get 的非零码需要区分缺记录和不可用。
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


def load_ledger_def(kind, name):
    """读取 workflow/template 账本定义并取 .Def 子树。

    参数：kind 为 workflow 或 template；name 为账本定义名。
    返回：Def dict，不包含 Name/Version/CreatedAt 外层噪声。
    抛出：NotInstalled 表示 stderr 含“记录不存在”；其余读失败为 LedgerUnavailable。
    """
    cmd = ["handoff", kind, "show", name]
    proc = _run_handoff(cmd)
    stderr = proc.stderr or ""
    if proc.returncode != 0:
        if "记录不存在" in stderr:
            LOGGER.warning("账本定义不存在", extra={"kind": kind, "record_name": name})
            raise NotInstalled(f"{kind} {name} 不在账本中")
        LOGGER.error(
            "账本定义读取失败",
            extra={"kind": kind, "record_name": name, "returncode": proc.returncode,
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
    LOGGER.error("账本定义没有可解析 JSON", extra={"kind": kind, "record_name": name})
    raise LedgerUnavailable(f"{kind} show {name} 没有可解析的 JSON 输出")


def load_discipline_body(name):
    """读取账本纪律块正文，去掉版本头后保留全部正文文本。

    参数：name 为请求的裸账本记录名，例如 charter-plan。
    返回：命中 name v数字 行之后的全部 stdout 文本，包含正文尾换行。
    抛出：NotInstalled 表示 stderr 含“记录不存在”；其余失败为 LedgerUnavailable。
    注意：版本头前允许日志；不解析 JSON、不 strip 正文、不读取本机纪律块目录。
    """
    cmd = ["handoff", "discipline", "get", name]
    proc = _run_handoff(cmd)
    stderr = proc.stderr or ""
    if proc.returncode != 0:
        if "记录不存在" in stderr:
            LOGGER.warning("纪律块账本记录不存在", extra={"record_name": name})
            raise NotInstalled(f"纪律块 {name} 不在账本中")
        LOGGER.error(
            "纪律块账本读取失败",
            extra={"record_name": name, "returncode": proc.returncode,
                   "stderr": stderr.strip()},
        )
        raise LedgerUnavailable(
            f"读纪律块 {name} 失败（退出码 {proc.returncode}）：{stderr.strip()}"
        )

    stdout = proc.stdout or ""
    header = re.compile(rf"(?m)^{re.escape(name)} v[0-9]+\r?\n")
    match = header.search(stdout)
    if match is None:
        LOGGER.error("纪律块 stdout 缺少可解析版本头", extra={"record_name": name})
        raise LedgerUnavailable(f"discipline get {name} 没有可解析的版本头")
    body = stdout[match.end():]
    LOGGER.info(
        "纪律块读取成功",
        extra={"record_name": name, "body_bytes": len(body.encode("utf-8"))},
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
            extra={"record_name": name, "path": path, "returncode": proc.returncode,
                   "stderr": (proc.stderr or "").strip()},
        )
    else:
        LOGGER.info("纪律块写入成功", extra={"record_name": name, "path": path})
    return proc.returncode


# JSON 侧的零值集合。剥掉它们是因为对侧 Go 结构体几乎全字段带 omitempty——
# 「字段缺失」与「值为零」在 wire 上已被抹平（契约 C-2 字段面 + 拍板 F-3）。
# 反过来说：本机要求区分它们，等于要求区分一个不可区分的差别。
# 注意 struct 字段的 omitempty 在 Go 里不生效，故账本侧会出现 "override":{} / "gate":{}
# 这类空对象（本轮实读确认），剥零值正是为它们准备的。
#
# 不写 False：Python 里 False == 0，写了也只是重复 0 这一项。
# 本前提承重且仓里无锁——它依赖对侧 NodeDef 的字段标注（handoff types.go:197-233
# 逐字段核过：标量与切片全带 omitempty，Override/Gate 是 struct，唯一指针 Produces
# 的空值被 validateNodes 第 8 条挡住）。对侧新增一个**不带 omitempty 且零值有意义**
# 的字段时，本剥法会开始吃掉真差异——那种字段一旦出现，这里要跟着改。
_ZEROS = ("", 0, None, {}, [])


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
                         extra={"kind": kind, "record_name": name, "error": str(exc)})
            print(f"账本不可用：{exc}。未继续写入；已完成步骤保留，重跑本命令是安全的。",
                  file=sys.stderr)
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
                         extra={"kind": kind, "record_name": name, "error": str(exc)})
            print(f"账本不可用：{exc}。未继续写入；已完成步骤保留，重跑本命令是安全的。",
                  file=sys.stderr)
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
                    extra={"kind": kind, "record_name": name, "path": path,
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
                                 extra={"record_name": block, "path": path,
                                        "error": str(exc)})
                    print(f"纪律块 {block} 生成产物读取失败：{exc}", file=sys.stderr)
                    return 1
                try:
                    installed = load_discipline_body(block)
                except NotInstalled:
                    print(f"纪律块 {block}: 账本中不存在，安装")
                except LedgerUnavailable as exc:
                    LOGGER.error("纪律块安装前账本不可用",
                                 extra={"record_name": block, "error": str(exc)})
                    print(f"账本不可用：{exc}。未继续写入；已完成步骤保留，重跑本命令是安全的。",
                          file=sys.stderr)
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
                                 extra={"record_name": block, "error": str(exc)})
                    print(f"账本不可用：{exc}。未继续写入；已完成步骤保留，重跑本命令是安全的。",
                          file=sys.stderr)
                    return 2
                if rc != 0:
                    print(
                        f"纪律块 {block}: 安装失败（退出码 {rc}）。"
                        "已完成的步骤保留在账本里；重跑本命令是安全的。",
                        file=sys.stderr,
                    )
                    return rc
                print(f"纪律块 {block}: 已入账")
    except Exception as exc:                       # 不吞：regen 失败是硬失败
        LOGGER.error("纪律块生成失败", extra={"repo": REPO, "error": str(exc)})
        print(f"纪律块生成失败：{exc}。前两步已完成，重跑本命令是安全的。",
              file=sys.stderr)
        return 1

    print(f"纪律块：{len(sizes)} 个已处理")
    print("提示：在途卡仍钉着旧版本号，需要时用 handoff workflow migrate 迁移。")
    LOGGER.info("charter 安装完成",
                extra={"repo": REPO, "discipline_count": len(sizes)})
    return 0


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

        # 第二段：template。拍板 F-2——内联比较、复用同一差异引擎，不新增缝。
        repo_tpl = load_repo_def(TEMPLATE_FILE)
        ledger_tpl = load_ledger_def("template", TEMPLATE_NAME)
        tpl_diffs = _defs_diff(_strip_zeros(repo_tpl), _strip_zeros(ledger_tpl),
                               f"template {TEMPLATE_NAME}")
        print(f"template {TEMPLATE_NAME}: {'一致' if not tpl_diffs else '漂移'}")
        findings += tpl_diffs
    except NotInstalled as exc:
        LOGGER.warning("check 发现定义未安装", extra={"error": str(exc)})
        print(f"未安装：{exc}。跑 `python3 scripts/charter_provision.py install`。",
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
                             extra={"record_name": block, "path": path, "error": str(exc)})
                print(f"纪律块 {block} 生成产物读取失败：{exc}", file=sys.stderr)
                return 2
            checked_blocks.add(block)
            try:
                installed = load_discipline_body(block)
            except NotInstalled:
                LOGGER.warning("check 发现纪律块缺失", extra={"record_name": block})
                block_findings.append(f"纪律块 {block}: 账本中不存在")
                continue
            except LedgerUnavailable as exc:
                LOGGER.error("check 读取纪律块时账本不可用",
                             extra={"record_name": block, "error": str(exc)})
                print(f"账本不可用：{exc}", file=sys.stderr)
                return 2
            available_blocks.add(block)
            if installed != fresh:
                LOGGER.warning("check 发现纪律块正文漂移", extra={"record_name": block})
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
                               extra={"node": n.get("name"), "record_name": block})
            except LedgerUnavailable as exc:
                LOGGER.error("F-8 读取 override 纪律块时账本不可用",
                             extra={"node": n.get("name"), "record_name": block,
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


def main(argv=None):
    p = argparse.ArgumentParser(description="charter 流程安装与漂移比对（仓→账本单向）")
    p.add_argument("mode", choices=("install", "check"),
                   help="install=装进本机账本；check=只比对不写")
    args = p.parse_args(argv)
    return install() if args.mode == "install" else check()


if __name__ == "__main__":
    sys.exit(main())
