#!/usr/bin/env python3
# 职责：从 skills/ 各节点正文重新生成 handoff 纪律块（charter-*.md）。
# 边界：只做「去 frontmatter + 附录拼接 + 0600 落盘」，不校验正文内容；组成映射改动在本文件里改。
# 注意：B229 起纪律块的权威副本在 handoff 账本；charter_provision 的 install
# 通过 handoff discipline put 入账，check 通过 handoff discipline get 比对。
# 本脚本无参运行仍可把调试正文写到 OUT，但写 OUT 不代表已安装，也不是 check 判据。
#
# 本文件同时是库：charter_provision 直接 import regen() 把块生成到临时目录做比对，
# 故模块顶层不得有任何写盘副作用——import 只定义，不执行。
import argparse
import os
import re

SK = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "skills")
OUT = os.path.expanduser("~/.handoff/discipline")


def body(name):
    with open(f"{SK}/{name}/SKILL.md") as f:
        t = f.read()
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

    参数：out —— 落盘目录，缺省为本机 handoff 纪律块目录。不存在则建。
    返回：{块名: 字节数}，供调用方打印或断言。
    注意：逐文件写、非原子——中途失败会留下新旧混合的半装状态（已知欠账，见 roadmap 第 16 条）。

    为什么要自己建目录：handoff 只建 DataDir，它的 discipline 子目录是「谁先写谁建」，
    而 agentd 只在自己写块时才建。全新机器上装 charter 时它并不存在——不建就是
    换机重装（本方案的头号场景）必失败，且本机验证因目录早已存在而看不见。
    """
    os.makedirs(out, exist_ok=True)
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
