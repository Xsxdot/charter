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
	KindPrefixFamily       = "prefix-family"
	KindOversizedPackage   = "oversized-package"
	KindBudgetRaised       = "budget-raised"
	KindUnplaced           = "unplaced"
	KindUnplacedOverBudget = "unplaced-over-budget"
	KindDomainEmpty        = "domain-empty"
)

// 阈值写死在包内，不进 target 配置，避免把 fitness 判据调高到不报为止。
const (
	prefixFamilyMinShared  = 4
	prefixFamilyMinMembers = 5
	oversizedPackageFiles  = 40
)

// CheckBudgetRatchet 逐契约比对当前与基准 target 的 legacyBudget，上涨即产出 finding。
// 基准缺席的契约按预算 0 处理，因为新增契约携带的存量债同样需要留下理由（契约
// §7-R4）。本函数只产 findings，不在这里判档；分档必须由调用方读取当前契约的
// LegacyBudgetNote 并写入 Report（契约 §7-R6）。
func CheckBudgetRatchet(cur, base *Target) []Finding {
	if base == nil {
		return nil
	}
	baseBudgets := make(map[string]int, len(base.Contracts))
	for _, c := range base.Contracts {
		baseBudgets[c.From+"->"+c.To] = c.LegacyBudget
	}
	var findings []Finding
	for _, c := range cur.Contracts {
		key := c.From + "->" + c.To
		oldBudget, exists := baseBudgets[key]
		if !exists {
			oldBudget = 0
		}
		if c.LegacyBudget <= oldBudget {
			continue
		}
		detail := fmt.Sprintf("契约 %s 新增契约携带存量预算 %d（基准中缺席，按预算 0 处理）", c.From+"→"+c.To, c.LegacyBudget)
		if exists {
			detail = fmt.Sprintf("契约 %s 预算 %d→%d 上涨", c.From+"→"+c.To, oldBudget, c.LegacyBudget)
		}
		findings = append(findings, Finding{
			Kind: KindBudgetRaised, From: c.From, To: c.To, Detail: detail,
		})
	}
	return findings
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
