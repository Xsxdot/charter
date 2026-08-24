# Breakdown：codegraph 查看器搬迁（C1.4）

> 日期：2026-08-23 | 状态：**出稿待拍板**（handoff executor 出稿，所有岔口保留给协调者）
> 定级：L3 轻档；上游 spec「已批准」、contract「已冻结」均已实读核对
> 基线：charter 当前提交 `6a2ddc9`；本仓无根级 `codegraph/target.json`，按无目标图口径人工对账
> 纪律：本稿只交拆解提案，不写实现代码、不建卡、不派发；协调者拍板后再进入 implement

## 待拍板清单

| # | 岔口 | 方案与取舍 |
|---|---|---|
| **P1** | **新 graph tag 的版本** | A=`graph/v0.4.0`，将新增 `webui` 包视为下一 minor，语义清晰；B=`graph/v0.3.1`，以 additive-only 兼容为由走 patch，版本更保守但容易把新增可消费能力藏在 patch。contract 只冻结「具体 tag 由发版卡点决定」；handoff 升版仍是本卡 T4 的冻结范围，本稿不自选。 |
| **P2** | **`graph/webui` 前端 manifest 的依赖范围** | A=沿用 handoff `web/package.json`/lock 的完整依赖集合，迁移快、锁文件可信，但把无关前端依赖带进公共工具；B=只保留查看器实际 import、Vitest、Vite、React、Tailwind 所需依赖并重生成 lock，包更小但 lock 重建与版本漂移风险更高。两者都不改变 Go module 白名单；由协调者选。 |

## 一、触及子系统清单（架构法第一条）

项目没有目标图，故不存在可直接读取的 `domains` 子系统数组；以下清单以 contract §1 的依赖方向和本轮实读路径为准。每项均逐条核过架构法的四条派卡资格。

| id | 子系统与类型 | 派卡资格核对 |
|---|---|---|
| **S1** | `charter/graph`：**逻辑型**。包含 `graph/webui` 前端资产包、Go embed 门和 graph module 的现有测试。 | 有界路径 `graph/webui/**` + `.github/workflows/ci.yml`；导出面可枚举为 `webui.FS()`、前端 client/types/viewer；依赖 DAG 为 S1 → 发版边界 → S2，无回调环；接缝对面是本仓自有代码，Go/Vitest 可闭环。 |
| **S2** | `handoff` 宿主：**逻辑型**。只负责消费 `graph/webui`、注册静态挂载、渲染 iframe 和保留既有 API。 | 有界文件集为 `go.mod/go.sum`、`internal/agentd/server.go`、`web/src/app/codegraph/CodegraphFrame.tsx`、`web/src/app/shell/Shell.tsx`；宿主契约是静态 FS + 两条既有 API + 路由；依赖只从 S1 单向流入；宿主代码和既有测试可闭环。浏览器/鉴权的行为半边另列真机清单。 |
| **S3** | 发版、module proxy、GitHub Actions、浏览器/桌面薄壳：**边界型**。对面是外部发布系统与真实浏览器，不以 mock 结论抵账。 | 有界证据面为 `graph/go.mod`、`graph/webui/dist/**`、`.github/workflows/release.yml`、handoff `go.mod/go.sum`；契约形状可枚举为 tag → module zip → `webui.FS()`、同源 cookie/iframe；DAG 为 S1 → S3 → S2；类型明确为边界型，行为归协调者真机执行。 |

### 竖切资格核查

- `graph/webui` 已是独立包边界，迁入的 10 个源文件与 9 个测试文件均可按目标目录圈定；没有同层前缀家族达到 5 个源文件、无单包 40 个源文件、无超过 2~3 万行的上下文单元，**不插竖切还债卡**。
- handoff 只替换 `codegraph` 入口薄壳，`Shell.tsx`/`server.go` 是既有组装点，新增内容不形成层内家族；`internal/agentd` 的存量规模不因本卡触发重构，**不把竖切债塞进本卡**。
- S3 是外部边界，不是可继续拆成内部包的代码子系统；不派实现卡，只保留边界型发版/真机卡。

## 二、契约增量核对

### 逐条核对冻结清单

| 冻结项 | 本次拆解结论 |
|---:|---|
| 1 | 由 T2 固定包名 `webui`；不新增别的公共包名。 |
| 2 | 由 T2 实现唯一 Go 导出 `FS() fs.FS`；不派 HTTP handler。 |
| 3 | 由 T2 的 embed 测试验收 FS 根能读 `index.html`。 |
| 4 | 由 T2 验收 `fs.Sub` 后根不含外层 `dist/`。 |
| 5 | 由 T2 固定正式实现 `//go:embed all:dist`；Ticket 0 空壳只作为待替换基线。 |
| 6 | 由 T2 固定 `fs.Sub(distFS, "dist")`。 |
| 7 | 由 T2 验收不可达 `fs.Sub` 错误 panic，不静默返回空 FS。 |
| 8 | T2/T4 均不新增 HTTP handler 导出；路由仍归 S2。 |
| 9 | T2 不导出 `Embedded()`。 |
| 10 | T1/T2 不引入 handoff import；S1 → S2 只经 module/FS。 |
| 11 | T2 的 Go 包只准 `embed`、`io/fs` 等标准库；第三方依赖门不放宽。 |
| 12 | T1/T2 不改 `graph/go.mod` 的 cobra `v1.10.2`；P2 只影响前端 manifest。 |
| 13 | T2 将 `graph/webui/dist/` 作为 Git 提交物；不写 `.gitignore` 排除。 |
| 14 | T1 迁入恰 10 个现有查看器源文件；新增的 client/types/CSS 属于自带边界文件，不冒充迁入数量。 |
| 15 | T1 迁入恰 9 个现有测试文件；若 P1/P2 之外需要 wire 回归，只新增最小 client transport test，不删除或合并这 9 个。 |
| 16 | T1 的验收逐名核对 9 个测试文件仍存在并被 `npm test` 收集。 |
| 17 | T1 删除查看器对 `useProjectTree` 的依赖；只由 URL project 驱动。 |
| 18 | T1 验收查看器从自身 URL 读取 `project` query。 |
| 19 | T1 验收空 project 不触发整图 fetch，并保留空状态。 |
| 20 | T1 不新增 `/api/projects` 或其它项目列表 API。 |
| 21 | T1 迁移目录不引入 `react-router`；三态仍由组件 state 驱动。 |
| 22 | T1 保留只按 `domains` 段消费的语义，不按包名伪造领域。 |
| 23 | T1 的 `types.ts` 增加 `CgNode.projScanned?: boolean`。 |
| 24 | T1 的 `CgGraph` 保留 `implements?: [string,string][]`。 |
| 25 | T1 的 `CgGraph` 保留 `projections?: [string,string,string][]`。 |
| 26 | T1 的 `CgGraph` 保留 `lifecycle?: CgLifecycleRef[]`。 |
| 27 | T1 的 `CgDiff` 保留 `containersAdded?: Record<string,CgContainer>`。 |
| 28 | T1 的 `CgDiff` 保留 `implementsAdded/Deleted`。 |
| 29 | T1 的 `CgDiff` 保留 `projectionsAdded/Deleted`。 |
| 30 | T1 的 `CgDiff` 保留 `lifecycleAdded/Deleted`。 |
| 31 | T1 固定 `CodegraphResp.views` 为 `Record<string, CgDiff>`。 |
| 32 | T1 固定 `CgSourceResp.from` 为 `number`，并在序列化回归中区分缺失与零。 |
| 33 | T1 保留 `fetchCodegraph(project: string)`。 |
| 34 | T1 保留 `fetchCodegraphSource(project, file, line, span = 40)`。 |
| 35 | T1 验收两个请求都使用同源相对路径。 |
| 36 | T1 验收底层 request 使用 `credentials: 'same-origin'`。 |
| 37 | T1 验收 client 不读/发 token；cookie 归宿主浏览器。 |
| 38 | T4 不改整图端点的成功响应 `baseline`；既有 provider 测试继续验。 |
| 39 | T4 不改整图端点的 `views`；迁入 viewer 仅消费，不重定义。 |
| 40 | T4 不改整图端点的 `stale`；T1 类型与 T4 provider 共同对账。 |
| 41 | T4 保留未登记项目 404；不在 iframe 层吞掉。 |
| 42 | T4 保留缺 baseline 404。 |
| 43 | T4 保留 `未生成代码图` 文案；这是已知债，不在本卡结构化。 |
| 44 | T4 保留坏 diff 跳过整页的 provider 行为。 |
| 45 | T4 保留 server 将缺省 stale 归一为空数组。 |
| 46 | T4 不改源码端点成功键 `file/from/lines`。 |
| 47 | T4 保留空 `file` 拒绝。 |
| 48 | T4 保留绝对路径拒绝。 |
| 49 | T4 保留 `..` 路径逃逸拒绝。 |
| 50 | T4 保留源码端点默认 `span=40`。 |
| 51 | T4 保留 `span>200` 截为 200。 |
| 52 | T4 保留窗口最多向上带 3 行上下文。 |
| 53 | T4 保留越界行号截到文件边界而非报错。 |
| 54 | T4 新增且只新增 handoff `/codegraph/app/` 静态挂载。 |
| 55 | T4 固定使用 `http.StripPrefix`，不另造 handler。 |
| 56 | T4 验收静态挂载位于 `s.auth` 保护范围内。 |
| 57 | T4 固定 `CodegraphFrame({ project: string })`。 |
| 58 | T4 固定 iframe project 使用 `encodeURIComponent`。 |
| 59 | T4 验收 iframe 与宿主同源；不加 CORS/postMessage。 |
| 60 | T4 固定 iframe URL 的 `?project=`，不把 API 路径参数改 query。 |
| 61 | T4 保留 handoff `/codegraph` 路由。 |
| 62 | T4 将该路由 element 替换为 `CodegraphFrame`。 |
| 63 | T4 将 `/codegraph` 加入 `fullPageRoute`。 |
| 64 | T4 验收 full-page 页面不渲染 Breadcrumb。 |
| 65 | T4 验收 full-page 页面不渲染 FileTree。 |
| 66 | T4 保留 ProjectTree 既有入口导航到 `/codegraph`。 |
| 67 | T4 明确 `handoff/internal/webui` 不在文件集内，不删除不改写。 |
| 68 | T1 的 `npm test` 要求 9 个迁入测试全部通过。 |
| 69 | T2 的 `webui_test.go` 要求 FS 读到 `index.html`。 |
| 70 | T2 的 embed 测试递归统计非目录文件不少于 3。 |
| 71 | T2 的 CI 要求新构建产物与提交的 `dist/` 逐字节一致，否则非零。 |
| 72 | 全部卡不新增 `codegraph/target.json`；charter 根无目标图，人工清单承接。 |
| 73 | 全部卡不新增空的 `codegraph/diffs/<branch>.json`。 |

### 不退回 contract 的边界澄清（已回写 contract §11）

1. `graph/webui/src/api/types.ts` 是 S1 的包内 wire 镜像，字段来源是 `graph/codegraph/types.go`；它不是第三条宿主 API，也不扩大 host seam。
2. `graph/webui/dist/` 与 `.github/workflows/ci.yml` 是同一静态资产交付的构建/保全面，不是新的运行时网络接缝；唯一运行时交付仍是 `FS()`。
3. `/codegraph/app/` 是 handoff 的本次挂载实例；通用契约仍是同源任意挂载点，相对 base 使挂载点不进入 viewer API。
4. `?project=` 只在 iframe URL 层传值，`/api/projects/{name}` 仍是 provider 的路径参数；两层并存不是重复契约。
5. handoff 的既有 `codegraph.go` provider handler 和 `internal/webui` embed 包均属存量边界，T4 只消费/挂载，不把它们迁入 S1。

以上澄清均未新增接缝、字段、路由或导出面；若协调者认为任何一条实际需要新接缝，必须先退回 contract，本稿不继续拆。

## 三、子卡清单与依赖 DAG

### T1【S1·逻辑型】查看器源码、wire 镜像与测试迁移

#### ①契约引用

contract §3-1～§3-3、§4、§5-3、§7-1、冻结项 14～37、68；`graph/codegraph/types.go#Graph/#Diff/#Node` 是 TS wire 的事实源。

#### ②意图与为什么

把 viewer 的 10 个源文件和 9 个测试文件从 handoff 迁入 `graph/webui`，同时把原先从 handoff 目录借用的 client、types、主题 CSS 变成工具自己的最小边界。项目选择改由 URL `?project=` 提供，查看器不再认识 handoff 的项目树；这使 UI 语义与 Go 算法同仓，并把 handoff 依赖收窄为 host API。

有界文件集：

```text
graph/webui/index.html
graph/webui/package.json
graph/webui/package-lock.json
graph/webui/vite.config.ts
graph/webui/tsconfig*.json
graph/webui/src/api/client.ts
graph/webui/src/api/types.ts
graph/webui/src/index.css
graph/webui/src/test/setup.ts
graph/webui/src/app/codegraph/{CallTree,CodegraphPage,DetailPanel,DomainDetail,DomainPanorama,FocusGraph,domainlayout,domains,graphmath,useCodegraph}.{tsx,ts}
graph/webui/src/app/codegraph/{CallTree,CodegraphPage,DetailPanel,DomainDetail,DomainPanorama,FocusGraph,domainlayout,domains,graphmath}.{test.tsx,test.ts}
```

上面 brace 集合按实际后缀解释为 10 个源文件 + 9 个测试文件；允许另有一个最小 `src/api/client.test.ts` 作为真实 JSON 解析回归，不计入“迁入 9 个”冻结数量。

#### ③验收

机内可独立执行：

1. `cd graph/webui && npm ci && npm test` 退出码为 0；文件枚举恰有 9 个迁入测试文件，9 个均被 Vitest 收集，不以删测试或跳过测试换绿。
2. `cd graph/webui && npm run build` 退出码为 0，并生成含 `index.html` 的 `dist/`；构建使用相对 base，产物不写死 `/codegraph/app/`。
3. `rg -n "useProjectTree|react-router|/api/projects" graph/webui/src` 对 viewer 源码零命中（`/api/projects/{name}` 只能出现在 client 的两条既定路径模板中）；`CodegraphPage` 读取 URL `project`，空值用例断言 `fetchCodegraph` 未被调用。
4. `types.ts` 编译通过且包含冻结新增字段；client 回归使用真正执行 `Response.json()`/JSON.parse 的序列化边界，分别喂“字段缺失”和 `from: 0`，断言前者为 `undefined`、后者为数字 0；同时覆盖 `projScanned`、`implements`、`projections`、`lifecycle`、`containersAdded` 不被投影丢失。该测试是最小 transport test，不建立 CDC 基础设施。
5. `CodegraphPage` 的三态、无领域降级、未扫描、真错误、加载中断言仍在；未扫描仍按 `未生成代码图` 可行动地显示空态，真错误保留原文和重试；项目下拉断言改为 URL project 断言，不删除错误可观察性。
6. `DetailPanel` 测试仍断言 `fetchCodegraphSource('demo', 'svc/server.go', 4)`，源码窗口 `file/from/lines` 显示可见；`graphmath/domains/domainlayout` 的既有反面断言继续通过。

缺陷族对抗结论（结论均属于本卡验收）：

| 族 | 结论 |
|---|---|
| 生命周期 / 状态机中断 | 无新增运行时状态机，因为 T1 只搬静态源码和测试；`npm` 中途退出只留下可见的工作树/临时 `node_modules`，不产生进程、工单或服务端孤儿。完成条件仍是 T2 的提交 dist 与构建门，不能把半成品当可发布资产。 |
| 静默失败 / 误导报错 | `project=''` 必须不请求；404 未扫描与其它错误分支分别显示；ApiError 原文不吞。反面断言在验收 3、5 中，故不存在“空页但报成功”的窗口。 |
| 跨平台假设 | URL 段和 `file` 用 `encodeURIComponent`，构建用相对 base，不用宿主绝对路径或 `filepath`；Node 24 与浏览器 DOM 仍是外部环境假设，跨浏览器结果未验证，列入真机清单。 |
| 假红 / 假绿测试 | 迁入测试数量、空 project 不请求、错误原文、缺失/零值序列化均为反面或边界断言；组件夹具仍不能证明真实宿主浏览器像素一致，逐屏事实列入真机清单。 |
| 门禁绕过 | 新 client 只有两条只读同源 GET，不新增写/执行入口，不读 token；同一 `request` 门覆盖整图和源码请求，验收 grep 防止旁路 `fetch`。 |
| 序列化边界 | Go `types.go` → JSON 键 → TS `types.ts` → client `Response.json()` → viewer 消费逐处列入文件集；transport test 区分字段缺失和零值，避免“两端各自绿、中间投影丢字段”。 |
| 枚举新值过既有白名单 | 本卡不新增 `Node.kind` 取值；既有 `entry/func/model` 的分支在 `graphmath.ts`、`domains.ts`、`CallTree.tsx`、`FocusGraph.tsx`、`DomainDetail.tsx` 逐处核对。`lifecycle.kind` 仅镜像 Go 已有 `creator/writer`，无新的消费 switch；若实读发现白名单，必须在 T1 验收中补登记。 |
| 承重安全属性 | 无 token 一次性/隔离属性，因为查看器不发凭据、不写数据；同源 cookie 由宿主持有，T4/T5 负责锁 auth。viewer 自身承重属性是“空 project 不 fetch”和“错误不吞”，已有能变红的测试。 |

#### ④入口指针

charter：`graph/webui/`（新前端工程）、`graph/codegraph/types.go`（canonical wire）；handoff 迁移源：`web/src/app/codegraph/`、`web/src/api/client.ts`、`web/src/api/types.ts`、`web/src/index.css`、`web/package.json`、`web/vite.config.ts`、`web/tsconfig*.json`。

### T2【S1·逻辑型】正式 embed、资源测试与 CI 防漂移门

#### ①契约引用

contract §2、§7-2、冻结项 1～13、69～71；现有 handoff 资源测试的判据出处为 `internal/webui/embed_test.go#TestEmbeddedFSHasRealAssets`。

#### ②意图与为什么

把 Ticket 0 的空 `embed.FS` 变为可被 module consumer 直接使用的静态资产包：FS 根直接暴露 `index.html`，`dist` 作为已提交 module 内容，CI 每次重建并逐字节比对，阻断源码与发布界面漂移。Go release 不依赖 Node；Node 只存在于 CI 的防漂移门。

有界文件集：`graph/webui/webui.go`、`graph/webui/webui_test.go`、`graph/webui/dist/**`、`.github/workflows/ci.yml`、`graph/go.mod`（只读依赖门）、`.gitignore`（只读确认不忽略 dist）。

#### ③验收

1. `cd graph && go test ./... -count=1 && go vet ./... && go build ./...` 全部退出码为 0；在无 Node 的 Go 构建环境中仍能完成，因为 `dist` 已提交。
2. `go test` 中 `FS()` 读取根 `index.html` 成功；递归 `fs.WalkDir(FS(), ".")` 的非目录文件数不少于 3；`fs.Stat(FS(), "dist")` 返回不存在，证明根没有外层 `dist/`。
3. `webui.go` 的 import 只有标准库，正式实现出现 `//go:embed all:dist`、`fs.Sub(distFS, "dist")`，不可达错误 panic；`go doc`/源码 grep 证明无 HTTP handler、`Embedded()` 或 build tag 分支。
4. `.github/workflows/ci.yml` 明确使用 Node 24、`npm ci`、`npm test`、`npm run build`，并对新构建的 `dist/` 与提交 `graph/webui/dist/` 做逐字节比较；比较不一致时 job 返回非零。release workflow 不被改成依赖 Node。
5. 变异复验：在临时副本仅改变提交 dist 的一个字节，运行漂移比较命令必须非零；恢复后同一命令为零。不能只断言 `go build`，因为那会让旧 dist 假绿。

缺陷族对抗结论（结论均属于本卡验收）：

| 族 | 结论 |
|---|---|
| 生命周期 / 状态机中断 | 无运行时长生命周期，因为 FS 只读静态字节；CI/build 中途终止不会产生服务端进程或工单，临时产物由 runner/工作树清理或以 `git status` 可见。提交 dist 与源码不同步时由漂移门阻断，不由运行时补救。 |
| 静默失败 / 误导报错 | 空 embed 不能以“编译成功”报成功：`index.html`、文件数 ≥3、根无 `dist/` 三重断言必须同时过；漂移比较非零且输出待修路径，不能静默沿用旧界面。 |
| 跨平台假设 | `go:embed`/`io/fs` 使用 module 内 `/` 逻辑路径，不依赖宿主文件系统分隔符；六平台 Go release 继续 `CGO_ENABLED=0`。CI shell/Node 是 Linux runner 假设，发布跨平台行为需真机清单验证。 |
| 假红 / 假绿测试 | embed 文件数与根路径是反面断言，变异 dist 必须把 CI 变红；仅 `go build` 或只读 index 都不够。真实 module zip 是否携带 dist 不是夹具可证，转 T3 真机。 |
| 门禁绕过 | 新增的是静态读资源，不新增 HTTP 写/执行表面；CI 的构建写入只发生在 runner 工作目录，release 仍由既有最小 `contents:write` 门保护。`dist` 不进 gitignore，避免“绕过门”靠缺资产发布。 |
| 序列化边界 | 本卡没有 JSON wire 字段，但有 `dist` 文件系统投影：`go:embed` → `fs.Sub` → host SPA 读取。`index.html`/≥3 资源/无外层目录三断言锁每一处投影；不要以字节数量替代可读文件断言。 |
| 枚举新值过既有白名单 | 无，因为本卡不新增状态、事件或 kind；Go module 依赖白名单仍由 `graph/cli/deps_test.go#TestModuleDependencyAllowlist` 锁定。 |
| 承重安全属性 | 无 token/唯一性属性；承重不变式是 FS 根形状、标准库-only、dist 提交和漂移门，均有能变红的测试/比较。 |

#### ④入口指针

`graph/webui/webui.go`、`graph/webui/webui_test.go`、`graph/webui/dist/`、`.github/workflows/ci.yml`、`graph/cli/deps_test.go`、`.github/workflows/release.yml`。

### T3【S3·边界型】发版与 module consumer 卡点

#### ①契约引用

contract §6、§7-2、§9-1、spec「实现分两阶段且中间有发版卡点」；版本号使用待拍板 P1 的 `<GRAPH_TAG>`，不得在本稿假定。

#### ②意图与为什么

把 S1 的提交物变成真实可消费的 graph module，再允许 S2 升版。这个卡点对面是 module proxy、GitHub release 与无 Node 的消费者环境，机内 Go 测试不能代替它；它必须显式出现在 DAG 中，避免 handoff 以未发布或不含 dist 的版本误绿。

有界证据文件集：charter `graph/go.mod`、`graph/webui/dist/**`、`.github/workflows/release.yml`；handoff `go.mod`、`go.sum`。外部状态为 `<GRAPH_TAG>` 的 tag、module zip、六平台 release assets。

#### ③验收

以下均为**未验证，需真机，归协调者执行**：

1. 对拍板后的 `<GRAPH_TAG>`，在干净临时 consumer 中执行 `go mod download github.com/Xsxdot/charter/graph@<GRAPH_TAG>`，退出码为 0；consumer 不使用 `replace`，且 module cache 中可读 `webui` 的 `index.html`/JS/CSS。
2. 在同一干净 consumer 中编译一个只 import `github.com/Xsxdot/charter/graph/webui` 并调用 `webui.FS()` 的最小程序，退出码为 0；这条证明 zip 不只是 tag 存在，而是 embed 目标随 module 交付。
3. 推送 `<GRAPH_TAG>` 后 release workflow 的六平台资产和 checksums 全部生成，workflow 的 `go vet`/`go test`/构建均绿；release 过程不安装 Node。
4. handoff 升版后 `go.mod` 中 graph 版本等于 `<GRAPH_TAG>` 且 `grep -c '^replace' go.mod` 返回 0；`go mod tidy` 不回退到旧版本。

缺陷族对抗结论（结论均属于本卡验收）：

| 族 | 结论 |
|---|---|
| 生命周期 / 状态机中断 | 发版是外部状态机：tag、workflow、module proxy、consumer 下载可能在任一步中断。无孤儿进程由本卡创建；协调者必须以 workflow 完成、module clean download 和 handoff 升版三证据收尾，失败不得把 tag 存在误报成可消费。未验证，需真机。 |
| 静默失败 / 误导报错 | “tag 已推送”不等于 module zip 带 dist；最小 consumer 编译和 `FS()` 资源读取是反成功断言。`go mod download`/release/checksum 的原始错误必须保留，失败不可降格为“稍后再试”。未验证，需真机。 |
| 跨平台假设 | module zip 与 Go 六平台构建、Windows archive、代理缓存是外部现实；release workflow 的六平台构建形状可机内读，真实资产齐全与 consumer 可取需真机。 |
| 假红 / 假绿测试 | 本地 graph 测试不能证明 module zip；clean consumer、无 Node 构建和六资产 checksums 才是外部尺。必须避免使用当前工作树的 `replace` 或旧 module cache 作为证据。 |
| 门禁绕过 | 发版写入 GitHub Release 需要既有 `contents:write` 权限；本执行者不 push、不改 tag。handoff 升版必须去掉 `replace`，不能以本地路径绕过发布门。并发下发布动作由平台串行状态承担，若出现半成品由协调者复核 workflow。 |
| 序列化边界 | Go module zip 是 `dist` 从 Git tree 到 consumer FS 的真实序列化/打包边界；最小 consumer 直接读 `index.html`、JS、CSS，覆盖“目录存在但为空”和“字段/资源缺失”两类反面。 |
| 枚举新值过既有白名单 | 无新增业务枚举；tag 版本字符串只流过既有 release tag 解析，不进入 codegraph wire switch。workflow 资产命名须逐项核对，不把未识别 tag 当成功。 |
| 承重安全属性 | 无 token/一次性凭据属性；承重属性是 module 可解析、dist 随包、无 replace、六资产齐，均有独立真机命令锁定。 |

#### ④入口指针

charter：`graph/go.mod`、`graph/webui/dist/`、`.github/workflows/release.yml`；handoff：`go.mod`、`go.sum`。外部：`<GRAPH_TAG>`、module proxy、GitHub Actions/Release。

### T4【S2·逻辑型，含边界真机半边】handoff 同源挂载、iframe 宿主与 full-page 修复

#### ①契约引用

contract §5、§6、§7-3、冻结项 38～67；handoff 现状锚为 `internal/agentd/codegraph.go#handleProjectCodegraph/#handleProjectCodegraphSource`、`internal/agentd/webhandler.go#newSPAHandler`、`internal/agentd/server.go`、`web/src/app/shell/Shell.tsx`、`web/src/app/tree/ProjectTree.tsx`。

#### ②意图与为什么

让 handoff 只保留宿主薄壳：升到 `<GRAPH_TAG>`，把 `webui.FS()` 接到既有 SPA handler 的 `/codegraph/app/`，用同源 iframe 传 `?project=`，并把 `/codegraph` 加入 full-page 白名单，从而移除无关 Breadcrumb/FileTree 挤压。既有两条 API、ProjectTree 入口与 handoff 自有 `internal/webui` 均不改。

有界文件集：

```text
handoff/go.mod
handoff/go.sum
handoff/internal/agentd/server.go
handoff/web/src/app/codegraph/CodegraphFrame.tsx
handoff/web/src/app/codegraph/（删除旧 viewer，仅保留 CodegraphFrame.tsx）
handoff/web/src/app/shell/Shell.tsx
handoff/web/src/app/tree/ProjectTree.tsx（只读核对入口，不改）
handoff/internal/agentd/codegraph.go（只读核对 API，不改）
handoff/internal/webui/**（明确不在修改集）
```

#### ③验收

机内可独立执行：

1. handoff 根 `go build ./... && go vet ./... && go test ./... -count=1` 全绿；`go.mod` 使用 `<GRAPH_TAG>`、无 `replace`。现有 `internal/agentd/codegraph_test.go` 继续覆盖整图/源码 provider 行为。
2. `rg -n "CodegraphPage|useProjectTree" web/src/app/codegraph web/src/app/shell` 只剩允许的迁移历史/零命中；该目录只保留 `CodegraphFrame.tsx`，其 props 含 `project: string`，iframe src 精确为 `"/codegraph/app/?project=" + encodeURIComponent(project)`。
3. `server.go` 同时保留两条 `/api/projects/{name}/codegraph*` 注册，并新增 `http.StripPrefix("/codegraph/app/", newSPAHandler(webui.FS(), ...))`；静态挂载在 `s.auth(mux)` 保护范围内。`internal/webui` 的 `git diff` 为空。
4. `Shell.tsx` 的 `/codegraph` route 仍存在但 element 为 `CodegraphFrame`，project 来自 `wb.base?.projectName ?? ''`；`fullPageRoute` 命中 `/codegraph`。代码审查/组件测试必须能指出 Breadcrumb 和 FileTree 的两个条件均被挡住，ProjectTree 既有按钮仍只导航 `/codegraph`。
5. T4 的边界行为列入真机：访问 `/codegraph/app/` 得到嵌入 `index.html`，访问深路径回落同一 index，非 GET/HEAD 返回 405；未登录访问同一路径得到宿主 auth 响应，不出现绕过 cookie 的静态页。访问 `/codegraph` 时 iframe 与宿主保持同源，URL 对空格、`/`、中文项目名编码后可还原。
6. T4 的边界行为列入真机：同一个已登记项目的领域全景、叶子树/图、详情面板、源码窗口、焦点历史逐屏与搬迁前对照；唯一预期可见差异是查看器自身项目下拉消失，以及右侧 FileTree/Breadcrumb 不再挤压。404 未扫描、真错误和源码路径逃逸仍显示既有可行动语义。

缺陷族对抗结论（结论均属于本卡验收）：

| 族 | 结论 |
|---|---|
| 生命周期 / 状态机中断 | 进程重启只会切换宿主二进制，静态 FS/iframe 不创建工单、临时目录或子进程；新旧版本不会同时由本卡管理。若升级中断，旧 handoff 仍是现状，必须由真机确认不会出现半挂载路由或孤儿静态服务。未验证，需真机。 |
| 静默失败 / 误导报错 | `/codegraph/app/` 缺资源、深路径 fallback、auth 401、API 404/500、源码 400/404 均必须可观察；viewer 不把真错误当未扫描，不把静态空壳报成功。已有 handler 的错误契约保持不变，真机 5/6 反面覆盖。 |
| 跨平台假设 | same-origin iframe、cookie `SameSite=Lax`、桌面薄壳顶层导航、浏览器 URL 编码和宿主 auth 是跨浏览器/桌面假设；Go 路径挂载用 URL `/`，不把 OS 文件路径交给 viewer。桌面薄壳与普通浏览器行为未验证，归真机。 |
| 假红 / 假绿测试 | Go 路由/endpoint 测试只证明 handler 形状，不能证明 iframe 实际加载、cookie、深路径 fallback 或像素；真机 5/6 是独立外部尺。负向断言包括 auth 拒绝、非 GET 405、未知项目/坏 file 错误与“不出现 FileTree/Breadcrumb”。 |
| 门禁绕过 | 新静态入口必须注册在 `s.auth` 内，API/静态资源共享宿主 cookie 门；不新增 CORS、postMessage、token、端口或第二项目选择器。检查与动作间无新增权限判定窗口，真实并发/重启仍需真机观察。 |
| 序列化边界 | provider `codegraph.go` JSON → viewer `client.ts` → TS `types.ts` → 组件 props 是同一条链；T1 的真实 JSON parse 回归覆盖缺失/零值，T4 保留 provider `baseline/views/stale` 与 `file/from/lines` 的实际 HTTP 测试，不能只靠两端类型编译。 |
| 枚举新值过既有白名单 | 本卡不新增 API 状态、route kind 或图 kind；现有 `entry/func/model` 消费仍在 viewer，HTTP 状态/错误分支沿既有 handler。所有路由注册、`fullPageRoute`、404 文案与 source 校验点逐处核对，不能让 `/codegraph/app/` 成为未登记白名单的旁路。 |
| 承重安全属性 | 同源隔离和宿主鉴权是承重安全属性：auth 包裹静态入口、cookie 不由 viewer 读取、无 Authorization header。Go/grep 能锁结构，真正“未登录不能读 iframe、登录后同源 fetch 带 cookie”必须真机变红复验。 |

#### ④入口指针

`handoff/go.mod`、`go.sum`、`internal/agentd/server.go`、`internal/agentd/codegraph.go`、`internal/agentd/webhandler.go`、`web/src/app/codegraph/`、`web/src/app/shell/Shell.tsx`、`web/src/app/tree/ProjectTree.tsx`；明确排除 `internal/webui/**`。

### 依赖 DAG

```text
T1（viewer 源码 + wire + 测试）
 └──→ T2（dist + embed + CI 漂移门）
          └──→ T3（协调者发 <GRAPH_TAG>，module/Release 真机）
                         └──→ T4（handoff 升版 + iframe + full-page）
T1 ───────────────────────────────────────────────→ T4（迁移契约与真实 JSON 断言作为消费侧基准）
```

T3 是显式发版卡点：T4 不得在未发布 `<GRAPH_TAG>` 或保留 `replace` 的状态下假装完成。T1/T2/T4 文件集互不发生“为了方便”跨边界改写；T4 对 provider 与 handoff `internal/webui` 只读核对。

## 四、缺陷族全集对抗审查（基线 `charter@6a2ddc9`）

项目没有独立的缺陷族清单文件；本稿以 `skills/defect-families/SKILL.md` 的通用五族 + 序列化边界、枚举新值、承重安全属性为下限。T1～T4 的验收栏已逐族回答，汇总如下，便于协调者查漏：

| 族 | T1 | T2 | T3 | T4 |
|---|---|---|---|---|
| 生命周期 / 状态机中断 | 静态迁移无服务孤儿；半成品不可发布 | 只读 FS/CI，无运行时孤儿 | tag/workflow/proxy/consumer 中断须真机收口 | 宿主重启/升级半挂载须真机 |
| 静默失败 / 误导报错 | 空 project、404、真错误正反断言 | 空 embed 与漂移门反断言 | clean consumer 防“tag 存在即成功” | auth、fallback、API 错误、源码错误可行动 |
| 跨平台假设 | relative base/URL 编码，浏览器待真机 | Go FS/六平台，CI runner 待真机 | proxy/六资产/Windows archive 待真机 | cookie/iframe/桌面薄壳待真机 |
| 假红 / 假绿测试 | 9 测试 + transport + negative | 文件树 + 变异漂移 | clean module consumer + assets | 浏览器 iframe/像素/权限外部尺 |
| 门禁绕过 | 同一只读 request、无 token | static asset 无新运行时面、CI 权限 | no replace、既有 release 权限 | auth 包裹全部静态面、无旁路 |
| 序列化边界 | Go canonical→JSON→TS→viewer，缺失/零值 | embed FS 根投影逐项断言 | module zip→consumer FS | provider JSON→client→组件全链 |
| 枚举新值过既有白名单 | 既有 kind 全部核对，无新值 | 无枚举变化，依赖白名单仍锁 | tag 只走 release 解析，无业务 switch | route/HTTP/error/kind 既有入口逐处核对 |
| 承重安全属性 | 无凭据；空 project/错误可变红 | FS 根/dist/漂移门可变红 | module 可消费/无 replace/资产齐 | auth/same-origin/cookie 真机变异 |

## 五、真机清单（全部标“未验证，需真机”，归协调者执行）

1. 按 P1 选定 `<GRAPH_TAG>` 推送 tag，确认 workflow 六平台资产、checksums、release 状态全绿；不得把本地 `HEAD` 或已有 module cache 当发版证据。
2. 在无 Node 的干净 consumer 中下载 `<GRAPH_TAG>`，编译并运行最小 `webui.FS()` 程序，读到 `index.html`、JS、CSS；确认无 `replace`。
3. 在真实 handoff 设备/浏览器上访问 `/codegraph/app/` 与深路径：同一 index、非 GET/HEAD 405、未登录被 auth 拒绝；登录后 iframe fetch 使用同源 cookie。
4. 用项目名含空格、斜杠、中文的真实项目验证 iframe `?project=` 编解码及两条 `/api/projects/{name}` 请求；检查未登记、未扫描、真错误、source 路径逃逸各自仍显示既有语义。
5. 在普通浏览器和 handoff 桌面薄壳分别打开 `/codegraph`，确认没有 Breadcrumb/FileTree；确认 ProjectTree 入口仍可导航，并逐屏对照搬迁前的领域全景、焦点图、详情、源码窗口、焦点历史。
6. 在一台没有 Node 的环境执行 handoff/charter Go 构建，确认已提交 dist 使 release/consumer 不需现场构建前端。
7. 对 CI 漂移门做一次可恢复变异：只改 dist 一个字节必须红，恢复源码/产物后必须绿；不得留下工作树脏改动。
8. 在真实升级中途重启/重新加载一次 agentd，确认不会留下孤儿进程、半挂载静态路由或旧 iframe 指向错误 host；若失败，保留原始日志并退回 review。

## 六、图覆盖债

charter 根无 `codegraph/target.json`，因此本稿不伪造目标图、baseline 或 diff；S1 引用以直接实读 `graph/webui/webui.go`、`graph/codegraph/types.go`、`graph/cli/deps_test.go` 为准。handoff 侧引用以 contract 已冻结的 `file#Symbol`/路径为准，因本 worktree 不含 handoff 仓，不能把跨仓锚误报为本仓可解析。新增未命中符号：无；本稿不运行 `codegraph resolve` 伪造跨仓结果。

## 七、交稿自检

1. 触及子系统清单：S1/S2/S3 均有类型与四条派卡资格核对；无目标图事实已明示。
2. 契约增量核对：冻结项 1～73 逐条分配；5 条边界澄清已列并回写 contract §11；未发现需要新接缝的事项。
3. 子卡：T1～T4 均含契约引用、意图/为什么、行为化验收、入口指针；每卡文件集有界；无竖切触发。
4. 缺陷族：T1～T4 各自逐答通用五族与三追加族；无用“一句无风险”带过的族。
5. 待拍板岔口：P1/P2 已集中置顶，正文不自批。
6. 真机项：8 条全集已汇总，所有跨浏览器、module proxy、发布、cookie/iframe、像素与重启行为均标“未验证，需真机”。

交棒：协调者按 P1/P2 拍板后，进入单轮 implement；发版卡 T3 必须保留在执行 DAG 中。
