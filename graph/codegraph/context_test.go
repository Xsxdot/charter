package codegraph

import (
	"strings"
	"testing"
)

func TestAssembleContextDeclaredAndUndeclared(t *testing.T) {
	g, err := LoadGraph("testdata/repo")
	if err != nil {
		t.Fatal(err)
	}
	v := Merge(g, nil)
	declared, err := AssembleContext(v, g, "testdata/repo", "d_cli", QueryOptions{})
	if err != nil {
		t.Fatal(err)
	}
	if declared.Domain.ID != "d_cli" || declared.Declaration == nil || declared.Chain == nil {
		t.Fatalf("declared context=%+v", declared)
	}
	if !strings.Contains(declared.Warning, "未分种") {
		t.Fatalf("fixture modelKind 全空时应有未分种 warning=%q", declared.Warning)
	}
	undeclared, err := AssembleContext(v, g, "testdata/repo", "d_svc", QueryOptions{})
	if err != nil {
		t.Fatal(err)
	}
	if undeclared.Declaration != nil || !strings.Contains(undeclared.Warning, "codegraph/domains/d_svc.json") || undeclared.Chain == nil {
		t.Fatalf("undeclared context=%+v", undeclared)
	}
}

func TestAssembleContextBestOnlyErrorAndParentBoundary(t *testing.T) {
	g, err := LoadGraph("testdata/repo")
	if err != nil {
		t.Fatal(err)
	}
	v := Merge(g, nil)
	if _, err := AssembleContext(v, g, "testdata/repo", "d_orchestration", QueryOptions{}); err == nil || !strings.Contains(err.Error(), "现状视图词表") {
		t.Fatalf("best-only error=%v", err)
	}
	parent, err := AssembleContext(v, g, "testdata/repo", "d_svc", QueryOptions{})
	if err != nil {
		t.Fatal(err)
	}
	if len(parent.Interfaces) != 1 || parent.Interfaces[0].ID != "n_runE" {
		t.Fatalf("parent boundary interfaces=%+v", parent.Interfaces)
	}
	if len(parent.Entities) != 0 {
		t.Fatalf("untyped fixture models must not become entities: %+v", parent.Entities)
	}
}

func TestAssembleContextFocusQuota(t *testing.T) {
	domains := map[string]Domain{"d_ctx": {Label: "context"}}
	containers := map[string]Container{}
	nodes := map[string]ViewNode{}
	for i := 0; i < 6; i++ {
		id := "e_" + string(rune('a'+i))
		container := "c_" + id
		containers[container] = Container{Domain: "d_ctx", Entry: true}
		nodes[id] = ViewNode{Node: Node{Kind: "entry", Container: container, Name: id}}
	}
	v := &View{Name: "baseline", Domains: domains, Containers: containers, Nodes: nodes}
	g := &Graph{Domains: domains, Containers: map[string]Container{}, Nodes: map[string]Node{}}
	for id, n := range nodes {
		g.Nodes[id] = n.Node
	}
	result, err := AssembleContext(v, g, "testdata/repo", "d_ctx", QueryOptions{})
	if err != nil {
		t.Fatal(err)
	}
	if result.FociTruncated == nil || result.FociTruncated.Total != 6 || result.FociTruncated.Shown != 5 || result.FociTruncated.Reason != "focus-quota" {
		t.Fatalf("focus quota=%+v", result.FociTruncated)
	}
}
