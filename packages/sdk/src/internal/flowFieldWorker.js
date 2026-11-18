/* global self */
import { TidalEvolution } from './tidalEvolution.js'

const frameRequests = new Map()
let frameRequestId = 0
function getFrame(index) {
    return new Promise((resolve, reject) => {
        const requestId = ++frameRequestId
        frameRequests.set(requestId, { resolve, reject })
        self.postMessage({ type: 'requestFrame', requestId, index })
    })
}
let state
let timeline, previousRaw, pumping = false
const tidalRequests = []

async function pumpTidalHistory() {
    if (pumping) return
    pumping = true
    try {
        if (!timeline) timeline = new TidalEvolution(state)
        while (tidalRequests.length) {
            // Return newly available low-frame seeks immediately, even while an
            // older high-frame request is rebuilding the remaining history.
            for (let i = tidalRequests.length - 1; i >= 0; i--) {
                const request = tidalRequests[i]
                if (request.frame >= timeline.history.length) continue
                const result = timeline.output(request.frame)
                self.postMessage({ id: request.id, state: result }, [result.memory.buffer])
                tidalRequests.splice(i, 1)
            }
            if (!tidalRequests.length) break
            const index = timeline.history.length
            const buffer = await getFrame(index)
            if (buffer.byteLength !== state.nCells * 6) throw new Error(`Invalid tidal history frame ${index}`)
            const current = new Int16Array(buffer), times = state.times
            const seconds = (Date.parse(times[index]) - Date.parse(times[0])) / 1000
            const dt = index ? (Date.parse(times[index]) - Date.parse(times[index - 1])) / 1000 : 0
            timeline.step(index, previousRaw || current, current, seconds, dt)
            previousRaw = current
            const pending = tidalRequests.filter(request => request.frame >= timeline.history.length)
            const target = pending.length ? Math.max(...pending.map(request => request.frame)) : index
            self.postMessage({ type: 'historyProgress', loaded: timeline.history.length, target })
        }
    } catch (error) {
        for (const request of tidalRequests.splice(0)) self.postMessage({ id: request.id, error: error.message || String(error) })
    } finally { pumping = false }
}

function aggregate(values) {
    const output = new Float32Array(state.nNodes * 4)
    for (let node = 0; node < state.nNodes; node++) {
        let level = 0
        let u = 0
        let v = 0
        let wetCount = 0
        const start = state.offsets[node]
        const end = state.offsets[node + 1]
        for (let cursor = start; cursor < end; cursor++) {
            const cell = state.adjacency[cursor]
            const rawLevel = values[cell]
            if (rawLevel === state.dry) continue
            wetCount++
            level += rawLevel
            u += values[state.nCells + cell]
            v += values[2 * state.nCells + cell]
        }
        const offset = node * 4
        if (wetCount) {
            output[offset] = (level / wetCount) * state.levelScale
            output[offset + 1] = (u / wetCount) * state.uvScale
            output[offset + 2] = (v / wetCount) * state.uvScale
            output[offset + 3] = wetCount / (end - start)
        }
    }
    return output
}

self.onmessage = event => {
    const message = event.data
    if (message.type === 'frameData' || message.type === 'frameError') {
        const pending = frameRequests.get(message.requestId)
        frameRequests.delete(message.requestId)
        if (pending) message.type === 'frameData' ? pending.resolve(message.buffer) : pending.reject(new Error(message.error))
        return
    }
    if (message.type === 'init') {
        state = message
        return
    }
    if (message.type === 'tidalCancel') {
        const index = tidalRequests.findIndex(request => request.id === message.id)
        if (index >= 0) tidalRequests.splice(index, 1)
        return
    }
    if (state && message.type === 'tidalState') {
        tidalRequests.push(message)
        pumpTidalHistory()
        return
    }
    if (!state || message.type !== 'aggregate') return

    try {
        const output = aggregate(message.values)
        self.postMessage({ id: message.id, buffer: output.buffer }, [output.buffer])
    } catch (error) {
        self.postMessage({ id: message.id, error: error.message || String(error) })
    }
}
