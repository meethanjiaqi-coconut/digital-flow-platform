import { tidalGeometry, interpolateTidalTrack } from './tidalEvolution.js'

export function smoothstep(low, high, value) {
    const t = Math.max(0, Math.min(1, (value - low) / (high - low)))
    return t * t * (3 - 2 * t)
}

/** Visual sediment contrast driven by the tracked front, not SSC data.
 * River distance increases upstream and follows mesh connectivity around bends.
 * Interpolate the front position, not two coloured masks, so there is one boundary.
 */
export class TidalWaterMix {
    constructor(data, textureLength = data.nNodes) {
        this.data = data
        this.coordinates = new Float32Array(textureLength * 4)
        this.geometry = tidalGeometry(data)
        this.coordinates.set(this.geometry.coordinates)
        this.memoryA = null
        this.memoryB = null
        this.memoryMaximum = 0
        this.front = null
        this.a = null
        this.b = null
        this.distance = 0
        this.intensity = 0
        this.t = 0
    }

    summarize(front) {
        if (!front) return null
        if (front.track) return { ...front.track, maximum: front.track.confidence }
        let total = 0, along = 0, maximum = 0, peak = -1
        for (let i = 0; i < this.data.nNodes; i++) {
            if (this.coordinates[i * 4 + 1] <= 0) continue
            const strength = Number.isFinite(front[i]) ? front[i] : 0
            if (strength > maximum) { maximum = strength; peak = i }
            // Same core-node weighting as the existing tidal-front marker.
            if (strength >= 0.58) {
                const weight = strength ** 3
                along += this.coordinates[i * 4] * weight
                total += weight
            }
        }
        if (peak < 0 || maximum < 0.02) return null
        return { distance: total > 0 ? along / total : this.coordinates[peak * 4], maximum }
    }

    setFrames(a, b) {
        this.memoryA = a?.memory || null
        this.memoryB = b?.memory || null
        this.memoryMaximum = 0
        for (let i = 0; i < this.data.nNodes; i++) this.memoryMaximum = Math.max(this.memoryMaximum, this.memoryA?.[i] || 0, this.memoryB?.[i] || 0)
        this.structured = Boolean(a?.track || b?.track)
        this.a = this.summarize(a)
        this.b = this.summarize(b)
        this.setT(this.t)
    }

    setT(t) {
        this.t = Math.max(0, Math.min(1, Number(t) || 0))
        if (this.structured) {
            this.front = interpolateTidalTrack(this.a, this.b, this.t)
            this.distance = this.front.distance
            this.intensity = smoothstep(0.08, 0.7, this.front.confidence)
            return
        }
        this.front = null
        const a = this.a || this.b, b = this.b || this.a
        this.distance = a ? a.distance * (1 - this.t) + b.distance * this.t : 0
        const confidence = (this.a?.maximum || 0) * (1 - this.t) + (this.b?.maximum || 0) * this.t
        this.intensity = smoothstep(0.04, 0.30, confidence)
    }
}
