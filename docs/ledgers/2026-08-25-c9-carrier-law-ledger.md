# 台账：C9 载体法修法（spec 期）

> 本文件是卡 C9 的仓内台账。spec 期的调查过程与原始结论记这里，spec 正文只留裁决与结论。

## 2026-08-25 三路文档对齐审计（spec 前置事实调查）

三个独立 subagent 并行审计，基准 = README 六条设计原则 + spec/contract/breakdown 三节点 skill 正文；均按「纪律演进，早期文档不用后立的法追溯问责」执行（用 git log 核对各条款入法时间）。

### 审计一：charter 仓 docs/specs/（14 份）

判决：**整体一致**。要点：

- 14/14 头部有级别判决+批准回写（08-22 立法前的病彻底逆转）；OOS→roadmap 落账全线可对上；接缝清单形态随立法收敛（08-24 三款立法当天即被 charter-provisioning 与 C1.10 完整执行）。
- 长度 63→259 行的增长是读数驱动（现状读数表制度化），同期仍产 59 行合格短 spec（C1.9）——非八股膨胀。
- 具名瑕疵四处：①best-graph spec 流程倒置（contract 先行、spec 补写，有披露有口头批准）+ 头部「该修正待用户过目」悬空（此后零回写提交）；②C1.10 批准回写漏 L126「若获批」残句；③seam-budget 头部状态行（跳过 plan）与级别行（完整路由）并存；④「不写未来落点」持续轻度松动——C1.1 起实现决定段出现未来类型名/文件落点（「新类型 `TargetDomain`」、C1.5 逐文件指派），有「签名归 contract」兜底句但已过线。
- 内容层最大一次失误：C1.1 核心原语「目标域归属=路径规则」获批次日被用户整体推翻——纠错走了正规跨流取代通道，验证了「判决一次、判错显式迁移」设计。

### 审计二：charter 仓 docs/contracts/（10 份）+ docs/breakdowns/（8 份）

判决：**局部漂移，未系统性跑偏**。要点：

- 核心件（签名带出处、依赖库行为钉源码、对侧常量执法、可执行冻结、缺陷族实答、修订留痕）绝大多数文档在执行且自我加严（reconcile-fitness R10 反伪绿改述、packages 授权作废销账、webui §12 偏差坦白）。
- **漂移一（最实质）：breakdown 拍板回写/状态位失守**——C1.1 拆解三岔口裁决零回写（状态永停「待拍板」）；C1.4 拆解 P1/P2 裁决只活在会话而实现已发生；另三份（schema-v2、best-graph、viewer-compare）裁决回写了但头部状态行不更新。契约侧同款纪律（冻结即提交）近乎完美——失守集中在 breakdown 的自我状态管理。
- **漂移二：契约面 08-23 批次外扩为实现规格书**——条目数 15/16 → 37/38/86/73 → 13/8/7。best-graph 的条 39/74/76/79（私有函数删除清单、字典序、改名指令）、webui 条 21/5 是单包实现选择非接缝；08-24 已自发回摆。根子是「契约文档兼任 review 对账清单」的定位含混。
- **漂移三：原子化两头摆**——复合句残留（schema-v2 冻结 15/16、best-graph 条 67）与反向打包（viewer-compare C1 一条打包三键 wire 形状）并存。
- 漂移四：收尾自检（新鲜编译证据+欠账声明）执行不均——best-graph 整节缺失最重。
- 软信号：schema-v2 六岔口、viewer-compare 五岔口的协调者裁决全按出稿倾向（快速盖章形态）；对照 charter-provisioning（改哨兵名、另裁两条）的实质裁决。
- 反向趋势：缺陷族审查在加深不在退化（best-graph 拆解挖出 `checkNoDecls` 假绿单点；charter-provisioning 拆解产出 Go omitempty 实证并外溢开卡 B241）。

### 审计三：handoff 仓 docs/superpowers/specs/ 2026-08-22 起（21 份重点全读 + 19 份快扫）

判决：**整体一致**，19/21 合格或典范级。要点：

- 典范：executor-timing-contract（现状事实表+库行为量化+「欠账：无」）、custom-launchers-contract（Ticket 0 当场抓到两处契约错配并回写）、b205-contract（「判错了，不予冻结」原文留存审计链）、b239 spec（弃选五案+图覆盖债写「无，因为」）。
- 漂移一（已自愈）：08-22 过渡期约 6 份 spec 无批准状态行（b153/b163/b174/b175/b176/executor-timing design），08-23 起全部规范为「已批准+日期+用户原话」，零复发——该教训即 spec skill「批准即回写」条款的来源。
- 漂移二（已消失）：两份 08-22 breakdown 的单上下文降级声明凭空援引「未经用户要求不调 Agent」约束、未逐字引出处；08-23 起全部改走形态 2。
- 个案：**b185-contract 缺 Ticket 0 骨架、编译证据、交棒声明证据表**（「待实现清单（本轮不落码）」），同期其余 5 份 contract 全合规——个案非模式。
- 轻档 breakdown 吸收 plan 粒度（b185 指定测试函数名、b239 钉 TTL 落点）判为可辩护的形态适配（轻档路由无独立 plan 节点），均标「拍板时可否决」。
- 与旧时代（2026-08-07-handoff-design.md）对比：文档职能从「描述系统」换成「钉死判据与取舍」，不是换模板。

### 顶层诊断（三报告合并，进 spec 正文）

四处系统性漂移（breakdown 拍板留会话、契约吃实现规格、spec 吃 plan 落点、spec 吃 ledger 读数）同根因：**该类信息无唯一法定载体**。正面证据:残余→roadmap 立了载体后执行全套最扎实；spec 批准回写立状态行载体后近满分。

## 2026-08-25 spec 期补充读数

- 台账条款分布：contract/breakdown/plan/implement 四节点有「边干边落台账」，review 显式豁免（skills/review/SKILL.md:44），**spec 无**——漂移四是立法缺口。
- roadmap 载体条款分布：spec/acceptance/integrate/finish 四节点均有落 roadmap 条款。
- 分发通道：`scripts/regen_discipline.py` `compose_map()` 只发 7 个派发节点纪律块，横切法以附录拼接；spec/acceptance/finish 无纪律块；README 不进任何分发通道。
- 个案四处一手核实：C1.10 spec L126「推荐 A 若获批」残句在；best-graph spec L5「该修正待用户过目」在（git log 零回写）；seam-budget spec L3-4 状态行与级别行并存矛盾在；roadmap L36「C1.10 待批准」与 L75 17c「已裁决」矛盾在。

## 裁决记录（四岔口，用户 2026-08-25 逐条拍板）

1. 载体法总纲落点 → **README 设计原则第七条**（弃：新横切 skill、网关加节）
2. contract 冻结物边界 → **判据句 + 移交区**（弃：纯判据句、条目数上限）
3. spec 未来落点判据 → **可见性分界**（弃：临时命名标注、放开合法化）
4. spec 读数归置 → **补台账条款 + 裁决/过程分界**（弃：仅瘦身项、附录合法化）

## 2026-08-25 追加：用户两项指令与台账条款溯源核查

- 用户指令①：每次 skill 更新配检查方案（事后核奏效与负优化）→ 立为实现决定 G（README 修法自检三件套），C9 自带一份并落 roadmap 18c。
- 用户指令②：审查 handoff 执行者未经批准落地的台账条款（是否合适、该在源还是脚本）。
- 溯源核查（handoff 侧会话执行，结论已核对本仓 git log）：393d2d7a 改 skills/{plan,contract,breakdown,implement}/SKILL.md 各 +1 条「边干边落台账」（四份逐字相同）；f2b101eb 改 skills/review/SKILL.md +1 条「本节点不留台账文件」豁免；`regen_discipline.py` 零改动。
- 审查结论（进 spec 正文 H）：内容合格；落点正确——skills 正文是唯一真源、两个消费端（本地插件 + handoff 纪律块）都从它出发，条款进脚本则本地流程失明，且违反脚本头注「只做去 frontmatter + 附录拼接，不装正文」的自我声明边界。随 spec 批准一并追认。

## 2026-08-25 批准与移列（含一处顺手抓到的 handoff 缺陷）

- 用户批准 spec（含 G/H 与个案 2 过目确认），并裁决跳过 plan 直接实现（先例 seam-budget）。状态行、级别行注记已回写。
- 卡操作：spec 挂 C9；按 L1 式路由挂 plan 双 kind 时撞缺陷——`card update --attach` 同路径不同 kind 静默 no-op（attachments 不变、updated_at 不变、零报错），product-backlog 写明的「同一份文件挂 spec:/plan: 双 kind」形态今天走不通。已立 handoff 卡 **B246**（复现与修复判据在卡 note）。绕行：指针页 `docs/plans/2026-08-25-c9-plan.md` 过 implement 门，C9 已移 implement 列。

## 2026-08-25 追加裁决与 implement 落地

- 用户授权（原话「OK」）：L1 立法并入 C9 为实现决定 I。裁决要点：复用 implement 节点不加新节点；L1 两判据（plan 增量为零 + 验收一眼可核）两中才是 L1；只中判据①的按 L2 定级、可裁决跳 plan（先例 seam-budget、C9）。
- implement 执行位置：**回落本地**（原因：改动基于本工作树未推送分支，远端执行者 fetch 不到基线，push 归用户裁决；全部为纪律文本编辑）。卡生命周期照走。
- 落地清单：A+G→README（第七条判例表 + 修法三件套）；I→using-charter 地图 L1 行 + spec 定级表 L1 行与两判据；D→spec 可见性分界 + 台账条款/裁决过程分界 + 收尾自检第 5 项；B→breakdown「拍板即提交（含回写）」；C→contract 原子化双向 + 冻结物边界/移交区；F→四处个案（C1.10 残句、best-graph 状态行收口、seam-budget 级别行注记、roadmap 第 36 条更正）。
- E 验证（scratch，不动线上）：`python3 scripts/regen_discipline.py --out <scratch>/discipline` 退出码 0，七块生成（contract 8416 / breakdown 8823 / plan 8460 / implement 15737 / review 17824 / integrate 2184 / recon 2388 字节）。正断言：charter-contract.md 命中「冻结物边界」「移交 plan」，charter-breakdown.md 命中「视同未拍板」。负断言：七块对「信息归唯一载体」「修法三件套」「裁决/过程分界」全部零命中。
- **欠账（显式）**：线上 `~/.handoff/discipline` 未重生成——分支未合并，从工作树装法等于部署未获批文本；合并后在 finish 节点跑 `scripts/regen_discipline.py`（G③ 在 finish 兑现）。本机插件目录（`~/.claude/skills/charter`）同理待 finish 后由 install 同步。
