package codegraph

import (
	"bytes"
	"os"
	"path/filepath"
	"strconv"
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

func TestMigrateTargetV1(t *testing.T) {
	repo := writeTargetFixture(t, migrateV1)
	got, err := MigrateTarget(repo)
	if err != nil {
		t.Fatalf("v1 migrate: %v", err)
	}
	if !got.Migrated || got.From != 1 || got.To != 2 {
		t.Fatalf("migrate result: %+v", got)
	}
	raw, err := os.ReadFile(filepath.Join(repo, "codegraph", "target.json"))
	if err != nil {
		t.Fatal(err)
	}
	if string(raw) != migrateV2 {
		t.Fatalf("迁移后的字节不符:\ngot:\n%s\nwant:\n%s", raw, migrateV2)
	}
}

func TestMigrateTargetV2IsIdempotent(t *testing.T) {
	repo := writeTargetFixture(t, migrateV2)
	path := filepath.Join(repo, "codegraph", "target.json")
	before, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	got, err := MigrateTarget(repo)
	if err != nil {
		t.Fatalf("v2 migrate: %v", err)
	}
	if got.Migrated || got.From != 0 || got.To != 0 {
		t.Fatalf("v2 migrate result: %+v", got)
	}
	after, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(before, after) {
		t.Fatal("v2 migrate 不得改写文件")
	}
}

func TestMigrateTargetRejectsUnknownFields(t *testing.T) {
	for _, raw := range []string{
		strings.Replace(migrateV1, `"domains":`, `"unknown": 1, "domains":`, 1),
		strings.Replace(migrateV1, `"type": "logic"`, `"type": "logic", "extra": true`, 1),
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
	for _, version := range []int{0, 3} {
		raw := strings.Replace(migrateV1, `"version": 1`, `"version": `+strconv.Itoa(version), 1)
		if _, err := MigrateTarget(writeTargetFixture(t, raw)); err == nil {
			t.Fatalf("version=%d 应拒绝", version)
		}
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
