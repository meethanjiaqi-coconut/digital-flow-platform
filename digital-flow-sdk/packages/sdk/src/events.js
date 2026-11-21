import { FlowError, isFlowError, toFlowError } from './errors.js'
import { assertAlive, getState, timeAt } from './state.js'

export const EVENT_NAMES = Object.freeze([
  'statechange', 'error', 'destroy', 'progress', 'warning',
  'scenariochange', 'timechange', 'ready'
])

const TIMECHANGE_INTERVAL = 100
const WARNING_LIMIT = 20

export function emit(ctx, type, payload) {
  for (const listener of [...(ctx.listeners.get(type) || [])]) {
    try { listener(payload) } catch (error) { console.warn('FlowField event listener failed', error) }
  }
}

export function notify(ctx) {
  emit(ctx, 'statechange', getState(ctx))
}

export function subscribe(ctx, type, listener) {
  assertAlive(ctx)
  if (!EVENT_NAMES.includes(type) || typeof listener !== 'function') {
    throw new FlowError('INVALID_ARGUMENT', `无效的事件订阅: ${type}`)
  }
  if (!ctx.listeners.has(type)) ctx.listeners.set(type, new Set())
  ctx.listeners.get(type).add(listener)
  return () => ctx.listeners.get(type)?.delete(listener)
}

export function warn(ctx, code, message, detail) {
  const warning = { code, message, ...(detail !== undefined ? { detail } : {}) }
  ctx.warnings.push(warning)
  if (ctx.warnings.length > WARNING_LIMIT) ctx.warnings.splice(0, ctx.warnings.length - WARNING_LIMIT)
  emit(ctx, 'warning', { ...warning })
}

export function setProgress(ctx, phase, loaded, total) {
  ctx.progress = { phase, loaded, total }
  emit(ctx, 'progress', { phase, loaded, total })
  notify(ctx)
}

/** 记录可恢复错误：暂停播放、保存 error 并发出 error 事件。AbortError 静默忽略。 */
export function report(ctx, error) {
  if (ctx.destroyed || error?.name === 'AbortError') return
  ctx.error = isFlowError(error) ? error : toFlowError(error, 'playback', 'SERVICE_ERROR')
  ctx.playing = false
  ctx.buffering = false
  emit(ctx, 'error', ctx.error)
  notify(ctx)
}

/** displayedFrame 变化时发 timechange；播放中节流 10 次/秒，force 立即发。 */
export function emitTimechange(ctx, force = false) {
  const now = performance.now()
  if (!force && now - ctx.lastTimechangeEmit < TIMECHANGE_INTERVAL) return
  ctx.lastTimechangeEmit = now
  emit(ctx, 'timechange', {
    requestedTime: timeAt(ctx, ctx.position),
    displayedTime: timeAt(ctx, ctx.displayed),
    displayedFrame: ctx.displayed
  })
}

export function requestSignal(ctx, context = {}) {
  const signals = [ctx.lifetime?.signal, context.signal].filter(Boolean)
  return signals.length > 1 ? AbortSignal.any(signals) : signals[0]
}
