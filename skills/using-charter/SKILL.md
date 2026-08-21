---
name: using-charter
description: 会话开始时建立流程纪律——任何开发任务动手前先定位它在流程中的节点并调用对应 skill。由 SessionStart hook 全文注入。
---

# Using Charter

你装载了 charter 套件：契约先行、分域并行的开发流程。流程中的每个节点是一个 skill。

## 规则

**动手前先定位节点。**任何开发请求——新功能、修 bug、重构、评审——先判断它处于流程的哪个节点，调用对应 skill，再开始工作。哪怕只有 1% 的可能某个节点 skill 适用，也必须先调用确认。

## 节点地图

```
triage（定级路由）
  ├─ L1 小修 ──────────────→ plan → implement → review → acceptance → finish
  ├─ L2 单域功能 → spec ───→ plan → implement → review → acceptance → finish
  └─ L3 跨域协作 → spec → contract → breakdown
                     ├─ 轻档：单轮 implement → review → acceptance → finish
                     └─ 重档：各域并行(plan→implement→review) → integrate → finish
```

横切法（被各节点引用，不占流程位）：`architecture-law`（架构法）、`defect-families`（缺陷族法）。

## 依赖分档

- **硬依赖**（缺了输出就是错的）：`contract` 与 `breakdown` 依赖项目的目标图（`codegraph/target.json`）与实例化清单——缺失时**明说缺什么、降什么档**，不静默假装有。
- **软依赖**（缺了只是变钝）：其余节点在无图项目照常工作，对照类步骤降级为人工清单，**静默降档，不唠叨建档**。

## 红旗

| 念头 | 事实 |
|---|---|
| 「这个太简单，不用走节点」 | 简单任务走 L1 只有三个节点，成本近零；跳过的从来不是仪式，是判据。 |
| 「我记得那个 skill 说什么」 | skill 会演进，调用读当前版本。 |
| 「先探索一下代码再说」 | triage 的定级两问正是靠探索回答的——那就是节点内的工作，不是节点外的。 |
| 「用户催得急」 | 急 = 走轻档，不 = 跳节点。 |

用户显式指令永远优先于本套件。
