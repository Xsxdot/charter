# Spec：`codegraph context` 转向最优树词表 + 实然披露（C10）

> **状态：已批准（2026-08-25，用户「批准」）**
> 级别/档位：**L2 单子系统**（只动 charter 的 `graph` 子系统：`graph/codegraph` + `graph/cli`；不动 handoff、不改跨仓 wire 契约）
> 来源：裁决 **#6**（2026-08-25 用户裁「A+：最优树词表 + 实然披露」）。缺陷发现于 C1.5/C1.10 攒批合并试跑。

## 问题陈述

**两张卡各自单独跑测试都绿，合起来必红，而 git 不报任何冲突**——因为两边改的不是同一个文件。

- **C1.5** 的 `AssembleContext`（`graph/codegraph/context.go:65`）只接受**现状视图**领域 id，
  并显式拒绝 best-only id（错误文案逐字为「best-only id 不能用于 context」）；
  `context.go:93` 又用**同一个现状 id** 去 `decls[domainID]` 取声明。
- **C1.10** 已把 `ValidateDecls` 改为**以 `best.Domains` 为唯一主词表**；**C1.11** 接着要把
  handoff 的声明文件重写成 best id（用户 2026-08-25 裁决 A：改成最优树的 id）。

即：**声明按最优树存，context 按现状取。** 迁移一落地，context 就取不到声明。

### 现状读数（真机实测，2026-08-25，隔离 agentd + handoff 真实数据）

| 读数 | 值 | 出处 |
|---|---|---|
| 现状视图领域数 | **20** | `/api/projects/handoff/codegraph` 的 `baseline.domains` |
| best 领域数 | **23** | `best.domains` |
| 两套词表交集 | **11** | 上二者取交 |
| 合并树 Go 测试 | **FAIL** `TestAssembleContextDeclaredAndUndeclared` | 临时 worktree 试跑合并后 `go test ./codegraph/` |
| 两分支单独跑 | 各自 **ok**（0.577s / 0.536s） | 分别建 worktree 实跑 |
| 迁移后 `d_orchestration` 声明可达性 | **不可达**（被 `context.go:65` 直接拒绝） | 推论 + 上述报文 |
| 迁移后 `d_workspace` 声明可达性 | 可达（两套词表同名，巧合） | 同上 |

fixture 层的表征是 `testdata/repo/codegraph/domains/` 在 master/C1.5 上是 `d_cli.json`、
在 C1.10 上被重命名为 `d_cmd.json`（改成 best 词表 id），合并取了 C1.10 的重命名，
而 C1.5 **新增**的 `context_test.go` 仍查 `d_cli`——该文件 C1.10 从未碰过，故无冲突可报。
**但把测试改名并不能修好**：真因在词表，不在文件名。

## 方案（含弃选）

### 采纳：A+ —— context 用最优树词表取声明，同时披露实然

1. **词表**：`AssembleContext` 接受 **best 领域 id**；领域切片 = 「best 把哪些容器判给了这个域」。
   声明查找仍是 `decls[domainID]`，此时 `domainID` 已是 best id，与 C1.10/C1.11 的存法对齐。
2. **实然披露**（本方案的"+"，也是用户追问「给 agent 用会不会造成歧义」的处置）：
   返回里必须同时给出**这些容器今天实际在哪**——覆盖容器数、按现状域的分布、放错位清单。

   语义上要让消费者一眼分得清两层：**应然**（声明与 best 分组）与 **实然**（今天的真实归属）。
   形态示意（不是最终字段名，签名归 plan）：

   > 领域 `d_orchestration`（应然）覆盖 11 个容器。
   > 今天实际归属：`d_coordination_task` 10 个、`d_coordination_api` 1 个。其中放错位 m 个。

3. **best 缺席时**：不静默退回现状词表。按 C1.10 给 `ValidateDecls` 定下的同一条纪律
   ——缺席产生**可见告警**，并明说本次按现状视图词表降级运行。**这是降级，不是双词表**：
   没有最优树的项目本就只有一套词表可用。

### 为什么不是 B（现状词表 + 现状→best 映射）

**映射非单值，且在第一个真实用例上就不单值。**实测：15 个现状域里 **4 个**的容器散落到多个 best 域——

| 现状域 | 散到几个 best 域 | 分布 |
|---|---|---|
| `d_web` | **7** | web_shell 13 / web_contract 9 / web_admin 10 / web_workbench 8 / web_command 6 / web_cards 4 / 未归 1 |
| **`d_coordination_task`** | **7** | orchestration 10 / maintenance 5 / policy 3 / workspace 2 / gateway 1 / web_shell 1 / 未归 3 |
| `d_coordination_api` | 2 | gateway 3 / orchestration 1 |
| `d_executor` | 2 | execution_adapters 40 / execution_contract 6 |

`d_coordination_task` **正是今天唯一那份要迁移的声明所在的域**。B 在它身上就没有唯一解，
而且取错不会报错——**静默给出别人的说明书**，属缺陷族里最坏的那类。

### 为什么不是 C（声明保留双套键）

C1.11 spec 已作为弃选写过，理由不变：补丁式修复，会把用户裁的「改成」变成「兼容」，永远收不了口。

## 用户故事

1. 作为 agent，我 `codegraph context d_orchestration`，拿到的是**这个域的声明**（不再是"声明缺失"），
   以及真实的包、接口、主链与实体。
2. 作为 agent，我在同一份返回里看到「本域覆盖 N 个容器；今天实际归属 X 域 a 个、Y 域 b 个；放错位 m 个」，
   因此**不会误以为仓库已经按最优树组织好了**——这正是本卡"+"的存在理由。
3. 作为维护者，我用旧的现状域名去查（如 `context d_coordination_task`），得到的是**可行动的报错**
   ——说清这是现状词表 id、本命令已转向最优树词表、并给出对应的 best 域候选，而不是一句"不在词表中"。
4. 作为无最优树项目的使用者，我照常用现状域名，且**看得见一条告警**说明本次是降级运行。
5. 作为协调者，C1.5 + C1.10 合并后的结果树 `go test ./...` **全绿**——本卡的验收底线。

## 实现决定

- `AssembleContext` 显式接收 `best *Best` 参数（与 C1.10 给 `ValidateDecls` 的改法同款），
  **不在函数内部偷偷 `LoadBest`**——参数化才测得动 best 缺席分支。
- 实然披露是 `ContextResult` 上的 **additive-only 新键**，旧消费方可安全忽略（沿用本仓既有 additive 纪律）。
- 现状域 → best 域的分布**只做统计与陈列，不做归一选择**——正因为它非单值，本卡绝不替调用方挑一个。
- fixture 归位：`testdata/repo` 的声明文件与 best 词表对齐（C1.10 已改成 `d_cmd.json`，
  本卡让 `context_test.go` 按新词表验，**且必须验的是词表语义，不是改个名字让它绿**）。

## 测试决定（接缝清单）

1. **`graph/codegraph#AssembleContext`**（调用方：`graph/cli/cli.go` 的 `graphContextCmd`，
   `cli.go:596` 处调用）——本卡主缝。表驱动覆盖：best id 命中声明、best id 无声明（催稿语义）、
   传现状-only id（可行动报错 + best 候选）、best 缺席降级（告警可见）、实然披露的分布与放错位计数。
2. **`graph/cli#graphContextCmd` 的 JSON 输出**（调用方：CLI 用户与 agent）——边界型接缝：
   返回被 agent 当作输入消费，**序列化形态即契约**。断言新键存在、缺席时省略而非发 `null`。

**变异复验**（每条都要能红）：把 best 词表判据换回现状词表 → 主缝那几支必红；
把实然披露里的"按现状域分布"改成只报总数 → 披露那支必红；把 best 缺席的告警吞掉 → 降级那支必红。

**回归底线**：C1.5 + C1.10 合并树 `go test ./...` 与 `go vet ./...` 全过——这是本卡存在的直接原因，
不绿即未完成。

## Out of Scope

- **改 handoff 仓的任何东西**：声明文件迁移仍归 C1.11，本卡只改 charter 侧的读取方。
- **给 `context` 加"自动迁移旧 id"**：故事 3 只要求**可行动报错 + 候选**，不做自动改写——
  非单值映射下自动改写等于替用户猜。**永不做。**
- **查看器侧的任何改动**：C1.10 已交付，本卡不碰 `graph/webui`。
- **补齐其余 21 个域的声明**：覆盖读数停在诚实值，见 C1.11。**本期不做、后续要做**（已在 C1.11 落 roadmap）。
- **`codegraph chain / who-calls / sym` 等其他子命令的词表**：本卡只动 `context`。
  它们今天按现状词表工作，是否也该转向最优树，**本期不做、后续要做**，落 roadmap。

## 备注

- 本卡**阻塞攒批合并**：C1.5 / C1.7 / C1.10 都停在 finish 等它落地。
- 承载分支：`cards/C10-integration`（= master ← C1.5-review-1 ← C1.10-charter-7 的合并树，
  roadmap 冲突按"都留下、C1.5 侧改号 18→19、19→20"解，dist 冲突按 `npm run build` 重建解）。
  finish 时主线只需合这一条分支。
