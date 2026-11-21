// Browser regression runner: executes scripts/browser-validate.js and
// scripts/browser-examples.js (async (page) => {...} functions) against the
// static demo server (auto-started if port 5185 is not already listening),
// then captures the five H2 comparison screenshots and writes a consolidated
// report to output/playwright/.
import { chromium } from 'file:///D:/nodejs/node_global/node_modules/playwright/index.mjs'
import { spawn } from 'node:child_process'
import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises'

const BASE = 'http://127.0.0.1:5185'
const OUT = 'output/playwright'
const loadScript = async name => eval(`(${await readFile(new URL(`./browser-${name}.js`, import.meta.url), 'utf8')})`)

async function ensureServer() {
  const probe = async () => {
    try {
      const r = await fetch(`${BASE}/examples/vanilla/`, { signal: AbortSignal.timeout(800) })
      return r.ok
    } catch { return false }
  }
  if (await probe()) return null
  const child = spawn(process.execPath, [new URL('./serve-demo.mjs', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')], { stdio: 'ignore' })
  for (let i = 0; i < 30; i++) {
    if (child.exitCode !== null) throw new Error(`Demo server exited early with ${child.exitCode}`)
    if (await probe()) return child
    await new Promise(r => setTimeout(r, 200))
  }
  child.kill()
  throw new Error('Timed out waiting for demo server on :5185')
}

const serverProc = await ensureServer()
const headed = process.env.PW_HEADLESS !== '1' && !process.argv.includes('--headless')
let browser
try {
  browser = await chromium.launch({
    headless: !headed,
    args: headed
      ? ['--enable-gpu', '--ignore-gpu-blocklist', '--enable-accelerated-2d-canvas']
      : ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist']
  })
} catch (error) {
  console.log('launch failed, retrying headless with GPU flags:', error.message)
  browser = await chromium.launch({
    headless: true,
    args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist']
  })
}

const page = await browser.newPage({ viewport: { width: 1600, height: 900 } })
const pageErrors = []
const failedRequests = []
page.on('pageerror', e => pageErrors.push(String(e)))
page.on('response', r => { if (r.status() >= 400 && r.url().includes('127.0.0.1')) failedRequests.push({ url: r.url(), status: r.status() }) })

const report = { gpu: null, phases: {}, warnings: {}, screenshots: [], pageErrors, failedRequests }
const waitReady = () => page.waitForFunction(() => window.demoFlow?.getState().status === 'ready', null, { timeout: 120000 })
const tapWarnings = () => page.evaluate(() => { window.__warnings = []; window.demoFlow.on('warning', w => window.__warnings.push(w)) })
const drainWarnings = () => page.evaluate(() => ({ tapped: window.__warnings ?? [], buffered: window.demoFlow?.getDiagnostics?.().warnings ?? [] }))

try {
  // Phase 1: 20-cycle mount/unmount lifecycle on the subdirectory mount.
  await page.goto(`${BASE}/sdk-demo/examples/vanilla/`)
  await waitReady()
  await tapWarnings()
  const validate = await (await loadScript('validate'))(page)
  await mkdir(OUT, { recursive: true })
  await copyFile(`${OUT}/browser-validation.json`, `${OUT}/h2-lifecycle-validation.json`).catch(() => { })
  report.phases.lifecycle = validate
  report.warnings.lifecycle = await drainWarnings()

  // Phase 2: vanilla + vue example interaction checks.
  const examples = await (await loadScript('examples'))(page)
  await copyFile(`${OUT}/browser-validation.json`, `${OUT}/h2-examples-validation.json`).catch(() => { })
  report.phases.examples = examples
  report.warnings.examples = await drainWarnings()

  // Phase 3: five comparison screenshots, same camera and timestamp.
  await page.goto(`${BASE}/examples/vanilla/`)
  await waitReady()
  await tapWarnings()
  report.gpu = await page.evaluate(() => {
    const gl = window.sdkDemo?.viewer?.scene?.context?._gl
    const ext = gl?.getExtension?.('WEBGL_debug_renderer_info')
    return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'unavailable'
  })
  const shots = [
    ['h2-standard', {}],
    ['h2-low', { quality: 'low' }],
    ['h2-quality-III', { water: { qualityPreset: 'III' } }],
    ['h2-tech', { water: { palette: 'tech' } }],
    ['h2-speed-arrows', { water: { colorMode: 'speed', arrows: true, arrowScale: 24 } }]
  ]
  for (const [name, patch] of shots) {
    await page.evaluate(async p => {
      const flow = window.demoFlow
      flow.setOptions({ quality: 'standard', exaggeration: 60, water: { palette: 'natural', qualityPreset: 'off', colorMode: 'river', arrows: false, arrowScale: 24 } })
      if (Object.keys(p).length) flow.setOptions(p)
      await flow.seek('2026-10-25T02:20:00+08:00')
      flow.pause()
    }, patch)
    await page.waitForTimeout(800)
    await page.screenshot({ path: `${OUT}/${name}.png` })
    report.screenshots.push(`${OUT}/${name}.png`)
  }
  report.warnings.screenshots = await drainWarnings()
  report.state = await page.evaluate(() => window.demoFlow.getState())
} finally {
  await writeFile(`${OUT}/h2-report.json`, JSON.stringify(report, null, 2))
  await browser.close()
  if (serverProc && serverProc.exitCode === null) serverProc.kill()
}
console.log(JSON.stringify({ gpu: report.gpu, lifecycle: report.phases.lifecycle?.lifecyclePassed, examples: report.phases.examples, pageErrors, failedRequests }, null, 2))
if (pageErrors.length || failedRequests.length || !report.phases.lifecycle?.lifecyclePassed) {
  process.exitCode = 1
}
