// domains.go —— 领域层的投影：把视图按领域聚合成带统计的领域树。
//
// 职责：领域树结构（parent/children）、每个领域的成员统计与对外接口清单
// 边界：只读视图，不改数据、不打日志、不做网络；领域一律读自数据的 domains 段，
// **不按包名或容器名推导**——推导出来的层级会被人和 agent 当成真实架构。
// 与前端 web/src/app/codegraph/domains.ts 的「跨领域边 / 对外接口」判定规则
// 必须一致，两侧分叉就是 bug。
package codegraph

import (
	"encoding/json"
	"sort"
)

// DomainStat 是一个领域的展示投影：元信息 + 结构位置 + 成员统计。
//
// 统计只算**直属容器**里的节点：父领域的数字不含子领域，读数不会重复计入。
// Interfaces 是本领域中被其他领域调用到的节点 id（即「对外开放接口」）。
type DomainStat struct {
	ID             string   `json:"id"`
	Label          string   `json:"label"`
	Kind           string   `json:"kind"`
	Summary        string   `json:"summary,omitempty"`
	Desc           string   `json:"desc,omitempty"`
	Parent         string   `json:"parent,omitempty"`
	Children       []string `json:"children"`
	Containers     []string `json:"containers"`
	Funcs          int      `json:"funcs"`
	Models         int      `json:"models"`
	Entries        int      `json:"entries"`
	Unscanned      int      `json:"unscannedEntries"`
	Interfaces     []string `json:"interfaces"`
	Subsystems     []string `json:"subsystems,omitempty"`
	CrossSubsystem bool     `json:"crossSubsystem,omitempty"`
	bestDerived    bool
}

// DomainEdgeStat 是跨领域调用边的有序聚合记录。
type DomainEdgeStat struct {
	From  string `json:"from"`
	To    string `json:"to"`
	Count int    `json:"count"`
}

// MarshalJSON 只在成功加载 best 时输出派生字段；best 缺失时保持旧 wire 形状。
func (s DomainStat) MarshalJSON() ([]byte, error) {
	type plain DomainStat
	raw, err := json.Marshal(plain(s))
	if err != nil || !s.bestDerived {
		return raw, err
	}
	var fields map[string]json.RawMessage
	if err := json.Unmarshal(raw, &fields); err != nil {
		return nil, err
	}
	if s.Subsystems == nil {
		s.Subsystems = []string{}
	}
	subsystems, err := json.Marshal(s.Subsystems)
	if err != nil {
		return nil, err
	}
	crossSubsystem, err := json.Marshal(s.CrossSubsystem)
	if err != nil {
		return nil, err
	}
	fields["subsystems"] = subsystems
	fields["crossSubsystem"] = crossSubsystem
	return json.Marshal(fields)
}

// DomainTree 把视图投影成领域列表，按 id 升序；列表内各切片字段也按字典序排序，
// 保证同一份数据每次输出一致（CLI 输出要能直接 diff）。
//
// 视图没有领域段时返回 nil——调用方据此降级为单领域视图，不要自行编造领域。
func DomainTree(v *View) []DomainStat {
	return domainTree(v, nil)
}

// DomainTreeWithBest 在 DomainTree 的基础上按 best 容器归属派生所属子系统。
func DomainTreeWithBest(v *View, best *Best) []DomainStat {
	return domainTree(v, best)
}

// DomainEdgeMatrix 按视图中的现状领域归属统计跨领域调用边。
func DomainEdgeMatrix(v *View) []DomainEdgeStat {
	return domainEdgeMatrix(v, func(nodeID string) string {
		n, ok := v.Nodes[nodeID]
		if !ok || n.Status == "deleted" {
			return ""
		}
		return domainOfContainer(v, n.Container)
	})
}

// BestEdgeMatrix 按最优图的顶层领域归属统计跨领域调用边。
func BestEdgeMatrix(v *View, best *Best) []DomainEdgeStat {
	return domainEdgeMatrix(v, func(nodeID string) string {
		return bestSubsystemOfNode(best, v, nodeID)
	})
}

func domainEdgeMatrix(v *View, owner func(string) string) []DomainEdgeStat {
	counts := map[string]*DomainEdgeStat{}
	for _, edge := range v.Edges {
		if edge.Status == "deleted" {
			continue
		}
		if _, ok := v.Nodes[edge.From]; !ok {
			continue
		}
		if _, ok := v.Nodes[edge.To]; !ok {
			continue
		}
		from, to := owner(edge.From), owner(edge.To)
		if from == "" || to == "" || from == to {
			continue
		}
		key := from + "\x00" + to
		if counts[key] == nil {
			counts[key] = &DomainEdgeStat{From: from, To: to}
		}
		counts[key].Count++
	}
	out := make([]DomainEdgeStat, 0, len(counts))
	for _, stat := range counts {
		out = append(out, *stat)
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].Count != out[j].Count {
			return out[i].Count > out[j].Count
		}
		if out[i].From != out[j].From {
			return out[i].From < out[j].From
		}
		return out[i].To < out[j].To
	})
	return out
}

func domainTree(v *View, best *Best) []DomainStat {
	if len(v.Domains) == 0 {
		return nil
	}
	stats := make(map[string]*DomainStat, len(v.Domains))
	for id, d := range v.Domains {
		stats[id] = &DomainStat{
			ID: id, Label: d.Label, Kind: d.Kind, Summary: d.Summary, Desc: d.Desc,
			Parent: d.Parent, Children: []string{}, Containers: []string{}, Interfaces: []string{},
		}
	}
	for id, d := range v.Domains {
		if p, ok := stats[d.Parent]; ok {
			p.Children = append(p.Children, id)
		}
	}
	for cid, c := range v.Containers {
		if s, ok := stats[c.Domain]; ok {
			s.Containers = append(s.Containers, cid)
		}
	}
	for _, n := range v.Nodes {
		if n.Status == "deleted" {
			continue
		}
		s, ok := stats[domainOfContainer(v, n.Container)]
		if !ok {
			continue
		}
		switch n.Kind {
		case "entry":
			s.Entries++
			if n.Unscanned {
				s.Unscanned++
			}
		case "model":
			s.Models++
		default:
			s.Funcs++
		}
	}
	if best != nil {
		subsystems := make(map[string]map[string]bool, len(stats))
		for id := range stats {
			subsystems[id] = map[string]bool{}
		}
		for nodeID, n := range v.Nodes {
			if n.Status == "deleted" {
				continue
			}
			id := domainOfContainer(v, n.Container)
			stat, ok := stats[id]
			if !ok {
				continue
			}
			if subsystem := bestSubsystemOfNode(best, v, nodeID); subsystem != "" {
				subsystems[id][subsystem] = true
			}
			stat.bestDerived = true
		}
		for id, stat := range stats {
			stat.bestDerived = true
			for subsystem := range subsystems[id] {
				stat.Subsystems = append(stat.Subsystems, subsystem)
			}
			sort.Strings(stat.Subsystems)
			stat.CrossSubsystem = len(stat.Subsystems) > 1
		}
	}
	// 对外接口 = 被别的领域调用到的节点。同一节点被多个领域调用只记一次。
	seen := map[string]map[string]bool{}
	for _, e := range v.Edges {
		if e.Status == "deleted" {
			continue
		}
		from, okF := v.Nodes[e.From]
		to, okT := v.Nodes[e.To]
		if !okF || !okT || from.Status == "deleted" || to.Status == "deleted" {
			continue
		}
		da := domainOfContainer(v, from.Container)
		db := domainOfContainer(v, to.Container)
		if da == "" || db == "" || da == db {
			continue
		}
		if seen[db] == nil {
			seen[db] = map[string]bool{}
		}
		if seen[db][e.To] {
			continue
		}
		seen[db][e.To] = true
		if s, ok := stats[db]; ok {
			s.Interfaces = append(s.Interfaces, e.To)
		}
	}
	out := make([]DomainStat, 0, len(stats))
	for _, s := range stats {
		sort.Strings(s.Children)
		sort.Strings(s.Containers)
		sort.Strings(s.Interfaces)
		out = append(out, *s)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].ID < out[j].ID })
	return out
}

// domainOfContainer 返回容器所属领域 id；容器不存在或未归属时返回空串，
// 调用方据此跳过——未归属的容器由 Validate 报问题，这里不做二次兜底。
func domainOfContainer(v *View, cid string) string {
	c, ok := v.Containers[cid]
	if !ok {
		return ""
	}
	return c.Domain
}
