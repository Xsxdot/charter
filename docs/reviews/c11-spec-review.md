# 审查：C11 spec（charter_provision 纪律块比对改对账本）

- **判决**：**修订后再批**
- **审查对象**：`docs/superpowers/specs/c11.md`（状态「待独立审查」；台账 `docs/ledgers/2026-08-28-c11-spec-ledger.md`）
- **审查者**：零实现上下文。不改 spec、不改测试、不改生产代码、不 commit、不跑 `handoff discipline put`。
- **日期**：2026-08-28
- **工作树**：charter `fix/c11-provision-ledger`，对照 `origin/master` `67c47c7e`（与 spec 头一致；本分支 refs 仍停在该提交，spec/台账尚未入提交）
- **对侧消费面**：handoff `origin/main` `f8e252ef3`（`b286-step-review` 工作树同点实读 `cmd/discipline.go`、`internal/ledger/disciplines.go`、`internal/agentd/discipline.go`）。活账本 `list`/`get` 本轮未实跑（约束禁止 put；审查环境无 CLI 探针），版本号读数以 spec 台账为准、不作为本判决的承重证据。

问题陈述成立：第三段仍比没人读的 `~/.handoff/discipline`，check 可以 7/7 绿而账本旧。方向也对：install/check 改对 `handoff discipline get/put`，幂等放 provision，不改 `PutDiscipline`。不能原样批准，是因为定级与法定抬级条件冲突，且几处承重语义仍能走出两种不兼容实现。

---

## 定级：spec 写 L2，审查改判 L3 轻档

spec 定级理由：不新增 handoff 契约面，只把第三段接到 B229 已冻结的缝 2；C-9 回写是文档对齐不是新 wire。

这与 `skills/spec/SKILL.md` **定级两问第 2 问**直接冲突：

> 实现或对接一个已存在的跨仓/跨进程 wire 契约，即便本侧零修改，也按「动契约层」计：单侧冻结的契约恰恰是查证纪律最不能省的地方。

本卡同时踩上两条抬级条件：

1. **对接跨仓 wire**：`handoff discipline get|put|list` 是 B229 缝 2 的 CLI（`cmd/discipline.go` 文件头点名「缝 2 的人手读写口」）。charter_provision 今天只消费 `workflow`/`template` 的 `show|put`（`charter_provision.py#load_ledger_def` / `install()`）。纪律族 stdout 不是 JSON（首行 `{name} v{N}` + 正文），put 是位置参数文件而不是 `--file`。这是新的消费面，不是「同一条 CLI 再加一个动词」。C4+C6 当初把 workflow/template 消费面冻成 L3 轻档（本仓契约 C-1~C-13），先例正是「本侧脚本对接 handoff CLI」。
2. **动冻结物**：方案第 5 条要回写 C-9，现状读数还要改 C-7 第三步语义。C-9 今天仍是「DataDir 文件三段式」（契约 `:130-144`），R-4 的哨兵运行期行为还是从那段推导出来的（`:360-362`）。改冻结条款不是 L2 能「顺手对齐」的。

工作量远低于轻/重档阈值（单文件脚本 + 测试 + 冻结物回写，不扇出）→ **L3 轻档**，不是重档。轻档仍要走 contract：把 get 解析、缺块/不可用分诊、put argv、比对面判据、C-9/C-7/R-4 回写冻住。这些恰恰是下面二解测试打中的东西。

若协调者坚持 L2，唯一合法出路是 **把本该进 contract 的语义全部写进 spec**，让这份 spec 承担冻结职责。当前文没有写满，留 L2 等于把 wire 交给 implement 发明——C4 审查 I-6（stderr「记录不存在」事后补 R-5）会再演一次。

不构成 L3 的部分，spec 说对了：不改 `PutDiscipline` 库语义、不重装 agentd、B286/C7/C8 不并入。那些是范围，不是定级。

---

## 现状读数核对

对照 charter `67c47c7e` 工作树实读。对则记 ✅，错则记 ❌ 并进 findings。

| spec 断言 | 活代码 | 裁决 |
|---|---|---|
| `install()` 第三步 `regen_discipline.regen()` 无参，写 `OUT=~/.handoff/discipline`，打印「纪律块：N 个已刷新」；不调 `discipline put` | `charter_provision.py:212-218` | ✅ |
| `check()` 第三段 `regen(tmp)` 后与 `regen_discipline.OUT` 同名文件比内容；缺目录/缺文件 → 「本机未安装」 | `:254-271`；文案是 `纪律块 {fname}: 本机未安装` | ✅ |
| `override.discipline` 存在性 `os.path.exists(OUT/{block}.md)`（约 286 行） | `:286-288` | ✅ |
| 哨兵 `charter-must-override` 故意无文件；F-8 只看 nodes 覆盖值 | `:274-276` 注释；`flows/charter-default.template.json:7`；七个 dispatch 节点均写 `charter-*`（`charter.workflow.json`） | ✅ |
| `regen_discipline.py` 头仍写「agentd 的 resolver 每次派发时现读盘…即全部生效」 | `regen_discipline.py:4` | ✅ |
| 契约 C-9 仍写 DataDir 三段式；handoff `internal/agentd/discipline.go` 包注释：B229 起目录不再读/写，file 端点拒服务 | 契约 `:137-144`；`discipline.go:1-12,30-35,105-127`（410 + 指路 `handoff discipline put/get/list`） | ✅ |
| `handoff discipline get <name>` stdout：首行 `{name} v{N}`，随后正文 | `cmd/discipline.go:64-70`：先打 `name vN\n`，再打 `Body`；正文无尾换行则 CLI **补一行** | ✅（补换行 spec 没写，见 I-5） |
| INFO 可能混进 stdout，与 `load_ledger_def` 同一形状 | `ledger.Open` 打 `账本库已打开`（`store.go:82`），`log()` = `slog.Default()`（`ledger.go:33`），CLI 账本族不 `logx.Setup`。Go 默认 slog 走 **stderr**。`load_ledger_def` 从 stdout 挑最后一行 JSON（`charter_provision.py:77-83`）；测试夹具 `_ledger_stdout` 把 INFO **人为塞进 stdout**（`test_charter_provision.py:123-127`） | ⚠️ 形状不同族（JSON vs 文本头+正文）；INFO 进 stdout 是夹具假设，不是纪律 CLI 的已证生产形状。见 I-5 |
| `handoff discipline put <name> <file>`：每次 INSERT 新版本；stdout 一行 JSON `{"name","version"}` | `PutDiscipline` 无内容去重（`disciplines.go:43-66`：`MAX(version)+1` + INSERT）；CLI `cmd/discipline.go:74-94`，文件是 **第 2 个位置参数**，不是 `--file` | ✅ |
| `test_check_never_writes_ledger` 走真 `check()` 纪律段，读真 `~/.handoff/discipline`（roadmap 18e） | `_run_check_with_ledger` 让 workflow/template `show` 成功，`check()` 落到第三段读 `rd.OUT`；断言 `kinds == ["workflow","template"]` 且 `rc==0`（`:154-169`） | ✅（第 40 行） |
| 同测试「今天它在 show 第一次就抛 NotInstalled，锁不住第三段」 | 这是 2026-08-24 审查 I-4 的旧账。现行测试已经修过，能走完三段（纪律段靠本机 OUT 绿） | ❌ 自相矛盾，见 I-2 |
| 块名 = `charter-{compose_map 键}`，与文件名去 `.md` 一致 | `compose_map()` 七键；workflow 七个 `override.discipline` 同名 | ✅ |
| C-7 第三步仍是 `scripts/regen_discipline.py` | 契约 `:103-107` | ✅ |
| 活账本七块、plan/contract/breakdown/review v2 其余 v1 | 未实跑 CLI | 未核。不挡方向 |

handoff 库层 spec **没写**、实现会撞上的：`maxDisciplineBody = 64KiB`、空/空白正文拒绝、名字禁路径分隔符（`disciplines.go:17-20,32-51`）。当前七块由短 skill 拼接，远低于 64KiB；put 失败已是硬失败。见 m-8。

---

## 二解测试

只列会改可观察行为、事实归属或不可逆成本的。局部实现选择不追。

### T1｜get 非 0 = 缺块还是账本不可用？（承重）

方案第 2 条并列三支：成功且正文相同 → skip；**不存在或正文不同** → put；**get 因账本不可用失败** → 退出 2、不盲 put。没有写怎么从同一次 `get` 的退出码/stderr 切开「不存在」和「不可用」。

- **解释 A**：沿 `load_ledger_def` / R-5：stderr 含「记录不存在」→ 缺块（install 对该块 put；check 记漂移、退出 1）；其余非 0 → `LedgerUnavailable`、退出 2。对侧活文案是 `纪律块 %s v%d: ledger: 记录不存在`（`disciplines.go:83` + `ledger.go:22`），子串与 workflow show 相同。
- **解释 B**：凡 get 非 0 都算「失败」→ 退出 2。空账本上七块 get 全非 0，**首次 install 永远装不上纪律块**。用户故事 2 死。

实现决定写了「与 `load_ledger_def` 同族」，但没把 R-5 的分诊子串和失效方向写进方案。两种都「按字面可做」。必须在 spec 里钉死 A，并写明 check 缺块是退出 1 不是 2。

### T2｜「正文」从哪一字节切到哪一字节？（承重）

- **解释 A**：去掉版本行，**之后全部字节**（含尾换行）对 regen(tmp) 文件逐字比。版本行按「请求的 name + ` v` + 数字」认，不按「stdout 物理第一行」认。
- **解释 B**：字面「首行名+版本，其余正文」。若 INFO 真在 stdout（spec 自己这么写），首行是日志，正文以 `charter-plan v2` 开头，**永远不等于** regen 产物 → check 恒红、install 永不 skip（用户故事 3 死）。
- **解释 C**：把整段 stdout（含版本行）拿去比 regen。同样恒不等。

「与 `load_ledger_def` 同样找得出合法块」是 JSON 的「最后一行能 `json.loads`」。纪律 get 不是 JSON，这句不能当解析规则。用户故事 1 要假绿锁、故事 3 要 skip，两条都依赖切法唯一。

附：CLI 在 body 无尾 `\n` 时会补一行（`cmd/discipline.go:67-69`）。regen 产物经 `body()` 总是带 `\n`。从本卡 install 进去的块，A 切法稳定。账本里若有人手 put、无尾换行的旧正文，check 报漂是对的（与仓 regen 不等）。

### T3｜F-8 存在性：get 还是 list？（承重偏弱）

方案第 4 条：「`discipline get {block}` 能取到（**或 list 含该 name**）即存在」。

- get：与第三段同一通道，缺块文案/退出码已有分诊（前提是 T1 已裁）。
- list：人读表（`名称\t最新版`，`cmd/discipline.go:37-46`），无 `--json`。再造一个表解析器，脆，且与「只经 CLI、同族 load_ledger_def」不一致。

测试决定 3（账本无、本地目录有同名文件仍报不存在）两种都能绿，但 list 解析失败时容易把「表头认不出」收成不可用（退出 2）或漏报。删掉「或 list」，存在性复用第三段已取到的名字/正文。

### T4｜install 第三步 argv（真取舍）

方案写 `discipline put <name> <tmpfile>`。`INSTALL_ORDER` 前两步是 `handoff {kind} put {name} --file {path}`。零上下文可能抄 `--file`。对侧 `ExactArgs(2)`，`--file` 会被当成文件名，读盘失败 → 第三步硬失败。方案字面已偏向位置参数；测试决定 2 没锁 argv。补一条接缝断言即可，不必再问用户。

---

## 假缝与缺失调用方

spec 假缝禁令写得对：不要为解析 get stdout 抽一个无生产调用方的纯函数。`load_discipline_body` 若作为与 `load_ledger_def` 并列的模块函数、且 **check 与 install 都调用**，算缝上符号。内部函数名本身是落点（spec 纪律：用户改不察觉的名字归 plan），L3 轻档的 contract 只冻语义不冻这个名字。

生产路径今天的调用方，改完之后必须还在：

| 行为 | 今天的调用方 | 改完后若消失即假绿 |
|---|---|---|
| 纪律段比对 | `check()` 读 `rd.OUT` | 必须改为 `discipline get`；`test_discipline_block_mismatch_is_reported`（`test_charter_provision.py:225-234` patch `rd.OUT`）必须退役或改打 get，否则锁的是旧判据 |
| F-8 存在性 | `os.path.exists(OUT/…)` | 必须改为账本；仅 patch `rd.OUT` 的测试锁不住「本地有文件、账本没有」 |
| 只读 | `test_check_never_writes_ledger` | 今天断言 `cmd[1] in {workflow,template}`，**纪律段零 CLI 调用**。改完后第三段必发 `discipline get`；若仍断言只有两种 kind，会逼实现不要 get，或让测试在发 get 时红——两种都不是这张卡要的锁 |
| `_run_check_with_ledger.fake_run` | `cmd[1]=="workflow"` 否则当 template，回 JSON `Def` | 未声明的调用方。`handoff discipline get` 会被当成 template JSON。check 第三段要么解析失败走退出 2，要么把 JSON 当正文报漂。所有「rc==0」的 check 测试在改第三段后会结构性坏掉，必须在测试决定里点名改这个 helper，不能只改那一支只读测试 |

`regen()` 无参写 `OUT`：spec 保留作调试入口、不再当安装/check 判据。生产调用方从 `install()` 撤掉是预期。`test_regen_to_tmpdir_leaves_home_untouched` 仍 `listdir(rd.OUT)`，本卡不必须动，但 18e 销账后它仍耦合本机目录存在——roadmap 16a 残留，不是本卡假缝。

缺失的测试调用方（接缝清单有行为、没有能打到新通道的锁）：

- install：账本已是最新则 **discipline 不 put**（今天 `test_idempotent_skips_put` mock 掉整个 `regen`，第三段零 put 是空转）。
- install：缺块或正文旧则 **discipline put 一次**，argv 为位置文件、无 `--file`。
- install：顺序 template → workflow → **discipline**（今天顺序测试在 mock `regen` 之后看不到第三段）。
- check：get 返回与 tmp 不同正文 → 退出 1 且点名块（负向假绿）。现存 OUT 补丁测试不是这条缝。
- check：第三段不得 put（只读锁要看见 `discipline get`，且断言无 `discipline put`）。

---

## Findings

### Critical

无。方向、单向、假绿牙、不改 handoff 库，这些成立；挡批准的是定级与承重语义未裁，不是方案整体走不通。

### Important

**I-1｜定级 L2 不成立，应改 L3 轻档（或把契约语义写进 spec）**

- 位置：spec `:5-18`；法定依据 `skills/spec/SKILL.md` 定级两问第 2 问；先例 C4+C6 契约头「L3 轻档」。
- 为什么承重：跳过 contract 就没有地方冻 get 解析、缺块分诊、put argv、C-9/R-4。下面 I-2~I-6 全是「L2 spec 把 contract 的活留下了」。
- 建议：头改定级 **L3 / 轻档**。范围仍单侧 charter。contract 冻消费面与冻结物回写，breakdown 轻档一轮，不扇出。若协调者裁留 L2，则本 spec 必须吸收下列最小补丁里所有契约语义，不得写「实现决定里同族即可」。

**I-2｜现状读数把现行只读测试写成了 2026-08-24 的假锁**

- 位置：spec `:40` 与 `:53` 互斥。
- 活代码：`test_check_never_writes_ledger` 经 `_run_check_with_ledger` 让两次 show 成功，第三段读真 OUT，断言 `rc==0` 且无 put（`:154-169`）。roadmap 18e（`:81`）描述的是这条现行耦合，不是「第一次 show 就 NotInstalled」。
- 「第一次 show 抛 NotInstalled」是 `docs/reviews/2026-08-24-charter-provisioning-review.md` I-4，**之后已经修过**。方案第 6 条用旧账论证「锁不住第三段」，会让 implement 以为只要避免早退，其实还要：① mock 掉 OUT；② 让 fake_run 认识 `discipline`；③ 负向打到 get 正文。
- 建议：删 `:53` 那句旧账。写明：现行锁已走完三段，但纪律段走文件系统、helper 不认识 `discipline`；本卡要把只读锁改到 get/put 通道上。

**I-3｜缺块 vs 不可用未裁，首次 install 可以按字面做成永恒退出 2**

- 位置：方案 `:47-50`、用户故事 2/6、测试决定 1「账本缺块 → 退出 1」。
- 证据：对侧缺块 stderr 含子串 `记录不存在`（与 R-5 同款）；契约 R-5 已把这条依赖的失效方向定为「拒绝动作不是盲写」。
- 建议：把 T1 解释 A 写进方案与测试决定。check：缺块 = 漂移/退出 1；不可用 = 退出 2。install：缺块 = put；不可用 = 退出 2 且该块不 put。禁止「get 非 0 一律退出 2」。

**I-4｜F-8「get 或 list」是未裁的第二通道**

- 位置：方案 `:51`。
- 建议：存在性 = get 成功（或复用第三段已解析的名字集合）。删「或 list」。测试决定 3 保持：账本无、`~/.handoff/discipline` 有同名文件 → 仍报不存在。

**I-5｜get 正文边界 + INFO 混入规则不够当唯一实现**

- 位置：现状 `:38-39`、实现决定 `:73-74`。
- 活代码：stdout 形状见 `cmd/discipline.go:64-70`；「同一形状」不成立（show 是 JSON 对象，get 是文本头+markdown）；INFO 进 stdout 只有测试夹具证据。
- 建议：写死 T2 解释 A。不要新 flag。INFO/日志行若出现在版本行之前则跳过；版本行之后的字节一律算正文，不再做「最后一行合法块」。测试夹具给 get 的 stdout 必须是 `"{name} v{N}\n" + 与 regen 相同的正文`，不要复用 `_ledger_stdout` 的 JSON。

**I-6｜C-9 回写未点名 R-4（以及 C-7）——冻结物调用方会断**

- 位置：方案 `:52`、OOS 未列 R-4；R-4 在契约 `:347-376`，运行期从 C-9 三段式推导哨兵必报错。
- B229 已改存续条件：`ResolveDispatch` 在 lookup 失败时 `未知纪律块名字 %q`（`internal/discipline/dispatch.go:80-82`），契约 §3.2 写明「查不到就退回 X」会让哨兵和缺陷三一起复活。charter 侧 R-4 仍在讲 `Resolver.ByName` 第 3 段和 DataDir 文件，回写 C-9 若不动 R-4，冻结物内部自相矛盾。
- C-7 第三步今天是 `scripts/regen_discipline.py`。spec 现状读数要改语义，方案第 5 条只点了 C-9。
- 建议：交付物列明 C-9 + C-7 + R-4（必要时 R-5 追记纪律 get 的同一子串）。C-9 改权威副本=账本、三段式标「已退役」；比对面单列纪律段判据（逐字比正文，不复用 C-11 的 nodes 规则）。R-4 改从 B229 §3.2 推导：哨兵不入账本 → 拒发；本卡 OOS 已禁装 `charter-must-override`，R-4 要写清这条仍是哨兵成立条件。

**I-7｜测试决定没覆盖将在改第三段时变成假缝/空转的存量测试**

- 位置：测试决定 `:78-97`；活代码 `test_charter_provision.py:130-145,154-169,225-234,253-271,273-289`。
- 建议：接缝清单补四句：① `_run_check_with_ledger` 按 `cmd[1]` 分诊 workflow/template/**discipline**，discipline 成功路径回文本头+正文，不得回 `Def` JSON；② 只读锁断言存在 `discipline get`、不存在任何 `put`（含 `discipline put`）；③ 负向假绿 mock get 成功但正文 ≠ regen(tmp)，退出 1 且报文含块名；④ install 顺序与幂等测试不得再把 `regen` mock 成空映射来「跳过」第三段——要么真 regen 到 tmp，要么 fake_run 捕获 `discipline put` 的 argv（`["handoff","discipline","put",name,path]`，无 `--file`）。`test_discipline_block_mismatch_is_reported` 的 `patch(rd.OUT)` 退役。

### Minor

**m-8｜未记 PutDiscipline 的 64KiB / 空正文 / 非法名拒绝**

库层硬拒绝（`disciplines.go:47-51`）。本卡「put 失败硬失败」已覆盖运行期。七块由 skill 拼接，量级远低于 64KiB。补一句约束即可：regen 产物必须低于 64KiB，超限不得在 charter 侧截断后静默 put。不必为本卡加压缩或拆块。

**m-9｜`load_discipline_body` 是内部落点**

实现决定点名模块函数。用户改这个名字无感，按 spec 纪律应归 plan。contract/L2 spec 只冻「check 与 install 共用同一处解析、禁止无调用方纯函数占缝」。

**m-10｜活账本 v1/v2 读数本轮未复跑**

台账与 spec 现状都写了 2026-08-28 list 读数。不挡方案。acceptance 真机项应再 list 一次，避免把手工补救当 install 基线。

**m-11｜B229 §3.3 与本卡幂等 skip 的差异未点明**

B229 契约 §3.3：「此后每次 regen 产出即 PutDiscipline 新版本」。本卡因库层不去重，改成 get 相同则 skip。这是正确的 charter 侧覆盖，不是对侧违约。建议在弃选/备注里点一句，避免 contract 回写时被「B229 说每次都 put」带回去。

---

## 最小补丁清单（批前必改）

改完这些可以再送审，不必重写问题陈述和用户故事。

1. **定级**：头改 L3 轻档；或书面裁留 L2，但把 2–7 全部写成 spec 正文里的唯一语义（视同本卡的冻结物）。
2. **现状**：删「第一次 show 抛 NotInstalled」。写现行只读测试已走完三段、纪律段读真 OUT、helper 不认识 `discipline`。
3. **分诊（T1）**：stderr 含「记录不存在」= 缺块；其余 get 非 0 = 不可用。check 缺块退出 1，不可用退出 2。install 缺块 put，不可用退出 2 不 put。
4. **正文（T2）**：跳过版本行之前的日志行；命中 `{请求名} v{数字}` 之后的全部字节 vs regen(tmp) 文件逐字比。版本行不算正文。不新 flag。
5. **F-8（T3）**：只按 get（或第三段缓存）判断存在；删「或 list」。
6. **冻结物**：C-9 权威改账本、三段式退役；比对面写纪律段逐字判据；C-7 第三步改为经 `discipline put` 入账本（顺序仍 template→workflow→纪律）；R-4 改 B229 §3.2 推导，哨兵禁止入账。
7. **测试决定**：改 `_run_check_with_ledger`；只读锁打到 `discipline get` 且无 put；负向假绿打 get 正文不等；install 锁顺序与 `put <name> <file>` argv；退役 `patch(rd.OUT)` 那支。
8. **一句约束**：put 侧 64KiB/空正文拒绝已存在，本卡不截断、不改库。

不需要扩 scope：真派 `--step`、重装 agentd、库层内容幂等、回写 `skills/`，保持 OOS。

---

## 结论

这张卡该做，假绿根因找得准，弃选（继续写 OUT、改 `PutDiscipline` 去重、md5 长度比）也站得住。独立审查不批准原样进入 plan/implement：**先改定级（L3 轻档，或 L2 但把 wire 写满），再裁 T1/T2/T3，并点名 R-4 与存量测试 helper**。补丁是短文案，不是换方案。

协调者若裁「消费已冻结 CLI 仍算 L2」，请把该裁决写回 spec 头并执行补丁 2–8；否则按法定两问走 L3 轻档，contract 节点冻 I-3/I-5/I-6 那几条即可。
