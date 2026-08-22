// cli 命令树测试：validate/chain/who-calls 等子命令的 JSON 契约与退出语义。
// 自 handoff cmd/graph_test.go 迁移（harness 由「rootCmd + "graph" 前缀」改为直挂 New 构造的根）。
package cli

import (
	"bytes"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/Xsxdot/charter/graph/codegraph"
)

// runGraph 执行 codegraph <args...>，返回 stdout 与 err。
func runGraph(t *testing.T, args ...string) (string, error) {
	t.Helper()
	root := New("codegraph")
	buf := &bytes.Buffer{}
	root.SetOut(buf)
	root.SetErr(buf)
	root.SetArgs(args)
	defer root.SetArgs(nil)
	err := root.Execute()
	return buf.String(), err
}

func runGraphSeparate(t *testing.T, args ...string) (stdout, stderr string, err error) {
	t.Helper()
	root := New("codegraph")
	outBuf, errBuf := &bytes.Buffer{}, &bytes.Buffer{}
	root.SetOut(outBuf)
	root.SetErr(errBuf)
	root.SetArgs(args)
	defer root.SetArgs(nil)
	err = root.Execute()
	return outBuf.String(), errBuf.String(), err
}

const fixtureRepo = "../codegraph/testdata/repo"

func TestGraphValidate(t *testing.T) {
	out, err := runGraph(t, "validate", "--repo", fixtureRepo)
	if err != nil {
		t.Fatalf("validate 应通过: %v\n%s", err, out)
	}
	var r map[string]any
	if json.Unmarshal([]byte(out), &r) != nil ||
		r["nodes"].(float64) != 8 || r["unscannedEntries"].(float64) != 1 {
		t.Fatalf("统计 JSON 形状: %s", out)
	}
}

// TestGraphValidateEdgeIssues 锁 validate 输出的 edgeIssues 字段（B173 调用边门控接线）：
// 键必须存在（清洗脚本与外部消费方的 wire 契约），干净夹具上不得有假边。
func TestGraphValidateEdgeIssues(t *testing.T) {
	out, err := runGraph(t, "validate", "--repo", fixtureRepo)
	if err != nil {
		t.Fatalf("validate 应通过: %v\n%s", err, out)
	}
	var r map[string]any
	if err := json.Unmarshal([]byte(out), &r); err != nil {
		t.Fatalf("JSON 解析: %v\n%s", err, out)
	}
	eis, ok := r["edgeIssues"]
	if !ok {
		t.Fatalf("validate 输出缺 edgeIssues 字段: %s", out)
	}
	if arr, _ := eis.([]any); len(arr) != 0 {
		t.Fatalf("干净夹具不应有假边: %v", eis)
	}
}

func TestGraphChainDefaultDepth(t *testing.T) {
	out, err := runGraph(t, "chain", "e_run", "--repo", fixtureRepo)
	if err != nil {
		t.Fatal(err)
	}
	var r struct {
		Nodes   []map[string]any `json:"nodes"`
		Warning string           `json:"warning"`
	}
	if json.Unmarshal([]byte(out), &r) != nil {
		t.Fatalf("非法 JSON: %s", out)
	}
	// 默认深度 2：e_run + runE + do
	if len(r.Nodes) != 3 || r.Warning == "" {
		t.Fatalf("默认深度/警示: %d %q", len(r.Nodes), r.Warning)
	}
}

func TestGraphWhoCallsUnionByName(t *testing.T) {
	// 按名字解析 + 多参数并集 + --depth 0 不限
	out, err := runGraph(t, "who-calls", "Server.Save", "Server.Do", "--depth", "0", "--repo", fixtureRepo)
	if err != nil {
		t.Fatal(err)
	}
	var r struct {
		Foci  []string         `json:"foci"`
		Nodes []map[string]any `json:"nodes"`
	}
	if json.Unmarshal([]byte(out), &r) != nil {
		t.Fatalf("非法 JSON: %s", out)
	}
	if len(r.Foci) != 2 || len(r.Nodes) != 4 {
		t.Fatalf("并集: foci=%v nodes=%d", r.Foci, len(r.Nodes))
	}
}

func TestGraphChainWithView(t *testing.T) {
	out, err := runGraph(t, "chain", "e_run", "--depth", "0", "--view", "branch-x", "--repo", fixtureRepo)
	if err != nil {
		t.Fatal(err)
	}
	// branch-x 视图里链路走 audit 不走 save
	if !bytes.Contains([]byte(out), []byte("n_audit")) || bytes.Contains([]byte(out), []byte("n_save")) {
		t.Fatalf("视图叠加没生效: %s", out)
	}
}

func TestGraphResolveErrorListsCandidates(t *testing.T) {
	out, err := runGraph(t, "chain", "Do", "--repo", fixtureRepo)
	if err == nil {
		t.Fatalf("模糊名应报错: %s", out)
	}
	if !bytes.Contains([]byte(err.Error()), []byte("Server.Do")) {
		t.Fatalf("报错要带候选: %v", err)
	}
}

func TestGraphDomains(t *testing.T) {
	out, err := runGraph(t, "domains", "--repo", fixtureRepo)
	if err != nil {
		t.Fatalf("domains 应通过: %v\n%s", err, out)
	}
	var r struct {
		View    string `json:"view"`
		Domains []struct {
			ID             string   `json:"id"`
			Children       []string `json:"children"`
			Funcs          int      `json:"funcs"`
			Interfaces     []string `json:"interfaces"`
			Subsystems     []string `json:"subsystems"`
			CrossSubsystem bool     `json:"crossSubsystem"`
		} `json:"domains"`
		Warning string `json:"warning"`
	}
	if json.Unmarshal([]byte(out), &r) != nil {
		t.Fatalf("非法 JSON: %s", out)
	}
	if len(r.Domains) != 4 || r.Domains[0].ID != "d_cli" || r.Warning != "" {
		t.Fatalf("领域树形状: %s", out)
	}
	if r.Domains[1].ID != "d_svc" || len(r.Domains[1].Children) != 2 {
		t.Fatalf("嵌套子领域没出来: %s", out)
	}
	for _, d := range r.Domains {
		if d.ID == "d_svc/store" && (!d.CrossSubsystem || len(d.Subsystems) != 2) {
			t.Fatalf("跨子系统派生: %+v", d)
		}
	}
}

func TestGraphValidateReportsDomainCount(t *testing.T) {
	out, err := runGraph(t, "validate", "--repo", fixtureRepo)
	if err != nil {
		t.Fatalf("validate 应通过: %v\n%s", err, out)
	}
	var r map[string]any
	if json.Unmarshal([]byte(out), &r) != nil || r["domains"].(float64) != 4 {
		t.Fatalf("validate 要报领域计数: %s", out)
	}
	if r["domainDecls"].(float64) != 1 {
		t.Fatalf("validate 要报声明计数: %s", out)
	}
}

func TestGraphDomainsTargetIsSoftDependency(t *testing.T) {
	for _, version := range []int{0, 1} {
		repo := t.TempDir()
		copyFixtureRepo(t, fixtureRepo, repo)
		path := filepath.Join(repo, "codegraph", "target.json")
		if version == 0 {
			if err := os.Remove(path); err != nil {
				t.Fatal(err)
			}
		} else if err := os.WriteFile(path, []byte(`{"meta":{"version":1},"domains":[]}`), 0o644); err != nil {
			t.Fatal(err)
		}
		stdout, stderr, err := runGraphSeparate(t, "domains", "--repo", repo)
		if err != nil {
			t.Fatalf("target version=%d 时 domains 应通过: %v stdout=%s stderr=%s", version, err, stdout, stderr)
		}
		if bytes.Contains([]byte(stdout), []byte(`"subsystems"`)) || bytes.Contains([]byte(stdout), []byte(`"crossSubsystem"`)) {
			t.Fatalf("target version=%d 时派生字段应省略: %s", version, stdout)
		}
		if !strings.Contains(stderr, "subsystems") {
			t.Fatalf("target version=%d 时 stderr 应提示字段省略: %s", version, stderr)
		}
	}
}

func TestGraphValidateDomainDeclIssuePrefix(t *testing.T) {
	repo := t.TempDir()
	copyFixtureRepo(t, fixtureRepo, repo)
	path := filepath.Join(repo, "codegraph", "domains", "d_cli.json")
	if err := os.WriteFile(path, []byte(`{"domain":"d_cli","responsibility":"x","lifecycle":{"from":"svc/server.go#Gone","to":"svc/server.go#Gone"}}`), 0o644); err != nil {
		t.Fatal(err)
	}
	out, err := runGraph(t, "validate", "--repo", repo)
	if err == nil || !strings.Contains(out, "[decl d_cli]") {
		t.Fatalf("坏声明应带领域前缀并非零: err=%v out=%s", err, out)
	}
}

// check：fixture target 与 baseline 套合后输出 Report JSON。
func TestGraphCheck(t *testing.T) {
	out, err := runGraph(t, "check", "--repo", fixtureRepo)
	if err != nil {
		t.Fatalf("check 应通过: %v\n%s", err, out)
	}
	for _, want := range []string{`"fails"`, `"warns"`} {
		if !bytes.Contains([]byte(out), []byte(want)) {
			t.Fatalf("check 输出缺字段 %s: %s", want, out)
		}
	}
}

func TestGraphCheckMissingTargetFails(t *testing.T) {
	// 指向一个没有 target.json 的仓：必须报错退出，不能静默通过。
	_, err := runGraph(t, "check", "--repo", t.TempDir())
	if err == nil {
		t.Fatal("无 target 的 check 必须失败")
	}
}

func TestGraphTargetVersionGate(t *testing.T) {
	for _, version := range []int{1, 3} {
		repo := t.TempDir()
		copyFixtureRepo(t, fixtureRepo, repo)
		path := filepath.Join(repo, "codegraph", "target.json")
		raw, err := os.ReadFile(path)
		if err != nil {
			t.Fatal(err)
		}
		raw = bytes.Replace(raw, []byte(`"version": 2`), []byte(fmt.Sprintf(`"version": %d`, version)), 1)
		if err := os.WriteFile(path, raw, 0o644); err != nil {
			t.Fatal(err)
		}
		_, err = runGraph(t, "check", "--repo", repo)
		if err == nil || !strings.Contains(err.Error(), "codegraph migrate") {
			t.Fatalf("version=%d check 应指向 migrate: %v", version, err)
		}
		_, err = runGraph(t, "contract", "set", "--from", "d_cmd", "--to", "d_svc", "--repo", repo)
		if err == nil || !strings.Contains(err.Error(), "codegraph migrate") {
			t.Fatalf("version=%d contract set 应指向 migrate: %v", version, err)
		}
	}
}

func TestGraphCommandCountIncludesMigrate(t *testing.T) {
	root := New("codegraph")
	count := 0
	for _, command := range root.Commands() {
		if command.Name() == "help" || command.Name() == "completion" {
			continue
		}
		count++
	}
	if count != 14 {
		t.Fatalf("codegraph 业务子命令数=%d，want 14", count)
	}
	for _, command := range root.Commands() {
		if command.Name() == "migrate" {
			return
		}
	}
	t.Fatal("子命令列表缺 migrate")
}

func TestGraphAbsorb(t *testing.T) {
	repo := t.TempDir()
	copyFixtureRepo(t, fixtureRepo, repo)
	out, err := runGraph(t, "absorb", "branch-x", "--repo", repo, "--commit", "abc123", "--branch", "main")
	if err != nil {
		t.Fatalf("absorb 应通过: %v\n%s", err, out)
	}
	g, err := codegraph.LoadGraph(repo)
	if err != nil {
		t.Fatal(err)
	}
	if g.Meta.Commit != "abc123" || g.Meta.Branch != "main" {
		t.Fatalf("meta 来源戳未刷新: %+v", g.Meta)
	}
	if _, ok := g.Nodes["n_audit"]; !ok {
		t.Fatal("added 节点未写入基线")
	}
	if _, ok := g.Nodes["n_save"]; ok {
		t.Fatal("deleted 节点仍在基线")
	}
	if _, err := os.Stat(filepath.Join(repo, "codegraph", "diffs", "branch-x.json")); !os.IsNotExist(err) {
		t.Fatalf("diff 应在写盘成功后删除，stat=%v", err)
	}
}

// TestGraphAbsorbRejectsFakeEdges 锁 R6 的 absorb 拒假边门（acceptance 补牙）：
// 视图带跨语言调用边（Go n_do → TS m_task_ts）必须拒绝併入，基线与 diff 文件均不得动。
func TestGraphAbsorbRejectsFakeEdges(t *testing.T) {
	repo := t.TempDir()
	copyFixtureRepo(t, fixtureRepo, repo)
	view := `{"view":"branch:fake","base":"abc1234","summary":"含假边","edgesAdded":[["n_do","m_task_ts"]]}`
	if err := os.WriteFile(filepath.Join(repo, "codegraph", "diffs", "branch-fake.json"), []byte(view), 0o644); err != nil {
		t.Fatal(err)
	}
	out, err := runGraph(t, "absorb", "branch-fake", "--repo", repo, "--commit", "abc123", "--branch", "main")
	if err == nil {
		t.Fatalf("含假边视图应被拒绝併入: %s", out)
	}
	if !strings.Contains(err.Error(), "不可能真实的调用边") {
		t.Fatalf("拒绝理由应指向调用边门控: %v", err)
	}
	if _, statErr := os.Stat(filepath.Join(repo, "codegraph", "diffs", "branch-fake.json")); statErr != nil {
		t.Fatalf("拒收后 diff 文件应保留: %v", statErr)
	}
	g, err := codegraph.LoadGraph(repo)
	if err != nil {
		t.Fatal(err)
	}
	for _, e := range g.Edges {
		if e[0] == "n_do" && e[1] == "m_task_ts" {
			t.Fatal("假边被写入基线")
		}
	}
}

func TestGraphSym(t *testing.T) {
	out, err := runGraph(t, "sym", "Do", "--repo", fixtureRepo)
	if err != nil {
		t.Fatalf("sym 应通过: %v\n%s", err, out)
	}
	var r struct {
		Matches []struct {
			ID        string `json:"id"`
			Anchor    string `json:"anchor"`
			Line      int    `json:"line"`
			Signature string `json:"signature"`
		} `json:"matches"`
	}
	if err := json.Unmarshal([]byte(out), &r); err != nil {
		t.Fatalf("非法 JSON: %v\n%s", err, out)
	}
	if len(r.Matches) != 1 || r.Matches[0].ID != "n_do" || r.Matches[0].Anchor != "ok" ||
		r.Matches[0].Line != 4 || r.Matches[0].Signature == "" {
		t.Fatalf("sym 结果: %s", out)
	}
}

func TestGraphSymMiss(t *testing.T) {
	out, err := runGraph(t, "sym", "Nope", "--repo", fixtureRepo)
	if err == nil || !bytes.Contains([]byte(err.Error()), []byte("图未覆盖")) {
		t.Fatalf("sym 未命中错误: err=%v out=%s", err, out)
	}
}

func TestGraphEntity(t *testing.T) {
	repo := t.TempDir()
	copyFixtureRepo(t, fixtureRepo, repo)
	path := filepath.Join(repo, "codegraph", "baseline.json")
	raw, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	raw = bytes.Replace(raw, []byte(`"domain": "d_svc/store"`), []byte(`"domain": "d_cli"`), 1)
	if err := os.WriteFile(path, raw, 0o644); err != nil {
		t.Fatal(err)
	}
	out, err := runGraph(t, "entity", "Task", "--repo", repo)
	if err != nil {
		t.Fatalf("entity 应通过: %v\n%s", err, out)
	}
	var r struct {
		Model    map[string]any   `json:"model"`
		Typed    []map[string]any `json:"typed"`
		Handroll []map[string]any `json:"handroll"`
	}
	if err := json.Unmarshal([]byte(out), &r); err != nil {
		t.Fatalf("非法 JSON: %v\n%s", err, out)
	}
	if r.Model["id"] != "m_task" || len(r.Typed) == 0 || len(r.Handroll) == 0 {
		t.Fatalf("entity 输出形状: %s", out)
	}
	for _, key := range []string{`"creators"`, `"writers"`, `"domainDecl"`} {
		if !bytes.Contains([]byte(out), []byte(key)) {
			t.Fatalf("entity 输出缺 %s: %s", key, out)
		}
	}
}

func TestGraphResolveDoc(t *testing.T) {
	repo := t.TempDir()
	copyFixtureRepo(t, fixtureRepo, repo)
	doc := filepath.Join(repo, "doc.md")
	if err := os.WriteFile(doc, []byte("`svc/server.go#Do` `svc/server.go#Gone`"), 0o644); err != nil {
		t.Fatal(err)
	}
	out, err := runGraph(t, "resolve", "--doc", doc, "--repo", repo)
	if err == nil || !bytes.Contains([]byte(out), []byte(`"anchor"`)) || !bytes.Contains([]byte(out), []byte(`"vanished"`)) {
		t.Fatalf("坏文档锚点应非零并输出结果: err=%v out=%s", err, out)
	}
}

func TestGraphResolveSingle(t *testing.T) {
	repo := t.TempDir()
	copyFixtureRepo(t, fixtureRepo, repo)
	out, err := runGraph(t, "resolve", "svc/server.go#Do", "--repo", repo)
	if err != nil {
		t.Fatalf("图内单锚应通过: %v\n%s", err, out)
	}
	var graphAnchor codegraph.AnchorResult
	if err := json.Unmarshal([]byte(out), &graphAnchor); err != nil {
		t.Fatalf("单锚 JSON: %v\n%s", err, out)
	}
	if graphAnchor.NodeID != "n_do" || graphAnchor.Anchor != "ok" {
		t.Fatalf("图内单锚: %+v", graphAnchor)
	}

	if err := os.WriteFile(filepath.Join(repo, "outside.go"), []byte("package outside\n\nfunc Moved() {}\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	out, err = runGraph(t, "resolve", "outside.go#Moved", "--repo", repo)
	if err != nil {
		t.Fatalf("图外单锚应通过: %v\n%s", err, out)
	}
	graphAnchor = codegraph.AnchorResult{}
	if err := json.Unmarshal([]byte(out), &graphAnchor); err != nil {
		t.Fatalf("图外单锚 JSON: %v\n%s", err, out)
	}
	if graphAnchor.Anchor != "moved" || graphAnchor.Line != 3 || graphAnchor.NodeID != "" {
		t.Fatalf("图外单锚: %+v", graphAnchor)
	}
}

func TestGraphContractSet(t *testing.T) {
	repo := t.TempDir()
	copyFixtureRepo(t, fixtureRepo, repo)
	out, err := runGraph(t, "contract", "set", "--from", "d_cmd", "--to", "d_svc", "--entries", "svc.Server", "--budget", "3", "--repo", repo)
	if err != nil {
		t.Fatalf("contract set 应通过: %v\n%s", err, out)
	}
	if !bytes.Contains([]byte(out), []byte(`"before"`)) || !bytes.Contains([]byte(out), []byte(`"after"`)) {
		t.Fatalf("应输出前后对照: %s", out)
	}
	target, err := codegraph.LoadTarget(repo)
	if err != nil {
		t.Fatal(err)
	}
	if len(target.Contracts) != 1 || target.Contracts[0].LegacyBudget != 3 || len(target.Contracts[0].Entries) != 1 {
		t.Fatalf("contract set 写回: %+v", target.Contracts)
	}
	_, err = runGraph(t, "contract", "set", "--from", "d_cmd", "--to", "d_svc", "--entries", "svc.Other", "--repo", repo)
	if err != nil {
		t.Fatalf("未传 budget 的 contract set 应通过: %v", err)
	}
	target, err = codegraph.LoadTarget(repo)
	if err != nil {
		t.Fatal(err)
	}
	if target.Contracts[0].LegacyBudget != 3 || len(target.Contracts[0].Entries) != 1 || target.Contracts[0].Entries[0] != "svc.Other" {
		t.Fatalf("未传 budget 不应覆盖旧值: %+v", target.Contracts)
	}
	_, err = runGraph(t, "contract", "set", "--from", "d_cmd", "--to", "d_svc", "--budget", "0", "--repo", repo)
	if err != nil {
		t.Fatalf("显式 budget=0 的 contract set 应通过: %v", err)
	}
	target, err = codegraph.LoadTarget(repo)
	if err != nil {
		t.Fatal(err)
	}
	if target.Contracts[0].LegacyBudget != 0 || len(target.Contracts[0].Entries) != 1 || target.Contracts[0].Entries[0] != "svc.Other" {
		t.Fatalf("显式 budget=0 或清单写回不对: %+v", target.Contracts)
	}
}

func TestGraphSummary(t *testing.T) {
	out, err := runGraph(t, "summary", "--repo", fixtureRepo)
	if err != nil {
		t.Fatalf("summary 应通过: %v\n%s", err, out)
	}
	// F3 拍板：文案随 canonical 更名，断言收紧为 "codegraph sym"
	if !bytes.Contains([]byte(out), []byte("节点")) || !bytes.Contains([]byte(out), []byte("codegraph sym")) {
		t.Fatalf("summary 内容: %s", out)
	}
}

// TestGraphVersion：版本子命令输出非空版本标识。
func TestGraphVersion(t *testing.T) {
	out, err := runGraph(t, "version")
	if err != nil {
		t.Fatalf("version 应通过: %v\n%s", err, out)
	}
	if len(bytes.TrimSpace([]byte(out))) == 0 {
		t.Fatal("version 输出不得为空")
	}
}

func TestGraphMigrate(t *testing.T) {
	repo := t.TempDir()
	if err := os.MkdirAll(filepath.Join(repo, "codegraph"), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(repo, "codegraph", "target.json"), []byte(`{"meta":{"version":1},"domains":[]}`), 0o644); err != nil {
		t.Fatal(err)
	}
	out, err := runGraph(t, "migrate", "--repo", repo)
	if err != nil || !bytes.Contains([]byte(out), []byte(`"migrated": true`)) {
		t.Fatalf("migrate 输出: err=%v out=%s", err, out)
	}
	if _, err := codegraph.LoadTarget(repo); err != nil {
		t.Fatalf("migrate 后 target 应可加载: %v", err)
	}
}

func copyFixtureRepo(t *testing.T, src, dst string) {
	t.Helper()
	entries, err := os.ReadDir(src)
	if err != nil {
		t.Fatal(err)
	}
	for _, entry := range entries {
		from := filepath.Join(src, entry.Name())
		to := filepath.Join(dst, entry.Name())
		if entry.IsDir() {
			if err := os.MkdirAll(to, 0o755); err != nil {
				t.Fatal(err)
			}
			copyFixtureRepo(t, from, to)
			continue
		}
		raw, err := os.ReadFile(from)
		if err != nil {
			t.Fatal(err)
		}
		if err := os.MkdirAll(filepath.Dir(to), 0o755); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(to, raw, 0o644); err != nil {
			t.Fatal(err)
		}
	}
}
