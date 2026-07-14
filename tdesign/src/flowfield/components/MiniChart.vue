<template>
    <svg :width="W" :height="H" class="ff-chart">
        <rect x="0" y="0" :width="W" :height="H" fill="rgba(10,18,32,0.6)" rx="4" />
        <!-- 网格线 -->
        <line v-for="g in 4" :key="g" :x1="PL" :x2="W - PR" :y1="PT + ((H - PT - PB) * g) / 4" :y2="PT + ((H - PT - PB) * g) / 4" stroke="rgba(120,150,190,0.18)" />
        <!-- 水位 / 流速曲线 -->
        <path :d="levelPath" fill="none" stroke="#4aa3ff" stroke-width="1.6" />
        <path :d="speedPath" fill="none" stroke="#ffb84d" stroke-width="1.4" />
        <!-- 当前时刻游标 -->
        <line :x1="cursorX" :x2="cursorX" :y1="PT" :y2="H - PB" stroke="#7df3ff" stroke-width="1" stroke-dasharray="3,2" />
        <!-- 轴标签 -->
        <text :x="PL - 4" :y="PT + 9" class="lab lab-l">{{ lvMax.toFixed(1) }}</text>
        <text :x="PL - 4" :y="H - PB" class="lab lab-l">{{ lvMin.toFixed(1) }}</text>
        <text :x="W - PR + 4" :y="PT + 9" class="lab lab-r">{{ spMax.toFixed(1) }}</text>
        <text :x="W - PR + 4" :y="H - PB" class="lab lab-r">0</text>
        <text :x="PL" :y="H - 4" class="lab lab-t">{{ t0 }}</text>
        <text :x="W - PR" :y="H - 4" class="lab lab-t" text-anchor="end">{{ t1 }}</text>
        <text :x="PL + 4" :y="PT - 4" class="lab" fill="#4aa3ff">水位 m</text>
        <text :x="W - PR - 4" :y="PT - 4" class="lab" fill="#ffb84d" text-anchor="end">流速 m/s</text>
    </svg>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
    levels: { type: Object, required: true },
    speeds: { type: Object, required: true },
    times: { type: Array, required: true },
    currentHour: { type: Number, default: 0 }
})

const W = 340, H = 150, PL = 34, PR = 40, PT = 18, PB = 20

const finite = (arr) => Array.from(arr).filter((v) => Number.isFinite(v))
const lvMin = computed(() => Math.floor(Math.min(...finite(props.levels), 0) * 2) / 2)
const lvMax = computed(() => Math.ceil(Math.max(...finite(props.levels), 0.5) * 2) / 2)
const spMax = computed(() => Math.max(0.5, Math.ceil(Math.max(...finite(props.speeds)) * 2) / 2))

function buildPath(arr, vmin, vmax) {
    const n = arr.length
    const xs = (i) => PL + ((W - PL - PR) * i) / (n - 1)
    const ys = (v) => PT + (H - PT - PB) * (1 - (v - vmin) / (vmax - vmin))
    let d = ''
    let pen = false
    for (let i = 0; i < n; i++) {
        const v = arr[i]
        if (!Number.isFinite(v)) { pen = false; continue }
        d += `${pen ? 'L' : 'M'}${xs(i).toFixed(1)},${ys(v).toFixed(1)}`
        pen = true
    }
    return d
}
const levelPath = computed(() => buildPath(props.levels, lvMin.value, lvMax.value))
const speedPath = computed(() => buildPath(props.speeds, 0, spMax.value))
const cursorX = computed(() => PL + ((W - PL - PR) * Math.min(props.currentHour, props.levels.length - 1)) / (props.levels.length - 1))
const fmt = (iso) => iso.slice(5, 13).replace('T', ' ') + '时'
const t0 = computed(() => fmt(props.times[0]))
const t1 = computed(() => fmt(props.times[props.times.length - 1]))
</script>

<style scoped>
.ff-chart .lab { font-size: 9px; fill: #9fb8d8; }
.ff-chart .lab-l { text-anchor: end; }
.ff-chart .lab-r { text-anchor: start; }
</style>
