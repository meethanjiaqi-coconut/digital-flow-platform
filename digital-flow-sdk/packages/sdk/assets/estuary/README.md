# Estuary water source assets

Pinned upstream: [three.js r180](https://github.com/mrdoob/three.js/tree/r180), MIT.

- `Water_1_M_Normal.jpg`: `examples/textures/water/Water_1_M_Normal.jpg`
  - Git blob SHA-1: `40226fbc32b09604c8ffbd96a5ea676a3f75a116`
  - SHA-256: `6d7825469a374ff84700b4fb1a2890bd1fce0ca1f777bdd4d5ecdaf15833a804`
- `Water_2_M_Normal.jpg`: `examples/textures/water/Water_2_M_Normal.jpg`
  - Git blob SHA-1: `809b500206cd20f96ca8898581f51f87f744a8ab`
  - SHA-256: `1f6f3fc5af584fb3ad7ff97df39b1835aaa184f53bf647c63120a83be7d63183`

These files are copied without image editing. Both are 512 x 512 and served locally. No runtime CDN request or three.js dependency is introduced. Keep `LICENSE-threejs.txt` with the assets and adapted code in distributions.

## Adaptation

`src/flowfield/estuaryWaterMaterial.js` adapts the staggered two-phase normal-map blending and Schlick Fresnel approach from:

- https://github.com/mrdoob/three.js/blob/r180/examples/jsm/objects/Water2.js
- https://github.com/mrdoob/three.js/blob/r180/examples/jsm/objects/Water.js

The original Three render targets, cameras and geometry are not used. Our adapter retains SuperMap3D/W3D, actual hydrodynamic U/V, wet/dry mask and pauseable clock. The local daylight sky approximation, microfacet lighting and world-anchored LOD integration are application-specific. Sky reflection is approximate, not a reflection render of shoreline buildings. The visual wave scale/speed is exaggerated for regional map viewing; it is not measured wave-height, wind, solar irradiance or sediment data.