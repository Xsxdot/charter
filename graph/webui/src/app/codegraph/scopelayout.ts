// scopelayout —— 结构轴画布的确定性布局（K4 组件层消费的纯函数）。
//
// 职责：把 ScopePageModel 的拓扑事实变成卡片坐标、包群组框、拓扑层信息与
// 边路径。分层与装箱行为移植自 prototypes/codegraph-two-axis/shared/graph.js；
// 领域布局对应 :3-64，容器群组对应 :124-212。
// 边界：纯函数、零随机数、零 DOM、零 console；ext 卡已由 scopepage 退役，布局
// 不为缺少节点的边创建坐标。所有排序显式按权重或 id 固定，保证重复调用逐位一致。
import type { ScopeEdge, ScopeNode } from './scopepage'

export const CARD_W = 252
export const CARD_H = 112
export const CONTAINER_H = 128

const DEFAULT_WIDTH = 1200
const TOP = 30
const GAP_X = 14
const GAP_Y = 160
const ISOLATED_GAP = 72
const LAYER_LABEL_W = 40
const PACKAGE_GAP = 30
const PACKAGE_PADDING = 14
const PACKAGE_HEADER = 24
// 原型 graph.js:58-60 的回边偏移是 34；C14 保持当前 28 的窄回边值，差异只为形态记录，值不动。
const BACK_OFFSET = 28

function cardSize(node: ScopeNode): [number, number] {
  return node.kind === 'container' ? [CARD_W, CONTAINER_H] : [CARD_W, CARD_H]
}

/** 包群组框：容器层按 dir 聚合容器卡的几何边界。 */
export interface ScopePackageFrame {
  dir: string
  nodeIds: string[]
  x: number
  y: number
  w: number
  h: number
}

export interface ScopeLayout {
  /** 每张输入卡的左上角坐标；键集与输入 nodes 一一对应。 */
  positions: Record<string, [number, number]>
  /** 容器层按 dir 聚出的包框；领域层恒为空。 */
  packageFrames: ScopePackageFrame[]
  /** 节点到拓扑层号（0 是最外层调用方）；孤立与容器层节点无条目。 */
  layers: Record<string, number>
  /** 分层卡的层数；容器层或空图为 0。 */
  layerCount: number
  /** SCC 环成员，升序。 */
  cyclicNodeIds: string[]
  /** 指向同层或上游的 call 边，升序。 */
  backEdgeKeys: string[]
  /** 孤立区成员，升序。 */
  isolatedIds: string[]
  /** 全部卡框、包框与左侧层标留白的内容包围盒。 */
  bounds: { w: number; h: number }
}

interface LayerResult {
  layers: Record<string, number>
  layerCount: number
  cyclicNodeIds: string[]
  backEdgeKeys: string[]
}

function callEdgesBetween(edges: ScopeEdge[], ids: Set<string>): ScopeEdge[] {
  return edges
    .filter((edge) => edge.kind === 'call' && ids.has(edge.from) && ids.has(edge.to) && edge.from !== edge.to)
    .slice()
    .sort((a, b) => a.key.localeCompare(b.key))
}

/**
 * 移植自 prototypes/codegraph-two-axis/shared/graph.js :3-32：Tarjan SCC 缩点后
 * 用最长路求源到目标的层号。排序是 TS 实现的确定性补充；projection 不参与拓扑。
 */
function buildLayers(nodes: ScopeNode[], edges: ScopeEdge[]): LayerResult {
  const ids = nodes.map((node) => node.id).sort((a, b) => a.localeCompare(b))
  const idSet = new Set(ids)
  const calls = callEdgesBetween(edges, idSet)
  const successors = new Map<string, string[]>(ids.map((id) => [id, []]))
  for (const edge of calls) {
    const list = successors.get(edge.from)!
    if (!list.includes(edge.to)) list.push(edge.to)
  }
  for (const list of successors.values()) list.sort((a, b) => a.localeCompare(b))

  const index = new Map<string, number>()
  const low = new Map<string, number>()
  const stack: string[] = []
  const onStack = new Set<string>()
  const components: string[][] = []
  let nextIndex = 0

  const visit = (id: string): void => {
    index.set(id, nextIndex)
    low.set(id, nextIndex)
    nextIndex += 1
    stack.push(id)
    onStack.add(id)
    for (const next of successors.get(id) ?? []) {
      if (!index.has(next)) {
        visit(next)
        low.set(id, Math.min(low.get(id)!, low.get(next)!))
      } else if (onStack.has(next)) {
        low.set(id, Math.min(low.get(id)!, index.get(next)!))
      }
    }
    if (low.get(id) !== index.get(id)) return
    const component: string[] = []
    for (;;) {
      const member = stack.pop()!
      onStack.delete(member)
      component.push(member)
      if (member === id) break
    }
    component.sort((a, b) => a.localeCompare(b))
    components.push(component)
  }
  for (const id of ids) if (!index.has(id)) visit(id)

  const componentOf = new Map<string, number>()
  components.forEach((component, componentId) => {
    component.forEach((id) => componentOf.set(id, componentId))
  })
  const componentSuccessors = components.map(() => new Set<number>())
  for (const edge of calls) {
    const from = componentOf.get(edge.from)!
    const to = componentOf.get(edge.to)!
    if (from !== to) componentSuccessors[from].add(to)
  }
  const depth = components.map(() => 0)
  const orderedComponents = components.map((_, id) => id).sort((a, b) => a - b)
  let changed = true
  while (changed) {
    changed = false
    for (const componentId of orderedComponents) {
      for (const successor of [...componentSuccessors[componentId]].sort((a, b) => a - b)) {
        if (depth[successor] < depth[componentId] + 1) {
          depth[successor] = depth[componentId] + 1
          changed = true
        }
      }
    }
  }

  const layers: Record<string, number> = {}
  for (const id of ids) layers[id] = depth[componentOf.get(id)!]
  const cyclicNodeIds = components
    .filter((component) => component.length > 1)
    .flat()
    .sort((a, b) => a.localeCompare(b))
  const backEdgeKeys = calls
    .filter((edge) => layers[edge.to]! <= layers[edge.from]!)
    .map((edge) => edge.key)
    .sort((a, b) => a.localeCompare(b))
  const layerCount = ids.length === 0 ? 0 : Math.max(...Object.values(layers)) + 1
  return { layers, layerCount, cyclicNodeIds, backEdgeKeys }
}

function incomingWeights(nodes: ScopeNode[], edges: ScopeEdge[]): Map<string, number> {
  const ids = new Set(nodes.map((node) => node.id))
  const weights = new Map(nodes.map((node) => [node.id, 0]))
  for (const edge of edges) {
    if (edge.kind !== 'call' || !ids.has(edge.from) || !ids.has(edge.to)) continue
    weights.set(edge.to, (weights.get(edge.to) ?? 0) + edge.weight)
  }
  return weights
}

function contentBounds(
  nodes: ScopeNode[],
  positions: Record<string, [number, number]>,
  frames: ScopePackageFrame[],
): { w: number; h: number } {
  let right = 0
  let bottom = 0
  for (const node of nodes) {
    const position = positions[node.id]
    if (!position) continue
    const [width, height] = cardSize(node)
    right = Math.max(right, position[0] + width)
    bottom = Math.max(bottom, position[1] + height)
  }
  for (const frame of frames) {
    right = Math.max(right, frame.x + frame.w)
    bottom = Math.max(bottom, frame.y + frame.h)
  }
  return nodes.length === 0 ? { w: 0, h: 0 } : { w: Math.max(LAYER_LABEL_W, right), h: bottom }
}

interface GroupLayout {
  dir: string
  nodeIds: string[]
  w: number
  h: number
  localPositions: Record<string, [number, number]>
  cyclicNodeIds: string[]
  backEdgeKeys: string[]
  x: number
  y: number
}

/**
 * 包群组内的分层摆放，行为基准为原型 graph.js:153-161。
 * 这是 plan 钦定的最大偏离点：原型按符号数做网格，本实现改按群组内 call 拓扑分层，
 * 让节点级边、回边与环徽章保持可读的方向关系；包群组的框与装箱仍沿用原型职责。
 */
function layoutPackageGroup(dir: string, nodes: ScopeNode[], edges: ScopeEdge[]): GroupLayout {
  const calls = callEdgesBetween(edges, new Set(nodes.map((node) => node.id)))
  const topo = buildLayers(nodes, calls)
  const weights = incomingWeights(nodes, calls)
  const localPositions: Record<string, [number, number]> = {}
  const perRow = Math.max(1, Math.min(3, Math.ceil(Math.sqrt(nodes.length))))
  let row = 0
  for (let layer = 0; layer < topo.layerCount; layer += 1) {
    const members = nodes
      .filter((node) => topo.layers[node.id] === layer)
      .sort((a, b) => (weights.get(b.id)! - weights.get(a.id)!) || a.id.localeCompare(b.id))
    for (let offset = 0; offset < members.length; offset += perRow) {
      const rowMembers = members.slice(offset, offset + perRow)
      const x0 = 0
      rowMembers.forEach((node, index) => {
        localPositions[node.id] = [x0 + index * (CARD_W + GAP_X), TOP + row * GAP_Y]
      })
      row += 1
    }
  }
  const groupNodes = new Map(nodes.map((node) => [node.id, node]))
  const right = Math.max(...Object.values(localPositions).map(([x]) => x + CARD_W), CARD_W)
  const bottom = Math.max(...Object.entries(localPositions).map(([id, [, y]]) => y + cardSize(groupNodes.get(id)!)[1]), TOP + CONTAINER_H)
  return {
    dir,
    nodeIds: nodes.map((node) => node.id).sort((a, b) => a.localeCompare(b)),
    w: right + PACKAGE_PADDING * 2,
    h: bottom + PACKAGE_PADDING * 2 + PACKAGE_HEADER,
    localPositions,
    cyclicNodeIds: topo.cyclicNodeIds,
    backEdgeKeys: topo.backEdgeKeys,
    x: 0,
    y: 0,
  }
}

function groupWeight(groups: GroupLayout[], edges: ScopeEdge[]): Map<string, number> {
  const nodeGroup = new Map<string, string>()
  for (const group of groups) for (const nodeId of group.nodeIds) nodeGroup.set(nodeId, group.dir)
  const weights = new Map<string, number>()
  for (const edge of edges) {
    if (edge.kind !== 'call') continue
    const from = nodeGroup.get(edge.from)
    const to = nodeGroup.get(edge.to)
    if (from === undefined || to === undefined || from === to) continue
    const key = [from, to].sort((a, b) => a.localeCompare(b)).join('|')
    weights.set(key, (weights.get(key) ?? 0) + edge.weight)
  }
  return weights
}

/**
 * 移植自原型 graph.js:167-204：按连接权重贪心排序、货架装箱，再做四轮相邻交换降距离。
 * 差异点：tiebreak 全部按 id 确定化；cost 取群组中心而非原型包框左上角；cost 仍逐条计算
 * 节点级 call 边，只有排序使用群组聚合权重，避免把节点级连线细节丢给布局决策。
 */
function arrangePackageGroups(groups: GroupLayout[], edges: ScopeEdge[], width: number): void {
  const weights = groupWeight(groups, edges)
  const between = (a: string, b: string): number => weights.get([a, b].sort((x, y) => x.localeCompare(y)).join('|')) ?? 0
  const left = new Set(groups.map((group) => group.dir))
  const degree = (dir: string) => groups.reduce((sum, group) => sum + between(dir, group.dir), 0)
  const order: string[] = []
  let current = [...left].sort((a, b) => (degree(b) - degree(a)) || a.localeCompare(b))[0]
  while (current !== undefined) {
    order.push(current)
    left.delete(current)
    current = [...left].sort((a, b) => {
      const weightA = order.reduce((sum, placed) => sum + between(a, placed), 0)
      const weightB = order.reduce((sum, placed) => sum + between(b, placed), 0)
      return (weightB - weightA) || a.localeCompare(b)
    })[0]
  }
  const byDir = new Map(groups.map((group) => [group.dir, group]))
  const area = groups.reduce((sum, group) => sum + group.w * group.h, 0)
  const aspect = Math.max(0.6, Math.min(3.2, width / Math.max(240, width * 0.62)))
  const target = Math.max(...groups.map((group) => group.w), Math.sqrt(area * aspect))
  const shelves: GroupLayout[][] = []
  let shelf: GroupLayout[] = []
  let shelfWidth = 0
  for (const dir of order) {
    const group = byDir.get(dir)!
    const nextWidth = shelfWidth + (shelf.length ? PACKAGE_GAP : 0) + group.w
    if (shelf.length && nextWidth > target) {
      shelves.push(shelf)
      shelf = []
      shelfWidth = 0
    }
    shelf.push(group)
    shelfWidth += (shelf.length > 1 ? PACKAGE_GAP : 0) + group.w
  }
  if (shelf.length) shelves.push(shelf)

  const place = (): void => {
    let y = PACKAGE_PADDING
    for (const row of shelves) {
      let x = PACKAGE_PADDING
      const height = Math.max(...row.map((group) => group.h))
      for (const group of row) {
        group.x = x
        group.y = y
        x += group.w + PACKAGE_GAP
      }
      y += height + PACKAGE_GAP
    }
  }
  const cost = (): number => {
    const nodeGroup = new Map<string, string>()
    for (const group of groups) for (const nodeId of group.nodeIds) nodeGroup.set(nodeId, group.dir)
    const centers = new Map(groups.map((group) => [group.dir, [group.x + group.w / 2, group.y + group.h / 2] as const]))
    return edges.reduce((sum, edge) => {
      if (edge.kind !== 'call') return sum
      const from = nodeGroup.get(edge.from)
      const to = nodeGroup.get(edge.to)
      if (from === undefined || to === undefined || from === to) return sum
      const a = centers.get(from)!
      const b = centers.get(to)!
      return sum + edge.weight * Math.hypot(a[0] - b[0], a[1] - b[1])
    }, 0)
  }
  place()
  let bestCost = cost()
  for (let pass = 0; pass < 4; pass += 1) {
    for (const row of shelves) {
      for (let i = 0; i < row.length - 1; i += 1) {
        const currentGroup = row[i]!
        row[i] = row[i + 1]!
        row[i + 1] = currentGroup
        place()
        const candidate = cost()
        if (candidate < bestCost) bestCost = candidate
        else {
          row[i + 1] = row[i]!
          row[i] = currentGroup
          place()
        }
      }
    }
  }
}

function layoutDomains(nodes: ScopeNode[], edges: ScopeEdge[], width: number): ScopeLayout {
  const isolated = nodes.filter((node) => node.isolated).sort((a, b) => a.id.localeCompare(b.id))
  const linked = nodes.filter((node) => !node.isolated)
  const topo = buildLayers(linked, edges)
  const weights = incomingWeights(linked, edges)
  const positions: Record<string, [number, number]> = {}
  const available = Math.max(CARD_W, width - LAYER_LABEL_W)
  const perRow = Math.max(2, Math.floor((width + GAP_X) / (CARD_W + GAP_X)))
  let row = 0
  for (let layer = 0; layer < topo.layerCount; layer += 1) {
    const members = linked
      .filter((node) => topo.layers[node.id] === layer)
      .sort((a, b) => (weights.get(b.id)! - weights.get(a.id)!) || a.id.localeCompare(b.id))
    for (let offset = 0; offset < members.length; offset += perRow) {
      const rowMembers = members.slice(offset, offset + perRow)
      const total = rowMembers.length * CARD_W + (rowMembers.length - 1) * GAP_X
      const x0 = LAYER_LABEL_W + Math.max(0, (available - total) / 2)
      rowMembers.forEach((node, index) => {
        positions[node.id] = [x0 + index * (CARD_W + GAP_X), TOP + row * GAP_Y]
      })
      row += 1
    }
  }
  let floorY = TOP
  for (const node of linked) floorY = Math.max(floorY, (positions[node.id]?.[1] ?? TOP) + cardSize(node)[1])
  const isolatedY = floorY + ISOLATED_GAP
  isolated.forEach((node, index) => {
    positions[node.id] = [LAYER_LABEL_W + index * (CARD_W + GAP_X), isolatedY]
  })
  return {
    positions,
    packageFrames: [],
    layers: topo.layers,
    layerCount: topo.layerCount,
    cyclicNodeIds: topo.cyclicNodeIds,
    backEdgeKeys: topo.backEdgeKeys,
    isolatedIds: isolated.map((node) => node.id),
    bounds: contentBounds(nodes, positions, []),
  }
}

function layoutContainers(nodes: ScopeNode[], edges: ScopeEdge[], width: number): ScopeLayout {
  const groupsByDir = new Map<string, ScopeNode[]>()
  for (const node of nodes) {
    const list = groupsByDir.get(node.dir) ?? []
    list.push(node)
    groupsByDir.set(node.dir, list)
  }
  const groups = [...groupsByDir.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dir, members]) => layoutPackageGroup(dir, members, edges))
  arrangePackageGroups(groups, edges, width)
  const positions: Record<string, [number, number]> = {}
  const frames: ScopePackageFrame[] = []
  const cyclic = new Set<string>()
  const backEdges = new Set<string>()
  for (const group of groups) {
    for (const nodeId of group.nodeIds) {
      const local = group.localPositions[nodeId] ?? [0, TOP]
      positions[nodeId] = [group.x + PACKAGE_PADDING + local[0], group.y + PACKAGE_HEADER + local[1]]
    }
    group.cyclicNodeIds.forEach((id) => cyclic.add(id))
    group.backEdgeKeys.forEach((key) => backEdges.add(key))
    frames.push({ dir: group.dir, nodeIds: group.nodeIds, x: group.x, y: group.y, w: group.w, h: group.h })
  }
  return {
    positions,
    packageFrames: frames,
    layers: {},
    layerCount: 0,
    cyclicNodeIds: [...cyclic].sort((a, b) => a.localeCompare(b)),
    backEdgeKeys: [...backEdges].sort((a, b) => a.localeCompare(b)),
    isolatedIds: nodes.filter((node) => node.isolated).map((node) => node.id).sort((a, b) => a.localeCompare(b)),
    bounds: contentBounds(nodes, positions, frames),
  }
}

/**
 * 布局主入口。领域层移植原型 :34-53；容器层移植原型 :124-212。`opts.width`
 * 只控制可见宽度，不读取 DOM；缺省 1200 与组件 jsdom 兜底一致。
 */
export function layoutScopeCards(
  nodes: ScopeNode[],
  edges: ScopeEdge[],
  opts: { width?: number } = {},
): ScopeLayout {
  if (nodes.length === 0) {
    return {
      positions: {}, packageFrames: [], layers: {}, layerCount: 0,
      cyclicNodeIds: [], backEdgeKeys: [], isolatedIds: [], bounds: { w: 0, h: 0 },
    }
  }
  const width = Number.isFinite(opts.width) && (opts.width ?? 0) > 0 ? opts.width! : DEFAULT_WIDTH
  const containers = nodes.filter((node) => node.kind === 'container')
  const domains = nodes.filter((node) => node.kind !== 'container')
  if (containers.length === 0) return layoutDomains(nodes, edges, width)
  if (domains.length === 0) return layoutContainers(nodes, edges, width)
  const domainLayout = layoutDomains(domains, edges, width)
  const containerLayout = layoutContainers(containers, edges, width)
  const containerOffsetY = domainLayout.bounds.h + GAP_Y
  const positions = { ...domainLayout.positions }
  for (const [id, [x, y]] of Object.entries(containerLayout.positions)) positions[id] = [x, y + containerOffsetY]
  const packageFrames = containerLayout.packageFrames.map((frame) => ({ ...frame, y: frame.y + containerOffsetY }))
  return {
    positions,
    packageFrames,
    layers: domainLayout.layers,
    layerCount: domainLayout.layerCount,
    cyclicNodeIds: [...new Set([...domainLayout.cyclicNodeIds, ...containerLayout.cyclicNodeIds])]
      .sort((a, b) => a.localeCompare(b)),
    backEdgeKeys: [...new Set([...domainLayout.backEdgeKeys, ...containerLayout.backEdgeKeys])]
      .sort((a, b) => a.localeCompare(b)),
    isolatedIds: [...new Set([...domainLayout.isolatedIds, ...containerLayout.isolatedIds])]
      .sort((a, b) => a.localeCompare(b)),
    bounds: contentBounds(nodes, positions, packageFrames),
  }
}

/** 卡片矩形：布局左上角加宽高，给边框锚点用。 */
export interface ScopeCardRect {
  x: number
  y: number
  w: number
  h: number
}

/**
 * 边端点贴在卡片边框，不落几何中心——HTML 卡叠在 SVG 上，中心端点会被卡面盖住。
 * 形态对齐原型 graph.js:54-64：正向下沿→上沿、回边右沿→右沿、同层下沿→下沿。
 */
export function scopeEdgeAnchors(
  from: ScopeCardRect,
  to: ScopeCardRect,
  kind: 'forward' | 'back' | 'sibling',
): { x1: number; y1: number; x2: number; y2: number } {
  if (kind === 'forward') {
    return { x1: from.x + from.w / 2, y1: from.y + from.h, x2: to.x + to.w / 2, y2: to.y }
  }
  if (kind === 'back') {
    return { x1: from.x + from.w, y1: from.y + from.h / 2, x2: to.x + to.w, y2: to.y + to.h / 2 }
  }
  return { x1: from.x + from.w / 2, y1: from.y + from.h, x2: to.x + to.w / 2, y2: to.y + to.h }
}

/** 移植原型 graph.js:54-64：正向边向下、回边右侧折返、同层边沿下沿浅弧。 */
export function scopeEdgePath(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  kind: 'forward' | 'back' | 'sibling',
): string {
  // forward：原型 :57 的向下贝塞尔，让调用方向由上至下并留出箭头空间。
  if (kind === 'forward') return `M${x1},${y1} C${x1},${y1 + 32} ${x2},${y2 - 32} ${x2},${y2}`
  // back：原型 :58-60 的右侧折返，和正向边形成明确视觉区分；偏移差异见 BACK_OFFSET 注释。
  if (kind === 'back') {
    const right = Math.max(x1, x2) + BACK_OFFSET
    return `M${x1},${y1} C${right},${y1} ${right},${y2} ${x2},${y2}`
  }
  // sibling：原型 :62-64 的下沿浅弧仅用于非回边的同层连接，避免同层节点的线完全重合。
  const dip = 22 + Math.abs(x1 - x2) * 0.05
  return `M${x1},${y1} C${x1},${y1 + dip} ${x2},${y2 + dip} ${x2},${y2}`
}
