package codegraph

import (
	"reflect"
	"sort"
	"strings"
	"testing"
)

// mkView 拼一个最小视图：nodes 映射 id→(container,file)，edges/impls 是边表。

// checkNoDecls 是「不带领域声明」的调用快捷方式。Best 夹具由旧 target
// 的子系统与视图容器机械转换而来，确保存量契约用例继续真正执行主判据；
// 第二个参数显式传入 Best，避免把 nil 当成「关闭全部契约执法」（C1.8 §5-3）。
func checkNoDecls(t *Target, v *View) *Report { return Check(t, bestFixtureForTarget(t, v), v, nil) }

func bestFixtureForTarget(t *Target, v *View) *Best {
	b := &Best{
		Meta:       BestMeta{Version: 1, Project: "test"},
		Domains:    map[string]BestDomain{},
		Containers: map[string]string{},
	}
	for _, subsystem := range t.Subsystems {
		b.Domains[subsystem.ID] = BestDomain{
			Label:          subsystem.Name,
			Responsibility: "fixture",
			Type:           subsystem.Type,
		}
	}
	nodeIDs := make([]string, 0, len(v.Nodes))
	for id := range v.Nodes {
		nodeIDs = append(nodeIDs, id)
	}
	sort.Strings(nodeIDs)
	for containerID := range v.Containers {
		for _, nodeID := range nodeIDs {
			n := v.Nodes[nodeID]
			if n.Status == "deleted" || n.Container != containerID {
				continue
			}
			if subsystem := t.SubsystemOf(n.File); subsystem != "" {
				b.Containers[containerID] = subsystem
				break
			}
		}
	}
	return b
}

func mkView(nodes map[string][2]string, edges, impls [][2]string) *View {
	v := &View{Containers: map[string]Container{}, Nodes: map[string]ViewNode{}}
	for id, cf := range nodes {
		v.Containers[cf[0]] = Container{Label: cf[0]}
		v.Nodes[id] = ViewNode{Node: Node{Container: cf[0], File: cf[1], Name: id}}
	}
	for _, e := range edges {
		v.Edges = append(v.Edges, ViewEdge{From: e[0], To: e[1]})
	}
	for _, e := range impls {
		v.Implements = append(v.Implements, ViewEdge{From: e[0], To: e[1]})
	}
	return v
}

func twoDomainTarget(entries []string, budget int) *Target {
	return &Target{
		Meta: TargetMeta{Version: 2},
		Subsystems: []TargetSubsystem{
			{ID: "d_a", Type: "logic", Paths: []string{"a/**"}},
			{ID: "d_b", Type: "logic", Paths: []string{"b/**"}},
		},
		Contracts: []Contract{{From: "d_a", To: "d_b", Entries: entries, LegacyBudget: budget}},
	}
}

func TestCheckTable(t *testing.T) {
	nodes := map[string][2]string{
		"a1": {"a.Server", "a/s.go"}, "b1": {"b.Facade", "b/f.go"}, "b2": {"b.Store", "b/st.go"},
	}
	cases := []struct {
		name          string
		tg            *Target
		edges, impls  [][2]string
		wantFailKinds []string
		wantWarnKinds []string
	}{
		{"域内边不检查", &Target{Meta: TargetMeta{Version: 2}, Subsystems: twoDomainTarget(nil, 0).Subsystems}, [][2]string{{"b1", "b2"}}, nil, nil, nil},
		{"走声明入口合法", twoDomainTarget([]string{"b.Facade"}, 0), [][2]string{{"a1", "b1"}}, nil, nil, nil},
		{"越界但有预算=warn", twoDomainTarget([]string{"b.Facade"}, 1), [][2]string{{"a1", "b2"}}, nil, nil, []string{"legacy"}},
		{"越界超预算=fail", twoDomainTarget([]string{"b.Facade"}, 0), [][2]string{{"a1", "b2"}}, nil, []string{"over-budget"}, nil},
		{"无契约方向=fail", &Target{Meta: TargetMeta{Version: 2}, Subsystems: twoDomainTarget(nil, 0).Subsystems},
			[][2]string{{"a1", "b1"}}, nil, []string{"new-direction"}, nil},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			rep := checkNoDecls(c.tg, mkView(nodes, c.edges, c.impls))
			assertKinds(t, "fail", rep.Fails, c.wantFailKinds)
			assertKinds(t, "warn", rep.Warns, c.wantWarnKinds)
		})
	}
}

func TestCheckNilBestSkipsContractEnforcement(t *testing.T) {
	target := twoDomainTarget(nil, 0)
	view := mkView(
		map[string][2]string{
			"a": {"a.Server", "a/server.go"},
			"b": {"b.Server", "b/server.go"},
		},
		[][2]string{{"a", "b"}}, nil)
	withBest := Check(target, bestFixtureForTarget(target, view), view, nil)
	if !hasFinding(withBest.Fails, "over-budget") {
		t.Fatalf("有 best 时应执行契约执法: %+v", withBest)
	}
	withoutBest := Check(target, nil, view, nil)
	if len(withoutBest.Fails) != 0 || len(withoutBest.LegacyHits) != 0 {
		t.Fatalf("best 缺失时应跳过全部契约执法: %+v", withoutBest)
	}
}

func assertKinds(t *testing.T, label string, got []Finding, want []string) {
	t.Helper()
	if len(want) == 0 && len(got) != 0 {
		t.Fatalf("%s 应为空，实际: %+v", label, got)
	}
	for _, k := range want {
		found := false
		for _, f := range got {
			if f.Kind == k {
				found = true
			}
		}
		if !found {
			t.Fatalf("%s 缺 kind=%s，实际: %+v", label, k, got)
		}
	}
}

// implements：接口在 d_a（使用方），实现落 d_b。声明了才合法。
func TestCheckImplements(t *testing.T) {
	nodes := map[string][2]string{
		"iface": {"a.Notifier", "a/n.go"}, "impl": {"b.Hook", "b/h.go"},
	}
	tg := twoDomainTarget(nil, 0)
	tg.Contracts[0].Interfaces = []string{"iface"}
	rep := checkNoDecls(tg, mkView(nodes, nil, [][2]string{{"impl", "iface"}}))
	if len(rep.Fails) != 0 {
		t.Fatalf("已声明接口应合法: %+v", rep.Fails)
	}
	tg.Contracts[0].Interfaces = nil
	rep = checkNoDecls(tg, mkView(nodes, nil, [][2]string{{"impl", "iface"}}))
	assertKinds(t, "fail", rep.Fails, []string{"off-interface"})
}

// 组装点出边豁免；deleted 状态的边不检查；未归属容器与空 best 领域进 warn。
func TestCheckExemptionsAndWarns(t *testing.T) {
	nodes := map[string][2]string{
		"main": {"main", "cmd/main.go"}, "b1": {"b.Facade", "b/f.go"}, "out": {"x", "web/x.ts"},
	}
	tg := &Target{
		Meta: TargetMeta{Version: 2},
		Subsystems: []TargetSubsystem{
			{ID: "d_cmd", Type: "logic", Paths: []string{"cmd/**"}},
			{ID: "d_b", Type: "logic", Paths: []string{"b/**"}},
			{ID: "d_dead", Type: "logic", Paths: []string{"ghost/**"}},
		},
		Assembly: []string{"cmd/main.go"},
	}
	v := mkView(nodes, [][2]string{{"main", "b1"}}, nil)
	v.Edges = append(v.Edges, ViewEdge{From: "b1", To: "out", Status: "deleted"})
	rep := checkNoDecls(tg, v)
	if len(rep.Fails) != 0 {
		t.Fatalf("组装豁免/deleted 边不应 fail: %+v", rep.Fails)
	}
	assertKinds(t, "warn", rep.Warns, []string{"container-unplaced", "domain-empty"})
}

// 组装点死配置：assembly 里写了视图中不存在的文件，必须报 dead-assembly warn。
// assembly 写错文件名必须有信号，
// 一条不存在的 "cmd/main.go" 能在基准里躺过整轮而无人发现。
func TestCheckDeadAssembly(t *testing.T) {
	nodes := map[string][2]string{
		"main": {"main", "cmd/main.go"}, "b1": {"b.Facade", "b/f.go"},
	}
	tg := &Target{
		Meta: TargetMeta{Version: 2},
		Subsystems: []TargetSubsystem{
			{ID: "d_cmd", Type: "logic", Paths: []string{"cmd/**"}},
			{ID: "d_b", Type: "logic", Paths: []string{"b/**"}},
		},
		Assembly: []string{"cmd/main.go", "cmd/ghost.go"},
	}
	rep := checkNoDecls(tg, mkView(nodes, [][2]string{{"main", "b1"}}, nil))

	var hits []Finding
	for _, w := range rep.Warns {
		if w.Kind == "dead-assembly" {
			hits = append(hits, w)
		}
	}
	// 恰好一条：存在的 cmd/main.go 不该报，不存在的 cmd/ghost.go 必须报。
	// 断言条数而不只断言「有」，是为了挡住「把所有 assembly 都报一遍」这种实现。
	if len(hits) != 1 {
		t.Fatalf("dead-assembly 应恰好 1 条，实际 %d 条: %+v", len(hits), rep.Warns)
	}
	if !strings.Contains(hits[0].Detail, "cmd/ghost.go") {
		t.Fatalf("dead-assembly 应指向 cmd/ghost.go，实际: %s", hits[0].Detail)
	}
	if len(rep.Fails) != 0 {
		t.Fatalf("dead-assembly 只能是 warn，不能进 fails: %+v", rep.Fails)
	}
}

// 节点被标记 deleted 时，该文件不算「视图里存在」——组装点仍应报死配置。
// 边界条件：deleted 节点只为渲染保留，不代表当前分支里还有这个文件。
func TestCheckDeadAssemblyIgnoresDeletedNodes(t *testing.T) {
	tg := &Target{
		Meta:       TargetMeta{Version: 2},
		Subsystems: []TargetSubsystem{{ID: "d_cmd", Type: "logic", Paths: []string{"cmd/**"}}},
		Assembly:   []string{"cmd/gone.go"},
	}
	v := mkView(map[string][2]string{"g": {"main", "cmd/gone.go"}}, nil, nil)
	n := v.Nodes["g"]
	n.Status = "deleted"
	v.Nodes["g"] = n

	rep := checkNoDecls(tg, v)
	found := false
	for _, w := range rep.Warns {
		if w.Kind == "dead-assembly" {
			found = true
		}
	}
	if !found {
		t.Fatalf("deleted 节点不应让组装点算「命中」，实际 warns: %+v", rep.Warns)
	}
}

func TestSortFindingsIsTotalOrder(t *testing.T) {
	findings := []Finding{
		{Kind: "same", Detail: "same", From: "d_c", To: "d_d", Edge: &Edge{"n_c", "n_d"}},
		{Kind: "same", Detail: "same", From: "d_a", To: "d_b", Edge: &Edge{"n_a", "n_b"}},
		{Kind: "same", Detail: "same", From: "d_b", To: "d_c", Edge: &Edge{"n_b", "n_c"}},
		{Kind: "same", Detail: "same", From: "d_a", To: "d_c", Edge: &Edge{"n_a", "n_c"}},
		{Kind: "same", Detail: "same", From: "d_c", To: "d_a", Edge: &Edge{"n_c", "n_a"}},
		{Kind: "same", Detail: "same", From: "d_b", To: "d_a", Edge: &Edge{"n_b", "n_a"}},
	}
	first := append([]Finding(nil), findings...)
	second := append([]Finding(nil), findings...)
	for i, j := 0, len(second)-1; i < j; i, j = i+1, j-1 {
		second[i], second[j] = second[j], second[i]
	}

	sortFindings(&Report{Fails: first})
	sortFindings(&Report{Fails: second})
	if !reflect.DeepEqual(first, second) {
		t.Fatalf("相同 Kind/Detail 的 finding 排序不稳定:\nfirst=%+v\nsecond=%+v", first, second)
	}
}

func TestCheckDeadEntryReconciliation(t *testing.T) {
	cases := []struct {
		name      string
		entry     string
		nodes     map[string][2]string
		wantDead  bool
		wantTo    string
		wantEntry string
	}{
		{
			name:      "缺失 Label",
			entry:     "missing.Entry",
			nodes:     map[string][2]string{"b1": {"b.Facade", "b/f.go"}},
			wantDead:  true,
			wantTo:    "d_b",
			wantEntry: "missing.Entry",
		},
		{
			name:      "同 Label 但节点在错误子系统",
			entry:     "same.Entry",
			nodes:     map[string][2]string{"a1": {"same.Entry", "a/a.go"}},
			wantDead:  true,
			wantTo:    "d_b",
			wantEntry: "same.Entry",
		},
		{
			name:     "Label 与节点均在 to",
			entry:    "b.Facade",
			nodes:    map[string][2]string{"b1": {"b.Facade", "b/f.go"}},
			wantDead: false,
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			tg := twoDomainTarget([]string{tc.entry}, 0)
			rep := checkNoDecls(tg, mkView(tc.nodes, nil, nil))
			var found *Finding
			for i := range rep.Fails {
				if rep.Fails[i].Kind == KindDeadEntry {
					found = &rep.Fails[i]
					break
				}
			}
			if tc.wantDead && found == nil {
				t.Fatalf("应报 dead-entry: %+v", rep)
			}
			if !tc.wantDead && found != nil {
				t.Fatalf("有效入口不应报 dead-entry: %+v", found)
			}
			if found != nil && (found.To != tc.wantTo || !strings.Contains(found.Detail, tc.wantEntry) || !strings.Contains(found.Detail, tc.wantTo)) {
				t.Fatalf("dead-entry 定位信息不完整: %+v", found)
			}
		})
	}
}

func TestCheckDeadInterfaceReconciliation(t *testing.T) {
	tg := twoDomainTarget(nil, 0)
	tg.Contracts[0].Interfaces = []string{"a.Notifier"}
	missing := checkNoDecls(tg, mkView(map[string][2]string{
		"b1": {"b.Facade", "b/f.go"},
	}, nil, nil))
	assertFinding(t, missing.Fails, KindDeadInterface, "a.Notifier", "d_b", "d_a→d_b")

	valid := checkNoDecls(tg, mkView(map[string][2]string{
		"a.Notifier": {"a.Notifier", "a/n.go"},
	}, nil, nil))
	if hasFinding(valid.Fails, KindDeadInterface) {
		t.Fatalf("from 子系统中的接口不应报 dead-interface: %+v", valid.Fails)
	}
}

func TestCheckDeadContractReconciliationCountsAllLiveEdges(t *testing.T) {
	tests := []struct {
		name     string
		edges    [][2]string
		impls    [][2]string
		assembly bool
		want     bool
	}{
		{name: "零边", want: true},
		{name: "implements 边算活", impls: [][2]string{{"impl", "iface"}}},
		{name: "组装点豁免 call 边算活", edges: [][2]string{{"caller", "callee"}}, assembly: true},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			tg := twoDomainTarget(nil, 0)
			if tc.name == "implements 边算活" {
				tg.Contracts[0].Interfaces = []string{"iface"}
			}
			tg.Assembly = nil
			if tc.assembly {
				tg.Assembly = []string{"a/assembly.go"}
			}
			nodes := map[string][2]string{
				"impl": {"b.Impl", "b/impl.go"}, "iface": {"a.Iface", "a/iface.go"},
				"caller": {"a.Caller", "a/assembly.go"}, "callee": {"b.Callee", "b/callee.go"},
			}
			rep := checkNoDecls(tg, mkView(nodes, tc.edges, tc.impls))
			hasDead := hasFinding(rep.Fails, KindDeadContract)
			if hasDead != tc.want {
				t.Fatalf("dead-contract=%v want=%v: %+v", hasDead, tc.want, rep.Fails)
			}
		})
	}
}

func TestCheckReconciliationFindingsAreFails(t *testing.T) {
	tg := twoDomainTarget([]string{"missing.Entry"}, 0)
	tg.Contracts[0].Interfaces = []string{"missing.Interface"}
	rep := checkNoDecls(tg, mkView(map[string][2]string{}, nil, nil))
	for _, kind := range []string{KindDeadEntry, KindDeadInterface, KindDeadContract} {
		if !hasFinding(rep.Fails, kind) {
			t.Fatalf("%s 应进 fails: %+v", kind, rep)
		}
		if hasFinding(rep.Warns, kind) {
			t.Fatalf("%s 不应进 warns: %+v", kind, rep)
		}
	}
}

func TestCheckDeadEntryAcceptsMergedAddedContainer(t *testing.T) {
	g := loadFixture(t)
	d := &Diff{
		ContainersAdded: map[string]Container{
			"k_new": {Label: "new.Entry", Kind: "服务端", Domain: "d_svc/api"},
		},
		NodesAdded: map[string]Node{
			"n_new": {Kind: "func", Container: "k_new", Name: "new.Entry", File: "svc/new.go"},
		},
		EdgesAdded: []Edge{{"n_runE", "n_new"}},
	}
	v := Merge(g, d)
	tg := &Target{
		Meta: TargetMeta{Version: 2},
		Subsystems: []TargetSubsystem{
			{ID: "d_cmd", Type: "logic", Paths: []string{"cmd/**"}},
			{ID: "d_svc", Type: "logic", Paths: []string{"svc/**"}},
		},
		Assembly:  []string{"cmd/run.go"},
		Contracts: []Contract{{From: "d_cmd", To: "d_svc", Entries: []string{"new.Entry"}}},
	}
	rep := checkNoDecls(tg, v)
	if hasFinding(rep.Fails, KindDeadEntry) {
		t.Fatalf("Merge 后来自 containersAdded 的入口不应报 dead-entry: %+v", rep.Fails)
	}
}

func hasFinding(findings []Finding, kind string) bool {
	for _, f := range findings {
		if f.Kind == kind {
			return true
		}
	}
	return false
}

func assertFinding(t *testing.T, findings []Finding, kind, detail, to, direction string) {
	t.Helper()
	for _, f := range findings {
		if f.Kind == kind {
			if f.To != to || !strings.Contains(f.Detail, detail) || !strings.Contains(f.Detail, direction) {
				t.Fatalf("%s 定位信息不完整: %+v", kind, f)
			}
			return
		}
	}
	t.Fatalf("缺少 %s: %+v", kind, findings)
}
