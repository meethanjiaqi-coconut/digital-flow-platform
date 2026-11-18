import {createFlowField,createStaticProvider,createHttpProvider,FlowError,isFlowError,VERSION,type FlowState,type FlowSample,type Series,type Scenario} from '@digital-flow/sdk'
import {createSuperMap3DRenderer} from '@digital-flow/sdk/supermap3d'
import {createTidalEstuary,qiantangProfile} from '@digital-flow/sdk/tidal-estuary'
import {FlowControls} from '@digital-flow/vue-tdesign'
import {h} from 'vue'
declare const viewer: unknown,SuperMap3D: unknown,w3d: unknown
const flow=createFlowField({
  provider:createStaticProvider({manifestUrl:'https://example.invalid/package.json',retry:false,timeoutMs:5000}),
  renderer:createSuperMap3DRenderer({viewer,runtime:{SuperMap3D,w3d},assets:{colorTable:'a.png',colorTable2:'b.png'}}),
  extensions:[createTidalEstuary({profile:qiantangProfile})],
  timeZone:'Asia/Shanghai',tidalHistoryBudgetMB:128
})
flow.setOptions({particles:{trailSeconds:3,count:16384},water:{colorMode:'river'}})
flow.on('statechange',(state:FlowState)=>console.log(state.displayedTime,state.error?.message))
flow.on('error',(error:FlowError)=>{if(isFlowError(error))console.log(error.code,error.toJSON().recoverable)})
flow.on('destroy',()=>console.log('destroyed'))
flow.on('progress',p=>console.log(p.phase,p.loaded,p.total))
flow.on('warning',w=>console.log(w.code,w.message))
flow.on('scenariochange',c=>console.log(c.previous,c.current))
flow.on('timechange',c=>console.log(c.displayedTime,c.displayedFrame))
flow.on('ready',s=>console.log(s.status))
h(FlowControls,{flow})
const caps=flow.getCapabilities()
const diag=flow.getDiagnostics()
console.log(VERSION,caps.scenarios,caps.series,caps.worker,caps.maxNodes,diag.provider,diag.warnings.length)
const scenarios:Scenario[]=await flow.listScenarios({signal:AbortSignal.timeout(1000)})
console.log(scenarios.length)
const reinit:Promise<FlowState>=flow.reinitialize()
const seeked:FlowState=await flow.seek('2026-01-01T00:00:00Z',{signal:AbortSignal.timeout(1000)})
console.log(seeked.displayedFrame)
const sample:FlowSample|null=await flow.queryAt({lon:120,lat:30,time:'2026-01-01T00:00:00Z'})
console.log(sample?.status,sample?.wetTransition,sample?.dirDeg)
const series:Series=await flow.querySeries({cell:0})
console.log(series.source,series.points.length)
const picked:FlowSample|null=await flow.pick({x:1,y:2})
console.log(picked?.cell)
const done:Promise<void>=flow.destroy()
await done
// @ts-expect-error Unsupported option must be caught for integrators.
flow.setOptions({particles:{trailing:1}})
// @ts-expect-error Timestamp seeking is explicit.
flow.seek(3)
// @ts-expect-error Unknown event names are rejected.
flow.on('bogus',()=>{})
// @ts-expect-error ScenarioSelection has no id field.
flow.loadScenario({id:'x'})
// @ts-expect-error queryAt requires both lon and lat.
flow.queryAt({lon:1})
// @ts-expect-error createHttpProvider requires baseUrl.
createHttpProvider({request:fetch})
