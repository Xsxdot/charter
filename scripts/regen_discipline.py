#!/usr/bin/env python3
# 职责：从 skills/ 各节点正文重新生成节点纪律正文（charter-story-<节点>.md），供外部种子脚本消费。
# 边界：只做「去 frontmatter + 0600 落盘」，不校验正文内容；组成映射改动在本文件里改。
# 2026-10-24 第三步（C18）起不再拼附录：架构法等改为 spec/plan/review 按需查阅——附录曾让
# implement/review 块膨胀到执行者读不完，每块只留本节点正文。
# 2026-11-01 第四步起本脚本不再有缺省输出目录：--out 必填，写到哪由调用方决定。
#
# 本文件同时是库：外部种子脚本 import 后调 regen(outDir) 把正文生成到临时目录再读文件，
# 故模块顶层不得有任何写盘副作用——import 只定义，不执行；regen 的签名与输出文件名是对外契约。
import argparse
import os
import re

SK = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "skills")
PREFIX = "charter-story"
NODES = ("spec", "plan", "implement", "review", "finish")


def body(name):
    with open(f"{SK}/{name}/SKILL.md") as f:
        t = f.read()
    return re.sub(r'^---\n.*?\n---\n', '', t, flags=re.S).strip() + "\n"


def compose_map():
    """组成映射：五个节点各只含本节点 skill 正文。

    返回 {块名: [正文段, ...]}——保留列表形状，regen 的拼接逻辑与调用方接口不变。
    每次调用重读 skills/ 正文——调用方可能刚改完正文。
    """
    return {name: [body(name)] for name in NODES}


def regen(out, prefix=PREFIX):
    """把 skills/ 正文生成为节点纪律正文，落到 out 目录。

    参数：out —— 落盘目录，必填，不存在则建；
    prefix —— 文件名前缀，输出文件为 <out>/<prefix>-<节点>.md。
    返回：{块名: 字节数}，供调用方打印或断言；正文只在文件里。
    注意：逐文件写、非原子——中途失败会留下新旧混合的半装状态（已知欠账，见 roadmap 第 16 条）。
    """
    os.makedirs(out, exist_ok=True)
    sizes = {}
    for name, parts in compose_map().items():
        path = f"{out}/{prefix}-{name}.md"
        with open(path, "w") as f:
            f.write("\n---\n\n".join(parts))
        os.chmod(path, 0o600)
        sizes[name] = os.path.getsize(path)
    return sizes


def main(argv=None):
    p = argparse.ArgumentParser(description="从 skills/ 正文重新生成 charter-story 节点纪律正文")
    p.add_argument("--out", required=True, help="落盘目录（必填）")
    p.add_argument("--prefix", default=PREFIX, help=f"文件名前缀（缺省 {PREFIX}）")
    args = p.parse_args(argv)
    for name, size in regen(args.out, args.prefix).items():
        print(name, size)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
