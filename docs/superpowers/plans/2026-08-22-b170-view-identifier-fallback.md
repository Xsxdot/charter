# B170 实现计划：视图标识的两个形态要能互认，找不到时要指路

> 2026-08-22。协调者写。原卡 B170（project=handoff）；**代码已随 codegraph
> 搬迁到 charter 仓**，故在 charter 项目下另开卡执行，原卡留痕指向本卡。

## 事实基线（协调者在 charter@1dfb0f68 上查证）

`graph/codegraph/load.go:32`：

```go
func LoadDiff(repoRoot, view string) (*Diff, error) {
	p := filepath.Join(repoRoot, "codegraph", "diffs", view+".json")
	raw, err := os.ReadFile(p)
	if err != nil {
		return nil, fmt.Errorf("读取视图 %s: %w", p, err)
	}
```

`--view` 取的是 `codegraph/diffs/` 下的**文件名**（`branch-dead-assembly`），
而扫描配方规定 diff 内的 `view` 字段形如 `branch:x`（`branch:dead-assembly`）——
两者只差一个分隔符，肉眼极易混。实测（08-21，pilot 分支）：
`--view branch:dead-assembly` → `Error: 读取视图 codegraph/diffs/branch:dead-assembly.json:
no such file or directory`，退出 1；换成 `branch-dead-assembly` 立即退出 0。

**报错也不指路**：只说文件不存在，不列可用视图，而 `ListViews`
（`load.go:47`）就在同一个包里、能力现成，`graph views` 子命令就是它。

`LoadDiff` 是**唯一**的视图读取入口（`graphLoadView` 与 absorb 都经它），
所以修在这里就同时覆盖 check / absorb / 其余带 `--view` 的子命令——
卡上点名「别只修 check 一处」，这个落点天然满足。

## 设计决定

1. **文件名优先，回退按 `view` 字段匹配**：先按现有路径读；文件不存在时，
   遍历 `ListViews` 逐个读出来比 `d.View` 字段，命中即用。顺序不能反——
   文件名是既有契约，回退只是补一条人性化的路。
2. **回退命中要留痕**：命中时往 stderr 打一行「视图 %s 按 view 字段匹配到文件
   %s」，否则用户永远不知道自己写的是另一个形态，下次还错。
3. **歧义要报错不要猜**：两个 diff 的 `view` 字段相同时，列出候选文件名并报错。
4. **找不到时报可用清单**：错误里带 `ListViews` 的结果（超过 20 条时截断并注明
   总数），这是本卡「报错不指路」那一半的正解。
5. **不改扫描配方、不改 `view` 字段的形态**：两个形态各有出处（文件名要能当
   文件名，`branch:x` 是视图的语义标识），本卡只让它们互认。

## Task 1：LoadDiff 加回退与指路

`graph/codegraph/load.go`：`LoadDiff` 改为——

- 原路径读取成功 → 原样返回（**零行为变化**）。
- `os.IsNotExist` → 调 `ListViews`，逐个 `os.ReadFile` + `json.Unmarshal` 取
  `View` 字段，收集匹配项：
  - 恰好一个：stderr 留痕后返回它
  - 多个：返回歧义错误，列出候选文件名
  - 零个：返回「视图 %s 不存在；可用视图：%v」
- 其他读取错误（权限等）**原样返回**，不要吞进「不存在」那条路。

留痕用包内既有的输出方式（先 `grep -rn "os.Stderr\|log\." graph/codegraph/*.go`
看这个包现在怎么打日志；**没有**日志设施就别引入依赖，改为把这条信息附在
成功路径的返回值上由 CLI 打——`LoadDiff` 是库函数，不该自己抢 stderr）。

## 测试映射

`graph/codegraph/load_test.go`（复用既有夹具，先看它怎么造 `codegraph/diffs/`）：

1. `TestLoadDiffByFileName`（回归网）：文件名照旧可读。
2. `TestLoadDiffFallsBackToViewField`：文件名 `branch-x.json`、内容 `view: "branch:x"`，
   用 `branch:x` 能读到，且返回的是同一份 diff。**这是本卡判据，修前必红。**
3. `TestLoadDiffAmbiguousViewField`：两个文件同 `view` 字段 → 报错且报文含两个文件名。
4. `TestLoadDiffUnknownListsAvailable`：都不匹配 → 报文含「可用视图」与实际存在的视图名。
5. `TestLoadDiffPropagatesNonNotExistError`：造一个不可读的文件（如把 diffs 下的
   目标做成目录）→ 错误不得被回退路径吞掉。

CLI 层再加一条端到端：`graph check --view branch:<x>` 与 `--view branch-<x>`
两种写法结果一致（用既有的 cli 测试夹具）。

## 测试范围

- `cd graph && go test ./...`
- `go build ./...`、`go vet ./...`、`gofmt -l .` 无输出
- **不要动 handoff 仓**：handoff 侧的 `handoff graph` 只是委托别名，本次零改动。

## 不属于本次

- 不改 `absorb` 的语义（它经 LoadDiff，自动受益）。
- 不改扫描配方文档里 `view` 字段的形态规定。
- 不发新版本 tag（发版与 handoff 侧升级由协调者定）。
