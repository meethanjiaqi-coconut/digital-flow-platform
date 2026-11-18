import {createApp,h,markRaw} from 'vue'
import {FlowControls} from '../../packages/vue-tdesign/dist/index.js'
import {createDemo} from '../demo.js'
try {
  const flow=markRaw(await createDemo())
  document.querySelector('#status').style.display='none'
  createApp({render:()=>h(FlowControls,{flow})}).mount('#controls')
}catch(e){document.querySelector('#status').textContent=e.message;console.error(e)}
