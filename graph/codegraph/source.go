// 本文件负责从本地源码读取以 1-based 行号为锚点的源码窗口。
// 边界：只读文件，不修改图；调用方负责决定是否把读取失败保留为 warning。
package codegraph

import (
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"strings"
)

type sourceFileCache map[string]sourceFileEntry

type sourceFileEntry struct {
	lines []string
	err   error
}

// ExtractSourceWindow reads a bounded 1-based window around an already anchored line.
// Missing, empty, or invalid files return an error; callers decide whether to warn or fail.
func ExtractSourceWindow(repoRoot string, n Node, anchoredLine, span int) (*SourceWindow, error) {
	if span < 1 || span > MaxSourceSpan {
		return nil, fmt.Errorf("source span %d out of range 1..%d", span, MaxSourceSpan)
	}
	if n.File == "" {
		return nil, fmt.Errorf("source file is empty for %s", n.Name)
	}
	lines, err := readSourceLines(repoRoot, n.File)
	if err != nil {
		slog.Default().Warn("source file read failed", "file", n.File, "line", anchoredLine, "error", err)
		return nil, err
	}
	return sourceWindowFromLines(lines, anchoredLine, span)
}

func (c sourceFileCache) window(repoRoot string, n Node, anchoredLine, span int) (*SourceWindow, error) {
	entry, ok := c[n.File]
	if !ok {
		entry.lines, entry.err = readSourceLines(repoRoot, n.File)
		c[n.File] = entry
	}
	if entry.err != nil {
		return nil, entry.err
	}
	return sourceWindowFromLines(entry.lines, anchoredLine, span)
}

func readSourceLines(repoRoot, file string) ([]string, error) {
	path := filepath.Join(repoRoot, file)
	raw, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("读取源码 %s: %w", path, err)
	}
	if len(raw) == 0 || strings.TrimSpace(string(raw)) == "" {
		return nil, fmt.Errorf("源码文件 %s 为空", path)
	}
	lines := strings.Split(string(raw), "\n")
	if len(lines) > 1 && lines[len(lines)-1] == "" {
		lines = lines[:len(lines)-1]
	}
	return lines, nil
}

func sourceWindowFromLines(lines []string, anchoredLine, span int) (*SourceWindow, error) {
	if span < 1 || span > MaxSourceSpan {
		return nil, fmt.Errorf("source span %d out of range 1..%d", span, MaxSourceSpan)
	}
	if len(lines) == 0 {
		return nil, fmt.Errorf("源码文件没有可用行")
	}
	if anchoredLine < 1 {
		anchoredLine = 1
	}
	if anchoredLine > len(lines) {
		anchoredLine = len(lines)
	}
	half := span / 2
	from := anchoredLine - half
	if from < 1 {
		from = 1
	}
	to := from + span - 1
	if to > len(lines) {
		to = len(lines)
		from = to - span + 1
		if from < 1 {
			from = 1
		}
	}
	return &SourceWindow{From: from, Lines: append([]string(nil), lines[from-1:to]...)}, nil
}
