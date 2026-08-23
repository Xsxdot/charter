// 本文件实现目标领域迁移 gap 判据。
//
// 职责：从非 deleted View 文件集计算目标领域未落位与空领域 finding。
// 边界：只读 Target/View，不访问文件系统、不写 target、不判预算棘轮档位。
package codegraph

import (
	"fmt"
	"strings"
)

// targetGapSampleLimit 是 unplaced Detail 里带的样例文件条数上限。
// 取固定条数而不是全量，是因为迁移首轮一个大包可能有几十个未落位文件；
// 全量会把 check 输出刷成不可读，也让重复运行的 diff 失去意义（契约 §2-2）。
const targetGapSampleLimit = 5

// targetDomainFindings 计算目标领域 gap：每个声明了 domains 的子系统最多一条
// unplaced / unplaced-over-budget，外加每个零命中目标域一条 domain-empty。
//
// 按子系统聚合而不是逐文件出 finding，是拍板记录三定的：迁移首轮 61 个未落位
// 文件不该变成 61 条红线，否则判据首轮就不可用（契约 §5 三）。
// 未声明 domains 的子系统整体跳过——目标领域执法是自愿加入的，缺 domains 表示
// 「这个子系统还没做竖切规划」，不是「它违规了」（契约 §3-1 第 1 条）。
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
					Kind:   KindDomainEmpty,
					From:   subsystem.ID,
					Detail: fmt.Sprintf("目标领域 %s 的 paths 在当前视图没有命中非 deleted 节点文件", domain.ID),
				})
			}
		}
	}
	return fails, warns
}

// targetRuleMatchesFile 判断一个文件是否落在一条归域规则内：精确路径相等，或者
// 文件在 dir/** 的目录子树里。
//
// 它与 target.go 的 SubsystemOf、targetPathCovers、targetPathsOverlap 是**同一套
// 字面约定下语义不同的四个判定**——分别是「文件对规则」「文件归哪个子系统」「父规则
// 是否覆盖子规则」「两条规则是否相交」。它们共享的只有 cutTargetRule 那一层后缀解析，
// **不共享判定逻辑**；合并成一个函数会得到一个四不像。
//
// 不引 glob 库是拍板记录二的直接后果——目标域归属只按路径规则，第二套匹配语义
// 会让目标图与代码位置分叉。dir/** 按「目录整段」匹配而非字符串前缀：拼回分隔符
// 才能保证 internal/task/** 不会把 internal/taskrunner/ 一起吞掉。
func targetRuleMatchesFile(file, rule string) bool {
	if file == rule {
		return true
	}
	prefix, ok := cutTargetRule(rule)
	return ok && strings.HasPrefix(file, prefix+"/")
}
