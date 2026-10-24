# charter 瘦身第三步：按两日实战复盘精简

> 状态：**草稿 r3，待用户批准（2026-10-24）**。r1→r2：用户指令「默认丙，觉得丙不行再询问我」。r2→r3：用户指令「本卡不按丙，像这种影响重大的，比如改整体的工作流的，或者算法、架构复杂的，按照甲，其他的按照丙」——Q5 规则定为「重大按甲、其余默认丙」，本卡形态回甲。
> 卡：C18（项目 charter）
> 级别：**L2**（单子系统 charter 仓 `skills/` + `scripts/`；流定义与纪律块 wire 格式不动，见 Q3）。plan 增量不为零（八份正文各有取舍），按规走 plan；前两步用户都裁决跳 plan 直接实现，本步同样可在状态行裁决。
> 形态：**甲**（用户定：改整体工作流本身属「影响重大」，按甲——plan 本会话 subagent 出稿、主会话拍板；implement 本会话 subagent；review 本会话 subagent 独审；主会话逐节点复核并亲跑 S6 `install --shared` / `check`）。
> 台账：`docs/ledgers/2026-10-24-charter-slim-step3-ledger.md`
> 前置：第二步 `docs/specs/2026-10-18-charter-slim-step2-spec.md`（master 2b98250）；复盘结论存于主会话记忆 `project-charter-2026-10-24-review`。

## 一、问题陈述

2026-10-22~24 在 erp / xianyu-bridge / handoff 三仓 40 个会话、118 次节点 skill 调用上复盘 charter 的实际产出（三份独立调查 + 量化读数，原始读数见台账）：

**真出活的只有三处**，三个项目一致：
1. review 的「首核偏离 + 新鲜复跑 + 一次变异」——抓到密钥入日志、至少六处没牙测试、已否决却仍实现的改动、隐改契约、两卡同升 schema 的冲突、外部出稿 plan 里的提权。
2. 真机验收——xianyu-bridge 五处、erp 两处（E23 补打不打印、E40 议价未做）单测全绿、变异也红、功能不生效。
3. spec 对话与批准门——用户推翻 13 条推荐中的 6 条、否掉补丁方案、取证暴露 SDK 兼容雷。用户自述只看 spec。

**近零收益**：
- `architecture-law` / 落位三问 / `defect-families`：几十张卡里没有一次改变决定（handoff 仅 1 例），裁决表里只剩「通过」行。
- 台账过程段：读者只有审查者核偏离节；是合并冲突源（xianyu-bridge 至少 4 次人工解冲突）；远程小队每追加一次主会话批一张工单（E23 一个会话 144 回合批工单，其中 22 张是追加台账）。单份台账 6.9 万~17 万字，零读证据。
- 冻结节：B435 写出 145 条，等于实现规格书；E40 的 C-23c 把错设计冻住，改要开新卡。
- L1 全套：一行文案改动走完全程约 30 分钟（B465）。
- 卡 note 里大量复述形态判决与纪律（约 270 次 card 命令），不是事实。

**不是问题的**：skill 正文注入只占上下文摄入 1.7%，文字长短不是成本所在。plan 文件虽大（4~7 万字）但确被执行者与审查者引用。

**真正的拖慢在 handoff 卡机械**（派发被拒、轮次门 3/3 误判、pass 不自动移列、工单没人收；X2.19 六小时里五小时是派发故障），不在 charter 仓——列入 OOS 交 handoff。

**结构性教训**：E40 spec 5 万字改到 r4 仍漏核心需求；真实歧义多在真机才暴露。重心从「前置写足」挪到「真机早做」。

## 二、方案

**原则**：保三处出活的环节一字不减其判据；删近零收益的文字与附录；不动流列、不动 handoff 引擎（本步零迁移）。

### 待拍板（承重岔口，推荐在前）

| # | 岔口 | 推荐 | 备选 | 后果差异 |
|---|---|---|---|---|
| Q1 | 台账形态 | **A 取消独立台账文件**。产出型节点的「证据」改为产出物末节「读数与证据」（只收原始命令与输出，一行一条）；执行者的交回物（卡 note / 报告 / 交棒声明）首节仍是「偏离与自主决定」。网关「台账纪律」节改名「交回物纪律」只写这两条 | B 保留台账文件但只准两节 | A 消除合并冲突源与小队追加工单；B 保留追溯路径但冲突与工单照旧 |
| Q2 | 两部法 | **A** `defect-families` 删 skill，五族压成 review 裁决表一格「缺陷族三问」（静默失败 / 假绿 / 门禁绕过）；`architecture-law` 保留为参考 skill 但**不再注入纪律块**、spec 删落位三问、review 架构轴改为一格「越界」（新增跨子系统穿透 / 改写他方权威状态 / 新增对外承诺未冻结） | B 两部法全删 | A 保留按需查阅；B 省一份 14k 字正文但失去判据数字先例 |
| Q3 | 流列 | **A 本步不动六列与两道门**（50 张在飞卡零迁移） | B 并 finish 进 review 成五列 | B 需 `workflow put` + 逐张 migrate，收益只是少一列 |
| Q4 | L1 审查 | **A 主会话亲审一轮**：复跑 + 一次变异 + 真机一眼，不派独立 review subagent | B 照旧派独立审 | A 省约一半 L1 时间；B465 类卡实测两轮独审 28 分钟 |
| Q5 | 全局 `~/.claude/CLAUDE.md` §3 形态判决 | **A 缩成两句**：「**影响重大按甲**——改整体工作流/流程本身、算法或架构复杂的；**其余默认丙**（plan 本会话 subagent 出稿、主会话拍板；implement 派 handoff 小队；review 本会话 subagent 独审；主会话验收）。判丙不行——小队探活失败、仓无远端、涉密钥/生产配置、实现中需人频繁拍板——先问人，不自行回落。乙只在用户点名时用。」三形态定义表保留一行版，删五条判序（用户 2026-10-24 定） | B 不动 | 用户私有文件，批准即由本会话改；A 停止形态叙事进卡 note，形态只在 spec 头部一行 |

### 各节点改法（Q1/Q2/Q4 取推荐时）

| skill | 保留（一字不减判据） | 删 / 并 | 新增 |
|---|---|---|---|
| using-charter | 节点地图、一律建卡、红旗、定级指针 | 「台账纪律」整节 | 「交回物纪律」两条（偏离首节 + 读数末节）；正文 ≤ 3.0k 字符 |
| spec | 承重歧义、承诺清单、对话纪律、定级两问 + L1 两判据、批准即回写、OOS 必写与残余落 roadmap | 落位三问（全部）；L3 段压成三行（职责 / 权威状态 / 依赖方向）；骨架去落位三问、去台账指针 | — ；≤ 5.5k |
| plan | 五件事表、决策权限、稿首待拍板、出稿者 ≠ 拍板者、真机清单、冻结节入口判据 | 行为闭环五格表、缺陷族逐族表、「事实风险测试」四条压成两条、读数行；L3 拆分段压成清单 + 依赖两类 | 真机清单标一条**首跑项**；冻结节条目上限 **12 条**，超了即实现规格书退回；≤ 5.5k |
| implement | 测试纪律、三段律、日志注释、修复熔断、排查节全部步骤、交回物首节偏离、没跑不写结论 | 台账指针 | **真机前移**：首条竖切跑通即按 plan 首跑项真机一次，不等 review；≤ 5.0k |
| review | 首核偏离、双轴、裁决表、Findings 分级落卡、顺序铁律复跑→变异→真机、父卡四件事、只读红线 | 架构法引条号、「hash ≠ HEAD 不许当 finding」红线、「不留台账」红线（随 Q1 消失） | 裁决表并入「缺陷族三问」一格与「越界」一格；**L1 单审一轮**段；≤ 6.5k |
| finish | 七步全部 | 文字压缩不改语义 | ≤ 2.5k |
| defect-families | — | **删除 skill** | — |
| architecture-law | 十二条全部 | 不再入纪律块附录 | 头部一行「参考法，spec/plan/review 按需查阅，不自动注入」 |
| regen_discipline | — | compose_map 去掉 arch / defect / ledger 三份附录，三块只含本节点正文 | 测试断言同步 |
| README | — | 两部法与台账相关描述 | 第三步记录一段 |

**弃选**：
- 把 spec / review / 真机也一并压短：三处是唯一出活的部分，判据减一条就是回到「单测全绿上线」。
- 节点 5 → 3（把 plan 并进 spec）：plan 文件被执行者与审查者真用（E34 执行者按 plan 实现、审查按其冻结条款裁），且 implement 门验的就是它。
- 砍真机：真机是时间大头（handoff 约 50% 回合），但它是出活的那部分；砍的是前置文字，不是验证。

## 三、必交故事

| ID | 谁 / 入口 | 期望观察 | 验证 |
|---|---|---|---|
| S1 | SessionStart hook 注入 using-charter | 正文含「交回物纪律」两条，无「台账纪律」；≤ 3.0k 字符 | `wc -m`；`grep -c 台账纪律 == 0` |
| S2 | 读 spec / plan / implement / review / finish 正文 | 各份不超预算（5.5k / 5.5k / 5.0k / 6.5k / 2.5k），且表「保留」列的判据逐条可在正文定位 | `wc -m`；保留清单逐条 grep |
| S3 | `ls skills/` | 恰为 architecture-law finish implement plan review spec using-charter（无 defect-families） | `ls` |
| S4 | `python3 scripts/regen_discipline.py --out <tmp>` | 三块只含本节点正文，无「# 附：」标题 | `grep -c '^# 附：' == 0` |
| S5 | `python3 scripts/test_charter_provision.py` | 全绿（含更新后的组成断言） | 命令输出 |
| S6 | `charter_provision.py install --shared` 后 `check` | workflow 一致、template 一致、纪律块 3/3 一致 | 命令输出 |
| S7 | 下一张产品 L1 卡 | review 由主会话亲审一轮，耗时 < 15 分钟，且复跑 + 变异 + 真机三项证据齐 | 该卡 `card accept --evidence` 原文 |
| S8 | 下一张产品 L2 卡的 implement | 首跑项真机在 review 之前发生，有时间戳可核 | 该卡交回物 |
| S9（Q5=A 时） | `~/.claude/CLAUDE.md` §3 | 形态判决缩为「重大按甲、其余默认丙、判丙不行先问人、乙仅点名」，三形态表留一行版，五条判序删除 | 读文件 |

S7 / S8 是生效观察项，不阻塞本卡 finish，落 roadmap。

## 四、实现决定

- 改动只在 `skills/*/SKILL.md`、`scripts/regen_discipline.py`、`scripts/test_charter_provision.py`、`README.md`、`docs/roadmap.md`；`flows/` 与 `hooks/` 不动。
- 删 `defect-families` 目录即删 skill；plugin 清单若有列举需同步（现状读数：`hooks/hooks.json` 只注册 SessionStart，无 skill 清单）。
- 纪律块名仍为 `charter-story-*`（改名破坏回退，第二步已裁）。
- 正文预算以 `wc -m` 字符数为判据（roadmap 69c 的「两页核心」在此落实）。
- 现状读数（执行节点复核）：落位三问 `skills/spec/SKILL.md:62`；行为闭环与缺陷族表 `skills/plan/SKILL.md:36-41`；附录组成 `scripts/regen_discipline.py:49-56`；附录断言 `scripts/test_charter_provision.py:150-165`。

## 五、测试决定

- 机内：S4~S6 三条命令即回归；`install --shared` 走共享账本，放后台跑。
- 真机：S7 / S8 在下一张产品卡上观察，证据回填本 spec 末节。
- 风险：regen 去附录后在飞卡（50 张，均钉当前版本）下一轮派发读到的纪律块变短——这是预期行为，不是漂移；`check` 一致即为证。

## 六、Out of Scope

**永不做（本仓）**：
- handoff 卡机械：轮次门 3/3 对分段派发误判、pass 不自动移列、dispatch 被拒形态、工单无人收——handoff 仓的事，本仓只记 roadmap 指针。
- 改纪律块名 `charter-story-*`。

**本期不做、后续要做（逐条落 roadmap）**：
- 流列并 finish 进 review（Q3-B），等本步跑十张卡后看 finish 是否还有独立裁决。
- `architecture-law` 是否整部删除（Q2-B），同一观察窗。
- 项目仓既有台账文件不迁移、不删；各仓 `docs/` 约定由各仓自定。
- v12 快照删否（roadmap 69a 原条）。

## 七、备注

- 复盘的三份独立调查与量化读数全文在台账；精简前各正文字符数：using-charter 4059、spec 8464、plan 8839、implement 6468、review 10038、finish 3063、architecture-law 13908、defect-families 3426。
- 第二步删掉的节点正文在 git 历史 d84d457；本步删掉的两部法附录与台账节在本提交的父提交。
