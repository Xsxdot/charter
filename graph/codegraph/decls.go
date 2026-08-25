package codegraph

import (
	"encoding/json"
	"fmt"
	"go/ast"
	"go/parser"
	"go/token"
	"io/fs"
	"os"
	"path/filepath"
	"sort"
	"strings"
)

// LoadDomainDecls 读取 repoRoot/codegraph/domains/*.json。声明目录可以不存在，
// 这样领域声明可以渐进铺开；目录只读一层，领域 id 含 slash 不支持平铺声明。
func LoadDomainDecls(repoRoot string) (map[string]DomainDecl, error) {
	dir := filepath.Join(repoRoot, "codegraph", "domains")
	entries, err := os.ReadDir(dir)
	if os.IsNotExist(err) {
		return map[string]DomainDecl{}, nil
	}
	if err != nil {
		return nil, fmt.Errorf("读取领域声明目录 %s: %w", dir, err)
	}
	decls := make(map[string]DomainDecl)
	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".json") {
			continue
		}
		path := filepath.Join(dir, entry.Name())
		raw, err := os.ReadFile(path)
		if err != nil {
			return nil, fmt.Errorf("读取领域声明 %s: %w", path, err)
		}
		var decl DomainDecl
		if err := json.Unmarshal(raw, &decl); err != nil {
			return nil, fmt.Errorf("解析领域声明 %s: %w", path, err)
		}
		name := strings.TrimSuffix(entry.Name(), ".json")
		if decl.Domain != name {
			return nil, fmt.Errorf("领域声明 %s 的文件名与 domain %q 不一致", path, decl.Domain)
		}
		if strings.TrimSpace(decl.Responsibility) == "" {
			return nil, fmt.Errorf("领域声明 %s 的 responsibility 不能为空", path)
		}
		decls[name] = decl
	}
	return decls, nil
}

// DomainDeclSummary 是 entity 输出的声明摘要，不把人工声明的完整内容复制进查询结果。
type DomainDeclSummary struct {
	Responsibility string `json:"responsibility"`
	Invariants     int    `json:"invariants"`
	StateMachine   int    `json:"stateMachine"`
}

// ValidateDecls 执行领域声明的三项保鲜检查：领域存在、所有 file#Symbol 锚存活、
// 填写的 invariant testRef 对应仓内真实的顶层测试函数。
//
// best 是领域存在性检查的唯一主词表；best == nil 不是成功降级，而是每条声明
// 都产生可见 issue。锚点与 testRef 检查仍沿用当前图和仓内真实顶层测试函数。
func ValidateDecls(v *View, best *Best, repoRoot string, decls map[string]DomainDecl) []string {
	var issues []string
	ids := make([]string, 0, len(decls))
	for id := range decls {
		ids = append(ids, id)
	}
	sort.Strings(ids)

	needsTests := false
	for _, id := range ids {
		for _, invariant := range decls[id].Invariants {
			if invariant.TestRef != "" {
				needsTests = true
				break
			}
		}
	}
	var testNames map[string]bool
	if needsTests {
		var err error
		testNames, err = repoTestFunctions(repoRoot)
		if err != nil {
			issues = append(issues, fmt.Sprintf("扫描 testRef 失败: %v", err))
			testNames = map[string]bool{}
		}
	}

	for _, id := range ids {
		decl := decls[id]
		if best == nil {
			issues = append(issues, fmt.Sprintf("领域 %s 无法在 best 词表校验：best 缺席", id))
		} else if _, ok := best.Domains[id]; !ok {
			issues = append(issues, fmt.Sprintf("领域 %s 不在 best domains 段中", id))
		}
		if decl.Lifecycle != nil {
			issues = append(issues, validateDeclAnchor(v, repoRoot, id, "lifecycle.from", decl.Lifecycle.From)...)
			issues = append(issues, validateDeclAnchor(v, repoRoot, id, "lifecycle.to", decl.Lifecycle.To)...)
		}
		for i, transition := range decl.StateMachine {
			if transition.Anchor != "" {
				issues = append(issues, validateDeclAnchor(v, repoRoot, id,
					fmt.Sprintf("stateMachine[%d].anchor", i), transition.Anchor)...)
			}
		}
		for i, invariant := range decl.Invariants {
			if invariant.TestRef != "" && !testNames[invariant.TestRef] {
				issues = append(issues, fmt.Sprintf("领域 %s 的 invariants[%d] testRef %q 不存在真实测试函数", id, i, invariant.TestRef))
			}
		}
	}
	return issues
}

func validateDeclAnchor(v *View, repoRoot, domain, label, ref string) []string {
	result, err := ResolveAnchor(v, repoRoot, ref)
	if err != nil {
		return []string{fmt.Sprintf("领域 %s 的 %s %q 无法解析: %v", domain, label, ref, err)}
	}
	if result.Anchor == "vanished" || result.Anchor == "file_missing" {
		return []string{fmt.Sprintf("领域 %s 的 %s %q 锚点失效: %s", domain, label, ref, result.Anchor)}
	}
	return nil
}

func repoTestFunctions(repoRoot string) (map[string]bool, error) {
	names := map[string]bool{}
	err := filepath.WalkDir(repoRoot, func(path string, entry fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if entry.IsDir() {
			if entry.Name() == ".git" || entry.Name() == "vendor" {
				return filepath.SkipDir
			}
			return nil
		}
		if !strings.HasSuffix(entry.Name(), "_test.go") {
			return nil
		}
		file, err := parser.ParseFile(token.NewFileSet(), path, nil, 0)
		if err != nil {
			return fmt.Errorf("解析测试文件 %s: %w", path, err)
		}
		for _, decl := range file.Decls {
			fn, ok := decl.(*ast.FuncDecl)
			if ok && fn.Recv == nil {
				names[fn.Name.Name] = true
			}
		}
		return nil
	})
	return names, err
}
