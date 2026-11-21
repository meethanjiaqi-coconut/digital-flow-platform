import test from 'node:test'
import assert from 'node:assert/strict'
import { FlowFieldData } from '../packages/sdk/src/internal/FlowFieldData.js'
import { createTidalRiverGeometry } from '../packages/sdk/src/internal/tidal-front-analysis.js'
import { tidalCandidates } from '../packages/sdk/src/internal/tidalEvolution.js'
import { createFlowField, isFlowError } from '../packages/sdk/src/index.js'
import { createTidalEstuary, qiantangProfile, DEFAULT_TIDAL_PARAMETERS } from '../packages/sdk/src/tidal-estuary.js'

const invalidArgument = error => isFlowError(error) && error.code === 'INVALID_ARGUMENT'

// —— Profile 校验 ——

test('createTidalEstuary rejects invalid profiles with INVALID_ARGUMENT', () => {
    const base = { id: 'x', polygon: [[119, 29], [121, 29], [121, 31]], seaward: 'east' }
    const badProfiles = [
        undefined, null, 'profile',
        { ...base, id: '' },
        { ...base, polygon: [[119, 29], [121, 29]] },
        { ...base, polygon: [[119, 29], [121, 29], [NaN, 31]] },
        { ...base, seaward: undefined },
        { ...base, seaward: 'seaward' },
        { ...base, seaward: ' Southeast ' },
        { ...base, parameters: 'fast' },
        { ...base, parameters: { unknownKey: 1 } },
        { ...base, parameters: { ['__proto__']: 1 } },
        { ...base, parameters: { minUpstreamSpeed: NaN } },
        { ...base, parameters: { minUpstreamSpeed: Infinity } },
        { ...base, parameters: { minUpstreamSpeed: 'fast' } },
        { ...base, validatedIntervalsSeconds: '300' },
        { ...base, validatedIntervalsSeconds: [] },
        { ...base, validatedIntervalsSeconds: [0] },
        { ...base, validatedIntervalsSeconds: [-300] },
        { ...base, validatedIntervalsSeconds: [NaN] },
        { ...base, validatedIntervalsSeconds: [300, 'x'] }
    ]
    for (const profile of badProfiles) {
        assert.throws(() => createTidalEstuary({ profile }), invalidArgument, JSON.stringify(profile))
    }
})

test('createTidalEstuary merges parameter overrides over defaults', () => {
    const profile = createTidalEstuary({
        profile: {
            id: 'custom', polygon: [[119, 29], [121, 29], [121, 31]], seaward: 'west',
            parameters: { minUpstreamSpeed: 0.5 }, validatedIntervalsSeconds: [300, 600]
        }
    }).profile
    assert.equal(profile.seaward, 'west')
    assert.equal(profile.parameters.minUpstreamSpeed, 0.5)
    assert.equal(profile.parameters.minLevelRiseMeters, DEFAULT_TIDAL_PARAMETERS.minLevelRiseMeters)
    assert.deepEqual(profile.validatedIntervalsSeconds, [300, 600])
    assert.ok(Object.isFrozen(profile.parameters))
})

test('qiantangProfile exposes seaward, merged parameters and frozen validated intervals', () => {
    assert.equal(qiantangProfile.id, 'qiantang-v1')
    assert.equal(qiantangProfile.seaward, 'east')
    assert.deepEqual(qiantangProfile.validatedIntervalsSeconds, [300])
    assert.deepEqual(qiantangProfile.parameters, DEFAULT_TIDAL_PARAMETERS)
    assert.ok(Object.isFrozen(qiantangProfile))
    assert.ok(Object.isFrozen(qiantangProfile.polygon))
    assert.ok(Object.isFrozen(qiantangProfile.polygon[0]))
    assert.ok(Object.isFrozen(qiantangProfile.parameters))
    assert.ok(Object.isFrozen(qiantangProfile.validatedIntervalsSeconds))
    const again = createTidalEstuary({ profile: qiantangProfile })
    assert.equal(again.profile.seaward, 'east')
    assert.deepEqual(again.profile.parameters, DEFAULT_TIDAL_PARAMETERS)
})

// —— 入海方向种子 ——

const COLS = 8, ROWS = 3
const STRIP_AOI = [119.98, 29.96, 120.32, 30.07]
const STRIP_POLYGON = [[119.98, 29.96], [120.32, 29.96], [120.32, 30.07], [119.98, 30.07]]

function stripGeometry(seaward, parameters) {
    const nNodes = (COLS + 1) * (ROWS + 1)
    const nCells = COLS * ROWS
    const cellNode = new Uint16Array(nCells * 4)
    const cellLon = new Float32Array(nCells)
    const cellLat = new Float32Array(nCells)
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            const cell = r * COLS + c
            cellNode[cell * 4] = r * (COLS + 1) + c
            cellNode[cell * 4 + 1] = r * (COLS + 1) + c + 1
            cellNode[cell * 4 + 2] = (r + 1) * (COLS + 1) + c + 1
            cellNode[cell * 4 + 3] = (r + 1) * (COLS + 1) + c
            cellLon[cell] = 120 + (c + 0.5) * 0.04
            cellLat[cell] = 30 + (r + 0.5) * 0.01
        }
    }
    return createTidalRiverGeometry({
        nNodes, nCells, cellNode, cellLon, cellLat,
        polygon: STRIP_POLYGON, aoi: STRIP_AOI, seaward, parameters,
        dry: -32768, uvScale: 0.001, levelScale: 0.01
    })
}

test('seaward direction seeds riverDistance on the matching edge', () => {
    const cases = [
        ['east', [7, 15, 23]],
        ['west', [0, 8, 16]],
        ['north', [16, 17, 18, 19, 20, 21, 22, 23]],
        ['south', [0, 1, 2, 3, 4, 5, 6, 7]]
    ]
    for (const [seaward, expected] of cases) {
        const g = stripGeometry(seaward)
        const zeros = [...Array(g.nCells).keys()].filter(i => g.riverDistance[i] === 0).sort((a, b) => a - b)
        assert.deepEqual(zeros, expected, seaward)
        for (let i = 0; i < g.nCells; i++) {
            if (expected.includes(i)) continue
            assert.ok(Number.isFinite(g.riverDistance[i]) && g.riverDistance[i] > 0, `${seaward} cell ${i}`)
        }
    }
})

test('parameter overrides change candidate recognition on the same input', () => {
    const nCells = COLS * ROWS
    const previous = new Int16Array(nCells * 3).fill(100)
    const current = new Int16Array(nCells * 3)
    for (let c = 0; c < COLS; c++) {
        const u = c === 0 ? 300 : c <= 6 ? -300 : -50
        for (let r = 0; r < ROWS; r++) {
            const cell = r * COLS + c
            current[cell] = 105
            current[nCells + cell] = u
        }
    }
    const baseline = stripGeometry('east')
    baseline.cellBed = new Float32Array(nCells)
    const base = tidalCandidates(baseline, previous, current, 300)
    const tuned = stripGeometry('east', { minComponentStrength: 1e9 })
    tuned.cellBed = new Float32Array(nCells)
    const suppressed = tidalCandidates(tuned, previous, current, 300)
    assert.ok(base.length > 0, 'default parameters should detect a bore candidate')
    assert.equal(suppressed.length, 0, 'extreme threshold must suppress all candidates')
})

// —— 已验证帧间隔 ——

function meshBuffer() {
    const mesh = new ArrayBuffer(108), head = new DataView(mesh)
    ;[0x46464d31, 4, 2, 2].forEach((v, i) => head.setUint32(i * 4, v, true))
    new Float32Array(mesh, 16, 12).set([120, 120.1, 120.1, 120, 30, 30, 30.1, 30.1, -5, -5, -5, -5])
    new Uint16Array(mesh, 64, 6).set([0, 1, 2, 0, 2, 3])
    new Uint16Array(mesh, 76, 8).set([0, 1, 2, 0, 0, 2, 3, 0])
    new Float32Array(mesh, 92, 4).set([120.066, 120.033, 30.033, 30.066])
    return mesh
}

function validTime(minutes) {
    const total = Math.floor(minutes)
    const hh = String(Math.floor(total / 60) % 24).padStart(2, '0')
    const mm = String(total % 60).padStart(2, '0')
    return `2026-10-25T${hh}:${mm}:00+08:00`
}

function intervalFixture(stepMinutes, nFrames = 4) {
    const m = {
        formatVersion: 2, scenarioId: 'interval', sourceRunId: 'src-interval',
        nNodes: 4, nCells: 2, nTris: 2, nFrames, bbox: [100, 0, 140, 40],
        scales: { level: .01, uv: .001 }, drySentinel: -32768,
        mesh: { meshId: 'interval-mesh' }, stats: {},
        frames: Array.from({ length: nFrames }, (_, i) => ({
            index: i, validTime: validTime(i * stepMinutes), file: `f/${i}.bin`
        }))
    }
    const mesh = meshBuffer()
    const buffers = Array.from({ length: nFrames }, (_, i) => new Int16Array([100 + i, 200 + i, 1000, 500, 0, 0]).buffer)
    const provider = {
        async loadManifest() { return m },
        async getMesh() { return mesh.slice(0) },
        async getFrame(_m, i) { return buffers[i].slice(0) }
    }
    return { m, provider }
}

test('unverified frame interval disables tidal with TIDAL_INTERVAL_UNVERIFIED', async () => {
    const warnings = []
    const { m, provider } = intervalFixture(60) // 相邻帧间隔 3600 秒
    const data = await FlowFieldData.load(provider, m, {
        worker: false, profile: qiantangProfile, onWarning: w => warnings.push(w)
    })
    try {
        const warning = warnings.find(w => w.code === 'TIDAL_INTERVAL_UNVERIFIED')
        assert.ok(warning, 'expected TIDAL_INTERVAL_UNVERIFIED warning')
        assert.deepEqual(warning.detail.allowedIntervalsSeconds, [300])
        assert.ok(warning.detail.intervalsSeconds.includes(3600))
        assert.deepEqual(data.tidalAvailability, { available: false, reason: 'interval-unverified' })
        assert.equal((await data.frame(0)).length, 6, 'flow-field playback must continue')
        await assert.rejects(data.tidalFrontFrame(0), error => error.code === 'DATA_UNAVAILABLE')
    } finally {
        data.destroy()
    }
})

test('verified 300s intervals keep tidal enabled without the warning', async () => {
    const warnings = []
    const { m, provider } = intervalFixture(5) // 相邻帧间隔 300 秒
    const data = await FlowFieldData.load(provider, m, {
        worker: false, profile: qiantangProfile, onWarning: w => warnings.push(w)
    })
    try {
        assert.ok(!warnings.some(w => w.code === 'TIDAL_INTERVAL_UNVERIFIED'))
        assert.deepEqual(data.tidalAvailability, { available: true })
    } finally {
        data.destroy()
    }
})

test('flow capabilities report interval-unverified while the scenario stays ready', async () => {
    const { m, provider } = intervalFixture(60)
    const renderer = {
        attach: () => ({
            setFrames() { }, setTime() { }, setOptions() { }, requestRender() { }, destroy() { }
        })
    }
    const flow = createFlowField({
        provider, renderer, worker: false,
        extensions: [createTidalEstuary({ profile: qiantangProfile })]
    })
    try {
        await flow.loadScenario()
        assert.equal(flow.getState().status, 'ready')
        assert.deepEqual(flow.getCapabilities().tidal, { available: false, reason: 'interval-unverified' })
        assert.ok(flow.getDiagnostics().warnings.some(w => w.code === 'TIDAL_INTERVAL_UNVERIFIED'))
    } finally {
        await flow.destroy()
    }
})
