# 审查：charter 自举安装 + 变异/判据纪律补缺（C4+C6）

- **审查对象**：`claude/batch-process-pending-cards-45aede` 相对 `8f1f2077`，四提交
  `ee06ef58`(spec) → `a5464c79`(contract+Ticket 0) → `ac967808`(breakdown+裁决) → `d13eb763`(implement)
- **上游基准**：spec / 契约（C-1~C-13、D-1~D-3、R-1~R-4）/ 拆解稿（F-1~F-9）/ plan（T1~T8 + 五项检查）
- **审查者**：零实现上下文，只看仓现状 + diff + 上游文档 + 对侧仓 `/Users/xushixin/workspace/handoff` 实读
- **日期**：2026-08-24
- **本轮实跑**：`py_compile` 退出码 0；`unittest discover -s scripts` 11 支全绿；
  `charter_provision.py check` 退出码 1（仅 template 段漂移）；另做 **9 发独立变异**（M-A~M-H + D-2 锚点复现），逐发读数见下。

---

## 一、契约轴裁决表

| 维度 | verdict | 证据 |
|---|---|---|
| **plan 覆盖完整性** | **缺项** | T1/T2/T3/T4/T5/T6/T8 全部落地并逐条复核通过（证据见下「plan 逐条对账」）。**T7 缺**：plan 第 730 行「T7 判据 1/2/5/6 的测试 \| `check` \| 在缝上 ✅」所指的测试**在交付物中不存在**——`scripts/test_charter_provision.py` 全部 11 支为 `TestNodesEquivalent`(4)+`TestRegenParameterized`(1)+`TestCheckIsReadOnly`(1)+`TestInstall`(5)，`check` 除早退路径外零覆盖。变异实证：M-E/M-F/M-G/M-H 四发全部存活（见 findings C-3）。另 **T8 判据 4 不可满足**（见 findings C-5）。 |
| **scope drift** | **有（双向）** | **说了没做**：① T7 判据 1/2/3/5/6 的测试（plan 已登记为已覆盖）；② plan T8 判据 4「template 段报一致」实跑为漂移。<br>**没说做了**：③ `regen_discipline.body()` 由 `open().read()` 改 `with open()`（plan 第 84 行给的「照抄」代码块是前者，plan 头写明「不要自行发挥」；commit message 有交代）；④ 纪律块计数由 plan 的硬编码 `7 - …` 改为 `len(compose_map())`（改进，未交代）；⑤ `check()` 循环变量 `name`→`fname` 防遮蔽（改进，未交代）；⑥ `.gitignore` 增 `__pycache__/`（落在 `a5464c79`，任何上游文档未声明；无害）；⑦ **本机 `~/.handoff/discipline` 已被分支态正文覆盖**（`check` 报「纪律块：7/7 一致」即证据）——见 findings C-7。<br>**OOS 复核通过**：spec OOS-7（其余 5 个纪律块正文不动）✅；OOS-8（`graph/`、`codegraph`、`install.sh` 零改动）✅ —— `git diff --stat` 全批只触 14 个文件，无一命中；OOS-2（handoff 侧零修改）✅ 全批不含对侧文件。 |
| **冻结物触碰** | **已回写 R-4 + 一处未回写（阻塞）** | **已回写**：F-6 哨兵 `charter-must-override` 的含义 → 契约 R-4（`docs/contracts/…contract.md:344-376`，`d13eb763` 追加 31 行）。内容完整（为什么不留空 / 为什么不是 `charter-implement` / 运行期行为 / 已知代价 / 零影响依据），并与 `flows/charter-default.template.json:7` 实际取值一致。<br>**未回写**：`load_ledger_def` 现以 **stderr 是否含「记录不存在」** 分诊 `NotInstalled` / `LedgerUnavailable`（`scripts/charter_provision.py:69-76`）。这是**安装面新增的一条对侧依赖**（且是文案级脆耦合），契约 C-1~C-13 无对应条目，只落在 plan 的基线表 B-1。见 findings C-6。 |

### plan 逐条对账（actionable item 抽取）

| task | plan 判据 | 复核 | 证据 |
|---|---|---|---|
| T1 | 无参行为逐字不变 / `--out` 不污染本机 / import 无副作用 / 返回 7 键 | ✅ | `regen_discipline.py` 模块顶层只剩定义；`TestRegenParameterized` 绿（mtime 前后相等）；`compose_map()` 键集实读 = `['breakdown','contract','implement','integrate','plan','recon','review']` |
| T2 | 块含「变异/编译/唯一」/ 原四段标题仍在 / <65536 / 不碰 architecture-law | ✅ | `regen --out $T` 后 `charter-implement.md`：变异 12 次、编译 12 次、唯一 8 次；`## TDD 铁律 / 测试三段律 / 变异自验 / 日志与注释 / 修复熔断` 齐；15390 字节；`git diff --stat … skills/architecture-law/SKILL.md` 为空 |
| T3 | 第 2 节改引用式 / 其余两条逐字保留 / 红旗表两行变异行 / `compose_map` 键不变 | ✅ | `grep -c "删出一个编译错误不是证据" skills/acceptance/SKILL.md` = 0；`grep -c '^\| 「变异'` = 2；diff 只动被替换那一条 |
| T4 | 块含「最省力方式」+「目标仓」+「版本」/ 顶级 `##` 标题集合不变 | ✅ | `charter-plan.md` 三词各命中；`diff <(git show 8f1f2077:skills/plan/SKILL.md \| grep '^## ') <(grep '^## ' skills/plan/SKILL.md)` 为空 |
| T5 | 四条缝级断言全绿 + 变异复验断言 1/4 转红 | ✅（证据形态见 findings m-13） | 四支绿；本审查独立三发语义变异 M-A/M-B/M-C 各自**单条**转红 |
| T6 | 顺序行为化 / 幂等 / 半装报文 / regen 硬失败 / 打印仓路径 | ✅ | `TestInstall` 五支绿；判据 1 断言的是**实际命令序列** `kinds == ["template","workflow"]`（`test_charter_provision.py:140-143`），不是常量——C-7 行为锁成立 |
| T7 | 一致路径 / 漂移指路 / 未安装=2 / 单向性 / 纪律块比对 / F-8 | **缺**（判据 4 为假绿，见 C-4；1/2/3/5/6 无测试，见 C-3） | M-D~M-H 五发变异全部存活 |
| T8 | py_compile / 全量绿 / R-4 回写 / regen 7 行 / check 两段一致 | 部分 | 前四条 ✅；**判据 4 不可满足**（C-5）；真源顶层键实读仍为 `['nodes']` ✅ |

---

## 二、规范轴裁决表

| 维度 | verdict | 证据 |
|---|---|---|
| **架构法合规** | **通过** | 第一条：`scripts/` 三文件、无独立契约面与生命周期，仍是 S1 内的一个领域，不升格 ✅。第二/三条：无前缀家族 ≥3、单包源文件 3 « 40，升格信号全未命中 ✅。第四条：`charter_provision` 直接 `import regen_discipline`（第 1 档导出符号），无 interface、无 adapter、无二次抽象 ✅；**D-2 的反面即第四条**——`nodes_equivalent` 未复刻 `withStatesFromNodes`（见 findings 核查 1）✅。第八条：具体路径与顺序集中在模块级 `INSTALL_ORDER`/`*_FILE` 常量 + `main()`，别处不 new ✅。第十条：对 handoff 只经 CLI 契约面（`workflow/template show|put`），不 import 对侧内部 ✅；唯一擦边是硬编码 `~/.handoff/discipline`（对侧 `internal/discipline/resolver.go:29` 的内部路径算法），**属存量、且已记 roadmap 16a**，按「不溯及既往」不判违条。 |
| **测试有牙** | **T5 已验（缝级） / T7 未验：缝级证据缺失** | **已验**：M-A（在 `nodes_equivalent` 尾部加 `states` 比较 = D-2 的真实威胁）→ 仅 `test_states_contradiction_ignored` 转红；M-B（`_strip_zeros` 退化为恒等）→ 仅 `test_noise_not_reported` 转红；M-C（节点顺序判定改为集合比较）→ 仅 `test_node_set_or_order_difference_named` 转红。三发均为**保编译的语义变异**，各自单条行为红，缝的牙齿独立确认。<br>**未验**：M-D（`check()` 第三段前插一条真 `handoff workflow put`）→ **11 支仍 OK**；M-E（F-8 整段短路）→ OK；M-F（纪律块比对永远判一致）→ OK；M-G（`return 1 if findings else 0` → `return 0`，漂了也报 0）→ OK；M-H（未安装分支 `return 2` → `1`，F-5 三值语义作废）→ OK。`check` 的四条承重行为（漂移可发现、三值退出码、F-8、纪律块比对）**一条都没有能变红的测试**。<br>**内部锁**：plan 声明的三条（`TestRegenParameterized`、T6 判据 1、T6 判据 3/4）理由成立、不顶替缝级证据 —— 但它们的红也没有被拿来充数，此处无违规。 |
| **日志与注释覆盖** | **通过（一处缺）** | 文件头有职责/边界/契约指针（`charter_provision.py:1-10`）；新增五个函数与两个异常类全部有 docstring（参数/返回/抛出/注意）；`_ZEROS` 上方写了「为什么」；每条错误分支带上下文与可行动指引（`:197-199`、`:204`、`:236-241`）；成功路径不静默（打印仓路径、每步决策、迁移提示）。<br>**缺**：`check()` 第三段 `regen_discipline.regen(tmp)`（`:246`）**无任何异常包裹**，而 `install()` 对同一调用有兜底（`:203-205`）——同一失败在两条路径上一条给报文、一条给裸栈，错误传播契约不一致。见 findings m-9。 |
| **序列化边界** | **缺** | plan 第 706 行声明「三处手写投影 P1/P2/P3 逐处有断言」。实核：**P3**（`nodes_equivalent` 取 `["nodes"]`）→ T5 四条断言 ✅；**P1**（`load_repo_def` 直接 `json.load`）→ JSON 合法性被 `TestInstall` 顺带穿过，但**顶层键 `['nodes']` 无断言**：把 `flows/charter.workflow.json` 顶层 `nodes` 改名为 `states` 后 **11 支全绿**（探针实跑），而「顶层只有 nodes」正是 D-1 的承重决定；**P2**（`load_ledger_def` 取 `["Def"]` + 从混入 INFO 日志的 stdout 挑最后一行合法 JSON）→ plan 指认的覆盖是「T7 判据 3」，**该测试不存在**（M-H 存活即证），P2 **零断言**。 |

---

## 三、Findings

### Critical

**C-1｜`install()` 在全新机器上必失败，且 acceptance 的真机清单结构性看不见**
- 现象：`regen_discipline.regen(out)` 直接 `open(f"{out}/charter-{name}.md","w")`（`scripts/regen_discipline.py:55-57`），docstring 写明「目录必须已存在」。全新机器上 `~/.handoff/discipline` **不存在**——对侧只在**自己写块**时才建该目录（`handoff internal/discipline/files.go:129` `MkdirAll`，调用方是块编辑 API `discipline.Write`）；`agentd` 启动只建 `DataDir` 本身（`cmd/agentd.go:114`），`resolver.go:29` 的 `Dir()` 只是 `filepath.Join`，不建目录。
- 实跑证据：`rd.regen("/tmp/definitely-not-here-xyz/discipline")` → `FileNotFoundError [Errno 2] … /charter-contract.md`。该异常被 `install()` 的 `except Exception` 兜住（`charter_provision.py:203`），打出「纪律块生成失败：…前两步已完成，重跑本命令是安全的。」并 `return 1`——**重跑永远同样失败**，报文不含「请先建目录」。
- 为什么是 Critical：spec 用户故事 1（「换机或重装的使用者跑一条命令装齐」）是本卡的头号交付，当前在**恰好那个场景**下断掉；而 acceptance 的真机项 M-1 在本机执行，本机该目录早已存在，**结构性不可能发现它**——不能靠 acceptance 兜。
- 修法（一行）：`regen()` 落盘前 `os.makedirs(out, exist_ok=True)`；同时给 `install()` 的兜底报文补一句目录路径。

### Important

**I-2｜`install()` 未捕获 `LedgerUnavailable`，裸抛栈**
- `install()` 的 `try` 只 `except NotInstalled`（`charter_provision.py:181-183`）；`check()` 对同一异常有分诊并 `return 2`（`:239-241`）。
- 实跑证据：mock `load_ledger_def` 抛 `LedgerUnavailable("找不到 handoff 命令…")` → **未捕获异常逃出 `install()`**，`main()` 直接透传成 traceback。
- 与 C-1 同场景叠加：新机器上 `handoff` 不在 PATH / agentd 未起时，用户拿到的是 Python 栈而不是那句已经写好的可行动报文。缺陷族「静默失败 / 误导报错」的「每条错误路径的传播契约」在此断裂。

**I-3｜`check()` 的四条承重行为零测试（plan 记为已覆盖）**
- plan 第 730 行把「T7 判据 1/2/5/6 的测试」登记进接缝覆盖表并判「在缝上 ✅」；plan 第 702 行又把缺陷族「静默失败」分配给「T7 判据 3」。**这些测试在交付物里都不存在。**
- 变异实证（全部存活，11 支仍 OK）：M-E 把 F-8 整段短路；M-F 让纪律块比对永远判一致；M-G 把 `return 1 if findings else 0` 改成 `return 0`（漂了也报一致）；M-H 把未安装分支的 `return 2` 改成 `1`（F-5 三值语义作废）。
- 后果：`check` 是本卡用户故事 2 的**全部**兑现物，它今天可以被任意「顺手优化」掏空而不撞红任何东西。

**I-4｜`TestCheckIsReadOnly` 是假绿锁——承重「单向性」实际无锁**
- 该测试的 `fake_run` 在**第一次** `subprocess.run` 就抛 `NotInstalled`（`test_charter_provision.py:97-99`），`check()` 于是在 `nodes_equivalent` 之前就 `return 2`。断言循环只跑过一条 `show` 命令。
- 变异实证：M-D 在 `check()` 第三段前插入一条真的 `handoff workflow put` → **11 支仍 OK**。「check 绝不写账本」这条被代码注释标为「承重属性，由测试锁住」（`charter_provision.py:217`）的性质，**没有任何能变红的测试**。
- 连带：plan 第 729 行「`TestCheckIsReadOnly` \| `check` \| 调用链穿过 `nodes_equivalent` ✅」这一行不成立——按交付实现，它根本走不到缝。M-A/M-B/M-C 三发缝内变异都没能让它红，即反证。
- 缺陷族「承重安全属性有测试锁住」直接命中：acceptance 的变异复验若拿这支当锁，会得到一个假绿。

**I-5｜plan T8 判据 4 不可满足，且它自己犯了 T4 刚落的纪律**
- 判据原文：「步骤 5 的 workflow 段与 template 段**报一致**」。但 T6 步骤 1 把仓侧 `discipline` 改成哨兵，而真机 install（不可逆 +1 版）已被协调者裁到 acceptance——**template 段必然漂移**。
- 实跑：`python3 scripts/charter_provision.py check` → `template charter-default: 漂移 / 字段 discipline 不同（仓内 'charter-must-override' / 账本 'implement'）`，`EXIT=1`。
- 这正是 T4 本批新增的「判据先在基线跑 / 判据要钉住行为」的反例，出在本批自己的 plan 上。
- **归协调者裁决**（审查者不单方改判 plan）：要么把判据改成「template 段允许且必须打印哨兵这一处漂移，其余为空」，要么给 acceptance 一个书面例外锚——**当前会话里的口头「这是预期的」不是对账锚点**，acceptance 拿到的是 plan 文本。

**I-6｜冻结物增补未回写：对侧 stderr 报文成了安装面的新依赖**
- `load_ledger_def` 以 `"记录不存在" in proc.stderr` 判定 `NotInstalled`（`charter_provision.py:73`），这是 F-5 三值退出码与 `install()` 首装分流的**全部**依据。
- 该事实属「charter → handoff 安装面」的读取面，契约 C-1~C-13 未涵盖（C-3 只冻了 `show` 的**成功**输出形状），只落在 plan 的基线表 B-1。按 review 纪律「本轮的发现或裁决增补了冻结物内容 ⇒ 必须回写并留修订号」。
- 加严理由：这是**文案级**耦合，对侧改一句错误文案就会让 charter 把「没装」误判成「够不着」（代码注释已认这是刻意的 fail-safe 方向，但 fail-safe 的**前提**没进冻结物）。建议补 R-5：记明依赖的报文子串、出处（`handoff` 侧 `ledger: 记录不存在`）、以及 fail-safe 方向的论证。

**I-7｜本机纪律块已被分支态正文覆盖，与协调者裁决的理由相冲突**
- 证据：`check` 报「纪律块：7/7 一致」——比对基准是**本工作树**（分支）的 `skills/` 正文，即 `~/.handoff/discipline/charter-*.md` 现在装的是**未合并的分支文本**。来源是 plan T8 步骤 4 的无参 `regen`。
- 协调者在 breakdown「另裁两条」里的理由是：「为了让 T8 判据 4 变绿而在 implement 期…把分支态的纪律块装到本机、影响所有其它会话——用一条验收判据去换一次全机副作用，不划算」。裁决文字针对的是 `install`，而无参 `regen` 做的是**等效**的事（纪律块那一样）。
- 实际影响：合并前，本机所有其它 charter 会话的 implement/plan 派发都会读到分支文本；分支若被改写或放弃，本机停在一个仓里不存在的版本上。
- **归协调者裁决**：接受（并在卡上记明「本机纪律块此刻来自分支」，与 M-1 的记账口径一致），或在合并前从 master 工作树重跑一次 `regen`。

### Minor

**m-8｜`_ZEROS` 的「对侧全字段 omitempty」前提承重且无锁；`0` 与 `False` 并列冗余**
- 逐字段核对 `handoff internal/ledger/types.go:197-233`：`NodeDef` 的全部标量/切片字段（`Template`/`Dispatch`/`Verdict`/`CarryCardContext`/`MaxRounds`/`OmitAcceptance`/`Next`/`OnFail`/`HumanBases`）**均带 `omitempty`**，故「值为零」与「字段缺失」在 wire 上确实不可区分；`Override`/`Gate` 是 struct（omitempty 不生效，会序列化成 `{}`）——正是剥零值要治的对象；唯一的指针字段 `Produces *NodeOutput` 理论上能区分 nil 与 `{}`，但 `validateNodes` 第 8 条（`kind`/`path` 必须同时非空）保证空 `Produces` **写不进账本**，歧义不可达。**结论：`_strip_zeros` 今天不吃真差异。**
- 但这条结论**完全依赖对侧的字段标注**，仓里没有任何东西钉住它：对侧将来加一个无 `omitempty` 的字段、或一个零值有意义的指针字段，`check` 会**静默判一致**。代码注释自己写的是「几乎全字段带 omitempty」——「几乎」两字即风险所在。建议：把这条前提写进契约（与 I-6 同一次回写），并在 `_ZEROS` 旁注明「新增字段时须复核对侧标注」。
- 另：`_ZEROS` 同时含 `0` 与 `False` 是冗余（Python `0 == False`，`any(sv == z …)` 两者互相覆盖）。无害，但会让读者以为二者被分别处理。

**m-9｜`check()` 第三段 `regen` 无异常包裹**
- `charter_provision.py:246` 裸调 `regen_discipline.regen(tmp)`；`install()` 对同一调用有 `except Exception` 兜底（`:203-205`）。同一失败在 `install` 上是一句可行动报文，在 `check` 上是裸栈。与 C-1 叠加时尤其难读。

**m-10｜P1 的顶层键无断言**
- 探针：把 `flows/charter.workflow.json` 顶层 `nodes` 改名为 `states` 后，**11 支全绿**。而 D-1（真源顶层只存 `nodes`）是本批最难逆转的决定之一，`nodes_equivalent` 用的是 `.get("nodes", [])`——真源一旦丢了这个键，两侧都退化成空列表，`check` 会报一致、`install` 会跳过。建议加一支断言真源顶层键集合 `== {"nodes"}` 的测试（同时兑现 T8 判据 5 的机器可判形态）。

**m-11｜plan 接缝覆盖表漏登 `test_prints_repo_path`（T6 判据 5）**
- 该测试经 `_fake_ledger(same=True)` → `install()` 的幂等分支 → `nodes_equivalent`，按 plan 自己的口径属「调用链穿过缝」，可登记；表里 T6 只列了判据 1/2/3/4。账本不全，不影响结论。

**m-12｜对 plan「照抄」代码块的三处未声明偏离**
- `body()` 改 `with open()`（修 ResourceWarning，commit message 有交代）、纪律块计数改 `len(compose_map())`（plan 版硬编码 7）、循环变量 `name`→`fname`（防遮蔽外层 `name`）。三处**都是改进**，无一处改变行为契约；记账仅因 plan 头明写「凡写『照抄』的地方…不要自行发挥」，后两处未在提交里逐条声明。

**m-13｜commit 声称的那一发变异，证据形态弱于本批新落的纪律**
- commit message：「保编译的语义变异（取 nodes 子树 → 取整个 def），断言 1 与 4 如预期转红，另两条一并转红」。本审查复现该变异：四支缝级断言中三支是 `AttributeError: 'str' object has no attribute 'get'` 的 **ERROR（崩溃）**，不是行为 FAIL——按 T2 刚落的「变异要改语义，不要改『有没有用到』」「先做一次行为断言确认这一发真的改变了行为」，崩溃型红的证据强度低于行为型红。
- **不影响结论**：本审查另跑 M-A/M-B/M-C 三发干净的语义变异，各自**单条**行为红，缝的牙齿独立确认。仅记账证据形态。

---

## 四、变异读数汇总（本轮新鲜，全部在 scratchpad 的隔离副本上跑，仓内文件未改）

| 发 | 变异 | 预期锁 | 读数 |
|---|---|---|---|
| M-A | `nodes_equivalent` 尾部追加 `states` 比较（D-2 的真实威胁形态） | 断言 4 | **FAIL ×1**（`test_states_contradiction_ignored`）✅ |
| M-B | `_strip_zeros` 首行 `return obj`（剥零值失效） | 断言 1 | **FAIL ×1**（`test_noise_not_reported`）✅ |
| M-C | 节点序列比较改成集合比较（顺序语义丢失） | 断言 2 | **FAIL ×1**（`test_node_set_or_order_difference_named`）✅ |
| M-D | `check()` 第三段前插一条真 `workflow put` | 单向性 | **OK（存活）** ❌ → I-4 |
| M-E | F-8 检查整段短路 | F-8 | **OK（存活）** ❌ → I-3 |
| M-F | 纪律块比对永远判一致 | 纪律块段 | **OK（存活）** ❌ → I-3 |
| M-G | `return 1 if findings else 0` → `return 0` | 漂移可发现 | **OK（存活）** ❌ → I-3 |
| M-H | 未安装分支 `return 2` → `return 1` | F-5 三值 | **OK（存活）** ❌ → I-3 |
| P1 探针 | 真源顶层键 `nodes` → `states` | D-1 | **OK（存活）** ❌ → m-10 |

## 五、逐条核查协调者点名的七处

1. **D-2 是否被违反** —— **未违反**。`nodes_equivalent`（`charter_provision.py:143-167`）只读 `.get("nodes")`，全文无 `states`/`gates` 字样的读取，无投影复算；`_strip_zeros` 是通用 JSON 规范化（不需要 `NodeDef` 字段表即可成立）。断言 4 是它唯一能变红的锁，M-A 实证其有牙。
2. **F-3 剥零值是否吃掉真差异** —— **今天不吃**，论证与残留风险见 m-8（逐字段核对了对侧 `NodeDef`/`NodeOverride`/`Gate`/`NodeOutput` 的标注与 `validateNodes` 第 8 条）。
3. **C-7 安装顺序是否行为锁** —— **是**。`test_template_put_strictly_before_workflow_put` 断言的是 mock 捕获的**实际命令序列**（`kinds == ["template","workflow"]`），不是 `INSTALL_ORDER` 常量。
4. **单向性** —— 代码事实上成立（`check()` 只发 `["handoff", kind, "show", name]`，无任何 `put`），**但锁是假的**，见 I-4。
5. **F-8 范围收窄** —— **已落实**。`charter_provision.py:264-273` 只遍历 `repo_wf["nodes"]` 的 `override.discipline`，不读模板缺省值；哨兵 `charter-must-override` 故意无对应文件因而不被覆盖，与 R-4 一致。**但该分支无任何测试**（M-E 存活），见 I-3。
6. **序列化边界 P1/P2/P3** —— P3 ✅、P1 部分（JSON 合法性顺带穿过，顶层键无断言，m-10）、**P2 零断言**（其指认的 T7 判据 3 测试不存在）。
7. **冻结物触碰** —— R-4 已回写且内容与实现一致；另有一处增补未回写（I-6）。

---

## 六、结论

代码质量、注释密度、契约意识与 D-1/D-2/C-7/F-3/F-6/F-8 的落地都扎实，C4 侧四项正文判据逐条实测通过，缝（`nodes_equivalent`）经三发独立语义变异确认真有牙。**问题集中在 `check()` 这一整块**：它是用户故事 2 的全部兑现物，却零测试覆盖，且 plan 的接缝覆盖表把不存在的测试记成了已覆盖；再加上 `install()` 在**全新机器**这一头号场景下会失败且 acceptance 看不见它。

**不建议直接进 acceptance**：先修 C-1、I-2，补 I-3/I-4 的测试（尤其把单向性锁改成真的走到第三段），再由协调者裁决 I-5（判据）与 I-7（本机纪律块归属）。I-6 的契约回写与 Minor 各条可随修一并处理。
