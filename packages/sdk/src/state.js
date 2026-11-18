import { FlowError } from './errors.js'

export const abortedError = () => new DOMException('Operation superseded or destroyed', 'AbortError')

export function assertAlive(ctx) {
  if (ctx.destroyed) throw new FlowError('DISPOSED', 'FlowField 已销毁')
}

export function assertReady(ctx) {
  assertAlive(ctx)
  if (ctx.status !== 'ready' || !ctx.data || !ctx.session) throw new FlowError('NOT_READY', '请先加载场次')
}

export function isSuspended(ctx) {
  return (typeof document !== 'undefined' && document.hidden) || ctx.options.visible === false
}

export function timeAt(ctx, frame) {
  const data = ctx.data
  if (!data) return null
  const i = Math.floor(frame), j = Math.min(i + 1, data.nFrames - 1)
  const a = Date.parse(data.meta.times[i]), b = Date.parse(data.meta.times[j])
  return new Date(a + (b - a) * (frame - i)).toISOString()
}

function isoTime(value) {
  if (value === undefined || value === null) return null
  const time = Date.parse(value)
  return Number.isFinite(time) ? new Date(time).toISOString() : null
}

/** seek/queryAt 的时间入参：非法值 INVALID_ARGUMENT，越界钳制到首末时刻。 */
export function frameForTime(ctx, time) {
  const value = time instanceof Date ? time.getTime() : typeof time === 'string' ? Date.parse(time) : NaN
  if (!Number.isFinite(value)) throw new FlowError('INVALID_ARGUMENT', '时间参数必须是 Date 或 ISO 时间字符串')
  const times = ctx.data.meta.times.map(t => Date.parse(t))
  const clamped = Math.max(times[0], Math.min(times[times.length - 1], value))
  let i = 0
  while (i < times.length - 1 && times[i + 1] <= clamped) i++
  return i + (i < times.length - 1 ? (clamped - times[i]) / (times[i + 1] - times[i]) : 0)
}

const intervalCache = new WeakMap()
function frameInterval(data) {
  if (intervalCache.has(data)) return intervalCache.get(data)
  let result = null
  const times = data.meta.times.map(t => Date.parse(t))
  if (times.length > 1) {
    const step = times[1] - times[0]
    if (step > 0 && times.every((t, i) => i === 0 || t - times[i - 1] === step)) result = step / 1000
  }
  intervalCache.set(data, result)
  return result
}

const FALLBACK_STATS = Object.freeze({ levelMin: -3.5, levelMax: 6.5, speedMax: 2.5 })

export function capabilities(ctx) {
  const data = ctx.data
  return {
    scenarios: typeof ctx.provider.listScenarios === 'function',
    series: typeof ctx.provider.querySeries === 'function' ? 'provider' : 'frames',
    worker: data ? data.workerMode : 'none',
    tidal: !ctx.profile ? { available: false }
      : data ? data.tidalAvailability
      : { available: true },
    maxNodes: 65535,
    renderer: ctx.session?.getCapabilities?.() ?? null
  }
}

export function diagnostics(ctx) {
  const d = ctx.data?.diagnostics() ?? {}
  return {
    rawFramesCached: d.rawFramesCached ?? 0,
    nodeFramesCached: d.nodeFramesCached ?? 0,
    pendingRequests: d.pendingRequests ?? 0,
    tidalHistoryFrames: d.tidalHistoryFrames ?? 0,
    tidalHistoryBytes: d.tidalHistoryBytes ?? 0,
    worker: d.worker ?? 'none',
    provider: typeof ctx.provider.getStats === 'function' ? ctx.provider.getStats() : null,
    warnings: ctx.warnings.map(w => ({ ...w }))
  }
}

export function getState(ctx) {
  const data = ctx.data
  const stats = data ? data.stats : FALLBACK_STATS
  return {
    version: ctx.version,
    status: ctx.status,
    switching: ctx.switching,
    playing: ctx.playing,
    buffering: ctx.buffering,
    suspended: isSuspended(ctx),
    rate: ctx.rate,
    secondsPerFrame: ctx.secondsPerFrame,
    loop: ctx.playback.loop !== false,
    timeZone: ctx.timeZone,
    error: ctx.error ? ctx.error.toJSON() : null,
    progress: ctx.progress ? { ...ctx.progress } : null,
    scenarioId: data?.scenarioId ?? null,
    sourceRunId: data?.manifest?.sourceRunId ?? null,
    scenarioName: data?.manifest?.scenarioName ?? null,
    meshId: data?.meshId ?? null,
    frameCount: data?.nFrames ?? 0,
    frameIntervalSeconds: data ? frameInterval(data) : null,
    requestedFrame: ctx.position,
    displayedFrame: ctx.displayed,
    requestedTime: timeAt(ctx, ctx.position),
    displayedTime: timeAt(ctx, ctx.displayed),
    startTime: isoTime(data?.meta.times[0]),
    endTime: isoTime(data?.meta.times.at(-1)),
    stats: { levelMin: stats.levelMin, levelMax: stats.levelMax, speedMax: stats.speedMax },
    options: structuredClone(ctx.options),
    tidal: ctx.session?.getTidalState?.() ?? { status: 'disabled' },
    capabilities: capabilities(ctx)
  }
}
