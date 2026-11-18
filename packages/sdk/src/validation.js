import { FlowError } from './errors.js'

const invalid = (message, code = 'INVALID_MANIFEST') => { throw new FlowError(code, message) }

export function validateManifest(m) {
  if (!m || typeof m !== 'object') invalid('场次清单缺失或不是对象')
  if (m.formatVersion !== 2) invalid('场次清单 formatVersion 必须为 2')
  if (!m.mesh?.meshId || !m.scenarioId) invalid('清单必须提供 scenarioId 和 mesh.meshId')
  for (const key of ['nNodes', 'nCells', 'nTris', 'nFrames']) {
    if (!Number.isSafeInteger(m[key]) || m[key] < 1) invalid(`清单字段 ${key} 必须是正整数`)
  }
  if (m.nNodes > 65535) invalid('Alpha 渲染器最多支持 65535 个节点', 'UNSUPPORTED_MESH')
  if (!Array.isArray(m.bbox) || m.bbox.length !== 4 || !m.bbox.every(Number.isFinite) || m.bbox[0] >= m.bbox[2] || m.bbox[1] >= m.bbox[3]) invalid('清单 bbox 无效')
  if (!(m.scales?.level > 0) || !(m.scales?.uv > 0) || !Number.isFinite(m.scales.level + m.scales.uv)) invalid('清单 scales 无效')
  if (!Number.isInteger(m.drySentinel) || m.drySentinel < -32768 || m.drySentinel > 32767) invalid('清单 drySentinel 无效')
  if (m.frames?.length !== m.nFrames) invalid('清单帧数量与 nFrames 不一致')
  let previous = -Infinity
  m.frames.forEach((f, index) => {
    const time = Date.parse(f.validTime)
    if (f.index !== index || !Number.isFinite(time) || time <= previous || !/(Z|[+-]\d\d:\d\d)$/.test(f.validTime)) invalid('清单帧必须具有有序且带时区的时间戳')
    previous = time
  })
  return m
}

export const DEFAULT_OPTIONS = Object.freeze({
  visible: true, flowStrength: 2, exaggeration: 60,
  particles: Object.freeze({visible: true, count: 16384, lineWidth: 1, trailSeconds: 1.5}),
  water: Object.freeze({visible: true, colorMode: 'river', arrows: false, reflection: true, waveAmplitude: 0.14}),
  tidal: Object.freeze({marker: false, turbidity: true})
})

const isPlainObject = value => value !== null && typeof value === 'object' && !Array.isArray(value)
const invalidOption = message => { throw new FlowError('INVALID_ARGUMENT', message) }

export function mergeOptions(current, patch = {}) {
  if (!isPlainObject(patch)) invalidOption('options 必须是普通对象')
  const result = structuredClone(current)
  for (const [key, value] of Object.entries(patch)) {
    if (!(key in result)) invalidOption(`未知配置项: ${key}`)
    const grouped = result[key] !== null && typeof result[key] === 'object'
    if (grouped) {
      if (!isPlainObject(value)) invalidOption(`${key} 必须是对象`)
      for (const [subkey, subvalue] of Object.entries(value)) {
        if (!(subkey in result[key])) invalidOption(`未知配置项: ${key}.${subkey}`)
        if (subvalue !== null && typeof subvalue === 'object') invalidOption(`${key}.${subkey} 不支持嵌套对象`)
        result[key][subkey] = subvalue
      }
    } else {
      if (isPlainObject(value)) invalidOption(`${key} 不支持对象值`)
      result[key] = value
    }
  }
  const range = (value, low, high, label) => { if (!Number.isFinite(value) || value < low || value > high) invalidOption(`${label} 必须在 ${low}..${high} 之间`) }
  for (const value of [result.visible, result.particles?.visible, result.water?.visible, result.water?.arrows, result.water?.reflection, result.tidal?.marker, result.tidal?.turbidity]) if (typeof value !== 'boolean') invalidOption('可见性配置必须是布尔值')
  if (![16384,65536,262144].includes(result.particles.count)) invalidOption('粒子数量必须是 16384、65536 或 262144')
  range(result.particles.lineWidth, .5, 5, '粒子宽度')
  range(result.particles.trailSeconds, 0, 3, '粒子拖尾')
  range(result.flowStrength, .5, 3, '沿流运动强度')
  range(result.exaggeration, 1, 200, '高程夸张')
  range(result.water.waveAmplitude, 0, .3, '微浪振幅')
  if (!['river','speed','level'].includes(result.water.colorMode)) invalidOption('无效的水面颜色模式')
  return result
}
