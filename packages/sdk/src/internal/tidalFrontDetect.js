import { DEFAULT_TIDAL_PARAMETERS } from './tidalParameters.js'
import { cellCornerCount, createTidalRiverGeometry, EMPTY_NEIGHBOR } from './tidal-front-analysis.js'

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
    const p = context.parameters || DEFAULT_TIDAL_PARAMETERS

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
        const localRiseSupport = smoothstep(-0.08, p.minLevelRiseMeters, levelRise)
        cellStrength[cell] = smoothstep(p.minUpstreamSpeed, p.strongUpstreamSpeed, upstreamSpeed) * (0.72 + localRiseSupport * 0.28)
    }

    // 选取规模最大的连续上溯潮流团。全区域平均水位可能仍在下降，但潮头所在的局部断面
    // 已经上涨；因此水位涨幅只作为局部置信度，不能再作为清空整帧结果的硬门槛。
    let bestComponent = []
    let bestComponentScore = 0
    let bestComponentMinimumDistance = Infinity
    let bestComponentMaximumDistance = -Infinity
    for (let index = 0; index < activeCells.length; index++) {
        const startCell = activeCells[index]
        if (componentVisited[startCell] || cellStrength[startCell] < p.minTidalFlowStrength) continue
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
                if (neighbor === EMPTY_NEIGHBOR || componentVisited[neighbor] || cellStrength[neighbor] < p.minTidalFlowStrength) {
                    continue
                }
                componentVisited[neighbor] = 1
                componentQueue[tail++] = neighbor
            }
        }
        const span = maximumDistance - minimumDistance
        if (
            tail >= p.minTidalComponentCells &&
            score >= p.minTidalComponentScore &&
            span >= p.minTidalComponentSpanMeters &&
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
        if (boundaryStrength >= p.minFrontBoundaryStrength) {
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
        const isBoundary = smoothedStrength[cell] >= p.minFrontBoundaryStrength
        if (hasBoundary && !isBoundary) continue
        if (maximumAdvance - riverDistance[cell] <= p.frontBandMeters) leadingCells.push(cell)
    }

    if (!leadingCells.length) return output.slice()
    selectedStrength.fill(0)
    // 强度不再写成接近 1 的二值尖峰。主浪、浪肩和尾部紊流分三层扩散，
    // 让相邻三角形之间保持连续梯度，避免播放时突然出现纯白色三角闪光。
    const componentSpan = bestComponentMaximumDistance - bestComponentMinimumDistance
    const componentConfidence = smoothstep(p.minTidalComponentSpanMeters, p.minTidalComponentSpanMeters * 2.5, componentSpan)
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
