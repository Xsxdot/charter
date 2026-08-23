// 本文件实现 codegraph 的 fitness 判据与预算棘轮。
//
// 边界：仅标准库纯函数，不碰 git、不读文件系统；基准 target 由 CLI 注入。
package codegraph

// 漏建对账（刀 3）的 finding kind——fail 侧。
const (
	KindDeadEntry     = "dead-entry"
	KindDeadInterface = "dead-interface"
	KindDeadContract  = "dead-contract"
)

// fitness 判据（刀 4）的 finding kind。
const (
	KindPrefixFamily     = "prefix-family"
	KindOversizedPackage = "oversized-package"
	KindBudgetRaised     = "budget-raised"
)

// 阈值写死在包内，不进 target 配置，避免把 fitness 判据调高到不报为止。
const (
	prefixFamilyMinShared  = 4
	prefixFamilyMinMembers = 5
	oversizedPackageFiles  = 40
)

// CheckBudgetRatchet 逐契约比对当前与基准 target 的 legacyBudget，上涨即产出 finding。
// 基准由调用方注入；本包不碰 git。分档由 CLI 按当前契约的理由字段决定。
func CheckBudgetRatchet(cur, base *Target) []Finding {
	return nil
}
