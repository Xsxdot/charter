# 代码图扫描 schema 草案（C12 配套）

**状态**：草案，待走查后随 C12 进 contract 冻结 · 2026-08-25
**配套原型**：`prototypes/codegraph-two-axis/`（真数据驱动）

---

## 0. 一句话

**机械层交给工具，语义层留给 AI。**今天的问题不是「AI 扫得好不好」，是 AI 在假扮机械层。

## 1. 分层（这条线图里早就划好了，只是执行错位）

| 层 | 内容 | 谁产出 | 落在哪 |
|---|---|---|---|
| **机械层** | 节点清单、`file`/`line`/`signature`、doc 注释转录、调用边、**控制流** | **工具**（`go/ast` + `go/types` + `x/tools/go/ssa`） | `baseline.json` |
| **语义层** | 领域归属、一句话职责、不变式、**状态机** | AI / 人 | `best.json` · `target.json` · `domains/*.json` |

扫描配方第 12 行已经写死了这条线：「`target.json`、`domains/*.json` 和 `best.json` 都是人工维护的应然声明，扫描期间一律只读」。**缺的只是机械层那一半也该由机器做。**

### 1.1 为什么必须换（实测账，非推测）

| 日期 | 实测 |
|---|---|
| 2026-08-23 | `cmd/` 下 50 个源码文件里 **9 个零节点**（7 个是上一轮全量扫描就漏的）；`handoff card` 族 **24 个命令一个 entry 节点都没有**——而 `validate` 全绿，下游 gap 少报约 18% |
| 2026-08-24 | 文件级自检通过的前提下仍在漏符号，被迫再加一道符号级自检（B231） |
| 2026-08-24 | 5 个 TS 节点把 `/** */` 整段抄进 `summary` |
| 持续 | 6 个空容器（上轮扫描残骸）留在图里 |

配方自陈根因：「**工具查不出漏建**。`stale` 是图→盘，`check` 的 `outside-file` 只看已经在图里的文件，**没有任何判据是盘→图方向的**」。

**162 个入口里 137 个只有一条出边**，也是这个病：不是代码只有一跳，是扫的时候没往下走。AST 遍历不会发生这种事，两道人工自检也就可以退休。

### 1.2 工具能到哪、不能到哪

| 数据 | 工具 | 判定 |
|---|---|---|
| 函数/方法/struct 清单、`file:line`、`signature`、doc 注释 | `go/ast` + `go/parser` | 精确，零漏 |
| 跨包符号解析（治「同名不是证据」） | `go/types` | 精确 |
| **if / switch / for 控制流** | `x/tools/go/ssa` 的 CFG | 精确 |
| 调用边 | `x/tools/go/callgraph`（CHA / RTA / VTA / pointer） | 精度可选档 |
| 领域归属、职责、不变式、状态机 | — | **工具做不了，留给语义层** |

先例在库内：`graph/codegraph/decls.go` 与 `edgegate.go` 已经在用 `go/ast` + `go/parser`，
且 `edgegate.go:180` 立先例的理由就是「用 `go/parser` 的 ImportsOnly 模式而非正则：注释与字符串里的路径不会误入」。

TypeScript 侧对等物是 TS Compiler API / ts-morph，成熟度略低，按同样分层套用。

## 2. 机械层新增：`flows` 段

`baseline.json` 新增顶层键 `flows`，**additive-only**（不改任何现有键，旧消费方不受影响）。

```jsonc
"flows": {
  "n_agentd_Manager_Dispatch": {
    "steps": [
      { "id": "s1", "order": 1, "kind": "call",   "to": "n_store_Store_GetTask", "line": 142 },
      { "id": "s2", "order": 2, "kind": "branch", "cond": "task.State != proto.StatePending",
        "line": 145, "then": ["s3"], "else": ["s5"] },
      { "id": "s3", "order": 3, "kind": "call",   "to": "n_agentd_Manager_transit", "line": 147 },
      { "id": "s4", "order": 4, "kind": "return", "line": 150 },
      { "id": "s5", "order": 5, "kind": "loop",   "cond": "for _, a := range adapters",
        "line": 153, "body": ["s6"] },
      { "id": "s6", "order": 6, "kind": "call",   "to": "n_agentd_Manager_adapterFor", "line": 154 }
    ]
  }
}
```

**字段**：

| 字段 | 必填 | 说明 |
|---|---|---|
| `id` | 是 | 函数内唯一 |
| `order` | 是 | 有序——**这正是今天 `edges` 缺的东西**（4728 条边全是无序二元组） |
| `kind` | 是 | `call` / `branch` / `loop` / `return` |
| `to` | `call` 必填 | 被调节点 id；必须是已定义节点 |
| `cond` | `branch`/`loop` 必填 | **源码条件原文**，不做归一化——归一化是语义判断 |
| `line` | 是 | 与真实代码一致 |
| `then`/`else`/`body` | 分支/循环必填 | 子步骤 id 列表 |

**边界**：`flows` 只建**承重函数**（跨域入缝符号、入口 handler、编排单元），不建全部 3629 个节点——全建等于把 SSA 原样倒出来，人看不懂，体积也不可控。承重判据见 §4。

## 2b. 接口调用点：图上展示接口，实现另开一张图

走查第 5 屏定的（2026-08-26）。流程图撞上「接口 → 实现」时：

- **节点展示接口**——代码里写的就是接口，走到哪个实现是运行期由注册表/装配决定的。
  图上替它猜一个具体实现，就是把运行期事实伪装成静态事实。
- **右栏列出全部实现**，每个实现的入口就是那个实现的流程图起点，点进去换一张图。

`flows` 里只多一个标记，**不内联实现清单**：

```jsonc
{ "id": "s14", "order": 14, "kind": "call", "to": "n_executor_Adapter_Start",
  "line": 994, "iface": true }
```

| 字段 | 必填 | 说明 |
|---|---|---|
| `iface` | 否 | 为真表示 `to` 是接口方法，本调用点是动态分派 |

实现清单从**已有的 `implements` 段** join 出来，不在 `flows` 里复制一份——复制的那份必然
先烂掉。`implements` 今天就有（`[string, string][]`，v0.5.0 起在库）。

**这一条把 §7 第 1 项的未决收窄了**：既然流程图要的就是接口本身，`callgraph` 那一档
不需要为「把接口调用解析成具体实现集」买单——CHA 的「接口即接口」正好是这里要的形态。
精度档位的取舍回到它本来的战场（跨函数可达性），与流程图无关。

**顺带一个读数**：一个接口有 N 个实现、这 N 张流程图骨架相同细节不同时，就是模板方法
没抽出来的债。实测：`executor.Adapter` 四个实现的 `Start` 都是「① 裁决 socket ② 写任务
物料 ③ 起进程 ④ 起事件循环 ⑤ 投首轮」，抄了四遍。这个对比只有把四张流程图并排才看得出来。

## 3. 语义层：状态机填充

`CgDomainDecl.stateMachine?: CgTransition[]` **格位今天就在**（`graph/webui/src/api/types.ts:17`），
数据 **0 条**——现存两份声明（`d_orchestration`、`d_workspace`）都没写，而全项目只有 2/23 个域有声明。

它只能人工声明：`lifecycle` 只记「谁写了哪个字段」，记不了状态值（全项目写 `state` 字段的只有 1 条：
`Store.UpdateTaskState → Task`；`Card` 有 4 个 writer 全写 `status`）。

本草案对它只加**一条约定**：

```jsonc
{ "from": "pending", "to": "running", "anchor": "internal/agentd/manager.go#Manager.transit" }
```

`anchor` 指向**写这次迁移的符号**（`file#Symbol` 符号锚，行号会漂）。加了它，原型早就定下的那条互证关系才可机械执法：

> 状态机的每条迁移边 ≙ 流程里某个 ✎ 步骤——两张图互为印证

即：`stateMachine[].anchor` 指向的符号，必须出现在该域某条 `flow` 的 `call` 步骤里，
且该符号在 `lifecycle` 中是对应实体的 `writer`。**三处对不上就是声明与代码不符。**
这条闸今天上不了（两边数据都缺），随本草案落地后开启。

## 3b. 语义层：容器职责（走查中发现的缺口）

容器在 schema 里**没有职责字段**——`CgContainer` 只有 `label` / `kind` / `entry` / `domain`
（`graph/webui/src/api/types.ts:6`）。而查看器要在图上直接显示每个容器的职责。

**今天能推导的只有一类**：「类型方法」容器 = 同名类型节点的 doc 注释，覆盖 **100/100**。
陷阱：类型节点住在同包的**实体**容器里，不在「类型方法」容器里，**必须按包匹配**——
按名字全局取首个同名会张冠李戴（实测：`opencode.Adapter` 一度拿到了 claudecode 的注释）。

**「函数组」「实体」类容器推导不出职责，也不该推导**——它们没有主体，这正是「说不出职责」的字面
意思。界面写「无职责主体（函数组）」，不硬凑。实测：执行器适配 40 个容器中 28 个有职责、
12 个没有（6 函数组 + 6 实体），**没有职责的那 12 个正好是「说不出职责」的那一批**。

**本草案的处置**：不给容器加职责字段。理由——能推导的那类已经有真数据（doc 注释），
推导不出的那类**不该有**职责，加了字段只会诱导人给兜底桶编一个假职责。
真要改善，方向是拆包/拆类型（B232 / B233），不是加字段。

## 3c. `packages` 段：这份基线没有

`CgGraph.packages`（目录 → 包 doc 摘要）是 v0.6.0 的 additive-only 键（B231），
但 handoff 现役 `baseline.json` **没有这个段**——它是那之前的扫描产物。
所以群组框今天只有包名和容器数，没有包摘要。重扫即有，不需要改 schema。
（另一条佐证：这份基线连 B228「基线落后于 main」都还没解。）

## 4. 折叠判据：不需要人工标注

原型 `order-flow-demo.html` 定下「步骤 = 行为（编排函数），**工具函数不入图**」。
「哪些是工具函数」看似语义判断，其实**可机械判定**，判据与真假共享内核同源：

```
噪声（折叠，不占泳道名额）：
    step.kind == "call"
    且 to 所在容器的 kind ∈ {"函数组", "TypeScript 函数组"}   ← 兜底桶
    且 to 的复用度 ≥ 10                                      ← 被十个以上程序入口可达

行为步骤（展开）：
    step.kind == "call" 且 to 跨领域   ← 同时是递归下钻的入口
    step.kind ∈ {"branch", "loop"}
```

「复用度」= 该符号能被多少个程序入口可达，从现有边即可算出，无需新数据。

**实测有效**（原型已验证）：`d_orchestration` 领域页按复用度排序时，前五条泳道
全是 `writeJSON`(73) / `isForwarded`(47) / `forwardURL`(45) / `truncateRunes`(33) 这类工具函数；
套上判据后前五条变成 `Store.GetTask`(23) / `Store.MirrorTaskTarget`(16) /
`Store.ListProjectLocations`(16) 这些真契约入口，5 条噪声折进可展开块。

同一个判据的另一半用于分辨共享内核：高复用度落在**实体/类型方法**容器 = 正当共享内核
（`Config` 123、`Target` 76、`ExecutorConfig` 68）；落在**兜底桶** = 假复用
（`writeJSON` 73、`Redact` 69、`isForwarded` 47）。

## 5. 顺带修掉的两个建模缺陷

**5.1 入口容器打架**（roadmap 28）。配方 `:314` 规定「入口分 CLI/HTTP/WS 三容器」，
`:257` 又要求「入口容器挂到它服务的领域上」。一个 `c_http` 只能挂一个域，于是 72 个端点
（至少横跨 6 个领域）全部记在 `d_gateway` 名下。改配方即可修，代码零改动。

**5.2 入口只建一跳**。162 个入口里 137 个出边为 1、8 个为 0。AST 遍历自然修复。

## 6. 迁移路径（不推倒重来）

1. **工具与 AI 并行跑一轮**，对同一提交产出两份 `baseline.json`，逐段 diff——差集就是 AI 扫的漏建清单，也是换工具的收益证据。
2. **机械层切工具**，AI 扫描配方**只保留语义层**（`best.json` 归属建议、包摘要转录复核）。两道人工完整性自检退休。
3. **`flows` 段按承重函数增量补**，不要求一次铺满；查看器读不到就走降级形态（原型已实现该降级并在界面显式标注）。
4. **状态机声明随卡增量补**（roadmap 1a 同批），补一个域开一个域的互证闸。

## 7. 未决（走查时定）

1. ~~`callgraph` 用哪一档~~ **部分已定（2026-08-26，§2b）**：流程图侧要的就是接口本身，
   不需要为解析实现集买单。剩余取舍只关跨函数可达性（`chain`/触达域读数），倾向 VTA。
2. `flows` 的「承重函数」范围一次定死还是按域增量声明。
3. TS 侧是否同批上工具，还是先只切 Go 侧（Go 占 baseline 节点的绝大多数）。
4. 工具产出的 `summary` 只能转录 doc 注释；**没有注释的符号 summary 留空还是交回 AI 补**——留空更诚实，补写更好看。
5. ~~`best.responsibility` 的归属~~ **已裁（2026-08-26，用户）：走甲**——归声明文件唯一所有，
   `best` 去掉该字段，21 个无声明领域界面显示「未声明」。落地三条见 §8.1。

## 8. `best.json` 这一侧：四条要定的，一条要你裁

前面几节只动了 `baseline.json`（机械层）。`best.json` 是另一半契约，走查里暴露的问题都在这
一侧，逐条如下。**现状读数全部取自 handoff 仓 `codegraph/best.json`（23 领域 / 232 容器）。**

### 8.1 `responsibility` 双写漂移 —— **已裁：走甲（2026-08-26，用户）**

同一个领域的职责正文写在两个地方，**而且两处文本不一样**：

| 领域 | `best.json` | `codegraph/domains/<id>.json` |
|---|---|---|
| `d_orchestration` | 「为协调者把一次派发从 pending 推进到终态：状态机迁移与 CAS、工单审批、事件留痕与实时分发、断线回收与状态对账、以及这一切的 SQLite 持久化。」 | 「为协调者保存任务、工单、事件和执行回合，并推进它们的合法状态迁移。」 |
| `d_workspace` | 「…把 git 与文件系统的现实隔离在协作语义之外。」 | 「为任务提供项目登记、工作树准备、分支同步、跨机器镜像和工作台启动项配置。」 |

viewer 两边都读：`BestScopePanorama.tsx:207` 与 `BestDetail.tsx:125` 读 `best`，
`BestDomainPage.tsx:40` 读 `decls`。**同一个领域在同一套界面里有两个不同的职责说法。**

两条路，代价不同：

- **甲（干净）**：`best.json` 只留结构——`id / label / parent / type`，**职责正文归领域声明文件
  唯一所有**（架构法第五条：规则归数据所有者）。代价：23 个领域里 21 个没有声明文件，
  会立刻失去职责文本，界面上大面积「未声明」。这个代价是**真实债务的显形**，不是新增损失。
- **乙（过渡）**：`best.responsibility` 保留，但降级为「结构树上的一句话定位」，
  界面上必须与声明区分显示，且**声明存在时以声明为准**；同时加一条闸：两者都在且语义冲突
  无法机械判定，只能靠人。等于把漂移合法化。

**裁决：甲。**`best.json` 的 `domains[].responsibility` 字段**移除**，职责正文归
`codegraph/domains/<id>.json` 唯一所有（架构法第五条）。随之落地三条：

1. `CgBestDomain` 去掉 `responsibility`；viewer 三处读它的地方（`BestScopePanorama.tsx:207`、
   `BestDetail.tsx:125`，以及 `BestDomainPage.tsx:40` 已读 decl）统一改读 `decls`。
2. 领域**没有声明文件**时，界面显示「未声明」并给出该写哪个文件的路径——**不回退到任何
   兜底文本**。23 个领域里 21 个会立刻空出来，这是真实债务的显形，不是新增损失。
3. 迁移不丢字：现有 `best.responsibility` 的 21 段正文**逐条搬进**对应的
   `codegraph/domains/<id>.json` 作为初稿（两处都有的以 decl 为准，best 那段作废）。
   搬运是一次性机械动作，不是新写声明——补全不变式与状态机仍是后续的活。

### 8.2 容器只挂叶子领域 —— 写成不变式并加闸

两轴导航的地基：**一个领域要么有子领域、要么有容器，不能两样都有**（否则「由什么组成」
这一格答不上来）。现状实测 **0 违例**（20 个叶子领域接住了全部 232 个容器），
但这条**没人写过、没人查过**——今天成立是运气，不是约束。

裁决：写进 `best.json` 的不变式，并在 `ValidateDecls` 旁加同级检查，违例即 fail。

### 8.3 入口归属：不改 `best` schema，改扫描配方

现状：162 个入口全塞在 5 个容器里（`c_cli` 86 / `c_http` 72 / `c_ws` 2 / `c_main` 1 /
`c_web_main` 1），而 `best.containers` 是**容器粒度**的映射，于是 86 个 CLI 入口整体归到
`d_cli`、72 个 HTTP 入口整体归到 `d_gateway`。原型实测：其中 **122 个（75%）逻辑上属于
别的子系统**。

**不给 `best` 加节点级映射**。根因在扫描配方自相矛盾：`codegraph-scan-recipe.md:257` 说
「入口容器挂到它服务的领域上」，`:314` 又说「入口分 CLI/HTTP/WS 三容器」。以 `:257` 为准，
删掉 `:314`；入口容器按服务领域拆开之后，`best.containers` 现有形状原样就对了。

**加节点级映射是打补丁**——它会让 `best` 出现两种粒度，从此每个消费方都要处理两条路径。

### 8.4 容器 `kind` 是受控词表，不是自由字符串

三条债读数全部 key 在 `container.kind` 上：兜底桶占比、噪声折叠判据（§4）、真假共享内核判据。
今天它是自由字符串，**扫描侧改个词，三条读数一起哑掉且不报错**。

现状词表（8 个值 / 232 容器）：

```
类型方法 100 · 函数组 44 · 实体 41 · TypeScript 模型 23
React 组件/函数 21 · 入口 5 · TypeScript 函数组 4 · TypeScript 实体 1
```

裁决：钉成受控词表；**未知 kind 必须显式报错，不得静默降级**——静默降级正是「看起来完整的
假读数」（用户故事 9）。「兜底桶」的定义随之钉死：`函数组` 与 `TypeScript 函数组` 两个值。

### 8.5 入口的 `channel` 要成为字段，不靠名字猜

入口清单按 CLI / HTTP / WS 分组，今天 `CgNode`（`kind: 'entry'`）**没有 channel 字段**，
只能从 id 前缀或 name 形状（`handoff card add` vs `GET /api/tasks/{id}`）猜。猜法能用是因为
命名恰好一致，不是因为有契约。

裁决：entry 节点加 `channel` 字段，additive-only，受控词表 `cli | http | ws | web`。

### 8.6 一张表：两个文件各自管什么

| | `baseline.json` | `best.json` | `codegraph/domains/*.json` |
|---|---|---|---|
| 谁产出 | 工具（扫描） | 人 | 人 |
| 管什么 | 现状事实：节点、边、容器、实现、投影、**flows** | 理想结构树：领域 id/label/parent/type + 容器归属 | 领域语义：职责、不变式、生命周期、状态机 |
| 职责正文 | — | 见 8.1 裁决 | 见 8.1 裁决 |
| 本轮新增 | `flows`（§2）、调用点 `iface`（§2b）、entry `channel`（§8.5） | 不变式：容器只挂叶子领域（§8.2） | `stateMachine.anchor`（§3） |
| 本轮**不**新增 | 容器职责（§3b）；`packages` 已在（§3c） | 节点级入口映射（§8.3——改扫描配方，不改 schema） | — |
