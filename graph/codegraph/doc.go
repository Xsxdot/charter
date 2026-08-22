// Package codegraph 承载入库代码图的数据契约与查询算法：
// 图/视图/目标图的加载、合并、校验、检查、符号与实体查询、锚点决议、基线回灌。
//
// 边界（契约不变式，见 docs/contracts/2026-08-22-codegraph-extraction-contract.md §5）：
//   - 仅依赖 Go 标准库，零 CGO——本包必须能原样搬进任何工具；
//   - 一切输入都是本地文件（被扫描项目仓库内的 codegraph/*.json），不发网络请求、不依赖 agentd 存活；
//   - 不产出图数据：扫描由 AI executor 按配方完成，本包只读写既有 JSON。
//
// 本文件为搬迁卡（刀 0）的 Ticket 0 骨架，包实现随实现轮自 handoff internal/codegraph 原样迁入。
package codegraph
