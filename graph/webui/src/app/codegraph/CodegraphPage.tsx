// CodegraphPage —— 两轴查看器的装配薄壳（K6 装配切换后的唯一页面入口）。
//
// 职责：从 iframe 自身 URL 读 ?project=，经 useCodegraph 一次取数；工具条保留
// 视图下拉 / 失鲜徽标 / 单域提示 / 刷新；内容区在结构轴（TwoAxisPage）与行为轴
// （FlowPageView）之间切换——点右栏「程序入口」进流程图，「返回结构轴」回结构轴。
// 一次取数两轴共用：轴间与层间的一切切换都是本地状态，不新增请求。
// 边界：本组件不重算任何债读数（缝纪律）——结构读数在 deriveScopePage、行为读数
// 在 deriveFlowPage；旧三态下钻世界（领域全景/子域全景/树+图）连同其派生器与
// 组件族已随 C12.6 同一刀退役（contract §2.5-37/-38、P5-A 无调用方即删）。
// diff 视图（views 下拉）：缝 1 冻结输入（§2.3-19 六字段）没有 diff 维度，
// 两轴不消费合成视图——选中 diff 视图时内容区仍渲染基准快照并显式告知
// （CgView 的对象边也无法安全转回 CgGraph 元组而不丢 flows/implements）。
// 换视图整页重挂——scope/组织/抽屉是上一层视图的语境，带过去只会误导。
import { useState } from 'react'
import { FlowPageView } from './FlowPageView'
import { TwoAxisPage } from './TwoAxisPage'
import { useCodegraph } from './useCodegraph'

export function CodegraphPage() {
  const project = new URLSearchParams(window.location.search).get('project') ?? ''
  const { data, error, loading, reload } = useCodegraph(project)

  const [viewName, setViewName] = useState('baseline')
  const [openEntry, setOpenEntry] = useState('')

  // 内容区永远吃 baseline（diff 渲染未接入，见文件头）；usingDiff 只驱动提示条。
  const view = data?.baseline ?? null
  const stale = data?.stale ?? []
  const usingDiff = !!view && viewName !== 'baseline'

  const onViewChange = (nextView: string) => {
    console.info('[codegraph] assembly view change', { from: viewName, to: nextView })
    setViewName(nextView)
    setOpenEntry('')
  }

  const openFlowPage = (entryNodeId: string) => {
    console.info('[codegraph] assembly open flow page', { entryNodeId, viewName })
    setOpenEntry(entryNodeId)
  }

  const backToStructure = () => {
    console.info('[codegraph] assembly back to structure', { entryNodeId: openEntry, viewName })
    setOpenEntry('')
  }

  // 出错时**不能整页替换**：视图下拉与「刷新」都在工具条里，把工具条一起换掉，
  // 选中一个取不到数据的 diff 视图后就再也换不回基准视图了（本页没有别的入口，
  // 等于卡死）。所以错误只占内容区，工具条恒在。
  return (
    <div className="relative flex h-full flex-col">
      <div className="flex items-center gap-2 border-b px-3 py-2 text-sm">
        <label className="text-muted-foreground">视图</label>
        <select value={viewName} onChange={(e) => onViewChange(e.target.value)}
          className="rounded border px-1.5 py-0.5">
          <option value="baseline">基准 · {data?.baseline.meta.branch ?? ''}</option>
          {Object.entries(data?.views ?? {}).map(([k, v]) => <option key={k} value={k}>{v.view}</option>)}
        </select>
        {stale.length > 0 && (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700"
            title={stale.map((s) => `${s.id}: ${s.reason}`).join('\n')}>
            ⚠ {stale.length} 个节点疑似失鲜
          </span>
        )}
        {view && Object.keys(view.domains ?? {}).length === 0 && (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">
            该图未包含领域划分（扫描版本较旧）：重扫可获得两轴全景
          </span>
        )}
        <button onClick={reload} className="ml-auto rounded border px-2 py-0.5 text-xs">刷新</button>
      </div>
      {loading || error || !view ? (
        <CodegraphPlaceholder loading={loading} error={error} project={project} onRetry={reload} />
      ) : openEntry ? (
        <div data-flow-shell className="relative flex min-h-0 flex-1 flex-col">
          <div className="flex items-center gap-2 border-b px-3 py-1.5 text-sm">
            <button type="button" data-back-to-structure onClick={backToStructure}
              className="rounded border px-2 py-0.5 text-xs hover:bg-muted">
              ← 返回结构轴
            </button>
            <span className="text-xs text-muted-foreground">
              正在看程序入口 <code className="font-mono">{openEntry}</code> 的流程图
            </span>
          </div>
          {/* 行为轴与结构轴吃同一份 baseline；轴间切换是纯本地状态 */}
          <FlowPageView baseline={view} entryNodeId={openEntry} />
        </div>
      ) : (
        /* key=viewName：换视图即重挂——scope/组织/抽屉是上一层视图的语境，不作跨视图保留 */
        <TwoAxisPage key={viewName} baseline={view} best={data?.best} decls={data?.decls}
          target={data?.target} report={data?.report} onOpenEntry={openFlowPage} />
      )}
      {usingDiff && (
        <div data-compare-fallback role="status" className="pointer-events-none absolute bottom-3 left-3.5 z-30 rounded border bg-background/95 px-3 py-1 text-xs text-muted-foreground shadow-sm">
          分支视图的两轴渲染未接入（二期）：当前显示的仍是基准快照
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
