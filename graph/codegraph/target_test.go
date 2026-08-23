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
	if tg.Meta.Version != 3 || len(tg.Contracts) == 0 {
		t.Fatalf("meta/contracts 解析不对: %+v", tg)
	}
}

// 缺失必须是显式错误——check 无基准静默通过是本机制的头号静默失败模式（spec §5）。
func TestLoadTargetMissingIsError(t *testing.T) {
	if _, err := LoadTarget(t.TempDir()); err == nil {
		t.Fatal("target 缺失应报错，不能返回 nil,nil")
	}
}

func TestTargetV3JSONGolden(t *testing.T) {
	target := Target{
		Meta:      TargetMeta{Version: 3, Project: "handoff"},
		Assembly:  []string{"cmd/run.go"},
		Contracts: []Contract{{From: "d_cmd", To: "d_svc", Entries: []string{"svc.Server"}, LegacyBudget: 2}},
	}
	raw, err := json.Marshal(target)
	if err != nil {
		t.Fatalf("编码 v3 目标图: %v", err)
	}
	want := `{"meta":{"version":3,"project":"handoff"},"assembly":["cmd/run.go"],"contracts":[{"from":"d_cmd","to":"d_svc","entries":["svc.Server"],"legacyBudget":2}]}`
	if string(raw) != want {
		t.Fatalf("v3 目标图 JSON 金样本漂移:\n got %s\nwant %s", raw, want)
	}
	for _, forbidden := range []string{`"subsystems"`, `"assignments"`} {
		if strings.Contains(string(raw), forbidden) {
			t.Fatalf("v3 wire 不得包含 %s: %s", forbidden, raw)
		}
	}
	var decoded Target
	if err := json.Unmarshal(raw, &decoded); err != nil {
		t.Fatalf("解码 v3 目标图: %v", err)
	}
	if decoded.Meta.Version != 3 || len(decoded.Contracts) != 1 || decoded.Contracts[0].LegacyBudget != 2 {
		t.Fatalf("v3 目标图回读结构错误: %+v", decoded)
	}
}

func TestValidateTarget(t *testing.T) {
	bad := &Target{Contracts: []Contract{{From: "d_a", To: "d_b", LegacyBudget: -1}}}
	issues := ValidateTarget(bad)
	if len(issues) != 1 || !strings.Contains(issues[0], "legacyBudget") {
		t.Fatalf("只应报告负 legacyBudget: %v", issues)
	}

	// 归属完整性已下沉到 Best；Target 不得再以未知域名拒绝契约。
	if issues := ValidateTarget(&Target{Contracts: []Contract{{From: "d_ghost", To: "d_ghost"}}}); len(issues) != 0 {
		t.Fatalf("未知域名不属于 target 结构门: %v", issues)
	}
}

// legacyBudget 缺省与 0 同义 = 硬拦（spec §4 钉死的语义）。
func TestContractBudgetDefaultZero(t *testing.T) {
	var c Contract
	if c.LegacyBudget != 0 {
		t.Fatal("缺省预算必须是 0（硬拦）")
	}
}
