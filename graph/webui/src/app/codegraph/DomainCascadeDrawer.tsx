// DomainCascadeDrawer —— C1.10 领域级联调用链与源码窗口。
//
// 边界：只渲染 deriveDomainPage 生成的列模型；源码窗口必须复用既有
// fetchCodegraphSource，过期 effect 响应不得写入新的抽屉选择。
import { useEffect, useState } from 'react'
import { fetchCodegraphSource } from '../../api/client'
import type { CgGraph, CgSourceResp } from '../../api/types'
import type { DomainLane } from './domainpage'

export interface DomainCascadeDrawerProps {
  project: string
  baseline: CgGraph
  lane: DomainLane | null
  selectedNodeId: string
  onSelectNode: (id: string) => void
}

/**
 * 渲染选中泳道的四级调用链。
 * 参数：项目名、基线节点、当前泳道和选中节点；返回抽屉或空值。
 * 注意：源码异步响应以 effect 清理标记隔离，失败只显示错误，不保留旧成功窗口。
 */
export function DomainCascadeDrawer({ project, baseline, lane, selectedNodeId, onSelectNode }: DomainCascadeDrawerProps) {
  const [source, setSource] = useState<CgSourceResp | null>(null)
  const [sourceError, setSourceError] = useState('')
  const selected = baseline.nodes[selectedNodeId]

  useEffect(() => {
    if (!selected || !lane) {
      setSource(null)
      setSourceError('')
      return
    }
    let current = true
    console.info('[codegraph] cascade source start', { project, id: selectedNodeId, file: selected.file, line: selected.line })
    setSource(null)
    setSourceError('')
    fetchCodegraphSource(project, selected.file, selected.line, 40).then((next) => {
      if (current) {
        console.info('[codegraph] cascade source success', { project, id: selectedNodeId, lines: next.lines.length })
        setSource(next)
      }
    }).catch((err: unknown) => {
      if (current) {
        const message = err instanceof Error ? err.message : String(err)
        console.warn('[codegraph] cascade source failed', { project, id: selectedNodeId, file: selected.file, line: selected.line, error: message })
        setSourceError(message)
      }
    })
    return () => { current = false }
  }, [project, selected, selectedNodeId, lane])

  if (!lane) return null
  return (
    <aside data-cascade-drawer={lane.key} className="w-[340px] shrink-0 overflow-y-auto border-l p-3.5">
      {lane.columns.map((column) => (
        <section key={column.depth} data-testid={`cascade-column-${column.depth}`} data-cascade-column={column.depth}>
          {column.nodes.map((node) => (
            <button key={node.id} type="button" data-testid={`cascade-node-${node.id}`} data-cascade-node={node.id} data-selected={selectedNodeId === node.id ? 'true' : undefined} onClick={() => onSelectNode(node.id)}>
              {node.name}{node.collapsed ? ' · 共享工具，已收桩' : ''}
            </button>
          ))}
          {column.truncated ? <span data-cascade-truncated>本级已截断，丢弃 {column.droppedNodes} 个节点</span> : null}
          {column.depthLimit ? <p>再深是 CLI 的活：<code>codegraph chain --with-source</code></p> : null}
        </section>
      ))}
      {sourceError ? <p data-testid="source-error" data-source-error>源码读取失败：{sourceError}</p> : null}
      {source ? <pre data-testid="source-window" data-source-window>{source.lines.join('\n')}</pre> : null}
    </aside>
  )
}
