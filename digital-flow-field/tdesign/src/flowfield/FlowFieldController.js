/* global performance */
import { formatFlowTime, timeAtFrame } from './flowTime.js'
import { DEFAULT_FLOW_STRENGTH, normalizeFlowStrength } from './flowDynamics.js'
/** 1 倍每两秒播放一个输出间隔，5 分钟数据不会跳过中间真实帧。 */
export const BASE_PLAYBACK_FRAMES_PER_SECOND = 0.5
export const BASE_PLAYBACK_HOURS_PER_SECOND = BASE_PLAYBACK_FRAMES_PER_SECOND

/**
 * 流场时钟与异步帧调度器。
 *
 * 相邻帧尚未到达时保持上一有效画面，并通过 buffering 通知界面；快速拖动时
 * 数据层会取消旧预取窗口中的请求。
 */
export class FlowFieldController {
    constructor(viewer, data) {
        this.viewer = viewer
        this.data = data
        this.simHour = 0
        // simHour 保留已有调用名，实际语义始终是可插值帧序号。
        this.playing = true
        this.speed = 1
        this.flowStrength = DEFAULT_FLOW_STRENGTH
        this.exaggeration = 60
        this.palette = 0
        this.buffering = true
        this.layers = []
        this._frameA = -1
        this._requestedFrame = -1
        this._requestGeneration = 0
        this._displayRatio = 0
        this._frameDataA = null
        this._frameDataB = null
        this._tidalFrontFrameA = -1
        this._tidalFrontRequestedFrame = -1
        this._tidalFrontRequestGeneration = 0
        this._tidalFrontDataA = null
        this._tidalFrontDataB = null
        this._lastTidalFrontWaterActive = false
        this._lastTidalFrontWaterIntensity = -1
        this._destroyed = false
        this._lastNow = undefined
        this._animationTime = 0
        this._animationFrame = 0
        this._listeners = new Set()
        this._onTick = this._onTick.bind(this)
        this._onVisibilityChange = this._onVisibilityChange.bind(this)
        viewer.scene.preUpdate.addEventListener(this._onTick)
        if (typeof document !== 'undefined') document.addEventListener('visibilitychange', this._onVisibilityChange)
        this._ensurePair(0)
    }

    addLayer(layer) {
        this.layers.push(layer)
        layer.setFlowStrength?.(this.flowStrength)
        layer.setAnimationTime?.(this._animationTime, this._animationFrame)
        if (this._frameDataA && this._frameDataB) this._syncLayerFrames(layer)
        else this._ensurePair(Math.floor(this.simHour))
        if (layer === this.tidalFront && layer.show !== false) {
            this._ensureTidalFrontPair(Math.floor(this.simHour))
        }
        this.viewer.scene.requestRender?.()
    }

    setWaterVisible(isVisible) {
        if (!this.water) return
        const hadVisibleLayers = this._hasVisibleLayers()
        const wasVisible = this.water.show !== false
        const isWaterVisible = Boolean(isVisible)
        this.water.show = isWaterVisible
        if (!isWaterVisible) {
            this.water.showArrow = false
            this.setTidalFrontVisible(false)
        } else if (!wasVisible) this._syncLayerFrames(this.water)
        if (isWaterVisible) this._ensureTidalFrontPair(Math.floor(this.simHour))
        if (!hadVisibleLayers && isWaterVisible) this._lastNow = undefined
        this.viewer.scene.requestRender?.()
    }

    setWaterArrowVisible(isVisible) {
        if (this.water) this.water.showArrow = this.water.show !== false && Boolean(isVisible)
    }

    setWaterArrowScale(value) {
        this.water?.setArrowScale(value)
    }

    setTidalFrontVisible(isVisible) {
        if (!this.tidalFront) return
        const hadVisibleLayers = this._hasVisibleLayers()
        const wasVisible = this.tidalFront.show !== false
        const isFrontVisible = this.water?.show !== false && Boolean(isVisible)
        this.tidalFront.show = isFrontVisible
        if (!isFrontVisible) {
            this._tidalFrontRequestedFrame = -1
            this._tidalFrontRequestGeneration++
        } else if (!wasVisible) {
            this._syncLayerFrames(this.tidalFront)
            this._ensureTidalFrontPair(Math.floor(this.simHour))
        }
        if (!hadVisibleLayers && isFrontVisible) this._lastNow = undefined
        if (this._needsTidalFrontData()) this._ensureTidalFrontPair(Math.floor(this.simHour))
        this._syncTidalFrontWaterEffect(true)
        this._notify()
        this.viewer.scene.requestRender?.()
    }

    setParticlesVisible(isVisible) {
        if (!this.particles) return
        const hadVisibleLayers = this._hasVisibleLayers()
        const wasVisible = this.particles.show !== false
        const areParticlesVisible = Boolean(isVisible)
        this.particles.show = areParticlesVisible
        if (areParticlesVisible && !wasVisible) this._syncLayerFrames(this.particles)
        if (!hadVisibleLayers && areParticlesVisible) this._lastNow = undefined
        this.viewer.scene.requestRender?.()
    }

    setParticleCount(dimension) {
        this.particles?.setCount(dimension)
    }

    setParticleWidth(width) {
        this.particles?.setWidth(width)
    }

    setParticleTrailDuration(seconds) {
        return this.particles?.setTrailDuration(seconds)
    }

    resetParticleStyle() {
        this.particles?.resetStyle()
    }

    setFlowStrength(value) {
        this.flowStrength = normalizeFlowStrength(value)
        for (const layer of this.layers) layer.setFlowStrength?.(this.flowStrength)
        this.viewer.scene.requestRender?.()
        return this.flowStrength
    }

    setExaggeration(value) {
        this.exaggeration = value
        this.water?.setExaggeration(value)
        this.tidalFront?.setExaggeration(value)
        this.particles?.setExaggeration(value)
    }

    setColorMode(value) {
        this.water?.setColorMode(value)
    }

    setPalette(value) {
        this.palette = value
        this.water?.setPalette(value)
    }

    setWaterQuality(value) {
        const quality = this.water?.setWaterQuality(value)
        if (quality && quality !== 'off') this.setTidalTurbidityEnabled(false)
        return quality
    }

    setTidalTurbidityEnabled(value) {
        this.water?.setTidalTurbidityEnabled(value)
        if (value) {
            this.water?.setWaterQuality('off')
            this.setPalette(0)
            this.setColorMode(2)
            this._syncLayerFrames(this.water)
            this._ensureTidalFrontPair(Math.floor(this.simHour))
        }
        this._notify()
    }

    _needsTidalFrontData() {
        return Boolean(this.tidalFront?.show === true || (this.water?.show !== false && this.water?.tidalTurbidityEnabled))
    }

    _hasVisibleLayers() {
        return this.layers.some(layer => layer?.show !== false)
    }

    _isPageHidden() {
        return typeof document !== 'undefined' && document.hidden
    }

    _onVisibilityChange() {
        this._lastNow = undefined
        if (!this._isPageHidden() && this._hasVisibleLayers()) this.viewer.scene.requestRender?.()
    }

    _syncLayerFrames(layer) {
        if (!layer || layer.show === false || !this._frameDataA || !this._frameDataB) return
        layer.setFrames?.(this._frameDataA, this._frameDataB)
        if ((layer === this.tidalFront || layer === this.water) && this._tidalFrontFrameA === this._frameA && this._tidalFrontDataA && this._tidalFrontDataB) {
            layer.setFrontFrames?.(this._tidalFrontDataA, this._tidalFrontDataB)
        } else if (layer === this.water) {
            // A hidden water surface may have missed several model frames.
            // Keep its original colour until the matching front has arrived.
            layer.setFrontFrames?.(null, null)
        }
        layer.setT?.(this._displayRatio)
    }

    _syncTidalFrontWaterEffect(force = false) {
        const active = Boolean(this.water?.show !== false && this.tidalFront?.active === true)
        const intensity = active ? this.tidalFront.intensity : 0
        if (!force && active === this._lastTidalFrontWaterActive && Math.abs(intensity - this._lastTidalFrontWaterIntensity) < 0.04) {
            return false
        }
        this._lastTidalFrontWaterActive = active
        this._lastTidalFrontWaterIntensity = intensity
        this.water?.setTidalFrontState?.(active, intensity)
        return true
    }

    setPlaying(value) {
        this.playing = Boolean(value)
        this._lastNow = undefined
        this._notify()
        this.viewer.scene.requestRender?.()
    }

    _onTick() {
        if (this._isPageHidden() || !this._hasVisibleLayers()) {
            this._lastNow = undefined
            return
        }
        const now = performance.now()
        const elapsed = this._lastNow === undefined ? 0 : (now - this._lastNow) / 1000
        this._lastNow = now
        // 保持原有特效节奏：粒子/潮头按实际秒数、水面按渲染帧数；仅暂停时冻结。
        if (this.playing) {
            this._animationTime += Math.max(0, Math.min(elapsed, 0.1))
            this._animationFrame++
        }
        if (this.playing && elapsed > 0 && !this.buffering) {
            this.simHour += Math.min(elapsed, 0.1) * this.speed * BASE_PLAYBACK_FRAMES_PER_SECOND
            if (this.simHour >= this.data.nFrames - 1) this.simHour = 0
        }
        const first = Math.max(0, Math.min(this.data.nFrames - 2, Math.floor(this.simHour)))
        const ratio = Math.max(0, Math.min(1, this.simHour - first))
        if (first !== this._frameA) this._ensurePair(first)
        if (first === this._frameA) this._displayRatio = ratio
        for (const layer of this.layers) {
            if (layer?.show !== false) layer.setT?.(this._displayRatio)
            layer.setAnimationTime?.(this._animationTime, this._animationFrame)
        }
        this._syncTidalFrontWaterEffect()
        this._notify()
        this.viewer.scene.requestRender && this.viewer.scene.requestRender()
    }

    async _ensurePair(first) {
        if (this._destroyed) return
        const second = Math.min(this.data.nFrames - 1, first + 1)
        if (first === this._requestedFrame && this.buffering) return
        this._requestedFrame = first
        const generation = ++this._requestGeneration
        this.data.activateWindow(first)
        if (first !== this._frameA) {
            this.buffering = true
            this._notify()
        }
        try {
            const needsFront = this._needsTidalFrontData()
            const [a, b, frontA, frontB] = await Promise.all([
                this.data.nodeFrame(first), this.data.nodeFrame(second),
                needsFront ? this.data.tidalFrontFrame(first) : null,
                needsFront ? this.data.tidalFrontFrame(second) : null
            ])
            if (generation !== this._requestGeneration) return
            this._frameA = first
            this._requestedFrame = -1
            this._displayRatio = Math.max(0, Math.min(1, this.simHour - first))
            this._frameDataA = a
            this._frameDataB = b
            if (frontA && frontB) {
                this._tidalFrontRequestGeneration++
                this._tidalFrontRequestedFrame = -1
                this._tidalFrontFrameA = first
                this._tidalFrontDataA = frontA
                this._tidalFrontDataB = frontB
            }
            for (const layer of this.layers) this._syncLayerFrames(layer)
            if (!frontA) this._ensureTidalFrontPair(first)
            this.buffering = false
            this._notify()
            this.viewer.scene.requestRender && this.viewer.scene.requestRender()
        } catch (error) {
            if (error.name === 'AbortError' || generation !== this._requestGeneration) return
            this._requestedFrame = -1
            this.buffering = true
            console.error('流场相邻帧加载失败', error)
            this._notify()
        }
    }

    async _ensureTidalFrontPair(first) {
        if (!this._needsTidalFrontData()) return
        const safeFirst = Math.max(0, Math.min(this.data.nFrames - 2, Math.floor(first)))
        if (this._tidalFrontFrameA === safeFirst && this._tidalFrontDataA && this._tidalFrontDataB) {
            if (this._frameA === safeFirst) {
                this._syncLayerFrames(this.tidalFront)
                this.water?.setFrontFrames?.(this._tidalFrontDataA, this._tidalFrontDataB)
            }
            return
        }
        if (this._tidalFrontRequestedFrame === safeFirst) return

        this._tidalFrontRequestedFrame = safeFirst
        const generation = ++this._tidalFrontRequestGeneration
        try {
            const [frontA, frontB] = await Promise.all([this.data.tidalFrontFrame(safeFirst), this.data.tidalFrontFrame(safeFirst + 1)])
            if (generation !== this._tidalFrontRequestGeneration || !this._needsTidalFrontData() || this._destroyed) {
                return
            }
            this._tidalFrontFrameA = safeFirst
            this._tidalFrontRequestedFrame = -1
            this._tidalFrontDataA = frontA
            this._tidalFrontDataB = frontB
            if (this._frameA === safeFirst) {
                this._syncLayerFrames(this.tidalFront)
                this.water?.setFrontFrames?.(frontA, frontB)
            }
            this._syncTidalFrontWaterEffect()
            this._notify()
            this.viewer.scene.requestRender?.()
        } catch (error) {
            if (generation !== this._tidalFrontRequestGeneration) return
            this._tidalFrontRequestedFrame = -1
            console.warn('潮头位置计算失败', error)
        }
    }

    setHour(hour) {
        if (!Number.isFinite(hour) || this._destroyed) return
        this.simHour = Math.max(0, Math.min(this.data.nFrames - 1, hour))
        const first = Math.max(0, Math.min(this.data.nFrames - 2, Math.floor(this.simHour)))
        this._ensurePair(first)
        this._notify()
    }

    get displayHour() {
        return this._frameA < 0 ? 0 : this._frameA + this._displayRatio
    }

    timeLabel() {
        return formatFlowTime(timeAtFrame(this.data.meta.times, this.displayHour))
    }

    onChange(listener) {
        this._listeners.add(listener)
    }

    offChange(listener) {
        this._listeners.delete(listener)
    }

    _notify() {
        const mix = this.water?._tidalMix
        const status = mix?.front?.status || 'unavailable'
        const tidalStatus = status === 'unavailable' && mix?.memoryMaximum > 0.05 ? 'residual' : status
        for (const listener of this._listeners) {
            listener(this.displayHour, this.buffering, this.tidalFront?.active === true, this.water?.tidalTurbidityActive === true, tidalStatus)
        }
    }

    destroy() {
        this._destroyed = true
        this._requestGeneration++
        this._tidalFrontRequestGeneration++
        this.water?.setTidalFrontState?.(false, 0)
        this.viewer.scene.preUpdate.removeEventListener(this._onTick)
        if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', this._onVisibilityChange)
        for (const layer of this.layers) layer.destroy && layer.destroy()
        this.layers = []
        this._frameDataA = null
        this._frameDataB = null
        this._tidalFrontDataA = null
        this._tidalFrontDataB = null
        this._listeners.clear()
        this.data.destroy()
    }
}
