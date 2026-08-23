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

// TargetSubsystem 一个声明的子系统。Type 二选一：logic / boundary（分区协议的类型标注）。
type TargetSubsystem struct {
	ID    string   `json:"id"`
	Name  string   `json:"name"`
	Type  string   `json:"type"`
	Paths []string `json:"paths"`
	Note  string   `json:"note,omitempty"`
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

// validPathRule 判断归域规则语法：精确路径或 "dir/**" 前缀，仅此两种（spec §4）。
func validPathRule(rule string) bool {
	if rule == "" || strings.ContainsAny(rule, "[]?{}") {
		return false
	}
	// "dir/**" 之外不允许出现 *；裸 "**" 会把整个仓库圈进一个域，禁止。
	if i := strings.Index(rule, "*"); i >= 0 {
		return strings.HasSuffix(rule, "/**") && !strings.Contains(strings.TrimSuffix(rule, "/**"), "*")
	}
	return true
}

// ValidateTarget 校验目标图内部一致性，返回问题清单（空 = 合法）。
func ValidateTarget(t *Target) []string {
	var issues []string
	ids := make(map[string]bool, len(t.Subsystems))
	for _, d := range t.Subsystems {
		if ids[d.ID] {
			issues = append(issues, fmt.Sprintf("子系统 id %q 重复", d.ID))
		}
		ids[d.ID] = true
		if d.Type != "logic" && d.Type != "boundary" {
			issues = append(issues, fmt.Sprintf("子系统 %s 的 type 取值非法: %q（只认 logic/boundary）", d.ID, d.Type))
		}
		for _, p := range d.Paths {
			if !validPathRule(p) {
				issues = append(issues, fmt.Sprintf("子系统 %s 的 paths 规则 %q 语法非法（只支持精确路径或 dir/**）", d.ID, p))
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
			if prefix, ok := strings.CutSuffix(rule, "/**"); ok && strings.HasPrefix(file, prefix+"/") {
				return d.ID
			}
		}
	}
	return ""
}
