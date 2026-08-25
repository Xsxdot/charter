// C12 重档法定直通竖切：一次真实调用穿过骨架空壳，返回写死但接线真实的结果。
// 断言钉在 spec 测试决定声明的主缝上（缝 1 结构轴 / 缝 2 行为轴）：
// docs/specs/2026-08-25-codegraph-viewer-two-axis-spec.md「测试决定（接缝清单）」。
// 缝 1 已由 scopepage.test.ts 正式断言取代（C12.2）；剩余缝 2 用例待 K3 正式化后整文件退役（K6）。
import { describe, expect, it } from 'vitest'
import type { CgGraph } from '../../api/types'
import { deriveFlowPage } from './flowpage'

const baseline: CgGraph = {
  meta: { project: 'ticket0', branch: 'cards/C12-charter', commit: '946ab79', scannedAt: '2026-08-26', generator: 'c12-ticket0' },
  containers: {},
  nodes: {},
  edges: [],
}

describe('C12 Ticket 0 直通竖切', () => {
  it('缝 2：flows 缺席该入口 → 显式降级', () => {
    const model = deriveFlowPage({ baseline, entryNodeId: 'n_entry' })
    expect(model.entryNodeId).toBe('n_entry')
    expect(model.degraded).toBe(true)
    expect(model.passthrough).toBe(true)
  })

  it('缝 2：flows 命中该入口 → 不降级', () => {
    const withFlows: CgGraph = {
      ...baseline,
      flows: { n_entry: { steps: [{ id: 's1', order: 1, kind: 'call', to: 'n_x', line: 10 }] } },
    }
    expect(deriveFlowPage({ baseline: withFlows, entryNodeId: 'n_entry' }).degraded).toBe(false)
  })
})
