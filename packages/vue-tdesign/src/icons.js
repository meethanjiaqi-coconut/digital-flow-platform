import { h } from 'vue'

const svg = (paths, size = 16) => h('svg', {
  class: 'df-icon',
  width: size,
  height: size,
  viewBox: '0 0 16 16',
  fill: 'none',
  'aria-hidden': 'true'
}, paths)

export const iconLocation = () => svg([
  h('path', { d: 'M8 1.5a4.5 4.5 0 0 0-4.5 4.5c0 3.2 4.5 8.5 4.5 8.5s4.5-5.3 4.5-8.5A4.5 4.5 0 0 0 8 1.5Z', stroke: 'currentColor', 'stroke-width': '1.4', 'stroke-linejoin': 'round' }),
  h('circle', { cx: 8, cy: 6, r: 1.6, fill: 'currentColor' })
])

export const iconChevronLeft = (size = 18) => svg([
  h('path', { d: 'M10 3.5 5.5 8 10 12.5', stroke: 'currentColor', 'stroke-width': '1.6', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' })
], size)

export const iconChevronRight = (size = 18) => svg([
  h('path', { d: 'M6 3.5 10.5 8 6 12.5', stroke: 'currentColor', 'stroke-width': '1.6', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' })
], size)

export const iconPlay = (size = 16) => svg([
  h('path', { d: 'M5.2 3.2 12.6 8 5.2 12.8V3.2Z', fill: 'currentColor' })
], size)

export const iconPause = (size = 16) => svg([
  h('rect', { x: 4.5, y: 3.3, width: 2.3, height: 9.4, rx: 0.6, fill: 'currentColor' }),
  h('rect', { x: 9.2, y: 3.3, width: 2.3, height: 9.4, rx: 0.6, fill: 'currentColor' })
], size)

export const iconClose = (size = 16) => svg([
  h('path', { d: 'M4 4l8 8M12 4l-8 8', stroke: 'currentColor', 'stroke-width': '1.5', 'stroke-linecap': 'round' })
], size)
