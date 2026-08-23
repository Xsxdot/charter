// 本文件实现引用完整性校验：图与 diff 里的一切引用必须落在已定义的对象上。
//
// 职责：Validate（基线自查）、ValidateDiff（diff 相对基线自查）
// 边界：不查 file:line 真实性（stale.go 的事）、不修数据，只报告
package codegraph

import (
	"fmt"
	"sort"
)

// Validate 检查基线的引用完整性，返回问题列表（空 = 干净）。
// 检查项：节点的 container 必须存在；每条边两端必须是已定义节点。
func Validate(g *Graph) []string {
	var issues []string
	for id, n := range g.Nodes {
		if _, ok := g.Containers[n.Container]; !ok {
			issues = append(issues, fmt.Sprintf("节点 %s 引用不存在的容器 %s", id, n.Container))
		}
	}
	for _, e := range g.Edges {
		for _, end := range e {
			if _, ok := g.Nodes[end]; !ok {
				issues = append(issues, fmt.Sprintf("边 %s→%s 引用不存在的节点 %s", e[0], e[1], end))
			}
		}
	}
	for _, e := range g.Implements {
		for _, end := range e {
			if _, ok := g.Nodes[end]; !ok {
				issues = append(issues, fmt.Sprintf("implements 边 %s→%s 引用不存在的节点 %s", e[0], e[1], end))
			}
		}
	}
	for _, p := range g.Projections {
		issues = append(issues, validateProjection(g.Nodes, p, "投影")...)
	}
	issues = append(issues, validateLifecycle(g.Nodes, g.Lifecycle, "lifecycle")...)
	issues = append(issues, validateModelKind(g)...)
	issues = append(issues, validateDomains(g)...)
	sort.Strings(issues)
	return issues
}

// validateModelKind 执法 model 分种（契约 21~23）。三条都是**自相矛盾**类：
// 取值不在枚举内、字段挂在非 model 节点上、声称是 dto 却有人往它里面写状态。
//
// 刻意不执法的第四种（契约 24）：entity 却没有 lifecycle 条目。全仓 707 个
// model 要分批补标，把「标了 entity 但生命周期还没补」判成硬红，会让 validate
// 在整个补标期不可用，逼出的处置只能是回头去改 modelKind 迁就现状。它改为在
// validate 命令里计数（与 unscannedEntries 同处），那个数字顺带成为补标进度表。
func validateModelKind(g *Graph) []string {
	return validateModelKindNodes(g.Nodes, g.Lifecycle, "")
}

// validateModelKindNodes 是上面那套判据的按节点集形态。label 非空时前缀进报文，
// 供 diff 侧区分「基线里就有的矛盾」与「这份 diff 引进的矛盾」。
func validateModelKindNodes(nodes map[string]Node, lifecycle []LifecycleRef, label string) []string {
	var issues []string
	writers := make(map[string]bool, len(lifecycle))
	for _, ref := range lifecycle {
		if ref.Kind == "writer" {
			writers[ref.Model] = true
		}
	}
	// 不在此处排序：Validate 末尾对 issues 整体 sort.Strings，且每条报文都带
	// 节点 id、不存在需要 tiebreak 的同键项。曾经在这里放过一次 sort，理由写的是
	// 「同键报文要稳定」——那是假的，删掉它输出一个字节都不变。
	for id, n := range nodes {
		if n.ModelKind == "" {
			continue // 空 = 未分种，存量默认，放行
		}
		switch n.ModelKind {
		case ModelKindEntity, ModelKindDTO, ModelKindConfig:
		default:
			issues = append(issues, label+fmt.Sprintf("节点 %s 的 modelKind %q 不在枚举内（entity/dto/config）", id, n.ModelKind))
			continue // 取值都非法，后两条判据无从谈起
		}
		if n.Kind != "model" {
			issues = append(issues, label+fmt.Sprintf("节点 %s 的 kind 是 %s，不该带 modelKind——该字段只对 model 有意义", id, n.Kind))
			continue
		}
		if n.ModelKind == ModelKindDTO && writers[id] {
			issues = append(issues, label+fmt.Sprintf("节点 %s 标为 dto 却在 lifecycle 段有 writer 条目：传输结构不该有人写它的状态", id))
		}
	}
	return issues
}

// EntitiesWithoutLifecycle 数「modelKind 标了 entity，但 lifecycle 段里一条都没有」
// 的节点。这是补标进度表，不是错误计数——见 validateModelKind 的注释。
//
// 口径两点，都刻意与注释字面一致（曾经写过头，被审计抓到）：
//   - 判「有没有条目」，不分 creator/writer，也不管 Kind 字段是否合法——
//     lifecycle 条目本身的合法性由 validateLifecycle 管，这里只问覆盖没覆盖。
//   - 不看 node.Kind：非 model 节点带 entity 已由第 22 条报硬 issue，
//     此处再筛一道只会让「报了错还不计数」这种更难解释的组合出现。
func EntitiesWithoutLifecycle(g *Graph) int {
	covered := make(map[string]bool, len(g.Lifecycle))
	for _, ref := range g.Lifecycle {
		covered[ref.Model] = true
	}
	n := 0
	for id, node := range g.Nodes {
		if node.ModelKind == ModelKindEntity && !covered[id] {
			n++
		}
	}
	return n
}

// validateDomains 检查领域段自洽与容器归属。
// domains 为空时整段跳过——那是旧扫描数据的合法降级路径，不是错误。
func validateDomains(g *Graph) []string {
	if len(g.Domains) == 0 {
		return nil
	}
	var out []string
	hasChild := map[string]bool{}
	for id, d := range g.Domains {
		if d.Parent == "" {
			continue
		}
		if _, ok := g.Domains[d.Parent]; !ok {
			out = append(out, fmt.Sprintf("领域 %s 的 parent %s 不存在", id, d.Parent))
			continue
		}
		hasChild[d.Parent] = true
	}
	// 父链探环：沿 Parent 上溯，重复遇到同一个 id 即成环。
	// 成环会让消费方的路径推导死循环，必须在数据层拦下。
	for id := range g.Domains {
		seen := map[string]bool{id: true}
		for cur := g.Domains[id].Parent; cur != ""; {
			if seen[cur] {
				out = append(out, fmt.Sprintf("领域 %s 的父链存在环", id))
				break
			}
			seen[cur] = true
			d, ok := g.Domains[cur]
			if !ok {
				break // parent 不存在已在上面报过，这里不重复报
			}
			cur = d.Parent
		}
	}
	// 容器归属：必须有 domain、领域必须存在、且必须是叶子。
	// 存在性一律用 ok 判定——拿零值比较会把「存在但字段全空的领域」误判成不存在。
	for cid, c := range g.Containers {
		if c.Domain == "" {
			out = append(out, fmt.Sprintf("容器 %s 未归属领域（domains 非空时每个容器都必须有 domain）", cid))
			continue
		}
		if _, ok := g.Domains[c.Domain]; !ok {
			out = append(out, fmt.Sprintf("容器 %s 引用不存在的领域 %s", cid, c.Domain))
			continue
		}
		if hasChild[c.Domain] {
			out = append(out, fmt.Sprintf("容器 %s 挂在非叶子领域 %s（容器只能挂叶子领域）", cid, c.Domain))
		}
	}
	return out
}

// ValidateDiff 检查 diff 相对基线的引用完整性。
// 检查项：nodesModified/nodesDeleted 引用的节点必须在基线里；
// edgesAdded/edgesDeleted 两端必须在「基线 ∪ nodesAdded」里；
// nodesAdded 的 container 必须在「基线 ∪ containersAdded」里。
func ValidateDiff(g *Graph, d *Diff) []string {
	var issues []string
	// containersAdded 是分支新建容器的唯一合法来源；先校验其 id 与领域，避免
	// 用一个看似新增的条目静默覆盖基线，或把容器挂到图外领域（契约 §7-R1）。
	for id, c := range d.ContainersAdded {
		if _, ok := g.Containers[id]; ok {
			issues = append(issues, fmt.Sprintf("新增容器 %s 已存在于基线，containersAdded 只接受新容器", id))
		}
		if c.Domain == "" {
			issues = append(issues, fmt.Sprintf("新增容器 %s 未声明 domain，containersAdded 的容器必须归属基线领域", id))
		} else if _, ok := g.Domains[c.Domain]; !ok {
			issues = append(issues, fmt.Sprintf("新增容器 %s 引用不存在的基线领域 %s", id, c.Domain))
		}
	}
	known := func(id string) bool {
		if _, ok := g.Nodes[id]; ok {
			return true
		}
		_, ok := d.NodesAdded[id]
		return ok
	}
	for id, n := range d.NodesAdded {
		if _, ok := g.Containers[n.Container]; !ok {
			if _, added := d.ContainersAdded[n.Container]; added {
				continue
			}
			issues = append(issues, fmt.Sprintf("新增节点 %s 引用不存在的容器 %s", id, n.Container))
		}
	}
	for id := range d.NodesModified {
		if _, ok := g.Nodes[id]; !ok {
			issues = append(issues, fmt.Sprintf("修改的节点 %s 不在基线里", id))
		}
	}
	for _, id := range d.NodesDeleted {
		if _, ok := g.Nodes[id]; !ok {
			issues = append(issues, fmt.Sprintf("删除的节点 %s 不在基线里", id))
		}
	}
	for _, e := range append(append([]Edge{}, d.EdgesAdded...), d.EdgesDeleted...) {
		for _, end := range e {
			if !known(end) {
				issues = append(issues, fmt.Sprintf("diff 边 %s→%s 引用未知节点 %s", e[0], e[1], end))
			}
		}
	}
	for _, e := range append(append([]Edge{}, d.ImplementsAdded...), d.ImplementsDeleted...) {
		for _, end := range e {
			if !known(end) {
				issues = append(issues, fmt.Sprintf("diff implements 边 %s→%s 引用未知节点 %s", e[0], e[1], end))
			}
		}
	}
	knownNodeMap := make(map[string]Node, len(g.Nodes)+len(d.NodesAdded))
	for id, n := range g.Nodes {
		knownNodeMap[id] = n
	}
	for id, n := range d.NodesAdded {
		knownNodeMap[id] = n
	}
	for id, n := range d.NodesModified {
		if _, ok := knownNodeMap[id]; ok {
			knownNodeMap[id] = n
		}
	}
	for _, p := range append(append([]Projection{}, d.ProjectionsAdded...), d.ProjectionsDeleted...) {
		issues = append(issues, validateProjection(knownNodeMap, p, "diff 投影")...)
	}
	// modelKind 在 diff 侧同样执法：nodesAdded/nodesModified 是新节点与改动进图的
	// 唯一入口，只查基线等于让每一次 diff 都能把矛盾数据合法带进来（契约 §4-21~23
	// 的 2026-08-23 扩展回写）。lifecycle 取基线与本 diff 新增的并集——dto 的
	// writer 可能是这份 diff 才加上的。
	diffNodes := make(map[string]Node, len(d.NodesAdded)+len(d.NodesModified))
	for id, n := range d.NodesAdded {
		diffNodes[id] = n
	}
	for id, n := range d.NodesModified {
		diffNodes[id] = n
	}
	mergedLifecycle := append(append([]LifecycleRef{}, g.Lifecycle...), d.LifecycleAdded...)
	issues = append(issues, validateModelKindNodes(diffNodes, mergedLifecycle, "diff ")...)
	issues = append(issues, validateLifecycle(knownNodeMap, d.LifecycleAdded, "diff lifecycle")...)
	issues = append(issues, validateLifecycle(knownNodeMap, d.LifecycleDeleted, "diff lifecycle")...)
	sort.Strings(issues)
	return issues
}

func validateLifecycle(nodes map[string]Node, refs []LifecycleRef, label string) []string {
	var issues []string
	for _, ref := range refs {
		_, whoOK := nodes[ref.Who]
		model, modelOK := nodes[ref.Model]
		if !whoOK {
			issues = append(issues, fmt.Sprintf("%s %s→%s 引用不存在的 Who 节点 %s", label, ref.Who, ref.Model, ref.Who))
		}
		if !modelOK {
			issues = append(issues, fmt.Sprintf("%s %s→%s 引用不存在的 Model 节点 %s", label, ref.Who, ref.Model, ref.Model))
		} else if model.Kind != "model" {
			issues = append(issues, fmt.Sprintf("%s %s→%s 的 Model 节点 kind 必须为 model，实际为 %s", label, ref.Who, ref.Model, model.Kind))
		}
		if ref.Kind != "creator" && ref.Kind != "writer" {
			issues = append(issues, fmt.Sprintf("%s %s→%s 的 kind 非法: %q（只认 creator/writer）", label, ref.Who, ref.Model, ref.Kind))
		}
	}
	return issues
}

func validateProjection(nodes map[string]Node, p Projection, label string) []string {
	var issues []string
	from, fromOK := nodes[p[0]]
	to, toOK := nodes[p[1]]
	if !fromOK {
		issues = append(issues, fmt.Sprintf("%s %s→%s(%s) 引用不存在的节点 %s", label, p[0], p[1], p[2], p[0]))
	}
	if !toOK {
		issues = append(issues, fmt.Sprintf("%s %s→%s(%s) 引用不存在的节点 %s", label, p[0], p[1], p[2], p[1]))
	}
	if p[2] != "typed" && p[2] != "handroll" && p[2] != "twin" {
		issues = append(issues, fmt.Sprintf("%s %s→%s 的 kind 非法: %q（只认 typed/handroll/twin）", label, p[0], p[1], p[2]))
	}
	if p[2] == "twin" && fromOK && toOK && (from.Kind != "model" || to.Kind != "model") {
		issues = append(issues, fmt.Sprintf("%s %s→%s 的 twin 两端必须都是 model 节点", label, p[0], p[1]))
	}
	return issues
}
