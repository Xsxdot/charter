// MigrationDrawer —— 迁移清单按需抽屉（§2.5-39①：常驻左栏改抽屉 + 计数徽标）。
//
// 职责：渲染触发钮（恒在，带待迁移计数徽标）与抽屉体（默认收起，open 时按应然
// 领域分组的迁移条目）。
// 边界：数据由装配层传入（besttree.migrationGroups 的结果），本组件不改图数据、
// 不发起请求；点击条目只回调原始 MigrationItem。动画细节归真机走查，机内只锁
// 开合状态与徽标数值的 DOM 契约。
import type { JSX } from 'react'
import type { MigrationGroup, MigrationItem } from './besttree'

export interface MigrationDrawerProps {
  groups: MigrationGroup[]
  open: boolean
  onToggle: () => void
  selectedContainer: string
  onSelectContainer: (item: MigrationItem) => void
}

export function MigrationDrawer({ groups, open, onToggle, selectedContainer, onSelectContainer }: MigrationDrawerProps): JSX.Element {
  const total = groups.reduce((sum, group) => sum + group.count, 0)
  return (
    <>
      <button
        type="button"
        data-migration-trigger
        aria-expanded={open}
        onClick={onToggle}
        className="inline-flex items-center gap-1.5 rounded-full border bg-background px-2.5 py-0.5 text-xs hover:bg-muted"
      >
        迁移清单
        <span data-migration-count className="rounded-full bg-amber-100 px-1.5 text-[10.5px] font-semibold text-amber-800">
          {total}
        </span>
      </button>
      {open && (
        <aside data-migration-drawer className="absolute left-3 top-12 z-40 max-h-[70%] w-[300px] overflow-y-auto rounded-xl border bg-background p-3 text-sm shadow-lg">
          <h3 className="mb-2 font-semibold">迁移清单（现在在 → 应归）</h3>
          {groups.length ? groups.map((group) => (
            <section key={group.expectedDomainId} data-migration-group={group.expectedDomainId} className="mb-3">
              <div className="mb-1 text-xs font-semibold">{group.expectedDomainLabel} · {group.count}</div>
              <div className="space-y-0.5">
                {group.items.map((item) => (
                  <button
                    key={item.containerId}
                    type="button"
                    data-migration-item={item.containerId}
                    data-selected={selectedContainer === item.containerId ? 'true' : undefined}
                    onClick={() => onSelectContainer(item)}
                    className={'block w-full truncate rounded px-2 py-1 text-left text-xs hover:bg-muted '
                      + (selectedContainer === item.containerId ? 'bg-muted outline outline-1 outline-primary' : '')}
                  >
                    {item.containerLabel} · 现在在 {item.currentDomainLabel} → 应归 {item.expectedDomainLabel}
                  </button>
                ))}
              </div>
            </section>
          )) : <div data-migration-none className="text-xs text-muted-foreground">无待迁移件</div>}
        </aside>
      )}
    </>
  )
}
