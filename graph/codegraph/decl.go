// 本文件是刀 1+2 契约的 Ticket 0 骨架：领域声明与生命周期段的类型落码
// （契约 docs/contracts/2026-08-22-codegraph-schema-v2-domains-contract.md §2/§3）。
//
// 职责：类型定义（wire 契约的 Go 形态）。加载与校验（LoadDomainDecls/ValidateDecls）
// 归 implement 阶段落地，本文件只锁 json 键形。
// 边界：与本包其余部分同约束——仅标准库、程序只读人写文件、不做网络。
package codegraph

// LifecycleRef 一条生命周期关系：Who 对 Model 的创建或状态写入。
// 由扫描配方产出入库（baseline 附加段），与 Projections 同为类型化独立段——
// 不塞进无类型的 Edges（那会污染调用边语义，契约 §7 拍板记录）。
type LifecycleRef struct {
	Who   string `json:"who"`             // 图节点 id（构造函数 / 写入函数）
	Model string `json:"model"`           // model 节点 id
	Kind  string `json:"kind"`            // "creator" / "writer" 二选一
	Field string `json:"field,omitempty"` // writer 专用：被写的状态字段名
}

// DomainDecl 一个领域的人工声明（codegraph/domains/<领域id>.json，人写程序只读）。
// 文件名（去 .json）必须等于 Domain 字段——加载时强校验。
type DomainDecl struct {
	Domain         string       `json:"domain"`         // baseline 领域 id
	Responsibility string       `json:"responsibility"` // 职责一句话，必填
	Invariants     []Invariant  `json:"invariants,omitempty"`
	Lifecycle      *DeclAnchor  `json:"lifecycle,omitempty"`    // 创建→终结
	StateMachine   []Transition `json:"stateMachine,omitempty"` // 合法迁移表
}

// Invariant 一条领域不变式；TestRef 非空时 validate 核验该测试函数真实存在。
type Invariant struct {
	Text    string `json:"text"`
	TestRef string `json:"testRef,omitempty"` // 守护测试函数名（Test 前缀）
}

// DeclAnchor 生命周期两端的 file#Symbol 锚，由 resolve 保鲜。
type DeclAnchor struct {
	From string `json:"from"`
	To   string `json:"to"`
}

// Transition 状态机的一条合法迁移；Anchor 指向执行该迁移的代码位（可空）。
type Transition struct {
	From   string `json:"from"`
	To     string `json:"to"`
	Anchor string `json:"anchor,omitempty"` // file#Symbol
}
