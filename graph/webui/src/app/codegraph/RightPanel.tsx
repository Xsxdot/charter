// RightPanel —— 结构轴右栏：基本信息 / 对外面 / 状态机 三 tab + 可拖宽分隔条。
//
// 职责：把 ScopePageModel 已算定的读数映射为可测试的 DOM（data-* 契约）；
// tab 切换、噪声折叠展开、程序入口点击、拖宽都是组件本地状态。
// 边界：只消费模型——禁止在 JSX 里重算任何债读数/折叠判据（缝纪律，breakdown
// K4 序列化边界族）。不变式按协调者修订 R3 从模型真渲染（三态互斥：present/
// unwritten/no-decl，text 与 testRef 逐字透传）；状态机仍是模型未投影的声明正文，
// 以「未接线」指针如实呈现（缺口登记见 c12.4-plan §1.5，R3-A 维持）。
// 拖宽持久化 localStorage 读写失败（隐私模式）不得崩溃：try/catch 包裹并留 warn。
import { useRef, useState } from 'react'
import type { JSX } from 'react'
import type { ScopeEntryRef, ScopeNode, ScopePageModel } from './scopepage'

/** tab 三值词表（breakdown K4 枚举族：tab 名三值）。 */
const SCOPE_TABS = ['info', 'seams', 'state-machine'] as const
export type ScopeTabId = (typeof SCOPE_TABS)[number]
const TAB_LABELS: Record<ScopeTabId, string> = {
  'info': '基本信息',
  'seams': '对外面',
  'state-machine': '状态机',
}

/**
 * channel 四值词表（api/types CgEntryChannel 同源序）+ 缺席降级桶恒排最后。
 * 词表外取值（wire JSON 不受静态四值约束，真实可达）与缺席同归「通道未标注」
 * 中性桶——任何 entry 都不许从界面消失（breakdown K4 枚举族：未知值走中性缺省）。
 */
const CHANNEL_BUCKETS = ['cli', 'http', 'ws', 'web'] as const
const UNLABELED_BUCKET = 'unlabeled'
const CHANNEL_LABELS: Record<string, string> = {
  'cli': 'CLI',
  'http': 'HTTP',
  'ws': 'WS',
  'web': 'Web',
  [UNLABELED_BUCKET]: '通道未标注',
}

// 桶成员判据写成穷尽式映射：每个 channel 值恰好映射到一个桶 id，缺席与词表外
// 统一落 UNLABELED_BUCKET——五个桶因此无交并全覆盖，成员数之和恒等于 entries 总数。
function channelBucketOf(channel: ScopeEntryRef['channel']): typeof UNLABELED_BUCKET | (typeof CHANNEL_BUCKETS)[number] {
  if (channel !== undefined && (CHANNEL_BUCKETS as readonly string[]).includes(channel)) {
    return channel
  }
  return UNLABELED_BUCKET
}

// 右栏宽度：默认值与夹取区间是渲染选择；持久化键名归 plan §7 定名。
const WIDTH_KEY = 'codegraph.scope.rightWidth'
const DEFAULT_WIDTH = 360
const MIN_WIDTH = 280
const MAX_WIDTH = 720

function readStoredWidth(): number {
  try {
    const raw = window.localStorage.getItem(WIDTH_KEY)
    const parsed = raw === null ? NaN : Number(raw)
    if (!Number.isFinite(parsed)) return DEFAULT_WIDTH
    return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, parsed))
  } catch (cause) {
    // 隐私模式读取失败按默认宽度开，不打断渲染；与写方向同款 warn 留痕（带键名）
    console.warn('[codegraph] right width restore failed', { key: WIDTH_KEY, cause: String(cause) })
    return DEFAULT_WIDTH
  }
}

function writeStoredWidth(width: number): void {
  try {
    window.localStorage.setItem(WIDTH_KEY, String(width))
  } catch (cause) {
    console.warn('[codegraph] right width persist failed', { key: WIDTH_KEY, cause: String(cause) })
  }
}

export interface RightPanelProps {
  model: ScopePageModel
  selectedNodeId: string
  /** 点程序入口进入行为轴流程图（K5/K6 接线）；本卡只回调。 */
  onOpenEntry?: (entryNodeId: string) => void
}

function declFileId(node: ScopeNode | null, model: ScopePageModel): string {
  return node ? node.id : model.scopeId ?? ''
}

function ResponsibilityBlock({ node, model }: { node: ScopeNode | null; model: ScopePageModel }) {
  if (!node) return null
  if (node.responsibility.state === 'declared') {
    return <p data-responsibility className="text-sm leading-relaxed">{node.responsibility.text}</p>
  }
  if (node.responsibility.state === 'no-subject') {
    return (
      <p data-no-subject className="text-xs text-muted-foreground">
        无职责主体（{node.type || '未知类型'}）：这类容器没有可说清的职责主体，不硬凑
      </p>
    )
  }
  return (
    <p data-empty="no-declaration" className="text-xs text-muted-foreground">
      未声明：职责正文唯一所有者是领域声明文件，请写入
      <code className="mx-1 rounded bg-muted px-1 py-0.5 font-mono">codegraph/domains/{declFileId(node, model)}.json</code>
    </p>
  )
}

// 不变式区块（R3 接线）：模型三态互斥，这里只做投影不重算——present 渲染条目与
// 测试锚；unwritten 与 no-decl 是两个不同事实，用两个不同的空态标记分开呈现。
function InvariantsBlock({ node, model }: { node: ScopeNode; model: ScopePageModel }) {
  const inv = node.invariants
  if (!inv) return null
  if (inv.state === 'present') {
    return (
      <div>
        {inv.items.map((item) => (
          <div key={item.text} data-invariant className="border-t py-1.5 text-xs leading-relaxed first:border-t-0">
            {item.text}
            {item.testRef !== undefined && (
              <span data-invariant-test className="ml-1 font-mono text-[10.5px] text-muted-foreground">· 测试 {item.testRef}</span>
            )}
          </div>
        ))}
      </div>
    )
  }
  if (inv.state === 'unwritten') {
    return (
      <p data-empty="no-invariants" className="text-xs text-muted-foreground">
        声明文件在，但还没写任何不变式；写入位置是
        <code className="mx-1 rounded bg-muted px-1 py-0.5 font-mono">codegraph/domains/{declFileId(node, model)}.json</code>
        的 invariants 字段
      </p>
    )
  }
  return (
    <p data-empty="no-decl" className="text-xs text-muted-foreground">
      该域还没有声明文件，不变式无从谈起；请先创建
      <code className="mx-1 rounded bg-muted px-1 py-0.5 font-mono">codegraph/domains/{declFileId(node, model)}.json</code>
      并写入职责与 invariants
    </p>
  )
}

export function RightPanel({ model, selectedNodeId, onOpenEntry }: RightPanelProps): JSX.Element {
  const [tab, setTab] = useState<ScopeTabId>('info')
  const [width, setWidth] = useState(readStoredWidth)
  const [foldedOpen, setFoldedOpen] = useState(false)
  const [activeEntry, setActiveEntry] = useState('')
  const dragStart = useRef<{ x: number; width: number } | null>(null)

  const selected: ScopeNode | null = model.nodes.find((n) => n.id === selectedNodeId) ?? null

  const startResize = (event: React.MouseEvent) => {
    dragStart.current = { x: event.clientX, width }
    const onMove = (e: MouseEvent) => {
      const base = dragStart.current
      if (!base) return
      setWidth(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, base.width + (base.x - e.clientX))))
    }
    const onUp = () => {
      dragStart.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      setWidth((final) => {
        writeStoredWidth(final)
        return final
      })
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    event.preventDefault()
  }

  const openEntry = (entry: ScopeEntryRef) => {
    console.info('[codegraph] scope entry open', { entryId: entry.id, wired: onOpenEntry !== undefined })
    setActiveEntry(entry.id)
    onOpenEntry?.(entry.id)
  }

  const seams = model.inboundSeams
  const foldedSeams = seams.filter((s) => s.folded)
  const shownSeams = seams.filter((s) => !s.folded)

  return (
    <aside
      data-right-panel
      data-selected={selectedNodeId}
      data-width={width}
      style={{ width }}
      className="relative shrink-0 overflow-y-auto border-l p-3 text-sm"
    >
      <div
        data-resize-handle
        role="separator"
        aria-orientation="vertical"
        aria-label="拖动调整右栏宽度"
        onMouseDown={startResize}
        className="absolute left-0 top-0 z-20 h-full w-1.5 cursor-col-resize hover:bg-primary/30"
      />
      <div role="tablist" data-panel-tabs className="mb-3 flex gap-1 border-b pb-1">
        {SCOPE_TABS.map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            data-panel-tab={id}
            onClick={() => { console.info('[codegraph] right panel tab select', { tab: id }); setTab(id) }}
            className={'rounded px-2.5 py-1 text-xs hover:bg-muted '
              + (tab === id ? 'bg-muted font-semibold outline outline-1 outline-primary' : '')}
          >
            {TAB_LABELS[id]}
          </button>
        ))}
      </div>

      {tab === 'info' && (
        <div role="tabpanel" data-tab-body="info" className="space-y-3">
          {!selected && (
            <p data-no-selection className="text-xs text-muted-foreground">
              单击图上的卡片查看它的职责、读数与程序入口
            </p>
          )}
          {selected && (
            <>
              <section data-section="subject" className="rounded-xl border bg-background p-2.5 shadow-sm">
                <h3 className="mb-1 text-sm font-semibold">{selected.label}</h3>
                <div className="font-mono text-[11px] text-muted-foreground">
                  {selected.kind} · {selected.type || '类型未知'}
                </div>
              </section>

              <section data-section="responsibility" className="rounded-xl border bg-background p-2.5 shadow-sm">
                <h3 className="mb-1 text-sm font-semibold">职责</h3>
                <ResponsibilityBlock node={selected} model={model} />
              </section>

              <section data-section="readouts" className="rounded-xl border bg-background p-2.5 shadow-sm">
                <h3 className="mb-1 text-sm font-semibold">选中项读数</h3>
                <div data-readouts className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                  <span>符号数</span><span data-readout="symbols" className="text-right font-mono">{selected.symbolCount}</span>
                  <span>文件数</span><span data-readout="files" className="text-right font-mono">{selected.fileCount}</span>
                  {selected.kind === 'domain' && (
                    <>
                      <span>容器数</span><span data-readout="containers" className="text-right font-mono">{selected.containerCount}</span>
                      <span>下层领域数</span><span data-readout="children" className="text-right font-mono">{selected.childCount}</span>
                    </>
                  )}
                  <span>包目录</span><span data-readout="dir" className="truncate text-right font-mono">{selected.dir || '—'}</span>
                </div>
                {selected.oversized && (
                  <p data-oversized-mark className="mt-1.5 rounded bg-amber-100 px-2 py-1 text-[11px] text-amber-800">
                    超大容器（&gt;40 符号）：{selected.symbolCount} 符号 / {selected.fileCount} 文件 · 如实报，不做折叠圆场
                  </p>
                )}
              </section>

              {selected.debt && (
                <section data-section="debt" className="rounded-xl border bg-background p-2.5 shadow-sm">
                  <h3 className="mb-1 text-sm font-semibold">对外面读数（兜底桶占比）</h3>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                    <span>跨域入边</span><span data-debt="inbound" className="text-right font-mono">{selected.debt.inboundCrossDomain}</span>
                    <span>落兜底桶</span><span data-debt="fallback" className="text-right font-mono">{selected.debt.fallbackBucket}</span>
                    <span>词表外 kind</span><span data-debt="unknown-kind" className="text-right font-mono">{selected.debt.unknownKind}</span>
                    <span>占比</span>
                    {selected.debt.ratio === null ? (
                      <span data-debt="ratio-none" className="text-right text-muted-foreground">无跨域入边</span>
                    ) : (
                      <span data-debt="ratio" className="text-right font-mono">{Math.round(selected.debt.ratio * 100)}%</span>
                    )}
                  </div>
                </section>
              )}

              <section data-section="entries" className="rounded-xl border bg-background p-2.5 shadow-sm">
                <h3 className="mb-1 text-sm font-semibold">程序入口</h3>
                {selected.entries.length === 0 ? (
                  <p data-empty="no-entries" className="text-xs text-muted-foreground">这张卡没有程序入口</p>
                ) : (
                  <div className="space-y-1.5">
                    {[...CHANNEL_BUCKETS, UNLABELED_BUCKET].map((bucket) => {
                      const members = selected.entries.filter((entry) => channelBucketOf(entry.channel) === bucket)
                      if (!members.length) return null
                      return (
                        <div key={bucket} data-channel-group={bucket}>
                          <div className="mb-0.5 text-[11px] font-semibold text-muted-foreground">
                            {CHANNEL_LABELS[bucket]} · {members.length}
                          </div>
                          {members.map((entry) => (
                            <button
                              key={entry.id}
                              type="button"
                              data-entry={entry.id}
                              data-entry-active={activeEntry === entry.id ? 'true' : undefined}
                              onClick={() => openEntry(entry)}
                              className={'block w-full truncate rounded px-2 py-0.5 text-left font-mono text-xs hover:bg-muted '
                                + (activeEntry === entry.id ? 'bg-muted outline outline-1 outline-primary' : '')}
                            >
                              {entry.name}
                            </button>
                          ))}
                        </div>
                      )
                    })}
                  </div>
                )}
              </section>

              {selected.kind !== 'container' && (
                <section data-section="invariants" className="rounded-xl border bg-background p-2.5 shadow-sm">
                  <h3 className="mb-1 text-sm font-semibold">不变式</h3>
                  <InvariantsBlock node={selected} model={model} />
                </section>
              )}
            </>
          )}
        </div>
      )}

      {tab === 'seams' && (
        <div role="tabpanel" data-tab-body="seams" className="space-y-2">
          <p data-seams-disclaimer className="rounded bg-muted/40 px-2 py-1 text-[11px] text-muted-foreground">
            这里列的是对外入缝（被调进来的契约面），不是程序入口——程序入口在基本信息 tab 底部，点它进流程图
          </p>
          {model.empty.noInboundSeams && (
            <p data-empty="no-inbound-seams" className="rounded border bg-muted/40 px-2.5 py-2 text-xs text-muted-foreground">
              本层没有跨域入缝：入缝来自扫描的跨域调用边，若应有请检查 codegraph/baseline.json 是否覆盖调用方
            </p>
          )}
          {shownSeams.map((seam) => (
            <div
              key={seam.nodeId}
              data-inbound-seam={seam.nodeId}
              data-kind-class={seam.kindClass}
              className="rounded border px-2 py-1.5 text-xs"
            >
              <div className="font-mono">{seam.name}</div>
              <div className="text-muted-foreground">
                {seam.containerLabel} · 复用 {seam.reuse}
                {seam.reuse === 0 ? <span data-dead-contract className="ml-1 text-destructive">死契约</span> : null}
              </div>
              {seam.callerDomains.length > 0 && (
                <div className="text-[11px] text-muted-foreground">来自 {seam.callerDomains.join('、')}</div>
              )}
            </div>
          ))}
          {foldedSeams.length > 0 && (
            <div data-folded-block>
              <button
                type="button"
                data-folded-toggle
                aria-expanded={foldedOpen}
                onClick={() => setFoldedOpen((open) => !open)}
                className="w-full rounded border border-dashed px-2 py-1 text-left text-xs text-muted-foreground hover:bg-muted"
              >
                已折叠 {foldedSeams.length} 条噪声（兜底桶 ∧ 复用≥10，不占名额）{foldedOpen ? '▲ 收起' : '▼ 展开'}
              </button>
              {foldedOpen && foldedSeams.map((seam) => (
                <div
                  key={seam.nodeId}
                  data-inbound-seam={seam.nodeId}
                  data-folded="true"
                  data-kind-class={seam.kindClass}
                  className="mt-1 rounded border border-dashed px-2 py-1.5 text-xs text-muted-foreground"
                >
                  <span className="font-mono">{seam.name}</span> · {seam.containerLabel} · 复用 {seam.reuse}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'state-machine' && (
        <div role="tabpanel" data-tab-body="state-machine">
          <p data-state-machine-unwired className="text-xs text-muted-foreground">
            状态机迁移未接入结构轴模型读数；声明的写入位置是
            <code className="mx-1 rounded bg-muted px-1 py-0.5 font-mono">codegraph/domains/{declFileId(selected, model)}.json</code>
            的 stateMachine 字段（迁移边 anchor 指向写迁移的符号）
          </p>
        </div>
      )}
    </aside>
  )
}
