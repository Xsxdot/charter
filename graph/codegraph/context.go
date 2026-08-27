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
	// Actual 是「实然披露」：本域（应然）覆盖的容器今天实际归在哪。
	// best 缺席时整段省略——没有最优树就没有应然/实然之分。additive-only 可选键。
	Actual  *ContextActual `json:"actual,omitempty"`
	Warning string         `json:"warning,omitempty"`
}

// ContextActual 回答「这个最优树领域的代码今天实际散在哪」。
//
// 存在理由：context 按最优树词表切片，而仓库今天仍按现状结构摆放。只给应然分组
// 会让消费者（多数是 agent）误以为仓库已经这么组织好了，那是把应然当实然。
type ContextActual struct {
	// Containers 是本域覆盖的真实容器数。
	Containers int `json:"containers"`
	// ByCurrentDomain 是这些容器今天的现状归属分布，按容器数降序、同数按 id 升序。
	// **只陈列分布，不挑"主归属"**——现状域到最优域的映射本就非单值，替调用方挑一个即是猜。
	ByCurrentDomain []ActualDomainCount `json:"byCurrentDomain"`
	// Misplaced 是本域内判定为放错位的容器，判据复用 containerAlignment（仓内唯一定义）。
	Misplaced []ActualMisplaced `json:"misplaced"`
	// MisplacedSkipped 是因视图领域不在 best 词表中而**无法比较**的容器数。
	// 必须与 Misplaced 同时出现：只报 0 会被读成「没搬错」，而真相往往是「没法比」。
	MisplacedSkipped int `json:"misplacedSkipped"`
}

// ActualDomainCount 是一条现状归属分布。
type ActualDomainCount struct {
	ID         string `json:"id"`
	Label      string `json:"label,omitempty"`
	Containers int    `json:"containers"`
}

// ActualMisplaced 是一条放错位记录（容器 · 现在在哪 · 差异说明）。
type ActualMisplaced struct {
	Container     string `json:"container"`
	CurrentDomain string `json:"currentDomain"`
	Detail        string `json:"detail"`
}

// AssembleContext 装配一个**最优树领域**的声明、包、接口、主链与实体上下文。
//
// 词表：best 在场时 domainID 必须是 best 领域 id——声明自 C1.10/C1.11 起就按最优树 id
// 存放，context 若还按现状词表取，声明必然取不到（这正是本函数改词表的原因）。
// best 缺席时降级为现状视图词表，并在 Warning 里明说本次是降级，**不静默**。
//
// 参数：v 当前视图、g 原图、best 最优图（可为 nil）、repoRoot 仓根、domainID 领域 id、opts 查询选项。
// 返回：装配结果；未知领域返回**可行动**的错误（含候选与映射分布），不是一句「不在词表中」。
//
// 注意 best 显式作为参数而不是函数内部 LoadBest：参数化才测得动 best 缺席那条分支。
func AssembleContext(v *View, g *Graph, best *Best, repoRoot, domainID string, opts QueryOptions) (*ContextResult, error) {
	if v == nil || g == nil {
		return nil, fmt.Errorf("context %q requires non-nil view and graph", domainID)
	}
	decls, err := LoadDomainDecls(repoRoot)
	if err != nil {
		slog.Default().Error("context declarations failed", "domain", domainID, "stage", "load-declarations", "error", err)
		return nil, fmt.Errorf("context %s 加载声明失败: %w", domainID, err)
	}
	ctxDomain, member, err := contextVocabulary(v, best, decls, domainID)
	if err != nil {
		return nil, err
	}
	slog.Default().Info("assemble context started", "domain", domainID, "view", v.Name, "best", best != nil, "opts", opts)

	out := &ContextResult{
		View: v.Name, Domain: ctxDomain,
		Packages: []ContextPackage{}, Interfaces: []ContextInterface{}, Entities: []EntityResult{},
	}
	if best == nil {
		out.Warning = appendWarning(out.Warning, "best.json 不可用，本次按现状视图词表降级运行；声明自最优树迁移后可能取不到")
	} else {
		out.Actual = contextActual(v, best, member)
		// best 没归位的容器不属于任何最优树领域，于是不会出现在任何一次 context 里。
		// 不吭声地漏掉一批真实代码就是静默失败——这里如实报数，让人知道漏在哪一类。
		if n := unplacedContainerCount(v, best); n > 0 {
			out.Warning = appendWarning(out.Warning, fmt.Sprintf("best.json 未归位容器 %d 个，它们不属于任何最优树领域，因而不会作为本域成员出现在 packages/interfaces/entities/actual 里；chain 是例外——主链是对全图的裸 BFS，不做领域过滤，它们仍可能出现在那里", n))
		}
	}

	if decl, ok := decls[domainID]; ok {
		copyDecl := decl
		out.Declaration = &copyDecl
	} else {
		out.Warning = appendWarning(out.Warning, fmt.Sprintf("领域声明缺失：codegraph/domains/%s.json；请按 roadmap 1a 补齐", domainID))
		if best == nil {
			if migrated := declKeysOutsideView(v, decls); len(migrated) > 0 {
				out.Warning = appendWarning(out.Warning, fmt.Sprintf("注意：仓内有 %d 份声明的键不在现状视图词表中（如 %s），声明很可能已迁到最优树词表；此时「补齐」是错的处置——真因是本次因 best.json 不可用而按现状词表运行", len(migrated), strings.Join(migrated, "、")))
			}
		}
	}

	out.Packages = contextPackages(v, g, member)
	out.Interfaces = contextInterfaces(v, member)

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
		if member(n.Node) && n.ModelKind == ModelKindEntity {
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

	foci := contextFoci(v, member)
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

func contextPackages(v *View, g *Graph, member func(Node) bool) []ContextPackage {
	paths := map[string]bool{}
	for _, n := range v.Nodes {
		if n.Status == "deleted" || !member(n.Node) || n.File == "" {
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

func contextInterfaces(v *View, member func(Node) bool) []ContextInterface {
	ids := map[string]bool{}
	for _, edge := range v.Edges {
		from, fromOK := v.Nodes[edge.From]
		to, toOK := v.Nodes[edge.To]
		if edge.Status == "deleted" || !fromOK || !toOK || from.Status == "deleted" || to.Status == "deleted" {
			continue
		}
		if !member(from.Node) && member(to.Node) {
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

func contextFoci(v *View, member func(Node) bool) []string {
	focus := map[string]*contextFocus{}
	for id, n := range v.Nodes {
		if n.Status == "deleted" || !member(n.Node) {
			continue
		}
		if n.Kind == "entry" {
			focus[id] = &contextFocus{id: id, entries: true}
		}
	}
	for _, edge := range v.Edges {
		from, fromOK := v.Nodes[edge.From]
		to, toOK := v.Nodes[edge.To]
		if edge.Status == "deleted" || !fromOK || !toOK || from.Status == "deleted" || to.Status == "deleted" {
			continue
		}
		if !member(from.Node) && member(to.Node) {
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

// contextVocabulary 决议本次 context 用哪套领域词表，并产出成员判据。
//
// 参数：v 当前视图、best 最优图（nil = 降级）、decls 已加载的声明表、domainID 领域 id。
// 返回：领域元信息、成员判据 member（判断一个节点是否属于本域）、错误。
// 领域摘要自 C12 起取 decls 正文，无声明为空。
//
// 两套词表只是两种 member 构造，遍历逻辑仍是同一份——这是本次改动刻意收敛的点：
// 若让两套词表各写一遍包/接口/焦点的遍历，日后必然只改一边。
func contextVocabulary(v *View, best *Best, decls map[string]DomainDecl, domainID string) (ContextDomain, func(Node) bool, error) {
	if best == nil {
		domain, ok := v.Domains[domainID]
		if !ok {
			ids := sortedDomainIDs(v.Domains)
			slog.Default().Error("context domain not found", "domain", domainID, "view", v.Name, "vocabulary", "current", "candidateCount", len(ids))
			return ContextDomain{}, nil, fmt.Errorf("领域 %q 不在现状视图词表中；现状视图领域候选: %s。（best.json 不可用，本次按现状词表运行）", domainID, strings.Join(ids, ", "))
		}
		sub := domainSubtree(v.Domains, domainID)
		children := []string{}
		for id, d := range v.Domains {
			if d.Parent == domainID {
				children = append(children, id)
			}
		}
		sort.Strings(children)
		out := ContextDomain{ID: domainID, Label: domain.Label, Kind: domain.Kind, Summary: domain.Summary,
			Desc: domain.Desc, Parent: domain.Parent, Children: children}
		return out, func(n Node) bool { return sub[nodeDomain(v, n)] }, nil
	}

	domain, ok := best.Domains[domainID]
	if !ok {
		return ContextDomain{}, nil, unknownBestDomainError(v, best, domainID)
	}
	sub := bestSubtree(best, domainID)
	children := []string{}
	for id, d := range best.Domains {
		if d.Parent == domainID {
			children = append(children, id)
		}
	}
	sort.Strings(children)
	out := ContextDomain{ID: domainID, Label: domain.Label, Kind: domain.Type,
		Summary: declSummary(decls, domainID), Parent: domain.Parent, Children: children}
	return out, func(n Node) bool { return sub[best.DomainOfContainer(n.Container)] }, nil
}

// declSummary 是 best 分支领域摘要的唯一取数点：职责正文唯一所有者是 decl
// 文件（C12 契约 §2.2-9），无声明如实为空串（omitempty 后键省略），
// 禁止任何来自 best 结构的兜底回填。
func declSummary(decls map[string]DomainDecl, domainID string) string {
	return decls[domainID].Responsibility
}

// unknownBestDomainError 产出**可行动**的未知领域报错。
//
// 光说「不在词表中」会把使用者晾在原地：多数误用是拿现状域 id 来查（迁移前的老习惯）。
// 因此 domainID 恰是现状域时，额外报出它的容器实际映射到哪些最优域及各自容器数。
// **只报分布、不自动改写**——现状域到最优域的映射非单值，替调用方挑一个即是猜。
func unknownBestDomainError(v *View, best *Best, domainID string) error {
	ids := make([]string, 0, len(best.Domains))
	for id := range best.Domains {
		ids = append(ids, id)
	}
	sort.Strings(ids)
	slog.Default().Error("context domain not found", "domain", domainID, "view", v.Name, "vocabulary", "best", "candidateCount", len(ids))
	msg := fmt.Sprintf("领域 %q 不在最优树词表中；context 已按最优树词表取声明，最优树领域候选: %s", domainID, strings.Join(ids, ", "))
	if _, isCurrent := v.Domains[domainID]; !isCurrent {
		return fmt.Errorf("%s", msg)
	}
	counts := map[string]int{}
	for id, c := range v.Containers {
		if c.Domain != domainID {
			continue
		}
		if b := best.DomainOfContainer(id); b != "" {
			counts[b]++
		} else {
			counts["(best 未归位)"]++
		}
	}
	if len(counts) == 0 {
		return fmt.Errorf("%s。%q 是现状视图领域 id，它在 best.json 里没有任何容器归属", msg, domainID)
	}
	parts := make([]string, 0, len(counts))
	for id := range counts {
		parts = append(parts, id)
	}
	sort.Slice(parts, func(i, j int) bool {
		if counts[parts[i]] != counts[parts[j]] {
			return counts[parts[i]] > counts[parts[j]]
		}
		return parts[i] < parts[j]
	})
	for i, id := range parts {
		parts[i] = fmt.Sprintf("%s(%d 容器)", id, counts[id])
	}
	return fmt.Errorf("%s。%q 是**现状视图**领域 id，它的容器分布在: %s——请按需改用其中一个最优树 id（分布非单值，不代为改写）",
		msg, domainID, strings.Join(parts, "、"))
}

// bestSubtree 以 domainID 为根、按 BestDomain.Parent 向下取闭包。
// 形态与 domainSubtree 一致：父域的 context 必须覆盖全部后代叶子的容器。
func bestSubtree(best *Best, root string) map[string]bool {
	seen := map[string]bool{root: true}
	for changed := true; changed; {
		changed = false
		for id, d := range best.Domains {
			if !seen[id] && d.Parent != "" && seen[d.Parent] {
				seen[id] = true
				changed = true
			}
		}
	}
	return seen
}

// contextActual 计算实然披露：本域覆盖的容器今天实际归在哪、哪些放错位、哪些没法比。
//
// 参数：v 当前视图、best 最优图、member 成员判据。返回：实然披露段（best 在场时必非 nil）。
// 放错位判据复用 containerAlignment——仓内只此一份定义。
func contextActual(v *View, best *Best, member func(Node) bool) *ContextActual {
	mine := map[string]bool{}
	for _, n := range v.Nodes {
		if n.Status == "deleted" || !member(n.Node) || n.Container == "" {
			continue
		}
		mine[n.Container] = true
	}
	ids := make([]string, 0, len(mine))
	for id := range mine {
		ids = append(ids, id)
	}
	sort.Strings(ids)

	out := &ContextActual{Containers: len(ids), ByCurrentDomain: []ActualDomainCount{}, Misplaced: []ActualMisplaced{}}
	counts := map[string]int{}
	for _, id := range ids {
		cur := v.Containers[id].Domain
		if cur == "" {
			cur = "(现状未归属)"
		}
		counts[cur]++
		if v.Containers[id].Domain == "" {
			// 现状域为空 = 没法比，与「视图领域不在 best 词表中」同类，一并计入 skipped。
			// 不并进来就会被读成「已对齐」，而 ByCurrentDomain 那半却专门给它留了
			// (现状未归属) 桶——同一个函数的两半不能对同一件事持相反信念。
			out.MisplacedSkipped++
			continue
		}
		switch kind, detail := containerAlignment(v, best, id); kind {
		case alignSkipped:
			out.MisplacedSkipped++
		case alignMisplaced:
			out.Misplaced = append(out.Misplaced, ActualMisplaced{Container: id, CurrentDomain: v.Containers[id].Domain, Detail: detail})
		}
	}
	for id, n := range counts {
		out.ByCurrentDomain = append(out.ByCurrentDomain, ActualDomainCount{ID: id, Label: v.Domains[id].Label, Containers: n})
	}
	sort.Slice(out.ByCurrentDomain, func(i, j int) bool {
		if out.ByCurrentDomain[i].Containers != out.ByCurrentDomain[j].Containers {
			return out.ByCurrentDomain[i].Containers > out.ByCurrentDomain[j].Containers
		}
		return out.ByCurrentDomain[i].ID < out.ByCurrentDomain[j].ID
	})
	return out
}

// unplacedContainerCount 数「有存活节点、但 best.json 没给归属」的容器。
//
// 参数：v 当前视图、best 最优图。返回：未归位容器数。
// 它与 bestGapFindings 的 KindContainerUnplaced 是同一个概念，此处只取计数：
// context 要的是一句可见提醒，逐条清单归 check。
func unplacedContainerCount(v *View, best *Best) int {
	live := map[string]bool{}
	for _, n := range v.Nodes {
		if n.Status != "deleted" && n.Container != "" {
			live[n.Container] = true
		}
	}
	count := 0
	for id := range live {
		if _, ok := best.Containers[id]; !ok {
			count++
		}
	}
	return count
}

// declKeysOutsideView 列出「键不在现状视图词表中」的声明，最多取前 3 个做示例。
//
// 参数：v 当前视图、decls 已加载的声明表。返回：越界键的示例列表（已排序）。
// 用途：best 缺席时 context 按现状词表运行，若声明其实已迁到最优树词表，
// 「声明缺失、请补齐」就是错的处置建议——这里提供判断依据，把误导报错掐掉。
func declKeysOutsideView(v *View, decls map[string]DomainDecl) []string {
	outside := make([]string, 0, len(decls))
	for id := range decls {
		if _, ok := v.Domains[id]; !ok {
			outside = append(outside, id)
		}
	}
	sort.Strings(outside)
	if len(outside) > 3 {
		return outside[:3]
	}
	return outside
}
