package codegraph

import (
	"reflect"
	"strings"
	"testing"
)

// diamondView 是和 chain 对照的最小菱形：A→B、A→C、B→D、C→D。
func diamondView() *View {
	n := func(id, name string) ViewNode {
		return ViewNode{Node: Node{Kind: "func", Name: name, File: id + ".go", Line: 1, Container: "k"}}
	}
	return &View{
		Name:       "diamond",
		Containers: map[string]Container{"k": {Label: "k", Kind: "组"}},
		Nodes: map[string]ViewNode{
			"a": n("a", "A"),
			"b": n("b", "B"),
			"c": n("c", "C"),
			"d": n("d", "D"),
		},
		Edges: []ViewEdge{
			{From: "a", To: "b"},
			{From: "a", To: "c"},
			{From: "b", To: "d"},
			{From: "c", To: "d"},
		},
	}
}

func countID(n TreeNode, id string) int {
	c := 0
	if n.ID == id {
		c = 1
	}
	for _, ch := range n.Children {
		c += countID(ch, id)
	}
	return c
}

func childIDs(n TreeNode) []string {
	out := make([]string, 0, len(n.Children))
	for _, ch := range n.Children {
		out = append(out, ch.ID)
	}
	return out
}

func TestCallTreeDownDiamondRepeatsSharedCallee(t *testing.T) {
	v := diamondView()
	chain, err := Neighborhood(v, []string{"a"}, 2, 0)
	if err != nil {
		t.Fatal(err)
	}
	dOnce := 0
	for _, n := range chain.Nodes {
		if n.ID == "d" {
			dOnce++
		}
	}
	if dOnce != 1 {
		t.Fatalf("对照前提：chain 里 D 应出现 1 次，得到 %d", dOnce)
	}

	tree, err := BuildCallTree(v, TreeOptions{Focus: "a", Depth: 2})
	if err != nil {
		t.Fatalf("向下树: %v", err)
	}
	if tree.Root.ID != "a" {
		t.Fatalf("根: %s", tree.Root.ID)
	}
	if got := countID(tree.Root, "d"); got != 2 {
		t.Fatalf("真树里 D 应按路径出现 2 次，得到 %d；若为 1 就是 chain 换皮", got)
	}
	if len(tree.Root.Children) != 2 {
		t.Fatalf("A 的直接被调: %v", childIDs(tree.Root))
	}
}

func TestCallTreeUpCorridorDropsSiblingBranch(t *testing.T) {
	v := diamondView()
	tree, err := BuildCallTree(v, TreeOptions{
		Focus: "d", Up: true, Depth: 2,
		Through: "b", From: "a",
	})
	if err != nil {
		t.Fatalf("走廊: %v", err)
	}
	if countID(tree.Root, "c") != 0 {
		t.Fatalf("走廊 a→b→d 不应再出现 C 支: %+v", tree.Root)
	}
	if countID(tree.Root, "b") != 1 || countID(tree.Root, "a") != 1 {
		t.Fatalf("走廊应保留 B 与 A: B=%d A=%d", countID(tree.Root, "b"), countID(tree.Root, "a"))
	}
}

func TestCallTreeFromRequiresThrough(t *testing.T) {
	_, err := BuildCallTree(diamondView(), TreeOptions{Focus: "d", Up: true, From: "a"})
	if err == nil || !strings.Contains(err.Error(), "through") {
		t.Fatalf("只给 from 应失败: %v", err)
	}
}

func TestCallTreeThroughOnDownRejected(t *testing.T) {
	_, err := BuildCallTree(diamondView(), TreeOptions{Focus: "a", Through: "b"})
	if err == nil || !strings.Contains(err.Error(), "向上") {
		t.Fatalf("向下模式给走廊应失败: %v", err)
	}
}

func TestCallTreeThroughNotAncestor(t *testing.T) {
	_, err := BuildCallTree(diamondView(), TreeOptions{Focus: "b", Up: true, Through: "c"})
	if err == nil || !strings.Contains(err.Error(), "祖先") {
		t.Fatalf("C 不是 B 的祖先应失败: %v", err)
	}
}

func TestCallTreeSelfCallStops(t *testing.T) {
	v := diamondView()
	v.Edges = append(v.Edges, ViewEdge{From: "d", To: "d"})
	tree, err := BuildCallTree(v, TreeOptions{Focus: "d", Depth: 3})
	if err != nil {
		t.Fatal(err)
	}
	if len(tree.Root.Children) != 1 || tree.Root.Children[0].ID != "d" {
		t.Fatalf("自环应出现一次: %v", childIDs(tree.Root))
	}
	if len(tree.Root.Children[0].Children) != 0 {
		t.Fatalf("自环子节点不得再展开: %+v", tree.Root.Children[0])
	}
}

func TestCallTreeOnceCollapsesRepeat(t *testing.T) {
	tree, err := BuildCallTree(diamondView(), TreeOptions{Focus: "a", Depth: 2, Once: true})
	if err != nil {
		t.Fatal(err)
	}
	if got := countID(tree.Root, "d"); got != 1 {
		t.Fatalf("--once 下 D 应只展开一次，得到 %d", got)
	}
}

func TestCallTreeDownSortsByNameThenID(t *testing.T) {
	v := diamondView()
	v.Nodes["b"] = ViewNode{Node: Node{Kind: "func", Name: "same", Container: "k"}}
	v.Nodes["c"] = ViewNode{Node: Node{Kind: "func", Name: "same", Container: "k"}}
	v.Nodes["d"] = ViewNode{Node: Node{Kind: "func", Name: "alpha", Container: "k"}}
	v.Edges = []ViewEdge{{From: "a", To: "c"}, {From: "a", To: "d"}, {From: "a", To: "b"}}
	tree, err := BuildCallTree(v, TreeOptions{Focus: "a", Depth: 1})
	if err != nil {
		t.Fatal(err)
	}
	if got := childIDs(tree.Root); !reflect.DeepEqual(got, []string{"d", "b", "c"}) {
		t.Fatalf("子节点必须按 name 后 id 排序: %v", got)
	}
}

func TestCallTreeSelfLoopEntryDoesNotImplicitlyStop(t *testing.T) {
	v := diamondView()
	v.Nodes["entry"] = ViewNode{Node: Node{Kind: "entry", Name: "entry", Container: "k"}}
	v.Edges = []ViewEdge{{From: "entry", To: "a"}, {From: "a", To: "entry"}}
	tree, err := BuildCallTree(v, TreeOptions{Focus: "entry", Depth: 2})
	if err != nil {
		t.Fatal(err)
	}
	if len(tree.Root.Children) != 1 || tree.Root.Children[0].ID != "a" {
		t.Fatalf("entry 必须按普通节点展开: %+v", tree.Root)
	}
	if len(tree.Root.Children[0].Children) != 1 || tree.Root.Children[0].Children[0].ID != "entry" {
		t.Fatalf("entry 回路应保留一层路径: %+v", tree.Root.Children[0])
	}
}

func TestCallTreeDepthAndTruncation(t *testing.T) {
	v := diamondView()
	rootOnly, err := BuildCallTree(v, TreeOptions{Focus: "a", Depth: 0})
	if err != nil {
		t.Fatal(err)
	}
	if len(rootOnly.Root.Children) != 0 || rootOnly.Root.Dist != 0 {
		t.Fatalf("Depth=0 只能输出根: %+v", rootOnly.Root)
	}
	one, err := BuildCallTree(v, TreeOptions{Focus: "a", Depth: 1})
	if err != nil {
		t.Fatal(err)
	}
	if len(one.Root.Children) != 2 || one.Root.Children[0].Dist != 1 || len(one.Root.Children[0].Children) != 0 {
		t.Fatalf("Depth=1 只能输出一层: %+v", one.Root)
	}
	all, err := BuildCallTree(v, TreeOptions{Focus: "a", Depth: -1})
	if err != nil {
		t.Fatal(err)
	}
	if countID(all.Root, "d") != 2 || all.Truncated != nil {
		t.Fatalf("Depth<0 应不限且不静默截断: %+v", all)
	}
	limited, err := BuildCallTree(v, TreeOptions{Focus: "a", Depth: -1, MaxNodes: 2})
	if err != nil {
		t.Fatal(err)
	}
	if limited.Truncated == nil || limited.Truncated.AtDepth == 1 || limited.Truncated.DroppedNodes < 1 || limited.Truncated.Reason != "max-tree-nodes" {
		t.Fatalf("MaxNodes 截断必须显式带元数据: %+v", limited.Truncated)
	}
}

func TestCallTreeCorridorValidation(t *testing.T) {
	v := diamondView()
	cases := []TreeOptions{
		{Focus: "d", Up: true, Through: "b", From: "d"},
		{Focus: "d", Through: "b"},
		{Focus: "d", Up: true, Through: "c", From: "b"},
		{Focus: "d", Up: true, Through: "b", From: "c"},
	}
	for i, opts := range cases {
		if got, err := BuildCallTree(v, opts); err == nil || got != nil {
			t.Fatalf("非法走廊 %d 必须返回 error/nil: tree=%+v err=%v", i, got, err)
		}
	}
}

func TestCallTreeFiltersDeletedEdgesAndNodes(t *testing.T) {
	v := diamondView()
	v.Nodes["dead"] = ViewNode{Node: Node{Kind: "func", Name: "dead", Container: "k"}, Status: "deleted"}
	v.Edges = append(v.Edges,
		ViewEdge{From: "a", To: "dead"},
		ViewEdge{From: "ghost", To: "a"},
		ViewEdge{From: "a", To: "ghost"},
	)
	for i := range v.Edges {
		if v.Edges[i].From == "a" && v.Edges[i].To == "c" {
			v.Edges[i].Status = "deleted"
		}
	}
	tree, err := BuildCallTree(v, TreeOptions{Focus: "a", Depth: 1})
	if err != nil {
		t.Fatal(err)
	}
	if countID(tree.Root, "dead") != 0 || countID(tree.Root, "ghost") != 0 || countID(tree.Root, "c") != 0 {
		t.Fatalf("删除节点/边与悬空端点不得进入树: %+v", tree.Root)
	}
}
