import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { FlowFieldData } from '../tdesign/src/flowfield/FlowFieldData.js'
import { TidalTracker, TidalEvolution, interpolateTidalTrack, locateTidalSection } from '../tdesign/src/flowfield/tidalEvolution.js'

const candidate = (distance, score = 1) => ({ distance, score, confidence: 0.8, depth: 5, speed: 0.5, longitude: 120.4, latitude: 30.3 })
const tracker = new TidalTracker()
tracker.step([candidate(10000)], 300, 300)
const start = tracker.step([candidate(11000)], 600, 300)
assert.equal(start.status, 'tracked')
const matched = tracker.step([candidate(65000, 9), candidate(12500)], 900, 300)
assert.equal(matched.distance, 12500, 'A stronger remote candidate must not steal the current bore')
const weak = tracker.step([candidate(65000, 9)], 1200, 300)
assert.equal(weak.distance, 12500);assert.equal(weak.status, 'uncertain')
for (const t of [1500, 1800, 2100]) assert.equal(tracker.step([], t, 300).confidence, 0)
tracker.step([candidate(66000)], 2400, 300)
tracker.step([candidate(67000)], 2700, 300)
const reacquired = tracker.step([candidate(68000)], 3000, 300)
assert.ok(reacquired.segment > start.segment)
for (const t of [0.25, 0.5, 0.75]) {
    const value = interpolateTidalTrack(matched, reacquired, t)
    assert.ok(value.distance === matched.distance || value.distance === reacquired.distance, 'New segments must fade, not sweep through unsupported positions')
}

// Synthetic connected channel: isolate transport without a front source.
const channel = { nNodes: 8, nCells: 3, lon: [], lat: [], zb: Array(8).fill(-3), cellNode: [], cellLon: [], cellLat: [],
    dry: -32768, levelScale: 0.01, uvScale: 0.001,
    tidalFrontPolygon: [[120.69,30.29],[120.73,30.29],[120.73,30.32],[120.69,30.32]] }
for (let x = 0; x < 4; x++) { channel.lon.push(120.7+x*0.004,120.7+x*0.004);channel.lat.push(30.3,30.304) }
for (let x = 0; x < 3; x++) { channel.cellNode.push(x*2,x*2+1,x*2+3,x*2+2);channel.cellLon.push(120.702+x*0.004);channel.cellLat.push(30.302) }
const transport = velocity => {
    const e = new TidalEvolution(channel), frame = new Int16Array([100,100,100,velocity,velocity,velocity,0,0,0])
    e.sediment[1] = 1;e.step(0,frame,frame,0,300);return e.sediment
}
const east = transport(1000), west = transport(-1000)
assert.ok(east[2] > east[0] * 5, 'Sediment must follow eastward model velocity')
assert.ok(west[0] > west[2] * 5, 'Sediment must reverse with the velocity')
const decay = transport(0)
assert.ok(decay[1] > 0 && decay[1] < 1, 'Residual sediment must persist and decay')

const root = new URL('../output/flowfield-5min-verified/', import.meta.url)
const manifest = JSON.parse(await readFile(new URL('package.json', root), 'utf8'))
const unpack = async file => { const raw = gunzipSync(await readFile(new URL(file, root)));return raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength) }
const data = new FlowFieldData({ ...manifest, scenarioId: manifest.sourceRunId }, await unpack(manifest.mesh.file), '')
const evolution = new TidalEvolution(data), rows = [], frames = []
const hash = array => createHash('sha256').update(Buffer.from(array.buffer, array.byteOffset, array.byteLength)).digest('hex')
let previous, maxAdjacentChange = 0, lastTrack, projected = 0
for (let index = 0; index < manifest.nFrames; index++) {
    const current = new Int16Array(await unpack(manifest.frames[index].file));frames.push(current);data._rawFrames.set(index,current)
    const seconds = (Date.parse(manifest.frames[index].validTime)-Date.parse(manifest.frames[0].validTime))/1000
    const dt = index ? seconds - rows.at(-1).seconds : 0
    const result = evolution.step(index,previous||current,current,seconds,dt), track = result.track
    for (const x of result.memory) assert.ok(Number.isFinite(x) && x >= 0 && x <= 1)
    if (track.status === 'tracked') {
        assert.ok(result.candidates.some(c => c.distance === track.distance), 'Accepted positions must come from actual candidates')
        if (lastTrack?.segment === track.segment && index === lastTrack.frame + 1) {
            const change = Math.abs(track.distance-lastTrack.distance)
            maxAdjacentChange = Math.max(maxAdjacentChange,change)
            assert.ok(change < 10000,'Reject the recorded 40-50 km jumps')
        }
        lastTrack = { ...track,frame:index }
        const p = locateTidalSection(evolution.g,track,c=>current[c]!==data.dry)
        assert.ok(p,'A tracked label must lie on an existing wet contour')
        const ids = Array.from(data.cellNode.slice(p.cell*4,p.cell*4+3)), [a,b,c] = ids
        const x1=data.lon[a],y1=data.lat[a],x2=data.lon[b],y2=data.lat[b],x3=data.lon[c],y3=data.lat[c]
        const d=(y2-y3)*(x1-x3)+(x3-x2)*(y1-y3)
        const u=((y2-y3)*(p.longitude-x3)+(x3-x2)*(p.latitude-y3))/d
        const v=((y3-y1)*(p.longitude-x3)+(x1-x3)*(p.latitude-y3))/d
        const distance=u*evolution.g.coordinates[a*4]+v*evolution.g.coordinates[b*4]+(1-u-v)*evolution.g.coordinates[c*4]
        assert.ok(Math.abs(distance-track.distance)<1,'Marker must be on the same shader distance contour');projected++
    }
    rows.push({frame:index,seconds,track,memoryMaximum:Math.max(...result.memory),memoryHash:hash(result.memory),candidates:result.candidates})
    previous=current
}
assert.ok(rows[75].memoryMaximum>0 && rows[79].memoryMaximum<rows[75].memoryMaximum,'History continues to decay after the front disappears')
// Cold seek to the last frame, then arbitrary backwards/forwards queries.
for (const frame of [143,16,79,38,2,100,16,143]) {
    const actual = await data.tidalFrontFrame(frame)
    assert.deepEqual(actual.track,rows[frame].track)
    assert.equal(hash(actual.memory),rows[frame].memoryHash,'Random seeks must reproduce chronological sediment history exactly')
}
data.destroy()
const report={checkedAt:new Date().toISOString(),status:'PASS',frames:rows.length,projected,maxAdjacentChange,
    trackedFrames:rows.filter(r=>r.track.status==='tracked').length,
    checks:['remote candidate rejection','confidence decay','segment reacquisition without sweeping','U/V advection and reversal','residual decay','bounded concentrations','actual candidate provenance','marker/contour coincidence','cold and random seek determinism'],rows}
await writeFile(new URL('../output/playwright/tidal-refinement-data-validation.json',import.meta.url),JSON.stringify(report,null,2))
console.log(JSON.stringify({...report,rows:undefined},null,2))
