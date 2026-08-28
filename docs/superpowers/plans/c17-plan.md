# C17 实现计划：行为轴泳道主语改为对外契约方法

> 状态：实现计划；本节点只写计划与台账，不实现代码、不创建脚手架、不派发。
> 冻结输入：`docs/superpowers/specs/c17-contract.md`、`docs/specs/2026-08-27-flow-subject-is-contract-spec.md` 第四稿、`docs/superpowers/specs/c17-breakdown.md`（拍板提交 `24d86ed`）、`prototypes/base/README.md`。
> 产出：`docs/superpowers/plans/c17-plan.md`。
> 过程台账：`docs/ledgers/2026-08-28-c17-plan-ledger.md`。

## 0. 执行边界、形态和基线

本计划给后续单轮实现者使用。C17 是 L3 轻档单轮，不建立子卡，不新增横向层；只覆盖拆解第五节的 S1（`graph/codegraph` + `graph/cli`）与 S2（`graph/webui`）。S3 扫描配方不在本仓，作为协调者 acceptance 的交棒项，不进入实现步骤。

当前工作树没有项目级 `codegraph/`，也没有 `prototypes/codegraph-two-axis/`；后者是 gitignore 的 fork 副本，不能当本仓输入。计划仅采用已冻结契约、第四稿 spec 和 `prototypes/base/README.md` 已确认的形态要点，不另起形态。原型 HTML 逐屏对拍只列在第 8 节真机清单，不阻塞本计划。

已在基线亲跑并记录台账的命令与结果：

```text
在 graph/ 执行 go build ./...：退出码 0，stdout 为空。
在 graph/ 执行 go test ./codegraph/ ./cli/ -count=1：退出码 0。
原始通过行：ok  github.com/Xsxdot/charter/graph/codegraph  0.025s
原始通过行：ok  github.com/Xsxdot/charter/graph/cli  0.159s
在 graph/webui/ 执行 npm run typecheck：退出码 127。
原始失败行：sh: 1: tsc: not found
在 graph/webui/ 执行拆解指定的 Vitest 文件命令：退出码 127。
原始失败行：sh: 1: vitest: not found
```

因此 Go 基线判据已经复核；WebUI 的 typecheck 和 Vitest 判据在依赖未安装的基线中未验证。实现者须先在实现轮安装仓库已有依赖或使用工作区既定依赖缓存，再亲跑 WebUI 命令；不得把上面的 127 写成测试通过。

本轮允许修改的文件集严格为：

| 子系统 | 可修改文件 | 只读依赖 | 对外接缝 |
|---|---|---|---|
| S1 | `graph/codegraph/flow.go`、`graph/codegraph/flow_test.go`、`graph/codegraph/tree.go`、`graph/codegraph/tree_test.go`、`graph/cli/cli.go`、`graph/cli/cli_test.go` | `graph/codegraph/{types.go,load.go,sym.go,merge.go,assemble.go}` | `LookupFlow`、`BuildCallTree`、`flow`、`tree`、`summary` |
| S2 | `graph/webui/src/api/types.ts`、`graph/webui/src/app/codegraph/{flowpage.ts,flowpage.test.ts,FlowChart.tsx,FlowChart.test.tsx,flowlayout.ts,flowlayout.test.ts,FlowPageView.tsx,FlowPageView.test.tsx,RightPanel.tsx,RightPanel.test.tsx,TwoAxisPage.tsx,TwoAxisPage.test.tsx,CodegraphPage.tsx,CodegraphPage.test.tsx,CodegraphPage.wire.test.tsx}` | `graph/webui/src/app/codegraph/scopepage.ts`、`graph/webui/src/api/client.ts` 只读核对 scope/Response 解码 | `deriveFlowPage`、`FlowChart`、`FlowPageView`、右栏与两轴装配 |
| S3 | 无本仓文件 | handoff 扫描配方 | 由协调者在真机 acceptance 执行 |

不得修改扫描器、handoff 配方、`prototypes/`、项目图元数据、`chain`/`who-calls` 语义或新增宿主请求。已挂的 `flow`/`tree` 是流程债，不因已有源码而跳过红测。

### 0.1 形态不变量

实现必须逐项保持以下已冻结形态：

- 方法是一条泳道；CLI/HTTP/WS 是“到达通道”，不是泳道主语。默认主语是“对外面”未折叠的跨域入缝；可打开集合再并入紫框命中目标和接口实现方法。
- 紫框 ▸ 的唯一判据是 `kind=call` 且 `call.to` 命中可打开主语集合；`kind=entry` 永不因节点类型成为紫框、开图或栈项。
- 流程图用矩形调用、真实菱形分支、卫语句侧甩返回、折列蛇形 SVG 连线、接口调用双线框。不要用橙/琥珀圆角矩形冒充菱形，不用“接上列”等文字替连线。
- 右栏永久保留三段：到达通道、实现、被谁调用；“调用链（给 agent）” tab 保留但不冒充流程图。到达通道只能高亮，不换图。
- 页面只有一颗“← 上一层”。页内栈允许 A→B→A，不去重；栈底返回结构轴时保留原 scope；面包屑可跳祖先并截断后续。

## 1. 冻结接口和数据边界

以下代码块是实现者必须保持的精确签名。代码块中的新类型/字段是计划约束，不表示本节点已经写入源码。

### 1.1 Viewer 类型（S2）

在 `graph/webui/src/api/types.ts` 保持既有 C12 wire 类型，并按下列代码补足或复核 viewer 使用的精确类型；不要为 C17 复制 `flows` 顶层键，也不要把 `openable` 写回 `CgNode`：

```ts
export type CgFlowStepKind = 'call' | 'branch' | 'loop' | 'return'

export interface CgFlowStep {
  id: string
  order: number
  kind: CgFlowStepKind
  line: number
  to?: string
  cond?: string
  then?: string[]
  else?: string[]
  body?: string[]
  iface?: boolean
}

export interface CgFlow { steps: CgFlowStep[] }
export type CgEntryChannel = 'cli' | 'http' | 'ws' | 'web'

export interface CgGraph {
  meta: CgMeta
  domains?: Record<string, CgDomain>
  containers: Record<string, CgContainer>
  nodes: Record<string, CgNode>
  edges: [string, string][]
  implements?: [string, string][]
  projections?: [string, string, string][]
  lifecycle?: CgLifecycleRef[]
  packages?: Record<string, { summary: string }>
  flows?: Record<string, CgFlow>
}

export interface FlowPageInput {
  baseline: CgGraph
  entryNodeId: string
}

export interface FlowNodeRef {
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

export interface FlowPageModel {
  subject: FlowNodeRef
  degraded: boolean
  missing?: string
  steps: CgFlowStep[]
  callers: FlowNodeRef[]
  implementations: FlowNodeRef[]
  channels: FlowNodeRef[]
}

export function deriveFlowPage(input: FlowPageInput): FlowPageModel
```

`deriveFlowPage` 的导出只供 codegraph 应用模块内部消费。`entryNodeId` 是 C12 遗留字段名，但语义只能是当前方法主语 id；任何实现变量、标题或按钮都不能把它重新解释为 CLI/HTTP/WS 入口。

### 1.2 Go flow 查询（S1）

`graph/codegraph/flow.go` 必须保持以下 Go/JSON wire 和函数签名；`SymMatch`、`FlowStep` 使用既有定义，不另造定位协议：

```go
type FlowRef struct {
	ID      string `json:"id"`
	Name    string `json:"name"`
	File    string `json:"file,omitempty"`
	Line    int    `json:"line,omitempty"`
	Kind    string `json:"kind,omitempty"`
	Channel string `json:"channel,omitempty"`
}

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

func LookupFlow(v *View, g *Graph, repoRoot, query, id string) (*FlowLookupResult, error)
```

行为约束：`id` 已由 CLI 决议且必须是活跃节点；`query` 原样进入结果；`repoRoot` 只用于既有 `SymMatch` 再锚定。空 View、未命中、删除节点返回 error。缺 `flows[id]` 或步骤为空才成功 degraded，`steps` 必为非空数组的空切片 `[]`、`missing` 非空，不得用 chain/tree 邻域填充。命中时步骤树按 baseline 透传。三邻域分别是活跃直接 caller、`implements` 的 `[实现,接口]` join、能沿活跃调用边反向到达的 `kind=entry` 通道；删除节点和删除边全部过滤。

### 1.3 Go tree 查询（S1）

`graph/codegraph/tree.go` 必须保持以下类型和签名：

```go
type TreeOptions struct {
	Focus    string
	Up       bool
	Depth    int
	Through  string
	From     string
	Once     bool
	MaxNodes int
}

type TreeNode struct {
	ID        string     `json:"id"`
	Dist      int        `json:"dist"`
	Kind      string     `json:"kind"`
	Name      string     `json:"name"`
	File      string     `json:"file"`
	Line      int        `json:"line"`
	Domain    string     `json:"domain,omitempty"`
	Container string     `json:"container,omitempty"`
	Children  []TreeNode `json:"children,omitempty"`
}

type TreeResult struct {
	View      string      `json:"view"`
	Focus     string      `json:"focus"`
	Up        bool        `json:"up"`
	Depth     int         `json:"depth"`
	Through   string      `json:"through,omitempty"`
	From      string      `json:"from,omitempty"`
	Once      bool        `json:"once,omitempty"`
	Root      TreeNode    `json:"root"`
	Truncated *Truncation `json:"truncated,omitempty"`
}

func BuildCallTree(v *View, opts TreeOptions) (*TreeResult, error)
```

`Depth < 0` 不限、`Depth == 0` 只根；CLI 默认 2，CLI `--depth 0` 传 API `-1`。向下是真树，菱形共享节点按路径重复；默认不去重，自环出现一次后停止，entry 不刹车。子节点按 `name` 再 `id` 升序。`--once` 仅显式开启全局一次展开。向上支持 `--through`，只给 through 仍保留 U 之上的祖先；`--from` 必须与 through 同时出现且只保留 `F→U`、U 到焦点的走廊。向下携带 corridor、非祖先、断走廊和只给 from 都 error。只读 View 调用边，不读 flows、不画 CFG、不复用 chain 折叠。

### 1.4 CLI 边界（S1）

`graph/cli/cli.go` 保持 `graphLoadView() (*codegraph.View, *codegraph.Graph, error)`、`graphPrintJSON(cmd, value)`、`graphUniqueID` 的既有职责。canonical `codegraph` 与挂载为 `graph` 的别名共享同一 Cobra 命令树。命令精确为：

```text
codegraph flow <节点 id 或名字>
codegraph tree <节点 id 或名字> [--depth N]
codegraph tree <焦点> --up [--depth N] [--through <上面那层>] [--from <调用上面那层的方法>]
```

两个命令都用恰一位置参数，继承 `--repo`/`--view`，不提供 `flow --with-source`。决议顺序为 id 精确 > Name 精确 > 方法尾段精确；同级多义列候选 id 后非零，未命中走既有 sym error 通道。成功 stdout 是一个 JSON 值并以换行结束；错误非零且不包装成功 JSON。`summary` 必须包含 `flow` 与 `tree`；`chain`、`who-calls` 保持原语义。

实现这些边界时只依赖已查证的库行为：模块版本在 `graph/go.mod`，允许依赖断言在 `graph/cli/deps_test.go:12-23`；Cobra `ExactArgs(1)` 的实现位于 `/root/go/pkg/mod/github.com/spf13/cobra@v1.10.2/args.go:93-100`，子命令 flag 解析位于 `/root/go/pkg/mod/github.com/spf13/cobra@v1.10.2/command.go:1867-1888`；pflag 版本与 flag 行为见冻结 contract §3.7；`encoding/json.Encoder.Encode` 写尾换行的标准库出处是 `/usr/local/go/src/encoding/json/stream.go:193-223`，现有 `graphPrintJSON` 的缩进与 `SetEscapeHTML(false)` 是 `graph/cli/cli.go:94-99`。这些出处对应的行为由 T1 CLI 接缝测试复核，不新增第三方依赖。

## 2. 实现依赖图、任务边界和故事归属

后续实现按以下无环顺序执行；这是实现计划内的任务序列，不是子卡或派发 assignments：

```text
T1 S1 seam tests red ──→ T2 S1 Go/CLI minimum implementation ──→ T4 S2 viewer implementation
T3 S2 seam tests red ──→ T4 S2 viewer implementation
S3 scanning handoff ───→ T2 and T4 acceptance input (coordinator only)
```

S1 和 S2 的测试准备可以各自开始，但 T4 的真实 wire 语义必须同时对齐 S1 的冻结字段；S3 不进入任何本仓实现步骤。

spec 用户故事逐条归属如下：

| spec 故事 | 具体计划任务 | 可观察闭环 |
|---|---|---|
| 1 方法主语 | T1/T2 flow 查询、T3/T4 入缝入口与方法标题 | 对外入缝打开方法图，程序入口不打开图 |
| 2 承重流程 | T1/T2 `LookupFlow`，T3/T4 `deriveFlowPage` | flows 命中透传，缺 flows 明确 degraded |
| 3 紫框下钻 | T3/T4 `flowpage` + `FlowChart` | call.to 命中承重集合才紫框/开图 |
| 4 右栏关系 | T1/T2 邻域 + T3/T4 右栏三段 | channels/implementations/callers 各自口径稳定 |
| 5 页面导航 | T3/T4 `FlowPageView`/`CodegraphPage` | 页内栈、上一层、祖先面包屑、scope 保留 |
| 6 流程形态 | T3/T4 `flowlayout`/`FlowChart` | 菱形、卫语句侧甩、蛇形连线、双线框 |
| 7 tree | T1/T2 `tree.go`/CLI | 真树、corridor、排序、截断 |
| 8 agent CLI | T1/T2 CLI | flow/tree JSON、错误、summary、alias |
| 9 降级与退场 | T3/T4 + 第 8 节真机清单 | 不伪造 chain，不为通道并列主图 |

## 3. T1：S1 接缝测试先红

### 3.1 文件、入口和范围

只编辑 `graph/codegraph/flow_test.go`、`graph/codegraph/tree_test.go`、`graph/cli/cli_test.go` 的测试部分；复用既有 `graph/codegraph` 构造器和 `graph/cli` 的 `fixtureRepo`、`runGraph`、`runGraphSeparate` harness。测试入口必须是以下声明缝：`LookupFlow`、`BuildCallTree`、`runGraph`/`runGraphSeparate`，不直接测试私有 helper。既有旧测试可保留，但与 C17 入口主语冲突的测试必须改成方法主语语义，不能靠旧测试继续证明旧行为。

本 task 的 Interfaces：Consumes 为既有 `Graph`/`View` fixture、`LookupFlow(v *View, g *Graph, repoRoot, query, id string)`、`BuildCallTree(v *View, opts TreeOptions)`、Cobra 根命令和 `runGraph`/`runGraphSeparate`；Produces 为 Go result 对象、CLI stdout/stderr/exit code 的可判定断言。T1 不改变导出签名，不新增 fixture 文件或依赖。

测试范围只跑：

```text
cd graph && go test ./codegraph/ ./cli/ -run 'Test(LookupFlow|CallTree|GraphFlow|GraphTree|GraphSummary|GraphCommand)' -count=1
cd graph && go test ./codegraph/ ./cli/ -count=1
```

第一条是修改期间的最小范围；第二条是 S1 绿测和任务验收范围。全仓测试不属于 T1/T2。

### 3.2 `flow` 接缝断言清单

在 `graph/codegraph/flow_test.go` 以现有 `flowWorld`/`degradeBase` 同形态的 `Graph`、`View` fixture 写或改以下完整行为测试。允许复用既有 harness 的形态例外：不复制库代码；每条断言必须照下面清单写出并能独立变红。

1. `TestLookupFlowHasSteps`：用有 `flows[id].Steps` 的方法节点调用 `LookupFlow(v,g,"repo","用户查询",id)`；断言无 error、`View` 等于 view 名、`Query` 原样保留、`Subject.ID` 等于 id、`Degraded == false`、`Steps` 与输入步骤的 id/order/kind/to/cond/then/else/body/iface 逐字段相等；断言 `Callers`、`Implementations`、`Channels` 非 nil。
2. `TestLookupFlowMissingIsDegradedNotChain`：分别构造 `g == nil`、`g.Flows == nil`、`g.Flows` 缺该 id、该 id 的 steps 为空四种输入；每次断言无 error、`Degraded == true`、`Missing != ""`、`len(Steps)==0` 且 `Steps` JSON 为 `[]`，并断言 steps 中不出现任何邻域节点 id。
3. `TestLookupFlowRejectsMissingOrDeletedSubject`：对不存在 id、View 中 status 为 deleted 的 id、nil View 分别断言返回 error 且结果指针为 nil；不要把这些输入断言为 degraded 成功。
4. `TestLookupFlowNeighborsUseActiveEdges`：构造直接 caller、删除 caller、删除边、活跃 entry 祖先、删除 entry、`implements` 实现和删除实现；断言 callers 只有活跃直接 caller，implementations 只有活跃 `[实现,接口]` join，channels 只有反向活跃 entry；三数组按 name 再 id 稳定排序；空数组断言非 nil。
5. `TestLookupFlowSubjectUsesSymMatch`：用 repoRoot 和需要再锚定的 fixture 调用 `LookupFlow`，断言 `Subject` 保持既有 `SymMatch` 的 id、anchor、domain、ViewNode 字段；不接受新增平行定位字段。

### 3.3 `tree` 接缝断言清单

在 `graph/codegraph/tree_test.go` 以既有 tree fixture 风格通过 `BuildCallTree` 写或改以下测试：

1. `TestCallTreeDownDiamondRepeatsSharedCallee`：构造 A→B、A→C、B→D、C→D；用 `Depth < 0`、`Once=false`，断言根 dist=0，B/C 各为 A 的 child，D 分别出现在 B 和 C 的 children 中恰两次；同一函数内不使用 flows。
2. `TestCallTreeDownSortsByNameThenID`：给同一父节点三个子节点，输入边顺序与 name/id 顺序相反且有同名不同 id；断言 children 先按 name 再按 id，不随 edges 输入顺序改变。
3. `TestCallTreeSelfLoopAppearsOnceAndStops`：构造 A→A，断言 A 根下恰一份 dist=1 的 A，且该子节点无 children；同时构造 entry→func→entry 回路，断言 entry 不会因 kind 自动截断。
4. `TestCallTreeDepthAndTruncation`：断言 API `Depth==0` 只有根、`Depth==1` 只有一层、`Depth==-1` 可继续；用 `MaxNodes` 小于真实展开数，断言 `Truncated != nil`、`AtDepth`、`DroppedNodes`、`Reason == "max-tree-nodes"` 均有值，未截断时 `Truncated == nil`。
5. `TestCallTreeUpCorridorDropsSiblingBranch`：构造 `F→U→M→焦点` 以及 U 的兄弟 caller 和 F 的其他边；`Up=true, Through=U, From=F` 只出现 F→U→M→焦点走廊，兄弟支不出现；只给 Through 时 U 之上的祖先仍保留直到 depth。
6. `TestCallTreeCorridorValidation`：逐项断言只给 From、向下带 Through/From、Through 不是焦点祖先、From 不直接调用 Through、走廊不能到达焦点均返回 error；错误结果为 nil。
7. `TestCallTreeFiltersDeletedEdgesAndNodes`：构造 deleted 节点/边及活跃边，断言删除项不出现在任何 children 中；不因 flows 存在而改变 tree 结果。

### 3.4 CLI 接缝断言清单

在 `graph/cli/cli_test.go` 通过既有 `runGraph`/`runGraphSeparate`（不得直调 `graphFlowCmd` 或 `graphTreeCmd`）加入或改写：

1. `TestGraphFlowJSONContract`：执行 `flow` 单参数；解码 stdout，断言顶层有 `view/query/subject/degraded/steps/callers/implementations/channels`，有 steps 时 degraded 为 false；用原始 stdout 断言最后一个字节是换行，stderr 不承载成功 JSON。
2. `TestGraphFlowDegradedWhenNoFlows`：执行无 flows fixture 的 `flow`；断言退出码为 0、`degraded:true`、`steps:[]`、`missing` 非空；断言 stdout 不含邻域节点被伪装为 steps。
3. `TestGraphFlowRejectsUnknownAndAmbiguous`：未命中 id 断言非零且不是成功 JSON；同级多义 query 断言非零且错误文本列出每个候选节点 id；id 精确优先于 name 精确，name 优先于方法尾段精确各断言一次。
4. `TestGraphTreeDownFixture`：执行默认 tree 和显式 `--depth 0`；断言默认 depth=2，depth=0 输出 API 不限且共享 D 按路径出现；默认 stdout 是单个换行 JSON。
5. `TestGraphTreeFromRequiresThrough`：只给 `--from`、向下带 corridor、非法祖先和断走廊分别断言非零；有效 `--up --through U --from F` 断言输出不含兄弟支。
6. `TestGraphSummaryIncludesFlowAndTree`：通过 root command 执行 summary，断言命令说明同时含 `flow` 与 `tree`；原有 `chain`、`who-calls` 名称和测试保持。
7. `TestGraphCommandTreeUsesBehaviorNotCount`：在既有命令树 harness 中按命令名断言 `flow`、`tree` 同时挂到 canonical 根和 graph alias；不再以精确命令总数作为唯一判据，以免零边节点满足计数而行为缺失。

T1 的“红”是指先写上述断言，再在 `graph` 运行第 3.1 第一条命令；实现轮应记录真实失败原文。若基线某条已意外通过，仍须检查该测试入口是否穿过声明缝；不可改成直接喂私有 helper 的内部锁。T1 不写日志/注释实现；测试 fixture 注释需说明为什么输入能暴露契约反例。

## 4. T2：S1 Go/CLI 最小实现并绿

### 4.1 文件和调用接口

只改 `graph/codegraph/flow.go`、`graph/codegraph/tree.go`、`graph/cli/cli.go` 及对应测试文件；保持第 1 节所有导出签名。Consumes 是 `View` 活跃节点/边、`Graph.Flows`、`Graph.Implements`、`SymLookup`；Produces 是 `FlowLookupResult`、`TreeResult` 以及 CLI 单 JSON stdout。S1 不消费 viewer，不写 baseline，不读 handoff 配方。

### 4.2 flow 实现步骤（非独立红绿步骤）

1. 在 `LookupFlow` 入口记录 `query`、`id`、view 名和 graph 是否有 flows；nil View、空/删除 id 每条 error 分支使用 `slog.Default().Error` 带 `query`/`id`/视图上下文后返回 error。
2. 通过既有 `symMatchFor(v, repoRoot, id)` 构造 `Subject`；不复制 `SymMatch` 字段。初始化 `Steps`、`Callers`、`Implementations`、`Channels` 为非 nil 空切片，保证 JSON 为 `[]`。
3. 仅读取 `g.Flows[id]`：缺席、nil graph 或空 steps 设 `Degraded=true` 与非空 `Missing`，不调用 chain/tree；命中时复制步骤树，保留顺序和所有可选字段，不重新按边排序或重建。
4. 用活跃调用反向邻接求一跳 callers；用 `Graph.Implements` 的 `[实现,接口]` 方向 join 当前 subject，先检查实现节点活跃；用反向 BFS 求能到达 subject 的活跃 entry channels。所有邻接构造都先检查 from/to 节点存在且非 deleted，避免悬空边触发零值节点访问。
5. 三数组用 name 再 id 稳定排序；实现/通道/caller 的成功和空结果都在 Info 日志中带计数，缺 flows 的成功降级日志带 `degraded` 与 `missing`。不得将 entry caller 或 channel 改成可打开主语，这是 viewer 的 `openable` 投影规则。

新增或修改的导出注释必须说明参数、返回值和“缺 flows 是 degraded、错误节点不是 degraded”的注意事项；文件头注释说明职责是只读 flow 查询、边界是不生成 CFG/chain。悬空边过滤的注释写“视图边可能先于节点删除记录到达，查询不能把零值节点当真实邻域”。

### 4.3 tree 实现步骤（非独立红绿步骤）

1. `BuildCallTree` 入口带 focus/up/depth/through/from/once/maxNodes 的 `slog` Info；nil view、空/删除 focus、错误方向和 corridor 校验各用 Error 带完整参数后返回 error。
2. 构造只包含活跃端点和非 deleted edge 的 forward/reverse adjacency；稳定排序 comparator 只读取节点 name/id，不读 flows。
3. 默认向下递归为真树：path map 仅用于当前路径自环保护，不做跨分支去重；self-loop 追加一次终点并不递归；entry 按普通节点继续展开。`Once` 为真才使用全局 seen。
4. 按 API depth 规则停止；超过 `MaxNodes` 时设置既有 `Truncation`，记录 atDepth/droppedNodes/reason，成功返回带 `truncated` 而非静默截断。成功日志带节点数和 truncation 状态。
5. 向上 corridor 先算祖先/走廊允许集，再过滤反向 adjacency。只给 through 不剥掉 U 之上的祖先；from 必须直接调用 through 且 through 必须在焦点祖先范围内。非法输入每条返回 error，不返回空成功树。

导出类型/函数注释必须说明 depth、children 方向、corridor 和只读边界；文件头注释明确 tree 不是 chain/CFG。不要为了实现 tree 加新依赖或读取 `flows`。

### 4.4 CLI 实现步骤（非独立红绿步骤）

1. 保持 `graphLoadView` 先加载 baseline、按 `--view` 得到 View，并把 baseline Graph 传给 `LookupFlow`；flow query 经过 `graphUniqueID` 决议后将原 query 和 resolved id 同时传入。决议错误原样走既有 Cobra error 通道。
2. 保持 Cobra `ExactArgs(1)`；tree 的 `--depth` 默认 2，值 0 转 API -1；`--through`/`--from` 先用同一解析器得到 id，再由库层验证关系。不要添加 `--with-source`。
3. 复核 canonical 与 graph alias 使用同一 `New`/`init` 命令树；summary 菜单只增 flow/tree 的命令说明，不删 chain/who-calls。`graphPrintJSON` 继续使用既有 Encoder，保持一个 JSON 值和换行。
4. CLI 成功调用前后记录 `slog` Info（命令、query、resolved id、view、JSON 结果类别）；每条加载、决议、库调用、打印错误带命令和 query 上下文。禁止 `fmt.Print`/`println` 作为日志；stdout 只给契约 JSON，日志走项目结构化 logger。

### 4.5 T2 绿测和验收范围

先运行 T1 最小命令，确认所有 S1 接缝测试实际绿，再运行：

```text
cd graph && go test ./codegraph/ ./cli/ -count=1
cd graph && go build ./...
```

两条都必须由实现者亲跑并记录原始输出；不把未跑结果写成 pass。T2 不跑 WebUI 和全仓测试。

## 5. T3：S2 查看器接缝测试先红

### 5.1 文件、入口和测试例外

只编辑第 0 节 S2 文件集中的测试文件和为测试所需的既有类型引用；不新增测试 fixture 文件。测试必须经下列真实接缝进入：`deriveFlowPage`、`layoutFlowSteps`、`FlowChart`、`FlowPageView`、`RightPanel`、`TwoAxisPage`、`CodegraphPage`。`flowpage.test.ts` 可以直接调用 `deriveFlowPage`；组件测试必须 render 真实组件，由组件调用真实派生器，不能 import 私有 helper 代替入口。

本 task 的 Interfaces：Consumes 为 `CgGraph`、`FlowPageInput`、`FlowPageModel`、`ScopePageModel` 和既有 React 组件 props；Produces 为可判定的 `FlowPageModel` 字段、`layoutFlowSteps` 的 `FlowLayout`、组件 DOM/data-*、SVG path、callback 参数以及真实 Response wire 回归。精确的跨 task 类型签名见第 1 节和第 6.1 节；T3 不新增宿主 API 或网络请求。

本 task 使用既有 harness 例外：测试 fixture 形态沿现有文件照抄，完整 fixture 代码不在计划中重复；实现者必须在指定文件内复用并改写现有 `flowWorld`、`degradeBase`、`renderPage`、`modelFixture`、`k4World`、`wireWorld` 等 harness。以下清单逐支列明可判 pass/fail 的断言，清单外不得用内部锁替代声明缝。

测试范围只跑触及包：

```text
cd graph/webui && npm test -- src/app/codegraph/flowpage.test.ts src/app/codegraph/FlowChart.test.tsx src/app/codegraph/flowlayout.test.ts src/app/codegraph/FlowPageView.test.tsx src/app/codegraph/RightPanel.test.tsx src/app/codegraph/TwoAxisPage.test.tsx src/app/codegraph/CodegraphPage.test.tsx src/app/codegraph/CodegraphPage.wire.test.tsx
cd graph/webui && npm run typecheck
```

依赖安装不是本 task 的代码范围；若 `tsc`/`vitest` 仍不存在，保留原始报错，不能自行写成红测或绿测结论。

### 5.2 `deriveFlowPage` 和 wire 投影断言

在 `graph/webui/src/app/codegraph/flowpage.test.ts` 改写旧入口主语测试并保留必要 wire fixture，至少包含以下测试；旧的 ownership/registrationDispersion/family 主图断言不再作为 C17 验收，必须删除或改成不影响冻结模型的历史测试：

1. `derivesMethodSubjectAndRelations`：以一个 `kind=func` 方法 id 作为 `entryNodeId`，同时放置 CLI/HTTP/WS `kind=entry` 节点和跨域入缝方法；断言 `subject.id/name/kind/file/line` 来自方法节点，`subject.openable` 为 true；断言 `steps` 只来自 `baseline.flows[methodId]`。
2. `entryIsChannelNotSubject`：以 entry id 调用派生器只验证该页的 `subject.kind === 'entry'` 是数据事实、`channels` 中的 entry `openable === false`；不得把 entry 类型自动投影为紫框/下钻元数据，也不得生成旧 `entryName`、`family`、`ownership`、`registrationDispersion` 必有字段。
3. `flowHitPassesThroughSteps`：输入 branch 的 `then`/`else` 与 loop 的 `body`，包含 guard return 引用；断言 `degraded === false`，每个 step 的 id/order/kind/to/cond/line/then/else/body/iface 逐字段保留，顺序不由 edges 改写。
4. `flowMissingAndEmptyAreExplicitDegraded`：分别删掉 `flows` 顶层、保留空 flows、缺少 subject key；断言 `degraded === true`、`steps` 是长度 0 的非 nil 数组、`missing` 非空，且不出现 edge reachable 节点；再构造 `line: 0` 的真实 subject，断言 line 仍为数字 0，和缺失 `missing` 不是同一信号。
5. `callersAreDirectAndActiveOnly`：加入直接 caller、二跳 caller、删除 caller、删除边；断言只输出一跳活跃 caller，二跳和删除项不在 callers，普通 caller 只有存在 `flows[id]` 时 `openable=true`，entry caller `openable=false`。
6. `implementationsComeFromImplementsJoin`：加入 `[实现,接口]`、反向边、幽灵实现、删除实现，并把伪造实现数组塞进未经静态校验的 flow JSON；断言 implementations 只来自正确方向且活跃节点的 join，伪造 flow 字段被忽略，数组无命中仍为 `[]`。
7. `channelsAreReverseReachableEntries`：构造 entry→helper→method、不可达 entry、删除 entry、非 entry caller；断言 channels 只含活跃反向可达 entry，channel 值 `cli|http|ws|web` 原样透传，空结果是 `[]`。

### 5.3 `FlowChart` 和 `flowlayout` 形态断言

在 `graph/webui/src/app/codegraph/flowlayout.test.ts` 通过 `layoutFlowSteps` 写：

1. `layoutFlowStepsKeepsGuardReturnsOffLinear`：branch 的某一臂只有 return；断言该 return 有 `guardReturn=true` 的 node、`layout.sequence` 不含该 id、`layout.childEdges` 仍有 branch→return 边。
2. `layoutFlowStepsProducesSnakeColumns`：使用超过一列的已排序步骤和固定宽度；断言相邻折列的列号递增、奇数列 y 方向翻转，布局结果重复输入完全相等；断言没有文字标签字段承担接续。
3. `layoutFlowStepsMapsAllKinds`：四个合法 kind 分别得到 rect/diamond/loop/terminal，词表外输入得到 unknown；断言 branch 是 diamond，不是 rounded rectangle 的语义替代。

在 `graph/webui/src/app/codegraph/FlowChart.test.tsx` 经 `deriveFlowPage` 生成 model，并以同一 fixture 传入第 6.1 的 `baseline` 与 `openableSubjectIds` 后 render 真实 `FlowChart`，覆盖以下声明缝：

1. `rendersDiamondAndGuardSideEdge`：断言 branch 节点 `[data-shape="diamond"]` 存在、其几何 class/style 使用真实菱形（例如 clip-path 或等价四边形实现）而非 rounded rectangle；guard return `[data-guard-return="true"]` 存在且 `data-flow-edge="child:branch:return"` 使用侧边 path；`layout.sequence` 的主干 DOM 不含 guard return。
2. `rendersSnakeWrapPath`：宽度迫使至少两列，断言存在 `path[data-flow-edge^="wrap:"]`，`d` 非空且是 SVG path；断言没有“接上列”等文字节点来代替该 path。
3. `rendersInterfaceAsDoubleBorder`：`iface:true` 的 call 节点有双线框可判定 DOM class/attribute，右栏实现数据不从 flow 步骤伪造。
4. `purpleOnlyForOpenableCallTargets`：显式传入或由页面上下文形成可打开集合 `{默认未折叠入缝方法, 已有 flows 方法, 实现方法}`，并放入一个 `flows[entryId]` 遗留通道项作为反面；断言只有 `kind=call` 且 `to` 命中集合的节点带紫框和 `▸`，branch/loop/return 即使有 `to` 也不带紫框，entry target 和普通无 flows call 不带紫框。
5. `entryTargetNeverDrills`：将 call.to 指向 `kind=entry` 到达通道；断言该节点没有紫框/下钻标志，点击只调用 `onSelectStep` 或高亮，不调用 `onOpenSubject`。
6. `degradedDoesNotRenderMechanicalChain`：对 `steps=[]` 的 model render，断言画布无 `[data-step]`，只显示 degraded 空态；不得以 edges 生成替代步骤。

### 5.4 页内栈、右栏和两轴装配断言

在 `graph/webui/src/app/codegraph/FlowPageView.test.tsx` 以真实 `FlowPageView` render 覆盖：

1. 初始请求为方法 A 时标题显示 A 的方法名、当前 id 和 degraded 状态；右栏永久存在 `data-flow-channels`、`data-flow-implementations`、`data-flow-callers` 三段。caller 只显示一跳；无流程 caller 显示名称和“无流程图”。
2. 点击紫框 B、实现项 B、可开普通 caller B 各自将 B 压入栈并换图；返回后恢复真实来源；A→B→A 再次压栈，深度增加，不因 id 已出现而去重。
3. 点击到达通道项只设置 `data-highlighted`（以及存在的图上第一步高亮），不改变当前主语、不调用换图 callback、不增加栈深。
4. 面包屑显示 `结构轴 ▸ A ▸ B ▸ 当前`；点击 A 后当前为 A 且 B 被截断；只有一颗 `[data-flow-back]`。首层点击它调用回结构轴 callback，并断言 origin scope id/label/organization 保留。
5. degraded 页面显示 `missing`，不显示伪造 linear 步骤；流程选择从一个主语换到另一个主语时旧 step selected 状态消失。

在 `graph/webui/src/app/codegraph/RightPanel.test.tsx` 经真实 `RightPanel` 入口覆盖：

1. “对外面” tab 展示未折叠入缝方法，并点击该方法调用 `onOpenSubject(methodId)`；折叠入缝仍按 scope 模型先展开后出现，不把折叠块当默认主语。
2. 基本信息中的 CLI/HTTP/WS/Web 程序入口仍按 channel 分组但按钮不可调用 `onOpenSubject`；点击只保持结构页并可显示选中/高亮状态。
3. “对外面”明确写“入缝”与“到达通道”是两种对象；不存在“每个通道一张主图”按钮；既有“调用链（给 agent）” tab 仍在且不渲染第二棵调用树。

在 `graph/webui/src/app/codegraph/TwoAxisPage.test.tsx` 通过真实 `deriveScopePage` 覆盖：

1. 点击 `inboundSeams` 未折叠方法，`onOpenSubject` 收到方法 id 和当前 scope origin context；点击程序入口卡只改变 entry active/highlight，不触发 callback。
2. 切换 organization、scope 或 breadcrumb 时，结构轴原有选择/组织行为不回退；入缝集合来自模型，组件不在 JSX 重算跨域边。

在 `graph/webui/src/app/codegraph/CodegraphPage.test.tsx` 覆盖：

1. 由结构轴回调方法 id 后进入行为轴，页头写方法主语，不再写“程序入口流程图”；行为轴仅保留一颗上一层入口。
2. 点击上一层回到同一 `TwoAxisPage` scope，不清空 baseline 组织上下文；换视图时旧行为栈清空，不能泄漏到新 baseline。

### 5.5 真实序列化边界测试

在 `graph/webui/src/app/codegraph/CodegraphPage.wire.test.tsx` 保留 fetch mock 作为真实 `Response JSON → useCodegraph → CgGraph → deriveFlowPage → CodegraphPage DOM` 链，不直接把 JS object 喂给派生器。把旧 `e_run` 主语 fixture 改为至少包含：entry `e_cli`、方法 `m_run`、`edges: [['e_cli','m_run']]`、`flows: { m_run: { steps: [...] } }`、`line: 0` 的方法字段。逐条断言：

1. wire 含 `flows.m_run` 时，点击结构轴入缝方法进入 `[data-flow-page]`，`data-degraded="false"`，标题/subject 是 `m_run`，不是 `e_cli`，并能看到 `line=0` 的步骤/subject 字段。
2. wire 整体缺 `flows` 时，结构轴仍渲染，点击入缝方法进入显式 degraded；`data-degraded="true"`、`data-flow-degraded` 在场、`data-flow-chart` 与 `[data-step]` 不在场。
3. wire 中 `line: 0` 与完全省略 line 的节点/字段分别断言：0 仍传成数字 0，省略字段保持 undefined/缺席；不得以 `||` 把 0 变成缺失。
4. wire 中 `implements`、`channel`、edges 的字段经过真实 JSON 解析后仍分别出现在 implementations/channels/入缝路径；不新增请求、不靠另一个 fixture 证明传输。

T3 的“红”是在改写断言后，于 `graph/webui` 运行第 5.1 第一条命令；实现者必须保留真实失败输出。测试只断言 data-*、role、callback 参数、状态和 SVG path，不以 snapshot/pixel 计数替代行为锁。

## 6. T4：S2 viewer 最小实现并绿

### 6.1 S2 内部接口（同一份签名供所有组件消费）

为承载结构轴 origin 与方法导航，允许在 `flowpage.ts` 增加只供应用包内部的导航上下文；它不是 `CgGraph` wire 字段，也不改变冻结 `FlowPageModel`：

```ts
export interface FlowOpenRequest {
  subjectId: string
  originScopeId: string | null
  originScopeLabel: string
  originOpenableSubjectIds: string[]
}

export interface FlowChartProps {
  model: FlowPageModel
  baseline: CgGraph
  openableSubjectIds: ReadonlySet<string>
  width: number
  selectedStepId: string
  onSelectStep: (stepId: string) => void
  onOpenSubject: (subjectId: string) => void
}

export function FlowChart(props: FlowChartProps): JSX.Element

export type FlowShape = 'rect' | 'diamond' | 'loop' | 'terminal' | 'unknown'

export interface FlowNodeBox {
  id: string
  col: number
  x: number
  y: number
  w: number
  h: number
  depth: number
  shape: FlowShape
  guardReturn: boolean
}

export interface FlowChildEdge {
  from: string
  to: string
  label: '' | '是' | '否' | '循环体'
}

export interface FlowWrapEdge {
  from: string
  to: string
  down: boolean
}

export interface FlowLayout {
  nodes: FlowNodeBox[]
  sequence: string[]
  childEdges: FlowChildEdge[]
  wraps: FlowWrapEdge[]
  cols: number
  top: number
  band: number
  bot: number
  height: number
  width: number
}

export function layoutFlowSteps(steps: readonly CgFlowStep[], width: number): FlowLayout

export interface FlowPageViewProps {
  baseline: CgGraph
  initial: FlowOpenRequest
  onBackToStructure: () => void
}

export function FlowPageView(props: FlowPageViewProps): JSX.Element

export interface RightPanelProps {
  model: ScopePageModel
  selectedNodeId: string
  onOpenSubject?: (subjectId: string) => void
  onHighlightEntry?: (entryNodeId: string) => void
}

export function RightPanel(props: RightPanelProps): JSX.Element

export interface TwoAxisPageProps {
  baseline: CgGraph
  best?: CgBest
  decls?: CgDomainDecls
  target?: CgTarget
  report?: CgCheckReport
  onOpenSubject?: (request: FlowOpenRequest) => void
}

export function TwoAxisPage(props: TwoAxisPageProps): JSX.Element
```

`CodegraphPage` 的内部 handler 精确消费 `FlowOpenRequest`，把它传给 `FlowPageView`；`FlowChart` 只消费 subject id callback，不直接知道结构轴。`originOpenableSubjectIds` 是从 `ScopePageModel.inboundSeams.filter(!folded).map(nodeId)` 得到的原始方法 id 列表；后续页的集合再并入 `Object.keys(baseline.flows ?? {})` 中节点存在且 `kind !== 'entry'` 的 id、当前非 entry implementations 和有 flows 的非 entry callers。遗留的 `flows[entryId]` 只可作通道注释，绝不能进入集合。集合只用于紫框/可打开投影，不写回 baseline。

### 6.2 `flowpage.ts` 纯派生实现

在 `graph/webui/src/app/codegraph/flowpage.ts` 文件头改写职责和边界注释：这是 `CgGraph` → `FlowPageModel` 的唯一纯函数入口；不访问 DOM、URL、localStorage、网络、不调用 chain/tree、不输出 console。导出函数注释必须写明参数、返回值，以及 entry 是通道数据而非默认主语的注意事项。

按下列完整顺序实现，私有 helper 可以换名但不能改变接口：

1. 用 `baseline.nodes[input.entryNodeId]` 构造 `FlowNodeRef`，字段逐项来自节点和其 container/domain；找不到节点时构造可显示的 id 兜底 subject、`openable=false`、`degraded=true`、`missing` 非空，绝不从邻接边猜主语。
2. 初始化三邻域为空数组。用只读、存在且非 deleted 的边建立 forward/reverse adjacency；直接反向 caller 只取一跳。`implements` 只认 `[implementation, interface]`，目标/实现节点均须活跃。
3. 用反向 BFS 求 channels；只收 `kind === 'entry'`，复制 `channel`，排序采用 name 再 id。channels 的 `openable` 恒 false。
4. 读取 `baseline.flows?.[input.entryNodeId]`；键缺失或 steps 长度为 0 时返回 degraded、空 steps、非空 missing；命中时返回 `steps` 的新数组但不改变其中字段、顺序或子步骤引用。
5. callers 的 `openable` 为“非 entry 且 `baseline.flows?.[id]` 存在”；implementations 的 `openable` 恒 true（即使实现尚无流程，点击也应打开 degraded 方法页）；entry subject/channel 的 `openable` 恒 false；caller/channel/implementation 各自用同一 `FlowNodeRef` 字段映射，不在 JSX 二次投影。
6. 对所有数组做确定性排序，保证输入 edges/implements 的排列改变不改变结果；空数组用 `[]`，不返回 undefined。该函数不输出日志，因为纯函数的日志会污染调用方且违反 scopepage 同边界。

### 6.3 `FlowChart.tsx` 和 `flowlayout.ts` 形态实现

在 `flowlayout.ts` 保持纯函数和零 console，入口签名为 `layoutFlowSteps(steps: readonly CgFlowStep[], width: number): FlowLayout`。主干 roots 排除被 branch/loop 子臂引用的 step；branch/loop 的子臂按 wire id 展开；一个全为 return 的 branch 臂标为 guard，guard return 只进入 `childEdges` 和侧甩坐标，不进入 `sequence`。重复引用只补边，不重复放盒。未知 kind 进入 unknown 盒并保留可见诊断。

在 `FlowChart.tsx`：

1. 以 `layoutFlowSteps(model.steps, width)` 作为唯一布局输入；从 `baseline` 解析 call 目标名称/领域，顺序边和折列边都用 SVG `path`，继续保留箭头 marker。跨列用上下带蛇形 path，奇偶列翻转由坐标决定，不写两套静态文字连接。
2. branch 采用真实菱形几何（CSS `clip-path`/等价四边形边框实现），`data-shape="diamond"` 只是可测试标记而不是圆角矩形的替代名；call 是矩形左色条，loop/return/unknown 映射契约词表。
3. `iface:true` 的 call 使用双线框；只对 `step.kind === 'call' && step.to !== undefined && openableSubjectIds.has(step.to)` 加紫框和 `▸`。entry target 只要不在集合就不紫；禁止使用 `target.kind === 'entry'` 作为紫框条件。
4. 点击可打开 call 记录 `[codegraph] flow subject drill`，带 `from`、`to`、当前 subject id 和 `kind`，调用 `onOpenSubject(step.to)`；其他节点记录 `[codegraph] flow step select` 并调用 onSelectStep。成功路径不静默，组件不使用 `print`。
5. `model.degraded` 不渲染 `FlowChart` 的 `[data-step]`，由页面壳显示 missing；组件本身对空 steps 保持安全空画布，绝不从 edges/chain 补步骤。

### 6.4 `FlowPageView.tsx` 页内导航和右栏三段

在 `FlowPageView.tsx` 文件头说明它是行为轴页面壳：持有页内 stack/selected/highlight 状态，调用 `deriveFlowPage`，装配 FlowChart 和永久关系右栏；不发网络请求、不用 iframe/浏览器后退、不把关系列表变成第二调用树。

1. 初始 stack 为 `{subjectId: initial.subjectId, label: subject.name}`，另存 origin scope 和 origin openable set；页面每次 stack 改变时以栈顶 id 调 `deriveFlowPage({ baseline, entryNodeId: id })`。方法换图前清空 selectedStepId/highlighted channel，避免状态泄漏。
2. `pushSubject` 总是 append，即使 id 已在 stack；记录 source/target；实现项、openable caller、紫框 call 都走同一入口。channel 点击只更新 highlighted id 和第一步匹配高亮，不 push。
3. 顶部只渲染一颗 `[data-flow-back]`。stack 长度大于 1 时 pop；长度为 1 时调用 `onBackToStructure`，让外层恢复同一 origin scope。breadcrumb 由 stack 映射，点击祖先将 stack slice 到该 index+1。
4. 右栏固定渲染三段 `到达通道`、`实现`、`被谁调用`，分别消费 model.channels、model.implementations、model.callers。空数组显式空态；entry caller/channel 只可高亮；实现和有流程 caller 是可开项；无流程 caller 保留名称并显示“无流程图”。保留既有“调用链（给 agent）”tab 的语义文字，不在行为轴绘制 tree。
5. 入口、外部导航、换图、返回、面包屑和通道高亮均使用 `console.info`，带 current/target/source/depth/scope；不存在的 subject 或 degraded 成功状态用 `console.warn` 带 id/missing。不得用 console 报纯派生函数内部事件。

### 6.5 结构轴和根页面装配

在 `RightPanel.tsx`：

1. `model.inboundSeams` 的未折叠项渲染为方法入口按钮，点击调用 `onOpenSubject(seam.nodeId)`；日志写入 seam id、scope id、folded 和 wired 状态。折叠块先执行既有展开状态，再显示其中方法。
2. `selected.entries` 仍按 `channelBucketOf` 分组，只读展示程序入口；点击调用 `onHighlightEntry`（若有），不调用 `onOpenSubject`。文案区分“对外入缝”和“到达通道”，entry 不被命名成方法主语。
3. 保留基本信息/对外面/状态机三个结构 tab、现有 localStorage 宽度 try/catch 和 warning；新增导出 prop 注释说明方法入缝可开、程序入口只读。

在 `TwoAxisPage.tsx`：

1. `handleOpenSubject(subjectId)` 只从当前 `ScopePageModel` 采集未折叠 `inboundSeams` id，构造第 6.1 的 `FlowOpenRequest`，其中 origin scope id/label 来自当前 scope model；调用 `onOpenSubject(request)`。
2. 保留组织切换、scope、结构 breadcrumb 和 selected state；结构组件不直接访问 FlowPageModel，不把 entry 列表传成行为轴主语。
3. 入口日志记录 subject id、scope、origin seam 数；无 callback 时记录 wired=false，但按钮仍有明确只读/高亮反馈。

在 `CodegraphPage.tsx`：

1. 把 `openEntry: string` 改为 `openFlow: FlowOpenRequest | null`；结构轴回调进入行为轴，页头显示“正在看方法主语”，不显示程序入口流程图。传给 `FlowPageView` 的是 `baseline`、`initial` 和 `onBackToStructure`。
2. 删除外层第二套行为轴 back button；唯一返回按钮由 `FlowPageView` 提供。`CodegraphPage` 只负责恢复结构轴，保留 `viewName`/baseline 及 origin scope，因为 TwoAxisPage 由相同 view key 重挂会清空行为状态但不丢数据上下文。
3. 保留工具条、refresh、错误占位、diff fallback，不新增请求。视图切换清除 `openFlow` 并记录 from/to；行为进入/返回日志带 subject/scope。

### 6.6 T4 绿测和验收范围

在依赖可用的 `graph/webui` 工作目录先跑第 5.1 的 Vitest 文件命令，再跑 `npm run typecheck`；两者均须亲跑到结果并记录原始输出。若命令仍返回 `tsc: not found` 或 `vitest: not found`，原文写入台账并标“未验证”，不得声称 T4 通过。T4 不跑 Go 和全仓测试。

## 7. 序列化边界、类型核对和接缝双向审计

### 7.1 手写投影与真实回归链

新增或修改字段必须沿以下每一处边界核对，文件集不得扩展：

| 边界 | 手写投影 | 必须由哪条断言覆盖 |
|---|---|---|
| baseline JSON → Go | `graph/codegraph/load.go#LoadGraph` 读入 `Graph.Flows`、`Node.Channel`、`FlowStep` 可选字段；本轮只读核对 | `graph/cli/cli_test.go#TestGraphFlowJSONContract` 的真实 fixture 解码与 `steps/callers/implementations/channels` 字段断言 |
| Go `Graph` → flow result | `graph/codegraph/flow.go#LookupFlow` 的 `FlowRef`、`SymMatch`、空切片和 steps 透传 | `flow_test.go` 的 hit/degraded/deleted/neighbor 五组声明缝测试 |
| Go result → CLI stdout | `graph/cli/cli.go#graphPrintJSON` 的 Encoder 投影/换行 | `TestGraphFlowJSONContract`、`TestGraphTreeDownFixture` 原始 stdout 末字节和 JSON 顶层键断言 |
| Go Graph/View → tree result | `graph/codegraph/tree.go#treeMakeNode` 与 nested `Children` 投影 | `tree_test.go` diamond、排序、depth、truncated、deleted 测试和 CLI tree JSON 测试 |
| Response JSON → CgGraph | `graph/webui/src/api/client` 既有 JSON 解码（只读，不增加请求）→ `types.ts` 可选字段 | `CodegraphPage.wire.test.tsx` 必须用 mock `Response`，不能直接传对象 |
| CgGraph → FlowPageModel | `flowpage.ts#deriveFlowPage` 的 node/container/domain、flows、implements、edges 投影 | `flowpage.test.ts` 的 subject/steps/caller/implementation/channel/degraded 测试 |
| FlowPageModel → DOM | `FlowPageView.tsx`、`FlowChart.tsx`、右栏三段 JSX、data-* 和 SVG path 投影 | `FlowPageView.test.tsx`、`FlowChart.test.tsx`、wire test 的 DOM 断言 |

`CodegraphPage.wire.test.tsx` 必须至少用一份 JSON 同时包含“字段缺席”和“值为零”：`flows` 缺席表示降级；节点 `line: 0` 是存在且为零；省略 line 的可选字段保持缺席。测试用 `JSON.stringify`/`Response`/既有 client 真实解析链，不用两端各自的 object fixture 代替。所有数组边界断言 `[]` 而不是 `null`；`missing` 是 optional 文本，不得与空字符串或步骤空数组混为一态。

### 7.2 接口一致性表

S1 Produces 与 S2 Consumes 必须逐字对齐：

| S1 Produces | S2 Consumes | 核对规则 |
|---|---|---|
| `FlowLookupResult.Steps []FlowStep` → JSON `steps` | `CgGraph.flows?: Record<string, CgFlow>` → `FlowPageModel.steps: CgFlowStep[]` | `id/order/kind/line/to/cond/then/else/body/iface` 逐字同名；kind 只四值 |
| `FlowRef{ID,Name,File,Line,Kind,Channel}` | `FlowNodeRef{id,name,file,line,kind,channel,openable}` | S2 只新增本地 `openable`，不回写 Go/baseline |
| `FlowLookupResult.Callers` | `FlowPageModel.callers` | 直接一跳、entry false、无 flows caller 保留但不可开 |
| `FlowLookupResult.Implementations` | `FlowPageModel.implementations` | Go/S2 均认 `[实现,接口]` join，不读 flow 私有伪造字段 |
| `FlowLookupResult.Channels` | `FlowPageModel.channels` | 反向可达 entry，channel 四值或缺席，openable 恒 false |
| `TreeResult.Root/Truncated` → CLI JSON | viewer 不消费 tree | S2 不画第二棵调用树，`chain/who-calls` 仍为原命令 |

提交前必须逐字符比对这些签名与第 1 节代码块；类型别名替换、`entryNodeId` 改名、把 `FlowNodeRef` 嵌回 wire 都视为不兼容，不在实现轮自行裁决。

### 7.3 五条声明接缝的双向覆盖

冻结 spec 的接缝清单只有以下五条：

| 接缝 | 至少一支缝级测试入口 | 测试断言 |
|---|---|---|
| `deriveFlowPage` | `flowpage.test.ts#derivesMethodSubjectAndRelations` | 方法主语、四态 degraded、步骤透传、三邻域和 openable |
| flow page nav stack | `FlowPageView.test.tsx#pushesAndPopsMethodStack` | A→B→A、唯一上一层、breadcrumb 截断、scope 返回 |
| flow CLI | `cli_test.go#TestGraphFlowJSONContract` | 命令决议、结果 JSON、错误/降级/换行 |
| tree CLI | `cli_test.go#TestGraphTreeDownFixture` | 真树、depth=0、corridor 错误与 JSON |
| `layoutFlowSteps` | `flowlayout.test.ts#layoutFlowStepsKeepsGuardReturnsOffLinear` | guard 侧甩、菱形/四类形态、蛇形列 |

反向核对：`deriveFlowPage` 的 steps/callers/implementations/channels/degraded 每一组均由 `flowpage.test.ts` 锁；nav stack 的通道高亮、实现/caller 下钻、返回和 breadcrumb 均由 `FlowPageView.test.tsx` 锁；flow CLI 的未命中/多义/JSON/summary 由 `cli_test.go` 锁；tree CLI 的向下/向上/非法 corridor/截断由 `cli_test.go` 锁；layout 的 guard/diamond/wrap/unknown 由 `flowlayout.test.ts` 和 `FlowChart.test.tsx` 锁。未锁的任何一条不得以组件 snapshot 或计数判定“已覆盖”。

以下是允许的附加内部消费者锁，不能替代上表声明缝：

- `RightPanel.test.tsx` 直接 render `RightPanel`，因为结构轴的入缝按钮和程序入口只读行为在行为轴页装配前发生，无法从 `deriveFlowPage` 或 nav stack 入口构造；它只验证 callback/DOM，不替代 `TwoAxisPage`/wire 的真实路径。
- `TwoAxisPage.test.tsx` 直接 render `TwoAxisPage`，因为它必须真实调用 `deriveScopePage` 产生当前 scope 的 `inboundSeams`，而 `deriveFlowPage` 只接收 `CgGraph + subjectId`，无法构造组织/scope 折叠断言；它只验证入缝 context 和 entry 反面。
- `FlowChart.test.tsx` 的入口是 render `FlowChart`，但调用链必穿 `layoutFlowSteps`；它作为布局接缝的 DOM 消费锁，不替代直接 `layoutFlowSteps` 测试。

### 7.4 上下文预算和不扩边界

每个实现任务的文件集均已在第 0 节列出：T1/T2 只读写 6 个 Go/CLI 源文件及对应测试；T3/T4 只读写 `types.ts` 与 14 个指定 viewer 文件及对应测试；`scopepage.ts` 只能查阅，hand-off 扫描配方无本仓路径。任何需要新增跨包 adapter、请求、schema、原型文件或手写序列化层的发现，都不能顺手扩展，必须退回 contract/协调者。

## 8. 缺陷族对抗审查和边界型真机清单

### 8.1 缺陷族结论（实现者验收栏必须逐项保留）

| 缺陷族 | S1 Go/CLI 对抗问题与判据 | S2 viewer 对抗问题与判据 |
|---|---|---|
| 生命周期 / 状态机中断 | 查询只读内存，不启动进程、不写临时目录；验证 nil/deleted/错误输入不留下成功结果。S3 扫描重启不归 S1，真机核对。 | 栈、selection、highlight 是本地 React 状态；换图清空旧 selection，卸载不遗留订阅。刷新/宿主后退行为列真机。 |
| 静默失败 / 误导报错 | 空/删除/未命中/非法 corridor 非零；缺 flows 才 degraded 且 `steps=[]/missing`；错误不包装成功 JSON，多义列候选 id。 | degraded 显示缺失原因不画伪流程；空邻域显示空态；entry/channel 点击有高亮而不假装换图。 |
| 跨平台假设 | 只复用既有 repoRoot/SymMatch/JSON；不新增 shell/平台 API。Windows 路径、权限和真实扫描输出未验证。 | jsdom 只锁 DOM/path 数据；SVG、中文折行、DPR、pointer/键盘、宿主 iframe/file 后退未验证。 |
| 假红 / 假绿测试 | diamond 重复、self-loop、through-only、from 缺 through、删除过滤、degraded 反面必须各能变红；不锁 helper/文件数。 | callback、data-*、path、状态反面各能变红；不锁 snapshot/pixel，wire 测试必须穿过 Response。 |
| 门禁绕过 | 不新增写/执行入口，`--repo/--view` 继续先加载/校验；不改变 chain/who-calls。 | 不新增写入、权限或外部执行；既有右栏 localStorage try/catch 保留。 |
| 序列化边界 | baseline→Graph→result→stdout 一条 CLI 回归；空数组不是 null，字段缺席/零值分别断言。 | Response→CgGraph→derive→DOM 一条 wire 回归；`line:0`、缺 line、缺 flows、implements/channel 分别断言。 |
| 枚举新值过既有白名单 | `FlowStep.kind` 四值、entry channel 和 tree flags 沿既有解析；未知步骤只能显式降级，不新增 kind。 | 四种步骤形态、四种 channel 穷尽；未知 kind/channel 可见中性降级，不扩大 node kind。 |
| 承重安全属性 | 本轮无 token/权限/隔离安全属性；删除节点/边过滤与错误不伪成功作为数据完整性反面锁。 | 本轮无权限/隔离安全属性；通道不入栈、caller 不扩深度、旧 selection 不泄漏作为状态边界反面锁。 |

### 8.2 acceptance 真机清单（不由本节点执行）

以下均是后续 acceptance 的显式真机判据，不是本计划已完成结论；实现者不要用 fixture/`jsdom`/当前缺依赖的 127 结果替代：

1. 在真实扫描项目确认 `flows` 键集合是“默认对外未折叠入缝 ∪ 紫框 call 目标 ∪ 右栏接口实现方法”；entry handler 不因 `kind=entry` 自动成为承重主语。该项属于 S3 交棒。
2. 真实扫描输出确认 `if err != nil { return }` 的 return 只在 branch.then/else 子列，未产生未引用 sequential root；坏引用、缺 flows 和缺步骤能沿约定被看见。
3. 原型 HTML 逐屏对拍：在可取得的 `prototypes/codegraph-two-axis/pages/behav-flow.html` 或协调者保存的同一原型副本上，逐屏记录方法标题、流程主干、右栏、导航栏、degraded 空态的截图/差异；当前 fork 副本缺席不阻塞本计划，不能擅自另造形态。
4. 真实浏览器点击结构轴“对外面”未折叠入缝，确认打开方法主语；已折叠块展开后入缝可开；基本信息中的 CLI/HTTP/WS/Web 程序入口点击不打开流程图。
5. 真实浏览器检查流程形态：分支是菱形而非圆角矩形；`if err` 卫语句甩在菱形侧边并不进入快乐路径；超过宽度后列间由蛇形 SVG 连线贯通，不由“接上列”文字代替。
6. 真实浏览器检查紫框/双线框：紫框只出现在 `kind=call` 且 `to` 命中可打开方法集合的步骤；entry 到达通道不紫、不换图、不压栈；接口调用是双线框，右栏列出全部实现，点击实现打开实现方法图。
7. 真实浏览器检查页内导航：A→B→A 允许重复压栈；只有一颗“← 上一层”；返回按照真实来处；祖先面包屑跳转后截断后续；栈底回原结构轴且 scope/组织选择保留，不依赖浏览器后退。
8. 真实浏览器检查右栏永久三段：到达通道、实现、被谁调用均在场；caller 只一跳；无流程 caller 显示“无流程图”；通道只高亮当前图第一步；结构轴“调用链（给 agent）” tab 保留，不画第二棵 tree。
9. 在真实 canonical `codegraph` 与 handoff `graph` 挂载分别执行 flow/tree/summary，确认命令名、参数、JSON 换行、错误退出和 summary 菜单一致；同时对照 baseline→CLI→viewer 检查字段缺席与零值、删除节点/边过滤。

## 9. 交付顺序、台账和计划自检

### 9.1 后续实现者交付顺序

1. 先把每个任务的红测命令、退出码和原始失败输出追加到 `docs/ledgers/2026-08-28-c17-plan-ledger.md`；没有亲跑结果不写“通过”。
2. 按 T1→T2 与 T3→T4 顺序最小实现，Go 只跑第 4.5 命令，WebUI 只跑第 6.6 命令；每个关键入口、外部调用前后、错误分支和成功路径按第 4.2/4.3/4.4、6.2/6.4/6.5 的 logger 约定记录。
3. 实现完成后由协调者执行第 8.2 真机清单；S3 不改本仓提交。任何跨卡签名冲突先停在 contract，不以类型断言或兼容别名掩盖。

### 9.2 本计划节点自检

- [x] 只引用冻结 contract、第四稿 spec、已确认 README 形态；未把缺失的 prototype fork 当输入，未另起形态。
- [x] 精确列出 S1/S2 文件集、每项 Consumes/Produces 和冻结 Go/TS 代码块；S3 明确不进本计划实现步骤。
- [x] 每个实现任务含基线判据、最小测试范围、红→绿顺序、关键节点日志、文件头/导出/非显然逻辑注释要求。
- [x] seam 清单五条双向覆盖完成；附加 RightPanel/TwoAxis/FlowChart 内部锁逐条声明了不能从声明缝构造的原因，未以内部锁替代主缝。
- [x] spec 故事 1～9 逐条归属 T1/T2/T3/T4 或第 8 节真机清单；S3 交棒项未伪装成本仓实现。
- [x] 手写序列化/投影链逐处列出，并要求真实 Response wire 测试区分字段缺席、零值、空数组和 degraded。
- [x] defect-families 八族、上下文预算、逻辑型/边界型类型标注、双向接缝和真机形态清单均已写入。
- [x] 未使用计数型文件/覆盖率判据作为行为替代；CLI 命令检查按名称和真实行为，不按命令总数达标。
- [x] 已自我声明测试代码块例外：T1 复用 `flow_test.go`、`tree_test.go`、`cli_test.go` 的现有 Go harness，T3 复用列出的 WebUI fixture/render harness；各测试入口、输入形态和每条断言均在第 3/5 节逐条列全，不以骨架测试或内部 helper 代替。
- [x] 本轮不实现代码，不派发，不调用 handoff CLI；仅提交本计划和过程台账。
