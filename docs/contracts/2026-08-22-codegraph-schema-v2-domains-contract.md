# 契约：codegraph 刀 1+2——schema v2 + 领域图（随本提交冻结）

> 2026-08-22。上游：`docs/specs/2026-08-22-codegraph-schema-v2-domains-spec.md`（已批准）。
> module：`github.com/Xsxdot/charter/graph`，本批次发 **`graph/v0.3.0`**（breaking：target v1 拒读 + `TargetDomain`→`TargetSubsystem` 改名）。
> 查证基线：charter master（graph/v0.2.1 后）；现状出处均为本轮工作树实读。

## 修订记录（breakdown 拍板回写，2026-08-22）

| # | 修订 |
|---|---|
| R1 | 边界澄清（拍板 P3）：§2-2 的引用完整性执法**同时覆盖 `ValidateDiff`**——`lifecycleAdded/lifecycleDeleted` 的 Who/Model 端点按「基线∪nodesAdded」校验，坏引用视图在 absorb 前置检查即拒（与 §6-8 的 Validate 条目同源，非新接缝）；冻结清单 8 按此口径读 |
| R2 | 边缘限定（拍板 P4）：§3「文件名=Domain 字段」限**平铺**目录；领域 id 含 `/` 者判「不可声明」（LoadDomainDecls 不支持子目录递归），真要声明先改领域 id。现状：handoff 真实 19 域均无 `/`，仅 graph 夹具有此风格 |
| R3 | migrate 策略钉死（拍板 P2）：§4-1 的 migrate 读入用 `DisallowUnknownFields`——target 含 schema 外未知键时**拒迁报错**（有未知键说明被手工加过料，先人工处理再迁），不静默丢弃 |

## §1 target.json v2（刀 1）

现状（`graph/codegraph/target.go#Target`）：`Meta{Version,Project}`、`Domains []TargetDomain`、`Assignments []Assignment{Path,Domain}`、`Assembly`、`Contracts`。v2 契约：

1. 键改名：顶层 `domains`→**`subsystems`**；`assignments[].domain`→**`subsystem`**；`meta.version` 1→**2**。`assembly`/`contracts` 键与语义不变（`Contract.From/To` 引用的是子系统 id，字段名本就中立）。
2. 类型改名（Go API，v0.3.0 breaking）：`TargetDomain`→`TargetSubsystem`（字段 id/name/type/paths/note 照旧，`type` 仍只认 logic/boundary）；`Target.Domains`→`Target.Subsystems`；`Assignment.Domain`→`Assignment.Subsystem`；`(*Target).DomainOf`→**`SubsystemOf`**（三级优先语义照旧：assignments 精确 > paths 规则 > 图外，出处 `target.go#DomainOf`）。
3. **版本门（反静默）**：`LoadTarget` 在 `meta.version != 2` 时返回错误，错误文案必须含 `codegraph migrate` 指引；不做 v1 兼容读（spec 裁决 5）。
4. `ValidateTarget`/`Check` 的人读文案「域」→「子系统」；**wire 键与枚举不变**：`Report.Fails[].Kind` 仍为 `new-direction`/`over-budget`（消费方按 Kind 分类，Detail 是人读文本可改）。
5. 消费方核对（刀 0 契约 §3 的四入口复核）：`cmd/graph_gate_test.go` 用 `LoadTarget/ValidateTarget/LoadGraph/Check/Merge`——**名称均不变**，编译无感；agentd 两 API 只碰 Graph 类型——additive 无感；`TargetDomain/DomainOf` 在 handoff 仓零引用（本轮 grep 实测）。

## §2 baseline 附加 lifecycle 段（刀 2 机械层）

先例：`Implements` 与 `Edges` 分列是既有 wire 决策（`types.go#Graph` 注释：Edge 二元组塞不进 kind）；`Projections` 为类型化三元组。lifecycle 依同模式做**独立顶层段**，additive-only：

```go
// LifecycleRef 一条生命周期关系：Who 对 Model 的创建或状态写入。
type LifecycleRef struct {
    Who   string `json:"who"`             // 图节点 id（构造函数 / 写入函数）
    Model string `json:"model"`           // model 节点 id
    Kind  string `json:"kind"`            // "creator" / "writer" 二选一
    Field string `json:"field,omitempty"` // writer 专用：被写的状态字段名
}
// Graph  增：Lifecycle []LifecycleRef `json:"lifecycle,omitempty"`
// Diff   增：LifecycleAdded / LifecycleDeleted []LifecycleRef `json:"lifecycleAdded/lifecycleDeleted,omitempty"`
```

1. baseline 既有键**零删改**（Web/agentd/前端 domains.ts 零破坏——additive JSON 对旧消费方不可见）。
2. `Validate` 增引用完整性：`Who`/`Model` 必须是在图节点，`Model` 的 `Kind` 必须为 `model`，`Kind` 枚举外即 issue。
3. `Merge`/`Absorb` 增 lifecycle 合并：加 added、剔 deleted、剔 dead 端点、去重——**逐字照 `absorb.go#mergeProjections` 模式**。
4. 产出者 = 扫描配方（handoff `docs/codegraph-scan-recipe.md` 新增 lifecycle 产出规则；配方纪律沿用 B173 边解析纪律：creator 必须是「返回该 model 类型」的真构造点、writer 必须是对状态类字段的真写入，禁裸名撞库）。`CheckEdges` 不管 lifecycle（非调用边），引用完整性归 Validate。
5. 存量回填 = 一次定向补扫（只扫 model 类节点），产出走视图 diff（lifecycleAdded）→ absorb 常规回灌。

## §3 领域声明文件（刀 2 声明层）

新文件族 `codegraph/domains/<领域id>.json`，人写、程序只读（与 target 同边界）：

```go
// DomainDecl 一个领域的人工声明。文件名（去 .json）必须等于 Domain 字段。
type DomainDecl struct {
    Domain         string       `json:"domain"`                 // baseline 领域 id
    Responsibility string       `json:"responsibility"`         // 职责一句话，必填
    Invariants     []Invariant  `json:"invariants,omitempty"`
    Lifecycle      *DeclAnchor  `json:"lifecycle,omitempty"`    // 创建→终结
    StateMachine   []Transition `json:"stateMachine,omitempty"` // 合法迁移表
}
type Invariant struct {
    Text    string `json:"text"`
    TestRef string `json:"testRef,omitempty"` // 守护测试函数名（Test 前缀）
}
type DeclAnchor struct {
    From string `json:"from"` // file#Symbol 锚
    To   string `json:"to"`
}
type Transition struct {
    From   string `json:"from"`             // 状态值
    To     string `json:"to"`
    Anchor string `json:"anchor,omitempty"` // file#Symbol：执行该迁移的代码位
}
```

1. `LoadDomainDecls(repoRoot string) (map[string]DomainDecl, error)`：读 `codegraph/domains/*.json`；目录缺失返回空 map 非错误（声明是渐进铺的）；文件名≠Domain 字段、JSON 非法、Responsibility 为空均为错误。
2. `ValidateDecls(v *View, repoRoot string, decls map[string]DomainDecl) []string`：①Domain id 必须在图 domains 段存在；②所有锚（DeclAnchor.From/To、Transition.Anchor）逐条过 `resolve.go#ResolveAnchor`，坏锚即 issue；③`TestRef` 非空时，仓内 `*_test.go` 必须存在同名测试函数（go/parser 核验，非 grep——注释里的同名串不算），缺失即 issue。执法档位=spec 裁决 3：锚保鲜必做、testRef 填了就验、不强制每条必挂。
3. `validate` 命令纳入：decls 问题计入 issues（前缀 `[decl <领域id>] `），输出增 `"domainDecls": <int>`（加载数）。

## §4 CLI 契约增量（v0.3.0）

1. **`migrate`** 新子命令：`codegraph migrate [--repo .]`——v1 target.json 机械改写（§1 三处键名 + 版号），**幂等**（v2 输入零改动、exit 0）；输出 JSON `{"migrated": bool, "from": 1, "to": 2}`（v2 输入 `migrated:false` 省略 from/to）；写盘保持 2 空格缩进 + 尾 newline（与 B173 清洗脚本同字节纪律）。无 target.json 时报错（migrate 无的放矢）。子命令总数 13→**14**。
2. **`entity`** 输出增段（`entity.go#EntityResult` 增字段，omitempty）：`creators`/`writers`（来自 lifecycle 段，按 node 带 file:line 展示）、`domainDecl`（该 model 所属领域的声明摘要：职责/不变式数/状态机行数，无声明省略）。
3. **`domains`** 输出增段（`domains.go#DomainStat` 增字段）：`subsystems []string`——派生映射（领域成员节点文件 × `SubsystemOf` 去重，**零手抄**）；`crossSubsystem bool`（len>1 时 true，警示）。target.json 缺失或 v1 时省略这两个字段（domains 对 target 是软依赖，不因此报错——版本门只在显式 LoadTarget 的命令生效）。
4. 别名等价条款照旧（同构造同版本等价）；cobra `Deprecated` 字段禁令照旧。

## §5 不变式（v0.2.1 五条全继承 + 增两条）

1~5 照刀 0 契约 §5（stdlib-only、仅 cobra v1.10.2、零 CGO 六平台、不发网络、baseline 既有键 schema 零改动——lifecycle 为 additive 新键不违此条）。
6. **target v1 拒读反静默**：任何走 LoadTarget 的命令对 v1 必须显式报错指路 migrate，不许静默当 v2 读或当无基准跳过。
7. **声明与派生分界**：领域↔子系统归属只许派生（§4-3），任何 schema 不得新增手抄归属字段。

## §6 冻结清单（原子条目，下游逐条打勾）

1. target.json v2 三处键名如 §1-1，`meta.version` = 2；
2. `LoadTarget` 对 version≠2 报错且文案含 `codegraph migrate`；
3. `TargetSubsystem`/`Target.Subsystems`/`Assignment.Subsystem`/`SubsystemOf` 改名落地，`TargetDomain`/`DomainOf` 不复存在；
4. `Report.Fails[].Kind` 枚举不变（new-direction/over-budget）；
5. `LifecycleRef` 四字段及 json 键如 §2 代码块，`Kind` 只认 creator/writer；
6. `Graph.Lifecycle`/`Diff.LifecycleAdded`/`Diff.LifecycleDeleted` 键名如 §2，均 omitempty；
7. baseline 既有键零删改（对 v0.2.1 的 Graph json 键集合做 additive-only diff 可验）；
8. `Validate` 覆盖 lifecycle 引用完整性（Who/Model 在图、Model 是 model、Kind 枚举）；
9. `Absorb`/`Merge` 处理 lifecycle 增删与 dead 剔除；
10. `DomainDecl` 族类型及 json 键如 §3 代码块；文件名 = Domain 字段强校验；
11. `ValidateDecls` 三查（域存在、锚保鲜、testRef 存在性）且经 `validate` 命令执法（issues + domainDecls 字段）；
12. `migrate` 幂等、输出 JSON 键如 §4-1、字节纪律（2 空格 + 尾 newline）；子命令总数 14；
13. `entity` 增 creators/writers/domainDecl 三键（omitempty）；
14. `domains` 增 subsystems/crossSubsystem 两键，target 缺失/v1 时省略且不报错；
15. handoff 侧：go.mod 升 v0.3.0 与 `codegraph migrate` 改写 target.json 同一提交，migrate 前后 check fails/warns 集合逐条一致（0=0）+ 全量测试绿；
16. 样板声明 1~2 份落 handoff `codegraph/domains/`，validate 绿且坏锚变异可红。

## §7 拍板记录（三重闸门筛选）

- **「baseline 不动、两套分区并存」**：target 的 10 子系统与 baseline 的 9 顶层域只有 3 个 id 重合，是两套各司其职的合法分区（执法分区 vs 语义分区）。被否方案：强制对齐重切（会扭曲其一——跨子系统领域真实存在，如 web 前后端配对）。后人看到两套 id 想「统一一下」时：先读本条，映射由 `domains` 命令派生展示，对齐与否是各仓自己的演进决策，不是 schema 债。
- **「lifecycle 独立段而非扩 Edge」**：Edge 是无类型二元组、全图消费方按调用边语义消费（who-calls/check/edgegate），塞 lifecycle 进去会污染全部下游；与 `Implements` 分列是同一个 wire 决策的延续（`types.go#Graph` 注释）。反向改写不会立刻红測试的部分由冻结清单 6/7 锁住。
- **「机械层入库（AI 配方产出）而非查询时现算」**：用户拍板（spec 裁决 4）。被否方案：go/parser 查询时现算（零保鲜债但只覆盖 Go、只服务 entity 单出口）。选入库换跨语言覆盖与全图消费方可见，保鲜债由「扫描配方 + 视图 diff + absorb」既有体系承接。
- **「migrate 强制一次性、无兼容窗口」**：全网 v1 消费者仅 handoff 一家，双读代码是为不存在的生态背债；旧版本隔离靠 go.mod 钉版。被否方案：v1 兼容读 + 告警观察期。

## Ticket 0 骨架

additive 部分落码（`graph/codegraph/decl.go`：LifecycleRef/DomainDecl/Invariant/DeclAnchor/Transition 类型 + Graph.Lifecycle + Diff.Lifecycle{Added,Deleted} 字段），本轮编译与全量测试须绿。**target 改名不进骨架**——它与 migrate、夹具改写是同一原子变更（分开会让主线出现红测试窗口），归 implement 首个 task。

## 交棒欠账

无——骨架纯 additive 空壳，无「已实现零测试」项。
