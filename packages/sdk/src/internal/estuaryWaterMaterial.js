import { ESTUARY_WAVES } from './estuaryVertexShader.js'
import { ESTUARY_SCENE_REFLECTION } from './estuarySceneReflection.js'

/**
 * Flow-map phase blending adapted from three.js r180 Water2 (MIT).
 * Multiscale normals / Fresnel lighting informed by three.js Water (MIT).
 * See public/textures/estuary/README.md and LICENSE-threejs.txt.
 * Optical detail is illustrative; model U/V and water levels remain authoritative.
 */
const ESTUARY_HELPERS = /* glsl */ `
uniform bool u_estuaryWater;
uniform sampler2D u_estuaryNormal0;
uniform sampler2D u_estuaryNormal1;
uniform vec3 u_estuaryWaveLod;
uniform float u_ffFlowBlend;
uniform float u_ffWaveTime;
uniform float u_ffWaveAmplitude;
uniform bool u_ffSceneReflection;
uniform vec4 u_ffTidalFront;
varying vec4 v_ffTidalCoordinates;
varying float v_ffSediment;
varying vec4 v_ffSurface;
varying vec4 v_ffDisplacement;
${ESTUARY_WAVES}
${ESTUARY_SCENE_REFLECTION}

float ffNoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    vec4 h = fract(sin(vec4(dot(i, vec2(127.1, 311.7)), dot(i + vec2(1.0, 0.0), vec2(127.1, 311.7)),
                            dot(i + vec2(0.0, 1.0), vec2(127.1, 311.7)), dot(i + vec2(1.0), vec2(127.1, 311.7)))) * 43758.5453);
    return mix(mix(h.x, h.y, f.x), mix(h.z, h.w, f.x), f.y);
}
// Integrated per-node displacements are independent of camera height and LOD.
vec2 ffFlowNormal(sampler2D normalMap, vec2 uv, vec2 offset0, vec2 offset1, float blend) {
    vec2 n0 = texture2D(normalMap, uv - offset0).rg * 2.0 - 1.0;
    vec2 n1 = texture2D(normalMap, uv - offset1).rg * 2.0 - 1.0;
    return mix(n0, n1, blend);
}
vec2 ffWaterSlope(vec2 metres, float tile, vec4 offsets, float blend) {
    vec2 p = metres / tile;
    vec4 flow = offsets / tile;
    mat2 rotation = mat2(0.8, -0.6, 0.6, 0.8);
    vec2 broad = ffFlowNormal(u_estuaryNormal0, p, flow.xy, flow.zw, blend);
    vec2 fine = ffFlowNormal(u_estuaryNormal1, rotation * p * 2.73 + 0.21, rotation * flow.xy * 2.73, rotation * flow.zw * 2.73, blend);
    fine = vec2(dot(rotation[0], fine), dot(rotation[1], fine));
    // Incommensurate third octave breaks recognisable repeated patches while
    // all three samples retain the same world-space advection velocity.
    mat2 turn = mat2(0.9563, -0.2924, 0.2924, 0.9563);
    vec2 detail = ffFlowNormal(u_estuaryNormal0, turn * p * 1.617 + 5.37,
        turn * flow.xy * 1.617, turn * flow.zw * 1.617, blend);
    detail = vec2(dot(turn[0], detail), dot(turn[1], detail));
    return broad * 0.59 + fine * 0.30 + detail * 0.18;
}
float ffSedimentNoise(vec2 p) {
    // Fade unresolved detail to its mean instead of letting it flicker at a
    // grazing angle or when the mixing band occupies only a few pixels.
    vec2 footprint = fwidth(p);
    return mix(ffNoise(p), 0.5, smoothstep(0.35, 1.1, max(footprint.x, footprint.y)));
}
float ffSedimentEddies(vec2 p, vec2 direction) {
    // Never rotate the absolute river position by a per-vertex direction:
    // small tangent changes then shear kilometres of coordinates into combs.
    // Keep a world-anchored domain and use direction only for a bounded warp.
    float curl = ffSedimentNoise(p / vec2(950.0, 400.0));
    vec2 q = p + direction * ((curl - 0.5) * 120.0);
    return ffSedimentNoise(vec2(q.x / 650.0 + curl * 1.6, q.y / 110.0 + curl * 1.2)) * 0.7
        + ffSedimentNoise(p / vec2(1700.0, 270.0) + 9.1) * 0.3;
}
float ffFlowRoughness(vec2 metres, vec4 offsets, float blend) {
    return mix(ffNoise((metres - offsets.xy) / 2300.0), ffNoise((metres - offsets.zw) / 2300.0), blend);
}
vec3 ffSkyReflection(vec3 ray, vec3 east, vec3 north, vec3 up) {
    float elevation = max(dot(ray, up), 0.03);
    vec2 skyUV = vec2(dot(ray, east), dot(ray, north)) / (elevation + 0.35);
    float clouds = ffNoise(skyUV * 2.6 + vec2(7.2, 9.1)) * 0.65 + ffNoise(skyUV * 6.2 + 2.1) * 0.35;
    clouds = smoothstep(0.42, 0.78, clouds);
    vec3 sky = mix(vec3(0.62, 0.69, 0.70), vec3(0.24, 0.40, 0.51), sqrt(elevation));
    return mix(sky, vec3(0.82, 0.83, 0.78), clouds * 0.65);
}
`

const ESTUARY_SURFACE = /* glsl */ `
    if (u_estuaryWater) {
        // W3D v_positionWC is camera ENU; v_position.xyz is the actual ECEF position.
        // SuperMap's WATER pass can have a separate depth attachment. Preserve
        // foreground geometry explicitly using the opaque scene captured above.
        if (u_ffSceneReflection) {
            vec2 screenUV = gl_FragCoord.xy / czm_viewport.zw;
            float opaqueDepth = czm_unpackDepth(texture2D(globeDepthTexture, screenUV));
            vec4 opaqueEye = czm_windowToEyeCoordinates(gl_FragCoord.xy, opaqueDepth);
            if (opaqueDepth > 0.0 && opaqueDepth < 1.0 &&
                opaqueEye.z / opaqueEye.w > -materialInput.positionToEyeEC.z + 0.2) discard;
        }
        vec3 world = v_position.xyz;
        vec3 up = normalize(world);
        vec3 east = normalize(vec3(-up.y, up.x, 0.0));
        vec3 north = normalize(cross(up, east));
        vec3 local = world - vec3(-2795485.0, 4717356.0, 3207150.0);
        vec2 metres = vec2(dot(local, vec3(-0.8603, -0.5098, 0.0)), dot(local, vec3(0.2575, -0.4346, 0.8629)));
        vec2 slopeA = ffWaterSlope(metres, u_estuaryWaveLod.x, v_ffDisplacement, u_ffFlowBlend);
        vec2 slopeB = ffWaterSlope(metres, u_estuaryWaveLod.y, v_ffDisplacement, u_ffFlowBlend);
        vec2 slope = mix(slopeA, slopeB, u_estuaryWaveLod.z);
        float roughnessPatch = ffFlowRoughness(metres, v_ffDisplacement, u_ffFlowBlend);
        vec3 smallWaves = ffSmallWaves(metres, u_ffWaveTime, u_ffWaveAmplitude * v_ffSurface.w);
        slope -= smallWaves.yz;
        slope *= mix(0.55, 0.95, roughnessPatch);
        vec3 normalWC = normalize(up + east * slope.x + north * slope.y);
        vec3 eye = normalize(czm_inverseViewRotation * materialInput.positionToEyeEC);
        vec3 reflected = reflect(-eye, normalWC);
        float ndv = max(dot(normalWC, eye), 0.001);
        float fresnel = 0.02 + 0.98 * pow(1.0 - ndv, 5.0);
        // Neutral daylight art direction; it does not assert forecast-time solar irradiance.
        vec3 light = normalize(east * 0.10 + north * 0.45 + up * 0.887);
        vec3 halfVector = normalize(eye + light);
        float ndl = max(dot(normalWC, light), 0.001);
        float ndh = max(dot(normalWC, halfVector), 0.0);
        float vdh = max(dot(eye, halfVector), 0.0);
        float riverCoverage = smoothstep(0.0, 0.85, v_ffTidalCoordinates.y);
        float history = clamp(v_ffSediment, 0.0, 1.0);
        float tidalAmount = u_ffTidalFront.w * riverCoverage * max(u_ffTidalFront.y, smoothstep(0.02, 0.35, history) * 0.85);
        // Positive along-river distance is ahead of the advancing bore (upstream).
        // Small world-anchored eddies soften the interface without moving its centre.
        vec2 riverDirection = normalize(v_ffTidalCoordinates.zw + vec2(0.00001));
        float interfaceNoise = mix(ffSedimentEddies(metres - v_ffDisplacement.xy * 0.16, riverDirection),
            ffSedimentEddies(metres - v_ffDisplacement.zw * 0.16, riverDirection), u_ffFlowBlend);
        float mixWidth = u_ffTidalFront.z * mix(0.72, 1.2, interfaceNoise);
        float frontDistance = v_ffTidalCoordinates.x - u_ffTidalFront.x + (interfaceNoise - 0.5) * mixWidth * 0.65;
        float frontFootprint = fwidth(frontDistance);
        float halfMixWidth = max(mixWidth * 0.5, frontFootprint * 1.25);
        float behindFront = 1.0 - smoothstep(-halfMixWidth, halfMixWidth, frontDistance);
        float sediment = mix(history, max(behindFront * 0.78, history), u_ffTidalFront.y);
        sediment = clamp(sediment + (interfaceNoise - 0.5) * history * 0.15, 0.0, 1.0);
        float crestWidth = max(frontFootprint * 1.25, clamp(mixWidth * 0.13, 22.0, 110.0));
        float crest = exp(-pow(frontDistance / crestWidth, 2.0)) * u_ffTidalFront.y * riverCoverage;
        float foamSoftness = max(0.18, fwidth(interfaceNoise));
        float brokenFoam = crest * smoothstep(0.58 - foamSoftness, 0.58 + foamSoftness, interfaceNoise)
            * smoothstep(0.0, 55.0, v_ffSurface.z);
        float roughness = mix(0.09, 0.14, roughnessPatch) + tidalAmount * behindFront * 0.035;
        float a2 = roughness * roughness;
        float denominator = ndh * ndh * (a2 - 1.0) + 1.0;
        float distribution = a2 / max(3.14159265 * denominator * denominator, 0.0001);
        float k = roughness * 0.5;
        float visibility = (ndv / (ndv * (1.0 - k) + k)) * (ndl / (ndl * (1.0 - k) + k));
        float sunFresnel = 0.02 + 0.98 * pow(1.0 - vdh, 5.0);
        float specular = distribution * visibility * sunFresnel / max(4.0 * ndv * ndl, 0.001);
        float depthTint = smoothstep(0.0, 18.0, v_ffSurface.x);
        vec3 clearWater = mix(vec3(0.30, 0.48, 0.47), vec3(0.16, 0.34, 0.35), depthTint);
        vec3 muddyWater = mix(vec3(0.57, 0.49, 0.34), vec3(0.43, 0.37, 0.26), depthTint);
        muddyWater = mix(muddyWater, vec3(0.58, 0.47, 0.30), history * 0.38);
        vec3 tidalColour = mix(clearWater, muddyWater, sediment);
        vec3 waterColour = mix(findColor.rgb, tidalColour, tidalAmount * 0.94);
        vec3 body = pow(max(waterColour, vec3(0.0)), vec3(2.2));
        body *= (0.78 + 0.22 * ndl) * mix(0.93, 1.07, roughnessPatch);
        vec3 sky = pow(ffSkyReflection(reflected, east, north, up), vec3(2.2));
        if (u_ffSceneReflection && length(materialInput.positionToEyeEC) < 28000.0) {
            vec4 sceneHit = ffSceneReflection(u_refractTexture, globeDepthTexture, -materialInput.positionToEyeEC, normalize(czm_viewRotation * reflected), world, up);
            float reflectionFade = 1.0 - smoothstep(20000.0, 28000.0, length(materialInput.positionToEyeEC));
            sky = mix(sky, pow(max(sceneHit.rgb, vec3(0.0)), vec3(2.2)), sceneHit.a * reflectionFade);
        }
        float shoreWidth = max(45.0, min(90.0, fwidth(v_ffSurface.z) * 1.5));
        float shoreCoverage = smoothstep(0.0, shoreWidth, v_ffSurface.z);
        // Wet flags are authoritative. Cell-to-node averaging can put the
        // interpolated level below a node's bed even inside a wet channel.
        // Depth only softens the shallow margin; it must not punch triangular
        // holes through otherwise continuous water or split the tidal front.
        float shallowCoverage = mix(0.65, 1.0, max(smoothstep(0.0, 0.20, v_ffSurface.x),
            smoothstep(45.0, 180.0, v_ffSurface.z)));
        // A narrow wet margin follows the model shoreline; the substrate is the
        // actual underlying scene, revealed by opacity, rather than a painted bank.
        body *= mix(0.88, 1.0, smoothstep(0.0, 65.0, v_ffSurface.z));
        vec3 radiance = body * (1.0 - fresnel) + sky * fresnel;
        radiance += vec3(1.0, 0.96, 0.83) * min(specular * ndl * 1.6, 0.55);
        vec3 colour = pow(radiance / (vec3(1.0) + radiance * 0.45), vec3(1.0 / 2.2));
        colour = mix(colour, vec3(0.80, 0.82, 0.76), brokenFoam * 0.28);
        // Lighting is evaluated above in world space; avoid a second engine Phong highlight.
        material.diffuse = vec3(0.0);
        material.emission = colour;
        material.normal = normalize(czm_viewRotation * normalWC);
        material.specular = 0.0;
        material.shininess = 1.0;
        material.alpha = alpha * shoreCoverage * shallowCoverage * mix(1.0, mix(0.94, 1.04, behindFront), tidalAmount);
        return material;
    }
`

export function addEstuaryWaterShading(source) {
    const anchor = 'material.diffuse = findColor.rgb;'
    if (!source.includes(anchor)) throw new Error('W3D water shader does not expose the expected surface-colour entry')
    return ESTUARY_HELPERS + source.replace(anchor, ESTUARY_SURFACE + '\n    ' + anchor)
}
