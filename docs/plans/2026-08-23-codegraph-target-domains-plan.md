# 实现计划：codegraph 目标领域 gap 与预算棘轮

> 卡：C1.1
> 节点：plan
> 适用仓：charter 当前 graph module；handoff 真仓动作单列为协调者任务
> 依赖顺序：V → G → R；H 依赖 V 的 wire 形状，并由协调者在 R 后做真机核验

## 1. 范围、输入与红线

本计划实现 charter 仓的三块逻辑代码，并把 handoff 第一案例列为不可派发的边界验收：

- V：TargetDomain 结构不变式与 ValidateTarget 结构门；
- G：Check 中按子系统聚合的 unplaced、unplaced-over-budget、domain-empty；
- R：保留 CheckBudgetRatchet(cur, base *Target) []Finding 探测器，新增 codegraph 装配函数负责当前 target 的 note 分档、写入 Report 和最终排序，CLI 只负责 git 取基准与触发装配；
- H：handoff 的 codegraph/target.json 与扫描配方是真仓边界动作，由协调者执行，不在 charter 工作树伪造目标领域职责或路径。

不做 meta.version bump、baseline 领域重划、目标领域 parent、跨子系统 paths 重叠检查、领域级契约字段、独立 gap 子命令或查看器实现。

法定输入：

1. docs/specs/2026-08-23-codegraph-target-domains-spec.md：已批准 spec。
2. docs/contracts/2026-08-23-codegraph-target-domains-contract.md：已冻结 wire 字段、函数签名、报告 kind、预算棘轮和向后兼容边界。
3. docs/breakdowns/2026-08-23-codegraph-target-domains-breakdown.md：V/G/R 子卡边界、真机清单与跨卡覆盖。

冻结口径补充：CheckBudgetRatchet 仍只探测上涨并返回 []Finding；新函数签名为下文 R 任务定义的 ApplyBudgetRatchet(rep *Report, cur, base *Target)。它只做内存装配，没有 I/O；CLI 不再查 note、不再 append、不再排序。

### 基线验收先跑结果

以下命令已在本计划出稿前于当前基线 f8fac90 实跑，后续每个实现 task 动手前必须按所属最小范围复核：

    $ cd graph && go run ./cmd/codegraph check --repo codegraph/testdata/repo
    {
     "fails": [],
     "warns": []
    }

    $ cd graph && go test ./codegraph ./cli -count=1
    ok  github.com/Xsxdot/charter/graph/codegraph  0.026s
    ok  github.com/Xsxdot/charter/graph/cli        0.190s

    $ cd graph && go build ./...
    (exit 0, no output)

    $ cd graph && go vet ./...
    (exit 0, no output)

    $ cd graph && gofmt -l .
    (exit 0, no output)

    $ git merge-base HEAD master
    31bf88b788007ab78f56960b3b107e8e6a01e401

    $ git rev-parse --show-prefix
    (empty line; current checkout is repository root)

现状签名和行为锚点：

| 接口或行为 | 当前出处 | 本计划约束 |
|---|---|---|
| TargetDomain、TargetSubsystem 字段 | graph/codegraph/target.go:22-41 | 字段名、类型、JSON tag 不改；Ticket 0 已落字段只补校验 |
| func ValidateTarget(t *Target) []string | graph/codegraph/target.go:105-139 | 签名不改；只读 target，不读 baseline/View/文件系统 |
| func Check(t *Target, v *View) *Report | graph/codegraph/check.go:36-38 | 签名不改；deleted 节点不进入 gap 文件集 |
| viewFiles(v *View) []string | graph/codegraph/fitness.go:167-180 | 复用唯一、非 deleted、字典序文件集 |
| func CheckBudgetRatchet(cur, base *Target) []Finding | graph/codegraph/fitness.go:37-72 | 仍只产上涨 finding；不读取 note、不判档 |
| CLI check 顺序 | graph/cli/cli.go:218-240 | 保留 Load→Validate→View→Check→基准读取→输出→退出码；装配发生在输出前 |
| sortFindings | graph/codegraph/check.go:237-269 | 所有 finding 进入 Report 后统一调用；装配函数调用它 |

依赖事实已查证：graph/go.mod:1-9 仅允许 Go 标准库与 cobra；LoadTarget 用 encoding/json.Unmarshal（target.go:83-89），标准库未知键行为见 /usr/local/go/src/encoding/json/encode.go:36-40；omitempty 零值行为见同文件 100-110；slices.SortFunc 的比较器约束见 /usr/local/go/src/slices/sort.go:24-32。本刀不增加第三方依赖、网络端点、读限或超时路径。

## 2. Task V：目标模型结构门

### 文件集

仅改：

- graph/codegraph/target.go
- graph/codegraph/target_test.go

### Interfaces

- Consumes：TargetSubsystem.Domains []TargetDomain、TargetSubsystem.UnplacedBudget int、TargetDomain{ID string, Name string, Responsibility string, Paths []string}；validPathRule(rule string) bool。
- Produces：func ValidateTarget(t *Target) []string；不新增导出符号，不改变 func LoadTarget(repoRoot string) (*Target, error)。
- JSON boundary：encoding/json.Marshal / encoding/json.Unmarshal 经过 Target；键名保持 domains、unplacedBudget、unplacedBudgetNote 与 id、name、responsibility、paths。

### 实施步骤

1. 基线复核：执行 cd graph && go test ./codegraph -run 'TestTargetDomainJSONGolden|TestValidateTarget|TestLoadTarget' -count=1，预期现有测试 PASS；这确认 Ticket 0 字段与版本门在动手前可用。
2. 在 target_test.go 追加完整测试 TestValidateTargetDomainRules 与 TestTargetDomainJSONPresenceAndZeroRoundTrip，先运行 cd graph && go test ./codegraph -run 'TestValidateTargetDomainRules|TestTargetDomainJSONPresenceAndZeroRoundTrip' -count=1。基线应因缺少结构校验而失败，失败原因必须是断言缺少目标领域 issue，而不是编译错误。
3. 测试代码必须逐条锁住：target 全局重复 id、空白 responsibility、非法 wildcard、父子 paths 不覆盖、同级重叠、跨子系统重叠不误报、负预算、合法精确/前缀路径；JSON 测试用 map[string]json.RawMessage 断言显式 0/[] 与字段缺失的 wire presence，再用 Target 回读并断言 nil slice 与 omitempty。
4. 以最小实现补入 target.go。TargetDomain 和 TargetSubsystem 字段保持 Ticket 0 不动；在 ValidateTarget 子系统循环中增加预算、目标域全局 id、责任、路径语法、父子集和同级重叠检查。路径关系只使用以下完整 helper：

    // targetPathCovers 判断 parent 的精确路径/dir/** 集合是否覆盖 child。
    func targetPathCovers(parent, child string) bool {
        parentPrefix, parentIsPrefix := strings.CutSuffix(parent, "/**")
        childPrefix, childIsPrefix := strings.CutSuffix(child, "/**")
        if !parentIsPrefix {
            return !childIsPrefix && parent == child
        }
        if childIsPrefix {
            return childPrefix == parentPrefix || strings.HasPrefix(childPrefix, parentPrefix+"/")
        }
        return strings.HasPrefix(child, parentPrefix+"/")
    }

    // targetPathsOverlap 判断两条已通过语法校验的规则是否拥有共同文件。
    func targetPathsOverlap(left, right string) bool {
        if left == right {
            return true
        }
        leftPrefix, leftIsPrefix := strings.CutSuffix(left, "/**")
        rightPrefix, rightIsPrefix := strings.CutSuffix(right, "/**")
        if !leftIsPrefix && !rightIsPrefix {
            return false
        }
        if !leftIsPrefix {
            return strings.HasPrefix(left, rightPrefix+"/")
        }
        if !rightIsPrefix {
            return strings.HasPrefix(right, leftPrefix+"/")
        }
        return leftPrefix == rightPrefix ||
            strings.HasPrefix(leftPrefix, rightPrefix+"/") ||
            strings.HasPrefix(rightPrefix, leftPrefix+"/")
    }

5. ValidateTarget 新增 issue 必须使用子系统、目标域和规则定位。具体循环顺序：保留现有 subsystem/type/path 检查；检查 UnplacedBudget；检查目标域全局 id、TrimSpace 后的 responsibility、每条合法 domain path 是否被任一合法父 path 覆盖；最后对同一 subsystem 内 domain pair 的合法规则做 targetPathsOverlap。非法规则只报语法 issue，不重复报覆盖 issue。
6. 跑绿：cd graph && go test ./codegraph -run 'TestTargetDomainJSONGolden|TestValidateTargetDomainRules|TestTargetDomainJSONPresenceAndZeroRoundTrip|TestValidateTarget' -count=1；随后跑 go test ./codegraph ./cli -count=1。
7. 注释与可观测性：保留 target.go 文件头职责/边界；为两个路径 helper 写清它们只处理两种字面规则的原因；每条新增 issue 都带 subsystem/domain/rule 定位。不得引入 print 或 logger，结构门返回字符串就是本包的可观测输出。

### V 验收

- 字段 JSON 金样本与显式 wire presence/zero roundtrip 测试 PASS；meta.version != 2 的原拒载文案保持 PASS。
- 目标域 id 全局唯一、责任非空、非法规则、父子集、同级重叠、负预算六族均各有能变红的测试；跨子系统重叠不被本 task 误报。
- ValidateTarget 和 LoadTarget 签名逐字不变；go test ./codegraph ./cli -count=1 PASS。
- 缺失/空 domains 不在 ValidateTarget 中被当成错误；它只在 G 中决定是否启用执法。

## 3. Task G：Check gap 判据

### 文件集

仅改：

- graph/codegraph/gap.go（新文件，gap 纯函数与文件规则匹配）
- graph/codegraph/check.go（接入 gap，并保持最终排序）
- graph/codegraph/check_test.go

### Interfaces

- Consumes：func Check(t *Target, v *View) *Report、func viewFiles(v *View) []string、TargetSubsystem.Domains []TargetDomain、Target.SubsystemOf(file string) string。
- Produces：KindUnplaced、KindUnplacedOverBudget、KindDomainEmpty 进入既有 Report.Fails / Report.Warns；不增 Report 顶层字段，不增 gap 子命令。
- JSON boundary：Finding{Kind, From, To, Detail} 经既有 Report JSON 编码；To 对 gap finding 保持省略。

### 实施步骤

1. 基线复核：执行 cd graph && go test ./codegraph -run 'TestCheck|TestSortFindingsIsTotalOrder' -count=1 与 go run ./cmd/codegraph check --repo codegraph/testdata/repo；预期现有测试 PASS、fixture fails 与 warns 为空。
2. 在 check_test.go 写失败测试，逐条覆盖预算内 unplaced、超预算、domain-empty、未声明 domains 跳过、deleted 排除、重复文件去重、图外排除、其他子系统排除、按子系统聚合、真实 Merge 后路径迁移使 n 下降，以及 Report JSON marshal/unmarshal。先运行对应 -run，红因必须是 gap kind 尚未接入。
3. gap.go 使用以下完整实现。样例固定为字典序前 5 个文件，保证现场和重复 CLI 输出可 diff：

    // 本文件实现目标领域迁移 gap 判据。
    //
    // 职责：从非 deleted View 文件集计算目标领域未落位与空领域 finding。
    // 边界：只读 Target/View，不访问文件系统、不写 target、不判预算棘轮档位。
    package codegraph

    import (
        "fmt"
        "strings"
    )

    const targetGapSampleLimit = 5

    func targetDomainFindings(t *Target, v *View) (fails, warns []Finding) {
        files := viewFiles(v)
        for _, subsystem := range t.Subsystems {
            if len(subsystem.Domains) == 0 {
                continue
            }
            var unplaced []string
            for _, file := range files {
                if t.SubsystemOf(file) != subsystem.ID {
                    continue
                }
                placed := false
                for _, domain := range subsystem.Domains {
                    for _, rule := range domain.Paths {
                        if targetRuleMatchesFile(file, rule) {
                            placed = true
                            break
                        }
                    }
                    if placed {
                        break
                    }
                }
                if !placed {
                    unplaced = append(unplaced, file)
                }
            }
            if len(unplaced) > 0 {
                kind := KindUnplaced
                if len(unplaced) > subsystem.UnplacedBudget {
                    kind = KindUnplacedOverBudget
                }
                sampleEnd := targetGapSampleLimit
                if len(unplaced) < sampleEnd {
                    sampleEnd = len(unplaced)
                }
                finding := Finding{
                    Kind: kind,
                    From: subsystem.ID,
                    Detail: fmt.Sprintf("子系统 %s 未落位 %d/%d 个图内文件，样例（字典序前 %d）: %s",
                        subsystem.ID, len(unplaced), subsystem.UnplacedBudget,
                        sampleEnd, strings.Join(unplaced[:sampleEnd], ", ")),
                }
                if kind == KindUnplacedOverBudget {
                    fails = append(fails, finding)
                } else {
                    warns = append(warns, finding)
                }
            }
            for _, domain := range subsystem.Domains {
                hit := false
                for _, file := range files {
                    for _, rule := range domain.Paths {
                        if targetRuleMatchesFile(file, rule) {
                            hit = true
                            break
                        }
                    }
                    if hit {
                        break
                    }
                }
                if !hit {
                    warns = append(warns, Finding{
                        Kind: KindDomainEmpty,
                        From: subsystem.ID,
                        Detail: fmt.Sprintf("目标领域 %s 的 paths 在当前视图没有命中非 deleted 节点文件", domain.ID),
                    })
                }
            }
        }
        return fails, warns
    }

    func targetRuleMatchesFile(file, rule string) bool {
        if file == rule {
            return true
        }
        prefix, ok := strings.CutSuffix(rule, "/**")
        return ok && strings.HasPrefix(file, prefix+"/")
    }

4. 在 Check 的 assembly/dead-assembly 收集之后、fitness findings 之前接入以下完整片段；替换原 Check 末尾同位置的 fitness/排序段：

    gapFails, gapWarns := targetDomainFindings(t, v)
    rep.Fails = append(rep.Fails, gapFails...)
    rep.Warns = append(rep.Warns, gapWarns...)

    rep.Warns = append(rep.Warns, prefixFamilyFindings(v)...)
    rep.Warns = append(rep.Warns, oversizedPackageFindings(v)...)
    sortFindings(rep)
    return rep

5. 测试辅助必须复用 graph/codegraph/check_test.go 的 mkView 与已有 hasFinding；目标 fixture 至少包含 app/** 子系统、app/api/** 与 app/worker/** 两个目标域、other/** 子系统、图外文件、deleted 节点和重复文件。真实 diff 测试用 loadFixture、Merge、NodesModified，把 svc/server.go 改到 svc/api/server.go，断言 unplaced 从 3/99 降到 2/99。
6. 跑绿：cd graph && go test ./codegraph -run 'TestCheckTargetDomain|TestCheck|TestSortFindingsIsTotalOrder' -count=1；再跑 go test ./codegraph ./cli -count=1。fixture target 未声明 domains，输出仍为 fails=[]、warns=[]。
7. 注释与可观测性：gap.go 文件头写职责/边界；targetDomainFindings 写清按子系统聚合与未声明 domains 跳过的原因；每条 Detail 带数量、预算、稳定样例或目标域 id；不得 print、不得读磁盘。

### G 验收

- unplaced 预算内只进 Warns；unplaced-over-budget 严格超预算只进 Fails；domain-empty 每个零命中目标域一条 Warn。
- 文件集合只取非 deleted 节点文件并去重；图外文件、其他子系统文件、已命中目标域文件都不计入 unplaced。
- 大包只产生一条子系统 finding；样例按仓内 / 路径字典序稳定。
- Merge 后 View 的真实路径变更能使 unplaced 数下降；Report JSON 真实 marshal/unmarshal 后新 kind、From/To、Detail 完整保留。
- 所有 findings 在 Check 返回前统一排序；Check 签名逐字不变。

## 4. Task R：预算探测器装配、分档与 CLI 接线

### 文件集

仅改：

- graph/codegraph/fitness.go
- graph/codegraph/fitness_test.go
- graph/cli/cli.go
- graph/cli/cli_test.go

### Interfaces

- Consumes：func CheckBudgetRatchet(cur, base *Target) []Finding、Contract.LegacyBudgetNote string、TargetSubsystem.UnplacedBudget int / UnplacedBudgetNote string。
- Produces：func ApplyBudgetRatchet(rep *Report, cur, base *Target)；它是 codegraph 包内的无 I/O 装配 API，不改变 JSON wire 面；Report.Fails / Report.Warns 追加 KindBudgetRaised 后重新排序。
- CLI Consumes：func loadBudgetBase(repo, explicit string) (*codegraph.Target, error)。
- CLI Produces：无新增命令、无新增退出路径；check 仍以 len(rep.Fails) > 0 决定非零退出。

### 实施步骤

1. 基线复核：执行 cd graph && go test ./codegraph -run 'TestCheckBudgetRatchet' -count=1、go test ./cli -run 'TestGraphCheckBudgetRatchet|TestGraphCheckSkipsRatchet' -count=1 与 go build ./...。现有 contract ratchet 测试应 PASS；后续排序测试必须锁住“追加发生在排序之后”的旧缺陷。
2. 在 fitness_test.go 增加目标领域预算 2→3、base 缺席按 0、相等/下降不报、当前 note 非空/纯空白分档、unplaced-over-budget 隔离和所有 finding 重新排序的测试；先跑 -run，红因必须是探测器未比较目标预算或没有装配函数。
3. 在 fitness.go 保留 CheckBudgetRatchet 精确签名，并使用下面完整实现。合约预算按 cur.Contracts 顺序比较；声明 domains 的子系统按 cur.Subsystems 顺序比较；base 缺席或没有目标域声明按 0。

    type ratchetBudget struct {
        value int
        declared bool
    }

    func CheckBudgetRatchet(cur, base *Target) []Finding {
        if base == nil {
            return nil
        }
        baseContracts := make(map[string]int, len(base.Contracts))
        for _, contract := range base.Contracts {
            baseContracts[contract.From+"->"+contract.To] = contract.LegacyBudget
        }
        baseSubsystems := make(map[string]ratchetBudget, len(base.Subsystems))
        for _, subsystem := range base.Subsystems {
            if len(subsystem.Domains) > 0 {
                baseSubsystems[subsystem.ID] = ratchetBudget{value: subsystem.UnplacedBudget, declared: true}
            }
        }
        var findings []Finding
        for _, contract := range cur.Contracts {
            key := contract.From + "->" + contract.To
            old, exists := baseContracts[key]
            if !exists {
                old = 0
            }
            if contract.LegacyBudget <= old {
                continue
            }
            detail := fmt.Sprintf("契约 %s 新增契约携带存量预算 %d（基准中缺席，按预算 0 处理）", contract.From+"→"+contract.To, contract.LegacyBudget)
            if exists {
                detail = fmt.Sprintf("契约 %s 预算 %d→%d 上涨", contract.From+"→"+contract.To, old, contract.LegacyBudget)
            }
            findings = append(findings, Finding{Kind: KindBudgetRaised, From: contract.From, To: contract.To, Detail: detail})
        }
        for _, subsystem := range cur.Subsystems {
            if len(subsystem.Domains) == 0 {
                continue
            }
            old, exists := baseSubsystems[subsystem.ID]
            if !exists {
                old = ratchetBudget{value: 0}
            }
            if subsystem.UnplacedBudget <= old.value {
                continue
            }
            detail := fmt.Sprintf("子系统 %s 新增目标领域携带未落位预算 %d（基准中未声明目标领域，按预算 0 处理）", subsystem.ID, subsystem.UnplacedBudget)
            if old.declared {
                detail = fmt.Sprintf("子系统 %s 未落位预算 %d→%d 上涨", subsystem.ID, old.value, subsystem.UnplacedBudget)
            }
            findings = append(findings, Finding{Kind: KindBudgetRaised, From: subsystem.ID, Detail: detail})
        }
        return findings
    }

    func ApplyBudgetRatchet(rep *Report, cur, base *Target) {
        for _, finding := range CheckBudgetRatchet(cur, base) {
            note := budgetRatchetNote(cur, finding)
            if strings.TrimSpace(note) != "" {
                rep.Warns = append(rep.Warns, finding)
            } else {
                rep.Fails = append(rep.Fails, finding)
            }
        }
        sortFindings(rep)
    }

    func budgetRatchetNote(cur *Target, finding Finding) string {
        if finding.To == "" {
            for _, subsystem := range cur.Subsystems {
                if subsystem.ID == finding.From {
                    return subsystem.UnplacedBudgetNote
                }
            }
            return ""
        }
        for _, contract := range cur.Contracts {
            if contract.From == finding.From && contract.To == finding.To {
                return contract.LegacyBudgetNote
            }
        }
        return ""
    }

4. ApplyBudgetRatchet 的导出注释必须说明参数、当前 target note 来源、TrimSpace、unplaced-over-budget 永远不降档以及最终 sortFindings；函数只操作内存。CheckBudgetRatchet 的注释必须说明 base 缺席按 0 与探测器不判档的原因。
5. 在 cli.go#graphCheckCmd 保留 loadBudgetBase 与 stderr 降级，替换旧 appendBudgetRatchet：

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

    删除 cli.go 中旧 appendBudgetRatchet；CLI 不再查 note、不再 TrimSpace、不再 append、不再排序。loadBudgetBase 的 v1 宽松解析、默认分支顺序、git show 前缀和 stderr 原因保持现有实现。
6. cli_test.go 必须用既有 runGraphSeparate、copyFixtureRepo、runGit，真实创建 git 仓并走 git show。新增断言逐条列全：contract 预算 2→3 无 note 进 Fails；非空 note 进 Warns；纯空白 note 进 Fails；schema v1 基准照常比较；目标领域预算 2→3 的 finding From 为 d_svc 且 To 为空；目标领域 note 只降 budget-raised；同一报告的 unplaced-over-budget 仍在 Fails；--repo 指向 git 顶层子目录时 show 读取 nested/codegraph/target.json；非 git 仓 stderr 含“棘轮”和“跳过”，stdout 可 json.Unmarshal。
7. 测试辅助的完整形态：从 fixture target 用 json.Unmarshal 读成 codegraph.Target，修改 d_svc.UnplacedBudget、UnplacedBudgetNote 和 Domains 为一条合法 svc/** 目标域，json.MarshalIndent 写回；用 git init/config/add/commit 造 base，再修改当前 target。nested case 在 top/nested 复制 fixture、在 top 初始化 git、--repo 传 nested，断言 budget-raised 存在。
8. 跑绿：cd graph && go test ./codegraph ./cli -run 'Test.*(BudgetRatchet|CheckTargetDomain|Sort)' -count=1；再跑 go test ./codegraph ./cli -count=1、go build ./...、go vet ./...、gofmt -l .。
9. CLI 降级路径不新增退出码：基准读取失败只写 stderr，仍打印 Check 报告；JSON 解析失败、git show 失败和默认分支缺失均带 revision/path/分支原因。不得在 codegraph 包引入 os/exec、git 或文件读取。

### R 验收

- 冻结签名 CheckBudgetRatchet(cur, base *Target) []Finding 逐字不变；contract 与目标领域预算都按 current > base 检测，相等/下降不报，base 缺席按 0。
- ApplyBudgetRatchet 是唯一分档/append/sort 位置：非空 TrimSpace note 的 budget-raised 进 Warns，空白进 Fails；目标领域 finding From=subsystem id、To 省略；契约 finding 继续使用 From/To。
- unplaced-over-budget 无论 note 如何都在 Fails；不得与 budget-raised 共用降档分支。
- CLI 无 note 查找、append、排序代码；真实 git show、schema v1 基准、非 git 降级、stdout JSON 零污染和 nested prefix 测试 PASS。
- 同一报告所有 findings（包括 budget-raised）最后统一排序，重复 CLI 运行字节稳定；退出码只由已有 len(rep.Fails)>0 判断。

## 5. Task H：handoff 第一案例（协调者执行，不派发）

这是边界型 task，不在当前 charter 工作树实现，也不由本 executor 调用 handoff CLI。协调者必须在真实 handoff checkout 中完成以下两个文件的用户批准数据落盘：

- codegraph/target.json
- docs/codegraph-scan-recipe.md

### Interfaces

- Consumes：charter 已冻结的 TargetSubsystem.Domains wire 结构与 KindUnplaced / KindUnplacedOverBudget / KindDomainEmpty 报告语义；用户批准的 d_controlplane、d_cli 目标域职责和路径数据。
- Produces：handoff target.json 仅让 d_controlplane、d_cli 声明 domains；扫描配方明确 subsystems[].domains[] 是人/AI 出稿并经用户拍板的 target 数据，不是扫描器产物。
- Boundary owner：协调者；本 task 的验收命令不得派给 executor，也不得用 charter fixture 代替。

### 协调者动作与真机验收

协调者在 handoff 真仓执行，不把未批准的职责/路径填进 charter 计划：

    codegraph validate --repo HANDOFF_CHECKOUT
    jq -e '[.subsystems[] | select((.domains // []) | length > 0) | .id] | sort == ["d_cli","d_controlplane"]' HANDOFF_CHECKOUT/codegraph/target.json
    rg -n 'domains.*扫描产出物|domains.*不是扫描' HANDOFF_CHECKOUT/docs/codegraph-scan-recipe.md
    codegraph check --repo HANDOFF_CHECKOUT

HANDOFF_CHECKOUT 是协调者现场实际 checkout 的命令参数，不是 charter 仓要创建的文件或数据；当前仓没有该目录，且 contract §6 明确禁止伪造它。协调者必须记录：

1. meta.version == 2，只有两个指定子系统声明 domains，其余子系统仍跳过目标执法；
2. 每个目标域 responsibility 非空，paths 被父子系统覆盖，同级不重叠，预算非负；
3. 真实 check 的四类 kind、From/To、Detail、Fails/Warns 与人工目录清单逐项一致；
4. 故意把一个文件移出目标路径时 unplaced 增长，移回时下降；实际 over-budget 即使有 note 仍为 fail；
5. 真实扫描流程不生成、不改写 domains 段；重复 check 三次输出字节一致，stdout 为 JSON，stderr 仅承载可行动的基准跳过提示。

## 6. 四项计划自审

### 6.1 缺陷族对抗审查

| 缺陷族 | V 结构门 | G gap | R 棘轮/CLI | H 边界 |
|---|---|---|---|---|
| 生命周期/状态机中断 | 无进程、工单、临时目录；内存校验中断不留资源 | 纯函数只读 View；宿主重启不产生资源 | git 子进程由 CLI 等待并回收；无临时 target 写入 | 协调者按 handoff 状态机确认无孤儿 executor/临时目录 |
| 静默失败/误导报错 | 非法目标图返回带 subsystem/domain/path 的 issue；版本门文案不变 | 未声明 domains 与 n=0 明确区分；finding Detail 带数量/预算/样例 | 基准失败 stderr 明示跳过且 stdout 仍是 JSON；宽松 v1 只投影 Contracts | 缺 target、paths 越界、扫描改写必须显式失败，零 finding 不等于完成 |
| 跨平台假设 | 只按仓内 / 字符串，禁止 filepath 做归域 | viewFiles 与 strings.CutSuffix 只处理 wire 路径，不读宿主文件系统 | git 参数用 exec.Command 参数数组；nested prefix 有真实测试 | 协调者在指定非 Linux/不同 checkout 环境复跑路径和 JSON |
| 假红/假绿测试 | 反面覆盖跨子系统重叠、缺失/显式零值、非法规则 | 覆盖 deleted、重复节点、图外、其他子系统、聚合、Merge 下降和 JSON 边界 | 覆盖空白 note、实际 over-budget 隔离、schema v1、nested git show、stdout/stderr/退出码和排序 | 静态 JSON 不代替真仓 check；做移出/移回反例和三次字节比较 |
| 门禁绕过 | ValidateTarget 是 Check 前置门；不读新来源 | gap 只有 Check 入口产生，CLI 不另造命令；无写路径 | 分档只有 ApplyBudgetRatchet；note 不能降实际 over-budget | 扫描器只读 domains；预算提升无 note fail、有 note 只降棘轮 warn |
| 序列化边界 | TargetDomain 与子系统新字段真实 JSON presence/zero roundtrip | Finding/Report marshal→unmarshal 锁三种新 kind、From/To/Detail | target.json→LoadTarget、git show v1 Contracts 投影、Report JSON 端到端测试 | handoff target、扫描配方文本、checker 真实链路各验证一次 |
| 枚举新值过既有白名单 | 本 task 不新增 finding kind | 三种 kind 经 Check、Report JSON；搜索既有 kind switch | budget-raised 复用旧值；CLI 不按白名单过滤 gap kind | 查看器/扫描器/校验器现场确认不挡新 kind 或 logic/boundary |
| 承重安全属性 | 全局 id 唯一、父子集、同级隔离、非负预算各有能变红测试 | deleted 排除、文件去重、子系统隔离、聚合与预算档位各有反例 | 检测单调性、理由降档隔离、全序排序与签名保持各有测试 | 目标唯一归属、扫描器只读、真实 gap 下降和棘轮行为有现场断言 |

### 6.2 序列化边界清单

| 边界 | 手写/投影位置 | 必须通过的回归 |
|---|---|---|
| target 结构→JSON | graph/codegraph/target.go 的声明 tag；target_test.go | TestTargetDomainJSONGolden 与显式 presence/zero 测试 |
| target JSON→当前 target | LoadTarget（target.go:77-90） | 旧 target 缺 domains 可加载；schema v2 新字段回读；schema v1 仍由 LoadTarget 拒载 |
| View→gap finding | gap.go#targetDomainFindings | Merge 迁移下降测试和 Report JSON 测试 |
| Report→CLI stdout | graphPrintJSON（cli.go） | CLI target budget/over-budget 测试先 json.Unmarshal stdout，再检查 kind/档位 |
| git show 基准→Contracts | cli.go#loadBudgetBase | schema v1 基准和 nested prefix 真实 git 仓测试；宽松解析只取 Contracts |
| handoff target→扫描配方/check | handoff codegraph/target.json、docs/codegraph-scan-recipe.md | 协调者真机 validate、扫描不改 domains、check 与人工文件清单核对 |

明确区分：wire 输入的显式 unplacedBudget:0 与字段缺失由 map[string]json.RawMessage 断言 presence；Go 结构语义两者均为 0，符合 omitempty 冻结设计；显式 domains:[] 与缺失由 nil slice 断言区分，序列化后两者均省略。

### 6.3 上下文预算与类型标注

| Task | 有界文件集 | 类型 |
|---|---|---|
| V | 2 个 Go 文件 | S1 逻辑型 |
| G | 1 个新 gap 文件 + 2 个既有 Go 文件 | S1 逻辑型 |
| R | 4 个 Go 文件 | S1 逻辑型 |
| H | handoff target 与扫描配方两个文件 | S2 边界型，协调者执行 |

每个逻辑 task 的生产代码只在 graph/codegraph 或 graph/cli 内，未把查看器、扫描器、业务代码带入同一上下文；H 的跨仓行为不以 charter 夹具冒充。

## 7. Spec / contract 覆盖与跨卡审计门

### 用户故事归属

| Spec 故事 | 具体归属 |
|---|---|
| 1 在 target 子系统下冻结目标领域树 | V 锁结构；H 写批准后的两棵真实树 |
| 2 check 显示未落位与空目标域 | G 的三类 finding 与 Report JSON |
| 3 搬文件使 unplaced 自动下降 | G 的真实 Merge 视图回归与 H 真机移出/移回 |
| 4 提高 unplacedBudget 触发棘轮 | R 的探测、当前 note 分档与空白 note 测试 |
| 5 handoff 控制面/CLI 第一案例 | H，协调者真仓动作，不由 charter 伪造 |
| 6 查看器消费目标/现状对照数据 | G/R 保持既有 Report JSON wire；查看器接入不在本卡 |

### 冻结项归属

- contract §4 冻结 1-15、37：V；
- contract §4 冻结 9、16-25：G；
- contract §4 冻结 26-35：R；冻结 32 的 over-budget 隔离由 G/R 交叉测试锁定；
- contract §4 冻结 36 与 §6：H；
- contract §3-4 的库行为、§5 拍板记录：所有逻辑 task 的代码块与验收共同遵守。

### 跨卡审计

本 plan 不驱动派发系统。协调者在派发 implement 前必须用独立上下文逐条复核：

1. V 的 TargetDomain/TargetSubsystem 字段与 contract §2-1 原文逐字符一致；
2. G 的 Check(t *Target, v *View) *Report、三个 kind、From/To 形状与 R 的 ApplyBudgetRatchet(rep *Report, cur, base *Target) 消费/生产逐字一致；
3. H 的用户故事 5 有明确协调者归属，不能把缺失的 handoff 批准数据误派给 charter executor；
4. 真机清单中的驱动 handoff/扫描流程全部标注协调者执行，不派发。

## 8. 占位符扫描与收尾

本计划中的生产实现代码块均给出完整函数；没有以模糊错误处理、邻 task 引用或未定义字段代替实现代码。测试使用既有 harness 的形态差异，采用计划规则允许的 harness 例外：V 复用 graph/codegraph/target_test.go 的 json/strings 测试导入，G 复用 graph/codegraph/check_test.go#mkView、#loadFixture、#hasFinding，R 复用 graph/cli/cli_test.go#runGraphSeparate、#copyFixtureRepo、#runGit；各 task 的断言已逐条列全。

测试例外的逐条 pass/fail 清单：V 必须分别断言全局 id 重复、空白责任、非法 wildcard、父子集失败、同级重叠失败、跨子系统重叠不报、负预算失败、合法精确/前缀规则通过，以及显式 zero/empty 与字段缺失的 JSON presence 和回读差异；G 必须分别断言预算内 warn、超预算 fail、每个空域 warn、未声明跳过、deleted 排除、重复文件去重、图外/其他子系统排除、单子系统聚合、Merge 后 3/99→2/99、Report JSON 可回读；R 必须分别断言 contract 无理由 fail、非空 note warn、纯空白 note fail、schema v1 基准参与、目标领域 From/To 形状、目标 note 只降 budget-raised、unplaced-over-budget 仍 fail、nested git show、非 git stderr/stdout 隔离和最终排序。每条都必须先在缺实现基线变红，再在最小实现后变绿。

实现节点按 V、G、R 各自先红后绿、每 task 一个提交；实现节点收尾最小命令为：

    cd graph && go test ./codegraph ./cli -count=1
    cd graph && go build ./... && go vet ./...
    cd graph && test -z "$(gofmt -l .)"

整分支终审再运行 cd graph && go test ./... -count=1；handoff 真机清单只由协调者执行。当前 plan 节点只提交本计划文件，不实现代码、不创建 handoff 数据。
