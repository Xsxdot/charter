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


def load_ledger_def(kind, name):
    """读账本现存定义，取 .Def 子树。

    契约 C-3：`handoff <kind> show` 吐的是完整对象
    {"Name":…,"Version":…,"Def":{…},"CreatedAt":…}，put 只吃其中的 Def 内容。
    契约 C-12：Name/Version/CreatedAt 是账本自增自填的噪声，不参与比对。
    """
    out = subprocess.run(
        ["handoff", kind, "show", name],
        capture_output=True, text=True, check=True,
    ).stdout
    # agentd 的 INFO 日志会混进来，取最后一行合法 JSON
    for line in reversed(out.strip().splitlines()):
        try:
            return json.loads(line)["Def"]
        except (json.JSONDecodeError, KeyError):
            continue
    raise RuntimeError(f"{kind} show {name} 没有可解析的 JSON 输出")


def nodes_equivalent(repo_def, ledger_def):
    """判定两份 workflow def 是否实质等价，并指出差异所在。

    返回 (bool, list[str])：等价与否，以及人读的差异清单（不等价时非空）。

    判据取 nodes 子树一处，契约 C-11 已证明必要且充分：states/gates 是 nodes 的
    纯函数，由 handoff 在写入期自行投影（internal/ledger/workflows.go:20-43）。
    **禁止在此复刻投影逻辑**（拍板 D-2）：那会造出第二份会漂的实现，而本函数正是
    用来发现漂移的工具。

    契约 C-13：在解析后的对象上比，不做字节比对，键序不承载语义。
    """
    raise NotImplementedError("接缝实现归 implement 节点，先写测试再写它")


def install():
    """按 C-7 的固定顺序装三样东西。返回退出码。"""
    raise NotImplementedError("归 implement 节点")


def check():
    """比对账本与仓，报告漂移。返回退出码（0=一致）。"""
    raise NotImplementedError("归 implement 节点")


def main(argv=None):
    p = argparse.ArgumentParser(description="charter 流程安装与漂移比对（仓→账本单向）")
    p.add_argument("mode", choices=("install", "check"),
                   help="install=装进本机账本；check=只比对不写")
    args = p.parse_args(argv)
    return install() if args.mode == "install" else check()


if __name__ == "__main__":
    sys.exit(main())
