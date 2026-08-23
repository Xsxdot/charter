package codegraph

import (
	"encoding/json"
	"testing"
)

// TestBestJSONGolden 锁死 best.json 的 wire 形状（契约 §6 条 1~6、51）。
//
// 这是跨仓文件格式契约：handoff 侧的 best.json 由人手写，键名一旦漂移，
// 那边的文件会被静默解析成零值——所以键名、omitempty 行为、回读结构都要锁。
func TestBestJSONGolden(t *testing.T) {
	best := Best{
		Meta: BestMeta{Version: 1, Project: "handoff"},
		Domains: map[string]BestDomain{
			"d_coordination": {Label: "协作控制", Responsibility: "编排任务生命周期", Type: "logic"},
		},
		Containers: map[string]string{"c_cli": "d_coordination"},
	}
	raw, err := json.Marshal(best)
	if err != nil {
		t.Fatalf("编码最优图样本: %v", err)
	}
	want := `{"meta":{"version":1,"project":"handoff"},` +
		`"domains":{"d_coordination":{"label":"协作控制","responsibility":"编排任务生命周期","type":"logic"}},` +
		`"containers":{"c_cli":"d_coordination"}}`
	if string(raw) != want {
		t.Fatalf("最优图 JSON 金样本漂移:\n got %s\nwant %s", raw, want)
	}

	var decoded Best
	if err := json.Unmarshal(raw, &decoded); err != nil {
		t.Fatalf("解码最优图样本: %v", err)
	}
	if decoded.Meta.Version != 1 || decoded.Containers["c_cli"] != "d_coordination" {
		t.Fatalf("最优图 JSON 回读结构错误: %+v", decoded)
	}
}

// TestBestDomainOmitempty 单独钉 parent/type 的 omitempty，以及 label/
// responsibility **不带** omitempty（契约 §6 条 3）。
//
// 分开成一支的理由：金样本里顶层领域必然带 type、必然不带 parent，
// 单靠它无法区分「叶子领域省略了 parent」和「叶子领域根本没有 parent 字段」。
func TestBestDomainOmitempty(t *testing.T) {
	leaf, err := json.Marshal(BestDomain{Parent: "d_coordination", Label: "", Responsibility: ""})
	if err != nil {
		t.Fatalf("编码叶子领域: %v", err)
	}
	// label/responsibility 无 omitempty，空值也要出现——它们是必填项，
	// 省略会让「作者忘了写」和「作者写了空串」在文件里不可区分。
	if want := `{"label":"","responsibility":"","parent":"d_coordination"}`; string(leaf) != want {
		t.Fatalf("叶子领域编码漂移:\n got %s\nwant %s", leaf, want)
	}
	top, err := json.Marshal(BestDomain{Label: "L", Responsibility: "R", Type: "boundary"})
	if err != nil {
		t.Fatalf("编码顶层领域: %v", err)
	}
	if want := `{"label":"L","responsibility":"R","type":"boundary"}`; string(top) != want {
		t.Fatalf("顶层领域编码漂移:\n got %s\nwant %s", top, want)
	}
}
