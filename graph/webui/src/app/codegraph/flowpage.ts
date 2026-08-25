// flowpage —— C12 行为轴视图模型派生器（缝 2）的 Ticket 0 签名壳。
//
// 入口归属、入口清单与流程图共用本派生器；一条程序入口一张流程图。
// baseline.flows 缺该入口时必须显式降级（degraded），不拿机械可达序列冒充流程图。
//
// Ticket 0 只落签名与降级判定位；内部模型形状归 plan 细化（c12-contract §2.4），
// 模块路径与入口函数名不可变。
import type { CgGraph } from '../../api/types'

export interface FlowPageInput {
  baseline: CgGraph
  entryNodeId: string
}

export interface FlowPageModel {
  entryNodeId: string
  /** true = 该入口在 baseline.flows 中无流程数据，界面按空态/降级形态渲染。 */
  degraded: boolean
  /** Ticket 0 直通标记：plan 落地派生行为后移除。 */
  passthrough: true
}

export function deriveFlowPage(input: FlowPageInput): FlowPageModel {
  return {
    entryNodeId: input.entryNodeId,
    degraded: input.baseline.flows?.[input.entryNodeId] === undefined,
    passthrough: true,
  }
}
