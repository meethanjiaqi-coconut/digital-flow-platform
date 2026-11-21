import { computed, defineComponent, h, onUnmounted, ref, watch } from 'vue'
import { Select } from 'tdesign-vue-next'
import { useFlowState } from './useFlowState.js'

export const FlowScenarioSelector = defineComponent({
  name: 'FlowScenarioSelector',
  props: {
    flow: { type: Object, required: true },
    scenarios: { type: Array, default: undefined },
    loading: { type: Boolean, default: undefined },
    placeholder: { type: String, default: '请选择预报场次' },
    popupProps: {
      type: Object,
      default: () => ({ attach: 'body', overlayClassName: 'df-scenario-dropdown', placement: 'bottom-left', zIndex: 9200 })
    }
  },
  emits: ['change', 'loaded', 'error'],
  setup(props, { emit }) {
    const { state, runAction } = useFlowState(() => props.flow, emit)
    const fetchedScenarios = ref([])
    const internalLoading = ref(false)
    let listAbort = null

    const abortList = () => { listAbort?.abort(); listAbort = null }

    async function refresh(flow) {
      abortList()
      if (!flow || props.scenarios !== undefined) return
      let supports = false
      try { supports = Boolean(flow.getCapabilities()?.scenarios) } catch { return }
      if (!supports) { fetchedScenarios.value = []; return }
      const controller = new AbortController()
      listAbort = controller
      internalLoading.value = true
      try {
        const list = await flow.listScenarios({ signal: controller.signal })
        if (!controller.signal.aborted && Array.isArray(list)) {
          fetchedScenarios.value = list
          emit('loaded', list)
        }
      } catch (error) {
        if (error?.name !== 'AbortError') emit('error', error)
      } finally {
        if (listAbort === controller) {
          listAbort = null
          internalLoading.value = false
        }
      }
    }

    watch(() => [props.flow, props.scenarios], ([flow]) => refresh(flow), { immediate: true })
    onUnmounted(abortList)

    const items = computed(() => props.scenarios ?? fetchedScenarios.value)
    const options = computed(() => {
      const list = items.value.map(item => ({
        value: item.id,
        label: item.name || item.sourceRunId || item.id
      }))
      const currentId = state.value?.scenarioId
      if (currentId && !list.some(item => item.value === currentId)) {
        list.unshift({
          value: currentId,
          label: state.value?.scenarioName || state.value?.sourceRunId || currentId
        })
      }
      return list
    })

    const isLoading = computed(() => props.loading ?? internalLoading.value)

    async function handleChange(value) {
      if (!value || value === state.value?.scenarioId) return
      emit('change', value)
      const matched = items.value.find(item => item.id === value)
      const selection = matched?.id
        ? { scenarioId: matched.id }
        : matched?.sourceRunId
          ? { sourceRunId: matched.sourceRunId }
          : { scenarioId: String(value) }
      await runAction(() => props.flow.loadScenario(selection))
    }

    return () => {
      const s = state.value
      return h(Select, {
        class: 'df-scenario-select',
        value: s?.scenarioId || '',
        loading: isLoading.value,
        disabled: Boolean(s?.switching) || options.value.length === 0,
        options: options.value,
        popupProps: props.popupProps,
        filterable: true,
        placeholder: props.placeholder,
        size: 'small',
        onChange: handleChange
      })
    }
  }
})
