package codegraph

import (
	"fmt"
	"math/rand"
	"testing"
)

// TestV2ResolverAndBestOwnershipEquivalenceProperty proves the general rule
// behind the v2→best migration: a container whose nodes all resolve to one
// v2 subsystem has the same ownership through the generated Best graph.
func TestV2ResolverAndBestOwnershipEquivalenceProperty(t *testing.T) {
	rng := rand.New(rand.NewSource(20260824))
	target := &migrateV2Target{
		Subsystems: []migrateV2Subsystem{
			{ID: "d_a", Paths: []string{"a/**"}},
			{ID: "d_b", Paths: []string{"b/**"}},
			{ID: "d_c", Paths: []string{"c/root.go"}},
		},
		Bindings: []migrateV2Binding{{Path: "c/assigned.go", Subsystem: "d_c"}},
	}
	graph := &Graph{Containers: map[string]Container{}, Nodes: map[string]Node{}}
	for i := 0; i < 160; i++ {
		containerID := fmt.Sprintf("c_%03d", i)
		graph.Containers[containerID] = Container{Label: containerID}
		choice := rng.Intn(4)
		file := fmt.Sprintf("orphan/%03d.go", i)
		switch choice {
		case 0:
			file = fmt.Sprintf("a/pkg%03d.go", i)
		case 1:
			file = fmt.Sprintf("b/pkg%03d.go", i)
		case 2:
			file = "c/assigned.go"
		case 3:
			file = "c/root.go"
		}
		// Two nodes per container exercise the deterministic first-node rule
		// while keeping every generated container subsystem-pure.
		graph.Nodes[fmt.Sprintf("n_%03d_z", i)] = Node{Container: containerID, File: file}
		graph.Nodes[fmt.Sprintf("n_%03d_a", i)] = Node{Container: containerID, File: file}
	}

	best := migrateInitialBest(target, graph)
	if cross := impureContainerResolutions(target, graph); len(cross) != 0 {
		t.Fatalf("前提不成立：发现跨子系统容器 %v", cross)
	}
	for nodeID, node := range graph.Nodes {
		legacy := migrateV2SubsystemOf(target, node.File)
		modern := best.SubsystemOf(best.DomainOfContainer(node.Container))
		if legacy != modern {
			t.Fatalf("归属不等价：node=%s container=%s legacy=%q modern=%q", nodeID, node.Container, legacy, modern)
		}
	}
}

func TestV2ResolverAndBestOwnershipNegativeCrossSubsystemContainer(t *testing.T) {
	target := &migrateV2Target{Subsystems: []migrateV2Subsystem{
		{ID: "d_a", Paths: []string{"a/**"}},
		{ID: "d_b", Paths: []string{"b/**"}},
	}}
	graph := &Graph{
		Containers: map[string]Container{"c_cross": {Label: "cross"}},
		Nodes: map[string]Node{
			"n_a": {Container: "c_cross", File: "a/one.go"},
			"n_b": {Container: "c_cross", File: "b/two.go"},
		},
	}
	cross := impureContainerResolutions(target, graph)
	if len(cross) != 1 || len(cross["c_cross"]) != 2 {
		t.Fatalf("负例前提应定位到 c_cross，实际: %v", cross)
	}

	best := migrateInitialBest(target, graph)
	for _, node := range graph.Nodes {
		legacy := migrateV2SubsystemOf(target, node.File)
		modern := best.SubsystemOf(best.DomainOfContainer(node.Container))
		if legacy != modern {
			if node.Container != "c_cross" {
				t.Fatalf("等价性破裂点应定位到 c_cross，实际 %s", node.Container)
			}
			return
		}
	}
	t.Fatal("跨子系统容器必须使等价性破裂")
}

func impureContainerResolutions(target *migrateV2Target, graph *Graph) map[string][]string {
	sets := make(map[string]map[string]bool)
	for _, node := range graph.Nodes {
		if sets[node.Container] == nil {
			sets[node.Container] = map[string]bool{}
		}
		sets[node.Container][migrateV2SubsystemOf(target, node.File)] = true
	}
	out := make(map[string][]string)
	for containerID, ids := range sets {
		if len(ids) <= 1 {
			continue
		}
		for id := range ids {
			out[containerID] = append(out[containerID], id)
		}
	}
	return out
}
