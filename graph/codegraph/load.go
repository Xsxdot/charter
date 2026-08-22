// 本文件实现数据契约文件的加载：baseline、单个 diff、视图列表。
//
// 职责：读文件 + json.Unmarshal + 带路径上下文的错误
// 边界：不校验引用完整性（validate.go 的事）、不合并（merge.go 的事）
package codegraph

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
)

// LoadGraph 读取 repoRoot/codegraph/baseline.json。
// 文件不存在或 JSON 非法时返回带路径的错误——调用方（CLI/agentd）原文透出。
func LoadGraph(repoRoot string) (*Graph, error) {
	p := filepath.Join(repoRoot, "codegraph", "baseline.json")
	raw, err := os.ReadFile(p)
	if err != nil {
		return nil, fmt.Errorf("读取基线 %s: %w", p, err)
	}
	var g Graph
	if err := json.Unmarshal(raw, &g); err != nil {
		return nil, fmt.Errorf("解析基线 %s: %w", p, err)
	}
	return &g, nil
}

const maxListedViews = 20

// LoadDiff 读取 repoRoot/codegraph/diffs/<view>.json。view 是文件名（不含 .json）。
// 文件名不存在时，兼容按 diff 内 view 字段查找，供 branch:x 这类语义标识使用。
func LoadDiff(repoRoot, view string) (*Diff, error) {
	p := filepath.Join(repoRoot, "codegraph", "diffs", view+".json")
	raw, err := os.ReadFile(p)
	if err == nil {
		return parseDiff(p, raw)
	}
	if !os.IsNotExist(err) {
		return nil, fmt.Errorf("读取视图 %s: %w", p, err)
	}

	views, err := ListViews(repoRoot)
	if err != nil {
		return nil, err
	}
	var matches []struct {
		name string
		diff *Diff
	}
	for _, name := range views {
		candidate := filepath.Join(repoRoot, "codegraph", "diffs", name+".json")
		raw, err := os.ReadFile(candidate)
		if err != nil {
			if os.IsNotExist(err) {
				continue
			}
			return nil, fmt.Errorf("读取视图 %s: %w", candidate, err)
		}
		d, err := parseDiff(candidate, raw)
		if err != nil {
			return nil, err
		}
		if d.View == view {
			matches = append(matches, struct {
				name string
				diff *Diff
			}{name: name, diff: d})
		}
	}

	switch len(matches) {
	case 1:
		matches[0].diff.loadNotice = fmt.Sprintf("视图 %s 按 view 字段匹配到文件 %s", view, matches[0].name)
		return matches[0].diff, nil
	case 0:
		return nil, fmt.Errorf("视图 %s 不存在；可用视图：%s", view, formatAvailableViews(views))
	default:
		candidates := make([]string, 0, len(matches))
		for _, match := range matches {
			candidates = append(candidates, match.name)
		}
		return nil, fmt.Errorf("视图 %s 按 view 字段匹配到多个文件：%v", view, candidates)
	}
}

func parseDiff(path string, raw []byte) (*Diff, error) {
	var d Diff
	if err := json.Unmarshal(raw, &d); err != nil {
		return nil, fmt.Errorf("解析视图 %s: %w", path, err)
	}
	return &d, nil
}

func formatAvailableViews(views []string) string {
	if len(views) <= maxListedViews {
		return fmt.Sprintf("%v", views)
	}
	return fmt.Sprintf("%v（共 %d 个，已截断）", views[:maxListedViews], len(views))
}

// LoadNotice 返回 LoadDiff 按 view 字段回退命中时的提示，供 CLI 输出到 stderr。
// 该信息不属于 diff JSON 数据契约。
func (d *Diff) LoadNotice() string {
	if d == nil {
		return ""
	}
	return d.loadNotice
}

// ListViews 列出 diffs 目录下的视图名（文件名去 .json，字典序）。
// 目录不存在返回空列表——大多数仓库只有基线，这不是错误。
func ListViews(repoRoot string) ([]string, error) {
	dir := filepath.Join(repoRoot, "codegraph", "diffs")
	ents, err := os.ReadDir(dir)
	if os.IsNotExist(err) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("列视图目录 %s: %w", dir, err)
	}
	var out []string
	for _, e := range ents {
		if !e.IsDir() && strings.HasSuffix(e.Name(), ".json") {
			out = append(out, strings.TrimSuffix(e.Name(), ".json"))
		}
	}
	sort.Strings(out)
	return out, nil
}
