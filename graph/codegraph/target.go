// 本文件实现目标图 target.json 的模型、加载与校验（spec
// docs/superpowers/specs/2026-08-21-codegraph-target-check-design.md §4）。
//
// 职责：类型定义、LoadTarget、ValidateTarget、子系统映射（Task 2）
// 边界：不做对照（check.go）；不写文件——target 是人写的，程序只读
package codegraph

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

// TargetMeta 目标图来源信息。
type TargetMeta struct {
	Version int    `json:"version"`
	Project string `json:"project"`
}

// TargetDomain 一个子系统内的目标领域。归属由嵌套关系决定，不设 subsystem 外键。
// Paths 与 TargetSubsystem.Paths 同构：只接受精确路径或 dir/**。
type TargetDomain struct {
	ID             string   `json:"id"`
	Name           string   `json:"name"`
	Responsibility string   `json:"responsibility"`
	Paths          []string `json:"paths"`
}

// TargetSubsystem 一个声明的子系统。Type 二选一：logic / boundary（分区协议的类型标注）。
type TargetSubsystem struct {
	ID                 string         `json:"id"`
	Name               string         `json:"name"`
	Type               string         `json:"type"`
	Paths              []string       `json:"paths"`
	Note               string         `json:"note,omitempty"`
	UnplacedBudget     int            `json:"unplacedBudget,omitempty"`
	UnplacedBudgetNote string         `json:"unplacedBudgetNote,omitempty"`
	Domains            []TargetDomain `json:"domains,omitempty"`
}

// Assignment 例外文件的显式归属，优先级高于 paths 规则。
type Assignment struct {
	Path      string `json:"path"`
	Subsystem string `json:"subsystem"`
}

// Contract 一个允许的跨域依赖方向 from → to。
// Entries：允许 call 边进入的 to 域容器 Label 清单（pkg.Receiver 规范形）。
// Interfaces：允许 to 域跨域实现的 from 域接口节点 Name 清单（回调契约面）。
// LegacyBudget：不走声明入口的存量直调边上限；缺省 0 = 硬拦（与缺失同义，spec §4）。
type Contract struct {
	From         string   `json:"from"`
	To           string   `json:"to"`
	Entries      []string `json:"entries,omitempty"`
	Interfaces   []string `json:"interfaces,omitempty"`
	LegacyBudget int      `json:"legacyBudget,omitempty"`
	// LegacyBudgetNote 非空表示「本契约的预算上涨是有意为之」，棘轮判据据此由
	// fail 降为 warn（契约 §2-2）。它只影响棘轮一条判据，不影响 over-budget
	// （实际 > 预算）的既有执法。
	LegacyBudgetNote string `json:"legacyBudgetNote,omitempty"`
}

// Target 是 codegraph/target.json 的顶层结构：事前基准。
type Target struct {
	Meta        TargetMeta        `json:"meta"`
	Subsystems  []TargetSubsystem `json:"subsystems"`
	Assignments []Assignment      `json:"assignments,omitempty"`
	Assembly    []string          `json:"assembly,omitempty"`
	Contracts   []Contract        `json:"contracts,omitempty"`
}

// LoadTarget 读取 repoRoot/codegraph/target.json。
// 文件缺失或解析失败都是显式错误——check 的调用方绝不允许把「无基准」
// 当「通过」（spec §5 反静默约定）。
func LoadTarget(repoRoot string) (*Target, error) {
	p := filepath.Join(repoRoot, "codegraph", "target.json")
	raw, err := os.ReadFile(p)
	if err != nil {
		return nil, fmt.Errorf("加载目标图 %s: %w", p, err)
	}
	var t Target
	if err := json.Unmarshal(raw, &t); err != nil {
		return nil, fmt.Errorf("解析目标图 %s: %w", p, err)
	}
	if t.Meta.Version != 2 {
		return nil, fmt.Errorf("目标图 %s 使用不支持的 schema version %d；请先运行 codegraph migrate", p, t.Meta.Version)
	}
	return &t, nil
}

// targetPrefixRuleSuffix 是「目录子树」规则的唯一后缀字面量。归域规则只有精确路径与
// dir/** 两种形态，这个后缀是区分它们的全部依据；它必须只有一处定义，否则收紧或放宽
// 约定时漏改一处不会有任何测试变红。
const targetPrefixRuleSuffix = "/**"

// cutTargetRule 解析一条归域规则的形态，是上述后缀约定的唯一实现。
//
// 参数：rule 为一条 paths 规则（未必已通过 validPathRule）。
// 返回：isPrefixRule 为 true 时 prefix 是去掉 "/**" 后的目录名（不含尾部斜杠），
// 调用方须自行按「目录整段」语义拼回分隔符；为 false 时 rule 是精确路径，prefix
// 原样返回。
//
// 注意：本函数只管**形态解析**，不做任何匹配判定。四个调用点（SubsystemOf、
// targetRuleMatchesFile、targetPathCovers、targetPathsOverlap）的判定语义各不相同，
// 共享的只有这一层解析。
func cutTargetRule(rule string) (prefix string, isPrefixRule bool) {
	return strings.CutSuffix(rule, targetPrefixRuleSuffix)
}

// validPathRule 判断归域规则语法：精确路径或 "dir/**" 前缀，仅此两种（spec §4）。
func validPathRule(rule string) bool {
	if rule == "" || strings.ContainsAny(rule, "[]?{}") {
		return false
	}
	// "dir/**" 之外不允许出现 *；裸 "**" 会把整个仓库圈进一个域，禁止。
	if strings.Contains(rule, "*") {
		prefix, isPrefixRule := cutTargetRule(rule)
		return isPrefixRule && !strings.Contains(prefix, "*")
	}
	return true
}

// targetPathCovers 判断 parent 的精确路径/dir/** 集合是否覆盖 child。
// 两个入参都必须已通过 validPathRule——本函数只认「精确路径」和「dir/**」两种字面
// 形态，不做 glob 匹配，因为归域规则本身就只有这两种（契约 §2-1 第 4 条）。
func targetPathCovers(parent, child string) bool {
	parentPrefix, parentIsPrefix := cutTargetRule(parent)
	childPrefix, childIsPrefix := cutTargetRule(child)
	if !parentIsPrefix {
		// 精确路径只覆盖同一个文件；它盖不住任何目录子树。
		return !childIsPrefix && parent == child
	}
	if childIsPrefix {
		return childPrefix == parentPrefix || strings.HasPrefix(childPrefix, parentPrefix+"/")
	}
	return strings.HasPrefix(child, parentPrefix+"/")
}

// targetPathsOverlap 判断两条已通过语法校验的规则是否拥有共同文件。
// 同样只处理精确路径与 dir/** 两种字面形态：两条精确路径除非相等否则永不相交，
// 前缀规则之间则看目录是否互为祖先（契约 §2-1 第 6 条）。
func targetPathsOverlap(left, right string) bool {
	if left == right {
		return true
	}
	leftPrefix, leftIsPrefix := cutTargetRule(left)
	rightPrefix, rightIsPrefix := cutTargetRule(right)
	if !leftIsPrefix && !rightIsPrefix {
		return false
	}
	if !leftIsPrefix {
		return strings.HasPrefix(left, rightPrefix+"/")
	}
	if !rightIsPrefix {
		return strings.HasPrefix(right, leftPrefix+"/")
	}
	return leftPrefix == rightPrefix ||
		strings.HasPrefix(leftPrefix, rightPrefix+"/") ||
		strings.HasPrefix(rightPrefix, leftPrefix+"/")
}

// ValidateTarget 校验目标图内部一致性，返回问题清单（空 = 合法）。
// 目标领域部分只做结构不变式（契约 §3-2）：id 全局唯一、responsibility 非空、
// 路径语法合法且被父子系统覆盖、同级不重叠、预算非负。它不读 baseline、不读视图、
// 不碰文件系统——「目标域在当前代码里有没有命中」是 Check 的事，不是结构门的事。
func ValidateTarget(t *Target) []string {
	var issues []string
	ids := make(map[string]bool, len(t.Subsystems))
	// 目标领域 id 的唯一性是整个文档级的（契约 §2-1 第 2 条），所以计数器必须
	// 活在子系统循环之外。
	domainIDs := make(map[string]bool)
	for _, d := range t.Subsystems {
		if ids[d.ID] {
			issues = append(issues, fmt.Sprintf("子系统 id %q 重复", d.ID))
		}
		ids[d.ID] = true
		if d.Type != "logic" && d.Type != "boundary" {
			issues = append(issues, fmt.Sprintf("子系统 %s 的 type 取值非法: %q（只认 logic/boundary）", d.ID, d.Type))
		}
		var subsystemRules []string
		for _, p := range d.Paths {
			if !validPathRule(p) {
				issues = append(issues, fmt.Sprintf("子系统 %s 的 paths 规则 %q 语法非法（只支持精确路径或 dir/**）", d.ID, p))
				continue
			}
			subsystemRules = append(subsystemRules, p)
		}
		if d.UnplacedBudget < 0 {
			issues = append(issues, fmt.Sprintf("子系统 %s 的 unplacedBudget 不能为负", d.ID))
		}
		// legalRules[i] 是第 i 个目标领域里语法合法的规则；重叠检查只在这些规则
		// 之间做——对语法已经非法的规则再报一次「覆盖/重叠」是噪声，只会让人去修
		// 一个由语法错误派生出来的假问题。
		legalRules := make([][]string, len(d.Domains))
		for i, domain := range d.Domains {
			if domainIDs[domain.ID] {
				issues = append(issues, fmt.Sprintf("目标领域 id %q 重复（子系统 %s）", domain.ID, d.ID))
			}
			domainIDs[domain.ID] = true
			if strings.TrimSpace(domain.Responsibility) == "" {
				issues = append(issues, fmt.Sprintf("子系统 %s 的目标领域 %s 缺 responsibility（不能为空白）", d.ID, domain.ID))
			}
			for _, rule := range domain.Paths {
				if !validPathRule(rule) {
					issues = append(issues, fmt.Sprintf("子系统 %s 的目标领域 %s 的 paths 规则 %q 语法非法（只支持精确路径或 dir/**）", d.ID, domain.ID, rule))
					continue
				}
				legalRules[i] = append(legalRules[i], rule)
				covered := false
				for _, parent := range subsystemRules {
					if targetPathCovers(parent, rule) {
						covered = true
						break
					}
				}
				if !covered {
					issues = append(issues, fmt.Sprintf("子系统 %s 的目标领域 %s 的 paths 规则 %q 未被子系统 paths %v 覆盖", d.ID, domain.ID, rule, subsystemRules))
				}
			}
		}
		for i := range d.Domains {
			for j := i + 1; j < len(d.Domains); j++ {
				for _, left := range legalRules[i] {
					for _, right := range legalRules[j] {
						if targetPathsOverlap(left, right) {
							issues = append(issues, fmt.Sprintf("子系统 %s 的目标领域 %s 与 %s 的 paths 规则 %q 与 %q 重叠",
								d.ID, d.Domains[i].ID, d.Domains[j].ID, left, right))
						}
					}
				}
			}
		}
	}
	for _, a := range t.Assignments {
		if !ids[a.Subsystem] {
			issues = append(issues, fmt.Sprintf("assignments %s 指向不存在的子系统 %q", a.Path, a.Subsystem))
		}
	}
	for _, c := range t.Contracts {
		for _, ref := range []string{c.From, c.To} {
			if !ids[ref] {
				issues = append(issues, fmt.Sprintf("契约 %s→%s 引用不存在的子系统 %q", c.From, c.To, ref))
			}
		}
		if c.LegacyBudget < 0 {
			issues = append(issues, fmt.Sprintf("契约 %s→%s 的 legacyBudget 不能为负", c.From, c.To))
		}
	}
	return issues
}

// SubsystemOf 返回 file 的归属子系统 id，"" 表示图外。
// 三级优先：assignments 精确指派 > 子系统 paths 规则 > 图外（spec §4）。
// file 与规则都是 '/' 分隔的仓内相对路径——图数据即此形态，不做 filepath 转换。
func (t *Target) SubsystemOf(file string) string {
	for _, a := range t.Assignments {
		if a.Path == file {
			return a.Subsystem
		}
	}
	for _, d := range t.Subsystems {
		for _, rule := range d.Paths {
			if rule == file {
				return d.ID
			}
			if prefix, ok := cutTargetRule(rule); ok && strings.HasPrefix(file, prefix+"/") {
				return d.ID
			}
		}
	}
	return ""
}

// targetRuleMatchesFile 判断文件是否命中精确路径或 dir/** 规则。
// 该谓词暂由 dead-rule 对账使用；dead-rule 与 ruleHitsAny 在 T6 一并删除，
// 路径规则族则在 T7 的一次性瘦身中退场。
func targetRuleMatchesFile(file, rule string) bool {
	if file == rule {
		return true
	}
	prefix, ok := cutTargetRule(rule)
	return ok && strings.HasPrefix(file, prefix+"/")
}
