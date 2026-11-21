import { createRouter, createWebHashHistory } from 'vue-router'
import routes from '@/router/routes.js'

const router = createRouter({
    history: createWebHashHistory(import.meta.env.BASE_URL),
    routes: routes
})

export default router
