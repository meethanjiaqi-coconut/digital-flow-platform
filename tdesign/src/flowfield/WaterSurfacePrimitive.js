/* global SuperMap3D */
/**
 * 数据驱动水面:静态网格几何 + 双帧顶点数据(level,u,v,wet)shader 插值,
 * 流向 flow-mapping 法线扰动、菲涅尔、太阳高光、干湿渐隐与泡沫。
 * 以自定义 DrawCommand 实现(SuperMap3D 暴露 Cesium 渲染内部类)。
 */
import { generateWaterNormalCanvas } from './waterNormalTexture'

const VS = /* glsl */ `
attribute vec3 position;
attribute vec2 lonlat;
attribute vec4 dataA;
attribute vec4 dataB;
uniform float u_t;
uniform float u_exagg;
uniform float u_time;
uniform vec3 u_centerWorld;
varying vec2 v_flow;
varying float v_wet;
varying float v_spd;
varying vec2 v_uv;
varying vec3 v_normalEC;
varying vec3 v_posEC;
void main() {
    vec4 d = mix(dataA, dataB, u_t);
    v_flow = d.yz;
    v_wet = d.w;
    float spd = length(d.yz);
    v_spd = spd;
    vec3 up = normalize(u_centerWorld + position);
    float wave = sin(u_time * 1.3 + dot(position.xy, vec2(0.0021, 0.0017)))
               + 0.6 * sin(u_time * 2.2 + dot(position.yz, vec2(0.0013, 0.0011)));
    float h = (d.x + wave * (0.05 + min(spd, 2.0) * 0.12)) * u_exagg;
    vec3 pos = position + up * h;
    v_uv = lonlat * 125.0; // 1 tile ≈ 0.008°
    v_normalEC = czm_normal * up;
    v_posEC = (czm_modelView * vec4(pos, 1.0)).xyz;
    gl_Position = czm_modelViewProjection * vec4(pos, 1.0);
}
`

const FS = /* glsl */ `
varying vec2 v_flow;
varying float v_wet;
varying float v_spd;
varying vec2 v_uv;
varying vec3 v_normalEC;
varying vec3 v_posEC;
uniform sampler2D u_normalMap;
uniform float u_time;
uniform float u_palette;
void main() {
    if (v_wet < 0.22) discard;
    float spd = v_spd;
    vec2 flowDir = spd > 0.001 ? normalize(v_flow) : vec2(1.0, 0.0);
    float cycle = u_time * (0.25 + spd * 0.55);
    float phase0 = fract(cycle);
    float phase1 = fract(cycle + 0.5);
    vec2 drift = flowDir * 0.42;
    vec3 n1 = texture2D(u_normalMap, v_uv - drift * phase0).xyz * 2.0 - 1.0;
    vec3 n2 = texture2D(u_normalMap, v_uv * 1.19 + vec2(0.35) - drift * phase1).xyz * 2.0 - 1.0;
    float blendPh = abs(phase0 * 2.0 - 1.0);
    vec3 nTS = mix(n1, n2, blendPh);
    nTS = normalize(nTS + vec3(0.0, 0.0, 2.6 / (0.35 + spd)));
    vec3 N = normalize(v_normalEC);
    vec3 T = normalize(cross(vec3(0.0, 0.0, 1.0), N) + vec3(1e-3));
    vec3 B = cross(N, T);
    vec3 normalEC = normalize(T * nTS.x + B * nTS.y + N * nTS.z);
    vec3 viewDir = normalize(-v_posEC);
    float fresnel = pow(1.0 - max(dot(viewDir, normalEC), 0.0), 3.0);
    fresnel = mix(0.06, 0.9, fresnel);
    float sn = clamp(spd / 2.5, 0.0, 1.0);
    vec3 deep = mix(vec3(0.015, 0.09, 0.18), vec3(0.0, 0.06, 0.22), u_palette);
    vec3 mid  = mix(vec3(0.05, 0.32, 0.42), vec3(0.0, 0.42, 0.72), u_palette);
    vec3 fast = mix(vec3(0.5, 0.83, 0.88), vec3(0.15, 0.9, 1.0), u_palette);
    vec3 waterColor = mix(deep, mid, smoothstep(0.0, 0.45, sn));
    waterColor = mix(waterColor, fast, smoothstep(0.45, 1.0, sn));
    vec3 sky = mix(vec3(0.5, 0.66, 0.82), vec3(0.1, 0.3, 0.55), u_palette);
    vec3 L = normalize(czm_sunDirectionEC);
    vec3 H = normalize(L + viewDir);
    float ndh = max(dot(normalEC, H), 0.0);
    float spec = pow(ndh, 240.0) * 1.4 + pow(ndh, 36.0) * 0.12;
    vec3 color = mix(waterColor, sky, fresnel);
    color += vec3(1.0, 0.96, 0.82) * spec;
    float noise = texture2D(u_normalMap, v_uv * 2.3 + flowDir * phase0 * 0.25).a;
    float foamBand = smoothstep(0.22, 0.42, v_wet) * (1.0 - smoothstep(0.42, 0.8, v_wet));
    float foam = foamBand * smoothstep(0.35, 0.7, noise) * 1.1
               + smoothstep(0.72, 1.0, sn) * smoothstep(0.45, 0.85, noise) * 0.7;
    color = mix(color, vec3(0.93, 0.97, 1.0), clamp(foam, 0.0, 0.85));
    float alpha = (0.62 + fresnel * 0.28 + sn * 0.1) * smoothstep(0.22, 0.55, v_wet);
    gl_FragColor = vec4(color, clamp(alpha, 0.0, 0.94));
}
`

export class WaterSurfacePrimitive {
    /**
     * @param {import('./FlowFieldData').FlowFieldData} data
     * @param {[number, number]} centerLonLat RTC 中心
     */
    constructor(data, centerLonLat = [120.9, 30.3]) {
        this.data = data
        this.show = true
        this._t = 0
        this._exagg = 60
        this._palette = 0
        this._time0 = performance.now()
        this._center = SuperMap3D.Cartesian3.fromDegrees(centerLonLat[0], centerLonLat[1], 0)
        this._modelMatrix = SuperMap3D.Matrix4.fromTranslation(this._center, new SuperMap3D.Matrix4())
        this._pendingA = null
        this._pendingB = null
        this._destroyed = false
        this._command = null
    }

    setFrames(a, b) {
        this._pendingA = a
        this._pendingB = b
    }
    setT(t) {
        this._t = t
    }
    setExaggeration(e) {
        this._exagg = e
    }
    setPalette(p) {
        this._palette = p
    }

    _createResources(context) {
        const S = SuperMap3D
        const { data } = this
        const n = data.nNodes
        const positions = new Float32Array(n * 3)
        const lonlat = new Float32Array(n * 2)
        const cart = new S.Cartesian3()
        for (let i = 0; i < n; i++) {
            S.Cartesian3.fromDegrees(data.lon[i], data.lat[i], 0, undefined, cart)
            positions[i * 3] = cart.x - this._center.x
            positions[i * 3 + 1] = cart.y - this._center.y
            positions[i * 3 + 2] = cart.z - this._center.z
            lonlat[i * 2] = data.lon[i]
            lonlat[i * 2 + 1] = data.lat[i]
        }
        const mk = (arr, usage) =>
            S.Buffer.createVertexBuffer({ context, typedArray: arr, usage })
        this._posBuf = mk(positions, S.BufferUsage.STATIC_DRAW)
        this._lonlatBuf = mk(lonlat, S.BufferUsage.STATIC_DRAW)
        this._dataABuf = mk(new Float32Array(n * 4), S.BufferUsage.DYNAMIC_DRAW)
        this._dataBBuf = mk(new Float32Array(n * 4), S.BufferUsage.DYNAMIC_DRAW)
        this._indexBuf = S.Buffer.createIndexBuffer({
            context,
            typedArray: data.tri,
            usage: S.BufferUsage.STATIC_DRAW,
            indexDatatype: S.IndexDatatype.UNSIGNED_SHORT
        })
        const attributeLocations = { position: 0, lonlat: 1, dataA: 2, dataB: 3 }
        this._va = new S.VertexArray({
            context,
            indexBuffer: this._indexBuf,
            attributes: [
                { index: 0, vertexBuffer: this._posBuf, componentsPerAttribute: 3, componentDatatype: S.ComponentDatatype.FLOAT },
                { index: 1, vertexBuffer: this._lonlatBuf, componentsPerAttribute: 2, componentDatatype: S.ComponentDatatype.FLOAT },
                { index: 2, vertexBuffer: this._dataABuf, componentsPerAttribute: 4, componentDatatype: S.ComponentDatatype.FLOAT },
                { index: 3, vertexBuffer: this._dataBBuf, componentsPerAttribute: 4, componentDatatype: S.ComponentDatatype.FLOAT }
            ]
        })
        this._sp = S.ShaderProgram.fromCache({
            context,
            vertexShaderSource: VS,
            fragmentShaderSource: FS,
            attributeLocations
        })
        this._normalTexture = new S.Texture({
            context,
            source: generateWaterNormalCanvas(256),
            sampler: new S.Sampler({
                wrapS: S.TextureWrap.REPEAT,
                wrapT: S.TextureWrap.REPEAT,
                minificationFilter: S.TextureMinificationFilter.LINEAR_MIPMAP_LINEAR,
                magnificationFilter: S.TextureMagnificationFilter.LINEAR
            })
        })
        this._normalTexture.generateMipmap()
        this._rs = S.RenderState.fromCache({
            depthTest: { enabled: true },
            depthMask: false,
            cull: { enabled: false },
            blending: {
                enabled: true,
                equationRgb: 0x8006, // FUNC_ADD
                equationAlpha: 0x8006,
                functionSourceRgb: 0x0302, // SRC_ALPHA
                functionSourceAlpha: 1,
                functionDestinationRgb: 0x0303, // ONE_MINUS_SRC_ALPHA
                functionDestinationAlpha: 0x0303
            }
        })
        const self = this
        this._command = new S.DrawCommand({
            owner: this,
            vertexArray: this._va,
            shaderProgram: this._sp,
            renderState: this._rs,
            primitiveType: S.PrimitiveType.TRIANGLES,
            pass: S.Pass.TRANSLUCENT,
            modelMatrix: this._modelMatrix,
            boundingVolume: new S.BoundingSphere(this._center, 2.8e6),
            uniformMap: {
                u_t: () => self._t,
                u_exagg: () => self._exagg,
                u_time: () => (performance.now() - self._time0) / 1000,
                u_palette: () => self._palette,
                u_centerWorld: () => self._center,
                u_normalMap: () => self._normalTexture
            }
        })
    }

    update(frameState) {
        if (!this.show || this._destroyed) return
        if (!frameState.passes.render) return
        const context = frameState.context
        if (!this._command) this._createResources(context)
        if (this._pendingA) {
            this._dataABuf.copyFromArrayView(this._pendingA)
            this._dataBBuf.copyFromArrayView(this._pendingB)
            this._pendingA = this._pendingB = null
        }
        frameState.commandList.push(this._command)
    }

    isDestroyed() {
        return this._destroyed
    }

    destroy() {
        this._destroyed = true
        this._va = this._va && this._va.destroy()
        this._sp = undefined // fromCache 由缓存管理
        this._normalTexture = this._normalTexture && this._normalTexture.destroy()
        this._command = null
        return undefined
    }
}
