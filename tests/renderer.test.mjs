import test from 'node:test'
import assert from 'node:assert/strict'
import { checkDegraded, checkRuntime, probeGl, watchContext, webMercatorProj4 } from '../packages/sdk/src/internal/rendererSupport.js'
import { acquireRuntime } from '../packages/sdk/src/internal/runtime.js'
import { isFlowError } from '../packages/sdk/src/errors.js'

const GLOBAL_KEYS = ['SuperMap3D', 'w3d', 'proj4']
function resetGlobals() {
    for (const key of GLOBAL_KEYS) delete globalThis[key]
}

function makeRuntime(overrides = {}) {
    class WaterFloodSimulation {}
    WaterFloodSimulation.prototype.loadIndexBufferData = function () {}
    return {
        SuperMap3D: {
            Texture: function () {}, Framebuffer: function () {}, Sampler: function () {},
            RenderState: function () {}, Matrix4: {}, Cartesian2: function () {},
            Cartographic: {}, JulianDate: {}, PixelFormat: {}, PixelDatatype: {}, Transforms: {}
        },
        w3d: { WaterFloodSimulation },
        ...overrides
    }
}

function makeViewer() {
    return { scene: { primitives: {}, preUpdate: {}, postUpdate: {}, context: { uniformState: {} }, camera: {} } }
}

test('checkRuntime：完整运行库返回空缺失列表', () => {
    assert.deepEqual(checkRuntime({ runtime: makeRuntime(), viewer: makeViewer() }), [])
})

test('checkRuntime：列出全部缺失成员名', () => {
    const runtime = makeRuntime()
    delete runtime.SuperMap3D.Texture
    delete runtime.SuperMap3D.Transforms
    runtime.w3d = {}
    const viewer = makeViewer()
    delete viewer.scene.camera
    delete viewer.scene.context.uniformState
    const missing = checkRuntime({ runtime, viewer })
    for (const name of [
        'SuperMap3D.Texture', 'SuperMap3D.Transforms',
        'scene.camera', 'scene.context.uniformState',
        'w3d.WaterFloodSimulation.prototype.loadIndexBufferData'
    ]) {
        assert.ok(missing.includes(name), `缺失 ${name}`)
    }
    assert.equal(missing.length, 5)
})

test('acquireRuntime：安装 runtime.proj4，release 后删除全部全局', () => {
    resetGlobals()
    try {
        const runtime = makeRuntime({ proj4: webMercatorProj4 })
        const release = acquireRuntime(runtime, {})
        assert.equal(globalThis.SuperMap3D, runtime.SuperMap3D)
        assert.equal(globalThis.w3d, runtime.w3d)
        assert.equal(globalThis.proj4, webMercatorProj4)
        release()
        assert.equal(globalThis.SuperMap3D, undefined)
        assert.equal(globalThis.w3d, undefined)
        assert.equal(globalThis.proj4, undefined)
    } finally {
        resetGlobals()
    }
})

test('acquireRuntime：宿主已有 proj4 函数时不覆盖', () => {
    resetGlobals()
    const hostProj4 = () => [0, 0]
    globalThis.proj4 = hostProj4
    try {
        const release = acquireRuntime(makeRuntime({ proj4: webMercatorProj4 }), {})
        assert.equal(globalThis.proj4, hostProj4)
        release()
        assert.equal(globalThis.proj4, hostProj4)
    } finally {
        resetGlobals()
    }
})

test('acquireRuntime：会话期间宿主替换 proj4，release 保留宿主值', () => {
    resetGlobals()
    try {
        const release = acquireRuntime(makeRuntime({ proj4: webMercatorProj4 }), {})
        assert.equal(globalThis.proj4, webMercatorProj4)
        const hostProj4 = () => [1, 1]
        globalThis.proj4 = hostProj4
        release()
        assert.equal(globalThis.proj4, hostProj4)
    } finally {
        resetGlobals()
    }
})

test('acquireRuntime：无 proj4 抛 UNSUPPORTED_RUNTIME', () => {
    resetGlobals()
    try {
        assert.throws(() => acquireRuntime(makeRuntime(), {}), error => {
            assert.ok(isFlowError(error))
            assert.equal(error.code, 'UNSUPPORTED_RUNTIME')
            assert.match(error.message, /proj4/)
            return true
        })
    } finally {
        resetGlobals()
    }
})

test('acquireRuntime：第二个获取者抛 RUNTIME_BUSY', () => {
    resetGlobals()
    try {
        const release = acquireRuntime(makeRuntime({ proj4: webMercatorProj4 }), {})
        assert.throws(() => acquireRuntime(makeRuntime({ proj4: webMercatorProj4 }), {}), error => {
            assert.ok(isFlowError(error))
            assert.equal(error.code, 'RUNTIME_BUSY')
            return true
        })
        release()
    } finally {
        resetGlobals()
    }
})

test('webMercatorProj4：(120,30) 与原实现一致', () => {
    const [x, y] = webMercatorProj4('EPSG:4326', 'EPSG:3857', [120, 30])
    assert.ok(Math.abs(x - 13358338.893333334) < 1e-6)
    assert.ok(Math.abs(y - 3503549.843016676) < 1e-6)
    assert.throws(() => webMercatorProj4('EPSG:4326', 'EPSG:4490', [120, 30]))
})

test('watchContext：lost/restored 回调触发且解除后不再通知', () => {
    const canvas = new EventTarget()
    const calls = []
    const unwatch = watchContext(canvas, {
        onLost: e => calls.push(['lost', e.type]),
        onRestored: e => calls.push(['restored', e.type])
    })
    canvas.dispatchEvent(new Event('webglcontextlost'))
    canvas.dispatchEvent(new Event('webglcontextrestored'))
    assert.deepEqual(calls, [['lost', 'webglcontextlost'], ['restored', 'webglcontextrestored']])
    unwatch()
    canvas.dispatchEvent(new Event('webglcontextlost'))
    canvas.dispatchEvent(new Event('webglcontextrestored'))
    assert.equal(calls.length, 2)
})

test('probeGl：WebGL2 + 充足纹理 → standard；否则 low', () => {
    const gl2 = {
        texStorage2D() { },
        MAX_TEXTURE_SIZE: 0x0d33,
        getParameter() { return 8192 },
        getExtension(name) { return name === 'EXT_color_buffer_float' ? {} : null }
    }
    assert.deepEqual(probeGl(gl2), { webgl2: true, maxTextureSize: 8192, floatRenderTarget: true, recommendedQuality: 'standard' })

    const gl1 = {
        MAX_TEXTURE_SIZE: 0x0d33,
        getParameter() { return 4096 },
        getExtension() { return {} }
    }
    const caps1 = probeGl(gl1)
    assert.equal(caps1.webgl2, false)
    assert.equal(caps1.floatRenderTarget, true)
    assert.equal(caps1.recommendedQuality, 'low')

    const small = {
        texStorage2D() { },
        MAX_TEXTURE_SIZE: 0x0d33,
        getParameter() { return 2048 },
        getExtension() { return {} }
    }
    const capsSmall = probeGl(small)
    assert.equal(capsSmall.webgl2, true)
    assert.equal(capsSmall.maxTextureSize, 2048)
    assert.equal(capsSmall.recommendedQuality, 'low')

    const noFloat = probeGl({ texStorage2D() { }, MAX_TEXTURE_SIZE: 0x0d33, getParameter() { return 8192 }, getExtension() { return null } })
    assert.equal(noFloat.floatRenderTarget, false)
    assert.equal(noFloat.recommendedQuality, 'standard')
})

test('checkDegraded：完整返回空，缺失列出非关键成员', () => {
    const healthy = { engine: { appearance: { material: { _uniforms: {} } }, primitive: {} }, scene: { view: { globeDepth: {} } } }
    assert.deepEqual(checkDegraded(healthy), [])
    const missing = checkDegraded({ engine: { appearance: {} }, scene: {} })
    assert.deepEqual(missing, ['engine.appearance.material', 'engine.primitive', 'scene.view.globeDepth'])
    const noUniforms = checkDegraded({ engine: { appearance: { material: {} }, primitive: {} }, scene: { view: { globeDepth: {} } } })
    assert.deepEqual(noUniforms, ['material._uniforms'])
})
