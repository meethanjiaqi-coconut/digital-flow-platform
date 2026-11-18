import { DEFAULT_FLOW_STRENGTH, normalizeFlowStrength } from './flowDynamics.js'
// Particle baseline from .tmp/water-completion/ParticleFlowLayer.js, including
// viewport-relative advection. Later full backups already used a slower,
// world-space water scale and do not preserve the original convergence effect.
// 1.5 seconds is the rounded time for 0.95 retention at 60 FPS to fade to 1%.
export const DEFAULT_PARTICLE_SETTINGS = Object.freeze({
    dimension: 128,
    width: 1.0,
    opacity: 0.65,
    trailSeconds: 1.5,
    fadeAt60Fps: 0.95,
    speedFractionPerSecond: 0.045
})
export const DEFAULT_PARTICLE_TRAIL_SECONDS = DEFAULT_PARTICLE_SETTINGS.trailSeconds
export const MAX_PARTICLE_TRAIL_SECONDS = 3

export function normalizeParticleTrail(value) {
    const seconds = Number(value)
    return Number.isFinite(seconds) ? Math.max(0, Math.min(MAX_PARTICLE_TRAIL_SECONDS, seconds)) : DEFAULT_PARTICLE_TRAIL_SECONDS
}

export function particleTrailFade(seconds, dt) {
    return seconds > 0 ? Math.pow(DEFAULT_PARTICLE_SETTINGS.fadeAt60Fps, Math.max(0, dt) * 60 * DEFAULT_PARTICLE_TRAIL_SECONDS / seconds) : 0
}

export function particleSpeedScale(longitudeSpan, strength = DEFAULT_FLOW_STRENGTH) {
    if (!Number.isFinite(longitudeSpan) || longitudeSpan <= 0) return 0
    // Restore the original screen-relative motion: at the default gain a 1 m/s
    // meridional flow travels 4.5% of the longitude span per animation second.
    // Only presentation is scaled; the sampled U/V values and colours are intact.
    return longitudeSpan * DEFAULT_PARTICLE_SETTINGS.speedFractionPerSecond * normalizeFlowStrength(strength) / DEFAULT_FLOW_STRENGTH
}
/* global SuperMap3D, WebGL2RenderingContext */
/**
 * Windy 风格 GPU 粒子流场层。
 * 每帧四段:①网格→视野流场纹理(r=u,g=v,b=wet,a=level) ②位置纹理 ping-pong 平流
 * ③拖尾纹理衰减+画粒子条带 ④合成到场景(OVERLAY 命令)。
 * ①②③ 在 update() 内直接 execute(离屏),④ 推入 commandList。
 * 粒子以屏幕空间四边形条带绘制(可控线宽、软边、头亮尾暗),重生点在湿区内拒绝采样。
 */

const QUAD_VS = `
attribute vec2 position;
varying vec2 v_st;
void main() { v_st = position * 0.5 + 0.5; gl_Position = vec4(position, 0.0, 1.0); }
`

const FIELD_VS = `
attribute vec2 lonlat;
attribute vec4 dataA;
attribute vec4 dataB;
uniform float u_t;
uniform vec4 u_bbox; // xmin, ymin, xspan, yspan
varying vec4 v_data;
void main() {
    v_data = mix(dataA, dataB, u_t);
    vec2 ndc = ((lonlat - u_bbox.xy) / u_bbox.zw) * 2.0 - 1.0;
    gl_Position = vec4(ndc, 0.0, 1.0);
}
`
const FIELD_FS = `
varying vec4 v_data;
void main() { gl_FragColor = vec4(v_data.y, v_data.z, v_data.w, v_data.x); }
`

const UPDATE_FS = `
uniform sampler2D u_particles;
uniform sampler2D u_field;
uniform vec4 u_bbox;
uniform float u_dt;
uniform float u_speedScale; // deg per (m/s) per second
uniform float u_frame;
uniform bool u_reseed;
varying vec2 v_st;
float rand(float x) { return fract(sin(x * 12.9898) * 43758.5453); }
void main() {
    vec4 p = texture2D(u_particles, v_st);
    vec2 lonlat = p.xy;
    float age = p.z;
    float seed = p.w;
    vec2 fuv = (lonlat - u_bbox.xy) / u_bbox.zw;
    vec4 f = texture2D(u_field, fuv);
    bool outside = fuv.x < 0.0 || fuv.x > 1.0 || fuv.y < 0.0 || fuv.y > 1.0;
    float maxAge = 4.0 + fract(seed * 7.31) * 6.0;
    if (u_reseed || outside || age > maxAge || f.b < 0.35) {
        // Camera redistribution must fill the new wet area even while paused.
        // Use more attempts for this one-off pass; normal births stay cheap.
        vec2 spawn = lonlat;
        float got = 0.0;
        for (int i = 0; i < 24; i++) {
            if (!u_reseed && i >= 4) break;
            float fi = float(i);
            vec2 cand = u_bbox.xy + vec2(
                rand(seed + u_frame * 0.0131 + v_st.x + fi * 0.317),
                rand(seed * 1.71 + u_frame * 0.0177 + v_st.y + fi * 0.731)
            ) * u_bbox.zw;
            float wet = texture2D(u_field, (cand - u_bbox.xy) / u_bbox.zw).b;
            if (got < 0.5) {
                spawn = cand;
                if (wet > 0.45) got = 1.0;
            }
        }
        lonlat = spawn;
        age = got > 0.5 ? 0.02 + (u_reseed ? rand(seed + v_st.y) * 3.0 : 0.0) : 0.0;
        seed = fract(seed + 0.61803398875);
    } else {
        float coslat = max(cos(radians(lonlat.y)), 0.2);
        lonlat += vec2(f.r / coslat, f.g) * u_speedScale * u_dt;
        age += u_dt;
    }
    gl_FragColor = vec4(lonlat, age, seed);
}
`

const FADE_FS = `
uniform sampler2D u_trail;
uniform float u_fade;
uniform float u_fadePhase;
varying vec2 v_st;
void main() {
    vec4 c = texture2D(u_trail, v_st) * u_fade;
    // Unbiased rounding keeps low RGBA8 values from rounding back to the same
    // byte forever. The sub-byte dither changes only on animation steps.
    float dither = fract(52.9829189 * fract(dot(gl_FragCoord.xy + u_fadePhase * vec2(17.0, 23.0), vec2(0.06711056, 0.00583715))));
    c = floor(c * 255.0 + dither) / 255.0;
    gl_FragColor = vec4(c.rgb, c.a) * step(0.012, max(max(c.r, c.g), c.b));
}
`

// 粒子条带:每粒子 4 顶点(尾左/尾右/头左/头右),屏幕空间展宽
const RIBBON_VS = `
attribute vec2 ref;      // 粒子纹理坐标
attribute float endFlag; // 0=尾 1=头
attribute float side;    // -1 / +1
uniform sampler2D u_curr;
uniform sampler2D u_prev;
uniform sampler2D u_field;
uniform vec4 u_bbox;
uniform float u_exagg;
uniform vec2 u_viewport;
uniform float u_width;   // 头部半宽(像素)
uniform bool u_preview;
uniform float u_previewSeconds;
uniform float u_speedScale;
uniform mat4 u_vp;       // 显式传入当前相机 投影×视图(手动 execute 时 czm_* 不可靠)
uniform vec3 u_camPos;   // 相机世界坐标(地平线剔除)
varying float v_speed;
varying float v_end;
varying float v_side;
varying float v_lifeOpacity;
varying vec2 v_fieldUV;
const float A = 6378137.0;
const float E2 = 0.00669437999014;
vec3 toEcef(vec2 ll, float h) {
    float lam = radians(ll.x);
    float phi = radians(ll.y);
    float sp = sin(phi), cp = cos(phi);
    float N = A / sqrt(1.0 - E2 * sp * sp);
    return vec3((N + h) * cp * cos(lam), (N + h) * cp * sin(lam), (N * (1.0 - E2) + h) * sp);
}
void main() {
    vec4 head = texture2D(u_curr, ref);
    vec4 tail = texture2D(u_prev, ref);
    vec2 fuv = (head.xy - u_bbox.xy) / u_bbox.zw;
    vec4 f = texture2D(u_field, fuv);
    v_speed = length(f.rg);
    v_end = endFlag;
    v_side = side;
    // Seed changes on every birth. A distance threshold both joined nearby
    // respawns into flashing streaks and rejected fast, valid motion on a slow
    // frame. Never connect two different lives, regardless of their distance.
    bool reborn = abs(head.w - tail.w) > 0.00001;
    bool outside = any(lessThan(fuv, vec2(0.0))) || any(greaterThan(fuv, vec2(1.0)));
    if ((!u_preview && reborn) || outside || f.b < 0.35 || head.z < 0.016) {
        gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
        return;
    }
    float maxAge = 4.0 + fract(head.w * 7.31) * 6.0;
    v_lifeOpacity = smoothstep(0.02, 0.18, head.z) * (1.0 - smoothstep(maxAge - 0.35, maxAge, head.z));
    // A paused redraw previews the selected length from the current velocity;
    // particle positions and the model/animation clocks remain frozen.
    if (u_preview) {
        vec2 offset = vec2(f.r / max(cos(radians(head.y)), 0.2), f.g) * u_speedScale * u_previewSeconds;
        float extent = max(length(offset / u_bbox.zw), 0.000001);
        tail.xy = head.xy - offset * min(1.0, 0.03 / extent);
    }
    v_fieldUV = ((endFlag > 0.5 ? head.xy : tail.xy) - u_bbox.xy) / u_bbox.zw;
    float h = f.a * u_exagg + 12.0;
    vec3 posH = toEcef(head.xy, h);
    // 椭球地平线剔除:域转到地球背面时不再穿透显示
    // Scale by all three ellipsoid radii. Treating Earth as a sphere with its
    // equatorial radius incorrectly puts low-altitude cameras inside it here.
    vec3 radii = vec3(A, A, A * sqrt(1.0 - E2));
    vec3 cv = u_camPos / radii;
    vec3 tv = posH / radii - cv;
    float vhMag2 = dot(cv, cv) - 1.0;
    float dd = dot(-cv, tv);
    if (dd > vhMag2 && dd * dd / dot(tv, tv) > vhMag2) {
        gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
        return;
    }
    vec4 clipH = u_vp * vec4(posH, 1.0);
    vec4 clipT = u_vp * vec4(toEcef(tail.xy, h), 1.0);
    vec2 sH = clipH.xy / max(clipH.w, 1e-6) * u_viewport;
    vec2 sT = clipT.xy / max(clipT.w, 1e-6) * u_viewport;
    vec2 dir = sH - sT;
    float len = length(dir);
    dir = len > 0.01 ? dir / len : vec2(1.0, 0.0);
    vec2 nrm = vec2(-dir.y, dir.x);
    vec4 clip = endFlag > 0.5 ? clipH : clipT;
    float wpx = u_width * mix(0.5, 1.0, endFlag); // 尾窄头宽
    clip.xy += nrm * side * (wpx * 2.0 / u_viewport) * clip.w;
    if (endFlag > 0.5) clip.xy += dir * (wpx * 1.2 / u_viewport) * clip.w; // 圆头外延
    gl_Position = clip;
}
`
const RIBBON_FS = `
uniform sampler2D u_ramp;
uniform float u_speedMax;
uniform sampler2D u_field;
varying float v_speed;
varying float v_end;
varying float v_side;
varying float v_lifeOpacity;
varying vec2 v_fieldUV;
void main() {
    if (any(lessThan(v_fieldUV, vec2(0.0))) || any(greaterThan(v_fieldUV, vec2(1.0))) || texture2D(u_field, v_fieldUV).b < 0.35) discard;
    vec3 c = texture2D(u_ramp, vec2(clamp(v_speed / u_speedMax, 0.02, 0.98), 0.5)).rgb;
    float edge = 1.0 - abs(v_side);
    float a = smoothstep(0.0, 0.55, edge) * mix(0.4, 1.0, v_end) * v_lifeOpacity;
    gl_FragColor = vec4(c * a, a);
}
`

const COMPOSITE_FS = `
uniform sampler2D u_trail;
uniform float u_opacity;
varying vec2 v_st;
void main() {
    vec4 c = texture2D(u_trail, v_st);
    gl_FragColor = vec4(c.rgb * u_opacity, 0.0);
}
`

function rampCanvas() {
    const c = document.createElement('canvas')
    c.width = 256
    c.height = 1
    const ctx = c.getContext('2d')
    const g = ctx.createLinearGradient(0, 0, 256, 0)
    g.addColorStop(0.0, '#137e88')
    g.addColorStop(0.25, '#18a7a1')
    g.addColorStop(0.5, '#63b790')
    g.addColorStop(0.75, '#b9bf64')
    g.addColorStop(1.0, '#dbc34d')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 256, 1)
    return c
}

const ADD_BLEND = {
    enabled: true,
    equationRgb: 0x8006,
    equationAlpha: 0x8006,
    functionSourceRgb: 1, // ONE
    functionSourceAlpha: 1,
    functionDestinationRgb: 1,
    functionDestinationAlpha: 1
}

export class ParticleFlowLayer {
    constructor(data, viewer) {
        this.data = data
        this.viewer = viewer
        this.show = true
        this._t = 0
        this._exagg = 60
        this._dim = DEFAULT_PARTICLE_SETTINGS.dimension
        this._fieldW = 2048
        this._fieldH = 1024
        this._trailSeconds = DEFAULT_PARTICLE_TRAIL_SECONDS
        this._opacity = DEFAULT_PARTICLE_SETTINGS.opacity
        this._width = DEFAULT_PARTICLE_SETTINGS.width // 条带头部半宽(像素)
        this._speedMax = (data.meta && data.meta.stats && data.meta.stats.speedMax) || 2.5
        this._pendingA = null
        this._pendingB = null
        this._bbox = null // [xmin,ymin,xspan,yspan]
        this._frame = 0
        this._animationTime = 0
        this._flowStrength = DEFAULT_FLOW_STRENGTH
        this._renderedAnimationTime = 0
        this._renderDirty = true
        this._fieldDirty = true
        this._destroyed = false
        this._ready = false
    }

    setFrames(a, b) {
        this._pendingA = a
        this._pendingB = b
    }
    setT(t) {
        if (this._t !== t) {
            this._renderDirty = true
            this._fieldDirty = true
        }
        this._t = t
    }
    setFlowStrength(value) {
        this._flowStrength = normalizeFlowStrength(value)
        return this._flowStrength
    }

    setAnimationTime(seconds) {
        this._animationTime = seconds
    }
    setExaggeration(e) {
        this._exagg = e
        this._renderDirty = true
    }
    setCount(dim) {
        this._dim = dim
        this._rebuildParticles = true
        this._clearTrails = true
        this._renderDirty = true
    }
    setWidth(px) {
        this._width = px
        this._clearTrails = true
        this._renderDirty = true
    }
    get trailDuration() {
        return this._trailSeconds
    }
    setTrailDuration(seconds) {
        this._trailSeconds = normalizeParticleTrail(seconds)
        this._clearTrails = true
        this._renderDirty = true
        this.viewer.scene.requestRender?.()
        return this._trailSeconds
    }

    resetStyle() {
        this.setCount(DEFAULT_PARTICLE_SETTINGS.dimension)
        this.setWidth(DEFAULT_PARTICLE_SETTINGS.width)
        this._opacity = DEFAULT_PARTICLE_SETTINGS.opacity
        this.setTrailDuration(DEFAULT_PARTICLE_TRAIL_SECONDS)
    }

    // ---------------------------------------------------------- resources
    _createStatic(context) {
        const S = SuperMap3D
        const { data } = this
        const n = data.nNodes
        const lonlat = new Float32Array(n * 2)
        for (let i = 0; i < n; i++) {
            lonlat[i * 2] = data.lon[i]
            lonlat[i * 2 + 1] = data.lat[i]
        }
        this._lonlatBuf = S.Buffer.createVertexBuffer({ context, typedArray: lonlat, usage: S.BufferUsage.STATIC_DRAW })
        this._dataABuf = S.Buffer.createVertexBuffer({ context, typedArray: new Float32Array(n * 4), usage: S.BufferUsage.DYNAMIC_DRAW })
        this._dataBBuf = S.Buffer.createVertexBuffer({ context, typedArray: new Float32Array(n * 4), usage: S.BufferUsage.DYNAMIC_DRAW })
        this._meshIndexBuf = S.Buffer.createIndexBuffer({
            context,
            typedArray: data.tri,
            usage: S.BufferUsage.STATIC_DRAW,
            indexDatatype: S.IndexDatatype.UNSIGNED_SHORT
        })
        this._fieldVA = new S.VertexArray({
            context,
            indexBuffer: this._meshIndexBuf,
            attributes: [
                { index: 0, vertexBuffer: this._lonlatBuf, componentsPerAttribute: 2, componentDatatype: S.ComponentDatatype.FLOAT },
                { index: 1, vertexBuffer: this._dataABuf, componentsPerAttribute: 4, componentDatatype: S.ComponentDatatype.FLOAT },
                { index: 2, vertexBuffer: this._dataBBuf, componentsPerAttribute: 4, componentDatatype: S.ComponentDatatype.FLOAT }
            ]
        })
        this._fieldSP = S.ShaderProgram.fromCache({
            context,
            vertexShaderSource: FIELD_VS,
            fragmentShaderSource: FIELD_FS,
            attributeLocations: { lonlat: 0, dataA: 1, dataB: 2 }
        })

        const quad = new Float32Array([-1, -1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1])
        this._quadBuf = S.Buffer.createVertexBuffer({ context, typedArray: quad, usage: S.BufferUsage.STATIC_DRAW })
        this._quadVA = new S.VertexArray({
            context,
            attributes: [{ index: 0, vertexBuffer: this._quadBuf, componentsPerAttribute: 2, componentDatatype: S.ComponentDatatype.FLOAT }]
        })
        this._updateSP = S.ShaderProgram.fromCache({
            context,
            vertexShaderSource: QUAD_VS,
            fragmentShaderSource: UPDATE_FS,
            attributeLocations: { position: 0 }
        })
        this._fadeSP = S.ShaderProgram.fromCache({
            context,
            vertexShaderSource: QUAD_VS,
            fragmentShaderSource: FADE_FS,
            attributeLocations: { position: 0 }
        })
        this._ribbonSP = S.ShaderProgram.fromCache({
            context,
            vertexShaderSource: RIBBON_VS,
            fragmentShaderSource: RIBBON_FS,
            attributeLocations: { ref: 0, endFlag: 1, side: 2 }
        })
        this._compositeSP = S.ShaderProgram.fromCache({
            context,
            vertexShaderSource: QUAD_VS,
            fragmentShaderSource: COMPOSITE_FS,
            attributeLocations: { position: 0 }
        })
        this._rampTex = new S.Texture({
            context,
            source: rampCanvas(),
            sampler: new S.Sampler({ wrapS: 0x812f, wrapT: 0x812f, minificationFilter: 0x2601, magnificationFilter: 0x2601 })
        })
        // NEAREST:避免依赖 OES_texture_float_linear(缺失时 LINEAR 采样浮点纹理恒返回 0)
        this._fieldTex = new S.Texture({
            context,
            width: this._fieldW,
            height: this._fieldH,
            pixelFormat: S.PixelFormat.RGBA,
            pixelDatatype: S.PixelDatatype.FLOAT,
            sampler: new S.Sampler({ wrapS: 0x812f, wrapT: 0x812f, minificationFilter: 0x2600, magnificationFilter: 0x2600 })
        })
        this._fieldFB = new S.Framebuffer({ context, colorTextures: [this._fieldTex], destroyAttachments: false })
    }

    _createParticles(context) {
        const S = SuperMap3D
        const dim = this._dim
        const n = dim * dim
        const init = new Float32Array(n * 4)
        const [xmin, ymin, xspan, yspan] = this._bbox
        for (let i = 0; i < n; i++) {
            init[i * 4] = xmin + Math.random() * xspan
            init[i * 4 + 1] = ymin + Math.random() * yspan
            init[i * 4 + 2] = Math.random() * 8 // age 错峰
            init[i * 4 + 3] = Math.random()
        }
        const mkTex = src =>
            new S.Texture({
                context,
                width: dim,
                height: dim,
                pixelFormat: S.PixelFormat.RGBA,
                pixelDatatype: S.PixelDatatype.FLOAT,
                source: src ? { width: dim, height: dim, arrayBufferView: src } : undefined,
                sampler: new S.Sampler({ wrapS: 0x812f, wrapT: 0x812f, minificationFilter: 0x2600, magnificationFilter: 0x2600 })
            })
        this._posTexA = mkTex(init)
        this._posTexB = mkTex(init)
        this._posFBA = new S.Framebuffer({ context, colorTextures: [this._posTexA], destroyAttachments: false })
        this._posFBB = new S.Framebuffer({ context, colorTextures: [this._posTexB], destroyAttachments: false })
        this._pingIsA = true
        this._redistribute = true

        // 条带 VB:每粒子 4 顶点 [ref.x, ref.y, endFlag, side],索引 6/粒子
        const vb = new Float32Array(n * 4 * 4)
        const ib = new Uint32Array(n * 6)
        let o = 0
        let q = 0
        const corners = [
            [0, -1],
            [0, 1],
            [1, -1],
            [1, 1]
        ]
        for (let i = 0; i < n; i++) {
            const x = i % dim
            const y = (i / dim) | 0
            const sx = (x + 0.5) / dim
            const sy = (y + 0.5) / dim
            for (const [ef, sd] of corners) {
                vb[o++] = sx
                vb[o++] = sy
                vb[o++] = ef
                vb[o++] = sd
            }
            const b = i * 4
            ib[q++] = b
            ib[q++] = b + 1
            ib[q++] = b + 2
            ib[q++] = b + 2
            ib[q++] = b + 1
            ib[q++] = b + 3
        }
        this._ribbonBuf = S.Buffer.createVertexBuffer({ context, typedArray: vb, usage: S.BufferUsage.STATIC_DRAW })
        this._ribbonIdx = S.Buffer.createIndexBuffer({
            context,
            typedArray: ib,
            usage: S.BufferUsage.STATIC_DRAW,
            indexDatatype: S.IndexDatatype.UNSIGNED_INT
        })
        this._ribbonVA = new S.VertexArray({
            context,
            indexBuffer: this._ribbonIdx,
            attributes: [
                {
                    index: 0,
                    vertexBuffer: this._ribbonBuf,
                    componentsPerAttribute: 2,
                    componentDatatype: S.ComponentDatatype.FLOAT,
                    strideInBytes: 16,
                    offsetInBytes: 0
                },
                {
                    index: 1,
                    vertexBuffer: this._ribbonBuf,
                    componentsPerAttribute: 1,
                    componentDatatype: S.ComponentDatatype.FLOAT,
                    strideInBytes: 16,
                    offsetInBytes: 8
                },
                {
                    index: 2,
                    vertexBuffer: this._ribbonBuf,
                    componentsPerAttribute: 1,
                    componentDatatype: S.ComponentDatatype.FLOAT,
                    strideInBytes: 16,
                    offsetInBytes: 12
                }
            ]
        })
        this._nRibbonIndices = n * 6
    }

    _createTrails(context) {
        const S = SuperMap3D
        const w = (this._trailW = context.drawingBufferWidth)
        const h = (this._trailH = context.drawingBufferHeight)
        const mk = () => {
            const tex = new S.Texture({
                context,
                width: w,
                height: h,
                pixelFormat: S.PixelFormat.RGBA,
                pixelDatatype: S.PixelDatatype.UNSIGNED_BYTE,
                sampler: new S.Sampler({ wrapS: 0x812f, wrapT: 0x812f, minificationFilter: 0x2601, magnificationFilter: 0x2601 })
            })
            return { tex, fb: new S.Framebuffer({ context, colorTextures: [tex], destroyAttachments: false }) }
        }
        this._trailA = mk()
        this._trailB = mk()
        this._trailPingIsA = true
        this._clearTrails = true
    }

    // ---------------------------------------------------------- helpers
    /**
     * 粒子域:以相机视线与椭球交点为中心、按视距自适应跨度。
     * 不用 computeViewRectangle——视角贴近水面时它会包含地平线(跨度爆炸/undefined),
     * 导致粒子被稀释到全域而"消失"。
     */
    _viewBbox() {
        const S = SuperMap3D
        const camera = this.viewer.camera
        const [dw, ds, de, dn] = this.data.bbox
        const ellipsoid = S.Ellipsoid.WGS84
        let centerLon, centerLat, distM
        let picked = false
        if (S.IntersectionTests && S.IntersectionTests.rayEllipsoid && S.Ray) {
            const ray = new S.Ray(camera.positionWC, camera.directionWC)
            const iv = S.IntersectionTests.rayEllipsoid(ray, ellipsoid)
            if (iv) {
                const p = S.Ray.getPoint(ray, iv.start)
                const c = S.Cartographic.fromCartesian(p)
                centerLon = S.Math.toDegrees(c.longitude)
                centerLat = S.Math.toDegrees(c.latitude)
                distM = Math.max(iv.start, 200)
                picked = true
            }
        }
        if (!picked) {
            const c = camera.positionCartographic
            centerLon = S.Math.toDegrees(c.longitude)
            centerLat = S.Math.toDegrees(c.latitude)
            distM = Math.max(c.height, 1000)
        }
        const spanM = Math.max(distM * 2.6, 2000) // 视距 ~2.6 倍,下限 2km
        const coslat = Math.max(Math.cos((centerLat * Math.PI) / 180), 0.2)
        const spanLat = Math.min(spanM / 110540, dn - ds)
        const spanLon = Math.min(spanM / (111320 * coslat), de - dw)
        let w = centerLon - spanLon / 2
        let e = centerLon + spanLon / 2
        let s = centerLat - spanLat / 2
        let n = centerLat + spanLat / 2
        // 平移回域内再钳制
        if (w < dw) {
            e += dw - w
            w = dw
        }
        if (e > de) {
            w -= e - de
            e = de
        }
        if (s < ds) {
            n += ds - s
            s = ds
        }
        if (n > dn) {
            s -= n - dn
            n = dn
        }
        w = Math.max(w, dw)
        s = Math.max(s, ds)
        if (!(e > w) || !(n > s)) {
            w = dw
            s = ds
            e = de
            n = dn
        }
        return [w, s, e - w, n - s]
    }

    _mkOffscreenRS(w, h, blending) {
        return SuperMap3D.RenderState.fromCache({
            viewport: new SuperMap3D.BoundingRectangle(0, 0, w, h),
            depthTest: { enabled: false },
            depthMask: false,
            blending: blending || { enabled: false }
        })
    }

    _drawOffscreen(context, { sp, va, fb, uniformMap, rs, count, primitiveType }) {
        const S = SuperMap3D
        const cmd = new S.DrawCommand({
            owner: this,
            shaderProgram: sp,
            vertexArray: va,
            framebuffer: fb,
            renderState: rs,
            uniformMap,
            count,
            primitiveType: primitiveType !== undefined ? primitiveType : S.PrimitiveType.TRIANGLES,
            pass: S.Pass.OPAQUE
        })
        cmd.execute(context)
    }

    // ---------------------------------------------------------- per frame
    update(frameState) {
        if (!this.show || this._destroyed) return
        if (!frameState.passes.render) return
        // SuperMap renders a water mirror FBO before the main scene, with the
        // same frame number and passes.render=true but a different camera view.
        // This overlay belongs only to the main view. Letting the mirror pass
        // consume dt / replace the screen history clears the trails twice per
        // frame and leaves only short preview strokes (or dots).
        if (frameState.fboEnable || frameState.passes.offscreen) return
        const S = SuperMap3D
        const context = frameState.context
        if (!this._ready) {
            const gl = context._gl
            const isWebGL2 = typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext
            const floatRenderable = isWebGL2
                ? !!gl.getExtension('EXT_color_buffer_float')
                : !!gl.getExtension('OES_texture_float') && !!gl.getExtension('WEBGL_color_buffer_float')
            const uintIndex = isWebGL2 || !!gl.getExtension('OES_element_index_uint')
            if (!floatRenderable || !uintIndex) {
                console.warn(
                    '[ParticleFlowLayer] GPU 能力不足(float 渲染或 uint 索引缺失),粒子层禁用。isWebGL2=',
                    isWebGL2,
                    'floatRenderable=',
                    floatRenderable,
                    'uintIndex=',
                    uintIndex
                )
                this.show = false
                return
            }
            try {
                this._createStatic(context)
                this._bbox = this._viewBbox()
                this._createParticles(context)
                this._createTrails(context)
                this._ready = true
                console.info('[ParticleFlowLayer] 初始化完成 isWebGL2=', isWebGL2, 'dim=', this._dim)
            } catch (e) {
                console.error('[ParticleFlowLayer] 初始化失败,粒子层禁用:', e)
                this.show = false
                return
            }
        }
        if (this._pendingA) {
            this._renderDirty = true
            this._fieldDirty = true
            this._dataABuf.copyFromArrayView(this._pendingA)
            this._dataBBuf.copyFromArrayView(this._pendingB)
            this._pendingA = this._pendingB = null
        }
        // 视野变化检测
        const nb = this._viewBbox()
        const ob = this._bbox
        const moved =
            Math.abs(nb[0] - ob[0]) > ob[2] * 0.08 ||
            Math.abs(nb[1] - ob[1]) > ob[3] * 0.08 ||
            Math.abs(nb[2] - ob[2]) > ob[2] * 0.08 ||
            Math.abs(nb[3] - ob[3]) > ob[3] * 0.08
        if (moved) {
            this._bbox = nb
            this._redistribute = true
            this._clearTrails = true
            this._renderDirty = true
        }
        if (context.drawingBufferWidth !== this._trailW || context.drawingBufferHeight !== this._trailH) {
            this._destroyTrails()
            this._createTrails(context)
        }
        if (this._rebuildParticles) {
            this._rebuildParticles = false
            this._destroyParticles()
            this._createParticles(context)
        }

        const dt = Math.max(0, Math.min(this._animationTime - this._renderedAnimationTime, 0.1))
        const advance = dt > 0
        this._renderedAnimationTime = this._animationTime
        if (advance) this._frame++
        // 显式取当前相机矩阵:手动 execute 时 czm_* 环境状态可能是上一 pass 的残留
        const cam = frameState.camera
        this._vp = S.Matrix4.multiply(cam.frustum.projectionMatrix, cam.viewMatrix, this._vp || new S.Matrix4())
        this._camPos = S.Cartesian3.clone(cam.positionWC, this._camPos || new S.Cartesian3())
        const cameraChanged = !this._renderedVp || !S.Matrix4.equalsEpsilon(this._vp, this._renderedVp, 1e-8)
        // Screen-space history belongs to the previous camera. Reusing it while
        // zooming smears old pixels over newly visible land and water.
        if (cameraChanged) this._clearTrails = true
        const redraw = this._renderDirty || this._clearTrails || cameraChanged
        this._renderedVp = S.Matrix4.clone(this._vp, this._renderedVp || new S.Matrix4())
        const bboxArr = this._bbox
        const bboxUniform = () => new S.Cartesian4(bboxArr[0], bboxArr[1], bboxArr[2], bboxArr[3])
        const speedScale = particleSpeedScale(bboxArr[2], this._flowStrength)

        try {
            // 暂停时保留粒子位置与拖尾；仅在相机、时次或样式改变时重新投影。
            if (advance || redraw) {
                // ① 流场纹理
                new S.ClearCommand({ color: new S.Color(0, 0, 0, 0), framebuffer: this._fieldFB }).execute(context)
                this._drawOffscreen(context, {
                    sp: this._fieldSP,
                    va: this._fieldVA,
                    fb: this._fieldFB,
                    rs: this._mkOffscreenRS(this._fieldW, this._fieldH),
                    uniformMap: { u_t: () => this._t, u_bbox: bboxUniform }
                })

                // ② 粒子更新:prev -> curr
                let currTex = this._pingIsA ? this._posTexA : this._posTexB
                let prevTex = this._pingIsA ? this._posTexB : this._posTexA
                const reseed = Boolean(this._redistribute)
                if (advance || reseed || this._fieldDirty) {
                    prevTex = currTex
                    const currFB = this._pingIsA ? this._posFBB : this._posFBA
                    currTex = this._pingIsA ? this._posTexB : this._posTexA
                    this._drawOffscreen(context, {
                        sp: this._updateSP,
                        va: this._quadVA,
                        fb: currFB,
                        rs: this._mkOffscreenRS(this._dim, this._dim),
                        uniformMap: {
                            u_particles: () => prevTex,
                            u_field: () => this._fieldTex,
                            u_bbox: bboxUniform,
                            u_dt: () => dt,
                            u_speedScale: () => speedScale,
                            u_frame: () => this._frame % 1000,
                            u_reseed: () => reseed
                        }
                    })
                    this._pingIsA = !this._pingIsA
                    this._redistribute = false
                    if (reseed) prevTex = currTex
                }

                // ③ 拖尾:prevTrail 衰减写入 currTrail,再叠加条带
                const trailPrev = this._trailPingIsA ? this._trailA : this._trailB
                const trailCurr = this._trailPingIsA ? this._trailB : this._trailA
                if (this._clearTrails || !advance) {
                    this._clearTrails = false
                    for (const t of [this._trailA, this._trailB]) {
                        new S.ClearCommand({ color: new S.Color(0, 0, 0, 0), framebuffer: t.fb }).execute(context)
                    }
                }
                const fadeNow = particleTrailFade(this._trailSeconds, dt)
                this._drawOffscreen(context, {
                    sp: this._fadeSP,
                    va: this._quadVA,
                    fb: trailCurr.fb,
                    rs: this._mkOffscreenRS(this._trailW, this._trailH),
                    uniformMap: { u_trail: () => trailPrev.tex, u_fade: () => fadeNow, u_fadePhase: () => this._frame % 1000 }
                })
                this._drawOffscreen(context, {
                    sp: this._ribbonSP,
                    va: this._ribbonVA,
                    fb: trailCurr.fb,
                    rs: this._mkOffscreenRS(this._trailW, this._trailH, ADD_BLEND),
                    count: this._nRibbonIndices,
                    primitiveType: S.PrimitiveType.TRIANGLES,
                    uniformMap: {
                        u_curr: () => currTex,
                        u_prev: () => prevTex,
                        u_field: () => this._fieldTex,
                        u_bbox: bboxUniform,
                        u_exagg: () => this._exagg,
                        u_viewport: () => new S.Cartesian2(this._trailW, this._trailH),
                        u_width: () => this._width,
                        u_preview: () => !advance || reseed,
                        u_previewSeconds: () => this._trailSeconds * 0.2,
                        u_speedScale: () => speedScale,
                        u_ramp: () => this._rampTex,
                        u_vp: () => this._vp,
                        u_camPos: () => this._camPos,
                        u_speedMax: () => this._speedMax
                    }
                })
                this._trailPingIsA = !this._trailPingIsA
                this._renderDirty = false
                this._fieldDirty = false
            }
        } catch (e) {
            if (!this._runError) {
                this._runError = true
                console.error('[ParticleFlowLayer] 离屏渲染失败,粒子层禁用:', e)
            }
            this.show = false
            return
        }

        // ④ 合成:OVERLAY pass 在场景之后直接叠加,避开 OIT/多视锥
        if (!this._compositeCmd) {
            this._compositeCmd = new S.DrawCommand({
                owner: this,
                shaderProgram: this._compositeSP,
                vertexArray: this._quadVA,
                renderState: S.RenderState.fromCache({
                    depthTest: { enabled: false },
                    depthMask: false,
                    cull: { enabled: false },
                    blending: ADD_BLEND
                }),
                uniformMap: {
                    u_trail: () => (this._trailPingIsA ? this._trailA : this._trailB).tex,
                    u_opacity: () => this._opacity
                },
                pass: S.Pass.OVERLAY
            })
        }
        frameState.commandList.push(this._compositeCmd)
    }

    // ---------------------------------------------------------- teardown
    _destroyParticles() {
        for (const k of ['_posFBA', '_posFBB', '_posTexA', '_posTexB', '_ribbonVA', '_ribbonBuf', '_ribbonIdx']) {
            if (this[k] && this[k].destroy && !(this[k].isDestroyed && this[k].isDestroyed())) this[k].destroy()
            this[k] = undefined
        }
    }
    _destroyTrails() {
        for (const t of [this._trailA, this._trailB]) {
            if (t) {
                t.fb.destroy()
                t.tex.destroy()
            }
        }
        this._trailA = this._trailB = undefined
    }
    isDestroyed() {
        return this._destroyed
    }
    destroy() {
        if (this._destroyed) return undefined
        this._destroyed = true
        if (this._ready) {
            this._destroyParticles()
            this._destroyTrails()
            for (const k of [
                '_fieldVA',
                '_fieldFB',
                '_fieldTex',
                '_lonlatBuf',
                '_dataABuf',
                '_dataBBuf',
                '_meshIndexBuf',
                '_quadVA',
                '_quadBuf',
                '_rampTex'
            ]) {
                if (this[k] && this[k].destroy && !(this[k].isDestroyed && this[k].isDestroyed())) this[k].destroy()
                this[k] = undefined
            }
        }
        this._compositeCmd = null
        return undefined
    }
}
