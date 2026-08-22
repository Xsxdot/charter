#!/usr/bin/env python3
# 职责：从 skills/ 各节点正文重新生成 handoff 纪律块（~/.handoff/discipline/charter-*.md）。
# 边界：只做「去 frontmatter + 附录拼接 + 0600 落盘」，不校验正文内容；组成映射改动在本文件里改。
# 注意：agentd 的 resolver 每次派发时现读盘，运行本脚本即全部生效，无需重启 agentd。
# 回退 skill 后必须重跑本脚本，否则纪律块仍是新版正文（两个消费端会漂移）。
import re, os

SK = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "skills")
OUT = os.path.expanduser("~/.handoff/discipline")


def body(name):
    t = open(f"{SK}/{name}/SKILL.md").read()
    return re.sub(r'^---\n.*?\n---\n', '', t, flags=re.S).strip() + "\n"


def retitle(text, title):
    # 附录正文的一级标题换成「# 附：…」，避免与主体标题同级混淆
    return re.sub(r'^# .*$', f'# 附：{title}', text, count=1, flags=re.M)


arch = retitle(body("architecture-law"), "架构法（子系统与领域章）")
defect = retitle(body("defect-families"), "缺陷族法")

# 组成映射：breakdown 带缺陷族法、implement 带架构法、review 带两法，其余单体
compose = {
    "contract":  [body("contract")],
    "breakdown": [body("breakdown"), defect],
    "plan":      [body("plan")],
    "implement": [body("implement"), arch],
    "review":    [body("review"), arch, defect],
    "integrate": [body("integrate")],
    "recon":     [body("recon")],
}

for name, parts in compose.items():
    path = f"{OUT}/charter-{name}.md"
    with open(path, "w") as f:
        f.write("\n---\n\n".join(parts))
    os.chmod(path, 0o600)
    print(name, os.path.getsize(path))
