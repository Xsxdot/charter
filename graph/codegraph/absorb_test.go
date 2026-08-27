package codegraph

import (
	"os"
	"path/filepath"
	"reflect"
	"testing"
)

// absorb 后写盘再重载，图与併入结果逐字段等价——穿真实序列化边界，
// 只比内存对象会漏 json tag 缺陷。
func TestAbsorbRoundTrip(t *testing.T) {
	g, err := LoadGraph("testdata/repo")
	if err != nil {
		t.Fatal(err)
	}
	d, err := LoadDiff("testdata/repo", "branch-x")
	if err != nil {
		t.Fatal(err)
	}
	merged := Absorb(g, d)
	// nodesAdded 进图、nodesDeleted 出图、edgesAdded/implementsAdded 进表
	for id := range d.NodesAdded {
		if _, ok := merged.Nodes[id]; !ok {
			t.Fatalf("added 节点 %s 未併入", id)
		}
	}
	for _, id := range d.NodesDeleted {
		if _, ok := merged.Nodes[id]; ok {
			t.Fatalf("deleted 节点 %s 仍在", id)
		}
	}
	dir := t.TempDir()
	if err := os.MkdirAll(filepath.Join(dir, "codegraph"), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := SaveGraph(dir, merged); err != nil {
		t.Fatalf("写盘: %v", err)
	}
	reloaded, err := LoadGraph(dir)
	if err != nil {
		t.Fatalf("重载: %v", err)
	}
	if !reflect.DeepEqual(merged, reloaded) {
		t.Fatal("写盘重载后不等价——序列化链路丢数据")
	}
}

// 入参不可变：absorb 失败重试的前提。
func TestAbsorbDoesNotMutateInput(t *testing.T) {
	g, err := LoadGraph("testdata/repo")
	if err != nil {
		t.Fatal(err)
	}
	before := len(g.Nodes)
	d, err := LoadDiff("testdata/repo", "branch-x")
	if err != nil {
		t.Fatal(err)
	}
	_ = Absorb(g, d)
	if len(g.Nodes) != before {
		t.Fatal("Absorb 改了入参 Graph")
	}
}

func TestAbsorbLifecycleMergeAndPreserve(t *testing.T) {
	g := loadFixture(t)
	mergedEmpty := Absorb(g, &Diff{})
	if !reflect.DeepEqual(mergedEmpty.Lifecycle, g.Lifecycle) {
		t.Fatalf("空 diff 不得清空 lifecycle: got=%v want=%v", mergedEmpty.Lifecycle, g.Lifecycle)
	}
	d, err := LoadDiff("testdata/repo", "branch-x")
	if err != nil {
		t.Fatal(err)
	}
	merged := Absorb(g, d)
	want := []LifecycleRef{
		{Who: "n_do", Model: "m_task", Kind: "creator"},
		{Who: "n_audit", Model: "m_task", Kind: "writer", Field: "status"},
	}
	if !reflect.DeepEqual(merged.Lifecycle, want) {
		t.Fatalf("lifecycle 增删/死端点/去重不对: got=%v want=%v", merged.Lifecycle, want)
	}
}

func TestAbsorbContainersAddedAndValidate(t *testing.T) {
	g := loadFixture(t)
	d := &Diff{
		ContainersAdded: map[string]Container{
			"k_new": {Label: "new.Server", Kind: "函数组", Domain: "d_svc/api"},
		},
		NodesAdded: map[string]Node{
			"n_new": {Kind: "func", Container: "k_new", File: "svc/new.go"},
		},
	}
	merged := Absorb(g, d)
	if _, ok := merged.Containers["k_new"]; !ok {
		t.Fatal("Absorb 后新增容器应进入 baseline.Containers")
	}
	if issues := Validate(merged); len(issues) != 0 {
		t.Fatalf("Absorb 后的 baseline 应通过 Validate: %v", issues)
	}
}
