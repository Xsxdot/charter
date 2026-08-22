# Breakdown：codegraph 搬迁（刀 0）

> 日期：2026-08-22 | 状态：**已拍板**（七岔口全裁，见下表；出稿 subagent、协调者拍板，P 归用户）
> 上游状态位（出稿时核对）：spec「已批准」✓；契约「已冻结」@ 94604dc ✓（修订 R1~R5 随本拍板一并回写契约文档）。
> 现状读数出自 handoff 仓 @ 5731493 与 charter worktree 当前树的直接复核。

## 拍板结果

| # | 岔口 | 裁决 |
|---|---|---|
| P | charter 私仓 × handoff 公仓依赖矛盾 | **charter 转公开**（用户拍板）。时点：T1 合并、打 `graph/v0.1.0` **之前**，归用户/协调者执行（真机清单 0）。裸 curl 安装通道成立，无需 vendor |
| F1 | 别名如何委托同一 module | **`graph/cli` 可导入 CLI 包**（导出面仅命令构造函数），cmd 壳与 handoff 别名同挂——「行为一致」由构造保证（契约 R2） |
| D | handoff 依赖顺序 | **串行等 tag**：T1 → 合并主线 → 打 `graph/v0.1.0` → T4 钉 tag。replace 仅限执行者本地调试，**提交内零 replace**（T4 验收断言） |
| F2 | version 子命令 | **加为第 13 个子命令**（契约 R4）；`go install` 构建走 `runtime/debug.ReadBuildInfo`，release 以 ldflags 覆盖 |
| F3 | summary 内嵌命令文案 | **改 canonical**（`codegraph sym …`）；「别名行为一致」= 同版本等价，非搬迁前逐字节冻结（契约 R4）；`cmd/graph_test.go:317` 的弱断言随迁收紧 |
| F4 | release 通道成卡与否 | **单独成卡 T2**（边界型，验收主体在真机，文件集与 T1 不相交） |
| F5 | charter skills 文案算不算第三子系统 | **不是**——派卡资格第 2、4 条不过（散文引用无自有契约面、无测试闭环），按架构法「按文件改」归 S1 子卡 T3；`~/.claude/CLAUDE.md` 两处仓外残余走真机清单 |
| 附 | §5-1/3 不变式的承重锁 | **T1 加一支依赖集合断言测试**（断言 module 第三方依赖集恰为 cobra 及其传递依赖），防「顺手加依赖」无声失守 |

## 一、触及子系统清单

- **S1 = charter/graph**（新 module，绿地）：**逻辑型**（接缝对面是自有代码 handoff，1244 行随迁测试 + CLI 壳测试闭环）；其中 release 通道切面（T2）为**边界型**（对面是 GitHub Actions 与无 Go 目标机，机内验形状、行为进真机清单）。派卡资格四条：有界文件集 `charter/graph/**`（T2 加 `.github/workflows/`、`install.sh`）✓；契约面可枚举（§2 51 符号 + §4 13 子命令）✓；对 S2 零依赖 ✓；类型已标 ✓。
- **S2 = handoff**（消费侧改造）：**逻辑型**（全量编译 + 全量测试含 `TestRepoContractGate` 闭环；别名等价性一条按冻结项 14 归真机）。四条核对 ✓（文件集见 T4）。

## 二、契约增量核对

**结论：拆解未越界，无新接缝，不退回 contract。**5 处边界澄清/勘误已回写契约修订记录 R1~R5。两条红线（导出面零增删、JSON schema 零改动）全部子卡遵守；T4 对 handoff 自身 `target.json` 删一行路径 + 产出分支视图 diff 属**图数据实例维护**（代码删除的落账义务），非 schema 变更，不越红线。§6 冻结清单分配：1~9 → T1；10~13 → T4；14~15 → 真机清单。

## 三、子卡清单 + 依赖 DAG

### T1【S1·逻辑型】module 整体搬迁 + CLI 落新家

- **契约引用**：§1、§2（51 符号逐符号）、§4（13 子命令）、§5-1/2/3/4、§6-1~9；F1/F2/F3 裁决。
- **意图**：`internal/codegraph`（14+14 文件含 testdata）与 CLI 壳（`cmd/graph.go` 498 行 + `cmd/graph_test.go` 349 行）原样迁入 `charter/graph/`，只改 module/包路径与测试 harness 前缀（新家无 `graph` 父命令，13 子命令直挂 root）；cobra 命令树落 `graph/cli` 导出构造，`graph/cmd/codegraph` 为 main 薄壳。
- **行为化验收**（机内）：①`cd graph && go build ./... && go vet ./... && go test ./... -count=1` 全绿，测试函数清单迁移前后 diff 为空（仅 harness 适配）；②`go doc ./codegraph` 与 §2 51 符号逐一相符零增删；③codegraph 包 import 仅标准库、module 第三方依赖仅 cobra v1.10.2；④`CGO_ENABLED=0` linux/amd64、darwin/arm64、windows/amd64 三平台 build 通过；⑤`go run ./cmd/codegraph --help` 列出 13 子命令，`codegraph version` 输出非空；⑥「不发网络、不依赖 agentd」边界注释保留；⑦依赖集合断言测试存在且能变红。
- **入口指针**：源 `handoff/internal/codegraph/**`、`cmd/graph.go#graphCmd`、`cmd/graph_test.go#runGraph`（SetArgs 前缀 "graph" 需去除）；目标（有界）`graph/go.mod`、`graph/codegraph/**`、`graph/cli/**`、`graph/cmd/codegraph/**`。

### T2【S1·边界型】release 通道：workflow + install 脚本

- **契约引用**：§5-3、§6-7；spec 用户故事 3；P 裁决（公开仓，裸 curl）。
- **意图**：charter 仓新增 release workflow（`graph/v*` tag 触发，六平台 `CGO_ENABLED=0`，产物命名 + checksums，permissions 仅 `contents: write`）与 `install.sh`（照抄 handoff 探测/校验/die-with-context 骨架的简化版；darwin 首版不签名，记 xattr 绕行说明）。
- **行为化验收**：机内验形状（YAML 可解析、`bash -n` 通过、不 sudo 不改 rc 的边界注释存在）；行为全真机（清单 3、4、5）。
- **入口指针**：模板 `handoff/.github/workflows/release.yml`、`handoff/install.sh`；目标（有界）`charter/.github/workflows/release.yml`、`charter/install.sh`。

### T3【S1】charter skills 文案 canonical 改名

- **契约引用**：§4 canonical 入口；spec 用户故事 5；F5 裁定。
- **意图**：skills 内写死的 `handoff graph ...` 改 `codegraph ...`，共 5 处 4 文件（grep 实测）：`skills/spec/SKILL.md:15,16`、`skills/contract/SKILL.md:57`、`skills/breakdown/SKILL.md:49`、`skills/plan/SKILL.md:20`。**不改**：docs/ 历史文档（记录当时事实）；`architecture-law` 的 `codegraph/target.json`、`graph check` 字样（数据路径与泛称）；handoff 仓内 hook/配方（OOS，别名长期可用）。
- **行为化验收**：`grep -rn "handoff graph" skills/` 零命中；diff 逐行确认仅命令串替换、零纪律语义变化；真机清单 6、7。
- **入口指针**：上列 4 个 SKILL.md（有界）。

### T4【S2·逻辑型】handoff 消费侧改造 + 自身图落账

- **契约引用**：§3（含 R3 第 4 入口）、§4 别名契约（R4 禁则）、§6-10~13；D/P/F1/F3 裁决。
- **意图**：go.mod 钉 `charter/graph v0.1.0`；删 `internal/codegraph/` 与 `cmd/graph_test.go`（随 T1 迁走）；`cmd/graph.go` 重写为薄别名（挂 `graph/cli` 构造，Use 仍 `graph`，帮助文本标 deprecated，**禁用 cobra Deprecated 字段**）；三个消费入口改 import；agentd 测试夹具复制入 `internal/agentd/testdata/`；落账：`codegraph/target.json` 的 `d_contract.paths` 删 `internal/codegraph/**`，产出分支视图 diff（absorb 归 finish，先合并后回灌）。
- **行为化验收**（机内）：①handoff 根 `go build ./... && go vet ./... && go test ./... -count=1` 全绿（含 TestRepoContractGate）；②`test ! -d internal/codegraph` 且 `grep -rn "Xsxdot/handoff/internal/codegraph" --include='*.go' .` 零命中；③go.mod 含 `charter/graph v0.1.0` 且 `grep -c '^replace' go.mod` = 0；④`handoff graph --help` 含 deprecated 字样，且 `handoff graph sym <符号> | python3 -m json.tool` 解析通过（运行时零 deprecation 污染）；⑤agentd codegraph 测试函数清单迁移前后一致（不许删测试收场）；⑥`handoff graph check` 与 `validate --view <本分支视图>` 通过，target.json 不再含 `internal/codegraph/**`。
- **入口指针**（有界）：`go.mod`/`go.sum`、`cmd/graph.go`、`cmd/graph_test.go`（删）、`cmd/graph_gate_test.go`、`internal/agentd/codegraph.go`、`internal/agentd/codegraph_test.go`（锚 `#codegraphFixtureRepo`）、`internal/agentd/testdata/**`（新）、`internal/codegraph/**`（删）、`codegraph/target.json`、`codegraph/diffs/<分支>.json`（新）。

### 依赖 DAG（轻档单执行者，建议顺序 T1 → T4 → T2 → T3）

```
[用户/协调者：charter 转公开] ──┐
T1 ──→ [协调者：合并主线 → tag graph/v0.1.0] ──→ T4 ──→ [finish：absorb 视图]
 ├──→ T2（文件可先行，真机验收必在 tag 后）
 └──→ T3（合并即生效；生效前协调者先在本机装 codegraph）
```

## 四、缺陷族对抗审查（结论已进各卡验收栏）

| 族 | 回答 |
|---|---|
| 生命周期/状态机中断 | 无新增风险，因为：纯静态搬迁、零运行时行为变更；唯一中断敏感序列「删包+改 import」半途状态编译不过，编译失败即护栏（T4 验收①） |
| 静默失败/误导报错 | 三点全有锁：cobra Deprecated 运行时告警污染 JSON 管道→T4 验收④正面断言；module 拉取失败是编译期硬失败（P=公开后无凭据路径）；install 失败路径继承 die-with-context（T2 验收） |
| 跨平台假设 | 零 CGO 六平台已是冻结项（T1 抽查三平台 + T2 真机全量）；graph 平台逻辑仅 3 行已查证；install 脚本继承「不装 Windows」边界 |
| 假红/假绿测试 | 「随迁测试全绿」可能连错一起搬→两把外部尺：§2 符号表对账（T1②）+ 新旧二进制输出比对（真机 1）；夹具搬迁不许删测试收场（T4⑤）；删包后 TestRepoContractGate 照旧绿是因基线未 absorb→视图落账 + finish absorb（T4⑥） |
| 门禁绕过 | 无新增权限面，因为：agentd 两条 API 只读、路径逃逸校验零触碰；T2 workflow 限 `contents: write`；install 不 sudo 不改 rc |
| 序列化边界 | 无，因为：零新增字段、零新增投影，红线二即本族答案；两处人读文本（summary 文案、deprecated 帮助）有正面断言 |
| 枚举新值过白名单 | 唯一新值 `version` 子命令已随 R4 入冻结清单；机内无 switch 消费子命令名 |
| 承重安全属性 | 无 token/隔离类属性；§5-1/3 纯标准库+零 CGO 是承重不变式，原本只有包注释无锁→T1⑦依赖集合断言测试补锁 |

## 五、真机清单（归协调者/用户）

0. **charter 仓转公开**（用户已拍板；`gh repo edit Xsxdot/charter --visibility public`，T1 合并打 tag 前执行，归用户/协调者）；
1. 冻结项 14：同一仓库 `handoff graph sym/check/entity` 与 `codegraph sym/check/entity` 输出逐一 diff 一致；
2. 冻结项 15：tag 推后 handoff `go mod download` 可解析；
3. 推 `graph/v0.1.0` 观察 workflow 六平台绿、六资产 + checksums 齐；
4. 一台无 Go 无 handoff 设备跑 install 脚本，`codegraph --help` 退出 0；
5. 开发机 `go install .../graph/cmd/codegraph@v0.1.0` 后 `codegraph sym` 在有图仓库可用；
6. `~/.claude/CLAUDE.md:81,85` 两处 `handoff graph` 改 `codegraph`（协调者本机手工，与 T3 合并同时段）;
7. 执行机 handoff 升级后 SessionStart hook `handoff graph summary` 照常注入；
8. handoff Web 控制台 codegraph 页三段照常渲染（前端零改动仍须确认）。

## 六、图覆盖债

charter 仓无图，无债。handoff 侧 `LoadGraph` 经 `handoff graph sym` 验证命中（域 d_coordination_graph），其余引用直接读码带 `file#Symbol` 锚；落盘后可跑 `handoff graph resolve --doc <本文档> --repo ~/workspace/handoff` 复核。
