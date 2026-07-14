<template>
    <div class="ff-popup">
        <div class="ff-popup-head">
            <span>点位查询</span>
            <t-button size="small" variant="text" theme="default" @click="$emit('close')">✕</t-button>
        </div>
        <div class="ff-popup-body">
            <div class="row"><span class="k">位置</span><span class="v">{{ info.lon.toFixed(5) }}°E, {{ info.lat.toFixed(5) }}°N</span></div>
            <template v-if="info.wet">
                <div class="row big"><span class="k">水位</span><span class="v num">{{ info.level.toFixed(2) }} m</span></div>
                <div class="row big"><span class="k">流速</span><span class="v num">{{ info.speed.toFixed(2) }} m/s</span></div>
                <div class="row"><span class="k">流向</span>
                    <span class="v">{{ compass }} ({{ info.dirDeg.toFixed(0) }}°)
                        <svg width="16" height="16" viewBox="-8 -8 16 16" style="vertical-align: -3px">
                            <g :transform="`rotate(${info.dirDeg})`"><path d="M0,-6 L3,4 L0,2 L-3,4 Z" fill="#7df3ff" /></g>
                        </svg>
                    </span>
                </div>
            </template>
            <div v-else class="row"><span class="v dry">当前时刻该单元干出(无水)</span></div>
            <mini-chart :levels="series.levels" :speeds="series.speeds" :times="times" :current-hour="currentHour" />
        </div>
    </div>
</template>

<script setup>
import { computed } from 'vue'
import MiniChart from './MiniChart.vue'

const props = defineProps({
    info: { type: Object, required: true }, // {lon,lat,level,speed,dirDeg,wet}
    series: { type: Object, required: true }, // {levels,speeds}
    times: { type: Array, required: true },
    currentHour: { type: Number, default: 0 }
})
defineEmits(['close'])

const DIRS = ['北', '北东北', '东北', '东东北', '东', '东东南', '东南', '南东南', '南', '南西南', '西南', '西西南', '西', '西西北', '西北', '北西北']
const compass = computed(() => DIRS[Math.round(props.info.dirDeg / 22.5) % 16])
</script>

<style scoped lang="scss">
.ff-popup {
    position: absolute;
    left: 16px;
    top: 64px;
    width: 372px;
    background: rgba(13, 22, 38, 0.92);
    border: 1px solid rgba(80, 140, 210, 0.35);
    border-radius: 8px;
    color: #d7e6fa;
    z-index: 5;
    backdrop-filter: blur(6px);
}
.ff-popup-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 12px;
    font-size: 14px;
    border-bottom: 1px solid rgba(80, 140, 210, 0.25);
}
.ff-popup-body {
    padding: 10px 14px 14px;
    .row {
        display: flex;
        justify-content: space-between;
        margin-bottom: 6px;
        font-size: 12px;
        &.big .num {
            font-size: 18px;
            font-weight: 600;
            color: #7df3ff;
        }
        .k { color: #8fa8c8; }
        .dry { color: #e6a23c; }
    }
}
</style>
