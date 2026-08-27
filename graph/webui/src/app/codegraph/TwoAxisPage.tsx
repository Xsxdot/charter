// TwoAxisPage —— 结构轴页面壳：scope 状态、组织切换、右栏装配与覆盖层。
//
// 职责：持有 organization/scopeId/选中态/抽屉开合等页面状态；按 scope 调用缝 1
// deriveScopePage（§2.3-18 地址冻结，递归同构——每一层共用同一个派生器）；装配
// 直调债四档色映射与迁移清单两个获准的 join（R2 备案 / §2.5-39①）；渲染面包屑
// 导航栈。双击领域即换 scope，「进领域」不是单独动作（spec 导航修订二）。
// 边界：结构读数唯一数据源是 ScopePageModel——本组件不重算任何债读数/折叠判据；
// 组织切换控件不进任何 tablist（§2.3-21，机械消解 BestDomainPage.tsx:172 缺陷）；
// 本卡不发起网络请求，取数由 K6 装配层经 props 注入。行为轴入口只回调
// onOpenEntry（K5/K6 接线）。
import { useMemo, useState } from 'react'
import type { JSX } from 'react'
import type { CgBest, CgCheckReport, CgDomainDecls, CgGraph, CgTarget } from '../../api/types'
import type { MigrationItem } from './besttree'
import { assembleDirections, migrationGroups } from './besttree'
import { MigrationDrawer } from './MigrationDrawer'
import { RightPanel } from './RightPanel'
import type { EdgeStatusMap } from './ScopeCanvas'
import { ScopeCanvas } from './ScopeCanvas'
import { deriveScopePage, type ScopeOrganization } from './scopepage'

export interface TwoAxisPageProps {
  baseline: CgGraph
  best?: CgBest
  decls?: CgDomainDecls
  target?: CgTarget
  report?: CgCheckReport
  /** 点程序入口进入行为轴流程图（K5/K6 接线）；未接线时点击仍记录日志并给按钮反馈。 */
  onOpenEntry?: (entryNodeId: string) => void
}

interface TrailEntry {
  id: string
  label: string
}

export function TwoAxisPage({ baseline, best, decls, target, report, onOpenEntry }: TwoAxisPageProps): JSX.Element {
  const [organization, setOrganization] = useState<ScopeOrganization>(best ? 'best' : 'current')
  const [scopeId, setScopeId] = useState<string | null>(null)
  // 面包屑走导航栈：label 取下钻时那张卡的模型字段，不在装配层重算祖先链
  const [trail, setTrail] = useState<TrailEntry[]>([])
  const [selectedNodeId, setSelectedNodeId] = useState('')
  const [migrationOpen, setMigrationOpen] = useState(false)
  const [migrationSelectedContainer, setMigrationSelectedContainer] = useState('')

  const model = useMemo(
    () => deriveScopePage({ baseline, best, decls, target, organization, scopeId }),
    [baseline, best, decls, target, organization, scopeId],
  )

  // R2 备案的装配 join：直调债四档色的数据源在 report，不在 §2.3-19 冻结输入里；
  // 复用既有 assembleDirections，键＝`${from}->${to}`，画布按边键直查。
  const edgeStatus = useMemo<EdgeStatusMap>(() => {
    const map: EdgeStatusMap = {}
    for (const direction of assembleDirections(target, report)) {
      map[direction.key] = direction.status
    }
    return map
  }, [target, report])

  // §2.5-39① 迁移抽屉的数据源：besttree.migrationGroups（report.warns 的
  // container-misplaced），与旧 CodegraphPage 同一函数同一口径。
  const migrations = useMemo(
    () => (best ? migrationGroups(best, baseline, report) : []),
    [best, baseline, report],
  )

  const openScope = (nextId: string, label: string) => {
    setTrail((current) => [...current, { id: nextId, label }])
    setScopeId(nextId)
    setSelectedNodeId('')
  }

  const goRoot = () => {
    console.info('[codegraph] scope enter', { from: scopeId, to: null, organization })
    setScopeId(null)
    setTrail([])
    setSelectedNodeId('')
  }

  const goTrail = (index: number) => {
    if (index < 0) {
      goRoot()
      return
    }
    const next = trail[index]
    if (!next) return
    console.info('[codegraph] scope enter', { from: scopeId, to: next.id, via: 'breadcrumb', organization })
    setTrail(trail.slice(0, index + 1))
    setScopeId(next.id)
    setSelectedNodeId('')
  }

  const switchOrganization = (next: ScopeOrganization) => {
    console.info('[codegraph] scope organization select', { organization: next, scopeId })
    setOrganization(next)
    setSelectedNodeId('')
  }

  const handleSelectMigration = (item: MigrationItem) => {
    console.info('[codegraph] best migration select', {
      containerId: item.containerId,
      expectedDomainId: item.expectedDomainId,
      currentDomainId: item.currentDomainId,
    })
    setMigrationSelectedContainer(item.containerId)
  }

  const handleOpenEntry = (entryNodeId: string) => {
    console.info('[codegraph] entry open', { entryNodeId, scopeId, wired: onOpenEntry !== undefined })
    onOpenEntry?.(entryNodeId)
  }

  return (
    <section data-two-axis-page data-scope={scopeId ?? ''} data-organization={organization} className="relative flex min-h-0 flex-1 flex-col">
      <div data-page-header className="flex items-center gap-2 border-b px-3 py-1.5 text-sm">
        <nav data-breadcrumbs className="flex items-center gap-1.5">
          <button
            type="button"
            data-breadcrumb="root"
            onClick={goRoot}
            className="rounded px-1.5 py-0.5 font-semibold hover:bg-muted"
          >
            子系统连线图
          </button>
          {trail.map((entry, index) => (
            <span key={entry.id} className="inline-flex items-center gap-1.5">
              <span className="text-muted-foreground">▸</span>
              {index === trail.length - 1 ? (
                <b className="px-0.5">{entry.label}</b>
              ) : (
                <button
                  type="button"
                  data-breadcrumb={entry.id}
                  onClick={() => goTrail(index)}
                  className="rounded px-1 py-0.5 text-muted-foreground hover:bg-muted hover:underline"
                >
                  {entry.label}
                </button>
              )}
            </span>
          ))}
        </nav>
        <div data-organization-switch className="ml-auto flex items-center gap-1">
          {/* 组织切换是结构轴内部正交维度：绝不放进 role=tablist（§2.3-21） */}
          <button
            type="button"
            data-organization="best"
            disabled={!best}
            onClick={() => switchOrganization('best')}
            className={'rounded-full border px-2.5 py-0.5 text-xs hover:bg-muted '
              + (organization === 'best' ? 'bg-muted font-semibold outline outline-1 outline-primary' : '')}
          >
            按最优树
          </button>
          <button
            type="button"
            data-organization="current"
            onClick={() => switchOrganization('current')}
            className={'rounded-full border px-2.5 py-0.5 text-xs hover:bg-muted '
              + (organization === 'current' ? 'bg-muted font-semibold outline outline-1 outline-primary' : '')}
          >
            按现状领域
          </button>
        </div>
        <div data-migration-area className="relative inline-flex items-center">
          <MigrationDrawer
            groups={migrations}
            open={migrationOpen}
            onToggle={() => {
              console.info('[codegraph] migration drawer toggle', { open: !migrationOpen, count: migrations.reduce((sum, group) => sum + group.count, 0) })
              setMigrationOpen((open) => !open)
            }}
            selectedContainer={migrationSelectedContainer}
            onSelectContainer={handleSelectMigration}
          />
        </div>
      </div>

      <div className="relative flex min-h-0 flex-1">
        <div data-scope-banners className="pointer-events-none absolute left-3 top-3 z-30 flex flex-col gap-1.5">
          {model.empty.noDeclaration && scopeId !== null && (
            <div data-scope-empty="declaration" role="status" className="pointer-events-auto rounded-full border bg-background px-3 py-1 text-xs shadow-sm">
              本层职责未声明：写入 <code className="mx-0.5 font-mono">codegraph/domains/{scopeId}.json</code>
            </div>
          )}
          {model.empty.noEntities && (
            <div data-scope-empty="entities" role="status" className="pointer-events-auto rounded-full border bg-background px-3 py-1 text-xs shadow-sm">
              本层没有实体（modelKind=entity 的扫描事实）；若应有请检查扫描覆盖
            </div>
          )}
        </div>
        <ScopeCanvas
          model={model}
          edgeStatus={edgeStatus}
          selectedNodeId={selectedNodeId}
          onSelect={(id) => {
            console.info('[codegraph] scope card select', { scopeId, nodeId: id })
            setSelectedNodeId(id)
          }}
          onOpenScope={openScope}
        />
        <RightPanel model={model} selectedNodeId={selectedNodeId} onOpenEntry={handleOpenEntry} />
      </div>
    </section>
  )
}
