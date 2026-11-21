import { defineComponent, h } from 'vue'
import { formatFlowTime } from './format.js'

const WIDTH = 360
const HEIGHT = 166
const PADDING_LEFT = 35
const PADDING_RIGHT = 39
const PADDING_TOP = 22
const PADDING_BOTTOM = 23

let chartIdSequence = 0
const isFiniteNum = value => value !== null && value !== undefined && Number.isFinite(Number(value))

function yForValue(value, min, max) {
  if (!isFiniteNum(value)) return Number.NaN
  const range = Math.max(0.0001, max - min)
  return PADDING_TOP + (HEIGHT - PADDING_TOP - PADDING_BOTTOM) * (1 - (Number(value) - min) / range)
}

function buildPath(points, timestamps, startMs, durationMs, key, min, max) {
  let path = ''
  let drawing = false
  points.forEach((point, index) => {
    const val = point?.[key]
    if (point?.dry || !isFiniteNum(val)) {
      drawing = false
      return
    }
    const ratio = durationMs > 0 ? Math.max(0, Math.min(1, (timestamps[index] - startMs) / durationMs)) : 0
    const x = PADDING_LEFT + (WIDTH - PADDING_LEFT - PADDING_RIGHT) * ratio
    const y = yForValue(val, min, max)
    path += `${drawing ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`
    drawing = true
  })
  return path
}

function buildAreaPath(points, timestamps, startMs, durationMs, min, max) {
  const baseline = HEIGHT - PADDING_BOTTOM
  const segments = []
  let line = ''
  let firstX = 0
  let lastX = 0
  const close = () => {
    if (line) segments.push(`${line}L${lastX.toFixed(1)},${baseline}L${firstX.toFixed(1)},${baseline}Z`)
    line = ''
  }
  points.forEach((point, index) => {
    if (point?.dry || !isFiniteNum(point?.level)) {
      close()
      return
    }
    const ratio = durationMs > 0 ? Math.max(0, Math.min(1, (timestamps[index] - startMs) / durationMs)) : 0
    const x = PADDING_LEFT + (WIDTH - PADDING_LEFT - PADDING_RIGHT) * ratio
    const y = yForValue(point.level, min, max)
    if (!line) firstX = x
    line += `${line ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`
    lastX = x
  })
  close()
  return segments.join('')
}

function sampleAtTime(points, timestamps, targetMs, key) {
  if (!points.length) return Number.NaN
  if (points.length === 1 || !Number.isFinite(targetMs)) {
    const p = points[0]
    return p?.dry || !isFiniteNum(p?.[key]) ? Number.NaN : Number(p[key])
  }
  const clamped = Math.max(timestamps[0], Math.min(timestamps[timestamps.length - 1], targetMs))
  let i = 0
  while (i < timestamps.length - 1 && timestamps[i + 1] <= clamped) i++
  const j = Math.min(points.length - 1, i + 1)
  const a = points[i]?.dry || !isFiniteNum(points[i]?.[key]) ? Number.NaN : Number(points[i][key])
  const b = points[j]?.dry || !isFiniteNum(points[j]?.[key]) ? Number.NaN : Number(points[j][key])
  if (!Number.isFinite(a) && !Number.isFinite(b)) return Number.NaN
  if (!Number.isFinite(a)) return b
  if (!Number.isFinite(b)) return a
  const span = timestamps[j] - timestamps[i]
  const ratio = span > 0 ? (clamped - timestamps[i]) / span : 0
  return a + (b - a) * ratio
}

export const FlowMiniChart = defineComponent({
  name: 'FlowMiniChart',
  props: {
    series: { type: Object, required: true },
    currentTime: { type: [String, Number, Date], default: null },
    currentFrame: { type: Number, default: 0 },
    timeZone: { type: String, default: 'Asia/Shanghai' }
  },
  setup(props) {
    const gradientId = `df-chart-level-fill-${++chartIdSequence}`
    return () => {
      const points = Array.isArray(props.series?.points) ? props.series.points : []
      if (!points.length) return null
      const timestamps = points.map((p, idx) => {
        const parsed = Date.parse(p?.validTime)
        return Number.isFinite(parsed) ? parsed : idx
      })
      const startMs = timestamps[0]
      const endMs = timestamps[timestamps.length - 1]
      const durationMs = Math.max(0, endMs - startMs)

      const levelValues = points.filter(p => !p?.dry && isFiniteNum(p?.level)).map(p => Number(p.level))
      const speedValues = points.filter(p => !p?.dry && isFiniteNum(p?.speed)).map(p => Number(p.speed))
      const levelMin = Math.floor(Math.min(...levelValues, 0) * 2) / 2
      const levelMax = Math.ceil(Math.max(...levelValues, 0.5) * 2) / 2
      const speedMax = Math.max(0.5, Math.ceil(Math.max(...speedValues, 0.5) * 2) / 2)

      let targetMs
      if (props.currentTime instanceof Date) targetMs = props.currentTime.getTime()
      else if (typeof props.currentTime === 'number') targetMs = props.currentTime
      else if (typeof props.currentTime === 'string') targetMs = Date.parse(props.currentTime)
      if (!Number.isFinite(targetMs)) {
        const idx = Math.max(0, Math.min(points.length - 1, Math.floor(props.currentFrame || 0)))
        const next = Math.min(points.length - 1, idx + 1)
        const frac = Math.max(0, Math.min(1, (props.currentFrame || 0) - idx))
        targetMs = timestamps[idx] + (timestamps[next] - timestamps[idx]) * frac
      }

      const cursorRatio = durationMs > 0 ? Math.max(0, Math.min(1, (targetMs - startMs) / durationMs)) : 0
      const cursorX = PADDING_LEFT + (WIDTH - PADDING_LEFT - PADDING_RIGHT) * cursorRatio
      const currentLevelY = yForValue(sampleAtTime(points, timestamps, targetMs, 'level'), levelMin, levelMax)
      const currentSpeedY = yForValue(sampleAtTime(points, timestamps, targetMs, 'speed'), 0, speedMax)

      const levelPath = buildPath(points, timestamps, startMs, durationMs, 'level', levelMin, levelMax)
      const speedPath = buildPath(points, timestamps, startMs, durationMs, 'speed', 0, speedMax)
      const levelAreaPath = buildAreaPath(points, timestamps, startMs, durationMs, levelMin, levelMax)

      const startLabel = formatFlowTime(points[0]?.validTime, { timeZone: props.timeZone, compact: true })
      const endLabel = formatFlowTime(points[points.length - 1]?.validTime, { timeZone: props.timeZone, compact: true })

      return h('svg', {
        class: 'df-mini-chart',
        viewBox: `0 0 ${WIDTH} ${HEIGHT}`,
        role: 'img',
        'aria-label': '水位与流速过程线'
      }, [
        h('defs', [
          h('linearGradient', { id: gradientId, x1: '0', y1: '0', x2: '0', y2: '1' }, [
            h('stop', { class: 'df-chart-level-fill-start', offset: '0' }),
            h('stop', { class: 'df-chart-level-fill-end', offset: '1' })
          ])
        ]),
        h('rect', { x: 0.5, y: 0.5, width: WIDTH - 1, height: HEIGHT - 1, rx: 3, class: 'df-chart-frame' }),
        ...[1, 2, 3, 4].map(grid => {
          const y = PADDING_TOP + ((HEIGHT - PADDING_TOP - PADDING_BOTTOM) * grid) / 4
          return h('line', { key: `h-${grid}`, x1: PADDING_LEFT, x2: WIDTH - PADDING_RIGHT, y1: y, y2: y, class: 'df-chart-grid' })
        }),
        ...[1, 2, 3, 4, 5, 6].map(grid => {
          const x = PADDING_LEFT + ((WIDTH - PADDING_LEFT - PADDING_RIGHT) * grid) / 6
          return h('line', { key: `v-${grid}`, x1: x, x2: x, y1: PADDING_TOP, y2: HEIGHT - PADDING_BOTTOM, class: 'df-chart-grid df-chart-grid--vertical' })
        }),
        levelAreaPath ? h('path', { d: levelAreaPath, fill: `url(#${gradientId})` }) : null,
        levelPath ? h('path', { d: levelPath, class: 'df-level-line' }) : null,
        speedPath ? h('path', { d: speedPath, class: 'df-speed-line' }) : null,
        h('line', { x1: cursorX, x2: cursorX, y1: PADDING_TOP, y2: HEIGHT - PADDING_BOTTOM, class: 'df-chart-cursor' }),
        Number.isFinite(currentLevelY) ? h('circle', { cx: cursorX, cy: currentLevelY, r: 3.2, class: 'df-cursor-point df-cursor-point--level' }) : null,
        Number.isFinite(currentSpeedY) ? h('circle', { cx: cursorX, cy: currentSpeedY, r: 3, class: 'df-cursor-point df-cursor-point--speed' }) : null,
        h('text', { x: PADDING_LEFT - 5, y: PADDING_TOP + 8, class: 'df-chart-label df-chart-label--left' }, levelMax.toFixed(1)),
        h('text', { x: PADDING_LEFT - 5, y: HEIGHT - PADDING_BOTTOM, class: 'df-chart-label df-chart-label--left' }, levelMin.toFixed(1)),
        h('text', { x: WIDTH - PADDING_RIGHT + 5, y: PADDING_TOP + 8, class: 'df-chart-label' }, speedMax.toFixed(1)),
        h('text', { x: WIDTH - PADDING_RIGHT + 5, y: HEIGHT - PADDING_BOTTOM, class: 'df-chart-label' }, '0'),
        h('text', { x: PADDING_LEFT, y: HEIGHT - 5, class: 'df-chart-label' }, startLabel),
        h('text', { x: WIDTH - PADDING_RIGHT, y: HEIGHT - 5, 'text-anchor': 'end', class: 'df-chart-label' }, endLabel),
        h('text', { x: PADDING_LEFT + 4, y: PADDING_TOP - 5, class: 'df-series-label df-series-label--level' }, '水位（米）'),
        h('text', { x: WIDTH - PADDING_RIGHT - 4, y: PADDING_TOP - 5, 'text-anchor': 'end', class: 'df-series-label df-series-label--speed' }, '流速（米/秒）')
      ])
    }
  }
})
