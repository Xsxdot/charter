package codegraph

import (
	"encoding/json"
	"os"
	"reflect"
	"testing"
)

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
	r, err := LookupFlow(v, g, "", "用户查询", "a")
	if err != nil {
		t.Fatal(err)
	}
	if r.View != "baseline" || r.Query != "用户查询" || r.Subject.ID != "a" || r.Degraded || !reflect.DeepEqual(r.Steps, g.Flows["a"].Steps) {
		t.Fatalf("流程主语/步骤未按 wire 透传: %+v", r)
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
	if r.Callers == nil || r.Implementations == nil || r.Channels == nil || r.Steps == nil {
		t.Fatal("所有数组字段都必须是非 nil 空/非空数组")
	}
}

func TestLookupFlowMissingIsDegradedNotChain(t *testing.T) {
	v, _ := flowWorld()
	inputs := []struct {
		name string
		g    *Graph
	}{
		{name: "nil graph", g: nil},
		{name: "nil flows", g: &Graph{}},
		{name: "missing id", g: &Graph{Flows: map[string]Flow{}}},
		{name: "empty steps", g: &Graph{Flows: map[string]Flow{"b": {Steps: []FlowStep{}}}}},
	}
	for _, tt := range inputs {
		t.Run(tt.name, func(t *testing.T) {
			r, err := LookupFlow(v, tt.g, "", "B", "b")
			if err != nil {
				t.Fatal(err)
			}
			if !r.Degraded || r.Missing == "" || len(r.Steps) != 0 {
				t.Fatalf("没有 flows 必须显式降级: %+v", r)
			}
			raw, err := json.Marshal(r.Steps)
			if err != nil || string(raw) != "[]" {
				t.Fatalf("steps 必须序列化为 []: raw=%s err=%v", raw, err)
			}
			for _, step := range r.Steps {
				if step.ID == "e" || step.ID == "a" {
					t.Fatalf("degraded 不得把邻域伪装成步骤: %+v", r.Steps)
				}
			}
		})
	}
}

func TestLookupFlowRejectsMissingOrDeletedSubject(t *testing.T) {
	v, g := flowWorld()
	v.Nodes["deleted"] = ViewNode{Node: Node{Kind: "func", Name: "Deleted"}, Status: "deleted"}
	for _, id := range []string{"missing", "deleted"} {
		r, err := LookupFlow(v, g, "", id, id)
		if err == nil || r != nil {
			t.Fatalf("%s 必须是错误且无结果: result=%+v err=%v", id, r, err)
		}
	}
	r, err := LookupFlow(nil, g, "", "nil", "a")
	if err == nil || r != nil {
		t.Fatalf("nil View 必须是错误且无结果: result=%+v err=%v", r, err)
	}
}

func TestLookupFlowNeighborsUseActiveEdges(t *testing.T) {
	g := &Graph{
		Containers: map[string]Container{
			"entry": {Label: "入口", Kind: "入口"},
			"func":  {Label: "函数", Kind: "类型方法"},
		},
		Nodes: map[string]Node{
			"target":         {Kind: "func", Name: "Target", Container: "func"},
			"caller-a":       {Kind: "func", Name: "Same", Container: "func"},
			"caller-b":       {Kind: "func", Name: "Same", Container: "func"},
			"deleted-caller": {Kind: "func", Name: "Deleted caller", Container: "func"},
			"entry-a":        {Kind: "entry", Name: "HTTP", Channel: ChannelHTTP, Container: "entry"},
			"entry-deleted":  {Kind: "entry", Name: "Deleted entry", Channel: ChannelCLI, Container: "entry"},
			"helper":         {Kind: "func", Name: "helper", Container: "func"},
			"impl-a":         {Kind: "func", Name: "Same", Container: "func"},
			"impl-b":         {Kind: "func", Name: "Same", Container: "func"},
			"impl-deleted":   {Kind: "func", Name: "Deleted impl", Container: "func"},
		},
		Edges:      []Edge{{"caller-b", "target"}, {"caller-a", "target"}, {"deleted-caller", "target"}, {"entry-a", "helper"}, {"helper", "target"}, {"entry-deleted", "target"}, {"ghost", "target"}},
		Implements: []Edge{{"impl-b", "target"}, {"impl-a", "target"}, {"impl-deleted", "target"}},
		Flows:      map[string]Flow{"target": {Steps: []FlowStep{{ID: "step", Order: 1, Kind: FlowStepReturn}}}},
	}
	v := Merge(g, nil)
	v.Nodes["deleted-caller"] = ViewNode{Node: g.Nodes["deleted-caller"], Status: "deleted"}
	v.Nodes["entry-deleted"] = ViewNode{Node: g.Nodes["entry-deleted"], Status: "deleted"}
	v.Nodes["impl-deleted"] = ViewNode{Node: g.Nodes["impl-deleted"], Status: "deleted"}
	for i := range v.Edges {
		if v.Edges[i].From == "caller-a" {
			v.Edges[i].Status = "deleted"
		}
	}
	for i := range v.Implements {
		if v.Implements[i].From == "impl-deleted" {
			v.Implements[i].Status = "deleted"
		}
	}
	r, err := LookupFlow(v, g, "", "target query", "target")
	if err != nil {
		t.Fatal(err)
	}
	callerIDs := make([]string, 0, len(r.Callers))
	for _, caller := range r.Callers {
		callerIDs = append(callerIDs, caller.ID)
	}
	if !reflect.DeepEqual(callerIDs, []string{"caller-b", "helper"}) {
		t.Fatalf("callers 只能保留活跃直接边且按 name/id 排序: %+v", r.Callers)
	}
	if len(r.Implementations) != 2 || r.Implementations[0].ID != "impl-a" || r.Implementations[1].ID != "impl-b" {
		t.Fatalf("implementations 必须使用活跃 view join 并稳定排序: %+v", r.Implementations)
	}
	if len(r.Channels) != 1 || r.Channels[0].ID != "entry-a" {
		t.Fatalf("channels 必须只保留反向可达活跃 entry: %+v", r.Channels)
	}
	if r.Callers == nil || r.Implementations == nil || r.Channels == nil {
		t.Fatal("邻域空集合必须为 [] 而非 null")
	}
}

func TestLookupFlowSubjectUsesSymMatch(t *testing.T) {
	v, g := flowWorld()
	root := t.TempDir()
	if err := os.WriteFile(root+"/a.go", []byte("package p\n\nfunc A() {}\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	node := v.Nodes["a"]
	node.Line = 3
	v.Nodes["a"] = node
	r, err := LookupFlow(v, g, root, "A()", "a")
	if err != nil {
		t.Fatal(err)
	}
	if r.Subject.ID != "a" || r.Subject.Anchor != "ok" || r.Subject.ViewNode.Name != "A" || r.Subject.Line != 3 {
		t.Fatalf("subject 必须沿既有 SymMatch 再锚定: %+v", r.Subject)
	}
}
