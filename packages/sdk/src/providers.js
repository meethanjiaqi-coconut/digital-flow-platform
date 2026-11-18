function absolute(url) {
  return new URL(url, typeof location === 'undefined' ? undefined : location.href).href
}
async function response(request, url, signal) {
  signal?.throwIfAborted()
  const res = await request(url, { signal })
  if (!res.ok) throw new Error(`Flow request failed: HTTP ${res.status} (${url})`)
  signal?.throwIfAborted()
  return res
}
async function json(request, url, signal) {
  const body = await (await response(request, url, signal)).json()
  signal?.throwIfAborted()
  if (body && Object.hasOwn(body, 'code')) {
    if (body.code !== 0) throw new Error(body.message || `Flow service error ${body.code}`)
    return body.data
  }
  return body
}
async function binary(request, url, signal) {
  let buffer = await (await response(request, url, signal)).arrayBuffer()
  signal?.throwIfAborted()
  const bytes = new Uint8Array(buffer)
  // Static servers may send .gz either raw or with Content-Encoding: gzip.
  if (bytes[0] === 0x1f && bytes[1] === 0x8b) {
    buffer = await new Response(new Blob([buffer]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer()
  }
  signal?.throwIfAborted()
  return buffer
}
export function createHttpProvider({ baseUrl, request = globalThis.fetch } = {}) {
  if (!baseUrl || typeof request !== 'function') throw new TypeError('baseUrl and fetch-compatible request are required')
  const base = absolute(baseUrl).replace(/\/+$/, '')
  const route = id => `${base}/api/v1/scenarios/${encodeURIComponent(id)}`
  return {
    listScenarios: ({ signal } = {}) => json(request, `${base}/api/v1/scenarios`, signal),
    loadManifest: ({ sourceRunId = 'latest' } = {}, { signal } = {}) => json(request, `${route(sourceRunId)}/manifest`, signal),
    getMesh: (m, { signal } = {}) => binary(request, `${base}/api/v1/meshes/${encodeURIComponent(m.mesh.meshId)}`, signal),
    getFrame: (m, index, { signal } = {}) => binary(request, `${route(m.scenarioId)}/frames/${index}`, signal),
    querySeries: (m, cell, { signal } = {}) => json(request, `${route(m.scenarioId)}/cells/${cell}/series`, signal)
  }
}
export function createStaticProvider({ manifestUrl, request = globalThis.fetch } = {}) {
  if (!manifestUrl || typeof request !== 'function') throw new TypeError('manifestUrl and fetch-compatible request are required')
  const url = absolute(manifestUrl)
  const load = async (selection = {}, { signal } = {}) => {
    const manifest = await json(request, url, signal)
    const id = manifest.scenarioId || manifest.sourceRunId
    if (selection.sourceRunId && selection.sourceRunId !== 'latest' && selection.sourceRunId !== id) throw new Error(`Unknown static scenario: ${selection.sourceRunId}`)
    return { ...manifest, scenarioId: id }
  }
  return {
    loadManifest: load,
    async listScenarios(context) {
      const m = await load({}, context)
      return [{id:m.scenarioId, sourceRunId:m.sourceRunId, name:m.scenarioName, startTime:m.frames[0].validTime, endTime:m.frames.at(-1).validTime, frameCount:m.nFrames}]
    },
    getMesh: (m, { signal } = {}) => binary(request, new URL(m.mesh.file, url), signal),
    getFrame: (m, index, { signal } = {}) => binary(request, new URL(m.frames[index].file, url), signal)
  }
}
