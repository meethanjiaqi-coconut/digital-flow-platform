import { readFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { gunzipSync } from 'node:zlib'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const digest = buffer => createHash('sha256').update(buffer).digest('hex')

/** 本地演示沿用正式只读 API，浏览器仍按帧加载；不会上传任何数据。 */
export function createLocalFlowHandler({ packageDir } = {}) {
    const sources = []
    if (packageDir) {
        const root = resolve(projectRoot, packageDir)
        const manifest = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'))
        if (manifest.formatVersion !== 2 || manifest.frames.length !== manifest.nFrames) throw new Error('本地转换包 Manifest 不合法')
        manifest.scenarioId = manifest.sourceRunId
        sources.push({
            manifest,
            mesh: () => readFile(resolve(root, manifest.mesh.file)),
            frame: index => readFile(resolve(root, manifest.frames[index].file)),
            compressed: true,
        })
    }
    const legacyRoot = resolve(projectRoot, 'public/data/flowfield')
    const meta = JSON.parse(readFileSync(resolve(legacyRoot, 'meta.json'), 'utf8'))
    const mesh = readFileSync(resolve(legacyRoot, 'mesh.bin'))
    let legacyFrames
    const legacy = {
        ...meta, scenarioId: 'local', sourceRunId: 'local',
        scenarioName: '2026年7月9日 · 逐时流场（原数据）',
        startTime: meta.times[0], endTime: meta.times.at(-1), timeStepSeconds: 3600,
        mesh: { meshId: digest(mesh) },
        frames: meta.times.map((validTime, index) => ({ index, validTime })),
    }
    sources.push({
        manifest: legacy, compressed: false, mesh: async () => mesh,
        frame: async index => {
            legacyFrames ||= readFileSync(resolve(legacyRoot, 'frames.bin'))
            const size = meta.nCells * 6
            if (legacyFrames.readUInt32LE(0) !== 0x46464631 || legacyFrames.length !== 12 + meta.nFrames * size) {
                throw new Error('原逐时二进制与元信息不一致')
            }
            return legacyFrames.subarray(12 + index * size, 12 + (index + 1) * size)
        },
    })
    return async (request, response) => {
        const path = new URL(request.url, 'http://localhost').pathname
        const json = (data, status = 200) => {
            if (response.destroyed) return
            response.statusCode = status
            response.setHeader('Cache-Control', 'no-store')
            response.setHeader('Content-Type', 'application/json; charset=utf-8')
            response.end(JSON.stringify(status === 200 ? { code: 0, message: 'OK', data } : { code: status, message: data }))
        }
        const binary = (buffer, compressed) => {
            if (response.destroyed) return
            response.setHeader('Content-Type', 'application/octet-stream')
            response.setHeader('Content-Length', buffer.length)
            response.setHeader('Cache-Control', 'no-store')
            response.setHeader('ETag', '"' + digest(buffer) + '"')
            if (compressed) response.setHeader('Content-Encoding', 'gzip')
            response.end(buffer)
        }
        try {
            if (request.method !== 'GET') return json('只支持 GET', 405)
            if (path === '/scenarios') return json(sources.map(({ manifest: m }) => ({
                id: m.scenarioId, sourceRunId: m.sourceRunId, name: m.scenarioName,
                meshId: m.mesh.meshId, startTime: m.startTime, endTime: m.endTime,
                frameCount: m.nFrames, timeStepSeconds: m.timeStepSeconds,
            })))
            const meshMatch = path.match(/^\/meshes\/([^/]+)$/)
            if (meshMatch) {
                const id = decodeURIComponent(meshMatch[1])
                const source = sources.find(({ manifest: m }) => m.mesh.meshId === id || m.sourceRunId === id)
                return source ? binary(await source.mesh(), source.compressed) : json('网格不存在', 404)
            }
            const match = path.match(/^\/scenarios\/([^/]+)\/(manifest|frames\/(\d+)|cells\/(\d+)\/series)$/)
            if (!match) return json('本地流场接口不存在', 404)
            const id = decodeURIComponent(match[1])
            const source = id === 'latest' ? sources[0] : sources.find(({ manifest: m }) => m.scenarioId === id || m.sourceRunId === id)
            if (!source) return json('场次不存在', 404)
            const m = source.manifest
            if (match[2] === 'manifest') return json(m)
            if (match[3] !== undefined) {
                const index = Number(match[3])
                if (index >= m.nFrames) return json('帧不存在', 404)
                return binary(await source.frame(index), source.compressed)
            }
            const cell = Number(match[4])
            if (cell >= m.nCells) return json('单元不存在', 404)
            const points = []
            for (let index = 0; index < m.nFrames; index++) {
                if (response.destroyed) return
                const encoded = await source.frame(index)
                const raw = source.compressed ? gunzipSync(encoded) : encoded
                const level = raw.readInt16LE(cell * 2)
                const dry = level === m.drySentinel
                points.push({
                    frameIndex: index, validTime: m.frames[index].validTime, dry,
                    level: dry ? null : level * m.scales.level,
                    u: dry ? null : raw.readInt16LE((m.nCells + cell) * 2) * m.scales.uv,
                    v: dry ? null : raw.readInt16LE((m.nCells * 2 + cell) * 2) * m.scales.uv,
                })
            }
            return json({ scenarioId: m.scenarioId, cellIndex: cell, points })
        } catch (error) {
            console.error('[本地流场]', error)
            json('本地数据读取失败，请检查转换包完整性', 500)
        }
    }
}

export function localFlowField(options) {
    let handler
    const register = server => {
        handler ||= createLocalFlowHandler(options)
        server.middlewares.use('/flow-field/api/v1', handler)
    }
    return { name: 'local-flow-field', configureServer: register, configurePreviewServer: register }
}
