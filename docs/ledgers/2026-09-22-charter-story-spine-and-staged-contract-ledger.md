# 台账：故事脊柱、分阶段契约与集成后验收

**日期**：2026-09-22；最近修订 2026-09-23（r3 skill 第一阶段）

**对应 spec**：`docs/specs/2026-09-22-charter-story-spine-and-staged-contract-spec.md`
**状态**：§1–6 为 r1 历史、§7 为 r2、§8 为 r3 设计修订、§9 为仓内 skill 第一阶段实施。当前设计以 spec r3 为准；尚未修改现役 workflow、账本纪律或两机安装。

## 1. 用户裁决与问题演进

1. 用户确认现象：大功能虽拆子卡，但无法一次达到初始目标；收尾出现大量补修卡。
2. 用户指出核心未知：只有真机才能暴露的行为无法被领域切分、契约先行、原型和流程图消除；执行中原型/流程图会被搁置，且用户失去对模型行为的理解。
3. 用户确认方向：以最重要用户故事为持续真源，并在扇出前验证。
4. 用户质疑现役 contract：若先做竖切会写很多代码；要求 contract 产精确接口/签名可能过早，且未观察到架构收益。
5. 用户授权开始修改 Charter；本轮先按 `charter:spec` 硬门形成正式设计，未提前实现。

## 2. Charter 现状证据

### 2.1 Workflow 时序矛盾

执行：

```text
jq '.states, .gates, .nodes' flows/charter.workflow.json
```

事实：

- `review.next = acceptance`
- `acceptance.next = integrate`
- `integrate.next = 图对账`

而 `skills/integrate/SKILL.md` 的交棒原文语义是「合并只是 acceptance 的入场券」「下一步：acceptance」。因此 workflow 与节点正文相反，L3 重档父卡在集成后没有最终 acceptance 位置。

### 2.2 Contract 同时承担精确化、骨架与竖切

`skills/contract/SKILL.md` 当前要求：

- spec 语义翻成精确签名；
- target/best 图冻结；
- Ticket 0 空壳与编译；
- 重档在扇出前写「一次真实调用、返回写死但接线真实的结果」。

最后一项能证明接线存在，不能证明用户故事、权威状态和真实环境成立；若把它加强到真实用户故事，contract 就会变成一个没有 plan/review/acceptance 分工的实现节点。

### 2.3 驾驶手册复制了旧顺序

`/Users/xushixin/.codex/skills/product-backlog/SKILL.md` 当前路径写为：

```text
待办→spec→contract→breakdown→plan→implement→review→acceptance→integrate→图对账→finish→已完成
```

其 L3 重档段要求父卡在 breakdown 后停驻 integrate，子卡 review 后完成，父卡 integrate 后直接图对账/finish；同样缺集成后的最终 acceptance。因此只改 Charter 仓的 workflow 不足以让新法可驾驶。

## 3. B358 样本核验

执行：

```text
wc -l /Users/xushixin/workspace/handoff/docs/superpowers/specs/*b358*
rg -n "外部.*订阅|初始.*seat|card.*close|listening|Ticket 0|时间线" \
  /Users/xushixin/workspace/handoff/docs/superpowers/specs/*b358*
```

读数：

- `b358-contract.md`：565 行；
- `b358-breakdown.md`：386 行；
- contract 已声明 Ticket 0、直通竖切与冻结；
- breakdown 首轮仍发现并处理：
  - 外部会话订阅通道缺签名（R1）；
  - 初始席位/卡收口 timeline 载体需补；
  - `listening` 词表存在但生产零调用方；
  - Ticket 0 `sessionTimeline` 用全量卡表判断归属，造成跨会话污染，原测试只断言非空。

这组证据不说明 B358 的 contract 写得不认真；恰好相反，它说明在缺少真实故事先行时，继续增加契约行数不能替代生产行为发现。

## 4. 方案推演记录（2026-09-22 r1，非现行裁决）

### 4.1 保留在 contract 内

否决。真实故事会让 contract 写大量业务代码；硬编码返回又不构成有效行为证据。节点职责无法同时成立。

### 4.2 Wave 0 做父卡的前置子卡

否决。纪律复用最干净，但引入「子卡分支如何成为 contract 与所有 Wave 1 子卡的共同基线」的新问题；现役卡模型只有一级子卡，且 product-backlog 未定义前置子卡基线晋升语义。

### 4.3 单一复合 spine 节点

暂不选。它会把计划、实现、自审、验收压回同一上下文，用户仍只能看到模型连续发现并解决问题，无法在关键转折处判断偏航。

### 4.4 四站式 Wave 0

选为 spec 推荐方案。用一个横切 `story-spine` skill 规定共同不变量，计划/实现/审查复用既有节点正文，人工脊柱验收形成用户可见闸门。代价是 L3 重档多四个状态；以三张真卡的数据判断是否过重。

## 5. 工作树边界

执行：

```text
git status --short --branch
```

读数：`master...origin/master`，既有未跟踪目录 `.zcode-plugin/`。本轮未读取、未修改、未纳入任何补丁。

## 6. 本轮变更

- 新增本 spec 与本台账。
- 未修改任何 `skills/` 正文。
- 未修改 `flows/charter.workflow.json`。
- 未运行 `scripts/regen_discipline.py`。
- 未覆盖本机 handoff workflow / discipline。

当时的交棒是请求批准 r1 第十一节；该“四站式”请求已由后续审查与 r2 修订撤回，不再作为待批事项。

## 7. r2 修订（2026-09-23）

### 7.1 授权与范围

用户先要求审查 spec，再追问“plan是否过重？”，最后指令“ok,修改spec吧”。本轮修订 spec，并同步本台账和 roadmap 观察项；没有把文档修订扩大为修改 skill、安装、迁移卡或发布。

### 7.2 本轮核验依据

- `git status --short --branch`：`master...origin/master`，仅 `.zcode-plugin/` 和本次 spec/ledger 为未跟踪；未发现重叠修改。
- `nl -ba skills/plan/SKILL.md`：第 23–25 行要求完整代码块、精确签名、2～5 分钟动作，第 65 行要求跨 plan 签名逐字符对齐。r2 把这些预写/重复要求列为删除项，保留行为验收和边界约束。
- `nl -ba scripts/regen_discipline.py`：第 4–6 行明确权威消费面是账本，写本地 OUT 不代表安装。r2 修正了“regen 即生效”的口径。
- `nl -ba docs/roadmap.md`：第 49⑤ 条记录核原型摘要而非页面的实际事故。r2 增加原型版本、页面状态与实际对照证据。
- 读取现役 product-backlog：条件边通过人工 move；产文档节点的 produces 路径是精确匹配；卡钉 workflow 版本。这些事实仅支持设计试点，不证明重复进入、纪律版本和旧卡兼容已经验收。

### 7.3 审查处置

1. plan 瘦身作为全路径改造，交接保留目标、边界、顺序、验收和决策权限；Wave 0 不复用旧重型要求。
2. spec 列全已承诺故事；第一条竖切按价值与承重未知选择，不机械限制一个失败用例。
3. 原型/流程图作为版本绑定的验收依据，不能只读摘要；中途裁决用用户结果解释后果。
4. 冻结前形成简短协作分工草案，breakdown 再落正式子卡；轻档不要求 Wave 0 证据。
5. 撤回 O 作为独立冻结理由：观察结果归证据，冻结理由限实际协作或外部兼容。
6. 故事是交付单位，子系统是代码责任单位；允许工程卡独立技术验收，由明确责任者集成故事。
7. 撤回四个新增状态的强制要求。先在隔离环境检验既有节点的阶段复用；失败后再凭证据设计必要增量。
8. 补共同基线、证据失效、重复进入、失败续接、真实安装、多 harness 生效与旧卡版本边界。
9. 效果观察增加首次演示、完整交付、人工裁决、返工和流程等待口径；不凭卡数/文档长度宣布效率提升。
10. 修法自身改判 L3 轻档：正文/生成/驾驶手册不构成可独立扇出的子系统；重档是方法应用对象，不是本次修法必然档位。

### 7.4 产物与验证边界

- spec 更新为 r2，末尾给出逐项审查处置索引。
- roadmap 第 65 条记录真实卡效果观察，第 66 条记录节点复用的机制验证及条件性后续。
- 本轮只核文档结构、引用与规则矛盾；未运行 handoff 真实流程，未把计划中的验收写成已通过。

### 7.5 文档检查结果

- `git diff --check -- docs/roadmap.md`：退出 0，无输出。
- 对新增 spec/ledger 运行 `git diff --no-index --check -- /dev/null <文件>`：清理两处 Markdown 行尾空格后无空白告警；退出 1 表示与空文件有差异。
- Node 只读检查本地链接、代码围栏、一级章节和 roadmap 引用：退出 0，原始输出 `Document checks passed: links, fences, 11 sections, roadmap 65/66.`。
- 人工复核 r1 残句：四列与 O/P/X 仅留在撤回说明及标为历史的台账中；现行前置条件明确区分轻档与 Wave 0，未混写安装完成或真实卡验证通过。

## 8. r3 修订（2026-09-23）

用户追问 Wave 0 是否会为赶演示写出错误架构，以及在先做真实竖切后 contract 是否还有意义，随后指令“OK，按照这个改吧”。本轮只修订设计文件与对应观察项。

- Wave 0 从 spec 已声明的子系统职责、权威状态和依赖方向出发；触及的生产路径须通过行为与物理边界双轴审查，演示成功不能覆盖新增越界调用。失败实验可废弃；通过的代码才进入后续共同基线。
- contract 改为条件节点：新增/变更独立工作单元共享的接缝，或新的对外兼容承诺，才进入冻结。既有稳定契约从一开始遵守但不重复冻结；同一工作单元内部演化且无新增对外承诺时跳过。新的外部承诺若是 Wave 0 的前提，先冻结该缝。
- L3 轻档允许 spec → breakdown；L3 重档允许 Wave 0 acceptance → breakdown。后续子卡基线为 Wave 0 已验提交，命中 contract 时再叠加冻结提交。
- 现役 `flows/charter.workflow.json` 的 `spec.next=contract`、`breakdown.gate.require_attachment=contract`、`breakdown.on_fail=contract` 与上述跳过路径冲突；r3 把条件分流、入口门禁、失败回退及必要的重复 contract 进入列为隔离试跑对象，不宣称现役引擎已支持。
- 同步 roadmap 第 65 条的架构/条件冻结效果观察与第 66 条的分流验证范围。未修改 skill、workflow 或安装，未运行真实卡流程；r2 的既往核验读数仍是历史，不把本轮文本修订写成机制已通过。

文档核验：`git diff --check -- docs/roadmap.md` 退出 0；对两个未跟踪文档各运行 `git diff --no-index --check -- /dev/null <文件>`，均无空白告警（退出 1 仅表示文件与空文件有差异）；Node 只读检查退出 0，输出 `Document checks passed: links, fences, r3 spec and roadmap references.`。本轮未验证 handoff 的条件分流或真实故事结果。

## 9. 仓内 skill 第一阶段实施与 workflow 双轨核查（2026-09-23）

用户指令先改仓内 skill，再讨论新建 workflow 还是更新版本、两机能否一新一旧。本阶段只修改 `skills/` 的 13 个节点/横切正文，并同步 spec 的实施状态；未修改 `flows/charter.workflow.json`、product-backlog、账本 workflow/template/discipline、现役安装或在飞卡。

- `using-charter`、`spec`、`architecture-law`：故事全集、Wave 0 的架构边界、条件 contract 与分档路由。
- `plan`、`implement`、`review`：五项轻量交接、真实生产竖切、行为与架构双轴审查；不再强制预写完整代码或逐字复制签名。
- `contract`、`breakdown`：仅为独立协作/外部承诺冻结，按已验基线拆出故事到工程卡及集成负责人的映射。
- `integrate`、`acceptance`、`finish`、`recon`、`debug`：分批故事闭环、集成后最终验收、无新冻结物时仍核架构与图、根因后的正确回退。

验证读数：14 个 `skills/*` 目录用 skill-creator 的 `quick_validate.py`（`uv --with pyyaml`）均报告 `Skill is valid!`；`python3 -m unittest scripts.test_charter_provision` 为 26 项通过；`scripts/regen_discipline.py --out <临时目录>` 生成 7 个纪律块；`git diff --check -- skills docs/roadmap.md` 退出 0。系统 Python 直接调用 quick_validate 缺 `yaml` 模块，改用 `uv --with pyyaml` 后完成校验；不把第一次失败说成正文缺陷。临时生成不等于账本安装或真卡通过。

只读查证：本机和 mac-02 的 `handoff status` 均指向同一 Postgres 账本，两端 `workflow list` 均为 `charter v12`，纪律清单也相同。handoff 源码显示建卡取该名字最新 workflow 并把版本写进卡；节点执行按卡钉版本找定义。但纪律和模板都在派发时按名字取最新版，派发快照才记录本次命中的版本。因此仅升级同名 `charter` workflow、或仅在一台机器安装新 skill，都不能保证共享账本上的旧卡与另一台机器完整执行旧法。新建并行 workflow 也会使原来“唯一工作流自动解析”的建卡路径变成必须显式指定 `--workflow`。`squad list --json` 还显示现役 `charter v12` 的 `pro`/`runner` 小队成员当前都在 linux-01，而非按本机/mac-02 自动分开；仅按机器安装 skill 不会改变现役派发选路。上述为版本与选路机制的只读证据，不代表新旧两轨已经试跑。workflow 命名、纪律命名、执行目标隔离与推广顺序待用户讨论后定案。

## 10. 独立审核后的定点修复（2026-09-23）

用户要求先由子 agent 审核，再指令修复。只读审核报告 4 项 Important、1 项 Minor；本轮逐条核对源文后修改，未把静态发现误称为真卡失败。

1. acceptance 的变异要求不再依赖每个 task 都预先声明“缝上的那支”：承重行为至少有真实消费入口或适用生产接缝的断言转红；内部锁不能独自证明生产路径覆盖。
2. breakdown 区分重档工程子卡 DAG 与轻档单轮工作单元；plan 明确轻档由协调者写交接，不为轻档强造子卡。
3. Wave 0 已验故事映射到父卡已验基线及最终回归负责人，后续子卡只承担仍待实现的故事；同步澄清 spec §6.4、plan 跨卡审计与 integrate 的生产闭环口径。
4. Wave 0 plan 头部标阶段、故事和 spec 修订；review 交棒带 plan 版本；Wave 0 验收后协调者在同一 plan 追加基线、分工草案和下一去向；重档最终验收由 integrate 交棒说明阶段、故事全集和计划版本。复核时发现 L3 轻档/L2/bug 不经过 integrate，acceptance 明确保留这些最终验收入口。
5. Wave 0 的真实入口到用户结果是整个阶段的完成条件，第一段允许先验证承重假设，避免与滚动 plan 自相矛盾。

本轮复跑：14 个 skill 的 `quick_validate.py` 均报告 `Skill is valid!`；`python3 -m unittest scripts.test_charter_provision` 为 26 项通过；临时目录中的 `regen_discipline.py --out` 生成 7 个纪律块；`git diff --check -- skills docs/roadmap.md` 退出 0。这些仅证明正文可解析、现有生成链与相关测试通过；没有修改现役 workflow、账本纪律、驾驶手册、安装或在飞卡，也未验证真卡行为。
