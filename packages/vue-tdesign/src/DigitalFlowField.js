import { computed, defineComponent, h, markRaw, onUnmounted, reactive, ref, shallowRef, watch } from 'vue'
import { Button } from 'tdesign-vue-next'
import { createFlowField } from '@digital-flow/sdk'
import { FlowControls } from './FlowControls.js'
import { FlowTimeline } from './FlowTimeline.js'
import { FlowQueryPopup } from './FlowQueryPopup.js'

const EVENT_NAMES = ['ready', 'error', 'warning', 'statechange', 'scenariochange', 'timechange', 'destroy']

export const DigitalFlowField = defineComponent({
  name: 'DigitalFlowField',
  props: {
    flow: { type: Object, default: null },
    provider: { type: Object, default: null },
    renderer: { type: Object, default: null },
    extensions: { type: Array, default: () => [] },
    playback: { type: Object, default: undefined },
    options: { type: Object, default: undefined },
    timeZone: { type: String, default: undefined },
    tidalHistoryBudgetMB: { type: Number, default: undefined },
    worker: { type: Boolean, default: undefined },
    workerUrl: { type: String, default: undefined },
    workerFactory: { type: Function, default: undefined },
    initialSelection: { type: Object, default: undefined },
    autoLoad: { type: Boolean, default: true },
    viewer: { type: Object, default: null },
    enablePick: { type: Boolean, default: true },
    supermap3d: { type: Object, default: undefined },
    scenarios: { type: Array, default: undefined },
    title: { type: String, default: '数字流场' },
    collapsible: { type: Boolean, default: true },
    defaultOpen: { type: Boolean, default: true },
    showTimeline: { type: Boolean, default: true },
    showQueryPopup: { type: Boolean, default: true },
    showLocate: { type: Boolean, default: false },
    panelWidth: { type: [String, Number], default: undefined },
    placement: { type: String, default: 'right' },
    zIndex: { type: Number, default: undefined },
    themeColor: { type: String, default: undefined }
  },
  emits: [...EVENT_NAMES, 'locate', 'pick', 'pick-empty', 'scenario-change'],
  setup(props, { emit, expose }) {
    const ownedFlow = shallowRef(null)
    const activeFlow = computed(() => props.flow || ownedFlow.value)
    const panelOpen = ref(props.defaultOpen)
    const flowState = shallowRef(null)
    const query = reactive({ visible: false, sample: null, series: null, loading: false, lon: NaN, lat: NaN })

    let unmounted = false
    let unsubs = []
    let seriesAbort = null
    let sampleAbort = null
    let clickHandler = null
    let markerCollection = null
    let markerPoint = null

    function clearPickVisual() {
      const viewer = props.viewer
      if (viewer && markerCollection && !viewer.isDestroyed?.()) {
        try { viewer.scene?.primitives?.remove(markerCollection) } catch { }
      }
      markerCollection = null
      markerPoint = null
    }

    function placeMarker(lon, lat) {
      const S = props.supermap3d || globalThis.SuperMap3D
      const viewer = props.viewer
      if (!viewer || !S?.Cartesian3 || !S?.PointPrimitiveCollection || viewer.isDestroyed?.()) return
      if (!markerCollection) {
        markerCollection = new S.PointPrimitiveCollection()
        viewer.scene.primitives.add(markerCollection)
        markerPoint = markerCollection.add({
          position: S.Cartesian3.fromDegrees(lon, lat, 30),
          pixelSize: 10,
          color: S.Color.fromCssColorString('#7df3ff'),
          outlineColor: S.Color.WHITE,
          outlineWidth: 2,
          disableDepthTestDistance: Number.POSITIVE_INFINITY
        })
      } else if (markerPoint) {
        markerPoint.position = S.Cartesian3.fromDegrees(lon, lat, 30)
      }
    }

    function closeQuery() {
      seriesAbort?.abort(); seriesAbort = null
      sampleAbort?.abort(); sampleAbort = null
      query.visible = false
      query.loading = false
      query.sample = null
      query.series = null
      clearPickVisual()
    }

    async function openQuerySample(sample) {
      const flow = activeFlow.value
      if (!flow || !sample) {
        emit('pick-empty')
        return null
      }
      emit('pick', sample)
      if (!props.showQueryPopup) return sample

      seriesAbort?.abort()
      const controller = new AbortController()
      seriesAbort = controller
      query.lon = sample.lon
      query.lat = sample.lat
      query.sample = sample
      query.series = null
      query.loading = true
      query.visible = true
      placeMarker(sample.lon, sample.lat)

      try {
        const series = await flow.querySeries({ cell: sample.cell }, { signal: controller.signal })
        if (seriesAbort === controller && !controller.signal.aborted) {
          query.series = series
        }
      } catch (error) {
        if (error?.name !== 'AbortError') emit('error', error)
      } finally {
        if (seriesAbort === controller) query.loading = false
      }
      return sample
    }

    async function openQueryAt(target) {
      const flow = activeFlow.value
      if (!flow) return null
      const sample = 'x' in target && 'y' in target
        ? await flow.pick({ x: target.x, y: target.y })
        : await flow.queryAt(target)
      return openQuerySample(sample)
    }

    async function refreshOpenSample() {
      const flow = activeFlow.value
      if (!flow || !query.visible || !Number.isFinite(query.lon) || !Number.isFinite(query.lat)) return
      if (sampleAbort) return
      const controller = new AbortController()
      sampleAbort = controller
      try {
        const sample = await flow.queryAt({ lon: query.lon, lat: query.lat }, { signal: controller.signal })
        if (!controller.signal.aborted && sample && query.visible) {
          query.sample = sample
        }
      } catch (error) {
        if (error?.name !== 'AbortError') emit('error', error)
      } finally {
        if (sampleAbort === controller) sampleAbort = null
      }
    }

    function teardownClickHandler() {
      clickHandler?.destroy?.()
      clickHandler = null
      clearPickVisual()
    }

    watch(() => [props.viewer, props.enablePick, activeFlow.value], ([viewer, enabled, flow]) => {
      teardownClickHandler()
      const S = props.supermap3d || globalThis.SuperMap3D
      if (!viewer || !enabled || !flow || !S?.ScreenSpaceEventHandler || !viewer.scene?.canvas) return
      const handler = new S.ScreenSpaceEventHandler(viewer.scene.canvas)
      handler.setInputAction(async movement => {
        if (viewer.selectedEntity && viewer.selectedEntity.id === undefined) viewer.selectedEntity = undefined
        if (activeFlow.value?.getState()?.status !== 'ready') return
        try {
          const sample = await activeFlow.value.pick(movement.position)
          await openQuerySample(sample)
        } catch (error) {
          if (error?.name !== 'AbortError') emit('error', error)
        }
      }, S.ScreenSpaceEventType.LEFT_CLICK)
      clickHandler = handler
    }, { immediate: true })

    function bindFlowEvents(flow) {
      unsubs.forEach(fn => fn())
      unsubs = []
      if (!flow) {
        flowState.value = null
        return
      }
      flowState.value = flow.getState()
      for (const name of EVENT_NAMES) {
        unsubs.push(flow.on(name, payload => {
          if (name === 'statechange') flowState.value = payload
          if (name === 'timechange') {
            flowState.value = flow.getState()
            refreshOpenSample()
          }
          if (name === 'scenariochange') closeQuery()
          if (name === 'destroy') {
            closeQuery()
            teardownClickHandler()
          }
          emit(name, payload)
        }))
      }
    }

    watch(activeFlow, bindFlowEvents, { immediate: true })

    async function disposeOwned() {
      const current = ownedFlow.value
      ownedFlow.value = null
      if (current) await current.destroy()
    }

    watch(() => [props.flow, props.provider, props.renderer], async ([externalFlow, provider, renderer]) => {
      await disposeOwned()
      if (unmounted || externalFlow || !provider || !renderer) return
      const instance = markRaw(createFlowField({
        provider,
        renderer,
        extensions: props.extensions,
        playback: props.playback,
        options: props.options,
        timeZone: props.timeZone,
        tidalHistoryBudgetMB: props.tidalHistoryBudgetMB,
        worker: props.worker,
        workerUrl: props.workerUrl,
        workerFactory: props.workerFactory
      }))
      ownedFlow.value = instance
      if (props.autoLoad) {
        try {
          await instance.loadScenario(props.initialSelection)
        } catch (error) {
          if (error?.name !== 'AbortError') emit('error', error)
        }
      }
    }, { immediate: true })

    onUnmounted(async () => {
      unmounted = true
      closeQuery()
      teardownClickHandler()
      unsubs.forEach(fn => fn())
      unsubs = []
      await disposeOwned()
    })

    expose({ getFlow: () => activeFlow.value, openQueryAt, closeQuery })

    const workspaceStyle = computed(() => {
      const style = {}
      if (props.panelWidth !== undefined) {
        style['--df-panel-width'] = typeof props.panelWidth === 'number' ? `${props.panelWidth}px` : props.panelWidth
      }
      if (props.zIndex !== undefined) style['--df-z-index'] = String(props.zIndex)
      if (props.themeColor) style['--df-brand-color'] = props.themeColor
      return style
    })

    return () => {
      const flow = activeFlow.value
      if (!flow) return null
      const isLeft = props.placement === 'left'
      const isReady = flowState.value?.status === 'ready'

      return h('div', {
        class: ['df-workspace', isLeft ? 'df-workspace--left' : 'df-workspace--right'],
        style: workspaceStyle.value
      }, [
        panelOpen.value
          ? h(FlowControls, {
              flow,
              scenarios: props.scenarios,
              title: props.title,
              showPlayback: !props.showTimeline,
              showLocate: props.showLocate,
              collapsible: props.collapsible,
              width: props.panelWidth,
              onLocate: () => emit('locate'),
              onClose: () => { panelOpen.value = false },
              onScenarioChange: id => emit('scenario-change', id),
              onError: error => emit('error', error)
            })
          : h(Button, {
              class: 'df-reopen',
              theme: 'primary',
              onClick: () => { panelOpen.value = true }
            }, () => '展开流场面板'),
        props.showTimeline && isReady
          ? h(FlowTimeline, {
              flow,
              wide: !panelOpen.value,
              onError: error => emit('error', error)
            })
          : null,
        props.showQueryPopup && isReady && query.visible
          ? h(FlowQueryPopup, {
              flow,
              sample: query.sample,
              series: query.series,
              loading: query.loading,
              onClose: closeQuery
            })
          : null
      ])
    }
  }
})
