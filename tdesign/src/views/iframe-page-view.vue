<template>
    <div class="iframe-page">
        <iframe :style="iframeStyle" :src="menuUrl" :frameborder="0"></iframe>
    </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useSystemStore } from '@/stores/system.js'

const router = useRouter()
const systemStore = useSystemStore()

const menuUrl = computed(() => {
    const currentRoute = router.currentRoute.value
    const id = currentRoute.params.id
    return getMenuUrlById(systemStore.menus, id)
})

const iframeStyle = computed(() => {
    // todo 如果配置了header的高度则计算之后再返回
    return {}
})

function getMenuUrlById(menus, id) {
    if (!Array.isArray(menus)) return
    let result
    for (let i = 0; i < menus.length; i++) {
        if (menus[i].id === id) {
            return menus[i].url
        } else if (menus[i].children && Array.isArray(menus[i].children) && menus[i].children.length > 0) {
            result = getMenuUrlById(menus[i].children, id)
            if (result) return result
        }
    }
    return result
}
</script>

<style scoped lang="scss">
.iframe-page {
    position: relative;
    width: 100%;
    height: 100%;

    iframe {
        width: 100%;
        height: 100%;
    }
}
</style>
