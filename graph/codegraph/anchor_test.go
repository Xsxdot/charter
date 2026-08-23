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
