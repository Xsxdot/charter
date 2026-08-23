package codegraph

import (
	"fmt"
	"strings"
	"testing"
)

func viewWithFiles(files ...string) *View {
	v := &View{Containers: map[string]Container{}, Nodes: map[string]ViewNode{}}
	for i, file := range files {
		id := fmt.Sprintf("n_%03d", i)
		container := fmt.Sprintf("c_%03d", i)
		v.Containers[container] = Container{Label: container}
		v.Nodes[id] = ViewNode{Node: Node{Container: container, Name: id, File: file}}
	}
	return v
}

func TestPrefixFamilyFindings(t *testing.T) {
	cases := []struct {
		name     string
		files    []string
		want     bool
		wantText string
		unwanted string
	}{
		{
			name:     "六个同目录文件共享前五字符",
			files:    []string{"internal/agentd/worksA.go", "internal/agentd/worksB.go", "internal/agentd/worksC.go", "internal/agentd/worksD.go", "internal/agentd/worksE.go", "internal/agentd/worksF.go"},
			want:     true,
			wantText: `"works"`,
		},
		{
			name:  "四个成员不足阈值",
			files: []string{"pkg/workA.go", "pkg/workB.go", "pkg/workC.go", "pkg/workD.go"},
		},
		{
			name:     "只共享前三字符",
			files:    []string{"pkg/useA.go", "pkg/useB.go", "pkg/useC.go", "pkg/useD.go", "pkg/useE.go"},
			unwanted: `prefix-family`,
		},
		{
			name:  "跨目录不成一族",
			files: []string{"pkg/worksA.go", "pkg/worksB.go", "pkg/worksC.go", "other/worksD.go", "other/worksE.go"},
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			findings := prefixFamilyFindings(viewWithFiles(tc.files...))
			if tc.want && len(findings) != 1 {
				t.Fatalf("应命中一条 prefix-family: %+v", findings)
			}
			if !tc.want && len(findings) != 0 {
				t.Fatalf("不应命中 prefix-family: %+v", findings)
			}
			if tc.wantText != "" && !strings.Contains(findings[0].Detail, tc.wantText) {
				t.Fatalf("Detail 应包含真实最长公共前缀 %s: %s", tc.wantText, findings[0].Detail)
			}
			if tc.unwanted != "" {
				for _, f := range findings {
					if f.Kind == tc.unwanted {
						t.Fatalf("不应出现 %s: %+v", tc.unwanted, findings)
					}
				}
			}
		})
	}
}

func TestOversizedPackageFindings(t *testing.T) {
	files := func(n int, prefix string) []string {
		out := make([]string, 0, n)
		for i := 0; i < n; i++ {
			out = append(out, fmt.Sprintf("%s/file%02d.go", prefix, i))
		}
		return out
	}
	t.Run("四十个文件无子目录命中", func(t *testing.T) {
		findings := oversizedPackageFindings(viewWithFiles(files(40, "internal/agentd")...))
		if len(findings) != 1 || !strings.Contains(findings[0].Detail, "internal/agentd") || !strings.Contains(findings[0].Detail, "40") {
			t.Fatalf("应命中 oversized-package 并带目录与数量: %+v", findings)
		}
	})
	t.Run("有子目录不命中", func(t *testing.T) {
		all := files(40, "internal/agentd")
		all = append(all, "internal/agentd/sub/file.go")
		if got := oversizedPackageFindings(viewWithFiles(all...)); len(got) != 0 {
			t.Fatalf("存在更深目录时不应命中: %+v", got)
		}
	})
	t.Run("三十九个文件不命中", func(t *testing.T) {
		if got := oversizedPackageFindings(viewWithFiles(files(39, "internal/agentd")...)); len(got) != 0 {
			t.Fatalf("三十九个文件不应命中: %+v", got)
		}
	})
}

func TestFitnessFindingsAreWarnings(t *testing.T) {
	files := []string{"pkg/worksA.go", "pkg/worksB.go", "pkg/worksC.go", "pkg/worksD.go", "pkg/worksE.go"}
	for i := 0; i < 40; i++ {
		files = append(files, fmt.Sprintf("large/file%02d.go", i))
	}
	rep := Check(&Target{}, viewWithFiles(files...))
	if !hasFinding(rep.Warns, KindPrefixFamily) || !hasFinding(rep.Warns, KindOversizedPackage) {
		t.Fatalf("两类 fitness finding 都应进 warns: %+v", rep)
	}
	if hasFinding(rep.Fails, KindPrefixFamily) || hasFinding(rep.Fails, KindOversizedPackage) {
		t.Fatalf("两类 fitness finding 不应进 fails: %+v", rep)
	}
}
