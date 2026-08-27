# C12 集成报告

> 日期：2026-08-27；节点：charter integrate；当前分支：`cards/C12-charter-7`
>；范围：合入审查子卡链与有效基线、双端全量验证、40 条冻结契约人工对照、残余账本与 acceptance 交棒。
>
> 结论：**集成分支就绪，下一步是 acceptance；真机清单 6 条待执行。**本报告的“通过”只表示本节点的合分支与机内验证通过，不替代真机 acceptance。

## 1. 合分支与祖先证据

按本卡补充要求执行了两次合并：

1. `git merge --no-ff cards/C12.6-charter-2` 首次实际出现冲突。原始冲突包括 `best_test.go`、`context.go`、`migrate_test.go`、`api/types.ts`、两轴页面组件、`besttree`、`flowpage`、`scopepage` 等；这与计划阶段“零冲突”预测不符。由于 `8f7f5ce1b` 已明确作废，冲突路径按审查链顶版本裁决。
2. 冲突解决后又检查到若干非冲突 `graph/` 文件仍来自作废提交；已将整个 `graph/` 树恢复为 `cards/C12.6-charter-2`，并修订合并提交。实测 `git diff --quiet cards/C12.6-charter-2 -- graph` 返回 0（输出：`graph tree matches cards/C12.6-charter-2`）。因此最终源码不是作废实现的拼接物。
3. 本地不存在用户给出的裸基线名 `claude/system-architecture-redesign-d01c32`；原始命令输出为：

   ```text
   merge: claude/system-architecture-redesign-d01c32 - not something we can merge
   ```

   使用已存在的远端引用 `origin/claude/system-architecture-redesign-d01c32` 完成合并，合并只修改 `docs/roadmap.md` 与 `docs/specs/2026-08-25-codegraph-scan-schema-draft.md`。
4. `git log --oneline --decorate --all` 实测同时可见 `d5b0721`、`a3ca540`、`e3a91b7`；`git merge-base --is-ancestor` 对 `d5b072157...` 与 `a3ca5409b...` 均返回 0。用户指定的 `894d02281` 对象不存在，实测原始输出为：

   ```text
   fatal: Not a valid object name 894d02281
   ```

   `git ls-remote` 也只返回基线分支 `a3ca5409b4dbfc6567c364219a208373d306e90c`，未返回 `894d02281`。因此不把 `a3ca5409b` 冒充为 `894d02281`；该引用缺口已列入残余账本。

最终合并提交为 `47b04ed`（子卡链与源码树对齐）及其后的基线合并提交；本报告提交后以最终 HEAD 为集成交付点。

## 2. 法定全量验证

### graph

亲跑命令：

```text
cd graph && go build ./... && go vet ./... && go test ./... -count=1
```

退出码 0，原始测试输出：

```text
ok  	github.com/Xsxdot/charter/graph/cli	0.184s
?   	github.com/Xsxdot/charter/graph/cmd/codegraph	[no test files]
ok  	github.com/Xsxdot/charter/graph/codegraph	0.021s
ok  	github.com/Xsxdot/charter/graph/webui	0.002s
```

### webui

亲跑命令：

```text
cd graph/webui && npm ci && npm run typecheck && npm test && npm run build
```

退出码 0；`npm ci` 输出 `added 168 packages`、`found 0 vulnerabilities`；typecheck 无错误；Vitest 原始摘要为：

```text
Test Files  16 passed (16)
Tests       203 passed (203)
```

Vite 原始摘要为：

```text
vite v6.4.3 building for production...
✓ 42 modules transformed.
✓ built in 653ms
```

构建按预期重写了入库 `graph/webui/dist` 的哈希文件；由于本轮红线明确“不改 dist”，已恢复 `dist` 到合并前版本并删除本次构建生成的两个明确新资产。最终 `git status --short --branch` 只输出分支行，无工作区改动。

charter 仓只发现 `graph/codegraph/testdata/repo/codegraph/` 下的测试夹具 `baseline.json`、`best.json`、`target.json` 和一个分支 diff，没有项目级真实图。因此没有生产项目的分支视图可做第二次对照；按 breakdown 的“仓根无项目图”规则跳过，不能伪造图对照读数。

## 3. 40 条冻结契约人工对照

证据口径：机检部分以 §2 冻结条目对应测试和上述全量结果为实测；`移交` 表示该条的扫描侧、handoff 仓或真机部分不在本仓，不能把 viewer 侧的消费实现写成全链路完成。

| 条目 | 实测裁决 | 证据与预测对账 |
|---:|---|---|
| §2.1-1 | 通过 | `Graph.Flows`/`CgGraph.flows?` 保持 additive-only；预测为类型与全量回归足够，实测双端全绿。 |
| §2.1-2 | 通过 | `FlowStep` 与 `CgFlowStep` 字段镜像存在，flowpage/FlowChart 测试通过；预测的字段透传闭环成立。 |
| §2.1-3 | 通过（消费侧） | Go 四个 `FlowStep*` 常量、TS 四值联合类型、未知步骤显式标记均存在；扫描侧非法值校验不在本仓。 |
| §2.1-4 | 通过（viewer） | `flowpage.ts` 从 `implements` join 实现清单，测试夹具覆盖接口实现；未复制 flows 清单。 |
| §2.1-5 | 移交 | 承重函数范围由扫描配方决定；viewer 对缺席入口走 degraded。未声称扫描覆盖率完成，残余落 roadmap。 |
| §2.1-6 | 部分：wire/消费通过，扫描移交 | `CgEntryChannel` 四值、scopepage 入口透传、RightPanel 分桶存在；真实扫描产出 channel 未在 charter 验证。 |
| §2.1-7 | 通过 | 缺 flows/channel 的降级双向断言、显式“通道未标注”与调用链提示通过 203 项测试。 |
| §2.2-8 | 通过 | `best.go` 无 `Responsibility`，序列化反向钉值测试通过；TS `CgBestDomain` 只保留结构。 |
| §2.2-9 | 通过（viewer） | `CgDomainDecl.responsibility` 是唯一 viewer 正文来源；best 结构不再有该字段。handoff 正文搬运移交。 |
| §2.2-10 | 通过 | `besttree.ts`/scopepage 读 `decls`；无声明时模型返回 undeclared，不从 best label 回退。 |
| §2.2-11 | 通过 | 结构轴渲染写入 `codegraph/domains/{id}.json`，测试锁住 no-declaration 与反兜底行为。 |
| §2.2-12 | 移交 | 旧 best 正文逐条搬入 handoff 的 decl 文件不在本仓；已在报告与 roadmap 逐条认账。 |
| §2.2-13 | 通过 | `ValidateBest` 的容器只能挂叶子领域检查保留，`best_test.go`/Go 全量通过。 |
| §2.2-14 | 通过（消费侧） | `CONTAINER_KINDS` 八值与 `FALLBACK_BUCKET_KINDS` 二值常量存在，判据不靠前缀。 |
| §2.2-15 | 部分：viewer 通过，扫描移交 | viewer 对未知 kind 输出 `unknown` 并计数、不静默进兜底桶；扫描侧显式拒绝器随重扫开启，未在本仓验证。 |
| §2.2-16 | 部分：形状通过，互证移交 | `CgTransition.anchor`、Go/TS anchor 字段与状态机空态文案存在；flows 与 lifecycle 的三方互证闸待真实扫描数据。 |
| §2.3-17 | 通过 | `scopepage.ts` 路径和应用内导出面存在；全量 typecheck/test 通过。 |
| §2.3-18 | 通过 | `deriveScopePage(input)` 冻结入口保持；scopepage 测试覆盖根/领域/容器模型。 |
| §2.3-19 | 通过 | 六字段输入与 `scopeId === null` 根层语义保持；未擅自加入 report，report join 留在装配层。 |
| §2.3-20 | 通过 | 根→领域→容器递归同构，容器原子无下钻；ScopeCanvas/页面穿线测试通过。 |
| §2.3-21 | 通过 | 组织切换位于独立 `data-organization-switch`，不在结构轴 `role=tablist`；反面断言通过。 |
| §2.3-22 | 通过 | 兜底桶占比、复用度、真假共享内核在 scopepage 输出并有数值断言；触达域散度已按 R1 归 flowpage。 |
| §2.3-23 | 通过 | `NOISE_FOLD_REUSE_THRESHOLD = 10` 仅在派生器；10→9 变异实测转红后复原。 |
| §2.3-24 | 通过 | >40 容器显示符号数/文件数/无声明职责与债务色；模型和 RightPanel 测试通过。 |
| §2.3-25 | 通过 | 无声明、无实体、无入缝各有显式格位；缺失数据不补假读数。 |
| §2.3-26 | 通过 | 同包类型 doc 注释匹配与函数组/实体“无职责主体”由 scopepage 测试锁住。 |
| §2.3-27 | 通过（viewer） | 孤立子系统原因与 projections 的非调用边标记存在；真实图数量未在本仓验证。 |
| §2.4-28 | 通过 | `flowpage.ts` 路径与应用内导出面存在。 |
| §2.4-29 | 通过 | `deriveFlowPage(input)` 冻结入口保持；flowpage 测试通过。 |
| §2.4-30 | 通过 | 输入仅 `baseline`、`entryNodeId`；一入口一模型，并由 203 项测试覆盖。 |
| §2.4-31 | 通过 | flows 缺席时 `degraded=true`，机械序列单独进 callChain，UI 明写“无次序·无分支”；degraded 反转变异实测 5 红。 |
| §2.4-32 | 通过（模型） | single/multi/none 三态、全部候选和无行为均有测试；真实 162 入口读数留 acceptance。 |
| §2.4-33 | 通过（模型） | 集中注册边界为单文件且入口数大于 3，flowpage 测试覆盖边界。 |
| §2.4-34 | 通过 | 入口族从名字形状计算，不依赖服务领域拆分；CLI/HTTP 夹具通过。 |
| §2.4-35 | 通过（机内形状） | FlowChart 测试覆盖矩形/菱形/卫语句/蛇形折列/紫框/双线框；真实浏览器视觉连续性留 acceptance。 |
| §2.4-36 | 通过 | UI 明确区分程序入口、对外入缝、泳道；右栏“对外面”免责声明与流程页调用链文案均存在。 |
| §2.5-37 | 通过 | `deriveDomainPage` 与旧载体退役，端口聚合进入 scopepage；最终 graph 树与子卡链顶一致。 |
| §2.5-38 | 通过 | `DomainCascadeDrawer`、`CallTree`、`FocusGraph` 等旧人视图退场；退役残留检查实测为 0。 |
| §2.5-39 | 通过（机内形状） | 迁移抽屉计数、四档债务色、三态配色、虚线 frame 均在组件/测试；真机视觉留 acceptance。 |
| §2.5-40 | 通过 | `classname-drift.test.ts` 8 项全绿；删一个触发按钮 className 的变异为 1 红后复原。 |

## 4. 接缝缺陷记账

集成阶段新发现缺陷数：**2 条协议/流程接缝；产品代码接缝 0 条**。两条均已记录，不用注释代替队列：

1. **合并冲突预判失真。**现象：指定 `git merge cards/C12.6-charter-2` 实际产生多文件冲突；根因是当前起点含作废 `8f7f5ce1b` 且与审查链顶分叉，计划台账沿用了“零冲突”拓扑假设；接缝：integrate 分支拓扑与作废轮退场接缝。处置：冲突路径接受审查链，随后全量 `graph/` 树与子卡链顶逐字对齐；最终 graph diff 检查为 0。
2. **基线祖先命名/可达性缺口。**现象：用户要求的 `894d02281` 对象不存在，裸本地基线名也不可解析；根因是仓库可见远端基线链只有 `a41b3226`→`e3a91b7e`→`a3ca5409`，与补充文本列出的 hash 不一致；接缝：基线 refs/协议记录与集成证据接缝。处置：合入可达的 `origin/claude/system-architecture-redesign-d01c32`，不把 `a3ca5409b` 冒充 `894d02281`，并把缺口列入 roadmap 46。

契约错配统计：**1 条**（第 2 条基线 refs 记录错配）；未发现 viewer wire 与当前审查链源码的产品契约错配。未处理缺口（扫描器、真 flows、stateMachine 互证、handoff 正文搬运、宿主联调、真机）已逐条写入 roadmap 36–46，现有 roadmap 27/32/33/34/29 作为相关总账交叉引用。

## 5. 回旋镖对账

| 计划阶段预测 | 集成实测 | 差异与校准 |
|---|---|---|
| 40 条冻结断言可由测试绿覆盖机检部分，人工清单核对移交边界 | graph 与 webui 最终树全量通过；40 条逐条完成，扫描/真机条目标为移交 | 判据预测成立，但不能把 viewer 绿扩大为扫描器/真机完成。 |
| 合并无冲突，源码来自审查子卡链 | 首次合并冲突，且非冲突作废源码残留；全树对齐后才满足源码来源约束 | 影响面预测错误。以后集成前需同时验证 merge-base 与整树来源，不能只看冲突列表。 |
| Go wire 同刀影响 context/migrate/fixtures，webui 退役会减少旧测试并补两轴测试 | 最终 graph 包全绿，webui 为 16 文件/203 测试，且 `graph/` 与子卡链顶一致 | 影响面方向成立；测试数量以实跑值为准，未用算术外推替代实测。 |
| 计划阶段未固定分钟耗时 | 本报告不伪造分钟差异 | 耗时预测仍为“未固定”，下轮若需要校准应在 plan 固定起止判据。 |
| 未作“无风险”承诺；真机/宿主/大图依赖 acceptance | 未作无风险结论；dist 构建副作用已清理，真机与宿主仍未验证 | 风险边界预测成立；新增的 refs 接缝风险已入账。 |

棘轮核对：本仓无项目级真实图，也没有亲跑到“存量直调下降”的读数，故本轮不调整接缝预算；不能用测试数量代替直调存量。

## 6. 交棒：acceptance 未执行

下一步：**acceptance，真机清单 6 条待执行**。以下每条当前状态均为“未执行”，不得以本报告的 jsdom/构建绿替代：

1. 真机打开查看器，走通结构轴“根→领域→容器”，核对一页按 scope 变、容器原子无详情页、箭头方向/空白/交叉和 `prototypes/base/README.md` 形态。
2. 真机走通行为轴“入口→流程图→接口→实现”，核对蛇形折列、紫框递归下钻、双线框接口与右栏全部实现。
3. 真实浏览器宽度/DPR 下拖动右栏分隔条，清 storage/隐私模式核对降级；核对键盘、读屏的 tab 与组织切换可用性。
4. 4000+ 边真实大图核对页面耗时、布局与交互流畅度，不填入推测读数。
5. 在 handoff 宿主 iframe 中核对 `?project=` 传参、宿主 best/decl 双写差异与 CodegraphFrame 单向传参。
6. 真 `flows` 数据到达后，核对 162 个入口的归属三态、注册散度、入口族、接口实现 join 与 stateMachine.anchor 互证；数据缺席时核对所有降级格位显式标注。
