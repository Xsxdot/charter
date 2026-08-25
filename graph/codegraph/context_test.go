package codegraph

import (
	"strings"
	"testing"
)

// loadFixtureBest 取 fixture 的最优图；context 自 C10 起按最优树词表运行，
// 绝大多数用例都要它，单独抽出来避免每支重复三行。
func loadFixtureBest(t *testing.T) *Best {
	t.Helper()
	best, err := LoadBest("testdata/repo")
	if err != nil {
		t.Fatal(err)
	}
	if best == nil {
		t.Fatal("fixture 必须有 best.json，否则本文件的词表用例全部失去意义")
	}
	return best
}

func TestAssembleContextDeclaredAndUndeclared(t *testing.T) {
	g, err := LoadGraph("testdata/repo")
	if err != nil {
		t.Fatal(err)
	}
	v := Merge(g, nil)
	best := loadFixtureBest(t)

	// d_cmd 是最优树 id，且 codegraph/domains/d_cmd.json 存在——声明必须取得到。
	// 这一支就是 C10 的存在理由：改词表之前它必红（声明按最优树存、context 按现状取）。
	declared, err := AssembleContext(v, g, best, "testdata/repo", "d_cmd", QueryOptions{})
	if err != nil {
		t.Fatal(err)
	}
	if declared.Domain.ID != "d_cmd" || declared.Declaration == nil || declared.Chain == nil {
		t.Fatalf("declared context=%+v", declared)
	}
	if declared.Declaration.Responsibility != "命令入口与调度" {
		t.Fatalf("取到的必须是 d_cmd 自己的声明: %+v", declared.Declaration)
	}
	if !strings.Contains(declared.Warning, "未分种") {
		t.Fatalf("fixture modelKind 全空时应有未分种 warning=%q", declared.Warning)
	}

	undeclared, err := AssembleContext(v, g, best, "testdata/repo", "d_svc", QueryOptions{})
	if err != nil {
		t.Fatal(err)
	}
	if undeclared.Declaration != nil || !strings.Contains(undeclared.Warning, "codegraph/domains/d_svc.json") || undeclared.Chain == nil {
		t.Fatalf("undeclared context=%+v", undeclared)
	}
}

// 传现状-only id 时的报错必须可行动：说清已转向最优树词表、给候选、并报出该 id
// 的容器实际映射到哪些最优域。只说「不在词表中」会把使用者晾在原地。
func TestAssembleContextRejectsCurrentOnlyIDWithMapping(t *testing.T) {
	g, err := LoadGraph("testdata/repo")
	if err != nil {
		t.Fatal(err)
	}
	v := Merge(g, nil)
	best := loadFixtureBest(t)

	_, err = AssembleContext(v, g, best, "testdata/repo", "d_cli", QueryOptions{})
	if err == nil {
		t.Fatal("现状-only id 必须被拒")
	}
	for _, want := range []string{"最优树词表", "现状视图", "d_cmd(1 容器)"} {
		if !strings.Contains(err.Error(), want) {
			t.Fatalf("报错缺少 %q: %v", want, err)
		}
	}

	// 两套词表都不认识的 id：给候选即可，不编造映射。
	_, err = AssembleContext(v, g, best, "testdata/repo", "d_nowhere", QueryOptions{})
	if err == nil || !strings.Contains(err.Error(), "最优树领域候选") {
		t.Fatalf("未知 id 报错=%v", err)
	}
	if strings.Contains(err.Error(), "容器分布在") {
		t.Fatalf("非现状 id 不得编造容器分布: %v", err)
	}
}

// best 缺席是降级不是失败：现状词表照常可用，但必须有可见告警，且不产出实然披露
// （没有最优树就没有应然/实然之分）。
func TestAssembleContextBestAbsentDegrades(t *testing.T) {
	g, err := LoadGraph("testdata/repo")
	if err != nil {
		t.Fatal(err)
	}
	v := Merge(g, nil)

	out, err := AssembleContext(v, g, nil, "testdata/repo", "d_cli", QueryOptions{})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(out.Warning, "降级") {
		t.Fatalf("best 缺席必须有可见降级告警: %q", out.Warning)
	}
	if out.Actual != nil {
		t.Fatalf("best 缺席时不得产出实然披露: %+v", out.Actual)
	}
	if _, err := AssembleContext(v, g, nil, "testdata/repo", "d_cmd", QueryOptions{}); err == nil {
		t.Fatal("best 缺席时最优树 id 不应可用")
	}
}

// 实然披露：应然分组之外，必须说清这些容器今天实际在哪。
// MisplacedSkipped 必须与 Misplaced 一起出现——fixture 的现状域不在 best 词表里，
// 放错位恒为 0，只报 0 会被读成「没搬错」，真相是「没法比」。
func TestAssembleContextActualDisclosure(t *testing.T) {
	g, err := LoadGraph("testdata/repo")
	if err != nil {
		t.Fatal(err)
	}
	v := Merge(g, nil)
	best := loadFixtureBest(t)

	out, err := AssembleContext(v, g, best, "testdata/repo", "d_cmd", QueryOptions{})
	if err != nil {
		t.Fatal(err)
	}
	if out.Actual == nil {
		t.Fatal("best 在场必须产出实然披露")
	}
	if out.Actual.Containers != 1 {
		t.Fatalf("d_cmd 覆盖容器数=%d，期望 1", out.Actual.Containers)
	}
	if len(out.Actual.ByCurrentDomain) != 1 || out.Actual.ByCurrentDomain[0].ID != "d_cli" || out.Actual.ByCurrentDomain[0].Containers != 1 {
		t.Fatalf("现状归属分布=%+v", out.Actual.ByCurrentDomain)
	}
	if out.Actual.ByCurrentDomain[0].Label != "cli" {
		t.Fatalf("分布要带现状域 label: %+v", out.Actual.ByCurrentDomain[0])
	}
	if out.Actual.MisplacedSkipped != 1 {
		t.Fatalf("d_cli 不在 best 词表中，应计入 skipped=1，实得 %d", out.Actual.MisplacedSkipped)
	}
	if len(out.Actual.Misplaced) != 0 {
		t.Fatalf("词表不可比时不得伪报放错位: %+v", out.Actual.Misplaced)
	}

	svc, err := AssembleContext(v, g, best, "testdata/repo", "d_svc", QueryOptions{})
	if err != nil {
		t.Fatal(err)
	}
	if svc.Actual.Containers != 2 || len(svc.Actual.ByCurrentDomain) != 2 {
		t.Fatalf("d_svc 实然披露=%+v", svc.Actual)
	}
	if svc.Actual.ByCurrentDomain[0].ID != "d_svc/api" || svc.Actual.ByCurrentDomain[1].ID != "d_svc/store" {
		t.Fatalf("同数时按 id 升序: %+v", svc.Actual.ByCurrentDomain)
	}
}

// 真放错位（两边都在 best 词表内、归属不同）必须报出来，且不计入 skipped。
func TestAssembleContextActualReportsRealMisplacement(t *testing.T) {
	g, err := LoadGraph("testdata/repo")
	if err != nil {
		t.Fatal(err)
	}
	v := Merge(g, nil)
	best := loadFixtureBest(t)
	// 让 c_cli 的现状领域也是一个 best 词表里的 id（d_svc），于是两边可比且不同。
	c := v.Containers["c_cli"]
	c.Domain = "d_svc"
	v.Containers["c_cli"] = c

	out, err := AssembleContext(v, g, best, "testdata/repo", "d_cmd", QueryOptions{})
	if err != nil {
		t.Fatal(err)
	}
	if len(out.Actual.Misplaced) != 1 || out.Actual.Misplaced[0].Container != "c_cli" {
		t.Fatalf("应报出真放错位: %+v", out.Actual)
	}
	if out.Actual.Misplaced[0].CurrentDomain != "d_svc" || !strings.Contains(out.Actual.Misplaced[0].Detail, "d_cmd") {
		t.Fatalf("放错位记录要说清现在在哪、应归哪: %+v", out.Actual.Misplaced[0])
	}
	if out.Actual.MisplacedSkipped != 0 {
		t.Fatalf("可比时不应计入 skipped: %+v", out.Actual)
	}
}

// 父域的 context 必须覆盖全部后代叶子的容器——best 侧闭包与现状侧同形。
func TestAssembleContextBestParentSubtree(t *testing.T) {
	best := &Best{
		Domains: map[string]BestDomain{
			"d_top":  {Label: "顶", Responsibility: "父域"},
			"d_leaf": {Label: "叶", Parent: "d_top"},
			"d_out":  {Label: "外"},
		},
		Containers: map[string]string{"c_leaf": "d_leaf", "c_out": "d_out"},
	}
	nodes := map[string]ViewNode{
		"n_in":  {Node: Node{Kind: "func", Container: "c_leaf", Name: "In", File: "leaf/a.go", Line: 1}},
		"n_out": {Node: Node{Kind: "func", Container: "c_out", Name: "Out", File: "out/b.go", Line: 1}},
	}
	v := &View{Name: "baseline",
		Domains:    map[string]Domain{},
		Containers: map[string]Container{"c_leaf": {Domain: "d_cur_leaf"}, "c_out": {Domain: "d_cur_out"}},
		Nodes:      nodes,
		Edges:      []ViewEdge{{From: "n_out", To: "n_in"}},
	}
	g := &Graph{Containers: map[string]Container{}, Nodes: map[string]Node{}}
	for id, n := range nodes {
		g.Nodes[id] = n.Node
	}

	out, err := AssembleContext(v, g, best, "testdata/repo", "d_top", QueryOptions{})
	if err != nil {
		t.Fatal(err)
	}
	if out.Domain.Label != "顶" || len(out.Domain.Children) != 1 || out.Domain.Children[0] != "d_leaf" {
		t.Fatalf("父域元信息应取自 best: %+v", out.Domain)
	}
	if out.Actual.Containers != 1 {
		t.Fatalf("父域应覆盖后代叶子的容器: %+v", out.Actual)
	}
	if len(out.Interfaces) != 1 || out.Interfaces[0].ID != "n_in" {
		t.Fatalf("跨域入边应落在子树边界上: %+v", out.Interfaces)
	}
}

func TestAssembleContextFocusQuota(t *testing.T) {
	domains := map[string]Domain{"d_ctx": {Label: "context"}}
	containers := map[string]Container{}
	nodes := map[string]ViewNode{}
	for i := 0; i < 6; i++ {
		id := "e_" + string(rune('a'+i))
		container := "c_" + id
		containers[container] = Container{Domain: "d_ctx", Entry: true}
		nodes[id] = ViewNode{Node: Node{Kind: "entry", Container: container, Name: id}}
	}
	v := &View{Name: "baseline", Domains: domains, Containers: containers, Nodes: nodes}
	g := &Graph{Domains: domains, Containers: map[string]Container{}, Nodes: map[string]Node{}}
	for id, n := range nodes {
		g.Nodes[id] = n.Node
	}
	// 这支验的是配额，与词表无关：走 best 缺席的降级路径即可。
	result, err := AssembleContext(v, g, nil, "testdata/repo", "d_ctx", QueryOptions{})
	if err != nil {
		t.Fatal(err)
	}
	if result.FociTruncated == nil || result.FociTruncated.Total != 6 || result.FociTruncated.Shown != 5 || result.FociTruncated.Reason != "focus-quota" {
		t.Fatalf("focus quota=%+v", result.FociTruncated)
	}
}

func TestAssembleContextEntitiesFollowNodeIDOrder(t *testing.T) {
	g, err := LoadGraph("testdata/repo")
	if err != nil {
		t.Fatal(err)
	}
	v := Merge(g, nil)
	best := loadFixtureBest(t)
	for id, name := range map[string]string{"z_model": "Alpha", "a_model": "Zulu"} {
		n := Node{Kind: "model", Container: "c_svc", Name: name, File: "svc/task.go", Line: 1, ModelKind: ModelKindEntity}
		g.Nodes[id] = n
		v.Nodes[id] = ViewNode{Node: n}
	}
	g.Containers["c_svc"] = Container{Domain: "d_svc"}
	v.Containers["c_svc"] = g.Containers["c_svc"]
	best.Containers["c_svc"] = "d_svc"

	result, err := AssembleContext(v, g, best, "testdata/repo", "d_svc", QueryOptions{})
	if err != nil {
		t.Fatal(err)
	}
	if len(result.Entities) < 2 {
		t.Fatalf("entities=%+v", result.Entities)
	}
	if result.Entities[0].Model.ID != "a_model" || result.Entities[1].Model.ID != "z_model" {
		t.Fatalf("entities must follow node id order: %+v", result.Entities)
	}
}

// best 没归位的容器不属于任何最优树领域，于是任何一次 context 都不会包含它们。
// 静默漏掉一批真实代码是缺陷族里的静默失败——必须有可见提醒。
func TestAssembleContextWarnsOnUnplacedContainers(t *testing.T) {
	g, err := LoadGraph("testdata/repo")
	if err != nil {
		t.Fatal(err)
	}
	v := Merge(g, nil)
	best := loadFixtureBest(t)
	// 造一个有存活节点、但 best.json 没给归属的容器。
	n := Node{Kind: "func", Container: "c_orphan", Name: "Orphan", File: "orphan/a.go", Line: 1}
	g.Nodes["n_orphan"] = n
	v.Nodes["n_orphan"] = ViewNode{Node: n}
	v.Containers["c_orphan"] = Container{Domain: "d_cli"}

	out, err := AssembleContext(v, g, best, "testdata/repo", "d_cmd", QueryOptions{})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(out.Warning, "未归位容器 1 个") {
		t.Fatalf("未归位容器必须有可见提醒: %q", out.Warning)
	}
	// 提醒归提醒，不得把未归位容器硬塞进本域。
	if out.Actual.Containers != 1 {
		t.Fatalf("未归位容器不得混入本域: %+v", out.Actual)
	}
}
