# Charter 故事批次试点（2026-09-27）

本试点是**新流 `charter-story`**，不是把旧 `charter` 升版。旧流定义、旧 `charter-*` 纪律块与旧卡钉住的工作流版本不改；新流使用 `charter-story-default` 模板和 `charter-story-*` 纪律块。仓内源是 `flows/charter-story.workflow.json` 与 `skills/`。`scripts/regen_discipline.py` 默认生成新前缀；生成文件不是安装，`scripts/charter_provision.py` 的 install/check 才对账本读写新名字。试跑时用 `python3 scripts/charter_provision.py install --config <隔离配置>`，再以同一配置跑 `check`；省略 `--config` 会指向当前 handoff 配置，推广前不要在共享账本执行。

## 驾驶规则

- 建试点卡必须显式指定 `--workflow charter-story`；旧卡仍显式 `--workflow charter`。同一账本存在两条流后，省略工作流的建卡命令会变成歧义，不能把旧驾驶手册的“默认唯一流”继续当真。不要把旧卡批量 migrate 到试点。
- `spec` 定级与选档；L3 重档在父卡 Wave 0（`plan→implement→review→阶段验收`）后，必要时进 `contract`，再进 `breakdown`。轻档按同一冻结判据命中/跳过 `contract`。`breakdown` 只要求 spec 附件；跳过 contract 时不得造空附件。Wave 0 前确需冻结外部承诺时先走 contract。每次人工跳列记明阶段、理由与所依据的 spec/计划版本。
- breakdown 一次覆盖全部故事、责任和硬依赖；重档父卡在 breakdown 通过后人工移到「待批次」停靠（轻档则进 plan），仅为**当前可演示故事批次**细化子卡 plan。`card split` 不继承附件，协调者须给每张工程子卡挂父卡 breakdown 或适用 spec，不能以空附件绕 plan 门。先做本批跨卡审计，再派本批，不等未来全部 plan。每批子卡 `plan→implement→review→阶段验收`，阶段验收只证明工程结果及真实消费者接入条件，不替父卡完成故事。
- 父卡在「待批次」期间由协调者逐批组织真实合分支、演示和已有故事回归，逐批在 ledger 留提交、环境、结果、下一批基线及未核销承诺；子卡技术验收**不能代替**这项批次合流。全部子卡阶段完成且全部批次证据就绪后，父卡才进入并**仅派发一次** `integrate` 终局集成。这样避免 handoff 无条件 `integrate→最终验收` 在第一批就误触发，也避免同一卡同一节点累计三轮后第四批转等人。终局集成报告明确故事全集和真机清单后，进入 `最终验收→图对账（适用时）→finish`。L2、L3 轻档和 bug 流可从 review 直接进入最终验收，无须伪造 integrate。
- 指定浏览器、机器、账号、数据集、隐私状态的证据必须按原判据取得；替代环境须用户批准。原承诺欠交和脱敏/隐私/安全红线不能只转 roadmap 或另开修复卡就判最终通过。

## 机器能力边界与推广闸

现有 handoff `MoveCard` 只核目标列是否存在、CAS 和 gate，不限制跳列；`card dispatch --step` 也不核卡当前列，能越过列入口 gate 直接点火。gate 只看附件 kind 是否存在、验收判据非空、直接子卡是否完结，**不验证某份验收证据是在最后一批集成之后生成**。因此仓内新流程能把阶段与最终验收分成不同列，也能使正常成功边成为 `integrate→最终验收→图对账→finish`，但**不能机器禁止人工 move 或 dispatch 跳过关口**。本试点的 acceptance/finish 纪律是人工关口，不能宣称已经满足不可跳过的机械保证。若要机器保证，需要 handoff 增加节点入场、带阶段/集成版本的验收证据门和跳列限制，另行实现与验证；不能靠一份旧 `doc` 附件冒充新鲜最终验收。

新流也不能直接装入 mac-02 与本机共用的生产账本而不处理默认建卡：第二条流会使省略 `--workflow` 的建卡命令在**两台机器**都变成歧义。安装脚本目前拒绝无 `--config` 的 install；传隔离配置时仍须人工核其 data dir/DSN 不指向生产账本。本机现役 `product-backlog` 驾驶 skill 仍是旧单流路由，仓内 pilot 文档不会自动覆盖它；在单独更新本机 opt-in 驾驶规则并测试前，**不能宣称新试点已可用于真卡**。推广前须在隔离账本跑正反向路由、失败重试、重复 contract/阶段验收/最终验收、附件版本和恢复测试，更新两机驾驶手册或给出明确的默认流迁移方案，再决定是否向共享账本安装。mac-02 仍继续旧流，勿在其环境更新 `using-charter` 与 `product-backlog`。
