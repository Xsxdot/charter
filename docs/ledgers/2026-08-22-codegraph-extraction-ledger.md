# 实现账本：codegraph 搬迁（刀 0）

> 流程游标：**T1~T4 全部完成，真机清单 8 条中 6 条已执行**（余：4 无 Go 设备脚本装、7 执行机 hook、8 Web 控制台渲染——见文末）→ 下一步：**review 节点（diff 审查）→ acceptance → finish**（handoff 分支 `feat/codegraph-extraction` 合并归用户；charter 侧本分支随每 task 已滚动合并主线）
> 顺序说明：与 breakdown 建议的 T1→T4→T2→T3 有一处偏差——T4 依赖合并后的 tag（D 裁决串行、零 replace），把 T2/T3 提前到合并前可让主线只合一次；已按此执行，非漂移。

## T1：module 整体搬迁 + CLI 落新家（2026-08-22）

范围：`graph/codegraph/**`（14 源 + 14 测试 + testdata，自 handoff internal/codegraph 原样迁入，零 import 修改）；`graph/cli/`（cli.go 自 cmd/graph.go 迁移改造：New 构造函数、13 子命令直挂、summary 文案 canonical 化、新增 version；cli_test.go 自 cmd/graph_test.go 迁移，harness 去 "graph" 前缀；deps_test.go 新增依赖白名单锁）；`graph/cmd/codegraph/main.go`（薄壳）；go.mod 钉 cobra v1.10.2。

验证（全部本轮跑出）：
- `go test ./... -count=1`：cli ok 0.685s、codegraph ok 0.897s；`go vet ./...` 零输出
- TDD 红灯：cli_test.go 先落盘，`undefined: New` 编译红（功能缺失）后落实现转绿
- 契约对账：51 导出符号（22 func + 29 type）与 §2 逐一相符；13 子命令 = absorb chain check contract domains entity resolve summary sym validate version views who-calls；`version` 输出 `devel` 非空
- `CGO_ENABLED=0` linux/amd64、darwin/arm64、windows/amd64 三平台 build OK
- 依赖锁变异复验：go.mod 加伪依赖 → TestModuleDependencyAllowlist FAIL；还原 → ok
- 测试清单对齐：包测试与原版 diff 为空；CLI 测试 = 原 18 支 + TestGraphVersion（新行为新测试），零删减

## T2：release 通道（2026-08-22，机内部分完成）

范围：`.github/workflows/release.yml`（graph/v* tag 触发、六平台 CGO=0、产物命名断言、checksums、softprops gh-release，permissions 仅 contents:write）；`install.sh`（Darwin/Linux×amd64/arm64 探测、graph/v* 最新版决议、sha256 校验、装 ~/.local/bin、不 sudo 不改 rc、darwin xattr 提示）。
验证（本轮）：YAML 解析通过（YAML_OK）；`bash -n install.sh` 通过。**行为验收全部真机**（清单 3/4/5），未执行。

## T3：skills 文案 canonical 改名（2026-08-22 完成）

范围：`skills/{spec,contract,breakdown,plan}/SKILL.md` 共 5 处 `handoff graph` → `codegraph`。
验证（本轮）：`grep -rn "handoff graph" skills/` 零命中；diff 逐行核对仅命令串替换。生效前置（真机 5/6）未执行。

## T4：handoff 消费侧改造（2026-08-22 完成，分支 feat/codegraph-extraction @ a566ee86c，合并归用户）

范围：删 `internal/codegraph`（-3943 行）与 `cmd/graph_test.go`；`cmd/graph.go` 改委托别名（Short 标 deprecated，禁用 cobra Deprecated 字段）；agentd 两 API + 契约闸测试改 import；agentd 夹具迁 `internal/agentd/testdata/codegraph-repo`；go.mod 钉 `charter/graph v0.1.0` 零 replace；target.json d_contract 删路径；落视图 `codegraph/diffs/codegraph-extraction.json`（100 节点 130 边删除）。
验证（全部本轮）：build/vet OK；根全量测试除既有 B173 门禁红外全绿（**基线先跑证实该红在动手前已存在**）；check fails 集合前后逐条一致（33=33，零新增零消失）；`test ! -d internal/codegraph`、旧 import 零命中、`grep -c '^replace' go.mod`=0；别名 help 含 deprecated、`graph sym` 输出 `python3 -m json.tool` 解析通过。
修正一笔：首次提交误含其他会话两个 untracked 文档，amend 摘出后 force push。

## 真机清单执行状态（2026-08-22）

| # | 条目 | 状态 |
|---|---|---|
| 0 | charter 转公开 | ✅ 用户拍板后执行，`gh repo view` = PUBLIC |
| 1 | 别名 vs canonical 输出比对 | ✅ sym/entity 逐字节一致；check 集合等价（顺序抖动为 check 自身既有非确定性，已落 roadmap 第 2 条） |
| 2 | tag 后 go mod download 可解析 | ✅ `go get charter/graph@v0.1.0` 成功 |
| 3 | release workflow 六平台 + 资产 | ✅ run 32566617996 success（1m6s），六资产 + checksums.txt 齐、命名与契约逐字一致 |
| 4 | 无 Go 无 handoff 设备 install 脚本 | ⬜ 未执行（需另一台设备） |
| 5 | go install 通道 | ✅ `go install ...@v0.1.0` 后 `codegraph version` 输出 v0.1.0、sym 查询正常 |
| 6 | ~/.claude/CLAUDE.md 两处改名 | ✅ 已改（canonical + 别名注记） |
| 7 | 执行机 SessionStart hook | ⬜ 未执行（待 handoff 分支合并 + 全网升级后验） |
| 8 | Web 控制台 codegraph 页渲染 | ⬜ 未执行（待 handoff 分支合并后起 agentd 验） |
