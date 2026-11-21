import { createApp, h, markRaw } from 'vue'
import { DigitalFlowField } from '../../packages/vue-tdesign/dist/index.js'
import { createDemo } from '../demo.js'

try {
  const flow = markRaw(await createDemo())
  const viewer = markRaw(globalThis.sdkDemo.viewer)
  const S = globalThis.SuperMap3D
  document.querySelector('#status').style.display = 'none'
  createApp({
    render: () => h(DigitalFlowField, {
      flow,
      viewer,
      showLocate: true,
      onLocate: () => {
        viewer.camera.flyTo({
          destination: S.Cartesian3.fromDegrees(120.65, 30.35, 125000),
          orientation: { heading: 0, pitch: -Math.PI / 2, roll: 0 },
          duration: 1.0
        })
      }
    })
  }).mount('#controls')
} catch (e) {
  document.querySelector('#status').textContent = e.message
  console.error(e)
}
