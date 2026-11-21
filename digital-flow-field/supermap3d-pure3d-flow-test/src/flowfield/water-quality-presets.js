/**
 * 水质视觉预设只负责水材质表现，不参与水质等级判定。
 * 未来接入监测接口时，可直接将记录中的 quality 字段传给 normalizeWaterQuality。
 */
export const WATER_QUALITY_OFF = 'off'

export const WATER_QUALITY_OPTIONS = Object.freeze([
    { label: '关闭', value: WATER_QUALITY_OFF },
    { label: 'Ⅰ类 · 清澈', value: 'I' },
    { label: 'Ⅱ类 · 较清', value: 'II' },
    { label: 'Ⅲ类 · 轻度浑浊', value: 'III' },
    { label: 'Ⅳ类 · 浑浊', value: 'IV' },
    { label: 'Ⅴ类 · 重度浑浊', value: 'V' },
    { label: '劣Ⅴ类 · 极浑浊', value: 'BAD_V' }
])

export const WATER_QUALITY_PRESETS = Object.freeze({
    I: Object.freeze({
        baseColor: '#0b607c',
        shallowColor: '#62ddea',
        deepColor: '#073a57',
        horizonColor: '#e5fbff',
        causticColor: '#83efff',
        alpha: 0.82,
        shallowAlpha: 0.18,
        deepAlpha: 0.7,
        luminance: 0.9,
        noiseIntensity: 0.002,
        waterDepth: 8.5,
        reflectionStrength: 0.52,
        reflectionMix: 0.44,
        foamBlend: 0.025,
        causticScale: 0.006,
        shiny: 420,
        spec: 4.2
    }),
    II: Object.freeze({
        baseColor: '#176875',
        shallowColor: '#5bc6c7',
        deepColor: '#0b4654',
        horizonColor: '#ddf4f2',
        causticColor: '#69d9d7',
        alpha: 0.87,
        shallowAlpha: 0.25,
        deepAlpha: 0.78,
        luminance: 0.8,
        noiseIntensity: 0.0035,
        waterDepth: 7,
        reflectionStrength: 0.45,
        reflectionMix: 0.38,
        foamBlend: 0.04,
        causticScale: 0.007,
        shiny: 350,
        spec: 3.5
    }),
    III: Object.freeze({
        baseColor: '#526f4b',
        shallowColor: '#8da36a',
        deepColor: '#354d38',
        horizonColor: '#dce3c9',
        causticColor: '#779b67',
        alpha: 0.92,
        shallowAlpha: 0.38,
        deepAlpha: 0.87,
        luminance: 0.68,
        noiseIntensity: 0.006,
        waterDepth: 5.2,
        reflectionStrength: 0.34,
        reflectionMix: 0.3,
        foamBlend: 0.065,
        causticScale: 0.009,
        shiny: 270,
        spec: 2.7
    }),
    IV: Object.freeze({
        baseColor: '#6f673d',
        shallowColor: '#9c8d51',
        deepColor: '#4a432a',
        horizonColor: '#d9d0ad',
        causticColor: '#7f7447',
        alpha: 0.95,
        shallowAlpha: 0.52,
        deepAlpha: 0.93,
        luminance: 0.58,
        noiseIntensity: 0.009,
        waterDepth: 4,
        reflectionStrength: 0.26,
        reflectionMix: 0.24,
        foamBlend: 0.09,
        causticScale: 0.011,
        shiny: 210,
        spec: 2.1
    }),
    V: Object.freeze({
        baseColor: '#70502f',
        shallowColor: '#927045',
        deepColor: '#3e2d20',
        horizonColor: '#c7b394',
        causticColor: '#675035',
        alpha: 0.97,
        shallowAlpha: 0.65,
        deepAlpha: 0.97,
        luminance: 0.48,
        noiseIntensity: 0.013,
        waterDepth: 3.2,
        reflectionStrength: 0.18,
        reflectionMix: 0.18,
        foamBlend: 0.115,
        causticScale: 0.014,
        shiny: 150,
        spec: 1.6
    }),
    BAD_V: Object.freeze({
        baseColor: '#59412f',
        shallowColor: '#755f43',
        deepColor: '#2b221c',
        horizonColor: '#aa9b87',
        causticColor: '#493c30',
        alpha: 0.985,
        shallowAlpha: 0.78,
        deepAlpha: 0.99,
        luminance: 0.4,
        noiseIntensity: 0.018,
        waterDepth: 2.6,
        reflectionStrength: 0.12,
        reflectionMix: 0.13,
        foamBlend: 0.14,
        causticScale: 0.017,
        shiny: 105,
        spec: 1.2
    })
})

const QUALITY_ALIASES = Object.freeze({
    OFF: WATER_QUALITY_OFF,
    NONE: WATER_QUALITY_OFF,
    0: WATER_QUALITY_OFF,
    关闭: WATER_QUALITY_OFF,
    原始: WATER_QUALITY_OFF,
    自然: WATER_QUALITY_OFF,
    I: 'I',
    Ⅰ: 'I',
    1: 'I',
    一: 'I',
    清澈: 'I',
    II: 'II',
    Ⅱ: 'II',
    2: 'II',
    二: 'II',
    较清: 'II',
    III: 'III',
    Ⅲ: 'III',
    3: 'III',
    三: 'III',
    轻度浑浊: 'III',
    IV: 'IV',
    Ⅳ: 'IV',
    4: 'IV',
    四: 'IV',
    浑浊: 'IV',
    V: 'V',
    Ⅴ: 'V',
    5: 'V',
    五: 'V',
    重度浑浊: 'V',
    BADV: 'BAD_V',
    BAD_V: 'BAD_V',
    劣V: 'BAD_V',
    劣Ⅴ: 'BAD_V',
    劣五: 'BAD_V',
    极浑浊: 'BAD_V'
})

export function normalizeWaterQuality(value) {
    const source = value && typeof value === 'object' ? value.quality : value
    if (source === undefined || source === null || source === '') return WATER_QUALITY_OFF
    const key = String(source).trim().toUpperCase().replace(/\s+/g, '').replace(/水质/g, '').replace(/等级/g, '').replace(/类/g, '')
    return QUALITY_ALIASES[key] || WATER_QUALITY_OFF
}

export function getWaterQualityPreset(value) {
    return WATER_QUALITY_PRESETS[normalizeWaterQuality(value)] || null
}
