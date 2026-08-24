# Spec：查看器对照刀·一期——理想树全景 + gap 读数上墙（C1.3）

> **状态：已批准（2026-08-24，用户「批准」）**
> 级别/档位：**L3 轻档**（跨仓 wire 契约：handoff agentd ↔ charter graph/webui；单侧工作量不超流程固定成本）
> 来源：roadmap 第 10 条（查看器刀，吸收 1b）拆出的一期；二期残余见 Out of Scope。

## 问题陈述

C1.6 已把 handoff 的最优图（best.json 理想树 + 233 容器归属）与契约面（target v3，36 方向 + 预算棘轮）冻结进主线，执法闸也绿了——但这些成果**只活在 JSON 与 CLI 里**。查看器（charter `graph/webui`）今天渲染的是 baseline 的现状域全景，API（`CodegraphResp`）只传 `baseline + views + stale` 三样，理想树、契约面、gap 读数一概不可见。用户无法回答「我们做成什么样了」。

## 现状读数（contract 节点复核）

- 宿主 API：`internal/agentd/codegraph.go#handleProjectCodegraph` 返回 `{baseline, views, stale}` 三键 map，无 best/target/report。
- 查看器契约镜像：`graph/webui/src/api/types.ts` 第 26 行 `CodegraphResp { baseline; views; stale }`。
- 查看器主视图：`graph/webui/src/app/codegraph/CodegraphPage.tsx` 以 `?project=` 取数，领域全景按 **baseline 现状域**组织。
- 执法库：graph v0.5.0 `codegraph.Check(t, b, v, decls)` 返回 `Report{Fails, Warns, LegacyHits, BestCoverage}`；handoff go.mod 已钉 v0.5.0（C1.6 完成）。
- 契约闸同口径先例：`cmd/graph_gate_test.go#TestRepoContractGate`（LoadTarget/LoadBest/LoadDomainDecls + Merge(g,nil)）。

## 方案（含已拍板裁决与弃选）

**主视角 = 理想树（用户 2026-08-24 拍板，方案 1）**：首层全景画 best.json 的顶层子系统树，现状是每张卡片上的进度读数。弃选：以现状为主叠标注（gap 不成主角）；双联画（233 容器映射一屏塞不下，实现与阅读成本最高）。

**切两期（用户 2026-08-24 拍板）**：一期只做「理想树全景 + 对照 + gap 读数」；领域页双 tab、泳道、级联面板归二期。弃选：整刀全做（泳道/级联消费 baseline 语义数据，与对照视图在数据面正交，捆绑无互相成全）。

**形态基准**：沿用已确认的 `prototypes/codegraph-subsystem/` 全景形态（首层按子系统组织、类型徽标、聚合边——C1.8 后「子系统 = 理想树顶层」，原型形态与方案 1 天然同构）。对照读数是卡片/边上的**附加元素**，不改布局结构，默认不再走独立原型轮；用户批准本 spec 时可要求加做一轮原型。

## 用户故事

1. 打开查看器（`?project=handoff`），首层全景显示 12 个顶层子系统卡片（label/responsibility/类型徽标），布局即理想树。
2. 每张子系统卡片带 gap 读数：归属容器数、放错位数（container-misplaced 命中）、（有嵌套领域的）子领域数。
3. 子系统间连线显示实测调用数（= 直调数；走合法窄缝 entries 的调用不计入，2026-08-24 拍板 2）与契约状态：已声明方向按「直调数/预算」着色（超预算红），未声明方向（new-direction）醒目告警。
4. 点开子系统可见其领域嵌套与归属容器清单；放错位容器逐条列出（在哪、该去哪）。
5. 全局横幅显示执法总读数：fails 数 / container-misplaced 数 / 未归属容器数，与 `codegraph check` CLI 同口径。
6. 项目没有 best.json（如其他未建图项目）：查看器回退到今天的现状域全景，无报错、无空白。

## 契约语义与接缝（L3 段——只定语义，签名归 contract）

- **唯一承重接缝：`CodegraphResp` wire 契约**（handoff agentd 产出、charter webui 消费，跨仓单侧冻结）。增量语义：响应新增**可选**的三类数据——best 结构树（含容器归属映射）、契约面（方向/预算/窄缝，供边覆盖层）、执法报告（fails/warns/legacyHits/bestCoverage 镜像）。透传原文件还是裁剪投影，由 contract 节点按 v0.5.0 类型事实定。
- **报告由宿主算，查看器不执法**：agentd 在请求时调用库级 Check（与 TestRepoContractGate 同口径：baseline、Merge(g,nil)），查看器只渲染。理由：执法逻辑单一事实源在 Go 库，前端复算必漂移。
- **缺席即回退**：项目无 best.json 时新字段缺席（不是 null 错误），HTTP 200，老字段语义不变。旧版查看器忽略新字段——向后兼容是本契约的硬性质。
- **一期不做 per-view 对照**：视图切换不重算报告（报告恒为 baseline 口径），语义上「对照面向主线」。

## 实现决定

- 宿主侧改动收口在 `handleProjectCodegraph` 一个 handler；best/target/decls 加载失败降级为字段缺席 + Warn 日志，不 500（图数据残缺不拖垮整页，与现有坏视图跳过同策）。
- 查看器侧：全景组件按「有 best 走理想树、无 best 走现状域」二态分流；对照读数从报告字段直读，不在前端重新聚合边。
- 期一不动 `codegraph/diffs` 视图叠加逻辑与源码窗口功能。

## 测试决定（接缝清单）

- **宿主缝（主）**：agentd handler 层 httptest——①带 best 的项目：响应含三类新数据且报告读数与库级 Check 直调一致；②无 best 项目：新字段缺席、200、老三样不变。
- **查看器缝**：既有 vitest 模式——①有 best 数据时全景按理想树渲染且读数上卡；②无 best 数据回退现状全景（现有用例不红即为证）。

## Out of Scope

- **二期（落 roadmap 第 10 条余额，本期不做、后续要做）**：领域页双 tab（语义 tab：职责/不变式/状态机/生命周期锚；结构 tab：订单样例泳道 + 级联调用链面板）；1b 的 domains/*.json 声明 UI 消费；组织方式切换（按子系统/按领域）。
- per-view 对照重算（视图叠加下的报告口径）——等真需求。
- 响应体瘦身/按域取数（roadmap 11b，照旧另案）。
- C1.7 的宿主挂载（同源 webui.FS() + iframe 薄壳）——独立卡，本刀继续用 vite 反代开发态验收。
- 查看器展示 legacyHits 逐边明细、entries 窄缝清单编辑——永不做进查看器（编辑契约归 CLI/contract 节点）。

## 备注

- 走查否决项继续有效：DFS 调用链长墙、容器级聚合作主视图（roadmap 第 10 条）。
- 开发态查看路径已验通：vite 反代 agentd（localhost cookie 会话），`http://127.0.0.1:5174/?project=handoff`。
