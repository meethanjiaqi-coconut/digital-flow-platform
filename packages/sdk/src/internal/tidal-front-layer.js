import { SuperMap3D } from './runtime.js'
/* global SuperMap3D */
import { tidalGeometry, interpolateTidalTrack, locateTidalSection } from './tidalEvolution.js'

function createTidalFrontMarkerCanvas() {
    const canvas = document.createElement('canvas')
    const size = 96
    const context = canvas.getContext('2d')
    canvas.width = size
    canvas.height = size
    context.scale(size / 48, size / 48)
    context.shadowColor = 'rgba(2, 17, 42, 0.38)'
    context.shadowBlur = 4
    context.shadowOffsetY = 2
    context.fillStyle = '#174b99'
    context.beginPath()
    context.arc(24, 21, 17, 0, Math.PI * 2)
    context.fill()
    context.shadowColor = 'transparent'
    context.fillStyle = '#174b99'
    context.beginPath()
    context.moveTo(17, 33)
    context.lineTo(24, 44)
    context.lineTo(31, 33)
    context.closePath()
    context.fill()
    context.fillStyle = '#f3a33b'
    context.beginPath()
    context.moveTo(13, 27)
    context.quadraticCurveTo(17, 25, 18.5, 19)
    context.quadraticCurveTo(22, 23, 25, 16)
    context.quadraticCurveTo(29, 23, 35, 20)
    context.lineTo(34, 29)
    context.quadraticCurveTo(27, 32, 20, 29)
    context.quadraticCurveTo(16, 28, 13, 29)
    context.closePath()
    context.fill()
    context.strokeStyle = '#ffd17a'
    context.lineWidth = 1.4
    context.lineCap = 'round'
    context.beginPath()
    context.moveTo(15, 31)
    context.quadraticCurveTo(21, 28, 27, 31)
    context.quadraticCurveTo(31, 32, 34, 30)
    context.stroke()
    return canvas
}

/** Marker only. The crest and foam now belong to the water material itself,
 * so all three displays share a curved river coordinate and scene occlusion. */
export class TidalFrontLayer {
    constructor(data, viewer) {
        this.data = data; this.viewer = viewer; this.geometry = tidalGeometry(data)
        this._show = true; this._destroyed = false; this._t = 0; this._exaggeration = 60
        this._active = false; this._intensity = 0; this._lastLabelT = -1
        this._markerImage = createTidalFrontMarkerCanvas()
        this._createFrontLabel(120.5, 30.3)
    }
    get show() { return this._show }
    set show(value) { this._show = Boolean(value); this._updateFrontLabel(true) }
    _createFrontLabel(longitude, latitude) {
        const renderer = SuperMap3D
        const options = {
            show: false,
            position: renderer.Cartesian3.fromDegrees(longitude, latitude, 0),
            billboard: {
                image: this._markerImage,
                width: 48,
                height: 48,
                verticalOrigin: renderer.VerticalOrigin.BOTTOM,
                disableDepthTestDistance: Number.POSITIVE_INFINITY
            },
            label: {
                text: '潮头位置',
                font: '600 14px Microsoft YaHei',
                fillColor: renderer.Color.fromCssColorString('#ffffff'),
                outlineColor: renderer.Color.fromCssColorString('#0f356f'),
                outlineWidth: 2,
                style: renderer.LabelStyle.FILL_AND_OUTLINE,
                showBackground: true,
                backgroundColor: renderer.Color.fromCssColorString('#10366f').withAlpha(0.9),
                backgroundPadding: new renderer.Cartesian2(8, 5),
                pixelOffset: new renderer.Cartesian2(0, -52),
                verticalOrigin: renderer.VerticalOrigin.BOTTOM,
                disableDepthTestDistance: Number.POSITIVE_INFINITY
            }
        }
        // Own the marker primitives directly. Using viewer.entities lazily creates
        // a host DataSourceDisplay collection that survives entity removal.
        this._markerPrimitives = new renderer.PrimitiveCollection()
        const billboards = this._markerPrimitives.add(new renderer.BillboardCollection({scene:this.viewer.scene}))
        const labels = this._markerPrimitives.add(new renderer.LabelCollection({scene:this.viewer.scene}))
        const billboard = billboards.add({...options.billboard,position:options.position,show:false})
        const label = labels.add({...options.label,position:options.position,show:false})
        this._labelEntity = Object.defineProperties({}, {
            show:{get:()=>billboard.show,set:value=>{billboard.show=value;label.show=value}},
            position:{get:()=>billboard.position,set:value=>{billboard.position=value;label.position=value}}
        })
    }

    setFrames(a, b) { this._frameA = a; this._frameB = b; this._updateFrontLabel(true) }
    setFrontFrames(a, b) {
        this._trackA = a?.track || null; this._trackB = b?.track || null
        this._frontCenterA = this._trackA; this._frontCenterB = this._trackB
        this.setT(this._t, true)
    }
    setT(t, force = false) {
        this._t = Math.max(0, Math.min(1, Number(t) || 0))
        this.front = interpolateTidalTrack(this._trackA, this._trackB, this._t, this.geometry.parameters)
        this._intensity = this.front.confidence
        this._active = this._intensity > 0.08 && Number.isFinite(this.front.longitude)
        this._updateFrontLabel(force)
    }
    setAnimationTime() {}
    get active() { return this.show && this._active }
    get intensity() { return this.active ? this._intensity : 0 }
    setExaggeration(value) { this._exaggeration = Math.max(0, Number(value) || 0); this._updateFrontLabel(true) }
    _updateFrontLabel(force = false) {
        if (!this._labelEntity) return
        this._labelEntity.show = this._show && this._active
        if (!this._labelEntity.show || !this._frameA || !this._frameB) return
        if (!force && Math.abs(this._t - this._lastLabelT) < 0.015) return
        const location = locateTidalSection(this.geometry, this.front, cell => {
            const count = this.data.cellNode[cell * 4] === this.data.cellNode[cell * 4 + 3] ? 3 : 4
            let wet = 0
            for (let i = 0; i < count; i++) {
                const n = this.data.cellNode[cell * 4 + i]
                wet += this._frameA[n * 4 + 3] * (1 - this._t) + this._frameB[n * 4 + 3] * this._t
            }
            return wet / count > 0.35
        })
        if (!location) { this._labelEntity.show = false; return }
        this.location = location
        const node = this.data.cellNode[location.cell * 4]
        const stage = this._frameA[node * 4] * (1 - this._t) + this._frameB[node * 4] * this._t
        const position = SuperMap3D.Cartesian3.fromDegrees(location.longitude, location.latitude, stage * this._exaggeration + 10)
        if (this._labelEntity.position?.setValue) this._labelEntity.position.setValue(position)
        else this._labelEntity.position = position
        this._lastLabelT = this._t
    }
    update(frameState) { if (!this._destroyed) this._markerPrimitives?.update(frameState) }
    isDestroyed() { return this._destroyed }
    destroy() {
        if (this._destroyed) return
        this._destroyed = true
        this._markerPrimitives?.destroy()
        this._markerPrimitives = null
        this._labelEntity = null; this._frameA = null; this._frameB = null
    }
}
