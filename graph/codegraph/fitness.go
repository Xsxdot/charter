// 本文件实现 codegraph 的 fitness 判据与预算棘轮。
//
// 边界：仅标准库纯函数，不碰 git、不读文件系统；基准 target 由 CLI 注入。
package codegraph

import (
	"fmt"
	"path"
	"slices"
	"strings"
)

// 漏建对账（刀 3）的 finding kind——fail 侧。
const (
	KindDeadEntry     = "dead-entry"
	KindDeadInterface = "dead-interface"
	KindDeadContract  = "dead-contract"
)

// fitness 判据（刀 4）的 finding kind。
const (
	KindPrefixFamily     = "prefix-family"
	KindOversizedPackage = "oversized-package"
	KindBudgetRaised     = "budget-raised"
	KindDomainEmpty      = "domain-empty"
)

// 声明锚归属（刀 C1.2）的 finding kind。两者一律进 Warns：handoff 今天就有
// 14 条命中，报硬红只会逼出「改声明去迁就现状」这一最坏的拐杖（契约 §2-2）。
const (
	KindAnchorOffDomain = "anchor-off-domain"
	KindAnchorOffGraph  = "anchor-off-graph"
)

// 最优图 gap（刀 C1.8）的 finding kind。四条一律进 Warns——它们衡量的是最优图
// 与现状分类的一致性，靠编辑 best.json 即可消解；把可编辑消解的东西设为 fail，
// 等于给「改标签」发进度奖（契约 §1-3、§4）。
// 不可伪造的迁移进度条是边的合法性，由既有 new-direction / over-budget /
// legacyBudget 棘轮承担，本刀只换它们的归属输入。
const (
	KindContainerMisplaced = "container-misplaced"
	KindContainerUnplaced  = "container-unplaced"
	KindBestDangling       = "best-dangling"
)

// 阈值写死在包内，不进 target 配置，避免把 fitness 判据调高到不报为止。
const (
	prefixFamilyMinShared  = 4
	prefixFamilyMinMembers = 5
	oversizedPackageFiles  = 40
)

// ratchetBudget 记一个基准子系统的未落位预算。declared 与「值为 0」必须分开：
// 基准里根本没声明目标领域，和基准声明了目标领域但预算写 0，措辞不同——前者是
// 「本轮新引入目标领域」，后者是「已有的零容忍被放宽」。
type ratchetBudget struct {
	value    int
	declared bool
}

// CheckBudgetRatchet 比对当前与基准 target 的两类预算，上涨即产出 finding：
// 契约的 legacyBudget 按 from->to 比，声明了目标领域的子系统按 unplacedBudget 比。
//
// 参数：cur 为当前 target，base 为基准 target（nil 表示取不到基准，返回 nil）。
// 返回：按 cur.Contracts、cur.Subsystems 的声明序排列的 budget-raised findings。
//
// 注意：基准缺席的契约/目标领域预算一律按 0 参与比较，因为新引入时携带的存量债同样
// 需要留下理由（契约 §3-3）。本函数只探测上涨，**不判档**——档位取决于当前 target
// 的 note，那是装配期的事；探测器保持无 I/O 纯函数，也不写 Report。分档见
// ApplyBudgetRatchet。
func CheckBudgetRatchet(cur, base *Target) []Finding {
	if base == nil {
		return nil
	}
	baseContracts := make(map[string]int, len(base.Contracts))
	for _, contract := range base.Contracts {
		baseContracts[contract.From+"->"+contract.To] = contract.LegacyBudget
	}
	baseSubsystems := make(map[string]ratchetBudget, len(base.Subsystems))
	for _, subsystem := range base.Subsystems {
		if len(subsystem.Domains) > 0 {
			baseSubsystems[subsystem.ID] = ratchetBudget{value: subsystem.UnplacedBudget, declared: true}
		}
	}
	var findings []Finding
	for _, contract := range cur.Contracts {
		key := contract.From + "->" + contract.To
		old, exists := baseContracts[key]
		if !exists {
			old = 0
		}
		if contract.LegacyBudget <= old {
			continue
		}
		detail := fmt.Sprintf("契约 %s 新增契约携带存量预算 %d（基准中缺席，按预算 0 处理）", contract.From+"→"+contract.To, contract.LegacyBudget)
		if exists {
			detail = fmt.Sprintf("契约 %s 预算 %d→%d 上涨", contract.From+"→"+contract.To, old, contract.LegacyBudget)
		}
		findings = append(findings, Finding{Kind: KindBudgetRaised, From: contract.From, To: contract.To, Detail: detail})
	}
	for _, subsystem := range cur.Subsystems {
		if len(subsystem.Domains) == 0 {
			continue
		}
		old, exists := baseSubsystems[subsystem.ID]
		if !exists {
			old = ratchetBudget{value: 0}
		}
		if subsystem.UnplacedBudget <= old.value {
			continue
		}
		detail := fmt.Sprintf("子系统 %s 新增目标领域携带未落位预算 %d（基准中未声明目标领域，按预算 0 处理）", subsystem.ID, subsystem.UnplacedBudget)
		if old.declared {
			detail = fmt.Sprintf("子系统 %s 未落位预算 %d→%d 上涨", subsystem.ID, old.value, subsystem.UnplacedBudget)
		}
		findings = append(findings, Finding{Kind: KindBudgetRaised, From: subsystem.ID, Detail: detail})
	}
	return findings
}

// ApplyBudgetRatchet 把预算棘轮探测结果按理由分档写进 rep，并重排整份报告。
//
// 参数：rep 为 Check 已产出的报告（原地修改）；cur 为当前 target；base 为基准
// target（nil 时探测器返回空，本函数只剩一次排序）。
//
// 分档口径：理由一律取**当前** target 的 note——子系统预算取 UnplacedBudgetNote，
// 契约预算取 LegacyBudgetNote；TrimSpace 后非空才降为 warn，否则进 fails。取当前而
// 不取基准，是因为「这次为什么放宽」只有当前这份 target 能回答。
//
// 注意：只有 budget-raised 会被 note 降档；其他 fail 一律留在 Fails。
//
// 收尾必须重新 sortFindings：追加发生在 Check 排序之后，不重排 budget-raised 就会
// 永远吊在末尾，check 输出顺序不再确定、CLI 重复运行无法 diff。
// 本函数只操作内存，不做任何 I/O——git 取基准是 CLI 的边界。
func ApplyBudgetRatchet(rep *Report, cur, base *Target) {
	for _, finding := range CheckBudgetRatchet(cur, base) {
		note := budgetRatchetNote(cur, finding)
		if strings.TrimSpace(note) != "" {
			rep.Warns = append(rep.Warns, finding)
		} else {
			rep.Fails = append(rep.Fails, finding)
		}
	}
	sortFindings(rep)
}

// budgetRatchetNote 找到一条 budget-raised 对应的当前 note。
// To 为空是目标领域预算上涨的形状标记（契约 §4 冻结 30），据此分流到子系统；
// 否则按 from/to 找契约。找不到就返回空串 = 没有理由。
func budgetRatchetNote(cur *Target, finding Finding) string {
	if finding.To == "" {
		for _, subsystem := range cur.Subsystems {
			if subsystem.ID == finding.From {
				return subsystem.UnplacedBudgetNote
			}
		}
		return ""
	}
	for _, contract := range cur.Contracts {
		if contract.From == finding.From && contract.To == finding.To {
			return contract.LegacyBudgetNote
		}
	}
	return ""
}

// prefixFamilyFindings 在视图文件集内按目录和文件名前四个字符分组。阈值选四个字符
// 是因为 use/get/set/new 等惯例前缀实测都不超过三个字符，四字符共享能自动滤掉它们
// （契约 §2-1）；只读 View.Nodes 则保持 Check 纯函数，不为统计访问文件系统（§2-3、
// 拍板记录三）。
func prefixFamilyFindings(v *View) []Finding {
	type stemFile struct{ stem string }
	byDir := map[string]map[string][]stemFile{}
	for _, file := range viewFiles(v) {
		dir := path.Dir(file)
		base := path.Base(file)
		stem := strings.TrimSuffix(base, path.Ext(base))
		runes := []rune(stem)
		if len(runes) < prefixFamilyMinShared {
			continue
		}
		prefix := string(runes[:prefixFamilyMinShared])
		if byDir[dir] == nil {
			byDir[dir] = map[string][]stemFile{}
		}
		byDir[dir][prefix] = append(byDir[dir][prefix], stemFile{stem: stem})
	}

	dirs := make([]string, 0, len(byDir))
	for dir := range byDir {
		dirs = append(dirs, dir)
	}
	slices.Sort(dirs)
	var findings []Finding
	for _, dir := range dirs {
		prefixes := make([]string, 0, len(byDir[dir]))
		for prefix := range byDir[dir] {
			prefixes = append(prefixes, prefix)
		}
		slices.Sort(prefixes)
		for _, prefix := range prefixes {
			members := byDir[dir][prefix]
			if len(members) < prefixFamilyMinMembers {
				continue
			}
			lcp := members[0].stem
			for _, member := range members[1:] {
				lcp = longestCommonPrefix(lcp, member.stem)
			}
			findings = append(findings, Finding{
				Kind: KindPrefixFamily,
				Detail: fmt.Sprintf("目录 %s 下前缀族 %q 有 %d 个源文件（阈值 %d）——架构法第三条：必须回答「还能圈出有界文件集吗」",
					dir, lcp, len(members), prefixFamilyMinMembers),
			})
		}
	}
	return findings
}

// oversizedPackageFindings 只统计 View.Nodes 中非 deleted 节点的去重文件，并用 path
// 处理仓库统一的 '/' 路径；不读文件系统是为了保持 Check 的纯函数性（契约 §2-3）。
func oversizedPackageFindings(v *View) []Finding {
	files := viewFiles(v)
	counts := map[string]int{}
	dirs := map[string]bool{}
	for _, file := range files {
		dir := path.Dir(file)
		counts[dir]++
		dirs[dir] = true
	}
	orderedDirs := make([]string, 0, len(dirs))
	for dir := range dirs {
		orderedDirs = append(orderedDirs, dir)
	}
	slices.Sort(orderedDirs)
	var findings []Finding
	for _, dir := range orderedDirs {
		if counts[dir] < oversizedPackageFiles || hasDeeperDirectory(dir, dirs) {
			continue
		}
		findings = append(findings, Finding{
			Kind: KindOversizedPackage,
			Detail: fmt.Sprintf("目录 %s 有 %d 个图内源文件（阈值 %d）且没有更深层目录——架构法第三条：必须回答「还能圈出有界文件集吗」",
				dir, counts[dir], oversizedPackageFiles),
		})
	}
	return findings
}

func viewFiles(v *View) []string {
	seen := map[string]bool{}
	for _, n := range v.Nodes {
		if n.Status != "deleted" {
			seen[n.File] = true
		}
	}
	files := make([]string, 0, len(seen))
	for file := range seen {
		files = append(files, file)
	}
	slices.Sort(files)
	return files
}

func longestCommonPrefix(a, b string) string {
	ar, br := []rune(a), []rune(b)
	limit := len(ar)
	if len(br) < limit {
		limit = len(br)
	}
	i := 0
	for i < limit && ar[i] == br[i] {
		i++
	}
	return string(ar[:i])
}

func hasDeeperDirectory(dir string, dirs map[string]bool) bool {
	for other := range dirs {
		if other == dir {
			continue
		}
		if dir == "." {
			if other != "." {
				return true
			}
			continue
		}
		if strings.HasPrefix(other, dir+"/") {
			return true
		}
	}
	return false
}
