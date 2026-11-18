import test from 'node:test'
import assert from 'node:assert/strict'
import { FlowFieldData } from '../packages/sdk/src/internal/FlowFieldData.js'
import { createTidalEstuary } from '../packages/sdk/src/tidal-estuary.js'
import { Worker } from 'node:worker_threads'

function meshBuffer() {
  const mesh = new ArrayBuffer(108), head = new DataView(mesh)
  ;[0x46464d31, 4, 2, 2].forEach((v, i) => head.setUint32(i * 4, v, true))
  new Float32Array(mesh, 16, 12).set([120, 120.1, 120.1, 120, 30, 30, 30.1, 30.1, -5, -5, -5, -5])
  new Uint16Array(mesh, 64, 6).set([0, 1, 2, 0, 2, 3])
  new Uint16Array(mesh, 76, 8).set([0, 1, 2, 0, 0, 2, 3, 0])
  new Float32Array(mesh, 92, 4).set([120.066, 120.033, 30.033, 30.066])
  return mesh
}

function manifest(id, nFrames = 3, meshId = 'shared-mesh') {
  return {
    formatVersion: 2, scenarioId: id, sourceRunId: `src-${id}`,
    nNodes: 4, nCells: 2, nTris: 2, nFrames, bbox: [100, 0, 140, 40],
    scales: { level: .01, uv: .001 }, drySentinel: -32768,
    mesh: { meshId }, stats: { levelMin: -1, levelMax: 3, speedMax: 1.5 },
    frames: Array.from({ length: nFrames }, (_, i) => ({
      index: i, validTime: `2026-10-25T00:${String(i * 5).padStart(2, '0')}:00+08:00`, file: `f/${i}.bin`
    }))
  }
}

function makeFrames(n) {
  return Array.from({ length: n }, (_, i) => new Int16Array([100 + i * 50, 200 + i * 50, 1000 + i * 500, 500 + i * 250, i * 200, 0]).buffer)
}

// 布局 [lvl0,lvl1, u0,u1, v0,v1]；f0 cell0 湿/cell1 干，f1 相反，f2 cell0 零流速
const SERIES_FRAMES = [
  [100, -32768, 1000, 0, 0, 0],
  [-32768, 200, 0, 500, 0, 0],
  [200, 300, 0, 1500, 0, 0]
]

function fixture({ id = 'data-a', nFrames = 3, frames, querySeries } = {}) {
  const m = manifest(id, nFrames)
  const mesh = meshBuffer()
  const buffers = (frames ?? makeFrames(nFrames)).map(raw => raw instanceof ArrayBuffer ? raw : new Int16Array(raw).buffer)
  const calls = []
  const provider = {
    calls,
    async getMesh() { return mesh.slice(0) },
    async getFrame(_m, i, { signal } = {}) { signal?.throwIfAborted(); calls.push(i); return buffers[i].slice(0) },
    ...(querySeries ? { querySeries } : {})
  }
  return { m, mesh, frames: buffers, provider, calls }
}

function slowProvider(f, delay = 8) {
  return {
    ...f.provider,
    getFrame: (m, i, { signal } = {}) => new Promise((resolve, reject) => {
      f.calls.push(i)
      const timer = setTimeout(() => resolve(f.frames[i].slice(0)), delay)
      signal?.addEventListener('abort', () => { clearTimeout(timer); reject(new DOMException('Aborted', 'AbortError')) }, { once: true })
    })
  }
}

const waitFor = async (condition, timeout = 3000) => {
  const deadline = Date.now() + timeout
  while (!condition()) {
    if (Date.now() > deadline) throw new Error('waitFor timeout')
    await new Promise(r => setTimeout(r, 5))
  }
}

const tidalProfile = () => createTidalEstuary({ profile: { id: 't', polygon: [[119, 29], [121, 29], [121, 31], [119, 31]], seaward: 'east' } }).profile

test('shared meshId reuses the mesh buffer without a second getMesh', async () => {
  const f = fixture({ id: 'reuse-a' })
  let meshCalls = 0
  const provider = { ...f.provider, getMesh: async () => { meshCalls++; return f.mesh.slice(0) } }
  const a = await FlowFieldData.load(provider, f.m, { worker: false })
  const b = await FlowFieldData.load(provider, manifest('reuse-b'), { worker: false, reuse: a })
  assert.equal(meshCalls, 1)
  assert.equal(b._meshBuffer, a._meshBuffer)
  const c = await FlowFieldData.load(provider, manifest('reuse-c', 3, 'other-mesh'), { worker: false, reuse: b })
  assert.equal(meshCalls, 2)
  a.destroy(); b.destroy(); c.destroy()
})

test('sampleValues covers interpolation, dry cells, transitions and zero speed', async () => {
  const f = fixture({ frames: SERIES_FRAMES })
  const data = await FlowFieldData.load(f.provider, f.m, { worker: false })
  const mk = (l0, l1, u0, u1, v0, v1) => new Int16Array([l0, l1, u0, u1, v0, v1])
  const DRY = -32768

  const both = data.sampleValues(0, 0.5, mk(100, 0, 1000, 0, 0, 0), mk(300, 0, 3000, 0, 6000, 0))
  assert.equal(both.wet, true)
  assert.equal(both.wetTransition, false)
  assert.ok(Math.abs(both.level - 2) < 1e-9)
  assert.ok(Math.abs(both.u - 2) < 1e-9)
  assert.ok(Math.abs(both.v - 3) < 1e-9)
  assert.ok(Math.abs(both.speed - Math.hypot(2, 3)) < 1e-6)
  assert.ok(Math.abs(both.dirDeg - 33.6900675) < 1e-4)

  const transition = data.sampleValues(0, 0.5, mk(DRY, 0, 0, 0, 0, 0), mk(200, 0, 500, 0, 0, 0))
  assert.equal(transition.wet, true)
  assert.equal(transition.wetTransition, true)
  assert.ok(Math.abs(transition.level - 2) < 1e-9)
  assert.ok(Math.abs(transition.u - 0.5) < 1e-9)
  assert.ok(Math.abs(transition.speed - 0.5) < 1e-6)

  const bothDry = data.sampleValues(0, 0.5, mk(DRY, 0, 0, 0, 0, 0), mk(DRY, 0, 0, 0, 0, 0))
  assert.equal(bothDry.wet, false)
  for (const key of ['level', 'u', 'v', 'speed', 'dirDeg']) assert.equal(bothDry[key], null)

  const zero = data.sampleValues(0, 0.5, mk(100, 0, 0, 0, 0, 0), mk(300, 0, 0, 0, 0, 0))
  assert.equal(zero.wet, true)
  assert.equal(zero.speed, 0)
  assert.equal(zero.dirDeg, null)

  const dryValue = data.cellValue(0, 1)
  assert.equal(dryValue.wet, false)
  for (const key of ['level', 'u', 'v']) assert.equal(dryValue[key], null)
  data.destroy()
})

test('series provider and frames fallback produce identical point structures', async () => {
  const m = manifest('series-a', 3)
  const querySeries = async (_m, cell) => ({
    points: [
      { frameIndex: 0, validTime: m.frames[0].validTime, wet: true, level: 100 * .01, u: 1000 * .001, v: 0 },
      { frameIndex: 1, validTime: m.frames[1].validTime, wet: false, level: 9, u: 9, v: 9 },
      { frameIndex: 2, validTime: m.frames[2].validTime, wet: true, level: 200 * .01, u: 0, v: 0 }
    ]
  })
  const withProvider = fixture({ id: 'series-a', frames: SERIES_FRAMES, querySeries })
  const withoutProvider = fixture({ id: 'series-a', frames: SERIES_FRAMES })
  const a = await FlowFieldData.load(withProvider.provider, m, { worker: false })
  const b = await FlowFieldData.load(withoutProvider.provider, m, { worker: false })
  const remote = await a.series(0)
  const local = await b.series(0)
  assert.equal(remote.source, 'provider')
  assert.equal(local.source, 'frames')
  assert.equal(remote.scenarioId, 'series-a')
  assert.equal(remote.cellIndex, 0)
  assert.deepEqual(remote.points, local.points)
  assert.deepEqual(remote.points.map(p => Object.keys(p).sort()), local.points.map(p => Object.keys(p).sort()))
  const dry = remote.points[1]
  assert.equal(dry.dry, true)
  for (const key of ['level', 'u', 'v', 'speed', 'dirDeg']) assert.equal(dry[key], null)
  assert.equal(remote.points[2].dirDeg, null)
  assert.equal(remote.points[0].validTime, '2026-10-24T16:00:00.000Z')
  a.destroy(); b.destroy()
})

async function cancelScenario(loadOptions) {
  const f = fixture({ id: 'tidal-x', nFrames: 5 })
  const slow = slowProvider(f, 8)
  const progress = []
  const data = await FlowFieldData.load(slow, f.m, { ...loadOptions, profile: tidalProfile(), onProgress: p => progress.push(p) })
  f.calls.length = 0
  const controller = new AbortController()
  const pending = data.tidalFrontFrame(4, { signal: controller.signal })
  await waitFor(() => progress.some(p => p.phase === 'history'), 3000)
  controller.abort()
  await assert.rejects(pending, error => error.name === 'AbortError')
  const settled = f.calls.length
  await new Promise(r => setTimeout(r, 80))
  assert.equal(f.calls.length, settled, 'frame requests must stop after cancel')
  assert.ok(settled < 3, `expected cancellation before all history frames, got ${settled} fetches`)
  assert.ok(progress.filter(p => p.phase === 'history').length >= 1)
  data.destroy()
}

test('tidal history cancel stops frame requests on the main-thread path', async () => {
  await cancelScenario({ worker: false })
})

test('tidal history cancel stops frame requests through the worker path', async () => {
  const workerFactory = () => {
    const url = new URL('../packages/sdk/src/internal/flowFieldWorker.js', import.meta.url).href
    const worker = new Worker(`const {parentPort}=require('node:worker_threads'); globalThis.self={postMessage:(...args)=>parentPort.postMessage(...args)}; import(${JSON.stringify(url)}).then(()=>parentPort.on('message',data=>self.onmessage({data})));`, { eval: true })
    const wrapper = { postMessage: (...args) => worker.postMessage(...args), terminate: () => worker.terminate(), onmessage: null, onerror: null }
    worker.on('message', data => wrapper.onmessage?.({ data }))
    worker.on('error', error => wrapper.onerror?.(error))
    return wrapper
  }
  await cancelScenario({ workerFactory })
})

test('tidal history output is deterministic across cancel-and-continue', async () => {
  const f1 = fixture({ id: 'det-a', nFrames: 5 })
  const f2 = fixture({ id: 'det-b', nFrames: 5 })
  const a = await FlowFieldData.load(slowProvider(f1, 6), f1.m, { worker: false, profile: tidalProfile() })
  const progress = []
  const b = await FlowFieldData.load(slowProvider(f2, 6), f2.m, { worker: false, profile: tidalProfile(), onProgress: p => progress.push(p) })
  const expected = await a.tidalFrontFrame(4)
  const controller = new AbortController()
  const first = b.tidalFrontFrame(4, { signal: controller.signal })
  await waitFor(() => progress.some(p => p.phase === 'history'), 3000)
  controller.abort()
  await assert.rejects(first, error => error.name === 'AbortError')
  const resumed = await b.tidalFrontFrame(4)
  assert.deepEqual(resumed, expected)
  a.destroy(); b.destroy()
})

test('worker crash during aggregate falls back to main thread with a single warning', async () => {
  const warnings = []
  const workerFactory = () => {
    const wrapper = {
      postMessage(message) {
        if (message.type === 'aggregate') queueMicrotask(() => wrapper.onerror?.({ message: 'Worker crashed' }))
      },
      terminate() { },
      onmessage: null, onerror: null
    }
    return wrapper
  }
  const f = fixture({ id: 'crash' })
  const reference = fixture({ id: 'crash' })
  const data = await FlowFieldData.load(f.provider, f.m, { workerFactory, onWarning: w => warnings.push(w) })
  const plain = await FlowFieldData.load(reference.provider, reference.m, { worker: false })
  assert.deepEqual(await data.nodeFrame(0), await plain.nodeFrame(0))
  assert.equal(data.workerMode, 'main-thread')
  assert.equal(warnings.filter(w => w.code === 'WORKER_FALLBACK').length, 1)
  data.destroy(); plain.destroy()
})

test('tiny tidalHistoryBudgetMB disables tidal computation but the scenario still loads', async () => {
  const warnings = []
  const f = fixture({ id: 'budget', nFrames: 5 })
  const data = await FlowFieldData.load(f.provider, f.m, {
    worker: false, profile: tidalProfile(), tidalHistoryBudgetMB: 0.00001,
    onWarning: w => warnings.push(w)
  })
  assert.ok(warnings.some(w => w.code === 'TIDAL_DISABLED_BUDGET'))
  assert.deepEqual(data.tidalAvailability, { available: false, reason: 'memory-budget' })
  assert.equal((await data.frame(0)).length, 6)
  await assert.rejects(data.tidalFrontFrame(0), error => error.code === 'DATA_UNAVAILABLE')
  data.destroy()
})
