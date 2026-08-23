package codegraph

import (
	"encoding/json"
	"fmt"
	"reflect"
	"strings"
	"testing"
)

// mkView 拼一个最小视图：nodes 映射 id→(container,file)，edges/impls 是边表。
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
			rep := Check(c.tg, mkView(nodes, c.edges, c.impls))
			assertKinds(t, "fail", rep.Fails, c.wantFailKinds)
			assertKinds(t, "warn", rep.Warns, c.wantWarnKinds)
		})
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
	rep := Check(tg, mkView(nodes, nil, [][2]string{{"impl", "iface"}}))
	if len(rep.Fails) != 0 {
		t.Fatalf("已声明接口应合法: %+v", rep.Fails)
	}
	tg.Contracts[0].Interfaces = nil
	rep = Check(tg, mkView(nodes, nil, [][2]string{{"impl", "iface"}}))
	assertKinds(t, "fail", rep.Fails, []string{"off-interface"})
}

// 组装点出边豁免；deleted 状态的边不检查；图外文件与死规则进 warn。
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
	rep := Check(tg, v)
	if len(rep.Fails) != 0 {
		t.Fatalf("组装豁免/deleted 边不应 fail: %+v", rep.Fails)
	}
	assertKinds(t, "warn", rep.Warns, []string{"outside-file", "dead-rule"})
}

// 死规则判据（check.go#ruleHitsAny）的目录边界：dir/** 不得把兄弟目录/兄弟文件
// 算成命中，否则一条真的死规则会被邻居的存在掩盖过去，永远报不出来。
// 这条判据走的是与 targetRuleMatchesFile 相互独立的第二处实现，必须单独看着：
// 夹具让 app/apix.go 归到 d_other（只有已归域的文件才进 fileHit），d_api 的
// app/api/** 因此一个文件都命中不到，必须报 dead-rule。
func TestCheckDeadRuleRespectsDirectoryBoundary(t *testing.T) {
	nodes := map[string][2]string{"x": {"x", "app/apix.go"}}
	tg := &Target{
		Meta: TargetMeta{Version: 2},
		Subsystems: []TargetSubsystem{
			{ID: "d_other", Type: "logic", Paths: []string{"app/apix.go"}},
			{ID: "d_api", Type: "logic", Paths: []string{"app/api/**"}},
		},
	}
	rep := Check(tg, mkView(nodes, nil, nil))
	dead := findingsOfKind(rep.Warns, "dead-rule")
	if len(dead) != 1 {
		t.Fatalf("app/api/** 命中不到任何文件，应报 1 条 dead-rule，实际 %d 条: %+v", len(dead), rep.Warns)
	}
	if !strings.Contains(dead[0].Detail, "app/api/**") {
		t.Errorf("dead-rule 应指向 app/api/** 这条规则，实际: %s", dead[0].Detail)
	}
}

// 组装点死配置：assembly 里写了视图中不存在的文件，必须报 dead-assembly warn。
// 这是与 dead-rule 对称的一条——在此之前 assembly 写错文件名完全没有信号，
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
	rep := Check(tg, mkView(nodes, [][2]string{{"main", "b1"}}, nil))

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

	rep := Check(tg, v)
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
			rep := Check(tg, mkView(tc.nodes, nil, nil))
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
	missing := Check(tg, mkView(map[string][2]string{
		"b1": {"b.Facade", "b/f.go"},
	}, nil, nil))
	assertFinding(t, missing.Fails, KindDeadInterface, "a.Notifier", "d_b", "d_a→d_b")

	valid := Check(tg, mkView(map[string][2]string{
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
			rep := Check(tg, mkView(nodes, tc.edges, tc.impls))
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
	rep := Check(tg, mkView(map[string][2]string{}, nil, nil))
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
	rep := Check(tg, v)
	if hasFinding(rep.Fails, KindDeadEntry) {
		t.Fatalf("Merge 后来自 containersAdded 的入口不应报 dead-entry: %+v", rep.Fails)
	}
}

// gapTarget 造一个「只有 d_app 声明目标领域」的目标图：d_other 故意不声明，
// 用来锁「未声明 domains 的子系统整体跳过执法」（契约 §3-1 第 1 条）。
func gapTarget(budget int, domains ...TargetDomain) *Target {
	return &Target{
		Meta: TargetMeta{Version: 2},
		Subsystems: []TargetSubsystem{
			{ID: "d_app", Name: "App", Type: "logic", Paths: []string{"app/**"}, UnplacedBudget: budget, Domains: domains},
			{ID: "d_other", Name: "Other", Type: "logic", Paths: []string{"other/**"}},
		},
	}
}

func gapDomains() []TargetDomain {
	return []TargetDomain{
		{ID: "d_api", Name: "API", Responsibility: "对外接口", Paths: []string{"app/api/**"}},
		{ID: "d_worker", Name: "Worker", Responsibility: "后台任务", Paths: []string{"app/worker/**"}},
	}
}

// gapView 按 file 列表造视图，节点 id 自增；同一个文件出现多次即多个节点。
func gapView(files ...string) *View {
	v := &View{Containers: map[string]Container{}, Nodes: map[string]ViewNode{}}
	for i, file := range files {
		id := fmt.Sprintf("n_%03d", i)
		v.Containers["c"] = Container{Label: "c"}
		v.Nodes[id] = ViewNode{Node: Node{Container: "c", Name: id, File: file}}
	}
	return v
}

func findingsOfKind(findings []Finding, kind string) []Finding {
	var out []Finding
	for _, f := range findings {
		if f.Kind == kind {
			out = append(out, f)
		}
	}
	return out
}

func TestCheckTargetDomainGap(t *testing.T) {
	cases := []struct {
		name          string
		target        *Target
		view          *View
		wantFails     map[string]int // kind → 条数
		wantWarns     map[string]int
		wantDetail    []string // 必须出现在某条 gap finding 的 Detail 里
		unwantDetail  []string
		wantFindingID string // 若非空，断言该 kind 的 finding From/To 形状
	}{
		{
			name:       "预算内未落位只进 warns",
			target:     gapTarget(1, gapDomains()...),
			view:       gapView("app/api/a.go", "app/loose.go", "other/x.go", "web/out.ts"),
			wantFails:  map[string]int{KindUnplacedOverBudget: 0},
			wantWarns:  map[string]int{KindUnplaced: 1, KindDomainEmpty: 1},
			wantDetail: []string{"1/1", "app/loose.go", "d_worker"},
		},
		{
			name:      "严格超预算进 fails",
			target:    gapTarget(0, gapDomains()...),
			view:      gapView("app/api/a.go", "app/loose.go"),
			wantFails: map[string]int{KindUnplacedOverBudget: 1},
			wantWarns: map[string]int{KindUnplaced: 0, KindDomainEmpty: 1},
			// 1 > 0 才超预算；Detail 必须能看到 n 与预算两个数。
			wantDetail: []string{"1/0", "app/loose.go"},
		},
		{
			name:      "未声明 domains 的子系统整体跳过",
			target:    gapTarget(0),
			view:      gapView("app/loose.go", "other/x.go"),
			wantFails: map[string]int{KindUnplacedOverBudget: 0},
			wantWarns: map[string]int{KindUnplaced: 0, KindDomainEmpty: 0},
		},
		{
			name:      "全部落位时不产 unplaced",
			target:    gapTarget(0, gapDomains()...),
			view:      gapView("app/api/a.go", "app/worker/w.go"),
			wantFails: map[string]int{KindUnplacedOverBudget: 0},
			wantWarns: map[string]int{KindUnplaced: 0, KindDomainEmpty: 0},
		},
		{
			name:      "重复文件只算一个未落位",
			target:    gapTarget(0, gapDomains()...),
			view:      gapView("app/loose.go", "app/loose.go", "app/loose.go", "app/api/a.go", "app/worker/w.go"),
			wantFails: map[string]int{KindUnplacedOverBudget: 1},
			// 去重后 n=1；若实现按节点计数会变成 3/0。
			wantDetail:   []string{"1/0"},
			unwantDetail: []string{"3/0"},
		},
		{
			name:      "图外文件与其他子系统文件都不计入",
			target:    gapTarget(0, gapDomains()...),
			view:      gapView("app/api/a.go", "app/worker/w.go", "other/x.go", "other/deep/y.go", "web/out.ts"),
			wantFails: map[string]int{KindUnplacedOverBudget: 0},
			wantWarns: map[string]int{KindUnplaced: 0, KindDomainEmpty: 0},
		},
		{
			name:      "同子系统多个未落位文件只聚合成一条",
			target:    gapTarget(99, gapDomains()...),
			view:      gapView("app/api/a.go", "app/worker/w.go", "app/f1.go", "app/f2.go", "app/f3.go", "app/f4.go", "app/f5.go", "app/f6.go", "app/f7.go"),
			wantWarns: map[string]int{KindUnplaced: 1, KindDomainEmpty: 0},
			// 样例固定为字典序前 5 条，第 6、7 条不得出现——否则大包会刷屏且输出不可 diff。
			wantDetail:   []string{"7/99", "app/f1.go", "app/f5.go"},
			unwantDetail: []string{"app/f6.go", "app/f7.go"},
		},
		{
			name:      "每个零命中目标领域各一条 domain-empty",
			target:    gapTarget(0, gapDomains()...),
			view:      gapView("other/x.go"),
			wantWarns: map[string]int{KindDomainEmpty: 2, KindUnplaced: 0},
			// 两条 Detail 各带自己的目标域 id。
			wantDetail: []string{"d_api", "d_worker"},
		},
		{
			// dir/** 是「目录整段」而不是「字符串前缀」。真实动机是 handoff 的竖切：
			// internal/task/** 绝不能顺手把 internal/taskrunner/ 也吞进任务域，否则
			// 竖切边界一开始就是假的，而 unplaced 会假性归零、让人以为已经切完。
			name:         "兄弟目录前缀不得被 dir/** 规则误盖",
			target:       gapTarget(0, TargetDomain{ID: "d_api", Name: "API", Responsibility: "对外接口", Paths: []string{"app/api/**"}}),
			view:         gapView("app/api/x.go", "app/apix.go", "app/api-v2/x.go"),
			wantFails:    map[string]int{KindUnplacedOverBudget: 1},
			wantWarns:    map[string]int{KindUnplaced: 0, KindDomainEmpty: 0},
			wantDetail:   []string{"2/0", "app/apix.go", "app/api-v2/x.go"},
			unwantDetail: []string{"app/api/x.go"},
		},
		{
			// 精确路径规则只认那一个文件：它既不能盖住同目录的兄弟文件，自己也必须
			// 被认出来。删掉精确分支后本域会一个文件都命中不了，未落位从 1 变 2、
			// 还会多冒一条 domain-empty——三个断言各自都能把它拦下。
			name:         "精确路径目标领域只盖那一个文件",
			target:       gapTarget(0, TargetDomain{ID: "d_exact", Name: "单文件域", Responsibility: "只管一个文件", Paths: []string{"app/api/x.go"}}),
			view:         gapView("app/api/x.go", "app/api/y.go"),
			wantFails:    map[string]int{KindUnplacedOverBudget: 1},
			wantWarns:    map[string]int{KindUnplaced: 0, KindDomainEmpty: 0},
			wantDetail:   []string{"1/0", "app/api/y.go"},
			unwantDetail: []string{"app/api/x.go"},
		},
		{
			// 兄弟前缀在 domain-empty 这条判据上的表现：app/apix.go 不算 app/api/**
			// 的命中，所以该目标域是空域，同时那个文件自己计入未落位。上面两例断的是
			// unplaced 计数，这条断的是空域信号——同一个边界，两种可观测后果。
			name:       "兄弟目录前缀不算命中，空目标领域仍报 domain-empty",
			target:     gapTarget(9, TargetDomain{ID: "d_api", Name: "API", Responsibility: "对外接口", Paths: []string{"app/api/**"}}),
			view:       gapView("app/apix.go"),
			wantFails:  map[string]int{KindUnplacedOverBudget: 0},
			wantWarns:  map[string]int{KindDomainEmpty: 1, KindUnplaced: 1},
			wantDetail: []string{"d_api", "app/apix.go"},
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			rep := Check(tc.target, tc.view)
			for kind, want := range tc.wantFails {
				if got := len(findingsOfKind(rep.Fails, kind)); got != want {
					t.Errorf("fails 中 %s 应有 %d 条，实际 %d 条: %+v", kind, want, got, rep.Fails)
				}
			}
			for kind, want := range tc.wantWarns {
				if got := len(findingsOfKind(rep.Warns, kind)); got != want {
					t.Errorf("warns 中 %s 应有 %d 条，实际 %d 条: %+v", kind, want, got, rep.Warns)
				}
			}
			gap := append(append([]Finding{}, gapFindings(rep.Fails)...), gapFindings(rep.Warns)...)
			joined := ""
			for _, f := range gap {
				joined += f.Detail + "\n"
				// 契约 §4 冻结 23：gap finding 一律 From=子系统 id、To 省略。
				if f.From != "d_app" || f.To != "" {
					t.Errorf("gap finding 的 From/To 形状不对: %+v", f)
				}
			}
			for _, want := range tc.wantDetail {
				if !strings.Contains(joined, want) {
					t.Errorf("gap Detail 应含 %q，实际:\n%s", want, joined)
				}
			}
			for _, unwanted := range tc.unwantDetail {
				if strings.Contains(joined, unwanted) {
					t.Errorf("gap Detail 不应含 %q，实际:\n%s", unwanted, joined)
				}
			}
		})
	}
}

func gapFindings(findings []Finding) []Finding {
	var out []Finding
	for _, f := range findings {
		switch f.Kind {
		case KindUnplaced, KindUnplacedOverBudget, KindDomainEmpty:
			out = append(out, f)
		}
	}
	return out
}

// deleted 节点只为渲染保留，不代表当前分支还有这个文件：它既不能撑起未落位计数，
// 也不能让一个目标域看起来「已经有代码了」。
func TestCheckTargetDomainExcludesDeletedNodes(t *testing.T) {
	target := gapTarget(0, TargetDomain{ID: "d_api", Name: "API", Responsibility: "r", Paths: []string{"app/api/**"}})
	v := gapView("app/api/gone.go", "app/loose.go")
	for id, node := range v.Nodes {
		if node.File == "app/api/gone.go" || node.File == "app/loose.go" {
			node.Status = "deleted"
			v.Nodes[id] = node
		}
	}
	rep := Check(target, v)
	if got := len(findingsOfKind(rep.Fails, KindUnplacedOverBudget)); got != 0 {
		t.Errorf("deleted 文件不应撑起未落位计数: %+v", rep.Fails)
	}
	if got := len(findingsOfKind(rep.Warns, KindDomainEmpty)); got != 1 {
		t.Errorf("目标域只被 deleted 节点命中时仍应算零命中: %+v", rep.Warns)
	}
}

// 真实迁移回归：把 svc/server.go 搬进 svc/api/ 后，未落位数必须自己降下来——
// 这条是用户故事 3「搬文件使 unplaced 下降」的可执行判据，不是构造视图能糊弄的。
func TestCheckTargetDomainUnplacedDropsAfterRealMerge(t *testing.T) {
	g := loadFixture(t)
	target := &Target{
		Meta: TargetMeta{Version: 2},
		Subsystems: []TargetSubsystem{
			{ID: "d_svc", Name: "服务", Type: "logic", Paths: []string{"svc/**"}, UnplacedBudget: 99,
				Domains: []TargetDomain{{ID: "d_svc_api", Name: "API", Responsibility: "对外方法", Paths: []string{"svc/api/**"}}}},
			{ID: "d_cmd", Name: "入口", Type: "logic", Paths: []string{"cmd/**"}},
			{ID: "d_web", Name: "前端", Type: "boundary", Paths: []string{"web/**"}},
		},
	}
	if issues := ValidateTarget(target); len(issues) != 0 {
		t.Fatalf("迁移回归用的目标图自身必须合法: %v", issues)
	}

	before := Check(target, Merge(g, nil))
	beforeGap := findingsOfKind(before.Warns, KindUnplaced)
	if len(beforeGap) != 1 || !strings.Contains(beforeGap[0].Detail, "3/99") {
		t.Fatalf("迁移前 svc/** 应有 3 个未落位文件: %+v", before.Warns)
	}

	moved := g.Nodes["n_do"]
	moved.File = "svc/api/server.go"
	movedSave := g.Nodes["n_save"]
	movedSave.File = "svc/api/server.go"
	after := Check(target, Merge(g, &Diff{View: "branch-migrate", NodesModified: map[string]Node{"n_do": moved, "n_save": movedSave}}))
	afterGap := findingsOfKind(after.Warns, KindUnplaced)
	if len(afterGap) != 1 || !strings.Contains(afterGap[0].Detail, "2/99") {
		t.Fatalf("把 svc/server.go 搬进 svc/api/ 后未落位应降到 2/99: %+v", after.Warns)
	}
	if hasFinding(after.Warns, KindDomainEmpty) {
		t.Fatalf("目标域被真实文件命中后不应再报 domain-empty: %+v", after.Warns)
	}
}

// 三种新 kind 必须能原样穿过 Report 的 JSON 编解码——查看器与 CLI 消费的就是这层 wire。
func TestCheckTargetDomainFindingsSurviveReportJSON(t *testing.T) {
	rep := Check(gapTarget(0, gapDomains()...), gapView("app/loose.go"))
	raw, err := json.Marshal(rep)
	if err != nil {
		t.Fatalf("编码 Report: %v", err)
	}
	var decoded Report
	if err := json.Unmarshal(raw, &decoded); err != nil {
		t.Fatalf("回读 Report: %v", err)
	}
	if !reflect.DeepEqual(rep.Fails, decoded.Fails) || !reflect.DeepEqual(rep.Warns, decoded.Warns) {
		t.Fatalf("Report JSON 回读后 finding 不一致:\n原始 %+v\n回读 %+v", rep, decoded)
	}
	over := findingsOfKind(decoded.Fails, KindUnplacedOverBudget)
	empty := findingsOfKind(decoded.Warns, KindDomainEmpty)
	if len(over) != 1 || over[0].From != "d_app" || over[0].To != "" || over[0].Detail == "" {
		t.Fatalf("unplaced-over-budget 未完整穿过 JSON: %+v", decoded.Fails)
	}
	if len(empty) != 2 {
		t.Fatalf("domain-empty 未完整穿过 JSON: %+v", decoded.Warns)
	}
	// To 省略是 wire 契约（冻结 23），不能编成 "to":""。
	if strings.Contains(string(raw), `"to":""`) {
		t.Fatalf("gap finding 的 To 必须省略而不是空串: %s", raw)
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
