import { FlowError } from '../errors.js'

function isoTime(value) {
  if (value === undefined || value === null) return null
  const time = value instanceof Date ? value.getTime() : Date.parse(value)
  return Number.isFinite(time) ? new Date(time).toISOString() : null
}

function finiteOrNull(value) {
  return Number.isFinite(value) ? value : null
}

function directionOf(u, v, speed) {
  if (u === null || v === null || speed === null || speed < 1e-6) return null
  return (Math.atan2(u, v) * 180 / Math.PI + 360) % 360
}

/** 统一序列点结构：干点数值全为 null，零流速 dirDeg 为 null。 */
export function normalizeSeriesPoint(point = {}) {
  const frameIndex = Number.isSafeInteger(point.frameIndex) ? point.frameIndex
    : Number.isSafeInteger(point.index) ? point.index
    : Number.isSafeInteger(point.frame) ? point.frame : 0
  const validTime = isoTime(point.validTime ?? point.time)
  const dry = point.dry === true || point.wet === false
  if (dry) {
    return { frameIndex, validTime, dry: true, level: null, u: null, v: null, speed: null, dirDeg: null }
  }
  const level = finiteOrNull(point.level)
  const u = finiteOrNull(point.u)
  const v = finiteOrNull(point.v)
  const speed = u !== null && v !== null ? Math.hypot(u, v) : finiteOrNull(point.speed)
  const dirDeg = u !== null && v !== null ? directionOf(u, v, speed) : finiteOrNull(point.dirDeg)
  return { frameIndex, validTime, dry: false, level, u, v, speed, dirDeg }
}

/** 服务端/本地回退共用的序列结果包装，保证两条路径结构一致。 */
export function normalizeSeriesResult(raw, { scenarioId = null, cellIndex = null, source = 'provider' } = {}) {
  const points = Array.isArray(raw?.points) ? raw.points : Array.isArray(raw) ? raw : []
  return {
    scenarioId: raw?.scenarioId ?? scenarioId,
    cellIndex: Number.isSafeInteger(raw?.cellIndex) ? raw.cellIndex : cellIndex,
    points: points.map(normalizeSeriesPoint),
    source
  }
}

/** 场景选择参数归一化：scenarioId > sourceRunId > latest；兼容 {sourceRunId:'latest'}。 */
export function selectionId(selection = {}) {
  if (typeof selection === 'string') return selection
  if (selection?.scenarioId !== undefined && selection?.scenarioId !== null) return String(selection.scenarioId)
  if (selection?.sourceRunId !== undefined && selection?.sourceRunId !== null) return String(selection.sourceRunId)
  return 'latest'
}

/** listScenarios 统一输出结构。 */
export function normalizeScenario(item) {
  const id = item?.id ?? item?.scenarioId ?? item?.sourceRunId
  if (id === undefined || id === null) {
    throw new FlowError('DATA_UNAVAILABLE', '场景列表包含缺少标识的条目')
  }
  const result = {
    id: String(id),
    sourceRunId: item.sourceRunId ?? null,
    name: item.name ?? item.scenarioName ?? null,
    startTime: isoTime(item.startTime ?? item.start),
    endTime: isoTime(item.endTime ?? item.end),
    frameCount: Number.isSafeInteger(item.frameCount) ? item.frameCount
      : Number.isSafeInteger(item.nFrames) ? item.nFrames : null
  }
  const meshId = item.meshId ?? item.mesh?.meshId
  if (meshId !== undefined && meshId !== null) result.meshId = String(meshId)
  if (item.publishedAt !== undefined && item.publishedAt !== null) result.publishedAt = item.publishedAt
  return result
}
