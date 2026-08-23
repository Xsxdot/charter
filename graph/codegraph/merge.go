// 本文件实现「基准 + 差异 → 视图」的合并（spec §3.2 的渲染时合并）。
//
// 职责：Merge 产出带 Status 标记的 View；删除的对象保留并标 deleted，
//
//	供消费方画红虚线——直接剔除会让"删了什么"不可见
//
// 边界：不做查询（query.go）；diff 的合法性由 ValidateDiff 把关，
//
//	Merge 对非法引用宽容跳过（渲染路径不因脏数据崩）
package codegraph

// ViewNode 是视图里的节点：Node + 差异状态。
type ViewNode struct {
	Node
	Status string `json:"status,omitempty"` // "" | added | modified | deleted
}

// ViewEdge 是视图里的边。
type ViewEdge struct {
	From   string `json:"from"`
	To     string `json:"to"`
	Status string `json:"status,omitempty"`
}

// ViewProjection 是视图里的投影关系，带有 diff 状态供消费方展示。
type ViewProjection struct {
	From   string `json:"from"`
	To     string `json:"to"`
	Kind   string `json:"kind"` // typed | handroll | twin
	Status string `json:"status,omitempty"`
}

// ViewLifecycle 是一条带 diff 状态的生命周期关系。
type ViewLifecycle struct {
	Who    string `json:"who"`
	Model  string `json:"model"`
	Kind   string `json:"kind"`
	Field  string `json:"field,omitempty"`
	Status string `json:"status,omitempty"`
}

// View 是合并后的图视图。
type View struct {
	Name string `json:"view"`
	// Domains 原样来自基线：diff 只改节点与边，不改领域划分。
	Domains     map[string]Domain    `json:"domains,omitempty"`
	Containers  map[string]Container `json:"containers"`
	Nodes       map[string]ViewNode  `json:"nodes"`
	Edges       []ViewEdge           `json:"edges"`
	Implements  []ViewEdge           `json:"implements"`
	Projections []ViewProjection     `json:"projections"`
	Lifecycle   []ViewLifecycle      `json:"lifecycle"`
}

// Merge 把基线与一个 diff 合并成视图。d 为 nil 时返回纯基准视图（Name="baseline"）。
func Merge(g *Graph, d *Diff) *View {
	containers := make(map[string]Container, len(g.Containers))
	for id, c := range g.Containers {
		containers[id] = c
	}
	v := &View{Name: "baseline", Domains: g.Domains, Containers: containers,
		Nodes: make(map[string]ViewNode, len(g.Nodes))}
	for id, n := range g.Nodes {
		v.Nodes[id] = ViewNode{Node: n}
	}
	for _, e := range g.Edges {
		v.Edges = append(v.Edges, ViewEdge{From: e[0], To: e[1]})
	}
	for _, e := range g.Implements {
		v.Implements = append(v.Implements, ViewEdge{From: e[0], To: e[1]})
	}
	for _, p := range g.Projections {
		v.Projections = append(v.Projections, ViewProjection{From: p[0], To: p[1], Kind: p[2]})
	}
	for _, ref := range g.Lifecycle {
		v.Lifecycle = append(v.Lifecycle, ViewLifecycle{Who: ref.Who, Model: ref.Model, Kind: ref.Kind, Field: ref.Field})
	}
	if d == nil {
		return v
	}
	v.Name = d.View
	// 新容器必须先投影进视图，分支节点才能引用它并让 dead-entry 看见已建成入口；
	// 容器表已复制，故该增量不会污染可复用的基线（契约 §7-R1）。
	for id, c := range d.ContainersAdded {
		v.Containers[id] = c
	}
	for id, n := range d.NodesAdded {
		v.Nodes[id] = ViewNode{Node: n, Status: "added"}
	}
	for id, n := range d.NodesModified {
		if _, ok := v.Nodes[id]; ok {
			v.Nodes[id] = ViewNode{Node: n, Status: "modified"}
		}
	}
	for _, id := range d.NodesDeleted {
		if vn, ok := v.Nodes[id]; ok {
			vn.Status = "deleted"
			v.Nodes[id] = vn
		}
	}
	del := map[string]bool{}
	for _, e := range d.EdgesDeleted {
		del[e[0]+"\x00"+e[1]] = true
	}
	for i := range v.Edges {
		if del[v.Edges[i].From+"\x00"+v.Edges[i].To] {
			v.Edges[i].Status = "deleted"
		}
	}
	for _, e := range d.EdgesAdded {
		if _, ok := v.Nodes[e[0]]; !ok {
			continue
		}
		if _, ok := v.Nodes[e[1]]; !ok {
			continue
		}
		v.Edges = append(v.Edges, ViewEdge{From: e[0], To: e[1], Status: "added"})
	}
	delImplements := map[string]bool{}
	for _, e := range d.ImplementsDeleted {
		delImplements[e[0]+"\x00"+e[1]] = true
	}
	for i := range v.Implements {
		if delImplements[v.Implements[i].From+"\x00"+v.Implements[i].To] {
			v.Implements[i].Status = "deleted"
		}
	}
	for _, e := range d.ImplementsAdded {
		if _, ok := v.Nodes[e[0]]; !ok {
			continue
		}
		if _, ok := v.Nodes[e[1]]; !ok {
			continue
		}
		v.Implements = append(v.Implements, ViewEdge{From: e[0], To: e[1], Status: "added"})
	}
	delProjections := map[string]bool{}
	for _, p := range d.ProjectionsDeleted {
		delProjections[p[0]+"\x00"+p[1]+"\x00"+p[2]] = true
	}
	for i := range v.Projections {
		p := &v.Projections[i]
		if delProjections[p.From+"\x00"+p.To+"\x00"+p.Kind] {
			p.Status = "deleted"
		}
	}
	for _, p := range d.ProjectionsAdded {
		if _, ok := v.Nodes[p[0]]; !ok {
			continue
		}
		if _, ok := v.Nodes[p[1]]; !ok {
			continue
		}
		v.Projections = append(v.Projections, ViewProjection{From: p[0], To: p[1], Kind: p[2], Status: "added"})
	}
	delLifecycle := map[string]bool{}
	for _, ref := range d.LifecycleDeleted {
		delLifecycle[lifecycleKey(ref)] = true
	}
	for i := range v.Lifecycle {
		ref := LifecycleRef{
			Who: v.Lifecycle[i].Who, Model: v.Lifecycle[i].Model,
			Kind: v.Lifecycle[i].Kind, Field: v.Lifecycle[i].Field,
		}
		if delLifecycle[lifecycleKey(ref)] {
			v.Lifecycle[i].Status = "deleted"
		}
	}
	for _, ref := range d.LifecycleAdded {
		if _, ok := v.Nodes[ref.Who]; !ok {
			continue
		}
		if _, ok := v.Nodes[ref.Model]; !ok {
			continue
		}
		v.Lifecycle = append(v.Lifecycle, ViewLifecycle{
			Who: ref.Who, Model: ref.Model, Kind: ref.Kind, Field: ref.Field, Status: "added",
		})
	}
	return v
}

func lifecycleKey(ref LifecycleRef) string {
	return ref.Who + "\x00" + ref.Model + "\x00" + ref.Kind + "\x00" + ref.Field
}
