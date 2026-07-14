<template>
    <t-head-menu
        flex="main:center cross:center"
        :default-value="props.defaultActive"
        expandType="popup"
        @change="handlerSelect"
    >
        <header-menu-group v-for="menuItem in menus" :key="menuItem.id" :menu="menuItem" />
    </t-head-menu>
</template>

<script setup>
import HeaderMenuGroup from '@/layout/header-menu-group.vue'

const props = defineProps({
    menus: {
        type: Array,
        default: () => []
    },
    defaultActive: {
        type: String,
        default: () => ''
    }
})

// eslint-disable-next-line no-unused-vars
function handlerSelect(key, keyPath, item, routeResult) {
    // todo
    // console.log('select', key, keyPath, item, routeResult)
}
</script>
