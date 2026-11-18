export const ESTUARY_WAVES = /* glsl */ `
vec3 ffSmallWaves(vec2 p, float t, float amplitude) {
    vec2 d0 = vec2(0.94, 0.34), d1 = vec2(-0.38, 0.925), d2 = vec2(0.71, -0.704);
    vec3 k = 6.2831853 / vec3(180.0, 95.0, 46.0);
    vec3 phase = vec3(dot(p, d0), dot(p, d1), dot(p, d2)) * k - t * sqrt(9.81 * k);
    vec3 a = amplitude * vec3(0.57, 0.28, 0.15);
    float h = dot(a, sin(phase));
    vec3 derivative = a * k * cos(phase);
    return vec3(h, d0 * derivative.x + d1 * derivative.y + d2 * derivative.z);
}
vec2 ffWorldMetres(vec3 world) {
    vec3 local = world - vec3(-2795485.0, 4717356.0, 3207150.0);
    return vec2(dot(local, vec3(-0.8603, -0.5098, 0.0)), dot(local, vec3(0.2575, -0.4346, 0.8629)));
}
`

export function addEstuaryVertexShading(source) {
    const geometryAnchor = 'vec3 highDifference = highPos - czm_encodedCameraPositionMCHigh;'
    const valueAnchor = 'v_UV = vec2(U,V);'
    if (!source.includes(geometryAnchor) || !source.includes(valueAnchor)) throw new Error('Unsupported W3D water vertex shader')
    const uniforms = `
uniform sampler2D u_ffSurfaceData;
uniform sampler2D u_ffDisplacement;
uniform sampler2D u_ffTidalCoordinates;
varying vec4 v_ffTidalCoordinates;
varying float v_ffSediment;
uniform vec4 u_ffTidalFront;
uniform float u_ffWaveTime;
uniform float u_ffWaveAmplitude;
uniform bool u_estuaryWater;
varying vec4 v_ffSurface;
varying vec4 v_ffDisplacement;
`
    // Lift the original encoded ellipsoid vertex directly. W3D's original
    // camera-ENU plane changes curvature when the camera crosses its 50 km LOD.
    const start = source.indexOf('    if(u_renderHeight.x > 0.)')
    const end = source.indexOf(geometryAnchor)
    if (start < 0 || end < start) throw new Error('Unsupported W3D height transform')
    source = source.slice(0, start) + `
    vec3 ffEllipsoidUp = normalize((position3DHigh + position3DLow) / vec3(1.0, 1.0, 0.99330562));
    lowPos += ffEllipsoidUp * (waterStage * u_renderHeight.x + u_renderHeight.y);
    ` + source.slice(end)
    return uniforms + ESTUARY_WAVES + source.replace(geometryAnchor, `
    vec4 ffSurface = texture2D(u_ffSurfaceData, vec2(l, h));
    vec4 ffRiver = texture2D(u_ffTidalCoordinates, vec2(l, h));
    float ffShoreDamping = smoothstep(0.0, 35.0, ffSurface.z) * smoothstep(0.0, 1.5, ffSurface.x) * ffSurface.y;
    vec3 ffWorld = highPos + lowPos;
    vec3 ffWave = ffSmallWaves(ffWorldMetres(ffWorld), u_ffWaveTime, u_estuaryWater ? u_ffWaveAmplitude * ffShoreDamping : 0.0);
    // Add centimetre-scale displacement to the LOW part; never multiply it by the
    // model-level exaggeration, or round it away in a six-million-metre ECEF value.
    lowPos += normalize(ffWorld) * ffWave.x;
    float ffCrest = exp(-pow((ffRiver.x - u_ffTidalFront.x) / max(45.0, u_ffTidalFront.z * 0.18), 2.0));
    lowPos += normalize(ffWorld) * (u_estuaryWater ? ffCrest * 0.12 * u_ffTidalFront.y * ffShoreDamping * ffRiver.y : 0.0);
    ${geometryAnchor}
`).replace(valueAnchor, `${valueAnchor}
    v_ffSurface = vec4(ffSurface.xyz, ffShoreDamping);
    v_ffDisplacement = texture2D(u_ffDisplacement, vec2(l, h));
    v_ffTidalCoordinates = ffRiver;
    v_ffSediment = ffSurface.w;
    // Symmetric wet->dry AND dry->wet opacity from model wet flags.
    v_findColor.a = u_alpha * ffSurface.y;
`)
}
