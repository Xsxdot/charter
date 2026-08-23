// 本文件实现最优图与视图之间的容器级 gap 判据。
//
// 职责：按 Best 的容器归属计算四类可编辑告警与归属覆盖读数。
// 边界：只读 Best/View，不访问文件系统、不写文件、不参与契约棘轮。
package codegraph

import "sort"

// BestCoverage 是 check 的归属覆盖读数，不是 Finding，不参与退出码。
// 它在 best 非 nil 时始终出现，即使所有数值都是 0。
type BestCoverage struct {
	AssignedContainers int `json:"assignedContainers"`
	ViewContainers     int `json:"viewContainers"`
	CrossDomainEdges   int `json:"crossDomainEdges"`
	MisplacedSkipped   int `json:"misplacedSkipped"`
}

// bestGapFindings 逐容器/逐叶子领域产生四类 warn。容器归属是 best.json 的
// Containers 表，而不是文件路径规则；因此一个容器只产生一条容器级 finding。
func bestGapFindings(v *View, b *Best) (warns []Finding, misplacedSkipped int) {
	if v == nil || b == nil {
		return nil, 0
	}

	hasLiveNode := make(map[string]bool, len(v.Containers))
	for _, n := range v.Nodes {
		if n.Status != "deleted" {
			hasLiveNode[n.Container] = true
		}
	}

	containerIDs := make([]string, 0, len(v.Containers))
	for id := range v.Containers {
		containerIDs = append(containerIDs, id)
	}
	sort.Strings(containerIDs)
	for _, containerID := range containerIDs {
		if !hasLiveNode[containerID] {
			continue
		}
		container := v.Containers[containerID]
		if _, ok := b.Containers[containerID]; !ok {
			warns = append(warns, Finding{Kind: KindContainerUnplaced, From: containerID,
				Detail: "视图容器存在非 deleted 节点，但 best.json 未声明容器归属"})
		}
		if container.Domain == "" {
			continue
		}
		if _, comparable := b.Domains[container.Domain]; !comparable {
			misplacedSkipped++
			continue
		}
		if bestDomain := b.DomainOfContainer(containerID); bestDomain != "" && bestDomain != container.Domain {
			warns = append(warns, Finding{Kind: KindContainerMisplaced, From: containerID,
				Detail: "视图容器领域 " + container.Domain + " 与 best.json 归属 " + bestDomain + " 不同"})
		}
	}

	children := make(map[string]bool, len(b.Domains))
	for _, domain := range b.Domains {
		if domain.Parent != "" {
			children[domain.Parent] = true
		}
	}
	containerCounts := make(map[string]int, len(b.Domains))
	for _, domainID := range b.Containers {
		containerCounts[domainID]++
	}
	domainIDs := make([]string, 0, len(b.Domains))
	for id := range b.Domains {
		domainIDs = append(domainIDs, id)
	}
	sort.Strings(domainIDs)
	for _, domainID := range domainIDs {
		if !children[domainID] && containerCounts[domainID] == 0 {
			warns = append(warns, Finding{Kind: KindDomainEmpty, From: domainID,
				Detail: "best.json 叶子领域没有容器归属"})
		}
	}

	bestContainerIDs := make([]string, 0, len(b.Containers))
	for id := range b.Containers {
		bestContainerIDs = append(bestContainerIDs, id)
	}
	sort.Strings(bestContainerIDs)
	for _, containerID := range bestContainerIDs {
		if !hasLiveNode[containerID] {
			warns = append(warns, Finding{Kind: KindBestDangling, From: containerID,
				Detail: "best.json 容器在当前视图中不存在非 deleted 节点"})
		}
	}
	return warns, misplacedSkipped
}

func bestCoverage(v *View, b *Best) *BestCoverage {
	coverage := &BestCoverage{}
	if v == nil || b == nil {
		return coverage
	}
	liveContainers := make(map[string]bool, len(v.Containers))
	for _, node := range v.Nodes {
		if node.Status != "deleted" {
			if _, ok := v.Containers[node.Container]; ok {
				liveContainers[node.Container] = true
			}
		}
	}
	coverage.ViewContainers = len(liveContainers)
	for containerID := range liveContainers {
		if b.SubsystemOf(b.DomainOfContainer(containerID)) != "" {
			coverage.AssignedContainers++
		}
	}
	for _, edge := range v.Edges {
		if edge.Status == "deleted" {
			continue
		}
		from := bestSubsystemOfNode(b, v, edge.From)
		to := bestSubsystemOfNode(b, v, edge.To)
		if from != "" && to != "" && from != to {
			coverage.CrossDomainEdges++
		}
	}
	return coverage
}
