<template>
    <t-submenu v-if="isSubMenu(menu)" :value="menu.id" :popupProps="{}">
        <template #title>
            <span>{{ menu.text }}</span>
        </template>
        <header-menu-group v-for="menuItem in menu.children" :key="menuItem.id" :menu="menuItem"></header-menu-group>
    </t-submenu>
    <header-menu-item v-else :menu="menu"></header-menu-item>
</template>

<script setup>
import HeaderMenuItem from '@/layout/header-menu-item.vue'

defineProps({
    menu: {
        type: Object,
        default: () => {}
    }
})
function isSubMenu(menuItem) {
    return menuItem.children && Array.isArray(menuItem.children)
}
</script>
