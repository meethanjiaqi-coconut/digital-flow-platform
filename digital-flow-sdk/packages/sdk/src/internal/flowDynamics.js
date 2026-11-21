/** Shared presentation scale; model velocities and query values remain in m/s. */
export const FLOW_METRES_PER_MODEL_METRE = 600
export const FLOW_PHASE_SECONDS = 8
export const DEFAULT_FLOW_STRENGTH = 2

export function normalizeFlowStrength(value) {
    const n = Number(value)
    return Number.isFinite(n) ? Math.max(0.5, Math.min(3, n)) : DEFAULT_FLOW_STRENGTH
}

/** Integrate velocity over time, rather than re-evaluating velocity * age.
 * Each of the two displacement fields resets only while its blend weight is zero.
 * Camera, texture LOD and gain changes never recalculate past displacement.
 */
export class FlowDisplacement {
    constructor(count, textureLength = count) {
        this.count = count
        this.values = new Float32Array(textureLength * 4)
        this.time = 0
        this.strength = DEFAULT_FLOW_STRENGTH
        this.version = 0
    }

    get blend() {
        const f = (this.time % FLOW_PHASE_SECONDS) / FLOW_PHASE_SECONDS
        const weight = Math.abs(f * 2 - 1)
        return weight * weight * (3 - 2 * weight)
    }

    advance(seconds, u, v, wet) {
        if (!(seconds > 0)) return false
        let remaining = seconds * this.strength
        const half = FLOW_PHASE_SECONDS / 2
        while (remaining > 1e-9) {
            const nextBoundary = (Math.floor((this.time + 1e-8) / half) + 1) * half
            const step = Math.min(remaining, nextBoundary - this.time)
            const scale = step * FLOW_METRES_PER_MODEL_METRE
            for (let i = 0; i < this.count; i++) {
                const j = i * 4
                if (wet[i] <= 0.001) {
                    this.values.fill(0, j, j + 4)
                    continue
                }
                const dx = u[i] * scale, dy = v[i] * scale
                this.values[j] += dx
                this.values[j + 1] += dy
                this.values[j + 2] += dx
                this.values[j + 3] += dy
            }
            this.time += step
            remaining -= step
            if (Math.abs(this.time - nextBoundary) < 1e-7) {
                const component = Math.round(nextBoundary / half) % 2 === 0 ? 0 : 2
                for (let i = 0; i < this.count; i++) {
                    this.values[i * 4 + component] = 0
                    this.values[i * 4 + component + 1] = 0
                }
            }
        }
        this.version++
        return true
    }
}

/** Distances along the model mesh to its shoreline and currently dry nodes.
 * Bounded Dijkstra keeps offshore cells out of the per-frame shoreline work.
 */
export class ShorelineDistance {
    constructor(data) {
        const n = data.nNodes, edges = new Map()
        for (let i = 0; i < data.tri.length; i += 3) {
            const t = [data.tri[i], data.tri[i + 1], data.tri[i + 2]]
            for (let j = 0; j < 3; j++) {
                const a = Math.min(t[j], t[(j + 1) % 3]), b = Math.max(t[j], t[(j + 1) % 3])
                const key = a * n + b
                const edge = edges.get(key)
                if (edge) edge.count++
                else edges.set(key, { a, b, count: 1 })
            }
        }
        this.count = n
        this.boundary = new Uint8Array(n)
        this.starts = new Uint32Array(n + 1)
        for (const { a, b, count } of edges.values()) {
            this.starts[a + 1]++; this.starts[b + 1]++
            if (count === 1) this.boundary[a] = this.boundary[b] = 1
        }
        for (let i = 1; i <= n; i++) this.starts[i] += this.starts[i - 1]
        this.neighbours = new Uint32Array(edges.size * 2)
        this.lengths = new Float32Array(edges.size * 2)
        const cursor = this.starts.slice()
        for (const { a, b } of edges.values()) {
            const dx = (data.lon[b] - data.lon[a]) * 111320 * Math.cos((data.lat[a] + data.lat[b]) * Math.PI / 360)
            const dy = (data.lat[b] - data.lat[a]) * 110540
            const length = Math.hypot(dx, dy)
            const ia = cursor[a]++, ib = cursor[b]++
            this.neighbours[ia] = b; this.neighbours[ib] = a
            this.lengths[ia] = this.lengths[ib] = length
        }
    }

    compute(wet, limit = 600) {
        const distance = new Float32Array(this.count).fill(limit)
        const heap = []
        const push = (node, value) => {
            let at = heap.length
            heap.push([node, value])
            while (at > 0) {
                const parent = (at - 1) >> 1
                if (heap[parent][1] <= value) break
                heap[at] = heap[parent]; at = parent
            }
            heap[at] = [node, value]
        }
        for (let i = 0; i < this.count; i++) if (this.boundary[i] || !wet[i]) {
            distance[i] = 0; push(i, 0)
        }
        while (heap.length) {
            const [node, d] = heap[0], last = heap.pop()
            if (heap.length) {
                let at = 0
                while (at * 2 + 1 < heap.length) {
                    let child = at * 2 + 1
                    if (child + 1 < heap.length && heap[child + 1][1] < heap[child][1]) child++
                    if (heap[child][1] >= last[1]) break
                    heap[at] = heap[child]; at = child
                }
                heap[at] = last
            }
            if (d > distance[node]) continue
            for (let i = this.starts[node]; i < this.starts[node + 1]; i++) {
                const target = this.neighbours[i], next = Math.fround(d + this.lengths[i])
                if (next < distance[target] && next < limit) {
                    distance[target] = next; push(target, next)
                }
            }
        }
        return distance
    }
}
