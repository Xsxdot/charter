// client.ts —— codegraph viewer 的两条同源只读请求。
// 边界：不持有 token/cookie，不拼 host，不添加超时、重试或轮询。
import type { CgSourceResp, CodegraphResp } from './types'

class ApiError extends Error {
  readonly status: number
  readonly body: unknown

  constructor(status: number, message: string, body?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.body = body
  }
}

async function bodyOrError(resp: Response): Promise<{ detail: string; body: unknown }> {
  try {
    const body = (await resp.json()) as { error?: string }
    return { detail: body.error ?? '', body }
  } catch {
    return { detail: '', body: undefined }
  }
}

async function parseResponse<T>(path: string, resp: Response): Promise<T> {
  if (resp.status === 401) {
    console.warn('[codegraph] response unauthorized', { path, status: resp.status })
    throw new ApiError(401, '未授权：浏览器会话已失效，请重新执行 handoff console 兑换 cookie')
  }
  if (!resp.ok) {
    const { detail, body } = await bodyOrError(resp)
    console.warn('[codegraph] response failed', { path, status: resp.status, error: detail || resp.statusText })
    throw new ApiError(resp.status, detail || `agentd 返回 ${resp.status} ${resp.statusText}`, body)
  }
  const result = (await resp.json()) as T
  console.debug('[codegraph] response success', { path, status: resp.status })
  return result
}

async function request<T>(path: string): Promise<T> {
  console.debug('[codegraph] request', { path })
  let resp: Response
  try {
    resp = await fetch(path, { credentials: 'same-origin' })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.warn('[codegraph] transport failed', { path, error: message })
    throw new ApiError(0, `无法连接 agentd（反代失败？）：${message}`)
  }
  return parseResponse<T>(path, resp)
}

/** fetchCodegraph 获取项目的基线、全部 diff 视图与保鲜报告。 */
export function fetchCodegraph(project: string): Promise<CodegraphResp> {
  return request<CodegraphResp>(`/api/projects/${encodeURIComponent(project)}/codegraph`)
}

/** fetchCodegraphSource 按节点 file:line 实时读取源码窗口。span 默认读取 40 行。 */
export function fetchCodegraphSource(project: string, file: string, line: number, span = 40): Promise<CgSourceResp> {
  return request<CgSourceResp>(
    `/api/projects/${encodeURIComponent(project)}/codegraph/source?file=${encodeURIComponent(file)}&line=${line}&span=${span}`,
  )
}
