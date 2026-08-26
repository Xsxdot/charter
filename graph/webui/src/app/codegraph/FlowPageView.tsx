// FlowPageView —— 行为轴页面壳：一条程序入口一条泳道。
//
// 职责：持有递归下钻栈与步骤选中态；对每个当前入口调用缝 2 deriveFlowPage
// （§2.4-29 地址冻结）；渲染泳道头、术语三分定义、右栏两 tab（基本信息 /
// 调用链（给 agent））。紫框 ▸ 下层入口点击即把该入口压栈进入它自己的流程图；
// 换图清空旧图选中态。degraded 时渲染显式可行动空态（缺什么 / 为什么 / 何时有 /
// 现在能做什么），绝不把 callChain 机械可达序列画成流程图（§2.4-31 最大危害，
// 反面断言锁死）。
// 边界：唯一数据源是 FlowPageModel；本页不发起任何网络请求（取数由 K6 装配层经
// props 注入）。入口显示名读模型输出侧字段 entryName（C12.6 协调者裁决的纯输出侧
// 扩展，c12.5-plan §1.4 登记缺口的正道落地）；幽灵入口空串时以 id 兜底呈现，
// 不就地读 baseline.nodes 补名。下钻层级（祖先链）显示沿途入口真名——名字来自
// 各自当层模型的 entryName 与点击时的步骤 targetName，同样不从 baseline 直读。
// 视觉质量（蛇形走线、中文折行、拖宽重排）归真机清单（breakdown §四.2）。
import { useEffect, useMemo, useState } from 'react'
import type { JSX } from 'react'
import type { CgGraph } from '../../api/types'
import { FlowChart, FLOW_PAGE_WIDTH } from './FlowChart'
import { deriveFlowPage } from './flowpage'

export interface FlowPageViewProps {
  baseline: CgGraph
  /** 泳道起点：一条程序入口一张流程图（§2.4-30）；下钻栈由本组件内存维护。 */
  entryNodeId: string
}

export function FlowPageView({ baseline, entryNodeId }: FlowPageViewProps): JSX.Element {
  const [stack, setStack] = useState<string[]>([entryNodeId])
  const [selectedStepId, setSelectedStepId] = useState('')
  const [tab, setTab] = useState<'info' | 'chain'>('info')
  // 下钻层级真名表：id → 入口显示名。名字两个来源，都不读 baseline——
  // ① 点击下层入口那一刻，从当前模型里查该 id 的步骤 targetName；
  // ② 到达后由当层模型的 entryName 回填（①未命中或空串时兜底）。
  const [trailNames, setTrailNames] = useState<Record<string, string>>({})
  const current = stack[stack.length - 1] ?? entryNodeId

  // 外部换入口（K6 装配接线）＝整张页面重置：旧图的层级栈与真名表不跨图泄漏
  useEffect(() => {
    setStack([entryNodeId])
    setSelectedStepId('')
    setTrailNames({})
  }, [entryNodeId])

  const model = useMemo(
    () => deriveFlowPage({ baseline, entryNodeId: current }),
    [baseline, current],
  )

  // 当层入口名回填真名表：泳道标题与祖先链都从这里取词
  useEffect(() => {
    if (model.entryName === '') return
    setTrailNames((m) => (m[current] === model.entryName ? m : { ...m, [current]: model.entryName }))
  }, [current, model.entryName])

  const openEntry = (nextEntryId: string) => {
    console.info('[codegraph] flow page drill', { from: current, to: nextEntryId })
    // 点击瞬间的真名＝当前模型里指向该入口的步骤目标名（紫框 ▸ 的可见文本同源）
    const stepName = model.steps.find((s) => s.to === nextEntryId)?.targetName ?? ''
    setTrailNames((m) => ({ ...m, [nextEntryId]: m[nextEntryId] ?? stepName }))
    setStack((s) => [...s, nextEntryId])
    setSelectedStepId('')
  }

  const goBack = () => {
    if (stack.length <= 1) return
    console.info('[codegraph] flow page back', { from: current, to: stack[stack.length - 2] })
    setStack(stack.slice(0, -1))
    setSelectedStepId('')
  }

  const selectStep = (stepId: string) => {
    setSelectedStepId(stepId)
  }

  const selectedStep = model.steps.find((s) => s.id === selectedStepId) ?? null

  return (
    <section
      data-flow-page
      data-current-entry={current}
      data-degraded={model.degraded ? 'true' : 'false'}
      data-depth={stack.length - 1}
      className="relative flex min-h-0 flex-1 flex-col"
    >
      <div data-lane-header className="flex items-center gap-2 border-b px-3 py-1.5 text-sm">
        {stack.length > 1 && (
          <button
            type="button"
            data-flow-back
            onClick={goBack}
            className="rounded border px-2 py-0.5 text-xs hover:bg-muted"
          >
            ← 返回上一张（第 {stack.length - 1} 层）
          </button>
        )}
        <h1 data-lane-title className="font-semibold">
          泳道{model.entryName !== '' ? (
            <span className="mx-1">{model.entryName}</span>
          ) : (
            <span className="mx-1 font-mono text-xs font-normal text-muted-foreground">{current}</span>
          )}
          {model.family && (
            <span className="ml-1 text-xs font-normal text-muted-foreground">
              {model.family.label} · {model.family.members} 入口 · 触达 {model.family.reachDomains} 域
            </span>
          )}
        </h1>
        {model.degraded && !model.entryFound && (
          <span className="ml-auto rounded bg-red-100 px-2 py-0.5 text-xs text-red-700">幽灵入口</span>
        )}
      </div>

      {stack.length > 1 && (
        <nav data-flow-trail className="flex flex-wrap items-center gap-1 border-b px-3 py-1 text-xs text-muted-foreground">
          {stack.slice(0, -1).map((id, index) => (
            <span key={id} className="inline-flex items-center gap-1">
              {index > 0 && <span className="text-muted-foreground">▸</span>}
              <span data-flow-trail-entry={id}>{trailNames[id] || id}</span>
            </span>
          ))}
        </nav>
      )}

      <div className="relative flex min-h-0 flex-1">
        <div className="relative flex min-w-0 flex-1 flex-col">
          {!model.degraded && (
            <FlowChart
              model={model}
              width={FLOW_PAGE_WIDTH}
              selectedStepId={selectedStepId}
              onSelectStep={selectStep}
              onOpenEntry={openEntry}
            />
          )}

          {model.degraded && !model.entryFound && (
            <div data-entry-ghost role="alert" className="m-3 rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-800">
              入口 <code className="mx-1 font-mono">{current}</code>
              不在 codegraph/baseline.json 的 nodes 里（幽灵入口）。请检查基线是否覆盖该入口后重新扫描。
            </div>
          )}

          {model.degraded && model.entryFound && (
            <div data-flow-degraded role="status" className="m-3 rounded-xl border border-dashed bg-muted/30 p-4">
              <p data-degraded-title className="mb-2 text-sm font-semibold">这条泳道还没有流程图</p>
              <ul className="space-y-1 text-xs text-muted-foreground">
                <li>
                  <span data-degraded-missing>
                    缺什么：这个程序入口的 flows 流程数据（codegraph/baseline.json 的 flows 键没有它的条目）
                  </span>
                </li>
                <li>
                  <span data-degraded-why>
                    为什么缺：行为轴流程扫描尚未实现（C12 Out of Scope 1，扫描侧 roadmap 27/32）
                  </span>
                </li>
                <li>
                  <span data-degraded-eta>
                    何时会有：扫描侧重扫产出 flows 后自动出现，查看器无需任何改动
                  </span>
                </li>
                <li>
                  <span data-degraded-hint>
                    现在可以：切右栏「调用链（给 agent）」tab 看机械可达序列（无次序 · 无分支），或回结构轴选别的入口
                  </span>
                </li>
              </ul>
            </div>
          )}

          <div data-flow-terms className="border-t px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
            <p data-term-definition="program-entry">
              程序入口＝CLI 命令 / HTTP 端点 / WS 这类外部入口；在结构轴右栏「基本信息」底部，点它进到这里的流程图
            </p>
            <p data-term-definition="inbound-seam">
              对外入缝＝跨层边界被调进来的符号（契约面），在结构轴右栏「对外面」tab 查看——它不是程序入口，两者不得混用
            </p>
            <p data-term-definition="lane">
              泳道＝流程图的一条，一条程序入口一条泳道，只在本页出现
            </p>
          </div>
        </div>

        <aside data-flow-panel className="w-[320px] shrink-0 overflow-y-auto border-l p-3 text-sm">
          <div role="tablist" data-flow-tabs className="mb-3 flex gap-1 border-b pb-1">
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'info'}
              data-flow-tab="info"
              onClick={() => { console.info('[codegraph] flow panel tab', { tab: 'info', entry: current }); setTab('info') }}
              className={'rounded px-2.5 py-1 text-xs hover:bg-muted '
                + (tab === 'info' ? 'bg-muted font-semibold outline outline-1 outline-primary' : '')}
            >
              基本信息
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'chain'}
              data-flow-tab="chain"
              onClick={() => { console.info('[codegraph] flow panel tab', { tab: 'chain', entry: current }); setTab('chain') }}
              className={'rounded px-2.5 py-1 text-xs hover:bg-muted '
                + (tab === 'chain' ? 'bg-muted font-semibold outline outline-1 outline-primary' : '')}
            >
              调用链（给 agent）
            </button>
          </div>

          {tab === 'info' && (
            <div role="tabpanel" data-flow-tab-body="info" className="space-y-3">
              <section data-section="ownership" className="rounded-xl border bg-background p-2.5 shadow-sm">
                <h3 className="mb-1 text-sm font-semibold">入口归属</h3>
                {model.ownership.state === 'single' && (
                  <p data-ownership-single className="text-xs">
                    单值归属：<span className="font-mono">{model.ownership.domainId}</span>
                  </p>
                )}
                {model.ownership.state === 'multi' && (
                  <p data-ownership-multi className="text-xs">
                    多值归属（全部候选）：
                    {model.ownership.candidates.map((c) => (
                      <span key={c} data-ownership-candidate={c} className="mr-1 font-mono">{c}</span>
                    ))}
                  </p>
                )}
                {model.ownership.state === 'none' && (
                  <p data-ownership-none className="text-xs text-muted-foreground">
                    无行为：从入口出发判不出跨域归属（如 Cobra 分组命令本身没有行为）
                  </p>
                )}
              </section>

              <section data-section="dispersion" className="rounded-xl border bg-background p-2.5 shadow-sm">
                <h3 className="mb-1 text-sm font-semibold">注册散度</h3>
                {model.registrationDispersion === null ? (
                  <p data-dispersion-none className="text-xs text-muted-foreground">
                    归属非单值：没有唯一归属就不发散发度读数，不假装有
                  </p>
                ) : (
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                    <span>归属入口数</span><span data-dispersion-entries className="text-right font-mono">{model.registrationDispersion.entries}</span>
                    <span>注册文件数</span><span data-dispersion-files className="text-right font-mono">{model.registrationDispersion.files}</span>
                    {model.registrationDispersion.concentrated && (
                      <p data-dispersion-concentrated className="col-span-2 rounded bg-red-100 px-2 py-1 text-[11px] text-red-700">
                        集中注册：{model.registrationDispersion.files} 个文件注册了 {model.registrationDispersion.entries} 个入口（&gt;3 即红）
                      </p>
                    )}
                  </div>
                )}
              </section>

              {model.danglingChildRefs.length > 0 && (
                <section data-section="dangling" className="rounded-xl border bg-background p-2.5 shadow-sm">
                  <h3 className="mb-1 text-sm font-semibold">子干引用完整性</h3>
                  <p data-dangling-count className="text-xs text-muted-foreground">
                    {model.danglingChildRefs.length} 条悬空引用（指向不存在的步骤 id）：已在画布对应步骤上标注
                  </p>
                </section>
              )}

              {selectedStep && (
                <section data-section="step-detail" data-step-detail={selectedStep.id} className="rounded-xl border bg-background p-2.5 shadow-sm">
                  <h3 className="mb-1 text-sm font-semibold">选中步骤</h3>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                    <span>kind</span><span data-step-kind className="text-right font-mono">{selectedStep.kind}{selectedStep.unknownKind ? '（词表外）' : ''}</span>
                    <span>行号</span><span data-step-line className="text-right font-mono">{selectedStep.line}</span>
                    <span>目标</span><span data-step-target className="truncate text-right font-mono">{selectedStep.targetName ?? '—'}</span>
                    <span>所属领域</span><span data-step-target-domain className="text-right font-mono">{selectedStep.targetDomain || '—'}</span>
                  </div>
                  {selectedStep.iface === true && (
                    <div data-iface-block className="mt-2 border-t pt-2">
                      <p className="mb-1 text-xs font-semibold">接口调用（动态分派）· 全部实现</p>
                      {selectedStep.implementations.length === 0 ? (
                        <p data-impl-none className="text-xs text-muted-foreground">无实现记录（implements 段没有该接口的实现）</p>
                      ) : (
                        <ul data-impl-list className="space-y-1">
                          {selectedStep.implementations.map((impl) => (
                            <li key={impl.nodeId} data-implementation={impl.nodeId} className="rounded border px-2 py-1 text-xs">
                              <span className="font-mono">{impl.name}</span>
                              {impl.entryNodeId !== '' ? (
                                <button
                                  type="button"
                                  data-impl-entry={impl.entryNodeId}
                                  onClick={() => openEntry(impl.entryNodeId)}
                                  className="ml-1 rounded bg-muted px-1.5 py-0.5 text-[11px] hover:bg-background"
                                >
                                  看它的流程图
                                </button>
                              ) : (
                                <span data-impl-no-entry className="ml-1 text-[11px] text-muted-foreground">无入口记录</span>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </section>
              )}
              {!selectedStep && (
                <p data-no-step-selection className="text-xs text-muted-foreground">
                  单击图上的步骤查看它的目标与接口实现
                </p>
              )}
            </div>
          )}

          {tab === 'chain' && (
            <div role="tabpanel" data-flow-tab-body="chain" className="space-y-2">
              <p data-chain-note className="rounded bg-muted/40 px-2 py-1 text-[11px] text-muted-foreground">
                机械可达序列：无次序 · 无分支——这是给 agent 取数用的调用链快照，不是流程图；人的流程图在左侧画布（degraded 时本序列就是该入口当前全部已知行为）
              </p>
              {model.callChain.nodeIds.length === 0 ? (
                <p data-chain-empty className="text-xs text-muted-foreground">没有可达节点（入口无出边或入口不存在）</p>
              ) : (
                <ol data-call-chain className="space-y-0.5">
                  {model.callChain.nodeIds.map((id) => (
                    <li key={id} data-chain-node={id} className="rounded px-1.5 py-0.5 font-mono text-xs hover:bg-muted">
                      {id}
                    </li>
                  ))}
                </ol>
              )}
            </div>
          )}
        </aside>
      </div>
    </section>
  )
}
