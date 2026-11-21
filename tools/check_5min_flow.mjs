import assert from 'node:assert/strict'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { gunzipSync } from 'node:zlib'
import { createServer } from 'node:http'
import { createLocalFlowHandler } from '../tdesign/server/local-flow-field.mjs'
import { timeAtFrame, formatFlowTime, frameIntervalLabel } from '../tdesign/src/flowfield/flowTime.js'
import { FlowFieldController } from '../tdesign/src/flowfield/FlowFieldController.js'

const packageRoot = new URL('../output/flowfield-5min-verified/', import.meta.url)
const manifest = JSON.parse(await readFile(new URL('package.json', packageRoot), 'utf8'))
const sha = buffer => createHash('sha256').update(buffer).digest('hex')
const times = manifest.frames.map(frame => frame.validTime)
assert.equal(times.length, 144)
assert.equal(manifest.timeStepSeconds, 300)
assert.equal(times[0], '2026-10-25T00:00:00+08:00')
assert.equal(times.at(-1), '2026-10-25T11:55:00+08:00')
for (let i = 1; i < times.length; i++) assert.equal(Date.parse(times[i]) - Date.parse(times[i - 1]), 300000)
const frames = []
for (const item of [manifest.mesh, ...manifest.frames]) {
  const encoded = await readFile(new URL(item.file, packageRoot))
  const raw = gunzipSync(encoded)
  assert.equal(encoded.length, item.compressedLength)
  assert.equal(sha(encoded), item.compressedSha256)
  assert.equal(raw.length, item.rawLength)
  assert.equal(sha(raw), item.rawSha256)
  if (item !== manifest.mesh) frames.push(raw)
}
assert.equal(formatFlowTime(timeAtFrame(times, 0.5), { seconds: true }), '2026-10-25 00:02:30')
assert.equal(formatFlowTime(timeAtFrame(times, 11.5), { seconds: true }), '2026-10-25 00:57:30')
assert.equal(formatFlowTime(timeAtFrame(times, 143)), '2026-10-25 11:55')
assert.equal(formatFlowTime(timeAtFrame(times, 999)), '2026-10-25 11:55')
assert.equal(frameIntervalLabel(times), '5 \u5206\u949f')
assert.equal(timeAtFrame([times[0]], 10), Date.parse(times[0]))

const server = createServer(createLocalFlowHandler({ packageDir: '../output/flowfield-5min-verified' }))
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
const origin = `http://127.0.0.1:${server.address().port}`
const get = async path => {
  const response = await fetch(origin + path)
  assert.equal(response.status, 200, path)
  return (await response.json()).data
}
let wetCell = -1, dryCell = -1
for (let i = 0; i < manifest.nCells; i++) {
  if (frames[0].readInt16LE(i * 2) === manifest.drySentinel) dryCell = i
  else wetCell = i
  if (wetCell >= 0 && dryCell >= 0) break
}
try {
  const scenarios = await get('/scenarios')
  assert.equal(scenarios[0].id, manifest.sourceRunId)
  assert.equal(scenarios[0].frameCount, 144)
  assert.equal(scenarios[1].frameCount, 72)
  const latest = await get('/scenarios/latest/manifest')
  assert.equal(latest.sourceRunId, manifest.sourceRunId)
  for (const index of [0, 1, 11, 12, 72, 143]) {
    const response = await fetch(`${origin}/scenarios/${manifest.sourceRunId}/frames/${index}`)
    assert.equal(response.headers.get('content-encoding'), 'gzip')
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), frames[index])
  }
  for (const cell of [wetCell, dryCell].filter(value => value >= 0)) {
    const series = await get(`/scenarios/${manifest.sourceRunId}/cells/${cell}/series`)
    assert.equal(series.points.length, 144)
    for (let index = 0; index < 144; index++) {
      const point = series.points[index], raw = frames[index]
      const level = raw.readInt16LE(cell * 2)
      const dry = level === manifest.drySentinel
      assert.equal(point.validTime, times[index])
      assert.equal(point.frameIndex, index)
      assert.equal(point.dry, dry)
      assert.equal(point.level, dry ? null : level * manifest.scales.level)
      assert.equal(point.u, dry ? null : raw.readInt16LE((manifest.nCells + cell) * 2) * manifest.scales.uv)
      assert.equal(point.v, dry ? null : raw.readInt16LE((manifest.nCells * 2 + cell) * 2) * manifest.scales.uv)
    }
  }
  assert.equal((await fetch(`${origin}/scenarios/latest/frames/144`)).status, 404)
  assert.equal((await fetch(`${origin}/scenarios/latest/cells/${manifest.nCells}/series`)).status, 404)
  const legacy = await get('/scenarios/local/manifest')
  assert.equal(legacy.nFrames, 72)
  assert.equal(frameIntervalLabel(legacy.times), '1 \u5c0f\u65f6')
  assert.equal(timeAtFrame(legacy.times, 0.5) - Date.parse(legacy.times[0]), 1800000)
} finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)) }

const flush = () => new Promise(resolve => setImmediate(resolve))
const pending = new Map()
const data = {
 nFrames: 144, meta: { times }, activateWindow() {}, destroy() {},
 nodeFrame(index) { return new Promise(resolve => { const queue = pending.get(index) || []; queue.push(resolve); pending.set(index, queue) }) }
}
const viewer = { scene: { preUpdate: { addEventListener() {}, removeEventListener() {} }, requestRender() {} } }
const controller = new FlowFieldController(viewer, data)
const layer = { show: true, setFrames(a,b) { this.a = a; this.b = b }, setT(value) { this.t = value } }
controller.addLayer(layer)
const resolveFrame = index => { for (const resolve of pending.get(index) || []) resolve(new Float32Array([index])); pending.delete(index) }
resolveFrame(0); resolveFrame(1); await flush()
controller.setPlaying(false)
controller.setHour(12.5)
assert.equal(controller.displayHour, 0, 'keep display time at last rendered frame while buffering')
controller.setHour(24.5)
resolveFrame(24); resolveFrame(25); await flush()
assert.equal(controller.displayHour, 24.5)
assert.equal(controller.timeLabel(), '2026-10-25 02:02')
assert.equal(layer.a[0], 24)
resolveFrame(12); resolveFrame(13); await flush()
assert.equal(controller.displayHour, 24.5, 'late response must not overwrite newer seek')
controller.setHour(143)
resolveFrame(142); resolveFrame(143); await flush()
assert.equal(controller.timeLabel(), '2026-10-25 11:55')
assert.equal(layer.t, 1)
controller.setHour(NaN)
assert.equal(controller.simHour, 143)
controller.setHour(2)
controller.destroy()
resolveFrame(2); resolveFrame(3); await flush()
assert.equal(controller._frameDataA, null, 'destroyed controller ignores outstanding response')

const report = {
 checkedAt: new Date().toISOString(), sourceRunId: manifest.sourceRunId,
 frames: manifest.nFrames, nodes: manifest.nNodes, cells: manifest.nCells,
 start: times[0], end: times.at(-1), stepSeconds: 300,
 checks: ['144 timestamps and uniform cadence', '145 compressed/raw lengths and SHA256', 'fractional-frame time and endpoints', 'HTTP decoded frames match package', 'wet and dry cell series match all 144 raw frames', 'invalid frame/cell return 404', '72-frame hourly backward compatibility', 'buffering keeps rendered time', 'rapid seeks ignore stale responses', 'destroy ignores pending response'],
 wetCell, dryCell, status: 'PASS'
}
await mkdir(new URL('../output/playwright/', import.meta.url), { recursive: true })
await writeFile(new URL('../output/playwright/5min-validation.json', import.meta.url), JSON.stringify(report, null, 2))
console.log(JSON.stringify(report, null, 2))
