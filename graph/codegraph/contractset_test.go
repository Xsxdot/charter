package codegraph

import (
	"os"
	"path/filepath"
	"testing"
)

func TestSetContractCreateAndUpdate(t *testing.T) {
	repo := t.TempDir()
	if err := os.MkdirAll(filepath.Join(repo, "codegraph"), 0o755); err != nil {
		t.Fatal(err)
	}
	raw, err := os.ReadFile(filepath.Join("testdata", "repo", "codegraph", "target.json"))
	if err != nil {
		t.Fatal(err)
	}
	targetPath := filepath.Join(repo, "codegraph", "target.json")
	if err := os.WriteFile(targetPath, raw, 0o644); err != nil {
		t.Fatal(err)
	}

	before, after, err := SetContract(repo, Contract{From: "d_svc", To: "d_cmd", Entries: []string{"cmd.run"}})
	if err != nil {
		t.Fatalf("创建契约: %v", err)
	}
	if before != nil || after == nil || after.From != "d_svc" || after.To != "d_cmd" || len(after.Entries) != 1 {
		t.Fatalf("创建结果: before=%+v after=%+v", before, after)
	}

	before, after, err = SetContract(repo, Contract{From: "d_svc", To: "d_cmd", LegacyBudget: 5})
	if err != nil {
		t.Fatalf("更新预算: %v", err)
	}
	if before == nil || before.LegacyBudget != 0 || after.LegacyBudget != 5 || len(after.Entries) != 1 || after.Entries[0] != "cmd.run" {
		t.Fatalf("更新结果: before=%+v after=%+v", before, after)
	}

	beforeRaw, err := os.ReadFile(targetPath)
	if err != nil {
		t.Fatal(err)
	}
	beforeGhost, afterGhost, err := SetContract(repo, Contract{From: "d_svc", To: "d_ghost", Entries: []string{"bad"}})
	if err != nil || beforeGhost != nil || afterGhost == nil || afterGhost.To != "d_ghost" {
		t.Fatalf("契约引用完整性已下沉，未知目标域仍应写入: before=%+v after=%+v err=%v", beforeGhost, afterGhost, err)
	}
	afterRaw, err := os.ReadFile(targetPath)
	if err != nil {
		t.Fatal(err)
	}
	if string(beforeRaw) == string(afterRaw) {
		t.Fatal("未知目标域契约应写回 target")
	}
}
