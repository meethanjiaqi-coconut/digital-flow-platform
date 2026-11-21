import { FlowError, toFlowError } from '../errors.js'
import { validateManifest } from '../validation.js'
import { normalizeSeriesResult } from './normalize.js'
import { aggregateSync, buildAdjacency, buildSpatialIndex, decodeMesh, pickCell } from './meshIndex.js'
import { resolveTidalFrontAoi, resolveTidalFrontPolygon } from './tidal-front-analysis.js'
import { TidalHistory } from './tidalHistory.js'
import { evaluateTidalBudget, getTidalAvailability } from './tidalAvailability.js'
/* global fetch, AbortController, Worker, URL */

/**
 * 风暴潮流场数据层。
 *
 * 首屏只加载 manifest、共享网格和前两帧；逐帧请求由 12 帧 LRU、预取窗口和
 * AbortController 管理。服务端响应虽然在磁盘上是 gzip，浏览器会按
 * Content-Encoding 自动解压，因此这里拿到的 ArrayBuffer 仍是原始二进制布局。
 */
const FRAME_MAGIC = 0x46464631
const RAW_CACHE_LIMIT = 12
const NODE_CACHE_LIMIT = 6
const abortedError = () => new DOMException('Operation superseded or destroyed', 'AbortError')

function decodeCell(data, values, cell) {
    if (!values) return null
    const levelRaw = values[cell]
    if (levelRaw === data.dry) return { level: null, u: null, v: null, wet: false }
    return {
        level: levelRaw * data.levelScale,
        u: values[data.nCells + cell] * data.uvScale,
        v: values[2 * data.nCells + cell] * data.uvScale,
        wet: true
    }
}

/** 复用旧场次网格：meshId 相同且字节长度与清单计数一致时返回其 ArrayBuffer。 */
function reusableMesh(reuse, manifest) {
    if (!reuse || reuse.meshId !== manifest?.mesh?.meshId || !(reuse._meshBuffer instanceof ArrayBuffer)) return undefined
    const expected = 16 + manifest.nNodes * 12 + manifest.nTris * 6 + manifest.nCells * 16
    return reuse._meshBuffer.byteLength === expected ? reuse._meshBuffer : undefined
}

export class FlowFieldData {
    static async load(provider, manifest, options = {}) {
        try {
            validateManifest(manifest)
            options.onProgress?.({ phase: 'mesh', loaded: 0, total: 1 })
            const mesh = reusableMesh(options.reuse, manifest) ?? await provider.getMesh(manifest, { signal: options.signal })
            options.onProgress?.({ phase: 'mesh', loaded: 1, total: 1 })
            options.signal?.throwIfAborted()
            const data = new FlowFieldData(manifest, mesh, provider, options)
            try {
                evaluateTidalBudget(data)
                let loaded = 0
                const track = promise => promise.then(value => {
                    loaded++
                    options.onProgress?.({ phase: 'frames', loaded, total: 2 })
                    return value
                })
                await Promise.all([track(data.frame(0, options)), track(data.frame(Math.min(1, data.nFrames - 1), options))])
                options.signal?.throwIfAborted()
                return data
            } catch (error) { data.destroy(); throw error }
        } catch (error) {
            throw toFlowError(error, 'scenario.load', 'INVALID_BINARY')
        }
    }

    /**
     * 保留旧静态二进制的测试入口，不参与生产加载。
     */
    static fromLegacy(meta, meshBuffer, framesBuffer) {
        const view = new DataView(framesBuffer)
        if (view.getUint32(0, true) !== FRAME_MAGIC) throw new Error('frames.bin 魔数错误')
        const nFrames = view.getUint32(4, true)
        const nCells = view.getUint32(8, true)
        const manifest = {
            scenarioId: 'legacy',
            mesh: { meshId: 'legacy' },
            nNodes: meta.nNodes,
            nCells,
            nTris: meta.nTris,
            nFrames,
            bbox: meta.bbox,
            scales: meta.scales,
            drySentinel: meta.drySentinel,
            frames: (meta.times || []).map((validTime, index) => ({ index, validTime })),
            stats: meta.stats
        }
        const data = new FlowFieldData(manifest, meshBuffer, '')
        const all = new Int16Array(framesBuffer, 12)
        for (let index = 0; index < nFrames; index++) {
            const begin = index * nCells * 3
            data._rawFrames.set(index, all.slice(begin, begin + nCells * 3))
        }
        return data
    }

    constructor(manifest, meshBuffer, provider, options = {}) {
        this.options = options
        this.tidalEnabled = Boolean(options.profile)
        this.provider = provider
        this.manifest = manifest
        this.meta = {
            ...manifest,
            times: manifest.frames.map(frame => frame.validTime),
            stats: manifest.stats || {}
        }
        this.apiBase = provider ? 'provider' : ''
        this.scenarioId = manifest.scenarioId
        this.meshId = manifest.mesh.meshId
        this.nFrames = manifest.nFrames
        this.nCells = manifest.nCells
        this.levelScale = manifest.scales.level
        this.uvScale = manifest.scales.uv
        this.dry = manifest.drySentinel
        this.bbox = manifest.bbox
        this._meshBuffer = meshBuffer
        this._rawFrames = new Map()
        this._pendingFrames = new Map()
        this._nodeFrameCache = new Map()
        this._nodePending = new Map()
        this.tidalFrontPolygon = options.profile?.polygon || null
        this.tidalFrontAoi = this.tidalEnabled ? resolveTidalFrontAoi({}, this.tidalFrontPolygon) : null
        this.tidalProfile = options.profile || null
        this.tidalAvailable = false
        this.tidalDisabledReason = null
        this._tidal = null
        this._workerRequests = new Map()
        this._workerSequence = 0
        this._workerFallbackWarned = false
        this._destroyed = false
        decodeMesh(this, meshBuffer)
        buildAdjacency(this)
        buildSpatialIndex(this)
        this._createWorker()
    }

    async frame(index, options = {}) {
        if (this._destroyed) throw new FlowError('DISPOSED', '流场数据已销毁')
        const safeIndex = Math.max(0, Math.min(this.nFrames - 1, index))
        const cached = this._touch(this._rawFrames, safeIndex)
        if (cached) return cached
        const pending = this._pendingFrames.get(safeIndex)
        if (pending && !pending.controller.signal.aborted) {
            if (options.history) pending.pinned = true
            return pending.promise
        }
        if (!this.apiBase) throw new FlowError('DATA_UNAVAILABLE', `旧数据入口未缓存第 ${safeIndex} 帧`)

        const controller = new AbortController()
        let abortHandler
        if (options.signal) {
            if (options.signal.aborted) controller.abort()
            else {
                abortHandler = () => controller.abort()
                options.signal.addEventListener('abort', abortHandler, { once: true })
            }
        }
        const promise = this.provider.getFrame(this.manifest, safeIndex, { signal: controller.signal })
            .then(buffer => {
                controller.signal.throwIfAborted()
                if (this._destroyed) throw abortedError()
                if (!(buffer instanceof ArrayBuffer)) throw new FlowError('INVALID_BINARY', '数据源必须返回 ArrayBuffer')
                if (buffer.byteLength !== this.nCells * 3 * 2) {
                    throw new FlowError('INVALID_BINARY', `第 ${safeIndex} 帧长度不符`)
                }
                const values = new Int16Array(buffer)
                this._rawFrames.set(safeIndex, values)
                this._trimLru(this._rawFrames, RAW_CACHE_LIMIT, this._activeWindow)
                return values
            })
            .finally(() => {
                if (this._pendingFrames.get(safeIndex)?.controller === controller) this._pendingFrames.delete(safeIndex)
                if (abortHandler) options.signal.removeEventListener('abort', abortHandler)
            })
        this._pendingFrames.set(safeIndex, { promise, controller, pinned: Boolean(options.history) })
        return promise
    }

    /**
     * 保留当前帧前 1、后 4 的请求；快速拖动时取消窗口外尚未完成的请求。
     */
    activateWindow(frameIndex) {
        if (this._destroyed) return
        const center = Math.max(0, Math.min(this.nFrames - 1, Math.floor(frameIndex)))
        const wanted = new Set()
        for (let index = center - 1; index <= center + 4; index++) {
            if (index >= 0 && index < this.nFrames) wanted.add(index)
        }
        this._activeWindow = wanted
        for (const [index, request] of this._pendingFrames) {
            if (!wanted.has(index) && !request.pinned) request.controller.abort()
        }
        for (const index of wanted) {
            this.frame(index).catch(error => {
                if (error.name !== 'AbortError') console.warn('流场帧预取失败', index, error)
            })
        }
    }

    hasFrame(index) {
        return this._rawFrames.has(index)
    }

    cellValue(frame, cell) {
        const values = this._touch(this._rawFrames, frame)
        return decodeCell(this, values, cell)
    }

    async nodeFrame(frame) {
        if (this._destroyed) throw new FlowError('DISPOSED', '流场数据已销毁')
        const cached = this._touch(this._nodeFrameCache, frame)
        if (cached) return cached
        if (this._nodePending.has(frame)) return this._nodePending.get(frame)
        const pending = this.frame(frame)
            .then(values => this._aggregate(frame, values))
            .then(result => {
                if (this._destroyed) throw abortedError()
                this._nodeFrameCache.set(frame, result)
                this._trimLru(this._nodeFrameCache, NODE_CACHE_LIMIT)
                return result
            })
            .finally(() => this._nodePending.delete(frame))
        this._nodePending.set(frame, pending)
        return pending
    }

    /**
     * 返回当前时次的连续跟踪状态和浑水历史（视觉示意）。
     * 支持 {signal} 取消：同帧并发共享，全部取消才真正中止构建。
     */
    async tidalFrontFrame(frame, options = {}) {
        if (this._destroyed) throw new FlowError('DISPOSED', '流场数据已销毁')
        if (!this.tidalAvailable) throw new FlowError('DATA_UNAVAILABLE', '本场次潮头计算未启用')
        if (!this._tidal) this._tidal = new TidalHistory(this, { onProgress: this.options.onProgress })
        return this._tidal.frame(frame, options)
    }

    get tidalAvailability() {
        return getTidalAvailability(this)
    }

    get workerMode() {
        if (this._worker) return 'worker'
        if (this.options.worker === false) return 'none'
        return 'main-thread'
    }

    get stats() {
        const stats = this.meta.stats || {}
        return {
            levelMin: Number.isFinite(stats.levelMin) ? stats.levelMin : -3.5,
            levelMax: Number.isFinite(stats.levelMax) ? stats.levelMax : 6.5,
            speedMax: Number.isFinite(stats.speedMax) ? stats.speedMax : 2.5
        }
    }

    diagnostics() {
        return {
            rawFramesCached: this._rawFrames.size,
            nodeFramesCached: this._nodeFrameCache.size,
            pendingRequests: this._pendingFrames.size + this._nodePending.size + (this._tidal?.pending.size ?? 0),
            tidalHistoryFrames: this._tidal?.stats.frames ?? 0,
            tidalHistoryBytes: this._tidal?.stats.bytes ?? 0,
            worker: this.workerMode
        }
    }

    _createWorker() {
        if (this.options.worker === false || (typeof Worker === 'undefined' && !this.options.workerFactory)) return
        try {
            this._worker = this.options.workerFactory
                ? this.options.workerFactory()
                : this.options.workerUrl
                    ? new Worker(this.options.workerUrl, { type: 'module' })
                    : new Worker(new URL('./flowFieldWorker.js', import.meta.url), { type: 'module' })
            this._worker.onmessage = event => {
                if (event.data.type === 'requestFrame') {
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
                if (event.data.type === 'historyProgress') {
                    const loaded = event.data.loaded ?? 0
                    const target = Number.isFinite(event.data.target) ? event.data.target : loaded - 1
                    this.options.onProgress?.({ phase: 'history', loaded, total: Math.max(loaded, target + 1) })
                    return
                }
                const request = this._workerRequests.get(event.data.id)
                if (!request) return
                this._workerRequests.delete(event.data.id)
                if (event.data.error) request.reject(new FlowError('WORKER_FAILED', event.data.error || 'Worker 执行失败'))
                else request.resolve(event.data.state || new Float32Array(event.data.buffer))
            }
            this._worker.onerror = event => {
                const error = new Error(event.message || 'Web Worker 执行失败')
                for (const request of this._workerRequests.values()) request.reject(error)
                this._workerRequests.clear()
                this._worker && this._worker.terminate()
                this._worker = null
                this._warnWorkerFallback(error)
            }
            this._worker.postMessage({
                type: 'init',
                nNodes: this.nNodes,
                nCells: this.nCells,
                cellNode: this.cellNode,
                cellLon: this.cellLon,
                cellLat: this.cellLat,
                lon: this.lon, lat: this.lat, zb: this.zb,
                times: this.meta.times,
                offsets: this._adjOffsets,
                adjacency: this._adj,
                dry: this.dry,
                levelScale: this.levelScale,
                uvScale: this.uvScale,
                aoi: this.tidalFrontAoi,
                polygon: this.tidalFrontPolygon,
                tidalProfile: this.tidalProfile
            })
        } catch (error) {
            this._worker = null
            this._warnWorkerFallback(error)
        }
    }

    _warnWorkerFallback(error) {
        if (this._workerFallbackWarned) return
        this._workerFallbackWarned = true
        const warning = {
            code: 'WORKER_FALLBACK',
            message: 'Worker 执行失败，已回退到主线程计算',
            detail: String(error?.message || error)
        }
        if (this.options.onWarning) this.options.onWarning(warning)
        else console.warn(warning.message, error)
    }

    async _aggregate(frame, values) {
        if (!this._worker) return aggregateSync(this, values)
        try {
            return await this._requestWorker({ type: 'aggregate', frame, values })
        } catch (error) {
            if (this._destroyed || error?.name === 'AbortError' || this._worker) throw error
            this._warnWorkerFallback(error)
            return aggregateSync(this, values)
        }
    }

    _requestWorker(message) {
        const id = ++this._workerSequence
        return new Promise((resolve, reject) => {
            this._workerRequests.set(id, { resolve, reject })
            this._worker.postMessage({ ...message, id })
        })
    }

    /** 可取消的 Worker 请求：signal 中止时向 Worker 发送 tidalCancel 并摘除挂起项。 */
    _requestWorkerCancelable(message, signal) {
        const id = ++this._workerSequence
        let onAbort
        const promise = new Promise((resolve, reject) => {
            this._workerRequests.set(id, { resolve, reject })
            this._worker.postMessage({ ...message, id })
            if (!signal) return
            onAbort = () => {
                if (this._workerRequests.delete(id)) {
                    try { this._worker?.postMessage({ type: 'tidalCancel', id }) } catch { }
                    reject(abortedError())
                }
            }
            if (signal.aborted) onAbort()
            else signal.addEventListener('abort', onAbort, { once: true })
        })
        if (signal && onAbort) return promise.finally(() => signal.removeEventListener('abort', onAbort))
        return promise
    }

    /**
     * 两帧原始值在 cell 处的插值采样：干帧数值为 null，
     * 一干一湿取湿帧并标记 wetTransition，零流速 dirDeg 为 null。
     */
    sampleValues(cell, ratio, valuesA, valuesB) {
        const a = decodeCell(this, valuesA, cell)
        const b = decodeCell(this, valuesB, cell)
        if (!a || !b) return null
        if (!a.wet && !b.wet) {
            return { wet: false, wetTransition: false, level: null, u: null, v: null, speed: null, dirDeg: null }
        }
        const wetTransition = a.wet !== b.wet
        const only = a.wet && b.wet ? null : a.wet ? a : b
        const level = only ? only.level : a.level + (b.level - a.level) * ratio
        const u = only ? only.u : a.u + (b.u - a.u) * ratio
        const v = only ? only.v : a.v + (b.v - a.v) * ratio
        const speed = Math.hypot(u, v)
        const dirDeg = speed < 1e-6 ? null : (Math.atan2(u, v) * 180 / Math.PI + 360) % 360
        return { wet: true, wetTransition, level, u, v, speed, dirDeg }
    }

    async series(cell, signal) {
        if (this.provider?.querySeries) {
            const raw = await this.provider.querySeries(this.manifest, cell, { signal })
            signal?.throwIfAborted()
            return normalizeSeriesResult(raw, { scenarioId: this.scenarioId, cellIndex: cell, source: 'provider' })
        }
        const points = new Array(this.nFrames)
        let next = 0
        const worker = async () => {
            while (next < this.nFrames) {
                const index = next++
                signal?.throwIfAborted()
                const values = await this.frame(index, { signal, history: true })
                const value = decodeCell(this, values, cell)
                points[index] = {
                    frameIndex: index, validTime: this.meta.times[index],
                    dry: !value?.wet,
                    level: value?.level ?? null, u: value?.u ?? null, v: value?.v ?? null
                }
            }
        }
        await Promise.all(Array.from({ length: Math.min(4, this.nFrames) }, worker))
        signal?.throwIfAborted()
        return normalizeSeriesResult({ points }, { scenarioId: this.scenarioId, cellIndex: cell, source: 'frames' })
    }

    pickCell(lon, lat) {
        return pickCell(this, lon, lat)
    }

    _touch(map, key) {
        const value = map.get(key)
        if (!value) return value
        map.delete(key)
        map.set(key, value)
        return value
    }

    _trimLru(map, limit, protectedKeys = new Set()) {
        for (const key of map.keys()) {
            if (map.size <= limit) break
            if (!protectedKeys.has(key)) map.delete(key)
        }
    }

    destroy() {
        if (this._destroyed) return
        this._destroyed = true
        this._rawFrames.clear()
        this._nodeFrameCache.clear()
        this._nodePending.clear()
        for (const request of this._pendingFrames.values()) request.controller.abort()
        this._pendingFrames.clear()
        this._tidal?.destroy()
        this._tidal = null
        this._worker && this._worker.terminate()
        this._worker = null
        for (const request of this._workerRequests.values()) request.reject(abortedError())
        this._workerRequests.clear()
    }
}
