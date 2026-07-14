<template>
    <t-menu-item :value="menu.id" @click="handleMenuItemClick">{{ menu.text }}</t-menu-item>
</template>

<script setup>
import { useRouter } from 'vue-router'

const router = useRouter()
const props = defineProps({
    menu: {
        type: Object,
        default: () => {}
    }
})

function handleMenuItemClick() {
    const menu = props.menu
    switch (menu.type) {
        case 'location':
            router.replace({
                name: 'IframePageView',
                params: {
                    id: menu.id
                }
            })
            break
        case 'location_blank':
            window.open(menu.url)
            break
        case 'route':
        default:
            router.replace(menu.url)
            break
    }
}
</script>

<style scoped></style>
