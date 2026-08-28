// 本文件实现 codegraph flow：按符号取出一条承重函数的控制流，不拿 chain 冒充。
//
// 职责：决议后的节点 → 定位（再锚定）+ flows 步骤树 + 直接调用方 / 实现 / 到达通道。
// 边界：不生成 CFG；没有 flows[id] 就 degraded，steps 保持空。
package codegraph

import (
	"fmt"
	"log/slog"
	"sort"
)

// FlowRef 是 flow 查询里的一条邻域摘要（调用方、实现或入口通道）。
type FlowRef struct {
	ID      string `json:"id"`
	Name    string `json:"name"`
	File    string `json:"file,omitempty"`
	Line    int    `json:"line,omitempty"`
	Kind    string `json:"kind,omitempty"`
	Channel string `json:"channel,omitempty"`
}

// FlowLookupResult 是一次 flow 查询的输出。
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

// LookupFlow 取出已决议 id 的流程图与一跳邻域摘要。
// 参数 v 是活跃视图，g 提供 baseline flows，repoRoot 仅用于既有 SymMatch 再锚定；
// 返回值在缺少流程数据时成功降级（steps=[]），但缺少/删除 subject 时返回 error。
func LookupFlow(v *View, g *Graph, repoRoot, query, id string) (*FlowLookupResult, error) {
	slog.Default().Info("flow lookup started", "query", query, "id", id, "view", viewName(v), "hasFlows", g != nil && g.Flows != nil)
	if v == nil {
		slog.Default().Error("flow lookup rejected nil view", "query", query, "id", id)
		return nil, fmt.Errorf("flow 需要非空视图")
	}
	if _, ok := v.Nodes[id]; !ok || v.Nodes[id].Status == "deleted" {
		slog.Default().Error("flow lookup subject missing", "query", query, "id", id, "view", v.Name)
		return nil, fmt.Errorf("符号 %s 不在视图中", id)
	}
	out := &FlowLookupResult{
		View:            v.Name,
		Query:           query,
		Subject:         symMatchFor(v, repoRoot, id),
		Callers:         []FlowRef{},
		Implementations: []FlowRef{},
		Channels:        []FlowRef{},
		Steps:           []FlowStep{},
	}
	if g == nil || g.Flows == nil {
		out.Degraded = true
		out.Missing = "基线没有 flows 段"
	} else if fl, ok := g.Flows[id]; !ok || len(fl.Steps) == 0 {
		out.Degraded = true
		out.Missing = fmt.Sprintf("flows 没有 %s 的步骤（现在可用 who-calls / chain / tree，或读源码；禁止把邻域切片当成流程图）", id)
	} else {
		out.Steps = append([]FlowStep{}, fl.Steps...)
	}

	_, radj := treeAdjacency(v)
	for _, cid := range uniqueSorted(radj[id], v) {
		out.Callers = append(out.Callers, flowRefOf(v, cid))
	}
	for _, e := range v.Implements {
		if e.Status == "deleted" || e.To != id {
			continue
		}
		if implementation, ok := v.Nodes[e.From]; ok && implementation.Status != "deleted" {
			out.Implementations = append(out.Implementations, flowRefOf(v, e.From))
		}
	}
	sortFlowRefs(out.Implementations)
	out.Channels = flowChannels(v, radj, id)
	slog.Default().Info("flow lookup completed", "query", query, "id", id, "view", out.View, "degraded", out.Degraded, "steps", len(out.Steps), "callers", len(out.Callers), "implementations", len(out.Implementations), "channels", len(out.Channels))
	return out, nil
}

func flowRefOf(v *View, id string) FlowRef {
	n := v.Nodes[id]
	return FlowRef{ID: id, Name: n.Name, File: n.File, Line: n.Line, Kind: n.Kind, Channel: n.Channel}
}

func uniqueSorted(ids []string, v *View) []string {
	seen := map[string]bool{}
	out := make([]string, 0, len(ids))
	for _, id := range ids {
		node, ok := v.Nodes[id]
		if !ok || seen[id] || node.Status == "deleted" {
			continue
		}
		seen[id] = true
		out = append(out, id)
	}
	sort.Slice(out, func(i, j int) bool {
		if v.Nodes[out[i]].Name != v.Nodes[out[j]].Name {
			return v.Nodes[out[i]].Name < v.Nodes[out[j]].Name
		}
		return out[i] < out[j]
	})
	return out
}

func sortFlowRefs(refs []FlowRef) {
	sort.Slice(refs, func(i, j int) bool {
		if refs[i].Name != refs[j].Name {
			return refs[i].Name < refs[j].Name
		}
		return refs[i].ID < refs[j].ID
	})
}

func flowChannels(v *View, radj map[string][]string, id string) []FlowRef {
	seen := map[string]bool{id: true}
	q := []string{id}
	ch := make([]FlowRef, 0)
	if v.Nodes[id].Kind == "entry" {
		ch = append(ch, flowRefOf(v, id))
	}
	for len(q) > 0 {
		cur := q[0]
		q = q[1:]
		for _, p := range radj[cur] {
			node, ok := v.Nodes[p]
			if !ok || seen[p] || node.Status == "deleted" {
				continue
			}
			seen[p] = true
			if v.Nodes[p].Kind == "entry" {
				ch = append(ch, flowRefOf(v, p))
			}
			q = append(q, p)
		}
	}
	sortFlowRefs(ch)
	return ch
}

func viewName(v *View) string {
	if v == nil {
		return ""
	}
	return v.Name
}
