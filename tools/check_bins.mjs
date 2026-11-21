// Node 冒烟测试:node tools/check_bins.mjs
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { FlowFieldData } from '../tdesign/src/flowfield/FlowFieldData.js'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const DIR = join(ROOT, 'tdesign', 'public', 'data', 'flowfield')
const toAB = (b) => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)

const meta = JSON.parse(readFileSync(join(DIR, 'meta.json'), 'utf8'))
const data = FlowFieldData.fromLegacy(
    meta,
    toAB(readFileSync(join(DIR, 'mesh.bin'))),
    toAB(readFileSync(join(DIR, 'frames.bin')))
)

let fails = 0
const check = (name, cond) => {
    if (!cond) fails++
    console.log(`${cond ? 'PASS' : 'FAIL'} ${name}`)
}

check('计数一致', data.nNodes === meta.nNodes && data.nCells === meta.nCells && data.nFrames === meta.nFrames)

// 抽样 100 单元:中心点 pickCell 命中自身
let hit = 0
for (let s = 0; s < 100; s++) {
    const c = (s * 719 + 13) % data.nCells
    if (data.pickCell(data.cellLon[c], data.cellLat[c]) === c) hit++
}
check(`pickCell 单元中心命中 ${hit}/100`, hit >= 99) // 允许中心恰在边上的极端情况

// 数值范围
let ok = true
for (let f = 0; f < data.nFrames; f += 7) {
    for (let c = 0; c < data.nCells; c += 997) {
        const v = data.cellValue(f, c)
        if (v.wet && (Math.abs(v.level) > 10 || Math.abs(v.u) > 5 || Math.abs(v.v) > 5)) ok = false
    }
}
check('湿单元数值范围合理(|z1|<10m,|uv|<5m/s)', ok)

// 节点聚合:抽查节点值介于邻接湿单元 min/max 之间
const nf = await data.nodeFrame(0)
ok = true
for (let n = 0; n < data.nNodes; n += 511) {
    const s0 = data._adjOffsets[n], e0 = data._adjOffsets[n + 1]
    let lo = Infinity, hi = -Infinity, wetCnt = 0
    for (let j = s0; j < e0; j++) {
        const v = data.cellValue(0, data._adj[j])
        if (!v.wet) continue
        wetCnt++
        lo = Math.min(lo, v.level); hi = Math.max(hi, v.level)
    }
    const got = nf[n * 4]
    if (wetCnt > 0 && (got < lo - 1e-4 || got > hi + 1e-4)) ok = false
    if (wetCnt === 0 && nf[n * 4 + 3] !== 0) ok = false
}
check('节点聚合值在邻接范围内', ok)

// 与浏览器交叉验证用的参考值
for (const c of [0, 1000, 50000]) {
    const v = data.sampleCell(c, 0)
    console.log(`REF frame0 cell${c}: level=${v.level.toFixed(3)} speed=${v.speed.toFixed(3)} dir=${v.dirDeg.toFixed(1)} wet=${v.wet}`)
}
console.log(fails === 0 ? 'ALL PASS' : `${fails} FAILURES`)
process.exit(fails === 0 ? 0 : 1)
