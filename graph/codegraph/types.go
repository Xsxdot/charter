// Package codegraph 实现代码图数据契约的模型与算法：加载、校验、合并、查询、保鲜。
//
// 职责：
//   - 解析目标仓库 codegraph/baseline.json 与 codegraph/diffs/<view>.json
//   - 基准 + 差异合并出视图；BFS 邻域查询（chain / who-calls / 并集 / 深度）
//   - file:line 签名保鲜检测
//
// 边界：
//   - 不依赖 handoff 任何内部包（agentd/store/client）——数据契约独立是 spec
//     2026-08-19-codegraph-design §2 的硬约束，本包必须能原样搬进任何工具
//   - 不产出数据：扫描由 AI executor 完成（见 docs/codegraph-scan-recipe.md）
//   - 不做网络：一切输入都是本地文件
package codegraph

// Meta 是图的来源信息。
type Meta struct {
	Project   string `json:"project"`
	Branch    string `json:"branch"`
	Commit    string `json:"commit"`
	ScannedAt string `json:"scannedAt"`
	Generator string `json:"generator"`
}

// Container 是分组盒子（struct 一级，见 spec §3.1）。
type Container struct {
	Label string `json:"label"`
	Kind  string `json:"kind"`
	Entry bool   `json:"entry,omitempty"`
	// Domain 是所属领域 id，必须是**叶子**领域。空串只在整图没有 domains 段时
	// 合法（旧扫描数据，消费方降级为单领域视图）。
	Domain string `json:"domain,omitempty"`
}

// Container kind 是扫描侧与查看器共用的受控词表。
const (
	ContainerKindTypeMethod  = "类型方法"
	ContainerKindFunctionSet = "函数组"
	ContainerKindEntity      = "实体"
	ContainerKindTSModel     = "TypeScript 模型"
	ContainerKindReact       = "React 组件/函数"
	ContainerKindEntry       = "入口"
	ContainerKindTSFunction  = "TypeScript 函数组"
	ContainerKindTSEntity    = "TypeScript 实体"
)

// ContainerKinds 返回受控词表的只读副本，调用方可安全排序或修改返回值。
func ContainerKinds() []string {
	return []string{
		ContainerKindTypeMethod, ContainerKindFunctionSet, ContainerKindEntity,
		ContainerKindTSModel, ContainerKindReact, ContainerKindEntry,
		ContainerKindTSFunction, ContainerKindTSEntity,
	}
}

func validContainerKind(kind string) bool {
	switch kind {
	case ContainerKindTypeMethod, ContainerKindFunctionSet, ContainerKindEntity,
		ContainerKindTSModel, ContainerKindReact, ContainerKindEntry,
		ContainerKindTSFunction, ContainerKindTSEntity:
		return true
	default:
		return false
	}
}

// Domain 是一个领域：领域图的一级组织单位，可嵌套。
//
// 领域由扫描产出、人可在入库后修改（spec §3.1）。Parent 串成树，为空即顶层。
// 容器只能挂叶子领域——挂在中间层的容器既不属于本级全景、也进不了任何子领域，
// 会静默从图里消失，所以 Validate 把它当错误报出来而不是默默丢掉。
type Domain struct {
	Label   string `json:"label"`
	Kind    string `json:"kind"`
	Summary string `json:"summary,omitempty"`
	Desc    string `json:"desc,omitempty"`
	Parent  string `json:"parent,omitempty"`
}

// Package 是包摘要（B231，v0.6.0）。key 是包目录路径（与 Node.File 的目录一致）。
// Summary 只许**转录**源码包 doc 注释（无注释即空串）——扫描配方不得自行概括，
// 否则图里会写着一个代码里不存在的意图。应然职责归 best.json，这里只放事实。
type Package struct {
	Summary string `json:"summary"`
}

// TestRef 关联一个测试函数。File 形如 "pkg/x_test.go:41"。
type TestRef struct {
	Name string `json:"name"`
	File string `json:"file"`
}

// Node 是图节点，Kind 三选一：entry / func / model。
// 不存源码——消费方按 File:Line 实时读取，这同时是保鲜检测的抓手。
type Node struct {
	Kind         string     `json:"kind"`
	Container    string     `json:"container"`
	Order        int        `json:"order,omitempty"`
	Name         string     `json:"name"`
	File         string     `json:"file"`
	Line         int        `json:"line"`
	Signature    string     `json:"signature,omitempty"`
	SignatureOld string     `json:"signatureOld,omitempty"` // 仅出现在 diff 的 nodesModified 里
	Params       [][]string `json:"params,omitempty"`       // [名, 类型, 说明]
	Returns      string     `json:"returns,omitempty"`
	Summary      string     `json:"summary,omitempty"`
	Tests        []TestRef  `json:"tests,omitempty"`
	Fields       [][]string `json:"fields,omitempty"` // model 专用: [名, 类型, 说明]
	Unscanned    bool       `json:"unscanned,omitempty"`
	ProjScanned  bool       `json:"projScanned,omitempty"`
	// ModelKind 只对 kind=="model" 有意义：区分真实体与传输/配置结构。
	// 空 = 未分种（存量数据的默认），**不是**「未知实体」——消费侧统计实体数
	// 时不得把空值计入，否则 707 个 model 又会原样淹没实体表（契约 §2-1）。
	ModelKind string `json:"modelKind,omitempty"`
	// Channel 是 entry 节点的对外通道（cli/http/ws/web），additive-only 新键（C12）；
	// 只对 kind=="entry" 有意义。
	Channel string `json:"channel,omitempty"`
}

// model 的三种子分类。判定序与判据表在扫描配方里，此处只钉取值。
const (
	ModelKindEntity = "entity" // 有创建者或写入者的真实体
	ModelKindDTO    = "dto"    // 传输结构、wire 类型；兜底档
	ModelKindConfig = "config" // 构造后只读、从配置或 env 装载
)

// 流程步骤 kind 受控词表（C12，docs/specs/2026-08-25-codegraph-scan-schema-draft.md §2）。
const (
	FlowStepCall   = "call"
	FlowStepBranch = "branch"
	FlowStepLoop   = "loop"
	FlowStepReturn = "return"
)

// 入口 channel 受控词表（C12 schema 草案 §8.5）：entry 节点的对外通道，
// 不靠 id 前缀或名字形状猜。
const (
	ChannelCLI  = "cli"
	ChannelHTTP = "http"
	ChannelWS   = "ws"
	ChannelWeb  = "web"
)

// FlowStep 是 flows 段里的一步：承重函数内可排序的一步调用/控制流。
// 字段必填性（call 必有 to、branch/loop 必有 cond 与子步骤列）由扫描侧保证；
// 引用完整性的 Validate 执法随 flows 真数据同批开启（C12 Out of Scope 1）。
type FlowStep struct {
	ID    string   `json:"id"`
	Order int      `json:"order"`
	Kind  string   `json:"kind"`
	To    string   `json:"to,omitempty"`
	Cond  string   `json:"cond,omitempty"`
	Line  int      `json:"line"`
	Then  []string `json:"then,omitempty"`
	Else  []string `json:"else,omitempty"`
	Body  []string `json:"body,omitempty"`
	// Iface 为真表示 To 是接口方法、本调用点是动态分派；实现清单从既有 implements
	// 段 join 出来，不在 flows 里复制（schema 草案 §2b）。
	Iface bool `json:"iface,omitempty"`
}

// Flow 是一条承重函数的步骤序列。flows 只覆盖承重函数（跨域入缝符号、入口
// handler、编排单元），不要求全节点覆盖。
type Flow struct {
	Steps []FlowStep `json:"steps"`
}

// Edge 是一条调用关系 [caller, callee]。
type Edge [2]string

// Projection 是一条数据实体投影关系 [投影点节点 id, model 节点 id, kind]。
// kind=typed 表示类型可见的投影；handroll 表示手搭 map/字面量拼装（类型系统不可见）；
// twin 表示跨语言孪生的 model↔model 关系。独立顶层列表保持与 implements 一致，旧基线无需迁移。
type Projection [3]string

// Graph 是 codegraph/baseline.json 的顶层结构。
// 顶层 "diffs" 字段是早期原型的兼容残留，一期忽略：视图一律来自 diffs/目录。
type Graph struct {
	Meta Meta `json:"meta"`
	// Domains 是领域段，可为空——空即「该图未划分领域」，消费方降级为单领域视图。
	// **不得按包名伪造领域**：伪造出来的层级会被人和 agent 当成真实架构读。
	Domains    map[string]Domain    `json:"domains,omitempty"`
	Containers map[string]Container `json:"containers"`
	Nodes      map[string]Node      `json:"nodes"`
	Edges      []Edge               `json:"edges"`
	// Implements 是接口满足边 [实现, 接口]。与 Edges 分列是 wire 兼容决策
	//（Edge 是二元组塞不进 kind 字段，spec §3）；语义上它们是 kind=implements 的边。
	Implements  []Edge       `json:"implements,omitempty"`
	Projections []Projection `json:"projections,omitempty"`
	// Lifecycle 是生命周期段（谁创建/谁写状态），additive-only 新键（v0.3.0，契约 §2）：
	// 旧消费方可安全忽略；产出者是扫描配方，Validate 管引用完整性。
	Lifecycle []LifecycleRef `json:"lifecycle,omitempty"`
	// Packages 是包摘要段（目录 → 包 doc 摘要），additive-only 新键（v0.6.0，B231）：
	// 旧消费方安全忽略。悬空键（目录不属于图中任何节点）由 Validate 判硬红——
	// 那是自相矛盾；「有目录没条目」不执法，补齐靠扫描配方自检（防拐杖，见 roadmap 9①先例）。
	Packages map[string]Package `json:"packages,omitempty"`
	// Flows 是流程段（承重函数 id → 步骤序列），additive-only 新键（C12）：
	// 旧消费方安全忽略；缺席即查看器降级形态，不当作传输失败。
	Flows map[string]Flow `json:"flows,omitempty"`
}

// Diff 是 codegraph/diffs/<view>.json：某分支/plan 相对基准的差异声明。
type Diff struct {
	View    string `json:"view"`
	Base    string `json:"base,omitempty"`
	Summary string `json:"summary,omitempty"`
	// ContainersAdded 是本分支新建的容器（新包/新类型）。没有它，分支上新建的
	// 入口容器进不了视图——ValidateDiff 会拒收引用未知容器的新节点，contract 节点
	// 的「骨架符号入图」纪律与刀 3 的 dead-entry 清零在分支内都无法满足
	// （契约 §7-R1）。id 与基线冲突时由 ValidateDiff 报问题，不静默覆盖。
	ContainersAdded    map[string]Container `json:"containersAdded,omitempty"`
	NodesAdded         map[string]Node      `json:"nodesAdded,omitempty"`
	NodesModified      map[string]Node      `json:"nodesModified,omitempty"`
	NodesDeleted       []string             `json:"nodesDeleted,omitempty"`
	EdgesAdded         []Edge               `json:"edgesAdded,omitempty"`
	EdgesDeleted       []Edge               `json:"edgesDeleted,omitempty"`
	ImplementsAdded    []Edge               `json:"implementsAdded,omitempty"`
	ImplementsDeleted  []Edge               `json:"implementsDeleted,omitempty"`
	ProjectionsAdded   []Projection         `json:"projectionsAdded,omitempty"`
	ProjectionsDeleted []Projection         `json:"projectionsDeleted,omitempty"`
	LifecycleAdded     []LifecycleRef       `json:"lifecycleAdded,omitempty"`
	LifecycleDeleted   []LifecycleRef       `json:"lifecycleDeleted,omitempty"`
}
