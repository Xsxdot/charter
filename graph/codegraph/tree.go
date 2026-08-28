// 本文件实现调用树：把调用边展开成字面树（路径保留），不是 chain 的邻域切片。
//
// 职责：
//   - 向下：焦点的被调方递归展开，菱形在每条路径上各出现一次
//   - 向上：调用方递归展开；--through / --from 卡住「上面那层 + 调用那层」的走廊
//
// 边界：只读 View 上的调用边，不读 flows、不画 CFG、不改图。
package codegraph

import (
	"fmt"
	"log/slog"
	"sort"
)

// DefaultMaxTreeNodes 防止真树沿高扇出指数膨胀。超过后停止展开并标 truncated。
const DefaultMaxTreeNodes = 2000

// TreeOptions 是一次调用树查询的参数。Depth < 0 表示不限跳数；0 表示只出根。
// Through / From 只允许在 Up 时使用，且 From 必须搭配 Through。
type TreeOptions struct {
	Focus    string
	Up       bool
	Depth    int
	Through  string
	From     string
	Once     bool
	MaxNodes int
}

// TreeNode 是调用树的一个节点。Children 在向下是被调方，在向上是调用方。
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

// TreeResult 是 BuildCallTree 的完整输出。
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

// BuildCallTree 从焦点展开调用树。Focus / Through / From 必须已经是节点 id。
func BuildCallTree(v *View, opts TreeOptions) (*TreeResult, error) {
	slog.Default().Info("call tree started", "focus", opts.Focus, "up", opts.Up, "depth", opts.Depth, "through", opts.Through, "from", opts.From, "once", opts.Once)
	if v == nil {
		slog.Default().Error("call tree rejected nil view")
		return nil, fmt.Errorf("调用树需要非空视图")
	}
	if opts.Focus == "" {
		slog.Default().Error("call tree rejected empty focus")
		return nil, fmt.Errorf("调用树需要焦点")
	}
	if _, ok := v.Nodes[opts.Focus]; !ok || v.Nodes[opts.Focus].Status == "deleted" {
		slog.Default().Error("call tree focus missing", "focus", opts.Focus)
		return nil, fmt.Errorf("焦点 %s 不在视图中", opts.Focus)
	}
	if opts.From != "" && opts.Through == "" {
		slog.Default().Error("call tree from without through", "from", opts.From)
		return nil, fmt.Errorf("向上走廊必须同时指定 through（上面那层）；只给 from 无法卡住范围")
	}
	if !opts.Up && (opts.Through != "" || opts.From != "") {
		slog.Default().Error("call tree corridor on down", "through", opts.Through, "from", opts.From)
		return nil, fmt.Errorf("走廊（--through/--from）只定义在向上查找")
	}
	if opts.MaxNodes <= 0 {
		opts.MaxNodes = DefaultMaxTreeNodes
	}

	adj, radj := treeAdjacency(v)
	var allowed map[string]bool
	if opts.Up && opts.Through != "" {
		var err error
		allowed, err = treeCorridor(v, adj, radj, opts)
		if err != nil {
			slog.Default().Error("call tree corridor rejected", "focus", opts.Focus, "through", opts.Through, "from", opts.From, "error", err)
			return nil, err
		}
	}

	next := adj
	if opts.Up {
		next = radj
	}
	if allowed != nil {
		next = treeFilterAdj(next, allowed)
	}

	seen := map[string]bool{}
	nodeCount := 1
	var trunc *Truncation
	var expand func(id string, dist int, path map[string]bool) TreeNode
	expand = func(id string, dist int, path map[string]bool) TreeNode {
		n := treeMakeNode(v, id, dist)
		if opts.Depth >= 0 && dist >= opts.Depth {
			return n
		}
		neighbors := append([]string{}, next[id]...)
		sort.Slice(neighbors, func(i, j int) bool {
			ni, nj := v.Nodes[neighbors[i]], v.Nodes[neighbors[j]]
			if ni.Name != nj.Name {
				return ni.Name < nj.Name
			}
			return neighbors[i] < neighbors[j]
		})
		childPath := map[string]bool{}
		for k := range path {
			childPath[k] = true
		}
		childPath[id] = true
		for _, c := range neighbors {
			if _, ok := v.Nodes[c]; !ok || v.Nodes[c].Status == "deleted" {
				continue
			}
			if opts.Once && seen[c] {
				continue
			}
			if childPath[c] {
				n.Children = append(n.Children, treeMakeNode(v, c, dist+1))
				continue
			}
			if nodeCount >= opts.MaxNodes {
				trunc = &Truncation{AtDepth: dist, DroppedNodes: 1, Reason: "max-tree-nodes"}
				break
			}
			nodeCount++
			if opts.Once {
				seen[c] = true
			}
			n.Children = append(n.Children, expand(c, dist+1, childPath))
		}
		return n
	}

	root := expand(opts.Focus, 0, map[string]bool{})
	out := &TreeResult{
		View: v.Name, Focus: opts.Focus, Up: opts.Up, Depth: opts.Depth,
		Through: opts.Through, From: opts.From, Once: opts.Once,
		Root: root, Truncated: trunc,
	}
	slog.Default().Info("call tree completed", "focus", opts.Focus, "up", opts.Up, "nodes", nodeCount, "truncated", trunc != nil)
	return out, nil
}

func treeAdjacency(v *View) (adj, radj map[string][]string) {
	adj, radj = map[string][]string{}, map[string][]string{}
	for _, e := range v.Edges {
		from, fromOK := v.Nodes[e.From]
		to, toOK := v.Nodes[e.To]
		if e.Status == "deleted" || !fromOK || !toOK ||
			from.Status == "deleted" || to.Status == "deleted" {
			continue
		}
		adj[e.From] = append(adj[e.From], e.To)
		radj[e.To] = append(radj[e.To], e.From)
	}
	return adj, radj
}

func treeFilterAdj(src map[string][]string, allowed map[string]bool) map[string][]string {
	out := map[string][]string{}
	for from, tos := range src {
		if !allowed[from] {
			continue
		}
		for _, to := range tos {
			if allowed[to] {
				out[from] = append(out[from], to)
			}
		}
	}
	return out
}

func treeMakeNode(v *View, id string, dist int) TreeNode {
	n := v.Nodes[id]
	tn := TreeNode{
		ID: id, Dist: dist, Kind: n.Kind, Name: n.Name,
		File: n.File, Line: n.Line, Container: n.Container,
	}
	if c, ok := v.Containers[n.Container]; ok {
		tn.Domain = c.Domain
	}
	return tn
}

func treeHasEdge(adj map[string][]string, from, to string) bool {
	for _, x := range adj[from] {
		if x == to {
			return true
		}
	}
	return false
}

func treeBFS(start string, next map[string][]string, keep map[string]bool) map[string]int {
	dist := map[string]int{start: 0}
	q := []string{start}
	for len(q) > 0 {
		id := q[0]
		q = q[1:]
		for _, t := range next[id] {
			if keep != nil && !keep[t] {
				continue
			}
			if _, seen := dist[t]; seen {
				continue
			}
			dist[t] = dist[id] + 1
			q = append(q, t)
		}
	}
	return dist
}

func treeCorridor(v *View, adj, radj map[string][]string, opts TreeOptions) (map[string]bool, error) {
	if _, ok := v.Nodes[opts.Through]; !ok || v.Nodes[opts.Through].Status == "deleted" {
		return nil, fmt.Errorf("through %s 不在视图中", opts.Through)
	}
	ancFocus := treeBFS(opts.Focus, radj, nil)
	if opts.Depth >= 0 {
		for id, d := range ancFocus {
			if d > opts.Depth {
				delete(ancFocus, id)
			}
		}
	}
	if _, ok := ancFocus[opts.Through]; !ok {
		return nil, fmt.Errorf("%s 不是焦点 %s 的祖先（不在向上 %d 跳内）", opts.Through, opts.Focus, opts.Depth)
	}
	keepAnc := map[string]bool{}
	for id := range ancFocus {
		keepAnc[id] = true
	}

	startU := opts.Through
	if opts.From != "" {
		if _, ok := v.Nodes[opts.From]; !ok || v.Nodes[opts.From].Status == "deleted" {
			return nil, fmt.Errorf("from %s 不在视图中", opts.From)
		}
		if _, ok := ancFocus[opts.From]; !ok {
			return nil, fmt.Errorf("%s 不是焦点 %s 的祖先", opts.From, opts.Focus)
		}
		if !treeHasEdge(adj, opts.From, opts.Through) {
			return nil, fmt.Errorf("%s 并不调用上面那层 %s", opts.From, opts.Through)
		}
	}

	forwardU := treeBFS(startU, adj, keepAnc)
	allowed := map[string]bool{}
	if opts.From == "" {
		ancU := treeBFS(opts.Through, radj, keepAnc)
		for id := range ancU {
			allowed[id] = true
		}
		for id := range forwardU {
			allowed[id] = true
		}
	} else {
		ancU := treeBFS(opts.Through, radj, keepAnc)
		forwardF := treeBFS(opts.From, adj, keepAnc)
		for id := range forwardF {
			if _, ok := ancU[id]; ok {
				allowed[id] = true
			}
		}
		for id := range forwardU {
			allowed[id] = true
		}
	}
	if !allowed[opts.Focus] {
		return nil, fmt.Errorf("走廊 %s → %s 到不了焦点 %s", opts.From, opts.Through, opts.Focus)
	}
	return allowed, nil
}
