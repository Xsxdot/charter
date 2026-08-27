# C17 契约增量：行为轴泳道主语改为对外契约方法

> **状态：已冻结（随本提交，2026-08-28）**
> 上游：`docs/specs/2026-08-27-flow-subject-is-contract-spec.md`（第四稿，已批准 2026-08-28）+
> C12：`docs/superpowers/specs/c12-contract.md` §2.1-5、§2.4-30/32-36。
> 卡：C17；级别 L3 · 轻档；接缝：扫描侧（handoff）↔ charter `graph/codegraph` ↔ 查看器（handoff/charter webui）。
> 台账：`docs/ledgers/2026-08-27-c17-spec-ledger.md`。
> 架构形态：`graph/codegraph` 为数据契约模型 + 只读算法，CLI 为 Cobra 命令薄壳；查看器沿 C12 的「纯函数派生层 + React 组件薄壳」两层，不新造横向分层。

## 1. 现状锚与边界

本文件冻结第四稿相对 C12 的契约增量。现状代码表只用于查证签名，不能把本分支已挂的 CLI `flow`/`tree` 实现当成终态 wire 事实；不在本卡实现或修正它们。

### 1.1 当前工作树查到的签名

| 现状符号 | 当前签名/形状 | 现状出处 |
|---|---|---|
| `FlowStep` | `ID string; Order int; Kind string; To/Cond string; Line int; Then/Else/Body []string; Iface bool`，JSON 键为 `id/order/kind/to/cond/line/then/else/body/iface` | `graph/codegraph/types.go#FlowStep`（114-127 行） |
| `Flow` | `Steps []FlowStep`，JSON 为 `{ "steps": [...] }` | `graph/codegraph/types.go#Flow`（131-133 行） |
| `Graph.Flows` | `map[string]Flow`，JSON `flows,omitempty` | `graph/codegraph/types.go#Graph`（143-167 行） |
| `Node.Channel` | `string`，JSON `channel,omitempty`，只对 `kind=entry` 有意义 | `graph/codegraph/types.go#Node`（62-85 行） |
| `FlowRef` | `FlowRef{ID, Name, File, Line, Kind, Channel}` | `graph/codegraph/flow.go#FlowRef`（13-21 行） |
| `FlowLookupResult` | `View/Query/Subject/Degraded/Missing/Steps/Callers/Implementations/Channels` | `graph/codegraph/flow.go#FlowLookupResult`（23-34 行） |
| `LookupFlow` | `func LookupFlow(v *View, g *Graph, repoRoot, query, id string) (*FlowLookupResult, error)` | `graph/codegraph/flow.go#LookupFlow`（36-85 行） |
| `TreeOptions` | `Focus string; Up bool; Depth int; Through string; From string; Once bool; MaxNodes int` | `graph/codegraph/tree.go#TreeOptions`（19-29 行） |
| `TreeNode` | `ID/Dist/Kind/Name/File/Line/Domain/Container/Children`，Children 为嵌套 `[]TreeNode` | `graph/codegraph/tree.go#TreeNode`（31-42 行） |
| `TreeResult` | `View/Focus/Up/Depth/Through/From/Once/Root/Truncated` | `graph/codegraph/tree.go#TreeResult`（44-55 行） |
| `BuildCallTree` | `func BuildCallTree(v *View, opts TreeOptions) (*TreeResult, error)` | `graph/codegraph/tree.go#BuildCallTree`（57-157 行） |
| `Truncation` | `AtDepth int; DroppedNodes int; Reason string` | `graph/codegraph/assemble.go#Truncation`（52-57 行） |
| 符号决议 | `SymLookup` 的 id 精确 > Name 精确 > 方法尾段精确；CLI 再要求唯一 | `graph/codegraph/sym.go#SymLookup`（31-47 行）、`graph/codegraph/sym.go#symResolve`（65-85 行）、`graph/cli/cli.go#graphUniqueID`（574-588 行） |
| 视图加载 | `func graphLoadView() (*codegraph.View, *codegraph.Graph, error)`；返回合并 View 与原始 Graph | `graph/cli/cli.go#graphLoadView`（76-91 行） |
| `flow` CLI | Cobra command `Use: "flow <节点 id 或名字>"`，位置参数恰一项，调用 `LookupFlow` | `graph/cli/cli.go#graphFlowCmd`（590-615 行） |
| `tree` CLI | Cobra command `Use: "tree <节点 id 或名字>"`，位置参数恰一项，调用 `BuildCallTree` | `graph/cli/cli.go#graphTreeCmd`（617-660 行） |
| JSON 输出 | `graphPrintJSON(cmd, v)` 使用缩进 JSON、关闭 HTML 转义并写 stdout | `graph/cli/cli.go#graphPrintJSON`（94-99 行） |
| 命令挂载 | `New(use string) *cobra.Command`；`init` 将 `flow`、`tree` 挂到同一根命令 | `graph/cli/cli.go#New`（69-74 行）、`graph/cli/cli.go#init`（941-965 行） |

当前 `View` 不含 `Flows` 字段，`LookupFlow` 现状从单独的 `*Graph` 取 flows；这只是已挂 CLI 的实现读数。终态按本契约以 baseline `flows` 段取步骤，并保持 `--view` 视图对调用边/节点的读取语义。

### 1.2 存量无图与外部接缝

当前 charter 仓根没有项目级 `codegraph/best.json`，只有 `graph/codegraph/testdata/repo/codegraph/` 测试夹具；因此本仓属于存量无图项目，本文件就是契约冻结物，不创建 `codegraph/target.json` 或 `codegraph/diffs/<分支>.json`。Ticket 0 新符号无项目图可入视图 diff，合法无视图。

`deriveFlowPage` 属 C12 已冻结的查看器接缝，但 `graph/webui` 不在当前 charter 工作树；当前本仓不能把它写成已查到的本地代码事实。沿用 C12 §2.4-28/29 的模块路径和函数名，handoff/查看器实现轮须按本契约复核该外部侧。

## 2. 冻结清单

每条编号是一支可独立判 pass/fail 的断言；实现选择、私有辅助函数、组件内部命名不属于本清单。

### 2.1 主语与 `flows` 承重集合

1. 行为轴一条泳道对应一个**当前泳道主语方法**，不是一个 CLI/HTTP/WS 程序入口。
2. 默认泳道主语集合等于结构轴「对外面」中未折叠的跨域入缝；折叠块展开后，展开出的未折叠入缝也可进入行为轴。
3. 可打开的泳道主语集合为：默认对外入缝、紫框机械判据命中的目标、右栏列出的接口实现方法。
4. 紫框唯一机械判据是：流程图中某一步 `kind=call` 的 `to` 属于上述可打开主语集合；不得以「紫框指向下层主语」循环定义，也不得以调用目标的 `kind=entry` 作为紫框判据。
5. `kind=entry` 节点是到达通道，不是泳道主语；通道不得被标紫、不得打开新流程图、不得压入下钻栈。
6. 入口 handler 不因自身 `kind=entry` 就进入承重 `flows` 集合；通道上残留的 `flows[id]` 只能作为通道注释数据。
7. 扫描侧 `flows` 键集合冻结为：对外入缝 ∪ 紫框下钻目标 ∪ 右栏列出的实现方法；不要求全函数覆盖。
8. `baseline.flows` 的 wire 形状保持 C12：`Record<string, { steps: FlowStep[] }>`；不得为 C17 复制或改名 `flows` 顶层键。
9. `FlowStep.kind` 仍只允许 `call|branch|loop|return`；`call` 的 `to`、`branch/loop` 的 `cond` 与相应子步骤列按 C12 §2.1-2 约定消费。
10. `return` 作为卫语句分支体中的步骤时，必须被 `branch.then`/`branch.else` 引用；不得把该卫语句 return 再作为未引用的 sequential root。
11. `iface: true` 只表示调用目标是接口方法、调用点为动态分派；实现清单从既有 `implements` 段 join，不在 `flows` 内复制。

### 2.2 行为轴页面接缝与模型

12. 主缝模块路径为 `graph/webui/src/app/codegraph/flowpage.ts`，导出函数保持：

    ```ts
    function deriveFlowPage(input: FlowPageInput): FlowPageModel
    ```

    导出面只供 codegraph 应用模块内组件层消费，不导出到应用外。

13. `FlowPageInput` 的字段精确为：

    ```ts
    interface FlowPageInput {
      baseline: CgGraph
      entryNodeId: string
    }
    ```

    `entryNodeId` 是 C12 遗留字段名，语义是当前泳道主语 id，不表示 CLI/HTTP/WS 入口；不得借字段名恢复旧入口主语。

14. `FlowPageModel` 的对外消费字段冻结为以下可编译类型：

    ```ts
    interface FlowNodeRef {
      id: string
      name: string
      kind: 'entry' | 'func' | 'model'
      file: string
      line: number
      domain?: string
      container?: string
      channel?: CgEntryChannel
      openable: boolean
    }

    interface FlowPageModel {
      subject: FlowNodeRef
      degraded: boolean
      missing?: string
      steps: CgFlowStep[]
      callers: FlowNodeRef[]
      implementations: FlowNodeRef[]
      channels: FlowNodeRef[]
    }
    ```

    `FlowNodeRef` 的 `openable` 只表达 UI 是否可把该项作为下一张方法图；它不改变 baseline 节点 `kind`。

15. `deriveFlowPage` 的 `subject` 是当前 `entryNodeId` 对应的泳道主语；它输出该主语的流程步骤、到达通道、接口实现和直接调用方，不把通道列表转换成并列主图。
16. `baseline.flows[entryNodeId]` 缺席或没有步骤时，`degraded` 必须为 `true`、`steps` 必须为空数组、`missing` 必须说明缺少流程数据；不得用机械可达序列或 `chain` 结果填充 `steps`。
17. `baseline.flows[entryNodeId]` 命中并有步骤时，`degraded` 必须为 `false`，`steps` 按该 flow 的步骤树透传；步骤顺序、分支与循环不由边遍历重建。
18. 「到达通道」是能够沿活跃调用边到达当前主语的 `kind=entry` 节点，通道值沿 C12 `CgEntryChannel` 的 `cli|http|ws|web` 词表；C17 页面文案称 CLI/HTTP/WS 为到达通道，不把它们称泳道主语。
19. 到达通道项 `openable` 必须为 `false`；点击只高亮右栏通道项及图上从通道到当前主语的第一步（无对应步骤时只高亮右栏），不换图、不压栈。
20. 「实现」段列出当前主语是接口方法时的全部实现方法；接口调用步骤的实现段也列出该接口的全部实现。实现项以实现方法 id 为下一张图主语，不到实现容器里寻找 CLI/HTTP 入口。
21. 「被谁调用」段只列当前主语的直接调用方，与 `who-calls --depth 1` 的活跃直接边同口径；不得在 UI 中展开 depth > 1。
22. 「被谁调用」中的 `kind=entry` 项 `openable=false`，按到达通道处理；其余项只有在存在 `flows[id]` 时 `openable=true`，没有流程数据的项必须保留名字并显式标「无流程图」。
23. 对外面 tab 必须明确区分「对外入缝」与「到达通道」；结构轴程序入口列表只读，点击程序入口不打开流程图。
24. 行为轴不再把 C12 §2.4-32 的入口归属、§2.4-33 的注册散度或 §2.4-34 的入口族作为必有段；若保留只能作为到达通道的注释，不能套用契约方法名。

### 2.3 流程形态与导航

25. 流程图矩形表示一次调用，左色条表示所属领域；菱形表示分支；不得用橙色/琥珀色圆角矩形替代菱形。
26. `if err != nil { return }` 等卫语句必须甩到菱形侧边的返回终点，不占快乐路径主干，不进入蛇形 `linear` 主干序列。
27. 主干装不下时采用折列，列间用蛇形连线连接；不得用文字标签代替连线。
28. 双线框表示接口调用；图上展示接口本身，右栏展示全部实现；每个实现方法自己就是流程图主语。
29. 紫框 ▸ 只由第 4 条机械判据产生；紫框目标可递归下钻，且不把到达通道当作下钻目标。
30. 页面维护页内下钻栈，不依赖 iframe 或浏览器后退；从结构轴进入第一张图时栈底来源为原 scope 的结构轴。
31. 点紫框目标、实现项或符合条件的调用方时压栈换图；主语已在栈中时仍允许再次压栈，不做去重。
32. 流程图页只提供一颗「← 上一层」；弹出栈顶后回到真实来处。栈底返回结构轴时必须保住原 scope，不重挂到根。
33. 面包屑为 `结构轴 ▸ 主语1 ▸ 主语2 ▸ 当前` 形态；点击祖先直接跳到该层并截断其后的栈项。
34. 本期不提供第二颗「跳过整栈回结构轴」按钮。

### 2.4 Go 库 `flow` 查询契约

35. graph 库保持可编译入口：

    ```go
    func LookupFlow(v *View, g *Graph, repoRoot, query, id string) (*FlowLookupResult, error)
    ```

    `id` 必须是已决议的活跃节点 id；`query` 原样保留为用户查询串，`repoRoot` 仅用于沿既有 `SymMatch` 规则再锚定定位。

36. `FlowRef` 的 Go/JSON 形状冻结为：

    ```go
    type FlowRef struct {
        ID      string `json:"id"`
        Name    string `json:"name"`
        File    string `json:"file,omitempty"`
        Line    int    `json:"line,omitempty"`
        Kind    string `json:"kind,omitempty"`
        Channel string `json:"channel,omitempty"`
    }
    ```

37. `FlowLookupResult` 的 Go/JSON 形状冻结为：

    ```go
    type FlowLookupResult struct {
        View            string     `json:"view"`
        Query           string     `json:"query"`
        Subject         SymMatch   `json:"subject"`
        Degraded        bool       `json:"degraded"`
        Missing         string     `json:"missing,omitempty"`
        Steps           []FlowStep `json:"steps"`
        Callers         []FlowRef  `json:"callers"`
        Implementations []FlowRef  `json:"implementations"`
        Channels        []FlowRef  `json:"channels"`
    }
    ```

38. `subject` 使用既有 `SymMatch` wire：`id`、再锚定状态 `anchor`、归属 `domain` 及嵌入的 `ViewNode` 字段；不另造一份定位协议。
39. `LookupFlow` 找不到活跃 `id`、节点被删除或视图为空时返回 error；不把不存在的节点编码成成功的 `degraded` 结果。
40. 有 `flows[id]` 且步骤非空时返回 `degraded=false` 与对应 `steps`；`callers`、`implementations`、`channels` 仍按各自语义输出。
41. 缺少 `flows[id]` 或流程段时返回成功的降级结果：`degraded=true`、`steps=[]`、`missing` 非空；不得把邻域或 `chain` 切片伪装成流程步骤。
42. `callers` 只取当前主语的直接活跃调用方；`implementations` 从 `implements` 的 `[实现, 接口]` 边 join；`channels` 只取能到达当前主语的活跃 `kind=entry` 节点。
43. 删除状态的节点和边不进入上述三个邻域集合；没有结果时数组仍为 `[]`，不以 `null` 代替空集合。

### 2.5 Go 库 `tree` 查询契约

44. graph 库保持可编译入口：

    ```go
    func BuildCallTree(v *View, opts TreeOptions) (*TreeResult, error)
    ```

    `TreeOptions` 字段冻结为 `Focus string`、`Up bool`、`Depth int`、`Through string`、`From string`、`Once bool`、`MaxNodes int`；`Focus/Through/From` 由 CLI 先按 §2.6 决议为节点 id。

45. `TreeNode` JSON 形状冻结为 `id`、`dist`、`kind`、`name`、`file`、`line`、可选 `domain`/`container`、可选嵌套 `children`；向下 `children` 是被调方，向上 `children` 是调用方。

46. `TreeResult` JSON 形状冻结为：`view`、`focus`、`up`、`depth`、可选 `through`/`from`/`once`、`root`、可选 `truncated`。`truncated` 使用既有 `Truncation{atDepth,droppedNodes,reason}`，展开过大时必须显式出现。

47. 向下缺省模式从焦点沿活跃调用边递归展开；它是真树，不做 `chain` 的全局去重。菱形 A→B、A→C、B→D、C→D 中，D 必须在两条路径各出现一次。
48. 向下树不保证同一函数内的源码先后；每个父节点的子节点按 `name` 升序、同名再按 `id` 升序稳定排序；排序不得读取 `flows`。
49. 向下自环作为一次子节点出现并停止展开；`kind=entry` 不作为隐式刹车。
50. `--once` 缺省关闭；打开时同一节点只展开第一次，允许结果接近 chain，但不得改变 `tree` 缺省真树语义。
51. API 层 `Depth < 0` 表示不限跳数，`Depth == 0` 表示只输出根；CLI `--depth` 缺省为 `2`，CLI 的 `--depth 0` 翻译为 API 的不限跳数。焦点计作 distance 0。
52. `--up` 模式沿反向活跃调用边展开；向上深度同样从焦点计，不因遇到 `kind=entry` 自动停止。
53. `--through U` 只允许向上使用，U 必须是焦点在当前 depth 内的祖先；只给 `--through` 时仍保留 U 之上的反向祖先，直到 depth 用尽。
54. `--from F` 必须与 `--through U` 同时出现；F 必须直接调用 U，输出只保留 `F → U` 且 U 能到达焦点的走廊；只给 `--from` 必须失败。
55. 向下模式带 `--through` 或 `--from` 必须失败；U 不是祖先、F 不调用 U 或走廊到不了焦点时必须失败，不得返回伪造的空走廊成功。
56. tree 只读 View 现有调用边，不读取 `flows`、不生成 CFG、不复用 chain 的工具节点折叠；截断只通过 `truncated` 或 `--once` 表达。

### 2.6 CLI 边界

57. canonical `codegraph` 与挂载为 `graph` 的别名共享同一命令树；`flow` 与 `tree` 的命令名、位置参数语义和 JSON stdout 形状一致。

58. `codegraph flow` 的命令形状为：

    ```text
    codegraph flow <节点 id 或名字>
    ```

    必须恰有一个位置参数；同一根命令的 `--repo`、`--view` 适用。该命令不提供 `--with-source`，源码窗口继续走 `sym`/`chain --with-source`。

59. `flow` 的决议优先级为 id 精确 > Name 精确 > 方法尾段精确；同级多义必须失败并列出节点 id；未命中沿 `sym` 的错误通道返回，不静默当作 degraded。

60. `codegraph tree` 的命令形状为：

    ```text
    codegraph tree <节点 id 或名字> [--depth N]
    codegraph tree <焦点> --up [--depth N] [--through <上面那层>] [--from <调用上面那层的方法>]
    ```

    位置参数必须恰有一个；`--repo`、`--view` 与 `chain` 同套；`--through`/`--from` 只按 §2.5 规则使用。

61. `flow` 与 `tree` 的成功 stdout 是一个 JSON 值并以换行结束；错误返回非零，不把错误文本包装成成功 JSON。`summary` 开局菜单必须包含 `flow` 与 `tree`。

62. `chain` 与 `who-calls` 保留原命令和语义；本卡不以 `flow`/`tree` 替代它们，不给 `chain` 增加 `--pretty`，也不在查看器中再画一棵调用树。

### 2.7 退场与不做

63. 结构轴旧的「程序入口点进流程图」路径退场；程序入口列表只读，到达通道只高亮。
64. 为每个 CLI/HTTP/WS 通道保留一张并列主图不做；入口 handler 也不重新成为默认泳道主语。
65. 查看器既有「调用链（给 agent）」tab 保留；它继续表示机械下游能力，不冒充流程图。
66. `flow --with-source`、tree 复用 chain 的折叠工具节点、查看器 UI depth > 1 的「被谁调用」展开均不做。
67. 第二颗「跳过整栈回结构轴」按钮不做；`flow`/`tree` 也不取代 `chain`/`who-calls`。

## 3. 依赖库既成行为查证

1. Go `encoding/json` 在解码 JSON 对象到结构体时默认忽略未知键；只有显式调用 `Decoder.DisallowUnknownFields` 才报未知键错误。标准库出处：`/usr/local/go/src/encoding/json/encode.go`（36-40 行）与 `stream.go`（41-44 行）。本契约不要求旧消费方因增量 `flows`/`channel` 失败。
2. `json.Unmarshal` 到 `map[string]Flow` 时键集开放；缺失 `steps` 得到零值切片。当前基线加载确实走 `json.Unmarshal`，出处：`graph/codegraph/load.go#LoadGraph`（16-28 行）。缺失流程由 §2.4-41 显式降级，不能靠解码异常表达。
3. `encoding/json.Encoder.Encode` 会在值后写换行，标准库出处：`/usr/local/go/src/encoding/json/stream.go`（193-223 行）。当前 CLI `graphPrintJSON` 还设置缩进与 `SetEscapeHTML(false)`，出处：`graph/cli/cli.go#graphPrintJSON`（94-99 行）；本卡不把空白布局当业务字段。
4. Go 模块当前直接依赖 Cobra `v1.10.2`，`go.mod` 已钉；依赖白名单测试也钉 `github.com/spf13/cobra: v1.10.2`，出处：`graph/go.mod` 与 `graph/cli/deps_test.go#TestModuleDependencyAllowlist`（12-23 行）。本卡不新增 CLI 依赖。
5. Cobra `ExactArgs(1)` 只有在位置参数数目不等于 1 时返回错误，依赖源码：`/root/go/pkg/mod/github.com/spf13/cobra@v1.10.2/args.go`（93-100 行）；flow/tree 的一参边界与此行为对齐。
6. Cobra 在执行子命令前解析其 flags，依赖源码：`/root/go/pkg/mod/github.com/spf13/cobra@v1.10.2/command.go`（1867-1888 行）。当前 CLI 的 `--through`/`--from` 是 tree 本地 flags，持久 `--repo`/`--view` 在根命令注册，出处：`graph/cli/cli.go#init`（941-965 行）。
7. pflag 的 bool flag 无值时使用 `true`，int flag 由字符串解析为 int；依赖源码：`/root/go/pkg/mod/github.com/spf13/pflag@v1.0.9/bool.go`（47-56 行）、`int.go`（38-46 行）。因此 `--up`/`--once` 为开关，`--depth N` 为整数；`--depth 0` 的「不限」是 CLI 到 API 的显式映射，不是 pflag 默认行为。
8. 当前 `graphLoadView` 的 `--view` 先加载 diff、校验后调用 `Merge`，出处：`graph/cli/cli.go#graphLoadView`（76-91 行）；tree 的边必须来自合并后的 View，flow 的 baseline flows 仍是其独立步骤源，不能用 diff 节点迭代顺序替代流程步骤。

## 4. 可执行冻结与测试落点

### 4.1 本契约直接冻结的测试断言

- `LookupFlow`/`flow`：有 flows 时输出 `degraded=false` 和步骤树；无 flows 时成功输出 `degraded=true`、`steps=[]`、非空 `missing`；不得出现 chain 步骤。现状已有测试锚：`graph/codegraph/flow_test.go#TestLookupFlowHasSteps`、`#TestLookupFlowMissingIsDegradedNotChain`，CLI 读数锚：`graph/cli/cli_test.go#TestGraphFlowDegradedWhenNoFlows`（1210-1229 行）。
- `BuildCallTree`：菱形共享被调方按路径重复；向上 `--through`+`--from` 去掉兄弟支；只给 `--from` 失败；向下模式携带走廊参数失败。现状已有测试锚：`graph/codegraph/tree_test.go#TestCallTreeDownDiamondRepeatsSharedCallee`（50-79 行）、`#TestCallTreeUpCorridorDropsSiblingBranch`（81-96 行）、`#TestCallTreeFromRequiresThrough`（98-103 行）、`#TestCallTreeThroughOnDownRejected`（105-110 行）。
- 下游实现轮必须补测第四稿新增的只给 `--through` 保留 U 之上祖先、子节点 name/id 排序且不读 flows、`kind=entry` 不刹车、紫框 membership、entry caller 不可打开，以及导航栈/结构轴程序入口只读；这些属于本契约，不能由现有局部测试推定已覆盖。
- 页面主缝 `deriveFlowPage`、导航栈与 `layoutFlowSteps` 由 C17 spec §测试决定的五支接缝测试承重；查看器实现侧需把缺 flows 双向降级、caller/implementation/channel 语义和形态断言落成可变红测试。

### 4.2 金样本与拍板

- 哈希、密钥派生、编码格式金样本：**无命中**。本卡冻结的是 JSON 结构、节点集合和 CLI 行为，不冻结字节级编码向量；编码器既成行为见 §3。
- C17 三重闸门拍板一：泳道主语改为对外契约方法、CLI/HTTP/WS 降为到达通道。难逆转：扫描承重集合、viewer 主缝、CLI flow 输出和导航都要一起改；无上下文会惊讶：后人会自然把外部入口再画成主图；真取舍：否掉「一入口一主图」以换取方法行为可读性。明确不做：为每个通道保留并列主图。
- C17 三重闸门拍板二：紫框按 `call.to ∈（默认入缝 ∪ 实现 ∪ 已有 flows 符号）` 的机械集合判定，`kind=entry` 永不成为紫框目标。难逆转：扫描产出、viewer 画法和递归导航共享同一判据；无上下文会惊讶：旧语义曾把紫框近似当作入口，后人会想按入口字段修回；真取舍：否掉按通道/容器猜下层入口，接受集合需要随 flows 扩展。
- C17 三重闸门拍板三：`tree` 缺省是真树，向上用 `--through/--from` 走廊，不把 chain 嵌套打印当调用树。难逆转：CLI JSON、agent 使用方式和测试语义同时依赖路径重复；无上下文会惊讶：共享节点重复看似冗余，后人会想全局去重；真取舍：否掉 chain 的全局去重与隐式折叠，保留路径信息，`--once` 才作为显式例外。
- C17 三重闸门拍板四：页内只保留一颗「上一层」，栈底回原 scope 的结构轴，面包屑跳祖先。难逆转：流程页、结构轴装配和下钻来源共同依赖导航状态；无上下文会惊讶：不提供第二颗跳过整栈按钮；真取舍：否掉浏览器后退和第二套回退状态，统一「上一层 = 我从哪张图来」。

## 5. 目标图、视图与交棒欠账

### 5.1 冻结物

本仓是存量无项目图：本契约文档即冻结物，随本提交冻结。目标图 `codegraph/target.json`、结构图 `codegraph/best.json`、分支视图 `codegraph/diffs/<分支>.json` 均跳过，不造空文件。该跳过不是把本仓当绿地，也不把测试夹具的图误认成项目图。

### 5.2 交棒欠账

1. handoff 扫描配方：把承重 `flows` 键集合更新为对外入缝 ∪ 紫框下钻目标 ∪ 右栏实现方法；补 `branch.then/else` 的卫语句引用，禁止未引用 sequential return root；不在 charter 本卡修改 handoff 配方。
2. handoff/查看器实现：按 §2.2 落 `deriveFlowPage`、主语/通道/实现/直接 caller 模型、导航栈、结构轴旧入口只读与原型形态；实现侧负责补齐 §4.1 未覆盖测试。
3. charter CLI 当前已有 `flow`/`tree` 流程债；本契约冻结后，后续实现轮必须按 §2.4-2.6 对照已挂代码，缺字段补、越界字段删，不把现状实现自动视为契约。
4. `flow`/`tree` 当前已实现但本轮不改实现；本轮编译/测试只作为仓库健康证据，不替代 §4.1 的新增契约测试。
5. 不创建 `target.json`、`best.json` 或分支视图 diff；无图项目不需要为本卡新增符号造空视图。

## 6. 修订记录

- 2026-08-28：C17 第四稿已批准；本契约冻结行为轴主语、紫框唯一机械判据、到达通道/程序入口区分、调用树双模式、页面导航栈与 CLI JSON 接缝。
- 2026-08-28：当前工作树由 `origin/cards/C17-charter` 快进至 `04ed7a6a` 后查证；已挂 `flow`/`tree` 标为现状流程债，未作为终态字段来源。
