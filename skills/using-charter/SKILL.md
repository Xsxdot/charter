---
name: using-charter
description: 会话开始时建立流程纪律——任何开发任务动手前先定位它在流程中的节点并调用对应 skill。由 SessionStart hook 全文注入。
---

# Using Charter

你装载了 charter 套件：契约先行、分子系统并行的开发流程。流程中的每个节点是一个 skill。

## 规则

**动手前先定位节点。**任何开发请求——新功能、修 bug、重构、评审——先判断它处于流程的哪个节点，调用对应 skill，再开始工作。哪怕只有 1% 的可能某个节点 skill 适用，也必须先调用确认。

## 节点地图

入口只有两条，网关直接分流，无分诊节点：

```
bug/测试失败/诡异行为 → debug（根因+分流）→ 小修顺手 / plan → implement → review → acceptance → finish
需求/想法 → spec（收尾定级与选档）
   ├─ L2 单子系统 → plan → implement → review → acceptance → finish
   └─ L3 跨子系统 → contract → breakdown
        ├─ 轻档：单轮 implement → review → acceptance → finish
        └─ 重档：各子系统并行(plan→implement→review) → integrate → finish
```

横切（被各节点引用，不占流程位）：`architecture-law`（架构法·子系统与领域章）、`defect-families`（缺陷族法）、`recon`（图对账——合并前核对分支改动与视图 diff，作为卡流「图对账」列的纪律块源头，被 finish 第 4 步引用）；implement 中途撞失败 → 切入 `debug`。

定级与选档的判据在 spec 的「定级与选档」节，判决按定稿范围下、写进 spec 头部；判错的纠偏是**跨流迁移**（带着已产出的东西显式迁移并留痕），不是推倒重建。

## 依赖分档

- **硬依赖**（缺了输出就是错的）：`contract` 与 `breakdown` 依赖项目的最优图（`codegraph/best.json`，结构树：子系统=顶层领域）、契约图（`codegraph/target.json`，依赖方向与预算）与实例化清单。**存量项目**缺图时明说缺什么、降什么档，不静默假装有；**绿地项目不降档**——建图本身就是 contract 节点的法定产出。
- **软依赖**（缺了只是变钝）：其余节点在无图项目照常工作，对照类步骤降级为人工清单，**静默降档，不唠叨建档**。

## 红旗

| 念头 | 事实 |
|---|---|
| 「这个太简单，不用走节点」 | 简单需求的 spec 可以只有几句话，成本近零；跳过的从来不是仪式，是判据。 |
| 「我记得那个 skill 说什么」 | skill 会演进，调用读当前版本。 |
| 「先探索一下代码再说」 | spec 的事实调查、debug 的第 0 步正是探索——那是节点内的工作，不是节点外的。 |
| 「用户催得急」 | 急 = 走轻档，不 = 跳节点。 |
| 「级别判错了，重新建卡吧」 | 跨流迁移带着产出走；重建丢事件流，审计链断裂。 |
| 「有规则不让我做 X」 | 引出那条规则的原文和出处；引不出，它就不存在。 |

用户显式指令永远优先于本套件。
