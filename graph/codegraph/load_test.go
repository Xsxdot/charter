// codegraph 加载层测试：夹具仓库读取、diffs 目录发现、坏 JSON 报错带路径。
package codegraph

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestLoadGraph(t *testing.T) {
	g, err := LoadGraph(filepath.Join("testdata", "repo"))
	if err != nil {
		t.Fatalf("LoadGraph: %v", err)
	}
	if g.Meta.Project != "demo" || len(g.Nodes) != 8 || len(g.Edges) != 4 {
		t.Fatalf("解析形状不对: meta=%+v nodes=%d edges=%d", g.Meta, len(g.Nodes), len(g.Edges))
	}
	if !g.Nodes["e_skip"].Unscanned {
		t.Fatal("unscanned 标丢失")
	}
}

func TestLoadGraphMissing(t *testing.T) {
	if _, err := LoadGraph(t.TempDir()); err == nil {
		t.Fatal("无 codegraph/baseline.json 应当报错")
	}
}

func TestLoadDiffByFileName(t *testing.T) {
	views, err := ListViews(filepath.Join("testdata", "repo"))
	if err != nil || len(views) != 1 || views[0] != "branch-x" {
		t.Fatalf("ListViews: %v %v", views, err)
	}
	d, err := LoadDiff(filepath.Join("testdata", "repo"), "branch-x")
	if err != nil {
		t.Fatalf("LoadDiff: %v", err)
	}
	if d.View != "branch:x" || len(d.NodesAdded) != 1 || len(d.NodesDeleted) != 1 {
		t.Fatalf("diff 形状不对: %+v", d)
	}
	if d.NodesModified["n_do"].SignatureOld == "" {
		t.Fatal("signatureOld 丢失")
	}
}

func TestLoadDiffFallsBackToViewField(t *testing.T) {
	repo := t.TempDir()
	writeFixtureBaseline(t, repo)
	writeDiffFixture(t, repo, "branch-x", "branch:x")

	d, err := LoadDiff(repo, "branch:x")
	if err != nil {
		t.Fatalf("按 view 字段回退读取: %v", err)
	}
	if d.View != "branch:x" || d.Summary != "fixture" {
		t.Fatalf("回退读取的 diff 不对: %+v", d)
	}
}

func TestLoadDiffAmbiguousViewField(t *testing.T) {
	repo := t.TempDir()
	writeFixtureBaseline(t, repo)
	writeDiffFixture(t, repo, "branch-a", "branch:x")
	writeDiffFixture(t, repo, "branch-b", "branch:x")

	_, err := LoadDiff(repo, "branch:x")
	if err == nil || !strings.Contains(err.Error(), "branch-a") || !strings.Contains(err.Error(), "branch-b") {
		t.Fatalf("同 view 字段应报歧义并列出文件名: %v", err)
	}
}

func TestLoadDiffUnknownListsAvailable(t *testing.T) {
	repo := t.TempDir()
	writeFixtureBaseline(t, repo)
	writeDiffFixture(t, repo, "branch-x", "branch:x")
	writeDiffFixture(t, repo, "branch-y", "branch:y")

	_, err := LoadDiff(repo, "branch:z")
	if err == nil || !strings.Contains(err.Error(), "可用视图") ||
		!strings.Contains(err.Error(), "branch-x") || !strings.Contains(err.Error(), "branch-y") {
		t.Fatalf("未知视图应指路到可用清单: %v", err)
	}
}

func TestLoadDiffPropagatesNonNotExistError(t *testing.T) {
	repo := t.TempDir()
	writeFixtureBaseline(t, repo)
	path := filepath.Join(repo, "codegraph", "diffs", "branch-x.json")
	if err := os.MkdirAll(path, 0o755); err != nil {
		t.Fatal(err)
	}

	_, err := LoadDiff(repo, "branch-x")
	if err == nil || !strings.Contains(err.Error(), "branch-x.json") || strings.Contains(err.Error(), "可用视图") {
		t.Fatalf("非不存在读取错误应原样走错误路径: %v", err)
	}
}

func TestListViewsEmptyDir(t *testing.T) {
	// 没有 diffs 目录不是错误：返回空列表（大多数仓库只有基线）
	dir := t.TempDir()
	writeFixtureBaseline(t, dir)
	views, err := ListViews(dir)
	if err != nil || len(views) != 0 {
		t.Fatalf("空 diffs 应返回空列表: %v %v", views, err)
	}
}

func writeFixtureBaseline(t *testing.T, dir string) {
	t.Helper()
	graphDir := filepath.Join(dir, "codegraph")
	if err := os.MkdirAll(graphDir, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(graphDir, "baseline.json"), []byte(`{"meta":{},"containers":{},"nodes":{},"edges":[],"diffs":{}}`), 0o644); err != nil {
		t.Fatal(err)
	}
}

func writeDiffFixture(t *testing.T, repo, filename, view string) {
	t.Helper()
	diffsDir := filepath.Join(repo, "codegraph", "diffs")
	if err := os.MkdirAll(diffsDir, 0o755); err != nil {
		t.Fatal(err)
	}
	raw := `{"view":"` + view + `","summary":"fixture"}`
	if err := os.WriteFile(filepath.Join(diffsDir, filename+".json"), []byte(raw), 0o644); err != nil {
		t.Fatal(err)
	}
}
