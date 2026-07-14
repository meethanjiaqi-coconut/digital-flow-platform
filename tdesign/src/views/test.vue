<template>
    <div style="position: absolute; left: 0; top: 0; width: 300px; height: 100%; background: red; z-index: 1">示例，index的子组件
        <t-button @click="handleSwitch">切换</t-button>
    </div>
</template>

<script setup>
import { inject, watch } from 'vue'

const mapRef = inject('getMap')
const syncRef = inject('getSync')

watch(mapRef, () => {
    console.log('子组件获取到viewer对象', mapRef.value)
})

function handleSwitch() {
    const sync = syncRef.value
    sync.enabled = !sync.enabled
}
</script>

<style scoped></style>
