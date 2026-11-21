import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from '@/router'

import 'tdesign-vue-next/es/style/index.css'
import '@/style/index.scss'

import 'virtual:uno.css'

import App from '@/App.vue'

const app = createApp(App)

app.use(createPinia())
app.use(router)

app.mount('#app')
