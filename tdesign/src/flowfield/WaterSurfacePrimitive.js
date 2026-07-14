/* global SuperMap3D */
/**
 * 数据驱动水面:静态网格几何 + 双帧顶点数据(level,u,v,wet)shader 插值。
 * 顶点级 Gerstner 三波(沿实际流向传播,幅随流速)+ 流向 flow-mapping 法线扰动、
 * 菲涅尔、太阳高光、干湿渐隐与泡沫;支持流速着色 / 水位云图两种模式。
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
varying float v_level;
varying vec2 v_uv;
varying vec3 v_normalEC;
varying vec3 v_posEC;
varying vec2 v_gerst; // Gerstner 大波坡度(east/north)
void main() {
    vec4 d = mix(dataA, dataB, u_t);
    v_flow = d.yz;
    v_wet = d.w;
    v_level = d.x;
    float spd = length(d.yz);
    v_spd = spd;
    vec3 up = normalize(u_centerWorld + position);
    vec3 east = normalize(cross(vec3(0.0, 0.0, 1.0), up));
    vec3 north = cross(up, east);
    vec2 fdir = spd > 0.01 ? d.yz / spd : vec2(1.0, 0.0);
    // 米制平面坐标(近似),供波相位使用
    vec2 posM = vec2(lonlat.x * 111320.0 * cos(radians(lonlat.y)), lonlat.y * 110540.0);
    // Gerstner 三波:沿流向 ±25° 展开,波长 620/360/210m,幅随流速与夸张系数
    float wetAmp = smoothstep(0.3, 0.8, d.w);
    float ampBase = (0.05 + min(spd, 2.5) * 0.16) * u_exagg * 0.3 * wetAmp;
    vec2 d1 = fdir;
    vec2 d2 = vec2(fdir.x * 0.906 - fdir.y * 0.423, fdir.x * 0.423 + fdir.y * 0.906);
    vec2 d3 = vec2(fdir.x * 0.906 + fdir.y * 0.423, -fdir.x * 0.423 + fdir.y * 0.906);
    float k1 = 6.2832 / 620.0;
    float k2 = 6.2832 / 360.0;
    float k3 = 6.2832 / 210.0;
    float a1 = ampBase;
    float a2 = ampBase * 0.55;
    float a3 = ampBase * 0.3;
    float p1 = dot(d1, posM) * k1 - u_time * sqrt(9.8 * k1) * 1.2;
    float p2 = dot(d2, posM) * k2 - u_time * sqrt(9.8 * k2) * 1.2;
    float p3 = dot(d3, posM) * k3 - u_time * sqrt(9.8 * k3) * 1.2;
    float eta = a1 * cos(p1) + a2 * cos(p2) + a3 * cos(p3);
    vec2 grad = d1 * (a1 * k1 * sin(p1)) + d2 * (a2 * k2 * sin(p2)) + d3 * (a3 * k3 * sin(p3));
    float Q = 0.55; // choppiness:水平位移让波峰更尖
    vec2 horiz = d1 * (a1 * Q * sin(p1)) + d2 * (a2 * Q * sin(p2)) + d3 * (a3 * Q * sin(p3));
    float h = d.x * u_exagg + eta;
    vec3 pos = position + up * h + east * horiz.x + north * horiz.y;
    v_gerst = grad;
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
varying float v_level;
varying vec2 v_uv;
varying vec3 v_normalEC;
varying vec3 v_posEC;
varying vec2 v_gerst;
uniform sampler2D u_normalMap;
uniform float u_time;
uniform float u_palette;
uniform float u_colorMode;  // 0=流速着色 1=水位云图
uniform vec2 u_levelRange;  // [min, max] m
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
    nTS.xy += v_gerst * 1.6; // Gerstner 大波坡度并入法线
    nTS = normalize(nTS + vec3(0.0, 0.0, 2.6 / (0.35 + spd)));
    vec3 N = normalize(v_normalEC);
    vec3 T = normalize(cross(vec3(0.0, 0.0, 1.0), N) + vec3(1e-3));
    vec3 B = cross(N, T);
    vec3 normalEC = normalize(T * nTS.x + B * nTS.y + N * nTS.z);
    vec3 viewDir = normalize(-v_posEC);
    float fresnel = pow(1.0 - max(dot(viewDir, normalEC), 0.0), 3.0);
    fresnel = mix(0.06, 0.9, fresnel);
    float sn = clamp(spd / 2.5, 0.0, 1.0);
    vec3 waterColor;
    if (u_colorMode > 0.5) {
        // 水位云图:蓝→青→绿→黄→红
        float tL = clamp((v_level - u_levelRange.x) / max(u_levelRange.y - u_levelRange.x, 0.01), 0.0, 1.0);
        vec3 c1 = vec3(0.06, 0.21, 0.67);
        vec3 c2 = vec3(0.0, 0.78, 1.0);
        vec3 c3 = vec3(0.49, 1.0, 0.69);
        vec3 c4 = vec3(1.0, 0.91, 0.36);
        vec3 c5 = vec3(1.0, 0.36, 0.24);
        waterColor = mix(c1, c2, smoothstep(0.0, 0.25, tL));
        waterColor = mix(waterColor, c3, smoothstep(0.25, 0.5, tL));
        waterColor = mix(waterColor, c4, smoothstep(0.5, 0.75, tL));
        waterColor = mix(waterColor, c5, smoothstep(0.75, 1.0, tL));
    } else {
        vec3 deep = mix(vec3(0.015, 0.09, 0.18), vec3(0.0, 0.06, 0.22), u_palette);
        vec3 mid  = mix(vec3(0.05, 0.32, 0.42), vec3(0.0, 0.42, 0.72), u_palette);
        vec3 fast = mix(vec3(0.5, 0.83, 0.88), vec3(0.15, 0.9, 1.0), u_palette);
        waterColor = mix(deep, mid, smoothstep(0.0, 0.45, sn));
        waterColor = mix(waterColor, fast, smoothstep(0.45, 1.0, sn));
    }
    vec3 sky = mix(vec3(0.5, 0.66, 0.82), vec3(0.1, 0.3, 0.55), u_palette);
    vec3 L = normalize(czm_sunDirectionEC);
    vec3 H = normalize(L + viewDir);
    float ndh = max(dot(normalEC, H), 0.0);
    float spec = pow(ndh, 240.0) * 1.4 + pow(ndh, 36.0) * 0.12;
    // 云图模式弱化反射与高光,保证色彩可读
    float skyMix = fresnel * (u_colorMode > 0.5 ? 0.3 : 1.0);
    float specMix = u_colorMode > 0.5 ? 0.35 : 1.0;
    vec3 color = mix(waterColor, sky, skyMix);
    color += vec3(1.0, 0.96, 0.82) * spec * specMix;
    float noise = texture2D(u_normalMap, v_uv * 2.3 + flowDir * phase0 * 0.25).a;
    float foamBand = smoothstep(0.22, 0.42, v_wet) * (1.0 - smoothstep(0.42, 0.8, v_wet));
    float foam = foamBand * smoothstep(0.35, 0.7, noise) * 1.1
               + smoothstep(0.72, 1.0, sn) * smoothstep(0.45, 0.85, noise) * 0.7;
    color = mix(color, vec3(0.93, 0.97, 1.0), clamp(foam, 0.0, 0.85));
    float alpha = u_colorMode > 0.5
        ? 0.82 + sn * 0.05
        : 0.62 + fresnel * 0.28 + sn * 0.1;
    alpha *= smoothstep(0.22, 0.55, v_wet);
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
        this._colorMode = 0
        const st = (data.meta && data.meta.stats) || {}
        this._levelRange = new SuperMap3D.Cartesian2(
            st.levelMin !== undefined ? st.levelMin : -3.5,
            st.levelMax !== undefined ? st.levelMax : 6.5
        )
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
    /** 0=流速着色 1=水位云图 */
    setColorMode(m) {
        this._colorMode = m
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
        const mk = (arr, usage) => S.Buffer.createVertexBuffer({ context, typedArray: arr, usage })
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
                u_colorMode: () => self._colorMode,
                u_levelRange: () => self._levelRange,
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
