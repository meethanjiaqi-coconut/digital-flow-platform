<!--
 * @name FlowFieldLegend
 * @desc 与三维流场着色规则一致的数值图例。
-->
<template>
    <div class="field-legend">
        <div class="field-legend__head">
            <span>{{ mode === 0 ? '流速强度' : '水位高程' }}</span>
            <span>{{ mode === 0 ? '米/秒' : '米' }}</span>
        </div>
        <div class="field-legend__bar" :style="{ background: gradient }">
            <i v-for="tick in 5" :key="tick"></i>
        </div>
        <div v-if="mode === 0" class="field-legend__ticks">
            <span>0</span>
            <span>{{ (speedMax * 0.25).toFixed(1) }}</span>
            <span>{{ (speedMax * 0.5).toFixed(1) }}</span>
            <span>{{ (speedMax * 0.75).toFixed(1) }}</span>
            <span>{{ speedMax.toFixed(1) }}</span>
        </div>
        <div v-else class="field-legend__ticks field-legend__ticks--level">
            <span>{{ min.toFixed(1) }}</span>
            <span>{{ ((min + max) / 2).toFixed(1) }}</span>
            <span>{{ max.toFixed(1) }}</span>
        </div>
    </div>
</template>

<script setup>
import { computed } from 'vue'
import { LEVEL_COLOR_STOPS, SPEED_COLOR_STOPS, toLinearGradient } from '../flowColorRamps.js'

const props = defineProps({
    max: {
        type: Number,
        default: 3
    },
    min: {
        type: Number,
        default: -2
    },
    mode: {
        type: Number,
        default: 0
    },
    speedMax: {
        type: Number,
        default: 2.5
    }
})

const gradient = computed(() => toLinearGradient(props.mode === 0 ? SPEED_COLOR_STOPS : LEVEL_COLOR_STOPS))
</script>

<style lang="scss" scoped>
.field-legend {
    padding: 8px 12px;
    background: var(--td-bg-color-secondarycontainer, #f3f4f7);
    border: 1px solid var(--td-component-stroke, var(--basic-border-color, #d2d2d2));
    border-radius: var(--td-radius-default, 3px);
}

.field-legend__head {
    display: flex;
    justify-content: space-between;
    margin-bottom: 8px;
    color: var(--td-text-color-secondary, var(--el-text-color-primary));
    font-size: 12px;
}

.field-legend__bar {
    position: relative;
    display: flex;
    height: 8px;
    border-radius: 2px;

    i {
        position: relative;
        flex: 1;

        &::after {
            position: absolute;
            top: 9px;
            right: 0;
            width: 1px;
            height: 3px;
            content: '';
            background: var(--td-text-color-placeholder, rgba(0, 0, 0, 0.35));
        }
    }
}

.field-legend__ticks {
    display: flex;
    justify-content: space-between;
    margin-top: 6px;
    color: var(--td-text-color-secondary, var(--el-text-color-primary));
    font-size: 11px;

    &--level span:nth-child(2) {
        margin-right: auto;
        margin-left: auto;
    }
}
</style>
