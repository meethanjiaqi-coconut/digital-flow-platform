import {createFlowField,createStaticProvider,type FlowState} from '@digital-flow/sdk'
import {createSuperMap3DRenderer} from '@digital-flow/sdk/supermap3d'
import {createTidalEstuary,qiantangProfile} from '@digital-flow/sdk/tidal-estuary'
import {FlowControls} from '@digital-flow/vue-tdesign'
import {h} from 'vue'
declare const viewer: unknown,SuperMap3D: unknown,w3d: unknown
const flow=createFlowField({
  provider:createStaticProvider({manifestUrl:'https://example.invalid/package.json'}),
  renderer:createSuperMap3DRenderer({viewer,runtime:{SuperMap3D,w3d},assets:{colorTable:'a.png',colorTable2:'b.png'}}),
  extensions:[createTidalEstuary({profile:qiantangProfile})]
})
flow.setOptions({particles:{trailSeconds:3,count:16384},water:{colorMode:'river'}})
flow.on('statechange',(state:FlowState)=>console.log(state.displayedTime))
h(FlowControls,{flow})
// @ts-expect-error Unsupported option must be caught for integrators.
flow.setOptions({particles:{trailing:1}})
// @ts-expect-error Timestamp seeking is explicit.
flow.seek(3)
