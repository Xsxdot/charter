// 本包构造 codegraph 命令树：对仓库内代码图数据的本地只读查询。
// 自 handoff cmd/graph.go 迁移（刀 0），子命令语义零变化，新增 version。
//
// 职责：
//   - 导出唯一构造函数 New：graph/cmd/codegraph（canonical 二进制）与
//     handoff 的 graph 别名共同挂载同一棵树——「别名行为一致」由构造保证
//   - validate/check/absorb/views/chain/who-calls/context/domains/sym/entity/
//     resolve/contract set/summary/version/migrate/flow/tree 共 17 个子命令
//
// 边界：
//   - 只读 --repo 指向的本地文件，不发任何网络请求、不依赖 agentd 存活
//     ——spec 2026-08-19-codegraph-design §2/§6 的硬约束，agent 离线可用
//   - 不产出/修改图数据（扫描配方见 handoff 仓 docs/codegraph-scan-recipe.md）
//   - 第三方依赖仅 cobra（契约 §5-2，deps_test.go 执法）
package cli

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"os"
	"os/exec"
	"path/filepath"
	"runtime/debug"
	"sort"
	"strings"

	"github.com/Xsxdot/charter/graph/codegraph"
	"github.com/spf13/cobra"
)

// buildVersion 由 release 构建以 -ldflags "-X .../cli.buildVersion=vX.Y.Z" 注入；
// go install / 源码构建时为空，version 子命令回落到 runtime/debug.ReadBuildInfo。
var buildVersion string

var (
	graphRepo               = "."
	graphBase               string
	graphDepth              = 2
	graphFull               bool
	graphFoldExternal       = true
	graphCollapseUtil       = true
	graphWithSource         bool
	graphContextWithSource  = true
	graphSourceSpan         = codegraph.DefaultSourceSpan
	graphMaxTokens          = codegraph.DefaultMaxTokens
	graphView               string
	graphStale              bool
	graphEdges              bool
	absorbCommit            string
	absorbBranch            string
	graphResolveDoc         string
	graphContractFrom       string
	graphContractTo         string
	graphContractEntries    []string
	graphContractInterfaces []string
	graphContractBudget     int
	treeUp                  bool
	treeThrough             string
	treeFrom                string
	treeOnce                bool
)

var graphCmd = &cobra.Command{
	Use:   "codegraph",
	Short: "查询仓库内的代码图（codegraph/*.json，本地只读）",
}

// New 构造命令树并返回根命令。use 为挂载名：canonical 二进制传 "codegraph"，
// handoff 别名传 "graph"。命令树是包级单例——同一进程只应使用一个挂载名。
func New(use string) *cobra.Command {
	graphCmd.Use = use
	return graphCmd
}

// graphLoadView 加载基线并按 --view 叠加 diff，返回合并视图。
func graphLoadView() (*codegraph.View, *codegraph.Graph, error) {
	g, err := codegraph.LoadGraph(graphRepo)
	if err != nil {
		return nil, nil, err
	}
	var d *codegraph.Diff
	if graphView != "" {
		if d, err = codegraph.LoadDiff(graphRepo, graphView); err != nil {
			return nil, nil, err
		}
		if issues := codegraph.ValidateDiff(g, d); len(issues) > 0 {
			return nil, nil, fmt.Errorf("视图 %s 引用不完整: %v", graphView, issues)
		}
	}
	return codegraph.Merge(g, d), g, nil
}

// graphPrintJSON 把结果编码到 stdout（缩进 JSON，agent 与人都可读）。
func graphPrintJSON(cmd *cobra.Command, v any) error {
	enc := json.NewEncoder(cmd.OutOrStdout())
	enc.SetIndent("", " ")
	enc.SetEscapeHTML(false)
	return enc.Encode(v)
}

// graphResetState 清理进程内复用命令树时的图命令 flag 状态。
// Cobra 测试会在同一进程执行多次子命令，未提供的 flag 不能继承上一次查询。
func graphResetState() {
	graphRepo = "."
	graphBase = ""
	graphDepth = 2
	graphFull = false
	graphFoldExternal = true
	graphCollapseUtil = true
	graphWithSource = false
	graphContextWithSource = true
	graphSourceSpan = codegraph.DefaultSourceSpan
	graphMaxTokens = codegraph.DefaultMaxTokens
	graphView = ""
	graphStale = false
	graphEdges = false
	absorbCommit = ""
	absorbBranch = ""
	graphResolveDoc = ""
	graphContractFrom = ""
	graphContractTo = ""
	graphContractEntries = nil
	graphContractInterfaces = nil
	graphContractBudget = 0
	treeUp = false
	treeThrough = ""
	treeFrom = ""
	treeOnce = false
}

var graphValidateCmd = &cobra.Command{
	Use:   "validate",
	Short: "校验基线与全部视图的引用完整性（--stale 加保鲜检查），问题即非零退出",
	RunE: func(cmd *cobra.Command, args []string) (err error) {
		defer graphResetState()
		g, err := codegraph.LoadGraph(graphRepo)
		if err != nil {
			return err
		}
		issues := codegraph.Validate(g)
		best, err := codegraph.LoadBest(graphRepo)
		if err != nil {
			return err
		}
		if best != nil {
			for _, issue := range codegraph.ValidateBest(best) {
				issues = append(issues, "[best] "+issue)
			}
		}
		decls, err := codegraph.LoadDomainDecls(graphRepo)
		if err != nil {
			return err
		}
		declView := codegraph.Merge(g, nil)
		declIDs := make([]string, 0, len(decls))
		for id := range decls {
			declIDs = append(declIDs, id)
		}
		sort.Strings(declIDs)
		for _, id := range declIDs {
			for _, issue := range codegraph.ValidateDecls(declView, best, graphRepo, map[string]codegraph.DomainDecl{id: decls[id]}) {
				issues = append(issues, "[decl "+id+"] "+issue)
			}
		}
		edgeIssues := codegraph.CheckEdges(graphRepo, g.Nodes, g.Edges)
		for _, ei := range edgeIssues {
			issues = append(issues, "调用边门控: "+ei.Detail)
		}
		views, err := codegraph.ListViews(graphRepo)
		if err != nil {
			return err
		}
		if views == nil {
			views = []string{}
		}
		for _, name := range views {
			d, err := codegraph.LoadDiff(graphRepo, name)
			if err != nil {
				return err
			}
			for _, is := range codegraph.ValidateDiff(g, d) {
				issues = append(issues, "["+name+"] "+is)
			}
			mergedNodes := make(map[string]codegraph.Node, len(g.Nodes)+len(d.NodesAdded))
			for id, n := range g.Nodes {
				mergedNodes[id] = n
			}
			for id, n := range d.NodesAdded {
				mergedNodes[id] = n
			}
			for id, n := range d.NodesModified {
				if _, ok := mergedNodes[id]; ok {
					mergedNodes[id] = n
				}
			}
			for _, ei := range codegraph.CheckEdges(graphRepo, mergedNodes, d.EdgesAdded) {
				issues = append(issues, "["+name+"] 调用边门控: "+ei.Detail)
			}
		}
		var stale []codegraph.StaleNode
		if graphStale {
			stale = codegraph.CheckStale(graphRepo, g)
		}
		unscanned := 0
		for _, n := range g.Nodes {
			if n.Kind == "entry" && n.Unscanned {
				unscanned++
			}
		}
		out := map[string]any{
			"nodes": len(g.Nodes), "edges": len(g.Edges),
			"containers": len(g.Containers), "domains": len(g.Domains), "views": views,
			"domainDecls": len(decls), "unscannedEntries": unscanned, "issues": issues, "edgeIssues": edgeIssues,
			// 标了 entity 但还没补生命周期的 model 数。刻意不执法（契约 24），
			// 与 unscannedEntries 同处：它是补标进度表，不是错误。
			"entitiesWithoutLifecycle": codegraph.EntitiesWithoutLifecycle(g),
		}
		if graphStale {
			out["stale"] = stale
		}
		if err := graphPrintJSON(cmd, out); err != nil {
			return err
		}
		if len(issues) > 0 || len(stale) > 0 {
			return fmt.Errorf("发现 %d 个完整性问题、%d 个失鲜节点", len(issues), len(stale))
		}
		return nil
	},
}

var graphMigrateCmd = &cobra.Command{
	Use:   "migrate",
	Short: "将 v2 target.json 与 baseline.json 机械迁移到 v3 与 best.json",
	RunE: func(cmd *cobra.Command, args []string) error {
		defer graphResetState()
		result, err := codegraph.MigrateTarget(graphRepo)
		if err != nil {
			return err
		}
		for _, note := range result.Notes {
			fmt.Fprintln(cmd.ErrOrStderr(), note)
		}
		return graphPrintJSON(cmd, result)
	},
}

var graphCheckCmd = &cobra.Command{
	Use:          "check",
	Short:        "目标图契约对照：实际跨域边 ⊆ target.json 声明的契约面，违规即非零退出",
	SilenceUsage: true,
	RunE: func(cmd *cobra.Command, args []string) error {
		defer graphResetState()
		t, err := codegraph.LoadTarget(graphRepo)
		if err != nil {
			// 无基准绝不静默通过——这是本机制的头号反静默约定（spec §5）
			return fmt.Errorf("目标图不可用，check 拒绝执行: %w", err)
		}
		if issues := codegraph.ValidateTarget(t); len(issues) > 0 {
			return fmt.Errorf("目标图自身不合法: %v", issues)
		}
		best, err := codegraph.LoadBest(graphRepo)
		if err != nil {
			return fmt.Errorf("最优图不可用，check 拒绝执行: %w", err)
		}
		if best == nil {
			fmt.Fprintln(cmd.ErrOrStderr(), "最优图判据已跳过：未找到 codegraph/best.json")
		} else if issues := codegraph.ValidateBest(best); len(issues) > 0 {
			return fmt.Errorf("最优图自身不合法: %v", issues)
		}
		v, _, err := graphLoadView()
		if err != nil {
			return err
		}
		// 领域声明进 check：validate 管存在性，check 管正确性（锚归属）。
		// 加载失败直接返回，不静默降级成「没有声明」——那会让锚判据无声失效，
		// 报告全绿而问题还在（与 graphValidateCmd 的处置一致）。
		decls, err := codegraph.LoadDomainDecls(graphRepo)
		if err != nil {
			return err
		}
		rep := codegraph.Check(t, best, v, decls)
		// CLI 只负责用 git 取基准 target；判档、写入 Report 和重排都在 codegraph
		// 的纯函数里（契约 §3-3）——分档逻辑留在 CLI 就成了第二套判据。
		if base, baseErr := loadBudgetBase(graphRepo, graphBase); baseErr != nil {
			fmt.Fprintf(cmd.ErrOrStderr(), "预算棘轮判据已跳过：%v\n", baseErr)
		} else {
			codegraph.ApplyBudgetRatchet(rep, t, base)
		}
		if err := graphPrintJSON(cmd, rep); err != nil {
			return err
		}
		if len(rep.Fails) > 0 {
			return fmt.Errorf("契约对照发现 %d 处违规", len(rep.Fails))
		}
		return nil
	},
}

func loadBudgetBase(repo, explicit string) (*codegraph.Target, error) {
	revision := explicit
	if revision == "" {
		var err error
		revision, err = findMergeBase(repo)
		if err != nil {
			return nil, err
		}
	}
	prefix, err := gitOutput(repo, "rev-parse", "--show-prefix")
	if err != nil {
		return nil, fmt.Errorf("无法确定 git 顶层路径前缀：%w", err)
	}
	if prefix != "" && !strings.HasSuffix(prefix, "/") {
		prefix += "/"
	}
	targetPath := prefix + "codegraph/target.json"
	raw, err := gitOutput(repo, "show", revision+":"+targetPath)
	if err != nil {
		return nil, fmt.Errorf("无法读取基准 %s 的 %s：%w", revision, targetPath, err)
	}
	var target codegraph.Target
	// 这是对 LoadTarget 中 meta.version 白名单单点收口的有意例外：基准可能是
	// schema v1/v2，而三个版本的 contracts 段形态相同（契约 §7-R11）。本函数只
	// 投影 contracts，产物只允许喂给棘轮比较（CheckBudgetRatchet /
	// ApplyBudgetRatchet），**永远不得传给 Check**；预算字段只作比较、不作事实
	// 来源，执法判据一律只吃走过版本门的当前 target。
	if err := json.Unmarshal([]byte(raw), &target); err != nil {
		return nil, fmt.Errorf("解析基准 %s 的 target.json：%w", revision, err)
	}
	return &codegraph.Target{Contracts: target.Contracts}, nil
}

func findMergeBase(repo string) (string, error) {
	// 先用远端 HEAD 的权威符号引用，再试常见远端分支，最后试本地分支；这个顺序
	// 兼顾团队默认分支命名和未配置 remote 的本地仓，且不把任意分支当成主线。
	branches := []string{"refs/remotes/origin/HEAD", "origin/main", "origin/master", "main", "master"}
	var reasons []string
	for _, branch := range branches {
		if _, err := gitOutput(repo, "rev-parse", "--verify", branch+"^{commit}"); err != nil {
			reasons = append(reasons, branch+" 不存在")
			continue
		}
		base, err := gitOutput(repo, "merge-base", "HEAD", branch)
		if err == nil && base != "" {
			return base, nil
		}
		reasons = append(reasons, branch+" 无法计算 merge-base")
	}
	return "", fmt.Errorf("未探测到默认分支（已按 origin/HEAD、origin/main、origin/master、main、master 探测：%s）", strings.Join(reasons, "；"))
}

func gitOutput(repo string, args ...string) (string, error) {
	cmd := exec.Command("git", append([]string{"-C", repo}, args...)...)
	out, err := cmd.CombinedOutput()
	if err != nil {
		detail := strings.TrimSpace(string(out))
		if detail == "" {
			return "", fmt.Errorf("git %s: %w", strings.Join(args, " "), err)
		}
		return "", fmt.Errorf("git %s: %w（%s）", strings.Join(args, " "), err, detail)
	}
	return strings.TrimSpace(string(out)), nil
}

var graphAbsorbCmd = &cobra.Command{
	Use:   "absorb <view>",
	Short: "把分支视图 diff 併入 baseline 并删除该 diff（分支合并回主线后执行）",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		defer graphResetState()
		g, err := codegraph.LoadGraph(graphRepo)
		if err != nil {
			return err
		}
		d, err := codegraph.LoadDiff(graphRepo, args[0])
		if err != nil {
			return err
		}
		if issues := codegraph.ValidateDiff(g, d); len(issues) > 0 {
			return fmt.Errorf("视图 %s 引用不完整，拒绝併入: %v", args[0], issues)
		}
		mergedNodes := make(map[string]codegraph.Node, len(g.Nodes)+len(d.NodesAdded))
		for id, n := range g.Nodes {
			mergedNodes[id] = n
		}
		for id, n := range d.NodesAdded {
			mergedNodes[id] = n
		}
		for id, n := range d.NodesModified {
			if _, ok := mergedNodes[id]; ok {
				mergedNodes[id] = n
			}
		}
		if eis := codegraph.CheckEdges(graphRepo, mergedNodes, d.EdgesAdded); len(eis) > 0 {
			var lines []string
			for _, ei := range eis {
				lines = append(lines, ei.Detail)
			}
			return fmt.Errorf("视图 %s 含 %d 条不可能真实的调用边，拒绝併入:\n%s", args[0], len(eis), strings.Join(lines, "\n"))
		}
		merged := codegraph.Absorb(g, d)
		// 刷新来源戳。--commit/--branch 未给时从 git 取；取不到就报错，
		// 不猜——基线的 meta 是审计锚点（worktree 版本戳说谎的前科）。
		merged.Meta.Commit, merged.Meta.Branch = absorbCommit, absorbBranch
		if merged.Meta.Commit == "" {
			if merged.Meta.Commit, err = gitHead(graphRepo); err != nil {
				return fmt.Errorf("取 HEAD 失败，请显式传 --commit: %w", err)
			}
		}
		if merged.Meta.Branch == "" {
			if merged.Meta.Branch, err = gitBranch(graphRepo); err != nil {
				return fmt.Errorf("取分支失败，请显式传 --branch: %w", err)
			}
		}
		if err := codegraph.SaveGraph(graphRepo, merged); err != nil {
			return err // 写盘失败：diff 保留，重试无损
		}
		diffPath := filepath.Join(graphRepo, "codegraph", "diffs", args[0]+".json")
		if err := os.Remove(diffPath); err != nil {
			return fmt.Errorf("基线已更新但删除 diff 失败（手动删除 %s）: %w", diffPath, err)
		}
		fmt.Fprintf(cmd.ErrOrStderr(), "已併入视图 %s：+%d 节点 ~%d -%d，基线 %d 节点 @%s\n",
			args[0], len(d.NodesAdded), len(d.NodesModified), len(d.NodesDeleted),
			len(merged.Nodes), merged.Meta.Commit)
		return nil
	},
}

func gitHead(repo string) (string, error) {
	out, err := exec.Command("git", "-C", repo, "rev-parse", "HEAD").Output()
	if err != nil {
		return "", fmt.Errorf("git rev-parse HEAD: %w", err)
	}
	commit := strings.TrimSpace(string(out))
	if commit == "" {
		return "", fmt.Errorf("git rev-parse HEAD 返回空值")
	}
	return commit, nil
}

func gitBranch(repo string) (string, error) {
	out, err := exec.Command("git", "-C", repo, "branch", "--show-current").Output()
	if err != nil {
		return "", fmt.Errorf("git branch --show-current: %w", err)
	}
	branch := strings.TrimSpace(string(out))
	if branch == "" {
		return "", fmt.Errorf("当前处于 detached HEAD")
	}
	return branch, nil
}

var graphViewsCmd = &cobra.Command{
	Use:   "views",
	Short: "列出可用视图（codegraph/diffs/ 下的文件名）",
	RunE: func(cmd *cobra.Command, args []string) error {
		defer graphResetState()
		views, err := codegraph.ListViews(graphRepo)
		if err != nil {
			return err
		}
		if views == nil {
			views = []string{}
		}
		return graphPrintJSON(cmd, map[string]any{"views": views})
	},
}

// graphQueryOutput 保持装配结果字段在 JSON 顶层，附加 CLI 层的深度与可选 stale 数据。
type graphQueryOutput struct {
	*codegraph.AssembledResult
	Depth int                   `json:"depth"`
	Stale []codegraph.StaleNode `json:"stale,omitempty"`
}

// graphQueryRunE 是 chain 与 who-calls 的共用主体：解析焦点 → 邻域查询 → 输出。
func graphQueryRunE(down, up bool) func(*cobra.Command, []string) error {
	return func(cmd *cobra.Command, args []string) error {
		defer graphResetState()
		slog.Default().Info("graph query started", "command", cmd.Name(), "args", args, "down", down, "up", up)
		v, _, err := graphLoadView()
		if err != nil {
			slog.Default().Error("graph query load failed", "command", cmd.Name(), "stage", "load", "error", err)
			return err
		}
		foci := make([]string, 0, len(args))
		for _, a := range args {
			id, err := codegraph.Resolve(v, a)
			if err != nil {
				slog.Default().Error("graph query resolve failed", "command", cmd.Name(), "arg", a, "stage", "resolve", "error", err)
				return err
			}
			foci = append(foci, id)
		}
		limit := graphDepth
		if limit == 0 {
			limit = -1 // CLI 语义：0 = 不限 → 核心语义 -1
		}
		dn, upn := 0, 0
		if down {
			dn = limit
		}
		if up {
			upn = limit
		}
		r, err := codegraph.Neighborhood(v, foci, dn, upn)
		if err != nil {
			slog.Default().Error("graph query neighborhood failed", "command", cmd.Name(), "stage", "neighborhood", "error", err)
			return err
		}
		opts := graphQueryOptions()
		if err := validateGraphQueryOptions(opts); err != nil {
			slog.Default().Error("graph query options rejected", "command", cmd.Name(), "stage", "options", "error", err)
			return err
		}
		assembled, err := codegraph.AssembleResult(v, r, graphRepo, opts)
		if err != nil {
			slog.Default().Error("graph query assembly failed", "command", cmd.Name(), "stage", "assemble", "error", err)
			return err
		}
		out := graphQueryOutput{AssembledResult: assembled, Depth: graphDepth}
		if graphStale {
			subset := &codegraph.Graph{Nodes: map[string]codegraph.Node{}}
			for _, n := range r.Nodes {
				if vn, ok := v.Nodes[n.ID]; ok && vn.Status != "deleted" {
					subset.Nodes[n.ID] = vn.Node
				}
			}
			out.Stale = codegraph.CheckStale(graphRepo, subset)
		}
		slog.Default().Info("graph query completed", "command", cmd.Name(), "rawNodes", len(r.Nodes), "outputNodes", len(assembled.Nodes), "outputEdges", len(assembled.Edges), "truncated", assembled.Truncated != nil)
		if err := graphPrintJSON(cmd, out); err != nil {
			slog.Default().Error("graph query json output failed", "command", cmd.Name(), "stage", "json", "error", err)
			return err
		}
		return nil
	}
}

func graphQueryOptions() codegraph.QueryOptions {
	return codegraph.QueryOptions{Full: graphFull, FoldExternal: graphFoldExternal, CollapseUtil: graphCollapseUtil,
		WithSource: graphWithSource, SourceSpan: graphSourceSpan, MaxTokens: graphMaxTokens}
}

func graphContextOptions() codegraph.QueryOptions {
	return codegraph.QueryOptions{Full: graphFull, FoldExternal: graphFoldExternal, CollapseUtil: graphCollapseUtil,
		WithSource: graphContextWithSource, SourceSpan: graphSourceSpan, MaxTokens: graphMaxTokens}
}

func validateGraphQueryOptions(opts codegraph.QueryOptions) error {
	if opts.SourceSpan < 1 || opts.SourceSpan > codegraph.MaxSourceSpan {
		return fmt.Errorf("source span %d out of range 1..%d", opts.SourceSpan, codegraph.MaxSourceSpan)
	}
	if opts.MaxTokens < 0 {
		return fmt.Errorf("max tokens %d must be non-negative", opts.MaxTokens)
	}
	return nil
}

var graphChainCmd = &cobra.Command{
	Use:   "chain <节点 id 或名字>...",
	Short: "焦点的下游调用链（多个焦点取并集）",
	Args:  cobra.MinimumNArgs(1),
	RunE:  graphQueryRunE(true, false),
}

var graphWhoCallsCmd = &cobra.Command{
	Use:   "who-calls <节点 id 或名字>...",
	Short: "谁调用了焦点——上游影响面（多个焦点取并集）",
	Args:  cobra.MinimumNArgs(1),
	RunE:  graphQueryRunE(false, true),
}

func graphUniqueID(v *codegraph.View, arg string) (string, error) {
	r, err := codegraph.SymLookup(v, graphRepo, arg)
	if err != nil {
		return "", err
	}
	if len(r.Matches) != 1 {
		ids := make([]string, 0, len(r.Matches))
		for _, m := range r.Matches {
			ids = append(ids, m.ID+"("+m.Name+")")
		}
		sort.Strings(ids)
		return "", fmt.Errorf("名字 %q 多义，请用节点 id: %s", arg, strings.Join(ids, ", "))
	}
	return r.Matches[0].ID, nil
}

var graphFlowCmd = &cobra.Command{
	Use:   "flow <节点 id 或名字>",
	Short: "一个方法怎么走——控制流步骤树，不是 chain 的调用图切片",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		defer graphResetState()
		slog.Default().Info("graph flow started", "arg", args[0])
		v, g, err := graphLoadView()
		if err != nil {
			slog.Default().Error("graph flow load failed", "error", err)
			return err
		}
		id, err := graphUniqueID(v, args[0])
		if err != nil {
			slog.Default().Error("graph flow resolve failed", "arg", args[0], "error", err)
			return err
		}
		out, err := codegraph.LookupFlow(v, g, graphRepo, args[0], id)
		if err != nil {
			slog.Default().Error("graph flow lookup failed", "id", id, "error", err)
			return err
		}
		slog.Default().Info("graph flow completed", "id", id, "degraded", out.Degraded, "steps", len(out.Steps))
		return graphPrintJSON(cmd, out)
	},
}

var graphTreeCmd = &cobra.Command{
	Use:   "tree <节点 id 或名字>",
	Short: "调用树（缺省向下；--up 向上，--through/--from 卡住走廊）",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		defer graphResetState()
		slog.Default().Info("graph tree started", "arg", args[0], "up", treeUp, "through", treeThrough, "from", treeFrom, "once", treeOnce, "depth", graphDepth)
		v, _, err := graphLoadView()
		if err != nil {
			slog.Default().Error("graph tree load failed", "error", err)
			return err
		}
		id, err := graphUniqueID(v, args[0])
		if err != nil {
			slog.Default().Error("graph tree resolve failed", "arg", args[0], "error", err)
			return err
		}
		opts := codegraph.TreeOptions{Focus: id, Up: treeUp, Once: treeOnce, Depth: graphDepth}
		if graphDepth == 0 {
			opts.Depth = -1
		}
		if treeThrough != "" {
			opts.Through, err = graphUniqueID(v, treeThrough)
			if err != nil {
				slog.Default().Error("graph tree through resolve failed", "through", treeThrough, "error", err)
				return err
			}
		}
		if treeFrom != "" {
			opts.From, err = graphUniqueID(v, treeFrom)
			if err != nil {
				slog.Default().Error("graph tree from resolve failed", "from", treeFrom, "error", err)
				return err
			}
		}
		out, err := codegraph.BuildCallTree(v, opts)
		if err != nil {
			slog.Default().Error("graph tree failed", "id", id, "error", err)
			return err
		}
		slog.Default().Info("graph tree completed", "id", id, "up", opts.Up)
		return graphPrintJSON(cmd, out)
	},
}

func bindQueryFlags(cmd *cobra.Command, source *bool, withDepth bool) {
	if withDepth {
		cmd.Flags().IntVar(&graphDepth, "depth", 2, "查询深度（0 = 不限）")
	}
	cmd.Flags().BoolVar(&graphFull, "full", false, "恢复旧的全量节点字段")
	cmd.Flags().BoolVar(&graphFoldExternal, "fold-external", true, "按外部领域折叠节点")
	cmd.Flags().BoolVar(&graphCollapseUtil, "collapse-util", true, "收桩跨领域高扇入节点")
	cmd.Flags().BoolVar(source, "with-source", *source, "附带源码窗口")
	cmd.Flags().IntVar(&graphSourceSpan, "source-span", codegraph.DefaultSourceSpan, "源码窗口行数（上限 200）")
	cmd.Flags().IntVar(&graphMaxTokens, "max-tokens", codegraph.DefaultMaxTokens, "近似 token 预算（0 = 不限）")
}

var graphContextCmd = &cobra.Command{
	Use:   "context <领域>",
	Short: "装配一个最优树领域的声明、接口、主链与实体上下文（无 best.json 时降级为现状领域）",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		defer graphResetState()
		slog.Default().Info("graph context started", "domain", args[0])
		v, g, err := graphLoadView()
		if err != nil {
			slog.Default().Error("graph context load failed", "domain", args[0], "stage", "load", "error", err)
			return err
		}
		opts := graphContextOptions()
		if err := validateGraphQueryOptions(opts); err != nil {
			slog.Default().Error("graph context options rejected", "domain", args[0], "stage", "options", "error", err)
			return err
		}
		// best 缺席不是错误：AssembleContext 会降级到现状词表并在 warning 里说明。
		best, bestErr := codegraph.LoadBest(graphRepo)
		if bestErr != nil {
			slog.Default().Error("graph context best load failed", "domain", args[0], "stage", "load-best", "error", bestErr)
			return bestErr
		}
		out, err := codegraph.AssembleContext(v, g, best, graphRepo, args[0], opts)
		if err != nil {
			slog.Default().Error("graph context assembly failed", "domain", args[0], "stage", "assemble", "error", err)
			return err
		}
		if !graphStale {
			out.Stale = nil
		}
		slog.Default().Info("graph context completed", "domain", args[0], "interfaces", len(out.Interfaces), "entities", len(out.Entities), "chainNodes", len(out.Chain.Nodes), "stale", len(out.Stale))
		if err := graphPrintJSON(cmd, out); err != nil {
			slog.Default().Error("graph context json output failed", "domain", args[0], "stage", "json", "error", err)
			return err
		}
		return nil
	},
}

// graphDomainsCmd 列领域树：agent 定位「该从哪个领域下手」的第一跳。
var graphDomainsCmd = &cobra.Command{
	Use:   "domains",
	Short: "列出领域树（职责、成员统计、对外接口）",
	RunE: func(cmd *cobra.Command, args []string) error {
		defer graphResetState()
		v, _, err := graphLoadView()
		if err != nil {
			return err
		}
		if graphEdges {
			best, bestErr := codegraph.LoadBest(graphRepo)
			if bestErr != nil {
				return bestErr
			}
			out := map[string]any{
				"view":    v.Name,
				"current": codegraph.DomainEdgeMatrix(v),
			}
			if best == nil {
				out["bestSkipped"] = "best.json 不可用，已跳过最优矩阵：未找到 codegraph/best.json"
			} else {
				out["best"] = codegraph.BestEdgeMatrix(v, best)
			}
			return graphPrintJSON(cmd, out)
		}
		doms := codegraph.DomainTree(v)
		best, bestErr := codegraph.LoadBest(graphRepo)
		if bestErr != nil {
			return bestErr
		}
		if best != nil {
			doms = codegraph.DomainTreeWithBest(v, best)
		} else {
			fmt.Fprintln(cmd.ErrOrStderr(), "best.json 不可用，subsystems/crossSubsystem 已省略：未找到 codegraph/best.json")
		}
		out := map[string]any{"view": v.Name, "domains": doms}
		if doms == nil {
			// 明确区分「没有领域」与「查不出领域」：前者是旧数据，给可行动的提示
			out["domains"] = []codegraph.DomainStat{}
			out["warning"] = "该图未包含领域划分（扫描版本较旧）：重扫可获得领域信息"
		}
		return graphPrintJSON(cmd, out)
	},
}

// graphSymCmd 单点符号查询：agent 探索「X 在哪 / 什么形状」的第一跳，
// 输出行号已做查询时再锚定（图数据允许陈旧，输出必须当下可用）。
var graphSymCmd = &cobra.Command{
	Use:   "sym <符号名或节点 id>",
	Short: "单点符号查询：位置（已再锚定）、签名、字段、摘要、归属",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		defer graphResetState()
		v, _, err := graphLoadView()
		if err != nil {
			return err
		}
		r, err := codegraph.SymLookup(v, graphRepo, args[0])
		if err != nil {
			return err
		}
		return graphPrintJSON(cmd, r)
	},
}

// graphEntityCmd 查询数据实体的投影链：typed/handroll 投影点与跨语言孪生侧。
var graphEntityCmd = &cobra.Command{
	Use:   "entity <model 名或节点 id>",
	Short: "数据实体的投影链：typed/handroll 投影点 + 跨语言孪生（序列化边界四查入口）",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		defer graphResetState()
		v, _, err := graphLoadView()
		if err != nil {
			return err
		}
		r, err := codegraph.EntityLookup(v, graphRepo, args[0])
		if err != nil {
			return err
		}
		return graphPrintJSON(cmd, r)
	},
}

var graphResolveCmd = &cobra.Command{
	Use:   "resolve [file#Symbol]",
	Short: "校验 file#Symbol 符号锚，或批量检查文档（坏锚即非零退出）",
	RunE: func(cmd *cobra.Command, args []string) error {
		defer func() {
			graphResetState()
			cmd.Flags().Lookup("doc").Changed = false
		}()
		if len(args) > 1 {
			return fmt.Errorf("resolve 只接受一个 file#Symbol 位置参数")
		}
		if graphResolveDoc != "" && len(args) > 0 {
			return fmt.Errorf("resolve 的 --doc 与 file#Symbol 位置参数互斥")
		}
		if graphResolveDoc == "" && len(args) == 0 {
			return fmt.Errorf("resolve 必须指定 --doc 或 file#Symbol")
		}
		v, _, err := graphLoadView()
		if err != nil {
			return err
		}
		if len(args) == 1 {
			anchor, err := codegraph.ResolveAnchor(v, graphRepo, args[0])
			if err != nil {
				return err
			}
			return graphPrintJSON(cmd, anchor)
		}
		anchors, err := codegraph.CheckDocAnchors(v, graphRepo, graphResolveDoc)
		if err != nil {
			return err
		}
		if anchors == nil {
			anchors = []codegraph.AnchorResult{}
		}
		if err := graphPrintJSON(cmd, map[string]any{"anchors": anchors}); err != nil {
			return err
		}
		for _, a := range anchors {
			if a.Anchor == "vanished" || a.Anchor == "file_missing" {
				return fmt.Errorf("文档锚点检查失败: %s (%s)", a.Ref, a.Anchor)
			}
		}
		return nil
	},
}

var graphContractCmd = &cobra.Command{
	Use:   "contract",
	Short: "维护目标图中的跨领域契约",
}

var graphContractSetCmd = &cobra.Command{
	Use:   "set",
	Short: "创建或更新 From→To 契约",
	Args:  cobra.NoArgs,
	RunE: func(cmd *cobra.Command, args []string) error {
		defer func() {
			graphResetState()
			for _, name := range []string{"from", "to", "entries", "interfaces", "budget"} {
				cmd.Flags().Lookup(name).Changed = false
			}
		}()
		if graphContractFrom == "" || graphContractTo == "" {
			return fmt.Errorf("contract set 必须指定 --from 与 --to")
		}
		c := codegraph.Contract{From: graphContractFrom, To: graphContractTo}
		entriesSet := cmd.Flags().Changed("entries")
		interfacesSet := cmd.Flags().Changed("interfaces")
		budgetSet := cmd.Flags().Changed("budget")
		if entriesSet {
			c.Entries = append([]string(nil), graphContractEntries...)
		}
		if interfacesSet {
			c.Interfaces = append([]string(nil), graphContractInterfaces...)
		}
		if budgetSet {
			c.LegacyBudget = graphContractBudget
		}
		before, after, err := codegraph.SetContractWithPresence(graphRepo, c, entriesSet, interfacesSet, budgetSet)
		if err != nil {
			return err
		}
		return graphPrintJSON(cmd, map[string]any{"before": before, "after": after})
	},
}

// graphSummaryCmd 输出一段图存在性摘要，供 SessionStart hook 注入会话上下文：
// 让 agent 开局就知道图存在、先查图再 grep。
var graphSummaryCmd = &cobra.Command{
	Use:   "summary",
	Short: "图摘要（供会话开局注入：规模、领域数、查询子命令菜单）",
	RunE: func(cmd *cobra.Command, args []string) error {
		defer graphResetState()
		g, err := codegraph.LoadGraph(graphRepo)
		if err != nil {
			return err
		}
		fmt.Fprintf(cmd.OutOrStdout(),
			"本仓库有代码图：%d 节点 / %d 边 / %d 领域（codegraph/）。探索已有代码先查图：codegraph sym <符号>（定位+签名+字段，行号已再锚定）、flow <符号>（这个方法怎么走）、tree <符号>（调用树，--up --through --from 卡住向上走廊）、who-calls <符号>（上游影响面）、chain <符号>（下游切片）、domains（领域树）；图未命中再 grep，并把未命中符号记入产出物的「图覆盖债」小节。\n",
			len(g.Nodes), len(g.Edges), len(g.Domains))
		return nil
	},
}

// graphVersionCmd 输出版本标识（契约 R4 新增的第 13 个子命令）：
// release 构建由 ldflags 注入 buildVersion；go install / 源码构建读 build info。
var graphVersionCmd = &cobra.Command{
	Use:   "version",
	Short: "输出 codegraph 版本",
	RunE: func(cmd *cobra.Command, args []string) error {
		fmt.Fprintln(cmd.OutOrStdout(), resolveVersion())
		return nil
	},
}

// resolveVersion 决议版本串：ldflags 注入优先，其次 module 版本 + vcs 提交号。
// 两者皆无（如测试二进制）时输出 "devel"——version 的契约是非空，不是精确。
func resolveVersion() string {
	if buildVersion != "" {
		return buildVersion
	}
	if bi, ok := debug.ReadBuildInfo(); ok {
		v := bi.Main.Version
		var rev string
		for _, s := range bi.Settings {
			if s.Key == "vcs.revision" && len(s.Value) >= 12 {
				rev = s.Value[:12]
			}
		}
		switch {
		case v != "" && v != "(devel)" && rev != "":
			return v + "+" + rev
		case v != "" && v != "(devel)":
			return v
		case rev != "":
			return "devel+" + rev
		}
	}
	return "devel"
}

func init() {
	graphCmd.PersistentFlags().StringVar(&graphRepo, "repo", ".", "目标仓库根目录")
	graphCmd.PersistentFlags().StringVar(&graphBase, "base", "", "棘轮基准 revision（缺省取默认分支 merge-base）")
	graphCmd.PersistentFlags().StringVar(&graphView, "view", "", "叠加的视图名（codegraph/diffs/<名>.json）")
	graphCmd.PersistentFlags().BoolVar(&graphStale, "stale", false, "附带保鲜检测结果")
	bindQueryFlags(graphChainCmd, &graphWithSource, true)
	bindQueryFlags(graphWhoCallsCmd, &graphWithSource, true)
	graphTreeCmd.Flags().IntVar(&graphDepth, "depth", 2, "查询深度（0 = 不限）")
	bindQueryFlags(graphContextCmd, &graphContextWithSource, false)
	graphDomainsCmd.Flags().BoolVar(&graphEdges, "edges", false, "输出跨领域边矩阵")
	graphAbsorbCmd.Flags().StringVar(&absorbCommit, "commit", "", "写入基线 meta 的提交号（缺省从 git HEAD 读取）")
	graphAbsorbCmd.Flags().StringVar(&absorbBranch, "branch", "", "写入基线 meta 的分支名（缺省从 git 读取）")
	graphResolveCmd.Flags().StringVar(&graphResolveDoc, "doc", "", "要检查的 Markdown 文档路径")
	graphContractSetCmd.Flags().StringVar(&graphContractFrom, "from", "", "契约来源域 id")
	graphContractSetCmd.Flags().StringVar(&graphContractTo, "to", "", "契约目标域 id")
	graphContractSetCmd.Flags().StringSliceVar(&graphContractEntries, "entries", nil, "允许进入目标域的入口清单")
	graphContractSetCmd.Flags().StringSliceVar(&graphContractInterfaces, "interfaces", nil, "允许的跨域接口清单")
	graphContractSetCmd.Flags().IntVar(&graphContractBudget, "budget", 0, "存量直调预算")
	graphContractCmd.AddCommand(graphContractSetCmd)
	graphTreeCmd.Flags().BoolVar(&treeUp, "up", false, "向上展开（被谁调用）")
	graphTreeCmd.Flags().StringVar(&treeThrough, "through", "", "上面那层方法（向上走廊）")
	graphTreeCmd.Flags().StringVar(&treeFrom, "from", "", "调用上面那层的方法（向上走廊，必须搭配 --through）")
	graphTreeCmd.Flags().BoolVar(&treeOnce, "once", false, "同一节点只展开第一次（防指数爆炸，形状接近 chain）")
	graphCmd.AddCommand(graphValidateCmd, graphCheckCmd, graphAbsorbCmd, graphViewsCmd, graphChainCmd, graphWhoCallsCmd, graphContextCmd, graphDomainsCmd, graphSymCmd, graphEntityCmd, graphResolveCmd, graphContractCmd, graphSummaryCmd, graphVersionCmd, graphMigrateCmd, graphFlowCmd, graphTreeCmd)
}
