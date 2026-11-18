import { FlowError, isFlowError, toFlowError } from './errors.js'
import { normalizeScenario, normalizeSeriesResult, selectionId } from './internal/normalize.js'

const DEFAULT_RETRY = Object.freeze({ retries: 2, baseDelayMs: 300, maxDelayMs: 3000 })
const abortError = () => new DOMException('Operation aborted', 'AbortError')

function absolute(url) {
  return new URL(url, typeof location === 'undefined' ? undefined : location.href).href
}

function retryPolicy(retry) {
  if (retry === false) return null
  if (retry === undefined || retry === null) return { ...DEFAULT_RETRY }
  return { ...DEFAULT_RETRY, ...retry }
}

function retryDelay(policy, attempt) {
  return Math.min(policy.maxDelayMs, policy.baseDelayMs * 2 ** attempt) * (0.8 + 0.4 * Math.random())
}

function waitAbortable(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(abortError()); return }
    const timer = setTimeout(() => { signal?.removeEventListener('abort', onAbort); resolve() }, ms)
    const onAbort = () => { clearTimeout(timer); reject(abortError()) }
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

function statusToCode(status, notFoundCode) {
  if (status === 401) return 'AUTH_REQUIRED'
  if (status === 403) return 'FORBIDDEN'
  if (status === 404) return notFoundCode
  if (status === 408) return 'TIMEOUT'
  if (status === 429 || status >= 500) return 'SERVICE_ERROR'
  return 'DATA_UNAVAILABLE'
}

function isRetryable(error) {
  if (error?.code === 'NETWORK_ERROR' || error?.code === 'TIMEOUT') return true
  const status = error?.status
  return status === 408 || status === 429 || (Number.isFinite(status) && status >= 500)
}

async function httpError(response, notFoundCode, operation) {
  let detail = ''
  try {
    const readable = typeof response.clone === 'function' ? response.clone() : response
    const body = await readable.json()
    if (typeof body?.message === 'string' && body.message) detail = `：${body.message}`
  } catch { /* 错误体无法解析时忽略 */ }
  return new FlowError(statusToCode(response.status, notFoundCode), `请求失败（HTTP ${response.status}）${detail}`, { status: response.status, operation })
}

async function consumeJson(response) {
  const body = await response.json()
  if (body && typeof body === 'object' && Object.hasOwn(body, 'code')) {
    if (body.code !== 0) {
      const detail = typeof body.message === 'string' && body.message ? `：${body.message}` : ''
      throw new FlowError('SERVICE_ERROR', `服务返回错误码 ${body.code}${detail}`, { recoverable: false })
    }
    return body.data
  }
  return body
}

async function consumeBinary(response) {
  let buffer = await response.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  // .gz 资源可能原样返回或带 Content-Encoding: gzip；魔数识别，解压失败回退原始字节。
  if (bytes.length > 2 && bytes[0] === 0x1f && bytes[1] === 0x8b) {
    try {
      buffer = await new Response(new Blob([buffer]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer()
    } catch { /* 保留原始字节 */ }
  }
  return buffer
}

async function fetchWithRetry(request, url, { signal, timeoutMs, retry, stats, kind, consume, operation }) {
  const policy = retryPolicy(retry)
  const attempts = policy ? policy.retries + 1 : 1
  const notFoundCode = kind === 'manifest' ? 'SCENARIO_NOT_FOUND' : 'DATA_UNAVAILABLE'
  for (let attempt = 0; attempt < attempts; attempt++) {
    if (signal?.aborted) throw abortError()
    stats.requests++
    const timeout = AbortSignal.timeout(timeoutMs)
    const combined = signal ? AbortSignal.any([signal, timeout]) : timeout
    try {
      const response = await request(url, { signal: combined })
      if (signal?.aborted) throw abortError()
      if (!response.ok) throw await httpError(response, notFoundCode, operation)
      const value = await consume(response)
      if (timeout.aborted) throw new FlowError('TIMEOUT', `请求超时（${timeoutMs}ms）`, { operation })
      signal?.throwIfAborted()
      return value
    } catch (error) {
      if (signal?.aborted) throw abortError()
      const mapped = isFlowError(error) ? error
        : timeout.aborted ? new FlowError('TIMEOUT', `请求超时（${timeoutMs}ms）`, { operation })
        : toFlowError(error, operation, 'NETWORK_ERROR')
      if (!isRetryable(mapped) || attempt === attempts - 1) {
        stats.failures++
        throw mapped
      }
      stats.retries++
      await waitAbortable(retryDelay(policy, attempt), signal)
    }
  }
}

function makeRequester({ request, retry, timeoutMs }) {
  const stats = { requests: 0, retries: 0, failures: 0 }
  return {
    getStats: () => ({ ...stats }),
    call: (url, { signal, kind = 'data', consume, operation }) =>
      fetchWithRetry(request, url, { signal, timeoutMs, retry, stats, kind, consume, operation })
  }
}

function scenarioList(body) {
  const list = Array.isArray(body) ? body
    : Array.isArray(body?.scenarios) ? body.scenarios
    : Array.isArray(body?.items) ? body.items : null
  if (!list) throw new FlowError('DATA_UNAVAILABLE', '场景列表格式无效')
  return list.map(normalizeScenario)
}

export function createHttpProvider({ baseUrl, request = globalThis.fetch, retry, timeoutMs = 30000 } = {}) {
  if (!baseUrl || typeof request !== 'function') throw new FlowError('INVALID_ARGUMENT', 'baseUrl 和 fetch 兼容的 request 是必需的')
  const base = absolute(baseUrl).replace(/\/+$/, '')
  const { call, getStats } = makeRequester({ request, retry, timeoutMs })
  const route = id => `${base}/api/v1/scenarios/${encodeURIComponent(id)}`
  return {
    getStats,
    listScenarios: (context = {}) => call(`${base}/api/v1/scenarios`, { ...context, kind: 'data', consume: consumeJson, operation: 'scenarios' }).then(scenarioList),
    loadManifest: (selection = {}, context = {}) => call(`${route(selectionId(selection))}/manifest`, { ...context, kind: 'manifest', consume: consumeJson, operation: 'manifest' }),
    getMesh: (m, context = {}) => call(`${base}/api/v1/meshes/${encodeURIComponent(m.mesh.meshId)}`, { ...context, kind: 'data', consume: consumeBinary, operation: 'mesh' }),
    getFrame: (m, index, context = {}) => call(`${route(m.scenarioId)}/frames/${index}`, { ...context, kind: 'data', consume: consumeBinary, operation: 'frame' }),
    querySeries: (m, cell, context = {}) => call(`${route(m.scenarioId)}/cells/${cell}/series`, { ...context, kind: 'data', consume: consumeJson, operation: 'series' })
      .then(body => normalizeSeriesResult(body, { scenarioId: m.scenarioId, cellIndex: cell }))
  }
}

export function createStaticProvider({ manifestUrl, request = globalThis.fetch, retry, timeoutMs = 30000 } = {}) {
  if (!manifestUrl || typeof request !== 'function') throw new FlowError('INVALID_ARGUMENT', 'manifestUrl 和 fetch 兼容的 request 是必需的')
  const url = absolute(manifestUrl)
  const { call, getStats } = makeRequester({ request, retry, timeoutMs })
  const load = async (selection = {}, context = {}) => {
    const manifest = await call(url, { ...context, kind: 'manifest', consume: consumeJson, operation: 'manifest' })
    const requested = selectionId(selection)
    if (requested !== 'latest') {
      const accepted = new Set()
      for (const candidate of [manifest?.scenarioId ?? manifest?.sourceRunId, manifest?.sourceRunId]) {
        if (candidate !== undefined && candidate !== null) accepted.add(String(candidate))
      }
      if (!accepted.has(requested)) throw new FlowError('SCENARIO_NOT_FOUND', `未知静态场次: ${requested}`, { scenarioId: requested })
    }
    return { ...manifest, scenarioId: manifest?.scenarioId ?? manifest?.sourceRunId }
  }
  return {
    getStats,
    loadManifest: load,
    async listScenarios(context = {}) {
      const m = await load({}, context)
      return [normalizeScenario({
        id: m.scenarioId, sourceRunId: m.sourceRunId, name: m.scenarioName,
        startTime: m.frames?.[0]?.validTime, endTime: m.frames?.at(-1)?.validTime,
        frameCount: m.nFrames, meshId: m.mesh?.meshId, publishedAt: m.publishedAt
      })]
    },
    getMesh: (m, context = {}) => call(new URL(m.mesh.file, url).href, { ...context, kind: 'data', consume: consumeBinary, operation: 'mesh' }),
    getFrame: (m, index, context = {}) => call(new URL(m.frames[index].file, url).href, { ...context, kind: 'data', consume: consumeBinary, operation: 'frame' })
  }
}
