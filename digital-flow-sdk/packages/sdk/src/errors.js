const RECOVERABLE = Object.freeze({
  NETWORK_ERROR: true, TIMEOUT: true, SERVICE_ERROR: true, AUTH_REQUIRED: true,
  WORKER_FAILED: true, CONTEXT_LOST: true, RUNTIME_BUSY: true,
  FORBIDDEN: false, SCENARIO_NOT_FOUND: false, DATA_UNAVAILABLE: false,
  INVALID_MANIFEST: false, INVALID_BINARY: false, UNSUPPORTED_RUNTIME: false,
  UNSUPPORTED_MESH: false, GPU_UNSUPPORTED: false, NOT_SUPPORTED: false,
  NOT_READY: false, INVALID_ARGUMENT: false, DISPOSED: false
})

/** SDK 公开错误：code 为英文常量，message 为中文，recoverable 标记是否可重试。 */
export class FlowError extends Error {
  constructor(code, message, { recoverable, operation, status, frame, scenarioId, cause } = {}) {
    super(message)
    this.name = 'FlowError'
    this.code = code
    this.recoverable = recoverable ?? RECOVERABLE[code] ?? false
    if (operation !== undefined) this.operation = operation
    if (status !== undefined) this.status = status
    if (frame !== undefined) this.frame = frame
    if (scenarioId !== undefined) this.scenarioId = scenarioId
    if (cause !== undefined) this.cause = cause
  }
  toJSON() {
    const out = { code: this.code, message: this.message, recoverable: this.recoverable }
    for (const key of ['operation', 'status', 'frame', 'scenarioId']) {
      if (this[key] !== undefined) out[key] = this[key]
    }
    return out
  }
}

export function isFlowError(error) {
  return error instanceof FlowError
    || Boolean(error && error.name === 'FlowError' && typeof error.code === 'string' && typeof error.recoverable === 'boolean')
}

/**
 * 统一错误出口：AbortError 原样返回（取消不属于错误）；FlowError 补 operation；
 * fetch 层 TypeError 视为 NETWORK_ERROR；其余按 fallbackCode 归类。
 */
export function toFlowError(error, operation, fallbackCode = 'SERVICE_ERROR') {
  if (!error || error.name === 'AbortError') return error
  if (isFlowError(error)) {
    if (error.operation === undefined) error.operation = operation
    return error
  }
  if (error instanceof TypeError) {
    return new FlowError('NETWORK_ERROR', error.message, { operation, cause: error })
  }
  const message = typeof error?.message === 'string' && error.message ? error.message : String(error)
  return new FlowError(fallbackCode, message, { operation, cause: error })
}
