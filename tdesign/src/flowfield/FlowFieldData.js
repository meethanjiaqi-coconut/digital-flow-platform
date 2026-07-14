/**
 * 流场数据层:加载/解码 mesh.bin + frames.bin + meta.json,
 * 提供单元取值、节点聚合(供水面/粒子顶点数据)、空间反查、时间插值采样、过程线。
 * 纯 JS 无环境依赖:浏览器用 FlowFieldData.load(),Node 测试直接 new FlowFieldData(...)。
 */
const MESH_MAGIC = 0x46464d31
const FRAME_MAGIC = 0x46464631
const GRID = 512 // 空间索引分辨率

async function fetchWithProgress(url, onChunk) {
    const resp = await fetch(url)
    if (!resp.ok) throw new Error(`加载失败 ${url}: ${resp.status}`)
    const total = Number(resp.headers.get('content-length')) || 0
    if (!resp.body || !total) {
        const buf = await resp.arrayBuffer()
        onChunk && onChunk(buf.byteLength, buf.byteLength)
        return buf
    }
    const reader = resp.body.getReader()
    const chunks = []
    let received = 0
    for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        chunks.push(value)
        received += value.byteLength
        onChunk && onChunk(received, total)
    }
    const out = new Uint8Array(received)
    let off = 0
    for (const c of chunks) {
        out.set(c, off)
        off += c.byteLength
    }
    return out.buffer
}

export class FlowFieldData {
    /**
     * @param {string} baseUrl 形如 'data/flowfield/'
     * @param {(loaded:number,total:number)=>void} onProgress 合并进度(字节)
     */
    static async load(baseUrl, onProgress) {
        const metaResp = await fetch(baseUrl + 'meta.json')
        if (!metaResp.ok) throw new Error(`加载失败 meta.json: ${metaResp.status}`)
        const meta = await metaResp.json()
        const progress = [0, 0]
        const totalGuess = 2_100_000 + 31_100_000
        const report = () => onProgress && onProgress(progress[0] + progress[1], totalGuess)
        const [meshBuf, framesBuf] = await Promise.all([
            fetchWithProgress(baseUrl + 'mesh.bin', (r) => ((progress[0] = r), report())),
            fetchWithProgress(baseUrl + 'frames.bin', (r) => ((progress[1] = r), report()))
        ])
        return new FlowFieldData(meta, meshBuf, framesBuf)
    }

    constructor(meta, meshBuf, framesBuf) {
        this.meta = meta
        const dv = new DataView(meshBuf)
        if (dv.getUint32(0, true) !== MESH_MAGIC) throw new Error('mesh.bin 魔数错误')
        const nNodes = (this.nNodes = dv.getUint32(4, true))
        const nCells = (this.nCells = dv.getUint32(8, true))
        const nTris = (this.nTris = dv.getUint32(12, true))
        let o = 16
        this.lon = new Float32Array(meshBuf, o, nNodes); o += nNodes * 4
        this.lat = new Float32Array(meshBuf, o, nNodes); o += nNodes * 4
        this.zb = new Float32Array(meshBuf, o, nNodes); o += nNodes * 4
        this.tri = new Uint16Array(meshBuf, o, nTris * 3); o += nTris * 6
        this.cellNode = new Uint16Array(meshBuf, o, nCells * 4); o += nCells * 8
        this.cellLon = new Float32Array(meshBuf, o, nCells); o += nCells * 4
        this.cellLat = new Float32Array(meshBuf, o, nCells); o += nCells * 4
        if (o !== meshBuf.byteLength) throw new Error(`mesh.bin 长度不符 ${o}/${meshBuf.byteLength}`)

        const fdv = new DataView(framesBuf)
        if (fdv.getUint32(0, true) !== FRAME_MAGIC) throw new Error('frames.bin 魔数错误')
        this.nFrames = fdv.getUint32(4, true)
        if (fdv.getUint32(8, true) !== nCells) throw new Error('frames.bin 单元数不符')
        this.frames = new Int16Array(framesBuf, 12)
        if (this.frames.length !== this.nFrames * 3 * nCells) throw new Error('frames.bin 长度不符')

        this.levelScale = meta.scales.level
        this.uvScale = meta.scales.uv
        this.dry = meta.drySentinel
        this.bbox = meta.bbox

        this._nodeFrameCache = new Map() // frame -> Float32Array(nNodes*4)
        this._buildAdjacency()
        this._buildIndex()
    }

    /** 单元在某帧的原始值。wet=false 时 level/u/v 为 0。 */
    cellValue(frame, cell) {
        const base = frame * 3 * this.nCells
        const z = this.frames[base + cell]
        if (z === this.dry) return { level: 0, u: 0, v: 0, wet: false }
        return {
            level: z * this.levelScale,
            u: this.frames[base + this.nCells + cell] * this.uvScale,
            v: this.frames[base + 2 * this.nCells + cell] * this.uvScale,
            wet: true
        }
    }

    _buildAdjacency() {
        const { nNodes, nCells, cellNode } = this
        const counts = new Uint16Array(nNodes)
        const uniq = (i, k) => !(k === 3 && cellNode[i * 4 + 3] === cellNode[i * 4])
        for (let i = 0; i < nCells; i++)
            for (let k = 0; k < 4; k++) if (uniq(i, k)) counts[cellNode[i * 4 + k]]++
        const offsets = new Uint32Array(nNodes + 1)
        for (let n = 0; n < nNodes; n++) offsets[n + 1] = offsets[n] + counts[n]
        const adj = new Uint32Array(offsets[nNodes])
        const cursor = Uint32Array.from(offsets.subarray(0, nNodes))
        for (let i = 0; i < nCells; i++)
            for (let k = 0; k < 4; k++)
                if (uniq(i, k)) adj[cursor[cellNode[i * 4 + k]]++] = i
        this._adjOffsets = offsets
        this._adj = adj
    }

    /** 节点聚合帧数据 [level,u,v,wet]×nNodes,湿邻接单元均值,LRU(6)。 */
    nodeFrame(frame) {
        const cached = this._nodeFrameCache.get(frame)
        if (cached) {
            this._nodeFrameCache.delete(frame)
            this._nodeFrameCache.set(frame, cached)
            return cached
        }
        const { nNodes, nCells, frames } = this
        const base = frame * 3 * nCells
        const out = new Float32Array(nNodes * 4)
        const offsets = this._adjOffsets
        const adj = this._adj
        for (let n = 0; n < nNodes; n++) {
            let sl = 0, su = 0, sv = 0, wetCnt = 0
            const s = offsets[n], e = offsets[n + 1]
            for (let j = s; j < e; j++) {
                const c = adj[j]
                const z = frames[base + c]
                if (z === this.dry) continue
                wetCnt++
                sl += z
                su += frames[base + nCells + c]
                sv += frames[base + 2 * nCells + c]
            }
            const o4 = n * 4
            if (wetCnt > 0) {
                out[o4] = (sl / wetCnt) * this.levelScale
                out[o4 + 1] = (su / wetCnt) * this.uvScale
                out[o4 + 2] = (sv / wetCnt) * this.uvScale
                out[o4 + 3] = wetCnt / (e - s)
            }
        }
        this._nodeFrameCache.set(frame, out)
        if (this._nodeFrameCache.size > 6)
            this._nodeFrameCache.delete(this._nodeFrameCache.keys().next().value)
        return out
    }

    _cellUniqCount(i) {
        return this.cellNode[i * 4 + 3] === this.cellNode[i * 4] ? 3 : 4
    }

    _buildIndex() {
        const [w, s, e, n] = this.bbox
        this._ix = (lon) => Math.min(GRID - 1, Math.max(0, Math.floor(((lon - w) / (e - w)) * GRID)))
        this._iy = (lat) => Math.min(GRID - 1, Math.max(0, Math.floor(((lat - s) / (n - s)) * GRID)))
        const bins = (this._bins = new Array(GRID * GRID))
        const { nCells, cellNode, lon, lat } = this
        for (let i = 0; i < nCells; i++) {
            let x0 = 999, x1 = -999, y0 = 999, y1 = -999
            const cnt = this._cellUniqCount(i)
            for (let k = 0; k < cnt; k++) {
                const nd = cellNode[i * 4 + k]
                const px = lon[nd], py = lat[nd]
                if (px < x0) x0 = px
                if (px > x1) x1 = px
                if (py < y0) y0 = py
                if (py > y1) y1 = py
            }
            const gx0 = this._ix(x0), gx1 = this._ix(x1)
            const gy0 = this._iy(y0), gy1 = this._iy(y1)
            for (let gy = gy0; gy <= gy1; gy++)
                for (let gx = gx0; gx <= gx1; gx++) {
                    const key = gy * GRID + gx
                    ;(bins[key] || (bins[key] = [])).push(i)
                }
        }
    }

    _pointInCell(i, px, py) {
        const { cellNode, lon, lat } = this
        const cnt = this._cellUniqCount(i)
        let inside = false
        for (let k = 0, j = cnt - 1; k < cnt; j = k++) {
            const xa = lon[cellNode[i * 4 + k]], ya = lat[cellNode[i * 4 + k]]
            const xb = lon[cellNode[i * 4 + j]], yb = lat[cellNode[i * 4 + j]]
            if (ya > py !== yb > py && px < ((xb - xa) * (py - ya)) / (yb - ya) + xa) inside = !inside
        }
        return inside
    }

    /** 经纬度反查单元,未命中返回 -1。 */
    pickCell(lonDeg, latDeg) {
        const [w, s, e, n] = this.bbox
        if (lonDeg < w || lonDeg > e || latDeg < s || latDeg > n) return -1
        const bin = this._bins[this._iy(latDeg) * GRID + this._ix(lonDeg)]
        if (!bin) return -1
        for (const i of bin) if (this._pointInCell(i, lonDeg, latDeg)) return i
        return -1
    }

    /** 两帧线性插值采样,未命中返回 null。 */
    sampleAt(lonDeg, latDeg, timeF) {
        const cell = this.pickCell(lonDeg, latDeg)
        if (cell < 0) return null
        return this.sampleCell(cell, timeF)
    }

    /** dirDeg 为流向(去向,北=0 顺时针)。 */
    sampleCell(cell, timeF) {
        const f0 = Math.max(0, Math.min(this.nFrames - 1, Math.floor(timeF)))
        const f1 = Math.min(this.nFrames - 1, f0 + 1)
        const t = Math.max(0, Math.min(1, timeF - f0))
        const a = this.cellValue(f0, cell)
        const b = this.cellValue(f1, cell)
        if (!a.wet && !b.wet) return { cell, wet: false, level: 0, u: 0, v: 0, speed: 0, dirDeg: 0 }
        const pick = a.wet && b.wet ? null : a.wet ? a : b
        const level = pick ? pick.level : a.level + (b.level - a.level) * t
        const u = pick ? pick.u : a.u + (b.u - a.u) * t
        const v = pick ? pick.v : a.v + (b.v - a.v) * t
        const speed = Math.hypot(u, v)
        const dirDeg = (Math.atan2(u, v) * 180) / Math.PI
        return { cell, wet: true, level, u, v, speed, dirDeg: (dirDeg + 360) % 360 }
    }

    /** 单元 72h 过程线,干时刻为 NaN。 */
    series(cell) {
        const levels = new Float32Array(this.nFrames)
        const speeds = new Float32Array(this.nFrames)
        for (let f = 0; f < this.nFrames; f++) {
            const v = this.cellValue(f, cell)
            levels[f] = v.wet ? v.level : NaN
            speeds[f] = v.wet ? Math.hypot(v.u, v.v) : NaN
        }
        return { levels, speeds }
    }
}
