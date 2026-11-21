<!--
 * @name FlowFieldMiniChart
 * @desc 点选单元的水位、流速过程线和当前时次游标。
-->
<template>
    <svg class="flow-mini-chart" viewBox="0 0 360 166" role="img" aria-label="水位与流速过程线">
        <defs>
            <linearGradient id="flow-chart-level-fill" x1="0" y1="0" x2="0" y2="1">
                <stop class="level-fill-start" offset="0" />
                <stop class="level-fill-end" offset="1" />
            </linearGradient>
        </defs>

        <rect x="0.5" y="0.5" width="359" height="165" rx="3" class="chart-frame" />
        <line
            v-for="grid in 4"
            :key="grid"
            :x1="PADDING_LEFT"
            :x2="WIDTH - PADDING_RIGHT"
            :y1="PADDING_TOP + ((HEIGHT - PADDING_TOP - PADDING_BOTTOM) * grid) / 4"
            :y2="PADDING_TOP + ((HEIGHT - PADDING_TOP - PADDING_BOTTOM) * grid) / 4"
            class="chart-grid"
        />
        <line
            v-for="grid in 6"
            :key="`vertical-${grid}`"
            :x1="PADDING_LEFT + ((WIDTH - PADDING_LEFT - PADDING_RIGHT) * grid) / 6"
            :x2="PADDING_LEFT + ((WIDTH - PADDING_LEFT - PADDING_RIGHT) * grid) / 6"
            :y1="PADDING_TOP"
            :y2="HEIGHT - PADDING_BOTTOM"
            class="chart-grid chart-grid--vertical"
        />

        <path v-if="levelAreaPath" :d="levelAreaPath" class="level-area" />
        <path :d="levelPath" class="level-line" />
        <path :d="speedPath" class="speed-line" />
        <line :x1="cursorX" :x2="cursorX" :y1="PADDING_TOP" :y2="HEIGHT - PADDING_BOTTOM" class="chart-cursor" />
        <circle v-if="Number.isFinite(currentLevelY)" :cx="cursorX" :cy="currentLevelY" r="3.2" class="cursor-point cursor-point--level" />
        <circle v-if="Number.isFinite(currentSpeedY)" :cx="cursorX" :cy="currentSpeedY" r="3" class="cursor-point cursor-point--speed" />

        <text :x="PADDING_LEFT - 5" :y="PADDING_TOP + 8" class="chart-label chart-label--left">{{ levelMax.toFixed(1) }}</text>
        <text :x="PADDING_LEFT - 5" :y="HEIGHT - PADDING_BOTTOM" class="chart-label chart-label--left">{{ levelMin.toFixed(1) }}</text>
        <text :x="WIDTH - PADDING_RIGHT + 5" :y="PADDING_TOP + 8" class="chart-label">{{ speedMax.toFixed(1) }}</text>
        <text :x="WIDTH - PADDING_RIGHT + 5" :y="HEIGHT - PADDING_BOTTOM" class="chart-label">0</text>
        <text :x="PADDING_LEFT" :y="HEIGHT - 5" class="chart-label">{{ startLabel }}</text>
        <text :x="WIDTH - PADDING_RIGHT" :y="HEIGHT - 5" text-anchor="end" class="chart-label">{{ endLabel }}</text>
        <text :x="PADDING_LEFT + 4" :y="PADDING_TOP - 5" class="series-label series-label--level">水位（米）</text>
        <text :x="WIDTH - PADDING_RIGHT - 4" :y="PADDING_TOP - 5" text-anchor="end" class="series-label series-label--speed">
            流速（米/秒）
        </text>
    </svg>
</template>

<script setup>
import { computed } from 'vue'
import { timeAtFrame, formatFlowTime } from '../flowTime.js'

const props = defineProps({
    currentHour: {
        type: Number,
        default: 0
    },
    levels: {
        type: [Array, Object],
        required: true
    },
    speeds: {
        type: [Array, Object],
        required: true
    },
    times: {
        type: Array,
        required: true
    }
})

const WIDTH = 360
const HEIGHT = 166
const PADDING_LEFT = 35
const PADDING_RIGHT = 39
const PADDING_TOP = 22
const PADDING_BOTTOM = 23

const finiteValues = values => Array.from(values || []).filter(value => Number.isFinite(value))

const levelMin = computed(() => {
    const values = finiteValues(props.levels)
    return Math.floor(Math.min(...values, 0) * 2) / 2
})

const levelMax = computed(() => {
    const values = finiteValues(props.levels)
    return Math.ceil(Math.max(...values, 0.5) * 2) / 2
})

const speedMax = computed(() => {
    const values = finiteValues(props.speeds)
    return Math.max(0.5, Math.ceil(Math.max(...values, 0.5) * 2) / 2)
})

const cursorIndex = computed(() => Math.max(0, Math.min(props.levels.length - 1, props.currentHour)))
const cursorX = computed(() => xForIndex(cursorIndex.value, props.levels.length))
const currentLevelY = computed(() => yForValue(interpolatedValue(props.levels, cursorIndex.value), levelMin.value, levelMax.value))
const currentSpeedY = computed(() => yForValue(interpolatedValue(props.speeds, cursorIndex.value), 0, speedMax.value))
const levelPath = computed(() => buildPath(props.levels, levelMin.value, levelMax.value))
const speedPath = computed(() => buildPath(props.speeds, 0, speedMax.value))
const levelAreaPath = computed(() => buildAreaPath(props.levels, levelMin.value, levelMax.value))
const startLabel = computed(() => formatTime(props.times[0]))
const endLabel = computed(() => formatTime(props.times[props.times.length - 1]))

function xForIndex(index, length) {
    const start = timeAtFrame(props.times, 0)
    const duration = timeAtFrame(props.times, length - 1) - start
    const ratio = duration > 0 ? (timeAtFrame(props.times, index) - start) / duration : 0
    return PADDING_LEFT + (WIDTH - PADDING_LEFT - PADDING_RIGHT) * ratio
}

function yForValue(value, min, max) {
    if (!Number.isFinite(value)) return Number.NaN
    const range = Math.max(0.0001, max - min)
    return PADDING_TOP + (HEIGHT - PADDING_TOP - PADDING_BOTTOM) * (1 - (value - min) / range)
}

function interpolatedValue(values, index) {
    const first = Math.floor(index)
    const second = Math.min(values.length - 1, first + 1)
    const firstValue = Number(values[first])
    const secondValue = Number(values[second])
    if (!Number.isFinite(firstValue) && !Number.isFinite(secondValue)) return Number.NaN
    if (!Number.isFinite(firstValue)) return secondValue
    if (!Number.isFinite(secondValue)) return firstValue
    return firstValue + (secondValue - firstValue) * (index - first)
}

function buildPath(values, min, max) {
    let path = ''
    let isDrawing = false
    Array.from(values || []).forEach((value, index) => {
        if (!Number.isFinite(value)) {
            isDrawing = false
            return
        }
        const x = xForIndex(index, values.length)
        const y = yForValue(value, min, max)
        path += `${isDrawing ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`
        isDrawing = true
    })
    return path
}

function buildAreaPath(values, min, max) {
    const baseline = HEIGHT - PADDING_BOTTOM
    const segments = []
    let line = '', firstX = 0, lastX = 0
    const close = () => {
        if (line) segments.push(`${line}L${lastX.toFixed(1)},${baseline}L${firstX.toFixed(1)},${baseline}Z`)
        line = ''
    }
    Array.from(values || []).forEach((value, index) => {
        if (!Number.isFinite(value)) { close(); return }
        const x = xForIndex(index, values.length)
        const y = yForValue(value, min, max)
        if (!line) firstX = x
        line += `${line ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`
        lastX = x
    })
    close()
    return segments.join('')
}
function formatTime(value) {
    return formatFlowTime(value, { compact: true })
}
</script>

<style lang="scss" scoped>
.flow-mini-chart {
    display: block;
    width: 100%;
    height: auto;
    overflow: visible;
}

.chart-frame {
    fill: var(--td-bg-color-secondarycontainer, #f3f4f7);
    stroke: var(--td-component-stroke, var(--basic-border-color, #d2d2d2));
}

.chart-grid {
    stroke: var(--td-component-stroke, rgba(0, 0, 0, 0.14));
    stroke-width: 0.7;

    &--vertical {
        stroke-dasharray: 2 4;
    }
}

.level-fill-start {
    stop-color: var(--basic-color, var(--td-brand-color, #0052d9));
    stop-opacity: 0.18;
}

.level-fill-end {
    stop-color: var(--basic-color, var(--td-brand-color, #0052d9));
    stop-opacity: 0;
}

.level-area {
    fill: url('#flow-chart-level-fill');
}

.level-line,
.speed-line {
    fill: none;
    stroke-linecap: round;
    stroke-linejoin: round;
}

.level-line {
    stroke: var(--basic-color, var(--td-brand-color, #0052d9));
    stroke-width: 1.8;
}

.speed-line {
    stroke: var(--td-warning-color, #ed7b2f);
    stroke-width: 1.6;
}

.chart-cursor {
    stroke: var(--td-text-color-primary, rgba(0, 0, 0, 0.9));
    stroke-dasharray: 3 3;
    stroke-width: 1;
}

.cursor-point {
    stroke: var(--main-page-bg-color, #fff);
    stroke-width: 1.4;

    &--level {
        fill: var(--basic-color, var(--td-brand-color, #0052d9));
    }

    &--speed {
        fill: var(--td-warning-color, #ed7b2f);
    }
}

.chart-label {
    fill: var(--td-text-color-secondary, rgba(0, 0, 0, 0.6));
    font-size: 8px;

    &--left {
        text-anchor: end;
    }
}

.series-label {
    font-family: var(--basic-font-family);
    font-size: 9px;

    &--level {
        fill: var(--basic-color, var(--td-brand-color, #0052d9));
    }

    &--speed {
        fill: var(--td-warning-color, #ed7b2f);
    }
}
</style>
