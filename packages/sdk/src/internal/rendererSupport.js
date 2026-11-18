// Shared renderer support helpers: pure functions kept free of WebGL/DOM side effects
// so they can be unit-tested under Node.

// Minimal EPSG:4326 -> EPSG:3857 projection used by the W3D water engine when the
// host does not provide proj4. Pass it as `runtime.proj4` (or let the host load proj4).
export function webMercatorProj4(source, target, coordinate) {
    if (source !== 'EPSG:4326' || target !== 'EPSG:3857') {
        throw new Error(`W3D 暂不支持投影转换：${source} -> ${target}`)
    }
    const lon = Number(coordinate[0])
    const lat = Math.max(-85.05112878, Math.min(85.05112878, Number(coordinate[1])))
    const x = (lon * 20037508.34) / 180
    const y = (Math.log(Math.tan(((90 + lat) * Math.PI) / 360)) * 20037508.34) / Math.PI
    return [x, y]
}

const SUPERMAP3D_MEMBERS = ['Texture', 'Framebuffer', 'Sampler', 'RenderState', 'Matrix4', 'Cartesian2', 'Cartographic', 'JulianDate', 'PixelFormat', 'PixelDatatype', 'Transforms']
const SCENE_MEMBERS = ['primitives', 'preUpdate', 'postUpdate']

// Returns the names of required runtime members that are missing or unusable.
// An empty array means the supplied runtime can drive the W3D water renderer.
export function checkRuntime({ runtime, viewer } = {}) {
    const missing = []
    const SuperMap3D = runtime?.SuperMap3D
    for (const key of SUPERMAP3D_MEMBERS) {
        if (!SuperMap3D?.[key]) missing.push(`SuperMap3D.${key}`)
    }
    const scene = viewer?.scene
    for (const key of SCENE_MEMBERS) {
        if (scene?.[key] == null) missing.push(`scene.${key}`)
    }
    if (!scene?.context?.uniformState) missing.push('scene.context.uniformState')
    if (!scene?.camera) missing.push('scene.camera')
    const proto = runtime?.w3d?.WaterFloodSimulation?.prototype
    if (typeof proto?.loadIndexBufferData !== 'function') {
        missing.push('w3d.WaterFloodSimulation.prototype.loadIndexBufferData')
    }
    return missing
}

// Strip the query string and hash from an asset URL for diagnostics.
export function assetUrl(url) {
    const text = String(url ?? '')
    const cut = text.search(/[?#]/)
    return cut === -1 ? text : text.slice(0, cut)
}

// Fire-and-forget image preload for early asset-failure detection; never blocks attach.
export function preloadImage(url, { asset, onWarning } = {}) {
    if (typeof Image === 'undefined' || !url) return
    const image = new Image()
    image.onerror = () => {
        const warning = { code: 'ASSET_LOAD_FAILED', message: `资源加载失败：${asset}`, detail: { asset, url: assetUrl(url) } }
        if (onWarning) onWarning(warning)
        else console.warn(`[flow-renderer] ${warning.code}: ${warning.message}`, warning.detail)
    }
    image.src = url
}

// One-shot WebGL capability probe; recommendedQuality drops to 'low' without WebGL2
// or when the max texture size is below 4096.
export function probeGl(gl) {
    const webgl2 = (typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext)
        || typeof gl?.texStorage2D === 'function'
    const maxTextureSize = Number(gl?.getParameter?.(gl?.MAX_TEXTURE_SIZE)) || 0
    const floatRenderTarget = webgl2
        ? !!gl?.getExtension?.('EXT_color_buffer_float')
        : !!gl?.getExtension?.('OES_texture_float') && !!gl?.getExtension?.('WEBGL_color_buffer_float')
    return {
        webgl2,
        maxTextureSize,
        floatRenderTarget,
        recommendedQuality: (!webgl2 || maxTextureSize < 4096) ? 'low' : 'standard'
    }
}

// Non-critical engine member check after the water engine exists; returns missing names.
export function checkDegraded({ engine, scene } = {}) {
    const missing = []
    const material = engine?.appearance?.material
    if (!material) missing.push('engine.appearance.material')
    else if (!material._uniforms) missing.push('material._uniforms')
    if (!engine?.primitive) missing.push('engine.primitive')
    if (!scene?.view?.globeDepth) missing.push('scene.view.globeDepth')
    return missing
}

// Watch the scene canvas for WebGL context loss/restore; returns an unwatch function.
export function watchContext(canvas, { onLost, onRestored } = {}) {
    if (!canvas?.addEventListener) return () => { }
    const lost = event => onLost?.(event)
    const restored = event => onRestored?.(event)
    canvas.addEventListener('webglcontextlost', lost)
    canvas.addEventListener('webglcontextrestored', restored)
    return () => {
        canvas.removeEventListener('webglcontextlost', lost)
        canvas.removeEventListener('webglcontextrestored', restored)
    }
}
