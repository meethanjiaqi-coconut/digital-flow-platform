import { defineComponent, h } from 'vue'
import { COLOR_RAMPS } from '@digital-flow/sdk'
import { useFlowState } from './useFlowState.js'

const toGradient = stops => `linear-gradient(to right, ${stops.join(', ')})`

export const FlowLegend = defineComponent({
  name: 'FlowLegend',
  props: {
    flow: { type: Object, default: null },
    mode: { type: [String, Number], default: undefined },
    min: { type: Number, default: undefined },
    max: { type: Number, default: undefined },
    speedMax: { type: Number, default: undefined }
  },
  setup(props) {
    const { state } = useFlowState(() => props.flow)
    return () => {
      const s = state.value
      const rawMode = props.mode !== undefined
        ? props.mode
        : s?.options?.water?.colorMode
      const resolvedMode = (rawMode === 0 || rawMode === 'speed') ? 'speed' : 'level'
      const stats = s?.stats || {}
      const min = props.min ?? stats.levelMin ?? -2
      const max = props.max ?? stats.levelMax ?? 3
      const speedMax = (props.speedMax ?? stats.speedMax) || 2.5
      const gradient = toGradient(resolvedMode === 'speed' ? COLOR_RAMPS.speed : COLOR_RAMPS.level)

      return h('div', { class: 'df-legend', role: 'region', 'aria-label': resolvedMode === 'speed' ? '流速强度图例' : '水位高程图例' }, [
        h('div', { class: 'df-legend__head' }, [
          h('span', resolvedMode === 'speed' ? '流速强度' : '水位高程'),
          h('span', resolvedMode === 'speed' ? '米/秒' : '米')
        ]),
        h('div', { class: 'df-legend__bar', style: { background: gradient } }, [
          h('i'), h('i'), h('i'), h('i'), h('i')
        ]),
        resolvedMode === 'speed'
          ? h('div', { class: 'df-legend__ticks' }, [
              h('span', '0'),
              h('span', (speedMax * 0.25).toFixed(1)),
              h('span', (speedMax * 0.5).toFixed(1)),
              h('span', (speedMax * 0.75).toFixed(1)),
              h('span', speedMax.toFixed(1))
            ])
          : h('div', { class: 'df-legend__ticks df-legend__ticks--level' }, [
              h('span', min.toFixed(1)),
              h('span', ((min + max) / 2).toFixed(1)),
              h('span', max.toFixed(1))
            ])
      ])
    }
  }
})
