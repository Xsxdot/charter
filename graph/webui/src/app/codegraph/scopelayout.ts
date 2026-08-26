// scopelayout —— 结构轴画布的确定性布局（K4 组件层消费的纯函数）。
//
// 职责：把 ScopePageModel 的拓扑事实（nodes/edges）变成每张卡的左上角坐标、
// 容器层的包群组框、域外引用卡外圈与孤立卡专行。
// 边界：纯函数、零随机数（Math.random / Date.now 禁用——同一份数据每次打开必须
// 长得一样，domainlayout 同一纪律）；不访问 DOM、零 console。视觉质量判据
// （空白最少、交叉最少）机内不可断言，归真机清单 1；本模块只保证确定性、
// 非重叠与分组归属这些可机检的性质。
import type { ScopeEdge, ScopeNode } from './scopepage'

const ITER = 240        // 力导向迭代次数：够收敛且毫秒级（domainlayout 同款）
const RX = 340          // 椭圆斥力横向半径 ≈ 卡宽 + 间距
const RY = 200          // 纵向半径 ≈ 卡高 + 间距
const REST = 340        // 弹簧静止长度
const GRAVITY_Y = 330   // 纵向重力目标带
const SEP_ITER = 80     // 分离迭代上限
export const CARD_W = 252
export const CARD_H = 112   // 领域卡高
export const CONTAINER_H = 128
export const EXT_W = 176
export const EXT_H = 56
const ISOLATED_GAP = 72 // 孤立行与主体云的垂直间隔

function cardSize(node: ScopeNode): [number, number] {
  if (node.external) return [EXT_W, EXT_H]
  return node.kind === 'container' ? [CARD_W, CONTAINER_H] : [CARD_W, CARD_H]
}

/** 包群组框：容器层按包目录聚合的虚线 frame 几何（dir 空串＝跨多目录不猜，照常成框）。 */
export interface ScopePackageFrame {
  dir: string
  nodeIds: string[]
  x: number
  y: number
  w: number
  h: number
}

export interface ScopeLayout {
  /** 每张卡的左上角坐标；键集与输入 nodes 一一对应。 */
  positions: Record<string, [number, number]>
  packageFrames: ScopePackageFrame[]
}

/**
 * 结构轴布局主入口。确定性：同一输入两次调用逐位相同（无随机数、只按 id 序处理）。
 * 孤立卡（无跨域 call 入边）不进主力云——排进云里等于谎称它们是被调方，
 * 单列一行摆在主体下方，原因文案由画布渲染（spec 布局判据）。
 */
export function layoutScopeCards(nodes: ScopeNode[], edges: ScopeEdge[]): ScopeLayout {
  const positions: Record<string, [number, number]> = {}
  nodes.forEach((node, i) => {
    positions[node.id] = [340 + ((i * 173) % 640), 90 + ((i * 257) % 420)]
  })
  const inner = nodes.filter((n) => !n.external && !n.isolated)
  const outer = nodes.filter((n) => n.external)
  const isolated = nodes.filter((n) => n.isolated && !n.external)

  const springs: [string, string, number][] = []
  for (const edge of edges) {
    if (edge.kind !== 'call') continue
    if (positions[edge.from] && positions[edge.to]
      && inner.some((n) => n.id === edge.from) && inner.some((n) => n.id === edge.to)) {
      springs.push([edge.from, edge.to, Math.min(edge.weight, 4)])
    }
  }

  for (let it = 0; it < ITER; it += 1) {
    const f: Record<string, [number, number]> = {}
    for (const n of inner) f[n.id] = [0, 0]
    for (let i = 0; i < inner.length; i += 1) {
      for (let j = i + 1; j < inner.length; j += 1) {
        const a = inner[i].id
        const b = inner[j].id
        const dx = positions[a][0] - positions[b][0]
        const dy = positions[a][1] - positions[b][1]
        const nd = Math.sqrt((dx / RX) ** 2 + (dy / RY) ** 2) || 0.01
        if (nd >= 1) continue
        const len = Math.hypot(dx, dy) || 1
        const push = (1 - nd) * 46
        f[a][0] += (dx / len) * push
        f[a][1] += (dy / len) * push
        f[b][0] -= (dx / len) * push
        f[b][1] -= (dy / len) * push
      }
    }
    for (const [a, b, w] of springs) {
      const dx = positions[b][0] - positions[a][0]
      const dy = positions[b][1] - positions[a][1]
      const len = Math.hypot(dx, dy) || 1
      const pull = (len - REST) * 0.012 * w
      f[a][0] += (dx / len) * pull
      f[a][1] += (dy / len) * pull
      f[b][0] -= (dx / len) * pull
      f[b][1] -= (dy / len) * pull
    }
    const damp = (it < 120 ? 1 : 0.5) * 0.5
    for (const n of inner) {
      f[n.id][1] += (GRAVITY_Y - positions[n.id][1]) * 0.005
      positions[n.id][0] = Math.max(30, positions[n.id][0] + f[n.id][0] * damp)
      positions[n.id][1] = Math.max(64, positions[n.id][1] + f[n.id][1] * damp)
    }
  }
  separate(positions, inner)

  ringOuter(nodes, edges, positions, inner.map((n) => n.id), outer.map((n) => n.id))
  // 外圈落位后可能压到内圈：只推外圈，内圈已分离定型
  separate(positions, [...inner, ...outer], new Set(inner.map((n) => n.id)))

  // 孤立行：主体云（含外圈）最低点之下单列一行，按 id 升序从左到右
  let floorY = 0
  for (const n of [...inner, ...outer]) {
    const size = cardSize(n)
    floorY = Math.max(floorY, positions[n.id][1] + size[1])
  }
  if (!Number.isFinite(floorY)) floorY = 200
  let cursorX = 30
  for (const n of [...isolated].sort((a, b) => a.id.localeCompare(b.id))) {
    positions[n.id] = [cursorX, floorY + ISOLATED_GAP]
    cursorX += CARD_W + 24
  }

  return { positions, packageFrames: packageFramesOf(nodes, positions) }
}

/** 容器层包群组框：按 dir 聚合容器卡并算包围盒（含 14px 内边距）。 */
function packageFramesOf(nodes: ScopeNode[], positions: Record<string, [number, number]>): ScopePackageFrame[] {
  const byDir = new Map<string, string[]>()
  for (const n of nodes) {
    if (n.kind !== 'container' || n.external) continue
    const list = byDir.get(n.dir) ?? []
    list.push(n.id)
    byDir.set(n.dir, list)
  }
  const frames: ScopePackageFrame[] = []
  for (const dir of [...byDir.keys()].sort((a, b) => a.localeCompare(b))) {
    const ids = byDir.get(dir)!.sort((a, b) => a.localeCompare(b))
    let x0 = Infinity
    let y0 = Infinity
    let x1 = -Infinity
    let y1 = -Infinity
    for (const id of ids) {
      const p = positions[id]
      if (!p) continue
      x0 = Math.min(x0, p[0])
      y0 = Math.min(y0, p[1])
      x1 = Math.max(x1, p[0] + CARD_W)
      y1 = Math.max(y1, p[1] + CONTAINER_H)
    }
    if (!Number.isFinite(x0)) continue
    frames.push({ dir, nodeIds: ids, x: x0 - 14, y: y0 - 14, w: x1 - x0 + 28, h: y1 - y0 + 28 })
  }
  return frames
}

// ringOuter 把域外引用卡摆到本层内容外面的一圈上（domainlayout 同款策略：
// 占位卡是「这条调用出去到哪儿了」的边界注解，位置按它连向的本层卡定方位）。
function ringOuter(
  nodes: ScopeNode[],
  edges: ScopeEdge[],
  positions: Record<string, [number, number]>,
  innerIds: string[],
  outerIds: string[],
): void {
  if (!outerIds.length) return
  const innerSet = new Set(innerIds)
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  for (const id of innerIds) {
    const n = nodes.find((cand) => cand.id === id)
    const p = positions[id]
    if (!n || !p) continue
    const size = cardSize(n)
    x0 = Math.min(x0, p[0])
    y0 = Math.min(y0, p[1])
    x1 = Math.max(x1, p[0] + size[0])
    y1 = Math.max(y1, p[1] + size[1])
  }
  if (!Number.isFinite(x0)) { x0 = 60; y0 = 90; x1 = 60 + CARD_W; y1 = 90 + CARD_H }
  const cx = (x0 + x1) / 2
  const cy = (y0 + y1) / 2
  const rx = (x1 - x0) / 2 + 260
  const ry = (y1 - y0) / 2 + 190
  const dir: Record<string, [number, number]> = {}
  for (const edge of edges) {
    for (const [a, b] of [[edge.from, edge.to], [edge.to, edge.from]] as const) {
      if (!outerIds.includes(a) || !innerSet.has(b) || !positions[b]) continue
      const d = dir[a] ?? (dir[a] = [0, 0])
      d[0] += positions[b][0] + CARD_W / 2 - cx
      d[1] += positions[b][1] + CARD_H / 2 - cy
    }
  }
  outerIds.forEach((id, i) => {
    const d = dir[id]
    const ang = d && (d[0] || d[1]) ? Math.atan2(d[1], d[0]) : (i / outerIds.length) * Math.PI * 2
    positions[id] = [
      Math.max(30, cx + Math.cos(ang) * rx - EXT_W / 2),
      Math.max(64, cy + Math.sin(ang) * ry - EXT_H / 2),
    ]
  })
}

// separate 按矩形真实相交再分离一遍（domainlayout 同款）：斥力是软的，
// 卡压卡是这张图唯一不可接受的形态问题。确定性：只按传入顺序两两处理。
function separate(
  positions: Record<string, [number, number]>,
  cards: ScopeNode[],
  frozen?: Set<string>,
): void {
  for (let it = 0; it < SEP_ITER; it += 1) {
    let moved = false
    for (let i = 0; i < cards.length; i += 1) {
      for (let j = i + 1; j < cards.length; j += 1) {
        const a = cards[i]
        const b = cards[j]
        const sa = cardSize(a)
        const sb = cardSize(b)
        const pa = positions[a.id]
        const pb = positions[b.id]
        if (!pa || !pb) continue
        const ox = Math.min(pa[0] + sa[0], pb[0] + sb[0]) - Math.max(pa[0], pb[0])
        const oy = Math.min(pa[1] + sa[1], pb[1] + sb[1]) - Math.max(pa[1], pb[1])
        if (ox <= 0 || oy <= 0) continue
        moved = true
        const fa = frozen?.has(a.id) ?? false
        const fb = frozen?.has(b.id) ?? false
        if (fa && fb) continue
        const share = fa || fb ? 1 : 0.5
        if (ox < oy) {
          const d = (ox * share + 1) * (pa[0] <= pb[0] ? -1 : 1)
          if (!fa) pa[0] = Math.max(30, pa[0] + d)
          if (!fb) pb[0] = Math.max(30, pb[0] - d)
        } else {
          const d = (oy * share + 1) * (pa[1] <= pb[1] ? -1 : 1)
          if (!fa) pa[1] = Math.max(64, pa[1] + d)
          if (!fb) pb[1] = Math.max(64, pb[1] - d)
        }
      }
    }
    if (!moved) return
  }
}
