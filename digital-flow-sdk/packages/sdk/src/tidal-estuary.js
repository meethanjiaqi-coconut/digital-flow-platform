import { DEFAULT_QIANTANG_ESTUARY_POLYGON } from './internal/tidal-front-analysis.js'
import { DEFAULT_TIDAL_PARAMETERS, TIDAL_SEAWARD_DIRECTIONS } from './internal/tidalParameters.js'
import { FlowError } from './errors.js'

export { DEFAULT_TIDAL_PARAMETERS } from './internal/tidalParameters.js'

const invalid = message => { throw new FlowError('INVALID_ARGUMENT', message) }

/**
 * 规范化潮头河口 Profile：校验 id/polygon/seaward/parameters/
 * validatedIntervalsSeconds，合并默认参数为完整参数表，返回冻结副本。
 * createTidalEstuary 与 createFlowField 共用本函数，保证两条入口行为一致。
 */
export function normalizeTidalProfile(profile) {
    if (!profile || typeof profile !== 'object' || Array.isArray(profile)) {
        invalid('潮头 Profile 必须是对象')
    }
    const source = structuredClone(profile)
    if (typeof source.id !== 'string' || !source.id) invalid('潮头 Profile 缺少 id')
    if (!Array.isArray(source.polygon) || source.polygon.length < 3
        || source.polygon.some(p => !Array.isArray(p) || p.length !== 2 || !p.every(Number.isFinite))) {
        invalid('潮头 Profile 需要至少 3 个 [lon, lat] 顶点的 polygon')
    }
    if (!TIDAL_SEAWARD_DIRECTIONS.includes(source.seaward)) {
        invalid(`潮头 Profile 的 seaward 必须是 ${TIDAL_SEAWARD_DIRECTIONS.map(d => `'${d}'`).join('/')} 之一`)
    }
    const parameters = { ...DEFAULT_TIDAL_PARAMETERS }
    if (source.parameters !== undefined) {
        if (!source.parameters || typeof source.parameters !== 'object' || Array.isArray(source.parameters)) {
            invalid('潮头 Profile 的 parameters 必须是对象')
        }
        for (const [key, value] of Object.entries(source.parameters)) {
            if (!Object.hasOwn(DEFAULT_TIDAL_PARAMETERS, key)) invalid(`潮头 Profile 包含未知参数：${key}`)
            if (!Number.isFinite(value)) invalid(`潮头参数 ${key} 必须是有限数`)
            parameters[key] = value
        }
    }
    let validatedIntervalsSeconds
    if (source.validatedIntervalsSeconds !== undefined) {
        if (!Array.isArray(source.validatedIntervalsSeconds) || !source.validatedIntervalsSeconds.length
            || source.validatedIntervalsSeconds.some(v => !Number.isFinite(v) || v <= 0)) {
            invalid('潮头 Profile 的 validatedIntervalsSeconds 必须是正数数组')
        }
        validatedIntervalsSeconds = [...source.validatedIntervalsSeconds]
    }
    const normalized = {
        ...source,
        id: source.id,
        polygon: Object.freeze(source.polygon.map(p => Object.freeze([Number(p[0]), Number(p[1])]))),
        seaward: source.seaward,
        parameters: Object.freeze(parameters)
    }
    if (validatedIntervalsSeconds) normalized.validatedIntervalsSeconds = Object.freeze(validatedIntervalsSeconds)
    return Object.freeze(normalized)
}

export const qiantangProfile = normalizeTidalProfile({
    id: 'qiantang-v1',
    polygon: DEFAULT_QIANTANG_ESTUARY_POLYGON,
    seaward: 'east',
    parameters: { ...DEFAULT_TIDAL_PARAMETERS },
    validatedIntervalsSeconds: [300],
    visualOnly: true
})

export function createTidalEstuary({ profile } = {}) {
    return Object.freeze({ kind: 'tidal-estuary', profile: normalizeTidalProfile(profile) })
}
