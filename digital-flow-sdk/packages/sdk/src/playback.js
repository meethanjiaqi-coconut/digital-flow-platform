import { FlowError, isFlowError, toFlowError } from './errors.js'
import { mergeOptions } from './validation.js'
import { abortedError, assertAlive, assertReady, frameForTime, getState } from './state.js'
import { emitTimechange, notify, report } from './events.js'

const playbackError = error => isFlowError(error) ? error : toFlowError(error, 'playback', 'SERVICE_ERROR')

/**
 * 应用一对相邻节点帧到渲染会话。每次调用持有独立的 AbortController，
 * 只用于中止潮头历史等待（共享的帧请求不受影响）；新的 applyPair 开始时
 * 中止上一次的潮头等待。非取消失败记入 blockedPair：tick 不再对该 pair
 * 重复请求，播放停止、位置回退到 displayed，直到 play/seek/setOptions
 * 触发的新 applyPair 清除 blockedPair 与 error。
 */
export async function applyPair(ctx, frame, expectedGeneration = ctx.generation) {
  const localData = ctx.data, localSession = ctx.session
  if (!localData || !localSession) throw new FlowError('NOT_READY', '请先加载场次')
  ctx.pairAbort?.abort()
  const pairAbort = new AbortController()
  ctx.pairAbort = pairAbort
  const ticket = ++ctx.revision
  const first = Math.max(0, Math.min(localData.nFrames - 2, Math.floor(frame)))
  const second = Math.min(localData.nFrames - 1, first + 1)
  ctx.pendingPair = first
  ctx.buffering = true
  notify(ctx)
  localData.activateWindow(first)
  const needsFront = Boolean(ctx.profile && localData.tidalAvailable && (ctx.options.tidal.turbidity || ctx.options.tidal.marker))
  try {
    const [a, b, frontA, frontB] = await Promise.all([
      localData.nodeFrame(first), localData.nodeFrame(second),
      needsFront ? localData.tidalFrontFrame(first, { signal: pairAbort.signal }) : null,
      needsFront ? localData.tidalFrontFrame(second, { signal: pairAbort.signal }) : null
    ])
    if (ctx.destroyed || ctx.generation !== expectedGeneration || ticket !== ctx.revision) throw abortedError()
    localSession.setFrames(a, b, frontA, frontB)
    ctx.pair = first
    ctx.pendingPair = -1
    ctx.displayed = frame
    localSession.setTime(frame - first, ctx.animationTime, ctx.animationFrame)
    ctx.buffering = false
    ctx.error = null
    ctx.lastNow = undefined
    notify(ctx)
  } catch (error) {
    if (ctx.destroyed || expectedGeneration !== ctx.generation || ticket !== ctx.revision) throw abortedError()
    ctx.pendingPair = -1
    ctx.buffering = false
    if (error?.name !== 'AbortError') {
      ctx.blockedPair = first
      ctx.playing = false
      ctx.position = ctx.displayed
    }
    throw error
  }
}

export function tick(ctx, now = performance.now()) {
  if (ctx.destroyed || ctx.status !== 'ready' || !ctx.data || !ctx.session
    || !ctx.options.visible || (typeof document !== 'undefined' && document.hidden)) {
    ctx.lastNow = undefined
    return
  }
  const dt = ctx.lastNow === undefined ? 0 : Math.max(0, Math.min(.1, (now - ctx.lastNow) / 1000))
  ctx.lastNow = now
  if (ctx.playing) { ctx.animationTime += dt; ctx.animationFrame++ }
  if (ctx.playing && !ctx.buffering && ctx.data.nFrames > 1) {
    ctx.position += dt * ctx.rate / ctx.secondsPerFrame
    if (ctx.position >= ctx.data.nFrames - 1) {
      if (ctx.playback.loop === false) {
        ctx.position = ctx.data.nFrames - 1
        ctx.playing = false
      } else {
        ctx.position = 0
        ctx.session?.resetTrails?.()
      }
    }
  }
  const first = Math.max(0, Math.min(ctx.data.nFrames - 2, Math.floor(ctx.position)))
  if (first !== ctx.pair && first !== ctx.pendingPair && first !== ctx.blockedPair) {
    applyPair(ctx, ctx.position).catch(error => report(ctx, playbackError(error)))
  }
  if (first === ctx.pair && ctx.pendingPair < 0) ctx.displayed = ctx.position
  ctx.session.setTime(Math.max(0, Math.min(1, ctx.displayed - ctx.pair)), ctx.animationTime, ctx.animationFrame)
  if (ctx.playing || ctx.buffering) ctx.session.requestRender?.()
  if (ctx.displayed !== ctx.lastDisplayedNotified) {
    ctx.lastDisplayedNotified = ctx.displayed
    emitTimechange(ctx)
  }
  if (now - ctx.lastNotice >= 100 && (ctx.playing || ctx.buffering)) {
    ctx.lastNotice = now
    notify(ctx)
  }
}

export function play(ctx) {
  assertReady(ctx)
  ctx.blockedPair = -1
  ctx.error = null
  ctx.playing = true
  ctx.lastNow = undefined
  notify(ctx)
  ctx.session?.requestRender?.()
}

export function pause(ctx) {
  assertAlive(ctx)
  ctx.playing = false
  ctx.lastNow = undefined
  notify(ctx)
  emitTimechange(ctx, true)
}

export function setPlaybackRate(ctx, value) {
  assertAlive(ctx)
  if (!Number.isFinite(value) || value < .1 || value > 16) throw new FlowError('INVALID_ARGUMENT', '播放速率必须在 0.1 到 16 之间')
  ctx.rate = value
  notify(ctx)
}

export async function seek(ctx, time, context = {}) {
  assertReady(ctx)
  context.signal?.throwIfAborted()
  const next = frameForTime(ctx, time)
  const crossed = Math.abs(next - ctx.displayed) > 1
  ctx.position = next
  ctx.blockedPair = -1
  ctx.error = null
  if (crossed) ctx.session?.resetTrails?.()
  try {
    await applyPair(ctx, next)
    context.signal?.throwIfAborted()
    emitTimechange(ctx, true)
    return getState(ctx)
  } catch (error) {
    const flowError = playbackError(error)
    report(ctx, flowError)
    throw flowError
  }
}

export function setOptions(ctx, patch) {
  assertAlive(ctx)
  const next = mergeOptions(ctx.options, patch)
  ctx.session?.setOptions(next)
  ctx.options = next
  notify(ctx)
  if (ctx.status === 'ready' && ctx.session && patch?.tidal) {
    ctx.blockedPair = -1
    ctx.error = null
    applyPair(ctx, ctx.position).catch(error => report(ctx, playbackError(error)))
  }
  ctx.session?.requestRender?.()
}
