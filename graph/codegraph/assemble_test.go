package codegraph

import (
	"encoding/json"
	"strings"
	"testing"
)

func TestAssembleResultDefaultProjectionAndFull(t *testing.T) {
	v := fixtureView(t)
	raw, err := Neighborhood(v, []string{"e_run"}, -1, 0)
	if err != nil {
		t.Fatal(err)
	}
	compact, err := AssembleResult(v, raw, "testdata/repo", QueryOptions{MaxTokens: 0})
	if err != nil {
		t.Fatal(err)
	}
	if len(compact.Nodes) != len(raw.Nodes) || compact.TokenEstimate.Method != "utf8-json-bytes/3" {
		t.Fatalf("compact result=%+v", compact)
	}
	for _, item := range compact.Nodes {
		if item.Node == nil {
			t.Fatalf("default item is not node: %+v", item)
		}
		if item.Node.Params != nil || item.Node.Returns != "" || item.Node.Tests != nil || item.Node.Fields != nil {
			t.Fatalf("default projection leaked full fields: %+v", item.Node)
		}
	}
	full, err := AssembleResult(v, raw, "testdata/repo", QueryOptions{Full: true, MaxTokens: 0})
	if err != nil {
		t.Fatal(err)
	}
	var do *AssembledNode
	for _, item := range full.Nodes {
		if item.Node != nil && item.Node.ID == "n_do" {
			do = item.Node
		}
	}
	if do == nil || do.Returns != "error" || len(do.Tests) != 1 {
		t.Fatalf("full projection did not restore fields: %+v", do)
	}
	rawJSON, err := json.Marshal(full)
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(rawJSON), "snippet") {
		t.Fatalf("snippet must be removed from wire: %s", rawJSON)
	}
}

func TestAssembleResultSourceAndBudget(t *testing.T) {
	v := fixtureView(t)
	raw, err := Neighborhood(v, []string{"e_run"}, 1, 0)
	if err != nil {
		t.Fatal(err)
	}
	result, err := AssembleResult(v, raw, "testdata/repo", QueryOptions{WithSource: true, SourceSpan: 1})
	if err != nil {
		t.Fatal(err)
	}
	if result.Nodes[0].Node == nil || result.Nodes[0].Node.Source == nil || len(result.Nodes[0].Node.Source.Lines) != 1 {
		t.Fatalf("source window=%+v", result.Nodes[0])
	}
	limited, err := AssembleResult(v, raw, "testdata/repo", QueryOptions{MaxTokens: 1})
	if err != nil {
		t.Fatal(err)
	}
	if limited.Truncated == nil || limited.Truncated.Reason != "max-tokens" || limited.Truncated.DroppedNodes == 0 {
		t.Fatalf("budget truncation=%+v", limited)
	}
	if limited.TokenEstimate.Value <= 0 || !limited.TokenEstimate.Approximate {
		t.Fatalf("token estimate=%+v", limited.TokenEstimate)
	}
}

func TestAssembleResultFullPreservesSource(t *testing.T) {
	v := fixtureView(t)
	raw, err := Neighborhood(v, []string{"e_run"}, 1, 0)
	if err != nil {
		t.Fatal(err)
	}
	result, err := AssembleResult(v, raw, "testdata/repo", QueryOptions{Full: true, WithSource: true, SourceSpan: 1})
	if err != nil {
		t.Fatal(err)
	}
	if result.Nodes[0].Node == nil || result.Nodes[0].Node.Source == nil {
		t.Fatalf("full must not disable source: %+v", result.Nodes[0])
	}
}

func TestAssembleResultSharedUtilNeedsThreeDomains(t *testing.T) {
	v := &View{
		Containers: map[string]Container{
			"a": {Domain: "d_a"}, "b": {Domain: "d_b"}, "target": {Domain: "d_t"},
		},
		Nodes: map[string]ViewNode{
			"a":      {Node: Node{Kind: "func", Container: "a", Name: "A"}},
			"b":      {Node: Node{Kind: "func", Container: "b", Name: "B"}},
			"target": {Node: Node{Kind: "func", Container: "target", Name: "Target"}},
		},
		Edges: []ViewEdge{{From: "a", To: "target"}, {From: "b", To: "target"}},
	}
	raw := &Result{View: "baseline", Foci: []string{"target"}, Nodes: []ResultNode{
		{ID: "target", Dist: 0, ViewNode: v.Nodes["target"]},
		{ID: "a", Dist: -1, ViewNode: v.Nodes["a"]},
		{ID: "b", Dist: -1, ViewNode: v.Nodes["b"]},
	}}
	result, err := AssembleResult(v, raw, "", QueryOptions{CollapseUtil: true})
	if err != nil {
		t.Fatal(err)
	}
	for _, item := range result.Nodes {
		if item.Node != nil && item.Node.ID == "target" && item.Node.SharedBy != 0 {
			t.Fatalf("two caller domains must not trigger shared util: %+v", item.Node)
		}
	}
}

func TestAssembledItemJSONUnion(t *testing.T) {
	node, err := json.Marshal(AssembledItem{Node: &AssembledNode{ID: "n", Dist: 0, Domain: "d"}})
	if err != nil || !strings.Contains(string(node), `"id":"n"`) {
		t.Fatalf("node json=%s err=%v", node, err)
	}
	external, err := json.Marshal(AssembledItem{External: &ExternalDomain{Domain: "d", Count: 2, Representatives: []AssembledNode{{ID: "n"}}}})
	if err != nil || !strings.Contains(string(external), `"count":2`) {
		t.Fatalf("external json=%s err=%v", external, err)
	}
	if _, err := json.Marshal(AssembledItem{}); err == nil {
		t.Fatal("empty union must fail")
	}
}

func TestRefSnippetWireRemoval(t *testing.T) {
	var ref TestRef
	if err := json.Unmarshal([]byte(`{"name":"TestDo","file":"x_test.go:1","snippet":"assert"}`), &ref); err != nil {
		t.Fatal(err)
	}
	raw, err := json.Marshal(ref)
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(raw), "snippet") {
		t.Fatalf("legacy snippet must be ignored on output: %s", raw)
	}
}
