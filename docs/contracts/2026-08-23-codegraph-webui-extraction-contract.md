# 契约增量：codegraph 查看器搬迁（C1.4，随本提交冻结）

> 日期：2026-08-23 | 状态：**已冻结**（随本提交）
> 上游：`docs/specs/2026-08-23-codegraph-webui-extraction-spec.md`（已批准，2026-08-23，用户「开吧」）
> 查证基线：charter 当前工作树 `f00f1f3`；handoff 当前工作树 `7adeb8f9`；依赖源码为本轮实读版本。
> 冻结物形态：charter 根目录无 `codegraph/target.json`（本轮实读 `git ls-tree` 无命中），属存量无图项目；**本文档即冻结物**，review 节点按 §8 人工对账。

## §1 架构形态、依赖方向与边界

- 架构形态声明：`graph` 嵌套 module = `codegraph` 算法包 + `cli` 命令构造包 + `cmd` 薄壳 + `webui` 静态资产包，平铺，无 controller/service/dao 横向分层。
- `graph/webui` 只向 Go 标准库依赖 `embed`、`io/fs`；不依赖 `graph/codegraph`、handoff、HTTP、路由、鉴权或网络客户端。
- 宿主方向固定为 `handoff -> github.com/Xsxdot/charter/graph/webui`；查看器静态代码不反向 import handoff。
- `webui` 只交付静态资源文件系统；HTTP handler、URL 路由、项目选择、鉴权、API 错误语义归宿主。
- `graph` module 现有第三方依赖白名单与版本不因本卡扩大：`graph/cli/deps_test.go#TestModuleDependencyAllowlist`（本轮实读 `graph/cli/deps_test.go:12-50`）执法的直接依赖仍为 cobra `v1.10.2`，`graph/go.mod:1-10` 现状不改。
- charter 无根级代码图目标图，因此本轮不写 `codegraph/target.json`，不造 `codegraph/diffs/<分支>.json`；`graph/codegraph/testdata/repo/codegraph/target.json` 是夹具，不是本仓目标图。

## §2 `graph/webui` Go 导出面

### 2-1 唯一导出签名

```go
package webui

func FS() fs.FS
```

- 目标包路径：`github.com/Xsxdot/charter/graph/webui`，包名 `webui`。
- 同形现状出处：handoff `internal/webui/embed.go:37-48` 的 `FS() fs.FS`（本轮实读）；其宿主调用出处为 handoff `internal/agentd/server.go:536` 的 `newSPAHandler(webui.FS(), s.log)`。
- 实现形态冻结：`webui.go` 用 `//go:embed all:dist` 得到包内嵌入 FS，再以 `fs.Sub(distFS, "dist")` 返回根；调用方看到的根目录直接含 `index.html`，不含外层 `dist/`。
- `FS()` 不返回 `nil`。
- `FS()` 不返回 HTTP handler。
- `FS()` 不提供 `Embedded()`、版本查询或构建标签分支。
- `dist` 是提交物，不进 `.gitignore`；handoff 的 `embedweb`/stub 双形态不迁入 charter。

### 2-2 依赖既成行为与出处

- `//go:embed` 必须紧邻包级变量声明，模式必须命中至少一个文件；目录模式递归嵌入，`all:` 会包含点号/下划线开头文件。出处：Go 标准库 `embed/embed.go:41-99`。
- `embed.FS` 未用 `//go:embed` 初始化时是空只读 FS；正式实现不能保留 Ticket 0 空 FS。出处：Go 标准库 `embed/embed.go:141-148`。
- `embed.FS` 实现 `io/fs.FS`，可直接交给理解 `fs.FS` 的宿主。出处：Go 标准库 `embed/embed.go:116-121`、`141-148`。
- `fs.Sub(fsys, "dist")` 对合法目录返回子树；目录非法时返回错误。出处：Go 标准库 `io/fs/sub.go:20-45`。
- 正式实现中 `dist` 缺失属于编译期错误；`fs.Sub` 的错误路径只为不可达防线，必须 panic，不得静默返回空 FS。现状同形实现出处：handoff `internal/webui/embed.go:40-48`。

### 2-3 Ticket 0 骨架

- 本提交只落 `graph/webui/webui.go` 的包壳、`FS() fs.FS` 签名和标准库接线；当前 `assets embed.FS` 是**有意空壳**，没有可观测前端行为。
- 前端源码、`dist`、`go:embed` 正式实现、embed 资源测试和 CI 防漂移门归 implement 轮；不把未完成资产伪装成可用查看器。
- 因 Ticket 0 未越过空壳，本轮不新增行为测试；本轮 `go build ./...` 是骨架编译门。实现轮必须把 `FS()` 的资源行为锁进测试，见 §7 与 §8。

## §3 查看器前端工程契约

### 3-1 迁入文件集与现状出处

目标目录：`graph/webui/`。前端工程自带 `package.json`、`package-lock.json`、`index.html`、`vite.config.ts`、`tsconfig*.json`、`src/`、`dist/`；`webui.go` 在工程根目录。

当前 handoff 查看器的**本轮复核计数**为 10 个源文件 + 9 个测试文件（共 19 个），不是 spec 现状表中的 10 + 8：

- 源文件：`CodegraphPage.tsx`、`CallTree.tsx`、`DetailPanel.tsx`、`DomainDetail.tsx`、`DomainPanorama.tsx`、`FocusGraph.tsx`、`domainlayout.ts`、`domains.ts`、`graphmath.ts`、`useCodegraph.ts`，出处：handoff `web/src/app/codegraph/`（本轮 `find ... | xargs wc -l` 实读）。
- 测试文件：`CallTree.test.tsx`、`CodegraphPage.test.tsx`、`DetailPanel.test.tsx`、`DomainDetail.test.tsx`、`DomainPanorama.test.tsx`、`FocusGraph.test.tsx`、`domainlayout.test.ts`、`domains.test.ts`、`graphmath.test.ts`，同目录本轮 `rg --files` 实读。
- 迁移时不得删除或合并这 9 支测试；测试函数/断言只允许为新路径、移除项目下拉和独立 client/types 做机械适配。

### 3-2 前端公开/跨文件签名（迁移前逐项查证）

以下签名是现状代码事实，搬迁时原样保留；行号为本轮实读出处，符号锚用于后续 `codegraph resolve`：

| 文件 | 签名/导出面 | 现状出处 |
|---|---|---|
| `graphmath.ts` | `type Status = '' \| 'added' \| 'modified' \| 'deleted'` | handoff `web/src/app/codegraph/graphmath.ts:9` |
| `graphmath.ts` | `interface ViewNode extends CgNode { status: Status }` | 同 `:10` |
| `graphmath.ts` | `interface ViewEdge { from: string; to: string; status: Status }` | 同 `:11` |
| `graphmath.ts` | `interface CgView { name: string; domains: NonNullable<CgGraph['domains']>; containers: CgGraph['containers']; nodes: Record<string, ViewNode>; edges: ViewEdge[] }` | 同 `:12-19` |
| `graphmath.ts` | `mergeView(g: CgGraph, d?: CgDiff): CgView` | 同 `:22` |
| `graphmath.ts` | `scannedEntries(v: CgView): string[]` | 同 `:37` |
| `graphmath.ts` | `buildAdj(v: CgView): { adj: Record<string, string[]>; radj: Record<string, string[]> }` | 同 `:45` |
| `graphmath.ts` | `neighborhood(v: CgView, foci: string[], depth: number, expand?: (id: string) => boolean): Record<string, number>` | 同 `:59-61` |
| `graphmath.ts` | `layoutBands(v: CgView, dist: Record<string, number>, NODE_W?: number, XSP?: number, YSTEP?: number, PADX?: number, PADY?: number): { px: Record<string, number>; py: Record<string, number>; W: number; H: number; order: number[] }` | 同 `:88-91` |
| `graphmath.ts` | `interface ChainTreeNode { id: string; cycle?: boolean; children: ChainTreeNode[] }` | 同 `:122` |
| `graphmath.ts` | `chainTree(v: CgView, entry: string, maxDepth?: number): ChainTreeNode` | 同 `:125` |
| `domains.ts` | `interface DomainCard`, `interface DomainEdge`, `interface DomainAgg` | handoff `web/src/app/codegraph/domains.ts:13-33` |
| `domains.ts` | `hasDomains(v: CgView): boolean` | 同 `:36` |
| `domains.ts` | `domainPathOf(v: CgView, containerId: string): string[]` | 同 `:42` |
| `domains.ts` | `nodeDomainPathOf(v: CgView, nodeId: string): string[]` | 同 `:55` |
| `domains.ts` | `domainAncestors(v: CgView, scope: string): string[]` | 同 `:62` |
| `domains.ts` | `childDomainsOf(v: CgView, scope: string \| null): string[]` | 同 `:76` |
| `domains.ts` | `inScope(v: CgView, nodeId: string, scope: string \| null): boolean` | 同 `:85` |
| `domains.ts` | `domainAgg(v: CgView, scope: string \| null): DomainAgg` | 同 `:93` |
| `domains.ts` | `leafRoots(v: CgView, scope: string): string[]` | 同 `:146` |
| `domainlayout.ts` | `layoutDomains(agg: DomainAgg, ids: string[], seed?: Record<string, [number, number]>): Record<string, [number, number]>` | handoff `web/src/app/codegraph/domainlayout.ts:23-27` |
| `useCodegraph.ts` | `useCodegraph(project: string): { data: CodegraphResp \| null; error: string; loading: boolean; reload: () => void }` | handoff `web/src/app/codegraph/useCodegraph.ts:7-22` |
| `CodegraphPage.tsx` | `CodegraphPage(): JSX.Element` | handoff `web/src/app/codegraph/CodegraphPage.tsx:19` |
| `CallTree.tsx` | `CallTree(props: { view: CgView; foci: string[]; open: Set<string>; scope: string \| null; onCrossJump: (id: string) => void; onToggle: (id: string, open: boolean) => void; onFocus: (id: string, additive: boolean) => void }): JSX.Element` | handoff `web/src/app/codegraph/CallTree.tsx:53-59` |
| `DetailPanel.tsx` | `DetailPanel(props: DetailPanelProps): JSX.Element`，其中 `DetailPanelProps = { project: string; view: CgView; nodeId: string; stale: Set<string>; onJump: (id: string) => void }` | handoff `web/src/app/codegraph/DetailPanel.tsx:9-11,22` |
| `DomainDetail.tsx` | `DomainDetail(props: DomainDetailProps): JSX.Element` | handoff `web/src/app/codegraph/DomainDetail.tsx:9-16,43` |
| `DomainPanorama.tsx` | `DomainPanorama(props: DomainPanoramaProps): JSX.Element` | handoff `web/src/app/codegraph/DomainPanorama.tsx:45` |
| `FocusGraph.tsx` | `FocusGraph(props: FocusGraphProps): JSX.Element` | handoff `web/src/app/codegraph/FocusGraph.tsx:22` |

组件内部未导出的 `DomainDetailProps`、`DomainPanoramaProps`、`FocusGraphProps` 与 `Row`/`Sec`/`NodeLink` 等局部签名随源文件逐行搬迁，不形成宿主契约；实现轮若改其形状，必须让本目录测试先变红再提交。

### 3-3 项目参数与行为边界

- 迁入后的 `CodegraphPage` 不再 import handoff `useProjectTree`；项目名只从自身 URL 的 `?project=<name>` 读出：`new URLSearchParams(window.location.search).get('project') ?? ''`。
- 查看器不渲染项目下拉，不请求项目树，不新增 `/api/projects` 依赖。
- `project === ''` 时不发代码图请求；页面仍可渲染空状态。
- 查看器内部不使用 react-router；三态仍由组件 state 驱动，刷新保留 `?project=`。
- 图算法只读 `domains` 段，不按包名推导领域；这条现状边界出处为 handoff `web/src/app/codegraph/domains.ts:1-7`。
- `/codegraph` 的下拉消失是本刀唯一可见行为差异；领域全景、叶子领域树+图、详情面板、源码窗口和焦点历史不改形态，C1.3 的形态改造不混入本卡。
- 前端自带最小主题 CSS，不能依赖 handoff `web/src/index.css` 的宿主 token；当前 token 依赖事实为 handoff `web/src/index.css` 的 `@theme inline`（spec 现状读数，本轮文件实读）。

## §4 `Cg*` TypeScript wire 镜像

目标 `graph/webui/src/api/types.ts` 只保留查看器需要的下列类型；字段形状以 charter `graph/codegraph/types.go` 为事实源，现有 handoff TS 类型为迁移前对账样本。

```ts
export interface CgMeta {
  project: string; branch: string; commit: string; scannedAt: string; generator: string
}
export interface CgTestRef { name: string; file: string; snippet?: string }
export interface CgDomain { label: string; kind: string; summary?: string; desc?: string; parent?: string }
export interface CgContainer { label: string; kind: string; entry?: boolean; domain?: string }
export interface CgNode {
  kind: 'entry' | 'func' | 'model'
  container: string
  order?: number
  name: string
  file: string
  line: number
  signature?: string
  signatureOld?: string
  params?: string[][]
  returns?: string
  summary?: string
  tests?: CgTestRef[]
  fields?: string[][]
  unscanned?: boolean
  projScanned?: boolean
}
export interface CgLifecycleRef { who: string; model: string; kind: 'creator' | 'writer'; field?: string }
export interface CgGraph {
  meta: CgMeta
  domains?: Record<string, CgDomain>
  containers: Record<string, CgContainer>
  nodes: Record<string, CgNode>
  edges: [string, string][]
  implements?: [string, string][]
  projections?: [string, string, string][]
  lifecycle?: CgLifecycleRef[]
}
export interface CgDiff {
  view: string
  base?: string
  summary?: string
  containersAdded?: Record<string, CgContainer>
  nodesAdded?: Record<string, CgNode>
  nodesModified?: Record<string, CgNode>
  nodesDeleted?: string[]
  edgesAdded?: [string, string][]
  edgesDeleted?: [string, string][]
  implementsAdded?: [string, string][]
  implementsDeleted?: [string, string][]
  projectionsAdded?: [string, string, string][]
  projectionsDeleted?: [string, string, string][]
  lifecycleAdded?: CgLifecycleRef[]
  lifecycleDeleted?: CgLifecycleRef[]
}
export interface CgStaleNode { id: string; file: string; line: number; reason: string }
export interface CodegraphResp { baseline: CgGraph; views: Record<string, CgDiff>; stale: CgStaleNode[] }
export interface CgSourceResp { file: string; from: number; lines: string[] }
```

现状出处与对账：

- Go canonical 字段：charter `graph/codegraph/types.go#Meta`（`16-22`）、`#Container`（`25-32`）、`#Domain`（`39-45`）、`#TestRef`（`48-52`）、`#Node`（`56-72`）、`#Graph`（`84-99`）、`#Diff`（`102-122`）。
- handoff 迁移前 TS 字段：`web/src/api/types.ts:766-824` 的 `CgTestRef`、`CgNode`、`CgDomain`、`CgContainer`、`CgGraph`、`CgDiff`、`CgStaleNode`、`CodegraphResp`、`CgSourceResp`。
- `implements`/`projections`/`lifecycle`/`containersAdded`/`projScanned` 是当前 Go canonical 已有而旧 TS 镜像缺席的字段；它们必须随工具一起补入，不得继续留下注释式漂移。
- JSON 键名逐字跟随 Go `json` tag；可选字段在 TS 用 `?`，不得改成 `null` 代替缺席。

## §5 宿主 HTTP 契约（handoff 现状复核）

### 5-1 整图端点

`GET /api/projects/{name}/codegraph`：

- `{name}` 是路径参数；查看器的 `?project=` 只负责提供这个路径参数的值，两者不合并成一个 API query。
- 200 body 类型是 `CodegraphResp`，形状为 `{ baseline: Graph, views: Record<string, Diff>, stale: StaleNode[] }`。
- server 先 `codegraph.LoadGraph(loc.Path)`，再 `ListViews`/`LoadDiff`，最后 `CheckStale`；坏的单个 diff 跳过，不能拖垮整页。出处：handoff `internal/agentd/codegraph.go:26-78`。
- `stale == nil` 时 server 归一化为空数组后发出；消费方不得把缺席当成功状态。出处：同文件 `:71-77`。
- 未登记项目返回 HTTP 404，JSON `{"error":"项目 {name} 未登记"}`；发出方为 `codegraph.go:35-38`，现有 handoff 消费测试为 `internal/agentd/codegraph_test.go:73-74`。
- 项目已登记但缺 `codegraph/baseline.json` 返回 HTTP 404，JSON `{"error":"项目 {name} 未生成代码图（无 codegraph/baseline.json）"}`；发出方为 `codegraph.go:44-49`，前端 `CodegraphPage.tsx:195-212` 以子串 `未生成代码图` 消费该分支。
- 其它加载、列视图错误返回 HTTP 500，JSON `error` 为服务端截断后的原因；前端原文展示，不把它映射成“未扫描”。
- 当前 handler 允许 `?machine=` 作为宿主跨机转发扩展（消费于 `codegraph.go:28-32` 的 `forwardIfRequested` 路径）；查看器不发送该参数，它不属于本卡两条最小宿主契约。

### 5-2 源码窗口端点

`GET /api/projects/{name}/codegraph/source?file=<file>&line=<line>&span=<span>`：

- 成功 body 类型是 `CgSourceResp`：`{ file: string, from: number, lines: string[] }`。
- `file` 必须是仓库内相对路径；空串、绝对路径、`..` 或以 `../` 开头返回 HTTP 400，JSON `{"error":"file 必须是仓库内相对路径"}`。出处：handoff `internal/agentd/codegraph.go:83-103`。
- `line` 解析失败按 0 处理；`span <= 0` 取 40；`span > 200` 截为 200。出处：同文件 `:87-95`。
- 返回窗口起点为 `max(1, line-3)`；末尾按文件长度截断；越界行号不返回错误。出处：同文件 `:116-129`，现有测试 `internal/agentd/codegraph_test.go:95-111`。
- 项目不存在或源码文件读取失败返回 HTTP 404；发出方为 `codegraph.go:104-114`。
- 查看器调用签名必须保持 `fetchCodegraphSource(project: string, file: string, line: number, span = 40): Promise<CgSourceResp>`；现状出处 handoff `web/src/api/client.ts:605-610`。

### 5-3 请求客户端签名与错误行为

目标 `graph/webui/src/api/client.ts` 的最小导出面：

```ts
export function fetchCodegraph(project: string): Promise<CodegraphResp>
export function fetchCodegraphSource(project: string, file: string, line: number, span = 40): Promise<CgSourceResp>
```

迁移前现状出处：handoff `web/src/api/client.ts:601-610`。

- 两个请求均使用同源相对路径，不拼 host，不读 token，不手工读写 cookie。
- 项目路径段与 `file` query 使用现状 `encodeURIComponent`；数字 `line`/`span` 直接写十进制字符串。现状请求模板出处 `client.ts:597-609`。
- 请求底层照抄现有 `request<T>(path: string, init?: RequestInit): Promise<T>` 的行为（出处 `client.ts:127-135`）：调用 `fetch(path, { credentials: 'same-origin', ...init })`，非 2xx 抛 `ApiError`，成功 JSON 解析为 `T`。
- 当前 request 没有超时、AbortController、keepalive、重试或轮询；查看器的整图请求只在项目参数变化/手动刷新时发起，源码请求只在详情展开时发起。超时与保活不得在搬迁时臆加。
- 401 的现状错误文案由 `client.ts:127-135` 的 `parseResponse` 生成；搬迁后的最小 client 可保留同一错误可观察性，但不能吞掉服务端 `error` 原文。

### 5-4 同源鉴权与静态挂载

- handoff 的静态 SPA handler 现状为 `newSPAHandler(fsys fs.FS, log *slog.Logger) http.Handler`；行为是 GET/HEAD 命中文件即发文件，未命中回落 `index.html`，其它方法 405，`index.html` 缺失 500。出处：handoff `internal/agentd/webhandler.go:81-167`。
- handoff 侧将 `webui.FS()` 接到 `server.go:536` 的 SPA handler；整个 mux 再由 `server.go:542` 的 `s.auth(mux)` 包裹，最终由 `server.go:550` 的 `hostGuard` 包裹。
- 本卡实现把查看器挂在 handoff `/codegraph/app/`，使用 `http.StripPrefix("/codegraph/app/", newSPAHandler(webui.FS(), s.log))` 让 `index.html` 位于静态 FS 根；`/codegraph/app/` 的深路径回落同一 `index.html`。
- `/codegraph/app/` 不是查看器对其它宿主的固定挂载点；通用宿主契约是**同源任意路径**，构建产物必须使用相对 base，挂载点不写入前端 API。
- `CodegraphFrame` 的宿主签名冻结为 `CodegraphFrame({ project }: { project: string }): JSX.Element`；iframe `src` 为 `"/codegraph/app/?project=" + encodeURIComponent(project)` 的同源 URL。项目值来自 handoff 当前基准 `BaseDir.projectName`，现状字段出处 `web/src/app/workbench/useWorkbench.ts:38-50`。
- iframe 页面内的 fetch 继续使用同源凭据；cookie 名 `handoff_session`，`Path=/`、`HttpOnly`、`SameSite=Lax`、TLS 时 `Secure=true`，出处 `handoff/internal/agentd/authroutes.go:275-306`。查看器不加 `Authorization` header。
- `postMessage`、跨源 CORS、独立 token、独立端口均不属于本卡。

## §6 handoff 宿主改动契约

- `go.mod` 将 `github.com/Xsxdot/charter/graph` 升到含 `webui` 的新 tag；提交中不得留下 `replace`。具体 tag 由发版卡点在实现后决定，本契约不擅自写版本号。
- `internal/agentd/codegraph.go` 的两条 API handler、响应体、错误码和错误字面值不改；它们的现状锚为 `#Server.handleProjectCodegraph`（`codegraph.go:26`）与 `#Server.handleProjectCodegraphSource`（`:83`）。
- `internal/agentd/server.go` 保留 API 注册 `GET /api/projects/{name}/codegraph` 与 `GET /api/projects/{name}/codegraph/source`（现状 `server.go:503-504`）；只新增 `/codegraph/app/` 静态挂载。
- `web/src/app/codegraph/` 整目录改为只含 `CodegraphFrame.tsx` 的宿主薄壳；`CodegraphPage`、项目下拉、handoff 主题和 handoff API client 不再由宿主持有。
- `Shell.tsx` 的 `Route path="/codegraph"` 保留（现状 `Shell.tsx:491`），element 改为 `CodegraphFrame`，并把当前 `wb.base?.projectName ?? ''` 传入。
- `Shell.tsx` 的 `fullPageRoute` 增加 `/codegraph` 前缀判断；当前定义为 `/cards`、`/flows`、`/settings`、`/machines`（`Shell.tsx:385-393`），该变更必须同时挡住 `Breadcrumb`（`:478`）和 `FileTree`（`:567-575`）。
- `ProjectTree` 的“代码图”入口与 `onOpenCodegraph` 保留；现状入口出处 `ProjectTree.tsx:815-823`，不新增第二个项目选择器。
- handoff 自有 `internal/webui` 双形态完全不动；`graph/webui` 与 handoff `internal/webui` 是两套独立包。

## §7 测试与可执行冻结

### 7-1 搬迁测试

- 9 个现有 Vitest 文件逐个迁入 `graph/webui/src/app/codegraph/`，`npm test` 必须逐个通过；它们是查看器等价搬迁的主接缝。
- `CodegraphPage.test.tsx` 的现状断言覆盖三态、无领域降级、未扫描/真错误/加载中三种非图状态，出处 `handoff/web/src/app/codegraph/CodegraphPage.test.tsx:59-133`；迁移后把项目下拉断言改为 URL project 输入断言，不得删除错误可观察性断言。
- `DetailPanel.test.tsx` 现状以 `fetchCodegraphSource('demo', 'svc/server.go', 4)` 锁源码窗口请求，出处 `handoff/web/src/app/codegraph/DetailPanel.test.tsx:56`；迁移后继续锁同一参数语义。

### 7-2 embed 与产物漂移门

- 实现轮新增 `graph/webui/webui_test.go`：`FS()` 必须能读根 `index.html`。
- 实现轮新增的 embed 测试必须递归统计非目录文件数不少于 3（`index.html` + JS + CSS），判据逐行照抄 handoff `internal/webui/embed_test.go:13-36` 的意图；不得用“能编译”替代资源存在性。
- charter 新增 `.github/workflows/ci.yml`：Node 24 → `npm ci` → `npm test` → `npm run build` → 与仓内 `graph/webui/dist/` 逐字节比对；不一致即失败。
- `graph/webui/dist/` 必须提交；Go release workflow 可在无 Node 的环境直接 `go build`，不依赖 CI 临时生成资产。

### 7-3 可执行冻结分类

- 本轮无哈希、密钥派生、自定义二进制编码或跨实现金样本向量命中；可执行冻结项记为**无命中**。
- URL 参数转义沿用平台 `encodeURIComponent`，不是本卡新定义的编码格式；不另造编码器、不把转义结果手抄进 JSON。
- 跨仓 wire 的可执行对账由 handoff 现有 `codegraph_test.go`（provider HTTP 行为）与迁入的 viewer Vitest（consumer 形状/调用）共同承担，不新建专项 CDC 基建。

## §8 冻结清单（原子断言）

1. `graph/webui` 的包名是 `webui`。
2. `graph/webui` 的唯一导出函数签名是 `FS() fs.FS`。
3. `FS()` 返回的 FS 根包含 `index.html`。
4. `FS()` 返回的 FS 根不包含外层 `dist/`。
5. `FS()` 的正式实现使用 `//go:embed all:dist`。
6. `FS()` 的正式实现使用 `fs.Sub(distFS, "dist")`。
7. `FS()` 的 `fs.Sub` 不可达错误路径 panic。
8. `graph/webui` 不导出 HTTP handler。
9. `graph/webui` 不导出 `Embedded()`。
10. `graph/webui` 不依赖 handoff 包。
11. `graph/webui` 只依赖 Go 标准库。
12. `graph/go.mod` 的既有 cobra 版本仍为 `v1.10.2`。
13. `graph/webui/dist/` 是 Git 提交物。
14. 查看器源码迁入数量是 10 个源文件。
15. 查看器测试迁入数量是 9 个测试文件。
16. 9 个现有测试文件不得因搬迁被删除。
17. 查看器不再 import `useProjectTree`。
18. 查看器从自身 URL 读取 `project` query。
19. 查看器在空 project 时不发代码图请求。
20. 查看器不新增项目列表 API。
21. 查看器内部不使用 react-router。
22. 查看器不按包名推导领域。
23. `CgNode` 含 `projScanned?: boolean`。
24. `CgGraph` 含 `implements?: [string,string][]`。
25. `CgGraph` 含 `projections?: [string,string,string][]`。
26. `CgGraph` 含 `lifecycle?: CgLifecycleRef[]`。
27. `CgDiff` 含 `containersAdded?: Record<string,CgContainer>`。
28. `CgDiff` 含 `implementsAdded` 与 `implementsDeleted`。
29. `CgDiff` 含 `projectionsAdded` 与 `projectionsDeleted`。
30. `CgDiff` 含 `lifecycleAdded` 与 `lifecycleDeleted`。
31. `CodegraphResp.views` 的类型是 `Record<string, CgDiff>`。
32. `CgSourceResp.from` 的类型是 `number`。
33. `fetchCodegraph` 的参数签名是 `(project: string)`。
34. `fetchCodegraphSource` 的参数签名是 `(project: string, file: string, line: number, span = 40)`。
35. 两个 client 请求使用同源相对路径。
36. 两个 client 请求使用 `credentials: 'same-origin'`。
37. client 不发送 token。
38. `GET /api/projects/{name}/codegraph` 的成功响应包含 `baseline`。
39. `GET /api/projects/{name}/codegraph` 的成功响应包含 `views`。
40. `GET /api/projects/{name}/codegraph` 的成功响应包含 `stale`。
41. 未登记项目的整图端点返回 404。
42. 缺少 baseline 的整图端点返回 404。
43. 缺少 baseline 的错误文案含 `未生成代码图`。
44. 单个坏 diff 不使整图端点失败。
45. `stale` 缺省结果由 server 归一化为空数组。
46. 源码端点成功响应键为 `file`、`from`、`lines`。
47. 源码端点拒绝空 `file`。
48. 源码端点拒绝绝对路径 `file`。
49. 源码端点拒绝 `..` 路径逃逸。
50. 源码端点默认 `span` 为 40。
51. 源码端点把大于 200 的 `span` 截为 200。
52. 源码端点窗口起点最多向上带 3 行上下文。
53. 源码端点行号越界时截到文件边界而非报错。
54. handoff 注册 `/codegraph/app/` 静态挂载。
55. `/codegraph/app/` 静态挂载使用 `http.StripPrefix`。
56. `/codegraph/app/` 静态挂载位于 `s.auth` 保护范围内。
57. `CodegraphFrame` 的 props 含 `project: string`。
58. iframe 的 project 值使用 `encodeURIComponent`。
59. iframe 与宿主保持同源。
60. iframe URL 使用 `?project=` 传项目名。
61. handoff `/codegraph` 路由仍存在。
62. handoff `/codegraph` 路由渲染 `CodegraphFrame`。
63. handoff 的 `fullPageRoute` 包含 `/codegraph`。
64. `/codegraph` 页面不渲染 Breadcrumb。
65. `/codegraph` 页面不渲染 FileTree。
66. ProjectTree 的代码图入口仍可导航到 `/codegraph`。
67. handoff 自有 `internal/webui` 未被本卡删除或改写。
68. `npm test` 的 9 个迁入测试文件全部通过。
69. `FS()` embed 测试能读 `index.html`。
70. `FS()` embed 测试统计资源文件不少于 3 个。
71. CI 构建产物与仓内 `dist/` 不一致时失败。
72. 本卡未新增 `codegraph/target.json`。
73. 本卡未新增空的 `codegraph/diffs/<分支>.json`。

## §9 拍板记录（三重闸门）

**一、产物提交进 `graph/webui/dist/`，而不是沿用 handoff 的 build tag + gitignore。** 难逆转：handoff 升级到 `graph/webui` 后，Go module zip 必须携带 `//go:embed` 目标，改成不提交产物会同时牵动 charter 发版、handoff 构建和发布流水线。无上下文会惊讶：一个 Go module 把约 300KB 的前端构建产物当源码提交，看起来像应当清理的生成物。真取舍：被否方案是 build tag/stub（跨 module 消费方无法先生成 module cache 内只读源码的 dist）、由 handoff 从 module cache 构建（把构建耦合塞给消费者）、独立 npm/Release 下载（引入网络和版本对齐）；均不做。反过来写会让 `go:embed` 在消费者编译期直接失败，故 CI 的逐字节防漂移门与提交产物是同一裁决的两半。

**二、查看器以同源 iframe 作为宿主接缝，不做 npm React 组件包。** 难逆转：组件包会把两个仓的 React、Tailwind、Vite 版本与构建管线绑定，后续每次升级都要联动两个仓。无上下文会惊讶：同源页面仍用 iframe，表面上多一层文档边界。真取舍：被否方案是 handoff 直接 import charter 的 React 组件；它要求共享依赖版本并暴露宿主状态，iframe 既保留同源 cookie/API，又隔离渲染与发布节奏，故不做跨仓组件包。

**三、查看器用 `?project=` 传项目名，API 继续使用路径参数 `{name}`。** 难逆转：把 API 改成 query 会牵动 handoff 两个 handler、跨机转发和所有现有测试；把宿主项目选择复制回查看器会重新引入项目树依赖。无上下文会惊讶：URL 同时出现 `?project=` 和 `/api/projects/{name}` 两种参数形态，后人容易“统一”其中一层。真取舍：被否方案是把 API 也改成 `?project=`，或让 iframe 自己发现项目列表；前者扩大后端改动，后者把宿主已有选择器复制一遍，均不做。**这是“反过来写不会有任何 charter 测试变红”的顺序/分层裁决**，因此在此留档。

**四、`webui` 只暴露 `FS()`，不暴露 HTTP handler。** 难逆转：把路由/鉴权放入公共包会让所有宿主接受 charter 的 HTTP 语义，后续拆分要动公共 API 与每个消费者。无上下文会惊讶：公共包已经有静态页面，却刻意不提供一行就能挂载的 handler。真取舍：被否方案是导出 `http.Handler` 或 `Serve`，但那会把 host path、cookie、CORS、缓存策略越过宿主边界；只给 `fs.FS` 让 handoff 复用现有 SPA handler，故不做公共 handler。

## §10 交棒声明

- 欠账：无。Ticket 0 只落 `graph/webui` 包壳与 `FS() fs.FS` 空签名；没有已实现但零测试的可观测行为。
- 契约增量文档：本文件，随本提交冻结；每个跨仓签名/端点/类型均带本轮现状出处。
- 目标图：charter 根无目标图，按存量无图口径跳过；本轮不造 `target.json` 或空视图 diff。
- Ticket 0 骨架：`graph/webui/webui.go`，本轮编译命令为 `cd graph && go build ./...`，必须以本轮命令退出码 0 为准。
- 本轮新鲜编译证据：`cd graph && go build ./...` 退出码 0；`cd graph && go vet ./...` 退出码 0；`cd graph && go test ./... -count=1` 退出码 0，`cli` 与 `codegraph` 两包 `ok`，`webui` 包编译通过且当前无测试文件。
- 符号锚自检：本仓无根级 baseline，`codegraph resolve --repo .. --doc ../docs/contracts/2026-08-23-codegraph-webui-extraction-contract.md` 按无图口径不适用（本轮命令因 `../codegraph/baseline.json` 不存在退出 1）；本文档中的现状引用保留 `file:line`，不伪造图锚。
- 可执行冻结：无命中（无哈希、密钥派生、自定义编码向量）；跨仓 HTTP 形状由现有 handoff endpoint tests + 迁移后的 viewer tests 对账。
- 拍板记录：四项均满足三重闸门，已在 §9 记录；“反过来写不会有任何测试变红”的 URL 分层裁决已显式记录。
- 交棒：breakdown。
