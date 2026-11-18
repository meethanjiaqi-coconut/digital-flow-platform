from pathlib import Path
P = Path(__file__).resolve().parents[1]/'packages/sdk/src/internal'
def edit(name, change):
    p = P/name
    p.write_text(change(p.read_text(encoding='utf-8')), encoding='utf-8')
def replace(s, a, b):
    assert a in s, a[:120]
    return s.replace(a, b)
def data(s):
    start = s.index('function trimSlash(')
    end = s.index('    /**\n     * 保留旧静态二进制')
    s = s[:start] + '''export class FlowFieldData {
    static async load(provider, manifest, options = {}) {
        validateManifest(manifest)
        const mesh = await provider.getMesh(manifest, { signal: options.signal })
        options.signal?.throwIfAborted()
        const data = new FlowFieldData(manifest, mesh, provider, options)
        try {
            await Promise.all([data.frame(0, options), data.frame(Math.min(1, data.nFrames - 1), options)])
            options.signal?.throwIfAborted()
            return data
        } catch (error) { data.destroy(); throw error }
    }

''' + s[end:]
    s = "import { validateManifest } from '../validation.js'\n" + s
    s = replace(s, 'constructor(manifest, meshBuffer, apiBase) {', 'constructor(manifest, meshBuffer, provider, options = {}) {\n        this.options = options\n        this.tidalEnabled = Boolean(options.profile)\n        this.provider = provider')
    s = replace(s, 'this.apiBase = apiBase', "this.apiBase = provider ? 'provider' : ''")
    s = replace(s, 'this.tidalFrontPolygon = resolveTidalFrontPolygon(manifest)', 'this.tidalFrontPolygon = options.profile?.polygon || null')
    s = replace(s, 'this.tidalFrontAoi = resolveTidalFrontAoi(manifest, this.tidalFrontPolygon)', 'this.tidalFrontAoi = this.tidalEnabled ? resolveTidalFrontAoi({}, this.tidalFrontPolygon) : null')
    s = replace(s, 'const view = new DataView(meshBuffer)\n        if (view.getUint32', "if (!(meshBuffer instanceof ArrayBuffer) || meshBuffer.byteLength < 16) throw new Error('Invalid mesh buffer')\n        const view = new DataView(meshBuffer)\n        if (view.getUint32")
    s = replace(s, 'let offset = 16', "if (nNodes !== this.manifest.nNodes || nTris !== this.manifest.nTris) throw new Error('Mesh counts differ from manifest')\n        if (meshBuffer.byteLength !== 16 + nNodes * 12 + nTris * 6 + nCells * 16) throw new Error('Invalid mesh byte length')\n        let offset = 16")
    s = replace(s, 'this.cellLon = new Float32Array', "for (const node of this.tri) if (node >= nNodes) throw new Error('Triangle node out of range')\n        for (const node of this.cellNode) if (node >= nNodes) throw new Error('Cell node out of range')\n        this.cellLon = new Float32Array")
    s = replace(s, 'fetchBuffer(`${this.apiBase}/api/v1/scenarios/${encodeURIComponent(this.scenarioId)}/frames/${safeIndex}`, controller.signal)', 'this.provider.getFrame(this.manifest, safeIndex, { signal: controller.signal })')
    s = replace(s, '.then(buffer => {\n                if (buffer.byteLength', ".then(buffer => {\n                controller.signal.throwIfAborted()\n                if (this._destroyed) throw new DOMException('Destroyed', 'AbortError')\n                if (!(buffer instanceof ArrayBuffer)) throw new Error('Provider must return ArrayBuffer')\n                if (buffer.byteLength")
    s = replace(s, 'this._pendingFrames.delete(safeIndex)', 'if (this._pendingFrames.get(safeIndex)?.controller === controller) this._pendingFrames.delete(safeIndex)')
    s = replace(s, 'if (pending) {', 'if (pending && !pending.controller.signal.aborted) {')
    s = replace(s, 'this._nodeFrameCache.set(frame, result)', "if (this._destroyed) throw new DOMException('Destroyed', 'AbortError')\n                this._nodeFrameCache.set(frame, result)")
    s = replace(s, "if (typeof Worker === 'undefined') return", "if (this.options.worker === false || (typeof Worker === 'undefined' && !this.options.workerFactory)) return")
    s = replace(s, "new Worker(new URL('./flowFieldWorker.js', import.meta.url), { type: 'module' })", "this.options.workerFactory ? this.options.workerFactory() : new Worker(this.options.workerUrl || new URL('./flowFieldWorker.js', import.meta.url), { type: 'module' })")
    s = replace(s, 'const request = this._workerRequests.get(event.data.id)', '''if (event.data.type === 'requestFrame') {
                    const worker = this._worker, { requestId, index } = event.data
                    this.frame(index, { history: true }).then(values => {
                        if (this._destroyed || this._worker !== worker) return
                        const buffer = values.slice().buffer
                        worker.postMessage({ type: 'frameData', requestId, buffer }, [buffer])
                    }).catch(error => {
                        if (!this._destroyed && this._worker === worker) worker.postMessage({ type: 'frameError', requestId, error: error.message })
                    })
                    return
                }
                const request = this._workerRequests.get(event.data.id)''')
    s = replace(s, '                frameUrl: `${this.apiBase}/api/v1/scenarios/${encodeURIComponent(this.scenarioId)}/frames/`,\n', '')
    a = s.index('    async series(cell, signal) {')
    b = s.index('    _touch(map, key)', a)
    s = s[:a] + '''    async series(cell, signal) {
        if (this.provider.querySeries) return this.provider.querySeries(this.manifest, cell, { signal })
        const points = []
        for (let index = 0; index < this.nFrames; index++) {
            signal?.throwIfAborted()
            await this.frame(index, { signal, history: true })
            const value = this.cellValue(index, cell)
            points.push({ frameIndex: index, validTime: this.meta.times[index], dry: !value.wet, ...value })
        }
        return { scenarioId: this.scenarioId, cellIndex: cell, points }
    }

''' + s[b:]
    s = replace(s, 'destroy() {\n        this._destroyed = true', 'destroy() {\n        if (this._destroyed) return\n        this._destroyed = true\n        this._rawFrames.clear()\n        this._nodeFrameCache.clear()')
    return s
edit('FlowFieldData.js', data)
def worker(s):
    s = replace(s, 'let state', '''const frameRequests = new Map()
let frameRequestId = 0
function getFrame(index) {
    return new Promise((resolve, reject) => {
        const requestId = ++frameRequestId
        frameRequests.set(requestId, { resolve, reject })
        self.postMessage({ type: 'requestFrame', requestId, index })
    })
}
let state''')
    a = s.index('            const response = await fetch(')
    b = s.index('            if (buffer.byteLength', a)
    s = s[:a] + '            const buffer = await getFrame(index)\n' + s[b:]
    return replace(s, 'const message = event.data', '''const message = event.data
    if (message.type === 'frameData' || message.type === 'frameError') {
        const pending = frameRequests.get(message.requestId)
        frameRequests.delete(message.requestId)
        if (pending) message.type === 'frameData' ? pending.resolve(message.buffer) : pending.reject(new Error(message.error))
        return
    }''')
edit('flowFieldWorker.js', worker)
def water(s):
    s = "import { SuperMap3D, w3d } from './runtime.js'\n" + s
    s = replace(s, "'./flowColorRamps'", "'./flowColorRamps.js'")
    s = replace(s, "'./waterQualityPresets'", "'./waterQualityPresets.js'")
    s = replace(s, 'constructor(viewer, data) {', 'constructor(viewer, data, assets) {\n        this.assets = assets')
    s = replace(s, '!window.w3d ||', '!w3d ||')
    s = replace(s, 'W3D 未加载，请检查 /libs/w3d/w3d.umd.js', 'runtime.w3d.WaterFloodSimulation is required')
    s = replace(s, 'this._tidalTurbidityEnabled = true', 'this._tidalTurbidityEnabled = data.tidalEnabled')
    s = replace(s, '        this._initializeEngine()\n', '        try { this._initializeEngine() } catch (error) { this.destroy(); throw error }\n')
    s = replace(s, '        this._engine = new w3d.WaterFloodSimulation(this.viewer)\n        try {', '        try {\n            this._engine = new w3d.WaterFloodSimulation(this.viewer)')
    s = replace(s, "drawColors: '/libs/SuperMap3D/Assets/Data/colorTable.png'", 'drawColors: this.assets.colorTable')
    s = replace(s, "drawColors2: '/libs/SuperMap3D/Assets/Data/colorTable2.png'", 'drawColors2: this.assets.colorTable2')
    s = replace(s, 'image.src = `/textures/estuary/Water_${index + 1}_M_Normal.jpg`', "image.crossOrigin = 'anonymous'\n            image.src = this.assets.normals[index]")
    return s
edit('W3dWaterSurfaceLayer.js', water)
for name in ['ParticleFlowLayer.js', 'tidal-front-layer.js']:
    edit(name, lambda s: "import { SuperMap3D } from './runtime.js'\n" + s)
edit('ParticleFlowLayer.js', lambda s: replace(s, "                '_rampTex'", "                '_rampTex', '_fieldSP', '_updateSP', '_fadeSP', '_ribbonSP', '_compositeSP'"))
edit('tidalWaterMix.js', lambda s: replace(s, 'this.geometry = tidalGeometry(data)', 'this.geometry = data.tidalEnabled ? tidalGeometry(data) : { coordinates: new Float32Array(data.nNodes * 4) }'))
print('Extracted adapter boundaries and authenticated worker frame bridge')
