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

const EMPTY_NEIGHBOR = 0xffffffff
const MIN_RISE = 0.015
const EARTH_METERS_PER_DEGREE = 111320
const MIN_UPSTREAM_SPEED = 0.035
const STRONG_UPSTREAM_SPEED = 0.15
const MIN_TIDAL_FLOW_STRENGTH = 0.12
const MIN_FRONT_BOUNDARY_STRENGTH = 0.08
const MIN_TIDAL_COMPONENT_CELLS = 24
const MIN_TIDAL_COMPONENT_SCORE = 18
const MIN_TIDAL_COMPONENT_SPAN_METERS = 5000
const FRONT_BAND_METERS = 2200
const BOUNDARY_ALIGNMENT_METERS = 5000

function cellCornerCount(cellNode, cell) {
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
function buildRiverMetrics(activeCells, neighbors, neighborCounts, cellLon, cellLat, nCells, aoi) {
    const activeMask = new Uint8Array(nCells)
    const riverDistance = new Float64Array(nCells)
    const upstreamX = new Float32Array(nCells)
    const upstreamY = new Float32Array(nCells)
    riverDistance.fill(Infinity)
    for (const cell of activeCells) activeMask[cell] = 1

    const seedWidth = Math.max(0.05, (aoi[2] - aoi[0]) * 0.08)
    const seedLongitude = aoi[2] - seedWidth
    const heap = new MinimumHeap()
    for (const cell of activeCells) {
        if (cellLon[cell] < seedLongitude) continue
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
        if (magnitude < 0.00001 && farthestNeighbor !== EMPTY_NEIGHBOR) {
            const offset = cellOffset(cellLon, cellLat, cell, farthestNeighbor)
            gradientX = offset.dx
            gradientY = offset.dy
            magnitude = offset.distance
        }
        if (magnitude >= 0.00001) {
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
    const riverMetrics = buildRiverMetrics(activeCells, neighbors, counts, cellLon, cellLat, nCells, aoi)

    return {
        ...options,
        aoi,
        polygon,
        activeCells,
        neighbors,
        neighborCounts: counts,
        ...riverMetrics,
    }
}

export function createTidalFrontContext(options) {
    const { nNodes, nCells } = options
    return {
        ...createTidalRiverGeometry(options),
        flowAlong: new Float32Array(nCells),
        cellStrength: new Float32Array(nCells),
        smoothedStrength: new Float32Array(nCells),
        selectedStrength: new Float32Array(nCells),
        componentQueue: new Uint32Array(nCells),
        componentVisited: new Uint8Array(nCells),
        output: new Float32Array(nNodes),
        outputWeight: new Float32Array(nNodes),
        outputMaximum: new Float32Array(nNodes)
    }
}

function smoothstep(low, high, value) {
    if (high <= low) return value > low ? 1 : 0
    const ratio = Math.max(0, Math.min(1, (value - low) / (high - low)))
    return ratio * ratio * (3 - 2 * ratio)
}

function isWet(values, cell, dry) {
    return values[cell] !== dry
}

/**
 * 根据区域水位上涨确认涨潮阶段，再从当前流场中识别“上溯潮流—下泄水流”的交界断面。
 *
 * 返回值为节点强度 0~1，仅用于视觉提示，不替代实测潮头位置。
 */
export function detectTidalFront(context, valuesA, valuesB) {
    const {
        nNodes,
        nCells,
        cellNode,
        dry,
        levelScale,
        uvScale,
        activeCells,
        neighbors,
        neighborCounts,
        riverDistance,
        upstreamX,
        upstreamY,
        flowAlong,
        cellStrength,
        smoothedStrength,
        selectedStrength,
        componentQueue,
        componentVisited,
        output,
        outputWeight,
        outputMaximum
    } = context

    flowAlong.fill(0)
    cellStrength.fill(0)
    smoothedStrength.fill(0)
    selectedStrength.fill(0)
    componentVisited.fill(0)
    output.fill(0)
    outputWeight.fill(0)
    outputMaximum.fill(0)

    for (let index = 0; index < activeCells.length; index++) {
        const cell = activeCells[index]
        if (!isWet(valuesA, cell, dry) || !isWet(valuesB, cell, dry) || !Number.isFinite(riverDistance[cell])) continue

        const uB = valuesB[nCells + cell] * uvScale
        const vB = valuesB[2 * nCells + cell] * uvScale
        const upstreamSpeed = uB * upstreamX[cell] + vB * upstreamY[cell]
        flowAlong[cell] = upstreamSpeed
        const levelRise = (valuesB[cell] - valuesA[cell]) * levelScale
        const localRiseSupport = smoothstep(-0.08, MIN_RISE, levelRise)
        cellStrength[cell] = smoothstep(MIN_UPSTREAM_SPEED, STRONG_UPSTREAM_SPEED, upstreamSpeed) * (0.72 + localRiseSupport * 0.28)
    }

    // 选取规模最大的连续上溯潮流团。全区域平均水位可能仍在下降，但潮头所在的局部断面
    // 已经上涨；因此水位涨幅只作为局部置信度，不能再作为清空整帧结果的硬门槛。
    let bestComponent = []
    let bestComponentScore = 0
    let bestComponentMinimumDistance = Infinity
    let bestComponentMaximumDistance = -Infinity
    for (let index = 0; index < activeCells.length; index++) {
        const startCell = activeCells[index]
        if (componentVisited[startCell] || cellStrength[startCell] < MIN_TIDAL_FLOW_STRENGTH) continue
        let head = 0
        let tail = 1
        let score = 0
        let minimumDistance = Infinity
        let maximumDistance = -Infinity
        componentQueue[0] = startCell
        componentVisited[startCell] = 1
        while (head < tail) {
            const cell = componentQueue[head++]
            const strength = cellStrength[cell]
            score += strength * strength
            minimumDistance = Math.min(minimumDistance, riverDistance[cell])
            maximumDistance = Math.max(maximumDistance, riverDistance[cell])
            const count = neighborCounts[cell]
            for (let neighborIndex = 0; neighborIndex < count; neighborIndex++) {
                const neighbor = neighbors[cell * 4 + neighborIndex]
                if (neighbor === EMPTY_NEIGHBOR || componentVisited[neighbor] || cellStrength[neighbor] < MIN_TIDAL_FLOW_STRENGTH) {
                    continue
                }
                componentVisited[neighbor] = 1
                componentQueue[tail++] = neighbor
            }
        }
        const span = maximumDistance - minimumDistance
        if (
            tail >= MIN_TIDAL_COMPONENT_CELLS &&
            score >= MIN_TIDAL_COMPONENT_SCORE &&
            span >= MIN_TIDAL_COMPONENT_SPAN_METERS &&
            score > bestComponentScore
        ) {
            bestComponentScore = score
            bestComponent = Array.from(componentQueue.subarray(0, tail))
            bestComponentMinimumDistance = minimumDistance
            bestComponentMaximumDistance = maximumDistance
        }
    }

    if (!bestComponent.length) return output.slice()
    for (const cell of bestComponent) selectedStrength[cell] = 1

    // 以主体潮流的上游边界为候选，并要求边界外仍为湿单元且流速已经转为缓流或下泄流。
    // 这正是粒子图上两股水流相遇的断面，可排除岸线边界和下游局部旋涡。
    let maximumAdvance = -Infinity
    for (const cell of bestComponent) {
        let boundaryStrength = 0
        const count = neighborCounts[cell]
        for (let neighborIndex = 0; neighborIndex < count; neighborIndex++) {
            const neighbor = neighbors[cell * 4 + neighborIndex]
            if (neighbor === EMPTY_NEIGHBOR || selectedStrength[neighbor] > 0 || !isWet(valuesB, neighbor, dry)) continue
            if (riverDistance[neighbor] <= riverDistance[cell]) continue

            const currentUpstreamSpeed = flowAlong[cell]
            const neighborUpstreamSpeed = flowAlong[neighbor]
            const opposingScore = smoothstep(-0.04, 0.1, -neighborUpstreamSpeed)
            const flowJumpScore = smoothstep(0.03, 0.42, currentUpstreamSpeed - neighborUpstreamSpeed)
            boundaryStrength = Math.max(boundaryStrength, cellStrength[cell] * opposingScore * (0.45 + flowJumpScore * 0.55))
        }
        if (boundaryStrength >= MIN_FRONT_BOUNDARY_STRENGTH) {
            smoothedStrength[cell] = boundaryStrength
            maximumAdvance = Math.max(maximumAdvance, riverDistance[cell])
        }
    }

    const hasBoundary = Number.isFinite(maximumAdvance)
    if (!hasBoundary) maximumAdvance = bestComponentMaximumDistance

    // 同一潮流分量在下游支汊也可能存在流向突变，只保留最上游约 2.2 千米内的连续断面。
    // 该范围足以覆盖网格离散误差，又不会把标注重新拉回下游强流区。
    const leadingCells = []
    for (const cell of bestComponent) {
        const isBoundary = smoothedStrength[cell] >= MIN_FRONT_BOUNDARY_STRENGTH
        if (hasBoundary && !isBoundary) continue
        if (maximumAdvance - riverDistance[cell] <= FRONT_BAND_METERS) leadingCells.push(cell)
    }

    if (!leadingCells.length) return output.slice()
    selectedStrength.fill(0)
    // 强度不再写成接近 1 的二值尖峰。主浪、浪肩和尾部紊流分三层扩散，
    // 让相邻三角形之间保持连续梯度，避免播放时突然出现纯白色三角闪光。
    const componentSpan = bestComponentMaximumDistance - bestComponentMinimumDistance
    const componentConfidence = smoothstep(MIN_TIDAL_COMPONENT_SPAN_METERS, MIN_TIDAL_COMPONENT_SPAN_METERS * 2.5, componentSpan)
    for (const cell of leadingCells) {
        const frontConfidence = hasBoundary ? smoothedStrength[cell] : cellStrength[cell] * componentConfidence
        selectedStrength[cell] = 0.82 + frontConfidence * 0.1
    }
    let frontier = leadingCells
    const falloffs = [0.66, 0.46, 0.28]
    for (const falloff of falloffs) {
        const nextFrontier = []
        for (const cell of frontier) {
            const count = neighborCounts[cell]
            for (let neighborIndex = 0; neighborIndex < count; neighborIndex++) {
                const neighbor = neighbors[cell * 4 + neighborIndex]
                if (neighbor === EMPTY_NEIGHBOR) continue
                if (selectedStrength[neighbor] < falloff) {
                    selectedStrength[neighbor] = falloff
                    nextFrontier.push(neighbor)
                }
            }
        }
        frontier = nextFrontier
    }

    // 邻域均值只柔化突变，不改变潮头主体位置。
    for (let pass = 0; pass < 1; pass++) {
        smoothedStrength.fill(0)
        for (let index = 0; index < activeCells.length; index++) {
            const cell = activeCells[index]
            const strength = selectedStrength[cell]
            if (strength <= 0) continue
            let sum = strength * 2
            let weight = 2
            const count = neighborCounts[cell]
            for (let neighborIndex = 0; neighborIndex < count; neighborIndex++) {
                const neighbor = neighbors[cell * 4 + neighborIndex]
                if (neighbor === EMPTY_NEIGHBOR || selectedStrength[neighbor] <= 0) continue
                sum += selectedStrength[neighbor]
                weight++
            }
            smoothedStrength[cell] = sum / weight
        }
        selectedStrength.set(smoothedStrength)
    }

    // 节点强度使用相邻单元的均值与峰值混合：均值保证连续，受限峰值保证主浪脊仍然清晰可见。
    for (let index = 0; index < activeCells.length; index++) {
        const cell = activeCells[index]
        const strength = selectedStrength[cell]
        const count = cellCornerCount(cellNode, cell)
        for (let corner = 0; corner < count; corner++) {
            const node = cellNode[cell * 4 + corner]
            output[node] += strength
            outputWeight[node]++
            outputMaximum[node] = Math.max(outputMaximum[node], strength)
        }
    }

    for (let node = 0; node < nNodes; node++) {
        if (outputWeight[node] > 0 && output[node] > 0) {
            const mean = output[node] / outputWeight[node]
            output[node] = Math.min(0.92, Math.pow(mean * 0.62 + outputMaximum[node] * 0.38, 0.94))
        }
    }
    return output.slice()
}
