// domainpage —— C1.10 领域页派生器的 Ticket 0 契约骨架。
//
// 纯函数层：不请求网络、不访问 DOM、不在组件内聚合。
// implement 阶段填充语义/结构派生；本文件当前只锁类型、签名与四个阈值。
import type {
  CgBest,
  CgDomainDecl,
  CgDomainDecls,
  CgGraph,
  CgNode,
} from '../../api/types'

export type DomainOrganization = 'best' | 'current'

export const DOMAIN_CASCADE_DEPTH = 3
export const DOMAIN_FOCUS_QUOTA = 5
export const DOMAIN_LEVEL_NODE_LIMIT = 8
export const DOMAIN_SHARED_CALLER_DOMAINS = 3

export interface DomainPageInput {
  baseline: CgGraph
  best?: CgBest
  decls?: CgDomainDecls
  organization: DomainOrganization
  domainId: string
}

export interface EmptyStates {
  noDeclaration: boolean
  noInvariants: boolean
  noEntities: boolean
  noInboundSeams: boolean
}

export interface EntityReadout {
  id: string
  node: CgNode
  creators: string[]
  writers: Array<{ id: string; field?: string }>
}

export interface PackageReadout {
  dir: string
  summary: string
}

export interface SemanticViewModel {
  domainId: string
  label: string
  declaration?: CgDomainDecl
  declaredDomainCount: number
  totalDomainCount: number
  entities: EntityReadout[]
  packages: PackageReadout[]
  empty: EmptyStates
}

export interface DomainPort {
  domainId: string
  label: string
  edgeCount: number
}

export interface FocusTruncation {
  total: number
  shown: number
  reason: 'focus-quota'
}

export interface CascadeNode {
  id: string
  depth: number
  name: string
  summary?: string
  collapsed: boolean
  collapseReason?: 'shared-by-domains'
}

export interface CascadeColumn {
  depth: number
  nodes: CascadeNode[]
  droppedNodes: number
  truncated: boolean
  depthLimit: boolean
}

export interface DomainLane {
  key: string
  fromDomainId: string
  focusNodeId: string
  columns: CascadeColumn[]
}

export interface StructureViewModel {
  domainId: string
  inboundPorts: DomainPort[]
  lanes: DomainLane[]
  outboundPorts: DomainPort[]
  inboundEdgeCount: number
  focusTruncation?: FocusTruncation
  noInboundSeams: boolean
}

export interface DomainPageModel {
  organization: DomainOrganization
  organizationAvailable: boolean
  semantic: SemanticViewModel
  structure: StructureViewModel
}

/** C1.10 主缝：由组件层调用，纯函数输出语义 tab 与结构 tab 模型。 */
export function deriveDomainPage(_input: DomainPageInput): DomainPageModel {
  throw new Error('C1.10 domain page derivation is not implemented')
}
