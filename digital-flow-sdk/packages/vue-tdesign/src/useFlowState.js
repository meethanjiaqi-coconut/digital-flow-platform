import { onUnmounted, shallowRef, watch } from 'vue'

export function useFlowState(getFlow, emit) {
  const state = shallowRef(getFlow()?.getState() ?? null)
  const actionError = shallowRef('')
  let offState = null
  let offTime = null

  const cleanup = () => {
    offState?.(); offState = null
    offTime?.(); offTime = null
  }

  watch(getFlow, flow => {
    cleanup()
    if (!flow) {
      state.value = null
      return
    }
    state.value = flow.getState()
    offState = flow.on('statechange', next => {
      state.value = next
    })
    offTime = flow.on('timechange', () => {
      state.value = flow.getState()
    })
  }, { immediate: true })

  onUnmounted(cleanup)

  async function runAction(fn) {
    actionError.value = ''
    try {
      return await fn()
    } catch (error) {
      if (error?.name !== 'AbortError') {
        actionError.value = error?.message || String(error)
        emit?.('error', error)
      }
      return undefined
    }
  }

  return { state, actionError, runAction }
}
