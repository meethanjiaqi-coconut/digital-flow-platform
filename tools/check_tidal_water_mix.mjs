import assert from 'node:assert/strict'
import { TidalWaterMix } from '../tdesign/src/flowfield/tidalWaterMix.js'
import { createTidalRiverGeometry } from '../tdesign/src/flowfield/tidal-front-analysis.js'
import { FlowFieldController } from '../tdesign/src/flowfield/FlowFieldController.js'

// Connected bent channel: the last reach turns east again, so longitude is NOT
// a valid upstream coordinate. Use shared edges, as in the production mesh.
const centres = [[1.04, 0], [1.00, 0], [0.8, 0], [0.6, 0.1], [0.6, 0.4], [0.7, 0.6]]
const lon = [], lat = [], cellNode = [], cellLon = [], cellLat = []
for (const [x, y] of centres) { lon.push(x, x); lat.push(y - 0.01, y + 0.01) }
for (let i = 0; i < centres.length - 1; i++) {
    cellNode.push(i * 2, i * 2 + 1, i * 2 + 3, i * 2 + 2)
    cellLon.push((centres[i][0] + centres[i + 1][0]) / 2)
    cellLat.push((centres[i][1] + centres[i + 1][1]) / 2)
}
const polygon = [[0.4, -0.1], [1.05, -0.1], [1.05, 0.8], [0.4, 0.8]]
const data = { nNodes: lon.length, nCells: cellLon.length, lon, lat, cellNode, cellLon, cellLat,
    tidalFrontPolygon: polygon, tidalFrontAoi: [0.4, -0.1, 1.05, 0.8] }
const geometry = createTidalRiverGeometry({ ...data, polygon, aoi: data.tidalFrontAoi })
for (let i = 1; i < data.nCells; i++) assert.ok(geometry.riverDistance[i] > geometry.riverDistance[i - 1])
assert.ok(cellLon[4] > cellLon[3], 'The diagnostic channel must actually turn east')

const mix = new TidalWaterMix(data)
const a = new Float32Array(data.nNodes), b = new Float32Array(data.nNodes)
a[6] = 0.8; b[8] = 0.8
mix.setFrames(a, b)
mix.setT(0); const start = mix.distance
mix.setT(1); const end = mix.distance
assert.ok(end > start)
mix.setT(0.5)
assert.equal(mix.distance, (start + end) / 2, 'One interpolated front, not two fading boundaries')
assert.equal(mix.intensity, 1)
const paused = [mix.distance, mix.intensity]; mix.setT(0.5)
assert.deepEqual([mix.distance, mix.intensity], paused)
mix.setFrames(null, b); mix.setT(0)
assert.equal(mix.intensity, 0, 'Absent front must retain original water')
mix.setT(0.5); assert.equal(mix.distance, end); assert.ok(mix.intensity > 0)
mix.setFrames(null, null); assert.equal(mix.intensity, 0)

// Loading model frames must not reveal a boundary belonging to an older pair.
const viewer = { scene: { preUpdate: { addEventListener() {}, removeEventListener() {} }, requestRender() {} } }
const pending = new Map()
const source = { nFrames: 20, activateWindow() {}, hasFrame: () => true,
    nodeFrame: async frame => ({ frame }),
    tidalFrontFrame: frame => new Promise(resolve => pending.set(frame, resolve)), destroy() {} }
const c = new FlowFieldController(viewer, source)
await new Promise(resolve => setImmediate(resolve))
const water = { show: true, tidalTurbidityEnabled: true,
    setFrames(a, b) { this.model = [a.frame, b.frame] },
    setFrontFrames(a, b) { this.front = a && b ? [a.frame, b.frame] : null }, setT() {}, destroy() {} }
c.water = water; c.addLayer(water)
c.setHour(4)
await new Promise(resolve => setImmediate(resolve))
assert.equal(c._frameA, 0); assert.equal(c.buffering, true)
c.setHour(8)
pending.get(8)({ frame: 8 }); pending.get(9)({ frame: 9 })
await new Promise(resolve => setImmediate(resolve))
assert.deepEqual(water.model, [8, 9]); assert.deepEqual(water.front, [8, 9])
pending.get(4)({ frame: 4 }); pending.get(5)({ frame: 5 })
await new Promise(resolve => setImmediate(resolve))
assert.equal(c._frameA, 8, 'Stale async front must not overwrite the selected time')
assert.deepEqual(water.front, [8, 9])
// A hidden surface can skip model pairs. On reveal, its old boundary must be
// cleared while the new front is loading; it must not flash the previous tide.
c.setWaterVisible(false)
c.setHour(12)
await new Promise(resolve => setImmediate(resolve))
assert.equal(c._frameA, 12)
c.setWaterVisible(true)
assert.equal(water.front, null)
pending.get(12)({ frame: 12 }); pending.get(13)({ frame: 13 })
await new Promise(resolve => setImmediate(resolve))
assert.deepEqual(water.front, [12, 13])
c.destroy()
console.log('PASS: curved river direction, one interpolated boundary, no-front fallback, pause, atomic model/front loading, stale-seek rejection, hide/reveal freshness')
