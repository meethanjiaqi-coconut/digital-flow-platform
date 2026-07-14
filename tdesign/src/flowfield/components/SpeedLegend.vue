<template>
    <div class="ff-legend">
        <template v-if="mode === 0">
            <div class="bar speed"></div>
            <div class="ticks">
                <span>0</span>
                <span>{{ (speedMax * 0.25).toFixed(1) }}</span>
                <span>{{ (speedMax * 0.5).toFixed(1) }}</span>
                <span>{{ (speedMax * 0.75).toFixed(1) }}</span>
                <span>{{ speedMax.toFixed(1) }} m/s</span>
            </div>
        </template>
        <template v-else>
            <div class="bar level"></div>
            <div class="ticks">
                <span>{{ min.toFixed(1) }}</span>
                <span>{{ ((min + max) / 2).toFixed(1) }}</span>
                <span>{{ max.toFixed(1) }} m</span>
            </div>
        </template>
    </div>
</template>

<script setup>
defineProps({
    mode: { type: Number, default: 0 }, // 0=流速 1=水位
    min: { type: Number, default: -3.5 },
    max: { type: Number, default: 6.5 },
    speedMax: { type: Number, default: 2.5 }
})
</script>

<style scoped lang="scss">
.ff-legend {
    margin-top: 4px;
    .bar {
        height: 8px;
        border-radius: 4px;
        /* 与粒子色带 rampCanvas 同源 */
        &.speed {
            background: linear-gradient(to right, #12345f, #1e6fd9, #00c8ff, #7df3ff, #ffffff);
        }
        /* 与水面水位云图 shader 色带同源 */
        &.level {
            background: linear-gradient(to right, #1035aa, #00c7ff, #7dffb0, #ffe85c, #ff5c3d);
        }
    }
    .ticks {
        display: flex;
        justify-content: space-between;
        font-size: 10px;
        color: #8fa8c8;
        margin-top: 2px;
    }
}
</style>
