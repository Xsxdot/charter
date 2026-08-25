# Plan：`codegraph context` 转向最优树词表 + 实然披露（C10）

> spec：`docs/specs/2026-08-25-codegraph-context-vocabulary-spec.md`（已批准）
> 承载分支：`cards/C10-integration`（master ← C1.5-review-1 ← C1.10-charter-7）
> 级别：L2，单任务，无扇出。

## 0. 现状事实（实读，非推断）

| 事实 | 出处 |
|---|---|
| `AssembleContext(v, g, repoRoot, domainID, opts)` 用 `v.Domains[domainID]` 做词表判据，未命中即报「best-only id 不能用于 context」 | `graph/codegraph/context.go:61,65,69` |
| 声明查找是 `decls[domainID]`，用同一个现状 id | `context.go:93` |
| 域成员判据统一是 `subtree[nodeDomain(v, n.Node)]`，四处消费：`contextPackages` / `contextInterfaces` / 实体过滤 / `contextFoci` | `context.go:180,204,113`；`contextFoci` 同文件 |
| `domainSubtree` 靠 `Domain.Parent` 向下闭包 | `context.go:165` |
| `Best.Domains[id].Parent` 存在，故 best 侧可用同一套闭包 | `graph/codegraph/best.go` 的 `BestDomain` |
| `Best.Containers` 是 `container -> best 域`；`Best.DomainOfContainer(id)` 已存在 | `best.go` |
| 放错位的**唯一既有定义**是 `bestGapFindings`，且**词表不可比时不伪报**、只累加 `misplacedSkipped` | `gap.go:20,50,53`；纪律见 `gap_test.go:74` |
| `ValidateDecls` 已在 C1.10 改成 `(v, best, repoRoot, decls)` | C1.10 交付 |

**由上一条推出一个必须写进披露的坑**：handoff 的现状域（如 `d_coordination_task`）不在
`best.Domains` 里，于是它的容器全部走 `misplacedSkipped`，**放错位恒为 0**。
若只报 0 而不报 skipped，读者会把「词表不可比所以没法比」误读成「没搬错」。

## 1. 任务（单任务，顺序即依赖序）

### T1｜词表判据改为最优树，成员判据抽成谓词

**文件**：`graph/codegraph/context.go`、`graph/cli/cli.go`

1. 签名改为 `AssembleContext(v *View, g *Graph, best *Best, repoRoot, domainID string, opts QueryOptions)`
   ——**显式传参，不在函数内 `LoadBest`**（spec 实现决定：参数化才测得动 best 缺席分支）。
   调用点 `cli.go:596` 同刀更新；`graphLoadView` 旁边补 best 加载（best 缺席返回 nil，不报错）。
2. 把四处 `subtree[nodeDomain(v, n.Node)]` 收敛成**一个谓词**
   `member func(Node) bool`，由 `contextPackages` / `contextInterfaces` / `contextFoci` /
   实体过滤共用（四个 helper 的 `subtree map[string]bool` 形参改成 `member`）。
   **两种词表只是两种谓词构造，遍历逻辑一份**：
   - best 在场：`bestSubtree` = 以 `domainID` 为根、按 `BestDomain.Parent` 闭包；
     `member(n) = bestSubtree[best.DomainOfContainer(n.Container)]`；
   - best 缺席：`member(n) = curSubtree[nodeDomain(v, n)]`（**与今天逐字等价**）。
3. 词表判据与报错：
   - best 在场且 `domainID ∈ best.Domains` → 正常；
   - best 在场且不在 → **可行动报错**：说清本命令已转向最优树词表、列出 best 候选；
     若 `domainID` 恰是现状视图 id，**额外**列出它的容器实际映射到的 best 域及各自容器数
     （即 spec 故事 3；数据现成，`Best.Containers` 一遍统计即得）。**不做自动改写**（OOS 永不做）。
   - best 缺席 → 走现状词表，且 `out.Warning` 追加**可见告警**说明本次降级运行。
4. 声明查找 `decls[domainID]` 一行不动——`domainID` 此刻已是 best id，自然与 C1.10/C1.11 对齐。

### T2｜实然披露

**文件**：`graph/codegraph/context.go`

`ContextResult` 加 **additive-only** 可选键（缺席时省略，不发 `null`）：

```
Actual *ContextActual `json:"actual,omitempty"`

ContextActual{
  Containers      int                   // 本 best 域覆盖的真实容器数
  ByCurrentDomain []ActualDomainCount   // 今天实际归属分布，按容器数降序、同数按 id 升序
  Misplaced       []ActualMisplaced     // 复用 bestGapFindings 的既有定义，过滤到本域
  MisplacedSkipped int                  // 词表不可比而未判的容器数——**必须报**
}
```

三条纪律：

- **不自造放错位定义**：`Misplaced` 一律来自 `bestGapFindings`，仓内只留一份真相；
- **`MisplacedSkipped` 必须同时出现**，否则 0 会被读成「没搬错」（见 §0 那个坑）；
- **只统计陈列、不做归一选择**：`ByCurrentDomain` 是分布，绝不替调用方挑一个"主归属"。

best 缺席时 `Actual` **整个省略**（没有最优树就没有"应然 vs 实然"可言）。

### T3｜fixture 与既有测试归位

`graph/codegraph/testdata/repo`：C1.10 已把声明改成 `domains/d_cmd.json`（best 词表）。
`context_test.go` 改为按**新词表语义**验，**不是改个名字让它绿**——见下节用例表。

## 2. 测试（接缝清单，每支指回一条缝）

**缝 1 主缝：`graph/codegraph#AssembleContext`**（调用方 `graph/cli/cli.go` 的 `graphContextCmd`）

| 用例 | 断言 |
|---|---|
| best 在场 + best id 且有声明 | `Declaration != nil`；`Domain.ID` 为该 best id |
| best 在场 + best id 但无声明 | `Declaration == nil` 且 Warning 含催稿语义与写入路径 |
| best 在场 + 传现状-only id | 返回 error；文案含「最优树词表」+ best 候选 + 该 id 容器映射到的 best 域分布 |
| best 缺席 | 行为与今天逐字等价（现状词表可用）**且** Warning 含降级说明；`Actual == nil` |
| 实然披露 | `Actual.Containers` 等于该 best 域容器数；`ByCurrentDomain` 分布正确且有序；`MisplacedSkipped` 如实 |
| 父域（有子域） | best 子树闭包生效：父域覆盖全部后代叶子的容器 |

**缝 2 边界缝：`graph/cli#graphContextCmd` 的 JSON 输出**（消费方是 agent，序列化形态即契约）
——断言 `actual` 键在 best 在场时存在、best 缺席时**省略而非 `null`**。

**变异复验（每条必须能红）**：
1. 词表判据换回 `v.Domains` → 主缝「best id 有声明」那支必红；
2. `ByCurrentDomain` 改成只报总数 → 披露那支必红；
3. 吞掉 best 缺席的降级告警 → 缺席那支必红；
4. `MisplacedSkipped` 恒返回 0 → 披露那支必红。

**回归底线**：`cd graph && go build ./... && go vet ./... && go test ./...` 全过；
`cd graph/webui && npx tsc -b && npm test` 全过（C1.10 的前端不得被波及）。

## 3. 缺陷族自检（对照 defect-families）

| 族 | 本卡命中点与锁 |
|---|---|
| 静默失败 | best 缺席不静默退现状（有 Warning）；放错位 0 不静默（有 MisplacedSkipped）；`actual` 缺席省略而非 null。各有断言。 |
| 误导报错 | 传现状 id 的报错必须可行动（含候选与映射分布），不是「不在词表中」。有断言。 |
| 双份真相 | 放错位只用 `bestGapFindings` 一处定义；成员判据收敛成一个谓词，遍历逻辑不复制。 |
| 假绿测试 | fixture 改名不算修好——用例验的是词表语义与分布数字，且四发变异各自钉一支。 |

## 4. 不做

见 spec 的 Out of Scope。特别重申两条：**不做旧 id 自动改写**（非单值映射下等于替用户猜）；
**不动 handoff 仓**（声明文件迁移归 C1.11）。
