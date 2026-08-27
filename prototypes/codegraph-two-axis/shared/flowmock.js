// flowmock.js —— 手抽的「真流程」样板。
//
// 为什么要手抽：今天 baseline 里没有控制流（既没有步骤次序，也没有 if/switch 分支），
// CG.flows 那四条是按调用边逐跳展开的**机械可达序列**，不是执行顺序。原型要回答的问题
// 是「流程图该长什么样」，用降级数据回答不了。所以这一条按 SSA CFG 将来会产出的形状
// 手抽自真实源码（handoff cmd/card_dispatch.go:234 RunE），字段与 schema 草案 §2 的
// baseline.flows 一致：steps[].{id,order,kind,line,...}，kind ∈ call|branch|return。
//
// 手抽 = 可核对：每一步都带 line，对着源码逐行能核。
window.CGFLOW = {
  e_cli_card_dispatch: {
    entry: 'handoff card dispatch <id>',
    file: 'cmd/card_dispatch.go', line: 234,
    domain: 'd_ledger', domainLabel: '卡片账本',
    authored: true,
    steps: [
      { kind: 'branch', line: 236, cond: '给了 --step（走工作流节点）',
        body: [
          { kind: 'call', line: 237, label: 'runStepDispatch', to: 'cmd/card_node.go:22',
            entry: true, entryOf: 'e_http_post_api_tasks', domain: 'd_protocol', domainLabel: '协议契约',
            note: '本地 CLI → 本机 agentd 的 HTTP 入口。换了通道，落点仍是 ViaTemplate，最终落到 Manager.Dispatch。' }
        ], bodyEnds: '返回（本命令到此结束）' },
      { kind: 'call', line: 239, label: 'openLedger', to: 'cmd/ledger.go', domain: 'd_ledger', domainLabel: '卡片账本' },
      { kind: 'branch', line: 240, cond: 'err != nil', exit: '返回 err' },
      { kind: 'call', line: 244, label: 'resolveCardDispatchTemplate', to: 'cmd/card_dispatch.go', domain: 'd_ledger', domainLabel: '卡片账本' },
      { kind: 'branch', line: 245, cond: 'err != nil', exit: '返回 err' },
      { kind: 'call', line: 248, label: 'ledgerActor', to: 'cmd/ledger.go', domain: 'd_ledger', domainLabel: '卡片账本' },
      { kind: 'call', line: 249, label: 'Store.GetCard', to: 'internal/ledger', domain: 'd_ledger', domainLabel: '卡片账本' },
      { kind: 'branch', line: 250, cond: 'err != nil', exit: '返回 err' },
      { kind: 'branch', line: 253, cond: '卡已被别人认领', exit: '返回 ErrCASConflict' },
      { kind: 'branch', line: 256, cond: 'ctx == nil', bodyInline: 'ctx = context.Background()' },
      { kind: 'call', line: 263, label: 'ledgerstep.PreflightDiscipline', to: 'internal/ledgerstep/dispatch.go:351',
        entry: true, entryOf: null, domain: 'd_ledger', domainLabel: '卡片账本', reuse: 3,
        note: 'B229 缝 1：拒发闸必须跑在认领之前——零半状态靠的就是这个次序。次序是流程图才能表达的事实，调用边表达不了。' },
      { kind: 'branch', line: 264, cond: 'err != nil', exit: '返回 err' },
      { kind: 'branch', line: 267, cond: 'discTarget != ""',
        body: [
          { kind: 'call', line: 268, label: 'resolveCardDispatchDiscipline', to: 'cmd/card_dispatch.go',
            entry: true, entryOf: null, domain: 'd_policy', domainLabel: '运行策略与配置' },
          { kind: 'branch', line: 270, cond: 'err != nil', exit: '记 slog.Warn 后返回（拒发）' }
        ] },
      { kind: 'call', line: 279, label: 'Store.ClaimCard', to: 'internal/ledger', domain: 'd_ledger', domainLabel: '卡片账本',
        note: 'B239：认领只写归属、不动状态列。' },
      { kind: 'branch', line: 279, cond: 'err != nil', exit: '返回「认领失败」' },
      { kind: 'call', line: 286, label: 'Dispatcher.ViaTemplate', to: 'internal/ledgerstep/dispatch.go:115',
        entry: true, entryOf: 'e_http_post_api_tasks', domain: 'd_ledger', domainLabel: '卡片账本', reuse: 2, heavy: true,
        note: '模板派发的唯一编排入口（B192 契约）。它自己有一整张流程图——这就是递归的那一层。' },
      { kind: 'branch', line: 295, cond: 'err != nil',
        body: [
          { kind: 'call', line: 299, label: 'Store.ReleaseCard', to: 'internal/ledger', domain: 'd_ledger', domainLabel: '卡片账本',
            note: '回滚只退归属；没有状态转移要回退。' },
          { kind: 'branch', line: 300, cond: '（无条件）', exit: '返回 err' }
        ] },
      { kind: 'call', line: 302, label: 'json.Encode(result)', to: 'stdlib', domain: null, domainLabel: '标准库' },
      { kind: 'return', line: 302, label: '返回 nil（成功）' }
    ],
    // 「复用与抽象的债」——这条线是用户提出的洞见：入口 → 流程图 → 节点即下层入口，
    // 递归下去能看出哪些抽象被复用、哪些被绕开。下面每条都对着源码可核。
    debt: [
      { t: 'ok', h: '三个节点本身是下层入口',
        d: 'runStepDispatch / PreflightDiscipline / ViaTemplate 各有自己的流程图。递归深度 ≥ 2 说明这条命令不是平铺的胶水，编排是分层的。' },
      { t: 'ok', h: 'PreflightDiscipline 被 3 处调用',
        d: 'cmd/card_dispatch.go:263 · internal/agentd/cardstep.go:133 · ViaTemplate 内部（disciplineAndTarget）。三条派发通道共用同一个裁决顺序——这是真复用。' },
      { t: 'warn', h: '同一个裁决在一条流程里跑了两遍',
        d: '主干 :263 先跑一次 PreflightDiscipline 拿（角色名，目标机），:286 的 ViaTemplate 内部再跑一次。源码注释自己写了「必须与这里完全同序」——靠注释维持的同序，是抽象债：该抽出一个「已裁决的派发意图」值对象往下传，而不是让两处各算一遍。' },
      { t: 'warn', h: '--step 分支与主干最终落在同一个 ViaTemplate，却走了两条通道',
        d: '主干：本地进程直调 ViaTemplate。--step：CLI → 本机 agentd HTTP → StepRunner → 同一个 ViaTemplate。同一个编排入口有两条抵达路径，其中一条绕了一整圈网络——这条债只有把流程图递归展开才看得见，调用边上看不出来。' }
    ]
  }
,
  // ── 流程二：接口 → 实现 的样板 ──────────────────────────
  // 承重摘要（schema 草案 §7 未决项之一）：Manager.Dispatch 真身 300 余行，
  // 大半是参数装配与日志。这里只留改变控制流的承重步骤，装配段折成一句。
  // 折了什么必须写出来——不写就等于谎称这就是全部。
  e_http_post_api_tasks: {
    entry: 'POST /api/tasks → Manager.Dispatch',
    file: 'internal/agentd/manager.go', line: 685,
    domain: 'd_orchestration', domainLabel: '任务编排',
    authored: true, abridged: '省略了 12 处纯参数装配与日志（plan 解码、纪律正文校验、分支名拼装等），它们不改变控制流。',
    steps: [
      { kind: 'call', line: 707, label: 'Store.ListProjectLocations', to: 'internal/agentd', domain: 'd_workspace', domainLabel: '项目与工作区' },
      { kind: 'call', line: 713, label: 'resolveProject', to: 'internal/agentd', domain: 'd_workspace', domainLabel: '项目与工作区' },
      { kind: 'branch', line: 724, cond: '仓库路径或 plan 皆空', exit: '返回 errBadDispatchRequest' },
      { kind: 'call', line: 742, label: 'Manager.resolveExecutor', to: 'internal/agentd/manager.go:329',
        domain: 'd_execution', domainLabel: '任务执行', resolves: 'executor.Adapter',
        note: '接口在这里被解析成实现：按 task.Executor（或缺省名）查注册表 m.ads。查不到就报错并列出已注册名——所以「有几个实现」在运行期是配置决定的，不是代码里写死的。' },
      { kind: 'call', line: 753, label: 'env.For(execName)', to: 'internal/agentd', domain: 'd_policy', domainLabel: '运行策略与配置' },
      { kind: 'call', line: 811, label: 'EnsureRepoUsable', to: 'internal/agentd', domain: 'd_workspace', domainLabel: '项目与工作区' },
      { kind: 'branch', line: 836, cond: '目标工作目录被占用', exit: '返回 409' },
      { kind: 'call', line: 841, label: 'ResolveBaseline', to: 'internal/agentd', domain: 'd_workspace', domainLabel: '项目与工作区' },
      { kind: 'branch', line: 881, cond: '进程余量不足', exit: '返回（准入闸拒发）' },
      { kind: 'call', line: 888, label: 'PrepareWorkspace', to: 'internal/agentd', domain: 'd_workspace', domainLabel: '项目与工作区',
        note: '这之后到 ad.Start 成功之前的任何错误返回，都要由 defer 清掉已建的 managed worktree。' },
      { kind: 'call', line: 967, label: 'Store.CreateTask', to: 'internal/agentd', domain: 'd_orchestration', domainLabel: '任务编排' },
      { kind: 'branch', line: 972, cond: '写分支名失败',
        body: [
          { kind: 'call', line: 975, label: 'transitBestEffort(failed)', to: 'internal/agentd', domain: 'd_orchestration', domainLabel: '任务编排' },
          { kind: 'branch', line: 977, cond: '（无条件）', exit: '返回「记录任务分支」' }
        ] },
      { kind: 'call', line: 994, label: 'Adapter.Start', to: 'internal/executor/executor.go:219',
        iface: true, domain: 'd_execution', domainLabel: '任务执行',
        note: '流程图上展示的是<b>接口</b>——代码里写的就是它，能不能走到哪个实现是运行期的事。右栏列实现，每个实现的入口就是那个实现的流程图起点。',
        impls: [
          { label: 'claudecode.Adapter', file: 'internal/executor/claudecode/adapter.go:224', entryOf: 'e_impl_claudecode_start', note: '默认执行器' },
          { label: 'codex.Adapter', file: 'internal/executor/codex/adapter.go:299', entryOf: null },
          { label: 'grok.Adapter', file: 'internal/executor/grok/adapter.go:212', entryOf: null },
          { label: 'opencode.Adapter', file: 'internal/executor/opencode/adapter.go:364', entryOf: null }
        ] },
      { kind: 'branch', line: 995, cond: 'adapter 启动失败',
        body: [
          { kind: 'call', line: 999, label: 'transitBestEffort(failed)', to: 'internal/agentd', domain: 'd_orchestration', domainLabel: '任务编排' },
          { kind: 'branch', line: 1000, cond: '（无条件）', exit: '返回 errExecutorStartFailed' }
        ] },
      { kind: 'call', line: 1006, label: 'Manager.transit(running)', to: 'internal/agentd', domain: 'd_orchestration', domainLabel: '任务编排' },
      { kind: 'return', line: 1010, label: '返回任务快照' }
    ],
    debt: [
      { t: 'ok', h: '接口把四个执行器收在一个格位上',
        d: 'executor.Adapter 五个方法，四个实现（claudecode / codex / grok / opencode）。Manager 只认接口，加第五个执行器不动 Dispatch 一行——这是抽象在还债。' },
      { t: 'warn', h: '四个实现只有一个走得到流程图',
        d: '原型手抽了 claudecode 一条。真实现里四个 Start 各自 80~150 行、结构相似（裁决 socket → 写任务物料 → 起进程 → 起事件循环 → 投首轮）。四张流程图摆在一起才看得出哪些步骤是真差异、哪些是抄了四遍——这个对比只有这根轴给得出。' },
      { t: 'warn', h: '接口调用点之前有一大段不可回滚的副作用',
        d: 'PrepareWorkspace 建工作树、CreateTask 落库、SetTaskField 写分支，全排在 ad.Start 之前。所以要靠一个 defer 补偿清理覆盖「全部」错误返回——源码注释自己写了漏补一处 worktree 就永久残留。次序造成的债，流程图上一眼看得见。' }
    ]
  },

  // ── 流程三：一个实现的流程图（下钻的落点）───────────────
  e_impl_claudecode_start: {
    entry: 'claudecode.Adapter.Start（executor.Adapter 的实现）',
    file: 'internal/executor/claudecode/adapter.go', line: 224,
    domain: 'd_execution', domainLabel: '任务执行',
    authored: true, implOf: { iface: 'executor.Adapter.Start', from: 'e_http_post_api_tasks' },
    steps: [
      { kind: 'call', line: 234, label: 'newRun(taskID, taskDir)', to: 'claudecode', domain: 'd_execution', domainLabel: '任务执行' },
      { kind: 'branch', line: 236, cond: 'frames.BeginTurn 失败', exit: '返回 err' },
      { kind: 'call', line: 243, label: '装配 rollback 闭包', to: 'claudecode', domain: 'd_execution', domainLabel: '任务执行',
        note: '回滚顺序与创建顺序相反：先停 socket 受理、再 kill 进程、最后注销运行态。' },
      { kind: 'call', line: 256, label: '① newPermServerFn(sock)', to: 'claudecode', domain: 'd_execution', domainLabel: '任务执行',
        note: '裁决 socket 必须先于 claude 进程存在——claude 加载 mcp.json 会立刻拉起子进程连它，socket 未就绪会让子进程一直重试（fail-closed）。' },
      { kind: 'branch', line: 257, cond: 'err != nil', exit: '返回 err' },
      { kind: 'call', line: 263, label: '② os.Executable()', to: 'stdlib', domain: null, domainLabel: '标准库' },
      { kind: 'call', line: 268, label: '② WriteTaskEnv(settings/mcp/prompt)', to: 'claudecode', domain: 'd_execution', domainLabel: '任务执行' },
      { kind: 'branch', line: 269, cond: 'err != nil', exit: '回滚后返回' },
      { kind: 'call', line: 280, label: '③ ensureTaskTmp', to: 'claudecode', domain: 'd_execution', domainLabel: '任务执行' },
      { kind: 'call', line: 286, label: '③ startProc(claude)', to: 'claudecode', domain: 'd_execution', domainLabel: '任务执行' },
      { kind: 'branch', line: 297, cond: 'err != nil', exit: '回滚后返回' },
      { kind: 'call', line: 303, label: '④ go streamLoop / go watchdog', to: 'claudecode', domain: 'd_execution', domainLabel: '任务执行',
        note: '必须在写 prompt 之前起好：claude 的 init 在收到首条输入后才吐，goroutine 晚起会漏掉 init 之前的事件。又一处只有流程图能表达的次序约束。' },
      { kind: 'call', line: 309, label: '⑤ 投首回合 prompt', to: 'claudecode', domain: 'd_execution', domainLabel: '任务执行' },
      { kind: 'return', line: 312, label: '返回 nil（异步执行已接管）' }
    ],
    debt: [
      { t: 'ok', h: '实现的流程图有自己的入口',
        d: '这就是你说的「各实现的入口就是实现的流程图的起点」。从 Manager.Dispatch 的接口节点点进来，起点换成了这个实现自己的 Start。' },
      { t: 'warn', h: '五步结构四个实现各写一遍',
        d: '① 裁决 socket ② 写任务物料 ③ 起进程 ④ 起事件循环 ⑤ 投首轮——四个 adapter 都是这个骨架。骨架相同、细节不同的东西抄四遍，是模板方法没抽出来的债。四张流程图并排才看得出来。' }
    ]
  }
}
