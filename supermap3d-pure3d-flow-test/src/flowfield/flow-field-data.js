/**
 * 风暴潮流场数据层。
 *
 * 首屏只加载 manifest、共享网格和前两帧；逐帧请求由 12 帧 LRU、预取窗口和
 * AbortController 管理。服务端响应虽然在磁盘上是 gzip，浏览器会按
 * Content-Encoding 自动解压，因此这里拿到的 ArrayBuffer 仍是原始二进制布局。
 */
/* global fetch, AbortController, Worker, URL */
const MESH_MAGIC = 0x46464d31
const FRAME_MAGIC = 0x46464631
const GRID = 512
const RAW_CACHE_LIMIT = 12
const NODE_CACHE_LIMIT = 6

function trimSlash(value) {
    return String(value || '').replace(/\/+$/, '')
}

async function fetchJson(url, signal) {
    try {
        const response = await fetch(url, { signal })
        if (!response.ok) throw new Error(`请求失败 ${url}: ${response.status}`)
        const body = await response.json()
        if (body && Object.prototype.hasOwnProperty.call(body, 'code')) {
            if (body.code !== 0) throw new Error(body.message || `接口错误 ${body.code}`)
            return body.data
        }
        return body
    } catch (error) {
        if (error.name === 'AbortError') throw error
        throw new Error(`流场接口请求失败：${error.message}`, { cause: error })
    }
}

async function fetchBuffer(url, signal) {
    try {
        const response = await fetch(url, { signal })
        if (!response.ok) throw new Error(`请求失败 ${url}: ${response.status}`)
        return await response.arrayBuffer()
    } catch (error) {
        if (error.name === 'AbortError') throw error
        throw new Error(`流场二进制请求失败：${error.message}`, { cause: error })
    }
}

export function resolveFlowApiBase() {
    const configured =
        import.meta.env.VITE_FLOW_API_BASE ||
        (typeof window !== 'undefined' && window.FLOW_FIELD_API_BASE) ||
        '/flow-field'
    return trimSlash(configured)
}

export class FlowFieldData {
    static async listScenarios(apiBase = resolveFlowApiBase(), signal) {
        return fetchJson(`${trimSlash(apiBase)}/api/v1/scenarios`, signal)
    }

    static async load(apiBase = resolveFlowApiBase(), onProgress, scenarioId, previousData, signal) {
        const base = trimSlash(apiBase)
        const manifestPath = scenarioId
            ? `/api/v1/scenarios/${encodeURIComponent(scenarioId)}/manifest`
            : '/api/v1/scenarios/latest/manifest'
        let data
        try {
            onProgress && onProgress(1, 4)
            const manifest = await fetchJson(base + manifestPath, signal)
            onProgress && onProgress(2, 4)

            let meshBuffer
            if (previousData && previousData.meshId === manifest.mesh.meshId) {
                meshBuffer = previousData._meshBuffer
            } else {
                meshBuffer = await fetchBuffer(
                    `${base}/api/v1/meshes/${encodeURIComponent(manifest.mesh.meshId)}`,
                    signal
                )
            }
            onProgress && onProgress(3, 4)

            data = new FlowFieldData(manifest, meshBuffer, base)
            const firstFrames = [data.frame(0, { signal })]
            if (data.nFrames > 1) firstFrames.push(data.frame(1, { signal }))
            await Promise.all(firstFrames)
            onProgress && onProgress(4, 4)
            data.activateWindow(0)
            return data
        } catch (error) {
            data && data.destroy()
            throw error
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

    constructor(manifest, meshBuffer, apiBase) {
        this.manifest = manifest
        this.meta = {
            ...manifest,
            times: manifest.frames.map(frame => frame.validTime),
            stats: manifest.stats || {}
        }
        this.apiBase = apiBase
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
        this._activeWindow = new Set()
        this._workerRequests = new Map()
        this._workerSequence = 0
        this._destroyed = false
        this._decodeMesh(meshBuffer)
        this._buildAdjacency()
        this._buildIndex()
        this._createWorker()
    }

    _decodeMesh(meshBuffer) {
        const view = new DataView(meshBuffer)
        if (view.getUint32(0, true) !== MESH_MAGIC) throw new Error('mesh.bin 魔数错误')
        const nNodes = (this.nNodes = view.getUint32(4, true))
        const nCells = view.getUint32(8, true)
        const nTris = (this.nTris = view.getUint32(12, true))
        if (nCells !== this.nCells) throw new Error('网格单元数与 manifest 不一致')
        let offset = 16
        this.lon = new Float32Array(meshBuffer, offset, nNodes)
        offset += nNodes * 4
        this.lat = new Float32Array(meshBuffer, offset, nNodes)
        offset += nNodes * 4
        this.zb = new Float32Array(meshBuffer, offset, nNodes)
        offset += nNodes * 4
        this.tri = new Uint16Array(meshBuffer, offset, nTris * 3)
        offset += nTris * 6
        this.cellNode = new Uint16Array(meshBuffer, offset, nCells * 4)
        offset += nCells * 8
        this.cellLon = new Float32Array(meshBuffer, offset, nCells)
        offset += nCells * 4
        this.cellLat = new Float32Array(meshBuffer, offset, nCells)
        offset += nCells * 4
        if (offset !== meshBuffer.byteLength) {
            throw new Error(`mesh.bin 长度不符 ${offset}/${meshBuffer.byteLength}`)
        }
    }

    async frame(index, options = {}) {
        if (this._destroyed) throw new Error('流场数据已销毁')
        const safeIndex = Math.max(0, Math.min(this.nFrames - 1, index))
        const cached = this._touch(this._rawFrames, safeIndex)
        if (cached) return cached
        const pending = this._pendingFrames.get(safeIndex)
        if (pending) return pending.promise
        if (!this.apiBase) throw new Error(`旧数据入口未缓存第 ${safeIndex} 帧`)

        const controller = new AbortController()
        let abortHandler
        if (options.signal) {
            if (options.signal.aborted) controller.abort()
            else {
                abortHandler = () => controller.abort()
                options.signal.addEventListener('abort', abortHandler, { once: true })
            }
        }
        const promise = fetchBuffer(
            `${this.apiBase}/api/v1/scenarios/${encodeURIComponent(this.scenarioId)}/frames/${safeIndex}`,
            controller.signal
        )
            .then(buffer => {
                if (buffer.byteLength !== this.nCells * 3 * 2) {
                    throw new Error(`第 ${safeIndex} 帧长度不符`)
                }
                const values = new Int16Array(buffer)
                this._rawFrames.set(safeIndex, values)
                this._trimLru(this._rawFrames, RAW_CACHE_LIMIT, this._activeWindow)
                return values
            })
            .finally(() => {
                this._pendingFrames.delete(safeIndex)
                if (abortHandler) options.signal.removeEventListener('abort', abortHandler)
            })
        this._pendingFrames.set(safeIndex, { promise, controller })
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
            if (!wanted.has(index)) request.controller.abort()
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
        if (!values) return null
        const levelRaw = values[cell]
        if (levelRaw === this.dry) return { level: 0, u: 0, v: 0, wet: false }
        return {
            level: levelRaw * this.levelScale,
            u: values[this.nCells + cell] * this.uvScale,
            v: values[2 * this.nCells + cell] * this.uvScale,
            wet: true
        }
    }

    async nodeFrame(frame) {
        if (this._destroyed) throw new Error('流场数据已销毁')
        const cached = this._touch(this._nodeFrameCache, frame)
        if (cached) return cached
        if (this._nodePending.has(frame)) return this._nodePending.get(frame)
        const pending = this.frame(frame)
            .then(values => this._aggregate(frame, values))
            .then(result => {
                this._nodeFrameCache.set(frame, result)
                this._trimLru(this._nodeFrameCache, NODE_CACHE_LIMIT)
                return result
            })
            .finally(() => this._nodePending.delete(frame))
        this._nodePending.set(frame, pending)
        return pending
    }

    _createWorker() {
        if (typeof Worker === 'undefined') return
        try {
            this._worker = new Worker(new URL('./flow-field-worker.js', import.meta.url), { type: 'module' })
            this._worker.onmessage = event => {
                const request = this._workerRequests.get(event.data.id)
                if (!request) return
                this._workerRequests.delete(event.data.id)
                if (event.data.error) request.reject(new Error(event.data.error))
                else request.resolve(new Float32Array(event.data.buffer))
            }
            this._worker.onerror = event => {
                const error = new Error(event.message || 'Web Worker 执行失败')
                for (const request of this._workerRequests.values()) request.reject(error)
                this._workerRequests.clear()
                this._worker && this._worker.terminate()
                this._worker = null
                console.warn('Web Worker 执行失败，将在主线程聚合', error)
            }
            this._worker.postMessage({
                type: 'init',
                nNodes: this.nNodes,
                nCells: this.nCells,
                cellNode: this.cellNode,
                offsets: this._adjOffsets,
                adjacency: this._adj,
                dry: this.dry,
                levelScale: this.levelScale,
                uvScale: this.uvScale
            })
        } catch (error) {
            console.warn('Web Worker 初始化失败，将在主线程聚合', error)
            this._worker = null
        }
    }

    _aggregate(frame, values) {
        if (!this._worker) return this._aggregateSync(values)
        const id = ++this._workerSequence
        return new Promise((resolve, reject) => {
            this._workerRequests.set(id, { resolve, reject })
            this._worker.postMessage({ type: 'aggregate', id, frame, values })
        })
    }

    _aggregateSync(values) {
        const output = new Float32Array(this.nNodes * 4)
        for (let node = 0; node < this.nNodes; node++) {
            let level = 0
            let u = 0
            let v = 0
            let wetCount = 0
            const start = this._adjOffsets[node]
            const end = this._adjOffsets[node + 1]
            for (let cursor = start; cursor < end; cursor++) {
                const cell = this._adj[cursor]
                const rawLevel = values[cell]
                if (rawLevel === this.dry) continue
                wetCount++
                level += rawLevel
                u += values[this.nCells + cell]
                v += values[2 * this.nCells + cell]
            }
            const offset = node * 4
            if (wetCount) {
                output[offset] = (level / wetCount) * this.levelScale
                output[offset + 1] = (u / wetCount) * this.uvScale
                output[offset + 2] = (v / wetCount) * this.uvScale
                output[offset + 3] = wetCount / (end - start)
            }
        }
        return output
    }

    _buildAdjacency() {
        const counts = new Uint16Array(this.nNodes)
        const unique = (cell, corner) =>
            !(corner === 3 && this.cellNode[cell * 4 + 3] === this.cellNode[cell * 4])
        for (let cell = 0; cell < this.nCells; cell++) {
            for (let corner = 0; corner < 4; corner++) {
                if (unique(cell, corner)) counts[this.cellNode[cell * 4 + corner]]++
            }
        }
        const offsets = new Uint32Array(this.nNodes + 1)
        for (let node = 0; node < this.nNodes; node++) offsets[node + 1] = offsets[node] + counts[node]
        const adjacency = new Uint32Array(offsets[this.nNodes])
        const cursor = Uint32Array.from(offsets.subarray(0, this.nNodes))
        for (let cell = 0; cell < this.nCells; cell++) {
            for (let corner = 0; corner < 4; corner++) {
                if (unique(cell, corner)) adjacency[cursor[this.cellNode[cell * 4 + corner]]++] = cell
            }
        }
        this._adjOffsets = offsets
        this._adj = adjacency
    }

    _cellUniqCount(index) {
        return this.cellNode[index * 4 + 3] === this.cellNode[index * 4] ? 3 : 4
    }

    _buildIndex() {
        const [west, south, east, north] = this.bbox
        this._ix = lon => Math.min(GRID - 1, Math.max(0, Math.floor(((lon - west) / (east - west)) * GRID)))
        this._iy = lat => Math.min(GRID - 1, Math.max(0, Math.floor(((lat - south) / (north - south)) * GRID)))
        const bins = (this._bins = new Array(GRID * GRID))
        for (let cell = 0; cell < this.nCells; cell++) {
            let minLon = Infinity
            let maxLon = -Infinity
            let minLat = Infinity
            let maxLat = -Infinity
            const count = this._cellUniqCount(cell)
            for (let corner = 0; corner < count; corner++) {
                const node = this.cellNode[cell * 4 + corner]
                minLon = Math.min(minLon, this.lon[node])
                maxLon = Math.max(maxLon, this.lon[node])
                minLat = Math.min(minLat, this.lat[node])
                maxLat = Math.max(maxLat, this.lat[node])
            }
            for (let y = this._iy(minLat); y <= this._iy(maxLat); y++) {
                for (let x = this._ix(minLon); x <= this._ix(maxLon); x++) {
                    const key = y * GRID + x
                    ;(bins[key] || (bins[key] = [])).push(cell)
                }
            }
        }
    }

    _pointInCell(index, lon, lat) {
        const count = this._cellUniqCount(index)
        let inside = false
        for (let current = 0, previous = count - 1; current < count; previous = current++) {
            const a = this.cellNode[index * 4 + current]
            const b = this.cellNode[index * 4 + previous]
            if (
                this.lat[a] > lat !== this.lat[b] > lat &&
                lon < ((this.lon[b] - this.lon[a]) * (lat - this.lat[a])) / (this.lat[b] - this.lat[a]) + this.lon[a]
            ) {
                inside = !inside
            }
        }
        return inside
    }

    pickCell(lon, lat) {
        const [west, south, east, north] = this.bbox
        if (lon < west || lon > east || lat < south || lat > north) return -1
        const bin = this._bins[this._iy(lat) * GRID + this._ix(lon)]
        if (!bin) return -1
        for (const index of bin) if (this._pointInCell(index, lon, lat)) return index
        return -1
    }

    sampleCell(cell, time) {
        const first = Math.max(0, Math.min(this.nFrames - 1, Math.floor(time)))
        const second = Math.min(this.nFrames - 1, first + 1)
        const ratio = Math.max(0, Math.min(1, time - first))
        const a = this.cellValue(first, cell)
        const b = this.cellValue(second, cell)
        if (!a || !b) return null
        if (!a.wet && !b.wet) return { cell, wet: false, level: 0, u: 0, v: 0, speed: 0, dirDeg: 0 }
        const only = a.wet && b.wet ? null : a.wet ? a : b
        const level = only ? only.level : a.level + (b.level - a.level) * ratio
        const u = only ? only.u : a.u + (b.u - a.u) * ratio
        const v = only ? only.v : a.v + (b.v - a.v) * ratio
        const speed = Math.hypot(u, v)
        const direction = (Math.atan2(u, v) * 180) / Math.PI
        return { cell, wet: true, level, u, v, speed, dirDeg: (direction + 360) % 360 }
    }

    async series(cell, signal) {
        if (!this.apiBase) {
            const levels = new Float32Array(this.nFrames)
            const speeds = new Float32Array(this.nFrames)
            for (let frame = 0; frame < this.nFrames; frame++) {
                const value = this.cellValue(frame, cell)
                levels[frame] = value && value.wet ? value.level : NaN
                speeds[frame] = value && value.wet ? Math.hypot(value.u, value.v) : NaN
            }
            return { levels, speeds }
        }
        const payload = await fetchJson(
            `${this.apiBase}/api/v1/scenarios/${encodeURIComponent(this.scenarioId)}/cells/${cell}/series`,
            signal
        )
        const levels = new Float32Array(payload.points.length)
        const speeds = new Float32Array(payload.points.length)
        payload.points.forEach((point, index) => {
            levels[index] = point.dry ? NaN : point.level
            speeds[index] = point.dry ? NaN : Math.hypot(point.u, point.v)
        })
        return { levels, speeds }
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
        this._destroyed = true
        for (const request of this._pendingFrames.values()) request.controller.abort()
        this._pendingFrames.clear()
        this._worker && this._worker.terminate()
        this._worker = null
        for (const request of this._workerRequests.values()) request.reject(new Error('数据已销毁'))
        this._workerRequests.clear()
    }
}
