import test from 'node:test'
import assert from 'node:assert/strict'
import { createSSRApp, h } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { createFlowField } from '../packages/sdk/src/index.js'
import { createTidalEstuary } from '../packages/sdk/src/tidal-estuary.js'
import {
  DigitalFlowField,
  FlowControls,
  FlowLegend,
  FlowMiniChart,
  FlowQueryPopup,
  FlowScenarioSelector,
  FlowTimeline
} from '../packages/vue-tdesign/src/index.js'
import {
  compassDirection,
  formatCellCount,
  formatFlowTime,
  formatIntervalLabel,
  frameTargetTime
} from '../packages/vue-tdesign/src/format.js'

function fixture() {
  const m = {
    formatVersion: 2,
    scenarioId: 'run-vue',
    sourceRunId: 'RUN-VUE-01',
    scenarioName: 'Vue 组件测试场次',
    nNodes: 4,
    nCells: 2,
    nTris: 2,
    nFrames: 3,
    bbox: [100, 0, 140, 40],
    scales: { level: 0.01, uv: 0.001 },
    drySentinel: -32768,
    mesh: { meshId: 'test', file: 'mesh.bin.gz' },
    frames: [0, 5, 10].map((minute, index) => ({
      index,
      validTime: `2026-10-25T00:${String(minute).padStart(2, '0')}:00+08:00`,
      file: `frames/${index}.bin.gz`
    }))
  }
  const mesh = new ArrayBuffer(108)
  const head = new DataView(mesh)
  ;[0x46464d31, 4, 2, 2].forEach((v, i) => head.setUint32(i * 4, v, true))
  new Float32Array(mesh, 16, 12).set([120, 120.1, 120.1, 120, 30, 30, 30.1, 30.1, -5, -5, -5, -5])
  new Uint16Array(mesh, 64, 6).set([0, 1, 2, 0, 2, 3])
  new Uint16Array(mesh, 76, 8).set([0, 1, 2, 0, 0, 2, 3, 0])
  new Float32Array(mesh, 92, 4).set([120.066, 120.033, 30.033, 30.066])
  const frames = [0, 1, 2].map(i => new Int16Array([100 + i * 100, 200 + i * 100, 1000 + i * 1000, 500 + i * 500, 0, 0]).buffer)
  const provider = {
    async listScenarios() {
      return [{ id: 'run-vue', sourceRunId: 'RUN-VUE-01', name: 'Vue 组件测试场次', startTime: m.frames[0].validTime, endTime: m.frames[2].validTime, frameCount: 3 }]
    },
    async loadManifest() { return m },
    async getMesh() { return mesh.slice(0) },
    async getFrame(_, i) { return frames[i].slice(0) }
  }
  const renderer = {
    attach() {
      return {
        setFrames() {},
        setTime() {},
        setOptions() {},
        requestRender() {},
        getTidalState() { return { status: 'tracked', active: true, visualOnly: true } },
        destroy() {}
      }
    }
  }
  return { provider, renderer }
}

test('Vue 格式化辅助函数处理时区、单元计数、静流方向与目标时刻', () => {
  assert.equal(formatFlowTime('2026-10-24T16:05:00.000Z', { timeZone: 'Asia/Shanghai', seconds: true }), '2026-10-25 00:05:00')
  assert.equal(formatFlowTime('2026-10-24T16:05:00.000Z', { timeZone: 'UTC', compact: true }), '10-24 16:05')
  assert.equal(formatIntervalLabel(300, 144), '5 分钟')
  assert.equal(formatIntervalLabel(3600, 72), '1 小时')
  assert.equal(formatIntervalLabel(null, 5), '非等间隔')
  assert.equal(formatIntervalLabel(300, 1), '单时次')
  assert.equal(formatCellCount(71958), '7.2 万')
  assert.equal(formatCellCount(420), '420')
  assert.equal(compassDirection(null), '静流')
  assert.equal(compassDirection(90), '东')

  const target = frameTargetTime({
    startTime: '2026-10-24T16:00:00.000Z',
    endTime: '2026-10-24T16:10:00.000Z',
    frameCount: 3,
    frameIntervalSeconds: 300
  }, 1)
  assert.equal(target.toISOString(), '2026-10-24T16:05:00.000Z')

  const irregularTarget = frameTargetTime({
    startTime: '2026-10-24T16:00:00.000Z',
    endTime: '2026-10-24T16:15:00.000Z',
    frameCount: 3,
    frameIntervalSeconds: null,
    frameTimes: ['2026-10-24T16:00:00.000Z', '2026-10-24T16:05:00.000Z', '2026-10-24T16:15:00.000Z']
  }, 1)
  assert.equal(irregularTarget.toISOString(), '2026-10-24T16:05:00.000Z')
})

test('FlowLegend、FlowMiniChart 与 FlowQueryPopup 支持湿/干/静流与 SVG 断点', async () => {
  const legendHtml = await renderToString(createSSRApp({
    render: () => h(FlowLegend, { mode: 'speed', speedMax: 4 })
  }))
  assert.match(legendHtml, /流速强度/)
  assert.match(legendHtml, /4\.0/)

  const series = {
    scenarioId: 's1',
    cellIndex: 10,
    source: 'frames',
    points: [
      { frameIndex: 0, validTime: '2026-10-25T00:00:00+08:00', dry: false, level: 1.5, u: 1, v: 0, speed: 1, dirDeg: 90 },
      { frameIndex: 1, validTime: '2026-10-25T00:05:00+08:00', dry: true, level: null, u: null, v: null, speed: null, dirDeg: null },
      { frameIndex: 2, validTime: '2026-10-25T00:10:00+08:00', dry: false, level: 2.0, u: 0, v: 0, speed: 0, dirDeg: null }
    ]
  }
  const chartHtml = await renderToString(createSSRApp({
    render: () => h(FlowMiniChart, { series, currentTime: '2026-10-25T00:10:00+08:00' })
  }))
  // 干单元跳过并分两段绘制，path 应包含两个 M 命令
  const levelPathMatch = chartHtml.match(/<path[^>]*d="([^"]+)"[^>]*class="df-level-line"/)
    || chartHtml.match(/<path[^>]*class="df-level-line"[^>]*d="([^"]+)"/)
  assert.ok(levelPathMatch)
  assert.equal((levelPathMatch[1].match(/M/g) || []).length, 2)

  const zeroDirHtml = await renderToString(createSSRApp({
    render: () => h(FlowQueryPopup, {
      sample: { status: 'wet', cell: 10, lon: 120.5, lat: 30.3, time: '2026-10-25T00:10:00+08:00', wet: true, wetTransition: false, level: 2.0, u: 0, v: 0, speed: 0, dirDeg: null },
      series
    })
  }))
  assert.match(zeroDirHtml, /静流/)
  assert.match(zeroDirHtml, /0 流速/)

  const dryHtml = await renderToString(createSSRApp({
    render: () => h(FlowQueryPopup, {
      sample: { status: 'dry', cell: 10, lon: 120.5, lat: 30.3, time: '2026-10-25T00:05:00+08:00', wet: false, wetTransition: false, level: null, u: null, v: null, speed: null, dirDeg: null },
      series
    })
  }))
  assert.match(dryHtml, /当前单元无水/)
})

test('FlowControls、FlowTimeline、FlowScenarioSelector 与 DigitalFlowField SSR 渲染完整', async () => {
  const { provider, renderer } = fixture()
  const flow = createFlowField({
    provider,
    renderer,
    worker: false,
    extensions: [createTidalEstuary({
      profile: {
        id: 'test-estuary',
        polygon: [[119, 29], [121, 29], [121, 31], [119, 31]],
        seaward: 'east',
        validatedIntervalsSeconds: [300]
      }
    })]
  })
  await flow.loadScenario()

  const workspaceHtml = await renderToString(createSSRApp({
    render: () => h(DigitalFlowField, { flow, showLocate: true })
  }))
  assert.match(workspaceHtml, /df-controls/)
  assert.match(workspaceHtml, /df-timeline/)
  assert.match(workspaceHtml, /计算单元/)
  assert.match(workspaceHtml, /5 分钟/)
  assert.match(workspaceHtml, /恢复默认粒子/)
  assert.match(workspaceHtml, /潮头清浊分界/)
  assert.match(workspaceHtml, /显示参数/)

  const controlsOnlyHtml = await renderToString(createSSRApp({
    render: () => h(FlowControls, { flow, showPlayback: true })
  }))
  assert.match(controlsOnlyHtml, /播放/)

  const timelineOnlyHtml = await renderToString(createSSRApp({
    render: () => h(FlowTimeline, { flow })
  }))
  assert.match(timelineOnlyHtml, /1 \/ 3 时次/)

  const selectorHtml = await renderToString(createSSRApp({
    render: () => h(FlowScenarioSelector, { flow, scenarios: [{ id: 'run-vue', name: 'Vue 组件测试场次' }] })
  }))
  assert.match(selectorHtml, /df-scenario-select/)

  await flow.destroy()
})
