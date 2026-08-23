// useCodegraph —— 按 URL project 一次性取代码图；不轮询、不写本地状态。
import { useCallback, useEffect, useState } from 'react'
import { fetchCodegraph } from '../../api/client'
import type { CodegraphResp } from '../../api/types'

export function useCodegraph(project: string) {
  const [data, setData] = useState<CodegraphResp | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const reload = useCallback(() => {
    if (!project) {
      console.info('[codegraph] skip fetch', { project, reason: 'empty-project' })
      return
    }
    console.info('[codegraph] fetch start', { project })
    setLoading(true)
    setError('')
    fetchCodegraph(project)
      .then((next) => {
        console.info('[codegraph] fetch success', { project, views: Object.keys(next.views).length, stale: next.stale.length })
        setData(next)
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err)
        console.warn('[codegraph] fetch failed', { project, error: message })
        setData(null)
        setError(message)
      })
      .finally(() => setLoading(false))
  }, [project])
  useEffect(reload, [reload])
  return { data, error, loading, reload }
}
