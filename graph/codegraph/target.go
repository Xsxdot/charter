// 本文件实现 target.json 的模型、加载与最小结构校验。
//
// target 只保留当前契约与组装点；容器归属由 best.json 承担，路径规则与旧归属
// resolver 不再属于执法路径。
package codegraph

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
)

// TargetMeta 目标图来源信息。
type TargetMeta struct {
	Version int    `json:"version"`
	Project string `json:"project"`
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

// Target 是 codegraph/target.json 的顶层结构：当前契约基准。
type Target struct {
	Meta      TargetMeta `json:"meta"`
	Assembly  []string   `json:"assembly,omitempty"`
	Contracts []Contract `json:"contracts,omitempty"`
}

// LoadTarget 读取 repoRoot/codegraph/target.json。
// 文件缺失或解析失败都是显式错误；旧版本必须先通过 migrate，并准备 baseline.json。
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
	if t.Meta.Version != 3 {
		return nil, fmt.Errorf("目标图 %s 使用不支持的 schema version %d；请先准备 baseline.json 并运行 codegraph migrate", p, t.Meta.Version)
	}
	return &t, nil
}

// ValidateTarget 只校验仍由 target 承担的契约预算结构。
// 领域与容器引用完整性已经下沉到 Best，不在这里重复执法。
func ValidateTarget(t *Target) []string {
	var issues []string
	for _, c := range t.Contracts {
		if c.LegacyBudget < 0 {
			issues = append(issues, fmt.Sprintf("契约 %s→%s 的 legacyBudget 不能为负", c.From, c.To))
		}
	}
	return issues
}
