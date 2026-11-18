import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createStaticProvider } from '../packages/sdk/src/providers.js'
import { FlowFieldData } from '../packages/sdk/src/internal/FlowFieldData.js'
import { tidalGeometry } from '../packages/sdk/src/internal/tidalEvolution.js'
import { qiantangProfile } from '../packages/sdk/src/tidal-estuary.js'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const manifestPath = resolve(root, 'local-assets/data/5min/package.json')
const fixturePath = resolve(root, 'tests/fixtures/tidal-golden.json')
const GOLDEN_FRAMES = [0, 1, 30, 60, 100, 143]

const sha256 = bytes => createHash('sha256').update(bytes).digest('hex')
const hashTypedArray = value => sha256(new Uint8Array(value.buffer, value.byteOffset, value.byteLength))

function sortKeys(value) {
    if (Array.isArray(value)) return value.map(sortKeys)
    if (value && typeof value === 'object') {
        return Object.fromEntries(Object.keys(value).sort().map(key => [key, sortKeys(value[key])]))
    }
    return value
}
const stableJson = value => JSON.stringify(sortKeys(value))

/** tidalFrontFrame 结果摘要：TypedArray 字段按名排序各自 SHA-256，其余字段稳定排序 JSON。 */
function summarizeFrame(result) {
    const out = {}
    for (const key of Object.keys(result).sort()) {
        const value = result[key]
        out[key] = ArrayBuffer.isView(value) ? { sha256: hashTypedArray(value) } : stableJson(value)
    }
    return out
}

/** tidalGeometry 关键场按名 SHA-256。 */
function summarizeGeometry(g) {
    const out = {}
    for (const key of ['activeCells', 'riverDistance', 'upstreamX', 'upstreamY', 'coordinates']) {
        out[key] = hashTypedArray(g[key])
    }
    return out
}

async function computeGolden() {
    const request = async url => new Response(await readFile(fileURLToPath(url)))
    const provider = createStaticProvider({ manifestUrl: pathToFileURL(manifestPath).href, request })
    const manifest = await provider.loadManifest()
    const data = await FlowFieldData.load(provider, manifest, { worker: false, profile: qiantangProfile })
    try {
        const frames = {}
        for (const index of GOLDEN_FRAMES) {
            frames[index] = summarizeFrame(await data.tidalFrontFrame(index))
        }
        return { frames, geometry: summarizeGeometry(tidalGeometry(data)) }
    } finally {
        data.destroy()
    }
}

test('潮头黄金基线：tidalFrontFrame 与 tidalGeometry 输出摘要', { skip: !existsSync(manifestPath) && '缺少 local-assets/data/5min 数据' }, async () => {
    const golden = await computeGolden()
    if (process.env.UPDATE_TIDAL_GOLDEN === '1') {
        await mkdir(dirname(fixturePath), { recursive: true })
        await writeFile(fixturePath, JSON.stringify(golden, null, 2))
        return
    }
    const expected = JSON.parse(await readFile(fixturePath, 'utf8'))
    assert.deepEqual(golden, expected)
})
