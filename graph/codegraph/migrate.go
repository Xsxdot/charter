package codegraph

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"slices"
	"strings"
)

// MigrateResult 是 migrate 命令的稳定 JSON 结果。
type MigrateResult struct {
	Migrated bool     `json:"migrated"`
	From     int      `json:"from,omitempty"`
	To       int      `json:"to,omitempty"`
	Notes    []string `json:"notes,omitempty"`
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

// migrateV2Domain / migrateV2Subsystem / migrateV2Target 是迁移专用、冻结的
// v3 前结构解码器；它们有意不进入 Check 链路。
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

// MigrateTarget 将 v2 target.json 与 baseline.json 机械迁移为 v3 target.json 与
// v1 best.json。v1 先在内存中转成私有 v2 结构，再走同一条 v2→v3 产物路径。
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
	case 3:
		return MigrateResult{Migrated: false}, nil
	case 2:
		var target migrateV2Target
		if err := decodeStrict(raw, &target); err != nil {
			return MigrateResult{}, fmt.Errorf("校验 v2 目标图 %s: %w", path, err)
		}
		return migrateV2ToV3(repoRoot, path, &target, 2)
	case 1:
		var old migrateV1Target
		if err := decodeStrict(raw, &old); err != nil {
			return MigrateResult{}, fmt.Errorf("校验 v1 目标图 %s: %w", path, err)
		}
		target := migrateV1ToV2(&old)
		if err := migrateSaveTarget(path, &target); err != nil {
			return MigrateResult{}, err
		}
		return MigrateResult{Migrated: true, From: 1, To: 2}, nil
	default:
		return MigrateResult{}, fmt.Errorf("目标图 %s 使用不支持的 schema version %d；migrate 只接受 version 1、2，version 3 幂等", path, probe.Meta.Version)
	}
}

func migrateV1ToV2(old *migrateV1Target) migrateV2Target {
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
	return target
}

var (
	migrateSaveBest   = saveMigratedBest
	migrateSaveTarget = saveMigratedTarget
)

func migrateV2ToV3(repoRoot, targetPath string, target *migrateV2Target, from int) (MigrateResult, error) {
	bestPath := filepath.Join(repoRoot, "codegraph", "best.json")
	if _, err := os.Stat(bestPath); err == nil {
		return MigrateResult{}, fmt.Errorf("最优图 %s 已存在，migrate 拒绝覆盖", bestPath)
	} else if !os.IsNotExist(err) {
		return MigrateResult{}, fmt.Errorf("检查最优图 %s: %w", bestPath, err)
	}

	graph, err := LoadGraph(repoRoot)
	if err != nil {
		return MigrateResult{}, fmt.Errorf("读取迁移所需 baseline.json: %w", err)
	}
	best := migrateInitialBest(target, graph)
	if issues := ValidateBest(best); len(issues) > 0 {
		return MigrateResult{}, fmt.Errorf("迁移生成的最优图不合法: %v", issues)
	}
	if err := migrateSaveBest(bestPath, best); err != nil {
		return MigrateResult{}, err
	}

	v3 := Target{Meta: target.Meta, Assembly: target.Assembly, Contracts: target.Contracts}
	v3.Meta.Version = 3
	if err := migrateSaveTarget(targetPath, &v3); err != nil {
		return MigrateResult{}, err
	}
	return MigrateResult{Migrated: true, From: from, To: 3, Notes: migrationNotes()}, nil
}

func migrateInitialBest(target *migrateV2Target, graph *Graph) *Best {
	best := &Best{
		Meta:       BestMeta{Version: 1, Project: target.Meta.Project},
		Domains:    make(map[string]BestDomain, len(target.Subsystems)),
		Containers: make(map[string]string),
	}
	for _, subsystem := range target.Subsystems {
		responsibility := subsystem.Note
		if responsibility == "" {
			responsibility = "（迁移生成，待填写）"
		}
		best.Domains[subsystem.ID] = BestDomain{
			Label:          subsystem.Name,
			Responsibility: responsibility,
			Type:           subsystem.Type,
		}
	}

	containerIDs := make([]string, 0, len(graph.Containers))
	for containerID := range graph.Containers {
		containerIDs = append(containerIDs, containerID)
	}
	slices.Sort(containerIDs)
	for _, containerID := range containerIDs {
		nodeIDs := make([]string, 0)
		for nodeID, node := range graph.Nodes {
			if node.Container == containerID {
				nodeIDs = append(nodeIDs, nodeID)
			}
		}
		slices.Sort(nodeIDs)
		if len(nodeIDs) == 0 {
			continue
		}
		if domainID := migrateV2SubsystemOf(target, graph.Nodes[nodeIDs[0]].File); domainID != "" {
			best.Containers[containerID] = domainID
		}
	}
	return best
}

func migrationNotes() []string {
	return []string{
		"初版是现状的机械翻译，不是最优结构。",
		"Responsibility 是占位符，请逐项补写。",
		"container-misplaced 初版下的预期条数为 0；这不代表没有 gap。",
	}
}

// migrateV2SubsystemOf 是仅为迁移保留的私有 v2 归属解析器。
// assignments 优先于精确/前缀路径规则；前缀匹配受目录边界约束。
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

func saveMigratedBest(path string, best *Best) error {
	return saveMigratedJSON(path, best, "best-migrate-", "最优图")
}

func saveMigratedTarget(path string, target any) error {
	return saveMigratedJSON(path, target, "target-migrate-", "目标图")
}

func saveMigratedJSON(path string, value any, prefix, label string) error {
	raw, err := json.MarshalIndent(value, "", "  ")
	if err != nil {
		return fmt.Errorf("编码迁移后的%s: %w", label, err)
	}
	dir := filepath.Dir(path)
	tmp, err := os.CreateTemp(dir, prefix+"*.json")
	if err != nil {
		return fmt.Errorf("建立%s临时文件: %w", label, err)
	}
	tmpPath := tmp.Name()
	cleanup := func() {
		_ = tmp.Close()
		_ = os.Remove(tmpPath)
	}
	if _, err := tmp.Write(append(raw, '\n')); err != nil {
		cleanup()
		return fmt.Errorf("写入%s临时文件: %w", label, err)
	}
	if err := tmp.Close(); err != nil {
		_ = os.Remove(tmpPath)
		return fmt.Errorf("关闭%s临时文件: %w", label, err)
	}
	if err := os.Rename(tmpPath, path); err != nil {
		_ = os.Remove(tmpPath)
		return fmt.Errorf("原子替换%s: %w", label, err)
	}
	return nil
}
