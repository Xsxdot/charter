package codegraph

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
)

// MigrateResult 是 migrate 命令的稳定 JSON 结果。v2 输入只输出 migrated=false。
type MigrateResult struct {
	Migrated bool `json:"migrated"`
	From     int  `json:"from,omitempty"`
	To       int  `json:"to,omitempty"`
}

type migrateV1Subsystem struct {
	ID    string   `json:"id"`
	Name  string   `json:"name"`
	Type  string   `json:"type"`
	Paths []string `json:"paths"`
	Note  string   `json:"note,omitempty"`
}

type migrateV1Assignment struct {
	Path   string `json:"path"`
	Domain string `json:"domain"`
}

type migrateV1Target struct {
	Meta        TargetMeta            `json:"meta"`
	Domains     []migrateV1Subsystem  `json:"domains"`
	Assignments []migrateV1Assignment `json:"assignments,omitempty"`
	Assembly    []string              `json:"assembly,omitempty"`
	Contracts   []Contract            `json:"contracts,omitempty"`
}

// migrateV2Domain / migrateV2Subsystem / migrateV2Target are a private frozen
// decoder for the pre-v3 shape. They intentionally never cross into Check.
type migrateV2Domain struct {
	ID             string   `json:"id"`
	Name           string   `json:"name"`
	Responsibility string   `json:"responsibility"`
	Paths          []string `json:"paths"`
}

type migrateV2Subsystem struct {
	ID      string            `json:"id"`
	Name    string            `json:"name"`
	Type    string            `json:"type"`
	Paths   []string          `json:"paths"`
	Note    string            `json:"note,omitempty"`
	Domains []migrateV2Domain `json:"domains,omitempty"`
}

type migrateV2Binding struct {
	Path      string `json:"path"`
	Subsystem string `json:"subsystem"`
}

type migrateV2Target struct {
	Meta       TargetMeta           `json:"meta"`
	Subsystems []migrateV2Subsystem `json:"subsystems"`
	Bindings   []migrateV2Binding   `json:"assignments,omitempty"`
	Assembly   []string             `json:"assembly,omitempty"`
	Contracts  []Contract           `json:"contracts,omitempty"`
}

// MigrateTarget 将 v1 target.json 一次性改写为 v2。它不调用 LoadTarget，
// 因为 LoadTarget 的版本门正是要拒绝 v1；输入解码严格拒绝 schema 外字段。
func MigrateTarget(repoRoot string) (MigrateResult, error) {
	path := filepath.Join(repoRoot, "codegraph", "target.json")
	raw, err := os.ReadFile(path)
	if err != nil {
		return MigrateResult{}, fmt.Errorf("读取待迁移目标图 %s: %w", path, err)
	}

	var probe struct {
		Meta struct {
			Version int `json:"version"`
		} `json:"meta"`
	}
	if err := json.Unmarshal(raw, &probe); err != nil {
		return MigrateResult{}, fmt.Errorf("解析待迁移目标图 %s: %w", path, err)
	}

	switch probe.Meta.Version {
	case 2:
		var target migrateV2Target
		if err := decodeStrict(raw, &target); err != nil {
			return MigrateResult{}, fmt.Errorf("校验 v2 目标图 %s: %w", path, err)
		}
		return MigrateResult{Migrated: false}, nil
	case 1:
		var old migrateV1Target
		if err := decodeStrict(raw, &old); err != nil {
			return MigrateResult{}, fmt.Errorf("校验 v1 目标图 %s: %w", path, err)
		}
		target := migrateV2Target{
			Meta:       old.Meta,
			Subsystems: make([]migrateV2Subsystem, 0, len(old.Domains)),
			Bindings:   make([]migrateV2Binding, 0, len(old.Assignments)),
			Assembly:   old.Assembly,
			Contracts:  old.Contracts,
		}
		target.Meta.Version = 2
		for _, oldSubsystem := range old.Domains {
			target.Subsystems = append(target.Subsystems, migrateV2Subsystem{
				ID: oldSubsystem.ID, Name: oldSubsystem.Name, Type: oldSubsystem.Type,
				Paths: oldSubsystem.Paths, Note: oldSubsystem.Note,
			})
		}
		for _, oldAssignment := range old.Assignments {
			target.Bindings = append(target.Bindings, migrateV2Binding{
				Path: oldAssignment.Path, Subsystem: oldAssignment.Domain,
			})
		}
		if err := saveMigratedTarget(path, &target); err != nil {
			return MigrateResult{}, err
		}
		return MigrateResult{Migrated: true, From: 1, To: 2}, nil
	default:
		return MigrateResult{}, fmt.Errorf("目标图 %s 使用不支持的 schema version %d；migrate 只接受 version 1", path, probe.Meta.Version)
	}
}

// migrateV2SubsystemOf is the private v2 resolver retained solely for migration.
// assignments win over exact/prefix path rules; prefix matches are directory-bounded.
func migrateV2SubsystemOf(target *migrateV2Target, file string) string {
	for _, assignment := range target.Bindings {
		if assignment.Path == file {
			return assignment.Subsystem
		}
	}
	for _, subsystem := range target.Subsystems {
		for _, rule := range subsystem.Paths {
			if migrateV2TargetRuleMatchesFile(file, rule) {
				return subsystem.ID
			}
		}
	}
	return ""
}

func migrateV2CutPathRule(rule string) (string, bool) {
	const suffix = "/**"
	return strings.CutSuffix(rule, suffix)
}

func migrateV2TargetRuleMatchesFile(file, rule string) bool {
	if file == rule {
		return true
	}
	prefix, ok := migrateV2CutPathRule(rule)
	return ok && strings.HasPrefix(file, prefix+"/")
}

func decodeStrict(raw []byte, dst any) error {
	dec := json.NewDecoder(bytes.NewReader(raw))
	dec.DisallowUnknownFields()
	if err := dec.Decode(dst); err != nil {
		return err
	}
	var extra any
	if err := dec.Decode(&extra); err != io.EOF {
		if err == nil {
			return fmt.Errorf("输入包含多个 JSON 值")
		}
		return err
	}
	return nil
}

func saveMigratedTarget(path string, target any) error {
	raw, err := json.MarshalIndent(target, "", "  ")
	if err != nil {
		return fmt.Errorf("编码迁移后的目标图: %w", err)
	}
	dir := filepath.Dir(path)
	tmp, err := os.CreateTemp(dir, "target-migrate-*.json")
	if err != nil {
		return fmt.Errorf("建立目标图临时文件: %w", err)
	}
	tmpPath := tmp.Name()
	cleanup := func() {
		_ = tmp.Close()
		_ = os.Remove(tmpPath)
	}
	if _, err := tmp.Write(append(raw, '\n')); err != nil {
		cleanup()
		return fmt.Errorf("写入目标图临时文件: %w", err)
	}
	if err := tmp.Close(); err != nil {
		_ = os.Remove(tmpPath)
		return fmt.Errorf("关闭目标图临时文件: %w", err)
	}
	if err := os.Rename(tmpPath, path); err != nil {
		_ = os.Remove(tmpPath)
		return fmt.Errorf("原子替换目标图: %w", err)
	}
	return nil
}
