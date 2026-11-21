import { computed, defineComponent, h, ref, watch } from 'vue'
import { Button, Progress, RadioButton, RadioGroup, Select, Slider, Switch } from 'tdesign-vue-next'
import { DEFAULT_OPTIONS, WATER_QUALITY_OPTIONS } from '@digital-flow/sdk'
import {
  formatCellCount,
  formatDisplayError,
  formatFlowTime,
  formatIntervalLabel,
  formatProgressPhase,
  formatTidalFrontStatus,
  formatTidalMixStatus,
  frameTargetTime
} from './format.js'
import { iconChevronRight, iconLocation } from './icons.js'
import { FlowLegend } from './FlowLegend.js'
import { FlowScenarioSelector } from './FlowScenarioSelector.js'
import { useFlowState } from './useFlowState.js'

const DENSITY_OPTIONS = [
  { label: '约 1.6 万', value: 16384 },
  { label: '约 6.5 万', value: 65536 },
  { label: '约 26 万', value: 262144 }
]

const COLOR_MODE_OPTIONS = [
  { label: '河口水面', value: 'river' },
  { label: '流速着色', value: 'speed' },
  { label: '水位着色', value: 'level' }
]

const DENSITY_POPUP = { attach: 'body', overlayClassName: 'df-density-dropdown', placement: 'top-right', zIndex: 9200 }
const QUALITY_POPUP = { attach: 'body', overlayClassName: 'df-water-quality-dropdown', placement: 'bottom-right', zIndex: 9200 }

export const FlowControls = defineComponent({
  name: 'FlowControls',
  props: {
    flow: { type: Object, required: true },
    scenarios: { type: Array, default: undefined },
    scenarioLoading: { type: Boolean, default: undefined },
    title: { type: String, default: '数字流场' },
    showPlayback: { type: Boolean, default: true },
    showScenarioSelector: { type: Boolean, default: true },
    showLocate: { type: Boolean, default: false },
    collapsible: { type: Boolean, default: false },
    width: { type: [String, Number], default: undefined }
  },
  emits: ['error', 'locate', 'close', 'scenario-change'],
  setup(props, { emit }) {
    const { state, actionError, runAction } = useFlowState(() => props.flow, emit)
    const draftFrame = ref(null)
    let dragTicket = 0

    watch(() => [props.flow, state.value?.scenarioId], () => {
      dragTicket++
      draftFrame.value = null
    })

    const panelStyle = computed(() => {
      if (props.width === undefined) return undefined
      const width = typeof props.width === 'number' ? `${props.width}px` : props.width
      return { '--df-panel-width': width }
    })

    const patch = payload => runAction(() => props.flow.setOptions(payload))

    const switchRow = (label, value, disabled, onChange, hint) =>
      h('div', { class: ['df-control-row', { 'is-disabled': disabled }], title: hint }, [
        h('span', label),
        h(Switch, {
          value,
          disabled,
          size: 'small',
          role: 'switch',
          'aria-label': label,
          'aria-checked': value,
          tabindex: 0,
          onChange,
          onKeydown: event => {
            if (event.key === ' ' || event.key === 'Enter') {
              event.preventDefault()
              if (!disabled) onChange(!value)
            }
          }
        })
      ])

    return () => {
      const s = state.value
      if (!s) return null

      const ready = s.status === 'ready'
      const o = s.options
      const w = o.water
      const p = o.particles
      const waterOn = w.visible
      const particlesOn = p.visible
      const isRiverNaturalOff = w.colorMode === 'river' && w.palette === 'natural' && w.qualityPreset === 'off'
      const tidalCap = s.capabilities?.tidal || { available: false }
      const hasTidalConfig = s.tidal?.status !== 'disabled' || Boolean(tidalCap.reason)
      const tidalFrontActive = s.tidal?.status === 'tracked'
      const particlesSupported = s.capabilities?.renderer?.particles?.available !== false
      const particlesReason = s.capabilities?.renderer?.particles?.reason
      const recommendedLow = s.capabilities?.renderer?.recommendedQuality === 'low'

      const progressPct = s.progress?.total > 0
        ? Math.min(100, Math.round((s.progress.loaded / s.progress.total) * 100))
        : 0

      const tz = s.timeZone
      const startCompact = formatFlowTime(s.startTime, { timeZone: tz, compact: true })
      const endCompact = formatFlowTime(s.endTime, { timeZone: tz, compact: true })
      const timeRange = s.startTime && s.endTime ? `${startCompact} 至 ${endCompact}` : '由场次清单提供'
      const maxFrame = Math.max(0, (s.frameCount || 1) - 1)
      const currentFrame = Math.max(0, Math.min(maxFrame, Math.round(s.displayedFrame ?? 0)))
      const isDragging = props.showPlayback && draftFrame.value !== null
      const sliderFrame = isDragging ? Math.max(0, Math.min(maxFrame, Math.round(draftFrame.value))) : currentFrame
      const currentTimeText = formatFlowTime(isDragging ? frameTargetTime(s, sliderFrame) : s.displayedTime, { timeZone: tz, seconds: true })
      const intervalLabel = formatIntervalLabel(s.frameIntervalSeconds, s.frameCount)

      const bodyChildren = []

      if (s.status === 'loading' && !s.switching) {
        bodyChildren.push(h('div', { class: 'df-panel-state' }, [
          h('strong', formatProgressPhase(s.progress?.phase)),
          h('span', '正在读取流场场次、计算网格和预报时次'),
          h(Progress, { class: 'df-panel-state__progress', percentage: progressPct, label: false }),
          h('span', `${progressPct}%`)
        ]))
      } else if (s.status === 'error') {
        bodyChildren.push(h('div', { class: 'df-panel-state df-panel-state--error' }, [
          h('strong', '流场数据加载失败'),
          h('span', formatDisplayError(s.error)),
          h(Button, {
            theme: 'primary',
            variant: 'outline',
            size: 'small',
            onClick: () => runAction(() => props.flow.loadScenario(
              s.sourceRunId ? { sourceRunId: s.sourceRunId } : s.scenarioId ? { scenarioId: s.scenarioId } : undefined
            ))
          }, () => '重新加载')
        ]))
      } else {
        const canSelectScenario = props.showScenarioSelector && (Boolean(s.capabilities?.scenarios) || Boolean(props.scenarios?.length))
        bodyChildren.push(
          h('section', { class: 'df-panel-section df-panel-section--scenario' }, [
            h('h3', '预报场次'),
            canSelectScenario
              ? h(FlowScenarioSelector, {
                  flow: props.flow,
                  scenarios: props.scenarios,
                  loading: props.scenarioLoading,
                  onChange: id => emit('scenario-change', id),
                  onError: err => emit('error', err)
                })
              : h('div', { class: 'df-scenario-readonly' }, s.scenarioName || s.sourceRunId || s.scenarioId || '等待加载场次'),
            h('div', { class: 'df-scenario-time' }, [
              h('span', '预报时段'),
              h('strong', timeRange)
            ])
          ]),
          h('div', { class: 'df-summary-grid', 'aria-label': '流场数据概况' }, [
            h('div', [h('span', '计算单元'), h('strong', formatCellCount(s.cellCount))]),
            h('div', [h('span', '输出时次'), h('strong', s.frameCount ? String(s.frameCount) : '--')]),
            h('div', [h('span', '输出间隔'), h('strong', { class: { 'is-buffering': s.buffering } }, s.buffering ? '缓冲中' : intervalLabel)])
          ]),
          h('div', { class: 'df-current-time-row' }, [
            h('span', '当前展示时间'),
            h('strong', currentTimeText)
          ])
        )

        if (props.showPlayback) {
          bodyChildren.push(h('section', { class: 'df-panel-section' }, [
            h('div', { class: 'df-playback-actions' }, [
              h(Button, {
                theme: 'primary',
                size: 'small',
                disabled: !ready,
                onClick: () => runAction(() => (s.playing ? props.flow.pause() : props.flow.play()))
              }, () => (s.playing ? '暂停' : '播放')),
              h(Select, {
                value: s.rate,
                size: 'small',
                disabled: !ready,
                options: [1, 2, 4, 8].map(value => ({ value, label: `${value} 倍` })),
                onChange: value => runAction(() => props.flow.setPlaybackRate(Number(value)))
              })
            ]),
            h(Slider, {
              value: sliderFrame,
              min: 0,
              max: maxFrame || 1,
              step: 1,
              disabled: !ready || maxFrame <= 0,
              label: false,
              'aria-label': '流场时间进度',
              onChange: value => {
                dragTicket++
                draftFrame.value = Number(value)
              },
              onChangeEnd: async value => {
                const target = frameTargetTime(s, Number(value))
                if (!target) { draftFrame.value = null; return }
                const ticket = ++dragTicket
                try {
                  await runAction(() => props.flow.seek(target))
                } finally {
                  if (ticket === dragTicket) draftFrame.value = null
                }
              }
            })
          ]))
        }

        const layerChildren = [
          h('h3', '图层显示'),
          switchRow('动态水位面', waterOn, false, v => patch({ water: { visible: Boolean(v) } })),
          switchRow('水面流向箭头', w.arrows, !waterOn, v => patch({ water: { arrows: Boolean(v) } }))
        ]
        if (w.arrows) {
          layerChildren.push(h('div', { class: ['df-slider-field df-slider-field--arrow', { 'is-disabled': !waterOn }] }, [
            h('div', { class: 'df-slider-field__label' }, [
              h('span', '箭头大小'),
              h('strong', `${w.arrowScale} 倍`)
            ]),
            h(Slider, {
              value: w.arrowScale,
              min: 1,
              max: 80,
              step: 1,
              disabled: !waterOn,
              label: false,
              'aria-label': '箭头大小',
              onChange: value => patch({ water: { arrowScale: Number(value) } })
            })
          ]))
        }
        if (hasTidalConfig) {
          layerChildren.push(switchRow(
            '潮头位置',
            o.tidal.marker,
            !waterOn || !tidalCap.available,
            v => patch({ tidal: { marker: Boolean(v) } })
          ))
          if ((waterOn && o.tidal.marker) || !tidalCap.available) {
            layerChildren.push(h('div', { class: ['df-tidal-front-note', { 'is-inactive': !tidalFrontActive || !tidalCap.available }] }, [
              h('i', { 'aria-hidden': 'true' }),
              h('span', formatTidalFrontStatus(s))
            ]))
          }
        }
        layerChildren.push(
          switchRow('流向粒子', particlesOn, !particlesSupported, v => patch({ particles: { visible: Boolean(v) } })),
          !particlesSupported && particlesReason
            ? h('p', { class: 'df-note' }, `粒子不可用：${particlesReason}`)
            : null,
          h('div', { class: ['df-control-row df-control-row--density', { 'is-disabled': !particlesOn || !particlesSupported }] }, [
            h('span', '粒子密度'),
            h(Select, {
              value: p.count,
              disabled: !particlesOn || !particlesSupported,
              options: DENSITY_OPTIONS,
              popupProps: DENSITY_POPUP,
              size: 'small',
              onChange: value => patch({ particles: { count: Number(value) } })
            })
          ]),
          h('div', { class: ['df-slider-field', { 'is-disabled': !particlesOn || !particlesSupported }] }, [
            h('div', { class: 'df-slider-field__label' }, [
              h('span', '粒子线宽'),
              h('strong', `${p.lineWidth.toFixed(1)} 像素`)
            ]),
            h(Slider, {
              value: p.lineWidth,
              min: 0.5,
              max: 5,
              step: 0.1,
              disabled: !particlesOn || !particlesSupported,
              label: false,
              'aria-label': '粒子线宽',
              onChange: value => patch({ particles: { lineWidth: Number(value) } })
            })
          ]),
          h('div', { class: ['df-slider-field', { 'is-disabled': !particlesOn || !particlesSupported }] }, [
            h('div', { class: 'df-slider-field__label' }, [
              h('span', '粒子拖尾'),
              h('strong', p.trailSeconds === 0 ? '无拖尾' : `${p.trailSeconds.toFixed(1)} 秒`)
            ]),
            h(RadioGroup, {
              value: p.trailSeconds,
              disabled: !particlesOn || !particlesSupported,
              size: 'small',
              variant: 'default-filled',
              class: 'df-trail-presets',
              'aria-label': '粒子拖尾预设',
              onChange: value => patch({ particles: { trailSeconds: Number(value) } })
            }, () => [
              h(RadioButton, { value: 0.4 }, () => '短'),
              h(RadioButton, { value: DEFAULT_OPTIONS.particles.trailSeconds }, () => '中'),
              h(RadioButton, { value: 3 }, () => '长')
            ]),
            h(Slider, {
              value: p.trailSeconds,
              min: 0,
              max: 3,
              step: 0.1,
              disabled: !particlesOn || !particlesSupported,
              label: false,
              'aria-label': '粒子拖尾时长',
              onChange: value => patch({ particles: { trailSeconds: Number(value) } })
            })
          ]),
          h('div', { class: 'df-particle-reset-row' }, [
            h(Button, {
              theme: 'primary',
              variant: 'text',
              size: 'small',
              disabled: !particlesOn || !particlesSupported,
              onClick: () => patch({ particles: { ...DEFAULT_OPTIONS.particles } })
            }, () => '恢复默认粒子')
          ])
        )

        const waterExprChildren = [
          h('h3', '水面表达'),
          h(RadioGroup, {
            value: w.colorMode,
            class: 'df-mode-group',
            variant: 'default-filled',
            onChange: value => patch({ water: { colorMode: String(value) } })
          }, () => COLOR_MODE_OPTIONS.map(opt => h(RadioButton, { key: opt.value, value: opt.value }, () => opt.label)))
        ]
        if (isRiverNaturalOff) {
          waterExprChildren.push(h('div', {
            class: ['df-slider-field', { 'is-disabled': !waterOn }],
            title: '仅增强画面流动，不改变模型流速数值和预报时间'
          }, [
            h('div', { class: 'df-slider-field__label' }, [
              h('span', '流动强度'),
              h('strong', `${o.flowStrength.toFixed(1)} 倍`)
            ]),
            h(Slider, {
              value: o.flowStrength,
              min: 0.5,
              max: 3,
              step: 0.1,
              disabled: !waterOn,
              label: false,
              'aria-label': '水面流动强度',
              onChange: value => patch({ flowStrength: Number(value) })
            })
          ]))
          if (hasTidalConfig) {
            waterExprChildren.push(h('div', { class: 'df-tidal-mix-control' }, [
              switchRow('潮头清浊分界', o.tidal.turbidity, !waterOn || !tidalCap.available, v => patch({ tidal: { turbidity: Boolean(v) } })),
              o.tidal.turbidity && tidalCap.available
                ? h('div', { class: ['df-tidal-mix-legend', { 'is-inactive': !s.tidal?.active || !waterOn }] }, [
                    h('div', { class: 'df-tidal-mix-legend__bar' }),
                    h('div', { class: 'df-tidal-mix-legend__labels' }, [
                      h('span', '潮前较清'),
                      h('span', '混合带'),
                      h('span', '潮后较浑')
                    ]),
                    h('p', !waterOn ? '开启水面后显示' : formatTidalMixStatus(s))
                  ])
                : null
            ]))
          }
        }
        if (w.colorMode !== 'river') {
          waterExprChildren.push(h(FlowLegend, { flow: props.flow }))
        }

        const waveCm = Math.round(w.waveAmplitude * 100)
        const detailsChildren = [
          h('summary', '显示参数'),
          h('div', { class: 'df-slider-field' }, [
            h('div', { class: 'df-slider-field__label' }, [
              h('span', '水位夸张倍数'),
              h('strong', `${o.exaggeration} 倍`)
            ]),
            h(Slider, {
              value: o.exaggeration,
              min: 1,
              max: 200,
              step: 1,
              label: false,
              'aria-label': '水位夸张倍数',
              onChange: value => patch({ exaggeration: Number(value) })
            })
          ])
        ]
        if (isRiverNaturalOff) {
          detailsChildren.push(
            switchRow('场景倒影', w.reflection, !waterOn, v => patch({ water: { reflection: Boolean(v) } }), '反射当前视野中的地形和三维物体'),
            h('div', {
              class: ['df-slider-field', { 'is-disabled': !waterOn }],
              title: '表现水面微小起伏，不代表模型波高预报'
            }, [
              h('div', { class: 'df-slider-field__label' }, [
                h('span', '微浪振幅（示意）'),
                h('strong', `${waveCm} 厘米`)
              ]),
              h(Slider, {
                value: waveCm,
                min: 0,
                max: 30,
                step: 1,
                disabled: !waterOn,
                label: false,
                'aria-label': '微浪振幅',
                onChange: value => patch({ water: { waveAmplitude: Number(value) / 100 } })
              })
            ])
          )
        }
        if (w.colorMode === 'river') {
          detailsChildren.push(h('div', { class: 'df-control-row df-control-row--water-quality' }, [
            h('span', '水质效果（预设）'),
            h(Select, {
              value: w.qualityPreset,
              options: WATER_QUALITY_OPTIONS,
              popupProps: QUALITY_POPUP,
              size: 'small',
              onChange: value => patch({ water: { qualityPreset: String(value) } })
            })
          ]))
          if (w.qualityPreset === 'off') {
            detailsChildren.push(h('div', { class: 'df-control-row df-control-row--palette' }, [
              h('span', '水面配色'),
              h(RadioGroup, {
                value: w.palette,
                size: 'small',
                variant: 'default-filled',
                onChange: value => patch({ water: { palette: String(value) } })
              }, () => [
                h(RadioButton, { value: 'natural' }, () => '自然水色'),
                h(RadioButton, { value: 'tech' }, () => '科技水色')
              ])
            ]))
          }
        }
        detailsChildren.push(h('div', { class: 'df-control-row df-control-row--palette' }, [
          h('span', recommendedLow ? '渲染质量（建议流畅）' : '渲染质量'),
          h(RadioGroup, {
            value: o.quality,
            size: 'small',
            variant: 'default-filled',
            onChange: value => patch({ quality: String(value) })
          }, () => [
            h(RadioButton, { value: 'standard' }, () => '标准'),
            h(RadioButton, { value: 'low' }, () => '流畅')
          ])
        ]))

        bodyChildren.push(
          h('section', { class: 'df-panel-section' }, layerChildren),
          h('section', { class: 'df-panel-section' }, waterExprChildren),
          h('details', { class: 'df-panel-section df-panel-section--last' }, detailsChildren)
        )
      }

      const errorText = actionError.value || (s.status !== 'error' ? s.error?.message : '')
      if (errorText) {
        bodyChildren.push(h('p', { class: 'df-error', role: 'alert' }, errorText))
      }

      const actions = []
      if (props.showLocate) {
        actions.push(h(Button, {
          title: '定位流场',
          'aria-label': '定位流场',
          theme: 'default',
          variant: 'text',
          shape: 'square',
          size: 'small',
          onClick: () => emit('locate')
        }, () => iconLocation()))
      }
      if (props.collapsible) {
        actions.push(h(Button, {
          title: '收起控制面板',
          'aria-label': '收起控制面板',
          theme: 'default',
          variant: 'text',
          shape: 'square',
          size: 'small',
          onClick: () => emit('close')
        }, () => iconChevronRight()))
      }

      return h('aside', {
        class: 'df-controls',
        style: panelStyle.value,
        'aria-label': '数字流场控制面板'
      }, [
        h('header', { class: 'df-controls__header' }, [
          h('h2', props.title),
          actions.length ? h('div', { class: 'df-controls__actions' }, actions) : null
        ]),
        h('div', { class: 'df-controls__body' }, bodyChildren)
      ])
    }
  }
})
