import { acquireRuntime } from './internal/runtime.js'
import { checkDegraded, checkRuntime, preloadImage, probeGl, watchContext, webMercatorProj4 } from './internal/rendererSupport.js'
import { W3dWaterSurfaceLayer } from './internal/W3dWaterSurfaceLayer.js'
import { ParticleFlowLayer } from './internal/ParticleFlowLayer.js'
import { TidalFrontLayer } from './internal/tidal-front-layer.js'
import { FlowError } from './errors.js'
import { WATER_QUALITY_OFF } from './internal/waterQualityPresets.js'

export { webMercatorProj4 }

export function createSuperMap3DRenderer({viewer, runtime, assets = {}} = {}) {
  if (!viewer?.scene?.primitives || !viewer.clock) throw new FlowError('INVALID_ARGUMENT', '需要宿主提供的 Viewer（viewer.scene.primitives 与 viewer.clock）')
  const urls = {
    normals:[new URL('../assets/estuary/Water_1_M_Normal.jpg',import.meta.url).href,new URL('../assets/estuary/Water_2_M_Normal.jpg',import.meta.url).href],
    ...assets
  }
  if (!urls.colorTable || !urls.colorTable2) throw new FlowError('INVALID_ARGUMENT', 'assets.colorTable 和 assets.colorTable2 为必填资源地址')
  return {
    attach({data,options,profile,onTick,onWarning,onError}) {
      const missing = checkRuntime({ runtime, viewer })
      if (missing.length) throw new FlowError('UNSUPPORTED_RUNTIME', `SuperMap3D 运行库缺少关键成员：${missing.join('、')}`)
      if (viewer.isDestroyed?.()) throw new FlowError('UNSUPPORTED_RUNTIME', 'Viewer 已销毁')
      const scene = viewer.scene, S = runtime.SuperMap3D
      if (scene._waterPassEvent) throw new FlowError('RUNTIME_BUSY', '场景已被其它 W3D 水面占用')
      const owner = {}, release = acquireRuntime(runtime,owner)
      const warn = onWarning ?? (w => console.warn(`[flow-renderer] ${w?.code ?? 'WARNING'}: ${w?.message ?? ''}`, w?.detail))
      const glCaps = probeGl(scene.context?._gl)
      preloadImage(urls.colorTable, { asset: 'colorTable', onWarning: warn })
      preloadImage(urls.colorTable2, { asset: 'colorTable2', onWarning: warn })
      const unwatchContext = watchContext(scene.canvas, {
        onLost: () => {
          const error = new FlowError('CONTEXT_LOST', 'WebGL 上下文丢失，请在恢复后调用 reinitialize()')
          if (onError) onError(error)
          else console.error(`[flow-renderer] ${error.code}: ${error.message}`)
        },
        onRestored: () => warn({ code: 'CONTEXT_RESTORED', message: 'WebGL 上下文已恢复；如画面异常请调用 flow.reinitialize()' })
      })
      const savedScene = new Map(['_worldENU','_cameraENU','_waterPassEvent'].map(k => [k,Object.getOwnPropertyDescriptor(scene,k)]))
      const savedMatrices = new Map(['_worldENU','_cameraENU'].filter(k => scene[k]).map(k => [k,S.Matrix4.clone(scene[k])]))
      let water, particles, front, removeTick, destroyed = false, lastOptions
      function destroy() {
        if (destroyed) return
        destroyed = true
        removeTick?.()
        unwatchContext()
        try {
          for (const layer of [particles,front]) if (layer) { if (!scene.primitives.remove(layer)) layer.destroy() }
          water?.destroy()
        } finally {
          for (const [key,descriptor] of savedScene) {
            if (descriptor) Object.defineProperty(scene,key,descriptor); else delete scene[key]
          }
          for (const [key,matrix] of savedMatrices) S.Matrix4.clone(matrix,scene[key])
          release(); scene.requestRender?.()
        }
      }
      function setOptions(next) {
        water.show = next.visible && next.water.visible
        particles.show = next.visible && next.particles.visible
        if (front) front.show = next.visible && next.water.visible && next.tidal.marker
        for (const layer of [water,particles,front]) {layer?.setFlowStrength?.(next.flowStrength); layer?.setExaggeration?.(next.exaggeration)}
        if (lastOptions?.particles.count !== next.particles.count) particles.setCount(Math.sqrt(next.particles.count))
        if (lastOptions?.quality !== next.quality) particles.setQuality?.(next.quality)
        particles.setWidth(next.particles.lineWidth)
        particles.setTrailDuration(next.particles.trailSeconds)
        water.setArrowScale(next.water.arrowScale)
        water.setWaterQuality(next.water.qualityPreset === 'off' ? WATER_QUALITY_OFF : next.water.qualityPreset)
        water.setPalette(next.water.palette === 'tech' ? 1 : 0)
        water.setColorMode({river:2,speed:0,level:1}[next.water.colorMode])
        water.showArrow = next.water.arrows && water.show
        water.setSceneReflection(next.water.reflection)
        water.setWaveAmplitude(next.water.waveAmplitude)
        water.setTidalTurbidityEnabled(Boolean(profile && data.tidalAvailable && next.tidal.turbidity))
        lastOptions = structuredClone(next)
      }
      try {
        water = new W3dWaterSurfaceLayer(viewer,data,urls,{onWarning:warn})
        const degraded = checkDegraded({ engine: water._engine, scene })
        if (degraded.length) warn({ code: 'RUNTIME_DEGRADED', message: `W3D 水面引擎缺少非关键成员：${degraded.join('、')}`, detail: { missing: degraded } })
        particles = new ParticleFlowLayer(data,viewer,{onWarning:warn})
        scene.primitives.add(particles)
        if (profile && data.tidalAvailable) {front = new TidalFrontLayer(data,viewer); scene.primitives.add(front)}
        setOptions(options)
        removeTick = scene.preUpdate.addEventListener(() => onTick(performance.now()))
        return {
          setOptions, destroy,
          setFrames(a,b,frontA,frontB) {water.setFrames(a,b); particles.setFrames(a,b); front?.setFrames?.(a,b); water.setFrontFrames(frontA,frontB); if (frontA) front?.setFrontFrames(frontA,frontB)},
          setTime(t,seconds,frame) {
            for (const layer of [water,particles,front]) {layer?.setT?.(t); layer?.setAnimationTime?.(seconds,frame)}
            water.setTidalFrontState(front?.active === true)
          },
          getTidalState() {
            if (!profile) return {status:'disabled'}
            if (!data.tidalAvailable) return {status:'disabled', reason:data.tidalAvailability?.reason}
            const mix = water._tidalMix
            return {status:mix.front?.status || (mix.memoryMaximum > .05 ? 'residual' : 'unavailable'), active:water.tidalTurbidityActive, visualOnly:true}
          },
          getCapabilities() {
            const caps = {
              water: { available: Boolean(water?._engine) },
              particles: { available: !particles?.unavailableReason },
              webgl2: glCaps.webgl2,
              maxTextureSize: glCaps.maxTextureSize,
              floatRenderTarget: glCaps.floatRenderTarget,
              recommendedQuality: glCaps.recommendedQuality
            }
            if (particles?.unavailableReason) caps.particles.reason = particles.unavailableReason
            return caps
          },
          resetTrails() { particles?.resetTrails?.() },
          requestRender: () => scene.requestRender?.(),
          pick({x,y}) {
            const position = scene.camera.pickEllipsoid(new S.Cartesian2(x,y),scene.globe.ellipsoid)
            if (!position) return null
            const c = S.Cartographic.fromCartesian(position)
            return {lon:S.Math.toDegrees(c.longitude),lat:S.Math.toDegrees(c.latitude)}
          }
        }
      } catch(error) {destroy(); throw error}
    }
  }
}
