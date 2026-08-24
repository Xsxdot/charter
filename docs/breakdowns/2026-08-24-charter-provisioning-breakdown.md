# 拆解：charter 自举安装 + 变异/判据纪律补缺

- **卡**：C4、C6（合批）
- **上游 spec**：`docs/specs/2026-08-24-charter-provisioning-and-mutation-discipline-spec.md`（状态位实读：**已批准（用户，2026-08-24）**，见该文件第 5 行）
- **上游契约**：`docs/contracts/2026-08-24-charter-provisioning-contract.md`（状态位实读：**冻结日期 2026-08-24** + 正文「本文档是本批的冻结物」，见该文件第 5、10 行）
- **级别与档位**：L3 轻档 —— **不重判**。轻档 = 实现归一轮，故下文第五节是**单轮 implement 的任务分解与顺序**（task，非 card），不扇出并行子卡。
- **出稿**：breakdown 节点 subagent，2026-08-24。**全文是提案**，拍板归协调者。

---

## 一、待拍板岔口清单（协调者只需裁这九条）

> 出稿者一条也没有自选。每条给方案、取舍、推荐与「选它之后 DAG 怎么变」。

| # | 岔口 | 方案 | 出稿者倾向 |
|---|---|---|---|
| **F-1** | 测试用什么形态跑（仓内零先例） | (a) 标准库 `unittest`，测试落 `scripts/test_charter_provision.py`，跑法 `python3 -m unittest discover -s scripts -p 'test_*.py'`；(b) 引入 `pytest`（需新增依赖声明，仓内今天没有任何依赖管理文件）；(c) 裸 `assert` 脚本 | **(a)**。零新增依赖、一条命令可跑、与「仓内无依赖管理文件、`scripts/` 无 CI 门」的现状一致。(b) 的收益（参数化、fixture）在本批 3~5 支测试的体量下不抵它引入的第一个依赖 |
| **F-2** | `template` 的比对没有对应的缝符号（契约只冻了 `nodes_equivalent` 一条缝） | (a) `check()` 内联 template 比较，复用与 nodes 同一个「差异清单引擎」，**不新增缝**；(b) 把签名泛化成 `defs_equivalent(kind, repo, ledger)` → **改冻结签名，退回 contract**；(c) 新增第二条缝 `template_equivalent` → **退回 contract 加缝** | **(a)**。C-8（经本轮更正后仍成立的部分）证明 template 往返恒等，比较逻辑是 `dict ==` 级别的纯映射；为它付一条缝的冻结成本不划算。代价要认：template 侧无独立缝级断言，验收靠 `check()` 的行为断言 + 真机 |
| **F-3** | `nodes_equivalent` 的规范化档位 | (a) 严格结构比较（`==`，键序天然无关）——**今日实测 repo nodes == ledger v9 nodes 为 True**，够用；但「显式零值」与「省略键」会被报成漂移；(b) 比较前**递归剥离 JSON 零值**（`""` / `0` / `false` / `null` / `{}` / `[]`）再比 | **(b)**。决定性论证在第六节「序列化边界」族：Go 侧 `NodeDef` 全字段带 `omitempty`，**「字段缺失」与「值为零」在 wire 上已经被抹平**，charter 侧要求区分它们等于要求区分一个不可区分的差别。且 (b) 只需要知道 JSON 零值集合，**不需要 NodeDef 字段表**（契约欠账 2 明说未逐字段冻结），故不违反 D-2 的「禁止复刻对侧逻辑」 |
| **F-4** | `install` 是否幂等 | (a) 无条件三连——每跑一次账本 +1 版（今日 v9→v10），简单、无 TOCTOU；(b) 先比对，一致则跳过 put——版本号不膨胀，但首装时必须把「不存在」与「不一致」分流，且引入 check→put 窗口 | **无强倾向，真取舍**。(b) 的理由：账本**没有 delete**，每一版都是永久的，反复跑 install 会把版本号变成噪声堆；(a) 的理由：版本号本就是 C-12 认定的噪声字段，多几版无害，而 (b) 让 T6 依赖 T5/T7（DAG 变长）。**选 (b) 时 DAG 变为 T5→T7→T6** |
| **F-5** | `check` 的退出码与报文形状 | (a) 三值：0=一致 / 1=漂移 / 2=未安装或环境不可用；(b) 二值：0/1，用报文区分 | **(a)**。「未安装」与「漂了」的处置完全不同（前者跑 install，后者要人看差异），压成同一个码等于把判断推给读报文的人 |
| **F-6** | 模板缺省 `discipline` 的修法（契约 D-3 明确交办本轮） | (a) 保持 `"implement"`（现状，雷不排）；(b) 改 `"charter-implement"`（忘写 override 的节点静默拿 charter 实现块，比 (a) 好但仍**静默**）；(c) 改成**不存在的哨兵名**（如 `charter-unset`）→ 按 C-9 第 3 段解析必然报错「未知纪律块名字」，**把静默降级变成响亮失败**；~~(d) 留空~~ **已被本轮查证否决，见 R-2** | **(c)**，理由与本批立意同族（治的正是「一个通过了的检查不等于它想证明的事情为真」）。**本轮新查证的三条支撑事实**：① 纪律块解析**只发生在派发时**（`internal/agentd/manager.go:369` `resolveDisciplineFor`，三个调用点 Dispatch / resumeForContinue / ResumeTask），`template put` 不解析；② 现有 7 个 dispatch 节点**全部写了 `override.discipline`**（本轮读 `flows/charter.workflow.json` 逐个核过），故 (c) 对现役流程**零影响**；③ `charter-unset` 过得了 C-10 的名字校验与 C-8 更正后的非空校验，全程合法直到派发时炸。**代价（真取舍）**：裸 `handoff dispatch --template charter-default`（不经工作流节点的直接派发）会从「能跑」变成「直接失败」 |
| **F-7** | `skills/acceptance/SKILL.md` 红旗表是否为形态②补一行 | (a) 补一行「变异后一切如常 → 先怀疑没打中，不是先下『测试是摆设』的结论」；(b) 不补，红旗表只留形态①那行 | **(a)**，但**范围上确属扩张**（spec 只授权「形态①正文改引用」），故必须拍板。理由：红旗表是**协调者复验侧的入口**，与 implement 的执行纪律受众不同，补一行不构成正文副本 |
| **F-8** | `check` 是否顺带核「每个 dispatch 节点的 `override.discipline` 在纪律块目录里有对应文件」 | (a) 核；(b) 不核 | **(a)**，但**与 F-6 耦合**：若 F-6 选 (c)，模板缺省值 `charter-unset` **故意**没有对应文件，这项检查必须只覆盖 `nodes[*].override.discipline`、**不覆盖模板缺省值**，否则 check 会永远报一个故意造出来的「问题」。选 (b) 则本项不做 |
| **F-9** | `regen_discipline.py` 输出目录参数化的形态（spec 已定「要参数化」，未定形态） | (a) 可选 CLI 参数 `--out DIR`（缺省 `~/.handoff/discipline`）；(b) 环境变量；(c) 函数参数化 `def regen(out=OUT)` + 模块级默认，`charter_provision` 直接 import 调用而非 `subprocess` | **(c) + (a) 组合**：(c) 让 install/check 与测试能把 regen 打到临时目录、且与 regen 同进程（错误可直接捕获，不必解析 subprocess 输出）；(a) 保持 `python3 scripts/regen_discipline.py` 的既有无参用法**逐字不变**。取舍要认：(c) 把 regen 从「独立可跑脚本」变成「也是一个库」，它今天的模块级 for 循环必须收进函数 |

---

## 一之二、协调者裁决（2026-08-24，拍板即生效）

**九条全部裁定，无一悬置。**下游 plan 以本节为准；本节与上表「出稿者倾向」冲突时以本节为准。

| # | 裁决 | 理由（协调者，非出稿者原文） |
|---|---|---|
| **F-1** | **(a) unittest** | 仓内今天没有任何依赖管理文件（无 `requirements.txt` / `pyproject.toml` / `setup.py`），Python 面只有 2 个脚本。为 3~5 支测试引入仓里的**第一个第三方依赖**，成本不在 pytest 本身，在于从此这个仓有了依赖面要管。 |
| **F-2** | **(a) 内联，不新增缝** | 采纳。补一条出稿者未给的支撑：C-8 被 R-2 更正掉的是「无校验」，**「无投影」那半仍然成立**——template 往返恒等，比较逻辑就是 `dict ==`。为一个纯映射付一轮 contract 的冻结成本不成比例。**代价明确认下**：template 侧没有独立缝级断言，验收靠 `check()` 行为断言 + 真机 M-1。 |
| **F-3** | **(b) 递归剥零值** | 采纳，且**证据比出稿者给的更硬**：Go 的 `omitempty` **对 struct 字段不生效**，故 `NodeOverride` / `Gate` 这两个结构体字段即便全零也会被序列化成 `{}`——本轮实读 `workflow show` 输出确认「待办」节点带 `"override":{}` 与 `"gate":{}`。严格比较下，任何人手写一个省略 `override` 的节点都会被报成漂移。**这不是理论风险，是第一次手编真源就会撞上的假阳。** |
| **F-4** | **(b) 幂等，一致则跳过** | 出稿者标「无强倾向」，此处由协调者定。决定性理由是**账本没有 delete**：每一版都是永久行。install 是「改完就跑」的命令，(a) 会让版本号在几天内变成垃圾堆（charter 一天内已从 v7 到 v9）。更难受的是 (a) 下连跑两次 install 会产生 v10、v11 两个**内容完全相同**的版本，其间建的卡各钉一个——事后考古看到两个版本号，要翻内容才知道它们一样。TOCTOU 在单用户本机账本上不构成理由。**接受 DAG 变长为 T5→T7→T6。** |
| **F-5** | **(a) 三值退出码** | 采纳。「未安装」与「漂了」的处置动作完全不同（跑 install vs 人看差异），压成一个码等于把判断推给读报文的人——而本批立意正是反对这个。 |
| **F-6** | **(c) 哨兵名，但改名为 `charter-must-override`** | 采纳 (c)，**改掉出稿者提的 `charter-unset`**：哨兵一旦触发，报文是 `未知纪律块名字 "X"：既无 …/X.md 也无同名内置块`，名字本身就是给读报文的人唯一的提示。`charter-unset` 要求读者已知本仓约定；`charter-must-override` 自解释。<br>**采纳 (c) 而非 (b) 的理由**：R-2 已证明 CLI 层强制 `discipline` 非空，故「本模板没有合理缺省」这个真实语义**无法用留空表达**，哨兵是它在必填字段上的唯一诚实编码。<br>**补一条出稿者未给的支撑**：该模板的 `prompt` 通篇是卡形状的（`{{CARD}}` / `{{TITLE}}` / `{{ACCEPT}}`），裸 `handoff dispatch --template charter-default` 本来就会渲染出一堆没有卡的占位符——**那条路径今天已经是语义损坏的**，让它响亮失败是修复不是回归。<br>**硬要求**：JSON 无注释，哨兵的含义必须同时写进契约修订记录与本稿，否则下一个人看到一个「坏值」的第一反应是修好它。 |
| **F-7** | **(a) 补红旗行 —— 批准的范围扩张** | 采纳。红旗表是**协调者复验侧**的入口，与 implement 的执行者受众不同，补一行不构成正文副本。**但它确属 spec 未授权的扩张**（spec 只授权「形态①改引用」），故按扩张记账：已在卡 C4 上记一笔，review 节点对账时按本裁决核，不得当作越轨。 |
| **F-8** | **(a) 核，但范围收窄 + 一条扩展** | 采纳 (a)。**收窄**：只覆盖 `nodes[*].override.discipline`，**不覆盖模板缺省值**——F-6 选 (c) 后缺省值故意无对应文件，覆盖它等于让 check 永远报一个自己造的问题。**扩展**：一个 `dispatch: true` 却**根本没写 `override.discipline`** 的节点同样要报——F-6 (c) 保证它在派发时会炸，但 check 应该更早发现，这是纵深不是冗余。 |
| **F-9** | **(c)+(a) 组合** | 采纳。硬约束一条：`python3 scripts/regen_discipline.py`（无参）的行为必须**逐字不变**——全局 CLAUDE.md 与本仓多处文档都在教这条命令，改掉它等于让所有既有文档同时失真。 |

**两项「非岔口」的裁定**：

1. **红旗表第 43 行保留** —— 同意，spec 第 182 行明写「协调者复验侧保留入口」。
2. **缝级断言由 spec 的 2 条加严到 4 条** —— **同意，且这是本稿最有价值的提案**。第 4 条（nodes 同、states 故意矛盾 → 判等价）是 D-2「禁止复刻投影」在仓里**唯一能变红的锁**。没有它，将来有人「顺手把 states 也比一下」不会撞红任何测试，而 D-2 是本批最难逆转的决定之一。加严不加缝，无需退回 contract。

**协调者另裁两条（出稿者已标出、需协调者消化的）**：

- **T8 判据 4 与 M-7 的次序冲突** —— 裁定：**T8 判据 4 降为两段**「workflow 段与 template 段一致」，纪律块段在本分支上**允许漂移且必须打印原因**（本机块来自 `~/.claude/skills/charter` 符号链接指向的 master 工作树）。完整的三段全绿**推迟到 finish 合并后**执行，并写进 finish 的基准回灌步骤。理由：为了让 T8 判据 4 变绿而在 implement 期从 worktree 跑 install，会把**分支态**的纪律块装到本机、影响所有其它会话——用一条验收判据去换一次全机副作用，不划算。
- **M-1（真机 install，+1 版不可逆）的执行时机** —— 裁定：**放 acceptance，不放 implement**。implement 期一律用 mock；acceptance 执行 M-1 时在卡上记明「本机纪律块此刻来自分支」，finish 合并后重跑一次 install 收口。

**另**：本稿第七节第 5 条的 handoff 侧观察项经协调者复核**属实**（`proto.NodeOverride` 缺 `Purpose`，`ledgerapi.go:122-126` 投影正好丢它；而 charter v9 的 review 节点**正在用** `purpose: "review"`），已开卡 **B241**（handoff 项目，中优先），不在本批做。

---

**另有两项本稿判定为「不构成岔口」，一并交代，协调者若不同意可推翻**：

- `skills/acceptance/SKILL.md` 第 2 节的形态①正文改引用、红旗表第 43 行**保留**——spec 第 182 行明写「协调者复验侧保留入口」，红旗行正是那个入口。非岔口。
- 本稿提案把缝级断言从 spec 的 2 条**加严到 3 条**（新增「states 矛盾但 nodes 相同 → 判等价」）。加严属纪律允许，不需退回 contract；但它是本稿最重要的一条提案，理由见第四节 R-1。

---

## 二、触及子系统清单（含类型）

charter 仓**无 `codegraph/`**（本工作树核实），无 `codegraph/best.json` 可引，`domains` 顶层领域清单不可得。以下按人工判断，并逐个核架构法第一条的**派卡资格四条**。本批 L3 轻档不扇出，四条核的是「该不该按子系统派」的资格，结论用于确认「一轮做完」是对的。

| # | 子系统 | 类型 | 派卡资格四条 | 结论 |
|---|---|---|---|---|
| S1 | **charter 仓**（`skills/` 正文 + `scripts/` 安装脚本 + `flows/` 真源） | **逻辑型**——接缝对面（比对函数吃的 JSON）虽来自外部工具，但两侧样本都能落成夹具，测试可在机内闭环 | ①有界文件集 ✅（`skills/{implement,plan,acceptance}/SKILL.md`、`scripts/*.py`、`flows/*.json`，一条路径规则写得出）；②契约面可枚举 ✅（`nodes_equivalent` / `install` / `check` / `regen` 四个模块级符号）；③DAG ✅（对 S2 单向依赖，无环）；④类型标注 ✅ | 是子系统，但**只有它一个在动** |
| S2 | **handoff 账本**（`workflow put` / `template put` / 纪律块目录约定） | **边界型**——接缝对面是外部进程与本机 SQLite，机内只验契约形状，**行为验收全部走真机清单，归协调者执行** | ①有界文件集 ❌（不在本仓）；②契约面可枚举 ✅（C-1~C-13 已冻结）；③—；④✅ | **本期零修改**，不派卡。它是接缝的对面，不是工作对象 |

**与 spec 的定级判决一致**：spec 第 100-101 行已判「`skills/` 与 `scripts/` 是同仓两目录，无独立契约面与部署单元，**不构成两个子系统**」。本稿据此把它们并入 S1，不另立门户。**并行没有对象**——这是轻档选择在拆解层面的复核结论，不是重述。

**图覆盖债**：无图可查，本稿全部现状引用来自 grep 与直读，符号锚无法由 `codegraph resolve` 决议。下游 review 复核时需人工核对文中 `文件:行` 出处。

---

## 三、契约增量核对（C-1 ~ C-13 逐条）

| 条 | 本次拆解是否越界 | 结论 |
|---|---|---|
| C-1 `put` 只吃 `WorkflowDef` | 否 | 任务 T6 按此实现，`--file` 直接喂 `flows/charter.workflow.json` |
| C-2 `WorkflowDef` 三键 | 否 | — |
| C-3 `show` 与 `put` 不同构，转换规则「取 `.Def`」 | 否 | 骨架 `load_ledger_def` 已按此写（`scripts/charter_provision.py:41-58`），T7 沿用 |
| C-4 回灌完整对象硬失败 | 否 | 转为真机负例 M-4（零残留，见第七节） |
| C-5 `states`/`gates` 是派生投影 | 否 | 真源已按 D-1 只存 `nodes`（本轮实读 `flows/charter.workflow.json` 顶层键 = `['nodes']`） |
| C-6 `validateNodes` 10 条 | 否 | **不在 charter 侧复刻**，见第六节「门禁绕过」族 |
| C-7 安装顺序 template→workflow→regen | 否 | T6 以 `INSTALL_ORDER` 常量落实（骨架 `scripts/charter_provision.py:29-32` 已在） |
| **C-8 `template put` 无投影、无校验** | **本轮查证发现该条不准确 → 已回写更正 R-2** | 「无投影」成立；**「无校验」不成立**——CLI 层有三字段必填校验。见 R-2 |
| C-9 `discipline` 是角色名、解析三段式 | 否 | F-6 的三个选项全部在此条的取值域内讨论 |
| C-10 名字不得含路径分隔符 | 否 | F-6 (c) 的哨兵名 `charter-unset` 合法 |
| **C-11 「一致」= 只比 `nodes`** | **与 spec 缝级断言②的措辞存在口径不一致 → 已回写澄清 R-1** | C-11 本身不改，**断言②的可执行重述**见 R-1 |
| C-12 忽略 `Name`/`Version`/`CreatedAt` | 否 | 骨架 `load_ledger_def` 取 `["Def"]` 时已剥离；**推论**：spec 断言①里的「版本号不同」在 `nodes_equivalent` 这一层**不适用**（噪声在函数外已剥），该函数层面断言①退化为「键序/零值表达不同 → 判等价」。见 R-1 |
| C-13 容忍键序差异 | 否 | Python `dict ==` 天然满足，无需额外实现 |

**需要新接缝吗**：**不需要**。F-2 的三个方案里只有 (b)(c) 要动契约，本稿推荐的 (a) 不动。**若协调者拍 (b) 或 (c)，本批必须退回 contract 一轮，不许边拆边加。**

**上游状态位核对**：spec 头部第 5 行「已批准（用户，2026-08-24）」✅；契约头部第 5 行以「冻结日期：2026-08-24」+ 第 10 行「本文档是本批的冻结物」承载冻结状态位 ✅。两者均已落在文件里，不依赖会话记忆。

### 本节点已回写进契约文档的修订记录

按 breakdown 纪律「边界澄清即便不退回 contract 也要回写一行」，本轮已在 `docs/contracts/2026-08-24-charter-provisioning-contract.md` 追加「拆解节点回写的修订记录」一节，含 R-1 / R-2 / R-3 三条。摘要如下（原文以契约文档为准）：

#### R-1（边界澄清，不退回 contract）：spec 缝级断言②的可执行重述

**冲突原文**：spec 测试决定第 206-207 行写「一对『states 或 gates 实质不同』的输入 → 判不等价」；C-11 与 D-2 写「只比 `nodes`，禁止复刻投影」。字面执行断言②要求实现去读 `states`/`gates` 键，**直接违反 C-11/D-2**。

**裁定**：断言②里的「states 或 gates 实质不同」是**症状描述，不是输入构造法**。在 D-1 的 nodes-only 真源制下，仓侧 def 根本没有 `states`/`gates` 键，生产路径上这两样的差异**只能以 nodes 差异为载体**。故断言②重述为：

> 构造一对 `nodes` 实质不同的输入，差异分别落在两类载体上——**(i) 节点集合或顺序变化**（其投影会体现为 states 变）、**(ii) 某节点的 `gate` 变化**（其投影会体现为 gates 变）——断言判不等价，且差异清单**指名到节点与字段**。

**并加严一条（本稿提案，属加严不属加缝）**：新增第三条缝级断言——**一对 `nodes` 完全相同、而 `states`/`gates` 键故意矛盾的输入 → 判等价**。它是 D-2「禁止复刻投影」这条承重决定**唯一能变红的锁**：没有它，将来有人「顺手把 states 也比一下」不会有任何测试拦他。

**为什么不退回 contract**：C-11 的判据本身不变、D-2 的决定不变、`nodes_equivalent` 的签名不变；变的只是 spec 一句话的可执行读法。这是边界澄清的标准形状。

**若协调者认为这是分歧而非澄清**，退回 contract 的正确做法是改 spec 的断言②措辞，而不是改 C-11 —— 因为 C-11 有代码级证明（`internal/ledger/workflows.go:20-43` + `:156`），断言②只有一句自然语言。

#### R-2（事实更正）：C-8「`template put` 无校验」不成立

**本轮实读 `cmd/template.go:81-83`**：

```go
if def.Executor == "" || def.Prompt == "" || def.Discipline == "" {
    return fmt.Errorf("executor/prompt/discipline 三者必填")
}
```

C-8 引的 `internal/ledger/templates.go:66-85`（`Store.PutTemplate`）确实无校验——**但 CLI 层有**。C-8 的「无投影」部分成立，「无校验」部分被本条更正为「store 层无校验，CLI 层有三字段必填校验」。

**直接后果**：F-6 的选项 (d)「`discipline` 留空」**不可行**——空串会被 CLI 当场拒绝。这个选项在契约 C-9 的行文里还是活的（spec 第 172 行也写着「整个字段留空」），本条把它杀死。

**为什么算更正而非退回**：契约的**决定**（D-1/D-2/D-3）不受影响，受影响的只是一条事实描述的精度，以及它下游一个选项的可行性。

#### R-3：`nodes_equivalent` 的职责边界

spec 断言②要求「指出差异在**哪一样**、哪个字段」。核对 spec 用户故事 2（第 145-146 行「告诉我漂在哪一样」）后裁定：**「哪一样」= 三样东西之一（workflow / template / 纪律块），归 `check()` 主流程的三段结构负责**；`nodes_equivalent` 只负责**单份 workflow def 内部的节点级/字段级差异清单**。两者不是同一个粒度，不要求一个函数同时承担。

---

## 四、任务分解与顺序（L3 轻档 = 单轮 implement）

**说明**：轻档不扇出并行子卡，故下列是 **task**，由同一轮 implement 顺序执行。四段式（契约引用 / 意图与为什么 / 验收 / 入口指针）一条不减，判据全部行为化、独立可验。

### 依赖 DAG

```
        ┌── T2 (implement 正文) ──┐
        ├── T3 (acceptance 正文) ─┤
        ├── T4 (plan 正文) ───────┤
        │                          ├──> T8 (收尾：regen + 全量自检)
  T1 (regen 参数化) ── T5 (缝) ── T7 (check) ──┤
        │                          │
        └──────────────── T6 (install) ────────┘

依赖边（实线即硬依赖）：
  T1 → T7   （check 要把 regen 打到临时目录做纪律块比对）
  T1 → T5   （仅当 F-9 选 (c)：测试要能 import regen；选 (a)/(b) 则此边消失）
  T5 → T7   （check 调用缝函数）
  T2,T3,T4 → T8（正文改完才有新段可验）
  T7 → T8
  T6 → T8
  【F-4 裁决影响】选 (b) 幂等方案时新增边 T7 → T6，T6 从并行位挪到 T7 之后
```

**最薄路径条自检**（`skills/plan/SKILL.md:27`）：本批要锁的行为（`nodes_equivalent` 返回可用判定）今天从声明缝调用会抛 `NotImplementedError`——**写下去就会红**，故 T5 本身即最薄可跑路径，**不需要另插点亮 task**。缝符号已由 contract 的 Ticket 0 落地（`scripts/charter_provision.py:61-73`），故 T5 的首红是**断言红**（功能缺失）而非编译红，符合 implement 铁律。

**T2/T3/T4 不是实现类 task**（纯正文改动，无代码接缝），故 `skills/plan/SKILL.md:38` 的「每个实现类 task 至少一条缝级断言」对它们不适用。**这一句必须写进下游 plan 的占位符扫描节自我声明**，否则 plan 会被自己的闸门绊住。

---

### T1 — `regen_discipline.py` 输出目录参数化

**①契约引用**：无契约面。spec 实现决定第 187-189 行（「输出目录需参数化，否则比对逻辑无法在不污染本机 `~/.handoff/` 的前提下被测试驱动」）；spec 测试决定第 209-210 行明确把它归为**内部锁候选，不占缝名额**。

**②意图与为什么**：今天 `OUT` 是模块级常量写死 `~/.handoff/discipline`（`scripts/regen_discipline.py:9`），且生成逻辑是模块顶层的 for 循环（`:36-41`）——**import 即执行、执行即写本机**。T7 的纪律块比对必须能把一份「按当前仓正文重新生成的块」放到临时目录再比，写死的常量让这件事在不污染本机的前提下做不到。这是**手段不是缝**，不进接缝清单。

**③验收**（形态待 F-9 裁决，判据按 (c)+(a) 写；选其它方案时判据同构改写）：
1. `python3 scripts/regen_discipline.py`（**无参**）跑完，`~/.handoff/discipline/` 下 7 个 `charter-*.md` 全部刷新，文件权限仍为 `0600`——**既有用法逐字不变**；
2. `python3 scripts/regen_discipline.py --out <tmpdir>` 跑完，7 个文件落在 `<tmpdir>`，且 `~/.handoff/discipline/` 的 7 个文件 mtime **未变**（可测：跑前记 mtime，跑后比）；
3. `import regen_discipline` **不产生任何文件**（模块顶层不再有副作用）——可测：在临时 HOME 下 import，断言 `~/.handoff/discipline` 不存在；
4. 生成的 7 个块名逐字为 `charter-{contract,breakdown,plan,implement,review,integrate,recon}.md`，与 `flows/charter.workflow.json` 里 7 个 dispatch 节点的 `override.discipline` 取值**逐一对应**（本轮已人工核过，此判据把它变成机器可判的）。

**④入口指针**：`scripts/regen_discipline.py`（全文 41 行）、`scripts/charter_provision.py:24`（`REGEN` 常量，选 (c) 时该常量的用法要改）。

---

### T2 — `skills/implement/SKILL.md` 新增「变异自验」段（C4 形态①②）

**①契约引用**：无契约面（C4 是纯正文改动，契约节点对它的产出为「无契约增量」，见卡 C4 事件 seq 2334）。落点由 spec 实现决定第 180-181 行钉死：形态①②→ implement，**因为做变异的是执行者，而 implement 有纪律块**（`scripts/regen_discipline.py:26-34` 的 compose 映射含 implement）。

**②意图与为什么**：`skills/implement/SKILL.md` **全文没有「变异」二字**（spec 第 42 行读数，本轮复核成立）。而 C4 记录的两次踩坑**恰恰发生在 implement 的变异自验环节**：
- 形态①：变异删掉一行 → import/局部变量未使用 → **编译失败** → `go test | grep -c "^--- FAIL"` 得 0 → 长得和「变异存活 = 测试是摆设」一模一样。实录里两次都先下了错误结论。
- 形态②：`s.replace(old, new, 1)` 打中了同名的**另一处**（`graph/cli/cli.go` 里同一段文本在 `:117` 与 `:232` 各出现一次）→ 编译通过、测试真跑了、报 0 红 → 比形态①**隐蔽得多**，唯一破绽是「变异后行为没变」这件事本身不合理。

正文要落两条纪律 + 两条配套手法：**变异必须编译得过**（两段判定：先确认编译通过，再数失败数；编译不过那一发不算数，整块替换成可编译的等价变异后重做）、**变异必须打中唯一**（断言 `count(old) == 1`，多处命中要求更长的上下文锚；变异后先做一次行为断言确认这一发真的改变了行为，再去数全量失败数）；配套：**变异要改语义，不要改「有没有用到」**（优先取反 / 改边界值 / 改比较符，而非整行删除）、**「变异后一切如常」永远先怀疑变异没生效**。

**③验收**（钉行为不钉计数——本条自我适用形态③）：
1. `python3 scripts/regen_discipline.py --out <tmp>` 后，`<tmp>/charter-implement.md` **同时含**「编译得过」与「打中唯一」两条纪律的可判定表述（判据：含字符串「变异」且含「编译」且含「唯一」——三者缺一即不通过）；
2. 同一文件仍含原有四段（TDD 铁律 / 测试三段律 / 日志与注释 / 修复熔断）的段标题——**新增不得挤掉存量**；
3. `<tmp>/charter-implement.md` 字节数 **< 65536**（handoff `maxBlockSize` = 64KiB，`internal/discipline/resolver.go:23`）——**本轮实测现值 13520 字节，余量 79%**，本判据是回归防线不是风险点；
4. 新段落在 implement 正文里、**不在架构法附录里**——判据：`skills/architecture-law/SKILL.md` 的 diff 为空。

**④入口指针**：`skills/implement/SKILL.md`（43 行，建议落在「TDD 铁律」与「测试三段律」之间或「测试三段律」之后）、C4 卡 note 两条实录（`handoff card show C4`，事件 seq 1600 与 1650）。

---

### T3 — `skills/acceptance/SKILL.md` 形态①正文改引用式（不重写）

**①契约引用**：无契约面。spec 实现决定第 182-183 行：「acceptance 现有的形态①正文**改为引用式，不重写**——避免同一条纪律出现第二份副本（C6 卡文点名忌讳的形态）。协调者复验侧保留入口。」

**②意图与为什么**：形态①今天的正文在 `skills/acceptance/SKILL.md:22`（「**变异必须编译得过。**删出一个编译错误不是证据……」）。T2 把它的完整版落进 implement 后，若 acceptance 原样留着，同一条纪律就有了两份可独立漂移的副本——**这正是本批要治的那一族的另一种形状**。

**关键结构事实（本轮复核）**：`acceptance` **不在** compose 映射里（`scripts/regen_discipline.py:26-34` 的七个键：contract/breakdown/plan/implement/review/integrate/recon），因此 **acceptance 的任何改动都不产生纪律块**。后果：**T3 的落地证据无法由 C6 的比对能力覆盖**（spec 第 216-217 行说「C4 的落地证据由 C6 的比对覆盖」，那句话对 T2/T4 成立，对 T3 不成立）。T3 的验收只能是文本级。这条差别必须显式认账，不能让下游误以为三个正文 task 的验收同构。

**③验收**：
1. `skills/acceptance/SKILL.md` 第 2 节**不再含**「变异必须编译得过」这条纪律的独立正文（判据：该节不再出现「删出一个编译错误不是证据」这类展开表述），改为一行指向 implement 变异自验段的指针；
2. 该节其余两条（变异点选**本次交付的承重行为**、转红须含**声明缝上那支**）**逐字保留**——它们是协调者复验侧的判据，不属形态①；
3. 红旗表第 43 行「变异删掉整段实现，测试红了 → 若红的是编译错误，证据无效」**保留**（spec 授权的「协调者复验侧入口」）；**是否为形态②补一行红旗 = F-7，待拍板**；
4. `scripts/regen_discipline.py` 的 compose 映射 **diff 为空**——本 task 不得顺手给 acceptance 加纪律块（spec Out of Scope 第 6 条：「acceptance 节点纪律块化」超出本批）。

**④入口指针**：`skills/acceptance/SKILL.md:18-24`（第 2 节）、`:38-44`（红旗表）、`scripts/regen_discipline.py:26-34`（compose 映射，本 task 的**禁改**对象）。

---

### T4 — `skills/plan/SKILL.md` 判据段扩写（C4 形态③④）

**①契约引用**：无契约面。spec 实现决定第 184-185 行：形态③④→ plan 判据段扩写，「作为 `skills/plan/SKILL.md:20`『判据先在基线跑』的**两个具体化**，不另起炉灶」。

**②意图与为什么**：形态③④与①②不同族——**①②是执行者做变异时的坑，③④是协调者写判据时的坑**（C4 卡文自陈，事件 seq 1709）。现有第 20 行的「判据先在基线跑」对形态④是**部分覆盖**（真跑了就会发现那个类型不存在），对形态③**完全无效**——「cmd/ 图内文件数 41→50」这类判据在基线上跑得通，它坏在**代理错了目标**，不坏在跑不通（执行者补了 40 个零边节点，文件数精确达标，而 who-calls/chain 依然一无所获）。

要落的两条：
- **形态③ 判据要钉住行为，不钉住计数**——写下一条计数型判据时先自问「满足它的**最省力方式**是什么，那个方式达成目标了吗」；
- **形态④ 跨仓判据落笔前先确认目标仓钉的依赖版本里有这个能力**——尤其是自己刚在上游加、尚未发版的东西，最容易想当然（实录：判据写「anchor-off-\* warn = 14」，而 handoff 钉的 graph 版本里根本没有这个类型）。

**③验收**：
1. `python3 scripts/regen_discipline.py --out <tmp>` 后，`<tmp>/charter-plan.md` 含形态③的可判定表述（判据：含「最省力方式」这一自问句式）与形态④的可判定表述（判据：含「目标仓」且含「版本」）；
2. 两条落在「每个实现类 task 必含的步骤」第 1 条（`skills/plan/SKILL.md:20`）**之下作为其具体化**，不新起顶级章节——判据：文件的顶级 `##` 标题集合与改动前**逐字相同**；
3. 「五项检查」「跨卡审计」「派发前自审」「红线」「自审三查」五节**逐字未动**（判据：这五节的 diff 为空）；
4. `<tmp>/charter-plan.md` 字节数 < 65536（现值 7113，余量 89%）。

**④入口指针**：`skills/plan/SKILL.md:18-27`（「每个实现类 task 必含的步骤」+ 最薄路径条）、C4 卡 note 事件 seq 1709。

---

### T5 — 接缝：`nodes_equivalent` 先红后绿

**①契约引用**：C-11（判据 = 只比 `nodes`，必要且充分）、C-12（噪声字段已由 `load_ledger_def` 剥离）、C-13（解析后对象比较，不做字节比对）、**D-2（禁止在 charter 侧复刻 `withStatesFromNodes`）**；签名冻结于 `scripts/charter_provision.py:61-73`：`nodes_equivalent(repo_def, ledger_def) -> (bool, list[str])`。**本批唯一接缝**（spec 测试决定第 195-207 行）。

**②意图与为什么**：这是「账本和仓漂了没有」这个问题的**全部判定逻辑**，也是下游一切测试的地基。它必须做到两件互相拉扯的事：**噪声不报**（否则比对命令变成狼来了，spec 第 204-205 行）与**真差异必报且指路**（「知道漂了但不知道漂在哪」是 B229 与 C6 都吃过的亏，spec 第 206-207 行）。

**结构不对称要处理**：仓侧 def 只有 `nodes` 一个键（D-1），账本侧 Def 有 `states`/`gates`/`nodes` 三个键（**本轮实读确认**）。函数两侧都只取 `["nodes"]`，仓侧缺 `states` **不算差异**。

**③验收**——**四条缝级断言，一条不能少**（前两条来自 spec，第三条是 R-1 的加严提案，第四条是 D-2 的锁）：

1. **噪声不报**：一对语义等价、但键序不同（且按 F-3 (b) 裁决时：一侧显式写 `"dispatch": false`、另一侧省略该键）的输入 → 返回 `(True, [])`；
2. **节点集合/顺序差异必报且指名**：一对 `nodes` 差在「多一个节点」或「两个节点顺序对调」的输入 → 返回 `(False, [...])`，且差异清单**含那个节点的名字**（判据：`any("<节点名>" in line for line in diffs)`）；
3. **节点 gate 差异必报且指名**：一对 `nodes` 差在某节点 `gate.require_attachment` 取值的输入 → 返回 `(False, [...])`，且差异清单**同时含节点名与字段名 `gate`**；
4. **【D-2 的锁 · 反向断言】**：一对 `nodes` **完全相同**、而 `states`/`gates` 键**故意矛盾**的输入 → 返回 `(True, [])`。这支测试的作用是让「顺手也比一下 states」这个动作**必然变红**；没有它，D-2 这条承重决定在仓里没有任何测试锁着。

**红绿与变异自验**（本 task 自我适用 T2 刚落的纪律，是本批的狗粮点）：
- 先写上述四条断言 → 跑红（现状抛 `NotImplementedError`，红因是**功能缺失**不是拼写错）→ 最小实现 → 跑绿；
- **变异复验**：把实现里「取 `nodes` 子树」改成「取整个 def」（**保编译、改语义、非整行删除**，符合形态①的手法要求），断言 **1 与 4 必须转红**（因为仓侧无 `states` 键、账本侧有）；还原回绿。变异前先断言该文本在文件中**命中唯一**（形态②）。

**④入口指针**：`scripts/charter_provision.py:61-73`（缝函数骨架与其注释里的 D-2 禁令）、`docs/contracts/2026-08-24-charter-provisioning-contract.md` C-11 / D-2 / R-1、测试文件落点待 F-1 裁决。

---

### T6 — `install()` 实现

**①契约引用**：C-7（顺序 template→workflow→regen，以 `INSTALL_ORDER` 常量落码，`scripts/charter_provision.py:29-32` 已在）、C-1/C-8（两条 put 都只吃 Def，仓内真源可直接 `--file`）、C-6 第 5 条（dispatch 节点所引模板必须已存在——顺序的成因）。

**②意图与为什么**：把「换机后凭记忆手搓 12 列 4 门」变成一条命令（spec 用户故事 1）。

**顺序的第二个理由（本稿新增论证，请下游 plan 把它写进注释）**：C-7 的顺序不只是**必要条件**，还恰好是**失败代价最小**的顺序。账本**没有 delete**（`handoff workflow --help` 仅 list/migrate/put/show），任何 put 都永久留一版、不可回滚。先 template 后 workflow 时，若 workflow 校验失败，账本只多一版**无害的 template**（版本不可变、旧版仍在、无人引用新版就不生效）；反过来则会留下一条**引用不存在模板的坏工作流**。**两个理由指向同一个顺序，是巧合但值得记下来**——记不下来，将来有人为了「先建流再建模板更符合直觉」去调顺序时，只会撞上第一个理由，改不动就可能去动别的地方。

**③验收**：
1. **顺序不可颠倒（承重属性，须有能变红的测试）**：mock 掉 subprocess，断言 `install()` 实际发出的命令序列中 `template put` **严格先于** `workflow put`，`regen` 最后。**只断言 `INSTALL_ORDER` 常量的次序不算数**——那锁的是常量，不是行为；
2. **半装报文**：mock 让 `workflow put` 返回非零 → `install()` 退出码非 0，且 stdout **同时含**「template 已完成」与「workflow 未完成」两个事实，并**明说重跑是安全的**（重跑只会再新增一版，不会写坏）；
3. **regen 失败是硬失败**：mock 让 regen 抛异常 → `install()` 退出码非 0 且点名 regen（**不得吞掉**）；
4. **版本与在途卡提示**：成功路径的 stdout 含新版本号，且含「在途卡仍钉旧版本，需 `handoff workflow migrate`」的提示。**依据**（API 事实，无需真机）：卡持有 `workflow_version` 字段且不自动跟随——本轮读 C4 卡实证：卡为 v7，账本为 v9，且卡上有显式 `workflow_migrated` 事件（seq 2156/2235/2290/2339）；
5. **仓路径可见**：stdout 打印本次安装所用的 `REPO` 绝对路径。**理由**：`~/.claude/skills/charter` 是指向 `/Users/xushixin/workspace/charter` 的**符号链接**（本轮 `ls -ld` 实证），而本批在 worktree 里改——从哪个 checkout 跑 install，装进本机的块就来自哪个 checkout，不打印出来事后无从追。

**④入口指针**：`scripts/charter_provision.py:76-78`（`install` 骨架）、`:29-32`（`INSTALL_ORDER`）、`:17-24`（路径常量）。

---

### T7 — `check()` 实现

**①契约引用**：C-3（取 `.Def`）、C-11/C-12/C-13（比对判据与噪声）、D-2（不复刻投影）、R-3（「哪一样」归本函数的三段结构，字段级差异归 `nodes_equivalent`）。

**②意图与为什么**：spec 用户故事 2——「怀疑漂了时，一条命令告诉我漂在**哪一样**、**哪个字段**，而不是让我肉眼比对两份 JSON」。三样东西各比一段：workflow（走 T5 的缝函数）、template（F-2 裁决的方式）、纪律块（按当前仓正文 regen 到临时目录，与已装块逐文件比对——**这正是 T1 参数化的消费方，也是 C4 落地证据的验证路径**，spec 第 216-217 行）。

**③验收**：
1. **一致路径**：在与账本一致的仓上跑 `check`，退出码 0，stdout 三段各报一致。**本轮已实测该状态成立**（repo nodes == ledger v9 nodes 为 `True`，template Def == 仓内 template 为 `True`），故这条判据今天就该绿；
2. **漂移路径必指路**：临时改一份仓内真源的某节点 `next` 取值后跑 `check` → 退出码为「漂移」码，stdout **含节点名与字段名**；
3. **未安装 ≠ 漂移**：mock 让 `handoff workflow show` 以「找不到」失败 → 退出码为「未安装」码（F-5 裁决具体值），报文可行动（「跑 `charter_provision.py install`」），**不得**报成漂移，**也不得**让 `CalledProcessError` 裸抛栈；
4. **【承重属性 · 单向性的锁】`check` 绝不写账本**：mock subprocess，断言 `check()` 全程发出的命令中**没有任何 `put`**。这是「check 是只读诊断」这一承诺的唯一能变红的锁；
5. **纪律块比对**：把已装的某个 `charter-*.md` 手工改一个字后跑 `check` → 报纪律块漂移并点名是哪个块（判据：stdout 含该块文件名）；
6. **多出来的键要指名**：账本侧 Def 出现仓内没有的键时（模拟 handoff 升级给 `NodeDef` 加了带非零默认的新字段），差异清单必须**指名那个键**。**理由**（API 事实，非行为事实，无需真机）：Go 侧全字段 `omitempty`，零值新字段会被省略、无影响；只有**带非零默认的新字段**才会浮现，此时报文必须让人一眼分清「handoff 升级了」还是「真漂了」——契约欠账 2 明说 `NodeDef` 未逐字段冻结，这条判据是那笔欠账的运行期缓冲；
7. **F-8 若拍 (a)**：每个 dispatch 节点的 `override.discipline` 在纪律块目录有对应文件，缺失即报——且**只覆盖 `nodes[*].override.discipline`，不覆盖模板缺省值**（F-6 选 (c) 时缺省值故意无文件）。

**④入口指针**：`scripts/charter_provision.py:81-83`（`check` 骨架）、`:41-58`（`load_ledger_def`，含 agentd INFO 日志混入的处理）、`scripts/regen_discipline.py`（T1 后的可调用面）。

---

### T8 — 收尾：跑 regen + 全量自检

**①契约引用**：契约「收尾自检」第 3 项的三条命令（本批沿用作回归）。

**②意图与为什么**：C4 的落地要真正生效必须跑一次 regen（spec 第 190-191 行：「纪律块内容改动后必须重跑 regen」）；本 task 同时是 implement 三段律的「每个 task 收尾：全量编译/类型检查」在 Python 仓里的对应物。

**③验收**：
1. `python3 -m py_compile scripts/charter_provision.py scripts/regen_discipline.py` 退出码 0；
2. 测试全绿（跑法待 F-1 裁决）；
3. `python3 scripts/regen_discipline.py` 无参跑通，7 个块刷新且权限 `0600`；
4. `python3 scripts/charter_provision.py check` 退出码 0（**前置**：本机已按当前分支正文装过，见真机清单 M-1/M-5 的次序坑）；
5. `flows/charter.workflow.json` 与 `flows/charter-default.template.json` 仍是合法 JSON 且顶层键分别为 `['nodes']` 与五/六键（F-6 若改 discipline 取值，键集合不变、取值变）。

**④入口指针**：`docs/contracts/2026-08-24-charter-provisioning-contract.md` 第 242-265 行（收尾自检的三条命令原文）。

---

## 五、缺陷族对抗审查

按 `defect-families` 逐族正面设问。**无风险的写「无，因为……」**。

### 通用五族

**1. 生命周期 / 状态机中断**

- **install 中途宿主进程被杀**：三步中任一步之后中断，账本停在**半装**状态。**没有孤儿资源**（版本不可变，多一版无人引用即不生效），但**不可回滚**——`handoff workflow` 命令族**没有 delete**（契约欠账 1 已认，本轮复核 `cmd/workflow.go` 的 init 确认只挂 list/show/put/migrate）。**处置**：T6 判据 2 要求半装时的报文说清「已完成到哪一步 + 重跑安全」；**收尾归重跑，不归回滚**。
- **regen 中途失败是最坏的半装**：regen 逐文件写（`scripts/regen_discipline.py:36-41`），写到第 4 个失败 → 3 个新块 + 4 个旧块，**且今天它不返回退出码语义、无临时文件+rename 的原子写**。T6 判据 3 要求把 regen 失败当硬失败并点名；**给 regen 加原子写属范围扩张，本期不做，落 `docs/roadmap.md`**。
- **在途卡的孤儿形态**：卡钉 `workflow_version`，install 新增版本**不迁移在途卡**（C4 卡实证：卡 v7 / 账本 v9）。孤儿的表现不是资源泄漏而是**「装了新流程，跑的还是旧的，无告警」**。谁收尾：**协调者**，动作是 `handoff workflow migrate`。T6 判据 4 把这件事从「靠记忆」变成「install 会告诉你」。
- **charter 侧脚本自身无持久状态**，无临时目录残留（T7 的 regen 临时目录用 `tempfile` 上下文管理器即可）。

**2. 静默失败 / 误导报错**

- **每条错误路径的传播契约**：`load_ledger_def` 已有 `RuntimeError`（`scripts/charter_provision.py:58`）；新增三条要求——`handoff` 不在 PATH（`FileNotFoundError`）要翻译成可行动报文；`workflow show` 报「找不到」要走**未安装**分支而非漂移分支（T7 判据 3）；`CalledProcessError` 不得裸抛栈。
- **「报成功但没做」的窗口**：存在一个真实的——`check` 报一致**不等于流程能跑**。nodes 一致只证明定义一致，不证明所引模板存在、纪律块文件存在。F-8 就是为封这个窗口而提的。**若 F-8 拍 (b)（不核），这个窗口就是本期明确保留的敞口，须落 roadmap。**
- **规范化会不会吃掉真差异（F-3 (b) 的假绿风险）**：**不会**。剥零值与 Go `omitempty` **一一对应**——`max_rounds: 0` 在 Go 侧本就等价于「用包内默认」（`internal/ledger/types.go` NodeDef 注释原文），`dispatch: false` 等价于缺失。剥掉的是**在 wire 上已经不可区分的东西**，不是语义。
- **check 在 worktree 上必报纪律块漂移**：本机块由 `~/.claude/skills/charter`（**符号链接 → `/Users/xushixin/workspace/charter`**，即 master 工作树）的正文装入；在 worktree 改完正文跑 check，**会报漂移，而这是正确行为**（确实漂了）。但报文若不打印仓路径，读的人会以为是 bug。T6 判据 5 / T7 报文要求打印 `REPO` 路径正是为此。

**3. 跨平台假设**

- **`~/.handoff/discipline` 硬编码**（`scripts/regen_discipline.py:9`）：handoff 的 `DataDir` **是可配的**（`internal/config/config.go:46`，来自配置文件而非环境变量——本轮 grep 确认无 `HANDOFF_DATA_DIR` 之类环境变量）。DataDir 非默认时 regen **会装错地方且无告警**。本期不做发现逻辑；F-9 的参数化至少给出手动覆盖口；**「从 handoff 配置发现 discipline 目录」落 roadmap**。
- **`os.path.expanduser("~")` 与 `0600` 权限**在 Windows 上语义不同。handoff 主要在 macOS/Linux 用，**本期不承诺 Windows**，明确记一句即可。
- **`subprocess.run(["handoff", ...])` 依赖 PATH**：见上一族。
- 无其它平台假设——脚本不起进程组、不动权限模型、无 webview。

**4. 假红 / 假绿测试**

- **验收判据是不是中途副产物**：T2/T3/T4 的判据**刻意不写「新增 ≥N 行」**（那正是形态③的代理指标型假达标），改写成「块里含哪几条可判定表述」。T5 判据 2/3 要求差异清单**指名到节点与字段**，不接受「返回了 False」。
- **反面断言（稳定假绿的温床）**：**本批有两条**——T5 断言 1（等价判等价）与 T5 断言 4（states 矛盾仍判等价）。**单独都能被 `return True, []` 满足**。防线：断言 2/3 与它们**必须成对存在**，四条一起才有牙。**这一句要写进下游 plan，否则将来有人删掉断言 2/3 时，剩下的两条会安静地全绿。**
- **负载/并发下会不会翻红**：无并发面（单进程、顺序执行三条命令），**无，因为**脚本不起线程、不并发调 handoff。
- **夹具里的行为假设有没有真机项对应**：有，且是本批最大的一处——T5/T6/T7 的全部 mock 断言都在假设「`handoff workflow put` 真的会按 C-1~C-8 的规则接受我们的文件」。**这个假设本轮完全没有真机验证过**（契约欠账 1 刻意不做）。对应真机项 M-1~M-4。
- **锁的是调用方依赖的行为还是内部帮手**：`nodes_equivalent` 是 spec 声明的缝，其调用方是 `check()` 主流程与测试——锁的是**调用方依赖的行为**。换实现（比如把差异清单从 list 换成生成器）会红，但那是签名变了，**契约已冻结签名**，属正当的红。

**5. 门禁绕过**

- **新增写路径过没过门**：install 是本批唯一的写路径，写的是**handoff 账本**。过的是**对侧的门**：workflow put 过 `validateNodes` 10 条（C-6），template put 过 CLI 三字段必填（**C-8 经 R-2 更正后的准确表述**）。**charter 侧不设自己的门——这是刻意的**：本地复刻 `validateNodes` 就是 D-2 禁令的同族违反（造第二份会漂的对侧逻辑副本）。**替代防线是顺序**：先 template 后 workflow，使校验失败时的残留代价最小（见 T6 的第二个理由）。
- **门覆盖的是全部表面吗**：**不是，且这是本期明确承认的敞口**。改流程有两个入口——「改仓再 install」（合规）与「直接 `handoff workflow put`」（绕过）。**charter 侧无法技术性堵住第二条**，handoff 是通用工具、不认识 charter。唯一防线是 `check` 事后能发现 + 单向纪律写进文档（spec 第 125-126 行）。**须落 roadmap，不假装已解决。**
- **TOCTOU**：仅在 F-4 拍 (b)（幂等）时存在——check 与 put 之间另一个进程可能已 put 新版。**后果仅是多一版，无损坏**，可接受；须在注释里写明。F-4 拍 (a) 则无此窗口。

### 追加设问（命中必答）

**序列化边界** —— **命中**。本批不新增数据字段，但**新增了一条完整链路**：
```
flows/*.json → json.load → subprocess → handoff json.Unmarshal → SQLite
            → json.Marshal → handoff show → json.loads → 取 .Def → 取 .nodes → 比对
```
链路上的**手写序列化/投影共三处**，逐处点名并配断言：

| # | 位置 | 投影动作 | 断言 |
|---|---|---|---|
| P1 | `scripts/charter_provision.py:35-38` `load_repo_def` | 无投影（直接 `json.load`） | T8 判据 5（真源仍是合法 JSON、顶层键正确） |
| P2 | `scripts/charter_provision.py:41-58` `load_ledger_def` | **取 `["Def"]`** + 从混入 agentd INFO 日志的 stdout 里挑最后一行合法 JSON | T7 判据 3（挑不出时的报文可行动）；真机 M-1 覆盖真实输出形状 |
| P3 | `nodes_equivalent` 内 | **取 `["nodes"]`** | T5 全部四条断言 |

**roundtrip 属性测试**：本批**可以做，但只能落真机**——「`repo_def` 经 put→show→取 Def→取 nodes 后与 `repo_def["nodes"]` 等价」这条属性需要真的写一次账本，而写入不可逆（无 delete）。故它是**真机项 M-1 的断言形态**，不是单测。**这一点要显式写进下游 plan，免得有人为了凑「roundtrip 属性测试」的推荐武器而去 mock 一个假的 handoff，那就是夹具编码了一个不存在的世界。**

**可空类型区分「字段缺失」与「值为零」**：**在本批不可能做到，且不应该做**——Go 侧 `NodeDef` 全字段 `omitempty`，wire 上两者已被抹平。这是 F-3 推荐 (b) 的决定性论证，不是疏漏。

**跨语言契约另一侧**：Go `NodeDef` ↔ charter JSON，**未逐字段冻结**（契约欠账 2）。后果与缓冲见 T7 判据 6。

**枚举新值过既有白名单** —— **无，因为**：本批不引入任何新枚举取值。workflow JSON 的取值域（节点名 12 个、attachment kind、7 个 discipline 名）全部是**导出物**，与账本 v9 逐字相同（本轮实测 `nodes equal: True`）。**唯一候选是 F-6 (c) 的哨兵 `charter-unset`**——它**故意**不在 `builtinByName` 白名单里（那正是它的作用）；本轮已逐个核过它经过的其它白名单：`resolvePath` 只拒路径分隔符与 `.`/`..`（C-10，`internal/discipline/resolver.go:191-197`）、`template put` 只查非空（R-2）、`validateNodes` 不看 discipline 取值（C-6 十条无一涉及）。**故它全程合法，直到派发时在 `ByName` 第 3 段响亮报错——这是设计意图，不是通道分裂。**（此结论依据可 grep 的 API 事实，不需真机；但「响亮」的实际观感列为真机项 M-6。）

**承重安全属性有测试锁住** —— **命中三条，逐条给锁**：

| 承重属性 | 出处 | 能变红的锁 |
|---|---|---|
| **单向性**：`check` 只读、绝不写账本 | spec 第 121-126 行「仓是唯一真源」 | **T7 判据 4**（mock 断言无任何 `put`） |
| **安装顺序不可颠倒** | C-7 | **T6 判据 1**（断言实际命令序列，**不是**断言常量） |
| **比对不复刻投影** | D-2 | **T5 断言 4**（states 矛盾但 nodes 同 → 判等价）——**本稿新增的第三条缝级断言，理由见 R-1** |

三条今天**一条锁都没有**。没有锁的属性，acceptance 的变异复验没有对应测试可红，会在后续「顺手优化」中无声失守。

---

## 六、真机清单（未验证，需真机 —— 归协调者执行）

| # | 项 | 为什么机内验不了 | 不可逆性 |
|---|---|---|---|
| **M-1** | install 三连在真账本上跑通 → `workflow` 到 v10、`template` 到 v5；随后 `workflow show charter` 的 `.Def.nodes` 与 `flows/charter.workflow.json` 的 `nodes` 语义等价（即 roundtrip 属性） | 「put 真的按 C-1~C-8 接受这份文件」是行为事实；本轮全部结论来自读源码，契约欠账 1 刻意未做 | **不可逆**：永久 +1 版，账本无 delete。契约已议定：对 `charter` 自身回灌，产生 v10、内容与 v9 等价、不新增流 |
| **M-2** | 装完后卡能在新版流上正常 move；并确认在途卡仍钉旧版、需 `workflow migrate` 才用上新版 | 状态机行为事实 | 只读 + 一次 move，可逆 |
| **M-3** | **C-7 负例**：把一份引用**不存在模板**的 workflow 定义喂给 `put` → 必失败，报文形如「节点 X 引用的模板 Y 不可用」 | 校验行为事实 | **零残留**——失败即不写入，安全 |
| **M-4** | **R-2 负例**：把一份 `discipline` 为空串的 template def 喂给 `put` → 必失败「executor/prompt/discipline 三者必填」 | 同上 | **零残留**——CLI 层拒绝，未触及账本 |
| **M-5** | 跑 regen 后**真派发一次**节点，确认执行者读到的纪律块含 T2/T4 的新段 | 「执行者真的读到」是行为事实；文件里有 ≠ 注入到了 | 一次真实派发 |
| **M-6** | **F-6 若拍 (c)**：裸 `handoff dispatch --template charter-default`（不经工作流节点）确实因未知纪律块名失败，报文可行动 | 验证「响亮失败」确实响亮 | 一次失败派发 |
| **M-7** | 确认主会话读的 skill 正文来自哪个 checkout：`~/.claude/skills/charter` 是指向 `/Users/xushixin/workspace/charter`（master 工作树）的符号链接（**本轮 `ls -ld` 已证**），故**在 worktree 跑 regen 会让本机纪律块领先于主会话读到的 skill 正文**，直到分支合并回 master | 「主会话此刻实际加载的是哪一份」是运行期行为事实 | 只读 |

**M-7 的次序坑（请协调者注意）**：本批的 T8 判据 4（`check` 退出码 0）与 M-7 冲突——**在 worktree 上，改完正文而未合并回 master 时，check 报纪律块漂移是正确的**。T8 判据 4 的正确前置是「已在本分支跑过 install/regen」，或把该判据推迟到 finish 节点合并后执行。**这是一个需要协调者在 acceptance 排序时消化的约束，不是缺陷。**

---

## 七、落 roadmap 的残余项（本期明确不做）

1. 给 `regen_discipline.py` 加原子写（临时文件 + rename），消除「写到第 4 个失败」的半装。
2. 从 handoff 配置**发现** discipline 目录，替代硬编码 `~/.handoff/discipline`（DataDir 可配，见跨平台族）。
3. **绕过入口的敞口**：直接 `handoff workflow put` 改账本无法被技术性堵住，只能靠 `check` 事后发现 + 文档纪律。
4. **F-8 若拍 (b)**：「check 报一致 ≠ 流程能跑」的窗口本期保留。
5. **观察项（handoff 侧，建议开卡，不在本批做）**：`internal/agentd/ledgerapi.go:126` 的 `ledgerNodeWire` 投影 `NodeOverride` 时**丢掉了 `Purpose` 字段**（`internal/proto/ledger.go:59-64` 的 wire DTO 只有 executor/discipline/target/model，无 purpose），而 `internal/ledger/types.go:169-177` 的 `Purpose` 注释里记着 B183 的教训（「审阅轮从卡基线开了条新分支，等于从未审阅过工作分支」）。**本批不受影响**——`handoff workflow show` 直读账本（`cmd/workflow.go:59-68` 用 `openLedger()` + `st.GetWorkflow`），**不过 wire 投影**，本轮实测 `template equal: True` / `nodes equal: True` 也印证了这一点。但**若将来 check 改走 agentd HTTP 面，会因这处丢字段而假报漂移**；而「派发路径是否受影响」需读 agentd 侧的实际取值路径才能定论——**未验证，需真机**。

---

## 八、交稿自检（逐项核对）

1. **产出四样齐全** —— ✅
   - 子系统清单：2 个，各带类型（S1 逻辑型 / S2 边界型），派卡资格四条逐条核过；
   - 契约增量核对：C-1~C-13 **逐条**有结论，其中 C-8 与 C-11 命中问题、已回写 R-1/R-2/R-3 进契约文档；上游状态位已实读核对；
   - 任务清单：T1~T8 **全部四段式**（契约引用 / 意图与为什么 / 验收 / 入口指针），判据全部行为化、独立可验（如 T2 判据刻意避开计数型、T6 判据 1 明确拒绝「只断言常量」）；
   - 缺陷族对抗审查：通用五族 + 三条追加设问**逐族有答案**，无风险的两处写成「无，因为……」（并发面、枚举新值）。
2. **「待拍板」岔口集中列成清单放稿首** —— ✅ 第一节 F-1~F-9 共九条，另有两项「判定为不构成岔口」的显式交代。正文中凡出现岔口影响处均回指编号（如 DAG 里标注 F-4 裁决的影响、T7 判据 7 标注依赖 F-8）。
3. **「未验证，需真机」条目已汇总成真机清单** —— ✅ 第六节 M-1~M-7，逐条给「为什么机内验不了」与不可逆性；M-3/M-4 明确标注零残留（可安全执行），M-1 标注永久 +1 版。roadmap 第 5 条的观察项也带真机标注。
4. **每张卡/task 的有界文件集核过** —— ✅ T1~T8 每条的「入口指针」即其有界文件集，全部圈得出（最大一条 T7 触及 2 个脚本文件）。**无一条需要插竖切还债卡**——架构法第三条的三个升格信号（前缀家族 ≥5 文件 / 单包 ≥40 文件 / 单元 >2~3 万行）在 `scripts/`（**2 个文件**）与 `skills/`（每目录 1 个 SKILL.md）上**全部未命中**。

**符号锚**：charter 仓无 `codegraph/`，`codegraph resolve --doc` 不适用，本文档全部引用为 `文件:行` 形式，行号会漂；下游复核请按符号名（`nodes_equivalent` / `install` / `check` / `validateNodes` / `withStatesFromNodes` / `ByName` / `resolveDisciplineFor` / `ledgerNodeWire`）定位。
