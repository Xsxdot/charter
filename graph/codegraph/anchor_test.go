package codegraph

import (
	"strings"
	"testing"
)

// anchorView 造一个带领域层的视图：mkView 不设 Domains、也不给容器填 Domain，
// 而锚归属判据全靠「节点→容器→领域」这条链，所以这里单独造。
// nodes: 节点 id → [容器 id, 文件路径]；containers: 容器 id → 领域 id（空串表示容器不归域）。
func anchorView(domains []string, containers map[string]string, nodes map[string][2]string) *View {
	v := &View{
		Domains:    map[string]Domain{},
		Containers: map[string]Container{},
		Nodes:      map[string]ViewNode{},
	}
	for _, d := range domains {
		v.Domains[d] = Domain{Label: d}
	}
	for cid, dom := range containers {
		v.Containers[cid] = Container{Label: cid, Domain: dom}
	}
	for id, cf := range nodes {
		v.Nodes[id] = ViewNode{Node: Node{Container: cf[0], File: cf[1], Name: id}}
	}
	return v
}

// 标准夹具：两个域，d_task 的容器里有 Handle，d_other 的容器里有 Steal。
func stdAnchorView() *View {
	return anchorView(
		[]string{"d_task", "d_other"},
		map[string]string{"k_task": "d_task", "k_other": "d_other"},
		map[string][2]string{
			"Handle": {"k_task", "task/handle.go"},
			"Steal":  {"k_other", "other/steal.go"},
		},
	)
}

func lifecycleDecl(domain, from, to string) map[string]DomainDecl {
	return map[string]DomainDecl{
		domain: {Domain: domain, Responsibility: "测试用", Lifecycle: &DeclAnchor{From: from, To: to}},
	}
}

func anchorFindings(rep *Report) []Finding {
	var out []Finding
	for _, f := range rep.Warns {
		if f.Kind == KindAnchorOffDomain || f.Kind == KindAnchorOffGraph {
			out = append(out, f)
		}
	}
	return out
}

func TestCheckAnchorOwnership(t *testing.T) {
	cases := []struct {
		name      string
		view      *View
		decls     map[string]DomainDecl
		wantKinds []string // 期望的 kind 序列（按输出顺序）
		wantIn    []string // 报文必须含的串
	}{
		{
			name:  "锚在本域且在图内：零 finding",
			view:  stdAnchorView(),
			decls: lifecycleDecl("d_task", "task/handle.go#Handle", ""),
		},
		{
			name:      "锚落在别人家的域",
			view:      stdAnchorView(),
			decls:     lifecycleDecl("d_task", "other/steal.go#Steal", ""),
			wantKinds: []string{KindAnchorOffDomain},
			wantIn:    []string{"other/steal.go#Steal"},
		},
		{
			name:      "锚在图内无节点",
			view:      stdAnchorView(),
			decls:     lifecycleDecl("d_task", "internal/proto/proto.go#transitTable", ""),
			wantKinds: []string{KindAnchorOffGraph},
			wantIn:    []string{"internal/proto/proto.go#transitTable"},
		},
		{
			name:  "声明的域不在图中：整个 decl 跳过",
			view:  stdAnchorView(),
			decls: lifecycleDecl("d_ghost", "other/steal.go#Steal", ""),
		},
		{
			name:  "锚格式非法：跳过（格式是 validate 的职责）",
			view:  stdAnchorView(),
			decls: lifecycleDecl("d_task", "没有井号", ""),
		},
		{
			name:  "锚格式非法（井号右侧空）：跳过",
			view:  stdAnchorView(),
			decls: lifecycleDecl("d_task", "task/handle.go#", ""),
		},
		{
			name: "容器不归任何域：跳过（旧扫描数据的降级形态）",
			view: anchorView([]string{"d_task"},
				map[string]string{"k_loose": ""},
				map[string][2]string{"Handle": {"k_loose", "task/handle.go"}}),
			decls: lifecycleDecl("d_task", "task/handle.go#Handle", ""),
		},
		{
			name: "容器根本不存在：跳过",
			view: anchorView([]string{"d_task"},
				map[string]string{},
				map[string][2]string{"Handle": {"k_missing", "task/handle.go"}}),
			decls: lifecycleDecl("d_task", "task/handle.go#Handle", ""),
		},
		{
			name:      "同一 decl 的 from 与 to 各判各的",
			view:      stdAnchorView(),
			decls:     lifecycleDecl("d_task", "other/steal.go#Steal", "nowhere/x.go#Gone"),
			wantKinds: []string{KindAnchorOffDomain, KindAnchorOffGraph},
		},
		{
			name: "重复的锚原文不去重：写两遍就是两条",
			view: stdAnchorView(),
			decls: map[string]DomainDecl{"d_task": {
				Domain: "d_task", Responsibility: "测试用",
				StateMachine: []Transition{
					{From: "a", To: "b", Anchor: "other/steal.go#Steal"},
					{From: "b", To: "c", Anchor: "other/steal.go#Steal"},
				},
			}},
			wantKinds: []string{KindAnchorOffDomain, KindAnchorOffDomain},
		},
		{
			name:  "decls 为 nil：整体跳过",
			view:  stdAnchorView(),
			decls: nil,
		},
		{
			name:  "decls 为空 map：整体跳过",
			view:  stdAnchorView(),
			decls: map[string]DomainDecl{},
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			rep := Check(&Target{Meta: TargetMeta{Version: 2}}, tc.view, tc.decls)
			got := anchorFindings(rep)
			if len(got) != len(tc.wantKinds) {
				t.Fatalf("期望 %d 条锚 finding，实际 %d 条: %+v", len(tc.wantKinds), len(got), got)
			}
			for i, want := range tc.wantKinds {
				if got[i].Kind != want {
					t.Errorf("第 %d 条 kind 应为 %s，实际 %s", i, want, got[i].Kind)
				}
			}
			joined := ""
			for _, f := range got {
				joined += f.Detail + "\n"
			}
			for _, want := range tc.wantIn {
				if !strings.Contains(joined, want) {
					t.Errorf("报文应含 %q，实际:\n%s", want, joined)
				}
			}
			// 锚 finding 一律进 Warns，永不进 Fails（契约 6）
			for _, f := range rep.Fails {
				if f.Kind == KindAnchorOffDomain || f.Kind == KindAnchorOffGraph {
					t.Errorf("锚 finding 不得进 Fails: %+v", f)
				}
			}
		})
	}
}

// 契约 7、8：From/To 的用法。off-domain 要能一眼看出「谁声明的、实际落在哪」，
// 这两个字段就是查看器与 CLI 做归因的唯一结构化入口，写错就只能靠人读 Detail。
func TestCheckAnchorFindingFields(t *testing.T) {
	rep := Check(&Target{Meta: TargetMeta{Version: 2}}, stdAnchorView(),
		lifecycleDecl("d_task", "other/steal.go#Steal", "nowhere/x.go#Gone"))
	got := anchorFindings(rep)
	if len(got) != 2 {
		t.Fatalf("应有 2 条: %+v", got)
	}
	var offDomain, offGraph Finding
	for _, f := range got {
		switch f.Kind {
		case KindAnchorOffDomain:
			offDomain = f
		case KindAnchorOffGraph:
			offGraph = f
		}
	}
	if offDomain.From != "d_task" || offDomain.To != "d_other" {
		t.Errorf("off-domain 的 From 应是声明方 d_task、To 应是实际所属 d_other，实际 From=%q To=%q", offDomain.From, offDomain.To)
	}
	if offGraph.From != "d_task" || offGraph.To != "" {
		t.Errorf("off-graph 的 From 应是 d_task、To 必须为空串，实际 From=%q To=%q", offGraph.From, offGraph.To)
	}
}

// 契约 19：多个 decl 时按 Domain 字典序遍历。
//
// **必须直呼 anchorOwnershipFindings，不能走 Check。** 初版这条测试是经 Check
// 写的，实测把函数里的 sort.Strings 整行删掉它照样全绿——因为 Check 末尾的
// sortFindings 已经把结果重排了一遍，测试测的是调用方的行为，不是本函数的。
// 那样的测试是摆设：将来若 sortFindings 的排序键变了，本函数的乱序会当场暴露，
// 而这条测试不会响。
func TestAnchorFindingsDeterministicOrder(t *testing.T) {
	v := anchorView(
		[]string{"d_a", "d_b", "d_c", "d_home"},
		map[string]string{"k_home": "d_home"},
		map[string][2]string{"Sym": {"k_home", "home/x.go"}},
	)
	decls := map[string]DomainDecl{}
	for _, d := range []string{"d_c", "d_a", "d_b"} {
		decls[d] = DomainDecl{Domain: d, Responsibility: "测试用",
			Lifecycle: &DeclAnchor{From: "home/x.go#Sym"}}
	}
	var first []string
	for i := 0; i < 12; i++ {
		var order []string
		for _, f := range anchorOwnershipFindings(v, decls) {
			order = append(order, f.From)
		}
		if i == 0 {
			first = order
			continue
		}
		if strings.Join(order, ",") != strings.Join(first, ",") {
			t.Fatalf("第 %d 次遍历顺序与首次不同: %v vs %v", i, order, first)
		}
	}
	if strings.Join(first, ",") != "d_a,d_b,d_c" {
		t.Errorf("应按 Domain 字典序，实际: %v", first)
	}
}

// 契约 15 的另一半：井号**左侧**为空。审计发现 committed 用例只覆盖了「没有井号」
// 与「右侧为空」两种，删掉 file == "" 那半边判据全量仍绿——而真实后果不是漏报，
// 是产出一条**假的** anchor-off-graph（空文件名当然解析不到节点）。
func TestAnchorSkipsRefWithEmptyFileSide(t *testing.T) {
	got := anchorOwnershipFindings(stdAnchorView(), lifecycleDecl("d_task", "#Handle", ""))
	if len(got) != 0 {
		t.Fatalf("锚 %q 左侧为空属格式非法，应跳过而不是报 off-graph，实际: %+v", "#Handle", got)
	}
}

// 契约 18 的顺序面：同一 decl 内 from 与 to 的发出序也要稳定。审计发现对调
// []string{Lifecycle.From, Lifecycle.To} 全量仍绿——「本函数自己的输出顺序自己
// 负责」这条纪律只兑现了跨 decl 的一半。
func TestAnchorRefsFollowDeclaredOrderWithinOneDecl(t *testing.T) {
	v := anchorView([]string{"d_task", "d_a", "d_b"},
		map[string]string{"k_a": "d_a", "k_b": "d_b"},
		map[string][2]string{"Alpha": {"k_a", "x/a.go"}, "Beta": {"k_b", "x/b.go"}})
	// from 落 d_a、to 落 d_b：两条都是 off-domain，靠 To 区分先后
	got := anchorOwnershipFindings(v, lifecycleDecl("d_task", "x/a.go#Alpha", "x/b.go#Beta"))
	if len(got) != 2 {
		t.Fatalf("应有 2 条: %+v", got)
	}
	if got[0].To != "d_a" || got[1].To != "d_b" {
		t.Errorf("应按 lifecycle 声明序 from→to 发出，实际 [%s %s]", got[0].To, got[1].To)
	}
	// stateMachine 排在 lifecycle 之后
	d := DomainDecl{Domain: "d_task", Responsibility: "x",
		Lifecycle:    &DeclAnchor{From: "x/b.go#Beta"},
		StateMachine: []Transition{{From: "s", To: "t", Anchor: "x/a.go#Alpha"}}}
	got = anchorOwnershipFindings(v, map[string]DomainDecl{"d_task": d})
	if len(got) != 2 || got[0].To != "d_b" || got[1].To != "d_a" {
		t.Errorf("lifecycle 应排在 stateMachine 之前，实际: %+v", got)
	}
}

// 契约 20：锚 finding 必须与既有 finding 一同经 sortFindings 重排，而不是排完再追加。
//
// 审计发现这条零守卫：把 anchorOwnershipFindings 的 append 挪到 sortFindings 之后，
// 全量仍绿。原因是 committed 的锚用例产出的 warns **只有锚这一种 kind**，混排顺序
// 从未被观测过。这里刻意造出两种 kind 共存的局面：anchor-off-domain 字典序在
// domain-empty 之前，若锚是排完才追加的，它会掉到末尾。
func TestCheckAnchorFindingsParticipateInFinalSort(t *testing.T) {
	v := anchorView([]string{"d_task", "d_other"},
		map[string]string{"k_task": "d_task", "k_other": "d_other"},
		map[string][2]string{"Steal": {"k_other", "svc/steal.go"}})
	// 目标图声明一个零命中的目标域 → 产出 domain-empty；锚落在别人家 → off-domain
	tg := &Target{
		Meta: TargetMeta{Version: 2},
		Subsystems: []TargetSubsystem{{
			ID: "d_svc", Type: "logic", Paths: []string{"svc/**"}, UnplacedBudget: 99,
			Domains: []TargetDomain{{ID: "dt_ghost", Name: "空域", Responsibility: "无成员", Paths: []string{"svc/ghost/**"}}},
		}},
	}
	rep := Check(tg, v, lifecycleDecl("d_task", "svc/steal.go#Steal", ""))

	kinds := make([]string, 0, len(rep.Warns))
	for _, w := range rep.Warns {
		kinds = append(kinds, w.Kind)
	}
	// 前置：这个夹具必须真的产出两种以上 kind，否则本测试观测不到顺序
	seen := map[string]bool{}
	for _, k := range kinds {
		seen[k] = true
	}
	if !seen[KindAnchorOffDomain] || len(seen) < 2 {
		t.Fatalf("夹具失效：需要锚 finding 与至少一种其他 kind 共存，实际 %v", kinds)
	}
	// 全序断言：Warns 必须整体按 (Kind, Detail) 有序
	for i := 1; i < len(rep.Warns); i++ {
		a, b := rep.Warns[i-1], rep.Warns[i]
		if a.Kind > b.Kind || (a.Kind == b.Kind && a.Detail > b.Detail) {
			t.Fatalf("Warns 未整体排序（锚 finding 可能是排完才追加的）：第 %d 条 %s 排在 %s 之前\n完整序列: %v",
				i, a.Kind, b.Kind, kinds)
		}
	}
}

// 父域声明覆盖子域里的锚。领域是树、容器只能挂叶子，所以写在父域上的声明其锚
// 必然落在子域——严格相等会让这类声明 100% 假阳（审计 F8）。
func TestAnchorParentDomainCoversChildDomain(t *testing.T) {
	v := &View{
		Domains: map[string]Domain{
			"d_svc":       {Label: "服务"},
			"d_svc/api":   {Label: "接口", Parent: "d_svc"},
			"d_svc/store": {Label: "存储", Parent: "d_svc"},
			"d_other":     {Label: "别处"},
		},
		Containers: map[string]Container{
			"k_api":   {Domain: "d_svc/api"},
			"k_other": {Domain: "d_other"},
		},
		Nodes: map[string]ViewNode{
			"Handle": {Node: Node{Container: "k_api", File: "svc/api/h.go", Name: "Handle"}},
			"Steal":  {Node: Node{Container: "k_other", File: "other/s.go", Name: "Steal"}},
		},
	}
	if got := anchorOwnershipFindings(v, lifecycleDecl("d_svc", "svc/api/h.go#Handle", "")); len(got) != 0 {
		t.Errorf("父域 d_svc 的声明，锚落在子域 d_svc/api，应视为在域内，实际: %+v", got)
	}
	// 反向不成立：子域声明、锚落在父域的另一个子域，仍是离域
	if got := anchorOwnershipFindings(v, lifecycleDecl("d_svc/store", "svc/api/h.go#Handle", "")); len(got) != 1 {
		t.Errorf("兄弟域之间不互相覆盖，应报 1 条离域，实际: %+v", got)
	}
	// 树外仍是离域
	if got := anchorOwnershipFindings(v, lifecycleDecl("d_svc", "other/s.go#Steal", "")); len(got) != 1 {
		t.Errorf("锚落在树外的 d_other，应报离域，实际: %+v", got)
	}
	// 父链成环时不死循环（数据脏由 validateDomains 报硬 issue，此处只求不挂）
	cyc := &View{
		Domains:    map[string]Domain{"a": {Parent: "b"}, "b": {Parent: "a"}},
		Containers: map[string]Container{"k": {Domain: "a"}},
		Nodes:      map[string]ViewNode{"S": {Node: Node{Container: "k", File: "x.go", Name: "S"}}},
	}
	_ = anchorOwnershipFindings(cyc, lifecycleDecl("b", "x.go#S", "")) // 不 panic、不挂起即通过
}
