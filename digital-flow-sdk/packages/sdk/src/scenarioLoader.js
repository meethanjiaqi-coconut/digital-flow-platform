import { FlowError, isFlowError, toFlowError } from './errors.js'
import { FlowFieldData } from './internal/FlowFieldData.js'
import { abortedError, assertAlive, getState } from './state.js'
import { emit, emitTimechange, notify, setProgress, warn } from './events.js'
import { applyPair } from './playback.js'

function rendererContext(ctx, data) {
  return {
    data,
    options: structuredClone(ctx.options),
    profile: ctx.profile,
    onTick: ctx.tick,
    onWarning: w => { warn(ctx, w?.code ?? 'FLOW_WARNING', w?.message ?? '渲染警告', w?.detail); notify(ctx) },
    onError: flowError => {
      const error = isFlowError(flowError) ? flowError : toFlowError(flowError, 'renderer', 'RUNTIME_BUSY')
      if (error?.name === 'AbortError' || ctx.destroyed) return
      ctx.playing = false
      ctx.error = error
      emit(ctx, 'error', ctx.error)
      notify(ctx)
    }
  }
}

function releaseCandidate(ctx, candidate, attachedSession) {
  if (candidate && ctx.data !== candidate) {
    try { candidate.destroy() } catch { }
  }
  if (attachedSession && ctx.session !== attachedSession && !ctx.deadSessions.has(attachedSession)) {
    try { attachedSession.destroy() } catch { }
    ctx.deadSessions.add(attachedSession)
  }
}

/**
 * 提交失败回滚：销毁半成品会话与候选数据，用旧数据重新 attach 并恢复旧画面。
 * 返回是否成功恢复。
 */
async function rollbackToOld(ctx, { oldData, oldLifetime, newLifetime, saved, attachedSession, candidate }) {
  newLifetime?.abort()
  ctx.lifetime = oldLifetime
  if (attachedSession) {
    try { attachedSession.destroy() } catch { }
    ctx.deadSessions.add(attachedSession)
  }
  if (ctx.session === attachedSession) ctx.session = undefined
  if (ctx.data === candidate) ctx.data = oldData
  if (candidate) {
    try { candidate.destroy() } catch { }
  }
  try {
    ctx.session = ctx.renderer.attach(rendererContext(ctx, oldData))
  } catch {
    return false
  }
  ctx.pair = -1
  ctx.pendingPair = -1
  ctx.blockedPair = -1
  ctx.position = saved.position
  ctx.displayed = saved.displayed
  ctx.animationTime = saved.animationTime
  ctx.animationFrame = saved.animationFrame
  try {
    await applyPair(ctx, saved.displayed)
  } catch {
    return false
  }
  return true
}

export function disposeSession(ctx) {
  ctx.lifetime?.abort()
  ctx.lifetime = undefined
  const previousSession = ctx.session, previousData = ctx.data
  ctx.session = undefined
  ctx.data = undefined
  try { previousSession?.destroy() } finally { previousData?.destroy() }
  if (previousSession) ctx.deadSessions.add(previousSession)
  ctx.pair = ctx.pendingPair = ctx.blockedPair = -1
  ctx.lastNow = undefined
}

export async function destroyFlow(ctx) {
  if (ctx.destroyed) return
  ctx.destroyed = true
  ctx.generation++
  ctx.revision++
  ctx.loadAbort?.abort()
  ctx.pairAbort?.abort()
  ctx.playing = false
  ctx.buffering = false
  try { disposeSession(ctx) } catch { }
  ctx.status = 'destroyed'
  notify(ctx)
  emit(ctx, 'destroy', undefined)
  ctx.listeners.clear()
}

/**
 * 事务式场次加载：候选数据全部就绪并 attach 成功前，旧场次保持可用；
 * 任何一步失败或被更新的 load 取代，都销毁候选并回滚/保留旧场次。
 */
export async function loadScenario(ctx, selection = {}, context = {}) {
  assertAlive(ctx)
  ctx.loadAbort?.abort()
  const loadAbort = new AbortController()
  ctx.loadAbort = loadAbort
  const ticket = ++ctx.generation
  ctx.revision++
  const signal = context.signal ? AbortSignal.any([loadAbort.signal, context.signal]) : loadAbort.signal

  const hadScenario = ctx.status === 'ready' && Boolean(ctx.data && ctx.session)
  // 被取代的加载可能已 attach 过：无场次语义时先清掉残留会话与数据。
  if (!hadScenario && (ctx.data || ctx.session)) disposeSession(ctx)
  const oldData = ctx.data, oldSession = ctx.session, oldLifetime = ctx.lifetime
  const previousId = oldData?.scenarioId ?? null
  let wasPlaying = false, saved = null
  let oldDestroyed = false, attachedSession = null, candidate = null, newLifetime = null

  if (hadScenario) {
    // 连续切换时沿用首次切换采样的播放意图，避免二次切换把 playing 读成 false。
    if (!ctx.switching) ctx.resumePlaying = ctx.playing
    wasPlaying = ctx.resumePlaying === true
    saved = {
      position: ctx.position, displayed: ctx.displayed, pair: ctx.pair,
      pendingPair: ctx.pendingPair, animationTime: ctx.animationTime, animationFrame: ctx.animationFrame
    }
    ctx.playing = false
    ctx.lastNow = undefined
    ctx.switching = true
    ctx.blockedPair = -1
    ctx.pendingPair = -1
    ctx.buffering = false
    ctx.error = null
    notify(ctx)
  } else {
    ctx.status = 'loading'
    ctx.playing = false
    ctx.buffering = true
    ctx.switching = false
    ctx.position = ctx.displayed = ctx.animationTime = ctx.animationFrame = 0
    ctx.pair = ctx.pendingPair = ctx.blockedPair = -1
    ctx.error = null
    notify(ctx)
  }

  try {
    setProgress(ctx, 'manifest', 0, 1)
    const manifest = await ctx.provider.loadManifest(selection, { signal })
    signal.throwIfAborted()
    setProgress(ctx, 'manifest', 1, 1)

    candidate = await FlowFieldData.load(ctx.provider, manifest, {
      signal,
      profile: ctx.profile,
      worker: ctx.worker, workerUrl: ctx.workerUrl, workerFactory: ctx.workerFactory,
      tidalHistoryBudgetMB: ctx.tidalBudgetMB,
      reuse: oldData,
      onWarning: w => warn(ctx, w?.code ?? 'FLOW_WARNING', w?.message ?? '数据层警告', w?.detail),
      onProgress: progress => {
        if (progress.phase === 'frames') setProgress(ctx, 'frames', Math.min(progress.loaded, 2), 2)
        else setProgress(ctx, progress.phase, progress.loaded, progress.total)
      }
    })
    signal.throwIfAborted()
    if (ticket !== ctx.generation || ctx.destroyed) throw abortedError()

    // 提交前预算首帧对与潮头首帧对，避免 attach 后才发现数据不可用。
    const precompute = [candidate.nodeFrame(0), candidate.nodeFrame(1)]
    if (candidate.tidalAvailable) {
      precompute.push(candidate.tidalFrontFrame(0, { signal }), candidate.tidalFrontFrame(1, { signal }))
    }
    const preTotal = precompute.length
    let preLoaded = 0
    await Promise.all(precompute.map(promise => promise.then(() => {
      preLoaded++
      setProgress(ctx, 'frames', 2 + preLoaded, 2 + preTotal)
    })))
    signal.throwIfAborted()
    if (ticket !== ctx.generation || ctx.destroyed) throw abortedError()

    // 渲染器同一场景只允许一个水面：先销毁旧会话再 attach。
    setProgress(ctx, 'renderer', 0, 1)
    oldSession?.destroy()
    oldDestroyed = true
    ctx.session = undefined
    newLifetime = new AbortController()
    try {
      attachedSession = ctx.renderer.attach(rendererContext(ctx, candidate))
    } catch (error) {
      throw toFlowError(error, 'renderer.attach', 'SERVICE_ERROR')
    }
    // attach 内可能同步触发 destroy() 或被更新的 load 取代：候选与新会话
    // 尚未挂到 ctx，交给下方 !current 分支的 releaseCandidate 就地清理。
    if (ctx.destroyed || ticket !== ctx.generation) throw abortedError()
    ctx.session = attachedSession
    ctx.data = candidate
    ctx.lifetime = newLifetime
    ctx.position = 0
    await applyPair(ctx, 0, ticket)
    signal.throwIfAborted()
    if (ticket !== ctx.generation || ctx.destroyed) throw abortedError()

    setProgress(ctx, 'renderer', 1, 1)
    oldLifetime?.abort()
    oldData?.destroy()
    ctx.status = 'ready'
    ctx.switching = false
    ctx.resumePlaying = undefined
    ctx.progress = null
    // 首次加载由 autoPlay 决定；切换成功恢复切换前采样的播放意图。
    ctx.playing = hadScenario ? wasPlaying : Boolean(ctx.playback.autoPlay)
    notify(ctx)
    emit(ctx, 'scenariochange', { previous: previousId, current: ctx.data.scenarioId })
    emitTimechange(ctx, true)
    emit(ctx, 'ready', getState(ctx))
    ctx.session?.requestRender?.()
    return getState(ctx)
  } catch (error) {
    const isAbort = error?.name === 'AbortError'
    const current = ticket === ctx.generation && !ctx.destroyed
    if (!current) {
      // 已进入提交段（旧会话已销毁）：旧数据与旧 lifetime 不再有属主，在此回收；
      // 候选数据与新会话已归 ctx 所有，由后续 load / destroy 负责。
      if (oldDestroyed) {
        oldLifetime?.abort()
        if (oldData && ctx.data !== oldData) {
          try { oldData.destroy() } catch { }
        }
      }
      releaseCandidate(ctx, candidate, attachedSession)
      throw abortedError()
    }
    if (hadScenario && oldDestroyed) {
      const restored = await rollbackToOld(ctx, { oldData, oldLifetime, newLifetime, saved, attachedSession, candidate })
      ctx.switching = false
      ctx.resumePlaying = undefined
      if (isAbort) {
        notify(ctx)
        throw error
      }
      const flowError = isFlowError(error) ? error : toFlowError(error, 'scenario.load', 'SERVICE_ERROR')
      ctx.error = flowError
      ctx.status = restored ? 'ready' : 'error'
      ctx.playing = restored ? wasPlaying : false
      emit(ctx, 'error', flowError)
      notify(ctx)
      throw flowError
    }
    releaseCandidate(ctx, candidate, attachedSession)
    ctx.switching = false
    if (isAbort) {
      if (hadScenario) {
        ctx.status = 'ready'
        ctx.playing = wasPlaying
        ctx.resumePlaying = undefined
      } else {
        ctx.status = 'idle'
        ctx.playing = false
        ctx.buffering = false
      }
      ctx.lastNow = undefined
      notify(ctx)
      throw error
    }
    const flowError = isFlowError(error) ? error : toFlowError(error, 'scenario.load', 'SERVICE_ERROR')
    if (hadScenario) {
      ctx.status = 'ready'
      ctx.playing = wasPlaying
      ctx.resumePlaying = undefined
      ctx.lastNow = undefined
    } else {
      ctx.status = 'error'
      ctx.playing = false
      ctx.buffering = false
    }
    ctx.error = flowError
    emit(ctx, 'error', flowError)
    notify(ctx)
    throw flowError
  }
}

/** 上下文丢失后的恢复入口：销毁并重新 attach 渲染会话，恢复当前画面与选项。 */
export async function reinitialize(ctx) {
  assertAlive(ctx)
  if (ctx.status !== 'ready' || !ctx.data || !ctx.session) {
    throw new FlowError('NOT_READY', '请先加载场次')
  }
  const data = ctx.data
  const saved = {
    position: ctx.position, displayed: ctx.displayed, pair: ctx.pair,
    pendingPair: ctx.pendingPair, animationTime: ctx.animationTime, animationFrame: ctx.animationFrame
  }
  ctx.revision++
  const oldSession = ctx.session
  ctx.session = undefined
  try { oldSession?.destroy() } catch { }
  if (oldSession) ctx.deadSessions.add(oldSession)
  try {
    ctx.session = ctx.renderer.attach(rendererContext(ctx, data))
  } catch (error) {
    throw toFlowError(error, 'renderer.attach', 'SERVICE_ERROR')
  }
  ctx.pair = -1
  ctx.pendingPair = -1
  ctx.blockedPair = -1
  ctx.position = saved.position
  ctx.displayed = saved.displayed
  ctx.animationTime = saved.animationTime
  ctx.animationFrame = saved.animationFrame
  try {
    await applyPair(ctx, saved.displayed)
  } catch (error) {
    throw isFlowError(error) ? error : toFlowError(error, 'playback', 'SERVICE_ERROR')
  }
  ctx.session?.requestRender?.()
  return getState(ctx)
}
