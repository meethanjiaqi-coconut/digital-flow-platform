/* global SuperMap3D */
/**
 * 数据驱动水面:静态网格几何 + 双帧顶点数据(level,u,v,wet)shader 插值。
 * 顶点级 Gerstner 三波(沿实际流向传播,幅随流速)+ 多尺度 flow-mapping 法线扰动、
 * 菲涅尔、太阳高光、浅水焦散、干湿渐隐与方向性泡沫;支持流速着色 / 水位云图两种模式。
 * 以自定义 DrawCommand 实现(SuperMap3D 暴露 Cesium 渲染内部类)。
 */
import { generateWaterNormalCanvas } from './waterNormalTexture'

const VS = /* glsl */ `
attribute vec3 position;
attribute vec2 lonlat;
attribute vec4 dataA;
attribute vec4 dataB;
attribute float zb;
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
varying float v_depth; // 真实水深 m
varying float v_crest; // 波峰归一 [-1,1]
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
    v_depth = max(d.x - zb, 0.0);
    v_crest = eta / (a1 + a2 + a3 + 1e-4);
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
varying float v_depth;
varying float v_crest;
uniform sampler2D u_normalMap;
uniform sampler2D u_detailNormalMap;
uniform float u_speedMax;
uniform float u_time;
uniform float u_palette;
uniform float u_colorMode;  // 0=流速着色 1=水位云图
uniform vec2 u_levelRange;  // [min, max] m

float causticPattern(vec2 uv, float time) {
    // 三组移动波纹形成浅水焦散，不增加额外渲染通道。
    vec2 p = uv * 2.4;
    float a = sin(p.x * 6.283 + sin(p.y * 4.7 - time * 0.75) + time * 0.55);
    float b = sin(p.y * 7.1 + sin(p.x * 3.9 + time * 0.62) - time * 0.48);
    float c = sin((p.x + p.y) * 4.6 - time * 0.83);
    float ridge = 1.0 - abs((a + b + c) / 3.0);
    return pow(clamp(ridge, 0.0, 1.0), 5.0);
}

void main() {
    if (v_wet < 0.22) discard;
    float spd = v_spd;
    vec2 flowDir = spd > 0.001 ? normalize(v_flow) : vec2(1.0, 0.0);
    vec2 flowSide = vec2(-flowDir.y, flowDir.x);
    float cycle = u_time * (0.055 + min(spd, 3.0) * 0.045);
    float phase0 = fract(cycle);
    float phase1 = fract(cycle + 0.5);
    vec2 drift = flowDir * 0.62;
    // 大中小三层法线：两层随真实流向平流，一层横向打散规则纹理。
    vec3 n1 = texture2D(u_detailNormalMap, v_uv * 0.72 - drift * phase0).xyz * 2.0 - 1.0;
    vec3 n2 = texture2D(u_detailNormalMap, v_uv * 1.47 + vec2(0.31, 0.17) - drift * phase1).xyz * 2.0 - 1.0;
    float blendPh = abs(phase0 * 2.0 - 1.0);
    vec3 n3 = texture2D(
        u_normalMap,
        v_uv * 3.2 + flowSide * 0.19 - flowDir * u_time * (0.025 + spd * 0.012)
    ).xyz * 2.0 - 1.0;
    vec3 nTS = normalize(mix(n1, n2, blendPh) + n3 * 0.28);
    nTS.xy += v_gerst * 1.6; // Gerstner 大波坡度并入法线
    // 远景衰减法线扰动:抑制高光闪烁与贴图平铺感
    float normFade = clamp(1.0 - (length(v_posEC) - 30000.0) / 250000.0, 0.15, 1.0);
    nTS.xy *= normFade;
    nTS = normalize(nTS + vec3(0.0, 0.0, 2.6 / (0.35 + spd)));
    vec3 N = normalize(v_normalEC);
    vec3 T = normalize(cross(vec3(0.0, 0.0, 1.0), N) + vec3(1e-3));
    vec3 B = cross(N, T);
    vec3 normalEC = normalize(T * nTS.x + B * nTS.y + N * nTS.z);
    vec3 viewDir = normalize(-v_posEC);
    float noV = max(dot(viewDir, normalEC), 0.0);
    // Schlick 菲涅尔，正视水面保持透明，掠射角强化天空反射。
    float fresnel = 0.025 + 0.72 * pow(1.0 - noV, 5.0);
    float sn = clamp(spd / u_speedMax, 0.0, 1.0);
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
        vec3 deep = mix(vec3(0.012, 0.075, 0.14), vec3(0.0, 0.045, 0.18), u_palette);
        vec3 mid  = mix(vec3(0.035, 0.29, 0.36), vec3(0.0, 0.36, 0.68), u_palette);
        vec3 fast = mix(vec3(0.42, 0.78, 0.78), vec3(0.1, 0.82, 1.0), u_palette);
        waterColor = mix(deep, mid, smoothstep(0.0, 0.45, sn));
        waterColor = mix(waterColor, fast, smoothstep(0.45, 1.0, sn));
        // 指数吸收近似：潮滩浅水透亮，深槽逐步吸收红绿光。
        vec3 shallowCol = mix(vec3(0.2, 0.43, 0.36), vec3(0.07, 0.43, 0.52), u_palette);
        float depthAbsorption = 1.0 - exp(-max(v_depth, 0.0) * 0.11);
        waterColor = mix(shallowCol, waterColor * 0.84, depthAbsorption);
    }
    float horizon = pow(1.0 - noV, 2.0);
    vec3 skyZenith = mix(vec3(0.08, 0.2, 0.34), vec3(0.035, 0.16, 0.38), u_palette);
    vec3 skyHorizon = mix(vec3(0.58, 0.69, 0.75), vec3(0.2, 0.52, 0.76), u_palette);
    vec3 sky = mix(skyZenith, skyHorizon, horizon);
    vec3 L = normalize(czm_sunDirectionEC);
    vec3 H = normalize(L + viewDir);
    float ndh = max(dot(normalEC, H), 0.0);
    float glintNoise = texture2D(u_normalMap, v_uv * 4.8 - flowDir * u_time * 0.04).a;
    float sunFacing = max(dot(normalEC, L), 0.0);
    float spec = (
        pow(ndh, 260.0) * mix(0.45, 1.35, glintNoise) +
        pow(ndh, 42.0) * 0.12
    ) * mix(0.25, 1.0, normFade) * smoothstep(0.0, 0.18, sunFacing);
    // 云图模式弱化反射与高光,保证色彩可读
    float skyMix = fresnel * (u_colorMode > 0.5 ? 0.3 : 1.0);
    float specMix = u_colorMode > 0.5 ? 0.35 : 1.0;
    vec3 color = mix(waterColor, sky, skyMix);
    color += vec3(1.0, 0.96, 0.82) * spec * specMix;
    // 浅水焦散只调制自然水色；水位云图保持数值可读性。
    float causticMask = (1.0 - smoothstep(0.25, 7.0, v_depth)) * (1.0 - fresnel);
    float caustic = causticPattern(v_uv * 1.7 + flowDir * u_time * 0.018, u_time);
    color += mix(vec3(0.18, 0.27, 0.18), vec3(0.05, 0.3, 0.34), u_palette)
        * caustic * causticMask * (u_colorMode > 0.5 ? 0.04 : 0.32);

    // 将噪声坐标旋转到真实流向，形成随 U/V 运动的条带白浪。
    vec2 flowUv = vec2(dot(v_uv, flowDir), dot(v_uv, flowSide));
    float noise = texture2D(
        u_normalMap,
        flowUv * vec2(0.82, 3.4) - vec2(u_time * (0.035 + spd * 0.025), 0.0)
    ).a;
    float detailNoise = texture2D(u_normalMap, v_uv * 5.1 + flowSide * u_time * 0.012).a;
    float foamBand = smoothstep(0.22, 0.42, v_wet) * (1.0 - smoothstep(0.42, 0.8, v_wet));
    float shoreline = (1.0 - smoothstep(0.12, 1.6, v_depth)) * smoothstep(0.3, 0.72, v_wet);
    float shoreFoam = max(foamBand, shoreline * 0.72) * smoothstep(0.4, 0.76, noise) * (0.65 + detailNoise * 0.45);
    float shearFoam = smoothstep(0.65, 2.7, spd) * smoothstep(0.56, 0.82, noise) * 0.38;
    float crestFoam = smoothstep(0.5, 0.96, v_crest) * smoothstep(0.75, 2.1, spd)
        * smoothstep(0.42, 0.72, detailNoise) * 0.62;
    float foam = (shoreFoam + shearFoam + crestFoam) * (u_colorMode > 0.5 ? 0.28 : 1.0);
    vec3 foamColor = mix(vec3(0.88, 0.95, 0.94), vec3(0.78, 0.94, 1.0), u_palette);
    color = mix(color, foamColor, clamp(foam, 0.0, 0.88));
    float alpha = u_colorMode > 0.5
        ? 0.82 + sn * 0.05
        : (0.56 + fresnel * 0.34 + sn * 0.08) * mix(0.67, 1.0, smoothstep(0.0, 9.0, v_depth));
    alpha = max(alpha, foam * 0.86);
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
        this._levelRange = new SuperMap3D.Cartesian2(st.levelMin !== undefined ? st.levelMin : -3.5, st.levelMax !== undefined ? st.levelMax : 6.5)
        this._speedMax = st.speedMax || 2.5
        this._time0 = performance.now()
        this._center = SuperMap3D.Cartesian3.fromDegrees(centerLonLat[0], centerLonLat[1], 0)
        this._modelMatrix = SuperMap3D.Matrix4.fromTranslation(this._center, new SuperMap3D.Matrix4())
        this._pendingA = null
        this._pendingB = null
        this._destroyed = false
        this._command = null
        this._detailNormalImage = null
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
        this._zbBuf = mk(data.zb, S.BufferUsage.STATIC_DRAW)
        this._indexBuf = S.Buffer.createIndexBuffer({
            context,
            typedArray: data.tri,
            usage: S.BufferUsage.STATIC_DRAW,
            indexDatatype: S.IndexDatatype.UNSIGNED_SHORT
        })
        const attributeLocations = { position: 0, lonlat: 1, dataA: 2, dataB: 3, zb: 4 }
        this._va = new S.VertexArray({
            context,
            indexBuffer: this._indexBuf,
            attributes: [
                { index: 0, vertexBuffer: this._posBuf, componentsPerAttribute: 3, componentDatatype: S.ComponentDatatype.FLOAT },
                { index: 1, vertexBuffer: this._lonlatBuf, componentsPerAttribute: 2, componentDatatype: S.ComponentDatatype.FLOAT },
                { index: 2, vertexBuffer: this._dataABuf, componentsPerAttribute: 4, componentDatatype: S.ComponentDatatype.FLOAT },
                { index: 3, vertexBuffer: this._dataBBuf, componentsPerAttribute: 4, componentDatatype: S.ComponentDatatype.FLOAT },
                { index: 4, vertexBuffer: this._zbBuf, componentsPerAttribute: 1, componentDatatype: S.ComponentDatatype.FLOAT }
            ]
        })
        this._sp = S.ShaderProgram.fromCache({
            context,
            vertexShaderSource: VS,
            fragmentShaderSource: FS,
            attributeLocations
        })
        const waterSampler = new S.Sampler({
            wrapS: S.TextureWrap.REPEAT,
            wrapT: S.TextureWrap.REPEAT,
            minificationFilter: S.TextureMinificationFilter.LINEAR_MIPMAP_LINEAR,
            magnificationFilter: S.TextureMagnificationFilter.LINEAR
        })
        this._normalTexture = new S.Texture({
            context,
            source: generateWaterNormalCanvas(256),
            sampler: waterSampler
        })
        this._normalTexture.generateMipmap()
        // 先使用程序纹理保证首帧立即可渲染，再异步换成 SuperMap 游戏水面同源细节法线。
        this._detailNormalTexture = null
        this._loadDetailNormalTexture(context, waterSampler)
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
                u_speedMax: () => self._speedMax,
                u_centerWorld: () => self._center,
                u_normalMap: () => self._normalTexture,
                u_detailNormalMap: () => self._detailNormalTexture || self._normalTexture
            }
        })
    }

    _loadDetailNormalTexture(context, sampler) {
        const image = new Image()
        this._detailNormalImage = image
        image.decoding = 'async'
        image.onload = () => {
            if (this._destroyed || this._detailNormalImage !== image) return
            try {
                const texture = new SuperMap3D.Texture({ context, source: image, sampler })
                texture.generateMipmap()
                if (this._destroyed) {
                    texture.destroy()
                    return
                }
                this._detailNormalTexture = texture
                this._detailNormalImage = null
                image.onload = null
                image.onerror = null
            } catch (error) {
                // 纹理加载失败时继续使用程序生成的法线，不影响流场主体渲染。
                this._detailNormalImage = null
                console.warn('[WaterSurfacePrimitive] 水面细节纹理初始化失败，已使用程序纹理回退:', error)
            }
        }
        image.onerror = () => {
            this._detailNormalImage = null
            if (!this._destroyed) console.warn('[WaterSurfacePrimitive] 水面细节纹理加载失败，已使用程序纹理回退')
        }
        image.src = `${import.meta.env.BASE_URL}libs/SuperMap3D/Assets/Textures/waterNormalsSmall.jpg`
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
        if (this._detailNormalImage) {
            this._detailNormalImage.onload = null
            this._detailNormalImage.onerror = null
            this._detailNormalImage = null
        }
        this._va = this._va && this._va.destroy()
        this._sp = undefined // fromCache 由缓存管理
        this._normalTexture = this._normalTexture && this._normalTexture.destroy()
        this._detailNormalTexture = this._detailNormalTexture && this._detailNormalTexture.destroy()
        this._command = null
        return undefined
    }
}
