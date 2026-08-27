package codegraph

import "testing"

func flowWorld() (*View, *Graph) {
	g := &Graph{
		Containers: map[string]Container{"k": {Label: "k", Kind: "组"}},
		Nodes: map[string]Node{
			"e": {Kind: "entry", Name: "cmd run", File: "cmd.go", Line: 1, Container: "k", Channel: ChannelCLI},
			"a": {Kind: "func", Name: "A", File: "a.go", Line: 10, Container: "k"},
			"b": {Kind: "func", Name: "B", File: "b.go", Line: 20, Container: "k"},
		},
		Edges:      []Edge{{"e", "a"}, {"a", "b"}},
		Implements: []Edge{{"b", "a"}},
		Flows: map[string]Flow{
			"a": {Steps: []FlowStep{
				{ID: "s1", Order: 1, Kind: FlowStepCall, To: "b", Line: 11},
				{ID: "s2", Order: 2, Kind: FlowStepReturn, Line: 12},
			}},
		},
	}
	return Merge(g, nil), g
}

func TestLookupFlowHasSteps(t *testing.T) {
	v, g := flowWorld()
	r, err := LookupFlow(v, g, "", "A", "a")
	if err != nil {
		t.Fatal(err)
	}
	if r.Degraded || len(r.Steps) != 2 {
		t.Fatalf("应有流程图: degraded=%v steps=%d", r.Degraded, len(r.Steps))
	}
	if len(r.Callers) != 1 || r.Callers[0].ID != "e" {
		t.Fatalf("直接调用方: %+v", r.Callers)
	}
	if len(r.Implementations) != 1 || r.Implementations[0].ID != "b" {
		t.Fatalf("实现: %+v", r.Implementations)
	}
	if len(r.Channels) != 1 || r.Channels[0].Channel != ChannelCLI {
		t.Fatalf("通道: %+v", r.Channels)
	}
}

func TestLookupFlowMissingIsDegradedNotChain(t *testing.T) {
	v, g := flowWorld()
	r, err := LookupFlow(v, g, "", "B", "b")
	if err != nil {
		t.Fatal(err)
	}
	if !r.Degraded || len(r.Steps) != 0 {
		t.Fatalf("没有 flows 不得填步骤: %+v", r)
	}
	if r.Missing == "" {
		t.Fatal("degraded 必须说明缺什么")
	}
}
