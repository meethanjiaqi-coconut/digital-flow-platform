import { defineComponent, h, ref, watch } from 'vue'
import { Button, Slider } from 'tdesign-vue-next'
import { formatFlowTime, formatIntervalLabel, frameTargetTime } from './format.js'
import { iconChevronLeft, iconChevronRight, iconPause, iconPlay } from './icons.js'
import { useFlowState } from './useFlowState.js'

export const FlowTimeline = defineComponent({
  name: 'FlowTimeline',
  props: {
    flow: { type: Object, required: true },
    rates: { type: Array, default: () => [1, 2, 4, 8] },
    wide: { type: Boolean, default: false }
  },
  emits: ['error'],
  setup(props, { emit }) {
    const { state, runAction } = useFlowState(() => props.flow, emit)
    const draftFrame = ref(null)
    let dragTicket = 0

    watch(() => [props.flow, state.value?.scenarioId], () => {
      dragTicket++
      draftFrame.value = null
    })

    async function seekToFrame(targetFrame) {
      const s = state.value
      const target = frameTargetTime(s, targetFrame)
      if (!target) {
        draftFrame.value = null
        return
      }
      const ticket = ++dragTicket
      try {
        await runAction(async () => {
          if (s.playing) props.flow.pause()
          await props.flow.seek(target)
        })
      } finally {
        if (ticket === dragTicket) draftFrame.value = null
      }
    }

    function step(direction) {
      const s = state.value
      if (!s || s.status !== 'ready') return
      const current = s.displayedFrame
      const target = direction > 0 ? Math.floor(current + 1e-6) + 1 : Math.ceil(current - 1e-6) - 1
      seekToFrame(target)
    }

    return () => {
      const s = state.value
      if (!s) return null
      const ready = s.status === 'ready'
      const maxFrame = Math.max(0, (s.frameCount || 1) - 1)
      const currentFrame = Math.max(0, Math.min(maxFrame, Math.round(s.displayedFrame ?? 0)))
      const isDragging = draftFrame.value !== null
      const sliderFrame = isDragging ? Math.max(0, Math.min(maxFrame, Math.round(draftFrame.value))) : currentFrame
      const previewTime = isDragging ? frameTargetTime(s, sliderFrame) : s.displayedTime
      const intervalLabel = formatIntervalLabel(s.frameIntervalSeconds, s.frameCount)
      const tz = s.timeZone
      const startLabel = formatFlowTime(s.startTime, { timeZone: tz, compact: true })
      const endLabel = formatFlowTime(s.endTime, { timeZone: tz, compact: true })
      const timeLabel = formatFlowTime(previewTime, { timeZone: tz, seconds: true })
      const displayCountIndex = isDragging ? sliderFrame : Math.floor(s.displayedFrame ?? 0)

      return h('nav', {
        class: ['df-timeline', { 'is-wide': props.wide }],
        'aria-label': '数字流场时间轴'
      }, [
        h('div', { class: 'df-timeline__toolbar' }, [
          h('span', { class: 'df-interval-badge', title: '使用模型原始输出，时次之间平滑过渡' }, `${intervalLabel} / 时次`),
          h('span', { title: '1倍：约2秒推进一个输出时次' }, '播放速度'),
          h('div', { class: 'df-speed-buttons' }, props.rates.map(rate =>
            h(Button, {
              key: rate,
              class: ['df-speed-button', { 'is-active': s.rate === rate }],
              size: 'small',
              disabled: !ready,
              onClick: () => runAction(() => props.flow.setPlaybackRate(rate))
            }, () => `${rate}倍`)
          )),
          s.buffering
            ? h('span', { class: 'df-buffering-text' }, '数据缓冲中')
            : h('span', { class: 'df-frame-count' }, `${displayCountIndex + 1} / ${s.frameCount || 0} 时次`)
        ]),
        h('div', { class: 'df-timeline__slider' }, [
          h(Button, {
            class: 'df-step-button',
            title: '上一时次',
            'aria-label': '上一时次',
            theme: 'default',
            variant: 'text',
            shape: 'square',
            disabled: !ready || currentFrame <= 0,
            onClick: () => step(-1)
          }, () => iconChevronLeft(20)),
          h(Button, {
            class: 'df-play-button',
            title: s.playing ? '暂停' : '播放',
            'aria-label': s.playing ? '暂停' : '播放',
            theme: 'primary',
            shape: 'circle',
            disabled: !ready,
            onClick: () => runAction(() => (s.playing ? props.flow.pause() : props.flow.play()))
          }, () => (s.playing ? iconPause(18) : iconPlay(18))),
          h(Button, {
            class: 'df-step-button',
            title: '下一时次',
            'aria-label': '下一时次',
            theme: 'default',
            variant: 'text',
            shape: 'square',
            disabled: !ready || currentFrame >= maxFrame,
            onClick: () => step(1)
          }, () => iconChevronRight(20)),
          h('div', { class: 'df-timeline__track' }, [
            h('div', { class: 'df-timeline__labels' }, [
              h('span', startLabel),
              h('strong', timeLabel),
              h('span', endLabel)
            ]),
            h(Slider, {
              class: 'df-timeline__t-slider',
              value: sliderFrame,
              min: 0,
              max: maxFrame || 1,
              step: 1,
              disabled: !ready || maxFrame <= 0,
              label: false,
              'aria-label': '选择流场时次',
              onChange: value => {
                dragTicket++
                draftFrame.value = Number(value)
              },
              onChangeEnd: value => seekToFrame(Number(value))
            })
          ])
        ])
      ])
    }
  }
})
