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

// LookupFlow 取出 id 的流程图与邻域摘要。g 为 nil 或没有 flows 段时一律 degraded。
func LookupFlow(v *View, g *Graph, repoRoot, query, id string) (*FlowLookupResult, error) {
	slog.Default().Info("flow lookup started", "query", query, "id", id)
	if v == nil {
		slog.Default().Error("flow lookup rejected nil view")
		return nil, fmt.Errorf("flow 需要非空视图")
	}
	if _, ok := v.Nodes[id]; !ok || v.Nodes[id].Status == "deleted" {
		slog.Default().Error("flow lookup subject missing", "id", id)
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
	if g != nil {
		for _, e := range g.Implements {
			if e[1] == id {
				if _, ok := v.Nodes[e[0]]; ok && v.Nodes[e[0]].Status != "deleted" {
					out.Implementations = append(out.Implementations, flowRefOf(v, e[0]))
				}
			}
		}
		sort.Slice(out.Implementations, func(i, j int) bool {
			return out.Implementations[i].Name < out.Implementations[j].Name
		})
	}
	out.Channels = flowChannels(v, radj, id)
	slog.Default().Info("flow lookup completed", "id", id, "degraded", out.Degraded, "steps", len(out.Steps), "callers", len(out.Callers), "channels", len(out.Channels))
	return out, nil
}

func flowRefOf(v *View, id string) FlowRef {
	n := v.Nodes[id]
	return FlowRef{ID: id, Name: n.Name, File: n.File, Line: n.Line, Kind: n.Kind, Channel: n.Channel}
}

func uniqueSorted(ids []string, v *View) []string {
	seen := map[string]bool{}
	var out []string
	for _, id := range ids {
		if seen[id] || v.Nodes[id].Status == "deleted" {
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

func flowChannels(v *View, radj map[string][]string, id string) []FlowRef {
	seen := map[string]bool{id: true}
	q := []string{id}
	var ch []FlowRef
	if v.Nodes[id].Kind == "entry" {
		ch = append(ch, flowRefOf(v, id))
	}
	for len(q) > 0 {
		cur := q[0]
		q = q[1:]
		for _, p := range radj[cur] {
			if seen[p] || v.Nodes[p].Status == "deleted" {
				continue
			}
			seen[p] = true
			if v.Nodes[p].Kind == "entry" {
				ch = append(ch, flowRefOf(v, p))
			}
			q = append(q, p)
		}
	}
	sort.Slice(ch, func(i, j int) bool {
		if ch[i].Name != ch[j].Name {
			return ch[i].Name < ch[j].Name
		}
		return ch[i].ID < ch[j].ID
	})
	return ch
}
