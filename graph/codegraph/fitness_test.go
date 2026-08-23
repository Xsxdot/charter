package codegraph

import (
	"fmt"
	"reflect"
	"strings"
	"testing"
)

func viewWithFiles(files ...string) *View {
	v := &View{Containers: map[string]Container{}, Nodes: map[string]ViewNode{}}
	for i, file := range files {
		id := fmt.Sprintf("n_%03d", i)
		container := fmt.Sprintf("c_%03d", i)
		v.Containers[container] = Container{Label: container}
		v.Nodes[id] = ViewNode{Node: Node{Container: container, Name: id, File: file}}
	}
	return v
}

func TestPrefixFamilyFindings(t *testing.T) {
	cases := []struct {
		name     string
		files    []string
		want     bool
		wantText string
		unwanted string
	}{
		{
			name:     "六个同目录文件共享前五字符",
			files:    []string{"internal/agentd/worksA.go", "internal/agentd/worksB.go", "internal/agentd/worksC.go", "internal/agentd/worksD.go", "internal/agentd/worksE.go", "internal/agentd/worksF.go"},
			want:     true,
			wantText: `"works"`,
		},
		{
			name:  "四个成员不足阈值",
			files: []string{"pkg/workA.go", "pkg/workB.go", "pkg/workC.go", "pkg/workD.go"},
		},
		{
			name:     "只共享前三字符",
			files:    []string{"pkg/useA.go", "pkg/useB.go", "pkg/useC.go", "pkg/useD.go", "pkg/useE.go"},
			unwanted: `prefix-family`,
		},
		{
			name:  "跨目录不成一族",
			files: []string{"pkg/worksA.go", "pkg/worksB.go", "pkg/worksC.go", "other/worksD.go", "other/worksE.go"},
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			findings := prefixFamilyFindings(viewWithFiles(tc.files...))
			if tc.want && len(findings) != 1 {
				t.Fatalf("应命中一条 prefix-family: %+v", findings)
			}
			if !tc.want && len(findings) != 0 {
				t.Fatalf("不应命中 prefix-family: %+v", findings)
			}
			if tc.wantText != "" && !strings.Contains(findings[0].Detail, tc.wantText) {
				t.Fatalf("Detail 应包含真实最长公共前缀 %s: %s", tc.wantText, findings[0].Detail)
			}
			if tc.unwanted != "" {
				for _, f := range findings {
					if f.Kind == tc.unwanted {
						t.Fatalf("不应出现 %s: %+v", tc.unwanted, findings)
					}
				}
			}
		})
	}
}

func TestOversizedPackageFindings(t *testing.T) {
	files := func(n int, prefix string) []string {
		out := make([]string, 0, n)
		for i := 0; i < n; i++ {
			out = append(out, fmt.Sprintf("%s/file%02d.go", prefix, i))
		}
		return out
	}
	t.Run("四十个文件无子目录命中", func(t *testing.T) {
		findings := oversizedPackageFindings(viewWithFiles(files(40, "internal/agentd")...))
		if len(findings) != 1 || !strings.Contains(findings[0].Detail, "internal/agentd") || !strings.Contains(findings[0].Detail, "40") {
			t.Fatalf("应命中 oversized-package 并带目录与数量: %+v", findings)
		}
	})
	t.Run("有子目录不命中", func(t *testing.T) {
		all := files(40, "internal/agentd")
		all = append(all, "internal/agentd/sub/file.go")
		if got := oversizedPackageFindings(viewWithFiles(all...)); len(got) != 0 {
			t.Fatalf("存在更深目录时不应命中: %+v", got)
		}
	})
	t.Run("三十九个文件不命中", func(t *testing.T) {
		if got := oversizedPackageFindings(viewWithFiles(files(39, "internal/agentd")...)); len(got) != 0 {
			t.Fatalf("三十九个文件不应命中: %+v", got)
		}
	})
}

func TestFitnessFindingsAreWarnings(t *testing.T) {
	files := []string{"pkg/worksA.go", "pkg/worksB.go", "pkg/worksC.go", "pkg/worksD.go", "pkg/worksE.go"}
	for i := 0; i < 40; i++ {
		files = append(files, fmt.Sprintf("large/file%02d.go", i))
	}
	rep := checkNoDecls(&Target{}, viewWithFiles(files...))
	if !hasFinding(rep.Warns, KindPrefixFamily) || !hasFinding(rep.Warns, KindOversizedPackage) {
		t.Fatalf("两类 fitness finding 都应进 warns: %+v", rep)
	}
	if hasFinding(rep.Fails, KindPrefixFamily) || hasFinding(rep.Fails, KindOversizedPackage) {
		t.Fatalf("两类 fitness finding 不应进 fails: %+v", rep)
	}
}

func TestCheckBudgetRatchetNilBase(t *testing.T) {
	if got := CheckBudgetRatchet(&Target{}, nil); got != nil {
		t.Fatalf("base=nil 应返回 nil，实际: %+v", got)
	}
}

func TestCheckBudgetRatchetRaisesExistingContract(t *testing.T) {
	base := twoDomainTarget(nil, 2)
	cur := twoDomainTarget(nil, 3)
	findings := CheckBudgetRatchet(cur, base)
	if len(findings) != 1 || findings[0].Kind != KindBudgetRaised {
		t.Fatalf("预算 2→3 应产生一条 budget-raised: %+v", findings)
	}
	if !strings.Contains(findings[0].Detail, "d_a→d_b") || !strings.Contains(findings[0].Detail, "2") || !strings.Contains(findings[0].Detail, "3") || !strings.Contains(findings[0].Detail, "上涨") {
		t.Fatalf("既有契约棘轮 Detail 缺方向、数值或上涨措辞: %+v", findings[0])
	}
}

func TestCheckBudgetRatchetIgnoresEqualAndLower(t *testing.T) {
	for _, budget := range []int{5, 2} {
		base := twoDomainTarget(nil, 5)
		cur := twoDomainTarget(nil, budget)
		if got := CheckBudgetRatchet(cur, base); len(got) != 0 {
			t.Fatalf("预算 5→%d 不应产生 finding: %+v", budget, got)
		}
	}
}

func TestCheckBudgetRatchetReportsNewContractDebt(t *testing.T) {
	base := &Target{}
	cur := twoDomainTarget(nil, 4)
	findings := CheckBudgetRatchet(cur, base)
	if len(findings) != 1 || findings[0].Kind != KindBudgetRaised {
		t.Fatalf("基准缺席且当前预算 4 应产生 finding: %+v", findings)
	}
	if !strings.Contains(findings[0].Detail, "新增契约携带存量预算") || strings.Contains(findings[0].Detail, "上涨") {
		t.Fatalf("新增契约应使用独立措辞: %+v", findings[0])
	}
	existing := CheckBudgetRatchet(twoDomainTarget(nil, 3), twoDomainTarget(nil, 2))
	if len(existing) != 1 || strings.Contains(existing[0].Detail, "新增契约携带存量预算") {
		t.Fatalf("既有契约措辞不应包含新增契约措辞: %+v", existing)
	}
}

func TestCheckBudgetRatchetIgnoresNewContractWithZeroBudget(t *testing.T) {
	base := &Target{}
	cur := twoDomainTarget(nil, 0)
	if got := CheckBudgetRatchet(cur, base); len(got) != 0 {
		t.Fatalf("基准缺席且当前预算 0 不应产生 finding: %+v", got)
	}
}

// domainSubsystemTarget 造一个「声明了目标领域」的子系统；只有这种子系统参与
// 未落位预算棘轮（契约 §3-3）。
func domainSubsystemTarget(id string, budget int, note string, declareDomains bool) *Target {
	subsystem := TargetSubsystem{ID: id, Name: id, Type: "logic", Paths: []string{id + "/**"},
		UnplacedBudget: budget, UnplacedBudgetNote: note}
	if declareDomains {
		subsystem.Domains = []TargetDomain{{ID: id + "_api", Name: "API", Responsibility: "r", Paths: []string{id + "/api/**"}}}
	}
	return &Target{Meta: TargetMeta{Version: 2}, Subsystems: []TargetSubsystem{subsystem}}
}

func TestCheckBudgetRatchetRaisesSubsystemUnplacedBudget(t *testing.T) {
	findings := CheckBudgetRatchet(
		domainSubsystemTarget("d_svc", 3, "", true),
		domainSubsystemTarget("d_svc", 2, "", true))
	if len(findings) != 1 || findings[0].Kind != KindBudgetRaised {
		t.Fatalf("未落位预算 2→3 应产生一条 budget-raised: %+v", findings)
	}
	// 冻结 30：目标领域预算上涨用 From=子系统 id，To 省略。
	if findings[0].From != "d_svc" || findings[0].To != "" {
		t.Fatalf("目标领域棘轮 From/To 形状不对: %+v", findings[0])
	}
	for _, want := range []string{"d_svc", "2", "3", "上涨"} {
		if !strings.Contains(findings[0].Detail, want) {
			t.Fatalf("Detail 缺 %q: %+v", want, findings[0])
		}
	}
}

func TestCheckBudgetRatchetSubsystemBaseAbsentCountsAsZero(t *testing.T) {
	findings := CheckBudgetRatchet(domainSubsystemTarget("d_svc", 2, "", true), &Target{})
	if len(findings) != 1 || findings[0].From != "d_svc" || findings[0].To != "" {
		t.Fatalf("基准缺席该子系统时当前预算 2 应报一条: %+v", findings)
	}
	if !strings.Contains(findings[0].Detail, "基准中未声明目标领域") || strings.Contains(findings[0].Detail, "上涨") {
		t.Fatalf("基准缺席应使用独立措辞: %+v", findings[0])
	}
	if got := CheckBudgetRatchet(domainSubsystemTarget("d_svc", 0, "", true), &Target{}); len(got) != 0 {
		t.Fatalf("基准缺席且当前预算 0 不应报: %+v", got)
	}
	// 基准里同名子系统但没声明目标领域，等同于「基准没有这个目标领域预算」。
	undeclared := CheckBudgetRatchet(domainSubsystemTarget("d_svc", 2, "", true), domainSubsystemTarget("d_svc", 5, "", false))
	if len(undeclared) != 1 || !strings.Contains(undeclared[0].Detail, "基准中未声明目标领域") {
		t.Fatalf("基准未声明目标领域时不得借用它的预算数: %+v", undeclared)
	}
}

func TestCheckBudgetRatchetSubsystemIgnoresEqualLowerAndUndeclared(t *testing.T) {
	for _, budget := range []int{5, 2} {
		if got := CheckBudgetRatchet(
			domainSubsystemTarget("d_svc", budget, "", true),
			domainSubsystemTarget("d_svc", 5, "", true)); len(got) != 0 {
			t.Fatalf("未落位预算 5→%d 不应报: %+v", budget, got)
		}
	}
	// 当前子系统没声明目标领域就整体跳过执法，预算涨了也不报（契约 §3-1 第 1 条）。
	if got := CheckBudgetRatchet(
		domainSubsystemTarget("d_svc", 9, "", false),
		domainSubsystemTarget("d_svc", 1, "", true)); len(got) != 0 {
		t.Fatalf("当前未声明目标领域的子系统不参与棘轮: %+v", got)
	}
}

func TestApplyBudgetRatchetGradesByCurrentNote(t *testing.T) {
	cases := []struct {
		name      string
		note      string
		wantFails int
		wantWarns int
	}{
		{name: "无理由进 fails", note: "", wantFails: 1},
		{name: "非空理由降为 warn", note: "竖切迁移中", wantWarns: 1},
		{name: "纯空白理由不算理由", note: " \t\n ", wantFails: 1},
	}
	for _, tc := range cases {
		t.Run("子系统/"+tc.name, func(t *testing.T) {
			rep := &Report{}
			ApplyBudgetRatchet(rep, domainSubsystemTarget("d_svc", 3, tc.note, true), domainSubsystemTarget("d_svc", 2, "", true))
			assertRatchetGrade(t, rep, tc.wantFails, tc.wantWarns)
		})
		t.Run("契约/"+tc.name, func(t *testing.T) {
			cur, base := twoDomainTarget(nil, 3), twoDomainTarget(nil, 2)
			cur.Contracts[0].LegacyBudgetNote = tc.note
			rep := &Report{}
			ApplyBudgetRatchet(rep, cur, base)
			assertRatchetGrade(t, rep, tc.wantFails, tc.wantWarns)
		})
	}
}

func assertRatchetGrade(t *testing.T, rep *Report, wantFails, wantWarns int) {
	t.Helper()
	fails, warns := 0, 0
	for _, f := range rep.Fails {
		if f.Kind == KindBudgetRaised {
			fails++
		}
	}
	for _, f := range rep.Warns {
		if f.Kind == KindBudgetRaised {
			warns++
		}
	}
	if fails != wantFails || warns != wantWarns {
		t.Fatalf("budget-raised 分档不对: fails=%d(want %d) warns=%d(want %d) rep=%+v", fails, wantFails, warns, wantWarns, rep)
	}
}

// 冻结 32：note 只降 budget-raised 的档，其他 fail 永远留在 fails。
// 这两条如果共用降档分支，一个 note 就能把真实的契约违规洗成 warn。
func TestApplyBudgetRatchetKeepsOverBudgetInFails(t *testing.T) {
	cur := twoDomainTarget(nil, 1)
	cur.Contracts[0].LegacyBudgetNote = "竖切迁移中"
	base := twoDomainTarget(nil, 0)
	rep := &Report{Fails: []Finding{{Kind: "over-budget", From: "d_a", To: "d_b", Detail: "a→b 2 条超出预算 1"}}}
	ApplyBudgetRatchet(rep, cur, base)
	if !hasFinding(rep.Fails, "over-budget") || hasFinding(rep.Warns, "over-budget") {
		t.Fatalf("over-budget 不得被 note 降档: %+v", rep)
	}
	if !hasFinding(rep.Warns, KindBudgetRaised) || hasFinding(rep.Fails, KindBudgetRaised) {
		t.Fatalf("有理由的 budget-raised 应降为 warn: %+v", rep)
	}
}

// 回归锁：追加必须发生在排序之前（等价说法——装配函数追加完要重排）。
// 旧 CLI 的 appendBudgetRatchet 在 Check 排完序之后才 append，于是 budget-raised
// 永远吊在末尾，check 输出顺序不再确定、无法做 diff。
func TestApplyBudgetRatchetReordersWholeReport(t *testing.T) {
	rep := &Report{
		Fails: []Finding{{Kind: "over-budget", From: "d_svc", To: "d_target", Detail: "z 超预算"}},
		Warns: []Finding{{Kind: "outside-file", Detail: "图外文件: z.go"}},
	}
	cur := &Target{Meta: TargetMeta{Version: 2}, Subsystems: []TargetSubsystem{
		{ID: "d_zzz", Type: "logic", Paths: []string{"z/**"}, UnplacedBudget: 2,
			Domains: []TargetDomain{{ID: "z_api", Responsibility: "r", Paths: []string{"z/api/**"}}}},
		{ID: "d_aaa", Type: "logic", Paths: []string{"a/**"}, UnplacedBudget: 2, UnplacedBudgetNote: "有理由",
			Domains: []TargetDomain{{ID: "a_api", Responsibility: "r", Paths: []string{"a/api/**"}}}},
	}}
	ApplyBudgetRatchet(rep, cur, &Target{})

	if len(rep.Fails) != 2 || rep.Fails[0].Kind != KindBudgetRaised {
		t.Fatalf("budget-raised 追加后必须重排到 over-budget 之前: %+v", rep.Fails)
	}
	if len(rep.Warns) != 2 || rep.Warns[0].Kind != KindBudgetRaised {
		t.Fatalf("warns 侧同样必须重排: %+v", rep.Warns)
	}
	// 幂等自证：再排一次不应改变顺序，说明返回的就是全序结果。
	for _, findings := range [][]Finding{rep.Fails, rep.Warns} {
		want := append([]Finding(nil), findings...)
		sortFindings(&Report{Fails: want})
		if !reflect.DeepEqual(want, findings) {
			t.Fatalf("装配后的报告不是排好序的:\n got %+v\nwant %+v", findings, want)
		}
	}
}

func TestCheckBudgetRatchetPreservesCurrentContractOrder(t *testing.T) {
	cur := &Target{Contracts: []Contract{
		{From: "d_second", To: "d_target", LegacyBudget: 3},
		{From: "d_first", To: "d_target", LegacyBudget: 2},
	}}
	base := &Target{Contracts: []Contract{
		{From: "d_second", To: "d_target", LegacyBudget: 1},
		{From: "d_first", To: "d_target", LegacyBudget: 1},
	}}
	findings := CheckBudgetRatchet(cur, base)
	if len(findings) != 2 || findings[0].From != "d_second" || findings[1].From != "d_first" {
		t.Fatalf("产出顺序必须跟随 cur.Contracts: %+v", findings)
	}
	for _, finding := range findings {
		if finding.Kind != KindBudgetRaised {
			t.Fatalf("棘轮 finding Kind 必须固定为 budget-raised: %+v", findings)
		}
	}
}
