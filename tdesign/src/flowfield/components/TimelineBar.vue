<template>
    <div class="ff-timeline">
        <t-button shape="circle" theme="primary" size="small" @click="togglePlay">
            <template #icon><span class="btn-ico">{{ playing ? '⏸' : '▶' }}</span></template>
        </t-button>
        <t-select v-model="speed" size="small" class="speed-sel" :options="speedOpts" @change="onSpeed" />
        <div class="slider-wrap">
            <t-slider v-model="hour" :min="0" :max="maxHour" :step="0.1" :label="false" @change="onSlide" />
        </div>
        <div class="time-label">{{ timeLabel }}</div>
    </div>
</template>

<script setup>
import { onBeforeUnmount, ref } from 'vue'

const props = defineProps({
    controller: { type: Object, required: true }
})

const c = props.controller
const playing = ref(c.playing)
const speed = ref(c.speed)
const hour = ref(c.simHour)
const maxHour = c.data.nFrames - 1
const timeLabel = ref(c.timeLabel())
const speedOpts = [1, 2, 4, 8].map((v) => ({ label: `${v}×`, value: v }))

function togglePlay() {
    c.playing = !c.playing
    playing.value = c.playing
}
function onSpeed(v) {
    c.speed = v
}
function onSlide(v) {
    c.setHour(Number(v))
}
function onExternal(h) {
    hour.value = Math.round(h * 10) / 10
    timeLabel.value = c.timeLabel()
}
c.onChange(onExternal)
onBeforeUnmount(() => c.offChange(onExternal))
</script>

<style scoped lang="scss">
.ff-timeline {
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    bottom: 18px;
    width: min(760px, 82vw);
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 18px;
    background: rgba(13, 22, 38, 0.88);
    border: 1px solid rgba(80, 140, 210, 0.35);
    border-radius: 24px;
    z-index: 5;
    backdrop-filter: blur(6px);
    .btn-ico { font-size: 12px; }
    .speed-sel { width: 76px; }
    .slider-wrap { flex: 1; padding: 0 6px; }
    .time-label {
        min-width: 128px;
        text-align: right;
        color: #7df3ff;
        font-size: 13px;
        font-variant-numeric: tabular-nums;
    }
}
</style>
