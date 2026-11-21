import test from 'node:test'
import assert from 'node:assert/strict'
import { createFlowField, FlowError, isFlowError } from '../packages/sdk/src/index.js'
import { FlowFieldData } from '../packages/sdk/src/internal/FlowFieldData.js'

const settle = () => new Promise(r => setTimeout(r, 0))
const sleep = ms => new Promise(r => setTimeout(r, ms))

function fixture() {
  const m = { formatVersion: 2, scenarioId: 'fixture', nNodes: 4, nCells: 2, nTris: 2, nFrames: 3, bbox: [100, 0, 140, 40], scales: { level: .01, uv: .001 }, drySentinel: -32768, mesh: { meshId: 'test', file: 'mesh.bin.gz' }, frames: [0, 5, 15].map((minute, index) => ({ index, validTime: `2026-10-25T00:${String(minute).padStart(2, '0')}:00+08:00`, file: `frames/${index}.bin.gz` })) }
  const mesh = new ArrayBuffer(108), head = new DataView(mesh)
  ;[0x46464d31, 4, 2, 2].forEach((v, i) => head.setUint32(i * 4, v, true))
  new Float32Array(mesh, 16, 12).set([120, 120.1, 120.1, 120, 30, 30, 30.1, 30.1, -5, -5, -5, -5])
  new Uint16Array(mesh, 64, 6).set([0, 1, 2, 0, 2, 3])
  new Uint16Array(mesh, 76, 8).set([0, 1, 2, 0, 0, 2, 3, 0])
  new Float32Array(mesh, 92, 4).set([120.066, 120.033, 30.033, 30.066])
  const frames = [0, 1, 2].map(i => new Int16Array([100 + i * 100, 200 + i * 100, 1000 + i * 1000, 500 + i * 500, 0, 0]).buffer)
  const provider = {
    async loadManifest(selection = {}, { signal } = {}) { signal?.throwIfAborted(); return { ...m, scenarioId: selection.sourceRunId || m.scenarioId } },
    async getMesh(_manifest, { signal } = {}) { signal?.throwIfAborted(); return mesh.slice(0) },
    async getFrame(_manifest, i, { signal } = {}) { signal?.throwIfAborted(); return frames[i].slice(0) }
  }
  return { m, mesh, frames, provider }
}

function harness(setup = {}) {
  const f = fixture()
  const live = { mounts: 0, destroys: 0, attachCalls: 0, frames: [], times: [], contexts: [] }
  const renderer = {
    attach(context) {
      live.attachCalls++
      live.contexts.push(context)
      setup.onAttach?.(live.attachCalls, context)
      if (setup.attachFails?.has(live.attachCalls)) throw new Error('渲染器挂载失败')
      live.mounts++
      live.tick = context.onTick
      live.options = context.options
      return {
        setFrames(...args) { live.frames.push(args) },
        setTime(...args) { live.times.push(args) },
        setOptions(o) { live.options = o },
        requestRender() { },
        getCapabilities: setup.getCapabilities,
        resetTrails() { live.resetTrails = (live.resetTrails || 0) + 1 },
        destroy() { live.destroys++ },
        pick() { return { lon: 120.07, lat: 30.02 } }
      }
    }
  }
  const { attachFails, ...flowConfig } = setup
  return { ...f, live, flow: createFlowField({ provider: f.provider, renderer, worker: false, ...flowConfig }) }
}

function spyDataDestroy() {
  const original = FlowFieldData.prototype.destroy
  const counter = { count: 0 }
  FlowFieldData.prototype.destroy = function (...args) { counter.count++; return original.apply(this, args) }
  return { counter, restore: () => { FlowFieldData.prototype.destroy = original } }
}

test('播放中单帧瞬时失败后 play() 恢复重试，不再永久阻塞', async () => {
  const f = fixture()
  let fail = true
  const frame2Calls = []
  const provider = {
    ...f.provider,
    async getFrame(m, i, ctx) {
      ctx?.signal?.throwIfAborted()
      if (i === 2) { frame2Calls.push(1); if (fail) throw new Error('HTTP 502') }
      return f.provider.getFrame(m, i, ctx)
    }
  }
  const { flow, live } = harness({ provider, playback: { secondsPerFrame: .1 } })
  await flow.loadScenario()
  flow.play()
  let t = 0, sawError = null
  for (let i = 0; i < 40 && !sawError; i++) {
    live.tick(t); t += 100; await settle()
    sawError = flow.getState().error
  }
  assert.ok(sawError, '播放失败应记录 error')
  assert.equal(flow.getState().playing, false)
  assert.ok(isFlowError(Object.assign(new Error(), sawError)) || typeof sawError.code === 'string')
  const callsAtFailure = frame2Calls.length
  assert.ok(callsAtFailure >= 1, '失败帧应被请求过')
  for (let i = 0; i < 5; i++) { live.tick(t); t += 100; await settle() }
  assert.equal(frame2Calls.length, callsAtFailure, '失败后 tick 不应自动重试')
  fail = false
  flow.play()
  let maxDisplayed = -1
  for (let i = 0; i < 40; i++) {
    live.tick(t); t += 100; await settle()
    maxDisplayed = Math.max(maxDisplayed, flow.getState().displayedFrame)
    if (flow.getState().displayedFrame >= 1 && !flow.getState().error) break
  }
  const state = flow.getState()
  assert.ok(state.displayedFrame >= 1, `恢复后 displayedFrame 应越过 1，实际 ${state.displayedFrame}`)
  assert.equal(state.error, null)
  assert.ok(frame2Calls.length > callsAtFailure, '恢复后应重新请求失败帧')
  flow.destroy()
})

test('场次切换失败保留旧场次：数据失败回滚、attach 失败重挂旧会话', async () => {
  const spy = spyDataDestroy()
  try {
    const { flow, live, provider } = harness()
    const events = []
    for (const type of ['progress', 'scenariochange', 'ready', 'error']) {
      flow.on(type, payload => events.push({ type, payload }))
    }
    await flow.loadScenario({ sourceRunId: 'run-a' })
    assert.equal(flow.getState().scenarioId, 'run-a')
    assert.equal(live.mounts, 1)

    const realGetFrame = provider.getFrame.bind(provider)
    provider.getFrame = (m, i, ctx) => m.scenarioId === 'run-b'
      ? Promise.resolve(new ArrayBuffer(4))
      : realGetFrame(m, i, ctx)
    const countBefore = spy.counter.count
    await assert.rejects(flow.loadScenario({ sourceRunId: 'run-b' }),
      error => isFlowError(error) && error.code === 'INVALID_BINARY')
    assert.equal(spy.counter.count, countBefore + 1, '失败候选数据应销毁')
    let state = flow.getState()
    assert.equal(state.status, 'ready')
    assert.equal(state.scenarioId, 'run-a')
    assert.equal(state.switching, false)
    assert.equal(state.error?.code, 'INVALID_BINARY')
    assert.equal(live.mounts, 1, '失败切换不应产生新挂载')
    assert.ok(events.some(e => e.type === 'error' && e.payload?.code === 'INVALID_BINARY'))
    const q = await flow.queryAt({ lon: 120.07, lat: 30.02 })
    assert.equal(q.status, 'wet')
    await flow.seek('2026-10-25T00:05:00+08:00')
    assert.equal(flow.getState().displayedFrame, 1)

    provider.getFrame = realGetFrame
    events.length = 0
    const countBeforeSuccess = spy.counter.count
    await flow.loadScenario({ sourceRunId: 'run-b' })
    state = flow.getState()
    assert.equal(state.status, 'ready')
    assert.equal(state.scenarioId, 'run-b')
    assert.equal(live.mounts, 2)
    assert.equal(spy.counter.count, countBeforeSuccess + 1, '成功切换应销毁旧 FlowFieldData')
    assert.deepEqual(events.find(e => e.type === 'scenariochange')?.payload, { previous: 'run-a', current: 'run-b' })
    assert.ok(events.some(e => e.type === 'ready'))
    flow.destroy()
  } finally { spy.restore() }
})

test('attach 抛错的首次加载进入 error 且无残留；切换 attach 失败重挂旧场次', async () => {
  const spy = spyDataDestroy()
  try {
    const first = harness({ attachFails: new Set([1]) })
    const firstErrors = []
    first.flow.on('error', e => firstErrors.push(e))
    await assert.rejects(first.flow.loadScenario())
    assert.equal(first.flow.getState().status, 'error')
    assert.equal(first.live.mounts, 0)
    assert.equal(first.live.destroys, 0)
    assert.equal(firstErrors.length, 1)
    assert.equal(spy.counter.count, 1, '首次加载候选数据应销毁')
    first.flow.destroy()

    const { flow, live } = harness({ attachFails: new Set([2]) })
    await flow.loadScenario({ sourceRunId: 'run-a' })
    await flow.seek('2026-10-25T00:05:00+08:00')
    const displayedBefore = flow.getState().displayedFrame
    const errors = []
    flow.on('error', e => errors.push(e))
    await assert.rejects(flow.loadScenario({ sourceRunId: 'run-b' }))
    const state = flow.getState()
    assert.equal(state.status, 'ready')
    assert.equal(state.scenarioId, 'run-a')
    assert.equal(live.attachCalls, 3, '候选 attach + 回滚 re-attach')
    assert.equal(live.mounts, 2, '仅 run-a 与回滚会话挂载成功')
    assert.equal(state.displayedFrame, displayedBefore, '恢复旧画面帧')
    assert.equal(errors.length, 1)
    assert.equal(errors[0]?.code, 'SERVICE_ERROR')
    const q = await flow.queryAt({ lon: 120.07, lat: 30.02 })
    assert.equal(q.status, 'wet')
    flow.destroy()
  } finally { spy.restore() }
})

test('连续 loadScenario 前者 AbortError；destroy 打断切换无残留挂载', async () => {
  const spy = spyDataDestroy()
  try {
    const { flow, live } = harness()
    const p1 = flow.loadScenario({ sourceRunId: 'run-a' })
    const p2 = flow.loadScenario({ sourceRunId: 'run-b' })
    await assert.rejects(p1, e => e.name === 'AbortError')
    await p2
    assert.equal(flow.getState().scenarioId, 'run-b')
    assert.equal(flow.getState().status, 'ready')
    assert.equal(live.mounts, 1)
    flow.destroy()

    const { provider } = harness()
    let releaseFrame
    const gate = new Promise(r => { releaseFrame = r })
    const slowProvider = {
      ...provider,
      getFrame: (m, i, ctx) => i === 0 ? gate.then(() => provider.getFrame(m, i, ctx)) : provider.getFrame(m, i, ctx)
    }
    const h2 = harness({ provider: slowProvider })
    const pending = h2.flow.loadScenario()
    await settle()
    const destroying = h2.flow.destroy()
    releaseFrame()
    await assert.rejects(pending, e => e.name === 'AbortError')
    await destroying
    assert.equal(h2.flow.getState().status, 'destroyed')
    assert.equal(h2.live.mounts, 0)
    assert.equal(h2.live.destroys, 0)
    assert.ok(spy.counter.count >= 1, '进行中的候选数据应销毁')
  } finally { spy.restore() }
})

test('progress 阶段顺序、切换事件、timechange 节流', async () => {
  const { flow, live } = harness({ playback: { secondsPerFrame: 1 } })
  const progress = [], scenariochanges = [], readies = [], timechanges = []
  flow.on('progress', p => progress.push(p.phase))
  flow.on('scenariochange', p => scenariochanges.push(p))
  flow.on('ready', () => readies.push(1))
  flow.on('timechange', () => timechanges.push(1))
  await flow.loadScenario({ sourceRunId: 'run-a' })
  const order = ['manifest', 'mesh', 'frames', 'renderer']
  let cursor = -1
  for (const phase of order) {
    const at = progress.indexOf(phase, cursor + 1)
    assert.ok(at > cursor, `progress 缺少或顺序错误: ${phase}`)
    cursor = at
  }
  assert.deepEqual(scenariochanges.at(-1), { previous: null, current: 'run-a' })
  assert.equal(readies.length, 1)
  const before = timechanges.length
  await flow.seek('2026-10-25T00:05:00+08:00')
  assert.equal(timechanges.length, before + 1, 'seek 完成应立即发 timechange')
  await flow.loadScenario({ sourceRunId: 'run-b' })
  assert.deepEqual(scenariochanges.at(-1), { previous: 'run-a', current: 'run-b' })
  assert.equal(readies.length, 2)

  await sleep(150)
  const tcBefore = timechanges.length
  flow.play()
  let maxDisplayed = 0, changes = 0, prev = -1
  const t0 = performance.now()
  for (let i = 0; i < 30; i++) {
    live.tick(t0 + i * 100)
    await settle()
    const d = flow.getState().displayedFrame
    if (d !== prev) changes++
    prev = d
    maxDisplayed = Math.max(maxDisplayed, d)
  }
  const elapsed = performance.now() - t0
  const emitted = timechanges.length - tcBefore
  assert.ok(maxDisplayed > 0.3, `播放应推进 displayedFrame，实际 ${maxDisplayed}`)
  assert.ok(changes >= 5, `displayedFrame 应多次变化，实际 ${changes}`)
  assert.ok(emitted <= Math.ceil(elapsed / 100) + 1,
    `timechange 超过 10 次/秒: ${emitted} 次/${elapsed.toFixed(0)}ms`)
  assert.ok(emitted < changes, 'timechange 应少于 displayed 变化次数（节流生效）')
  flow.pause()
  assert.equal(timechanges.length, tcBefore + emitted + 1, '暂停应立即补发 timechange')
  flow.destroy()
})

test('seek 越界钳制、非法时间、取消信号与 time 参数查询', async () => {
  const { flow } = harness()
  await flow.loadScenario()
  const early = await flow.seek('2020-01-01T00:00:00Z')
  assert.equal(early.displayedFrame, 0)
  assert.equal(early.requestedTime, '2026-10-24T16:00:00.000Z')
  const late = await flow.seek('2030-01-01T00:00:00Z')
  assert.equal(late.displayedFrame, 2)
  assert.equal(late.displayedTime, '2026-10-24T16:15:00.000Z')
  await assert.rejects(flow.seek(3), e => e.code === 'INVALID_ARGUMENT')
  await assert.rejects(flow.seek('not a time'), e => e.code === 'INVALID_ARGUMENT')
  await assert.rejects(
    flow.seek('2026-10-25T00:05:00+08:00', { signal: AbortSignal.abort() }),
    e => e.name === 'AbortError')
  const q = await flow.queryAt({ lon: 120.07, lat: 30.02, time: '2026-10-25T00:00:00+08:00' })
  assert.equal(q.status, 'wet')
  assert.equal(q.time, '2026-10-24T16:00:00.000Z')
  assert.equal(q.level, 1)
  flow.destroy()
})

test('destroy 返回 Promise 且幂等，销毁后公开方法抛 DISPOSED', async () => {
  const { flow, live } = harness()
  await flow.loadScenario()
  const first = flow.destroy()
  assert.ok(first instanceof Promise)
  await first
  await flow.destroy()
  assert.equal(flow.getState().status, 'destroyed')
  assert.equal(live.destroys, 1)
  assert.throws(() => flow.play(), e => e.code === 'DISPOSED')
  assert.throws(() => flow.pause(), e => e.code === 'DISPOSED')
  assert.throws(() => flow.setOptions({ visible: false }), e => e.code === 'DISPOSED')
  assert.throws(() => flow.setVisible(false), e => e.code === 'DISPOSED')
  assert.throws(() => flow.on('statechange', () => { }), e => e.code === 'DISPOSED')
  assert.throws(() => flow.getCapabilities(), e => e.code === 'DISPOSED')
  await assert.rejects(flow.seek('2026-10-25T00:05:00+08:00'), e => e.code === 'DISPOSED')
  await assert.rejects(flow.loadScenario(), e => e.code === 'DISPOSED')
  await assert.rejects(flow.queryAt({ lon: 120, lat: 30 }), e => e.code === 'DISPOSED')
  await assert.rejects(flow.querySeries({ cell: 0 }), e => e.code === 'DISPOSED')
  await assert.rejects(flow.reinitialize(), e => e.code === 'DISPOSED')
  await assert.rejects(flow.listScenarios(), e => e.code === 'DISPOSED')
  const diag = flow.getDiagnostics()
  assert.equal(typeof diag, 'object')
  flow.destroy()
})

test('渲染器 onError/onWarning 回调与 reinitialize 恢复', async () => {
  const { flow, live } = harness()
  await flow.loadScenario()
  const context = live.contexts[0]
  assert.equal(typeof context.onWarning, 'function')
  assert.equal(typeof context.onError, 'function')
  const warnings = [], errors = []
  flow.on('warning', w => warnings.push(w))
  flow.on('error', e => errors.push(e))
  context.onWarning({ code: 'WORKER_FALLBACK', message: '回退主线程' })
  assert.equal(warnings[0]?.code, 'WORKER_FALLBACK')
  flow.play()
  assert.equal(flow.getState().playing, true)
  context.onError(new FlowError('CONTEXT_LOST', 'WebGL 上下文丢失'))
  assert.equal(flow.getState().playing, false)
  assert.equal(flow.getState().error?.code, 'CONTEXT_LOST')
  assert.equal(errors.length, 1)
  assert.equal(errors[0]?.code, 'CONTEXT_LOST')

  await flow.seek('2026-10-25T00:05:00+08:00')
  const displayedBefore = flow.getState().displayedFrame
  const mountsBefore = live.mounts
  const framesBefore = live.frames.length
  await flow.reinitialize()
  const state = flow.getState()
  assert.equal(state.status, 'ready')
  assert.equal(live.mounts, mountsBefore + 1, 'reinitialize 应恰好挂载一次')
  assert.equal(live.destroys, 1, 'reinitialize 应销毁旧会话一次')
  assert.equal(state.displayedFrame, displayedBefore)
  assert.ok(live.frames.length > framesBefore, '恢复画面应重新 setFrames')
  flow.destroy()
})

test('渲染器 onWarning 后暂停状态下 statechange 反映粒子能力变化', async () => {
  let particlesAvailable = true
  const { flow, live } = harness({
    getCapabilities: () => ({
      water: { available: true },
      particles: particlesAvailable ? { available: true } : { available: false, reason: 'GPU 能力不足' },
      webgl2: true, maxTextureSize: 8192, floatRenderTarget: true, recommendedQuality: 'standard'
    })
  })
  await flow.loadScenario()
  flow.pause()
  assert.equal(flow.getState().playing, false)
  const states = []
  flow.on('statechange', s => states.push(s))
  const before = states.length
  particlesAvailable = false
  live.contexts[0].onWarning({ code: 'PARTICLES_UNSUPPORTED', message: '粒子流场不可用', detail: { reason: 'GPU 能力不足' } })
  assert.ok(states.length > before, 'onWarning 后应补发 statechange')
  const caps = states.at(-1).capabilities.renderer
  assert.equal(caps?.particles?.available, false)
  assert.equal(caps?.particles?.reason, 'GPU 能力不足')
  flow.destroy()
})

test('getCapabilities 与 getDiagnostics 字段完整且不暴露 URL', async () => {
  const { flow, provider } = harness()
  let caps = flow.getCapabilities()
  assert.equal(caps.scenarios, false)
  assert.equal(caps.series, 'frames')
  assert.equal(caps.worker, 'none')
  assert.equal(caps.tidal.available, false)
  assert.equal(caps.maxNodes, 65535)
  assert.equal(caps.renderer, null)
  await flow.loadScenario()
  caps = flow.getCapabilities()
  assert.equal(caps.worker, 'none')
  assert.equal(flow.getState().capabilities.maxNodes, 65535)
  provider.listScenarios = async () => [{ id: 'run-a' }]
  provider.querySeries = async () => ({ points: [] })
  provider.getStats = () => ({ requests: 3, retries: 0, failures: 0 })
  caps = flow.getCapabilities()
  assert.equal(caps.scenarios, true)
  assert.equal(caps.series, 'provider')
  const diag = flow.getDiagnostics()
  for (const key of ['rawFramesCached', 'nodeFramesCached', 'pendingRequests', 'tidalHistoryFrames', 'tidalHistoryBytes', 'worker', 'provider', 'warnings']) {
    assert.ok(key in diag, `diagnostics 缺少 ${key}`)
  }
  assert.deepEqual(diag.provider, { requests: 3, retries: 0, failures: 0 })
  assert.ok(Array.isArray(diag.warnings))
  assert.ok(!('http' in diag))
  assert.ok(!JSON.stringify(diag).includes('http'))
  flow.destroy()
})

test('attach 内同步 destroy：旧数据与候选数据及其 Worker 全部回收', async () => {
  const destroyed = []
  const original = FlowFieldData.prototype.destroy
  FlowFieldData.prototype.destroy = function (...args) { destroyed.push(this); return original.apply(this, args) }
  const workers = { terminates: 0 }
  const workerFactory = () => ({
    onmessage: null, onerror: null,
    postMessage(message) {
      if (message?.type === 'aggregate') {
        queueMicrotask(() => this.onmessage?.({ data: { id: message.id, state: new Float32Array(16) } }))
      }
    },
    terminate() { workers.terminates++ }
  })
  let flowRef
  try {
    const { flow, live } = harness({
      worker: true,
      workerFactory,
      onAttach: calls => { if (calls === 2) flowRef.destroy() }
    })
    flowRef = flow
    await flow.loadScenario({ sourceRunId: 'run-a' })
    assert.equal(live.mounts, 1)
    await assert.rejects(flow.loadScenario({ sourceRunId: 'run-b' }), e => e.name === 'AbortError')
    assert.equal(flow.getState().status, 'destroyed')
    assert.equal(new Set(destroyed).size, 2, '旧数据与候选数据都应销毁')
    assert.ok(destroyed.every(d => d._destroyed === true))
    assert.equal(workers.terminates, 2, '两个数据的 Worker 都应 terminate')
    assert.equal(live.mounts, live.destroys, '挂载与销毁应配平')
  } finally { FlowFieldData.prototype.destroy = original }
})

test('首次加载 attach 内被新 loadScenario 取代且新加载失败：无残留且 status error', async () => {
  let flowRef, second
  const { flow, live } = harness({
    attachFails: new Set([2]),
    onAttach: calls => {
      if (calls === 1) second = flowRef.loadScenario({ sourceRunId: 'run-b' }).catch(e => e)
    }
  })
  flowRef = flow
  await assert.rejects(flow.loadScenario(), e => e.name === 'AbortError')
  const secondError = await second
  assert.ok(isFlowError(secondError), '第二次加载应以 FlowError 拒绝')
  const state = flow.getState()
  assert.equal(state.status, 'error')
  assert.equal(live.mounts, live.destroys, '被取代会话应全部销毁')
  assert.equal(live.mounts, 1)
  flow.destroy()
})

test('连续切换播放意图保留：run-b 途中切 run-c 失败后回到 run-a 且继续播放', async () => {
  const { flow, provider } = harness()
  const realGetFrame = provider.getFrame.bind(provider)
  provider.getFrame = (m, i, ctx) => m.scenarioId === 'run-c'
    ? Promise.resolve(new ArrayBuffer(4))
    : realGetFrame(m, i, ctx)
  await flow.loadScenario({ sourceRunId: 'run-a' })
  flow.play()
  assert.equal(flow.getState().playing, true)
  const middle = flow.loadScenario({ sourceRunId: 'run-b' })
  const last = flow.loadScenario({ sourceRunId: 'run-c' })
  await assert.rejects(middle, e => e.name === 'AbortError')
  await assert.rejects(last, e => isFlowError(e) && e.code === 'INVALID_BINARY')
  const state = flow.getState()
  assert.equal(state.status, 'ready')
  assert.equal(state.scenarioId, 'run-a')
  assert.equal(state.switching, false)
  assert.equal(state.playing, true, '回滚后应恢复播放意图')
  assert.equal(state.error?.code, 'INVALID_BINARY')
  flow.destroy()
})
