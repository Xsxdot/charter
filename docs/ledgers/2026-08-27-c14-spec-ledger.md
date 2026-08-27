# C14 spec 台账（2026-08-27）

节点：spec（本地会话，协调者 + 用户）。卡：C14。

## 事实调查（本节点实跑，非转述）

- 偏差发现链：用户在隔离实例真机复核 → 两张截图 → 协调者发现 fork 副本实际存在于
  base worktree `prototypes/codegraph-two-axis/`（gitignored，`git ls-files` 不可见，
  昨日 finish 时误判「不可查」并已更账 prototypes/base/README.md）。
- 原型取证：`shared/graph.js` 293 行——Tarjan SCC 缩点（:8）、最长路分层（:21）、
  层内货架装箱（:43-50）、孤立节点不进分层图（:73）、环/双向边红标（:93, :243）、
  边色按预算（:65）、容器包群组 renderClusters（:124）。`index.html` 162 行、
  `style.css` 104 行、`mock.js` 为真数据抽取（handoff 仓入库图）。
- 实现取证（隔离实例 c12data + puppeteer DOM）：
  - 根层边：`call:declared×37, projection:declared×7, projection:(none)×2`——四档债务色
    无偏差（37 条全 declared，与 spec 2026-08-25 现状读数一致），图例/工具条/右栏均在。
  - `scopelayout.ts` grep 无 layer/topo/scc/环 任何命中——分层未实现，代码级证据。
  - 领域层（控制门面）15 节点：agentd.Server 卡面无 doc 职责文本（原型有），
    推导代码在 `scopepage.ts:503-506`（§2.3-26），真数据未出文本——推导或渲染断点待查。
- 定级复核：改动全在 `graph/webui`（派生层+组件），wire 响应零变更 → L2（非 L1：
  plan 增量非零，布局算法移植+三处卡面接线；非 L3：单子系统不动契约）。

## 用户裁决（本节点）

- 2026-08-27：修复直接按 fork 原型代码直对，不经 spec/plan 文字转述中间层——形态基准即代码。
  spec 因此保持薄：偏差清单 + 基准载体 + 验收重判据，不重述形态细节。
