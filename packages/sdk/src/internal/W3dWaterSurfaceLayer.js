import { SuperMap3D, w3d } from './runtime.js'
/* global SuperMap3D, w3d */
import { LEVEL_COLOR_STOPS, SPEED_COLOR_STOPS } from './flowColorRamps.js'
import { addEstuaryWaterShading } from './estuaryWaterMaterial.js'
import { addEstuaryVertexShading } from './estuaryVertexShader.js'
import { TidalWaterMix } from './tidalWaterMix.js'
import { FlowDisplacement, ShorelineDistance, normalizeFlowStrength, DEFAULT_FLOW_STRENGTH } from './flowDynamics.js'
import { getWaterQualityPreset, normalizeWaterQuality, WATER_QUALITY_OFF } from './waterQualityPresets.js'

const GRID_TYPE_INDEX_BUFFER = 3
const WET_THRESHOLD = 0.22
const MIN_VISIBLE_VALUE = 0.0001
// W3D 以 0 判断是否跳过高级水材质；极小非零值可启用动态法线，同时不把专题色混成 baseColor。
const THEMATIC_WATER_MIX = 0.0001

const PLAIN_WATER_ARROW_MIX = 0.35
export const MIN_WATER_ARROW_SCALE = 1
export const MAX_WATER_ARROW_SCALE = 80
export const DEFAULT_WATER_ARROW_SCALE = 24
export const DEFAULT_WATER_FLOW_STRENGTH = DEFAULT_FLOW_STRENGTH

function normalizeWaterArrowScale(value) {
    const scale = Number(value)
    if (!Number.isFinite(scale)) return DEFAULT_WATER_ARROW_SCALE
    return Math.max(MIN_WATER_ARROW_SCALE, Math.min(MAX_WATER_ARROW_SCALE, scale))
}

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
    constructor(viewer, data, assets) {
        this.assets = assets
        if (!w3d || typeof w3d.WaterFloodSimulation !== 'function') {
            throw new Error('runtime.w3d.WaterFloodSimulation is required')
        }
        this.viewer = viewer
        this.data = data
        this._show = true
        this._destroyed = false
        this._engine = null
        this._initialized = false
        this._exaggeration = 60
        this._palette = 0
        this._colorMode = 2
        this._waterQuality = WATER_QUALITY_OFF
        this._showArrow = false
        this._arrowScale = DEFAULT_WATER_ARROW_SCALE
        this._tidalFrontActive = false
        this._flowStrength = DEFAULT_WATER_FLOW_STRENGTH
        this._flowTime = 0
        this._animationTime = 0
        this._animationFrame = 0
        this._rawA = null
        this._rawB = null
        this._lastInterpolatedT = -1
        this._speedColorTexture = null
        this._levelColorTexture = null
        this._naturalWaterColorTexture = null
        this._techWaterColorTexture = null

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

        this._tidalTurbidityEnabled = data.tidalEnabled
        this._tidalMix = new TidalWaterMix(data, this._textureLength)
        this._flow = new FlowDisplacement(data.nNodes, this._textureLength)
        this._shoreline = new ShorelineDistance(data)
        this._surfaceData = new Float32Array(this._textureLength * 4)
        this._wetInterpolated = new Float32Array(data.nNodes)
        this._waveAmplitude = 0.14
        this._sceneReflection = true
        this._surfaceUploadCount = 0
        try { this._initializeEngine() } catch (error) { this.destroy(); throw error }
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

    get showArrow() {
        return this._showArrow
    }

    set showArrow(value) {
        this._showArrow = Boolean(value)
        if (!this._engine) return
        this._engine.showArrow = this._showArrow
        this._applyWaterMix()
        this.viewer.scene.requestRender?.()
    }

    get arrowScale() {
        return this._arrowScale
    }

    /**
     * 使用面板中的放大倍数设置水面箭头尺寸。
     *
     * W3D 的 arrowSize 会缩放世界坐标，数值越小箭头越大，因此此处按用户感知做倒数换算。
     * @param {number} value 箭头放大倍数
     */
    setArrowScale(value) {
        this._arrowScale = normalizeWaterArrowScale(value)
        this._applyArrowScale()
        this.viewer.scene.requestRender?.()
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

        try {
            this._engine = new w3d.WaterFloodSimulation(this.viewer)
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
                    showArrow: this._showArrow,
                    showFlowField: false,
                    showArrowField: false,
                    // The shared map synchronizer cannot track W3D auxiliary cameras; keep reflection/refraction passes disabled.
                    showReflect: false,
                    showRefract: false,
                    reflectPlaneHeight: 0,
                    renderMode: 1,
                    renderPass: [2],
                    renderMode2: 1,
                    renderPass2: [],
                    baseColorType: 0.36,
                    sss: false,
                    fbm: false,
                    drawColors: this.assets.colorTable,
                    drawColors2: this.assets.colorTable2
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
        this._installSceneCapture()
        this._applyArrowScale()
        this.show = this._show
        this._initialized = true
    }

    _isMainCameraPass() {
        const active = this.viewer.scene.context.uniformState.view
        const main = this.viewer.camera.viewMatrix
        // SuperMap also renders built-in mirror/auxiliary passes. Capturing there
        // would overwrite main-scene depth and can erase foreground objects.
        for (let i = 0; i < 12; i++) if (Math.abs(active[i] - main[i]) > 1e-5) return false
        return true
    }

    _installSceneCapture() {
        const scene = this.viewer.scene
        // W3D installs a one-shot wrapper tied to the first shader command.
        // Replace it so regenerated log-depth/HDR commands keep fresh scene data.
        scene._waterPassEvent?.()
        const wrapped = new WeakSet()
        const layer = this
        const wrap = command => {
            if (!command || wrapped.has(command)) return
            wrapped.add(command)
            const execute = command.execute
            command.execute = function (context, passState) {
                // Derived commands may clone an already wrapped execute method.
                if (layer._insideWaterDraw) return execute.call(this, context, passState)
                layer._insideWaterDraw = true
                try {
                    if (!layer._destroyed && layer._sceneReflection && layer._isMainCameraPass()) {
                        const depth = scene.view.globeDepth
                        // The opaque pass already resolved MSAA. executeCopyDepth()
                        // resolves it again and overwrites subsequently drawn objects.
                        if (depth?._copyDepthCommand) {
                            depth._copyDepthCommand.execute(context, passState)
                            context.uniformState.globeDepthTexture = depth._globeDepthTexture
                        }
                        layer._captureSceneColour(context)
                    }
                    return execute.call(this, context, passState)
                } finally {
                    layer._insideWaterDraw = false
                }
            }
        }
        this._removeSceneCapture = scene.postUpdate.addEventListener(() => {
            if (this._destroyed) return
            const origin = SuperMap3D.Cartographic.fromCartesian(this.viewer.camera.positionWC)
            const ground = SuperMap3D.Cartesian3.fromRadians(origin.longitude, origin.latitude, 0)
            SuperMap3D.Transforms.eastNorthUpToFixedFrame(ground, SuperMap3D.Ellipsoid.WGS84, scene._worldENU)
            SuperMap3D.Matrix4.inverse(scene._worldENU, scene._cameraENU)
            for (const command of this._engine.primitive?._colorCommands || []) {
                wrap(command)
                const log = command.derivedCommands?.logDepth?.command
                wrap(log)
                wrap(command.derivedCommands?.hdr?.command)
                wrap(log?.derivedCommands?.hdr?.command)
            }
        })
        scene._waterPassEvent = this._removeSceneCapture
    }

    _captureSceneColour(context) {
        const S = SuperMap3D, width = context.drawingBufferWidth, height = context.drawingBufferHeight
        if (!this.viewer.scene.view.globeDepth?._colorTexture) return
        if (this._sceneColorTexture?.width !== width || this._sceneColorTexture?.height !== height) {
            this._sceneColorFramebuffer?.destroy()
            this._sceneColorTexture?.destroy()
            this._sceneColorTexture = new S.Texture({ context, width, height, pixelFormat: S.PixelFormat.RGBA,
                sampler: new S.Sampler({ minificationFilter: S.TextureMinificationFilter.LINEAR, magnificationFilter: S.TextureMagnificationFilter.LINEAR }) })
            this._sceneColorFramebuffer = new S.Framebuffer({ context, colorTextures: [this._sceneColorTexture], destroyAttachments: false })
        }
        if (!this._sceneColorCopy) {
            this._sceneColorCopy = context.createViewportQuadCommand(`
                uniform sampler2D u_scene;
                varying vec2 v_textureCoordinates;
                void main() { gl_FragColor = texture2D(u_scene, v_textureCoordinates); }
            `, { uniformMap: { u_scene: () => this.viewer.scene.view.globeDepth._colorTexture } })
        }
        // A dedicated copy supports HDR sources, without clearing shared targets.
        // Pair this with the fragment depth guard for SuperMap's WATER pass.
        this._sceneColorCopy.framebuffer = this._sceneColorFramebuffer
        this._sceneColorCopy.renderState = S.RenderState.fromCache({
            viewport: new S.BoundingRectangle(0, 0, width, height),
            depthTest: { enabled: false }, depthMask: false, blending: { enabled: false }
        })
        this._sceneColorCopy.execute(context)
    }

    _configureMaterial() {
        const material = this._engine.appearance && this._engine.appearance.material
        if (!material) return
        // W3D 默认使用场景帧号驱动波纹和泡沫，替换为流场自己的可暂停时钟。
        material.shaderSource = 'uniform float u_flowAnimationFrame;\n' + material.shaderSource.replace(/\bczm_frameNumber\b/g, 'u_flowAnimationFrame')
        material.shaderSource = addEstuaryWaterShading(material.shaderSource)
        this._engine.appearance._vertexShaderSource = addEstuaryVertexShading(this._engine.appearance.vertexShaderSource)
        const makeDataTexture = values => new SuperMap3D.Texture({
            context: this.viewer.scene.context,
            pixelFormat: SuperMap3D.PixelFormat.RGBA,
            pixelDatatype: SuperMap3D.PixelDatatype.FLOAT,
            flipY: false,
            source: { width: this._texWidth, height: this._texHeight, arrayBufferView: values },
            sampler: new SuperMap3D.Sampler({
                minificationFilter: SuperMap3D.TextureMinificationFilter.NEAREST,
                magnificationFilter: SuperMap3D.TextureMagnificationFilter.NEAREST
            })
        })
        this._tidalCoordinatesTexture = makeDataTexture(this._tidalMix.coordinates)
        const tidalFront = new SuperMap3D.Cartesian4()
        material._uniforms.u_ffTidalCoordinates = () => this._tidalCoordinatesTexture
        material._uniforms.u_ffTidalFront = () => {
            tidalFront.x = this._tidalMix.distance
            tidalFront.y = this._tidalTurbidityEnabled ? this._tidalMix.intensity : 0
            if (this._tidalFrontActive) tidalFront.y = this._tidalMix.intensity
            tidalFront.z = Math.max(180, Math.min(1150, (this._tidalMix.front?.width || 1500) * 0.24 + Math.abs(this._tidalMix.front?.speed || 0) * 85))
            tidalFront.w = this._tidalTurbidityEnabled ? 1 : 0
            return tidalFront
        }
        this._surfaceDataTexture = makeDataTexture(this._surfaceData)
        this._displacementTexture = makeDataTexture(this._flow.values)
        material._uniforms.u_refractTexture = () => this._sceneColorTexture || this.viewer.scene.context.defaultTexture
        material._uniforms.u_ffSurfaceData = () => this._surfaceDataTexture
        material._uniforms.u_ffDisplacement = () => this._displacementTexture
        material._uniforms.u_ffFlowBlend = () => this._flow.blend
        material._uniforms.u_ffWaveTime = () => this._animationTime
        material._uniforms.u_ffWaveAmplitude = () => this._waveAmplitude
        material._uniforms.u_ffSceneReflection = () => this._sceneReflection
        material._uniforms.u_estuaryWater = () => this._colorMode === 2 && this._palette === 0 && this._waterQuality === WATER_QUALITY_OFF
        material._uniforms.u_flowAnimationFrame = () => this._animationTime * 60
        // World-anchored octave crossfade: zooming changes detail, not texture coordinates.
        const waveLod = new SuperMap3D.Cartesian3()
        material._uniforms.u_estuaryWaveLod = () => {
            const height = Math.max(1, this.viewer.scene.camera.positionCartographic.height)
            const pixels = Math.max(1, this.viewer.scene.canvas.clientHeight)
            const octave = Math.log2(Math.max(128, Math.min(65536, height / pixels * 150)) / 256)
            const lower = Math.floor(octave)
            const fraction = octave - lower
            waveLod.x = 256 * Math.pow(2, lower)
            waveLod.y = waveLod.x * 2
            waveLod.z = fraction * fraction * (3 - 2 * fraction)
            return waveLod
        }
        this._loadEstuaryNormals(material)
        const uniforms = material.uniforms
        uniforms.u_baseColorType = 0.36
        uniforms.luminance = 0.78
        uniforms.u_mut = 0.28
        uniforms.u_noiseIntensity = 0.0006
        uniforms.u_WaterDepth = 3.5
        uniforms.u_ReflectionFresnelPower = 4.5
        uniforms.u_ReflectionStrength = 0.12
        uniforms.u_ReflectionMix = 0.12
        uniforms.u_FoamFlow = true
        uniforms.u_FoamBlend = 0
        uniforms.u_FoamSpeed = 150
        uniforms.u_FoamScale = 18
        uniforms.u_FoamIntersectionFade = 8
        uniforms.u_causticScale = 0.008
        uniforms.u_causticSpeed = 75
        uniforms.u_causticIntersectionFade = 0.25
        uniforms.oceanFrequencyLowAltitude = 55000
        uniforms.oceanOneOverAmplitudeLowAltitude = 12
        uniforms.oceanFrequencyHighAltitude = 12000
        uniforms.oceanOneOverAmplitudeHighAltitude = 16
        uniforms.oceanAnimationSpeedLowAltitude = 0.012
        uniforms.oceanAnimationSpeedHighAltitude = 0.006
        uniforms.shiny = 280
        uniforms.spec = 0.18

        // 图例和 GPU 色带由同一组色标生成，专题模式不再叠加游戏水色。
        this._speedColorTexture = createColorRampTexture(this.viewer, SPEED_COLOR_STOPS)
        this._levelColorTexture = createColorRampTexture(this.viewer, LEVEL_COLOR_STOPS)
        this._naturalWaterColorTexture = createColorRampTexture(this.viewer, ['#85816a', '#79775c', '#696e58', '#576659', '#405d55'])
        this._techWaterColorTexture = createColorRampTexture(this.viewer, ['#07549a', '#07549a'])

        if (material._uniforms) {
            material._uniforms.u_colorTable = () => {
                if (this._colorMode === 2) return this._palette === 1 ? this._techWaterColorTexture : this._naturalWaterColorTexture
                if (this._colorMode === 1) return this._levelColorTexture
                return this._speedColorTexture || this.viewer.scene.context.defaultTexture
            }
        }
        this._applyPalette()
    }

    _loadEstuaryNormals(material) {
        const context = this.viewer.scene.context
        const flat = new SuperMap3D.Texture({
            context,
            source: { width: 1, height: 1, arrayBufferView: new Uint8Array([128, 128, 255, 255]) }
        })
        this._estuaryNormalTextures = [flat, flat]
        this._estuaryFlatNormal = flat
        material._uniforms.u_estuaryNormal0 = () => this._estuaryNormalTextures[0]
        material._uniforms.u_estuaryNormal1 = () => this._estuaryNormalTextures[1]
        this._estuaryNormalsReady = Promise.all([0, 1].map(index => new Promise(resolve => {
            const image = new Image()
            image.onload = () => {
                if (this._destroyed) { resolve(false); return }
                try {
                    const texture = new SuperMap3D.Texture({
                        context, source: image, flipY: false,
                        sampler: new SuperMap3D.Sampler({
                            wrapS: SuperMap3D.TextureWrap.REPEAT,
                            wrapT: SuperMap3D.TextureWrap.REPEAT,
                            minificationFilter: SuperMap3D.TextureMinificationFilter.LINEAR_MIPMAP_LINEAR,
                            magnificationFilter: SuperMap3D.TextureMagnificationFilter.LINEAR
                        })
                    })
                    texture.generateMipmap()
                    this._estuaryNormalTextures[index] = texture
                    this.viewer.scene.requestRender?.()
                    resolve(true)
                } catch (error) {
                    console.warn('Estuary normal texture could not initialize', error)
                    resolve(false)
                }
            }
            image.onerror = () => { console.warn('Estuary normal texture could not load', image.src); resolve(false) }
            image.crossOrigin = 'anonymous'
            image.src = this.assets.normals[index]
        })))
    }
    _applyArrowScale() {
        if (!this._engine?.appearance?.material) return
        this._engine.arrowSize = 1 / this._arrowScale
    }

    _applyWaterMix() {
        if (!this._engine || !this._engine.appearance) return
        const uniforms = this._engine.appearance.material.uniforms
        // 不着色模式使用同色纹理承载箭头，既保留自然水色，也避免箭头被 100% 基础水色覆盖。
        uniforms.u_baseColorType = this._colorMode === 2 ? (this._showArrow ? PLAIN_WATER_ARROW_MIX : 1) : THEMATIC_WATER_MIX
    }

    _applyPalette() {
        if (!this._engine || !this._engine.appearance) return
        const uniforms = this._engine.appearance.material.uniforms
        const qualityPreset = this._colorMode === 2 ? getWaterQualityPreset(this._waterQuality) : null

        // 每次完整恢复默认水材质参数，保证从浑浊水质切回普通配色时没有残留。
        uniforms.u_alpha = 0.92
        uniforms.luminance = 0.78
        uniforms.u_mut = 0.28
        uniforms.u_noiseIntensity = 0.0006
        uniforms.u_WaterDepth = 3.5
        uniforms.u_ReflectionStrength = 0.12
        uniforms.u_ReflectionMix = 0.12
        uniforms.u_FoamBlend = 0
        uniforms.u_causticScale = 0.008
        uniforms.shiny = 280
        uniforms.spec = 0.18

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
            uniforms.luminance = 0.78
            uniforms.u_mut = 1
            uniforms.u_noiseIntensity = 0.0006
            uniforms.u_ReflectionStrength = 0
            uniforms.u_ReflectionMix = 0
            uniforms.u_FoamBlend = 0
            if (this._tidalFrontActive) uniforms.u_FoamBlend = 0
            uniforms.u_causticScale = 0.008
            uniforms.shiny = 340
            uniforms.spec = 0.12
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
            uniforms.baseColor = waterColor('#46594e')
            uniforms.u_WaterShallowColor = waterColor('#6d7259')
            uniforms.u_WaterDeepColor = waterColor('#334f47')
            uniforms.u_HorizonColor = waterColor('#8d9e95')
            uniforms.u_causticColor = waterColor('#000000')
        }
        if (!qualityPreset) {
            uniforms.u_WaterShallowColorAlpha = 0.9
            uniforms.u_WaterDeepColorAlpha = 0.98
        }
        if (this._tidalFrontActive) uniforms.u_FoamBlend = 0
        this._applyWaterMix()
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
        // Hold the last wet stage during shoreline fading instead of dropping
        // disappearing vertices to elevation zero.
        for (let i = 0; i < this.data.nNodes; i++) {
            if (!this._wetA[i] && this._wetB[i]) this._stageA[i] = this._stageB[i]
            if (this._wetA[i] && !this._wetB[i]) this._stageB[i] = this._stageA[i]
        }
        this._shoreA = this._shoreline.compute(this._wetA)
        this._shoreB = this._wetA.every((wet, i) => wet === this._wetB[i])
            ? this._shoreA : this._shoreline.compute(this._wetB)
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
                  ? Math.max(Math.min(maxPhysicalDepth, 30), 0.01) // Visual depth ramp only; physical stage/depth arrays are unchanged.
                  : this._speedMax
        textureSource(this._engine._waterDepthTexture, depthA, this._texWidth, this._texHeight)
        textureSource(this._engine._waterDepthNextTexture, depthB, this._texWidth, this._texHeight)
    }

    setT(value, force = false) {
        if (this._destroyed || !this._initialized || !this._rawA) return
        const t = Math.max(0, Math.min(1, Number(value) || 0))
        this._tidalMix.setT(t)
        this._engine._lerpNum = t
        if (!force && t === this._lastInterpolatedT) return

        const inverse = 1 - t
        for (let index = 0; index < this.data.nNodes; index++) {
            this._stageInterpolated[index] = this._stageA[index] * inverse + this._stageB[index] * t
            this._uInterpolated[index] = this._uA[index] * inverse + this._uB[index] * t
            this._vInterpolated[index] = this._vA[index] * inverse + this._vB[index] * t
            const wet = this._wetA[index] * inverse + this._wetB[index] * t
            this._wetInterpolated[index] = wet
            const depthA = this._wetA[index] ? Math.max(0, this._stageA[index] - this.data.zb[index]) : 0
            const depthB = this._wetB[index] ? Math.max(0, this._stageB[index] - this.data.zb[index]) : 0
            this._surfaceData[index * 4] = depthA * inverse + depthB * t
            this._surfaceData[index * 4 + 1] = wet
            this._surfaceData[index * 4 + 2] = this._shoreA[index] * inverse + this._shoreB[index] * t
            this._surfaceData[index * 4 + 3] = (this._tidalMix.memoryA?.[index] || 0) * inverse + (this._tidalMix.memoryB?.[index] || 0) * t
        }
        this._engine._currentWaterStageView = this._stageInterpolated
        this._engine._currentWaterVelocityXView = this._uInterpolated
        this._engine._currentWaterVelocityYView = this._vInterpolated
        textureSource(this._engine._waterStageTexture, this._stageInterpolated, this._texWidth, this._texHeight)
        textureSource(this._engine._waterUV_UTexture, this._uInterpolated, this._texWidth, this._texHeight)
        textureSource(this._engine._waterUV_VTexture, this._vInterpolated, this._texWidth, this._texHeight)
        textureSource(this._surfaceDataTexture, this._surfaceData, this._texWidth, this._texHeight)
        this._surfaceUploadCount++
        this._lastInterpolatedT = t
    }

    get tidalTurbidityEnabled() { return this._tidalTurbidityEnabled }

    get tidalTurbidityActive() {
        return this.show && this._tidalTurbidityEnabled && this._colorMode === 2 &&
            this._palette === 0 && this._waterQuality === WATER_QUALITY_OFF && (this._tidalMix.intensity > 0.02 || this._tidalMix.memoryMaximum > 0.05)
    }

    setTidalTurbidityEnabled(value) {
        this._tidalTurbidityEnabled = Boolean(value)
        this.viewer.scene.requestRender?.()
    }

    setFrontFrames(a, b) {
        if (this._destroyed) return
        this._tidalMix.setFrames(a, b)
        this.setT(Math.max(0, this._lastInterpolatedT), true)
        this.viewer.scene.requestRender?.()
    }

    get flowStrength() {
        return this._flowStrength
    }

    setFlowStrength(value) {
        this._flowStrength = normalizeFlowStrength(value)
        this._flow.strength = this._flowStrength
        this.viewer.scene.requestRender?.()
        return this._flowStrength
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

    setAnimationTime(seconds, frame) {
        const elapsed = Math.max(0, Math.min(0.1, seconds - this._animationTime))
        if (this.show && this._rawA && this._flow.advance(elapsed, this._uInterpolated, this._vInterpolated, this._wetInterpolated)) {
            textureSource(this._displacementTexture, this._flow.values, this._texWidth, this._texHeight)
        }
        this._flowTime = this._flow.time
        this._animationTime = seconds
        this._animationFrame = frame
    }

    setSceneReflection(value) {
        this._sceneReflection = Boolean(value)
        this.viewer.scene.requestRender?.()
    }

    setWaveAmplitude(value) {
        this._waveAmplitude = Math.max(0, Math.min(0.3, Number(value) || 0))
        this.viewer.scene.requestRender?.()
    }

    setTidalFrontState(active) {
        const nextActive = Boolean(active)
        if (this._tidalFrontActive === nextActive) return
        this._tidalFrontActive = nextActive
        // 潮头泡沫由局部覆盖层绘制，避免叠加整张水面的全局泡沫。
        this._applyPalette()
        this.viewer.scene.requestRender?.()
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
        this._removeSceneCapture?.()
        if (this.viewer.scene._waterPassEvent === this._removeSceneCapture) this.viewer.scene._waterPassEvent = undefined
        this._sceneColorCopy?.shaderProgram?.destroy()
        this._sceneColorFramebuffer?.destroy()
        this._sceneColorTexture?.destroy()
        const engine = this._engine
        if (engine) {
            if (typeof engine.disposeListener === 'function') engine.disposeListener()
            const defaultTexture = this.viewer.scene.context.defaultTexture
            const extraTextures = new Set([
                engine._waterNormalMap,
                engine._colorTable,
                engine._colorTable2,
                this._speedColorTexture,
                this._levelColorTexture,
                this._naturalWaterColorTexture,
                this._techWaterColorTexture,
                this._estuaryFlatNormal,
                this._surfaceDataTexture,
                this._tidalCoordinatesTexture,
                this._displacementTexture,
                ...(this._estuaryNormalTextures || [])
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
