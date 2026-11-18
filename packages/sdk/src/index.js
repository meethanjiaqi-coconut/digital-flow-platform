import { FlowError } from './errors.js'
import { DEFAULT_OPTIONS, mergeOptions } from './validation.js'
import { assertAlive, capabilities, diagnostics, getState } from './state.js'
import { subscribe } from './events.js'
import { destroyFlow, loadScenario, reinitialize } from './scenarioLoader.js'
import { pause, play, seek, setOptions, setPlaybackRate, tick } from './playback.js'
import { listScenarios, pick, queryAt, querySeries } from './query.js'

export { createHttpProvider, createStaticProvider } from './providers.js'
export { DEFAULT_OPTIONS } from './validation.js'
export { FlowError, isFlowError } from './errors.js'
export const VERSION = '0.1.0-alpha.2'

const invalid = message => { throw new FlowError('INVALID_ARGUMENT', message) }

/**
 * 组装公共流场实例：场次加载/切换事务、播放调度、查询与事件分发
 * 分别由 scenarioLoader/playback/query/events 模块实现，本文件只做
 * 配置校验、上下文装配与公开方法绑定。
 */
export function createFlowField(config) {
  const {
    renderer, provider, extensions = [], playback = {},
    worker, workerUrl, workerFactory,
    timeZone = 'Asia/Shanghai', tidalHistoryBudgetMB = 256,
    options: optionPatch
  } = config || {}
  if (typeof renderer?.attach !== 'function') invalid('renderer.attach 是必需的')
  for (const method of ['loadManifest', 'getMesh', 'getFrame']) {
    if (typeof provider?.[method] !== 'function') invalid(`provider.${method} 是必需的`)
  }
  if (extensions.length > 1 || extensions.some(e => e?.kind !== 'tidal-estuary')) {
    invalid('仅支持一个 tidal-estuary 扩展')
  }
  const profile = extensions[0]?.profile
  if (extensions.length && (!profile?.id || !Array.isArray(profile.polygon) || profile.polygon.length < 3
    || profile.polygon.some(p => p.length !== 2 || !p.every(Number.isFinite)))) {
    invalid('潮汐扩展需要显式有效的 profile')
  }
  if (!Number.isFinite(tidalHistoryBudgetMB) || tidalHistoryBudgetMB <= 0) {
    invalid('tidalHistoryBudgetMB 必须是正数')
  }
  const options = mergeOptions(DEFAULT_OPTIONS, optionPatch)
  const rate = playback.rate ?? 1
  const secondsPerFrame = playback.secondsPerFrame ?? 2
  if (!Number.isFinite(secondsPerFrame) || secondsPerFrame <= 0) invalid('secondsPerFrame 必须是正数')
  if (!Number.isFinite(rate) || rate < .1 || rate > 16) invalid('播放速率必须在 0.1 到 16 之间')

  const ctx = {
    version: VERSION, provider, renderer, profile, options, playback,
    rate, secondsPerFrame, timeZone, tidalBudgetMB: tidalHistoryBudgetMB,
    worker, workerUrl, workerFactory,
    status: 'idle', switching: false, playing: false, buffering: false,
    destroyed: false, generation: 0, revision: 0,
    position: 0, displayed: 0, pair: -1, pendingPair: -1, blockedPair: -1,
    animationTime: 0, animationFrame: 0,
    lastNow: undefined, lastNotice: -Infinity, lastTimechangeEmit: -Infinity,
    lastDisplayedNotified: -1,
    listeners: new Map(), warnings: [], deadSessions: new Set(),
    data: undefined, session: undefined, lifetime: undefined,
    loadAbort: undefined, pairAbort: undefined,
    progress: null, error: null,
    tick: now => tick(ctx, now)
  }

  return {
    loadScenario: (selection, context) => loadScenario(ctx, selection, context),
    reinitialize: () => reinitialize(ctx),
    seek: (time, context) => seek(ctx, time, context),
    queryAt: (point, context) => queryAt(ctx, point, context),
    querySeries: (args, context) => querySeries(ctx, args, context),
    listScenarios: context => listScenarios(ctx, context),
    pick: (position, context) => pick(ctx, position, context),
    play: () => play(ctx),
    pause: () => pause(ctx),
    setPlaybackRate: value => setPlaybackRate(ctx, value),
    setOptions: patch => setOptions(ctx, patch),
    setVisible: visible => setOptions(ctx, { visible }),
    getState: () => getState(ctx),
    getCapabilities: () => { assertAlive(ctx); return capabilities(ctx) },
    getDiagnostics: () => diagnostics(ctx),
    on: (type, listener) => subscribe(ctx, type, listener),
    destroy: () => destroyFlow(ctx)
  }
}
