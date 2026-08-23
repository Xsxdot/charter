# Spec：codegraph CLI 去噪与上下文装配器（chain 瘦身 + --with-source + context 领域包）

> 状态：**待用户批准**
> 级别与档位：**L3 轻档**（动契约：查询命令的默认输出形态变更 + 删一个 wire 死字段 + 新增子命令）→ contract → breakdown → 单轮 implement → review → acceptance → finish
> 卡：`C1.5`（父卡 `C1` 代码图批次二；从 C1.3 查看器刀拆出——两半的阻塞关系不同）
> 来源：`docs/roadmap.md` 第 10 条的「CLI 去噪与装配器下放」半边；2026-08-23 roadmap 前置讨论（用户原话：「agent 如果能直接拿到一个调用链，是不是就不再需要那么多轮次的调用了？甚至是直接拿到它想看的某些方法的源代码。关键是怎么才能真正的达到高效率」）

## 问题陈述

**图今天是索引，不是上下文装配器。**agent 按 skill 纪律「有图先查图」，得到的是一串符号与关系，然后还得回落去读源码——`sym` 定位、`who-calls` 溯源、`chain` 展开、再读三个文件，每轮一次来回。图明明知道结构，却把"把该看的东西凑齐"这件事留给了调用方。

而且它给的那串东西**很贵**。实测（handoff 真基线，从一个真实 hub 出发）：

| 查询 | 节点数 | 字节 | ≈token |
|---|---|---|---|
| `chain n_cmd_agentdCmd_RunE`（默认 depth 2） | 83 | **56006** | **~18.7k** |
| `chain n_agentd_Manager_Dispatch`（默认 depth 2） | 73 | 48777 | ~16.3k |

**一次默认查询吃掉一万八千 token，而里面 36~42% 是 `tests` 数组**，另有一整套 `params`/`returns` 与 `signature` 说的是同一件事（func 节点 `signature` 覆盖率 100%）。agent 付了 18.7k 的账，拿到的是"这条链上有 83 个符号"——想看其中任何一个函数到底怎么写的，还得再发一轮。

这两件事是同一个病的两面：**输出里该省的没省，该给的没给。**

## 现状读数（2026-08-23 实测，contract 节点须对当轮工作树复核）

| 读数 | 值 | 出处 |
|---|---|---|
| `chain` 算法 | 单向下游多源 BFS，`dist` 兼作 visited，环自然终止 | `graph/codegraph/query.go#Neighborhood`（`chain` = `graphQueryRunE(true,false)`） |
| `who-calls` | 同一函数体，反向邻接，`dist` 为负 | `graph/cli/cli.go#graphWhoCallsCmd` |
| **裁剪逻辑** | **零**。除 `--depth` 外无任何按 kind / 域 / 出入度 / 数量的裁剪 | `graph/codegraph/query.go#Neighborhood` |
| 结果节点形态 | `ResultNode{id, dist}` **内嵌整个 `ViewNode`**（= 整个 `Node` + status），全量字段吐出 | `graph/codegraph/query.go#ResultNode` |
| depth 默认 | 2，`0 = 不限`，**无上限**（`--depth 99` 直接透传） | `graph/cli/cli.go#init`、`#graphQueryRunE` |
| 字段填充率（3564 节点） | `signature` 90.9%（func **100%**、model 70.7%、entry 0%）、`summary` 48.1%、`params` 40.6%、`returns` 32.7%、`tests` 12.1%、`fields` 10.9% | 对 handoff 基线实测 |
| `params`/`returns` 冗余 | 信息在 `signature` 里已全有，func 侧覆盖率反而更低（52.9%/42.6%） | 同上 |
| `tests` 体积占比 | 去掉后 depth-2 查询 **−36%~−42%** 字节 | 同上 |
| `summary` 质量 | 中位 39 字符、最长 142，多为被截断的首句——**替代不了源码** | 同上 |
| `TestRef.Snippet` | **1518 条中 0 条非空**，全仓无任何写入方 = 死字段 | `graph/codegraph/types.go#TestRef` + 实测 |
| 包边界允许读源码 | package doc 只否认「产出数据」与「网络」；`Node` 注释明写「不存源码——消费方按 File:Line **实时读取**」 | `graph/codegraph/types.go` |
| 已有三处在读源码 | `sym.go#ReAnchor`、`stale.go#CheckStale`（带 per-file 缓存）、`resolve.go#ResolveAnchor` | 实读 |
| **窗口提取几乎白送** | `ReAnchor` 已经 `os.ReadFile` + `strings.Split` 把整文件切成 `[]string`，**只返回一个行号就把行数组丢了** | `graph/codegraph/sym.go#ReAnchor` |
| 现成行窗口函数 | **没有**。最接近的 `sym.go#findTokenLine` 只返回行号不返回文本 | 同上 |
| 输出层 | 唯一函数 `graphPrintJSON`（缩进 1 空格、不转义 HTML、写 `cmd.OutOrStdout()`）；**无 `--json` 开关**，JSON 是唯一形态 | `graph/cli/cli.go#graphPrintJSON` |
| **无任何体积机制** | 无 `--limit`、无分页、无字符/token 上限、无字段投影、无 kind/域过滤。两处硬编码 `[:5]` 只裁错误消息里的近似候选 | 全模块实测 |
| 既存缺陷一 | `--stale` 对**整张基线图**跑（`CheckStale(repo, g)` 传的是全图 `g` 不是结果 `r`）——`chain X --stale` 会把 3564 个节点的失鲜结果全塞进输出 | `graph/cli/cli.go#graphQueryRunE` |
| 既存缺陷二 | 输出 `Edges` 的收集循环只判两端在 `dist` 里，**不过滤 `Status == "deleted"`**（遍历阶段过滤了，输出阶段漏了） | `graph/codegraph/query.go#Neighborhood` |
| 新增子命令的改动面 | 五处：cli.go 命令 var + `init` 注册 + `graphResetState` + 包注释的「共 14 个子命令」+ `cli_test.go#TestGraphCommandCountIncludesMigrate` 的硬编码断言 | `graph/cli/` |
| agent 侧纪律出处 | 「有图先查图……`sym / who-calls / chain / domains`，未命中再 grep」 | `skills/spec/SKILL.md`、`skills/plan/SKILL.md` |

## 方案（含弃选与理由）

### 一、默认输出瘦身，`--full` 一键回到今天

**改的是默认值，这是本刀最有杠杆的一处**——agent 不会传它不知道的 flag，所以缺省即事实标准。

默认 `ResultNode` 只保留：`id` / `dist` / `kind` / `name` / `file` / `line` / `signature` / `summary` / `status` / **`domain`（新增派生字段）**。
去掉：`params` / `returns`（与 signature 重复）、`tests`（36~42% 的体积，且只有 12% 的节点有）、`fields` / `order` / `unscanned` / `projScanned`（model 的 `fields` 由 `entity` 命令负责）。
`--full` 恢复今天的全量形态，一个 flag 换回向后兼容。

新增的 `domain` 派生字段是**净增信息**：agent 拿到一条链，最想先知道的就是"这条链穿过了哪几个域"，而这个信息今天要再查一次 `domains` 才有。

**弃选：**
- **加 `--slim` 开关、默认不变**：默认不变 = 什么都没发生，agent 照旧付 18.7k。
- **`--fields a,b,c` 自选投影**：把决策成本转嫁给调用方，且每个 agent 选得都不一样，输出不可比。

### 二、三条折叠规则下放（原型里验证过的那三条）

| flag | 规则 | 出处 |
|---|---|---|
| `--fold-external`（默认**开**） | 焦点所在领域之外的节点，按领域折叠成一行 `{domain, count, 若干代表节点}`，不再展开其下游 | 原型「外部领域一域一节点」 |
| `--collapse-util`（默认**开**） | 被 ≥N 个不同领域调用的高扇入节点（工具函数）只出现一次并标 `sharedBy: N`，不展开其下游 | 原型「高扇入工具收桩」 |
| `--full` | 关掉上面全部折叠与瘦身 | — |

这三条是四轮走查里唯一**没有**被否掉的东西——用户的裁决是"视图语法留下，拐杖扔掉"：折叠外部领域、工具收桩不是给烂架构化妆，订单样例那种干净架构同样需要它们才好读。人在 UI 里省的滚动和 agent 省的 token 是同一笔账，所以规则下放到 CLI，而不是只活在前端。

**弃选：默认关、按需开。**同第一条：默认即事实。开着的代价是偶尔要 `--full`，关着的代价是所有人一直付全量。

### 三、`--with-source`：把"再读三个文件"那一轮吃掉

给每个未折叠节点附源码窗口：`{from, lines[]}`，以**重锚定后**的行号为准（`ReAnchor` 已有），per-file 缓存复用 `CheckStale` 的先例。窗口大小 `--source-span`（默认 40 行，上限 200，与 handoff 那两条只读 API 的既有口径一致）。

实现上这几乎是白送的：`ReAnchor` 本来就把整个文件读成了 `[]string` 然后丢掉，本刀要做的是**别丢**。

默认**关**（源码是按需的重资产），但一旦开启，预算机制（下条）自动生效。

**弃选：**
- **把源码存进 baseline**：直接违反 `Node` 注释的设计意图（"不存源码——消费方按 File:Line 实时读取，这同时是保鲜检测的抓手"），且基线立刻膨胀十倍、每次改代码都要重扫。
- **用 `summary` 当源码替代品**：实测中位 39 字符的截断首句，替代不了。
- **复用 `TestRef.Snippet` 字段**：它是死字段（0/1518），本刀顺手删（见第五条），不是复活。

### 四、`--max-tokens`：预算截断，且**永不静默**

默认 **30000**（`0` = 不限）。按 `dist` 由近及远填充，超预算即停，输出里必须带：

```jsonc
"truncated": { "atDepth": 2, "droppedNodes": 41, "reason": "max-tokens" }
```

token 用字节数近似（实测约 3 字节/token，代码+中文混合），报文里注明是估算。选 30000 的理由：今天默认 depth-2 的典型查询是 18.7k，不会被截断；只有开了 `--with-source` 或深挖才会触发——即"平时无感，炸之前拦住"。

**弃选：**
- **`--max-bytes`**：agent 关心的是 token 预算，让它自己换算是把认知成本推给调用方。
- **静默截断**：违反「no silent caps」——被截断却看起来像"就这么多"，比报错更坏。

### 五、`codegraph context <领域>`：一击式领域包

新子命令，回答「agent 想理解一个领域」这个整问题，等于今天 `domains` + 领域声明 + `chain` + `entity` 四发查询的合成：

```
职责与不变式（来自 domains/<id>.json 声明，含 testRef 与状态机）
生命周期锚（创建 → 终结）
对外接口清单（被别的领域调用到的节点）
主调用链前 N 级（默认带源码，套用上面全部折叠与预算规则）
实体表（本域 model，分种后只列真实体——依赖 C1.2）
```

未声明领域降级输出（只出机械层：接口清单 + 主链 + 实体），并指向 `domains/<id>.json` 与 roadmap 1a，不报错。

**弃选：**
- **做成 `--pack` 之类的 flag 挂在 domains 上**：输入是领域、输出是包，语义与 `domains`（列全部领域的统计）完全不同，塞在一起两边都变钝。
- **一次装配多个领域**：领域包的价值在"聚焦一个"，多个就退化成又一份全量转储。

### 六、顺手修三件（都在本刀正要动的那几行上）

1. **`--stale` 只对结果子集跑**，不再对全图跑（今天 `chain X --stale` 塞进 3564 个节点的失鲜结果——这条与本刀"省 token"的主题直接冲突，不能留）。
2. **输出 `Edges` 过滤 `deleted`**（遍历阶段过滤了、输出阶段漏了，`--view` 下会吐出已删边）。
3. **删死字段 `TestRef.Snippet`**（1518 条全空、无写入方），与 review M1 删 `Diff.loadNotice` 同族先例。**contract 节点须核**：handoff 前端 `web/src/api/types.ts` 是否声明了它、`prototypes/` 的数据生成器是否引用了它。

## 用户故事

1. 作为 agent，我发一条 `codegraph chain <入口> --with-source` 就拿到去噪后的调用链**和**每个函数的源码窗口，不必再 sym → who-calls → 读三个文件地来回。
2. 作为 agent，我发一条 `codegraph context <领域>` 就拿到这个领域的职责、不变式、对外接口、主链与实体——理解一个域从 5~8 轮变 1 轮。
3. 作为 agent，我什么 flag 都不传时拿到的也是瘦身过的结果，默认就省掉一半以上的 token。
4. 作为 agent，我的查询被预算截断时能从输出里看见"被截了多少、截在哪一层"，不会把残缺结果当全貌。
5. 作为人，我在 UI 里验证过好用的三条视图语法（外部领域折叠、工具收桩、只看该看的），在命令行里是同一套。
6. 作为工具维护者，`--stale` 不再把全仓失鲜结果塞进一次链查询。

## 契约语义与接缝（L3）

**动的契约面有三处，contract 节点逐条冻结：**

- **查询命令的默认输出形态**：这是 agent 与 skill 文档共同依赖的事实契约。变更方向是"默认瘦身 + `--full` 兜底"，语义必须写死：**`--full` 的输出与本刀之前逐字段等价**（除死字段 `Snippet`），这是向后兼容的唯一承诺。
- **新增派生字段 `domain`**：来源是节点容器的领域归属（`Container.Domain`），与 `domains` 命令同源；无 domains 段的旧数据输出空串，不报错。
- **删 `TestRef.Snippet`**：wire schema 收缩，需确认无消费方。

**语义决定（签名归 contract）：**
- **折叠是输出层的事，不是图的事**：`Neighborhood` 的 BFS 语义不变，折叠发生在结果装配阶段。这条保证 `--full` 永远能还原真相，也保证折叠规则将来可改而不动图算法。
- **源码读取不越包边界**：`graph/codegraph` 已有三处在读源码文件，package doc 也明示「一切输入都是本地文件」。本刀不改包的职责声明。
- **`context` 是组合命令，不是新数据源**：它不引入任何新的加载路径，只把既有的 `DomainTree` / `LoadDomainDecls` / `Neighborhood` / `EntityLookup` 拼起来。
- **预算是估算，不是保证**：报文里明说 token 数为近似值，避免下游把它当精确计量。
- **skill 文档同步是本刀的交付物之一**：`skills/spec/SKILL.md`、`skills/plan/SKILL.md` 的「有图先查图」段要教新命令与新默认，否则 agent 不会用——**工具落地而说明书没改，等于没落地**。

**接缝**：不新增跨进程接缝。charter/graph 与消费方之间的接缝仍是 CLI 的 stdout JSON。

## 实现决定

- 折叠与投影落**结果装配层**（`query.go` 的输出段或新文件），不改 `Neighborhood` 的 BFS。
- 源码窗口提取抽成包内函数（`ReAnchor` 与它共用文件行缓存），供 `--with-source` 与 `context` 复用。
- `context` 落新文件，只做组合，不新增加载路径。
- CLI 五处改动面（var / init / resetState / 包注释 / 命令计数断言）按既有清单办；命令数 14 → 15。
- token 估算函数写死在包内（与 fitness 阈值同款：不进配置，避免被调到"不截为止"）。

## 测试决定（接缝清单）

**最高的可测缝是结果装配这一层，测试预算落在这里：**

1. **结果装配纯函数**（主缝）：表驱动覆盖默认投影字段集、`--full` 等价性、外部领域折叠、工具收桩阈值、预算截断的 `truncated` 报文、边的 deleted 过滤。用现成的 `graph/codegraph/testdata/repo` fixture。
2. **`context` 组装函数**（次缝）：有声明 / 无声明两条路径，字段齐全性。

源码窗口用 fixture 仓的真实文件测（`testdata/repo` 已有 `web/task.ts` 等）。CLI 层只测 flag 绑定与命令计数。真机验收 = 在 handoff 真基线上跑同一组查询，**逐条记录改造前后的字节数**（现状基线已实测：56006 / 48777 / 26477 三个数），并做一次真实场景走查（用 `context d_ledger` 一发 vs 旧命令若干发，比较拿到的信息完整度）。

## Out of Scope

**永不做：**
- **把源码存进 baseline**（违反设计意图，基线膨胀且每次改码都要重扫）。
- **让 CLI 输出非 JSON 的人读格式**（`summary` 那一行是历史例外，不扩大）。

**本期不做、后续要做（逐条落 roadmap）：**
- **`who-calls` 与 `chain` 的双向合并**（`Neighborhood` 本来就支持同时给 up/down，今天没有命令用）。
- **按 kind / 域 / 文件前缀过滤查询结果**（`--kind func`、`--domain d_x`）——先看去噪默认够不够。
- **查询结果缓存 / 索引加速**（今天每次全量加载 baseline，handoff 量级 1.7MB 尚可）。
- **`summary` 命令与 SessionStart 的接线**：它的注释自称「供 SessionStart hook 注入」，实测 hook 注入的是 `using-charter` 全文，**从未调用它**——注释与接线不符，另立。
- **agent 轮次的量化统计**（ledger 侧统计同类任务的查询轮次）：本刀用字节数做硬判据，轮次作观察项。

## 备注

- **从 C1.3 拆出的理由**：查看器形态改造被 C1.1（对照数据）与 C1.4（代码位置）双重阻塞，而 CLI 这半边**不被结构性阻塞**——它今天就能做。两半捆在一起，等于让能跑的等着不能跑的。
- **与 C1.2 的关系是收益依赖，不是结构依赖**：领域画错时，`context` 打包出来的就是一份噪声包（217 个假接口那种）。所以本刀**可以先落，但真实收益在 C1.2 洗完数据之后才兑现**。卡上不挂阻塞边，备注写明。
- 本刀**不动一行业务代码**，也不动图算法；改的是输出层与说明书。
- 图覆盖债：charter 仓无自托管代码图，读数来自读码与对 handoff 真基线的脚本统计。
- **一处事实纠错留痕**：本轮探索中有一份 agent 报告称 `fitness.go` 的 `prefixFamilyFindings` / `oversizedPackageFindings` 是「未接线死代码」。已实测证伪——`graph/codegraph/check.go` 第 211~212 行明确接线，刀 3+4 的 fitness 判据正常生效。
