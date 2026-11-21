import { defineComponent, h } from 'vue'
import { Button, Loading } from 'tdesign-vue-next'
import { compassDirection, formatFlowTime } from './format.js'
import { iconClose } from './icons.js'
import { FlowMiniChart } from './FlowMiniChart.js'
import { useFlowState } from './useFlowState.js'

export const FlowQueryPopup = defineComponent({
  name: 'FlowQueryPopup',
  props: {
    flow: { type: Object, default: null },
    sample: { type: Object, default: null },
    series: { type: Object, default: null },
    loading: { type: Boolean, default: false },
    currentTime: { type: [String, Number, Date], default: undefined },
    timeZone: { type: String, default: undefined }
  },
  emits: ['close'],
  setup(props, { emit }) {
    const { state } = useFlowState(() => props.flow)

    return () => {
      const s = state.value
      const sample = props.sample
      const tz = props.timeZone ?? s?.timeZone ?? 'Asia/Shanghai'
      const activeTime = props.currentTime ?? sample?.time ?? s?.displayedTime
      const coordLabel = sample && Number.isFinite(sample.lon) && Number.isFinite(sample.lat)
        ? `东经 ${sample.lon.toFixed(5)}°，北纬 ${sample.lat.toFixed(5)}°`
        : '等待点位坐标'
      const timeLabel = formatFlowTime(activeTime, { timeZone: tz, seconds: true })
      const pointCount = props.series?.points?.length ?? s?.frameCount ?? 0

      let bodyContent
      if (!sample) {
        bodyContent = h('div', { class: 'df-query-state' }, [
          h(Loading, { size: 'small' }),
          h('span', '正在准备当前点位数据')
        ])
      } else if (sample.wet) {
        const hasDir = Number.isFinite(sample.dirDeg)
        bodyContent = h('section', { class: 'df-query-metrics', 'aria-label': '当前点位数值' }, [
          h('div', { class: 'df-metric' }, [
            h('span', '水位'),
            h('div', [
              h('strong', Number.isFinite(sample.level) ? sample.level.toFixed(2) : '--'),
              h('small', '米')
            ])
          ]),
          h('div', { class: 'df-metric df-metric--speed' }, [
            h('span', '流速'),
            h('div', [
              h('strong', Number.isFinite(sample.speed) ? sample.speed.toFixed(2) : '--'),
              h('small', '米/秒')
            ])
          ]),
          h('div', { class: 'df-metric df-metric--direction' }, [
            h('span', '流向'),
            h('div', { class: 'df-direction-value' }, [
              hasDir
                ? h('svg', {
                    viewBox: '-10 -10 20 20',
                    style: { transform: `rotate(${sample.dirDeg}deg)` },
                    'aria-hidden': 'true'
                  }, [h('path', { d: 'M0-8 4 5 0 2l-4 3L0-8Z' })])
                : null,
              h('strong', compassDirection(sample.dirDeg))
            ]),
            h('small', hasDir ? `${sample.dirDeg.toFixed(0)} 度` : '0 流速')
          ])
        ])
      } else {
        bodyContent = h('div', { class: 'df-query-dry' }, [
          h('strong', '当前单元无水'),
          h('span', '本时次没有有效水位和流速数据')
        ])
      }

      let seriesContent
      if (props.loading) {
        seriesContent = h('div', { class: 'df-query-state df-query-state--series' }, [
          h(Loading, { size: 'small' }),
          h('span', '正在读取点位过程线')
        ])
      } else if (props.series?.points?.length) {
        seriesContent = h(FlowMiniChart, {
          series: props.series,
          currentTime: activeTime,
          currentFrame: s?.displayedFrame ?? 0,
          timeZone: tz
        })
      } else {
        seriesContent = h('div', { class: 'df-series-empty' }, '过程线暂不可用，请重新点选该位置')
      }

      return h('aside', { class: 'df-query-popup', 'aria-label': '流场点位信息' }, [
        h('header', { class: 'df-query-popup__header' }, [
          h('h3', '流场点位信息'),
          h(Button, {
            title: '关闭点位信息',
            'aria-label': '关闭点位信息',
            theme: 'default',
            variant: 'text',
            shape: 'square',
            size: 'small',
            onClick: () => emit('close')
          }, () => iconClose())
        ]),
        h('div', { class: 'df-query-popup__body' }, [
          h('dl', { class: 'df-point-summary' }, [
            h('div', [h('dt', '点位坐标'), h('dd', coordLabel)]),
            h('div', [h('dt', '展示时间'), h('dd', timeLabel)]),
            h('div', [h('dt', '计算单元'), h('dd', sample?.cell ?? '--')])
          ]),
          bodyContent,
          h('section', { class: 'df-query-series' }, [
            h('div', { class: 'df-query-series__header' }, [
              h('h4', '预报过程线'),
              h('span', `共 ${pointCount} 个时次`)
            ]),
            seriesContent
          ]),
          h('p', { class: 'df-query-footer' }, '点击流场范围内其他位置可更新点位信息')
        ])
      ])
    }
  }
})
