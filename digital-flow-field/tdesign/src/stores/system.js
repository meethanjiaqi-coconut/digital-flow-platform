import { ref } from 'vue'
import { defineStore } from 'pinia'
import { RequestGet } from '@/utils/Request.js'

export const useSystemStore = defineStore('system', () => {
    const menus = ref([])

    async function loadMenus() {
        menus.value = await RequestGet(APIS.SYSTEM.MENU)
    }

    return {
        menus,
        loadMenus
    }
})
