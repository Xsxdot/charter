// 本文件实现目标图对实际图的契约对照（spec §5）。
//
// 职责：Check——归域、逐边判定、legacy 预算结算，产出 Report
// 边界：不做 I/O、不打日志——纯函数，可观测性由返回的 Report 承担；
//
//	加载与退出码语义在 cmd 层
package codegraph

import (
	"fmt"
	"slices"
	"strings"
)

// Finding 一条对照发现。Kind 取值：
// fail 侧：new-direction（无契约方向）/ off-entry 归并进 legacy 或 over-budget /
// off-interface（未声明的跨域实现）/ over-budget（legacy 超预算）/ dead-entry /
// dead-interface / dead-contract（契约声明的缝未在视图中建成）
// warn 侧：legacy（预算内直调计数）/ outside-file（节点引用了不存在的容器）/
// dead-assembly（组装点条目未命中任何节点文件）
type Finding struct {
	Kind   string `json:"kind"`
	From   string `json:"from,omitempty"`
	To     string `json:"to,omitempty"`
	Edge   *Edge  `json:"edge,omitempty"`
	Detail string `json:"detail"`
}

// Report 是 Check 的产出。Fails 非空即闸门不过（cmd 层译成非零退出码）。
type Report struct {
	Fails        []Finding      `json:"fails"`
	Warns        []Finding      `json:"warns"`
	LegacyHits   map[string]int `json:"legacyHits,omitempty"` // "from->to" → 命中数
	BestCoverage *BestCoverage  `json:"bestCoverage,omitempty"`
}

// Check 把合并视图 v 套在目标图 t 上对照。算法四步见 spec §5。
// deleted 状态的节点/边不参与——它们只为渲染保留。
//
// decls 是领域声明（`codegraph/domains/*.json`），由 CLI 层加载后传入；
// 为 nil 或空时锚判据整体跳过，输出与本入参引入前逐字节相同（契约 §4-12）。
// 本函数**保持纯函数**：锚只走 resolveGraphAnchor 这条只读 View 的路径，
// 绝不调用会读盘的 ResolveAnchor（契约 §3-2、§4-13）。
//
// b 是最优图（`codegraph/best.json`），由 CLI 层加载后传入。
// **两个 nil 入参的后果不对称**：decls 为 nil 只关掉锚判据；b 为 nil 关掉的是
// 主判据——归属无来源，四条 gap 判据与全部契约执法一并跳过。因此调用方在 b 为
// nil 时必须显式喊出「判据已跳过」，静默等同伪绿（C1.8 契约 §3-1、§5-3）。
func Check(t *Target, b *Best, v *View, decls map[string]DomainDecl) *Report {
	rep := &Report{Fails: []Finding{}, Warns: []Finding{}, LegacyHits: map[string]int{}}
	assembly := make(map[string]bool, len(t.Assembly))
	for _, f := range t.Assembly {
		assembly[f] = true
	}
	contracts := make(map[string]*Contract, len(t.Contracts))
	for i := range t.Contracts {
		c := &t.Contracts[i]
		contracts[c.From+"->"+c.To] = c
	}
	// 归域 + 图外收集（每文件报一次）
	nodeDomain := make(map[string]string, len(v.Nodes))
	outside := map[string]bool{}
	allFiles := map[string]bool{} // 供组装点死配置检测：视图里出现过的全部文件（含图外）
	for id, n := range v.Nodes {
		if n.Status == "deleted" {
			continue
		}
		allFiles[n.File] = true
		d := bestSubsystemOfNode(b, v, id)
		nodeDomain[id] = d
		if _, ok := v.Containers[n.Container]; !ok {
			outside[n.File] = true
		}
	}
	if b != nil {
		// call 边
		liveDirections := map[string]bool{}
		for i := range v.Edges {
			e := v.Edges[i]
			if e.Status == "deleted" {
				continue
			}
			from, to := nodeDomain[e.From], nodeDomain[e.To]
			if from == "" || to == "" || from == to {
				continue // 图外已单独 warn；域内不检查
			}
			// 组装点边虽豁免 new-direction 执法，仍证明声明方向已建成；R3 要求
			// dead-contract 把它与普通 call 边一并计为活边。
			liveDirections[from+"->"+to] = true
			if callerNode, ok := v.Nodes[e.From]; ok && assembly[callerNode.File] {
				continue // 组装点豁免（依赖注入的绑定边）
			}
			c := contracts[from+"->"+to]
			if c == nil {
				rep.Fails = append(rep.Fails, Finding{Kind: "new-direction", From: from, To: to,
					Edge: &Edge{e.From, e.To}, Detail: fmt.Sprintf("跨子系统方向 %s→%s 无契约条目", from, to)})
				continue
			}
			label := ""
			if callee, ok := v.Nodes[e.To]; ok {
				label = v.Containers[callee.Container].Label
			}
			if inList(c.Entries, label) {
				continue
			}
			rep.LegacyHits[from+"->"+to]++
		}
		// implements 边：实现(from 侧域=to 契约方) → 接口(from 契约方)
		for i := range v.Implements {
			e := v.Implements[i]
			if e.Status == "deleted" {
				continue
			}
			implDom, ifaceDom := nodeDomain[e.From], nodeDomain[e.To]
			if implDom == "" || ifaceDom == "" || implDom == ifaceDom {
				continue
			}
			// implements 的方向是接口所在域 → 实现所在域；即使接口条目本身
			// 另有 dead-interface 问题，这条边仍证明契约缝存在（契约 §7-R3）。
			liveDirections[ifaceDom+"->"+implDom] = true
			c := contracts[ifaceDom+"->"+implDom]
			ifaceName := ""
			if n, ok := v.Nodes[e.To]; ok {
				ifaceName = n.Name
			}
			if c == nil || !inList(c.Interfaces, ifaceName) {
				rep.Fails = append(rep.Fails, Finding{Kind: "off-interface", From: ifaceDom, To: implDom,
					Edge:   &Edge{e.From, e.To},
					Detail: fmt.Sprintf("跨子系统实现未声明: %s 实现了 %s 的 %s", implDom, ifaceDom, ifaceName)})
			}
		}
		// 漏建对账沿用既有 call/implements 的归域口径。入口要求 Label 容器至少有
		// 一个非 deleted 节点落在 to 域，接口要求 Name 节点落在 from 域；这是 R2
		// 对全局存在性收窄，避免「同名但跨域」造成对账通过、实际 check 仍违规。
		for _, c := range t.Contracts {
			direction := c.From + "→" + c.To
			for _, entry := range c.Entries {
				found := false
				for containerID, container := range v.Containers {
					if container.Label != entry {
						continue
					}
					for nodeID, n := range v.Nodes {
						if n.Status == "deleted" || n.Container != containerID || bestSubsystemOfNode(b, v, nodeID) != c.To {
							continue
						}
						found = true
						break
					}
					if found {
						break
					}
				}
				if !found {
					rep.Fails = append(rep.Fails, Finding{
						Kind: KindDeadEntry, From: c.From, To: c.To,
						Detail: fmt.Sprintf("契约 %s 声明的入口 %q 在 %s 中不存在（无同 Label 容器或其非 deleted 节点均不属 %s；期望在 %s 找到）", direction, entry, c.To, c.To, c.To),
					})
				}
			}
			for _, iface := range c.Interfaces {
				found := false
				for nodeID, n := range v.Nodes {
					if n.Status != "deleted" && n.Name == iface && bestSubsystemOfNode(b, v, nodeID) == c.From {
						found = true
						break
					}
				}
				if !found {
					rep.Fails = append(rep.Fails, Finding{
						Kind: KindDeadInterface, From: c.From, To: c.To,
						Detail: fmt.Sprintf("契约 %s 声明的接口 %q 在 %s 中不存在（无同名非 deleted 节点；期望在 %s 找到）", direction, iface, c.From, c.From),
					})
				}
			}
			if !liveDirections[c.From+"->"+c.To] {
				rep.Fails = append(rep.Fails, Finding{
					Kind: KindDeadContract, From: c.From, To: c.To,
					Detail: fmt.Sprintf("契约 %s 声明的方向没有活跃 call、implements 或组装点豁免边（期望在该方向看到至少一条跨子系统边）", direction),
				})
			}
		}
		// 预算结算
		for key, hits := range rep.LegacyHits {
			c := contracts[key]
			if hits > c.LegacyBudget {
				rep.Fails = append(rep.Fails, Finding{Kind: "over-budget", From: c.From, To: c.To,
					Detail: fmt.Sprintf("%s 直调 %d 条超出预算 %d", key, hits, c.LegacyBudget)})
			} else {
				rep.Warns = append(rep.Warns, Finding{Kind: "legacy", From: c.From, To: c.To,
					Detail: fmt.Sprintf("%s 预算内直调 %d/%d（可收窄后调低预算）", key, hits, c.LegacyBudget)})
			}
		}
	}
	// 容器引用悬空
	for f := range outside {
		rep.Warns = append(rep.Warns, Finding{Kind: "outside-file", Detail: "图节点引用了视图中不存在的容器: " + f})
	}
	// 组装点死配置：assembly 条目在视图里找不到任何节点文件。
	// 在此之前 assembly 写错文件名是零信号：ValidateTarget 完全不看 Assembly，
	// Check 只把它当 set 做 caller 比对，于是一条并不存在的
	// "cmd/main.go" 能在基准里躺过整轮而无人发现（2026-08-21 双轨对照实测）。
	// 只报 warn 不报 fail：扫描未覆盖的入口文件（如当前的 main.go）本就没有节点，
	// 落 fail 会把「基线覆盖不全」误判成「契约违规」。
	for _, f := range t.Assembly {
		if !allFiles[f] {
			rep.Warns = append(rep.Warns, Finding{Kind: "dead-assembly",
				Detail: fmt.Sprintf("组装点 %q 未命中视图中任何节点文件", f)})
		}
	}
	if b != nil {
		rep.BestCoverage = bestCoverage(v, b)
		gapWarns, skipped := bestGapFindings(v, b)
		rep.BestCoverage.MisplacedSkipped = skipped
		rep.Warns = append(rep.Warns, gapWarns...)
	}
	// fitness 只消费当前视图的图内文件集并落 Warns；命中是要求回答边界，
	// 不是自动把架构形态判成契约违规（契约 §2-1、§2-3）。
	// 锚归属：位置在 gap 之后、fitness 之前。三者都只落 Warns，彼此无依赖，
	// 排序统一由末尾的 sortFindings 兜底。
	rep.Warns = append(rep.Warns, anchorOwnershipFindings(v, decls)...)

	rep.Warns = append(rep.Warns, prefixFamilyFindings(v)...)
	rep.Warns = append(rep.Warns, oversizedPackageFindings(v)...)
	sortFindings(rep) // 输出稳定排序，测试与 diff 可复现
	return rep
}

func inList(list []string, s string) bool {
	for _, x := range list {
		if x == s {
			return true
		}
	}
	return false
}

// sortFindings 把 Fails/Warns 按 Kind+Detail 排序——map 遍历序不定，
// 输出必须可复现，否则 CLI diff 与测试都不稳。slices.SortFunc 不稳定，
// 撞键时若没有 From/To/Edge tiebreak，输出顺序会抖动且无法做 diff。
func sortFindings(rep *Report) {
	cmp := func(a, b Finding) int {
		if a.Kind != b.Kind {
			return strings.Compare(a.Kind, b.Kind)
		}
		if a.Detail != b.Detail {
			return strings.Compare(a.Detail, b.Detail)
		}
		if a.From != b.From {
			return strings.Compare(a.From, b.From)
		}
		if a.To != b.To {
			return strings.Compare(a.To, b.To)
		}
		switch {
		case a.Edge == nil && b.Edge != nil:
			return -1
		case a.Edge != nil && b.Edge == nil:
			return 1
		case a.Edge == nil && b.Edge == nil:
			return 0
		}
		if (*a.Edge)[0] != (*b.Edge)[0] {
			return strings.Compare((*a.Edge)[0], (*b.Edge)[0])
		}
		return strings.Compare((*a.Edge)[1], (*b.Edge)[1])
	}
	slices.SortFunc(rep.Fails, cmp)
	slices.SortFunc(rep.Warns, cmp)
}
