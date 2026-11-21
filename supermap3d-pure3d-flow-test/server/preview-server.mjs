import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { createServer } from 'node:http'
import { dirname, extname, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const port = Number(process.env.PURE3D_TEST_PORT || 4181)
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const root = join(projectRoot, 'dist')
const mimeTypes = {
    '.bin': 'application/octet-stream',
    '.css': 'text/css; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.jpg': 'image/jpeg',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.wasm': 'application/wasm'
}

createServer(async (request, response) => {
    try {
        const { pathname } = new URL(request.url, `http://${request.headers.host}`)
        const requested = pathname === '/' ? 'index.html' : decodeURIComponent(pathname.slice(1))
        let file = resolve(root, requested)
        if (file !== root && !file.startsWith(root + sep)) {
            response.writeHead(403).end('Forbidden')
            return
        }
        try {
            if (!(await stat(file)).isFile()) throw new Error('Not a file')
        } catch {
            response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
            response.end('Not found')
            return
        }
        const info = await stat(file)
        response.writeHead(200, {
            'Content-Type': mimeTypes[extname(file).toLowerCase()] || 'application/octet-stream',
            'Content-Length': info.size
        })
        createReadStream(file).pipe(response)
    } catch (error) {
        console.error(error)
        response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' })
        response.end(error.message)
    }
}).listen(port, '127.0.0.1', () => {
    console.log(`Pure 3D flow test: http://127.0.0.1:${port}/`)
})
