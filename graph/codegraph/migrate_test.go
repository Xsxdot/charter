package codegraph

import (
	"bytes"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

const migrateV1 = `{
  "meta": { "version": 1, "project": "fixture" },
  "domains": [
    { "id": "d_svc", "name": "服务", "type": "logic", "paths": ["svc/**"] }
  ],
  "assignments": [{ "path": "svc/mirror.go", "domain": "d_svc" }],
  "assembly": ["cmd/run.go"],
  "contracts": [{ "from": "d_svc", "to": "d_svc", "entries": ["svc.Server"], "legacyBudget": 0 }]
}
`

const migrateV2 = `{
  "meta": {
    "version": 2,
    "project": "fixture"
  },
  "subsystems": [
    {
      "id": "d_svc",
      "name": "服务",
      "type": "logic",
      "paths": [
        "svc/**"
      ]
    }
  ],
  "assignments": [
    {
      "path": "svc/mirror.go",
      "subsystem": "d_svc"
    }
  ],
  "assembly": [
    "cmd/run.go"
  ],
  "contracts": [
    {
      "from": "d_svc",
      "to": "d_svc",
      "entries": [
        "svc.Server"
      ]
    }
  ]
}
`

const migrateBaseline = `{
  "meta": { "project": "fixture" },
  "containers": {
    "c_svc": { "label": "svc" },
    "c_empty": { "label": "empty" },
    "c_unplaced": { "label": "web" }
  },
  "nodes": {
    "n_z": { "kind": "func", "container": "c_svc", "name": "Z", "file": "svc/z.go" },
    "n_a": { "kind": "func", "container": "c_svc", "name": "A", "file": "svc/a.go" },
    "n_unplaced": { "kind": "func", "container": "c_unplaced", "name": "Web", "file": "web/x.ts" }
  },
  "edges": []
}
`

func writeTargetFixture(t *testing.T, raw string) string {
	t.Helper()
	repo := t.TempDir()
	if err := os.MkdirAll(filepath.Join(repo, "codegraph"), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(repo, "codegraph", "target.json"), []byte(raw), 0o644); err != nil {
		t.Fatal(err)
	}
	return repo
}

func writeBaselineFixture(t *testing.T, repo string) {
	t.Helper()
	if err := os.WriteFile(filepath.Join(repo, "codegraph", "baseline.json"), []byte(migrateBaseline), 0o644); err != nil {
		t.Fatal(err)
	}
}

func TestMigrateTargetV2ProducesDualArtifacts(t *testing.T) {
	repo := writeTargetFixture(t, migrateV2)
	writeBaselineFixture(t, repo)
	got, err := MigrateTarget(repo)
	if err != nil {
		t.Fatalf("v2 migrate: %v", err)
	}
	if !got.Migrated || got.From != 2 || got.To != 3 || len(got.Notes) != 3 {
		t.Fatalf("migrate result: %+v", got)
	}
	for _, note := range []string{"机械翻译", "不是最优结构", "Responsibility", "container-misplaced", "预期条数"} {
		found := false
		for _, item := range got.Notes {
			if strings.Contains(item, note) {
				found = true
			}
		}
		if !found {
			t.Errorf("迁移提示缺少 %q: %v", note, got.Notes)
		}
	}

	target, err := LoadTarget(repo)
	if err != nil {
		t.Fatalf("迁移后 target 应可加载: %v", err)
	}
	best, err := LoadBest(repo)
	if err != nil {
		t.Fatalf("迁移后 best 应可加载: %v", err)
	}
	if best.Containers["c_svc"] != "d_svc" || best.Containers["c_empty"] != "" || best.Containers["c_unplaced"] != "" {
		t.Fatalf("容器初版归属错误: %+v", best.Containers)
	}
	for id, domain := range best.Domains {
		if domain.Parent != "" {
			t.Fatalf("初版 best 不得伪造父子树: %s=%+v", id, domain)
		}
		if domain.Responsibility != "（迁移生成，待填写）" {
			t.Fatalf("空 note 应使用固定占位责任: %s=%+v", id, domain)
		}
	}
	if issues := ValidateBest(best); len(issues) != 0 {
		t.Fatalf("迁移生成的 best 不应有 issue: %v", issues)
	}

	graph, err := LoadGraph(repo)
	if err != nil {
		t.Fatal(err)
	}
	rep := Check(target, best, Merge(graph, nil), nil)
	if !hasFindingFrom(rep.Warns, KindContainerUnplaced, "c_unplaced") {
		t.Fatalf("未决议容器应报告 container-unplaced: %+v", rep.Warns)
	}
}

func TestMigrateTargetIsDeterministic(t *testing.T) {
	makeRepo := func() (string, []byte, []byte) {
		repo := writeTargetFixture(t, migrateV2)
		writeBaselineFixture(t, repo)
		if _, err := MigrateTarget(repo); err != nil {
			t.Fatal(err)
		}
		target, err := os.ReadFile(filepath.Join(repo, "codegraph", "target.json"))
		if err != nil {
			t.Fatal(err)
		}
		best, err := os.ReadFile(filepath.Join(repo, "codegraph", "best.json"))
		if err != nil {
			t.Fatal(err)
		}
		return repo, target, best
	}
	_, targetA, bestA := makeRepo()
	_, targetB, bestB := makeRepo()
	if !bytes.Equal(targetA, targetB) || !bytes.Equal(bestA, bestB) {
		t.Fatalf("相同输入的迁移产物必须逐字节相同:\ntarget A=%s\ntarget B=%s\nbest A=%s\nbest B=%s", targetA, targetB, bestA, bestB)
	}
}

func TestMigrateTargetV1KeepsTwoHopCompatibility(t *testing.T) {
	repo := writeTargetFixture(t, migrateV1)
	got, err := MigrateTarget(repo)
	if err != nil {
		t.Fatalf("v1 migrate: %v", err)
	}
	if !got.Migrated || got.From != 1 || got.To != 2 {
		t.Fatalf("v1→v2 migrate result: %+v", got)
	}
	if _, err := LoadTarget(repo); err == nil {
		t.Fatal("v1→v2 后 target 仍不是可执法的 v3")
	}
	writeBaselineFixture(t, repo)
	got, err = MigrateTarget(repo)
	if err != nil || !got.Migrated || got.From != 2 || got.To != 3 {
		t.Fatalf("v2→v3 migrate result: %+v err=%v", got, err)
	}
	if _, err := LoadTarget(repo); err != nil {
		t.Fatalf("两跳迁移后 target 应为 v3: %v", err)
	}
	if _, err := LoadBest(repo); err != nil {
		t.Fatalf("两跳迁移后 best 应可读: %v", err)
	}
}

func TestMigrateTargetV3IsIdempotent(t *testing.T) {
	repo := writeTargetFixture(t, `{"meta":{"version":3,"project":"fixture"},"contracts":[]}`)
	path := filepath.Join(repo, "codegraph", "target.json")
	before, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	got, err := MigrateTarget(repo)
	if err != nil || got.Migrated || got.From != 0 || got.To != 0 {
		t.Fatalf("v3 migrate 应幂等 no-op: result=%+v err=%v", got, err)
	}
	after, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(before, after) {
		t.Fatal("v3 migrate 不得改写 target")
	}
}

func TestMigrateTargetRejectsUnknownFields(t *testing.T) {
	for _, raw := range []string{
		strings.Replace(migrateV2, `"subsystems":`, `"unknown": 1, "subsystems":`, 1),
		strings.Replace(migrateV1, `"domains":`, `"unknown": 1, "domains":`, 1),
	} {
		if _, err := MigrateTarget(writeTargetFixture(t, raw)); err == nil {
			t.Fatalf("未知键应拒绝迁移: %s", raw)
		}
	}
}

func TestMigrateTargetRejectsMissingAndUnsupportedVersions(t *testing.T) {
	if _, err := MigrateTarget(t.TempDir()); err == nil {
		t.Fatal("target 缺失应报错")
	}
	for _, version := range []string{"0", "4"} {
		raw := strings.Replace(migrateV2, `"version": 2`, `"version": `+version, 1)
		if _, err := MigrateTarget(writeTargetFixture(t, raw)); err == nil {
			t.Fatalf("version=%s 应拒绝", version)
		}
	}
}

func TestMigrateTargetRequiresBaselineAndDoesNotWrite(t *testing.T) {
	repo := writeTargetFixture(t, migrateV2)
	path := filepath.Join(repo, "codegraph", "target.json")
	before, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := MigrateTarget(repo); err == nil || !strings.Contains(err.Error(), "baseline.json") {
		t.Fatalf("缺失 baseline 应报错并指向 baseline.json: %v", err)
	}
	after, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(before, after) {
		t.Fatal("baseline 缺失时不得改写 target")
	}
}

func TestMigrateTargetRejectsExistingBestWithoutChangingTarget(t *testing.T) {
	repo := writeTargetFixture(t, migrateV2)
	writeBaselineFixture(t, repo)
	targetPath := filepath.Join(repo, "codegraph", "target.json")
	bestPath := filepath.Join(repo, "codegraph", "best.json")
	before, err := os.ReadFile(targetPath)
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(bestPath, []byte(`{"meta":{"version":1,"project":"existing"},"domains":{},"containers":{}}`), 0o644); err != nil {
		t.Fatal(err)
	}
	if _, err := MigrateTarget(repo); err == nil || !strings.Contains(err.Error(), "已存在") {
		t.Fatalf("best 已存在应拒绝覆盖: %v", err)
	}
	after, err := os.ReadFile(targetPath)
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(before, after) {
		t.Fatal("best 已存在时不得改写 target")
	}
}

func TestMigrateTargetWritesBestBeforeTarget(t *testing.T) {
	repo := writeTargetFixture(t, migrateV2)
	writeBaselineFixture(t, repo)
	targetPath := filepath.Join(repo, "codegraph", "target.json")
	before, err := os.ReadFile(targetPath)
	if err != nil {
		t.Fatal(err)
	}
	original := migrateSaveTarget
	migrateSaveTarget = func(string, any) error { return errors.New("target write blocked") }
	defer func() { migrateSaveTarget = original }()
	if _, err := MigrateTarget(repo); err == nil || !strings.Contains(err.Error(), "target write blocked") {
		t.Fatalf("target 写失败应原样返回: %v", err)
	}
	if _, err := os.Stat(filepath.Join(repo, "codegraph", "best.json")); err != nil {
		t.Fatalf("target 写失败前 best 应已写成: %v", err)
	}
	after, err := os.ReadFile(targetPath)
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(before, after) {
		t.Fatal("target 写失败时 target 必须仍是 v2")
	}
}

func TestMigrateTargetValidatesBestBeforeWriting(t *testing.T) {
	repo := writeTargetFixture(t, strings.Replace(migrateV2, `"project": "fixture"`, `"project": ""`, 1))
	writeBaselineFixture(t, repo)
	if _, err := MigrateTarget(repo); err == nil || !strings.Contains(err.Error(), "最优图不合法") {
		t.Fatalf("生成非法 best 应在写盘前拒绝: %v", err)
	}
	if _, err := os.Stat(filepath.Join(repo, "codegraph", "best.json")); !os.IsNotExist(err) {
		t.Fatalf("best 校验失败不得写 best，stat=%v", err)
	}
}

func TestMigrateV2CutPathRule(t *testing.T) {
	cases := []struct {
		rule           string
		wantPrefix     string
		wantPrefixRule bool
	}{
		{rule: "a/**", wantPrefix: "a", wantPrefixRule: true},
		{rule: "a/b/**", wantPrefix: "a/b", wantPrefixRule: true},
		{rule: "a/b.go", wantPrefix: "a/b.go"},
		{rule: "**", wantPrefix: "**"},
		{rule: "a/**/b", wantPrefix: "a/**/b"},
		{rule: "", wantPrefix: ""},
	}
	for _, tc := range cases {
		got, prefixRule := migrateV2CutPathRule(tc.rule)
		if got != tc.wantPrefix || prefixRule != tc.wantPrefixRule {
			t.Errorf("migrateV2CutPathRule(%q) = (%q, %v), want (%q, %v)", tc.rule, got, prefixRule, tc.wantPrefix, tc.wantPrefixRule)
		}
	}
}

func TestMigrateV2SubsystemOf(t *testing.T) {
	target := &migrateV2Target{
		Subsystems: []migrateV2Subsystem{
			{ID: "d_svc", Paths: []string{"svc/**"}},
			{ID: "d_cmd", Paths: []string{"cmd/run.go"}},
		},
		Bindings: []migrateV2Binding{{Path: "svc/mirror.go", Subsystem: "d_cmd"}},
	}
	cases := []struct{ file, want string }{
		{file: "svc/task.go", want: "d_svc"},
		{file: "svc/mirror.go", want: "d_cmd"},
		{file: "cmd/run.go", want: "d_cmd"},
		{file: "web/x.ts", want: ""},
	}
	for _, tc := range cases {
		if got := migrateV2SubsystemOf(target, tc.file); got != tc.want {
			t.Errorf("migrateV2SubsystemOf(%q) = %q, want %q", tc.file, got, tc.want)
		}
	}
	if got := migrateV2SubsystemOf(target, "svcx/task.go"); got != "" {
		t.Fatalf("前缀必须整段匹配，svcx 不得命中 svc: %q", got)
	}
}
