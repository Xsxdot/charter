// nav.js —— 外壳渲染的最小助手（零依赖）。页面只需给出标题、当前导航项与面包屑。
window.shell = function (opts) {
  const items = [
    [(opts.depth ? '../' : '') + 'index.html', '子系统全景', 'home'],
    [(opts.depth ? '' : 'pages/') + 'behav-families.html', '入口清单（次要）', 'behav'],
  ]
  const nav = items.map(([h, t, k]) =>
    `<a href="${h}" class="nav-item${k === opts.nav ? ' active' : ''}"${k === opts.nav ? ' aria-current="page"' : ''}>${t}</a>`).join('')
  document.body.innerHTML = `<div class="app-shell">
  <aside class="sidebar"><div class="brand">charter · 代码图</div><nav>${nav}</nav>
    <div class="muted" style="font-size:10.5px;padding:12px 8px;line-height:1.5">真数据来源<br>handoff · baseline/best/target</div>
  </aside>
  <div class="main">
    <header class="topbar"><span class="page-title">${opts.title}</span>
      <span class="crumb">${opts.crumb || ''}</span></header>
    <main class="content" id="content"></main>
  </div></div>`
  return document.getElementById('content')
}
window.debtClass = function (n) { return n == null ? '' : n >= 100 ? 'd4' : n >= 30 ? 'd3' : n >= 10 ? 'd2' : n >= 1 ? 'd1' : 'ok' }
window.q = function (k, d) { return new URLSearchParams(location.search).get(k) || d }
