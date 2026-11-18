import test from 'node:test'
import assert from 'node:assert/strict'
import { createHttpProvider, createStaticProvider } from '../packages/sdk/src/providers.js'
import { FlowError, isFlowError } from '../packages/sdk/src/errors.js'

const FAST_RETRY = { retries: 2, baseDelayMs: 1, maxDelayMs: 2 }
const http = (request, options = {}) => createHttpProvider({ baseUrl: 'https://example.test', request, retry: FAST_RETRY, ...options })

test('HTTP 503 retries twice then succeeds; stats track requests/retries/failures', async () => {
  let count = 0
  const provider = http(async () => {
    count++
    if (count < 3) return new Response(JSON.stringify({ message: 'busy' }), { status: 503 })
    return Response.json({ scenarioId: 'run-a' })
  })
  const manifest = await provider.loadManifest({ scenarioId: 'run-a' })
  assert.equal(manifest.scenarioId, 'run-a')
  assert.equal(count, 3)
  assert.deepEqual(provider.getStats(), { requests: 3, retries: 2, failures: 0 })
})

test('HTTP 404 on manifest is SCENARIO_NOT_FOUND and never retried', async () => {
  let count = 0
  const provider = http(async () => { count++; return new Response(JSON.stringify({ message: 'missing' }), { status: 404 }) })
  await assert.rejects(provider.loadManifest({ scenarioId: 'nope' }), error => {
    assert.ok(isFlowError(error))
    assert.equal(error.code, 'SCENARIO_NOT_FOUND')
    assert.equal(error.status, 404)
    assert.equal(error.recoverable, false)
    return true
  })
  assert.equal(count, 1)
  assert.equal(provider.getStats().failures, 1)
})

test('HTTP 404 on frame data maps to DATA_UNAVAILABLE', async () => {
  const provider = http(async () => new Response('nf', { status: 404 }))
  const manifest = { scenarioId: 's', mesh: { meshId: 'm' } }
  await assert.rejects(provider.getFrame(manifest, 0), error => error.code === 'DATA_UNAVAILABLE' && error.status === 404)
  await assert.rejects(provider.getMesh(manifest), error => error.code === 'DATA_UNAVAILABLE')
})

test('HTTP 401 maps to AUTH_REQUIRED without retry', async () => {
  let count = 0
  const provider = http(async () => { count++; return new Response('{}', { status: 401 }) })
  await assert.rejects(provider.loadManifest(), error => error.code === 'AUTH_REQUIRED' && isFlowError(error))
  assert.equal(count, 1)
})

test('request exceeding timeoutMs produces TIMEOUT', async () => {
  const request = (url, { signal } = {}) => new Promise((_, reject) => {
    signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true })
  })
  const provider = http(request, { timeoutMs: 20, retry: false })
  await assert.rejects(provider.loadManifest(), error => error.code === 'TIMEOUT' && isFlowError(error))
  assert.equal(provider.getStats().requests, 1)
})

test('aborting during retry backoff rejects with AbortError', async () => {
  const provider = http(async () => new Response('busy', { status: 503 }), { retry: { retries: 5, baseDelayMs: 200, maxDelayMs: 1000 } })
  const controller = new AbortController()
  const pending = provider.loadManifest({}, { signal: controller.signal })
  await new Promise(resolve => setTimeout(resolve, 30))
  controller.abort()
  await assert.rejects(pending, error => error.name === 'AbortError')
})

test('retry:false issues exactly one request for a retryable failure', async () => {
  let count = 0
  const provider = http(async () => { count++; return new Response('busy', { status: 503 }) }, { retry: false })
  await assert.rejects(provider.loadManifest(), error => error.code === 'SERVICE_ERROR')
  assert.equal(count, 1)
})

test('fetch TypeError becomes NETWORK_ERROR and is retried', async () => {
  let count = 0
  const provider = http(async () => {
    count++
    if (count < 2) throw new TypeError('fetch failed')
    return Response.json({ ok: true })
  })
  await provider.loadManifest()
  assert.equal(count, 2)
  assert.equal(provider.getStats().retries, 1)
})

test('scenario selection routes latest, scenarioId, sourceRunId and legacy latest', async () => {
  const urls = []
  const provider = http(async url => { urls.push(String(url)); return Response.json({ scenarioId: 'x' }) }, { retry: false })
  await provider.loadManifest()
  await provider.loadManifest({ scenarioId: 'run a' })
  await provider.loadManifest({ sourceRunId: 'src-1' })
  await provider.loadManifest({ sourceRunId: 'latest' })
  assert.ok(urls[0].endsWith('/api/v1/scenarios/latest/manifest'))
  assert.ok(urls[1].endsWith('/api/v1/scenarios/run%20a/manifest'))
  assert.ok(urls[2].endsWith('/api/v1/scenarios/src-1/manifest'))
  assert.ok(urls[3].endsWith('/api/v1/scenarios/latest/manifest'))
})

test('listScenarios normalizes entries to the public shape', async () => {
  const provider = http(async () => Response.json([{
    id: 'a', sourceRunId: 's', scenarioName: '场景A',
    startTime: '2026-01-01T00:00:00Z', endTime: '2026-01-01T01:00:00Z',
    nFrames: 3, mesh: { meshId: 'm1' }, publishedAt: '2026-01-02T00:00:00Z'
  }]), { retry: false })
  const list = await provider.listScenarios()
  assert.deepEqual(list, [{
    id: 'a', sourceRunId: 's', name: '场景A',
    startTime: '2026-01-01T00:00:00.000Z', endTime: '2026-01-01T01:00:00.000Z',
    frameCount: 3, meshId: 'm1', publishedAt: '2026-01-02T00:00:00Z'
  }])
})

test('querySeries normalizes wet/dry/zero-speed points to the shared shape', async () => {
  const points = [
    { frameIndex: 0, validTime: '2026-01-01T00:00:00Z', wet: true, level: 1.5, u: 3, v: 4 },
    { frameIndex: 1, validTime: '2026-01-01T00:05:00Z', wet: false, level: 9, u: 9, v: 9 },
    { frameIndex: 2, validTime: '2026-01-01T00:10:00Z', wet: true, level: 2, u: 0, v: 0 }
  ]
  const provider = http(async url => String(url).includes('/series')
    ? Response.json({ points }) : Response.json({}), { retry: false })
  const result = await provider.querySeries({ scenarioId: 's', mesh: { meshId: 'm' } }, 7)
  assert.equal(result.source, 'provider')
  assert.equal(result.scenarioId, 's')
  assert.equal(result.cellIndex, 7)
  assert.equal(result.points.length, 3)
  const keys = Object.keys(result.points[0]).sort()
  assert.deepEqual(keys, ['dirDeg', 'dry', 'frameIndex', 'level', 'speed', 'u', 'validTime', 'v'].sort())
  assert.equal(result.points[0].speed, 5)
  assert.ok(Math.abs(result.points[0].dirDeg - 36.86989765) < 1e-6)
  const dry = result.points[1]
  assert.equal(dry.dry, true)
  for (const key of ['level', 'u', 'v', 'speed', 'dirDeg']) assert.equal(dry[key], null)
  assert.equal(result.points[2].dirDeg, null)
})

test('static provider resolves manifest-relative assets and enforces selection', async () => {
  const manifest = {
    formatVersion: 2, scenarioId: 'static-a', sourceRunId: 'src', nFrames: 1,
    frames: [{ index: 0, validTime: '2026-01-01T00:00:00Z', file: 'f/0.bin' }],
    mesh: { meshId: 'm', file: 'm.bin' }
  }
  const urls = []
  const request = async url => {
    urls.push(String(url))
    if (String(url).endsWith('manifest.json')) return Response.json(manifest)
    return new Response(new Uint8Array([1, 2, 3, 4]).buffer)
  }
  const provider = createStaticProvider({ manifestUrl: 'https://cdn.test/data/manifest.json', request, retry: false })
  const m = await provider.loadManifest({ sourceRunId: 'static-a' })
  assert.equal(m.scenarioId, 'static-a')
  await provider.getMesh(m)
  await provider.getFrame(m, 0)
  assert.ok(urls.includes('https://cdn.test/data/m.bin'))
  assert.ok(urls.includes('https://cdn.test/data/f/0.bin'))
  const bySource = await provider.loadManifest({ sourceRunId: 'src' })
  assert.equal(bySource.scenarioId, 'static-a')
  await assert.rejects(provider.loadManifest({ scenarioId: 'other' }), error => error.code === 'SCENARIO_NOT_FOUND')
  const list = await provider.listScenarios()
  assert.equal(list[0].id, 'static-a')
  assert.equal(list[0].frameCount, 1)
})

test('binary consumer falls back to raw bytes for corrupt gzip payloads', async () => {
  const raw = new Uint8Array([0x1f, 0x8b, 0x00, 0x01, 0x02]).buffer
  const provider = createStaticProvider({
    manifestUrl: 'https://cdn.test/m.json',
    request: async () => new Response(raw), retry: false
  })
  const buffer = await provider.getMesh({ mesh: { file: 'x.bin' } })
  assert.equal(buffer.byteLength, 5)
})

test('JSON envelope code!=0 maps to non-recoverable SERVICE_ERROR', async () => {
  const provider = http(async () => Response.json({ code: 7, message: 'quota exceeded', data: null }), { retry: false })
  await assert.rejects(provider.loadManifest(), error => {
    assert.equal(error.code, 'SERVICE_ERROR')
    assert.equal(error.recoverable, false)
    assert.match(error.message, /quota exceeded/)
    return true
  })
})

test('FlowError serializes to a stable JSON shape', () => {
  const error = new FlowError('TIMEOUT', '请求超时', { operation: 'frame', frame: 2 })
  assert.deepEqual(error.toJSON(), { code: 'TIMEOUT', message: '请求超时', recoverable: true, operation: 'frame', frame: 2 })
})

const VALID_MANIFEST = {
  formatVersion: 2, scenarioId: 's', nNodes: 4, nCells: 2, nTris: 2, nFrames: 1,
  bbox: [0, 0, 1, 1], scales: { level: 0.1, uv: 0.1 }, drySentinel: -32768,
  mesh: { meshId: 'm' }, frames: [{ index: 0, validTime: '2026-01-01T00:00:00Z' }]
}

test('validateManifest requires formatVersion 2 and emits FlowError codes', async () => {
  const { validateManifest, mergeOptions, DEFAULT_OPTIONS } = await import('../packages/sdk/src/validation.js')
  assert.equal(validateManifest(VALID_MANIFEST), VALID_MANIFEST)
  assert.throws(() => validateManifest({ ...VALID_MANIFEST, formatVersion: 1 }),
    error => error.code === 'INVALID_MANIFEST' && isFlowError(error))
  assert.throws(() => validateManifest({ ...VALID_MANIFEST, nNodes: 70000 }),
    error => error.code === 'UNSUPPORTED_MESH')
  assert.throws(() => mergeOptions(DEFAULT_OPTIONS, { particles: 5 }),
    error => error.code === 'INVALID_ARGUMENT')
  assert.throws(() => mergeOptions(DEFAULT_OPTIONS, { visible: {} }),
    error => error.code === 'INVALID_ARGUMENT')
  assert.throws(() => mergeOptions(DEFAULT_OPTIONS, { particles: { count: {} } }),
    error => error.code === 'INVALID_ARGUMENT')
  assert.throws(() => mergeOptions(DEFAULT_OPTIONS, { bogus: 1 }),
    error => error.code === 'INVALID_ARGUMENT')
  const merged = mergeOptions(DEFAULT_OPTIONS, { particles: { count: 65536 } })
  assert.equal(merged.particles.count, 65536)
  assert.equal(merged.particles.lineWidth, 1)
})
