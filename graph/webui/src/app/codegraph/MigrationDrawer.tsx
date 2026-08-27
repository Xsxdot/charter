import type { ReactNode } from 'react'

export interface MigrationDrawerItem {
  id: string
  label: string
  current: string
  expected: string
}

export interface MigrationDrawerProps {
  items: MigrationDrawerItem[]
  open: boolean
  onToggle: () => void
  onSelect?: (id: string) => void
  children?: ReactNode
}

/** 按需打开迁移清单；常驻页面只显示计数徽标，不占结构轴画布。 */
export function MigrationDrawer({ items, open, onToggle, onSelect, children }: MigrationDrawerProps) {
  return (
    <>
      <button type="button" data-migration-trigger className="rounded border px-2 py-1 text-xs hover:bg-accent"
        onClick={onToggle} aria-expanded={open}>
        迁移清单 <span data-migration-count className="ml-1 rounded-full bg-amber-100 px-1.5 text-amber-800">{items.length}</span>
      </button>
      {open ? <aside data-migration-drawer className="absolute bottom-3 left-3 z-40 max-h-72 w-80 overflow-y-auto rounded-lg border bg-background p-3 text-xs shadow-lg">
        <div className="mb-2 flex items-center justify-between"><b>迁移清单</b><button type="button" className="rounded border px-1.5 py-0.5" onClick={onToggle}>收起</button></div>
        {items.length ? <div className="space-y-1">{items.map((item) => <button type="button" key={item.id} data-migration-item={item.id}
          className="block w-full rounded border px-2 py-1 text-left hover:bg-muted" onClick={() => onSelect?.(item.id)}>
          <span className="font-mono">{item.label}</span><span className="ml-1 text-muted-foreground">{item.current} → {item.expected}</span>
        </button>)}</div> : <p data-migration-empty className="text-muted-foreground">没有待迁移容器</p>}
        {children}
      </aside> : null}
    </>
  )
}
