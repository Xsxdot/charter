# 台账：架构法第十二条「通信方式」+ spec「落位三问」

分支 `claude/zen-matsumoto-97e55e`（worktree），起点 `a40f131`。

## 2026-10-18 spec 节点

- 读 `skills/architecture-law/SKILL.md`：十一条，第四条隔离三档表后直接是「消费方不得二次抽象」；第四条跨切共享判据第 3 条是「缝的体温计」。无任何同步/异步条款（grep 同步|异步|消息 零命中）。
- 读 `skills/spec/SKILL.md` 格式骨架：`问题陈述 / 级别 / 方案 / 全部必交用户故事 / 目标架构与接缝语义（L3）/ 首故事选择 / 实现决定 / 测试决定 / Out of Scope / 备注`；收尾自检 5 条。落位只在 L3 增段被问。
- 读 `skills/review/SKILL.md` 裁决表：「架构法与触及路径」行 verdict 为 通过/违条/未验证，表后只有冻结物触碰行的判据段。
- 读 erp 仓依据：`AGENTS.md:30`、`docs/review/backend-review-2026-10-17.md:116`、`docs/architecture/overview.md:9`（事务由用例所属模块应用层发起，经 Client 传事务上下文）与 §4 同步/异步表、§5 outbox 与幂等。
- 判断：法条零案例，erp 路径不进 skill 正文；spec 只描述文档形态。记为自主决定，交批准。
- 定级 L2，理由写入 spec 头部。
- 产出 `docs/specs/2026-10-18-architecture-law-communication-and-placement-spec.md` r1，状态待批准。未动任何 skill 文件。

## 2026-10-18 批准与实现

- 用户批准 r1 原话：「批准 spec r1，L2 跳 plan，直接实现。erp 路径不进 charter 正文的决定也批准。」已回写 spec 头部状态行。
- 进入实现：按 spec 二节 A–E 逐处落地，只加不改既有条款。
- 落地：architecture-law（第四条插「何时上第 3 档」段、第十二条附于第十一条后、description 同步）、spec（骨架行 + 落位三问段 + 自检第 2 条 + description）、review（裁决表后加架构法行判据段）、README 两行。`grep 第十二条` 三文件各命中。
- README 首次替换脚本断言失败（`architecture-law/` 行前缀是 `├──` 不是 `└──`），改按行前缀匹配后两行替换成功。
- `python3 scripts/charter_provision.py install --shared && check`（后台，exit 0）原始输出：
  ```
  template charter-story-default: 已是最新，跳过
  workflow charter: 已是最新，跳过
  纪律块 charter-story-implement: 与本仓正文不一致，安装 → 已入账
  纪律块 charter-story-plan: 已是最新，跳过
  纪律块 charter-story-review: 与本仓正文不一致，安装 → 已入账
  === CHECK === workflow charter: 一致 / template charter-story-default: 一致 / 纪律块：3/3 一致
  ```
  plan 块未变是预期：`regen_discipline.py:52-56` 组成映射里只有 implement 与 review 拼架构法附录。
- 残余落账：roadmap 第 70、71 条（spec OOS-①②）。
- 提交（命令与输出见下，随后 amend 一次收进同批）：
  ```
  $ git commit -q -F - && git log --oneline -1
  3777fee feat(architecture-law): 第十二条「通信方式」+ 第四条何时上 client + spec 落位三问 + review 对照判据
  7 files changed, 173 insertions(+), 6 deletions(-)
  ```
  （本行随后 amend 一次收进同批，hash 随之变化，不再回写。）
