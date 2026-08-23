// CodegraphPage —— 代码图 viewer 的页面状态与三态下钻。
// 边界：项目选择不属于 viewer；只从 iframe 自身 URL 的 ?project= 读取。
import { useMemo, useState } from 'react'
import { CallTree } from './CallTree'
import { DetailPanel } from './DetailPanel'
import { DomainDetail } from './DomainDetail'
import { DomainPanorama } from './DomainPanorama'
import { FocusGraph } from './FocusGraph'
import { childDomainsOf, domainAncestors, hasDomains, leafRoots, nodeDomainPathOf } from './domains'
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

  const view = useMemo(() => {
    if (!data) return null
    const d = viewName === 'baseline' ? undefined : data.views[viewName]
    return mergeView(data.baseline, d)
  }, [data, viewName])
  const staleIds = useMemo(() => new Set((data?.stale ?? []).map((s) => s.id)), [data])

  const single = !!view && !hasDomains(view)
  const pano = !!view && !single && (scope === null || childDomainsOf(view, scope).length > 0)
  const leafScope = single ? null : scope

  const effFoci = useMemo(() => {
    if (!view) return []
    const ok = foci.filter((f) => view.nodes[f] && view.nodes[f].status !== 'deleted')
    if (ok.length) return ok
    return leafScope ? leafRoots(view, leafScope).slice(0, 1) : scannedEntries(view).slice(0, 1)
  }, [view, foci, leafScope])

  const setFociWithHist = (next: string[], fromHist = false) => {
    if (next.join('|') === effFoci.join('|')) return
    if (!fromHist) {
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
  const enterNode = (id: string) => {
    if (!view) return
    const path = nodeDomainPathOf(view, id)
    goScope(path.length ? path[path.length - 1] : null)
    setFoci([id])
    setHist([[id]])
    setHistIdx(0)
    setSelected(id)
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b px-3 py-2 text-sm">
        <label className="text-muted-foreground">视图</label>
        <select value={viewName} onChange={(e) => { setViewName(e.target.value); goScope(null) }}
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
          {!single && (
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
          {pano ? (
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
        </div>
      )}
    </div>
  )
}

// NOT_SCANNED 是 agentd 对「这个项目还没扫过图」的应答特征（codegraph.go 的 404
// 文案）。按文案判而不是按状态码：useCodegraph 只把 Error.message 传出来，
// 状态码在那一层就丢了。改 agentd 那句文案时这里要一起改——两处都在提「未生成
// 代码图」，grep 得到。
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
          {/* 这里不给「跑一句命令」的暗示：本仓没有 graph scan 子命令，
              基线是派 executor 按 docs/codegraph-scan-recipe.md 扫出来的
              （handoff graph 一族全是本地只读查询，见 cmd/graph.go） */}
          <p className="max-w-md text-xs text-muted-foreground">
            代码图是扫描产物，落在项目仓库的
            <code className="mx-1 rounded bg-muted px-1 py-0.5 font-mono">codegraph/baseline.json</code>。
            按 <code className="mx-1 rounded bg-muted px-1 py-0.5 font-mono">docs/codegraph-scan-recipe.md</code>
            派一次扫描任务，文件落盘后回来点「刷新」。
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
