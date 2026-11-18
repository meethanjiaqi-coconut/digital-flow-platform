export interface RequestContext { signal?: AbortSignal }

export type ErrorCode =
  | 'NETWORK_ERROR' | 'TIMEOUT' | 'SERVICE_ERROR' | 'AUTH_REQUIRED'
  | 'WORKER_FAILED' | 'CONTEXT_LOST' | 'RUNTIME_BUSY'
  | 'FORBIDDEN' | 'SCENARIO_NOT_FOUND' | 'DATA_UNAVAILABLE'
  | 'INVALID_MANIFEST' | 'INVALID_BINARY' | 'UNSUPPORTED_RUNTIME'
  | 'UNSUPPORTED_MESH' | 'GPU_UNSUPPORTED' | 'NOT_SUPPORTED'
  | 'NOT_READY' | 'INVALID_ARGUMENT' | 'DISPOSED'

export interface FlowErrorInfo {
  code: ErrorCode | string
  message: string
  recoverable: boolean
  operation?: string
  status?: number
  frame?: number
  scenarioId?: string
}

export declare class FlowError extends Error {
  readonly code: string
  readonly recoverable: boolean
  readonly operation?: string
  readonly status?: number
  readonly frame?: number
  readonly scenarioId?: string
  constructor(code: ErrorCode | string, message: string, options?: {
    recoverable?: boolean
    operation?: string
    status?: number
    frame?: number
    scenarioId?: string
    cause?: unknown
  })
  toJSON(): FlowErrorInfo
}
export declare function isFlowError(error: unknown): error is FlowError

export interface Manifest {
  formatVersion: number
  scenarioId: string
  sourceRunId?: string
  scenarioName?: string
  nNodes: number
  nCells: number
  nTris: number
  nFrames: number
  bbox: [number, number, number, number]
  scales: { level: number; uv: number }
  drySentinel: number
  mesh: { meshId: string; file?: string }
  frames: Array<{ index: number; validTime: string; file?: string }>
  stats?: Record<string, number>
}

export type ScenarioSelection =
  | { scenarioId: string }
  | { sourceRunId: string }
  | { latest: true }

export interface Scenario {
  id: string
  sourceRunId?: string | null
  name?: string | null
  startTime?: string | null
  endTime?: string | null
  frameCount?: number | null
  meshId?: string
  publishedAt?: unknown
}

export interface SeriesPoint {
  frameIndex: number
  validTime: string | null
  dry: boolean
  level: number | null
  u: number | null
  v: number | null
  speed: number | null
  dirDeg: number | null
}

export interface Series {
  scenarioId: string | null
  cellIndex: number | null
  points: SeriesPoint[]
  source: 'provider' | 'frames'
}

export interface ProviderStats { requests: number; retries: number; failures: number }

export interface RetryPolicy { retries?: number; baseDelayMs?: number; maxDelayMs?: number }
export interface ProviderRequestOptions {
  retry?: false | RetryPolicy
  timeoutMs?: number
}

export interface FlowProvider {
  getStats?(): ProviderStats
  listScenarios?(context?: RequestContext): Promise<Scenario[]>
  loadManifest(selection?: ScenarioSelection | string, context?: RequestContext): Promise<Manifest>
  getMesh(manifest: Manifest, context?: RequestContext): Promise<ArrayBuffer>
  getFrame(manifest: Manifest, index: number, context?: RequestContext): Promise<ArrayBuffer>
  querySeries?(manifest: Manifest, cell: number, context?: RequestContext): Promise<Series>
}

export type WaterQualityPreset = 'off' | 'I' | 'II' | 'III' | 'IV' | 'V' | 'BAD_V'
export type WaterPalette = 'natural' | 'tech'
export type RenderQuality = 'low' | 'standard'

export interface FlowOptions {
  visible: boolean
  flowStrength: number
  exaggeration: number
  quality: RenderQuality
  particles: { visible: boolean; count: 16384 | 65536 | 262144; lineWidth: number; trailSeconds: number }
  water: { visible: boolean; colorMode: 'river' | 'speed' | 'level'; arrows: boolean; arrowScale: number; palette: WaterPalette; qualityPreset: WaterQualityPreset; reflection: boolean; waveAmplitude: number }
  tidal: { marker: boolean; turbidity: boolean }
}
export type FlowOptionsPatch = {
  [K in keyof FlowOptions]?: FlowOptions[K] extends object ? Partial<FlowOptions[K]> : FlowOptions[K]
}

export interface TidalProfile {
  id: string
  polygon: ReadonlyArray<readonly [number, number]>
  visualOnly?: boolean
}
export interface TidalExtension { kind: 'tidal-estuary'; profile: TidalProfile }

export interface FlowProgress { phase: 'manifest' | 'mesh' | 'frames' | 'renderer' | 'history'; loaded: number; total: number }
export interface FlowWarning { code: string; message: string; detail?: unknown }

export interface FlowStats { levelMin: number; levelMax: number; speedMax: number }

export interface FlowCapabilities {
  scenarios: boolean
  series: 'provider' | 'frames'
  worker: 'worker' | 'main-thread' | 'none'
  tidal: { available: boolean; reason?: string }
  maxNodes: number
  renderer: unknown
}

export interface FlowDiagnostics {
  rawFramesCached: number
  nodeFramesCached: number
  pendingRequests: number
  tidalHistoryFrames: number
  tidalHistoryBytes: number
  worker: 'worker' | 'main-thread' | 'none'
  provider: ProviderStats | null
  warnings: FlowWarning[]
}

export interface FlowState {
  version: string
  status: 'idle' | 'loading' | 'ready' | 'error' | 'destroyed'
  switching: boolean
  playing: boolean
  buffering: boolean
  suspended: boolean
  rate: number
  secondsPerFrame: number
  loop: boolean
  timeZone: string
  error: FlowErrorInfo | null
  progress: FlowProgress | null
  scenarioId: string | null
  sourceRunId: string | null
  scenarioName: string | null
  meshId: string | null
  frameCount: number
  frameIntervalSeconds: number | null
  requestedFrame: number
  displayedFrame: number
  requestedTime: string | null
  displayedTime: string | null
  startTime: string | null
  endTime: string | null
  stats: FlowStats
  options: FlowOptions
  tidal: { status: string; active?: boolean; visualOnly?: boolean }
  capabilities: FlowCapabilities
}

export interface FlowSample {
  status: 'wet' | 'dry'
  cell: number
  lon: number
  lat: number
  time: string
  wet: boolean
  wetTransition: boolean
  level: number | null
  u: number | null
  v: number | null
  speed: number | null
  dirDeg: number | null
}

/** attach 上下文：渲染会话通过 onTick 驱动，onWarning/onError 回传诊断。 */
export interface RendererContext {
  data: unknown
  options: FlowOptions
  profile?: TidalProfile
  onTick: (now: number) => void
  onWarning: (warning: FlowWarning) => void
  onError: (error: FlowError | Error) => void
}

export interface FlowSession {
  setFrames(nodesA: Float32Array, nodesB: Float32Array, frontA?: unknown, frontB?: unknown): void
  setTime(ratio: number, animationTime: number, animationFrame: number): void
  setOptions(options: FlowOptions): void
  destroy(): void
  requestRender?(): void
  pick?(position: unknown): { lon: number; lat: number } | null | undefined
  resetTrails?(): void
  getCapabilities?(): unknown
  getTidalState?(): { status: string; active?: boolean; visualOnly?: boolean }
}

/** Opaque compatibility boundary. Use createSuperMap3DRenderer for the supported renderer. */
export interface FlowRenderer { attach(context: RendererContext): FlowSession }

export interface FlowConfig {
  renderer: FlowRenderer
  provider: FlowProvider
  extensions?: TidalExtension[]
  options?: FlowOptionsPatch
  playback?: { autoPlay?: boolean; rate?: number; secondsPerFrame?: number; loop?: boolean }
  worker?: boolean
  workerUrl?: string | URL
  workerFactory?: () => Worker
  timeZone?: string
  tidalHistoryBudgetMB?: number
}

export interface ScenarioChange { previous: string | null; current: string }
export interface TimeChange { requestedTime: string | null; displayedTime: string | null; displayedFrame: number }

export interface FlowField {
  loadScenario(selection?: ScenarioSelection | string, context?: RequestContext): Promise<FlowState>
  reinitialize(): Promise<FlowState>
  seek(time: string | Date, context?: RequestContext): Promise<FlowState>
  play(): void
  pause(): void
  setPlaybackRate(rate: number): void
  setOptions(patch: FlowOptionsPatch): void
  setVisible(visible: boolean): void
  getState(): FlowState
  getCapabilities(): FlowCapabilities
  getDiagnostics(): FlowDiagnostics
  queryAt(point: { lon: number; lat: number; time?: string | Date }, context?: RequestContext): Promise<FlowSample | null>
  querySeries(point: { cell: number } | { lon: number; lat: number }, context?: RequestContext): Promise<Series>
  listScenarios(context?: RequestContext): Promise<Scenario[]>
  pick(position: { x: number; y: number }, context?: RequestContext): Promise<FlowSample | null>
  on(event: 'statechange', listener: (state: FlowState) => void): () => void
  on(event: 'error', listener: (error: FlowError) => void): () => void
  on(event: 'destroy', listener: () => void): () => void
  on(event: 'progress', listener: (progress: FlowProgress) => void): () => void
  on(event: 'warning', listener: (warning: FlowWarning) => void): () => void
  on(event: 'scenariochange', listener: (change: ScenarioChange) => void): () => void
  on(event: 'timechange', listener: (change: TimeChange) => void): () => void
  on(event: 'ready', listener: (state: FlowState) => void): () => void
  destroy(): Promise<void>
}

export declare const VERSION: string
export declare const DEFAULT_OPTIONS: Readonly<FlowOptions>
export declare const WATER_QUALITY_OPTIONS: readonly { label: string; value: WaterQualityPreset }[]
export declare const COLOR_RAMPS: Readonly<{ level: string[]; speed: string[] }>
export declare function createFlowField(config: FlowConfig): FlowField
export declare function createHttpProvider(config: { baseUrl: string; request?: typeof fetch } & ProviderRequestOptions): FlowProvider
export declare function createStaticProvider(config: { manifestUrl: string; request?: typeof fetch } & ProviderRequestOptions): FlowProvider
