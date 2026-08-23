// 本文件实现最优图 best.json 的模型、加载与校验（契约
// docs/contracts/2026-08-23-codegraph-best-graph-contract.md §2、§3）。
//
// 职责：类型定义、LoadBest、ValidateBest、领域→子系统与容器→领域的归属决议。
// 边界：不做对照（check.go）；不写文件——best 是人写的应然结构，程序只读。
//
// 最优图与 baseline.json 是姊妹关系：baseline 记「代码今天是什么样」，best 记
// 「基于当下代码实现的功能，最优的子系统/领域结构应该是什么样」。归属由**容器**
// 表达而非路径规则——路径规则只能复述目录布局，表达不了不与目录同形的职责划分
//（契约 §1-2）。
package codegraph

// BestMeta 最优图的来源信息。
type BestMeta struct {
	Version int    `json:"version"`
	Project string `json:"project"`
}

// BestDomain 最优图里的一个领域。
//
// Parent 为空即顶层领域，**顶层领域就是子系统**——本图不设第二套分组概念，
// target.json 的 contracts[].from/to 引用的正是这些顶层领域 id（契约 §2-1）。
// Type 只对顶层领域有意义，取值 logic / boundary。
type BestDomain struct {
	Label          string `json:"label"`
	Responsibility string `json:"responsibility"`
	Parent         string `json:"parent,omitempty"`
	Type           string `json:"type,omitempty"`
}

// Best 是 codegraph/best.json 的顶层结构：应然结构。
//
// Containers 是容器 id → **叶子**领域 id 的归属表，是本图的正文。它由人编写、
// 不由扫描产出——这正是它能表达「这 3 个容器该去一个还不存在的领域」的原因。
type Best struct {
	Meta       BestMeta              `json:"meta"`
	Domains    map[string]BestDomain `json:"domains"`
	Containers map[string]string     `json:"containers"`
}

// LoadBest 读取 repoRoot/codegraph/best.json。
//
// 返回 (nil, nil) 表示文件不存在——最优图是自愿加入的，存量项目没有它。
// 解析失败与 meta.version 不匹配一律显式错误（反静默）。
//
// 注意：调用方拿到 nil 时**必须显式告知用户判据已跳过**，不得静默通过
//（契约 §3-1）。
func LoadBest(repoRoot string) (*Best, error) {
	// TODO(C1.8): 见契约 §3-1
	return nil, nil
}

// ValidateBest 校验最优图内部一致性，返回问题清单（空 = 合法）。
//
// 纯函数：不读 baseline、不读视图、不碰文件系统——「这个容器在当前代码里存不
// 存在」是 Check 的事（契约 §3-2）。
func ValidateBest(b *Best) []string {
	// TODO(C1.8): 见契约 §3-2 的八条
	return nil
}

// SubsystemOf 沿 Parent 链上溯到顶层领域，返回子系统 id。
// domainID 不存在、或 Parent 链成环时返回 ""。
//
// 环保护是必须的：ValidateBest 会拒环，但本函数不得假设调用方跑过 validate,
// 一个环会让上溯死循环（契约 §3-3）。
func (b *Best) SubsystemOf(domainID string) string {
	// TODO(C1.8): 见契约 §3-3
	return ""
}

// DomainOfContainer 返回容器的最优领域 id，未归属返回 ""。
func (b *Best) DomainOfContainer(containerID string) string {
	// TODO(C1.8): 见契约 §3-3
	return ""
}
