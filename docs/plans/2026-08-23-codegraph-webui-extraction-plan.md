# 实现计划：C1.4 codegraph 查看器搬迁

> 本计划服务于单轮 implement。它只描述实现者要落的代码、测试、发版卡点与真机验收，不在本节点直接实现功能。
> 本卡已拍板：graph tag 为 `graph/v0.4.0`；前端只保留实际 import 到的依赖，版本字符串逐项照抄 handoff `web/package.json`；不新增 JS 依赖白名单测试。

## 法定输入与已决裁决

实现者必须先通读以下文件，且以 contract 的冻结语义为最高优先级：

1. `docs/specs/2026-08-23-codegraph-webui-extraction-spec.md`：已批准的用户故事、等价搬迁边界、构建产物提交裁决。
2. `docs/contracts/2026-08-23-codegraph-webui-extraction-contract.md`：§1～§8 的导出面、wire 类型、宿主 HTTP 语义、冻结清单 1～73。
3. `docs/breakdowns/2026-08-23-codegraph-webui-extraction-breakdown.md`：T1～T4 的依赖 DAG、真机清单和边界归属。
4. `skills/defect-families/SKILL.md`：通用五族及序列化、枚举白名单、承重安全属性的对抗设问。

本次拍板已消除 breakdown 的 P1/P2 岔口：

- T3 发版 tag 固定为 `graph/v0.4.0`。新增 `webui` 包和新增 `FS() fs.FS` 可消费能力属于 minor 增量。
- `graph/webui/package.json` 只保留查看器实际需要的包；包名与版本字符串必须照抄 handoff `/root/.handoff/repos/handoff/web/package.json:14-48`，不得升版。保留清单见 T1 的完整 manifest 代码块。
- 不迁入 `@xterm/*`、`@radix-ui/*`、`lucide-react`、`react-router-dom`、`class-variance-authority`、`clsx`、`tailwind-merge`、ESLint 及 websocket 依赖；不在本卡增加 manifest 白名单测试，依赖面由 manifest、`npm ci` 和 review 约束。

## 范围、仓界与不可越界项

本计划覆盖三个子系统及一个外部卡点：

| 子系统 | 修改集合 | 类型 | 依赖方向 |
|---|---|---|---|
| charter `graph/webui` | `graph/webui/**`、`.github/workflows/ci.yml` | 逻辑型 | 只交付 `FS()` 与静态资源 |
| handoff 宿主 | handoff `go.mod`/`go.sum`、`internal/agentd/server.go`、`web/src/app/codegraph/CodegraphFrame.tsx`、`web/src/app/shell/Shell.tsx` | 逻辑型，含浏览器边界 | 消费 `graph/webui`，保留既有 provider API |
| 发版与 module consumer | tag、GitHub Actions、module zip、无 Node consumer | 边界型 | `graph/webui` → `graph/v0.4.0` → handoff |

明确不修改：

- handoff `internal/agentd/codegraph.go` 的两条 provider handler、错误字面值、状态码和响应体；只读核对其既有行为。
- handoff `internal/webui/**`；它仍负责 handoff 自有控制台根页面，和 `graph/webui` 是两个独立包。
- handoff `ProjectTree.tsx` 的代码图入口；只读确认它仍导航 `/codegraph`。
- `graph/codegraph/**` 的算法和 Go wire 结构；`graph/codegraph/types.go` 只作为 TS 镜像事实源。
- `codegraph/target.json`、`codegraph/diffs/<branch>.json`；charter 根没有目标图，本卡不伪造空图。
- `skills/**`、Git 配置、当前分支；不切分支、不 push。

### Interfaces：跨 task 逐字冻结

T1 Produces、T2 Produces、T3 Consumes、T4 Consumes 必须逐字符一致：

```go
// package github.com/Xsxdot/charter/graph/webui
func FS() fs.FS
```

```ts
export function fetchCodegraph(project: string): Promise<CodegraphResp>
export function fetchCodegraphSource(project: string, file: string, line: number, span = 40): Promise<CgSourceResp>
```

```tsx
export function CodegraphFrame({ project }: { project: string }): JSX.Element
```

```text
发布坐标：github.com/Xsxdot/charter/graph@graph/v0.4.0
宿主依赖：github.com/Xsxdot/charter/graph/webui
宿主挂载：/codegraph/app/
iframe URL：`/codegraph/app/?project=` + `encodeURIComponent(project)`
```

handoff 的 API consumer 继续消费以下精确 wire：

```text
GET /api/projects/{name}/codegraph
  -> { baseline: CgGraph, views: Record<string, CgDiff>, stale: CgStaleNode[] }
GET /api/projects/{name}/codegraph/source?file=<file>&line=<line>&span=<span>
  -> { file: string, from: number, lines: string[] }
```

## 基线证据与库行为事实

本计划出稿前在当前工作树真实执行了以下判据，执行者动手前必须重新执行并记录实际输出；命令失败先修正基线理解，不把失败当实现红因：

| 命令 | 基线结果 |
|---|---|
| `cd graph && go build ./...` | 退出码 0 |
| `cd graph && go vet ./...` | 退出码 0 |
| `cd graph && go test ./... -count=1` | `cli`、`codegraph` 为 `ok`，`webui` 无测试文件但编译通过，退出码 0 |
| `cd graph && gofmt -l .` | 无输出 |
| handoff web 临时副本 `npm ci` | 退出码 0，安装 290 packages，审计 0 vulnerabilities |
| handoff web 临时副本 `npm test` | Vitest 4.1.10；114 files passed、1103 tests passed |
| handoff web 临时副本 `npm run build` | `tsc -b` 与 Vite 6.4.3 构建成功，产出 `index.html`、JS、CSS |

基线临时副本位于 `/root/.handoff/tasks/b4c032a2-0df9-43ba-af5a-e8c28c89a6da/tmp/webui-baseline.q3yabd`，不属于提交物；它的 `node_modules` 不得复制进仓。

计划中引用的库行为来自本轮实读源码，而非凭记忆：

- Go `//go:embed` 必须紧邻包级变量，目录递归嵌入，`all:` 包含点号/下划线文件，未命中模式会让 build 失败：`/usr/local/go/src/embed/embed.go:41-99`。
- 未被 `//go:embed` 初始化的 `embed.FS` 是空 FS，且 `embed.FS` 实现 `io/fs.FS`：`/usr/local/go/src/embed/embed.go:141-148`。
- `fs.Sub` 对合法目录返回子树、非法路径返回 error：`/usr/local/go/src/io/fs/sub.go:20-45`。
- handoff 的 `request<T>` 使用 `fetch(path, { credentials: 'same-origin', ...init })` 并将非 2xx 转成 `ApiError`：handoff `web/src/api/client.ts:127-135`；两条 codegraph 请求模板是 `:600-610`。
- handoff 的 viewer 依赖版本以 `/root/.handoff/repos/handoff/web/package.json:14-48` 为准；Node 24、Vite、Vitest 的实跑结果已经写在上表。
- handoff SPA handler 的成功/错误行为、参数和既有结构化日志位于 `internal/agentd/webhandler.go:45-167`；静态 mux 与 `s.auth(mux)` 组装点位于 `internal/agentd/server.go:503-550`（行号以实现时目标 commit 复核为准，符号不变）。

## 全局实现纪律

- 每个逻辑 task 按“基线判据 → 写失败测试 → 跑红 → 最小实现 → 跑绿 → 触及包回归 → 提交”顺序执行。每个 numbered step 只做一个约 2～5 分钟动作。
- T1 只跑 `cd graph/webui && npm test`、`npm run build` 及其必要的单文件 Vitest；T2 只跑 `cd graph && go test ./webui`、`go vet ./webui`、`go build ./...` 与 workflow 漂移命令；T4 只跑 handoff `internal/agentd` 测试、handoff web typecheck/build 和 handoff 最小 Go 回归。全量测试只在 implement 三段律的最终终审执行一次，不归属于任何单个 task。
- 新文件头必须写职责和边界；导出函数写参数、返回值和注意事项；非显然逻辑写“为什么”。
- 关键节点必须可观察：viewer 使用浏览器现有的对象参数 `console.debug/info/warn` 形式记录入口、外部 fetch 前后、每条错误分支和成功统计，不打印 token/cookie；Go 宿主使用已有 `*slog.Logger` 记录静态挂载成功，`newSPAHandler` 已记录 fallback、405 和资源错误；纯 `webui.FS()` 不创建新 logger，因为 contract 只允许 `embed`/`io/fs` 标准库依赖。
- 日志内容不改变页面像素、API 响应或错误原文；测试不得因“日志存在”替代行为断言。

---

## T1：viewer 工程、wire 镜像、请求边界和测试迁移

### T1.1 文件集与 Interfaces

修改/新增文件仅限：

```text
graph/webui/index.html
graph/webui/package.json
graph/webui/package-lock.json
graph/webui/vite.config.ts
graph/webui/tsconfig.json
graph/webui/tsconfig.app.json
graph/webui/tsconfig.node.json
graph/webui/src/main.tsx
graph/webui/src/index.css
graph/webui/src/test/setup.ts
graph/webui/src/api/client.ts
graph/webui/src/api/client.test.ts
graph/webui/src/api/types.ts
graph/webui/src/app/codegraph/CallTree.tsx
graph/webui/src/app/codegraph/CallTree.test.tsx
graph/webui/src/app/codegraph/CodegraphPage.tsx
graph/webui/src/app/codegraph/CodegraphPage.test.tsx
graph/webui/src/app/codegraph/DetailPanel.tsx
graph/webui/src/app/codegraph/DetailPanel.test.tsx
graph/webui/src/app/codegraph/DomainDetail.tsx
graph/webui/src/app/codegraph/DomainDetail.test.tsx
graph/webui/src/app/codegraph/DomainPanorama.tsx
graph/webui/src/app/codegraph/DomainPanorama.test.tsx
graph/webui/src/app/codegraph/FocusGraph.tsx
graph/webui/src/app/codegraph/FocusGraph.test.tsx
graph/webui/src/app/codegraph/domainlayout.ts
graph/webui/src/app/codegraph/domainlayout.test.ts
graph/webui/src/app/codegraph/domains.ts
graph/webui/src/app/codegraph/domains.test.ts
graph/webui/src/app/codegraph/graphmath.ts
graph/webui/src/app/codegraph/graphmath.test.ts
graph/webui/src/app/codegraph/useCodegraph.ts
```

Consumes：

```text
handoff `web/src/app/codegraph/` 的 10 个 source + 9 个 test 文件；
charter `graph/codegraph/types.go:16-122` 的 JSON tag；
浏览器 `window.location.search`；
宿主的两条 GET API。
```

Produces：

```text
graph/webui 前端工程；
唯一 viewer client 导出 `fetchCodegraph(project: string): Promise<CodegraphResp>`；
唯一 viewer source 导出 `fetchCodegraphSource(project: string, file: string, line: number, span = 40): Promise<CgSourceResp>`；
`CodegraphPage` 从自身 URL 的 `?project=` 取项目名；空项目不发整图请求；
真实 `Response.json()` transport 回归覆盖缺失字段与零值。
```

### T1.2 基线判据（先跑）

1. 在 handoff web 的干净副本执行 `npm ci`、`npm test`、`npm run build`；预期是上表的 114 files/1103 tests 全绿、build 成功。实现者使用当前目标 commit 的 handoff 源，不把旧 `node_modules` 或旧 `dist` 当证据。
2. 在 charter 当前工作树执行 `cd graph && go test ./... -count=1`；预期为现有 `cli`/`codegraph` 绿和 `webui` 编译通过。
3. 执行 `find /root/.handoff/repos/handoff/web/src/app/codegraph -maxdepth 1 -type f | sort`，逐名确认 10 个 source 与 9 个 test；预期测试文件名完整为 `CallTree.test.tsx`、`CodegraphPage.test.tsx`、`DetailPanel.test.tsx`、`DomainDetail.test.tsx`、`DomainPanorama.test.tsx`、`FocusGraph.test.tsx`、`domainlayout.test.ts`、`domains.test.ts`、`graphmath.test.ts`。

### T1.3 失败测试与最小实现步骤

1. 建目标目录，并以源仓的完整文件为输入执行确定性复制；不要手写重排 19 个既有 viewer 文件。实现者在 handoff 仓 checkout 目标 commit 后执行：

```bash
mkdir -p graph/webui/src/app/codegraph graph/webui/src/api graph/webui/src/test
git -C /root/.handoff/repos/handoff show 7adeb8f9:web/src/app/codegraph/CallTree.tsx > graph/webui/src/app/codegraph/CallTree.tsx
git -C /root/.handoff/repos/handoff show 7adeb8f9:web/src/app/codegraph/CallTree.test.tsx > graph/webui/src/app/codegraph/CallTree.test.tsx
git -C /root/.handoff/repos/handoff show 7adeb8f9:web/src/app/codegraph/DetailPanel.tsx > graph/webui/src/app/codegraph/DetailPanel.tsx
git -C /root/.handoff/repos/handoff show 7adeb8f9:web/src/app/codegraph/DetailPanel.test.tsx > graph/webui/src/app/codegraph/DetailPanel.test.tsx
git -C /root/.handoff/repos/handoff show 7adeb8f9:web/src/app/codegraph/DomainDetail.tsx > graph/webui/src/app/codegraph/DomainDetail.tsx
git -C /root/.handoff/repos/handoff show 7adeb8f9:web/src/app/codegraph/DomainDetail.test.tsx > graph/webui/src/app/codegraph/DomainDetail.test.tsx
git -C /root/.handoff/repos/handoff show 7adeb8f9:web/src/app/codegraph/DomainPanorama.tsx > graph/webui/src/app/codegraph/DomainPanorama.tsx
git -C /root/.handoff/repos/handoff show 7adeb8f9:web/src/app/codegraph/DomainPanorama.test.tsx > graph/webui/src/app/codegraph/DomainPanorama.test.tsx
git -C /root/.handoff/repos/handoff show 7adeb8f9:web/src/app/codegraph/FocusGraph.tsx > graph/webui/src/app/codegraph/FocusGraph.tsx
git -C /root/.handoff/repos/handoff show 7adeb8f9:web/src/app/codegraph/FocusGraph.test.tsx > graph/webui/src/app/codegraph/FocusGraph.test.tsx
git -C /root/.handoff/repos/handoff show 7adeb8f9:web/src/app/codegraph/domainlayout.ts > graph/webui/src/app/codegraph/domainlayout.ts
git -C /root/.handoff/repos/handoff show 7adeb8f9:web/src/app/codegraph/domainlayout.test.ts > graph/webui/src/app/codegraph/domainlayout.test.ts
git -C /root/.handoff/repos/handoff show 7adeb8f9:web/src/app/codegraph/domains.ts > graph/webui/src/app/codegraph/domains.ts
git -C /root/.handoff/repos/handoff show 7adeb8f9:web/src/app/codegraph/domains.test.ts > graph/webui/src/app/codegraph/domains.test.ts
git -C /root/.handoff/repos/handoff show 7adeb8f9:web/src/app/codegraph/graphmath.ts > graph/webui/src/app/codegraph/graphmath.ts
git -C /root/.handoff/repos/handoff show 7adeb8f9:web/src/app/codegraph/graphmath.test.ts > graph/webui/src/app/codegraph/graphmath.test.ts
git -C /root/.handoff/repos/handoff show 7adeb8f9:web/src/app/codegraph/useCodegraph.ts > graph/webui/src/app/codegraph/useCodegraph.ts
git -C /root/.handoff/repos/handoff show 7adeb8f9:web/src/app/codegraph/CodegraphPage.tsx > graph/webui/src/app/codegraph/CodegraphPage.tsx
git -C /root/.handoff/repos/handoff show 7adeb8f9:web/src/app/codegraph/CodegraphPage.test.tsx > graph/webui/src/app/codegraph/CodegraphPage.test.tsx
```

   这段命令是完整的迁移清单；源仓固定为当前环境的 `/root/.handoff/repos/handoff`，不允许据此新增第二份 viewer。

2. 在 `graph/webui/src/app/codegraph/CodegraphPage.test.tsx` 先让迁移后的测试变红：删除 `useProjectTree` mock，设置 `window.history.replaceState({}, '', '/?project=demo')`，把“项目下拉仍在”的断言改成“URL project 被使用、页面只剩视图 combobox”的断言；此时源代码仍 import `useProjectTree`，预期红因是模块路径/项目选择行为不匹配，而不是 Vitest 启动失败。保留下列逐条断言：
   - URL `?project=demo` 下三态下钻仍能进入领域全景、子领域全景、叶子树+图。
   - `domains` 缺失时仍显示“未包含领域划分”，不得按包名构造领域。
   - “未生成代码图”只显示空态和刷新按钮，不显示“取代码图失败”；真错误原文仍显示且点击重试会调用 `reload`；加载中不提前显示空态。
   - 空 `?project=` 时 `fetchCodegraph` mock 调用次数为 0，页面仍可渲染空状态。
   - 空项目不显示项目下拉；视图下拉仍可在数据存在时选择 baseline/branch。
3. 最小修改 `CodegraphPage.tsx`：移除 `useProjectTree` import、`tree`、`projects`、`project` state 和 `active` fallback；新增以下完整入口代码，并把原有 `active` 用法替换为 `project`：

```tsx
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
    setScope(next); setSelDomain(''); setSelEdge(''); setFoci([])
    setHist([]); setHistIdx(-1); setOpen(new Set()); setSelected('')
  }
  const enterNode = (id: string) => {
    if (!view) return
    const path = nodeDomainPathOf(view, id)
    goScope(path.length ? path[path.length - 1] : null)
    setFoci([id]); setHist([[id]]); setHistIdx(0); setSelected(id)
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b px-3 py-2 text-sm">
        <label className="text-muted-foreground">视图</label>
        <select value={viewName} onChange={(e) => { setViewName(e.target.value); goScope(null) }} className="rounded border px-1.5 py-0.5">
          <option value="baseline">基准 · {data?.baseline.meta.branch ?? ''}</option>
          {Object.entries(data?.views ?? {}).map(([k, v]) => <option key={k} value={k}>{v.view}</option>)}
        </select>
        {data && data.stale.length > 0 && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700" title={data.stale.map((s) => `${s.id}: ${s.reason}`).join('\n')}>⚠ {data.stale.length} 个节点疑似失鲜</span>}
        {single && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">该图未包含领域划分（扫描版本较旧）：重扫可获得领域全景</span>}
        <button onClick={reload} className="ml-auto rounded border px-2 py-0.5 text-xs">刷新</button>
      </div>
      {loading || error || !view ? <CodegraphPlaceholder loading={loading} error={error} project={project} onRetry={reload} /> : (
        <div className="relative flex min-h-0 flex-1">
          {!single && <div className="absolute left-3.5 top-2.5 z-30 inline-flex items-center gap-2 rounded-full border bg-background px-3.5 py-1 text-xs shadow-sm">
            {scope === null ? <><b>领域全景</b><span className="text-[11px] text-muted-foreground">点卡片看职责 · 点连线看谁调谁 · 进入 ▸ 下钻 · 空白拖动平移 · ⌘/⌃+滚轮缩放</span></> : <>
              <span className="cursor-pointer text-muted-foreground hover:underline" onClick={() => goScope(null)}>◀ 领域全景</span>
              {domainAncestors(view, scope).map((id, i, arr) => <span key={id} className="inline-flex items-center gap-2"><span className="text-muted-foreground">▸</span>{i === arr.length - 1 ? <><b>{view.domains[id]?.label}</b><span className="text-[11px] text-muted-foreground">{view.domains[id]?.kind}</span></> : <span className="cursor-pointer text-muted-foreground hover:underline" onClick={() => goScope(id)}>{view.domains[id]?.label}</span>}</span>)}
            </>}
          </div>}
          {pano ? <><DomainPanorama view={view} scope={scope} selectedDomain={selDomain} selectedEdge={selEdge} onSelectDomain={(id) => { setSelDomain(id); setSelEdge('') }} onSelectEdge={(k) => { setSelEdge(k); setSelDomain('') }} onEnter={goScope} /><DomainDetail view={view} scope={scope} domainId={selDomain} edgeKey={selEdge} onEnterNode={enterNode} onEnterDomain={goScope} /></> : <><CallTree view={view} foci={effFoci} open={open} scope={leafScope} onToggle={(id, o) => setOpen((s) => { const n = new Set(s); if (o) n.add(id); else n.delete(id); return n })} onFocus={onFocus} onCrossJump={enterNode} /><FocusGraph view={view} foci={effFoci} depth={depth} staleIds={staleIds} scope={leafScope} onDepth={setDepth} onFocus={onFocus} onSelect={setSelected} onCrossJump={enterNode} canBack={histIdx > 0} canFwd={histIdx < hist.length - 1} onBack={() => { setHistIdx(histIdx - 1); setFociWithHist(hist[histIdx - 1], true) }} onFwd={() => { setHistIdx(histIdx + 1); setFociWithHist(hist[histIdx + 1], true) }} /><DetailPanel project={project} view={view} nodeId={selected || effFoci[effFoci.length - 1] || ''} stale={staleIds} onJump={enterNode} /></>}
        </div>
      )}
    </div>
  )
}

const NOT_SCANNED = '未生成代码图'

function CodegraphPlaceholder({ loading, error, project, onRetry }: { loading: boolean; error: string; project: string; onRetry: () => void }) {
  if (loading) return <div className="p-6 text-sm text-muted-foreground">加载中…</div>
  const notScanned = !error || error.includes(NOT_SCANNED)
  return <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
    {notScanned ? <><p className="text-sm font-medium">{project ? `项目 ${project} 还没有代码图` : '还没有代码图'}</p><p className="max-w-md text-xs text-muted-foreground">代码图是扫描产物，落在项目仓库的 <code className="mx-1 rounded bg-muted px-1 py-0.5 font-mono">codegraph/baseline.json</code>。</p></> : <><p className="text-sm font-medium text-destructive">取代码图失败</p><p className="max-w-md break-all text-xs text-muted-foreground">{error}</p></>}
    <button type="button" onClick={onRetry} className="rounded border px-2.5 py-1 text-xs hover:bg-accent/60">重试</button>
  </div>
}
```

   代码块保留原有的下钻、焦点历史、详情和源码展示语义；实现者不得把 C1.3 的目标/现状对照、泳道或级联改造混入本次替换。若为了可读性恢复原文件中的完整中文注释，行为代码必须保持上述接口与状态转换不变。
4. 把 `useCodegraph.ts` 的完整实现替换为以下版本；它是 viewer 的入口日志和空项目门，成功/失败均带 project 与结果上下文，失败保留 `Error.message` 原文：

```ts
// useCodegraph —— 按 URL project 一次性取代码图；不轮询、不写本地状态。
import { useCallback, useEffect, useState } from 'react'
import { fetchCodegraph } from '../../api/client'
import type { CodegraphResp } from '../../api/types'

export function useCodegraph(project: string) {
  const [data, setData] = useState<CodegraphResp | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const reload = useCallback(() => {
    if (!project) {
      console.info('[codegraph] skip fetch', { project, reason: 'empty-project' })
      return
    }
    console.info('[codegraph] fetch start', { project })
    setLoading(true)
    setError('')
    fetchCodegraph(project)
      .then((next) => {
        console.info('[codegraph] fetch success', { project, views: Object.keys(next.views).length, stale: next.stale.length })
        setData(next)
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err)
        console.warn('[codegraph] fetch failed', { project, error: message })
        setData(null)
        setError(message)
      })
      .finally(() => setLoading(false))
  }, [project])
  useEffect(reload, [reload])
  return { data, error, loading, reload }
}
```

5. 将 handoff `web/src/api/client.ts:127-135,600-610` 的行为缩成以下完整 viewer client；`request` 不导出，viewer 对外只保留两条 GET 函数。每次 fetch 前后、网络错误和非 2xx 都带路径/状态日志；日志不得写 Authorization、cookie 或响应体秘密：

```ts
// client.ts —— codegraph viewer 的两条同源只读请求。
// 边界：不持有 token/cookie，不拼 host，不添加超时、重试或轮询。
import type { CgSourceResp, CodegraphResp } from './types'

class ApiError extends Error {
  readonly status: number
  readonly body: unknown
  constructor(status: number, message: string, body?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.body = body
  }
}

async function bodyOrError(resp: Response): Promise<{ detail: string; body: unknown }> {
  try {
    const body = (await resp.json()) as { error?: string }
    return { detail: body.error ?? '', body }
  } catch {
    return { detail: '', body: undefined }
  }
}

async function parseResponse<T>(path: string, resp: Response): Promise<T> {
  if (resp.status === 401) {
    console.warn('[codegraph] response unauthorized', { path, status: resp.status })
    throw new ApiError(401, '未授权：浏览器会话已失效，请重新执行 handoff console 兑换 cookie')
  }
  if (!resp.ok) {
    const { detail, body } = await bodyOrError(resp)
    console.warn('[codegraph] response failed', { path, status: resp.status, error: detail || resp.statusText })
    throw new ApiError(resp.status, detail || `agentd 返回 ${resp.status} ${resp.statusText}`, body)
  }
  const result = (await resp.json()) as T
  console.debug('[codegraph] response success', { path, status: resp.status })
  return result
}

async function request<T>(path: string): Promise<T> {
  console.debug('[codegraph] request', { path })
  let resp: Response
  try {
    resp = await fetch(path, { credentials: 'same-origin' })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.warn('[codegraph] transport failed', { path, error: message })
    throw new ApiError(0, `无法连接 agentd（反代失败？）：${message}`)
  }
  return parseResponse<T>(path, resp)
}

export function fetchCodegraph(project: string): Promise<CodegraphResp> {
  return request<CodegraphResp>(`/api/projects/${encodeURIComponent(project)}/codegraph`)
}

export function fetchCodegraphSource(project: string, file: string, line: number, span = 40): Promise<CgSourceResp> {
  return request<CgSourceResp>(
    `/api/projects/${encodeURIComponent(project)}/codegraph/source?file=${encodeURIComponent(file)}&line=${line}&span=${span}`,
  )
}
```

6. 将 `graph/codegraph/types.go:16-122` 的 JSON tag 逐项投影成下面完整 `types.ts`；不得把 optional 字段改成 `null`，不得删除旧字段：

```ts
export interface CgMeta { project: string; branch: string; commit: string; scannedAt: string; generator: string }
export interface CgTestRef { name: string; file: string; snippet?: string }
export interface CgDomain { label: string; kind: string; summary?: string; desc?: string; parent?: string }
export interface CgContainer { label: string; kind: string; entry?: boolean; domain?: string }
export interface CgNode {
  kind: 'entry' | 'func' | 'model'; container: string; order?: number; name: string; file: string; line: number
  signature?: string; signatureOld?: string; params?: string[][]; returns?: string; summary?: string
  tests?: CgTestRef[]; fields?: string[][]; unscanned?: boolean; projScanned?: boolean
}
export interface CgLifecycleRef { who: string; model: string; kind: 'creator' | 'writer'; field?: string }
export interface CgGraph {
  meta: CgMeta; domains?: Record<string, CgDomain>; containers: Record<string, CgContainer>; nodes: Record<string, CgNode>
  edges: [string, string][]; implements?: [string, string][]; projections?: [string, string, string][]; lifecycle?: CgLifecycleRef[]
}
export interface CgDiff {
  view: string; base?: string; summary?: string; containersAdded?: Record<string, CgContainer>
  nodesAdded?: Record<string, CgNode>; nodesModified?: Record<string, CgNode>; nodesDeleted?: string[]
  edgesAdded?: [string, string][]; edgesDeleted?: [string, string][]
  implementsAdded?: [string, string][]; implementsDeleted?: [string, string][]
  projectionsAdded?: [string, string, string][]; projectionsDeleted?: [string, string, string][]
  lifecycleAdded?: CgLifecycleRef[]; lifecycleDeleted?: CgLifecycleRef[]
}
export interface CgStaleNode { id: string; file: string; line: number; reason: string }
export interface CodegraphResp { baseline: CgGraph; views: Record<string, CgDiff>; stale: CgStaleNode[] }
export interface CgSourceResp { file: string; from: number; lines: string[] }
```

7. 建立 `src/index.css`，只携带 viewer 实际用到的 token；完整内容如下，不能依赖 handoff 根页面的 CSS：

```css
@import 'tailwindcss';

:root {
  --background: oklch(1 0 0);
  --foreground: oklch(0.196 0 0);
  --primary: oklch(0.205 0 0);
  --primary-foreground: oklch(0.985 0 0);
  --muted: oklch(0.97 0 0);
  --muted-foreground: oklch(0.569 0 0);
  --accent: oklch(0.97 0 0);
  --destructive: oklch(0.577 0.245 27.325);
  --border: oklch(0.922 0 0);
  --ring: oklch(0.708 0 0);
  --font-sans: ui-sans-serif, system-ui, -apple-system, 'Segoe UI', 'Noto Sans', 'PingFang SC', sans-serif;
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-destructive: var(--destructive);
  --color-border: var(--border);
  --color-ring: var(--ring);
  --font-sans: var(--font-sans);
}

@layer base {
  * { @apply border-border outline-ring/50; }
  body { @apply bg-background text-foreground; font-family: var(--font-sans); margin: 0; }
  #root { min-height: 100vh; }
}
```

8. 建立以下完整工程壳文件；这些文件是新文件，头部注释说明职责和相对 base 的原因：

```html
<!-- graph/webui/index.html：viewer 的唯一 HTML 入口；不写死宿主挂载路径。 -->
<!doctype html>
<html lang="zh-CN">
  <head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /><title>Codegraph</title></head>
  <body><div id="root"></div><script type="module" src="./src/main.tsx"></script></body>
</html>
```

```tsx
// main.tsx：只组装 viewer 页面；静态资源 base 由 Vite 配置改写。
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { CodegraphPage } from './app/codegraph/CodegraphPage'

createRoot(document.getElementById('root')!).render(<StrictMode><CodegraphPage /></StrictMode>)
```

```ts
// vite.config.ts：开发时可选反代宿主 API，生产产物使用相对 base，因而可挂到任意同源路径。
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

const agentdTarget = process.env.AGENTD_URL ?? 'http://127.0.0.1:7777'

export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  server: { proxy: { '/api': { target: agentdTarget } } },
  test: { environment: 'jsdom', setupFiles: ['./src/test/setup.ts'] },
})
```

```json
{
  "files": [],
  "references": [{ "path": "./tsconfig.app.json" }, { "path": "./tsconfig.node.json" }]
}
```

```json
{
  "compilerOptions": {
    "target": "ES2022", "useDefineForClassFields": true, "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext", "skipLibCheck": true, "resolveJsonModule": true, "moduleResolution": "bundler",
    "allowImportingTsExtensions": true, "verbatimModuleSyntax": true, "moduleDetection": "force", "noEmit": true,
    "strict": true, "noUnusedLocals": true, "noUnusedParameters": true, "erasableSyntaxOnly": true,
    "noFallthroughCasesInSwitch": true, "noUncheckedSideEffectImports": true
  },
  "include": ["src"]
}
```

```json
{
  "compilerOptions": {
    "target": "ES2022", "lib": ["ES2023"], "module": "ESNext", "skipLibCheck": true,
    "moduleResolution": "bundler", "allowImportingTsExtensions": true, "verbatimModuleSyntax": true,
    "moduleDetection": "force", "noEmit": true, "strict": true, "noUnusedLocals": true,
    "noUnusedParameters": true, "erasableSyntaxOnly": true, "noFallthroughCasesInSwitch": true,
    "noUncheckedSideEffectImports": true
  },
  "include": ["vite.config.ts"]
}
```

```ts
// src/test/setup.ts：Vitest + RTL 的清理与 fake-timer 桥；不引入 handoff 全局状态。
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

afterEach(() => cleanup())
vi.stubGlobal('jest', { advanceTimersByTime: (ms: number) => vi.advanceTimersByTime(ms) })
```

9. 写 `package.json` 的失败门：先用以下完整 manifest 覆盖手工迁移的旧 manifest，再运行 `npm ci`；若 lock 未随 manifest 重建，预期 `npm ci` 红。保留版本字符串逐项来自 handoff，未列出的包不加入：

```json
{
  "name": "codegraph-webui",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": { "dev": "vite", "build": "tsc -b && vite build", "test": "vitest run", "typecheck": "tsc -b" },
  "dependencies": {
    "@tailwindcss/vite": "^4.3.3",
    "react": "^19.1.0",
    "react-dom": "^19.1.0",
    "tailwindcss": "^4.3.3"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^7.0.1",
    "@testing-library/react": "^16.3.2",
    "@types/node": "^26.2.0",
    "@types/react": "^19.1.2",
    "@types/react-dom": "^19.1.2",
    "@vitejs/plugin-react": "^4.4.1",
    "jsdom": "^30.0.1",
    "typescript": "~5.8.3",
    "vite": "^6.3.5",
    "vitest": "^4.1.10"
  }
}
```

10. 以 `npm install --package-lock-only --ignore-scripts --no-audit --no-fund` 重建 `package-lock.json`，再执行 `npm ci --ignore-scripts --no-audit --no-fund`。随后用 Node 只读校验 manifest 的依赖键集合和版本字符串与上面代码块逐字相等；此校验是实现步骤，不新增提交的 JS 白名单测试。`package-lock.json` 必须提交，`node_modules` 必须被忽略且不得进入 diff。
11. 写 `src/api/client.test.ts` 的真实 transport 红测试。该测试必须真正返回 `Response`，让生产 `Response.json()` 走过序列化边界；完整代码如下：

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchCodegraph, fetchCodegraphSource } from './client'

const jsonResponse = (value: unknown) => new Response(JSON.stringify(value), { status: 200, headers: { 'Content-Type': 'application/json' } })

describe('codegraph JSON transport', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('保留新增 wire 字段，并区分缺失 from 与 from=0', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    fetchMock.mockResolvedValueOnce(jsonResponse({
      baseline: {
        meta: { project: 'demo', branch: 'main', commit: 'c', scannedAt: 'now', generator: 'test' },
        containers: {},
        nodes: { n: { kind: 'func', container: 'c', name: 'N', file: 'x.go', line: 1 } },
        edges: [],
        implements: [['impl', 'iface']],
        projections: [['p', 'm', 'typed']],
        lifecycle: [{ who: 'creator', model: 'M', kind: 'creator' }],
      },
      views: { branch: {
        view: 'branch',
        containersAdded: { c2: { label: 'C2', kind: 'svc' } },
        implementsAdded: [['impl2', 'iface2']], implementsDeleted: [['impl0', 'iface0']],
        projectionsAdded: [['p2', 'm2', 'handroll']], projectionsDeleted: [['p0', 'm0', 'twin']],
        lifecycleAdded: [{ who: 'writer', model: 'M', kind: 'writer', field: 'state' }],
        lifecycleDeleted: [{ who: 'old', model: 'M', kind: 'writer' }],
      } },
      stale: [],
    }))
    const graph = await fetchCodegraph('a/b 中文')
    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/projects/a%2Fb%20%E4%B8%AD%E6%96%87/codegraph', { credentials: 'same-origin' })
    expect(graph.baseline.implements).toEqual([['impl', 'iface']])
    expect(graph.baseline.projections).toEqual([['p', 'm', 'typed']])
    expect(graph.baseline.lifecycle?.[0]?.kind).toBe('creator')
    expect(graph.baseline.nodes.n.projScanned).toBeUndefined()
    expect(graph.views.branch.containersAdded?.c2.label).toBe('C2')
    expect(graph.views.branch.implementsAdded).toEqual([['impl2', 'iface2']])
    expect(graph.views.branch.projectionsAdded).toEqual([['p2', 'm2', 'handroll']])
    expect(graph.views.branch.lifecycleAdded?.[0]?.field).toBe('state')

    fetchMock.mockResolvedValueOnce(jsonResponse({ file: 'x.go', lines: [] }))
    const missing = await fetchCodegraphSource('demo', 'x.go', 0)
    expect((missing as unknown as { from?: number }).from).toBeUndefined()
    fetchMock.mockResolvedValueOnce(jsonResponse({ file: 'x.go', from: 0, lines: [] }))
    const zero = await fetchCodegraphSource('demo', 'x.go', 0)
    expect(zero.from).toBe(0)
    expect(fetchMock).toHaveBeenNthCalledWith(3, '/api/projects/demo/codegraph/source?file=x.go&line=0&span=40', { credentials: 'same-origin' })
  })
})
```

12. 跑单测红：`cd graph/webui && npm test -- src/api/client.test.ts`。红因必须是缺文件/类型/请求行为，不得是没有 jsdom 或测试命令不存在。
13. 实现上述最小 client/types 与 URL project 读取后，先跑 `npm test -- src/api/client.test.ts src/app/codegraph/CodegraphPage.test.tsx` 转绿；再运行 `npm test`，确保 9 个迁入测试逐个被收集。
14. 在 `DetailPanel.tsx` 的既有 source fetch catch 中补一条对象参数日志 `console.warn('[codegraph] source fetch failed', { project: props.project, file: n.file, line: n.line, error: message })`，继续渲染 `from: 0` 的失败占位，不吞掉日志；在 `client.ts` 的非 2xx、401、网络异常分支保留响应 error 原文。
15. 执行结构 grep：

```bash
! rg -n "useProjectTree|react-router|@xterm|@radix-ui|lucide-react|class-variance-authority|tailwind-merge|fetchProject|projects\?" graph/webui/src
rg -n "encodeURIComponent\(project\)|credentials: 'same-origin'|fetchCodegraphSource\(project: string, file: string, line: number, span = 40\)" graph/webui/src/api graph/webui/src/app/codegraph
```

   第一条只允许 codegraph client 中出现 `/api/projects/${encodeURIComponent(project)}/...`，不允许项目列表 API；第二条必须命中两个 client 签名和同源凭据。
16. 跑绿与包内回归：`cd graph/webui && npm test && npm run typecheck && npm run build`。构建必须生成 `dist/index.html`，产物中的入口引用必须是相对路径，不得出现 `/codegraph/app/`。
17. 提交 T1：`git add graph/webui && git commit -m "feat(codegraph): migrate viewer into graph webui"`。提交前确认 `git diff --cached --name-only` 只含 T1 文件集。

### T1.4 测试范围与缺陷族验收

测试范围仅为 `graph/webui` 的 9 个迁入 test 文件、`src/api/client.test.ts`、typecheck、build；不跑 handoff 全量，不添加 JS 依赖白名单测试。

允许的 harness 复用例外：9 个迁入测试必须照抄 handoff 各自现有夹具；本计划不重复粘贴 9 个完整既有测试文件，而将每条可判断断言列全：三态下钻、无 domains 降级、未扫描/真错误/加载中、URL project、空 project 不请求、source 参数 `demo/svc/server.go/4`、图数学反面用例全部保留。测试文件名与源 commit 已在 T1.3 步骤 1 完整列出。

| 缺陷族 | T1 结论与验收锁 |
|---|---|
| 生命周期/状态机中断 | viewer 只做一次性 GET，无轮询/写入/子进程；空 project 不发请求。Vitest 中断不会生成服务端孤儿，`npm ci` 临时依赖不入仓。 |
| 静默失败/误导报错 | 401、非 2xx、网络失败保留上下文；未扫描和真错误分开渲染；source 失败仍可见“源码读取失败”。对应反面断言在 `CodegraphPage.test.tsx` 与 `client.test.ts`。 |
| 跨平台假设 | URL 段与 file query 只用 `encodeURIComponent`；Vite 用相对 base；不使用 OS 路径。浏览器/桌面薄壳行为列入 T4 真机。 |
| 假红/假绿测试 | 真实 `Response.json()` 回归、缺失/零值对照、9 文件收集数量、build 产物相对路径共同防止只编译不消费。 |
| 门禁绕过 | client 只有两条同源 GET，不读 token、不写 cookie、不加旁路 fetch；grep 命令锁住入口。 |
| 序列化边界 | `graph/codegraph/types.go` → provider JSON → `Response.json()` → `types.ts` → `graphmath/useCodegraph/DetailPanel` 全链列入；`client.test.ts` 断言 `projScanned`、`implements`、`projections`、`lifecycle`、`containersAdded` 不丢，`from` 缺失与 0 可区分。 |
| 枚举新值 | `Node.kind` 仍只有 `entry/func/model`，`lifecycle.kind` 只镜像 `creator/writer`；9 个既有图算法测试继续覆盖 switch/分支。 |
| 承重安全属性 | viewer 不持凭据；同源 cookie 和静态 auth 由 T4 锁定。T1 能变红的属性是“空 project 不 fetch”和“错误原文不吞”。 |

---

## T2：正式 embed、资源测试、提交 dist 与 CI 漂移门

### T2.1 文件集与 Interfaces

修改/新增文件：

```text
graph/webui/webui.go
graph/webui/webui_test.go
graph/webui/dist/**
.github/workflows/ci.yml
.gitignore（只读确认，不改）
graph/cli/deps_test.go（只读确认，不改）
```

Consumes：T1 的 `graph/webui/dist/` 构建输入、Go 标准库 `embed.FS`/`fs.Sub`。

Produces：

```go
package webui
func FS() fs.FS
```

其 FS 根直接含 `index.html`、JS、CSS，不含外层 `dist/`；不导出 HTTP handler、`Embedded()`、build tag 分支或第三方依赖。

### T2.2 基线判据与失败测试

1. 先跑 `cd graph && go test ./webui -count=1 && go vet ./webui`；预期当前 webui 编译通过但无测试文件。
2. 先跑 `git check-ignore -v graph/webui/dist/index.html`；预期退出码非 0，证明 dist 没被忽略。若命中 `.gitignore`，先停止并问协调者，因为改忽略规则会改变 contract 边界。
3. 新建 `graph/webui/webui_test.go`，先用当前空 `assets embed.FS` 写下完整测试；运行 `cd graph && go test ./webui -run TestEmbeddedFSHasRealAssets -count=1`，预期因 `index.html` 不存在而红。测试完整代码：

```go
// Package webui tests the committed static-resource boundary, not HTTP routing.
package webui

import (
  "errors"
  "io/fs"
  "testing"
)

func TestEmbeddedFSHasRealAssets(t *testing.T) {
  assets := FS()
  info, err := fs.Stat(assets, "index.html")
  if err != nil { t.Fatalf("FS 根缺少 index.html: %v", err) }
  if info.IsDir() { t.Fatal("FS 根的 index.html 不能是目录") }

  files := 0
  if err := fs.WalkDir(assets, ".", func(path string, entry fs.DirEntry, walkErr error) error {
    if walkErr != nil { return walkErr }
    if !entry.IsDir() { files++ }
    return nil
  }); err != nil { t.Fatalf("遍历嵌入资源失败: %v", err) }
  if files < 3 { t.Fatalf("嵌入资源文件数=%d，期望至少 index.html、JS、CSS 三个文件", files) }

  if _, err := fs.Stat(assets, "dist"); !errors.Is(err, fs.ErrNotExist) {
    t.Fatalf("FS 根不应暴露外层 dist 目录，stat error=%v", err)
  }
}
```

### T2.3 最小实现与 CI

4. 用以下完整 `webui.go` 替换空壳；`//go:embed` 必须直接贴在变量声明前，`fs.Sub` 不可达错误必须 panic：

```go
// Package webui embeds the codegraph viewer and exposes only an fs.FS boundary.
//
// 边界：不提供 HTTP handler、路由、鉴权或网络客户端；这些语义由宿主负责。
package webui

import (
  "embed"
  "io/fs"
)

// distFS holds the committed Vite output. The all: prefix preserves dot files.
//go:embed all:dist
var distFS embed.FS

// FS returns a read-only viewer filesystem whose root contains index.html.
// It never returns nil and panics only if the compile-time embedded tree is malformed.
func FS() fs.FS {
  sub, err := fs.Sub(distFS, "dist")
  if err != nil { panic("webui: embedded dist missing: " + err.Error()) }
  return sub
}
```

5. 跑 `cd graph && go test ./webui -run TestEmbeddedFSHasRealAssets -count=1` 转绿；再执行 `go test ./webui -count=1`。
6. 新建 `.github/workflows/ci.yml`，完整内容如下。CI 先备份 Git 中的 dist，再运行 `npm run build`，最后递归逐字节比较；比较失败必须返回非零。workflow 不改 release workflow，不新增发布权限：

```yaml
name: graph-webui

on:
  push:
    paths: ["graph/webui/**", ".github/workflows/ci.yml"]
  pull_request:
    paths: ["graph/webui/**", ".github/workflows/ci.yml"]

jobs:
  webui:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: npm
          cache-dependency-path: graph/webui/package-lock.json
      - name: Install viewer dependencies
        working-directory: graph/webui
        run: npm ci
      - name: Run viewer tests
        working-directory: graph/webui
        run: npm test
      - name: Preserve committed dist
        working-directory: graph/webui
        run: |
          cp -a dist "$RUNNER_TEMP/committed-dist"
      - name: Rebuild viewer
        working-directory: graph/webui
        run: npm run build
      - name: Reject stale committed dist
        working-directory: graph/webui
        run: diff -ruN "$RUNNER_TEMP/committed-dist" dist
```

7. 跑 workflow 等价本地命令：`cd graph/webui && npm ci && npm test && npm run build`；把 `dist` 变更前复制到临时目录后执行 `diff -ruN`，预期零差异。执行一次可恢复变异：仅修改临时副本中的 `index.html` 一个字节，`diff -ruN` 必须非零；恢复临时副本后必须再次为零。不得修改提交中的 dist 来伪造测试。
8. 跑 `cd graph && go test ./... -count=1 && go vet ./... && go build ./...`；预期 Go release 无 Node 依赖且全绿。
9. 静态检查：`rg -n "http|net/http|Embedded\(|go:build|github.com/" graph/webui/webui.go` 只允许命中注释中的 HTTP/Embedded 否定文字和标准库 import；`go list -deps ./webui` 的非标准库依赖为空；`graph/cli/deps_test.go` 与 `graph/go.mod` 的 cobra `v1.10.2` 不变。
10. 提交 T2：`git add graph/webui/webui.go graph/webui/webui_test.go graph/webui/dist .github/workflows/ci.yml && git commit -m "feat(codegraph): embed committed webui assets"`。提交前确认 `git status --short` 没有 `node_modules` 或未提交构建副产物。

### T2.4 测试范围与缺陷族验收

测试范围只含 `graph/webui` Go 包、T1 的 viewer test/build、dist 逐字节比较和 charter Go 全构建；不执行 handoff 测试，不改 release workflow。

| 缺陷族 | T2 结论与验收锁 |
|---|---|
| 生命周期/状态机中断 | `FS()` 是只读静态字节，不启动进程/服务；CI 中断不创建仓库运行时资源。dist 与源码不同步在发布前被 CI 阻断。 |
| 静默失败/误导报错 | `index.html`、文件数≥3、根无 `dist` 三个反面断言同时锁住非空 embed；漂移比较返回非零，不以 Go 编译成功冒充完成。 |
| 跨平台假设 | go:embed 使用 `/` 逻辑路径，标准库实现与 Go release 跨平台；GitHub runner 的 Node 24/Linux 是外部现实，列入真机清单。 |
| 假红/假绿测试 | 变异 dist 一个字节必须让 diff 红；仅改源码不重新生成提交 dist 也必须红。 |
| 门禁绕过 | 静态资源无新的写/执行入口；CI 使用 checkout 权限，不扩张 release `contents:write`；`dist` 不进 ignore。 |
| 序列化边界 | `dist/**` → `embed.FS` → `fs.Sub` → host SPA 是资源投影链；测试锁 index、资源数量和根路径，不能只看字节总数。 |
| 枚举新值 | 本 task 不新增业务枚举；`graph/cli/deps_test.go` 继续锁 Go 第三方依赖白名单，cobra 仍为 `v1.10.2`。 |
| 承重安全属性 | 承重不变式是“FS 非空、根形状正确、dist 已提交、源码/产物一致”；四个属性均有能变红的测试或 diff。 |

---

## T3：graph/v0.4.0 发版与 clean module consumer 卡点

**本 task 由协调者执行，不派发；它会写 tag、触碰 module proxy/GitHub Release 等外部状态，执行者不得自行执行。** T4 不得在 T3 的四项外部证据齐全前把 handoff 升版写成完成。

### T3.1 文件/外部证据集与 Interfaces

机内只读证据文件：`graph/go.mod`、`graph/webui/dist/**`、`.github/workflows/release.yml`；消费侧文件：handoff `go.mod`、`go.sum`。外部证据：Git tag `graph/v0.4.0`、GitHub Actions workflow、module zip、无 Node clean consumer。

Consumes：T2 的提交 commit，`webui.FS() fs.FS`，release workflow 既有六平台构建。

Produces：

```text
github.com/Xsxdot/charter/graph@graph/v0.4.0 可由 module proxy 下载；
zip 中含 graph/webui/dist/**；
无 Node 的 clean consumer 可 import github.com/Xsxdot/charter/graph/webui 并读取 FS；
handoff 后续可将 graph require 升到 v0.4.0，且不需要 replace。
```

### T3.2 协调者步骤

1. 先审 T1/T2 commit 的 diff 与 `git status --short`，确认 `graph/webui/dist/index.html` 已入 Git、`webui.go` 无 build tag/空 embed、T2 的 `go test ./...` 与 viewer test/build 证据齐全；发现缺证据就退回 T2。
2. 在 charter 主仓创建并推送精确 tag `graph/v0.4.0`；tag 不改写历史，不新增 patch tag，不以本地 HEAD 代替远端 tag。
3. 等待既有 `.github/workflows/release.yml` 完整成功；逐项记录 Go vet、Go test、六平台 archive、checksums，确认 release job 没有 Node 安装步骤。
4. 在干净临时目录创建最小 consumer，完整代码如下；`go.mod` 不含 `replace`，`go mod download` 必须从远端坐标下载：

```go
// /tmp/c14-consumer/main.go
package main

import (
  "fmt"
  "io/fs"

  "github.com/Xsxdot/charter/graph/webui"
)

func main() {
  assets := webui.FS()
  info, err := fs.Stat(assets, "index.html")
  if err != nil { panic(err) }
  fmt.Println(info.Name())
}
```

```text
module c14-consumer

go 1.26.1

require github.com/Xsxdot/charter/graph v0.4.0
```

5. 在 clean consumer 创建独立 `GOMODCACHE`，执行以下完整命令；预期 `go run` 输出 `index.html`。检查这个新 cache 或下载 zip 确认存在 JS/CSS；只读当前 charter 工作树或旧 cache 不算证据：

```bash
consumer_cache="$(mktemp -d)"
GOPROXY=https://proxy.golang.org,direct GOMODCACHE="$consumer_cache" go mod download github.com/Xsxdot/charter/graph@v0.4.0
GOMODCACHE="$consumer_cache" go build ./...
GOMODCACHE="$consumer_cache" go run .
```
6. 在 handoff 分支将 `github.com/Xsxdot/charter/graph` 升为 `v0.4.0`，运行 `go mod tidy`；`go.mod` 不得含 `replace`，`go.sum` 必须记录 `v0.4.0`。这里版本升级与宿主代码修改由 T4 同一 handoff change 收口，T3 只验证发布坐标可消费。

### T3.3 边界型显式真机清单

以下每条必须由协调者在真实外部环境执行并留原始输出；本地模拟不能标绿：

1. tag `graph/v0.4.0` 的 release workflow 六平台 assets、checksums、job 全绿。
2. 无 Node 的 clean consumer 下载 module zip，编译并读到 `index.html`、至少一个 JS、至少一个 CSS。
3. consumer `go.mod` 无 `replace`，`go list -m all` 指向 `github.com/Xsxdot/charter/graph v0.4.0`。
4. handoff 升版后的 `go mod tidy` 不回退旧 graph 版本。

### T3.4 缺陷族验收

| 缺陷族 | T3 结论 |
|---|---|
| 生命周期/状态机中断 | tag→workflow→proxy→consumer 是外部状态机；任何一步中断都只能停在 waiting review，不能把 tag 存在当作成功。 |
| 静默失败/误导报错 | clean consumer 的真实编译与 FS 读取反证“tag 存在但 zip 缺 dist”；保留下载、checksums、build 原始输出。 |
| 跨平台假设 | module zip、六平台 archive、Windows 路径和 proxy 是外部边界，全部列入真机；不以当前 Linux build 代替。 |
| 假红/假绿测试 | clean consumer 不依赖当前 workspace、replace 或旧 cache；FS 读 index/JS/CSS 三项反面断言逐条成立。 |
| 门禁绕过 | 发布写权限由协调者既有 release 流程承担；T3 不改变 CI 权限、不绕过 module proxy、不写本地 replace。 |
| 序列化边界 | Git tree→module zip→module cache→`embed.FS` 的真实打包边界由 consumer 读资源锁住。 |
| 枚举新值 | 无业务枚举；版本字符串只流经 release/module 解析，不进入 viewer switch。 |
| 承重安全属性 | 承重属性是 module 可下载、dist 随包、无 replace、资产齐全；四项均有独立外部证据。 |

---

## T4：handoff 同源挂载、iframe 薄壳与 full-page 修复

### T4.1 文件集与 Interfaces

handoff 侧修改集合：

```text
handoff/go.mod
handoff/go.sum
handoff/internal/agentd/server.go
handoff/web/src/app/codegraph/CodegraphFrame.tsx
handoff/web/src/app/codegraph/（删除旧 viewer，仅保留 CodegraphFrame.tsx）
handoff/web/src/app/shell/Shell.tsx
```

只读核对：`handoff/internal/agentd/codegraph.go`、`handoff/internal/agentd/webhandler.go`、`handoff/web/src/app/tree/ProjectTree.tsx`、`handoff/internal/webui/**`。

Consumes：

```go
github.com/Xsxdot/charter/graph/webui.FS() fs.FS
newSPAHandler(fsys fs.FS, log *slog.Logger) http.Handler
BaseDir.projectName（当前 workbench 选择项目）
```

Produces：

```go
GET /codegraph/app/ -> http.StripPrefix("/codegraph/app/", newSPAHandler(graphwebui.FS(), s.log))
```

```tsx
CodegraphFrame({ project }: { project: string }): JSX.Element
// iframe src = "/codegraph/app/?project=" + encodeURIComponent(project)
```

### T4.2 基线判据与测试 harness

1. 在 T3 外部证据通过后，先在 handoff 目标分支执行 `go test ./internal/agentd -count=1`、`go vet ./internal/agentd`、`go build ./...`；预期现有 provider、SPA handler 测试绿，代码图 API 未被修改。
2. 执行 handoff web 的 `npm ci`、`npm run typecheck`、`npm run build`；基线期预期当前完整 web 工程绿，实施后只由 iframe 薄壳替换 codegraph import。
3. 本 task 不新增 handoff 测试文件：contract/spec 已裁决 viewer iframe 无业务逻辑，SPA fallback/405/index 缺失行为已有 `internal/agentd/webhandler_test.go` harness，provider JSON 已由 `internal/agentd/codegraph_test.go` 覆盖。按测试 harness 例外，实施者必须照抄既有 harness 的逐条断言并在实现前确认它们基线为绿：
   - `newSPAHandler` 对 GET/HEAD 文件、深路径 index fallback、非 GET/HEAD 405、缺 index 500 的现有断言保持绿。
   - provider 对未登记项目 404、缺 baseline 404 且含“未生成代码图”、坏 diff 跳过、stale 缺省归一 `[]`、source path 逃逸 400、默认/上限 span、越界截断的现有断言保持绿。
   - `ProjectTree` 代码图入口仍导航 `/codegraph`；`internal/webui/**` 的 `git diff` 必须为空。
   - T4 真机而非 Go mock 另断言未登录静态入口被 auth 拒绝、登录后 iframe fetch 带 same-origin cookie；这两条不由现有测试冒充。

### T4.3 最小实现步骤

4. 删除 handoff `web/src/app/codegraph/` 的 19 个迁移前文件，只创建以下完整薄壳；先让 `Shell.tsx` 的 import/route 类型检查红，再接入：

```tsx
// CodegraphFrame.tsx —— handoff 只负责把当前项目交给同源 viewer。
// 边界：不请求 API、不读 token/cookie、不复制项目选择器；鉴权由父 mux 负责。
export function CodegraphFrame({ project }: { project: string }): JSX.Element {
  const src = `/codegraph/app/?project=${encodeURIComponent(project)}`
  console.debug('[handoff] codegraph iframe', { project, src })
  return <iframe title="代码图" src={src} className="h-full w-full border-0" />
}
```

5. 在 handoff `internal/agentd/server.go` 增加显式 charter import alias，并在 `s.auth(mux)` 之内、root `/` SPA fallback 之前注册挂载；完整接缝代码如下。旧 `internal/webui` 根挂载保持原名和行为：

```go
import (
  // ...现有 imports...
  graphwebui "github.com/Xsxdot/charter/graph/webui"
  "github.com/Xsxdot/handoff/internal/webui"
)

// mux 是 auth 内部 mux；只读 codegraph viewer 使用 charter 的 FS，
// handoff 控制台根页面仍使用自身 internal/webui，两个静态树不能混用。
mux := http.NewServeMux()
mux.Handle("/api/", api)
mux.Handle("/ws/", api)
mux.Handle("/codegraph/app/", http.StripPrefix("/codegraph/app/", newSPAHandler(graphwebui.FS(), s.log)))
mux.Handle("/", newSPAHandler(webui.FS(), s.log))

s.log.Info("代码图 viewer 静态资源已挂载", "path", "/codegraph/app/", "same_origin", true)
root := http.NewServeMux()
root.Handle("/", s.auth(mux))
```

   保留既有 API registrations `GET /api/projects/{name}/codegraph` 与 `GET /api/projects/{name}/codegraph/source`；不要把 `/api` 注册移到 viewer handler，不新增 CORS/postMessage/Authorization header。`newSPAHandler` 已负责文件命中、深路径回退、405、index 缺失日志。
6. 在 `Shell.tsx` 删除 `CodegraphPage` import，改为 `CodegraphFrame` import；把 full-page 判据完整替换为：

```tsx
import { CodegraphFrame } from '../codegraph/CodegraphFrame'

const fullPageRoute = ['/cards', '/flows', '/settings', '/machines', '/codegraph']
  .some((path) => location.pathname.startsWith(path))

<Route path="/codegraph" element={<CodegraphFrame project={wb.base?.projectName ?? ''} />} />
```

   这里 `fullPageRoute` 必须仍被 Breadcrumb 条件和 FileTree 条件共同使用，不能只挡其中一侧；`ProjectTree` 的既有 `/codegraph` navigation 不改。
7. 在 handoff `go.mod` 将 graph require 精确改为 `github.com/Xsxdot/charter/graph v0.4.0`，不写 `replace`；运行 `go mod tidy` 更新 `go.sum`。执行 `grep -n '^replace' go.mod`，预期无输出。
8. 运行结构负向检查：

```bash
test "$(find web/src/app/codegraph -maxdepth 1 -type f | sort | wc -l)" -eq 1
if rg -n "CodegraphPage|useProjectTree|fetchCodegraph|fetchCodegraphSource" web/src/app/codegraph web/src/app/shell; then exit 1; fi
rg -n "StripPrefix\(\"/codegraph/app/\"|graphwebui\.FS\(\)|s\.auth\(mux\)|path.*codegraph" internal/agentd/server.go
git diff --exit-code -- internal/webui
```

   第一条确保薄壳目录只有 `CodegraphFrame.tsx`；第二条只允许 `CodegraphFrame`/Shell route 引用，不允许 handoff viewer 继续请求或持有旧 page；第三条必须同时命中 StripPrefix、charter FS、auth 包裹与 codegraph route；第四条确认 handoff 自有 embed 未碰。
9. 跑机内回归：`go test ./internal/agentd -count=1 && go vet ./internal/agentd && go build ./...`；再跑 handoff `npm ci && npm run typecheck && npm run build`。预期 provider/SPA 行为保持绿、handoff build 不需要把 charter 的 source 复制进自身 web。
10. 提交 handoff 变更：`git add go.mod go.sum internal/agentd/server.go web/src/app/codegraph web/src/app/shell/Shell.tsx && git commit -m "feat(codegraph): host charter viewer in same-origin iframe"`。提交前 `git status --short` 只含预期文件。

### T4.4 真机清单与类型标注

T4 是“逻辑型代码 + 边界型浏览器/鉴权”的混合 task；以下行为不能用 mock 结论抵账，全部标注“未验证，需协调者真机执行”：

1. 普通浏览器访问已登录 handoff `/codegraph/app/`，得到 charter embed 的 `index.html`；访问 `/codegraph/app/deep/path` 回落同一 index；POST/PUT 返回 405；未登录访问得到宿主 401/鉴权响应而非静态 HTML。
2. 登录后 iframe 与宿主保持同源，viewer 的 `/api/projects/{name}/codegraph` 和 `/source` 请求自动携带 handoff cookie；浏览器网络面无 `Authorization` header、CORS、postMessage 或第二端口。
3. 项目名含空格、斜杠、中文时，iframe `?project=` 能还原原值，client path/file query 的 percent encoding 与 provider 寻址一致；未登记、未扫描、真错误、source 路径逃逸各显示既有语义。
4. 普通浏览器和 handoff 桌面薄壳访问 `/codegraph`，Breadcrumb 和 FileTree 均不显示；ProjectTree 入口仍能导航；页面只保留 viewer 自身的视图选择器。
5. 同一项目逐屏比较领域全景、叶子领域树+图、详情、源码窗口、焦点历史；唯一预期差异是 viewer 项目下拉消失、右侧文件树/顶部面包屑不再挤压；C1.3 形态改造不在本卡验收。
6. agentd 重启/重新加载后没有孤儿进程、半挂载静态路由或 iframe 指向旧 host；失败时保留原始日志并退回 review。

### T4.5 缺陷族验收

| 缺陷族 | T4 结论与验收锁 |
|---|---|
| 生命周期/状态机中断 | iframe/FS 不创建 agentd 子进程、ticket 或临时目录；升级中断由旧 handoff 继续服务，重启真机检查无半挂载/孤儿。 |
| 静默失败/误导报错 | SPA 的 fallback/405/index 缺失、auth 401、provider 404/500/400 均沿既有日志/原文；viewer 不把真错误误判成未扫描。 |
| 跨平台假设 | `/` 是 URL/FS 逻辑分隔符；same-origin cookie 的普通浏览器和桌面薄壳行为分别真机检查；项目名特殊字符由 encode/decode 对照锁住。 |
| 假红/假绿测试 | 现有 `webhandler_test.go`/`codegraph_test.go` 机内锁 handler/provider 形状，真机锁 iframe、cookie、像素和权限；未登录拒绝和“不显示 FileTree/Breadcrumb”都是反面断言。 |
| 门禁绕过 | `/codegraph/app/` 在 `s.auth(mux)` 内，既有 `/api/`/`/ws/` 分派仍优先；不新增 CORS/token/写接口；静态挂载的 auth 范围由源码与真机同时锁定。 |
| 序列化边界 | provider JSON→viewer client `Response.json()`→TS types→组件 props 由 T1 transport test 锁字段，T4 保留 provider 真实 HTTP tests；iframe query→client path 的 URL 编码由特殊项目名真机锁定。 |
| 枚举新值 | 本卡不新增 graph kind 或 API 状态；route `/codegraph`、`/codegraph/app/`、HTTP 400/401/404/405/500 逐处沿既有入口核对。 |
| 承重安全属性 | 同源 iframe、宿主 cookie 鉴权、无 Authorization header 是承重隔离属性；源码结构检查可变红，登录/未登录行为必须真机可变红。 |

---

## 任务 DAG、spec 覆盖与冻结清单归属

```text
T1 viewer + wire + JSON transport test
 └──> T2 dist + embed + CI drift gate
       └──> T3 coordinator publishes graph/v0.4.0 and proves clean consumer
             └──> T4 handoff upgrade + same-origin mount + iframe + full-page fix
T1 ───────────────────────────────────────────────> T4 consumer/type compatibility
```

用户故事逐条归属：

| 故事 | 具体任务与判据 |
|---|---|
| 1 同仓改 viewer/扫描算法，CI 防漂移 | T1 的源码/wire 同 graph；T2 的提交 dist + CI 逐字节门 |
| 2 handoff 界面等价且不被文件树挤压 | T4 的 `CodegraphFrame`、`fullPageRoute`、T4 真机逐屏对照 |
| 3 codegraph 可被任意同源宿主挂载 | T2 的唯一 `FS()` 与相对 base；T3 clean consumer 读取资源；T4 `/codegraph/app/` 实例 |
| 4 C1.3 只改 charter、发版后 handoff 消费 | T3 `graph/v0.4.0` 与 T4 `go.mod` 无 replace |
| 5 release 不装 Node | T2 已提交 dist；T2 Go build 与 T3 release workflow/无 Node consumer |

冻结清单归属：

- 1～13、69～71：T2；
- 14～37、68：T1；
- 38～53：T1 wire/client + T4 provider 只读核对；
- 54～67：T4；
- 72～73：T1/T2/T4 的 `git diff` 与目标图检查共同保证，不新增目标图或空 diff。

跨 task 签名审计：T2 的 `FS() fs.FS` 与 T4 的 `graphwebui.FS() fs.FS` 逐字符相同；T1 两个 fetch 签名与 T1 transport test、T4 viewer 消费相同；T4 `CodegraphFrame({ project }: { project: string }): JSX.Element` 与 Shell 传入 `wb.base?.projectName ?? ''` 相同；tag 固定 `graph/v0.4.0`，无未决版本标记。

## 计划级四项检查

### 1. 缺陷族全集

T1、T2、T3、T4 各自都有生命周期、静默失败、跨平台、假红/假绿、门禁绕过、序列化边界、枚举白名单、承重安全属性的对抗结论；每条跨现实结论都明确标为真机，而非用本地 mock 盖章。

### 2. 序列化边界完整清单

| 边界 | 手写投影位置 | 回归断言 |
|---|---|---|
| Go Graph/ Diff → JSON → TS | handoff `internal/agentd/codegraph.go`（只读 provider）→ `graph/webui/src/api/client.ts` → `src/api/types.ts` | `src/api/client.test.ts` 用真实 `Response.json()` 检查新增字段、缺失 `from` 和 `from: 0` |
| TS graph → viewer math/components | `src/api/types.ts` → `graphmath.ts`/`domains.ts`/`DetailPanel.tsx`/`CodegraphPage.tsx` | 9 个既有测试继续消费 `CgGraph/CgDiff/CgSourceResp`；字段不被转换成 null 或另一个键 |
| dist tree → Go embed FS | `graph/webui/dist/**` → `webui.go` `//go:embed all:dist` → `fs.Sub` → handoff SPA | `webui_test.go` 检查 index、≥3 文件、无外层 dist；CI 逐字节 diff |
| iframe query → API path | `CodegraphFrame.tsx` `encodeURIComponent` → `client.ts` path/file `encodeURIComponent` | client test 检查空格/斜杠/中文 path；T4 真机检查特殊项目名真实寻址 |
| module zip → consumer FS | Git tree → `graph/v0.4.0` zip → module cache → `webui.FS()` | T3 clean consumer 读取 index/JS/CSS；不以本地 replace 或旧 cache 代替 |

### 3. 上下文预算

T1 仅 19 个迁移文件 + 10 个新工程/边界文件；T2 仅 embed、测试、dist、workflow；T3 仅 release/module 外部证据；T4 仅 6 个 handoff 修改面并明确排除 provider/internal webui。每个 task 都有界，未触发竖切还债卡。

### 4. 边界型类型标注

T3 的 module proxy/release/clean consumer 与 T4 的浏览器、cookie、iframe、桌面薄壳都明确列出可执行真机清单；机内 Go/Vitest 只验契约形状，不把边界行为写成 pass。

## 占位符与 harness 例外自审

本计划不保留未决版本、未决路径、未决接口或“后续再补”的动作；版本已写死 `graph/v0.4.0`，依赖版本已写入完整 manifest，T3 consumer 的 module version 已写死 `v0.4.0`。

允许的测试复用例外仅两处：

1. T1 的 9 个迁入 Vitest 文件逐字复制既有 handoff harness；计划逐条列出必须保留的断言和逐个文件名。
2. T4 不新增 handoff 测试文件，照抄既有 `internal/agentd/webhandler_test.go` 与 `codegraph_test.go` harness 的逐条行为断言；新增 iframe/鉴权/像素行为归协调者真机清单。

## 跨卡审计与派发前自审

本计划是一张卡内的 T1～T4 implementation plan，没有需要本节点驱动 handoff CLI 的验收步骤；T3 外部发布明确写“协调者执行，不派发”。独立上下文的跨卡审计仍由协调者在扇出前执行，至少逐条核对：contract §2/§4/§5/§6/§7 原文、T1/T2/T3/T4 上述签名、五个用户故事的具体归属。审计不得放宽 `graph/v0.4.0`、最小 manifest、无 JS 白名单测试或 `internal/webui` 不改四项裁决。

## 收尾

计划实现完成的必要证据是：T1/T2/T4 各自提交、T3 外部证据齐全、最终全量 Go/Node 检查全绿、T4 真机清单由协调者逐项验收；本计划节点本身只需落盘此文件并提交，不提前执行任何实现或发版动作。
