<template>
    <div class="ff-legend">
        <div class="bar"></div>
        <div class="ticks">
            <span>0</span><span>0.6</span><span>1.2</span><span>1.9</span><span>2.5+ m/s</span>
        </div>
    </div>
</template>

<script setup></script>

<style scoped lang="scss">
.ff-legend {
    margin-top: 4px;
    .bar {
        height: 8px;
        border-radius: 4px;
        /* 与粒子色带 rampCanvas 同源 */
        background: linear-gradient(to right, #12345f, #1e6fd9, #00c8ff, #7df3ff, #ffffff);
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
