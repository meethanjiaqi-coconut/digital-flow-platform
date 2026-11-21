import type { DefineComponent } from 'vue'
import type {
  FlowField,
  FlowOptionsPatch,
  FlowProvider,
  FlowRenderer,
  FlowSample,
  PlaybackOptions,
  Scenario,
  ScenarioSelection,
  Series,
  TidalExtension
} from '@digital-flow/sdk'

export interface FlowControlsProps {
  flow: FlowField
  scenarios?: Scenario[]
  scenarioLoading?: boolean
  title?: string
  showPlayback?: boolean
  showScenarioSelector?: boolean
  showLocate?: boolean
  collapsible?: boolean
  width?: string | number
}

export interface FlowTimelineProps {
  flow: FlowField
  rates?: number[]
  wide?: boolean
}

export interface FlowLegendProps {
  flow?: FlowField
  mode?: 'speed' | 'level' | 0 | 1
  min?: number
  max?: number
  speedMax?: number
}

export interface FlowScenarioSelectorProps {
  flow: FlowField
  scenarios?: Scenario[]
  loading?: boolean
  placeholder?: string
  popupProps?: Record<string, unknown>
}

export interface FlowMiniChartProps {
  series: Series
  currentTime?: string | number | Date | null
  currentFrame?: number
  timeZone?: string
}

export interface FlowQueryPopupProps {
  flow?: FlowField
  sample: FlowSample | null
  series?: Series | null
  loading?: boolean
  currentTime?: string | number | Date
  timeZone?: string
}

export interface DigitalFlowFieldProps {
  flow?: FlowField
  provider?: FlowProvider
  renderer?: FlowRenderer
  extensions?: TidalExtension[]
  playback?: PlaybackOptions
  options?: FlowOptionsPatch
  timeZone?: string
  tidalHistoryBudgetMB?: number
  worker?: boolean
  workerUrl?: string
  workerFactory?: () => Worker
  initialSelection?: ScenarioSelection
  autoLoad?: boolean
  viewer?: unknown
  enablePick?: boolean
  supermap3d?: unknown
  scenarios?: Scenario[]
  title?: string
  collapsible?: boolean
  defaultOpen?: boolean
  showTimeline?: boolean
  showQueryPopup?: boolean
  showLocate?: boolean
  panelWidth?: string | number
  placement?: 'right' | 'left'
  zIndex?: number
  themeColor?: string
}

export declare const DigitalFlowField: DefineComponent<DigitalFlowFieldProps>
export declare const FlowControls: DefineComponent<FlowControlsProps>
export declare const FlowTimeline: DefineComponent<FlowTimelineProps>
export declare const FlowLegend: DefineComponent<FlowLegendProps>
export declare const FlowScenarioSelector: DefineComponent<FlowScenarioSelectorProps>
export declare const FlowQueryPopup: DefineComponent<FlowQueryPopupProps>
export declare const FlowMiniChart: DefineComponent<FlowMiniChartProps>
