// 本文件把现状视图的领域声明、包摘要、接口、主调用链和实体表组合成一个 context 结果。
// 边界：只调用现有 View/Graph API，不读取 best.json、不扩展加载路径、不修改图数据。
package codegraph

import (
	"fmt"
	"log/slog"
	"path/filepath"
	"sort"
	"strings"
)

// ContextPackage is a package directory and its transcribed package-doc summary.
type ContextPackage struct {
	Path    string `json:"path"`
	Summary string `json:"summary"`
}

// ContextInterface is a live node crossing into the selected domain subtree.
type ContextInterface struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	Signature string `json:"signature,omitempty"`
}

// ContextDomain is the selected current-view domain and its direct children.
type ContextDomain struct {
	ID       string   `json:"id"`
	Label    string   `json:"label"`
	Kind     string   `json:"kind"`
	Summary  string   `json:"summary,omitempty"`
	Desc     string   `json:"desc,omitempty"`
	Parent   string   `json:"parent,omitempty"`
	Children []string `json:"children"`
}

// FocusTruncation explains focus-quota reduction without hiding the full interface list.
type FocusTruncation struct {
	Total  int    `json:"total"`
	Shown  int    `json:"shown"`
	Reason string `json:"reason"`
}

// ContextResult is the assembled domain context returned by the CLI context command.
type ContextResult struct {
	View          string             `json:"view"`
	Domain        ContextDomain      `json:"domain"`
	Declaration   *DomainDecl        `json:"declaration,omitempty"`
	Packages      []ContextPackage   `json:"packages"`
	Interfaces    []ContextInterface `json:"interfaces"`
	Chain         *AssembledResult   `json:"chain"`
	Entities      []EntityResult     `json:"entities"`
	FociTruncated *FocusTruncation   `json:"fociTruncated,omitempty"`
	Stale         []StaleNode        `json:"stale,omitempty"`
	Warning       string             `json:"warning,omitempty"`
}

// AssembleContext returns one existing view domain. Unknown domains fail with the
// current-view vocabulary so a best.json id cannot be mistaken for missing data.
// Missing declarations and untyped model metadata are warnings, not fatal errors.
func AssembleContext(v *View, g *Graph, repoRoot, domainID string, opts QueryOptions) (*ContextResult, error) {
	if v == nil || g == nil {
		return nil, fmt.Errorf("context %q requires non-nil view and graph", domainID)
	}
	domain, ok := v.Domains[domainID]
	if !ok {
		ids := sortedDomainIDs(v.Domains)
		slog.Default().Error("context domain not found", "domain", domainID, "view", v.Name, "candidateCount", len(ids))
		return nil, fmt.Errorf("领域 %q 不在现状视图词表中；现状视图领域候选: %s。best-only id 不能用于 context", domainID, strings.Join(ids, ", "))
	}
	slog.Default().Info("assemble context started", "domain", domainID, "view", v.Name, "opts", opts)

	subtree := domainSubtree(v.Domains, domainID)
	children := []string{}
	for id, d := range v.Domains {
		if d.Parent == domainID {
			children = append(children, id)
		}
	}
	sort.Strings(children)
	out := &ContextResult{
		View: v.Name,
		Domain: ContextDomain{ID: domainID, Label: domain.Label, Kind: domain.Kind, Summary: domain.Summary,
			Desc: domain.Desc, Parent: domain.Parent, Children: children},
		Packages: []ContextPackage{}, Interfaces: []ContextInterface{}, Entities: []EntityResult{},
	}

	decls, err := LoadDomainDecls(repoRoot)
	if err != nil {
		slog.Default().Error("context declarations failed", "domain", domainID, "stage", "load-declarations", "error", err)
		return nil, fmt.Errorf("context %s 加载声明失败: %w", domainID, err)
	}
	if decl, ok := decls[domainID]; ok {
		copyDecl := decl
		out.Declaration = &copyDecl
	} else {
		out.Warning = appendWarning(out.Warning, fmt.Sprintf("领域声明缺失：codegraph/domains/%s.json；请按 roadmap 1a 补齐", domainID))
	}

	out.Packages = contextPackages(v, g, subtree)
	out.Interfaces = contextInterfaces(v, subtree)

	modelsTyped := false
	modelsUntyped := true
	for id, n := range v.Nodes {
		if n.Status == "deleted" || n.Kind != "model" {
			continue
		}
		if n.ModelKind != "" {
			modelsTyped = true
			modelsUntyped = false
		}
		if subtree[nodeDomain(v, n.Node)] && n.ModelKind == ModelKindEntity {
			entity, err := EntityLookup(v, repoRoot, id)
			if err != nil {
				slog.Default().Error("context entity lookup failed", "domain", domainID, "node", id, "error", err)
				return nil, fmt.Errorf("context %s 查询实体 %s 失败: %w", domainID, id, err)
			}
			out.Entities = append(out.Entities, *entity)
		}
	}
	if !modelsTyped && modelsUntyped {
		out.Warning = appendWarning(out.Warning, "该项目未分种，实体数不可用")
	}
	sort.Slice(out.Entities, func(i, j int) bool { return out.Entities[i].Query < out.Entities[j].Query })

	foci := contextFoci(v, subtree)
	if len(foci) > DefaultContextFocusQuota {
		out.FociTruncated = &FocusTruncation{Total: len(foci), Shown: DefaultContextFocusQuota, Reason: "focus-quota"}
		foci = foci[:DefaultContextFocusQuota]
	}
	slog.Default().Info("context neighborhood before call", "domain", domainID, "foci", len(foci), "interfaces", len(out.Interfaces), "entities", len(out.Entities))
	raw, err := Neighborhood(v, foci, DefaultContextDepth, 0)
	if err != nil {
		slog.Default().Error("context neighborhood failed", "domain", domainID, "stage", "neighborhood", "error", err)
		return nil, fmt.Errorf("context %s 查询主链失败: %w", domainID, err)
	}
	chain, err := AssembleResult(v, raw, repoRoot, opts)
	if err != nil {
		slog.Default().Error("context chain assembly failed", "domain", domainID, "stage", "assemble", "error", err)
		return nil, fmt.Errorf("context %s 装配主链失败: %w", domainID, err)
	}
	out.Chain = chain
	subset := &Graph{Nodes: map[string]Node{}}
	for _, n := range raw.Nodes {
		vn, ok := v.Nodes[n.ID]
		if ok && vn.Status != "deleted" {
			subset.Nodes[n.ID] = vn.Node
		}
	}
	out.Stale = CheckStale(repoRoot, subset)
	slog.Default().Info("assemble context completed", "domain", domainID, "packages", len(out.Packages), "interfaces", len(out.Interfaces), "entities", len(out.Entities), "foci", len(foci), "stale", len(out.Stale))
	return out, nil
}

func sortedDomainIDs(domains map[string]Domain) []string {
	ids := make([]string, 0, len(domains))
	for id := range domains {
		ids = append(ids, id)
	}
	sort.Strings(ids)
	return ids
}

func domainSubtree(domains map[string]Domain, root string) map[string]bool {
	seen := map[string]bool{root: true}
	changed := true
	for changed {
		changed = false
		for id, d := range domains {
			if !seen[id] && seen[d.Parent] {
				seen[id] = true
				changed = true
			}
		}
	}
	return seen
}

func contextPackages(v *View, g *Graph, subtree map[string]bool) []ContextPackage {
	paths := map[string]bool{}
	for _, n := range v.Nodes {
		if n.Status == "deleted" || !subtree[nodeDomain(v, n.Node)] || n.File == "" {
			continue
		}
		paths[filepath.ToSlash(filepath.Dir(n.File))] = true
	}
	ids := make([]string, 0, len(paths))
	for path := range paths {
		ids = append(ids, path)
	}
	sort.Strings(ids)
	out := make([]ContextPackage, 0, len(ids))
	for _, path := range ids {
		summary := ""
		if g.Packages != nil {
			summary = g.Packages[path].Summary
		}
		out = append(out, ContextPackage{Path: path, Summary: summary})
	}
	return out
}

func contextInterfaces(v *View, subtree map[string]bool) []ContextInterface {
	ids := map[string]bool{}
	for _, edge := range v.Edges {
		if edge.Status == "deleted" || v.Nodes[edge.From].Status == "deleted" || v.Nodes[edge.To].Status == "deleted" {
			continue
		}
		fromDomain := nodeDomain(v, v.Nodes[edge.From].Node)
		toDomain := nodeDomain(v, v.Nodes[edge.To].Node)
		if !subtree[fromDomain] && subtree[toDomain] {
			ids[edge.To] = true
		}
	}
	ordered := make([]string, 0, len(ids))
	for id := range ids {
		ordered = append(ordered, id)
	}
	sort.Strings(ordered)
	out := make([]ContextInterface, 0, len(ordered))
	for _, id := range ordered {
		n := v.Nodes[id].Node
		out = append(out, ContextInterface{ID: id, Name: n.Name, Signature: n.Signature})
	}
	return out
}

type contextFocus struct {
	id      string
	entries bool
	incross int
}

func contextFoci(v *View, subtree map[string]bool) []string {
	focus := map[string]*contextFocus{}
	for id, n := range v.Nodes {
		if n.Status == "deleted" || !subtree[nodeDomain(v, n.Node)] {
			continue
		}
		if n.Kind == "entry" {
			focus[id] = &contextFocus{id: id, entries: true}
		}
	}
	for _, edge := range v.Edges {
		if edge.Status == "deleted" || v.Nodes[edge.From].Status == "deleted" || v.Nodes[edge.To].Status == "deleted" {
			continue
		}
		fromDomain := nodeDomain(v, v.Nodes[edge.From].Node)
		toDomain := nodeDomain(v, v.Nodes[edge.To].Node)
		if !subtree[fromDomain] && subtree[toDomain] {
			if focus[edge.To] == nil {
				focus[edge.To] = &contextFocus{id: edge.To}
			}
			focus[edge.To].incross++
		}
	}
	ordered := make([]*contextFocus, 0, len(focus))
	for _, f := range focus {
		ordered = append(ordered, f)
	}
	sort.Slice(ordered, func(i, j int) bool {
		if ordered[i].incross != ordered[j].incross {
			return ordered[i].incross > ordered[j].incross
		}
		if ordered[i].entries != ordered[j].entries {
			return ordered[i].entries
		}
		return ordered[i].id < ordered[j].id
	})
	out := make([]string, 0, len(ordered))
	for _, f := range ordered {
		out = append(out, f.id)
	}
	return out
}

func appendWarning(current, next string) string {
	if current == "" {
		return next
	}
	return current + "；" + next
}
