<template>
    <div class="layout" flex="dir:top box:first">
        <div class="layout-header" flex="box:justify">
            <!-- 左，系统logo -->
            <div class="layout-header__left" flex="cross:center">
                <div class="system-logo">
                    <img src="/images/logo.svg" alt="" />
                </div>
                <div class="system-title">{{ systemTitle }}</div>
            </div>
            <!-- 中，菜单 -->
            <div class="layout-header__center">
                <header-menu v-model:default-active="defaultActive" class="header-menu" :menus="systemStore.menus" />
            </div>
            <!-- 右，工具、用户信息 -->
            <div class="layout-header__right"></div>
        </div>
        <div class="layout-content">
            <router-view />
        </div>
    </div>
</template>

<script setup>
import { computed } from 'vue'
import HeaderMenu from '@/layout/header-menu.vue'
import { useSystemStore } from '@/stores/system.js'
import { useRouter } from 'vue-router'

const router = useRouter()
const systemStore = useSystemStore()

const systemTitle = SYSTEM_CONFIG.SYSTEM_TITLE

const defaultActive = computed(() => {
    const menus = systemStore.menus
    let returnValue
    const currentRoute = router.currentRoute.value
    const isIframe = currentRoute.name === 'IframePageView'
    returnValue = getSelectMenu(menus, currentRoute, isIframe)
    return returnValue
})

function getSelectMenu(menuList, currentRoute, isIframe) {
    if (!Array.isArray(menuList)) return
    let result
    for (let i = 0; i < menuList.length; i++) {
        if (Array.isArray(menuList[i].children) && menuList[i].children.length > 0) {
            result = getSelectMenu(menuList[i].children, currentRoute, isIframe)
            if (result) return result
        } else if (menuList[i].url) {
            if (currentRoute.path === menuList[i].url) {
                return menuList[i].id
            }
            if (isIframe) {
                const id = currentRoute.params.id
                if (menuList[i].id === id) {
                    return menuList[i].id
                }
            }
        }
    }
    return result
}

systemStore.loadMenus()
</script>

<style lang="scss">
@use './layout.scss';
</style>
