// CodegraphPage —— 代码图 viewer 的页面状态与三态下钻。
//
// 三态：
//   scope=null 且图里有领域 → 领域全景
//   scope 还有子领域        → 子领域全景（域外领域画成占位卡）
//   scope 是叶子领域        → 树+图视图（左树 320 / 中图自适应 / 右详情 340）
// 整图没有领域段时降级为单领域视图并明示提示——不按包名伪造领域。
//
// 边界：项目选择不属于 viewer；只从 iframe 自身 URL 的 ?project= 读取。
import { useEffect, useMemo, useState } from 'react'
import { CallTree } from './CallTree'
import { BestDetail } from './BestDetail'
import { BestPanorama } from './BestPanorama'
import { BestEdgeDetail } from './BestOverlays'
import { BestDomainPage } from './BestDomainPage'
import { BestScopePanorama } from './BestScopePanorama'
import { MigrationSidebar } from './BestOverlays'
import { DetailPanel } from './DetailPanel'
import { DomainDetail } from './DomainDetail'
import { DomainPanorama } from './DomainPanorama'
import { FocusGraph } from './FocusGraph'
import { childDomainsOf, domainAncestors, hasDomains, leafRoots, nodeDomainPathOf } from './domains'
import { bestDomainPath, bestScopeGraph, isBestLeaf, migrationGroups } from './besttree'
import { mergeView, scannedEntries } from './graphmath'
import { useCodegraph } from './useCodegraph'

export function CodegraphPage() {
  const project = new URLSearchParams(window.location.search).get('project') ?? ''
  const { data, error, loading, reload } = useCodegraph(project)

  const [viewName, setViewName] = useState('baseline')
  const [scope, setScope] = useState<string | null>(null)
  const [selDomain, setSelDomain] = useState('')
  const [selEdge, setSelEdge] = useState('')
  const [depth, setDepth] = useState(2)
  const [foci, setFoci] = useState<string[]>([])
  const [hist, setHist] = useState<string[][]>([])
  const [histIdx, setHistIdx] = useState(-1)
  const [open, setOpen] = useState<Set<string>>(new Set())
  const [selected, setSelected] = useState('')
  const [bestScope, setBestScope] = useState<string | null>(null)
  const [bestEdge, setBestEdge] = useState('')
  const [bestContainer, setBestContainer] = useState('')
  const [bestHistory, setBestHistory] = useState<string[]>([])

  const view = useMemo(() => {
    if (!data) return null
    const d = viewName === 'baseline' ? undefined : data.views[viewName]
    return mergeView(data.baseline, d)
  }, [data, viewName])
  const staleIds = useMemo(() => new Set((data?.stale ?? []).map((s) => s.id)), [data])

  const single = !!view && !hasDomains(view)               // 旧图：整张图当一个领域看
  const pano = !!view && !single && (scope === null || childDomainsOf(view, scope).length > 0)
  const bestMode = !!view && viewName === 'baseline' && !!data?.best
  const bestPano = bestMode && bestScope === null
  const bestNested = bestMode && bestScope !== null && !isBestLeaf(data!.best!, bestScope)
  const branchCompareFallback = !!view && viewName !== 'baseline' && !!data?.best
  const leafScope = single ? null : scope
  const bestMigrationGroups = useMemo(
    () => data?.best ? migrationGroups(data.best, data.baseline, data.report) : [],
    [data?.best, data?.baseline, data?.report],
  )
  const bestMigrationItems = useMemo(
    () => bestMigrationGroups.flatMap((group) => group.items),
    [bestMigrationGroups],
  )

  // 边选择是 best 页面唯一的方向详情入口，记录当前投影上下文便于定位空详情。
  useEffect(() => {
    if (bestEdge) console.debug('[codegraph] best edge state', { scopeId: bestScope, key: bestEdge })
  }, [bestEdge, bestScope])

  const effFoci = useMemo(() => {
    if (!view) return []
    const ok = foci.filter((f) => view.nodes[f] && view.nodes[f].status !== 'deleted')
    if (ok.length) return ok
    // 默认焦点必须落在当前领域内：goScope 会清空 foci，若这里回落到全图第一个
    // 已扫描入口，进领域后左树列的是本域的根、焦点图却停在域外节点上，两栏各说各话。
    return leafScope ? leafRoots(view, leafScope).slice(0, 1) : scannedEntries(view).slice(0, 1)
  }, [view, foci, leafScope])

  const setFociWithHist = (next: string[], fromHist = false) => {
    if (next.join('|') === effFoci.join('|')) return
    if (!fromHist) {
      // 历史为空时先把当前（默认）焦点垫底：否则第一次换焦点后「后退」无处可退
      const base = hist.length ? hist.slice(0, histIdx + 1) : [effFoci]
      const h = [...base, next]
      setHist(h)
      setHistIdx(h.length - 1)
    }
    setFoci(next)
    setSelected(next[next.length - 1] ?? '')
  }
  const onFocus = (id: string, additive: boolean) => {
    if (additive) {
      const s = effFoci.includes(id) ? effFoci.filter((x) => x !== id) : [...effFoci, id]
      if (s.length) setFociWithHist(s)
    } else setFociWithHist([id])
  }

  // 换一层领域：焦点历史与展开状态都作废——它们是上一层的语境，带过去只会误导
  const goScope = (next: string | null) => {
    setScope(next)
    setSelDomain('')
    setSelEdge('')
    setFoci([])
    setHist([])
    setHistIdx(-1)
    setOpen(new Set())
    setSelected('')
  }

  // best 下钻拥有独立状态，避免把现状叶子焦点/面包屑带入理想树。
  const goBestScope = (next: string | null) => {
    if (next && data?.best) {
      const path = bestDomainPath(data.best, next)
      if (!path.length) {
        console.warn('[codegraph] best scope target missing', { scopeId: next })
        setBestScope(null)
        setBestHistory([])
        setBestEdge('')
        setBestContainer('')
        return
      }
      setBestScope(next)
      setBestHistory(path)
    } else {
      setBestScope(null)
      setBestHistory([])
    }
    setBestEdge('')
    setBestContainer('')
    setSelDomain('')
  }

  const onBestMigration = (item: import('./besttree').MigrationItem) => {
    console.info('[codegraph] best migration select', {
      containerId: item.containerId,
      expectedDomainId: item.expectedDomainId,
      currentDomainId: item.currentDomainId,
    })
    setBestContainer(item.containerId)
    if (item.expectedDomainId && item.expectedSubsystemId) {
      goBestScope(item.expectedSubsystemId)
      setBestHistory([item.expectedSubsystemId])
      setBestContainer(item.containerId)
      return
    }
    console.warn('[codegraph] best migration target missing', { containerId: item.containerId })
    goBestScope(null)
  }

  const onViewChange = (nextView: string) => {
    setViewName(nextView)
    goScope(null)
    goBestScope(null)
  }
  // 横跳：落到目标节点所在的叶子领域并把它设为焦点
  const enterNode = (id: string) => {
    if (!view) return
    const path = nodeDomainPathOf(view, id)
    goScope(path.length ? path[path.length - 1] : null)
    setFoci([id])
    setHist([[id]])
    setHistIdx(0)
    setSelected(id)
  }

  // 出错时**不能整页替换**：视图下拉与「刷新」都在工具条里，把工具条一起换掉，
  // 选中一个取不到数据的 diff 视图后就再也换不回基准视图了（本页没有别的入口，
  // 等于卡死）。所以错误只占内容区，工具条恒在。
  // 上游 handoff 版这里换掉的是项目下拉，症状同一个——工具条是唯一的退路。
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b px-3 py-2 text-sm">
        <label className="text-muted-foreground">视图</label>
        <select value={viewName} onChange={(e) => onViewChange(e.target.value)}
          className="rounded border px-1.5 py-0.5">
          <option value="baseline">基准 · {data?.baseline.meta.branch ?? ''}</option>
          {Object.entries(data?.views ?? {}).map(([k, v]) => <option key={k} value={k}>{v.view}</option>)}
        </select>
        {data && data.stale.length > 0 && (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700"
            title={data.stale.map((s) => `${s.id}: ${s.reason}`).join('\n')}>
            ⚠ {data.stale.length} 个节点疑似失鲜
          </span>
        )}
        {single && (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">
            该图未包含领域划分（扫描版本较旧）：重扫可获得领域全景
          </span>
        )}
        <button onClick={reload} className="ml-auto rounded border px-2 py-0.5 text-xs">刷新</button>
      </div>
      {loading || error || !view ? (
        <CodegraphPlaceholder loading={loading} error={error} project={project} onRetry={reload} />
      ) : (
        <div className="relative flex min-h-0 flex-1">
          {bestMode ? (
            <div className="absolute left-3.5 top-2.5 z-40 inline-flex items-center gap-2 rounded-full border bg-background px-3.5 py-1 text-xs shadow-sm">
              <button type="button" data-best-breadcrumb="root" className="font-semibold hover:underline" onClick={() => goBestScope(null)}>
                理想树全景
              </button>
              {bestHistory.map((id, index) => (
                <span key={id} className="inline-flex items-center gap-2">
                  <span className="text-muted-foreground">▸</span>
                  {index === bestHistory.length - 1 ? (
                    <b>{data?.best ? data.best.domains[id]?.label ?? id : id}</b>
                  ) : (
                    <button type="button" data-best-breadcrumb={id} className="text-muted-foreground hover:underline" onClick={() => goBestScope(id)}>
                      {data?.best ? data.best.domains[id]?.label ?? id : id}
                    </button>
                  )}
                </span>
              ))}
              {bestScope === null ? <span className="text-[11px] text-muted-foreground">主线对照 · 点卡查看详情 · 点击进入下钻</span> : null}
            </div>
          ) : !single && (
            <div className="absolute left-3.5 top-2.5 z-30 inline-flex items-center gap-2 rounded-full border bg-background px-3.5 py-1 text-xs shadow-sm">
              {scope === null ? (
                <>
                  <b>领域全景</b>
                  <span className="text-[11px] text-muted-foreground">点卡片看职责 · 点连线看谁调谁 · 进入 ▸ 下钻 · 空白拖动平移 · ⌘/⌃+滚轮缩放</span>
                </>
              ) : (
                <>
                  <span className="cursor-pointer text-muted-foreground hover:underline" onClick={() => goScope(null)}>◀ 领域全景</span>
                  {domainAncestors(view, scope).map((id, i, arr) => (
                    <span key={id} className="inline-flex items-center gap-2">
                      <span className="text-muted-foreground">▸</span>
                      {i === arr.length - 1 ? (
                        <>
                          <b>{view.domains[id]?.label}</b>
                          <span className="text-[11px] text-muted-foreground">{view.domains[id]?.kind}</span>
                        </>
                      ) : (
                        <span className="cursor-pointer text-muted-foreground hover:underline" onClick={() => goScope(id)}>
                          {view.domains[id]?.label}
                        </span>
                      )}
                    </span>
                  ))}
                </>
              )}
            </div>
          )}
          {bestMode ? (
            <>
              <MigrationSidebar groups={bestMigrationGroups} selectedContainer={bestContainer} onSelectContainer={onBestMigration} />
              {bestPano ? (
                <BestPanorama best={data.best!} target={data.target} report={data.report} decls={data.decls}
                  selectedSubsystem={selDomain} selectedEdge={bestEdge}
                  onSelectSubsystem={(id) => { setSelDomain(id); setBestEdge('') }}
                  onSelectEdge={(key) => {
                    console.debug('[codegraph] best edge select', { scopeId: bestScope, key })
                    setBestEdge(key)
                    setSelDomain('')
                  }} />
              ) : bestNested ? (
                <BestScopePanorama best={data.best!} target={data.target} report={data.report} decls={data.decls} scopeId={bestScope!}
                  selectedDomain={selDomain} selectedEdge={bestEdge} migrationItems={bestMigrationItems}
                  onSelectDomain={(id) => setSelDomain(id)}
                  onSelectEdge={(key) => { setBestEdge(key); setSelDomain('') }}
                  onEnter={goBestScope} onSelectMigration={onBestMigration} />
              ) : (
                <BestDomainPage
                  project={project}
                  baseline={data.baseline}
                  best={data.best}
                  decls={data.decls}
                  report={data.report}
                  domainId={bestScope!}
                  migrationItems={bestMigrationItems}
                  selectedContainer={bestContainer}
                  onSelectContainer={setBestContainer}
                />
              )}
              {bestEdge ? (
                <BestEdgeDetail
                  edge={bestScopeGraph(data.best!, data.target, data.report, bestScope).edges.find((edge) => edge.key === bestEdge) ?? null}
                  target={data.target} report={data.report} />
              ) : bestPano ? (
                <BestDetail best={data.best!} baseline={data.baseline} report={data.report} decls={data.decls} subsystemId={selDomain}
                  selectedDomain={selDomain} onEnterDomain={goBestScope} selectedContainer={bestContainer} onSelectContainer={setBestContainer} />
              ) : null}
            </>
          ) : pano ? (
            <>
              <DomainPanorama view={view} scope={scope} selectedDomain={selDomain} selectedEdge={selEdge}
                onSelectDomain={(id) => { setSelDomain(id); setSelEdge('') }}
                onSelectEdge={(k) => { setSelEdge(k); setSelDomain('') }}
                onEnter={goScope} />
              <DomainDetail view={view} scope={scope} domainId={selDomain} edgeKey={selEdge}
                onEnterNode={enterNode} onEnterDomain={goScope} />
            </>
          ) : (
            <>
              <CallTree view={view} foci={effFoci} open={open} scope={leafScope}
                onToggle={(id, o) => setOpen((s) => {
                  const n = new Set(s)
                  if (o) n.add(id)
                  else n.delete(id)
                  return n
                })}
                onFocus={onFocus} onCrossJump={enterNode} />
              <FocusGraph view={view} foci={effFoci} depth={depth} staleIds={staleIds} scope={leafScope}
                onDepth={setDepth} onFocus={onFocus} onSelect={setSelected} onCrossJump={enterNode}
                canBack={histIdx > 0} canFwd={histIdx < hist.length - 1}
                onBack={() => { setHistIdx(histIdx - 1); setFociWithHist(hist[histIdx - 1], true) }}
                onFwd={() => { setHistIdx(histIdx + 1); setFociWithHist(hist[histIdx + 1], true) }} />
              <DetailPanel project={project} view={view} nodeId={selected || effFoci[effFoci.length - 1] || ''}
                stale={staleIds} onJump={enterNode} />
            </>
          )}
          {branchCompareFallback && (
            <div data-compare-fallback className="pointer-events-none absolute bottom-3 left-3.5 z-30 rounded border bg-background/95 px-3 py-1 text-xs text-muted-foreground shadow-sm">
              分支视图暂用现状域全景——对照面向主线，per-view 对照见二期
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// NOT_SCANNED 是宿主服务端对「这个项目还没扫过图」的 404 应答特征。按文案判而
// 不是按状态码：useCodegraph 只把 Error.message 传出来，状态码在那一层就丢了。
// 这句是跨仓约定的字面量（契约冻结项），宿主改那句文案时这里必须一起改——两处
// 都在提「未生成代码图」，grep 得到。
const NOT_SCANNED = '未生成代码图'

/** CodegraphPlaceholder 是内容区的三种非图状态：加载中 / 没扫过 / 真出错。 */
function CodegraphPlaceholder({ loading, error, project, onRetry }: {
  loading: boolean
  error: string
  project: string
  onRetry: () => void
}) {
  if (loading) return <div className="p-6 text-sm text-muted-foreground">加载中…</div>

  // 「没扫过」不是故障，是这个项目还没做过的一件事——给命令，别给红字。
  const notScanned = !error || error.includes(NOT_SCANNED)
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
      {notScanned ? (
        <>
          <p className="text-sm font-medium">{project ? `项目 ${project} 还没有代码图` : '还没有代码图'}</p>
          {/* 这里只说产物落点，不给具体命令、也不点名任何仓内文档：本组件是发给
              任意宿主的公共包，扫描入口各家不同（有的是 CLI 子命令，有的是派一次
              扫描任务），写死一条路径必然对一部分宿主是死链。产物落点是契约里
              固定的，所以它可以写。 */}
          <p className="max-w-md text-xs text-muted-foreground">
            代码图是扫描产物，落在项目仓库的
            <code className="mx-1 rounded bg-muted px-1 py-0.5 font-mono">codegraph/baseline.json</code>。
            按本项目的方式扫一次图，文件落盘后回来点「刷新」。
          </p>
        </>
      ) : (
        <>
          <p className="text-sm font-medium text-destructive">取代码图失败</p>
          {/* 报错原文照抄，不翻译不概括：这里最常见的是网络/权限，改写会让人查错方向 */}
          <p className="max-w-md break-all text-xs text-muted-foreground">{error}</p>
        </>
      )}
      <button type="button" onClick={onRetry} className="rounded border px-2.5 py-1 text-xs hover:bg-accent/60">
        重试
      </button>
    </div>
  )
}
