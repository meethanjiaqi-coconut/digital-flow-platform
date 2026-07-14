<template>
    <i :class="svgClass" :style="style" v-bind="$attrs"></i>
</template>

<script setup>
import { computed } from 'vue'
import './index.scss'

const props = defineProps({
    iconClass: {
        type: String,
        required: true
    },
    className: {
        type: String,
        default: ''
    },
    size: {
        type: Number,
        default: 24
    },
    sizeUnit: {
        type: String,
        default: 'px'
    },
    color: {
        type: String,
        default: '#000'
    }
})

const svgClass = computed(() => {
    let className = 'svg-icon'
    if (props.iconClass) {
        className += ` i-svg:${props.iconClass}`
    }
    if (props.className) {
        className += ` ${props.className}`
    }
    return className
})

const style = computed(() => {
    let colorStyle = {}
    if (props.color) {
        colorStyle = {
            color: props.color
        }
    }
    return {
        width: `${props.size}${props.sizeUnit}`,
        height: `${props.size}${props.sizeUnit}`,
        ...colorStyle
    }
})
</script>

<style lang="scss"></style>
