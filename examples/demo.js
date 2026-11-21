import {createFlowField,createStaticProvider} from '@digital-flow/sdk'
import {createSuperMap3DRenderer,webMercatorProj4} from '@digital-flow/sdk/supermap3d'
import {createTidalEstuary,qiantangProfile} from '@digital-flow/sdk/tidal-estuary'

export async function createDemo() {
  const S=globalThis.SuperMap3D
  const root=new URL('../../',document.baseURI)
  const viewer=new S.Viewer('map',{
    animation:false,timeline:false,baseLayerPicker:false,geocoder:false,homeButton:false,
    sceneModePicker:false,navigationHelpButton:false,infoBox:false,selectionIndicator:false,
    shouldAnimate:false,terrainProvider:new S.EllipsoidTerrainProvider(),
    imageryProvider:new S.UrlTemplateImageryProvider({url:'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',maximumLevel:18})
  })
  viewer.scene.globe.depthTestAgainstTerrain=false
  viewer.screenSpaceEventHandler?.removeInputAction?.(S.ScreenSpaceEventType.LEFT_CLICK)
  // Locating the river and handling clicks are explicit host actions, not SDK defaults.
  viewer.camera.setView({destination:S.Cartesian3.fromDegrees(120.65,30.35,125000),orientation:{heading:0,pitch:-Math.PI/2,roll:0}})
  const provider=createStaticProvider({manifestUrl:new URL('local-assets/data/5min/package.json',root).href})
  const create=()=>createFlowField({
    renderer:createSuperMap3DRenderer({viewer,runtime:{SuperMap3D:S,w3d:globalThis.w3d,proj4:webMercatorProj4},assets:{
      colorTable:new URL('local-assets/runtime/SuperMap3D/Assets/Data/colorTable.png',root).href,
      colorTable2:new URL('local-assets/runtime/SuperMap3D/Assets/Data/colorTable2.png',root).href
    }}),
    provider,extensions:[createTidalEstuary({profile:qiantangProfile})],playback:{autoPlay:false}
  })
  // Capture after the host has initialized its own data-source primitive collection.
  await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))
  const baseline={primitives:viewer.scene.primitives.length,entities:viewer.entities.values.length,preUpdate:viewer.scene.preUpdate.numberOfListeners,postUpdate:viewer.scene.postUpdate.numberOfListeners,clockTick:viewer.clock.onTick.numberOfListeners,clockStop:viewer.clock.onStop.numberOfListeners,currentTime:S.JulianDate.toIso8601(viewer.clock.currentTime),shouldAnimate:viewer.clock.shouldAnimate}
  const flow=create()
  globalThis.demoFlow=flow
  globalThis.sdkDemo={viewer,provider,create,baseline}
  const query=document.querySelector('#query')
  const handler=query?new S.ScreenSpaceEventHandler(viewer.scene.canvas):null
  handler?.setInputAction(async ({position})=>{
    try {
      const value=await flow.pick({x:position.x,y:position.y})
      query.textContent=!value ? '当前位置无模型数据'
        : value.status==='dry' ? '当前位置为干单元（无水）'
        : `水位 ${value.level?.toFixed(2) ?? '—'} m · 流速 ${value.speed?.toFixed(2) ?? '—'} m/s · 流向 ${value.dirDeg==null?'—':value.dirDeg.toFixed(0)+'°'}`
    }catch(e){query.textContent=e.message}
  },S.ScreenSpaceEventType.LEFT_CLICK)
  window.addEventListener('pagehide',()=>{handler?.destroy();flow.destroy();viewer.destroy()},{once:true})
  flow.on('error',e=>{document.querySelector('#status').textContent=e.message})
  await flow.loadScenario({sourceRunId:'RST-WUV-20261025-5MIN'})
  return flow
}
