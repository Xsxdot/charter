package codegraph

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestLoadDomainDecls(t *testing.T) {
	repo := t.TempDir()
	dir := filepath.Join(repo, "codegraph", "domains")
	if err := os.MkdirAll(dir, 0o755); err != nil {
		t.Fatal(err)
	}
	valid := DomainDecl{Domain: "d_cli", Responsibility: "命令入口"}
	raw, err := json.Marshal(valid)
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "d_cli.json"), raw, 0o644); err != nil {
		t.Fatal(err)
	}
	decls, err := LoadDomainDecls(repo)
	if err != nil || len(decls) != 1 || decls["d_cli"].Responsibility != "命令入口" {
		t.Fatalf("声明加载: decls=%v err=%v", decls, err)
	}

	cases := []struct {
		name string
		file string
		raw  string
	}{
		{"文件名不匹配", "wrong.json", `{"domain":"d_cli","responsibility":"x"}`},
		{"职责为空", "empty.json", `{"domain":"empty","responsibility":" "}`},
		{"JSON 非法", "bad.json", `{`},
		{"斜杠领域不可平铺声明", "d_svc_api.json", `{"domain":"d_svc/api","responsibility":"x"}`},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if err := os.WriteFile(filepath.Join(dir, tc.file), []byte(tc.raw), 0o644); err != nil {
				t.Fatal(err)
			}
			if _, err := LoadDomainDecls(repo); err == nil {
				t.Fatal("非法声明应报错")
			}
			if err := os.Remove(filepath.Join(dir, tc.file)); err != nil {
				t.Fatal(err)
			}
		})
	}

	missing := t.TempDir()
	decls, err = LoadDomainDecls(missing)
	if err != nil || len(decls) != 0 {
		t.Fatalf("声明目录缺失应为空 map: decls=%v err=%v", decls, err)
	}
}

func TestValidateDecls(t *testing.T) {
	v, repo := loadFixtureView(t)
	best, err := LoadBest(repo)
	if err != nil || best == nil {
		t.Fatalf("加载 fixture best: best=%v err=%v", best, err)
	}
	valid := map[string]DomainDecl{
		"d_cmd": {
			Domain: "d_cmd", Responsibility: "命令入口",
			Invariants:   []Invariant{{Text: "入口可执行", TestRef: "TestRunE"}},
			Lifecycle:    &DeclAnchor{From: "cmd/run.go#runE", To: "cmd/run.go#runE"},
			StateMachine: []Transition{{From: "ready", To: "running", Anchor: "cmd/run.go#runE"}},
		},
	}
	if issues := ValidateDecls(v, best, repo, valid); len(issues) != 0 {
		t.Fatalf("完整声明应通过: %v", issues)
	}
	if issues := ValidateDecls(v, best, repo, map[string]DomainDecl{
		"d_cli": {Domain: "d_cli", Responsibility: "旧现状词表"},
	}); len(issues) == 0 || !strings.Contains(strings.Join(issues, "\n"), "d_cli") {
		t.Fatalf("baseline-only 声明必须按 best 词表报领域 id: %v", issues)
	}
	if issues := ValidateDecls(v, nil, repo, valid); len(issues) == 0 || !strings.Contains(strings.Join(issues, "\n"), "d_cmd") || !strings.Contains(strings.Join(issues, "\n"), "无法在 best 词表校验") {
		t.Fatalf("best nil 必须安全产生可见 issue: %v", issues)
	}

	moved := *v
	moved.Nodes = make(map[string]ViewNode, len(v.Nodes))
	for id, node := range v.Nodes {
		moved.Nodes[id] = node
	}
	n := moved.Nodes["n_runE"]
	n.Line = 1
	moved.Nodes["n_runE"] = n
	if issues := ValidateDecls(&moved, best, repo, map[string]DomainDecl{
		"d_cmd": {Domain: "d_cmd", Responsibility: "x", Lifecycle: &DeclAnchor{From: "cmd/run.go#runE", To: "cmd/run.go#runE"}},
	}); len(issues) != 0 {
		t.Fatalf("moved 锚仍然存活，不应报错: %v", issues)
	}

	bad := map[string]DomainDecl{
		"d_missing": {Domain: "d_missing", Responsibility: "x"},
		"d_cmd": {
			Domain: "d_cmd", Responsibility: "x",
			Lifecycle:  &DeclAnchor{From: "svc/server.go#Gone", To: "missing.go#Gone"},
			Invariants: []Invariant{{Text: "x", TestRef: "TestNoSuchTest"}},
		},
	}
	issues := ValidateDecls(v, best, repo, bad)
	for _, want := range []string{"d_missing", "vanished", "file_missing", "TestNoSuchTest"} {
		found := false
		for _, issue := range issues {
			if strings.Contains(issue, want) {
				found = true
			}
		}
		if !found {
			t.Errorf("声明问题缺少 %q: %v", want, issues)
		}
	}

	commentRepo := t.TempDir()
	commentOnly := filepath.Join(commentRepo, "comment_test.go")
	if err := os.WriteFile(commentOnly, []byte("package comment\n// func TestCommentOnly(t *testing.T) {}\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	issues = ValidateDecls(v, best, commentRepo, map[string]DomainDecl{
		"d_cmd": {Domain: "d_cmd", Responsibility: "x", Invariants: []Invariant{{Text: "x", TestRef: "TestCommentOnly"}}},
	})
	if len(issues) == 0 || !strings.Contains(strings.Join(issues, "\n"), "TestCommentOnly") {
		t.Fatalf("注释中的同名测试不得算存在: %v", issues)
	}
}
