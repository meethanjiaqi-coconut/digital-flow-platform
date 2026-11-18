export function validateManifest(m) {
  if (!m || !m.mesh?.meshId || !m.scenarioId) throw new TypeError('Manifest requires scenarioId and mesh.meshId')
  for (const key of ['nNodes', 'nCells', 'nTris', 'nFrames']) {
    if (!Number.isSafeInteger(m[key]) || m[key] < 1) throw new TypeError(`Invalid manifest.${key}`)
  }
  if (m.nNodes > 65535) throw new RangeError('Alpha renderer supports at most 65535 nodes')
  if (!Array.isArray(m.bbox) || m.bbox.length !== 4 || !m.bbox.every(Number.isFinite) || m.bbox[0] >= m.bbox[2] || m.bbox[1] >= m.bbox[3]) throw new TypeError('Invalid bbox')
  if (!(m.scales?.level > 0) || !(m.scales?.uv > 0) || !Number.isFinite(m.scales.level + m.scales.uv)) throw new TypeError('Invalid scales')
  if (!Number.isInteger(m.drySentinel) || m.drySentinel < -32768 || m.drySentinel > 32767) throw new TypeError('Invalid dry sentinel')
  if (m.frames?.length !== m.nFrames) throw new TypeError('Frame count mismatch')
  let previous = -Infinity
  m.frames.forEach((f, index) => {
    const time = Date.parse(f.validTime)
    if (f.index !== index || !Number.isFinite(time) || time <= previous || !/(Z|[+-]\d\d:\d\d)$/.test(f.validTime)) throw new TypeError('Frames require ordered timestamps with explicit timezone')
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
export function mergeOptions(current, patch = {}) {
  const result = structuredClone(current)
  for (const [key, value] of Object.entries(patch)) {
    if (!(key in result)) throw new TypeError(`Unknown option: ${key}`)
    if (value && typeof value === 'object') {
      for (const [subkey, subvalue] of Object.entries(value)) {
        if (!(subkey in result[key])) throw new TypeError(`Unknown option: ${key}.${subkey}`)
        result[key][subkey] = subvalue
      }
    } else result[key] = value
  }
  const range = (value, low, high, label) => { if (!Number.isFinite(value) || value < low || value > high) throw new RangeError(`Invalid ${label}: expected ${low}..${high}`) }
  for (const value of [result.visible, result.particles?.visible, result.water?.visible, result.water?.arrows, result.water?.reflection, result.tidal?.marker, result.tidal?.turbidity]) if (typeof value !== 'boolean') throw new TypeError('Visibility options must be booleans')
  if (![16384,65536,262144].includes(result.particles.count)) throw new RangeError('Particle count must be 16384, 65536 or 262144')
  range(result.particles.lineWidth, .5, 5, 'lineWidth')
  range(result.particles.trailSeconds, 0, 3, 'trailSeconds')
  range(result.flowStrength, .5, 3, 'flowStrength')
  range(result.exaggeration, 1, 200, 'exaggeration')
  range(result.water.waveAmplitude, 0, .3, 'waveAmplitude')
  if (!['river','speed','level'].includes(result.water.colorMode)) throw new TypeError('Invalid water.colorMode')
  return result
}
