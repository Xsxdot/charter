# Breakdown：查看器对照刀·一期——理想树全景 + gap 读数上墙（C1.3，L3 轻档）

> **状态：出稿待拍板（2026-08-24）**
> 上游：spec `docs/specs/2026-08-24-codegraph-viewer-compare-spec.md`（头部已回写「已批准 2026-08-24」，已核）；
> 契约 `docs/contracts/2026-08-24-codegraph-viewer-compare-contract.md`（头部已回写「已冻结 2026-08-24」，已核）。
> 既定裁决（不重开）：主视角=理想树；切两期（本稿只拆一期）；报告宿主算（与契约闸同口径）；缺席分级降级；透传库类型。
> 档位说明：L3 轻档——下述「子卡」是**单轮 implement 内的工作单元序列**，不扇出独立卡；plan 节点按本 DAG 编 task。

---

## 〇之前｜协调者裁决（2026-08-24，拍板即生效）

| # | 裁决 | 理由 |
|---|---|---|
| 1 | **B**（新建 `BestPanorama` / `BestDetail`） | 采纳出稿者倾向。降级隔离是本刀的硬验收（无 best 项目零回归），靠「既有组件一行没改」证明远强于靠分支覆盖证明。手势抽 hook 一并做。 |
| 2 | **A**（纯 report/target 驱动，前端零边聚合） | 采纳。库行为已核实（check.go:106 `legacyHits` 只累加非窄缝非组装点边；`dead-contract` 仅在零活边时报），故「直调 0 且无 dead-contract」= 全走窄缝，可分辨，A 的信息损失不成立。附带办：spec 用户故事 3 补一行「实测调用数 = 直调数（走窄缝的合法调用不计）」。 |
| 3 | **A**（misplaced 读数归 best 应然归属侧） | 采纳。主视角是理想树，卡片语义统一为「离应然还差多远」；W3 详情面板双向都列，不丢信息。 |
| 4 | **A**（每请求现算，不缓存） | 采纳。既有 handler 每请求读盘 1.7MB，Check 是纯内存遍历，边际成本可忽略；缓存失效策略是新缺陷面，不预付。真机清单第 3 条量到超预期再回来议。 |
| 5 | **B**（非 baseline 视图回落现状域全景）**＋一条补充** | 采纳 B（口径不混、实现最小、与「对照面向主线」一致）。**补充要求**：回落时必须在视图区显示一行说明（如「分支视图暂用现状域全景——对照面向主线，per-view 对照见二期」），否则全景形态突变会被读成 bug。这行说明写进 W2 验收判据。 |

**附带回写项：准。**「查看器渲染用聚合类型属 webui 包内 API、不属 C5 镜像面」这条边界澄清，回写契约文档修订记录一行。

**执行形态**：L3 轻档，H1 / W1→W2→W3 在**单轮 implement** 内完成（不扇出独立卡）；跨仓两条线可并行。

---

## 〇、待拍板清单（协调者按此裁决，正文有展开论证）

**拍板 1｜理想树组件策略：扩展既有组件，还是新建 best 系组件？**
- A）在 `DomainPanorama.tsx` / `DomainDetail.tsx` 里加 best 分支：改动文件少，但把「现状域全景」「理想树全景」两套语义搅进同一组件（305 行 → 400+），两态测试矩阵交叉，降级路径靠分支保证。
- B）新建 `BestPanorama` / `BestDetail`（复用 `layoutDomains` 布局与平移/缩放手势——手势可抽成共享 hook 或先复制后抽）：文件多一倍，但每个组件单语义；「无 best 走老组件零改动」的降级验收最干净（现有用例不红即为证）。
- 出稿者倾向：**B**（降级隔离价值 > 手势复用成本；手势代码已是独立 useEffect 块，抽取成本低）。

**拍板 2｜连线「实测调用数」的数据来源与语义**
- A）纯 report/target 驱动：连线集合 = `target.contracts` 声明方向 ∪ report 里出现的方向（new-direction fails、legacyHits 键）；数字 = `legacyHits["from->to"]`（直调数）/ `legacyBudget`；`dead-contract` 方向画「未建成」。前端**零边聚合**，与 spec 实现决定「不在前端重新聚合边」字面一致。代价：某方向调用全走合法窄缝（entries）时直调数为 0，可能被误读成「没有调用」。
- B）在 A 之上，另按 `best.containers` 把 baseline 边聚合出「总调用数」（含走窄缝的合法调用），直调数括注。信息全，但引入前端 O(边数) 聚合与第二套口径。
- 出稿者倾向：**A**（单一事实源；「直调 0/预算 N」配 dead-contract 状态已可分辨「没调用」与「全走窄缝」——dead-contract 缺席即方向活着）。拍板 A 则建议在 spec 用户故事 3 补一行语义澄清（实测调用数=直调数）。

**拍板 3｜container-misplaced 读数归哪张卡**
finding 只带 `from`（容器 id），前端查 `best.containers[from]` 得应然归属、查 baseline 容器 domain 得现状所在，两侧都能归。
- A）归 **best 归属侧**卡片：「该来我这的还没来」——主视角=理想树的自然读法。
- B）归**现状所在侧**：「我这有个该走的」。
- 出稿者倾向：**A**；详情面板（W3）无论拍哪边都逐条列「现在在 X · 应归 Y」（spec 用户故事 4 本就要求）。

**拍板 4｜宿主 Check 的计算时机：每请求现算 vs 缓存**
- A）每请求现算：无状态、口径恒新鲜；现有 handler 本就每请求 LoadGraph 读盘 1.7MB，Check 是纯内存遍历，边际成本预计远小于既有 IO。
- B）按 mtime/commit 缓存：省 CPU，但引入失效策略（生命周期缺陷族新表面）。
- 出稿者倾向：**A**（延迟真值列真机清单第 3 条，实测超预期再回来议缓存，不预付复杂度）。

**拍板 5｜非 baseline 视图（diff 视图）下的主视角**
report 恒为 baseline 口径（契约 C3，一期不做 per-view 对照）。用户在下拉切到 diff 视图时：
- A）理想树恒为主视角：gap 读数固定 baseline 口径（角标注明「主线口径」），成员加改删徽标按所选视图算——两套口径同屏。
- B）非 baseline 视图自动回落现状域全景（理想树只服务主线对照），baseline 视图下才是理想树。
- 出稿者倾向：**B**（实现最小、口径不混；与 spec「对照面向主线」语义一致；二期做 per-view 对照时再抬）。

**附带回写项（拍板后办，不阻塞）**：边界澄清一条拟回写契约文档修订记录——「查看器为渲染定义的聚合类型（子系统卡、方向读数等）是 webui 包内 API，不属 C5 镜像面；C5 只冻结 wire 逐字镜像」。结论是「不退回 contract」，但按 breakdown 纪律澄清须落契约文档一行，防 review 冻结物触碰行对不上账。

---

## 一、触及子系统清单

| 子系统 | 仓库 | 类型 | 判定依据 |
|---|---|---|---|
| **d_gateway 控制门面** | handoff | **边界型** | `codegraph/best.json` domains 顶层，`type: boundary`（有图以图为准）。接缝对面是网络上的浏览器/CLI；httptest 伪造网络只验契约形状，真实 cookie 会话/反代行为归真机清单。 |
| **查看器（graph/webui）** | charter | **边界型**（人工判，无图仓库） | 见下方论证。接缝对面是浏览器与真实宿主数据；vitest+jsdom 机内验 DOM 结构与数据契约，渲染性能/视觉形态归真机清单。其内部纯函数层（domains.ts/graphmath.ts 系）测试可闭环——本拆解刻意把可闭环判据压进纯函数单元（W1）。 |

**明确不触及**：执法库 `charter/graph/codegraph`——handoff go.mod 已钉 v0.5.0（go.mod 第 7 行），本刀零库改动，所有库行为按契约「依赖库既成行为查证」四条引用。

**查看器的人工判（charter 仓无 codegraph/，按架构法第一条）**：
- 身份三判据：①只以契约面对外——对宿主是 `CodegraphResp` wire 镜像 + 构建产物（vite build），宿主不 import 其内部；②独立生命周期——独立 npm 包、`vitest run`/`tsc -b` 独立测试交付；③有消费者——浏览器用户与宿主 handoff（C1.7 将同源挂载）。三条齐 → 是子系统。
- 派卡资格四条：①有界文件集——`graph/webui/src/app/codegraph/**` + `src/api/types.ts`，路径规则一句话写得出；②契约面可枚举——消费 `CodegraphResp`（C5 镜像）+ `?project=` 页面入口；③依赖可排 DAG——单向依赖 wire 契约（已冻结），对 handoff 实现无依赖，可并行；④类型已标边界型。四条齐 → 可按子系统派工作单元。

## 二、契约增量核对（对照冻结物逐条）

上游状态位已核：spec 头部「已批准」、契约头部「已冻结」均已回写进文件（非会话记忆）。

| 冻结条目 | 本拆解是否越界 | 结论 |
|---|---|---|
| C1 透传库类型 | H1 只把 `Best/Target/Report` 序列化原文放进响应 map，零投影、零新类型 | 不越界 |
| C2a/b/c 缺席语义 | H1 的降级分支即实现此语义：`LoadBest` 返回 `(nil,nil)` → 三键全缺席；target/decls 失败 → 失败者与 report 缺席、best 照传、Warn 日志；「map 不放键」实现 | 不越界 |
| C3 报告口径 | H1 调 `Check(tg, best, Merge(g,nil), decls)` 与 `cmd/graph_gate_test.go#TestRepoContractGate` 逐参一致；W 侧视图切换不重取不重算（拍板 5 只影响 UI 呈现，不影响口径） | 不越界 |
| C4 归一化 | H1 对 `report.fails/warns` 为 nil 时归一 `[]`（仿 stale 先例）——注意库 `Check` 已初始化空切片（check.go:50），归一化是防御性双保险，测试仍须断言 `[]` 非 null | 不越界 |
| C5 消费方镜像 | Ticket 0 已落 `types.ts`，本拆解**不再改镜像结构**；W1 新增的聚合类型是包内 API（见待拍板附带回写项） | 不越界，附带一条边界澄清回写 |
| C6 兼容性 | W2 验收覆盖两级降级（三键全缺席 → 现状全景既有用例不红；有 best 无 report → 理想树照画 + 读数无数据态）；旧查看器兼容由纯增量性质保证，H1 测试②佐证 | 不越界 |
| C7 kind 词表 | W1 有「未知 kind 走缺省渲染不抛错」用例；横幅「与 CLI 同口径」对照时须排除 budget-raised（库级 Check 不产出，C7 已记），真机清单第 4 条落实 | 不越界 |

**新接缝需求：无**——全部工作落在已冻结的 `CodegraphResp` 缝两侧，无需退回 contract。

## 三、子卡清单 + 依赖 DAG

```
H1（handoff · d_gateway）───────────────────┐
                                            ├─→ 真机联调（协调者执行真机清单，非子卡）
W1 ──→ W2 ──→ W3（charter · webui）─────────┘

H1 与 W1~W3 跨仓可并行：W 侧 vitest fixture 依赖的是 C5 冻结镜像（Ticket 0 已落），
不依赖 H1 实现。W2/W3 均触碰 CodegraphPage.tsx，须串行；W1 是二者的纯函数前置。
W2、W3 依赖拍板 1/2/3/5 的裁决先落。
```

### H1｜宿主对照三键（handoff · d_gateway · 边界型）

- **契约引用**：C1（透传三键）、C2a/b/c（缺席语义）、C3（Check 同口径）、C4（归一化）；库既成行为 1/2/4（LoadBest nil-nil、LoadTarget/LoadDomainDecls 普通 error、库级无 budget-raised）。
- **意图与为什么**：把 best/target/report 装进 `handleProjectCodegraph` 响应——执法单一事实源在 Go 库，宿主算一次，查看器只渲染；降级为字段缺席 + Warn 而非 500，图数据残缺不拖垮整页（与坏视图跳过同策）。
- **验收（边界型：httptest 验契约形状；真实网络行为归真机清单）**：
  1. fixture 增补 `codegraph/best.json`、`codegraph/target.json`、`codegraph/domains/*.json`（testdata/codegraph-repo）后，`go test ./internal/agentd/ -run TestCodegraph` 绿，且：GET `/api/projects/demo/codegraph` 响应解出 `best/target/report` 三键；`report` 与测试内直调 `codegraph.Check(tg, best, Merge(g,nil), decls)`（同 fixture 参数）的结果 DeepEqual——**不许硬编码期望数字**，防 fixture 漂移假绿；
  2. fails/warns 为空的 fixture 下，响应原文含 `"fails":[]`（`[]` 非 null，C4）；
  3. 删除 fixture 的 best.json 后同请求返回 200，JSON 解成 map 后三键**无键**（非 null），baseline/views/stale 三样逐字段不变（C2a/C2c）；
  4. best 在、target.json 写成非法 JSON 时：200、`best` 键在、`target`/`report` 缺席（C2b）；
  5. 未知项目仍 404（既有断言不回归）。
- **入口指针**：`/Users/xushixin/workspace/handoff/internal/agentd/codegraph.go#handleProjectCodegraph`；`/Users/xushixin/workspace/handoff/internal/agentd/codegraph_test.go#TestCodegraphEndpoint`；`/Users/xushixin/workspace/handoff/internal/agentd/testdata/codegraph-repo/`；口径先例 `/Users/xushixin/workspace/handoff/cmd/graph_gate_test.go#TestRepoContractGate`。
- **有界文件集**：上述三处（codegraph.go、codegraph_test.go、testdata/codegraph-repo/**）。已核：改动收口单 handler，圈得出。

### W1｜理想树纯函数层（charter · webui · 边界型子系统内的可闭环内核）

- **契约引用**：C5（只消费 `CgBest/CgTarget/CgCheckReport` 镜像）、C7（未知 kind 缺省）；拍板 2/3 定聚合口径。
- **意图与为什么**：仿 domains.ts 的「纯算法层 + 组件只渲染」既有形态，新建 best 系纯函数文件（暂名 `besttree.ts`）：顶层子系统枚举（parent 为空）、`subsystemOf`（parent 链上溯，防环——对齐库 `best.go#SubsystemOf` 语义）、容器→子系统 join、卡片读数聚合（归属容器数 / misplaced 数 / 子领域数）、方向读数装配（declared 直调/预算、new-direction、dead-contract、[拍板 2B 时] baseline 边聚合）、横幅读数（fails 总数 / misplaced 数 / unplaced 数——按 warns kind 计数，与 CLI warn 行同口径）。先落纯函数是为了把边界型子系统里**能闭环的判据全部闭环在机内**，组件层测试只剩渲染。
- **验收（vitest 可闭环）**：`npx vitest run`（新增 besttree.test.ts）绿，且：
  1. 含嵌套领域的 fixture 下顶层子系统枚举只含 parent 为空者；`subsystemOf` 对嵌套域返回顶层、对成环坏数据不死循环；
  2. 卡片读数：fixture 的 misplaced finding 按拍板 3 口径归卡，归属容器数与 `best.containers` 分组一致，子领域数只计直接/全部子域（以拍板 3 随附口径为准，测试写死）；
  3. 方向装配：声明方向读出 `直调=legacyHits 值、预算=legacyBudget`；new-direction fail 产出「未声明」方向；dead-contract 产出「未建成」标记；
  4. `kind: "some-future-kind"` 的 finding 走缺省分类，不抛错（C7）；
  5. `tsc -b` 绿（类型只引 types.ts 镜像）。
- **入口指针**：`/Users/xushixin/workspace/charter/graph/webui/src/app/codegraph/domains.ts`（形态样板）、`/Users/xushixin/workspace/charter/graph/webui/src/api/types.ts`（C5 镜像）、语义对齐参照 `/Users/xushixin/workspace/charter/graph/codegraph/best.go#SubsystemOf`。
- **有界文件集**：`graph/webui/src/app/codegraph/besttree.ts` + `besttree.test.ts`（新文件，名字 implement 定）。

### W2｜理想树全景 + 执法横幅 + 二态分流（charter · webui）

- **契约引用**：C6（两级降级）、C3（读数恒 baseline 口径）；拍板 1（组件策略）、2（连线语义）、5（diff 视图回落）。
- **意图与为什么**：spec 用户故事 1/2/3/5/6 的渲染面。首层全景画 best 顶层 12 卡（label/responsibility/类型徽标），连线按拍板 2 口径着色（超预算红、new-direction 醒目告警）；全局横幅 fails/misplaced/unplaced；`CodegraphPage` 按「有 best 走理想树、无 best 走现状域」分流。形态沿用 `prototypes/codegraph-subsystem/` 已确认基准，对照读数是附加元素不改布局。
- **验收（vitest 验 DOM 结构；渲染性能/视觉归真机）**：
  1. 带 best/target/report 的 fixture 渲染出全部顶层子系统卡片，卡上有 label、responsibility、类型徽标文本与 gap 读数数字，横幅数字与 fixture 按 W1 口径逐数一致；
  2. 超预算方向与 new-direction 方向断言到可区分的 DOM 标记（data 属性或类名，行为化查询非快照）；
  3. 有 best 无 report 的 fixture：理想树照画、执法读数区出现「无数据」文案（C6 第二级）；
  4. 三键全缺席：`CodegraphPage.test.tsx` 既有用例全绿（现状全景零回归，C6 第一级——拍板 1B 下即「老组件零改动」之证）；
  5. [拍板 5B 时] 选中 diff 视图后断言回落现状全景；[5A 时] 断言「主线口径」角标存在；
  6. `tsc -b` 与全量 `vitest run` 绿。
- **入口指针**：`/Users/xushixin/workspace/charter/graph/webui/src/app/codegraph/CodegraphPage.tsx`、`DomainPanorama.tsx`（布局/手势基建：`layoutDomains`、pan/zoom useEffect 块）、`domainlayout.ts`。
- **有界文件集**：拍板 1B 下为新文件 `BestPanorama.tsx`(+test) + `CodegraphPage.tsx`(+test)（如抽手势 hook 另加一个新文件）；拍板 1A 下为 `DomainPanorama.tsx` + `CodegraphPage.tsx`(+各自 test)。两案都圈得出。

### W3｜子系统详情面板（charter · webui）

- **契约引用**：C5；拍板 1（组件策略）、3（misplaced 双侧列示）。
- **意图与为什么**：spec 用户故事 4——点开子系统卡见领域嵌套、归属容器清单；misplaced 逐条「现在在 X · 应归 Y」。与 DomainDetail 的「领域详情」平行：那个回答现状域，这个回答理想子系统。
- **验收（vitest）**：
  1. 点击子系统卡后详情区出现该子系统的子领域列表（嵌套 fixture）与归属容器清单（按 `best.containers` 分组）；
  2. misplaced fixture 逐条渲染出「在哪、该去哪」两个领域名；
  3. 既有 `DomainDetail.test.tsx` 不红（现状详情零回归）。
- **入口指针**：`/Users/xushixin/workspace/charter/graph/webui/src/app/codegraph/DomainDetail.tsx`（形态样板）、`CodegraphPage.tsx`（选中态接线）。
- **有界文件集**：拍板 1B 下为新文件 `BestDetail.tsx`(+test) + `CodegraphPage.tsx`；1A 下为 `DomainDetail.tsx` + `CodegraphPage.tsx`。圈得出。

## 四、缺陷族对抗审查（逐族正面回答，结论已并入各卡验收栏）

### d_gateway（H1）

| 族 | 回答 |
|---|---|
| 生命周期/状态机中断 | **无，因为**端点只读、无副作用、不落盘不起进程：请求中途 agentd 重启只断这条连接，无孤儿资源可回收。 |
| 静默失败/误导报错 | **命中**。C2b 降级天然制造「200 但缺数据」窗口——契约已把它定义为特性（分级降级），但两个配套必须钉死：①宿主侧失败必打 Warn 日志（H1 实现要求，含失败文件与 cause）；②查看器侧必须有显式无数据态（W2 验收 3），不许静默空白。另：`forwardIfRequested` 转发到旧版 agentd 时对端响应本就无三键 → 查看器按 C6 降级，不炸（真机清单 6）。 |
| 跨平台假设 | **无新增，因为**加载全走库 `LoadBest/LoadTarget/LoadDomainDecls(repoRoot)`，与现有 `LoadGraph` 同一套路径机制，handler 不新拼任何路径。 |
| 假红/假绿测试 | **命中并已对抗**：fixture 的 best/target 是手编数据，若测试硬编码期望读数，fixture 一改就假绿/假红——H1 验收 1 规定 report 断言与库级 Check 直调结果 DeepEqual（同数据同参，测试与实现共享事实源但不共享 handler 代码路径）。真实数据下读数正确性是行为事实 → 真机清单 4。 |
| 门禁绕过 | **无新表面，因为**不新增路由与写路径：三键长在既有 GET 端点的既有鉴权/转发链后面，门的覆盖面不变。无检查-动作窗口（只读）。 |
| 序列化边界（追加） | **命中**。链路：库类型 → writeJSON → HTTP → TS 镜像。Go 侧零手写投影（C1 透传即防御）；TS 镜像 C5 已冻结（Ticket 0）。穿真实序列化边界的测试 = H1 的 httptest 断言响应**原文**（验收 2 的 `"fails":[]` 按字节断原文，区分缺键/null/空数组三态）；W 侧 fixture 字面量须按库 JSON tag 逐字拼写，review 按 C5 对账。Edge `[from,to]` 二元组镜像已锁（types.ts CgFinding.edge）。 |
| 枚举新值过白名单（追加） | **命中**。kind 词表（C7）流经的唯一消费侧校验点是查看器着色分类——W1 验收 4 钉「未知 kind 走缺省」。宿主侧无 kind 白名单（透传），无通道分裂点。 |
| 承重安全属性（追加） | **无，因为**本刀不引入一次性/唯一性/隔离类属性：端点只读、无 token 语义；路径逃逸防线在 source 端点，本刀不触碰。 |

### 查看器（W1~W3）

| 族 | 回答 |
|---|---|
| 生命周期/状态机中断 | **无，因为**查看器无持久状态：useCodegraph 一次性取数不轮询，pan/zoom 监听器按既有模式在 useEffect cleanup 卸载（新组件沿用同款）；页面刷新即全量重建。 |
| 静默失败/误导报错 | **命中**。三处：①有 best 无 report → 必须显式「无数据」态（W2 验收 3），不许读数区留白冒充「零违规」——留白与 0 的混淆正是本族形状；②直调数 0 与「没有调用」的混淆（拍板 2 论证，dead-contract 标记做分辨）；③fetch 失败沿用既有 Placeholder 路径，不新增错误通道。 |
| 跨平台假设 | **无新增，因为**手势/滚轮代码沿用 DomainPanorama 既有实现（ctrlKey/metaKey、passive:false 的坑已踩平），新组件不写新手势逻辑。 |
| 假红/假绿测试 | **命中并已对抗**：vitest fixture 编码的是手造小世界——①断言一律行为化 DOM 查询（文本/data 属性），不用快照（快照是稳定假绿温床）；②fixture 行为假设的真机对应项已逐条入真机清单（大数据渲染=清单 1、真数据读数=清单 4、回退=清单 5）；③反面断言备齐：三键缺席时断「理想树元素不存在」，不只断「现状全景存在」。 |
| 门禁绕过 | **无，因为**查看器零写路径，取数走既有同源 cookie 会话的既有 client.ts 函数，不新增请求通道。 |
| 序列化边界（追加） | **命中**，与 d_gateway 侧同一条链路的消费端：见上表；W 侧义务 = fixture 逐字对 C5 + 可选键用 `?:` 区分缺失与空值（types.ts 已如此）。 |
| 枚举新值过白名单（追加） | **命中**：着色 switch 必带 default（W1 验收 4）；子系统 `type` 徽标同理——best.json 现值 logic/boundary，前端对未知 type 走缺省徽标（并入 W1 验收 4 同款用例）。 |
| 承重安全属性（追加） | **无，因为**前端不持有、不生成任何安全凭据；会话由宿主 cookie 承载，本刀不触碰鉴权面。 |

## 五、真机清单（机内验不了的行为事实；归协调者执行）

1. **未验证，需真机**：真实 handoff 数据（12 顶层子系统 / 233 容器 / 3656 节点 / baseline ~1.7MB + 三键增量）下 `?project=handoff` 理想树全景的渲染性能与布局可读性（12 卡 + ≤36 声明方向连线的视觉密度）。
2. **未验证，需真机**：vite 反代 agentd + localhost cookie 会话下端到端取数——三键真实到达前端、无鉴权/反代路径问题（`http://127.0.0.1:5174/?project=handoff`）。
3. **未验证，需真机**：每请求现算 Check 的真实延迟（预期毫秒级：纯内存遍历，且现有 handler 本就每请求读盘 1.7MB；拍板 4A 的前提数据）。
4. **未验证，需真机**：横幅/卡片/连线读数与 CLI `codegraph check` 真数据对照逐数一致——对照时 CLI 侧排除 budget-raised（棘轮层产出，库级 Check 不含，契约 C7 及查证 4）。
5. **未验证，需真机**：无 best.json 的真实登记项目回退现状域全景走查（200、无报错、无空白）。
6. **未验证，需真机（需双机）**：`?machine=` 转发到旧版 agentd 时三键缺席、查看器降级不炸（跨版本兼容的行为事实）。

## 六、图覆盖债

- charter `graph/webui`：**无图仓库**（既知，非本稿新债）——子系统类型按架构法人工判，已在第一节记录论证。
- handoff 侧：本稿引用符号（`codegraph.go#handleProjectCodegraph`、`graph_gate_test.go#TestRepoContractGate`、库 `best.go#SubsystemOf`、`check.go#Check`、`gap.go#bestGapFindings`）均直接读码核实并带文件出处，无图查询未命中项。

## 七、交稿自检（出稿者已核）

1. 产出四样齐全：子系统清单 2 项各带类型与判定依据；契约增量 C1~C7 逐条结论 + 新接缝「无」；子卡 4 张全四段式、判据行为化（跑 X 返回 Y）；缺陷族两子系统逐族有答案，「无」均带「因为」。✅
2. 待拍板 5 项 + 附带回写 1 项集中稿首。✅
3. 真机清单 6 条已汇总，均为行为事实类。✅
4. 有界文件集逐卡核过，均圈得出；无升格信号命中（新增文件个位数，无前缀家族/大包问题），无需插竖切还债卡。✅
