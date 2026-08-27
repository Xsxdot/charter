// CodegraphPage —— 数据装配薄壳。
//
// 页面状态属于 TwoAxisPage；本层只读取宿主传入的 project、一次取图，并保留
// 旧的未扫描/错误降级文案。结构轴与行为轴不另起网络入口。
import { useCodegraph } from './useCodegraph'
import { TwoAxisPage } from './TwoAxisPage'

const NOT_SCANNED = '未生成代码图'

export function CodegraphPage() {
  const project = new URLSearchParams(window.location.search).get('project') ?? ''
  const { data, error, loading, reload } = useCodegraph(project)
  return <div className="flex h-full flex-col"><header className="flex items-center gap-3 border-b px-4 py-2 text-sm"><span className="font-semibold">{project || '代码图'}</span><span className="text-xs text-muted-foreground">一次取数 · 页面内切换不增加请求</span><button type="button" className="ml-auto rounded border px-2 py-1 text-xs hover:bg-muted" onClick={reload}>刷新</button></header>{loading || error || !data ? <CodegraphPlaceholder loading={loading} error={error} project={project} onRetry={reload} /> : <TwoAxisPage baseline={data.baseline} best={data.best} decls={data.decls} target={data.target} report={data.report} />}</div>
}

function CodegraphPlaceholder({ loading, error, project, onRetry }: { loading: boolean; error: string; project: string; onRetry: () => void }) {
  if (loading) return <div className="p-6 text-sm text-muted-foreground">加载中…</div>
  const notScanned = !error || error.includes(NOT_SCANNED)
  return <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 p-6 text-center">{notScanned ? <><p className="text-sm font-medium">{project ? `项目 ${project} 还没有代码图` : '还没有代码图'}</p><p className="max-w-md text-xs text-muted-foreground">代码图是扫描产物，落在项目仓库的 <code className="rounded bg-muted px-1 py-0.5 font-mono">codegraph/baseline.json</code>。完成扫描后回来点「刷新」。</p></> : <><p className="text-sm font-medium text-destructive">取代码图失败</p><p className="max-w-md break-all text-xs text-muted-foreground">{error}</p></>}<button type="button" className="rounded border px-2.5 py-1 text-xs hover:bg-muted" onClick={onRetry}>重试</button></div>
}
