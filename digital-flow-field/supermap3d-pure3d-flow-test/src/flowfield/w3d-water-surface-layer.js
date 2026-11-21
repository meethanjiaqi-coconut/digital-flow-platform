/* global SuperMap3D, w3d */
import { LEVEL_COLOR_STOPS, SPEED_COLOR_STOPS } from './flow-color-ramps'
import { getWaterQualityPreset, normalizeWaterQuality, WATER_QUALITY_OFF } from './water-quality-presets'

const GRID_TYPE_INDEX_BUFFER = 3
const WET_THRESHOLD = 0.22
const MIN_VISIBLE_VALUE = 0.0001
// W3D 以 0 判断是否跳过高级水材质；极小非零值可启用动态法线，同时不把专题色混成 baseColor。
const THEMATIC_WATER_MIX = 0.0001
const INTERPOLATION_STEP = 1 / 30
const W3D_COLOR_TABLE = new URL('./libs/SuperMap3D/Assets/Data/colorTable.png', document.baseURI).href
const W3D_COLOR_TABLE_2 = new URL('./libs/SuperMap3D/Assets/Data/colorTable2.png', document.baseURI).href

function installWebMercatorProjection() {
    if (typeof window.proj4 === 'function') return
    window.proj4 = (source, target, coordinate) => {
        if (source !== 'EPSG:4326' || target !== 'EPSG:3857') {
            throw new Error(`W3D 暂不支持投影转换：${source} -> ${target}`)
        }
        const lon = Number(coordinate[0])
        const lat = Math.max(-85.05112878, Math.min(85.05112878, Number(coordinate[1])))
        const x = (lon * 20037508.34) / 180
        const y = (Math.log(Math.tan(((90 + lat) * Math.PI) / 360)) * 20037508.34) / Math.PI
        return [x, y]
    }
}

function cloneJulianDate(value) {
    return value ? SuperMap3D.JulianDate.clone(value) : value
}

function saveClock(clock) {
    return {
        startTime: cloneJulianDate(clock.startTime),
        stopTime: cloneJulianDate(clock.stopTime),
        currentTime: cloneJulianDate(clock.currentTime),
        multiplier: clock.multiplier,
        clockRange: clock.clockRange,
        shouldAnimate: clock.shouldAnimate
    }
}

function restoreClock(clock, state) {
    clock.startTime = cloneJulianDate(state.startTime)
    clock.stopTime = cloneJulianDate(state.stopTime)
    clock.currentTime = cloneJulianDate(state.currentTime)
    clock.multiplier = state.multiplier
    clock.clockRange = state.clockRange
    clock.shouldAnimate = state.shouldAnimate
}

/**
 * W3D 会注册自己的时钟事件；数字流场沿用现有控制器时钟，因此只保留 W3D 水面渲染能力。
 */
function captureClockListeners(clock) {
    const removers = []
    const patches = [clock.onTick, clock.onStop].map(event => {
        const original = event.addEventListener
        event.addEventListener = function (listener, scope) {
            const remove = original.call(event, listener, scope)
            if (typeof remove === 'function') removers.push(remove)
            return remove
        }
        return () => {
            event.addEventListener = original
        }
    })
    return {
        restore() {
            for (const restore of patches) restore()
        },
        removeCaptured() {
            for (const remove of removers) remove()
        }
    }
}

function fromIso8601(value, fallback) {
    if (!value) return cloneJulianDate(fallback)
    try {
        return SuperMap3D.JulianDate.fromIso8601(value)
    } catch {
        return cloneJulianDate(fallback)
    }
}

function textureSource(texture, view, width, height) {
    if (!texture || !view) return
    texture.copyFrom({ width, height, arrayBufferView: view })
}

function destroyTexture(texture, defaultTexture) {
    if (!texture || texture === defaultTexture || typeof texture.destroy !== 'function') return
    if (typeof texture.isDestroyed === 'function' && texture.isDestroyed()) return
    texture.destroy()
}

function waterColor(css) {
    return SuperMap3D.Color.fromCssColorString(css)
}

function createColorRampTexture(viewer, colors) {
    const canvas = document.createElement('canvas')
    canvas.width = 256
    canvas.height = 1
    const context = canvas.getContext('2d')
    const gradient = context.createLinearGradient(0, 0, canvas.width - 1, 0)
    const divisor = Math.max(colors.length - 1, 1)
    colors.forEach((color, index) => gradient.addColorStop(index / divisor, color))
    context.fillStyle = gradient
    context.fillRect(0, 0, canvas.width, canvas.height)
    return new SuperMap3D.Texture({ context: viewer.scene.context, source: canvas, flipY: false })
}

/**
 * 将现有网格和相邻两帧数据适配到 w3d.WaterFloodSimulation。
 *
 * 接口、帧格式和缓存策略均不变：W3D 不发起模型数据请求，也只持有当前帧和下一帧。
 */
export class W3dWaterSurfaceLayer {
    constructor(viewer, data) {
        if (!window.w3d || typeof w3d.WaterFloodSimulation !== 'function') {
            throw new Error('W3D 未加载，请检查 ./libs/w3d/w3d.umd.js')
        }
        this.viewer = viewer
        this.data = data
        this._show = true
        this._destroyed = false
        this._engine = null
        this._initialized = false
        this._exaggeration = 60
        this._palette = 0
        this._colorMode = 0
        this._waterQuality = WATER_QUALITY_OFF
        this._rawA = null
        this._rawB = null
        this._lastInterpolatedT = -1
        this._speedColorTexture = null
        this._levelColorTexture = null

        const stats = (data.meta && data.meta.stats) || {}
        this._levelMin = Number.isFinite(stats.levelMin) ? stats.levelMin : -3.5
        this._levelMax = Number.isFinite(stats.levelMax) ? stats.levelMax : 6.5
        this._speedMax = Number.isFinite(stats.speedMax) && stats.speedMax > 0 ? stats.speedMax : 2.5
        this._texWidth = 256
        this._texHeight = 256
        this._textureLength = this._texWidth * this._texHeight
        if (data.nNodes > this._textureLength) {
            throw new Error(`W3D 纹理容量不足：${data.nNodes} > ${this._textureLength}`)
        }

        this._stageA = new Float32Array(this._textureLength)
        this._stageB = new Float32Array(this._textureLength)
        this._uA = new Float32Array(this._textureLength)
        this._uB = new Float32Array(this._textureLength)
        this._vA = new Float32Array(this._textureLength)
        this._vB = new Float32Array(this._textureLength)
        this._wetA = new Uint8Array(data.nNodes)
        this._wetB = new Uint8Array(data.nNodes)
        this._stageInterpolated = new Float32Array(this._textureLength)
        this._uInterpolated = new Float32Array(this._textureLength)
        this._vInterpolated = new Float32Array(this._textureLength)

        this._initializeEngine()
    }

    get show() {
        return this._engine && this._engine.primitive ? this._engine.primitive.show : this._show
    }

    set show(value) {
        this._show = Boolean(value)
        if (this._engine && this._engine.primitive) this._engine.primitive.show = this._show
    }

    get waterQuality() {
        return this._waterQuality
    }

    _initializeEngine() {
        installWebMercatorProjection()
        const vertices = new Array(this.data.nNodes)
        for (let index = 0; index < this.data.nNodes; index++) {
            vertices[index] = [this.data.lon[index], this.data.lat[index], 0]
        }
        // W3D 会在索引末尾追加一个不可见三角形，因此必须传入独立的普通数组。
        const indices = Array.from(this.data.tri)
        const emptyA = new Float32Array(this.data.nNodes)
        const emptyB = new Float32Array(this.data.nNodes)
        const times = this.data.meta.times || []
        const startTime = fromIso8601(times[0], this.viewer.clock.currentTime)
        const stopFallback = SuperMap3D.JulianDate.addHours(startTime, 1, new SuperMap3D.JulianDate())
        const stopTime = fromIso8601(times[1], stopFallback)
        const clockState = saveClock(this.viewer.clock)
        const captured = captureClockListeners(this.viewer.clock)

        this._engine = new w3d.WaterFloodSimulation(this.viewer)
        try {
            this._engine.loadIndexBufferData(
                {
                    bufferData: { indices, vertices },
                    infoData: {
                        Depth: [emptyA, emptyB],
                        Stage: [emptyA, emptyB],
                        U: [emptyA, emptyB],
                        V: [emptyA, emptyB]
                    }
                },
                {
                    gridType: GRID_TYPE_INDEX_BUFFER,
                    drawIndex: 0,
                    drawCount: 2,
                    drawInterval: 60,
                    texWidth: this._texWidth,
                    texHeight: this._texHeight,
                    textureSize: this._texWidth,
                    minHeight: 0,
                    maxHeight: this._speedMax,
                    alpha: 0.92,
                    isAlpha: 0,
                    alphaLerp: true,
                    renderHeight: new SuperMap3D.Cartesian2(this._exaggeration, 0),
                    renderBaseHeight: 0,
                    offsetHeight: 0,
                    startTime,
                    stopTime,
                    showArrow: false,
                    showFlowField: false,
                    showArrowField: false,
                    // 当前基座会监听主场景相机；W3D 独立反射相机会与该监听冲突，因此保留折射水面但关闭额外反射通道。
                    showReflect: false,
                    showRefract: false,
                    reflectPlaneHeight: 0,
                    renderMode: 1,
                    renderPass: [2],
                    renderMode2: 1,
                    renderPass2: [],
                    baseColorType: 0.36,
                    sss: true,
                    fbm: false,
                    drawColors: W3D_COLOR_TABLE,
                    drawColors2: W3D_COLOR_TABLE_2
                }
            )
        } finally {
            captured.restore()
            captured.removeCaptured()
            restoreClock(this.viewer.clock, clockState)
        }

        this._engine._palyState = false
        this._engine.renderHeight = this._exaggeration
        this._engine.renderBaseHeight = 0
        this._configureMaterial()
        this.show = this._show
        this._initialized = true
    }

    _configureMaterial() {
        const material = this._engine.appearance && this._engine.appearance.material
        if (!material) return
        const uniforms = material.uniforms
        uniforms.u_baseColorType = 0.36
        uniforms.luminance = 0.62
        uniforms.u_mut = 0.58
        uniforms.u_noiseIntensity = 0.004
        uniforms.u_WaterDepth = 5.5
        uniforms.u_ReflectionFresnelPower = 4.5
        uniforms.u_ReflectionStrength = 0.42
        uniforms.u_ReflectionMix = 0.34
        uniforms.u_FoamFlow = true
        uniforms.u_FoamBlend = 0.08
        uniforms.u_FoamSpeed = 150
        uniforms.u_FoamScale = 18
        uniforms.u_FoamIntersectionFade = 8
        uniforms.u_causticScale = 0.008
        uniforms.u_causticSpeed = 75
        uniforms.u_causticIntersectionFade = 0.25
        uniforms.oceanFrequencyLowAltitude = 18000
        uniforms.oceanOneOverAmplitudeLowAltitude = 2.2
        uniforms.shiny = 280
        uniforms.spec = 2.8

        // 图例和 GPU 色带由同一组色标生成，专题模式不再叠加游戏水色。
        this._speedColorTexture = createColorRampTexture(this.viewer, SPEED_COLOR_STOPS)
        this._levelColorTexture = createColorRampTexture(this.viewer, LEVEL_COLOR_STOPS)

        if (material._uniforms) {
            material._uniforms.u_colorTable = () => {
                if (this._colorMode === 1) return this._levelColorTexture
                return this._speedColorTexture || this.viewer.scene.context.defaultTexture
            }
        }
        this._applyPalette()
    }

    _applyPalette() {
        if (!this._engine || !this._engine.appearance) return
        const uniforms = this._engine.appearance.material.uniforms
        const qualityPreset = this._colorMode === 2 ? getWaterQualityPreset(this._waterQuality) : null

        // 每次完整恢复默认水材质参数，保证从浑浊水质切回普通配色时没有残留。
        uniforms.u_alpha = 0.92
        uniforms.luminance = 0.62
        uniforms.u_mut = 0.58
        uniforms.u_noiseIntensity = 0.004
        uniforms.u_WaterDepth = 5.5
        uniforms.u_ReflectionStrength = 0.42
        uniforms.u_ReflectionMix = 0.34
        uniforms.u_FoamBlend = 0.08
        uniforms.u_causticScale = 0.008
        uniforms.shiny = 280
        uniforms.spec = 2.8

        if (this._colorMode !== 2) {
            // 专题色仍由流速/水位色带决定；黑色水体项只贡献动态法线、高光和少量流动泡沫。
            // 这样保留游戏水面的运动感，同时避免自然水色覆盖专题分级颜色。
            const detailColor = waterColor('#000000')
            uniforms.baseColor = detailColor
            uniforms.u_WaterShallowColor = detailColor
            uniforms.u_WaterDeepColor = detailColor
            uniforms.u_HorizonColor = detailColor
            uniforms.u_causticColor = detailColor
            uniforms.u_WaterShallowColorAlpha = 1
            uniforms.u_WaterDeepColorAlpha = 1
            uniforms.luminance = 0.9
            uniforms.u_mut = 1
            uniforms.u_noiseIntensity = 0.0025
            uniforms.u_ReflectionStrength = 0
            uniforms.u_ReflectionMix = 0
            uniforms.u_FoamBlend = 0.035
            uniforms.u_causticScale = 0.008
            uniforms.shiny = 340
            uniforms.spec = 3.2
            uniforms.u_baseColorType = THEMATIC_WATER_MIX
            return
        }

        if (qualityPreset) {
            uniforms.baseColor = waterColor(qualityPreset.baseColor)
            uniforms.u_WaterShallowColor = waterColor(qualityPreset.shallowColor)
            uniforms.u_WaterDeepColor = waterColor(qualityPreset.deepColor)
            uniforms.u_HorizonColor = waterColor(qualityPreset.horizonColor)
            uniforms.u_causticColor = waterColor(qualityPreset.causticColor)
            uniforms.u_alpha = qualityPreset.alpha
            uniforms.u_WaterShallowColorAlpha = qualityPreset.shallowAlpha
            uniforms.u_WaterDeepColorAlpha = qualityPreset.deepAlpha
            uniforms.luminance = qualityPreset.luminance
            uniforms.u_noiseIntensity = qualityPreset.noiseIntensity
            uniforms.u_WaterDepth = qualityPreset.waterDepth
            uniforms.u_ReflectionStrength = qualityPreset.reflectionStrength
            uniforms.u_ReflectionMix = qualityPreset.reflectionMix
            uniforms.u_FoamBlend = qualityPreset.foamBlend
            uniforms.u_causticScale = qualityPreset.causticScale
            uniforms.shiny = qualityPreset.shiny
            uniforms.spec = qualityPreset.spec
        } else if (this._palette === 1) {
            uniforms.baseColor = waterColor('#07549a')
            uniforms.u_WaterShallowColor = waterColor('#38bde8')
            uniforms.u_WaterDeepColor = waterColor('#032a62')
            uniforms.u_HorizonColor = waterColor('#d9f4ff')
            uniforms.u_causticColor = waterColor('#082a3d')
        } else {
            uniforms.baseColor = waterColor('#0a4851')
            uniforms.u_WaterShallowColor = waterColor('#438b7d')
            uniforms.u_WaterDeepColor = waterColor('#052c3d')
            uniforms.u_HorizonColor = waterColor('#d7e9ed')
            uniforms.u_causticColor = waterColor('#082c2b')
        }
        if (!qualityPreset) {
            uniforms.u_WaterShallowColorAlpha = 0.42
            uniforms.u_WaterDeepColorAlpha = 0.92
        }
        uniforms.u_baseColorType = 1
    }

    setFrames(frameA, frameB) {
        if (this._destroyed || !this._initialized) return
        const expected = this.data.nNodes * 4
        if (!frameA || !frameB || frameA.length < expected || frameB.length < expected) {
            throw new Error(`W3D 节点帧长度错误，期望至少 ${expected}`)
        }
        this._rawA = frameA
        this._rawB = frameB
        for (let index = 0; index < this.data.nNodes; index++) {
            const offset = index * 4
            const wetA = Number.isFinite(frameA[offset + 3]) && frameA[offset + 3] >= WET_THRESHOLD
            const wetB = Number.isFinite(frameB[offset + 3]) && frameB[offset + 3] >= WET_THRESHOLD
            this._wetA[index] = wetA ? 1 : 0
            this._wetB[index] = wetB ? 1 : 0
            this._stageA[index] = wetA && Number.isFinite(frameA[offset]) ? frameA[offset] : 0
            this._stageB[index] = wetB && Number.isFinite(frameB[offset]) ? frameB[offset] : 0
            this._uA[index] = wetA && Number.isFinite(frameA[offset + 1]) ? frameA[offset + 1] : 0
            this._uB[index] = wetB && Number.isFinite(frameB[offset + 1]) ? frameB[offset + 1] : 0
            this._vA[index] = wetA && Number.isFinite(frameA[offset + 2]) ? frameA[offset + 2] : 0
            this._vB[index] = wetB && Number.isFinite(frameB[offset + 2]) ? frameB[offset + 2] : 0
        }
        this._writeColorFrames()
        this._lastInterpolatedT = -1
        this.setT(0, true)
    }

    _writeColorFrames() {
        const depthA = this._engine._waterDepthViews[0]
        const depthB = this._engine._waterDepthViews[1]
        let maxPhysicalDepth = 0
        for (let index = 0; index < this.data.nNodes; index++) {
            if (this._colorMode === 1) {
                depthA[index] = this._wetA[index] ? Math.max(this._stageA[index] - this._levelMin, MIN_VISIBLE_VALUE) : 0
                depthB[index] = this._wetB[index] ? Math.max(this._stageB[index] - this._levelMin, MIN_VISIBLE_VALUE) : 0
            } else if (this._colorMode === 0) {
                depthA[index] = this._wetA[index] ? Math.max(Math.hypot(this._uA[index], this._vA[index]), MIN_VISIBLE_VALUE) : 0
                depthB[index] = this._wetB[index] ? Math.max(Math.hypot(this._uB[index], this._vB[index]), MIN_VISIBLE_VALUE) : 0
            } else {
                const physicalDepthA = this._wetA[index] ? Math.max(this._stageA[index] - this.data.zb[index], MIN_VISIBLE_VALUE) : 0
                const physicalDepthB = this._wetB[index] ? Math.max(this._stageB[index] - this.data.zb[index], MIN_VISIBLE_VALUE) : 0
                depthA[index] = physicalDepthA
                depthB[index] = physicalDepthB
                maxPhysicalDepth = Math.max(maxPhysicalDepth, physicalDepthA, physicalDepthB)
            }
        }
        this._engine._minHeight = 0
        this._engine._maxHeight =
            this._colorMode === 1
                ? Math.max(this._levelMax - this._levelMin, 0.01)
                : this._colorMode === 2
                  ? Math.max(maxPhysicalDepth, 0.01)
                  : this._speedMax
        textureSource(this._engine._waterDepthTexture, depthA, this._texWidth, this._texHeight)
        textureSource(this._engine._waterDepthNextTexture, depthB, this._texWidth, this._texHeight)
    }

    setT(value, force = false) {
        if (this._destroyed || !this._initialized || !this._rawA) return
        const t = Math.max(0, Math.min(1, Number(value) || 0))
        this._engine._lerpNum = t
        if (!force && Math.abs(t - this._lastInterpolatedT) < INTERPOLATION_STEP && t !== 0 && t !== 1) return

        const inverse = 1 - t
        for (let index = 0; index < this.data.nNodes; index++) {
            this._stageInterpolated[index] = this._stageA[index] * inverse + this._stageB[index] * t
            this._uInterpolated[index] = this._uA[index] * inverse + this._uB[index] * t
            this._vInterpolated[index] = this._vA[index] * inverse + this._vB[index] * t
        }
        this._engine._currentWaterStageView = this._stageInterpolated
        this._engine._currentWaterVelocityXView = this._uInterpolated
        this._engine._currentWaterVelocityYView = this._vInterpolated
        textureSource(this._engine._waterStageTexture, this._stageInterpolated, this._texWidth, this._texHeight)
        textureSource(this._engine._waterUV_UTexture, this._uInterpolated, this._texWidth, this._texHeight)
        textureSource(this._engine._waterUV_VTexture, this._vInterpolated, this._texWidth, this._texHeight)
        this._lastInterpolatedT = t
    }

    setExaggeration(value) {
        this._exaggeration = Math.max(0, Number(value) || 0)
        if (this._engine) this._engine.renderHeight = this._exaggeration
    }

    setPalette(value) {
        this._palette = Number(value) === 1 ? 1 : 0
        this._applyPalette()
        this.viewer.scene.requestRender && this.viewer.scene.requestRender()
    }

    /**
     * 切换水质视觉效果。支持 I~V、Ⅰ~Ⅴ、1~5、劣V及中文描述。
     * 水质只在“不着色”模式生效，避免改变流速/水位专题色带。
     */
    setWaterQuality(value) {
        this._waterQuality = normalizeWaterQuality(value)
        if (this._waterQuality !== WATER_QUALITY_OFF) this._colorMode = 2
        this._applyPalette()
        this.viewer.scene.requestRender && this.viewer.scene.requestRender()
        return this._waterQuality
    }

    setColorMode(value) {
        const mode = Number(value)
        this._colorMode = mode === 1 || mode === 2 ? mode : 0
        this._applyPalette()
        if (!this._rawA) return
        this._writeColorFrames()
        this.viewer.scene.requestRender && this.viewer.scene.requestRender()
    }

    destroy() {
        if (this._destroyed) return
        this._destroyed = true
        const engine = this._engine
        if (engine) {
            if (typeof engine.disposeListener === 'function') engine.disposeListener()
            const defaultTexture = this.viewer.scene.context.defaultTexture
            const extraTextures = new Set([
                engine._waterNormalMap,
                engine._colorTable,
                engine._colorTable2,
                this._speedColorTexture,
                this._levelColorTexture
            ])
            const shouldAnimate = this.viewer.clock.shouldAnimate
            engine.destroy()
            this.viewer.clock.shouldAnimate = shouldAnimate
            for (const texture of extraTextures) destroyTexture(texture, defaultTexture)
        }
        this._engine = null
        this._speedColorTexture = null
        this._levelColorTexture = null
        this._rawA = null
        this._rawB = null
        this._stageA = null
        this._stageB = null
        this._uA = null
        this._uB = null
        this._vA = null
        this._vB = null
        this._stageInterpolated = null
        this._uInterpolated = null
        this._vInterpolated = null
    }
}
