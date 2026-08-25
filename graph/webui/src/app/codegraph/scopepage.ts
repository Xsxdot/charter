// scopepage —— C12 结构轴视图模型派生器（缝 1）的 Ticket 0 签名壳。
//
// 一个页面按 scope 变：scopeId 空 = 根层子系统连线图，否则为某个领域；递归同构，
// 每一层返回同一形状的模型，到容器为止（容器是原子节点）。纯函数层：不请求网络、
// 不访问 DOM、不在组件内聚合。
//
// Ticket 0 只落签名与直通占位模型；内部模型形状归 plan 细化（c12-contract §2.3），
// 模块路径与入口函数名不可变。
import type { CgBest, CgDomainDecls, CgGraph, CgTarget } from '../../api/types'

export type ScopeOrganization = 'best' | 'current'

export interface ScopePageInput {
  baseline: CgGraph
  best?: CgBest
  decls?: CgDomainDecls
  target?: CgTarget
  organization: ScopeOrganization
  scopeId: string | null
}

export interface ScopePageModel {
  scopeId: string | null
  /** Ticket 0 直通标记：plan 落地派生行为后移除。 */
  passthrough: true
}

export function deriveScopePage(input: ScopePageInput): ScopePageModel {
  return { scopeId: input.scopeId, passthrough: true }
}
