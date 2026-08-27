// graph.js —— 依赖方向图：按调用方向分层，调用方在上、被调方在下，边一律向下。
// 环不是 bug，是债：环内节点同层并用红色双向边显式标出（架构法派卡资格第 3 条要求依赖可排 DAG）。
window.buildLayers = function (nodes, edges) {
  const ids = nodes.map(n => n.id), S = new Set(ids)
  const succ = {}, pred = {}
  ids.forEach(i => { succ[i] = new Set(); pred[i] = new Set() })
  edges.forEach(e => { if (S.has(e.from) && S.has(e.to) && e.from !== e.to) { succ[e.from].add(e.to); pred[e.to].add(e.from) } })
  // Tarjan SCC → 缩点
  const idx = {}, low = {}, st = [], on = new Set(); let c = 0; const comps = []
  const dfs = v => {
    idx[v] = low[v] = c++; st.push(v); on.add(v)
    succ[v].forEach(w => {
      if (!(w in idx)) { dfs(w); low[v] = Math.min(low[v], low[w]) }
      else if (on.has(w)) low[v] = Math.min(low[v], idx[w])
    })
    if (low[v] === idx[v]) { const comp = []; for (;;) { const w = st.pop(); on.delete(w); comp.push(w); if (w === v) break } comps.push(comp) }
  }
  ids.forEach(v => { if (!(v in idx)) dfs(v) })
  const cid = {}; comps.forEach((comp, i) => comp.forEach(v => { cid[v] = i }))
  const cyclic = new Set(); comps.forEach(comp => { if (comp.length > 1) comp.forEach(v => cyclic.add(v)) })
  // 缩点图上求最长路径分层（源在上）
  const csucc = comps.map(() => new Set())
  edges.forEach(e => { if (S.has(e.from) && S.has(e.to) && cid[e.from] !== cid[e.to]) csucc[cid[e.from]].add(cid[e.to]) })
  const depth = comps.map(() => 0)
  let changed = true, guard = 0
  while (changed && guard++ < 100) {
    changed = false
    comps.forEach((_, i) => csucc[i].forEach(j => { if (depth[j] < depth[i] + 1) { depth[j] = depth[i] + 1; changed = true } }))
  }
  const layer = {}; ids.forEach(v => { layer[v] = depth[cid[v]] })
  return { layer, cid, cyclic, maxLayer: Math.max(0, ...Object.values(layer)) }
}
// 布局：每层一行，行内按同层内的被调量排；行宽超出画布则本层内再折一行（不打乱层次）
window.layout = function (nodes, edges, W, opt) {
  opt = opt || {}
  const BW = opt.bw || 152, BH = opt.bh || 66, GAPX = 14, GAPY = 92
  const { layer, cyclic, maxLayer } = buildLayers(nodes, edges)
  const inDeg = {}; nodes.forEach(n => { inDeg[n.id] = 0 })
  edges.forEach(e => { if (inDeg[e.to] != null) inDeg[e.to] += (e.calls || 1) })
  const perRow = Math.max(2, Math.floor((W + GAPX) / (BW + GAPX)))
  const rows = []
  for (let L = 0; L <= maxLayer; L++) {
    const items = nodes.filter(n => layer[n.id] === L).sort((a, b) => inDeg[b.id] - inDeg[a.id])
    for (let i = 0; i < items.length; i += perRow) rows.push({ layer: L, items: items.slice(i, i + perRow) })
  }
  const pos = {}
  rows.forEach((row, ri) => {
    const total = row.items.length * BW + (row.items.length - 1) * GAPX
    const x0 = Math.max(0, (W - total) / 2)
    row.items.forEach((nd, i) => { pos[nd.id] = { x: x0 + i * (BW + GAPX), y: 30 + ri * GAPY, w: BW, h: BH, row: ri, layer: row.layer } })
  })
  return { pos, height: 30 + rows.length * GAPY + 16, layer, cyclic, rowsMeta: rows.map(r => r.layer) }
}
window.edgePath = function (pos, from, to) {
  const a = pos[from], b = pos[to]; if (!a || !b) return { d: '', back: false }
  const ax = a.x + a.w / 2, bx = b.x + b.w / 2
  if (a.row < b.row) return { d: `M${ax},${a.y + a.h} C${ax},${a.y + a.h + 32} ${bx},${b.y - 32} ${bx},${b.y}`, back: false }
  if (a.row > b.row) {                       // 回边：走右侧折返，明确区别于正向
    const rx = Math.max(ax, bx) + 34
    return { d: `M${a.x + a.w},${a.y + a.h / 2} C${rx},${a.y + a.h / 2} ${rx},${b.y + b.h / 2} ${b.x + b.w},${b.y + b.h / 2}`, back: true }
  }
  const y = a.y + a.h, dip = 22 + Math.abs(ax - bx) * 0.05   // 同层（环内）：下沿浅弧
  return { d: `M${ax},${y} C${ax},${y + dip} ${bx},${y + dip} ${bx},${y}`, back: true }
}
window.edgeColor = function (budget) {
  if (budget == null) return '#8a8a92'
  return budget >= 100 ? '#c62f04' : budget >= 30 ? '#e2641f' : budget >= 10 ? '#ef9f4e' : budget >= 1 ? '#d9b070' : '#16a34a'
}

// renderGraph —— 首层与内部页共用的渲染（递归同构：同一套形态，只换节点集）。
// opts: {el, nodes, edges, wire, W, sel, box(nd)->{title,sub,tag,tagCls}, tip(e)->string}
window.renderGraph = function (o) {
  // 孤立节点（本层内既不调用别人、也不被调用）不进分层图——把它们排进 L0 会谎称它们是最外层调用方。
  const deg = {}; o.nodes.forEach(n => { deg[n.id] = 0 })
  o.edges.forEach(e => { if (deg[e.from] != null) deg[e.from]++; if (deg[e.to] != null) deg[e.to]++ })
  const isolated = o.nodes.filter(n => deg[n.id] === 0)
  const linked = o.nodes.filter(n => deg[n.id] > 0)
  o.isolated = isolated
  const useNodes = linked.length ? linked : o.nodes
  const { pos, height, cyclic, rowsMeta } = layout(useNodes, o.edges, o.W, o.opt)
  o.nodes = useNodes
  const dim = id => o.sel && o.sel !== id
  const dimE = e => o.sel && o.sel !== e.from && o.sel !== e.to
  const rowLabels = rowsMeta.map((L, ri) => {
    const first = Object.values(pos).find(p => p.row === ri); if (!first) return ''
    return `<text x="4" y="${first.y + 15}" font-size="9.5" fill="#a1a1aa">L${L}</text>`
  }).join('')
  const eSvg = o.edges.map(e => {
    const { d, back } = edgePath(pos, e.from, e.to); if (!d) return ''
    const col = back ? '#dc2626' : edgeColor(e.budget)
    return `<path d="${d}" fill="none" stroke="${col}" stroke-width="${(1.6 + Math.min(e.calls || 1, 300) * .011).toFixed(2)}"
      ${back ? 'stroke-dasharray="6 3"' : ''} marker-end="url(#ar${back ? 'b' : ''})"
      opacity="${dimE(e) ? .08 : .85}"><title>${o.tip ? o.tip(e) : ''}${back ? '\n⟲ 回边/环内边——依赖方向成环（架构法派卡资格第 3 条）' : ''}</title></path>`
  }).join('')
  const wSvg = (o.wire || []).map(w => {
    const { d } = edgePath(pos, w.from, w.to); if (!d) return ''
    return `<path d="${d}" fill="none" stroke="#8b5cf6" stroke-width="1.4" stroke-dasharray="4 4"
      opacity="${dimE(w) ? .06 : .55}"><title>${w.tip || ''}</title></path>`
  }).join('')
  const nSvg = o.nodes.map(nd => {
    const p = pos[nd.id], b = o.box(nd), on = o.sel === nd.id, cyc = cyclic.has(nd.id)
    return `<g class="nd" data-id="${nd.id}" data-kind="${nd.kind || ''}" style="cursor:pointer" opacity="${dim(nd.id) ? .35 : 1}">
    <rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" rx="9" fill="${on ? '#eef2ff' : b.warn ? '#fff8f3' : '#fff'}"
      stroke="${on ? '#4338ca' : b.warn ? '#e2641f' : '#c8c8ce'}" stroke-width="${on ? 2.2 : 1.1}"/>
    ${cyc ? `<circle cx="${p.x + p.w - 11}" cy="${p.y + 11}" r="6.5" fill="#fee2e2" stroke="#dc2626" stroke-width="1"/>
      <text x="${p.x + p.w - 11}" y="${p.y + 14.5}" font-size="8" fill="#dc2626" text-anchor="middle">⟲</text>` : ''}
    <text x="${p.x + 10}" y="${p.y + 20}" font-size="${b.mono ? 11 : 12.5}" font-weight="600"
      ${b.mono ? 'font-family="ui-monospace,Menlo,monospace"' : ''}>${b.title.length > 20 ? b.title.slice(0, 19) + '…' : b.title}</text>
    <text x="${p.x + 10}" y="${p.y + 36}" font-size="10" fill="#71717a">${b.sub}</text>
    ${b.tag ? `<rect x="${p.x + 9}" y="${p.y + 44}" width="${b.tag.length * 6.4 + 14}" height="14" rx="7" fill="${b.tagCls === 'bad' ? '#e2641f' : '#e4e4e7'}"/>
      <text x="${p.x + 16}" y="${p.y + 54.5}" font-size="9.5" fill="${b.tagCls === 'bad' ? '#fff' : '#3f3f46'}">${b.tag}</text>` : ''}
  </g>`
  }).join('')
  o.el.innerHTML = `<svg viewBox="0 0 ${o.W} ${height}" width="100%" height="${height}" style="display:block">
  <defs>
    <marker id="ar" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 Z" fill="#6b6b73"/></marker>
    <marker id="arb" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 Z" fill="#dc2626"/></marker>
  </defs>${rowLabels}${wSvg}${eSvg}${nSvg}</svg>`
  return { pos, cyclic, isolated }
}

// ── 卫星图：容器按包聚成群组，群组之间分层，边接到具体容器 ──────────────
// 画布可拖动（空白处拖）、cmd/ctrl + 滚轮缩放。
window.renderClusters = function (o) {
  const nodes = o.nodes, edges = o.edges
  const pkgOf = {}; nodes.forEach(n => { pkgOf[n.id] = n.pkg || '·' })
  const groups = {}
  nodes.forEach(n => { (groups[pkgOf[n.id]] = groups[pkgOf[n.id]] || []).push(n) })
  const gids = Object.keys(groups)
  // 群组级边（用于分层）
  const gEdge = {}
  edges.forEach(e => {
    const a = pkgOf[e.from], b = pkgOf[e.to]; if (!a || !b || a === b) return
    gEdge[a + '|' + b] = (gEdge[a + '|' + b] || 0) + (e.calls || 1)
  })
  const gNodes = gids.map(g => ({ id: g }))
  const gEdges = Object.entries(gEdge).map(([k, v]) => ({ from: k.split('|')[0], to: k.split('|')[1], calls: v }))
  const { layer, cyclic } = buildLayers(gNodes, gEdges)
  // 群组内网格
  const BW = 178, BH = 88, GX = 10, GY = 8, PAD = 22, GAPG = 30, GAPL = 56
  // 选中时：相连的节点保持高亮，其余压暗——只压暗不够，得看出「谁连着谁」
  const near = new Set()
  if (o.sel) { near.add(o.sel); edges.forEach(e => { if (e.from === o.sel) near.add(e.to); if (e.to === o.sel) near.add(e.from) }) }
  const wrapText = (t, max, lines) => {
    const out = []; let cur = ''
    for (const ch of String(t || '')) {
      if ((cur + ch).length > max) { out.push(cur); cur = ch; if (out.length >= lines) break } else cur += ch
    }
    if (out.length < lines && cur) out.push(cur)
    if (out.length === lines && cur && out[lines - 1] !== cur) out[lines - 1] = out[lines - 1].slice(0, max - 1) + '…'
    return out
  }
  const box = {}, gbox = {}
  const rowsOf = {}
  gids.forEach(g => {
    const items = groups[g].slice().sort((a, b) => b.symbols - a.symbols)
    const cols = items.length <= 2 ? 1 : items.length <= 6 ? 2 : 3
    const rows = Math.ceil(items.length / cols)
    gbox[g] = { w: cols * BW + (cols - 1) * GX + PAD * 2, h: PAD + 16 + rows * BH + (rows - 1) * GY + 12, cols, items }
    rowsOf[g] = rows
  })
  // 摆放判据（用户裁决 2026-08-25）：不按层往下排——以「能看见全部节点时空白最少、连线交叉最少」为准。
  // 做法：① 按连接权重贪心排序（强连的相邻）；② 货架装箱到接近 4:3 的画布；③ 相邻交换若干轮降交叉。
  const wOf = {}
  gEdges.forEach(e => { const k = [e.from, e.to].sort().join('|'); wOf[k] = (wOf[k] || 0) + e.calls })
  const wBetween = (a, b) => wOf[[a, b].sort().join('|')] || 0
  const order = []
  const left = new Set(gids)
  let cur = gids.slice().sort((x, y) =>
    gids.reduce((s2, z) => s2 + wBetween(y, z), 0) - gids.reduce((s2, z) => s2 + wBetween(x, z), 0))[0]
  while (cur) { order.push(cur); left.delete(cur)
    let best = null, bw = -1
    left.forEach(g => { const w = order.reduce((s2, o2) => s2 + wBetween(g, o2), 0); if (w > bw) { bw = w; best = g } })
    cur = best }
  const area = gids.reduce((s2, g) => s2 + gbox[g].w * gbox[g].h, 0)
  // 判据：空白最少 = 装箱长宽比贴合画布长宽比（不是固定 4:3）
  const vw = o.el.clientWidth || 900, vh = o.el.clientHeight || 620
  const aspect = Math.max(0.6, Math.min(3.2, vw / Math.max(240, vh)))
  const target = Math.max(...gids.map(g => gbox[g].w), Math.sqrt(area * aspect))
  const shelves = []
  let shelf = { items: [], w: 0, h: 0 }
  order.forEach(g => {
    if (shelf.items.length && shelf.w + gbox[g].w + GAPG > target) { shelves.push(shelf); shelf = { items: [], w: 0, h: 0 } }
    shelf.items.push(g); shelf.w += (shelf.items.length > 1 ? GAPG : 0) + gbox[g].w; shelf.h = Math.max(shelf.h, gbox[g].h)
  })
  if (shelf.items.length) shelves.push(shelf)
  // 相邻交换降交叉：以「同一条边两端的欧氏距离总和」为代价函数，贪心若干轮
  const place = () => { let y = 20, W2 = 0
    shelves.forEach(sh => { let x = 20
      sh.items.forEach(g => { gbox[g].x = x; gbox[g].y = y; x += gbox[g].w + GAPG; W2 = Math.max(W2, x) })
      y += sh.h + GAPG })
    return { W: W2, H: y } }
  const cost = () => gEdges.reduce((s2, e) => {
    const A = gbox[e.from], B = gbox[e.to]
    return s2 + e.calls * Math.hypot(A.x - B.x, A.y - B.y) }, 0)
  let dim = place(), bestCost = cost()
  for (let pass = 0; pass < 4; pass++) {
    for (const sh of shelves) for (let i = 0; i < sh.items.length - 1; i++) {
      const t = sh.items[i]; sh.items[i] = sh.items[i + 1]; sh.items[i + 1] = t
      dim = place(); const cst = cost()
      if (cst < bestCost) bestCost = cst
      else { const t2 = sh.items[i]; sh.items[i] = sh.items[i + 1]; sh.items[i + 1] = t2; dim = place() }
    }
  }
  const W = dim.W, H = dim.H
  // 群组落位后，算群组内每个容器的坐标
  gids.forEach(g => {
    const gb = gbox[g]
    gb.items.forEach((nd, i) => {
      const r = Math.floor(i / gb.cols), cI = i % gb.cols
      box[nd.id] = { x: gb.x + PAD + cI * (BW + GX), y: gb.y + PAD + 16 + r * (BH + GY), w: BW, h: BH }
    })
  })
  const dimN = id => o.sel && !near.has(id)
  const dimE = e => o.sel && e.from !== o.sel && e.to !== o.sel
  // 边贴到节点边框（不是圆心），箭头才看得见；方向靠箭头表达，不靠上下位置。
  const anchor = (a, b) => {
    const ax = a.x + a.w / 2, ay = a.y + a.h / 2, bx = b.x + b.w / 2, by = b.y + b.h / 2
    const dx = bx - ax, dy = by - ay
    const sx = dx === 0 ? Infinity : (a.w / 2) / Math.abs(dx), sy = dy === 0 ? Infinity : (a.h / 2) / Math.abs(dy)
    const t = Math.min(sx, sy)
    return { x: ax + dx * t, y: ay + dy * t }
  }
  const link = e => {
    const a = box[e.from], b = box[e.to]; if (!a || !b) return { d: '' }
    const p1 = anchor(a, b), p2 = anchor(b, a)
    const mx = (p1.x + p2.x) / 2, my = (p1.y + p2.y) / 2
    const nx = -(p2.y - p1.y), ny = p2.x - p1.x
    const len = Math.hypot(nx, ny) || 1, bow = Math.min(26, len * 0.09)
    return { d: `M${p1.x},${p1.y} Q${mx + nx / len * bow},${my + ny / len * bow} ${p2.x},${p2.y}` }
  }
  const gSvg = gids.map(g => {
    const gb = gbox[g], cyc = cyclic.has(g)
    return `<g><rect x="${gb.x}" y="${gb.y}" width="${gb.w}" height="${gb.h}" rx="12"
      fill="#fafafa" stroke="${cyc ? '#fca5a5' : '#e4e4e7'}" stroke-width="1.2" stroke-dasharray="${cyc ? '0' : '0'}"/>
      <text x="${gb.x + 12}" y="${gb.y + 17}" font-size="11" font-weight="700" fill="#3f3f46"
        font-family="ui-monospace,Menlo,monospace">${g.split('/').pop()}</text>
      <text x="${gb.x + gb.w - 12}" y="${gb.y + 17}" font-size="10" fill="#a1a1aa" text-anchor="end">${gb.items.length} 容器${cyc ? ' · ⟲ 环' : ''}</text></g>`
  }).join('')
  const eSvg = edges.map(e => {
    const { d } = link(e); if (!d) return ''
    const same = pkgOf[e.from] === pkgOf[e.to]
    const two = edges.some(x => x.from === e.to && x.to === e.from)   // 双向 = 环，红色
    return `<path d="${d}" fill="none" stroke="${two ? '#dc2626' : same ? '#a1a1aa' : '#52525b'}"
      stroke-width="${(1.3 + Math.min(e.calls || 1, 90) * .032).toFixed(2)}" ${two ? 'stroke-dasharray="6 3"' : ''}
      marker-end="url(#ar${two ? 'b' : ''})" opacity="${dimE(e) ? .05 : same ? .45 : .85}"><title>${o.tip ? o.tip(e) : ''}${two ? '\n⟲ 双向——依赖成环' : ''}</title></path>`
  }).join('')
  const nSvg = nodes.map(nd => {
    const p = box[nd.id], b = o.box(nd), on = o.sel === nd.id, linked = o.sel && near.has(nd.id) && !on
    if (!p) return ''
    const duty = wrapText(b.duty, 22, 2)
    return `<g class="nd" data-id="${nd.id}" style="cursor:pointer" opacity="${dimN(nd.id) ? .22 : 1}">
      <rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" rx="8" fill="${on ? '#eef2ff' : b.warn ? '#fff8f3' : '#fff'}"
        stroke="${on ? '#4338ca' : linked ? '#6366f1' : b.warn ? '#e2641f' : '#d4d4d8'}" stroke-width="${on ? 2.2 : linked ? 1.8 : 1}"/>
      <text x="${p.x + 9}" y="${p.y + 18}" font-size="11" font-weight="600" font-family="ui-monospace,Menlo,monospace">${b.title.length > 22 ? b.title.slice(0, 21) + '…' : b.title}</text>
      <text x="${p.x + 9}" y="${p.y + 32}" font-size="9.5" fill="#71717a">${b.sub}</text>
      ${b.duty
        ? duty.map((ln, i) => `<text x="${p.x + 9}" y="${p.y + 48 + i * 12}" font-size="9.5" fill="#52525b">${ln}</text>`).join('')
        : `<text x="${p.x + 9}" y="${p.y + 48}" font-size="9.5" fill="#a1a1aa" font-style="italic">无职责主体（${b.ckind || ''}）</text>`}
      ${b.tag ? `<text x="${p.x + 9}" y="${p.y + p.h - 8}" font-size="9" fill="#c62f04" font-weight="600">${b.tag}</text>` : ''}
    </g>`
  }).join('')
  o.el.innerHTML = `<div class="canvas-wrap" style="position:relative;overflow:hidden;height:100%;min-height:320px;background:#fff;cursor:grab">
    <svg id="cvsvg" width="${W + 20}" height="${H}" style="position:absolute;left:0;top:0;transform-origin:0 0">
    <defs>
      <marker id="ar" markerWidth="9" markerHeight="9" refX="8.5" refY="4.5" orient="auto"><path d="M0,0.6 L9,4.5 L0,8.4 Z" fill="#52525b"/></marker>
      <marker id="arb" markerWidth="9" markerHeight="9" refX="8.5" refY="4.5" orient="auto"><path d="M0,0.6 L9,4.5 L0,8.4 Z" fill="#dc2626"/></marker>
    </defs>${gSvg}${eSvg}${nSvg}</svg>
    <div style="position:absolute;right:8px;bottom:8px;font-size:10.5px;color:#a1a1aa;background:#fffc;padding:3px 7px;border-radius:6px">
      空白处拖动平移 · ⌘/Ctrl + 滚轮缩放 · 双击空白复位</div></div>`
  // 平移缩放
  const wrap = o.el.querySelector('.canvas-wrap'), svg = o.el.querySelector('#cvsvg')
  const fit = () => Math.max(.4, Math.min(1.15,
    Math.min((wrap.clientWidth - 16) / (W + 20), (wrap.clientHeight - 16) / (H + 16))))
  const center = () => { const kk = fit()
    return { k: kk, tx: Math.max(0, (wrap.clientWidth - (W + 20) * kk) / 2), ty: Math.max(0, (wrap.clientHeight - H * kk) / 2) } }
  let c0 = center(), tx = c0.tx, ty = c0.ty, k = c0.k
  const apply = () => { svg.style.transform = `translate(${tx}px,${ty}px) scale(${k})` }
  apply()
  let drag = null
  wrap.addEventListener('mousedown', ev => { if (ev.target.closest('.nd')) return; drag = { x: ev.clientX - tx, y: ev.clientY - ty }; wrap.style.cursor = 'grabbing' })
  window.addEventListener('mousemove', ev => { if (!drag) return; tx = ev.clientX - drag.x; ty = ev.clientY - drag.y; apply() })
  window.addEventListener('mouseup', () => { drag = null; wrap.style.cursor = 'grab' })
  wrap.addEventListener('wheel', ev => {
    if (!(ev.metaKey || ev.ctrlKey)) return
    ev.preventDefault()
    const r = wrap.getBoundingClientRect(), mx = ev.clientX - r.left, my = ev.clientY - r.top
    const nk = Math.min(3, Math.max(.2, k * (ev.deltaY < 0 ? 1.12 : 1 / 1.12)))
    tx = mx - (mx - tx) * (nk / k); ty = my - (my - ty) * (nk / k); k = nk; apply()
  }, { passive: false })
  wrap.addEventListener('dblclick', ev => { if (ev.target.closest('.nd')) return; const c1 = center(); tx = c1.tx; ty = c1.ty; k = c1.k; apply() })
  return { groups: gids.length, isolated: [] }
}
