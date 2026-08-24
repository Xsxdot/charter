package codegraph

import (
	"encoding/json"
	"strings"
	"testing"
)

func TestCheckBestGapFindingsAreWarnsAndContainerScoped(t *testing.T) {
	v := &View{
		Containers: map[string]Container{
			"c_good":     {Domain: "d_a"},
			"c_unplaced": {Domain: "d_a"},
			"c_legacy":   {Domain: "d_legacy"},
			"c_deleted":  {Domain: "d_a"},
			"c_empty":    {},
			"c_zombie":   {Domain: "d_a"},
		},
		Nodes: map[string]ViewNode{
			"n_good":     {Node: Node{Container: "c_good", File: "good.go"}},
			"n_unplaced": {Node: Node{Container: "c_unplaced", File: "unplaced.go"}},
			"n_legacy":   {Node: Node{Container: "c_legacy", File: "legacy.go"}},
			"n_deleted":  {Node: Node{Container: "c_deleted", File: "deleted.go"}, Status: "deleted"},
			"n_empty":    {Node: Node{Container: "c_empty", File: "empty.go"}},
			"n_missing":  {Node: Node{Container: "missing", File: "outside.go"}},
		},
	}
	b := &Best{
		Meta: BestMeta{Version: 1, Project: "test"},
		Domains: map[string]BestDomain{
			"d_a":      {Responsibility: "a", Type: "logic"},
			"d_b":      {Responsibility: "b", Type: "logic"},
			"d_empty":  {Responsibility: "empty", Type: "logic"},
			"d_parent": {Responsibility: "parent", Type: "logic"},
			"d_leaf":   {Responsibility: "leaf", Parent: "d_parent"},
		},
		Containers: map[string]string{
			"c_good":     "d_b",
			"c_deleted":  "d_a",
			"c_dangling": "d_a",
		},
	}

	rep := Check(&Target{}, b, v, nil)
	if len(rep.Fails) != 0 {
		t.Fatalf("四条 gap 不得进入 fails: %+v", rep.Fails)
	}
	assertFindingCount(t, rep.Warns, KindContainerMisplaced, 1)
	assertFindingCount(t, rep.Warns, KindContainerUnplaced, 3)
	assertFindingCount(t, rep.Warns, KindDomainEmpty, 2)
	assertFindingCount(t, rep.Warns, KindBestDangling, 2)
	assertFindingCount(t, rep.Warns, "outside-file", 1)
	for _, finding := range rep.Warns {
		if finding.Kind == "outside-file" && !strings.Contains(finding.Detail, "不存在的容器") {
			t.Fatalf("outside-file 应指向悬空容器引用: %+v", finding)
		}
	}

	if rep.BestCoverage == nil {
		t.Fatal("best 非 nil 时必须输出归属覆盖读数")
	}
	if got := *rep.BestCoverage; got.AssignedContainers != 1 || got.ViewContainers != 4 || got.MisplacedSkipped != 1 {
		t.Fatalf("归属覆盖读数错误: %+v", got)
	}
	for _, finding := range rep.Warns {
		if finding.From == "c_zombie" {
			t.Fatalf("零节点容器不得进入覆盖读数或 gap finding: %+v", rep.Warns)
		}
	}
	if !hasFindingFrom(rep.Warns, KindContainerMisplaced, "c_good") {
		t.Fatalf("应报告 best 与 baseline 词汇已对齐的错位容器: %+v", rep.Warns)
	}
	if hasFindingFrom(rep.Warns, KindContainerMisplaced, "c_legacy") {
		t.Fatalf("词汇未对齐的容器不得伪报 container-misplaced: %+v", rep.Warns)
	}
	if hasFindingFrom(rep.Warns, KindContainerUnplaced, "c_deleted") {
		t.Fatalf("全 deleted 容器不得报 container-unplaced: %+v", rep.Warns)
	}

	raw, err := json.Marshal(rep)
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(raw), `"to":""`) {
		t.Fatalf("gap finding 的 To 必须省略而不是空串: %s", raw)
	}
}

func TestCheckBestCoverageCountsLiveCrossDomainEdges(t *testing.T) {
	b := &Best{
		Meta: BestMeta{Version: 1, Project: "test"},
		Domains: map[string]BestDomain{
			"d_a": {Responsibility: "a", Type: "logic"},
			"d_b": {Responsibility: "b", Type: "logic"},
		},
		Containers: map[string]string{"c_a": "d_a", "c_b": "d_b"},
	}
	v := &View{
		Containers: map[string]Container{"c_a": {}, "c_b": {}},
		Nodes: map[string]ViewNode{
			"a": {Node: Node{Container: "c_a", File: "a.go"}},
			"b": {Node: Node{Container: "c_b", File: "b.go"}},
		},
		Edges: []ViewEdge{
			{From: "a", To: "b"},
			{From: "b", To: "a"},
			{From: "a", To: "b", Status: "deleted"},
		},
	}
	target := &Target{Contracts: []Contract{
		{From: "d_a", To: "d_b", LegacyBudget: 1},
		{From: "d_b", To: "d_a", LegacyBudget: 1},
	}}
	rep := Check(target, b, v, nil)
	if rep.BestCoverage == nil || rep.BestCoverage.CrossDomainEdges != 2 {
		t.Fatalf("跨域边覆盖数应只计两条 live edge: %+v", rep.BestCoverage)
	}
	if rep.BestCoverage.AssignedContainers != 2 || rep.BestCoverage.ViewContainers != 2 {
		t.Fatalf("容器覆盖数错误: %+v", rep.BestCoverage)
	}
}

func assertFindingCount(t *testing.T, findings []Finding, kind string, want int) {
	t.Helper()
	got := 0
	for _, finding := range findings {
		if finding.Kind == kind {
			got++
		}
	}
	if got != want {
		t.Fatalf("%s 应有 %d 条，实际 %d: %+v", kind, want, got, findings)
	}
}

func hasFindingFrom(findings []Finding, kind, from string) bool {
	for _, finding := range findings {
		if finding.Kind == kind && finding.From == from {
			return true
		}
	}
	return false
}
