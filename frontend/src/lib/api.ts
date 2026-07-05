/**
 * lib/api.ts — shared HTTP helpers for the operator UI.
 *
 * Kept minimal: same-origin fetch, JSON bodies. Errors are logged and swallowed
 * so a failed control action never crashes the UI.
 */

export function post(path: string, body?: object): Promise<Response> {
  return fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
}

export function patch(path: string, body: object): Promise<Response> {
  return fetch(path, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

export function del(path: string): Promise<Response> {
  return fetch(path, { method: 'DELETE' })
}

export interface BulkResult {
  id: string
  ok: boolean
  error?: string
}

export interface BulkResponse {
  ok: boolean
  total: number
  okCount: number
  results: BulkResult[]
}

/**
 * Apply one control op to a group of cameras via POST /api/cameras/bulk.
 * `ids` is an explicit list or "all". Returns the per-camera result payload,
 * or null on a transport error.
 */
export async function bulk(
  op: string,
  params: object,
  ids: string[] | 'all',
): Promise<BulkResponse | null> {
  try {
    const r = await post('/api/cameras/bulk', { ids, op, params })
    return (await r.json()) as BulkResponse
  } catch (e) {
    console.error('[bulk] error', e)
    return null
  }
}
