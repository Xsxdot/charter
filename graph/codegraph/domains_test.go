package codegraph

import (
	"encoding/json"
	"reflect"
	"strings"
	"testing"
)

// 夹具的领域结构：d_cli（c_cli）、d_svc（父）→ d_svc/api（k_svc）、d_svc/store（k_ent）
func TestDomainTreeStatsAndInterfaces(t *testing.T) {
	g, err := LoadGraph("testdata/repo")
	if err != nil {
		t.Fatal(err)
	}
	got := DomainTree(Merge(g, nil))
	byID := map[string]DomainStat{}
	for _, d := range got {
		byID[d.ID] = d
	}
	if len(got) != 4 || got[0].ID != "d_cli" {
		t.Fatalf("应按 id 升序返回 4 个领域: %+v", got)
	}
	cli := byID["d_cli"]
	if cli.Entries != 2 || cli.Unscanned != 1 || cli.Funcs != 0 {
		t.Fatalf("d_cli 统计: %+v", cli)
	}
	svc := byID["d_svc"]
	if !reflect.DeepEqual(svc.Children, []string{"d_svc/api", "d_svc/store"}) {
		t.Fatalf("父领域的 children: %+v", svc.Children)
	}
	if len(svc.Containers) != 0 || svc.Funcs != 0 {
		t.Fatalf("父领域不直接持有成员，统计不重复计入: %+v", svc)
	}
	api := byID["d_svc/api"]
	if api.Funcs != 3 || !reflect.DeepEqual(api.Interfaces, []string{"n_runE"}) {
		t.Fatalf("d_svc/api: funcs=%d ifaces=%v", api.Funcs, api.Interfaces)
	}
	store := byID["d_svc/store"]
	if store.Models != 2 || !reflect.DeepEqual(store.Interfaces, []string{"m_task"}) {
		t.Fatalf("d_svc/store: models=%d ifaces=%v", store.Models, store.Interfaces)
	}
}

func TestDomainTreeNilWhenNoDomains(t *testing.T) {
	v := Merge(&Graph{Containers: map[string]Container{}, Nodes: map[string]Node{}}, nil)
	if got := DomainTree(v); got != nil {
		t.Fatalf("无领域段必须返回 nil 让调用方降级，不能编造: %+v", got)
	}
}

func TestDomainTreeSkipsDeleted(t *testing.T) {
	g, err := LoadGraph("testdata/repo")
	if err != nil {
		t.Fatal(err)
	}
	d, err := LoadDiff("testdata/repo", "branch-x")
	if err != nil {
		t.Fatal(err)
	}
	// branch-x 删了 n_save，n_save→m_task 这条跨领域边随之失效
	byID := map[string]DomainStat{}
	for _, s := range DomainTree(Merge(g, d)) {
		byID[s.ID] = s
	}
	if len(byID["d_svc/store"].Interfaces) != 0 {
		t.Fatalf("deleted 端点的边不该算作对外接口: %+v", byID["d_svc/store"])
	}
}

func TestDomainTreeDerivesSubsystems(t *testing.T) {
	g, err := LoadGraph("testdata/repo")
	if err != nil {
		t.Fatal(err)
	}
	best, err := LoadBest("testdata/repo")
	if err != nil {
		t.Fatal(err)
	}
	byID := map[string]DomainStat{}
	for _, stat := range DomainTreeWithBest(Merge(g, nil), best) {
		byID[stat.ID] = stat
	}
	if !reflect.DeepEqual(byID["d_cli"].Subsystems, []string{"d_cmd"}) || byID["d_cli"].CrossSubsystem {
		t.Fatalf("单子系统领域派生: %+v", byID["d_cli"])
	}
	if !reflect.DeepEqual(byID["d_svc/store"].Subsystems, []string{"d_svc"}) || byID["d_svc/store"].CrossSubsystem {
		t.Fatalf("best 容器归属应提供单一子系统: %+v", byID["d_svc/store"])
	}
	raw, err := json.Marshal(byID["d_cli"])
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(raw), `"crossSubsystem":false`) {
		t.Fatalf("单子系统 false 必须出现在输出: %s", raw)
	}
}

func TestDomainTreeWithoutTargetOmitsSubsystemFields(t *testing.T) {
	g, err := LoadGraph("testdata/repo")
	if err != nil {
		t.Fatal(err)
	}
	raw, err := json.Marshal(DomainTree(Merge(g, nil)))
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(raw), "subsystems") || strings.Contains(string(raw), "crossSubsystem") {
		t.Fatalf("无 target 时派生字段必须省略: %s", raw)
	}
}

func TestDomainEdgeMatrixFiltersDirectionsAndSorts(t *testing.T) {
	v := &View{
		Containers: map[string]Container{
			"c_a":     {Domain: "d_a"},
			"c_b":     {Domain: "d_b"},
			"c_c":     {Domain: "d_c"},
			"c_empty": {},
			"c_dead":  {Domain: "d_a"},
		},
		Nodes: map[string]ViewNode{
			"a1":      {Node: Node{Container: "c_a"}},
			"a2":      {Node: Node{Container: "c_a"}},
			"b1":      {Node: Node{Container: "c_b"}},
			"b2":      {Node: Node{Container: "c_b"}},
			"c1":      {Node: Node{Container: "c_c"}},
			"empty":   {Node: Node{Container: "c_empty"}},
			"deleted": {Node: Node{Container: "c_dead"}, Status: "deleted"},
		},
		Edges: []ViewEdge{
			{From: "b1", To: "a1"}, {From: "b1", To: "a2"}, {From: "b1", To: "a1"},
			{From: "b2", To: "a1"}, {From: "b2", To: "a2"},
			{From: "c1", To: "a1"}, {From: "c1", To: "a2"}, {From: "c1", To: "b1"}, {From: "c1", To: "a1"}, {From: "c1", To: "a2"}, {From: "c1", To: "a1"},
			{From: "a1", To: "b1"}, {From: "a1", To: "b2"}, {From: "a2", To: "b1"},
			{From: "a1", To: "a2"},
			{From: "empty", To: "a1"}, {From: "deleted", To: "a1", Status: "deleted"},
			{From: "missing", To: "a1"}, {From: "a1", To: "missing"},
		},
	}
	want := []DomainEdgeStat{
		{From: "d_c", To: "d_a", Count: 5},
		{From: "d_b", To: "d_a", Count: 5},
		{From: "d_a", To: "d_b", Count: 3},
		{From: "d_c", To: "d_b", Count: 1},
	}
	// 前两条记录刻意设置为相同计数；计数降序后，再由 from/to 顺序决定
	// d_b→d_a 排在 d_c→d_a 之前，并解决其余并列情况。
	want[0], want[1] = want[1], want[0]
	got := DomainEdgeMatrix(v)
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("现状矩阵应保留方向、过滤无归属/删除边并排序: got=%+v want=%+v", got, want)
	}
	if again := DomainEdgeMatrix(v); !reflect.DeepEqual(got, again) {
		t.Fatalf("同一视图重复计算必须逐字节稳定: first=%+v again=%+v", got, again)
	}
}

func TestBestEdgeMatrixRelabellingProgress(t *testing.T) {
	v := &View{
		Containers: map[string]Container{
			"c_a": {Domain: "d_a"}, "c_b": {Domain: "d_b"}, "c_c": {Domain: "d_c"},
		},
		Nodes: map[string]ViewNode{
			"a1": {Node: Node{Container: "c_a"}}, "a2": {Node: Node{Container: "c_a"}},
			"b1": {Node: Node{Container: "c_b"}}, "b2": {Node: Node{Container: "c_b"}},
			"c1": {Node: Node{Container: "c_c"}},
		},
		Edges: []ViewEdge{
			{From: "a1", To: "b1"}, {From: "a2", To: "b2"}, {From: "a1", To: "b2"},
			{From: "c1", To: "a1"},
		},
	}
	best := &Best{
		Domains: map[string]BestDomain{
			"d_a": {}, "d_b": {}, "d_c": {},
		},
		Containers: map[string]string{"c_a": "d_a", "c_b": "d_b", "c_c": "d_c"},
	}
	before := BestEdgeMatrix(v, best)
	if len(before) != 2 || before[0] != (DomainEdgeStat{From: "d_a", To: "d_b", Count: 3}) {
		t.Fatalf("最优矩阵初始边界: %+v", before)
	}
	best.Containers["c_a"] = "d_b"
	after := BestEdgeMatrix(v, best)
	if len(after) != 1 || after[0] != (DomainEdgeStat{From: "d_c", To: "d_b", Count: 1}) {
		t.Fatalf("重贴容器到 d_b 后应消除 d_a→d_b 边界: %+v", after)
	}
}
