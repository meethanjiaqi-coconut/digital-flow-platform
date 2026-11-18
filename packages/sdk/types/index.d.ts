export interface RequestContext {signal?: AbortSignal}
export interface Manifest {
  scenarioId: string; sourceRunId?: string; scenarioName?: string;
  nNodes:number; nCells:number; nTris:number; nFrames:number;
  bbox:[number,number,number,number]; scales:{level:number;uv:number}; drySentinel:number;
  mesh:{meshId:string;file?:string}; frames:Array<{index:number;validTime:string;file?:string}>;
  stats?:Record<string,number>;
}
export interface ScenarioSelection {sourceRunId?:string}
export interface Scenario {id:string;sourceRunId?:string;name?:string;startTime?:string;endTime?:string;frameCount?:number}
export interface SeriesPoint {frameIndex:number;validTime:string;dry:boolean;level:number;u:number;v:number}
export interface Series {scenarioId:string;cellIndex:number;points:SeriesPoint[]}
export interface FlowProvider {
  listScenarios?(context?:RequestContext):Promise<Scenario[]>;
  loadManifest(selection?:ScenarioSelection,context?:RequestContext):Promise<Manifest>;
  getMesh(manifest:Manifest,context?:RequestContext):Promise<ArrayBuffer>;
  getFrame(manifest:Manifest,index:number,context?:RequestContext):Promise<ArrayBuffer>;
  querySeries?(manifest:Manifest,cell:number,context?:RequestContext):Promise<Series>;
}
export interface FlowOptions {
  visible:boolean;flowStrength:number;exaggeration:number;
  particles:{visible:boolean;count:16384|65536|262144;lineWidth:number;trailSeconds:number};
  water:{visible:boolean;colorMode:'river'|'speed'|'level';arrows:boolean;reflection:boolean;waveAmplitude:number};
  tidal:{marker:boolean;turbidity:boolean};
}
export type FlowOptionsPatch = {[K in keyof FlowOptions]?:FlowOptions[K] extends object ? Partial<FlowOptions[K]>:FlowOptions[K]};
export interface TidalProfile {id:string;polygon:ReadonlyArray<readonly [number,number]>;visualOnly?:boolean}
export interface TidalExtension {kind:'tidal-estuary';profile:TidalProfile}
export interface FlowState {
  version:string;status:'idle'|'loading'|'ready'|'error'|'destroyed';playing:boolean;buffering:boolean;
  rate:number;secondsPerFrame:number;error:string|null;scenarioId:string|null;frameCount:number;
  requestedFrame:number;displayedFrame:number;requestedTime:string|null;displayedTime:string|null;
  startTime:string|null;endTime:string|null;options:FlowOptions;
  tidal:{status:string;active?:boolean;visualOnly?:boolean};
}
export interface FlowSample {cell:number;lon:number;lat:number;time:string;wet:boolean;level:number;u:number;v:number;speed:number;dirDeg:number}
/** Opaque compatibility boundary. Use createSuperMap3DRenderer for the supported renderer. */
export interface FlowRenderer {attach(context:any):any}
export interface FlowConfig {
  renderer:FlowRenderer;provider:FlowProvider;extensions?:TidalExtension[];options?:FlowOptionsPatch;
  playback?:{autoPlay?:boolean;rate?:number;secondsPerFrame?:number;loop?:boolean};
  worker?:boolean;workerUrl?:string|URL;workerFactory?:()=>Worker;
}
export interface FlowField {
  loadScenario(selection?:ScenarioSelection,context?:RequestContext):Promise<FlowState>;
  seek(time:string|Date):Promise<FlowState>;
  play():void;pause():void;setPlaybackRate(rate:number):void;
  setOptions(patch:FlowOptionsPatch):void;setVisible(visible:boolean):void;
  getState():FlowState;
  queryAt(point:{lon:number;lat:number},context?:RequestContext):Promise<FlowSample|null>;
  querySeries(point:{cell:number}|{lon:number;lat:number},context?:RequestContext):Promise<Series>;
  pick(position:{x:number;y:number},context?:RequestContext):Promise<FlowSample|null>;
  on(event:'statechange',listener:(state:FlowState)=>void):()=>void;
  on(event:'error',listener:(error:Error)=>void):()=>void;
  on(event:'destroy',listener:()=>void):()=>void;
  destroy():void;
}
export declare const VERSION:string;
export declare const DEFAULT_OPTIONS:Readonly<FlowOptions>;
export declare function createFlowField(config:FlowConfig):FlowField;
export declare function createHttpProvider(config:{baseUrl:string;request?:typeof fetch}):FlowProvider;
export declare function createStaticProvider(config:{manifestUrl:string;request?:typeof fetch}):FlowProvider;
