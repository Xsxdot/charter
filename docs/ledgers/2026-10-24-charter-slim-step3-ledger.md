# C18 charter 瘦身第三步 · 台账

## spec（2026-10-24，主会话）

### 取证范围
- 会话记录：`~/.claude/projects/` 下 2026-10-22 后修改、>300KB 的 40 个 jsonl（erp 18、xianyu-bridge 13、handoff 9），抽成「用户 + 助手发言 + Skill/Agent/handoff 调用」纯文本后由三个只读 subagent 分项目调查；调查报告原文由主会话收录，结论摘要存记忆 `project-charter-2026-10-24-review`。
- 三仓 git：`git log --all --since=2026-10-21`，erp 414 / xianyu-bridge 303 / handoff 229 次提交。

### 原始读数
- charter skill 调用：118 次 / 40 会话（spec 36、finish 26、plan 23、implement 19、review 9、两部法与旧节点各 1）。
- skill 正文注入：115 次、0.3M 字符，占全部用户侧上下文摄入（18.7M 字符）1.7%。
- 文档增行 ÷（代码 + 测试增行），按仓：erp 0.24、xianyu-bridge 0.25、handoff 0.20；按卡（合并提交对第一父）：中大卡 0.1~0.4，小卡 ≈ 1.0（X2.13 1.11、X2.20 1.02、E51 1.54、B461 4.84）。
- 最大产物：plan `handoff/docs/superpowers/plans/b453-plan.md` 73627 字符、`xianyu-bridge/docs/plans/2026-10-22-image-local-staging-plan.md` 61664；台账 `handoff/docs/superpowers/specs/b453-ledger.md` 129796、`erp/docs/superpowers/plans/e40-1-plan.ledger.md` 93053、`e23-plan.ledger.md` 69325。
- b453-ledger 结构：464 行、零代码块，按 implement 段 1~6 / 真机 R1~R8 / 修复轮 1~6 / review 3~4 轮分节。
- 账本：614 张卡，在飞 50 张（待办 19、implement 15、review 7、finish 5、plan 3、spec 1）；xianyu-bridge 26 张中 8 张停在 implement 而对应分支已合并（X2.2~X2.7 等）。
- 精简前正文字符数（`wc -m`）：using-charter 4059 / spec 8464 / plan 8839 / implement 6468 / review 10038 / finish 3063 / architecture-law 13908 / defect-families 3426。

### 三份调查的可引用结论（节选，细节见记忆与各报告）
- erp：收益/成本约 1 : 1.5~2；review 首核偏离抓到「已否决却仍实现的后端改动」（E23 段审 11:17）、密钥入日志（17:46）；变异抓无牙（E42 11:55、13:04）；真机抓 E23 补打不打印、E40 议价未做；spec 承重清单 13 条被用户推翻 6 条（E40 08:46）。成本：台账 appends 4/8/7 次、读 0/1/1 次；E23 主会话 144 回合批小队工单，22 张是追加台账；spec.ledger 与 card note 双写。
- xianyu-bridge：收益/成本约 6:4；真机抓 5 处（X2.10 CORS 预检、X2.18 抽屉遮挡、X2.17 visibilityState=hidden、点穿、X2.21 无昵称行）；变异抓 3 处没牙；首核披露抓 2 处隐改契约。成本：台账是 4 次合并冲突源；X2.13 一字段导出因「动契约即 L3」耗 1.6h；X2.19 六小时中五小时是派发故障；用户 118 条发言中约 15 条是单词「批准」。架构法/落位三问/缺陷族零改变决定。
- handoff：收益/成本约 6:4；review 抓假报（B464「未删测试凑绿」与事实不符）、假绿（B456）、提权（B469 批次 plan）、跨卡 schema 冲突（B456 vs 审批批）；finish 新鲜全量 + 换版 9 张卡无回滚；spec 对话 2 次改设计。成本：B435 冻结 145 条；台账读者只有审查者；B465 一行文案 28 分钟两轮独审；轮次门 3/3 误判、pass 不自动移列、熟练工挂不上卡、工单无人收共约 100+ 回合。用户表态：「执行纪律也不太用了…工作流应该完整保留」「做了哪些偏离的决定」要保留。

### 用户关于流程的显式表态（跨仓汇总，原话）
- 2026-10-20 04:19「那个可以不建卡的判据应当删掉，这两天发现会因为可以不建卡就全部自己做了」
- 2026-10-21 12:13「工单太多也是个大问题，这么多工单还不如你自己做呢」
- 2026-10-23 12:00「执行纪律也不太用了…工作流应该完整保留」；14:28「工作流也不需要了，现在 charter 已经收敛到四个节点了…每个节点做成一个熟练工」；「只读的那种摘要形式的事件，比如说做了哪些偏离的决定」
- 2026-10-23 10:43「先按照 C 吧，不要太过度防御了」
- 未见「别走流程 / 跳过 spec」类原话；不满集中在「慢」。

### 卡操作
```
$ handoff card add "charter 瘦身第三步：…" --project charter --priority 高
{"id":"C18","status":"待办","priority":"高","project":"charter","workflow":"charter","workflow_version":15,…}
```

### 判断
- 文字长短不是成本（1.7%），成本在台账机械、两部法零产出、冻结节膨胀、L1 全套与卡机械耦合；后者归 handoff，本卡只记指针。
- 定级 L2：单仓、流定义与纪律块 wire 不动；八份正文各有取舍，plan 增量不为零。

## spec r2（2026-10-24，主会话）
- 用户指令原话：「默认丙，觉得丙不行再询问我」。落为 Q5 推荐 A 的内容与本卡形态（甲→丙）。
- 丙前提核实：`git remote -v` → origin git@github.com:Xsxdot/charter.git；`git ls-remote --heads origin` rc=0。
