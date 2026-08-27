# C12 implement 节点台账

分支 `cards/C12-charter-6`。本节点实现代码图查看器两轴形态、两条视图模型缝及 C12 wire 执法；不触 handoff 宿主、扫描器或项目真实图。

## 本轮产出

- `graph/codegraph`：`BestDomain` 删除 `responsibility`，职责正文由 `domains/*.json` 读取；迁移不再写职责占位符。补齐容器 kind、入口 channel、flows 的受控校验，并保留容器只能挂叶子领域的闸。
- `graph/webui/src/app/codegraph/scopepage.ts`：实现根→领域→容器递归同构、端口/调用与投影边、兜底桶占比、入口复用度、真假共享内核、空态、超大容器和组织切换降级。
- `graph/webui/src/app/codegraph/flowpage.ts`：实现入口归属三态、注册散度、入口族、流程步骤形状、蛇形折列所需模型、递归入口、`iface`→`implements` join 与机械链显式降级。
- 新两轴页面组件装配右栏三 tab、可拖分隔条、迁移抽屉、双线框/紫框/投影标记；退役旧领域派生器与调用链/焦点组件，避免双派生器并存。
- 新增两缝纯函数测试与页面穿线测试；`docs/roadmap.md` 已回写 C12 后仍待处理的扫描器/真流程/重视觉对照缺口。

## 亲跑验证

- `cd graph/webui && npm test`：`Test Files 9 passed (9)`，`Tests 47 passed (47)`。
- `cd graph/webui && npm run typecheck`：退出码 0。
- `cd graph/webui && npm run build`：退出码 0；Vite 输出 `40 modules transformed`，生成 `dist/index.html`、CSS 与 JS bundle。
- `cd graph && go build ./...`：退出码 0。
- `cd graph && go test ./... -count=1`：退出码 0，四个包均通过。
- `cd graph && go vet ./codegraph/`：退出码 0。
- `git diff --check`：退出码 0，标准输出为空。
- `rg -n "deriveDomainPage|DomainCascadeDrawer|CallTree|FocusGraph|passthrough" graph/webui/src`：无匹配（rg 退出码 1，符合零命中语义）。

## 接缝缺陷与回旋镖对账

- 集成阶段新发现缺陷数：0。本节点自检中发现的面内问题均已修复：页面测试选择器与 DOM 属性不一致、容器选中后右栏误把 kind 当作 item 类型、同包类型职责不能跨容器匹配；不作为集成红线遗留。
- 判据预测：两缝可由纯函数和 jsdom 闭环——实测成立；旧组件退役后由 TypeScript 引用检查兜底——实测成立；Best 缺席必须显式不可用——模型测试已覆盖。
- 影响面预测：Go wire 同刀会触及 context/migrate/fixtures——实测已触及并由全量 Go 测试通过；Web UI 旧测试数量会因退役组件减少，新增模型/页面测试覆盖当前形态。
- 耗时预测：未在计划阶段固定分钟数，故无分钟差异可对账。
- 「无风险」结论：未作无风险承诺；真实浏览器/宿主/大图数据依赖 acceptance，保持未验证。

## 交棒：acceptance 未执行

下一步：acceptance，真机清单 6 条待执行。以下项目均登记为「未执行」：

1. 真实数据结构轴布局、空白、交叉与箭头方向，对照 `prototypes/base/README.md`。
2. 真实浏览器宽度/DPR 下流程图蛇形折列、拖分隔条与连线连续性。
3. 隐私模式/清 storage 后右栏宽度降级，以及键盘/读屏下 tab 与组织切换可用性。
4. 4000+ 边真实大图的页面耗时与交互流畅度。
5. handoff 宿主 iframe 的 `?project=` 传参联调与宿主 best/decl 双写差异复核。
6. 真 flows 数据到达后的 162 入口归属、散度、入口族真实读数复现。

本仓无项目级 `codegraph` 图，故不创建分支视图 diff；handoff 侧 responsibility 搬运、扫描配方自洽修复仍按 contract §6.2-1 交棒。
