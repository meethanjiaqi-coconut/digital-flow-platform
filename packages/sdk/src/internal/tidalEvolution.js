import { createTidalRiverGeometry, pointInPolygon } from './tidal-front-analysis.js'
import { DEFAULT_TIDAL_PARAMETERS } from './tidalParameters.js'

const EMPTY = 0xffffffff
export const clamp = (x, low = 0, high = 1) => Math.max(low, Math.min(high, x))
export const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t) }

/** Shared spatial coordinates for the marker, crest and sediment interface. */
export function tidalGeometry(data) {
    if (data._tidalGeometry) return data._tidalGeometry
    const g = createTidalRiverGeometry({
        ...data,
        polygon: data.tidalFrontPolygon || data.polygon,
        aoi: data.tidalFrontAoi || data.aoi,
        seaward: data.tidalProfile?.seaward ?? data.seaward,
        parameters: data.tidalProfile?.parameters ?? data.parameters
    })
    const coordinates = new Float32Array(data.nNodes * 4), counts = new Uint16Array(data.nNodes)
    g.localIndex = new Int32Array(data.nCells).fill(-1)
    g.cellBed = new Float32Array(data.nCells)
    g.edgeX = new Float32Array(data.nCells * 4); g.edgeY = new Float32Array(data.nCells * 4); g.edgeLength = new Float32Array(data.nCells * 4)
    g.activeCells.forEach((cell, i) => {
        g.localIndex[cell] = i
        if (!Number.isFinite(g.riverDistance[cell])) return
        const count = data.cellNode[cell * 4] === data.cellNode[cell * 4 + 3] ? 3 : 4
        for (let j = 0; j < count; j++) {
            const n = data.cellNode[cell * 4 + j], k = n * 4
            counts[n]++; coordinates[k] += g.riverDistance[cell]
            coordinates[k + 2] += g.upstreamX[cell]; coordinates[k + 3] += g.upstreamY[cell]
            g.cellBed[cell] += (data.zb?.[n] || 0) / count
        }
        for (let j = 0; j < g.neighborCounts[cell]; j++) {
            const k = cell * 4 + j, other = g.neighbors[k]
            const dx = (data.cellLon[other] - data.cellLon[cell]) * 111320 * Math.cos(data.cellLat[cell] * Math.PI / 180)
            const dy = (data.cellLat[other] - data.cellLat[cell]) * 110540, length = Math.max(1, Math.hypot(dx, dy))
            g.edgeX[k] = dx / length; g.edgeY[k] = dy / length; g.edgeLength[k] = length
        }
    })
    for (let n = 0; n < data.nNodes; n++) if (counts[n]) {
        const k = n * 4; coordinates[k] /= counts[n]
        coordinates[k + 1] = pointInPolygon(data.lon[n], data.lat[n], g.polygon) ? smooth(0, g.parameters.polygonMaskRampMeters, coordinates[k]) : 0
        const size = Math.hypot(coordinates[k + 2], coordinates[k + 3]) || 1
        coordinates[k + 2] /= size; coordinates[k + 3] /= size
    }
    g.coordinates = coordinates; g.nodeCounts = counts
    data._tidalGeometry = g
    return g
}

/** Keep alternative wet-to-wet velocity boundaries, rather than replacing the
 * previous bore with whichever flow component happens to be strongest today. */
export function tidalCandidates(g, previous, current, dt) {
    const p = g.parameters || DEFAULT_TIDAL_PARAMETERS
    dt ??= p.referenceIntervalSeconds
    const { nCells: n, activeCells, dry, uvScale, levelScale } = g
    const along = new Float32Array(n), strength = new Float32Array(n), wet = new Uint8Array(n)
    for (const c of activeCells) {
        if (current[c] === dry || !Number.isFinite(g.riverDistance[c])) continue
        wet[c] = 1
        along[c] = (current[n + c] * g.upstreamX[c] + current[n * 2 + c] * g.upstreamY[c]) * uvScale
        const rise = previous[c] === dry ? 0 : (current[c] - previous[c]) * levelScale * p.referenceIntervalSeconds / Math.max(1, dt)
        strength[c] = smooth(p.candidateSpeedRampLow, p.candidateSpeedRampHigh, along[c]) * (p.candidateSpeedEvidence + p.candidateRiseEvidence * smooth(p.candidateRiseRampLow, p.candidateRiseRampHigh, rise))
    }
    const visited = new Uint8Array(n), eligible = new Uint8Array(n), componentScore = new Float32Array(n), queue = []
    let largestComponentScore = 0
    for (const first of activeCells) {
        if (visited[first] || strength[first] < p.minComponentStrength) continue
        queue.length = 0; queue.push(first); visited[first] = 1
        let min = Infinity, max = -Infinity, score = 0
        for (let head = 0; head < queue.length; head++) {
            const c = queue[head]; min = Math.min(min, g.riverDistance[c]); max = Math.max(max, g.riverDistance[c]); score += strength[c] ** 2
            for (let j = 0; j < g.neighborCounts[c]; j++) {
                const other = g.neighbors[c * 4 + j]
                if (other === EMPTY || !g.activeMask[other] || visited[other] || strength[other] < p.minComponentStrength) continue
                visited[other] = 1; queue.push(other)
            }
        }
        if (queue.length >= p.minComponentCells && max - min >= p.minComponentSpanMeters) {
            largestComponentScore = Math.max(largestComponentScore, score)
            for (const c of queue) { eligible[c] = 1; componentScore[c] = score }
        }
    }
    const bins = new Map()
    for (const c of activeCells) {
        if (!eligible[c]) continue
        let boundary = 0
        for (let j = 0; j < g.neighborCounts[c]; j++) {
            const other = g.neighbors[c * 4 + j]
            if (other === EMPTY || !wet[other] || g.riverDistance[other] <= g.riverDistance[c]) continue
            boundary = Math.max(boundary, strength[c] * smooth(p.opposingFlowRampLow, p.opposingFlowRampHigh, -along[other]) * smooth(p.flowJumpRampLow, p.flowJumpRampHigh, along[c] - along[other]))
        }
        boundary *= (componentScore[c] / largestComponentScore) ** 2
        if (boundary < p.minBoundaryStrength) continue
        const bin = Math.floor(g.riverDistance[c] / p.candidateBinMeters), cells = bins.get(bin) || []
        cells.push({ c, weight: boundary }); bins.set(bin, cells)
    }
    const candidates = []
    for (const bin of bins.keys()) {
        const cells = [bins.get(bin - 1) || [], bins.get(bin) || [], bins.get(bin + 1) || []].flat()
        let weight = 0, distance = 0, lon = 0, lat = 0, tx = 0, ty = 0, depth = 0, speed = 0
        for (const { c, weight: w } of cells) {
            weight += w; distance += g.riverDistance[c] * w; lon += g.cellLon[c] * w; lat += g.cellLat[c] * w
            tx += g.upstreamX[c] * w; ty += g.upstreamY[c] * w
            depth += Math.max(p.minCandidateDepthMeters, current[c] * levelScale - g.cellBed[c]) * w; speed += along[c] * w
        }
        if (weight < p.minCandidateWeight) continue
        distance /= weight; lon /= weight; lat /= weight; depth /= weight; speed /= weight
        const length = Math.hypot(tx, ty) || 1; tx /= length; ty /= length
        let width = 0, best = Infinity, anchor = cells[0].c
        for (const { c } of cells) {
            const dx = (g.cellLon[c] - lon) * 111320 * Math.cos(lat * Math.PI / 180), dy = (g.cellLat[c] - lat) * 110540
            width = Math.max(width, Math.abs(dx * -ty + dy * tx) * 2)
            const error = Math.abs(g.riverDistance[c] - distance) + Math.hypot(dx, dy) * p.anchorSpatialWeight
            if (error < best) { best = error; anchor = c }
        }
        candidates.push({ distance: g.riverDistance[anchor], longitude: g.cellLon[anchor], latitude: g.cellLat[anchor],
            tangentX: tx, tangentY: ty, width: clamp(width, p.candidateWidthMinMeters, p.candidateWidthMaxMeters), depth, speed,
            score: weight, confidence: clamp(p.candidateConfidenceBase + weight * p.candidateConfidencePerWeight, 0, p.candidateConfidenceMax), cell: anchor })
    }
    candidates.sort((a, b) => b.score - a.score)
    return candidates.filter((candidate, i) => candidate.distance >= p.minCandidateDistanceMeters && !candidates.slice(0, i).some(other => Math.abs(other.distance - candidate.distance) < p.candidateDedupMeters))
}

/** Causal association. Reject incompatible observations instead of clamping or
 * interpolating across kilometres of unsupported motion. Reacquisition starts
 * a new segment after three consistent observations; playback order is irrelevant. */
export class TidalTracker {
    constructor(parameters = DEFAULT_TIDAL_PARAMETERS) {
        this.p = parameters
        this.last = null; this.missing = 0; this.pending = null; this.segment = 0; this.velocity = 0
    }
    step(candidates, seconds, dt) {
        const p = this.p, last = this.last
        let selected
        if (last && this.missing < p.trackerMaxMissingSeconds) {
            const age = seconds - last.seconds
            // This is a conservative association gate, not a measured bore speed.
            // Graph distance and coarse cells need a spatial uncertainty allowance.
            const forward = clamp(Math.sqrt(9.81 * last.depth) + Math.max(0, last.speed), p.trackerMinCelerity, p.trackerMaxCelerity) * age * p.trackerForwardSlack + p.trackerAllowanceMeters
            const matches = candidates.filter(c => c.distance - last.distance >= -p.trackerBackwardToleranceMeters && c.distance - last.distance <= forward)
            matches.sort((a, b) => b.distance - a.distance || b.score - a.score)
            selected = matches[0]
        }
        if (!last || this.missing >= p.trackerMaxMissingSeconds) {
            const candidate = candidates[0]
            if (candidate) {
                const consistent = this.pending && Math.abs(candidate.distance - this.pending.distance) <= dt * p.trackerMaxCelerity + p.trackerAllowanceMeters
                this.pending = { ...candidate, count: consistent ? this.pending.count + 1 : 1, origin: consistent ? this.pending.origin : candidate.distance }
                if (this.pending.count >= (last ? p.trackerConfirmCountWithTrack : p.trackerConfirmCountFresh) && candidate.distance - this.pending.origin > p.trackerMinAdvanceMeters) { selected = candidate; this.segment++; this.velocity = 0 }
            } else this.pending = null
        }
        if (selected) {
            if (last && this.missing < p.trackerMaxMissingSeconds) this.velocity = clamp((selected.distance - last.distance) / Math.max(1, seconds - last.seconds), 0, p.trackerMaxVelocity) * p.trackerVelocitySmoothing + this.velocity * (1 - p.trackerVelocitySmoothing)
            this.missing = 0; this.pending = null; this.last = { ...selected, seconds, segment: this.segment }
            return { ...this.last, status: 'tracked', rejected: candidates.filter(c => c !== selected).length }
        }
        this.missing += dt
        if (last && this.missing <= dt * p.trackerUncertainWindowFactor) return { ...last, seconds, confidence: last.confidence * p.trackerUncertainConfidenceDecay, status: 'uncertain', rejected: candidates.length }
        return { distance: last?.distance || 0, confidence: 0, segment: this.segment, status: candidates.length ? 'reacquiring' : 'unavailable', rejected: candidates.length }
    }
}

export function interpolateTidalTrack(a, b, t, parameters = DEFAULT_TIDAL_PARAMETERS) {
    const zero = { distance: 0, confidence: 0, width: parameters.fallbackTrackWidthMeters, status: 'unavailable', segment: -1 }
    a ||= zero; b ||= zero; t = clamp(t)
    if (a.segment !== b.segment && a.confidence > 0 && b.confidence > 0) {
        const chosen = t < 0.5 ? a : b
        return { ...chosen, confidence: chosen.confidence * Math.abs(2 * t - 1) }
    }
    const from = a.confidence > 0 ? a : b, to = b.confidence > 0 ? b : a
    const output = { ...(t < 0.5 ? a : b), confidence: a.confidence * (1 - t) + b.confidence * t }
    for (const key of ['distance', 'longitude', 'latitude', 'tangentX', 'tangentY', 'width', 'depth', 'speed']) output[key] = (from[key] || 0) * (1 - t) + (to[key] || 0) * t
    return output
}

/** Project the label onto the SAME interpolated distance contour as the shader,
 * keeping it in the wet mesh through bends instead of cutting across a bank. */
export function locateTidalSection(g, track, isWet = () => true) {
    let best = Infinity, result = null
    const targetX = track.longitude, targetY = track.latitude, cos = Math.cos(targetY * Math.PI / 180)
    for (const cell of g.activeCells) {
        if (!isWet(cell)) continue
        const count = g.cellNode[cell * 4] === g.cellNode[cell * 4 + 3] ? 3 : 4, hits = []
        for (let j = 0; j < count; j++) {
            const a = g.cellNode[cell * 4 + j], b = g.cellNode[cell * 4 + (j + 1) % count]
            const da = g.coordinates[a * 4], db = g.coordinates[b * 4]
            if (Math.abs(db - da) < 1e-6 || track.distance < Math.min(da, db) || track.distance > Math.max(da, db)) continue
            const t = (track.distance - da) / (db - da)
            hits.push({ x: g.lon[a] + (g.lon[b] - g.lon[a]) * t, y: g.lat[a] + (g.lat[b] - g.lat[a]) * t })
        }
        if (hits.length < 2) continue
        const a = hits[0], b = hits[1], dx = (b.x - a.x) * cos, dy = b.y - a.y
        const t = clamp((((targetX - a.x) * cos) * dx + (targetY - a.y) * dy) / Math.max(1e-15, dx * dx + dy * dy))
        const x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t
        const error = ((x - targetX) * cos) ** 2 + (y - targetY) ** 2
        if (error < best) { best = error; result = { longitude: x, latitude: y, cell, distance: track.distance } }
    }
    return result
}

/** Illustrative sediment memory on the wet model graph. Real U/V advects it;
 * diffusion and decay are display parameters, never measured concentration. */
export class TidalEvolution {
    constructor(data) {
        this.data = data; this.g = tidalGeometry(data); this.tracker = new TidalTracker(this.g.parameters)
        this.history = []; this.sediment = new Float32Array(this.g.activeCells.length); this.previousTrack = null
    }
    step(frame, previous, current, seconds, dt) {
        if (frame !== this.history.length) throw new Error('Tidal history must be built in chronological order')
        const g = this.g, p = g.parameters, n = g.nCells
        const candidates = frame ? tidalCandidates(g, previous, current, dt) : []
        const track = frame ? this.tracker.step(candidates, seconds, dt) : { distance: 0, confidence: 0, status: 'unavailable', segment: 0 }
        const steps = Math.max(1, Math.ceil(dt / p.sedimentSubstepSeconds)), delta = dt / steps
        for (let step = 0; step < steps; step++) {
            const next = new Float32Array(this.sediment.length)
            for (let i = 0; i < next.length; i++) {
                const c = g.activeCells[i]
                if (current[c] === g.dry) continue
                const u = current[n + c] * g.uvScale, v = current[n * 2 + c] * g.uvScale
                let sum = this.sediment[i], weight = 1
                for (let j = 0; j < g.neighborCounts[c]; j++) {
                    const k = c * 4 + j, other = g.neighbors[k], index = g.localIndex[other]
                    if (index < 0 || current[other] === g.dry) continue
                    const length = g.edgeLength[k]
                    const transfer = delta * (Math.max(0, -u * g.edgeX[k] - v * g.edgeY[k]) / length + p.sedimentDiffusionCoefficient / (length * length))
                    sum += this.sediment[index] * transfer; weight += transfer
                }
                let value = sum / weight * Math.exp(-delta / p.sedimentDecaySeconds)
                if (track.status === 'tracked') {
                    const before = this.previousTrack?.segment === track.segment && this.previousTrack.confidence > 0 ? this.previousTrack.distance : track.distance
                    const front = before + (track.distance - before) * (step + 1) / steps
                    const offset = g.riverDistance[c] - front
                    const source = Math.exp(-(((offset + p.sedimentSourceOffsetMeters) / p.sedimentSourceWidthMeters) ** 2)) * track.confidence
                    value += (1 - value) * source * (1 - Math.exp(-delta / p.sedimentSourceRiseSeconds))
                }
                next[i] = clamp(value)
            }
            this.sediment = next
        }
        this.history.push({ track, sediment: this.sediment.slice(), candidates: candidates.map(c => ({ distance: c.distance, score: c.score })) })
        this.previousTrack = track
        return this.output(frame)
    }
    output(frame) {
        const { track, sediment, candidates } = this.history[frame], g = this.g
        const memory = new Float32Array(g.nNodes), weights = new Uint16Array(g.nNodes)
        g.activeCells.forEach((c, i) => {
            const count = g.cellNode[c * 4] === g.cellNode[c * 4 + 3] ? 3 : 4
            for (let j = 0; j < count; j++) { const node = g.cellNode[c * 4 + j]; memory[node] += sediment[i]; weights[node]++ }
        })
        for (let node = 0; node < memory.length; node++) if (weights[node]) memory[node] /= weights[node]
        return { track: { ...track }, memory, candidates }
    }
}
