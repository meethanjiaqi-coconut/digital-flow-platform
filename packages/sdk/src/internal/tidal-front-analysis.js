import { mergeTidalParameters, resolveSeaward } from './tidalParameters.js'

/**
 * 钱塘江河口潮头默认判识区。
 *
 * 西端覆盖杭州段，东端止于澉浦附近，不延伸到杭州湾外海。场次清单可通过
 * tidalFrontPolygon 覆盖该范围。
 */
export const DEFAULT_QIANTANG_ESTUARY_POLYGON = Object.freeze([
    [119.98, 30.02],
    [120.18, 30.04],
    [120.38, 30.08],
    [120.64, 30.14],
    [120.88, 30.2],
    [121.08, 30.28],
    [121.08, 30.5],
    [120.92, 30.58],
    [120.68, 30.56],
    [120.44, 30.5],
    [120.22, 30.42],
    [120.04, 30.31]
])

export const EMPTY_NEIGHBOR = 0xffffffff
const EARTH_METERS_PER_DEGREE = 111320
// 死代码：声明后未被任何路径使用，保留原样不参与参数表。
const BOUNDARY_ALIGNMENT_METERS = 5000

export function cellCornerCount(cellNode, cell) {
    const offset = cell * 4
    return cellNode[offset + 3] === cellNode[offset] ? 3 : 4
}

function addNeighbor(neighbors, counts, cell, neighbor) {
    const count = counts[cell]
    if (count >= 4) return
    const offset = cell * 4
    for (let index = 0; index < count; index++) {
        if (neighbors[offset + index] === neighbor) return
    }
    neighbors[offset + count] = neighbor
    counts[cell] = count + 1
}

/**
 * 仅连接共享完整边的单元，避免把只共用一个顶点的斜对角单元误判为锋面邻域。
 */
function buildCellNeighbors(cellNode, nCells) {
    const neighbors = new Uint32Array(nCells * 4)
    const counts = new Uint8Array(nCells)
    neighbors.fill(EMPTY_NEIGHBOR)
    const edgeOwner = new Map()

    for (let cell = 0; cell < nCells; cell++) {
        const count = cellCornerCount(cellNode, cell)
        for (let corner = 0; corner < count; corner++) {
            const first = cellNode[cell * 4 + corner]
            const second = cellNode[cell * 4 + ((corner + 1) % count)]
            const low = Math.min(first, second)
            const high = Math.max(first, second)
            const key = low * 65536 + high
            const owner = edgeOwner.get(key)
            if (owner === undefined) {
                edgeOwner.set(key, cell)
            } else {
                addNeighbor(neighbors, counts, cell, owner)
                addNeighbor(neighbors, counts, owner, cell)
            }
        }
    }

    return { neighbors, counts }
}

class MinimumHeap {
    constructor() {
        this.cells = []
        this.distances = []
    }

    push(cell, distance) {
        let index = this.cells.length
        this.cells.push(cell)
        this.distances.push(distance)
        while (index > 0) {
            const parent = (index - 1) >> 1
            if (this.distances[parent] <= distance) break
            this.cells[index] = this.cells[parent]
            this.distances[index] = this.distances[parent]
            index = parent
        }
        this.cells[index] = cell
        this.distances[index] = distance
    }

    pop() {
        if (!this.cells.length) return null
        const cell = this.cells[0]
        const distance = this.distances[0]
        const lastCell = this.cells.pop()
        const lastDistance = this.distances.pop()
        if (this.cells.length) {
            let index = 0
            while (true) {
                const left = index * 2 + 1
                if (left >= this.cells.length) break
                const right = left + 1
                const child = right < this.cells.length && this.distances[right] < this.distances[left] ? right : left
                if (this.distances[child] >= lastDistance) break
                this.cells[index] = this.cells[child]
                this.distances[index] = this.distances[child]
                index = child
            }
            this.cells[index] = lastCell
            this.distances[index] = lastDistance
        }
        return { cell, distance }
    }
}

function cellOffset(cellLon, cellLat, first, second) {
    const meanLatitude = ((cellLat[first] + cellLat[second]) * Math.PI) / 360
    const dx = (cellLon[second] - cellLon[first]) * EARTH_METERS_PER_DEGREE * Math.cos(meanLatitude)
    const dy = (cellLat[second] - cellLat[first]) * EARTH_METERS_PER_DEGREE
    return { dx, dy, distance: Math.max(1, Math.hypot(dx, dy)) }
}

/**
 * 从河口沿网格连通关系计算河道里程，并由里程梯度得到每个单元的局部上游方向。
 *
 * 钱塘江进入杭州段后弯曲明显，不能再用固定“向西”代表向上游，否则潮头转弯后
 * 经度变化很小，点位会停在旧断面。
 */
function buildRiverMetrics(activeCells, neighbors, neighborCounts, cellLon, cellLat, nCells, aoi, seaward, parameters) {
    const activeMask = new Uint8Array(nCells)
    const riverDistance = new Float64Array(nCells)
    const upstreamX = new Float32Array(nCells)
    const upstreamY = new Float32Array(nCells)
    riverDistance.fill(Infinity)
    for (const cell of activeCells) activeMask[cell] = 1

    // 入海种子带：east 与原公式逐位一致；west/north/south 对称取对侧边缘。
    let isSeedCell
    if (seaward === 'west') {
        const seedWidth = Math.max(parameters.seawardSeedMinDegrees, (aoi[2] - aoi[0]) * parameters.seawardSeedFraction)
        const seedLongitude = aoi[0] + seedWidth
        isSeedCell = cell => cellLon[cell] <= seedLongitude
    } else if (seaward === 'north') {
        const seedHeight = Math.max(parameters.seawardSeedMinDegrees, (aoi[3] - aoi[1]) * parameters.seawardSeedFraction)
        const seedLatitude = aoi[3] - seedHeight
        isSeedCell = cell => cellLat[cell] >= seedLatitude
    } else if (seaward === 'south') {
        const seedHeight = Math.max(parameters.seawardSeedMinDegrees, (aoi[3] - aoi[1]) * parameters.seawardSeedFraction)
        const seedLatitude = aoi[1] + seedHeight
        isSeedCell = cell => cellLat[cell] <= seedLatitude
    } else {
        const seedWidth = Math.max(parameters.seawardSeedMinDegrees, (aoi[2] - aoi[0]) * parameters.seawardSeedFraction)
        const seedLongitude = aoi[2] - seedWidth
        isSeedCell = cell => cellLon[cell] >= seedLongitude
    }
    const heap = new MinimumHeap()
    for (const cell of activeCells) {
        if (!isSeedCell(cell)) continue
        riverDistance[cell] = 0
        heap.push(cell, 0)
    }

    while (heap.cells.length) {
        const current = heap.pop()
        if (current.distance !== riverDistance[current.cell]) continue
        const count = neighborCounts[current.cell]
        for (let neighborIndex = 0; neighborIndex < count; neighborIndex++) {
            const neighbor = neighbors[current.cell * 4 + neighborIndex]
            if (neighbor === EMPTY_NEIGHBOR || !activeMask[neighbor]) continue
            const candidateDistance = current.distance + cellOffset(cellLon, cellLat, current.cell, neighbor).distance
            if (candidateDistance >= riverDistance[neighbor]) continue
            riverDistance[neighbor] = candidateDistance
            heap.push(neighbor, candidateDistance)
        }
    }

    for (const cell of activeCells) {
        if (!Number.isFinite(riverDistance[cell])) continue
        let gradientX = 0
        let gradientY = 0
        let farthestNeighbor = EMPTY_NEIGHBOR
        let farthestIncrease = 0
        const count = neighborCounts[cell]
        for (let neighborIndex = 0; neighborIndex < count; neighborIndex++) {
            const neighbor = neighbors[cell * 4 + neighborIndex]
            if (neighbor === EMPTY_NEIGHBOR || !Number.isFinite(riverDistance[neighbor])) continue
            const { dx, dy, distance } = cellOffset(cellLon, cellLat, cell, neighbor)
            const distanceIncrease = riverDistance[neighbor] - riverDistance[cell]
            gradientX += (distanceIncrease * dx) / (distance * distance)
            gradientY += (distanceIncrease * dy) / (distance * distance)
            if (distanceIncrease > farthestIncrease) {
                farthestIncrease = distanceIncrease
                farthestNeighbor = neighbor
            }
        }

        let magnitude = Math.hypot(gradientX, gradientY)
        if (magnitude < parameters.upstreamGradientEpsilon && farthestNeighbor !== EMPTY_NEIGHBOR) {
            const offset = cellOffset(cellLon, cellLat, cell, farthestNeighbor)
            gradientX = offset.dx
            gradientY = offset.dy
            magnitude = offset.distance
        }
        if (magnitude >= parameters.upstreamGradientEpsilon) {
            upstreamX[cell] = gradientX / magnitude
            upstreamY[cell] = gradientY / magnitude
        }
    }

    return { activeMask, riverDistance, upstreamX, upstreamY }
}

function validAoi(value) {
    return Array.isArray(value) && value.length === 4 && value.every(Number.isFinite) && value[0] < value[2] && value[1] < value[3]
}

function validPolygon(value) {
    return (
        Array.isArray(value) &&
        value.length >= 3 &&
        value.every(point => Array.isArray(point) && point.length >= 2 && Number.isFinite(point[0]) && Number.isFinite(point[1]))
    )
}

function polygonBounds(polygon) {
    let west = Infinity
    let south = Infinity
    let east = -Infinity
    let north = -Infinity
    for (const point of polygon) {
        west = Math.min(west, point[0])
        south = Math.min(south, point[1])
        east = Math.max(east, point[0])
        north = Math.max(north, point[1])
    }
    return [west, south, east, north]
}

export function pointInPolygon(lon, lat, polygon) {
    let inside = false
    for (let current = 0, previous = polygon.length - 1; current < polygon.length; previous = current++) {
        const currentPoint = polygon[current]
        const previousPoint = polygon[previous]
        if (
            currentPoint[1] > lat !== previousPoint[1] > lat &&
            lon < ((previousPoint[0] - currentPoint[0]) * (lat - currentPoint[1])) / (previousPoint[1] - currentPoint[1]) + currentPoint[0]
        ) {
            inside = !inside
        }
    }
    return inside
}

export function resolveTidalFrontPolygon(manifest) {
    const configured = manifest?.tidalFrontPolygon || manifest?.tidalFront?.polygon || manifest?.extensions?.tidalFront?.polygon
    if (validPolygon(configured)) return configured.map(point => [Number(point[0]), Number(point[1])])

    const configuredAoi = manifest?.tidalFrontAoi || manifest?.tidalFront?.aoi || manifest?.extensions?.tidalFront?.aoi
    if (validAoi(configuredAoi)) {
        return [
            [configuredAoi[0], configuredAoi[1]],
            [configuredAoi[2], configuredAoi[1]],
            [configuredAoi[2], configuredAoi[3]],
            [configuredAoi[0], configuredAoi[3]]
        ]
    }
    return DEFAULT_QIANTANG_ESTUARY_POLYGON.map(point => [...point])
}

export function resolveTidalFrontAoi(manifest, polygon = resolveTidalFrontPolygon(manifest)) {
    const configured = manifest?.tidalFrontAoi || manifest?.tidalFront?.aoi || manifest?.extensions?.tidalFront?.aoi
    return validAoi(configured) ? configured.map(Number) : polygonBounds(polygon)
}

/**
 * 构建可复用的锋面判识上下文。邻接关系和工作数组只创建一次。
 */
export function createTidalRiverGeometry(options) {
    const { nNodes, nCells, cellNode, cellLon, cellLat } = options
    const polygon = validPolygon(options.polygon) ? options.polygon : DEFAULT_QIANTANG_ESTUARY_POLYGON
    const aoi = validAoi(options.aoi) ? options.aoi : polygonBounds(polygon)
    const seaward = resolveSeaward(options.seaward)
    const parameters = mergeTidalParameters(options.parameters)
    const { neighbors, counts } = buildCellNeighbors(cellNode, nCells)
    const active = []
    for (let cell = 0; cell < nCells; cell++) {
        const lon = cellLon[cell]
        const lat = cellLat[cell]
        if (lon >= aoi[0] && lon <= aoi[2] && lat >= aoi[1] && lat <= aoi[3] && pointInPolygon(lon, lat, polygon)) {
            active.push(cell)
        }
    }
    const activeCells = Uint32Array.from(active)
    const riverMetrics = buildRiverMetrics(activeCells, neighbors, counts, cellLon, cellLat, nCells, aoi, seaward, parameters)

    return {
        ...options,
        aoi,
        polygon,
        seaward,
        parameters,
        activeCells,
        neighbors,
        neighborCounts: counts,
        ...riverMetrics,
    }
}
