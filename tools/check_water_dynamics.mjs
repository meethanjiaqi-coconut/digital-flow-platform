import assert from 'node:assert/strict'
import { FlowDisplacement, ShorelineDistance, FLOW_METRES_PER_MODEL_METRE, FLOW_PHASE_SECONDS } from '../tdesign/src/flowfield/flowDynamics.js'

const flow = new FlowDisplacement(2)
const wet = [1, 0], u = [1, 1], v = [0.5, 1]
flow.advance(0.5, u, v, wet)
assert.deepEqual(Array.from(flow.values), [600, 300, 600, 300, 0, 0, 0, 0])
const before = flow.values.slice(), time = flow.time, version = flow.version
assert.equal(flow.advance(0, u, v, wet), false)
assert.equal(flow.time, time)
assert.equal(flow.version, version)
flow.strength = 3
assert.deepEqual(flow.values, before, 'Changing gain must not move existing texture coordinates')
flow.advance(0.1, [-1, 0], [-0.5, 0], wet)
assert.ok(Math.abs(flow.values[0] - (600 - 0.3 * FLOW_METRES_PER_MODEL_METRE)) < 1e-4)
assert.ok(flow.values[0] < before[0], 'A reversing current must immediately reverse subsequent displacement')

const phase = new FlowDisplacement(1)
phase.strength = 1
phase.advance(FLOW_PHASE_SECONDS / 2 - 0.00001, [1], [0], [1])
const visibleBefore = phase.values[0] * (1 - phase.blend) + phase.values[2] * phase.blend
phase.advance(0.00001, [1], [0], [1])
assert.equal(phase.blend, 0)
assert.equal(phase.values[2], 0)
assert.ok(Math.abs(phase.values[0] - visibleBefore) < 0.02, 'The reset phase must be invisible')
phase.advance(FLOW_PHASE_SECONDS / 2, [1], [0], [1])
assert.equal(phase.blend, 1)
assert.equal(phase.values[0], 0)
assert.equal(phase.values[2], FLOW_PHASE_SECONDS / 2 * FLOW_METRES_PER_MODEL_METRE)

// A 5x5 triangular mesh with 100-metre spacing: include a real interior dry cell.
const n = 5, lon = [], lat = [], tri = []
for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { lon.push(x * 100 / 111320); lat.push(y * 100 / 110540) }
for (let y = 0; y < n - 1; y++) for (let x = 0; x < n - 1; x++) {
  const a = y * n + x; tri.push(a, a + 1, a + n, a + 1, a + n + 1, a + n)
}
const shore = new ShorelineDistance({ nNodes: 25, lon, lat, tri })
const allWet = new Uint8Array(25).fill(1), d = shore.compute(allWet)
assert.equal(d[0], 0)
assert.ok(Math.abs(d[12] - 200) < 0.01)
const drying = allWet.slice(); drying[12] = 0
const retreat = shore.compute(drying)
assert.equal(retreat[12], 0)
assert.ok(retreat[7] > 99 && retreat[7] < 101)
assert.ok(shore.compute(new Uint8Array(25)).every(value => value === 0))
assert.ok(shore.compute(allWet, 40).every(value => value <= 40))
assert.deepEqual(shore.compute(allWet), d, 'A dry cycle must not mutate the mesh or later wet distances')
console.log('PASS: shared linear velocity, reversal, pause, gain continuity, invisible phase resets, wet/dry shoreline distance')
