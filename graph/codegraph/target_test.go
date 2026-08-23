package codegraph

import (
	"encoding/json"
	"strings"
	"testing"
)

func TestLoadTarget(t *testing.T) {
	tg, err := LoadTarget("testdata/repo")
	if err != nil {
		t.Fatalf("加载目标图: %v", err)
	}
	if tg.Meta.Version != 2 || len(tg.Subsystems) == 0 {
		t.Fatalf("meta/subsystems 解析不对: %+v", tg.Meta)
	}
}

// 缺失必须是显式错误——check 无基准静默通过是本机制的头号静默失败模式（spec §5）。
func TestLoadTargetMissingIsError(t *testing.T) {
	if _, err := LoadTarget(t.TempDir()); err == nil {
		t.Fatal("target 缺失应报错，不能返回 nil,nil")
	}
}

func TestTargetDomainJSONGolden(t *testing.T) {
	target := Target{
		Meta: TargetMeta{Version: 2, Project: "handoff"},
		Subsystems: []TargetSubsystem{{
			ID: "d_controlplane", Name: "Control Plane", Type: "logic", Paths: []string{"internal/**"},
			UnplacedBudget: 61, UnplacedBudgetNote: "vertical slice pending",
			Domains: []TargetDomain{{
				ID: "d_task", Name: "Task", Responsibility: "owns task lifecycle", Paths: []string{"internal/task/**"},
			}},
		}, {ID: "d_empty", Name: "Empty", Type: "logic", Paths: []string{"pkg/**"}}},
	}
	raw, err := json.Marshal(target)
	if err != nil {
		t.Fatalf("编码目标领域样本: %v", err)
	}
	want := `{"meta":{"version":2,"project":"handoff"},"subsystems":[{"id":"d_controlplane","name":"Control Plane","type":"logic","paths":["internal/**"],"unplacedBudget":61,"unplacedBudgetNote":"vertical slice pending","domains":[{"id":"d_task","name":"Task","responsibility":"owns task lifecycle","paths":["internal/task/**"]}]},{"id":"d_empty","name":"Empty","type":"logic","paths":["pkg/**"]}]}`
	if string(raw) != want {
		t.Fatalf("目标领域 JSON 金样本漂移:\n got %s\nwant %s", raw, want)
	}
	var decoded Target
	if err := json.Unmarshal(raw, &decoded); err != nil {
		t.Fatalf("解码目标领域样本: %v", err)
	}
	if len(decoded.Subsystems) != 2 || len(decoded.Subsystems[0].Domains) != 1 || decoded.Subsystems[1].UnplacedBudget != 0 || len(decoded.Subsystems[1].Domains) != 0 {
		t.Fatalf("目标领域 JSON 回读结构错误: %+v", decoded)
	}
}

func TestValidateTarget(t *testing.T) {
	bad := &Target{
		Meta: TargetMeta{Version: 2},
		Subsystems: []TargetSubsystem{
			{ID: "d_a", Name: "A", Type: "logic", Paths: []string{"pkg/**"}},
			{ID: "d_a", Name: "重复", Type: "magic", Paths: []string{"[bad"}},
		},
		Assignments: []Assignment{{Path: "x.go", Subsystem: "d_nope"}},
		Contracts:   []Contract{{From: "d_a", To: "d_nope", LegacyBudget: -1}},
	}
	issues := ValidateTarget(bad)
	for _, want := range []string{"重复", "type", "paths", "d_nope", "legacyBudget"} {
		found := false
		for _, is := range issues {
			if strings.Contains(is, want) {
				found = true
			}
		}
		if !found {
			t.Errorf("缺少对 %q 的校验报告，实际: %v", want, issues)
		}
	}
}

// legacyBudget 缺省与 0 同义 = 硬拦（spec §4 钉死的语义）。
func TestContractBudgetDefaultZero(t *testing.T) {
	var c Contract
	if c.LegacyBudget != 0 {
		t.Fatal("缺省预算必须是 0（硬拦）")
	}
}

func TestSubsystemOf(t *testing.T) {
	tg := &Target{
		Subsystems: []TargetSubsystem{
			{ID: "d_svc", Type: "logic", Paths: []string{"svc/**"}},
			{ID: "d_cmd", Type: "logic", Paths: []string{"cmd/run.go"}},
		},
		Assignments: []Assignment{{Path: "svc/mirror.go", Subsystem: "d_cmd"}},
	}
	cases := []struct{ file, want string }{
		{"svc/task.go", "d_svc"},   // 前缀规则
		{"svc/mirror.go", "d_cmd"}, // assignments 优先于 paths
		{"cmd/run.go", "d_cmd"},    // 精确规则
		{"web/x.ts", ""},           // 图外
		{"svcx/task.go", ""},       // 前缀必须整段匹配，svcx 不是 svc/
	}
	for _, c := range cases {
		if got := tg.SubsystemOf(c.file); got != c.want {
			t.Errorf("SubsystemOf(%q) = %q, want %q", c.file, got, c.want)
		}
	}
}
