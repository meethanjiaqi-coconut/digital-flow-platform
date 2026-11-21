const MESH_MAGIC = 0x46464d31
const GRID = 512

/** 解码 mesh.bin 二进制布局到 data 上的类型化数组字段。 */
export function decodeMesh(data, meshBuffer) {
    if (!(meshBuffer instanceof ArrayBuffer) || meshBuffer.byteLength < 16) throw new Error('Invalid mesh buffer')
    const view = new DataView(meshBuffer)
    if (view.getUint32(0, true) !== MESH_MAGIC) throw new Error('mesh.bin 魔数错误')
    const nNodes = (data.nNodes = view.getUint32(4, true))
    const nCells = view.getUint32(8, true)
    const nTris = (data.nTris = view.getUint32(12, true))
    if (nCells !== data.nCells) throw new Error('网格单元数与 manifest 不一致')
    if (nNodes !== data.manifest.nNodes || nTris !== data.manifest.nTris) throw new Error('Mesh counts differ from manifest')
    if (meshBuffer.byteLength !== 16 + nNodes * 12 + nTris * 6 + nCells * 16) throw new Error('Invalid mesh byte length')
    let offset = 16
    data.lon = new Float32Array(meshBuffer, offset, nNodes)
    offset += nNodes * 4
    data.lat = new Float32Array(meshBuffer, offset, nNodes)
    offset += nNodes * 4
    data.zb = new Float32Array(meshBuffer, offset, nNodes)
    offset += nNodes * 4
    data.tri = new Uint16Array(meshBuffer, offset, nTris * 3)
    offset += nTris * 6
    data.cellNode = new Uint16Array(meshBuffer, offset, nCells * 4)
    offset += nCells * 8
    for (const node of data.tri) if (node >= nNodes) throw new Error('Triangle node out of range')
    for (const node of data.cellNode) if (node >= nNodes) throw new Error('Cell node out of range')
    const floatArray = (start, count) => start % 4 === 0
        ? new Float32Array(meshBuffer, start, count)
        : Float32Array.from({ length: count }, (_, index) => view.getFloat32(start + index * 4, true))
    data.cellLon = floatArray(offset, nCells)
    offset += nCells * 4
    data.cellLat = floatArray(offset, nCells)
    offset += nCells * 4
    if (offset !== meshBuffer.byteLength) {
        throw new Error(`mesh.bin 长度不符 ${offset}/${meshBuffer.byteLength}`)
    }
}

/** 单元到节点的邻接表（去重角点），供节点聚合使用。 */
export function buildAdjacency(data) {
    const unique = (cell, corner) => !(corner === 3 && data.cellNode[cell * 4 + 3] === data.cellNode[cell * 4])
    const counts = new Uint16Array(data.nNodes)
    for (let cell = 0; cell < data.nCells; cell++) {
        for (let corner = 0; corner < 4; corner++) {
            if (unique(cell, corner)) counts[data.cellNode[cell * 4 + corner]]++
        }
    }
    const offsets = new Uint32Array(data.nNodes + 1)
    for (let node = 0; node < data.nNodes; node++) offsets[node + 1] = offsets[node] + counts[node]
    const adjacency = new Uint32Array(offsets[data.nNodes])
    const cursor = Uint32Array.from(offsets.subarray(0, data.nNodes))
    for (let cell = 0; cell < data.nCells; cell++) {
        for (let corner = 0; corner < 4; corner++) {
            if (unique(cell, corner)) adjacency[cursor[data.cellNode[cell * 4 + corner]]++] = cell
        }
    }
    data._adjOffsets = offsets
    data._adj = adjacency
}

function cellUniqCount(data, index) {
    return data.cellNode[index * 4 + 3] === data.cellNode[index * 4] ? 3 : 4
}

/** 512×512 网格桶空间索引，pickCell 的粗筛结构。 */
export function buildSpatialIndex(data) {
    const [west, south, east, north] = data.bbox
    data._ix = lon => Math.min(GRID - 1, Math.max(0, Math.floor(((lon - west) / (east - west)) * GRID)))
    data._iy = lat => Math.min(GRID - 1, Math.max(0, Math.floor(((lat - south) / (north - south)) * GRID)))
    const bins = (data._bins = new Array(GRID * GRID))
    for (let cell = 0; cell < data.nCells; cell++) {
        let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity
        const count = cellUniqCount(data, cell)
        for (let corner = 0; corner < count; corner++) {
            const node = data.cellNode[cell * 4 + corner]
            minLon = Math.min(minLon, data.lon[node])
            maxLon = Math.max(maxLon, data.lon[node])
            minLat = Math.min(minLat, data.lat[node])
            maxLat = Math.max(maxLat, data.lat[node])
        }
        for (let y = data._iy(minLat); y <= data._iy(maxLat); y++) {
            for (let x = data._ix(minLon); x <= data._ix(maxLon); x++) {
                const key = y * GRID + x
                ;(bins[key] || (bins[key] = [])).push(cell)
            }
        }
    }
}

function pointInCell(data, index, lon, lat) {
    const count = cellUniqCount(data, index)
    let inside = false
    for (let current = 0, previous = count - 1; current < count; previous = current++) {
        const a = data.cellNode[index * 4 + current]
        const b = data.cellNode[index * 4 + previous]
        if (
            data.lat[a] > lat !== data.lat[b] > lat &&
            lon < ((data.lon[b] - data.lon[a]) * (lat - data.lat[a])) / (data.lat[b] - data.lat[a]) + data.lon[a]
        ) {
            inside = !inside
        }
    }
    return inside
}

/** 节点聚合：单元值按邻接表平均到节点（主线程回退路径）。 */
export function aggregateSync(data, values) {
    const output = new Float32Array(data.nNodes * 4)
    for (let node = 0; node < data.nNodes; node++) {
        let level = 0
        let u = 0
        let v = 0
        let wetCount = 0
        const start = data._adjOffsets[node]
        const end = data._adjOffsets[node + 1]
        for (let cursor = start; cursor < end; cursor++) {
            const cell = data._adj[cursor]
            const rawLevel = values[cell]
            if (rawLevel === data.dry) continue
            wetCount++
            level += rawLevel
            u += values[data.nCells + cell]
            v += values[2 * data.nCells + cell]
        }
        const offset = node * 4
        if (wetCount) {
            output[offset] = (level / wetCount) * data.levelScale
            output[offset + 1] = (u / wetCount) * data.uvScale
            output[offset + 2] = (v / wetCount) * data.uvScale
            output[offset + 3] = wetCount / (end - start)
        }
    }
    return output
}

export function pickCell(data, lon, lat) {
    const [west, south, east, north] = data.bbox
    if (lon < west || lon > east || lat < south || lat > north) return -1
    const bin = data._bins[data._iy(lat) * GRID + data._ix(lon)]
    if (!bin) return -1
    for (const index of bin) if (pointInCell(data, index, lon, lat)) return index
    return -1
}
