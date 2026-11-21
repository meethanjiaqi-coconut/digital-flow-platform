/**
 * 流场时钟与异步帧调度器。
 *
 * 相邻帧尚未到达时保持上一有效画面，并通过 buffering 通知界面；快速拖动时
 * 数据层会取消旧预取窗口中的请求。
 */
/* global performance */
export class FlowFieldController {
    constructor(viewer, data) {
        this.viewer = viewer
        this.data = data
        this.simHour = 0
        this.playing = true
        this.speed = 2
        this.exaggeration = 60
        this.palette = 0
        this.buffering = true
        this.layers = []
        this._frameA = -1
        this._requestedFrame = -1
        this._requestGeneration = 0
        this._displayRatio = 0
        this._lastNow = undefined
        this._listeners = new Set()
        this._onTick = this._onTick.bind(this)
        viewer.scene.preUpdate.addEventListener(this._onTick)
        this._ensurePair(0)
    }

    addLayer(layer) {
        this.layers.push(layer)
        if (this._frameA >= 0) this._frameA = -1
        this._ensurePair(Math.floor(this.simHour))
    }

    _onTick() {
        const now = performance.now()
        const elapsed = this._lastNow === undefined ? 0 : (now - this._lastNow) / 1000
        this._lastNow = now
        if (this.playing && elapsed > 0 && !this.buffering) {
            this.simHour += Math.min(elapsed, 0.1) * this.speed * 0.5
            if (this.simHour >= this.data.nFrames - 1) this.simHour = 0
            this._notify()
        }
        const first = Math.max(0, Math.min(this.data.nFrames - 2, Math.floor(this.simHour)))
        const ratio = Math.max(0, Math.min(1, this.simHour - first))
        if (first !== this._frameA) this._ensurePair(first)
        if (first === this._frameA) this._displayRatio = ratio
        for (const layer of this.layers) layer.setT && layer.setT(this._displayRatio)
        this.viewer.scene.requestRender && this.viewer.scene.requestRender()
    }

    async _ensurePair(first) {
        if (first === this._requestedFrame && this.buffering) return
        this._requestedFrame = first
        const generation = ++this._requestGeneration
        this.data.activateWindow(first)
        if (!this.data.hasFrame(first) || !this.data.hasFrame(first + 1)) {
            this.buffering = true
            this._notify()
        }
        try {
            const [a, b] = await Promise.all([this.data.nodeFrame(first), this.data.nodeFrame(first + 1)])
            if (generation !== this._requestGeneration) return
            this._frameA = first
            this._requestedFrame = -1
            this._displayRatio = Math.max(0, Math.min(1, this.simHour - first))
            for (const layer of this.layers) layer.setFrames && layer.setFrames(a, b)
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

    setHour(hour) {
        this.simHour = Math.max(0, Math.min(this.data.nFrames - 1, hour))
        const first = Math.max(0, Math.min(this.data.nFrames - 2, Math.floor(this.simHour)))
        this._ensurePair(first)
        this._notify()
    }

    timeLabel() {
        const first = Math.min(this.data.nFrames - 1, Math.floor(this.simHour))
        const date = new Date(Date.parse(this.data.meta.times[first]))
        date.setMinutes(date.getMinutes() + Math.round((this.simHour - first) * 60))
        const pad = value => String(value).padStart(2, '0')
        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(
            date.getMinutes()
        )}`
    }

    onChange(listener) {
        this._listeners.add(listener)
    }

    offChange(listener) {
        this._listeners.delete(listener)
    }

    _notify() {
        for (const listener of this._listeners) listener(this.simHour, this.buffering)
    }

    destroy() {
        this.viewer.scene.preUpdate.removeEventListener(this._onTick)
        for (const layer of this.layers) layer.destroy && layer.destroy()
        this.layers = []
        this._listeners.clear()
        this.data.destroy()
    }
}
