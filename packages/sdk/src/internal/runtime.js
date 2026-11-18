// Compatibility boundary: this tested W3D runtime uses process-wide globals.
// A single active renderer is enforced; importing the package has no side effects.
export let SuperMap3D, w3d
let active
export function acquireRuntime(runtime, owner) {
  if (active) throw new Error('Alpha supports one active SuperMap3D flow renderer per page')
  if (!runtime?.SuperMap3D?.Texture || typeof runtime?.w3d?.WaterFloodSimulation !== 'function') throw new TypeError('Supply compatible SuperMap3D and w3d runtime objects')
  for (const key of ['SuperMap3D','w3d']) if (globalThis[key] && globalThis[key] !== runtime[key]) throw new Error(`Existing global ${key} differs from supplied runtime`)
  const saved = new Map(['SuperMap3D','w3d','proj4'].map(k => [k,Object.getOwnPropertyDescriptor(globalThis,k)]))
  SuperMap3D = runtime.SuperMap3D; w3d = runtime.w3d
  globalThis.SuperMap3D = SuperMap3D; globalThis.w3d = w3d; active = owner
  return () => {
    if (active !== owner) return
    for (const [key,descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis,key,descriptor)
      else delete globalThis[key]
    }
    active = undefined; SuperMap3D = w3d = undefined
  }
}
