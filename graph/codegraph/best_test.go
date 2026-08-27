package codegraph

import (
	"encoding/json"
	"math/rand"
	"os"
	"path/filepath"
	"reflect"
	"strings"
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
			"d_coordination": {Label: "协作控制", Type: "logic"},
		},
		Containers: map[string]string{"c_cli": "d_coordination"},
	}
	raw, err := json.Marshal(best)
	if err != nil {
		t.Fatalf("编码最优图样本: %v", err)
	}
	want := `{"meta":{"version":1,"project":"handoff"},` +
		`"domains":{"d_coordination":{"label":"协作控制","type":"logic"}},` +
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

// TestBestDomainOmitempty 单独钉 parent/type 的 omitempty，以及 label 不带
// omitempty；职责正文不属于 best wire。
//
// 分开成一支的理由：金样本里顶层领域必然带 type、必然不带 parent，
// 单靠它无法区分「叶子领域省略了 parent」和「叶子领域根本没有 parent 字段」。
func TestBestDomainOmitempty(t *testing.T) {
	leaf, err := json.Marshal(BestDomain{Parent: "d_coordination", Label: ""})
	if err != nil {
		t.Fatalf("编码叶子领域: %v", err)
	}
	// label 无 omitempty，空值也要出现；职责正文不应出现在 best。
	if want := `{"label":"","parent":"d_coordination"}`; string(leaf) != want {
		t.Fatalf("叶子领域编码漂移:\n got %s\nwant %s", leaf, want)
	}
	top, err := json.Marshal(BestDomain{Label: "L", Type: "boundary"})
	if err != nil {
		t.Fatalf("编码顶层领域: %v", err)
	}
	if want := `{"label":"L","type":"boundary"}`; string(top) != want {
		t.Fatalf("顶层领域编码漂移:\n got %s\nwant %s", top, want)
	}
}

func TestLoadBest(t *testing.T) {
	missing, err := LoadBest(t.TempDir())
	if err != nil || missing != nil {
		t.Fatalf("best.json 缺失应返回 (nil, nil)，got best=%#v err=%v", missing, err)
	}

	cases := []struct {
		name string
		raw  string
		want string
	}{
		{name: "malformed", raw: "{", want: "解析最优图"},
		{name: "unsupported version", raw: `{"meta":{"version":2,"project":"p"}}`, want: "schema version 2"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			root := t.TempDir()
			if err := os.MkdirAll(filepath.Join(root, "codegraph"), 0o755); err != nil {
				t.Fatal(err)
			}
			path := filepath.Join(root, "codegraph", "best.json")
			if err := os.WriteFile(path, []byte(tc.raw), 0o644); err != nil {
				t.Fatal(err)
			}
			best, err := LoadBest(root)
			if err == nil || best != nil || !strings.Contains(err.Error(), tc.want) || !strings.Contains(err.Error(), path) {
				t.Fatalf("LoadBest 错误未带路径与原因，best=%#v err=%v", best, err)
			}
		})
	}
}

func TestValidateBestRules(t *testing.T) {
	cases := []struct {
		name   string
		mutate func(*Best)
		want   string
	}{
		{name: "project required", mutate: func(b *Best) { b.Meta.Project = " \t" }, want: "meta.project"},
		{name: "parent exists", mutate: func(b *Best) { b.Domains["d_leaf"] = BestDomain{Label: "leaf", Parent: "d_ghost"} }, want: "d_ghost"},
		{name: "parent cycle", mutate: func(b *Best) {
			b.Domains["d_root"] = BestDomain{Label: "root", Parent: "d_leaf"}
			b.Domains["d_leaf"] = BestDomain{Label: "leaf", Parent: "d_root"}
		}, want: "parent 链存在环"},
		{name: "top level type", mutate: func(b *Best) { d := b.Domains["d_root"]; d.Type = "x"; b.Domains["d_root"] = d }, want: "d_root"},
		{name: "nested type empty", mutate: func(b *Best) { d := b.Domains["d_leaf"]; d.Type = "logic"; b.Domains["d_leaf"] = d }, want: "非顶层领域"},
		{name: "container domain exists", mutate: func(b *Best) { b.Containers["c"] = "d_ghost" }, want: "d_ghost"},
		{name: "container points to leaf", mutate: func(b *Best) { b.Containers["c"] = "d_root" }, want: "非叶子"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			best := validBest()
			tc.mutate(&best)
			issues := ValidateBest(&best)
			if !containsIssue(issues, tc.want) {
				t.Fatalf("ValidateBest 未报告 %q，issues=%v", tc.want, issues)
			}
		})
	}
}

func TestValidateBestIsPure(t *testing.T) {
	root := t.TempDir()
	best := validBest()
	if issues := ValidateBest(&best); len(issues) != 0 {
		t.Fatalf("合法 best 不应有问题: %v", issues)
	}
	entries, err := os.ReadDir(root)
	if err != nil {
		t.Fatal(err)
	}
	if len(entries) != 0 {
		t.Fatalf("ValidateBest 不应创建文件: %v", entries)
	}
}

func TestBestOwnershipResolution(t *testing.T) {
	best := validBest()
	if got := best.SubsystemOf("d_root"); got != "d_root" {
		t.Fatalf("顶层领域应返回自身，got %q", got)
	}
	if got := best.SubsystemOf("d_leaf"); got != "d_root" {
		t.Fatalf("叶子领域应上溯到顶层，got %q", got)
	}
	if got := best.SubsystemOf("d_ghost"); got != "" {
		t.Fatalf("图外领域应返回空串，got %q", got)
	}
	if got := best.DomainOfContainer("c"); got != "d_leaf" {
		t.Fatalf("已归属容器应返回领域，got %q", got)
	}
	if got := best.DomainOfContainer("missing"); got != "" {
		t.Fatalf("未归属容器应返回空串，got %q", got)
	}

	cycle := Best{Domains: map[string]BestDomain{
		"a": {Parent: "b"},
		"b": {Parent: "a"},
	}}
	if got := cycle.SubsystemOf("a"); got != "" {
		t.Fatalf("环应被保护并返回空串，got %q", got)
	}
}

func TestBestJSONRoundTripProperty(t *testing.T) {
	rng := rand.New(rand.NewSource(1))
	for iteration := 0; iteration < 100; iteration++ {
		want := Best{
			Meta:       BestMeta{Version: rng.Intn(3), Project: randomString(rng)},
			Domains:    make(map[string]BestDomain),
			Containers: make(map[string]string),
		}
		for i := 0; i < rng.Intn(8); i++ {
			id := "d_" + randomString(rng)
			want.Domains[id] = BestDomain{
				Label:  randomString(rng),
				Parent: randomString(rng),
				Type:   randomString(rng),
			}
		}
		for i := 0; i < rng.Intn(8); i++ {
			want.Containers["c_"+randomString(rng)] = randomString(rng)
		}

		raw, err := json.Marshal(want)
		if err != nil {
			t.Fatal(err)
		}
		var got Best
		if err := json.Unmarshal(raw, &got); err != nil {
			t.Fatal(err)
		}
		if !reflect.DeepEqual(got, want) {
			t.Fatalf("第 %d 次 roundtrip 改变结构:\n got=%#v\nwant=%#v", iteration, got, want)
		}
	}
}

func validBest() Best {
	return Best{
		Meta: BestMeta{Version: 1, Project: "test"},
		Domains: map[string]BestDomain{
			"d_root": {Label: "root", Type: "logic"},
			"d_leaf": {Label: "leaf", Parent: "d_root"},
		},
		Containers: map[string]string{"c": "d_leaf"},
	}
}

func containsIssue(issues []string, want string) bool {
	for _, issue := range issues {
		if strings.Contains(issue, want) {
			return true
		}
	}
	return false
}

func randomString(rng *rand.Rand) string {
	const alphabet = "abc"
	n := rng.Intn(4)
	buf := make([]byte, n)
	for i := range buf {
		buf[i] = alphabet[rng.Intn(len(alphabet))]
	}
	return string(buf)
}
