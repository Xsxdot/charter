# C12 spec 台账（2026-08-25）

本文只放过程与原始读数；裁决与结论在 `docs/specs/2026-08-25-codegraph-viewer-two-axis-spec.md`。

数据源：`handoff/codegraph/{baseline,best,target}.json`（handoff 仓 main 上的入库图）。
best.json：23 领域（12 顶层 = 子系统，11 子域）、232 容器归属。
baseline.json：3629 节点、4728 边、239 容器、130 lifecycle、378 projections。

## 读数 1：子系统入缝与容器收敛比

| 子系统 | 跨域入边 | 被调符号 | 落在几个容器 |
|---|---|---|---|
| 任务编排 | 336 | 152 | 6 |
| 协议契约 | 257 | 81 | 4 |
| 卡片账本 | 114 | 57 | 5 |
| 跨机连接 | 84 | 51 | 7 |
| 运行策略与配置 | 76 | 24 | 9 |
| 任务执行 | 45 | 28 | 10 |
| 安装与换版 | 35 | 18 | 6 |
| 项目与工作区 | 29 | 7 | 5 |
| 终端会话 | 20 | 17 | 5 |
| 控制门面 | 3 | 3 | 1 |

## 读数 2：入缝落在「函数组」兜底桶的比例

| 子系统 | 跨域入边 | 兜底桶 | 占比 | 其余分布 |
|---|---|---|---|---|
| 安装与换版 | 35 | 35 | 100% | — |
| 任务编排 | 336 | 242 | 72% | 类型方法 71 / 实体 23 |
| 任务执行 | 45 | 30 | 66% | 实体 15 |
| 运行策略与配置 | 76 | 47 | 61% | 实体 27 / 类型方法 2 |
| 终端会话 | 20 | 7 | 35% | 类型方法 10 / 实体 3 |
| 项目与工作区 | 29 | 9 | 31% | 类型方法 14 / 实体 6 |
| 跨机连接 | 84 | 18 | 21% | 类型方法 61 / 实体 5 |
| 卡片账本 | 114 | 4 | 3% | 类型方法 110 |
| 协议契约 | 257 | 1 | 0% | 实体 249 / 类型方法 7 |
| 控制门面 | 3 | 0 | 0% | 类型方法 3 |

## 读数 3：容器体量分布（作原子节点是否合适）

232 容器，符号数中位 6、p90 34、max 213。

| 区间 | 容器数 |
|---|---|
| 1-5 | 114 |
| 6-15 | 65 |
| 16-40 | 31 |
| 41-100 | 15 |
| 100+ | 7 |

超 40 符号的 22 个：k_agentd_fn(213/49 文件)、k_cmd_fn(196/46)、k_agentd_Server(188)、
c_cli(135/49)、k_prochost_fn(115)、k_proto_model(112)、k_ledger_Store(106)、
k_agentd_Manager(90)、k_web_api_types_model(87)、k_opencode_Adapter(84)、
k_web_app_workbench、c_http(72/1 文件)、k_web_api_client、k_client_Client、
k_agentd_model、k_web_app_task、k_store_Store、k_codex_Adapter、k_grok_Adapter、
k_claudecode_Adapter、k_grok_fn、k_codex_fn。

容器类别分布：类型方法 100 / 函数组 44 / 实体 41 / TS 模型 23 / React 组件 21 /
入口 5 / TS 函数组 4 / TS 实体 1。

## 读数 4：子系统内部的容器画布（以任务编排为例）

11 个容器、10 条容器间调用边、19 组出到外部子系统的边。

容器内边：k_agentd_fn 233 / k_agentd_Manager 135 / k_store_Store 19 / k_store_fn 14 /
k_agentd_Shutdown 5 / k_agentd_Hub 2；**k_agentd_model(62 符号)、k_store_model(8)、
k_agentd_pullTracker(5)、k_agentd_Approver(2)、k_agentd_DataDirLock(1) 内部零调用边**。

容器间前几条：Manager→fn 89、Manager→Store 67、Store→store_fn 45、Manager→model 40、
fn→model 24、Manager→Hub 18、fn→Manager 7。

出外部：fn→协议契约 40、Manager→协议契约 29、Store→协议契约 26、Manager→任务执行 21、
fn→项目与工作区 14。

## 读数 5：现状入缝排行是坏的（泳道画的是工具函数）

按入边数排「任务编排」的入缝 top5，并从每个入缝做 3 层域内 BFS：

| 入缝符号 | 入边 | 3 层内可达域内符号 | 横跨容器 | 触外部域 |
|---|---|---|---|---|
| writeJSON | 102 | 1 | 1 | 无 |
| truncateRunes | 9 | 1 | 1 | 无 |
| result | 8 | 1 | 1 | 无 |
| ledgerErr | 8 | 2 | 1 | 无 |
| Store.GetTask | 7 | 5 | 2 | 协议契约 |

现状取法比按边数排更任意：`inboundEdges.slice(0, 5)`，按边序取前五、不排序不过滤
（`graph/webui/src/app/codegraph/domainpage.ts:283`，配额定义 `:16`）。

## 读数 6：复用度（每个跨域入缝能被多少个程序入口可达）

438 个跨域入缝符号：

| 复用度 | 数量 |
|---|---|
| 0（无任何入口可达，死契约） | 21 |
| 1（只服务一个入口） | 230 |
| 2-5 | 125 |
| 6-20 | 23 |
| 21-60 | 30 |
| 60+ | 9 |

复用度 60+ 的九个及其容器类别：

| 符号 | 入口可达 | 容器 | 类别 | 判定 |
|---|---|---|---|---|
| Config | 123 | k_config_model | 实体 | 真共享内核 |
| Target | 76 | k_config_model | 实体 | 真 |
| writeJSON | 73 | k_agentd_fn | 函数组 | 假复用 |
| Redact | 69 | k_proxycfg_fn | 函数组 | 假复用 |
| ExecutorConfig | 68 | k_config_model | 实体 | 真 |
| DefaultPath | 67 | k_config_fn | 函数组 | 假复用 |
| Load | 67 | k_config_fn | 函数组 | 假复用 |
| Validate | 67 | k_proxycfg_fn | 函数组 | 假复用 |
| ApproverConfig | 67 | k_config_model | 实体 | 真 |

## 读数 7：入口层

162 入口 / 5 容器：c_cli 86、c_http 72、c_ws 2、c_main 1、c_web_main 1。
归属域：c_cli 与 c_main → d_cli；c_http 与 c_ws → d_gateway；c_web_main → d_web_shell。

出边分布：0 边 8 个（`handoff card`/`decision`/`discipline`/`graph`/`project`/`service`/
`template`/`workflow`，均为 Cobra 分组命令）、**1 边 137 个**、2 边 16 个、3 边 1 个。
——「每个入口必有一张流程图」在当前图上不成立，因为入口只建到 entry→handler 一跳。

CLI 命令族（15）：card 24、service 7、project 5、workflow 5、decision 4、discipline 4、
template 4、sessions 2、skill 2、agentd/attach/console/continue/diff/dispatch 各 1。

HTTP 资源族（17）：tasks 17、projects 9、workspaces 9、env 5、auth 4、machines 4、
discipline 4、update 4、workbench 4、pty 3、desktop 2、executor 2、
console/footprint/reclaim/status/root 各 1。

`c_http` 的 72 个端点实际服务的领域至少 6 个（/api/tasks→任务编排、/api/projects→项目与
工作区、/api/pty→终端会话、/api/machines→跨机连接、/api/discipline→运行策略、
/api/update→安装与换版），全部记在 d_gateway 名下。

## 读数 8：入口族触达域（行为轴首层 + 散度债）

| 入口族 | 入口 | 可达符号 | 触达域 |
|---|---|---|---|
| CLI agentd | 1 | 187 | 11 |
| HTTP /machines | 4 | 103 | 8 |
| HTTP /pty | 3 | 113 | 8 |
| HTTP /tasks | 17 | 326 | 7 |
| HTTP /projects | 9 | 140 | 7 |
| CLI project | 5 | 98 | 7 |
| HTTP /workspaces | 9 | 101 | 6 |
| CLI service | 7 | 80 | 6 |
| CLI card | 24 | 194 | 5 |
| CLI workflow | 5 | 62 | 5 |
| HTTP /update | 4 | 43 | 5 |
| HTTP /workbench | 4 | 21 | 3 |
| HTTP /desktop | 2 | 6 | 3 |
| HTTP /auth | 4 | 25 | 3 |

## 读数 9：递归性（外部入口 → 下层域入口）

| 外部入口 | 可达符号 | 下层域入口 | 横跨域 |
|---|---|---|---|
| GET /api/tasks/{id}/diff | 40 | 19 | 5 |
| GET /api/tasks/{id}/branches | 37 | 17 | 5 |
| GET /api/tasks/{id}/bundle | 37 | 16 | 5 |
| GET /api/tasks/{id} | 32 | 20 | 3 |
| GET /api/tasks/{id}/frames | 29 | 13 | 3 |
| GET /api/tasks/{id}/file | 28 | 13 | 3 |

## 读数 10：契约图的 entries 粒度

target.json v3：37 条契约，11 条带 `entries`，共 15 个 entry，**15/15 精确匹配容器 label**
（`ledger.Store`、`proto 实体`、`proto.Task`、`discipline（包级函数）`、`client 实体`、
`client.Client`、`ledgerstep.StepRunner`、`ptyhost 实体` 等）。assembly 3 项。

## 读数 11：图中不存在控制流

- edges 全部长度为 2 的数组（4728/4728），无顺序、无条件、无分支。
- node 字段全集：container、fields、file、kind、line、modelKind、name、order、params、
  projScanned、returns、signature、summary、tests、unscanned——无一与控制流相关。
- lifecycle 只有 `{who, model, kind: creator|writer, field?}`。
- implements 7 条、projections 378 条（`twin`），均为关联而非流程。

原型 `handoff/prototypes/codegraph-subsystem/pages/order-flow-demo.html`（281 行）的
`LANES` 是手写假数据，`steps` 为线性数组、无分支；其头部注释自陈「确认此形态后，作为
刀 6 流程视图（函数级）的布局基准」。

## 排除项与更正

- **排除「后端要改」**：`CodegraphResp`（`graph/webui/src/api/types.ts:87`）已带 best /
  target / report / decls，四层两轴所需数据齐备。
- **排除「跨仓契约要动」**：`handoff/web/src/app/codegraph/CodegraphFrame.tsx:19` 只传
  `?project=`，单向，查看器内部状态不经过它。
- **更正 C12 卡上「约 38 处零 className」**：该计数把 `<b>`、`<span>` 等本不需要 class 的
  内联元素也算进去，是噪声指标，不作严重度信号。真正裸的是领域页四个 tab 按钮与整个
  级联抽屉——而这两处在本轮重设计中都退场，该项自然消解。
