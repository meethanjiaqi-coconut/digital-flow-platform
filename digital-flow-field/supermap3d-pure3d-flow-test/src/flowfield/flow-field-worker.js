/* global self */
let state

self.onmessage = event => {
    const message = event.data
    if (message.type === 'init') {
        state = message
        return
    }
    if (message.type !== 'aggregate' || !state) return
    try {
        const values = message.values
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
        self.postMessage({ id: message.id, buffer: output.buffer }, [output.buffer])
    } catch (error) {
        self.postMessage({ id: message.id, error: error.message || String(error) })
    }
}
