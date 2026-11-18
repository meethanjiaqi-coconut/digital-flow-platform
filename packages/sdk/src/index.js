import { FlowFieldData } from './internal/FlowFieldData.js'
import { DEFAULT_OPTIONS, mergeOptions } from './validation.js'
export { createHttpProvider, createStaticProvider } from './providers.js'
export { DEFAULT_OPTIONS } from './validation.js'
export const VERSION = '0.1.0-alpha.1'

const aborted = () => new DOMException('Operation superseded or destroyed', 'AbortError')
/** The host owns Viewer, base map, input handlers, authentication and layout. */
export function createFlowField(config) {
  const { renderer, provider, extensions = [], playback = {}, worker, workerUrl, workerFactory } = config || {}
  if (typeof renderer?.attach !== 'function') throw new TypeError('renderer.attach is required')
  for (const method of ['loadManifest','getMesh','getFrame']) if (typeof provider?.[method] !== 'function') throw new TypeError(`provider.${method} is required`)
  if (extensions.length > 1 || extensions.some(e => e?.kind !== 'tidal-estuary')) throw new TypeError('Only one tidal-estuary extension is supported')
  const profile = extensions[0]?.profile
  if (extensions.length && (!profile?.id || !Array.isArray(profile.polygon) || profile.polygon.length < 3 || profile.polygon.some(p => p.length !== 2 || !p.every(Number.isFinite)))) throw new TypeError('Tidal extension requires an explicit valid profile')
  let options = mergeOptions(DEFAULT_OPTIONS, config.options)
  let rate = playback.rate ?? 1
  const secondsPerFrame = playback.secondsPerFrame ?? 2
  if (!Number.isFinite(secondsPerFrame) || secondsPerFrame <= 0) throw new RangeError('secondsPerFrame must be positive')
  validateRate(rate)
  let status = 'idle', playing = false, buffering = false, error = null
  let data, session, lifetime, generation = 0, revision = 0, destroyed = false
  let position = 0, displayed = 0, pair = -1, pendingPair = -1
  let animationTime = 0, animationFrame = 0, lastNow, lastNotice = -Infinity
  const listeners = new Map()
  function assertAlive() { if (destroyed) throw new Error('FlowField has been destroyed') }
  function assertReady() { assertAlive(); if (status !== 'ready' || !data || !session) throw new Error('Load a scenario first') }
  function timeAt(frame) {
    if (!data) return null
    const i = Math.floor(frame), j = Math.min(i + 1, data.nFrames - 1)
    const a = Date.parse(data.meta.times[i]), b = Date.parse(data.meta.times[j])
    return new Date(a + (b - a) * (frame - i)).toISOString()
  }
  function getState() {
    return {version:VERSION, status, playing, buffering, rate, secondsPerFrame, error,
      scenarioId: data?.scenarioId ?? null, frameCount:data?.nFrames ?? 0,
      requestedFrame:position, displayedFrame:displayed,
      requestedTime:timeAt(position), displayedTime:timeAt(displayed),
      startTime:data?.meta.times[0] ?? null, endTime:data?.meta.times.at(-1) ?? null,
      options:structuredClone(options), tidal:session?.getTidalState?.() ?? {status:'disabled'} }
  }
  function emit(type, payload) {
    for (const listener of [...(listeners.get(type) || [])]) {
      try { listener(payload) } catch (e) { console.warn('FlowField event listener failed', e) }
    }
  }
  function notify() { emit('statechange', getState()) }
  function report(e) {
    if (destroyed || e.name === 'AbortError') return
    error = e.message; playing = false; buffering = false
    emit('error', e); notify()
  }
  function disposeSession() {
    lifetime?.abort(); lifetime = undefined
    const previousSession = session, previousData = data
    session = undefined; data = undefined
    try { previousSession?.destroy() } finally { previousData?.destroy() }
    pair = pendingPair = -1; lastNow = undefined
  }
  async function applyPair(frame, expectedGeneration = generation) {
    const localData = data, localSession = session, ticket = ++revision
    const first = Math.max(0, Math.min(localData.nFrames - 2, Math.floor(frame)))
    const second = Math.min(localData.nFrames - 1, first + 1)
    pendingPair = first; buffering = true; notify()
    localData.activateWindow(first)
    const needsFront = Boolean(profile && (options.tidal.turbidity || options.tidal.marker))
    try {
      const [a,b,frontA,frontB] = await Promise.all([
        localData.nodeFrame(first), localData.nodeFrame(second),
        needsFront ? localData.tidalFrontFrame(first) : null,
        needsFront ? localData.tidalFrontFrame(second) : null
      ])
      if (destroyed || generation !== expectedGeneration || ticket !== revision) throw aborted()
      localSession.setFrames(a,b,frontA,frontB)
      pair = first; pendingPair = -1; displayed = frame
      localSession.setTime(frame - first, animationTime, animationFrame)
      buffering = false; error = null; lastNow = undefined; notify()
    } catch(e) {
      if (destroyed || expectedGeneration !== generation || ticket !== revision) throw aborted()
      if (expectedGeneration === generation && ticket === revision) { pendingPair = -1; buffering = false }
      throw e
    }
  }
  function tick(now = performance.now()) {
    if (destroyed || status !== 'ready' || !options.visible || (typeof document !== 'undefined' && document.hidden)) {lastNow = undefined; return}
    const dt = lastNow === undefined ? 0 : Math.max(0, Math.min(.1, (now - lastNow) / 1000))
    lastNow = now
    if (playing) { animationTime += dt; animationFrame++ }
    if (playing && !buffering && data.nFrames > 1) {
      position += dt * rate / secondsPerFrame
      if (position >= data.nFrames - 1) {
        position = playback.loop === false ? data.nFrames - 1 : 0
        if (playback.loop === false) playing = false
      }
    }
    const first = Math.max(0, Math.min(data.nFrames - 2, Math.floor(position)))
    if (first !== pair && first !== pendingPair && !error) applyPair(position).catch(report)
    if (first === pair && pendingPair < 0) displayed = position
    session.setTime(Math.max(0, Math.min(1, displayed - pair)), animationTime, animationFrame)
    if (playing || buffering) session.requestRender?.()
    if (now - lastNotice >= 100 && (playing || buffering)) {lastNotice = now; notify()}
  }
  async function loadScenario(selection = {}, context = {}) {
    assertAlive()
    const ticket = ++generation; revision++
    disposeSession()
    lifetime = new AbortController()
    const signal = context.signal ? AbortSignal.any([lifetime.signal, context.signal]) : lifetime.signal
    status = 'loading'; playing = false; buffering = true; error = null
    position = displayed = animationTime = animationFrame = 0; notify()
    let candidate
    try {
      const manifest = await provider.loadManifest(selection, {signal})
      signal.throwIfAborted()
      candidate = await FlowFieldData.load(provider, manifest, {signal, profile, worker, workerUrl, workerFactory})
      signal.throwIfAborted()
      if (ticket !== generation || destroyed) throw aborted()
      data = candidate
      session = renderer.attach({data, options:structuredClone(options), profile, onTick:tick})
      await applyPair(0, ticket)
      signal.throwIfAborted()
      if (ticket !== generation || destroyed) throw aborted()
      status = 'ready'; playing = Boolean(playback.autoPlay); notify(); session.requestRender?.()
      return getState()
    } catch(e) {
      if (ticket === generation && !destroyed) {
        disposeSession(); status = e.name === 'AbortError' ? 'idle' : 'error'; buffering = false
        error = e.name === 'AbortError' ? null : e.message
        if (error) emit('error',e)
        notify()
      } else {
        if (candidate !== data) candidate?.destroy()
        throw aborted()
      }
      throw e
    }
  }
  function toFrame(time) {
    const value = time instanceof Date ? time.getTime() : typeof time === 'string' ? Date.parse(time) : NaN
    if (!Number.isFinite(value)) throw new TypeError('seek expects a Date or ISO timestamp')
    const times = data.meta.times.map(Date.parse)
    if (value < times[0] || value > times.at(-1)) throw new RangeError('Time is outside the scenario')
    let i = 0
    while (i < times.length - 1 && times[i + 1] <= value) i++
    return i + (i < times.length - 1 ? (value - times[i]) / (times[i + 1] - times[i]) : 0)
  }
  async function seek(time) {
    assertReady(); const next = toFrame(time); position = next
    try {await applyPair(next); return getState()} catch(e) {report(e); throw e}
  }
  async function queryAt({lon,lat}, context = {}) {
    assertReady()
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) throw new TypeError('lon and lat must be finite')
    const current = data, ticket = generation, frame = displayed, time = timeAt(displayed)
    const cell = current.pickCell(lon,lat)
    if (cell < 0) return null
    const signal = context.signal ? AbortSignal.any([lifetime.signal,context.signal]) : lifetime.signal
    const i = Math.floor(frame)
    await Promise.all([current.frame(i,{signal,history:true}),current.frame(Math.min(i+1,current.nFrames-1),{signal,history:true})])
    signal.throwIfAborted()
    if (ticket !== generation) throw aborted()
    return {...current.sampleCell(cell,frame),lon,lat,time}
  }
  function validateRate(value) { if (!Number.isFinite(value) || value < .1 || value > 16) throw new RangeError('Playback rate must be 0.1..16') }
  return {
    loadScenario, seek, queryAt, getState,
    on(type, listener) {
      assertAlive()
      if (!['statechange','error','destroy'].includes(type) || typeof listener !== 'function') throw new TypeError('Invalid event subscription')
      if (!listeners.has(type)) listeners.set(type,new Set())
      listeners.get(type).add(listener)
      return () => listeners.get(type)?.delete(listener)
    },
    play() {assertReady(); playing = true; lastNow = undefined; notify(); session.requestRender?.()},
    pause() {assertAlive(); playing = false; lastNow = undefined; notify()},
    setPlaybackRate(value) {assertAlive(); validateRate(value); rate = value; notify()},
    setOptions(patch) {
      assertAlive(); const next = mergeOptions(options,patch)
      session?.setOptions(next); options = next; notify()
      if (status === 'ready' && patch.tidal) applyPair(position).catch(report)
      session?.requestRender?.()
    },
    setVisible(visible) {this.setOptions({visible})},
    async querySeries({cell,lon,lat}, context = {}) {
      assertReady(); const current = data, ticket = generation
      if (cell === undefined) {
        if (!Number.isFinite(lon) || !Number.isFinite(lat)) throw new TypeError('lon and lat must be finite')
        cell = current.pickCell(lon,lat)
      }
      if (!Number.isInteger(cell) || cell < 0 || cell >= current.nCells) throw new RangeError('Invalid query cell')
      const signal = context.signal ? AbortSignal.any([lifetime.signal,context.signal]) : lifetime.signal
      const result = await current.series(cell,signal)
      signal.throwIfAborted(); if (ticket !== generation) throw aborted()
      return result
    },
    async pick(position, context) {assertReady(); const point = session.pick?.(position); return point ? queryAt(point,context) : null},
    destroy() {
      if (destroyed) return
      destroyed = true; generation++; revision++; playing = false; buffering = false
      try {disposeSession()} finally {status = 'destroyed'; notify(); emit('destroy',undefined); listeners.clear()}
    }
  }
}
