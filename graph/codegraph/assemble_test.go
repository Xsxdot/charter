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
	full, err := AssembleResult(v, raw, "testdata/repo", QueryOptions{Full: true, FoldExternal: true, CollapseUtil: true, MaxTokens: 0})
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

func TestAssembleResultFullDisablesFolding(t *testing.T) {
	v := fixtureView(t)
	raw, err := Neighborhood(v, []string{"e_run"}, -1, 0)
	if err != nil {
		t.Fatal(err)
	}
	result, err := AssembleResult(v, raw, "testdata/repo", QueryOptions{
		Full:         true,
		FoldExternal: true,
		CollapseUtil: true,
	})
	if err != nil {
		t.Fatal(err)
	}
	got := map[string]bool{}
	for _, item := range result.Nodes {
		if item.External != nil {
			t.Fatalf("full output contains folded external item: %+v", item.External)
		}
		if item.Node == nil {
			t.Fatalf("full output contains non-node item: %+v", item)
		}
		got[item.Node.ID] = true
	}
	if len(got) != len(raw.Nodes) {
		t.Fatalf("full output node count=%d, raw=%d: %+v", len(got), len(raw.Nodes), got)
	}
	for _, rn := range raw.Nodes {
		if !got[rn.ID] {
			t.Fatalf("full output omitted raw node %q", rn.ID)
		}
	}
	wire, err := json.Marshal(result)
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(wire), `"representatives"`) || strings.Contains(string(wire), `"count"`) {
		t.Fatalf("full output contains folded wire shape: %s", wire)
	}
}

func TestAssembleResultFullDisablesSharedUtilityFolding(t *testing.T) {
	v := &View{
		Containers: map[string]Container{
			"caller-a": {Domain: "d_a"}, "caller-b": {Domain: "d_b"}, "caller-c": {Domain: "d_c"},
			"shared": {Domain: "d_shared"}, "child": {Domain: "d_shared"},
		},
		Nodes: map[string]ViewNode{
			"caller-a": {Node: Node{Kind: "func", Container: "caller-a", Name: "CallerA"}},
			"caller-b": {Node: Node{Kind: "func", Container: "caller-b", Name: "CallerB"}},
			"caller-c": {Node: Node{Kind: "func", Container: "caller-c", Name: "CallerC"}},
			"shared":   {Node: Node{Kind: "func", Container: "shared", Name: "Shared"}},
			"child":    {Node: Node{Kind: "func", Container: "child", Name: "Child"}},
		},
		Edges: []ViewEdge{
			{From: "caller-a", To: "shared"}, {From: "caller-b", To: "shared"}, {From: "caller-c", To: "shared"},
			{From: "shared", To: "child"},
		},
	}
	raw := &Result{
		View: "baseline", Foci: []string{"shared"},
		Nodes: []ResultNode{
			{ID: "shared", Dist: 0, ViewNode: v.Nodes["shared"]},
			{ID: "child", Dist: 1, ViewNode: v.Nodes["child"]},
			{ID: "caller-a", Dist: -1, ViewNode: v.Nodes["caller-a"]},
			{ID: "caller-b", Dist: -1, ViewNode: v.Nodes["caller-b"]},
			{ID: "caller-c", Dist: -1, ViewNode: v.Nodes["caller-c"]},
		},
	}
	result, err := AssembleResult(v, raw, "", QueryOptions{Full: true, FoldExternal: true, CollapseUtil: true})
	if err != nil {
		t.Fatal(err)
	}
	got := map[string]bool{}
	for _, item := range result.Nodes {
		if item.External != nil || item.Node == nil {
			t.Fatalf("full output folded shared utility or external nodes: %+v", item)
		}
		got[item.Node.ID] = true
	}
	if len(got) != len(raw.Nodes) {
		t.Fatalf("full output node count=%d, raw=%d: %+v", len(got), len(raw.Nodes), got)
	}
	for _, rn := range raw.Nodes {
		if !got[rn.ID] {
			t.Fatalf("full output omitted raw node %q", rn.ID)
		}
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

func TestAssembleResultSharedUtilityWinsExternalFoldAndRepsHaveNoSource(t *testing.T) {
	v := &View{
		Containers: map[string]Container{
			"focus": {Domain: "d_focus"}, "shared": {Domain: "d_external"},
			"other-a": {Domain: "d_external"}, "other-b": {Domain: "d_external"},
			"caller-a": {Domain: "d_a"}, "caller-b": {Domain: "d_b"}, "caller-c": {Domain: "d_c"},
		},
		Nodes: map[string]ViewNode{
			"focus":    {Node: Node{Kind: "entry", Container: "focus", File: "cmd/run.go", Line: 1}},
			"shared":   {Node: Node{Kind: "func", Container: "shared", Name: "Shared", File: "cmd/run.go", Line: 1}},
			"other-a":  {Node: Node{Kind: "entry", Container: "other-a", File: "cmd/run.go", Line: 1}},
			"other-b":  {Node: Node{Kind: "entry", Container: "other-b", File: "cmd/run.go", Line: 1}},
			"caller-a": {Node: Node{Kind: "func", Container: "caller-a"}},
			"caller-b": {Node: Node{Kind: "func", Container: "caller-b"}},
			"caller-c": {Node: Node{Kind: "func", Container: "caller-c"}},
		},
		Edges: []ViewEdge{
			{From: "caller-a", To: "shared"}, {From: "caller-b", To: "shared"}, {From: "caller-c", To: "shared"},
		},
	}
	raw := &Result{View: "baseline", Foci: []string{"focus"}, Nodes: []ResultNode{
		{ID: "focus", Dist: 0, ViewNode: v.Nodes["focus"]},
		{ID: "shared", Dist: 1, ViewNode: v.Nodes["shared"]},
		{ID: "other-a", Dist: 1, ViewNode: v.Nodes["other-a"]},
		{ID: "other-b", Dist: 1, ViewNode: v.Nodes["other-b"]},
	}}
	result, err := AssembleResult(v, raw, "testdata/repo", QueryOptions{
		FoldExternal: true, CollapseUtil: true, WithSource: true, SourceSpan: 1,
	})
	if err != nil {
		t.Fatal(err)
	}
	var shared *AssembledNode
	var external *ExternalDomain
	for _, item := range result.Nodes {
		if item.Node != nil && item.Node.ID == "shared" {
			shared = item.Node
		}
		if item.External != nil {
			external = item.External
		}
	}
	if shared == nil || shared.SharedBy != 3 || shared.Source == nil {
		t.Fatalf("shared utility must remain an ordinary sourced item: %+v", shared)
	}
	if external == nil || external.Domain != "d_external" || external.Count != 2 || len(external.Representatives) != 2 {
		t.Fatalf("external fold=%+v", external)
	}
	for _, representative := range external.Representatives {
		if representative.Source != nil {
			t.Fatalf("folded representative must not carry source: %+v", representative)
		}
	}
}

func TestAssembleResultKeepsDownstreamWithUncollapsedAlternatePath(t *testing.T) {
	v := &View{
		Containers: map[string]Container{
			"focus": {Domain: "d_focus"}, "shared": {Domain: "d_shared"}, "alt": {Domain: "d_focus"},
			"child": {Domain: "d_shared"}, "only": {Domain: "d_shared"},
			"caller-a": {Domain: "d_a"}, "caller-b": {Domain: "d_b"}, "caller-c": {Domain: "d_c"},
		},
		Nodes: map[string]ViewNode{
			"focus":    {Node: Node{Kind: "entry", Container: "focus"}},
			"shared":   {Node: Node{Kind: "func", Container: "shared", Name: "Shared"}},
			"alt":      {Node: Node{Kind: "func", Container: "alt", Name: "Alternate"}},
			"child":    {Node: Node{Kind: "func", Container: "child", Name: "Child"}},
			"only":     {Node: Node{Kind: "func", Container: "only", Name: "Only"}},
			"caller-a": {Node: Node{Kind: "func", Container: "caller-a"}},
			"caller-b": {Node: Node{Kind: "func", Container: "caller-b"}},
			"caller-c": {Node: Node{Kind: "func", Container: "caller-c"}},
		},
		Edges: []ViewEdge{
			{From: "caller-a", To: "shared"}, {From: "caller-b", To: "shared"}, {From: "caller-c", To: "shared"},
			{From: "focus", To: "shared"}, {From: "shared", To: "child"}, {From: "shared", To: "only"},
			{From: "focus", To: "alt"}, {From: "alt", To: "child"},
		},
	}
	raw := &Result{View: "baseline", Foci: []string{"focus"}, Nodes: []ResultNode{
		{ID: "focus", Dist: 0, ViewNode: v.Nodes["focus"]},
		{ID: "shared", Dist: 1, ViewNode: v.Nodes["shared"]},
		{ID: "alt", Dist: 1, ViewNode: v.Nodes["alt"]},
		{ID: "child", Dist: 2, ViewNode: v.Nodes["child"]},
		{ID: "only", Dist: 2, ViewNode: v.Nodes["only"]},
	}}
	result, err := AssembleResult(v, raw, "", QueryOptions{CollapseUtil: true})
	if err != nil {
		t.Fatal(err)
	}
	got := map[string]bool{}
	for _, item := range result.Nodes {
		if item.Node != nil {
			got[item.Node.ID] = true
		}
	}
	if !got["child"] {
		t.Fatalf("alternate uncollapsed path must retain child: %v", got)
	}
	if got["only"] {
		t.Fatalf("child reachable only through shared utility must be collapsed: %v", got)
	}
}

func TestAssembleResultExternalRepresentativesUseRawIncomingEdges(t *testing.T) {
	v := &View{
		Containers: map[string]Container{
			"focus": {Domain: "d_focus"}, "one": {Domain: "d_external"}, "two": {Domain: "d_external"}, "outside": {Domain: "d_outside"},
		},
		Nodes: map[string]ViewNode{
			"focus":   {Node: Node{Kind: "entry", Container: "focus"}},
			"one":     {Node: Node{Kind: "func", Container: "one", Name: "One"}},
			"two":     {Node: Node{Kind: "func", Container: "two", Name: "Two"}},
			"outside": {Node: Node{Kind: "func", Container: "outside", Name: "Outside"}},
		},
		Edges: []ViewEdge{{From: "focus", To: "two"}, {From: "outside", To: "one"}},
	}
	raw := &Result{View: "baseline", Foci: []string{"focus"}, Nodes: []ResultNode{
		{ID: "focus", Dist: 0, ViewNode: v.Nodes["focus"]},
		{ID: "one", Dist: 1, ViewNode: v.Nodes["one"]},
		{ID: "two", Dist: 1, ViewNode: v.Nodes["two"]},
	}}
	result, err := AssembleResult(v, raw, "", QueryOptions{FoldExternal: true})
	if err != nil {
		t.Fatal(err)
	}
	if len(result.Nodes) != 2 || result.Nodes[1].External == nil || len(result.Nodes[1].External.Representatives) != 2 {
		t.Fatalf("external result=%+v", result.Nodes)
	}
	if got := result.Nodes[1].External.Representatives[0].ID; got != "two" {
		t.Fatalf("representatives must rank raw-result incoming edges, got %q", got)
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
