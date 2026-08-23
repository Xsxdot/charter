// 本文件是刀 3+4 契约的 Ticket 0 骨架：漏建对账与 fitness 判据的类型与函数壳
// （契约 docs/contracts/2026-08-23-codegraph-reconcile-fitness-contract.md §1~§3）。
//
// 职责：新增 finding kind 常量、棘轮判据的纯函数入口。判定逻辑归 implement 阶段落地，
// 本文件只锁 wire 值与签名。
// 边界：与本包其余部分同约束——仅标准库、不碰 git、不读文件系统（棘轮的旧 target
// 由调用方注入，见契约 §3-1 的依赖方向不变式）。
package codegraph

// 漏建对账（刀 3）的 finding kind——fail 侧。
// 与既有 dead-rule / dead-assembly 同命名族（「声明了但图里没有」），
// 但判定档位是 fail 而非 warn：契约声明的东西没建成，与规则写错路径不是一回事。
const (
	KindDeadEntry     = "dead-entry"     // entries 声明的容器 label 在图中不存在
	KindDeadInterface = "dead-interface" // interfaces 声明的接口名在图中不存在
	KindDeadContract  = "dead-contract"  // 声明的契约方向零实际跨子系统边
)

// fitness 判据（刀 4）的 finding kind。
// 前两条是 warn——架构法第三条要求的是「必须回答」而非「必须拆」；
// 第三条是 fail，契约条目填了 LegacyBudgetNote 时降为 warn。
const (
	KindPrefixFamily     = "prefix-family"     // 同目录共享前缀家族达阈值
	KindOversizedPackage = "oversized-package" // 单包源文件达阈值且无子包
	KindBudgetRaised     = "budget-raised"     // legacyBudget 相对基准上涨
)

// fitness 判据阈值——写死不进配置（契约 §2-3 拍板记录：可调阈值最可能的用法是
// 「调高到不报为止」，反而弱化 fitness 函数）。
const (
	prefixFamilyMinShared  = 4  // 同目录内文件名共享前缀的最少字符数
	prefixFamilyMinMembers = 5  // 构成一个家族的最少源文件数
	oversizedPackageFiles  = 40 // 单包（目录）源文件数阈值
)

// CheckBudgetRatchet 逐契约比对 cur 与 base 的 legacyBudget，上涨即产出 finding。
//
// 参数：cur = 当前 target；base = 基准（主线）target，由调用方经 git 取出后注入——
// 本包不碰 git（契约 §3-1）。base 为 nil 表示基准不可得，返回 nil（调用方负责明示降级，
// 不得静默，见契约 §3-2）。
// 返回：上涨条目的 findings；Kind 恒为 KindBudgetRaised，是否属 fail 由调用方按
// 对应契约的 LegacyBudgetNote 是否非空分流（契约 §2-2）。
func CheckBudgetRatchet(cur, base *Target) []Finding {
	return nil // Ticket 0 空壳，实现归 implement
}
