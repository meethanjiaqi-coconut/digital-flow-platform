/**
 * 流场总控:模拟时钟(simHour 0..nFrames-1 浮点)、播放/倍速、
 * 跨整点时向注册图层推送双帧节点数据,每帧推送插值系数。
 */
export class FlowFieldController {
    constructor(viewer, data) {
        this.viewer = viewer
        this.data = data
        this.simHour = 0
        this.playing = true
        this.speed = 2 // 倍速;1× = 0.5 模型小时/真秒
        this.exaggeration = 60
        this.palette = 0 // 0=自然 1=科技蓝
        this.layers = []
        this._frameA = -1
        this._lastNow = undefined
        this._listeners = new Set()
        this._onTick = this._onTick.bind(this)
        viewer.scene.preUpdate.addEventListener(this._onTick)
    }

    addLayer(layer) {
        this.layers.push(layer)
        this._frameA = -1 // 强制下帧重推数据
    }

    _onTick() {
        const now = performance.now()
        const dt = this._lastNow === undefined ? 0 : (now - this._lastNow) / 1000
        this._lastNow = now
        if (this.playing && dt > 0) {
            this.simHour += Math.min(dt, 0.1) * this.speed * 0.5
            if (this.simHour >= this.data.nFrames - 1) this.simHour = 0
            this._notify()
        }
        const f0 = Math.max(0, Math.min(this.data.nFrames - 2, Math.floor(this.simHour)))
        const t = Math.max(0, Math.min(1, this.simHour - f0))
        if (f0 !== this._frameA) {
            this._frameA = f0
            const a = this.data.nodeFrame(f0)
            const b = this.data.nodeFrame(f0 + 1)
            for (const l of this.layers) l.setFrames && l.setFrames(a, b)
        }
        for (const l of this.layers) l.setT && l.setT(t)
        this.viewer.scene.requestRender && this.viewer.scene.requestRender()
    }

    setHour(h) {
        this.simHour = Math.max(0, Math.min(this.data.nFrames - 1, h))
        this._notify()
    }

    /** 当前时刻的展示文本(本地时间) */
    timeLabel() {
        const f0 = Math.min(this.data.nFrames - 1, Math.floor(this.simHour))
        const d = new Date(Date.parse(this.data.meta.times[f0]))
        d.setMinutes(d.getMinutes() + Math.round((this.simHour - f0) * 60))
        const p = (x) => String(x).padStart(2, '0')
        return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
    }

    onChange(fn) {
        this._listeners.add(fn)
    }
    offChange(fn) {
        this._listeners.delete(fn)
    }
    _notify() {
        for (const fn of this._listeners) fn(this.simHour)
    }

    destroy() {
        this.viewer.scene.preUpdate.removeEventListener(this._onTick)
        for (const l of this.layers) l.destroy && l.destroy()
        this.layers = []
        this._listeners.clear()
    }
}
