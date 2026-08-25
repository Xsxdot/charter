// BestDomainPage —— C1.10 领域页的语义/结构双 tab 与组织切换薄壳。
//
// 边界：只消费 deriveDomainPage 的模型，维护 tab、组织、泳道和节点选择；实体、
// 端口、级联和截断规则不在 JSX 内重算。源码读取由 DomainCascadeDrawer 统一走既有 client。
import { useEffect, useMemo, useState } from 'react'
import type { CgBest, CgCheckReport, CgGraph } from '../../api/types'
import { BestLeafGraph } from './BestLeafGraph'
import type { MigrationItem } from './besttree'
import {
  deriveDomainPage,
  type DomainLane,
  type DomainOrganization,
  type SemanticViewModel,
  type StructureViewModel,
} from './domainpage'
import { DomainCascadeDrawer } from './DomainCascadeDrawer'

type DomainTab = 'semantic' | 'structure'

export interface BestDomainPageProps {
  project: string
  baseline: CgGraph
  best?: CgBest
  decls?: import('../../api/types').CgDomainDecls
  report?: CgCheckReport
  domainId: string
  migrationItems: MigrationItem[]
  selectedContainer: string
  onSelectContainer: (id: string) => void
}

function SemanticTab({ model }: { model: SemanticViewModel }) {
  const declaration = model.declaration
  return (
    <div data-semantic-tab className="min-w-0 space-y-4">
      <section data-testid="semantic-intended" data-semantic-intended className="grid gap-3 lg:grid-cols-2">
        <article className="rounded-xl border bg-background p-3 shadow-sm">
          <h3 className="mb-1 text-sm font-semibold">职责</h3>
          <p className="mb-2 text-[11px] text-muted-foreground">应然层 · 人写声明</p>
          {declaration ? <p data-declaration className="text-sm leading-relaxed">{declaration.responsibility}</p> : (
            <p data-empty="no-declaration" className="text-xs text-muted-foreground">声明是人写的应然承诺，扫描器不生成；当前覆盖 {model.declaredDomainCount}/{model.totalDomainCount}，请写入 codegraph/domains/{model.domainId}.json</p>
          )}
          <p data-testid="declared-coverage" className="mt-2 text-[11px] text-muted-foreground">声明覆盖 {model.declaredDomainCount}/{model.totalDomainCount}</p>
        </article>

        <article className="rounded-xl border bg-background p-3 shadow-sm">
          <h3 className="mb-1 text-sm font-semibold">不变式</h3>
          <p className="mb-2 text-[11px] text-muted-foreground">每条须带测试锚</p>
          {declaration?.invariants?.length ? declaration.invariants.map((item) => (
            <div key={item.text} data-invariant className="border-t py-1.5 text-sm">{item.text}{item.testRef ? ` · 测试 ${item.testRef}` : ''}</div>
          )) : <p data-empty="no-invariants" className="text-xs text-muted-foreground">没有不变式声明</p>}
        </article>

        <article className="rounded-xl border bg-background p-3 shadow-sm">
          <h3 className="mb-1 text-sm font-semibold">状态机</h3>
          <p className="mb-2 text-[11px] text-muted-foreground">合法迁移表</p>
          {declaration?.stateMachine?.length ? declaration.stateMachine.map((transition) => (
            <div key={`${transition.from}->${transition.to}`} data-transition className="border-t py-1.5 text-sm">{transition.from} → {transition.to}{transition.anchor ? ` · ${transition.anchor}` : ''}</div>
          )) : <p className="text-xs text-muted-foreground">没有状态机迁移声明</p>}
        </article>

        <article className="rounded-xl border bg-background p-3 shadow-sm">
          <h3 className="mb-1 text-sm font-semibold">生命周期</h3>
          <p className="mb-2 text-[11px] text-muted-foreground">创建 → 终结</p>
          {declaration?.lifecycle ? <div data-lifecycle className="border-t py-1.5 text-sm">{declaration.lifecycle.from} → {declaration.lifecycle.to}</div> : (
            <p className="text-xs text-muted-foreground">没有生命周期声明</p>
          )}
        </article>
      </section>

      <section data-testid="semantic-mechanical" data-semantic-mechanical className="grid gap-3 lg:grid-cols-2">
        <article className="rounded-xl border bg-background p-3 shadow-sm">
          <h3 className="mb-1 text-sm font-semibold">实体表</h3>
          <p className="mb-2 text-[11px] text-muted-foreground">机械层 · 扫描事实</p>
          {model.entities.length ? model.entities.map((entity) => (
            <div key={entity.id} data-entity={entity.id} className="border-t py-1.5 text-sm">{entity.node.name} · creator {entity.creators.join('、') || '无'} · writer {entity.writers.map((writer) => `${writer.id}${writer.field ? `.${writer.field}` : ''}`).join('、') || '无'}</div>
          )) : <p data-empty="no-entities" className="text-xs text-muted-foreground">实体表只列 modelKind=entity；当前没有实体</p>}
        </article>

        <article className="rounded-xl border bg-background p-3 shadow-sm">
          <h3 className="mb-1 text-sm font-semibold">包职责</h3>
          <p className="mb-2 text-[11px] text-muted-foreground">机械层 · packages 段</p>
          {model.packages.length ? model.packages.map((pkg) => (
            <div key={pkg.dir} data-package={pkg.dir} className="border-t py-1.5 text-sm">{pkg.dir || '未归包'} · {pkg.summary}</div>
          )) : <p className="text-xs text-muted-foreground">没有 packages 段</p>}
        </article>
      </section>
    </div>
  )
}

function StructureTab({ model, organization, best, baseline, report, migrationItems, selectedContainer, onSelectContainer, onSelectLane }: {
  model: StructureViewModel
  organization: DomainOrganization
  best?: CgBest
  baseline: CgGraph
  report?: CgCheckReport
  migrationItems: MigrationItem[]
  selectedContainer: string
  onSelectContainer: (id: string) => void
  onSelectLane: (key: string) => void
}) {
  return (
    <div data-structure-tab className="min-w-0 space-y-4">
      <div className="grid gap-3 md:grid-cols-2" data-ports>
        <section data-inbound-ports className="rounded-xl border bg-background p-3 shadow-sm">
          <h3 className="mb-2 text-sm font-semibold">调进来（入边来源）</h3>
          <div className="space-y-1">
            {model.inboundPorts.length ? model.inboundPorts.map((port) => (
              <div key={port.domainId} data-testid={`inbound-port-${port.domainId}`} className="flex justify-between rounded bg-muted/40 px-2 py-1 text-xs">
                <span>{port.label}</span><span className="font-mono">{port.edgeCount}</span>
              </div>
            )) : <p className="text-xs text-muted-foreground">无跨域入边</p>}
          </div>
        </section>
        <section data-outbound-ports className="rounded-xl border bg-background p-3 shadow-sm">
          <h3 className="mb-2 text-sm font-semibold">调出去（出边去向）</h3>
          <div className="space-y-1">
            {model.outboundPorts.length ? model.outboundPorts.map((port) => (
              <div key={port.domainId} data-testid={`outbound-port-${port.domainId}`} className="flex justify-between rounded bg-muted/40 px-2 py-1 text-xs">
                <span>{port.label}</span><span className="font-mono">{port.edgeCount}</span>
              </div>
            )) : <p data-empty="no-outbound-seams" className="text-xs text-muted-foreground">无跨域出边</p>}
          </div>
        </section>
      </div>

      {model.focusTruncation ? (
        <p data-focus-truncation className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          入缝 {model.focusTruncation.total} 条，按配额显示前 {model.focusTruncation.shown}
        </p>
      ) : null}

      {model.noInboundSeams ? <p data-empty="no-inbound-seams">本域没有跨域入边；请读包职责与实体表</p> : (
        <div data-domain-lanes className="space-y-2">
          <h3 className="text-sm font-semibold">级联调用链</h3>
          {model.lanes.map((lane) => <button key={lane.key} type="button" data-testid="domain-lane" data-domain-lane={lane.key} onClick={() => onSelectLane(lane.key)} className="block w-full rounded border px-3 py-2 text-left text-xs hover:bg-muted">
            <span className="font-mono">{lane.fromDomainId}</span><span className="px-2 text-muted-foreground">→</span><span className="font-mono">{lane.focusNodeId}</span>
          </button>)}
        </div>
      )}
      {organization === 'best' && best ? <BestLeafGraph best={best} baseline={baseline} report={report} scopeId={model.domainId}
        selectedContainer={selectedContainer} migrationItems={migrationItems} onSelectContainer={onSelectContainer} /> : null}
    </div>
  )
}

/**
 * 渲染领域页。
 * 参数：项目名、基线/最优图、可选主线声明和既有迁移选择；返回双 tab 页面。
 * 注意：组织和选择态只存在组件内存，模型派生与源码请求分别由纯函数和既有 client 负责。
 */
export function BestDomainPage(props: BestDomainPageProps) {
  const { project, baseline, best, decls, report, domainId, migrationItems, selectedContainer, onSelectContainer } = props
  const [organization, setOrganization] = useState<DomainOrganization>(best ? 'best' : 'current')
  const [tab, setTab] = useState<DomainTab>('semantic')
  const [selectedLaneKey, setSelectedLaneKey] = useState('')
  const [selectedNodeId, setSelectedNodeId] = useState('')
  const model = useMemo(
    () => deriveDomainPage({ baseline, best, decls, organization, domainId }),
    [baseline, best, decls, organization, domainId],
  )
  const lane: DomainLane | null = model.structure.lanes.find((candidate) => candidate.key === selectedLaneKey) ?? null

  useEffect(() => {
    setSelectedLaneKey('')
    setSelectedNodeId('')
  }, [organization, domainId])

  return (
    <section data-testid="best-domain-page" data-best-domain-page={domainId} data-organization={organization} className="min-w-0 flex-1 overflow-y-auto p-4">
      <div data-domain-tabs role="tablist">
        <button role="tab" aria-selected={tab === 'semantic'} onClick={() => setTab('semantic')}>语义</button>
        <button role="tab" aria-selected={tab === 'structure'} onClick={() => setTab('structure')}>结构</button>
        <button type="button" data-organization="best" disabled={!best} onClick={() => { console.info('[codegraph] domain organization select', { domainId, organization: 'best' }); setOrganization('best') }}>按最优树</button>
        <button type="button" data-organization="current" onClick={() => { console.info('[codegraph] domain organization select', { domainId, organization: 'current' }); setOrganization('current') }}>按现状领域</button>
      </div>
      {tab === 'semantic' ? <SemanticTab model={model.semantic} /> : (
        <StructureTab model={model.structure} organization={organization} best={best} baseline={baseline} report={report}
          migrationItems={migrationItems} selectedContainer={selectedContainer} onSelectContainer={onSelectContainer}
          onSelectLane={(key) => { console.info('[codegraph] domain lane select', { domainId, organization, key }); setSelectedLaneKey(key); setSelectedNodeId('') }} />
      )}
      <DomainCascadeDrawer project={project} baseline={baseline} lane={lane} selectedNodeId={selectedNodeId}
        onSelectNode={(id) => { console.debug('[codegraph] cascade node select', { domainId, organization, id }); setSelectedNodeId(id) }} />
    </section>
  )
}
