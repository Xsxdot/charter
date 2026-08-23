package codegraph

import (
	"path/filepath"
	"reflect"
	"strings"
	"testing"
)

func loadFixture(t *testing.T) *Graph {
	t.Helper()
	g, err := LoadGraph(filepath.Join("testdata", "repo"))
	if err != nil {
		t.Fatal(err)
	}
	return g
}

func TestValidateCleanFixture(t *testing.T) {
	if issues := Validate(loadFixture(t)); len(issues) != 0 {
		t.Fatalf("夹具应当干净: %v", issues)
	}
}

func TestValidateCatchesBrokenRefs(t *testing.T) {
	g := loadFixture(t)
	n := g.Nodes["n_do"]
	n.Container = "k_ghost"
	g.Nodes["n_do"] = n
	g.Edges = append(g.Edges, Edge{"n_do", "n_ghost"})
	issues := Validate(g)
	if len(issues) != 2 {
		t.Fatalf("应报 2 条: %v", issues)
	}
	// 报文必须带引用者 id，否则修数据要靠猜
	if !strings.Contains(issues[0], "n_do") || !strings.Contains(issues[1], "n_ghost") {
		t.Fatalf("报文缺上下文: %v", issues)
	}
}

func TestValidateImplementsRefs(t *testing.T) {
	g := &Graph{
		Containers: map[string]Container{"k": {Label: "svc"}},
		Nodes:      map[string]Node{"n1": {Container: "k", File: "svc/a.go"}},
		Implements: []Edge{{"n1", "n_missing"}},
	}
	issues := Validate(g)
	found := false
	for _, is := range issues {
		if strings.Contains(is, "implements") && strings.Contains(is, "n_missing") {
			found = true
		}
	}
	if !found {
		t.Fatalf("implements 悬空引用未报: %v", issues)
	}
}

func TestValidateDiff(t *testing.T) {
	g := loadFixture(t)
	d, _ := LoadDiff(filepath.Join("testdata", "repo"), "branch-x")
	if issues := ValidateDiff(g, d); len(issues) != 0 {
		t.Fatalf("夹具 diff 应当干净: %v", issues)
	}
	d.NodesDeleted = append(d.NodesDeleted, "n_ghost") // 删除不存在的节点
	d.EdgesAdded = append(d.EdgesAdded, Edge{"n_audit", "n_ghost"})
	if issues := ValidateDiff(g, d); len(issues) != 2 {
		t.Fatalf("应报 2 条: %v", issues)
	}
}

func TestValidateDomains(t *testing.T) {
	g := &Graph{
		Domains: map[string]Domain{
			"d_svc":     {Label: "svc", Kind: "服务端", Summary: "服务"},
			"d_svc/api": {Label: "api", Kind: "接口层", Summary: "路由", Parent: "d_svc"},
			"d_ghosted": {Label: "孤儿", Kind: "x", Parent: "d_nope"},
		},
		Containers: map[string]Container{
			"k_api":  {Label: "svc.Server", Kind: "服务端", Domain: "d_svc/api"},
			"k_core": {Label: "svc.Manager", Kind: "核心", Domain: "d_svc"},
			"k_lost": {Label: "svc.Store", Kind: "存储", Domain: "d_ghost"},
			"k_none": {Label: "svc.Util", Kind: "工具"},
		},
		Nodes: map[string]Node{},
		Edges: []Edge{},
	}
	want := []string{
		"容器 k_core 挂在非叶子领域 d_svc（容器只能挂叶子领域）",
		"容器 k_lost 引用不存在的领域 d_ghost",
		"容器 k_none 未归属领域（domains 非空时每个容器都必须有 domain）",
		"领域 d_ghosted 的 parent d_nope 不存在",
	}
	if got := Validate(g); !reflect.DeepEqual(got, want) {
		t.Fatalf("领域校验:\n got=%q\nwant=%q", got, want)
	}
}

func TestValidateDomainParentCycle(t *testing.T) {
	g := &Graph{
		Domains: map[string]Domain{
			"d_a": {Label: "a", Kind: "x", Parent: "d_b"},
			"d_b": {Label: "b", Kind: "x", Parent: "d_a"},
		},
		Containers: map[string]Container{},
		Nodes:      map[string]Node{},
	}
	got := Validate(g)
	if len(got) != 2 || !strings.Contains(got[0], "父链存在环") {
		t.Fatalf("父链成环应逐个领域报出: %q", got)
	}
}

func TestValidateNoDomainsSectionIsClean(t *testing.T) {
	// 旧扫描数据没有 domains 段：整段校验跳过，不得因此报问题
	g := &Graph{
		Containers: map[string]Container{"k_svc": {Label: "svc", Kind: "服务端"}},
		Nodes:      map[string]Node{},
	}
	if got := Validate(g); len(got) != 0 {
		t.Fatalf("无领域段应零问题: %q", got)
	}
}

func TestValidateLifecycleRefs(t *testing.T) {
	base := loadFixture(t)
	cases := []struct {
		name string
		ref  LifecycleRef
		want string
	}{
		{"Who 缺失", LifecycleRef{Who: "n_ghost", Model: "m_task", Kind: "creator"}, "Who"},
		{"Model 缺失", LifecycleRef{Who: "n_do", Model: "m_ghost", Kind: "creator"}, "Model"},
		{"Model 非 model", LifecycleRef{Who: "n_do", Model: "n_save", Kind: "creator"}, "model"},
		{"Kind 非法", LifecycleRef{Who: "n_do", Model: "m_task", Kind: "reader"}, "kind"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			g := *base
			g.Lifecycle = []LifecycleRef{tc.ref}
			issues := Validate(&g)
			found := false
			for _, issue := range issues {
				if strings.Contains(issue, tc.want) {
					found = true
				}
			}
			if !found {
				t.Fatalf("lifecycle 问题 %q 未报告: %v", tc.want, issues)
			}
		})
	}
}

func TestValidateDiffLifecycleRefs(t *testing.T) {
	g := loadFixture(t)
	d := &Diff{
		NodesAdded: map[string]Node{
			"n_audit":       {Kind: "func", Container: "k_ent", File: "svc/audit.go"},
			"n_added_model": {Kind: "model", Container: "k_ent", File: "svc/added.go"},
		},
		LifecycleAdded:   []LifecycleRef{{Who: "n_audit", Model: "m_task", Kind: "writer", Field: "status"}},
		LifecycleDeleted: []LifecycleRef{{Who: "n_added_model", Model: "m_task", Kind: "creator"}},
	}
	if issues := ValidateDiff(g, d); len(issues) != 0 {
		t.Fatalf("基线和新增节点组成的端点应合法: %v", issues)
	}
	for _, tc := range []struct {
		name string
		ref  LifecycleRef
		want string
	}{
		{"Who 缺失", LifecycleRef{Who: "n_ghost", Model: "m_task", Kind: "creator"}, "n_ghost"},
		{"Model 缺失", LifecycleRef{Who: "n_audit", Model: "m_ghost", Kind: "creator"}, "m_ghost"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			d.LifecycleAdded = []LifecycleRef{tc.ref}
			issues := ValidateDiff(g, d)
			found := false
			for _, issue := range issues {
				if strings.Contains(issue, tc.want) {
					found = true
				}
			}
			if !found {
				t.Fatalf("lifecycle diff 问题 %q 未报告: %v", tc.want, issues)
			}
		})
	}
}

func TestValidateDiffAllowsNodeInAddedContainer(t *testing.T) {
	g := loadFixture(t)
	d := &Diff{
		ContainersAdded: map[string]Container{
			"k_new": {Label: "new.Server", Domain: "d_svc/api"},
		},
		NodesAdded: map[string]Node{
			"n_new": {Kind: "func", Container: "k_new", File: "svc/new.go"},
		},
	}
	if issues := ValidateDiff(g, d); len(issues) != 0 {
		t.Fatalf("新增节点引用新增容器不应报问题: %v", issues)
	}
}

func TestValidateDiffStillRejectsNodeInUnknownContainer(t *testing.T) {
	g := loadFixture(t)
	d := &Diff{NodesAdded: map[string]Node{
		"n_new": {Kind: "func", Container: "k_unknown", File: "svc/new.go"},
	}}
	issues := ValidateDiff(g, d)
	if len(issues) == 0 || !strings.Contains(strings.Join(issues, "\n"), "k_unknown") {
		t.Fatalf("真正未知的容器仍必须报问题: %v", issues)
	}
}

func TestValidateDiffRejectsAddedContainerConflict(t *testing.T) {
	g := loadFixture(t)
	d := &Diff{ContainersAdded: map[string]Container{
		"k_svc": {Label: "replacement", Domain: "d_svc/api"},
	}}
	issues := ValidateDiff(g, d)
	if len(issues) == 0 || !strings.Contains(strings.Join(issues, "\n"), "k_svc") {
		t.Fatalf("新增容器覆盖基线 id 应报 k_svc: %v", issues)
	}
}

func TestValidateDiffRejectsAddedContainerWithoutDomain(t *testing.T) {
	g := loadFixture(t)
	d := &Diff{ContainersAdded: map[string]Container{
		"k_no_domain": {Label: "new.Server"},
	}}
	issues := ValidateDiff(g, d)
	if len(issues) == 0 || !strings.Contains(strings.Join(issues, "\n"), "k_no_domain") {
		t.Fatalf("无 domain 的新增容器应报 k_no_domain: %v", issues)
	}
}

func TestValidateDiffRejectsAddedContainerUnknownDomain(t *testing.T) {
	g := loadFixture(t)
	d := &Diff{ContainersAdded: map[string]Container{
		"k_bad_domain": {Label: "new.Server", Domain: "d_missing"},
	}}
	issues := ValidateDiff(g, d)
	if len(issues) == 0 || !strings.Contains(strings.Join(issues, "\n"), "k_bad_domain") || !strings.Contains(strings.Join(issues, "\n"), "d_missing") {
		t.Fatalf("未知 domain 的新增容器应同时带 id 与 domain: %v", issues)
	}
}

// modelKind 执法（契约 21~24）。第 24 条是**反向**断言：entity 无 lifecycle
// 只计数不报错——沿用 validate 「统计 unscanned 但不报 issue」的先例，若把它
// 执法成硬红，707 个 model 补标期间 validate 会长期不可用。
func TestValidateModelKind(t *testing.T) {
	cases := []struct {
		name      string
		modelKind string
		onNode    string // 挂到哪个节点，缺省 m_task（model）
		lifecycle []LifecycleRef
		want      string // 期望报文含此串；空串＝期望**不**报
	}{
		{name: "枚举外取值报错", modelKind: "vo", want: "modelKind"},
		{name: "挂在非 model 节点上报错", modelKind: ModelKindEntity, onNode: "n_do", want: "modelKind"},
		{
			name:      "dto 却有 writer 是自相矛盾",
			modelKind: ModelKindDTO,
			lifecycle: []LifecycleRef{{Who: "n_do", Model: "m_task", Kind: "writer"}},
			want:      "dto",
		},
		{name: "空值放行", modelKind: "", want: ""},
		{name: "entity 无 lifecycle 不报错", modelKind: ModelKindEntity, want: ""},
		{
			name:      "dto 只有 creator 不算矛盾",
			modelKind: ModelKindDTO,
			lifecycle: []LifecycleRef{{Who: "n_do", Model: "m_task", Kind: "creator"}},
			want:      "",
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			g := loadFixture(t)
			target := tc.onNode
			if target == "" {
				target = "m_task"
			}
			n := g.Nodes[target]
			n.ModelKind = tc.modelKind
			g.Nodes[target] = n
			g.Lifecycle = tc.lifecycle
			issues := Validate(g)
			hit := ""
			for _, is := range issues {
				if tc.want != "" && strings.Contains(is, tc.want) {
					hit = is
				}
			}
			if tc.want == "" {
				// 反向断言：不能出现任何提到 modelKind 的 issue
				for _, is := range issues {
					if strings.Contains(is, "modelKind") || strings.Contains(is, "dto") {
						t.Fatalf("不应报 modelKind 相关 issue，实际: %v", issues)
					}
				}
				return
			}
			if hit == "" {
				t.Fatalf("期望报文含 %q，实际 issues: %v", tc.want, issues)
			}
		})
	}
}

// 契约 24 的「只计数」那一半。审计发现 EntitiesWithoutLifecycle 全仓零测试，
// 整个掏空成 return 0 全量仍绿——而契约 §5-5 的验收数字「全仓 entity ≈53」
// 正是从这个函数读出来的。
func TestEntitiesWithoutLifecycle(t *testing.T) {
	cases := []struct {
		name      string
		marks     map[string]string // 节点 → modelKind
		lifecycle []LifecycleRef
		want      int
	}{
		{name: "没有任何 entity 标记时为 0", want: 0},
		{name: "标了 entity 且无 lifecycle 计 1", marks: map[string]string{"m_task": ModelKindEntity}, want: 1},
		{
			name:      "有 creator 即算覆盖",
			marks:     map[string]string{"m_task": ModelKindEntity},
			lifecycle: []LifecycleRef{{Who: "n_do", Model: "m_task", Kind: "creator"}},
			want:      0,
		},
		{
			name:      "有 writer 也算覆盖（不分种类）",
			marks:     map[string]string{"m_task": ModelKindEntity},
			lifecycle: []LifecycleRef{{Who: "n_do", Model: "m_task", Kind: "writer"}},
			want:      0,
		},
		{
			name:      "覆盖的是别的 model，不算",
			marks:     map[string]string{"m_task": ModelKindEntity},
			lifecycle: []LifecycleRef{{Who: "n_do", Model: "m_task_ts", Kind: "creator"}},
			want:      1,
		},
		{name: "dto 不计入", marks: map[string]string{"m_task": ModelKindDTO}, want: 0},
		{name: "config 不计入", marks: map[string]string{"m_task": ModelKindConfig}, want: 0},
		{name: "空值不计入——空是未分种，不是未知实体", marks: map[string]string{"m_task": ""}, want: 0},
		{
			name:  "两个 entity 都没覆盖计 2",
			marks: map[string]string{"m_task": ModelKindEntity, "m_task_ts": ModelKindEntity},
			want:  2,
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			g := loadFixture(t)
			for id, mk := range tc.marks {
				n := g.Nodes[id]
				n.ModelKind = mk
				g.Nodes[id] = n
			}
			g.Lifecycle = tc.lifecycle
			if got := EntitiesWithoutLifecycle(g); got != tc.want {
				t.Fatalf("应为 %d，实际 %d", tc.want, got)
			}
		})
	}
}

// 枚举取值非法时短路：取值都不合法，后两条判据无从谈起，只该报一条。
// 审计发现删掉那个 continue 全量仍绿。
func TestValidateModelKindStopsAfterInvalidEnum(t *testing.T) {
	g := loadFixture(t)
	n := g.Nodes["n_do"] // 非 model 节点，同时踩枚举与 kind 两条
	n.ModelKind = "vo"
	g.Nodes["n_do"] = n
	var hits int
	for _, is := range Validate(g) {
		if strings.Contains(is, "n_do") && (strings.Contains(is, "modelKind") || strings.Contains(is, "dto")) {
			hits++
		}
	}
	if hits != 1 {
		t.Fatalf("枚举非法应短路、只报 1 条，实际 %d 条: %v", hits, Validate(g))
	}
}

// diff 侧的 modelKind 执法。nodesAdded 是新节点进图的唯一入口，只查基线等于
// 让每份 diff 都能把矛盾数据合法带进来。
func TestValidateDiffEnforcesModelKind(t *testing.T) {
	g := loadFixture(t)
	d := &Diff{
		View: "branch-x",
		NodesAdded: map[string]Node{
			"m_bad": {Kind: "model", Container: "k_ent", File: "svc/bad.go", Name: "Bad", ModelKind: "vo"},
			"f_bad": {Kind: "func", Container: "k_svc", File: "svc/f.go", Name: "F", ModelKind: ModelKindEntity},
			"m_dto": {Kind: "model", Container: "k_ent", File: "svc/dto.go", Name: "Dto", ModelKind: ModelKindDTO},
		},
		LifecycleAdded: []LifecycleRef{{Who: "n_do", Model: "m_dto", Kind: "writer"}},
	}
	issues := ValidateDiff(g, d)
	for _, want := range []string{"m_bad", "f_bad", "m_dto"} {
		found := false
		for _, is := range issues {
			if strings.Contains(is, want) && strings.HasPrefix(is, "diff ") {
				found = true
			}
		}
		if !found {
			t.Errorf("diff 侧应报 %s 的 modelKind 问题，实际 issues: %v", want, issues)
		}
	}
}
