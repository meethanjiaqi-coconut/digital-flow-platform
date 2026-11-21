import { FlowError, toFlowError } from './errors.js'
import { abortedError, assertAlive, assertReady, frameForTime, timeAt } from './state.js'
import { requestSignal } from './events.js'

const rethrow = error => {
  if (error?.name === 'AbortError') throw error
  throw toFlowError(error, 'query', 'DATA_UNAVAILABLE')
}

/**
 * 位置查询：域外返回 null；time 缺省查 displayedFrame，给定时按钳制后的
 * 时刻查询。数值直接由两帧返回数组计算，不经 LRU 重读。
 */
export async function queryAt(ctx, point = {}, context = {}) {
  assertReady(ctx)
  const { lon, lat, time } = point
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) {
    throw new FlowError('INVALID_ARGUMENT', 'lon 和 lat 必须是有限数值')
  }
  const data = ctx.data
  const cell = data.pickCell(lon, lat)
  if (cell < 0) return null
  const frame = time === undefined ? ctx.displayed : frameForTime(ctx, time)
  const i = Math.max(0, Math.min(data.nFrames - 1, Math.floor(frame)))
  const j = Math.min(data.nFrames - 1, i + 1)
  const ratio = Math.max(0, Math.min(1, frame - i))
  const signal = requestSignal(ctx, context)
  const ticket = ctx.generation
  try {
    const [valuesA, valuesB] = await Promise.all([
      data.frame(i, { signal, history: true }),
      data.frame(j, { signal, history: true })
    ])
    signal?.throwIfAborted()
    if (ctx.destroyed || ticket !== ctx.generation) throw abortedError()
    const sampled = data.sampleValues(cell, ratio, valuesA, valuesB)
    if (!sampled) throw new FlowError('DATA_UNAVAILABLE', '帧数据不可用', { frame: i })
    return {
      status: sampled.wet ? 'wet' : 'dry',
      cell, lon, lat,
      time: timeAt(ctx, frame),
      wet: sampled.wet,
      wetTransition: sampled.wetTransition,
      level: sampled.level, u: sampled.u, v: sampled.v,
      speed: sampled.speed, dirDeg: sampled.dirDeg
    }
  } catch (error) {
    rethrow(error)
  }
}

/** 单元序列：优先 provider 规范化结果，否则本地逐帧回退（并发上限 4）。 */
export async function querySeries(ctx, args = {}, context = {}) {
  assertReady(ctx)
  const data = ctx.data
  let cell = args.cell
  if (cell === undefined) {
    const { lon, lat } = args
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) {
      throw new FlowError('INVALID_ARGUMENT', 'lon 和 lat 必须是有限数值')
    }
    cell = data.pickCell(lon, lat)
  }
  if (!Number.isInteger(cell) || cell < 0 || cell >= data.nCells) {
    throw new FlowError('INVALID_ARGUMENT', '查询单元无效或超出计算域')
  }
  const signal = requestSignal(ctx, context)
  const ticket = ctx.generation
  try {
    const result = await data.series(cell, signal)
    signal?.throwIfAborted()
    if (ctx.destroyed || ticket !== ctx.generation) throw abortedError()
    return result
  } catch (error) {
    if (error?.name === 'AbortError') throw error
    throw toFlowError(error, 'query.series', 'DATA_UNAVAILABLE')
  }
}

/** 场景列表：provider 未实现 listScenarios 时抛 NOT_SUPPORTED。 */
export async function listScenarios(ctx, context = {}) {
  assertAlive(ctx)
  if (typeof ctx.provider.listScenarios !== 'function') {
    throw new FlowError('NOT_SUPPORTED', '当前数据源不支持场景列表')
  }
  const signal = requestSignal(ctx, context)
  try {
    const list = await ctx.provider.listScenarios({ signal })
    signal?.throwIfAborted()
    return list
  } catch (error) {
    if (error?.name === 'AbortError') throw error
    throw toFlowError(error, 'scenarios', 'SERVICE_ERROR')
  }
}

/** 渲染拾取：把屏幕位置交给会话换算后走 queryAt。 */
export async function pick(ctx, position, context = {}) {
  assertReady(ctx)
  const point = ctx.session.pick?.(position)
  return point ? queryAt(ctx, point, context) : null
}
