// 本文件实现声明锚的归属判据：领域声明里的 file#Symbol 锚，是不是真落在
// 声明它的那个领域里。
//
// 职责：anchorOwnershipFindings（两条 warn 判据，由 Check 调用）
// 边界：不查锚的存在性（那是 validate 的引用完整性职责），不读盘（见下）
package codegraph

import (
	"fmt"
	"sort"
	"strings"
)

// anchorOwnershipFindings 判两条：锚落在别人家的域（anchor-off-domain）、
// 锚在图内根本没有节点（anchor-off-graph）。**两条都只进 Warns。**
//
// 为什么是 warn 不是 fail：handoff 今天就有 14 条命中（2 条离域 + 12 条离图）。
// 报硬红会让 validate/check 当场不可用，而被逼出来的处置只能是「改声明去迁就
// 现状」——那是最坏的一种拐杖，与整个目标图批次的方向正好相反。锚失联本身就是
// 一条诚实的 gap 记录，该进迁移预算，不该被抹平（契约 §2-2、拍板记录 3、4）。
//
// 为什么不用 ResolveAnchor：那个函数在图内未命中时会 os.ReadFile 做词边界兜底，
// 一旦调用，Check 这个 codegraph 里唯一的纯判据函数就变成 I/O 函数了。此处只走
// resolveGraphAnchor 这条纯路径，代价是分不出「图外但文件里还在」与「彻底消失」
// ——而那个区分本就是 validate 的存在性职责，check 再报一次是重复（契约 §3-2）。
func anchorOwnershipFindings(v *View, decls map[string]DomainDecl) []Finding {
	if len(decls) == 0 {
		return nil
	}
	// 契约 19 说的是「按 Domain 字典序」，不是按 map key。走 CLI 时
	// LoadDomainDecls 保证 key == Domain 两者无差别，但 Check 是导出函数，
	// 直接构造 decls 的调用方可以让两者不一致——按契约字面办。
	ordered := make([]DomainDecl, 0, len(decls))
	for _, d := range decls {
		ordered = append(ordered, d)
	}
	// map 遍历序不定。Check 末尾的 sortFindings 确实也会重排，但那是**调用方**的
	// 行为：本函数要能被单独调用、单独测，所以自己的输出顺序自己负责。
	sort.Slice(ordered, func(i, j int) bool { return ordered[i].Domain < ordered[j].Domain })
	var out []Finding
	for _, decl := range ordered {
		if _, ok := v.Domains[decl.Domain]; !ok {
			// 域不在图中已经是 validate 的硬 issue，此处不重复报
			continue
		}
		for _, ref := range declAnchorRefs(decl) {
			if f, ok := anchorFinding(v, decl.Domain, ref); ok {
				out = append(out, f)
			}
		}
	}
	return out
}

// declAnchorRefs 按固定顺序摊平一份声明里的全部锚：先 lifecycle 的 from/to，
// 再按 stateMachine 的声明序。**刻意不去重**——同一个锚在声明里写了两遍就报两条，
// 去重会把声明本身的冗余一起藏掉（契约 18）。
func declAnchorRefs(d DomainDecl) []string {
	var refs []string
	if d.Lifecycle != nil {
		for _, r := range []string{d.Lifecycle.From, d.Lifecycle.To} {
			if r != "" {
				refs = append(refs, r)
			}
		}
	}
	for _, tr := range d.StateMachine {
		if tr.Anchor != "" {
			refs = append(refs, tr.Anchor)
		}
	}
	return refs
}

// domainCoversAnchor 判「锚所在领域 anchorDomain 是否落在声明领域 declDomain 之内」。
// 领域是树（Domain.Parent），而容器只能挂叶子（validateDomains 执法）——所以写在
// 父域上的声明，它的锚必然落在某个子域里。若在此处用严格相等，**任何**非叶子领域
// 上的声明都会 100% 假阳，且报文完全解释不了为什么。
//
// 今天 handoff 与夹具都还没有非叶子声明（实测），但 handoff 已有 4 个非叶子领域、
// 声明才铺了 2 个域；等 roadmap 1a 把声明铺满，撞上只是时间问题。
//
// 沿 Parent 上溯时带访问集：父链成环由 validateDomains 报硬 issue，但 Check 是纯
// 判据函数，不能因为数据脏就死循环。
func domainCoversAnchor(v *View, declDomain, anchorDomain string) bool {
	seen := map[string]bool{}
	for cur := anchorDomain; cur != "" && !seen[cur]; {
		if cur == declDomain {
			return true
		}
		seen[cur] = true
		cur = v.Domains[cur].Parent
	}
	return false
}

// anchorFinding 判定单个锚。返回的 ok 为 false 表示「无话可说」——它既涵盖
// 「锚是对的」，也涵盖四种交给别的判据去管的跳过分支（契约 15、16）。
func anchorFinding(v *View, declDomain, ref string) (Finding, bool) {
	file, symbol, ok := strings.Cut(ref, "#")
	if !ok || file == "" || symbol == "" {
		return Finding{}, false // 锚格式是 validate 的职责
	}
	nodeID, hit := resolveGraphAnchor(v, file, symbol)
	if !hit {
		return Finding{
			Kind: KindAnchorOffGraph, From: declDomain,
			Detail: fmt.Sprintf("领域 %s 的声明锚 %s 在图内没有节点，归属无从核对（图只收 entry/func/model 三类；包级 var、const、类型别名等本就不入图，属正当情形）", declDomain, ref),
		}, true
	}
	container, ok := v.Containers[v.Nodes[nodeID].Container]
	if !ok || container.Domain == "" {
		// 容器缺失或不归域：旧扫描数据的降级形态，不是声明作者的错
		return Finding{}, false
	}
	if domainCoversAnchor(v, declDomain, container.Domain) {
		return Finding{}, false
	}
	return Finding{
		Kind: KindAnchorOffDomain, From: declDomain, To: container.Domain,
		Detail: fmt.Sprintf("领域 %s 的声明锚 %s 实际属于领域 %s：声明说这是我的生命周期起止点，图说这个符号不是你的", declDomain, ref, container.Domain),
	}, true
}
