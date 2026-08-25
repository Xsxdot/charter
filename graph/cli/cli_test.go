// cli 命令树测试：validate/chain/who-calls 等子命令的 JSON 契约与退出语义。
// 自 handoff cmd/graph_test.go 迁移（harness 由「rootCmd + "graph" 前缀」改为直挂 New 构造的根）。
package cli

import (
	"bytes"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"reflect"
	"strconv"
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
	// 默认深度 2 且外部领域折叠：e_run + d_svc 外部领域项
	if len(r.Nodes) != 2 || r.Warning == "" {
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
		if d.ID == "d_svc/store" && (d.CrossSubsystem || !reflect.DeepEqual(d.Subsystems, []string{"d_svc"})) {
			t.Fatalf("best 容器归属应提供单一子系统: %+v", d)
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

func TestGraphDomainsBestIsSoftDependency(t *testing.T) {
	repo := t.TempDir()
	copyFixtureRepo(t, fixtureRepo, repo)
	if err := os.Remove(filepath.Join(repo, "codegraph", "best.json")); err != nil {
		t.Fatal(err)
	}
	stdout, stderr, err := runGraphSeparate(t, "domains", "--repo", repo)
	if err != nil {
		t.Fatalf("best.json 缺失时 domains 应通过: %v stdout=%s stderr=%s", err, stdout, stderr)
	}
	if bytes.Contains([]byte(stdout), []byte(`"subsystems"`)) || bytes.Contains([]byte(stdout), []byte(`"crossSubsystem"`)) {
		t.Fatalf("best.json 缺失时派生字段应省略: %s", stdout)
	}
	if !strings.Contains(stderr, "best.json") {
		t.Fatalf("stderr 应提示 best.json 字段省略: %s", stderr)
	}
}

func TestGraphDomainsEdgesWireAndBestComparison(t *testing.T) {
	stdout, stderr, err := runGraphSeparate(t, "domains", "--edges", "--repo", fixtureRepo)
	if err != nil {
		t.Fatalf("domains --edges 应通过: %v stdout=%s stderr=%s", err, stdout, stderr)
	}
	var out struct {
		View    string                     `json:"view"`
		Current []codegraph.DomainEdgeStat `json:"current"`
		Best    []codegraph.DomainEdgeStat `json:"best"`
	}
	if err := json.Unmarshal([]byte(stdout), &out); err != nil {
		t.Fatalf("domains --edges 应输出 JSON: %v\n%s", err, stdout)
	}
	if out.View != "baseline" || len(out.Current) == 0 || len(out.Best) == 0 {
		t.Fatalf("应同时输出现状/最优矩阵: %+v", out)
	}
	for _, stat := range append(append([]codegraph.DomainEdgeStat{}, out.Current...), out.Best...) {
		if stat.From == "" || stat.To == "" || stat.From == stat.To || stat.Count <= 0 {
			t.Fatalf("矩阵记录必须是非空有向跨域正计数: %+v", stat)
		}
	}
	if bytes.Contains([]byte(stdout), []byte(`"fails"`)) || bytes.Contains([]byte(stdout), []byte(`"warns"`)) {
		t.Fatalf("--edges 不得混入 check 报告: %s", stdout)
	}
	checkOut, err := runGraph(t, "check", "--repo", fixtureRepo)
	if err != nil {
		t.Fatalf("check fixture 应通过: %v\n%s", err, checkOut)
	}
	if bytes.Contains([]byte(checkOut), []byte(`"current"`)) || bytes.Contains([]byte(checkOut), []byte(`"best"`)) {
		t.Fatalf("check 输出不得混入矩阵: %s", checkOut)
	}
}

func TestGraphDomainsEdgesWithoutBestIsExplicit(t *testing.T) {
	repo := t.TempDir()
	copyFixtureRepo(t, fixtureRepo, repo)
	if err := os.Remove(filepath.Join(repo, "codegraph", "best.json")); err != nil {
		t.Fatal(err)
	}
	stdout, stderr, err := runGraphSeparate(t, "domains", "--edges", "--repo", repo)
	if err != nil {
		t.Fatalf("best 缺失时 domains --edges 应通过: %v stdout=%s stderr=%s", err, stdout, stderr)
	}
	if !bytes.Contains([]byte(stdout), []byte(`"current"`)) || bytes.Contains([]byte(stdout), []byte(`"best":`)) || !bytes.Contains([]byte(stdout), []byte("bestSkipped")) {
		t.Fatalf("缺 best 时应只输出现状矩阵并显式跳过最优矩阵: %s", stdout)
	}
}

func TestGraphValidateDomainDeclIssuePrefix(t *testing.T) {
	repo := t.TempDir()
	copyFixtureRepo(t, fixtureRepo, repo)
	path := filepath.Join(repo, "codegraph", "domains", "d_cmd.json")
	if err := os.WriteFile(path, []byte(`{"domain":"d_cmd","responsibility":"x","lifecycle":{"from":"svc/server.go#Gone","to":"svc/server.go#Gone"}}`), 0o644); err != nil {
		t.Fatal(err)
	}
	out, err := runGraph(t, "validate", "--repo", repo)
	if err == nil || !strings.Contains(out, "[decl d_cmd]") {
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
	var report codegraph.Report
	if err := json.Unmarshal([]byte(out), &report); err != nil {
		t.Fatalf("check 输出必须是合法 Report: %v", err)
	}
	if report.BestCoverage == nil || report.BestCoverage.AssignedContainers == 0 {
		t.Fatalf("best 存在时 check 必须输出非空归属覆盖读数: %+v", report)
	}
}

func TestGraphCheckMissingTargetFails(t *testing.T) {
	// 指向一个没有 target.json 的仓：必须报错退出，不能静默通过。
	_, err := runGraph(t, "check", "--repo", t.TempDir())
	if err == nil {
		t.Fatal("无 target 的 check 必须失败")
	}
}

func TestGraphCheckMissingBestSkipsWithNotice(t *testing.T) {
	repo := t.TempDir()
	copyFixtureRepo(t, fixtureRepo, repo)
	if err := os.Remove(filepath.Join(repo, "codegraph", "best.json")); err != nil {
		t.Fatal(err)
	}
	stdout, stderr, err := runGraphSeparate(t, "check", "--repo", repo)
	if err != nil {
		t.Fatalf("best.json 缺失时 check 应降级通过: %v stdout=%s stderr=%s", err, stdout, stderr)
	}
	if !strings.Contains(stderr, "best.json") || !strings.Contains(stderr, "跳过") {
		t.Fatalf("stderr 必须显式说明最优图判据已跳过: %s", stderr)
	}
	report := unmarshalReport(t, stdout)
	if len(report.Fails) != 0 {
		t.Fatalf("best 缺失时不得执行契约 fail: %+v", report)
	}
}

func TestGraphCheckInvalidBestFails(t *testing.T) {
	repo := t.TempDir()
	copyFixtureRepo(t, fixtureRepo, repo)
	if err := os.WriteFile(filepath.Join(repo, "codegraph", "best.json"), []byte("{"), 0o644); err != nil {
		t.Fatal(err)
	}
	_, err := runGraph(t, "check", "--repo", repo)
	if err == nil || !strings.Contains(err.Error(), "最优图不可用") {
		t.Fatalf("best.json 解析失败时 check 必须拒绝: %v", err)
	}
}

func TestGraphCheckCoverageReadoutShowsZero(t *testing.T) {
	repo := t.TempDir()
	copyFixtureRepo(t, fixtureRepo, repo)
	best := `{"meta":{"version":1,"project":"fixture"},"domains":{"d_svc":{"label":"服务","responsibility":"服务","type":"logic"}},"containers":{}}`
	if err := os.WriteFile(filepath.Join(repo, "codegraph", "best.json"), []byte(best), 0o644); err != nil {
		t.Fatal(err)
	}
	stdout, _, err := runGraphSeparate(t, "check", "--repo", repo)
	if err == nil {
		t.Fatalf("空容器 best 的死契约应让 check 非零: stdout=%s", stdout)
	}
	report := unmarshalReport(t, stdout)
	if report.BestCoverage == nil || report.BestCoverage.AssignedContainers != 0 || report.BestCoverage.ViewContainers == 0 {
		t.Fatalf("归属覆盖为 0 时读数不得静默: %+v", report.BestCoverage)
	}
}

func TestGraphCheckSkipsRatchetWithActionableWarning(t *testing.T) {
	repo := t.TempDir()
	copyFixtureRepo(t, fixtureRepo, repo)
	stdout, stderr, err := runGraphSeparate(t, "check", "--repo", repo)
	if err != nil {
		t.Fatalf("无 git 基准时其余判据通过，退出码应不变: %v\nstdout=%s\nstderr=%s", err, stdout, stderr)
	}
	var report codegraph.Report
	if err := json.Unmarshal([]byte(stdout), &report); err != nil {
		t.Fatalf("降级时 stdout 必须是合法 Report JSON: %v\n%s", err, stdout)
	}
	if !strings.Contains(stderr, "棘轮") || !strings.Contains(stderr, "跳过") {
		t.Fatalf("stderr 应明示棘轮判据已跳过: %s", stderr)
	}
}

func TestGraphCheckBudgetRatchetFailsFromExplicitBase(t *testing.T) {
	repo, base := gitTargetRepo(t, 1, 2, "")
	stdout, _, err := runGraphSeparate(t, "check", "--base", base, "--repo", repo)
	if err == nil {
		t.Fatalf("预算上涨且无理由应非零: %s", stdout)
	}
	var report codegraph.Report
	if jsonErr := json.Unmarshal([]byte(stdout), &report); jsonErr != nil {
		t.Fatalf("棘轮失败仍应输出合法 JSON: %v\n%s", jsonErr, stdout)
	}
	assertBudgetFinding(t, report, true)
}

func TestGraphCheckBudgetRatchetNoteDowngradesToWarning(t *testing.T) {
	repo, base := gitTargetRepo(t, 1, 2, "图重扫补全")
	stdout, _, err := runGraphSeparate(t, "check", "--base", base, "--repo", repo)
	if err != nil {
		t.Fatalf("有非空上涨理由应降为 warn: %v\n%s", err, stdout)
	}
	var report codegraph.Report
	if jsonErr := json.Unmarshal([]byte(stdout), &report); jsonErr != nil {
		t.Fatalf("棘轮 warn 仍应输出合法 JSON: %v\n%s", jsonErr, stdout)
	}
	assertBudgetFinding(t, report, false)
}

func TestGraphCheckBudgetRatchetWhitespaceNoteStillFails(t *testing.T) {
	repo, base := gitTargetRepo(t, 1, 2, "   ")
	stdout, _, err := runGraphSeparate(t, "check", "--base", base, "--repo", repo)
	if err == nil {
		t.Fatalf("纯空白上涨理由不得降档: %s", stdout)
	}
	var report codegraph.Report
	if jsonErr := json.Unmarshal([]byte(stdout), &report); jsonErr != nil {
		t.Fatalf("纯空白理由的棘轮失败仍应输出合法 JSON: %v\n%s", jsonErr, stdout)
	}
	assertBudgetFinding(t, report, true)
}

func TestGraphCheckBudgetRatchetAcceptsSchemaV1Base(t *testing.T) {
	repo, base := gitTargetRepoWithVersion(t, 1, 2, "", 1)
	stdout, _, err := runGraphSeparate(t, "check", "--base", base, "--repo", repo)
	if err == nil {
		t.Fatalf("schema v1 基准仍应参与棘轮并因上涨非零: %s", stdout)
	}
	var report codegraph.Report
	if jsonErr := json.Unmarshal([]byte(stdout), &report); jsonErr != nil {
		t.Fatalf("schema v1 基准棘轮失败仍应输出合法 JSON: %v\n%s", jsonErr, stdout)
	}
	assertBudgetFinding(t, report, true)
}

// TestGraphCheckContractRatchetAgainstTrueSchemaV1Base 用**真 v1 躯干**作为基准，
// 而不是「把 version 改成 1、字段还是 v2 那套」的伪 v1，锁住宽松解析只投影 contracts。
func TestGraphCheckContractRatchetAgainstTrueSchemaV1Base(t *testing.T) {
	repo, base := gitTrueV1BaseRepo(t, 2, "")
	stdout, stderr, err := runGraphSeparate(t, "check", "--base", base, "--repo", repo)
	if err == nil {
		t.Fatalf("真 v1 基准的契约预算上涨应非零退出: %s\nstderr=%s", stdout, stderr)
	}
	if strings.Contains(stderr, "跳过") {
		t.Fatalf("真 v1 基准不得让棘轮降级跳过（宽松解析路径就是为它开的）: %s", stderr)
	}
	report := unmarshalReport(t, stdout)
	raised := ratchetFindings(report.Fails)
	if len(raised) != 1 || len(ratchetFindings(report.Warns)) != 0 {
		t.Fatalf("真 v1 基准应恰好一条无理由的 budget-raised fail: %+v", report)
	}
	if raised[0].From != "d_cmd" || raised[0].To != "d_svc" || !strings.Contains(raised[0].Detail, "0→2") {
		t.Fatalf("真 v1 基准应保留契约方向与基准预算: %+v", raised[0])
	}
}

// trueSchemaV1Target 是 v1 躯干的目标图：顶层 domains（不是 subsystems）、
// assignments 的外键字段叫 domain，且没有任何目标领域/预算字段。形状取自
// codegraph/migrate.go#migrateV1Target 这个 v1 的权威定义。
const trueSchemaV1Target = `{
  "meta": { "version": 1, "project": "fixture" },
  "domains": [
    { "id": "d_svc", "name": "服务", "type": "logic", "paths": ["svc/**"] },
    { "id": "d_cmd", "name": "入口", "type": "logic", "paths": ["cmd/**"] },
    { "id": "d_web", "name": "前端", "type": "boundary", "paths": ["web/**"] }
  ],
  "assembly": ["cmd/run.go"],
  "contracts": [
    { "from": "d_cmd", "to": "d_svc", "entries": ["svc.Server"], "legacyBudget": 0 }
  ]
}
`

// gitTrueV1BaseRepo 造「基准提交是真 v1、工作区是 v2 且契约预算上涨」的仓。
func gitTrueV1BaseRepo(t *testing.T, budget int, note string) (string, string) {
	t.Helper()
	repo := t.TempDir()
	copyFixtureRepo(t, fixtureRepo, repo)
	targetPath := filepath.Join(repo, "codegraph", "target.json")
	if err := os.WriteFile(targetPath, []byte(trueSchemaV1Target), 0o644); err != nil {
		t.Fatal(err)
	}
	runGit(t, repo, "init", "-q")
	runGit(t, repo, "config", "user.email", "codegraph-test@example.com")
	runGit(t, repo, "config", "user.name", "codegraph-test")
	runGit(t, repo, "add", ".")
	runGit(t, repo, "commit", "-q", "-m", "true v1 base target")
	base := strings.TrimSpace(runGit(t, repo, "rev-parse", "HEAD"))

	// 基准提交落定后再把工作区换成 v2，并只修改契约预算。
	copyFixtureRepo(t, fixtureRepo, repo)
	writeTargetVersionBudget(t, repo, 3, budget, 3, 0, note)
	return repo, base
}

// --repo 指向 git 顶层的子目录时，git show 必须带上 nested/ 前缀去读 target.json。
func TestGraphCheckBudgetRatchetReadsNestedRepoPrefix(t *testing.T) {
	repo, base := gitTargetRepoNested(t, "nested", 2, 3, "")
	stdout, stderr, err := runGraphSeparate(t, "check", "--base", base, "--repo", repo)
	if err == nil {
		t.Fatalf("子目录仓的棘轮也应生效: %s\nstderr=%s", stdout, stderr)
	}
	if strings.Contains(stderr, "跳过") {
		t.Fatalf("子目录仓不应降级跳过棘轮: %s", stderr)
	}
	raised := ratchetFindings(unmarshalReport(t, stdout).Fails)
	if len(raised) != 1 || !strings.Contains(raised[0].Detail, "2→3") {
		t.Fatalf("子目录仓应读到 nested/codegraph/target.json 的基准预算: %+v", raised)
	}
}

// 棘轮 finding 追加后必须与其余 finding 一起重排：kind 字典序 budget-raised <
// dead-contract，所以它必须排在首位。旧实现在 Check 排完序后才 append，
// 于是它永远吊在末尾，check 输出顺序不再确定。
func TestGraphCheckOutputStaysSortedAndByteStable(t *testing.T) {
	repo, base := gitTargetRepo(t, 0, 1, "")
	addDeadContract(t, repo)
	first, _, err := runGraphSeparate(t, "check", "--base", base, "--repo", repo)
	if err == nil {
		t.Fatalf("前置条件：本用例应同时有棘轮与 dead-contract 两条 fail: %s", first)
	}
	report := unmarshalReport(t, first)
	if len(report.Fails) != 2 || report.Fails[0].Kind != "budget-raised" || report.Fails[1].Kind != "dead-contract" {
		t.Fatalf("fails 应按 kind 全序排列，budget-raised 在前: %+v", report.Fails)
	}
	for i := 0; i < 3; i++ {
		again, _, _ := runGraphSeparate(t, "check", "--base", base, "--repo", repo)
		if again != first {
			t.Fatalf("第 %d 次重复运行输出漂移:\n首次=%s\n本次=%s", i+1, first, again)
		}
	}
}

func addDeadContract(t *testing.T, repo string) {
	t.Helper()
	path := filepath.Join(repo, "codegraph", "target.json")
	raw, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	var target codegraph.Target
	if err := json.Unmarshal(raw, &target); err != nil {
		t.Fatal(err)
	}
	target.Contracts = append(target.Contracts, codegraph.Contract{From: "d_svc", To: "d_web"})
	out, err := json.MarshalIndent(&target, "", "  ")
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, out, 0o644); err != nil {
		t.Fatal(err)
	}
}

func unmarshalReport(t *testing.T, stdout string) codegraph.Report {
	t.Helper()
	var report codegraph.Report
	if err := json.Unmarshal([]byte(stdout), &report); err != nil {
		t.Fatalf("stdout 必须是合法 Report JSON: %v\n%s", err, stdout)
	}
	return report
}

func ratchetFindings(findings []codegraph.Finding) []codegraph.Finding {
	var out []codegraph.Finding
	for _, finding := range findings {
		if finding.Kind == "budget-raised" {
			out = append(out, finding)
		}
	}
	return out
}

// gitTargetRepoNested 与 gitTargetRepo 相同，但让 --repo 指向 git 顶层的子目录。
func gitTargetRepoNested(t *testing.T, repoSub string, baseBudget, currentBudget int, note string) (string, string) {
	t.Helper()
	gitRoot := t.TempDir()
	repo := filepath.Join(gitRoot, repoSub)
	if err := os.MkdirAll(repo, 0o755); err != nil {
		t.Fatal(err)
	}
	copyFixtureRepo(t, fixtureRepo, repo)
	writeTargetVersionBudget(t, repo, 2, baseBudget, 3, 0, "")
	runGit(t, gitRoot, "init", "-q")
	runGit(t, gitRoot, "config", "user.email", "codegraph-test@example.com")
	runGit(t, gitRoot, "config", "user.name", "codegraph-test")
	runGit(t, gitRoot, "add", ".")
	runGit(t, gitRoot, "commit", "-q", "-m", "base target")
	base := strings.TrimSpace(runGit(t, gitRoot, "rev-parse", "HEAD"))
	writeTargetVersionBudget(t, repo, 3, currentBudget, 2, baseBudget, note)
	return repo, base
}

func assertBudgetFinding(t *testing.T, report codegraph.Report, inFails bool) {
	t.Helper()
	var fails, warns int
	for _, finding := range report.Fails {
		if finding.Kind == "budget-raised" {
			fails++
		}
	}
	for _, finding := range report.Warns {
		if finding.Kind == "budget-raised" {
			warns++
		}
	}
	if inFails && (fails != 1 || warns != 0) {
		t.Fatalf("budget-raised 应在 fails: fails=%d warns=%d report=%+v", fails, warns, report)
	}
	if !inFails && (fails != 0 || warns != 1) {
		t.Fatalf("budget-raised 应在 warns: fails=%d warns=%d report=%+v", fails, warns, report)
	}
}

func gitTargetRepo(t *testing.T, oldBudget, currentBudget int, note string) (string, string) {
	return gitTargetRepoWithVersion(t, oldBudget, currentBudget, note, 2)
}

func gitTargetRepoWithVersion(t *testing.T, oldBudget, currentBudget int, note string, oldVersion int) (string, string) {
	t.Helper()
	repo := t.TempDir()
	copyFixtureRepo(t, fixtureRepo, repo)
	writeTargetVersionBudget(t, repo, oldVersion, oldBudget, 3, 0, "")
	runGit(t, repo, "init", "-q")
	runGit(t, repo, "config", "user.email", "codegraph-test@example.com")
	runGit(t, repo, "config", "user.name", "codegraph-test")
	runGit(t, repo, "add", ".")
	runGit(t, repo, "commit", "-q", "-m", "base target")
	base := strings.TrimSpace(runGit(t, repo, "rev-parse", "HEAD"))
	writeTargetVersionBudget(t, repo, 3, currentBudget, oldVersion, oldBudget, note)
	return repo, base
}

func writeTargetVersionBudget(t *testing.T, repo string, version, budget, previousVersion, previousBudget int, note string) {
	t.Helper()
	path := filepath.Join(repo, "codegraph", "target.json")
	raw, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	raw = bytes.Replace(raw, []byte(fmt.Sprintf(`"version": %d`, previousVersion)), []byte(fmt.Sprintf(`"version": %d`, version)), 1)
	raw = bytes.Replace(raw, []byte(fmt.Sprintf(`"legacyBudget": %d`, previousBudget)), []byte(fmt.Sprintf(`"legacyBudget": %d`, budget)), 1)
	if note != "" {
		old := []byte(fmt.Sprintf(`"legacyBudget": %d`, budget))
		newValue := []byte(fmt.Sprintf(`"legacyBudget": %d, "legacyBudgetNote": %s`, budget, strconv.Quote(note)))
		raw = bytes.Replace(raw, old, newValue, 1)
	}
	if err := os.WriteFile(path, raw, 0o644); err != nil {
		t.Fatal(err)
	}
}

func runGit(t *testing.T, repo string, args ...string) string {
	t.Helper()
	cmd := exec.Command("git", append([]string{"-C", repo}, args...)...)
	out, err := cmd.CombinedOutput()
	if err != nil {
		t.Fatalf("git %v 失败: %v\n%s", args, err, out)
	}
	return string(out)
}

func TestGraphTargetVersionGate(t *testing.T) {
	for _, version := range []int{1, 2} {
		repo := t.TempDir()
		copyFixtureRepo(t, fixtureRepo, repo)
		path := filepath.Join(repo, "codegraph", "target.json")
		raw, err := os.ReadFile(path)
		if err != nil {
			t.Fatal(err)
		}
		raw = bytes.Replace(raw, []byte(`"version": 3`), []byte(fmt.Sprintf(`"version": %d`, version)), 1)
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
	if count != 15 {
		t.Fatalf("codegraph 业务子命令数=%d，want 15", count)
	}
	for _, command := range root.Commands() {
		if command.Name() == "migrate" {
			return
		}
	}
	t.Fatal("子命令列表缺 migrate")
}

func TestGraphCLIQueryFlagsAndJSONWire(t *testing.T) {
	stdout, _, err := runGraphSeparate(t, "chain", "e_run", "--repo", fixtureRepo,
		"--with-source", "--fold-external=false", "--collapse-util=false", "--max-tokens", "0")
	if err != nil {
		t.Fatalf("chain with source 应通过: %v", err)
	}
	var withSource map[string]json.RawMessage
	if err := json.Unmarshal([]byte(stdout), &withSource); err != nil {
		t.Fatalf("stdout JSON=%v\n%s", err, stdout)
	}
	if !bytes.Contains(withSource["nodes"], []byte(`"source"`)) {
		t.Fatalf("stdout 缺 source: %s", stdout)
	}
	compact, _, err := runGraphSeparate(t, "chain", "e_run", "--repo", fixtureRepo,
		"--fold-external=false", "--collapse-util=false", "--max-tokens", "0")
	if err != nil || bytes.Contains([]byte(compact), []byte(`"source"`)) {
		t.Fatalf("默认 chain source 形态: err=%v stdout=%s", err, compact)
	}
	limited, _, err := runGraphSeparate(t, "chain", "e_run", "--repo", fixtureRepo,
		"--fold-external=false", "--collapse-util=false", "--max-tokens", "1")
	if err != nil || !bytes.Contains([]byte(limited), []byte(`"reason": "max-tokens"`)) {
		t.Fatalf("预算截断未穿过 JSON wire: err=%v stdout=%s", err, limited)
	}
	contextOut, _, err := runGraphSeparate(t, "context", "d_cmd", "--repo", fixtureRepo)
	if err != nil || !bytes.Contains([]byte(contextOut), []byte(`"declaration"`)) {
		t.Fatalf("context 声明路径: err=%v stdout=%s", err, contextOut)
	}
	_, badStderr, err := runGraphSeparate(t, "context", "d_cmd", "--depth", "1", "--repo", fixtureRepo)
	if err == nil {
		t.Fatalf("context 必须拒绝 depth: err=%v stderr=%s", err, badStderr)
	}
	_, _, err = runGraphSeparate(t, "context", "d_cmd", "extra", "--repo", fixtureRepo)
	if err == nil {
		t.Fatal("context 必须拒绝多余领域参数")
	}
	_, _, err = runGraphSeparate(t, "chain", "e_run", "--repo", fixtureRepo, "--source-span", "0")
	if err == nil {
		t.Fatal("source-span=0 必须拒绝，不能静默改成默认值")
	}
}

func TestGraphQueryFlagsResetBeforeWhoCallsAndContext(t *testing.T) {
	if _, _, err := runGraphSeparate(t, "chain", "e_run", "--repo", fixtureRepo,
		"--full", "--fold-external=false", "--collapse-util=false", "--with-source", "--source-span", "1", "--max-tokens", "0"); err != nil {
		t.Fatal(err)
	}
	who, _, err := runGraphSeparate(t, "who-calls", "n_do", "--repo", fixtureRepo)
	if err != nil {
		t.Fatal(err)
	}
	if bytes.Contains([]byte(who), []byte(`"source"`)) || bytes.Contains([]byte(who), []byte(`"returns"`)) {
		t.Fatalf("who-calls 不能继承前一条命令的 full/source flags: %s", who)
	}
	contextOut, _, err := runGraphSeparate(t, "context", "d_cmd", "--repo", fixtureRepo)
	if err != nil {
		t.Fatal(err)
	}
	var contextWire struct {
		Chain json.RawMessage `json:"chain"`
	}
	if err := json.Unmarshal([]byte(contextOut), &contextWire); err != nil {
		t.Fatal(err)
	}
	if !bytes.Contains(contextWire.Chain, []byte(`"source"`)) {
		t.Fatalf("context 默认必须保留源码窗口: %s", contextOut)
	}
}

func TestGraphJSONWireKeepsIndentedEncoder(t *testing.T) {
	out, _, err := runGraphSeparate(t, "chain", "e_run", "--repo", fixtureRepo, "--fold-external=false", "--max-tokens", "0")
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(out, "\n \"nodes\"") {
		t.Fatalf("graphPrintJSON 缩进契约丢失: %s", out)
	}
}

func TestGraphStaleUsesQuerySubset(t *testing.T) {
	repo := t.TempDir()
	copyFixtureRepo(t, fixtureRepo, repo)
	g, err := codegraph.LoadGraph(repo)
	if err != nil {
		t.Fatal(err)
	}
	n := g.Nodes["m_notifier"]
	n.File = "outside.go"
	n.Line = 1
	g.Nodes["m_notifier"] = n
	raw, err := json.Marshal(g)
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(repo, "codegraph", "baseline.json"), raw, 0o644); err != nil {
		t.Fatal(err)
	}
	out, _, err := runGraphSeparate(t, "chain", "e_run", "--repo", repo, "--stale", "--fold-external=false", "--max-tokens", "0")
	if err != nil {
		t.Fatal(err)
	}
	var result struct {
		Stale []codegraph.StaleNode `json:"stale"`
	}
	if err := json.Unmarshal([]byte(out), &result); err != nil {
		t.Fatal(err)
	}
	for _, stale := range result.Stale {
		if stale.ID == "m_notifier" {
			t.Fatalf("stale 越过查询子集: %+v", result.Stale)
		}
	}
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
	raw = bytes.Replace(raw, []byte(`"domain": "d_svc/store"`), []byte(`"domain": "d_cmd"`), 1)
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
	if err := os.WriteFile(filepath.Join(repo, "codegraph", "target.json"), []byte(`{"meta":{"version":1,"project":"fixture"},"domains":[]}`), 0o644); err != nil {
		t.Fatal(err)
	}
	out, stderr, err := runGraphSeparate(t, "migrate", "--repo", repo)
	if err != nil || !bytes.Contains([]byte(out), []byte(`"to": 2`)) {
		t.Fatalf("v1→v2 migrate 输出: err=%v stdout=%s stderr=%s", err, out, stderr)
	}
	if err := os.WriteFile(filepath.Join(repo, "codegraph", "baseline.json"), []byte(`{"meta":{"project":"fixture"},"containers":{},"nodes":{},"edges":[]}`), 0o644); err != nil {
		t.Fatal(err)
	}
	out, stderr, err = runGraphSeparate(t, "migrate", "--repo", repo)
	if err != nil || !bytes.Contains([]byte(out), []byte(`"migrated": true`)) || !bytes.Contains([]byte(out), []byte(`"to": 3`)) {
		t.Fatalf("v2→v3 migrate 输出: err=%v stdout=%s stderr=%s", err, out, stderr)
	}
	if !strings.Contains(stderr, "机械翻译") || !strings.Contains(stderr, "不是最优结构") {
		t.Fatalf("migrate stderr 应有结构提示: %s", stderr)
	}
	if _, err := codegraph.LoadTarget(repo); err != nil {
		t.Fatalf("migrate 后 target 应可加载: %v", err)
	}
	if _, err := codegraph.LoadBest(repo); err != nil {
		t.Fatalf("migrate 后 best 应可加载: %v", err)
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

// check 侧真加载领域声明（契约 25）。本测试把 fixture 的 best 词表声明临时改成
// baseline 词表的 d_cli，专门保留 anchor-off-domain 的 check 回归；ValidateDecls
// 的 best-only 词表行为由 TestValidateDecls 与 validate CLI 测试覆盖。
func TestGraphCheckLoadsDomainDeclsAndReportsAnchorOwnership(t *testing.T) {
	repo := t.TempDir()
	copyFixtureRepo(t, fixtureRepo, repo)
	bestDecl := filepath.Join(repo, "codegraph", "domains", "d_cmd.json")
	raw, err := os.ReadFile(bestDecl)
	if err != nil {
		t.Fatal(err)
	}
	raw = bytes.Replace(raw, []byte(`"d_cmd"`), []byte(`"d_cli"`), 1)
	legacyDecl := filepath.Join(repo, "codegraph", "domains", "d_cli.json")
	if err := os.WriteFile(legacyDecl, raw, 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.Remove(bestDecl); err != nil {
		t.Fatal(err)
	}
	out, _, err := runGraphSeparate(t, "check", "--repo", repo)
	if err != nil {
		t.Fatalf("锚归属只进 warn，不该让 check 非零退出: %v\n%s", err, out)
	}
	var rep struct {
		Fails []struct{ Kind string } `json:"fails"`
		Warns []struct {
			Kind, From, To, Detail string
		} `json:"warns"`
	}
	if err := json.Unmarshal([]byte(out), &rep); err != nil {
		t.Fatalf("解析 check 输出: %v\n%s", err, out)
	}
	var hit int
	for _, w := range rep.Warns {
		if w.Kind != "anchor-off-domain" {
			continue
		}
		hit++
		if w.From != "d_cli" || w.To != "d_svc/api" {
			t.Errorf("From 应是声明方 d_cli、To 应是实际所属 d_svc/api，实际 From=%q To=%q", w.From, w.To)
		}
		if !strings.Contains(w.Detail, "cmd/run.go#runE") {
			t.Errorf("报文应含锚原文，实际: %s", w.Detail)
		}
	}
	// lifecycle 的 from/to 两条 + stateMachine 一条，都指向同一个锚且刻意不去重
	if hit != 3 {
		t.Fatalf("应报 3 条 anchor-off-domain（from/to/stateMachine 各一，不去重），实际 %d 条: %+v", hit, rep.Warns)
	}
	for _, f := range rep.Fails {
		if strings.HasPrefix(f.Kind, "anchor-") {
			t.Errorf("锚判据不得进 fails: %+v", f)
		}
	}
}

// 契约 25：check 加载领域声明失败必须返回 err，不得静默降级成「没有声明」。
//
// 审计发现这条零守卫：把 `if err != nil { return err }` 换成 `decls, _ :=`，
// 一份损坏的声明文件会让 check 打印 {"fails":[],"warns":[]} 并退出 0——
// 全绿而问题还在，正是 cli.go 那处注释点名要防的失效形态，而当时没有测试守着。
func TestGraphCheckFailsOnUnreadableDomainDecls(t *testing.T) {
	repo := t.TempDir()
	copyFixtureRepo(t, fixtureRepo, repo)
	bad := filepath.Join(repo, "codegraph", "domains", "d_cmd.json")
	if err := os.WriteFile(bad, []byte("{ this is not json"), 0o644); err != nil {
		t.Fatal(err)
	}
	out, err := runGraph(t, "check", "--repo", repo)
	if err == nil {
		t.Fatalf("声明文件损坏时 check 必须失败，不得静默当作没有声明。输出: %s", out)
	}
	if !strings.Contains(err.Error(), "d_cmd.json") {
		t.Errorf("报错应指出是哪个文件坏了，实际: %v", err)
	}
}

// context 的实然披露必须真的穿过 JSON wire——消费方多数是 agent，序列化形态即契约。
// best 缺席时该键必须**省略**而不是发 null：null 会被读成「披露过了，是空的」。
func TestGraphContextActualCrossesJSONWire(t *testing.T) {
	withBest, _, err := runGraphSeparate(t, "context", "d_cmd", "--repo", fixtureRepo)
	if err != nil {
		t.Fatal(err)
	}
	var wire struct {
		Actual *struct {
			Containers      int `json:"containers"`
			ByCurrentDomain []struct {
				ID         string `json:"id"`
				Containers int    `json:"containers"`
			} `json:"byCurrentDomain"`
			MisplacedSkipped int `json:"misplacedSkipped"`
		} `json:"actual"`
	}
	if err := json.Unmarshal([]byte(withBest), &wire); err != nil {
		t.Fatal(err)
	}
	if wire.Actual == nil {
		t.Fatalf("best 在场时 actual 必须过线: %s", withBest)
	}
	if wire.Actual.Containers != 1 || len(wire.Actual.ByCurrentDomain) != 1 || wire.Actual.ByCurrentDomain[0].ID != "d_cli" {
		t.Fatalf("实然披露内容未逐字过线: %+v", wire.Actual)
	}
	if wire.Actual.MisplacedSkipped != 1 {
		t.Fatalf("misplacedSkipped 必须过线且如实: %+v", wire.Actual)
	}

	// 造一份没有 best.json 的仓：context 降级到现状词表，actual 整键省略。
	repo := t.TempDir()
	if err := os.MkdirAll(filepath.Join(repo, "codegraph"), 0o755); err != nil {
		t.Fatal(err)
	}
	for _, name := range []string{"baseline.json"} {
		raw, err := os.ReadFile(filepath.Join(fixtureRepo, "codegraph", name))
		if err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(filepath.Join(repo, "codegraph", name), raw, 0o644); err != nil {
			t.Fatal(err)
		}
	}
	noBest, _, err := runGraphSeparate(t, "context", "d_cli", "--repo", repo)
	if err != nil {
		t.Fatal(err)
	}
	if bytes.Contains([]byte(noBest), []byte(`"actual"`)) {
		t.Fatalf("best 缺席时 actual 必须省略而不是发 null: %s", noBest)
	}
	if !bytes.Contains([]byte(noBest), []byte("降级")) {
		t.Fatalf("best 缺席必须有可见降级告警: %s", noBest)
	}
}
