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

// TestValidateTargetDomainRules 逐族锁住目标领域结构门（契约 §4 冻结 10-15）。
// 每个用例只放一族违规，避免一条实现顺手把多族一起报了还看不出漏哪族。
func TestValidateTargetDomainRules(t *testing.T) {
	subsystem := func(id string, paths []string, budget int, domains ...TargetDomain) TargetSubsystem {
		return TargetSubsystem{ID: id, Name: id, Type: "logic", Paths: paths, UnplacedBudget: budget, Domains: domains}
	}
	cases := []struct {
		name     string
		target   *Target
		want     []string // 每条都必须出现在某条 issue 里
		unwanted []string // 不得出现在任何 issue 里
	}{
		{
			name: "目标领域 id 在整个文档内重复",
			target: &Target{Meta: TargetMeta{Version: 2}, Subsystems: []TargetSubsystem{
				subsystem("d_a", []string{"a/**"}, 0, TargetDomain{ID: "dup", Name: "X", Responsibility: "r", Paths: []string{"a/x/**"}}),
				subsystem("d_b", []string{"b/**"}, 0, TargetDomain{ID: "dup", Name: "Y", Responsibility: "r", Paths: []string{"b/y/**"}}),
			}},
			want: []string{`目标领域 id "dup" 重复`},
		},
		{
			name: "responsibility 纯空白等同缺失",
			target: &Target{Meta: TargetMeta{Version: 2}, Subsystems: []TargetSubsystem{
				subsystem("d_a", []string{"a/**"}, 0, TargetDomain{ID: "d_blank", Name: "X", Responsibility: "  \t ", Paths: []string{"a/x/**"}}),
			}},
			want: []string{"responsibility", "d_blank"},
		},
		{
			name: "非法 wildcard 只报语法不报覆盖",
			target: &Target{Meta: TargetMeta{Version: 2}, Subsystems: []TargetSubsystem{
				subsystem("d_a", []string{"a/**"}, 0, TargetDomain{ID: "d_bad", Name: "X", Responsibility: "r", Paths: []string{"a/*/x.go"}}),
			}},
			want:     []string{"语法非法", "d_bad"},
			unwanted: []string{"未被"},
		},
		{
			name: "目标领域路径不被父子系统覆盖",
			target: &Target{Meta: TargetMeta{Version: 2}, Subsystems: []TargetSubsystem{
				subsystem("d_a", []string{"a/**"}, 0, TargetDomain{ID: "d_out", Name: "X", Responsibility: "r", Paths: []string{"b/x.go"}}),
			}},
			want: []string{"未被", "d_out", `"b/x.go"`},
		},
		{
			name: "同一子系统内两个目标领域路径重叠",
			target: &Target{Meta: TargetMeta{Version: 2}, Subsystems: []TargetSubsystem{
				subsystem("d_a", []string{"a/**"}, 0,
					TargetDomain{ID: "d_wide", Name: "X", Responsibility: "r", Paths: []string{"a/x/**"}},
					TargetDomain{ID: "d_narrow", Name: "Y", Responsibility: "r", Paths: []string{"a/x/y.go"}}),
			}},
			want: []string{"重叠", "d_wide", "d_narrow"},
		},
		{
			name: "跨子系统的目标领域路径重叠不由本门执法",
			target: &Target{Meta: TargetMeta{Version: 2}, Subsystems: []TargetSubsystem{
				subsystem("d_a", []string{"shared/**"}, 0, TargetDomain{ID: "d_left", Name: "X", Responsibility: "r", Paths: []string{"shared/x/**"}}),
				subsystem("d_b", []string{"shared/**"}, 0, TargetDomain{ID: "d_right", Name: "Y", Responsibility: "r", Paths: []string{"shared/x/**"}}),
			}},
			unwanted: []string{"重叠"},
		},
		{
			name: "unplacedBudget 为负",
			target: &Target{Meta: TargetMeta{Version: 2}, Subsystems: []TargetSubsystem{
				subsystem("d_a", []string{"a/**"}, -1, TargetDomain{ID: "d_ok", Name: "X", Responsibility: "r", Paths: []string{"a/x/**"}}),
			}},
			want: []string{"unplacedBudget", "d_a"},
		},
		{
			name: "合法的精确路径与前缀路径全部放行",
			target: &Target{Meta: TargetMeta{Version: 2}, Subsystems: []TargetSubsystem{
				subsystem("d_a", []string{"a/**"}, 3,
					TargetDomain{ID: "d_pre", Name: "X", Responsibility: "r", Paths: []string{"a/x/**"}},
					TargetDomain{ID: "d_exact", Name: "Y", Responsibility: "r", Paths: []string{"a/y.go", "a/z/**"}}),
			}},
		},
		{
			name: "缺失 domains 的子系统不被结构门当错误",
			target: &Target{Meta: TargetMeta{Version: 2}, Subsystems: []TargetSubsystem{
				subsystem("d_a", []string{"a/**"}, 0),
			}},
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			issues := ValidateTarget(tc.target)
			if len(tc.want) == 0 && len(tc.unwanted) == 0 && len(issues) != 0 {
				t.Fatalf("合法目标图不应有 issue: %v", issues)
			}
			for _, want := range tc.want {
				found := false
				for _, issue := range issues {
					if strings.Contains(issue, want) {
						found = true
					}
				}
				if !found {
					t.Errorf("缺少含 %q 的 issue，实际: %v", want, issues)
				}
			}
			for _, unwanted := range tc.unwanted {
				for _, issue := range issues {
					if strings.Contains(issue, unwanted) {
						t.Errorf("不应出现含 %q 的 issue: %v", unwanted, issues)
					}
				}
			}
		})
	}
}

// TestTargetDomainJSONPresenceAndZeroRoundTrip 把 wire 层的「显式零值 / 显式空数组 /
// 字段缺失」三种形态与 Go 侧回读语义分开锁：wire presence 用 RawMessage 判键在不在，
// Go 侧用 nil slice 判显式 [] 与缺失的差别，编码回去两者都必须被 omitempty 省掉。
func TestTargetDomainJSONPresenceAndZeroRoundTrip(t *testing.T) {
	wire := []byte(`{"meta":{"version":2,"project":"p"},"subsystems":[` +
		`{"id":"d_zero","name":"Zero","type":"logic","paths":["a/**"],"unplacedBudget":0,"unplacedBudgetNote":"","domains":[]},` +
		`{"id":"d_absent","name":"Absent","type":"logic","paths":["b/**"]}]}`)

	var shape struct {
		Subsystems []map[string]json.RawMessage `json:"subsystems"`
	}
	if err := json.Unmarshal(wire, &shape); err != nil {
		t.Fatalf("解析 wire 形状: %v", err)
	}
	if len(shape.Subsystems) != 2 {
		t.Fatalf("wire 形状应有两个子系统: %+v", shape.Subsystems)
	}
	for _, key := range []string{"unplacedBudget", "unplacedBudgetNote", "domains"} {
		if _, ok := shape.Subsystems[0][key]; !ok {
			t.Errorf("输入 wire 里显式写了 %s，presence 断言必须看得到", key)
		}
		if _, ok := shape.Subsystems[1][key]; ok {
			t.Errorf("输入 wire 里没写 %s，presence 断言不得凭空多出来", key)
		}
	}
	if got := string(shape.Subsystems[0]["domains"]); got != "[]" {
		t.Errorf("显式空数组 wire 值应为 []，实际 %s", got)
	}

	var decoded Target
	if err := json.Unmarshal(wire, &decoded); err != nil {
		t.Fatalf("回读 target: %v", err)
	}
	zero, absent := decoded.Subsystems[0], decoded.Subsystems[1]
	if zero.UnplacedBudget != 0 || zero.UnplacedBudgetNote != "" || absent.UnplacedBudget != 0 || absent.UnplacedBudgetNote != "" {
		t.Fatalf("显式零值与缺失在 Go 侧都应是零值: %+v / %+v", zero, absent)
	}
	if zero.Domains == nil || len(zero.Domains) != 0 {
		t.Fatalf("显式 domains:[] 应回读成非 nil 空 slice: %#v", zero.Domains)
	}
	if absent.Domains != nil {
		t.Fatalf("缺失 domains 应回读成 nil slice: %#v", absent.Domains)
	}

	raw, err := json.Marshal(decoded)
	if err != nil {
		t.Fatalf("重新编码 target: %v", err)
	}
	shape.Subsystems = nil
	if err := json.Unmarshal(raw, &shape); err != nil {
		t.Fatalf("解析回写形状: %v", err)
	}
	for i, subsystem := range shape.Subsystems {
		for _, key := range []string{"unplacedBudget", "unplacedBudgetNote", "domains"} {
			if _, ok := subsystem[key]; ok {
				t.Errorf("omitempty 应省略子系统 %d 的零值键 %s: %s", i, key, raw)
			}
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
