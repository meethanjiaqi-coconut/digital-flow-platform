/** Screen-space ray tracing of the opaque scene captured BEFORE drawing water.
 * Actual colour/depth hits only: no mirrored satellite collage or synthetic banks.
 * Off-screen/occluded hits fade to the sky environment, without replacing the map camera.
 */
export const ESTUARY_SCENE_REFLECTION = /* glsl */ `
vec4 ffSceneReflection(sampler2D sceneColour, sampler2D sceneDepth, vec3 originEC, vec3 rayEC, vec3 waterWorld, vec3 up) {
    vec3 start = originEC + rayEC * 0.4;
    float reach = min(2500.0, max(80.0, length(originEC) * 0.8));
    float previousDistance = 0.0;
    float previousDelta = -1.0;
    for (int i = 1; i <= 28; i++) {
        float fraction = float(i) / 28.0;
        float distanceAlong = reach * fraction * fraction;
        vec3 point = start + rayEC * distanceAlong;
        vec4 clip = czm_projection * vec4(point, 1.0);
        if (clip.w <= 0.0) break;
        vec2 uv = clip.xy / clip.w * 0.5 + 0.5;
        if (any(lessThan(uv, vec2(0.002))) || any(greaterThan(uv, vec2(0.998)))) break;
        float packedDepth = czm_unpackDepth(texture2D(sceneDepth, uv));
        if (packedDepth > 0.0 && packedDepth < 1.0) {
            vec4 sceneEye4 = czm_windowToEyeCoordinates(uv * czm_viewport.zw, packedDepth);
            vec3 sceneEye = sceneEye4.xyz / sceneEye4.w;
            float delta = sceneEye.z - point.z;
            if (delta >= 0.0 && previousDelta < 0.0) {
                float lo = previousDistance, hi = distanceAlong;
                for (int j = 0; j < 8; j++) {
                    float mid = (lo + hi) * 0.5;
                    vec3 probe = start + rayEC * mid;
                    vec4 projected = czm_projection * vec4(probe, 1.0);
                    uv = projected.xy / projected.w * 0.5 + 0.5;
                    float z = czm_unpackDepth(texture2D(sceneDepth, uv));
                    if (z <= 0.0 || z >= 1.0) { delta = 1e8; break; }
                    vec4 eye4 = czm_windowToEyeCoordinates(uv * czm_viewport.zw, z);
                    sceneEye = eye4.xyz / eye4.w;
                    delta = sceneEye.z - probe.z;
                    if (delta >= 0.0) hi = mid; else lo = mid;
                }
                // Compare in eye space: the engine's inverse-view automatic
                // uniform can use a rebased origin, unlike W3D's world varying.
                float aboveWater = dot(sceneEye - originEC, czm_viewRotation * up);
                float thickness = max(0.35, length(sceneEye) * 0.0003);
                if (abs(delta) < thickness && aboveWater > 0.05 && hi > 1.0) {
                    vec2 edge = min(uv, 1.0 - uv);
                    float confidence = smoothstep(0.0, 0.06, min(edge.x, edge.y));
                    confidence *= 1.0 - smoothstep(0.75, 1.0, hi / reach);
                    // A small depth-aware footprint reduces single-pixel shore
                    // shimmer without dragging bank colour across a depth edge.
                    vec3 colour = texture2D(sceneColour, uv).rgb;
                    float weight = 1.0;
                    for (int tap = -1; tap <= 1; tap += 2) {
                        vec2 sampleUV = uv + vec2(float(tap) * 1.25, 0.0) / czm_viewport.zw;
                        float z = czm_unpackDepth(texture2D(sceneDepth, sampleUV));
                        if (z <= 0.0 || z >= 1.0) continue;
                        vec4 tapEye = czm_windowToEyeCoordinates(sampleUV * czm_viewport.zw, z);
                        if (abs(tapEye.z / tapEye.w - sceneEye.z) < max(0.5, thickness * 2.0)) {
                            colour += texture2D(sceneColour, sampleUV).rgb * 0.25;
                            weight += 0.25;
                        }
                    }
                    return vec4(colour / weight, confidence);
                }
            }
            previousDelta = delta;
        }
        previousDistance = distanceAlong;
    }
    return vec4(0.0);
}
`
