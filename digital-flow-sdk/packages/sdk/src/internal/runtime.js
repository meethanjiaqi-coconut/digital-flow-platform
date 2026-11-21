// Compatibility boundary: this tested W3D runtime uses process-wide globals.
// A single active renderer is enforced; importing the package has no side effects.
import { FlowError } from '../errors.js'

export let SuperMap3D, w3d
let active

export function acquireRuntime(runtime, owner) {
  if (active) throw new FlowError('RUNTIME_BUSY', '页面已有活动的 SuperMap3D 流场渲染器，请先销毁')
  if (!runtime?.SuperMap3D?.Texture || typeof runtime?.w3d?.WaterFloodSimulation !== 'function') {
    throw new FlowError('UNSUPPORTED_RUNTIME', '缺少兼容的 SuperMap3D.Texture 或 w3d.WaterFloodSimulation 运行库')
  }
  for (const key of ['SuperMap3D', 'w3d']) {
    if (globalThis[key] && globalThis[key] !== runtime[key]) {
      throw new FlowError('UNSUPPORTED_RUNTIME', `全局 ${key} 已存在且与提供的运行库不一致`)
    }
  }
  // proj4 规则：宿主全局已是函数则不动；否则安装 runtime.proj4；都没有则不支持。
  const hasHostProj4 = typeof globalThis.proj4 === 'function'
  const proj4 = hasHostProj4 ? globalThis.proj4 : (typeof runtime.proj4 === 'function' ? runtime.proj4 : null)
  if (!proj4) {
    throw new FlowError('UNSUPPORTED_RUNTIME', '缺少 proj4 投影函数：请传入 runtime.proj4（可用 webMercatorProj4）或由宿主加载 proj4')
  }
  const saved = new Map(['SuperMap3D', 'w3d', 'proj4'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
  const installed = new Map()
  SuperMap3D = runtime.SuperMap3D; w3d = runtime.w3d
  globalThis.SuperMap3D = SuperMap3D
  globalThis.w3d = w3d
  installed.set('SuperMap3D', SuperMap3D)
  installed.set('w3d', w3d)
  if (!hasHostProj4) {
    globalThis.proj4 = proj4
    installed.set('proj4', proj4)
  }
  active = owner
  return () => {
    if (active !== owner) return
    // 只恢复仍是 SDK 安装值的全局；宿主在会话期间替换的值保留。
    for (const [key, value] of installed) {
      if (globalThis[key] !== value) continue
      const descriptor = saved.get(key)
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else delete globalThis[key]
    }
    active = undefined; SuperMap3D = w3d = undefined
  }
}
