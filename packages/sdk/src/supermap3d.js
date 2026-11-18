import { acquireRuntime } from './internal/runtime.js'
import { W3dWaterSurfaceLayer } from './internal/W3dWaterSurfaceLayer.js'
import { ParticleFlowLayer } from './internal/ParticleFlowLayer.js'
import { TidalFrontLayer } from './internal/tidal-front-layer.js'

export function createSuperMap3DRenderer({viewer, runtime, assets = {}} = {}) {
  if (!viewer?.scene?.primitives || !viewer.clock) throw new TypeError('Host-owned Viewer is required')
  const urls = {
    normals:[new URL('../assets/estuary/Water_1_M_Normal.jpg',import.meta.url).href,new URL('../assets/estuary/Water_2_M_Normal.jpg',import.meta.url).href],
    ...assets
  }
  if (!urls.colorTable || !urls.colorTable2) throw new TypeError('assets.colorTable and assets.colorTable2 are required')
  return {
    attach({data,options,profile,onTick}) {
      if (viewer.isDestroyed?.()) throw new Error('Viewer is destroyed')
      const scene = viewer.scene, S = runtime.SuperMap3D
      if (scene._waterPassEvent) throw new Error('Another W3D water surface already owns this scene')
      const owner = {}, release = acquireRuntime(runtime,owner)
      const savedScene = new Map(['_worldENU','_cameraENU','_waterPassEvent'].map(k => [k,Object.getOwnPropertyDescriptor(scene,k)]))
      const savedMatrices = new Map(['_worldENU','_cameraENU'].filter(k => scene[k]).map(k => [k,S.Matrix4.clone(scene[k])]))
      let water, particles, front, removeTick, destroyed = false, lastOptions
      function destroy() {
        if (destroyed) return
        destroyed = true
        removeTick?.()
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
        particles.setWidth(next.particles.lineWidth)
        particles.setTrailDuration(next.particles.trailSeconds)
        water.setColorMode({river:2,speed:0,level:1}[next.water.colorMode])
        water.showArrow = next.water.arrows && water.show
        water.setSceneReflection(next.water.reflection)
        water.setWaveAmplitude(next.water.waveAmplitude)
        water.setTidalTurbidityEnabled(Boolean(profile && next.tidal.turbidity))
        lastOptions = structuredClone(next)
      }
      try {
        water = new W3dWaterSurfaceLayer(viewer,data,urls)
        particles = new ParticleFlowLayer(data,viewer)
        scene.primitives.add(particles)
        if (profile) {front = new TidalFrontLayer(data,viewer); scene.primitives.add(front)}
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
            const mix = water._tidalMix
            return {status:mix.front?.status || (mix.memoryMaximum > .05 ? 'residual' : 'unavailable'), active:water.tidalTurbidityActive, visualOnly:true}
          },
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
