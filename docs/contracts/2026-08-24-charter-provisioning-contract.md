# 契约冻结：charter → handoff 安装面

- **卡**：C4、C6（合批）
- **上游 spec**：`docs/specs/2026-08-24-charter-provisioning-and-mutation-discipline-spec.md`（状态：已批准 2026-08-24）
- **级别**：L3 轻档
- **冻结日期**：2026-08-24
- **对侧仓库**：`github.com/Xsxdot/handoff`，查证副本 `/Users/xushixin/workspace/handoff`
- **对侧二进制**：`handoff` d0d868fdbbb4（`handoff status` 读数，CLI 与 agentd 同批）

本文档是本批的冻结物（charter 无 `codegraph/`，按 contract 节点「存量无图项目：契约增量
文档即冻结物」办）。下游 breakdown / plan / review 逐条对账。

**每条出处均为 handoff 仓本轮实读**，格式 `文件:行`。行号会漂，条目同时给出符号名。

---

## 一、写入面：`workflow put` 吃什么

### C-1 `put` 只吃 `WorkflowDef`，不吃完整对象

`cmd/workflow.go:79-82`（`wfPutCmd.RunE`）：

```go
var def ledger.WorkflowDef
if err := json.Unmarshal(raw, &def); err != nil {
```

`--file` 的内容被反序列化成 `ledger.WorkflowDef`，**不是** `ledger.Workflow`。

### C-2 `WorkflowDef` 的字段面恰好三个

`internal/ledger/types.go:243-247`（`WorkflowDef`）：

| JSON 键 | Go 字段 | 备注 |
|---|---|---|
| `states` | `States []string` | **派生字段**，见 C-5 |
| `gates` | `Gates map[string]Gate` | **派生字段**，见 C-5；key = 目标状态 |
| `nodes` | `Nodes []NodeDef` | 唯一真源，见 C-5 |

### C-3 `show` 的输出与 `put` 的输入**不同构**，不能直接回灌

`internal/ledger/types.go:250-255`（`Workflow`）**没有 json tag**，故按 Go 字段名序列化：

```
{"Name":…,"Version":…,"Def":{"states":…,"gates":…,"nodes":…},"CreatedAt":…}
```

而 `put` 吃的是上面 `Def` 的**内容**。转换规则冻结为：**取 `.Def`**。

### C-4 直接回灌完整对象会**硬失败**，不会静默写坏

`cmd/workflow.go:83-85`：

```go
if len(def.Nodes) == 0 && len(def.States) == 0 {
    return fmt.Errorf("写入工作流失败（定义文件里 nodes 与 states 至少给一个，节点模型下应给 nodes）")
}
```

把 `show` 的完整输出喂给 `put`，`Name`/`Version`/`Def`/`CreatedAt` 四个键在 `WorkflowDef`
上都无对应字段，`encoding/json` 默认丢弃未知键（未启用 `DisallowUnknownFields`），解出空
def，随即被本守卫拦下。**这是一条明确的安全网，不是运气**——下游若要做「回灌失败」的负例
测试，断言的就是这条报文。

### C-5 `states` 与 `gates` 是 `nodes` 的派生投影，写入时输入值被**整体覆写**

`internal/ledger/workflows.go:20-43`（`WorkflowDef.withStatesFromNodes`），由
`PutWorkflow` 在校验前无条件调用（`internal/ledger/workflows.go:156`）：

```go
d.States = states          // 按 nodes 顺序取 node.Name
d.Gates  = gates           // 取每个 node.Gate（DeepEqual 非空者）
```

`nodes` 非空时，文件里写的 `states` / `gates` **一律被丢弃并重算**。

**推论（本批的关键契约决定，见拍板记录 D-1）**：仓内真源**只存 `nodes`**。
存 `states` 是一个编辑陷阱——改它不报错、不生效。

**本轮可执行验证**（`flows/charter.workflow.json` 出稿时执行，零账本写入）：
以 nodes 复算投影，与账本 v9 现存的 `states`（12 项）与 `gates`（4 项）逐字比对，
`states 投影一致: True`、`gates 投影一致: True` —— nodes-only 对本数据无损。

### C-6 `nodes` 的校验规则（写入期强制，共 10 条）

`internal/ledger/workflows.go:101-151`（`Store.validateNodes`）。每条独立可判 pass/fail：

1. `节点名不能为空`
2. `节点名 %q 重复`
3. `Verdict` 为真时 `Dispatch` 必须为真（`:113`）
4. `Dispatch` 为真时 `Template` 必须非空（`:117`）
5. **`Dispatch` 为真时所引模板必须已存在于账本**——`s.GetTemplate(node.Template, 0)` 查不到即拒（`:121`）
6. `MaxRounds` 不得为负（`:125`）
7. `MaxRounds > 0` 时 `Verdict` 必须为真（`:128`）
8. `Produces` 非空时 `kind` 与 `path` 必须同时非空（`:132`）
9. `OnFail` 非空时 `Verdict` 必须为真（`:138`）
10. `Next` / `OnFail` 必须指向定义内存在的节点名（`:143-149`）

### C-7 安装顺序被 C-6 第 5 条钉死：模板必须先于工作流，纪律块随后入账本

`charter.workflow.json` 的 12 个节点中有 7 个 `dispatch: true`，全部引用模板
`charter-default`。安装顺序固定为：

1. `handoff template put charter-default --file flows/charter-default.template.json`
2. `handoff workflow put charter --file flows/charter.workflow.json`
3. 对 `compose_map()` 的每个 `charter-{name}` 执行 `handoff discipline get charter-{name}`：
   get 成功且正文与本次 `regen(tmp)` 完全相同则 skip；缺记录或正文不同则执行
   `handoff discipline put charter-{name} temp_file_path`，其中 `temp_file_path` 是位置参数，
   不是 `--file`。

顺序颠倒（先 workflow）在空账本上会因 dispatch 节点引用的模板尚不存在而失败。
纪律块使用 get-before-put 保证 provision 客户端幂等；对侧 `PutDiscipline` 每次 put
都会新增版本，本契约不改变该库语义。

### C-8 `template put` 无投影、无校验，忠实回灌

> **⚠ 本条已被修订 R-2 更正**：「无投影」成立；**「无校验」只对 store 层成立，CLI 层有三字段必填校验**。见文末「拆解节点回写的修订记录」。

`internal/ledger/templates.go:66-85`（`Store.PutTemplate`）：直接 `json.Marshal(def)`
后 INSERT，无 `validate*` 调用、无 `with*` 投影。故 `TemplateDef` 的往返是恒等的，
与 workflow 侧不对称。

`put` 侧同样只吃 `TemplateDef`（`cmd/template.go:78-79`），与 C-1 同形。

---

## 二、纪律块解析面

### C-9 discipline 的权威副本是 handoff 账本，旧本地目录三段式已退役

`TemplateDef.Discipline` 仍是纪律块的账本记录名。B229 起 agentd 不再读取或写入
`<DataDir>/discipline/<name>.md`；该目录不是 charter provision 的安装目标，也不是
check 的比对基准。charter 的七个 `charter-*` 块必须通过 handoff CLI 进入账本。

读取规则：`handoff discipline get <name>` 成功时 stdout 是可选日志行、随后一行
`<name> v<N>`、再随后为正文；版本行不属于正文，版本行之后的全部文本（含尾换行）
才是比对值。stderr 含 `记录不存在` 的非零 get 表示账本中缺块；其它非零表示账本
不可用。check 对缺块报漂移并返回 1，install 对缺块执行 put；不可用两者均返回 2
且不盲写。

写入规则：`handoff discipline put record_name file_path` 的文件路径是位置参数。install 只
在 get 缺块或正文逐字不同的时候 put；正文相同不新增版本。put 的库层大小、空白正文
和名字校验保持由 handoff 负责，charter 不截断正文、不复刻对侧校验器。

因此旧表述“先查 `<DataDir>/discipline`，再回退内置块，最后报错”在 B229 后标记为
已退役；本卡不让 handoff 恢复该读取路径。

### C-10 纪律块名不得含路径分隔符

`internal/discipline/resolver.go:191-197`（`resolvePath`）：只收纯文件名，含 `/` 或
等于 `.` / `..` 一律 `ErrBadName`。故真源里的 discipline 值只能是裸角色名。

---

## 三、比对面（drift 检查的判据）

### C-11 「一致」的判据 = **只比 `nodes`**，必要且充分

> **本条不变，但其与上游 spec 缝级断言②的口径关系已由修订 R-1 澄清**（断言②的输入必须以 `nodes` 差异为载体，并新增一条反向断言锁住本条）。见文末修订记录。

由 C-5：`states` / `gates` 是 `nodes` 的纯函数，由 handoff 在写入期自行计算。
因此比对账本与仓时：

- **必要**：`nodes` 不同 ⇒ 投影必不同 ⇒ 定义实质不同。
- **充分**：`nodes` 相同 ⇒ 账本侧 `states` / `gates` 由 handoff 从同一 `nodes` 算出 ⇒ 无需再比。

**推论**：比对实现**不得**在 charter 侧复刻 `withStatesFromNodes`——那会造出第二份
投影实现，与 handoff 的实现可以无声漂移。比 `nodes` 一处即可。

### C-12 比对必须忽略的噪声字段

账本侧 `Workflow` / `Template` 外层的 `Name` / `Version` / `CreatedAt` 由账本自增与
自填（`internal/ledger/workflows.go:167-173`、`templates.go:73-79`：版本取
`MAX(version)+1`，时间取 `time.Now()`）。**它们不参与比对**，仓不管理版本号。

### C-13 比对必须容忍键序差异

两侧都经 `encoding/json` / `json.dump` 往返，键序不承载语义。比对在解析后的对象上做，
不做字节比对。

---

## 四、Ticket 0 骨架与实现边界

落码：`scripts/charter_provision.py`、`flows/charter.workflow.json`、
`flows/charter-default.template.json`。

- 原始骨架只落**签名、常量、CLI 接线**；当前实现已在 check/install 接缝上按 TDD
  补齐 workflow/template 的 JSON 比对与 discipline 账本 get/put 链路。
- 安装顺序 C-7 以常量 `INSTALL_ORDER` 落码，不散在函数体里。
- 编译验证见收尾自检第 3 项。

---

## 拍板记录

### D-1 仓内真源只存 `nodes`，不存 `states` / `gates`

**决定**：`flows/charter.workflow.json` 顶层只有 `nodes` 一个键。

**三重闸门**：难逆转（改格式要同时改安装与比对两侧）；无上下文会惊讶（后人看到没有
`states` 会以为漏了，很可能「顺手补上」）；真取舍（下面这个方案被否掉）。

**被否方案**：照 `show` 原样存完整 `Def`（含 `states` / `gates`）。
优点是与账本读数字节同构、比对可以偷懒做整体比较。
**否掉的理由**：`states` / `gates` 在写入期被 `withStatesFromNodes` 整体覆写（C-5），
存进真源就是一个**改了不报错也不生效**的编辑陷阱。本批要治的正是「一个通过了的检查不等于
它想证明的事情为真」这一族，往真源里埋一个静默失效的字段与本批立意直接相悖。

**反过来写不会有任何测试变红**——这正是必须留拍板记录的那类决定：真源多存两个派生键，
安装照样成功、比对照样通过、流程照样跑，只有真的有人去编辑 `states` 时才会中招，
而那时没人记得为什么。

### D-2 比对只比 `nodes`，禁止在 charter 侧复刻投影逻辑

**决定**：drift 判据取 `nodes` 子树，不复算 `states` / `gates`。

**三重闸门**：难逆转（比对语义是下游全部测试的地基）；无上下文会惊讶（后人会觉得
「只比一部分」是偷工减料，想补全）；真取舍（下面这个方案被否掉）。

**被否方案**：在 charter 侧用 Python 复刻 `withStatesFromNodes`，然后整体比较。
**否掉的理由**：那是把 handoff 的内部投影逻辑复制成第二份实现。handoff 改投影
（例如给 `Gate` 加字段，`workflows.go:28-32` 的注释正说明他们预期会加），charter 的
副本不会跟着改，比对会开始产生假阳或假阴——而**比对本身是用来发现漂移的工具**，
工具自己带一个会漂的副本是自相矛盾。C-11 已证明只比 `nodes` 必要且充分。

### D-3 本轮不改模板的缺省 `discipline`

**决定**：`flows/charter-default.template.json` 忠实导出账本 v4 现状，
`discipline` 保持 `"implement"`，**不在本节点改成 `charter-implement`**。

**三重闸门**：难逆转（否，改回很容易）——**故本条不入拍板记录的三闸门**，
此处记录仅为交代范围，不占决定名额。理由是审计价值：先落一份与账本 v4 逐字相同的基线，
让 C-9 那处修正在 implement 阶段成为一个**可见的 diff**，而不是混在导出里无人察觉。
修改动作与其理由归 implement/plan。

---

## 收尾自检（本轮新鲜证据）

1. **契约增量文档落盘**：本文件；C-1 ~ C-13 每条带 `文件:行` 出处，均为本轮实读 —— ✅
2. **目标图更新并提交**：charter 仓**无 `codegraph/`**（本工作树核实），按 contract 节点
   「存量无图项目：契约增量文档即冻结物」执行，无图可更 —— ✅（不适用）
3. **Ticket 0 骨架本轮编译通过** —— ✅ 三条命令本轮实跑，退出码均为 0：

   ```
   $ python3 -m py_compile scripts/charter_provision.py scripts/regen_discipline.py
   py_compile 退出码=0

   $ python3 -c "<按路径 exec_module 载入 charter_provision>"
   导入成功；INSTALL_ORDER = [('template', 'charter-default'), ('workflow', 'charter')]
   接缝签名存在: True
   导入检查退出码=0

   $ python3 -c "<json.load 两份真源>"
   flows/charter.workflow.json -> 顶层键 ['nodes']
   flows/charter-default.template.json -> 顶层键 ['executor', 'target', 'purpose', 'branch_prefix', 'prompt']
   真源 JSON 合法性退出码=0
   ```

   导入检查同时验了两件事：`INSTALL_ORDER` 的次序与 C-7 一致（template 在前），
   接缝符号 `nodes_equivalent` 已导出到模块级（spec 接缝清单声明的导出面）。
4. **可执行冻结条目**：命中一条（C-5 的 nodes-only 无损性），本轮已跑，读数
   `states 投影一致: True / gates 投影一致: True` —— ✅
5. **三重闸门拍板记录**：D-1、D-2 两条命中并已记；D-3 显式声明未命中三闸门、仅作范围交代 —— ✅

## 欠账（交棒 breakdown 时显式认账）

1. **未做真机 `put` 回灌验证**。本轮全部结论来自读源码，未对活账本执行过一次
   `workflow put` / `template put`。**刻意不做**：`handoff workflow` 命令族**没有
   delete**（`handoff workflow --help` 仅 list/migrate/put/show），探针工作流一旦写入
   即永久残留，且会破坏 product-backlog 依赖的「账本只有一条流时自动取它」这一行为
   （建卡不带 `--workflow` 将开始报错）。真机回灌的验收落 acceptance 节点，届时对
   `charter` 自身回灌（产生 v10，内容与 v9 等价，不新增流）。
2. **`NodeDef` 的完整字段面未逐字段冻结**。本文档冻结的是写入面的规则与三个顶层键；
   `NodeDef` 内部字段（`internal/ledger/types.go:197-220`）随真源 JSON 原样携带，
   未逐字段列表。理由：真源是导出物不是手写物，逐字段冻结的收益低于维护成本；
   若将来要手写节点，再补。

---

## 拆解节点回写的修订记录（2026-08-24）

由 breakdown 节点在 `docs/breakdowns/2026-08-24-charter-provisioning-breakdown.md` 出稿过程中
做出的**边界澄清与事实更正**，按 breakdown 纪律「澄清即便不退回 contract 也要回写一行修订记录」
落此。**C-1 ~ C-13 与 D-1 ~ D-3 的正文与决定均不变**，本节只改读法与一处事实精度。

### R-1 澄清：spec 缝级断言②的可执行重述（不退回 contract）

**冲突**：上游 spec 测试决定写「一对『states 或 gates 实质不同』的输入 → 判不等价」；
C-11 与 D-2 写「只比 `nodes`、禁止复刻投影」。字面执行断言②要求实现去读 `states` / `gates`
键，**直接违反 C-11 / D-2**。

**裁定**：断言②里的「states 或 gates 实质不同」是**症状描述，不是输入构造法**。在 D-1 的
nodes-only 真源制下，仓侧 def 根本没有这两个键，生产路径上它们的差异**只能以 `nodes` 差异为
载体**。断言②重述为：

> 构造一对 `nodes` 实质不同的输入，差异分别落在两类载体——**(i) 节点集合或顺序变化**
> （投影体现为 states 变）、**(ii) 某节点的 `gate` 变化**（投影体现为 gates 变）——
> 断言判不等价，且差异清单**指名到节点与字段**。

**并加严一条（属加严不属加缝，故不退回 contract）**：新增第三条缝级断言——
**一对 `nodes` 完全相同、而 `states` / `gates` 键故意矛盾的输入 → 判等价**。
它是 D-2 这条承重决定**唯一能变红的锁**；没有它，将来有人「顺手把 states 也比一下」
不会有任何测试拦他。

**为什么是澄清不是分歧**：C-11 的判据不变、D-2 的决定不变、`nodes_equivalent` 的签名不变，
变的只是 spec 一句自然语言的可执行读法。若协调者判定这是分歧，正确的退回动作是**改 spec
的断言②措辞**，不是改 C-11——C-11 有代码级证明（`internal/ledger/workflows.go:20-43` 与 `:156`），
断言②只有一句自然语言。

### R-2 更正：C-8「`template put` 无校验」不成立（CLI 层有三字段必填校验）

**本轮实读 `cmd/template.go:81-83`（`tplPutCmd.RunE`）**：

```go
if def.Executor == "" || def.Prompt == "" || def.Discipline == "" {
    return fmt.Errorf("executor/prompt/discipline 三者必填")
}
```

C-8 所引的 `internal/ledger/templates.go:66-85`（`Store.PutTemplate`）确实无 `validate*` 调用、
无投影——**但 CLI 层有一道校验**，C-8 的行文把 store 层的结论说成了整条写入路径的结论。
更正为：**store 层无校验，CLI 层有 `executor` / `prompt` / `discipline` 三字段必填校验。**

**直接后果**：D-3 交办 implement 的「缺省 `discipline` 该改成什么」这个岔口上，
**「整个字段留空」的选项不可行**——空串会被 CLI 当场拒绝。该选项在 C-9 的行文与 spec
「定不了的」第四条里都还是活的，本条把它杀死。

**为什么是更正不是退回**：D-1 / D-2 / D-3 三条决定均不受影响，受影响的只有一条事实描述的
精度与它下游一个选项的可行性。相关负例已进拆解稿真机清单（M-4，零残留可安全执行）。

### R-3 澄清：`nodes_equivalent` 的职责边界

spec 断言②要求「指出差异在**哪一样**、哪个字段」。核对 spec 用户故事 2（「一条命令告诉我
漂在哪一样、哪个字段」）后裁定：**「哪一样」= 三样东西之一（workflow / template / 纪律块），
由 `check()` 主流程的三段结构负责**；`nodes_equivalent` 只负责**单份 workflow def 内部的
节点级 / 字段级差异清单**。两者不是同一粒度，不要求一个函数同时承担。

### R-4（C11 回写）：`charter-must-override` 的哨兵含义改由账本 lookup 定义

**背景**：D-3 本轮决定「模板缺省 `discipline` 忠实导出、修法留给 implement」。
breakdown 的岔口 F-6 由协调者裁为 **(c) 哨兵名**，implement 已落地为
`flows/charter-default.template.json` 的 `"discipline": "charter-must-override"`。

**为什么不是留空**：R-2 已证明 CLI 层强制该字段非空。「本模板没有合理缺省」这个真实语义
**无法用留空表达**，哨兵是它在必填字段上唯一诚实的编码。

**为什么不是 `charter-implement`**：那仍然是**静默**的——忘写 `override.discipline` 的
新节点会安静地拿到 charter 的实现纪律，而它多半不是该节点想要的。C-9 记录的风险正是
「静默拿到不对的块」，用另一个静默默认去治它等于没治。

**它的运行期行为**：该哨兵不在 `compose_map()` 的七个生成块中，也不应写入 handoff
纪律账本。B229 后 dispatch 的纪律解析由 `ResolveDispatch` 对账本记录名做 lookup；
lookup 失败时返回“未知纪律块名字”类错误。名字本身就是给读到这条报文的人的指引——
**该节点必须写 `override.discipline`**。

**已知代价（协调者已认）**：裸 `handoff dispatch --template charter-default`（不经工作流节点
的直接派发）从「能跑」变成「必失败」。可接受，因为该模板的 `prompt` 通篇是卡形状的
（`{{CARD}}` / `{{TITLE}}` / `{{ACCEPT}}`），无卡直接派发本来就会渲染出一堆空占位符——
那条路径**在本次改动前已经是语义损坏的**，让它响亮失败是修复不是回归。

**零影响的依据**：现役 7 个 dispatch 节点**全部**写了 `override.discipline`
（`flows/charter.workflow.json` 实读：contract/breakdown/plan/implement/review/integrate/图对账
分别指向 7 个 `charter-*` 块），故哨兵在现役流程上永不被解析到。
charter 的 check 只检查节点显式 `override.discipline`：通过 discipline get 成功或
复用已成功读取的名字集合确认账本存在；不读取模板缺省值，不读取
`<DataDir>/discipline`，不调用 discipline list。现役七个 dispatch 节点分别覆盖
`charter-contract`、`charter-breakdown`、`charter-plan`、`charter-implement`、
`charter-review`、`charter-integrate`、`charter-recon`，所以哨兵不在现役工作流中被解析。

**JSON 无注释，本条即哨兵含义的唯一落点。**看到那个「坏值」的下一个人请先读本条，
不要「顺手把它改好」。

### R-5（review 回写）：读取侧新增一条**文案级**对侧依赖

**来源**：本批 review 的 finding I-6。冻结的 C-1~C-13 只覆盖了**写入面**（put 吃什么、
怎么校验），没有覆盖**读取侧的失败分诊**——而实现必须分诊，否则「没装」与「够不着」
会被压成同一种处置。

**新增的依赖（照实说，它比其余条目脆）**：
`scripts/charter_provision.py` 的 `load_ledger_def` 以
**`"记录不存在" in proc.stderr`** 判定「账本里没有这个定义」。

**依据**（基线实测，非记忆）：`handoff workflow show <不存在>` → 退出码 1、
stdout 为空、stderr 为 `Error: 工作流 X v0: ledger: 记录不存在`。该文案源自
handoff 的 `ErrNotFound` 包装。

**为什么不用退出码**：`show` 对「不存在」与「账本够不着」都返回 1，退出码分不开这两者。
**为什么不用 `workflow list` 解析**：`list` 输出是人读表格、无 `--json`，解析它同样脆且更绕。

**这条依赖的失效方向是安全的**：handoff 改了文案 → 认不出「记录不存在」→ 归入
`LedgerUnavailable` → `check` 报 2、`install` **拒绝安装并原样退出**。
即**误判的代价是多一次人工确认，不是误写账本**。这个方向是刻意选的。

**下游注意**：新增依赖 handoff 报文文本的地方，必须保持同一失效方向（拒绝动作，
不是盲干），并回到本条追记。

### R-5a（C11 追加）：discipline get 复用“记录不存在”缺块文案

`load_discipline_body` 对 `handoff discipline get <name>` 的非零结果仍以 stderr 含
“记录不存在”判定缺块；该子串来自对侧纪律记录不存在错误（对侧 `cmd/discipline.go`
与 `internal/ledger/disciplines.go`）。缺块在 check 中是漂移/退出 1，在 install 中是
允许 put 的首装状态；其它非零统一归 `LedgerUnavailable`，退出 2 且不写。若对侧未来
改变该文案，应先更新冻结依赖与真机断言，不得把所有非零 get 静默变成缺块。
