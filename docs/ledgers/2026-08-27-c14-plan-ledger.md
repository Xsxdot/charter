# C14 plan 台账（2026-08-27）

> 卡：C14「查看器形态对齐 fork 原型：根层分层、摆放判据、容器职责、入口徽标」（L2，协调者亲写 plan）。
> spec：`docs/specs/2026-08-27-codegraph-viewer-form-alignment-spec.md`（已批准）。本台账与 plan 同批提交。

## 取证事实（全部亲跑亲查，非转述）

1. **③ 容器职责断点根因（实测定案）**：`scopepage.ts:513` 匹配条件 `node.name !== def.label` 恒不匹配——真数据
   （c12data，handoff main@92394f56，3636 节点）里「类型方法」容器 label 带包前缀（`agentd.Manager`），
   而 model 节点 `name` 是裸类型名（`Manager`）。实测 100 个类型方法容器 `name===label` 命中 **0/100**。
   model 节点 summary 覆盖 574/700，数据齐全，纯粹匹配键写错。既有测试未拦住的原因：respWorld 夹具
   （scopepage.test.ts:136-163）容器 label 用裸名 `Store`，与真数据形态错位。
2. **修法键型实测**：id 同构（`k_agentd_Manager` ↔ `m_agentd_Manager`）+ 目录校验 + summary 非空 = 94/100 命中；
   6 个落空全部有正当理由（3 个无 model 节点：codegraph.Target/discipline.Resolver/svc.Server；
   3 个非导出类型无 doc：engine.session/relay.relayAddr/relay.secureConn → 如实 undeclared）。
   label 裸名（`split('.')` 尾段）匹配 100/100 但 31 个裸名多候选——契约 §2.3-26「同名+按包匹配」的
   直译取 label 类型段 + 成员目录集合校验，歧义由目录校验收敛（同包不容同类型名）。**取契约字面键**，
   不发明 id 同构依赖。扫描器（generator=codex-codegraph-b231）不在本仓，id 形态是数据约定非本仓契约。
3. **渲染侧无断点**：RightPanel.tsx:88-100 已接三态职责渲染；缺口 = 推导键（本条 1）+ 卡面 duty 行整条缺席。
4. **④ 入口徽标口径**：契约 §2.4-33（c12-contract.md:83）「集中在 1 个文件且入口数 > 3 判集中注册标红」；
   flowpage.ts:59-66 `RegistrationDispersion{domainId,entries,files,concentrated}` 已导出同形状同判据，
   scopepage 侧复用该类型不另造词。原型卡面文案 `▣ N 入口` / `▣ N 入口 集中`（集中时 tagCls='bad'），
   仅根层（isRoot）显示（index.html:105-106,115-116）。mock 印证判据：43/1→集中、24/1→集中、3/1→否。
5. **48 外部端口原型形态（关键发现）**：原型任何一层**没有外部虚线卡**——跨层调出只在图例文字列表
   「调出到本层之外：协议契约 102 · …」（index.html:91；mock scopes[].ext=[{to,calls}]，nodes[] 里
   ext 节点数=0）。真实现 ext: 外部引用卡是 C12 继承 besttree 旧形态的自造产物，契约 §2.3 十七条
   （17~27）**未冻结 ext 卡形态**（逐条核对 c12-contract.md §2.3）。对齐方向：ext 卡退役，横跳可见性
   由图例文字列表承接；ScopeNode.external 字段、ringOuter 外圈、EXT_W/EXT_H 随之删除。
6. **孤立口径分歧（原型 vs 实现）**：原型 = deg 0（既不调也不被调，graph.js renderGraph 孤立集合 +
   index.html:124 注释「不排进 L0，否则等于谎称它们是最外层调用方」）；实现 ScopeNode.isolated = 无 call
   入边（scopepage.ts:579，scopepage.test.ts:252 钉死）。后果差异：纯调用方（如 d_cli 协调者命令面）
   原型进 L0 当最外层，实现被扔进孤立行。契约 §2.3-27 只冻结「如实呈现+标注原因」，口径数值未钉——
   按 spec 实现决定 2 取原型口径，既有断言同步改（plan 点名授权）。
7. **边色不偏差（49 条不偏离项确认）**：根层 37 条 call 边全 declared、边色单一为数据正确；契约冻结
   DirectionStatus 四态与 data-direction-status 接线（ScopeCanvas.tsx:183-197）保持不动，不换成原型
   budget 数值四档——分歧记卡（spec 实现决定 2 条款）。
8. **基线复跑（plan 落笔前）**：base worktree `graph/webui` `npm test` = 16 文件 / 203 支全绿
   （2026-08-27 13:49，2.63s）。既有夹具形态：scopelayout.test.ts 只走 layoutScopeCards 单入口硬编码期望；
   scopepage.test.ts 键集断言（:389-394）锁 ScopeNode 键——加 entryDispersion 字段需同步更新该断言。
9. **消费面盘点**（ext/布局改动的波及半径）：layoutScopeCards/EXT_* 唯一消费方 ScopeCanvas.tsx；
   node.external 另有两处 RightPanel.tsx:83（剥 ext: 前缀）、:229（「本层之外引用卡」标注）；
   besttree.ts:643-645 是其旧视图模型自留逻辑，不随本卡动（方向：scopepage 不再产 ext 节点后，
   ScopeCanvas/RightPanel 两处消费随之删除）。

## 派发前提修正（spec 实现决定 1 的机制更正）

spec 写「fork 原型 force-add 入卡分支携带」。本机派发下此动作多余且有害：managed worktree 只物化
tracked 文件，而执行者与 base worktree 同机，fork 原型在
`/Users/xushixin/workspace/charter/.claude/worktrees/system-architecture-redesign-d01c32/prototypes/codegraph-two-axis/`
直接可读。**更正为：零 git 携带动作，plan 直接给执行者原型绝对路径**；「finish 前移出携带提交」随之作废。
已在卡上以 correction note 留痕（见卡事件流）。

## 基线引用

- base 分支：`claude/system-architecture-redesign-d01c32`，HEAD = C12 finish 合并后链（含 368253707 合并、
  fdf50a1f2 dist 重建、58faea349 偏差更账、C14 spec 提交）。**本地领先 origin，未 push（用户裁决先不推）**。
- 工作树：全部改动在 base worktree 上做，主仓 master 不动。
