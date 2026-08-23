# Spec：codegraph 前端搬迁刀（查看器入 charter，handoff 同源挂载 + iframe）

> 状态：**已批准**（2026-08-23，用户批准：「开吧」）
> 级别与档位：**L3 轻档**（跨仓：charter 新增 `graph/webui` embed 包与前端工程，handoff 升版消费；新增一条宿主契约面）→ contract → breakdown → 单轮 implement（**内含发版卡点**）→ review → acceptance → finish
> 卡：`C1.4`（父卡 `C1` 代码图批次二）
> 来源：`docs/roadmap.md` 第 11 条；2026-08-23 roadmap 前置讨论 Q1（用户原话：「前端页面是不是也从 handoff 抽过来，handoff 侧使用 frame 嵌入」）

## 问题陈述

**codegraph 的 Go 半边已经搬进 charter 一个月了，前端半边还留在 handoff。**刀 0 把工具本体剥离成 `github.com/Xsxdot/charter/graph`（handoff 今天直接依赖 v0.3.0，无 replace），但查看器的 18 个前端文件仍住在 `handoff/web/src/app/codegraph/`。这造成三件事：

1. **工具的两半异地。**图的语义（谁是领域、什么算跨域边）在两处各实现一遍，且注释里明写「必须与 Go 侧一致」——`graphmath.ts` 对 `internal/codegraph`、`domains.ts` 对 `codegraph/domains.go`。跨仓的"必须一致"没有任何机械保障。
2. **查看器刀（C1.3）会大改这一摊。**目标 vs 现状对照视图、泳道流程、级联调用链——如果在 handoff 里改完再搬，等于同一份代码盖两遍。这正是 roadmap 把本刀排在第 10 条动工**前**的唯一理由。
3. **别的项目用不上。**codegraph 是通用工具（charter 已转 public、六平台发版），但它的查看器只有 handoff 能跑。

顺带一个现存 bug：`/codegraph` 不在 Shell 的 `fullPageRoute` 白名单里，选过 workspace 之后打开代码图页，右侧仍挂着 280px 的文件树、顶上仍显示上一个目录的面包屑，图被挤在剩余宽度里。

## 现状读数（2026-08-23 实测，contract 节点须对当轮工作树复核）

| 读数 | 值 | 出处 |
|---|---|---|
| Go 半边已搬完 | handoff `go.mod` 直接 `require github.com/Xsxdot/charter/graph v0.3.0`，**无 replace** | `handoff/go.mod` |
| 查看器规模 | 10 个源文件约 1500 行 + 8 个测试 | `handoff/web/src/app/codegraph/` |
| **对目录外的依赖只有 4 条** | `../data/useProjectTree`（项目下拉）、`../../api/client`（两个 fetch）、`../../api/types`（`CgGraph`/`CgDiff`/`CgNode`/`CodegraphResp`/`CgSourceResp` 纯类型） | 同上 |
| 不依赖的东西 | 无 `@/` 别名、无 shadcn 组件、无 lucide 图标、无 react-router、无全局状态库、无 xterm、无 localStorage | 同上 |
| 隐式依赖 | Tailwind v4 主题 token（`bg-background`/`text-muted-foreground` 等 ~10 个），映射在 `handoff/web/src/index.css` 的 `@theme inline` | 同上 |
| 反向依赖 | **只有 1 条** import：`Shell.tsx` → `CodegraphPage`；另两处非 import 耦合：`<Route path="/codegraph">` 与 `ProjectTree.tsx` 的入口按钮 | `handoff/web/src/app/shell/Shell.tsx` |
| 查看器内部无路由 | 三态切换全靠组件内 state，**没有 react-router 深链接** | `handoff/web/src/app/codegraph/CodegraphPage.tsx` |
| 两条只读 API | `GET /api/projects/{name}/codegraph`（返回 baseline + 全部视图 diff + stale，合并渲染在前端）、`GET /api/projects/{name}/codegraph/source?file&line&span` | `handoff/internal/agentd/codegraph.go#Server.handleProjectCodegraph`、`#handleProjectCodegraphSource` |
| 项目参数形态 | 今天是**路径参数 `{name}`**，不是 roadmap 写的 `?project=` | `handoff/internal/agentd/server.go` |
| 前端取数方式 | `fetch(path, {credentials:'same-origin'})`，同源相对路径，**不碰 token/cookie** | `handoff/web/src/api/client.ts#request` |
| 鉴权层次 | `hostGuard(auth(mux))` 包住**全部**路由含静态资源；cookie 属性只在一处定义，`SameSite=Lax`（Strict 会被桌面薄壳的顶层导航扣下） | `handoff/internal/agentd/server.go#Server.auth`、`handoff/internal/agentd/authroutes.go#sessionCookie` |
| 文案耦合 | 前端按**中文文案** `'未生成代码图'` 匹配 404 分支 | `CodegraphPage.tsx` 的 `NOT_SCANNED` 常量 |
| handoff 的 embed 形态 | `//go:build embedweb` + stub 双形态，`internal/webui/dist/` **gitignored**，由构建脚本 `cp -R web/dist internal/webui/dist` 后带 tag 编译 | `handoff/internal/webui/{webui,embed,stub}.go`、`handoff/scripts/build-release-local.sh` |
| 不提交产物的理由 | `go:embed` 指向不存在目录是**编译期错误**；产物入库会让工作区变脏，与「dispatch 要求工作区干净」冲突 | `handoff/internal/webui/webui.go` 包注释 |
| charter graph 依赖白名单 | 只放行 cobra + pflag + mousetrap，**版本也冻结**；第四个依赖即红 | `graph/cli/deps_test.go#TestModuleDependencyAllowlist`（契约 §5-1/5-2） |
| charter 现有资产 | graph 下**零 go:embed、零前端资产**；全仓 46 go / 36 md / 7 json / 1 yml / 1 ts / 1 sh / 1 py | 实测 |
| charter CI | **只有 release workflow**（tag `graph/v*` 触发，六平台单循环，检查只有 `go vet` + `go test`）；**无 ci.yml、无 node** | `.github/workflows/release.yml` |
| handoff 前端工程 | npm + node 24（`.nvmrc` 与 CI 两处同步）、vite 6 + React 19 + Tailwind 4、产物 `web/dist/` | `handoff/web/package.json`、`handoff/web/vite.config.ts` |

## 方案（含弃选与理由）

### 一、落点 `graph/webui/`：前端工程 + embed 包，**构建产物提交进仓**

```
graph/webui/
  src/            ← 从 handoff 搬来的 10 个源文件 + 8 个测试 + 自带的 client/types
  index.html  package.json  vite.config.ts  tsconfig.json
  dist/           ← 构建产物，**提交进仓**
  webui.go        ← //go:embed all:dist + FS()
```

**"产物提交进仓"是本刀最关键、也最反直觉的一条裁决，它由跨 module 消费这个事实逼出来**：

handoff 之所以能不提交产物，是因为它 embed 的是**自己**的产物——本机构建、本机编译，用 build tag 兜住"没构建过就别 embed"。而 charter 这次是**被别的 module import**：Go module 的 zip 只包含**已提交**的文件。`graph/webui/dist/` 若被 gitignore，handoff 拉下来的 `charter/graph@vX` 里根本没有 dist 目录，`//go:embed dist` 当场编译失败——连 build tag 都救不了，因为消费者没有办法"先构建再编译"。

由此产生的三条配套约束：
- **不需要 build tag**：dist 恒在，`webui.go` 无条件 embed，形态比 handoff 那套双文件更简单。
- **需要一道防漂移门**：CI 重新构建一次，与仓内 dist 逐字节比对，不一致即红。否则"改了源码忘了提交产物"会静默发布旧界面。
- **charter release 不需要 node**：产物已在仓里，`go build` 直接拿。只有防漂移的 CI 需要 node。

**弃选：**
- **保持 handoff 的 build tag + gitignore 形态**：跨 module 消费下直接不成立（上文）。
- **让 handoff 构建 charter 的前端源码**（从 module cache 里 npm build）：把构建耦合塞进消费者，且 module cache 是只读的。
- **产物发成独立的 npm 包 / GitHub Release 资产，handoff 构建时下载**：引入网络依赖与版本对齐问题，比提交 300KB 产物贵得多。
- **不 embed，改由 `codegraph serve` 自己起服务**：跨源 cookie、端口协商、契约 §5「不发网络」不变式——roadmap 已裁决另议，不混入本刀。

### 二、宿主契约面：两条只读 API + 同源挂载 + `?project=`

搬过去的查看器不再认识 handoff，它对**任意宿主**的要求收窄成一张可冻结的清单：

| 契约项 | 内容 |
|---|---|
| 数据 API | `GET <origin>/api/projects/{name}/codegraph` → `{baseline, views, stale}` |
| 源码 API | `GET <origin>/api/projects/{name}/codegraph/source?file=&line=&span=` → `{file, from, lines}` |
| 项目参数 | 查看器从自身 URL 的 **`?project=<name>`** 取项目名，填进上面两条路径的 `{name}` |
| 挂载方式 | **同源**任意路径（构建用相对 base，挂载点不入契约）；同源即继承宿主的 cookie 鉴权，查看器自身不碰 token |
| 宿主责任 | 项目选择、鉴权、404 语义（"项目未登记" / "未生成代码图"） |

**由此产生的唯一行为变更：查看器内的项目下拉消失**（那是 `useProjectTree` 唯一的用途，也是它对 handoff 的唯一硬耦合）。项目由宿主经 `?project=` 指定——宿主本来就有更好的项目选择器。

**顺带修正 roadmap 的一处措辞**：roadmap 第 11 条写「契约面收窄为两条只读 API + `?project=`」，实测这两条 API 今天用的是**路径参数 `{name}`** 而非 query。裁决：**API 保持路径参数不动**（改它要动 handoff 的路由与转发逻辑，与本刀无关），`?project=` 只用于**iframe URL 告诉查看器该查哪个项目**。两者不是同一层。

**弃选：**
- **让查看器自己发现项目列表**（新增一条 `/api/projects` 依赖）：把契约面从 2 条扩到 3 条，只为换回一个宿主已经有的下拉。
- **postMessage 传项目名**：iframe query 是零协议的等价物，且刷新后仍在。

### 三、handoff 侧：18 个文件换成一个 iframe 页，顺手修白名单

- `go.mod` 升到含 `webui` 的新 tag；`server.go` 用现成的 `newSPAHandler(webui.FS(), …)` 把它挂到 `/codegraph/app/`（在 `auth` 之内，鉴权与静态资源同层，无新增缺口）。
- `web/src/app/codegraph/` 整目录删除，换成一个几十行的 `CodegraphFrame.tsx`：`<iframe src={"/codegraph/app/?project=" + encodeURIComponent(project)} />`。
- `Shell.tsx` 的 `fullPageRoute` 加 `/codegraph`——**这就是那个挤压 bug 的修复**，一行。
- 两条 API handler、`ProjectTree.tsx` 的入口按钮、路由注册全部不动。

**弃选：把查看器做成 npm 包让 handoff 前端 import 成 React 组件。**要求两仓共用 React/Tailwind 版本与构建管线，任何一侧升级都会牵动另一侧；iframe 的隔离恰恰是这里想要的（同源，所以隔离只在渲染层，鉴权与取数照常）。

### 四、本刀是**等价搬迁**，不改一个像素

除"项目下拉消失"之外，搬迁前后逐屏一致。形态改造全部归 C1.3。这条写进 acceptance 判据：**搬迁前后同一个项目的领域全景、焦点图、详情面板逐屏对照**。

原因是双轴不合并：搬迁的风险面是构建与挂载，形态改造的风险面是交互设计，混在一轮里出问题分不清是谁的锅。

## 用户故事

1. 作为 codegraph 的维护者，我改查看器和改扫描算法在同一个仓、同一次提交里，语义漂移由 CI 而不是注释来兜。
2. 作为 handoff 用户，我打开 `/codegraph` 看到的界面与搬迁前一致，右边不再挂着一棵无关的文件树。
3. 作为别的项目的使用者，我拿到的 `codegraph` 不只是命令行，还有一个能被任何同源宿主挂载的查看器。
4. 作为 C1.3 的实施者，我在 charter 里改查看器，改完发版、handoff 升版——不需要在两个仓里各改一遍。
5. 作为发布者，我打 `graph/v*` tag 时不需要装 node，产物已经在仓里。

## 契约语义与接缝（L3）

**新增接缝一条：charter `graph/webui` 与宿主之间的挂载契约。**内容即上文「宿主契约面」表；contract 节点冻结精确形态（`FS()` 的签名与语义、`?project=` 的解析规则、相对 base 的构建约定）。

语义层的决定（签名归 contract）：

- **`graph/webui` 只暴露一个 `FS() fs.FS`**，与 handoff `internal/webui#FS` 同形（宿主可以直接换上），**不提供 HTTP handler**——handler 涉及路由与鉴权，是宿主的领域；charter 只交付静态资产。
- **不新增 Go 依赖**：`webui.go` 只用 `embed` + `io/fs`，`deps_test` 的白名单不动。**契约 §5-1/§5-2 因此不需要修订**——这是本刀刻意保持的边界。
- **契约 §5「不发网络」不变式不受影响**：embed 的是字节，不是服务。`serve` 命令留 OOS。
- **charter 仓形态的边界扩张是有意的**：它从"纯 Go + 文档"变成"含一个前端子工程"。理由：codegraph 是一个带查看器的工具，工具的家就该装下它的全部。约束是**只装 codegraph 的查看器**，charter 不因此成为放前端的地方。
- **版本节奏**：查看器每次改动都需要 charter 发 tag + handoff 升 go.mod。C1.3 开发期用 `replace` 指令本地联调，收口时发一次版——**这正是把本刀排在 C1.3 前面的成本论证**：先搬，只付一次；后搬，两份代码各改一遍。
- **文案耦合的处置**：前端按中文文案 `'未生成代码图'` 匹配 404，这个耦合跨仓之后更脆。裁决：**本刀原样保留**（等价搬迁），在契约里记为已知债，与"错误语义应结构化"一并落 roadmap。

## 实现决定

- 前端源码搬迁时**内建**原先跨目录取的三样东西：一个薄 `client.ts`（两个 fetch，同源相对路径）、一份 `types.ts`（`Cg*` 类型是 `graph/codegraph/types.go` 的 TS 镜像，跟着工具走才对）、一份最小主题 CSS（把用到的 ~10 个 Tailwind token 自带，不依赖宿主主题）。
- vite 构建用**相对 base**（查看器内部无路由，相对 base 可用），挂载点因此不入契约。
- charter 新增 `.github/workflows/ci.yml`：node 24 → `npm ci` → `npm test`（8 个测试跟着搬） → `npm run build` → **与仓内 `dist/` 比对，不一致即红**。release workflow 不动。
- `graph/webui/webui_test.go` 补 embed 断言（有 `index.html`、文件数 ≥3），抄 handoff `embed_test.go#TestEmbeddedFSHasRealAssets` 的判据，但**不带 build tag**（dist 恒在）。
- handoff 侧 `internal/webui`（宿主自己的前端）**完全不动**，两套 embed 并存互不干扰。

## 测试决定（接缝清单）

**接缝两个，都在 charter 侧：**

1. **查看器的 vitest**（主缝）：8 个既有测试文件原样搬迁，在 charter CI 跑。搬迁的正确性首先由它们守——测试跟着代码走，是"等价搬迁"最便宜的证据。
2. **`graph/webui` 的 embed 断言 + CI 防漂移门**（次缝）：前者保证产物真被嵌进去，后者保证产物与源码同步。

handoff 侧不新增测试：iframe 页无逻辑，挂载走的是既有 `newSPAHandler`（已有覆盖）。真机验收 = 升版后打开 `/codegraph`，与搬迁前逐屏对照，并确认右侧文件树不再挤压。

## Out of Scope

**永不做：**
- **把 handoff 其余前端也搬进 charter**——charter 只装 codegraph 的查看器，这是边界不是起点。
- **让 charter 提供 HTTP handler / 路由 / 鉴权**——只交付静态资产。

**本期不做、后续要做（逐条落 roadmap）：**
- **`codegraph serve` 独立命令**：涉契约 §5「不发网络」不变式修订，另立（roadmap 第 11 条已注明）。
- **查看器的一切形态改造**：目标 vs 现状对照、泳道流程、级联调用链——全归 C1.3。
- **404 语义结构化**（前端按中文文案匹配 `'未生成代码图'`），跨仓后更脆，本刀原样保留。
- **API 项目参数从路径参数改 `?project=`**：本刀裁定不动。
- **两条 API 的响应体瘦身**：今天一次性返回整份 baseline + 全部视图 diff（handoff 是 3564 节点 / 1.7MB 量级），C1.3 若要分页/按域取数再议。
- **charter 前端工程的完整质量门**（eslint / typecheck 全套）：一期 CI 只做 test + build + 防漂移。

## 备注

- **顺序**：本刀与 C1.1/C1.2 无依赖，可任意穿插；但必须在 **C1.3 之前**完成，否则查看器要盖两遍。C1.3 的卡上已挂 `blocked:C1.1,C1.4`。
- **实现分两阶段且中间有发版卡点**：charter 侧（前端工程 + embed 包 + CI + 发 tag）→ handoff 侧（升版 + iframe 页 + 白名单修复）。breakdown 须把发版这一步显式排进去，与刀 0 同款。
- 本刀**不动一行图算法**，也不动业务代码；风险面集中在构建与挂载。
- 图覆盖债：本 spec 的现状读数来自读码与配置文件实读（charter 仓无自托管代码图，handoff 前端不在 Go 图内）。
