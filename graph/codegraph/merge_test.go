package codegraph

import (
	"encoding/json"
	"path/filepath"
	"strings"
	"testing"
)

func TestMergeBaselineOnly(t *testing.T) {
	v := Merge(loadFixture(t), nil)
	if v.Name != "baseline" || len(v.Nodes) != 8 || len(v.Edges) != 4 {
		t.Fatalf("基准视图形状: %s %d %d", v.Name, len(v.Nodes), len(v.Edges))
	}
	if v.Nodes["n_do"].Status != "" {
		t.Fatal("基准视图不应有 status")
	}
}

func TestMergeWithDiff(t *testing.T) {
	g := loadFixture(t)
	d, _ := LoadDiff(filepath.Join("testdata", "repo"), "branch-x")
	v := Merge(g, d)
	if v.Name != "branch:x" {
		t.Fatalf("视图名取 diff.view: %s", v.Name)
	}
	if v.Nodes["n_audit"].Status != "added" || v.Nodes["n_do"].Status != "modified" ||
		v.Nodes["n_save"].Status != "deleted" {
		t.Fatalf("节点状态: %+v", v.Nodes)
	}
	// 修改后的节点内容替换为 diff 里的版本，且带 signatureOld
	if v.Nodes["n_do"].SignatureOld == "" || v.Nodes["n_do"].Signature ==
		g.Nodes["n_do"].Signature {
		t.Fatal("modified 节点应替换为新签名并携带旧签名")
	}
	// 删除的节点保留在视图里（status=deleted），供渲染红虚线，不是直接消失
	st := map[string]string{}
	for _, e := range v.Edges {
		st[e.From+"→"+e.To] = e.Status
	}
	if st["n_do→n_audit"] != "added" || st["n_do→n_save"] != "deleted" {
		t.Fatalf("边状态: %v", st)
	}
	lifecycleStatus := map[string]string{}
	for _, ref := range v.Lifecycle {
		lifecycleStatus[ref.Who+"→"+ref.Model+"→"+ref.Kind] = ref.Status
	}
	if lifecycleStatus["n_do→m_task→creator"] != "" || lifecycleStatus["n_audit→m_task→writer"] != "added" || lifecycleStatus["n_save→m_task→writer"] != "deleted" {
		t.Fatalf("lifecycle 状态: %v", lifecycleStatus)
	}
}

func TestMergeSkipsInvalidAddedEdges(t *testing.T) {
	g := loadFixture(t)
	v := Merge(g, &Diff{EdgesAdded: []Edge{{"n_do", "n_ghost"}}})
	if len(v.Edges) != len(g.Edges) {
		t.Fatalf("非法新增边不应进入视图: %+v", v.Edges)
	}
}

func TestMergeContainersAdded(t *testing.T) {
	g := loadFixture(t)
	d := &Diff{ContainersAdded: map[string]Container{
		"k_new": {Label: "new.Server", Kind: "函数组", Domain: "d_svc/api"},
	}}
	v := Merge(g, d)
	got, ok := v.Containers["k_new"]
	if !ok || got.Label != "new.Server" {
		t.Fatalf("新增容器未进入视图或 Label 错误: ok=%v container=%+v", ok, got)
	}
	if _, ok := g.Containers["k_new"]; ok {
		t.Fatal("Merge 不应就地污染基线容器")
	}
}

// implements 边必须穿过 LoadGraph→LoadDiff→Merge 全链出现在视图里。
// 只测内存构造会漏掉 json tag 拼写错这类 wire 缺陷（ChildrenTotal 前科）。
func TestMergeImplementsThroughWire(t *testing.T) {
	g, err := LoadGraph("testdata/repo")
	if err != nil {
		t.Fatalf("加载基线: %v", err)
	}
	if len(g.Implements) == 0 {
		t.Fatal("夹具基线应含 implements 边")
	}
	d, err := LoadDiff("testdata/repo", "branch-x")
	if err != nil {
		t.Fatalf("加载 diff: %v", err)
	}
	v := Merge(g, d)
	var added, kept int
	for _, e := range v.Implements {
		switch e.Status {
		case "added":
			added++
		case "":
			kept++
		}
	}
	if kept == 0 || added == 0 {
		t.Fatalf("视图 implements 合并不对: kept=%d added=%d", kept, added)
	}
}

func TestGraphJSONKeysAreAdditiveForLifecycle(t *testing.T) {
	raw, err := json.Marshal(loadFixture(t))
	if err != nil {
		t.Fatal(err)
	}
	var fields map[string]json.RawMessage
	if err := json.Unmarshal(raw, &fields); err != nil {
		t.Fatal(err)
	}
	want := map[string]bool{
		"meta": true, "domains": true, "containers": true, "nodes": true,
		"edges": true, "implements": true, "projections": true, "lifecycle": true,
	}
	if len(fields) != len(want) {
		t.Fatalf("Graph JSON 键数=%d，want=%d: %v", len(fields), len(want), fields)
	}
	for key := range fields {
		if !want[key] {
			t.Fatalf("Graph JSON 出现非 additive 键 %q", key)
		}
	}
}

func TestDiffContainersAddedJSONKeyIsAdditiveAndOmittable(t *testing.T) {
	withContainer, err := json.Marshal(&Diff{View: "new", ContainersAdded: map[string]Container{
		"k_new": {Label: "new.Server", Domain: "d_svc/api"},
	}})
	if err != nil {
		t.Fatal(err)
	}
	var fields map[string]json.RawMessage
	if err := json.Unmarshal(withContainer, &fields); err != nil {
		t.Fatal(err)
	}
	if _, ok := fields["containersAdded"]; !ok {
		t.Fatalf("非空 ContainersAdded 应序列化为 containersAdded: %s", withContainer)
	}
	empty, err := json.Marshal(&Diff{View: "empty"})
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(empty), "containersAdded") {
		t.Fatalf("空 ContainersAdded 应被 omitempty 省略: %s", empty)
	}
}
