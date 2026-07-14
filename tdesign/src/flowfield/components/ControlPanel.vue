<template>
    <div class="ff-panel">
        <div class="ff-panel-title">数字流场</div>
        <div class="item">
            <span>水面效果</span>
            <t-switch v-model="waterOn" size="small" @change="v => (c.water.show = v)" />
        </div>
        <div class="item">
            <span>粒子效果</span>
            <t-switch v-model="particlesOn" size="small" @change="v => (c.particles.show = v)" />
        </div>
        <div class="item">
            <span>粒子数量</span>
            <t-select v-model="dim" size="small" style="width: 96px" :options="dimOpts" @change="v => c.particles.setCount(v)" />
        </div>
        <div class="item col">
            <span>粒子粗细 {{ width.toFixed(1) }}px</span>
            <t-slider v-model="width" :min="0.5" :max="5" :step="0.1" :label="false" @change="v => c.particles.setWidth(v)" />
        </div>
        <div class="item col">
            <span>水位夸张 ×{{ exagg }}</span>
            <t-slider v-model="exagg" :min="1" :max="200" :step="1" :label="false" @change="onExagg" />
        </div>
        <div class="item">
            <span>着色</span>
            <t-radio-group v-model="colorMode" size="small" variant="default-filled" @change="v => c.water.setColorMode(v)">
                <t-radio-button :value="0">流速</t-radio-button>
                <t-radio-button :value="1">水位</t-radio-button>
            </t-radio-group>
        </div>
        <div class="item">
            <span>配色</span>
            <t-radio-group v-model="palette" size="small" variant="default-filled" @change="v => c.water.setPalette(v)">
                <t-radio-button :value="0">自然</t-radio-button>
                <t-radio-button :value="1">科技蓝</t-radio-button>
            </t-radio-group>
        </div>
        <speed-legend :mode="colorMode" :min="lvMin" :max="lvMax" />
    </div>
</template>

<script setup>
import { ref } from 'vue'
import SpeedLegend from './SpeedLegend.vue'

const props = defineProps({
    controller: { type: Object, required: true }
})
const c = props.controller
const waterOn = ref(true)
const particlesOn = ref(true)
const dim = ref(256)
const width = ref(1.5) // 与 ParticleFlowLayer 默认线宽一致
const exagg = ref(c.exaggeration)
const palette = ref(c.palette)
const colorMode = ref(0)
const lvMin = c.data.meta.stats.levelMin
const lvMax = c.data.meta.stats.levelMax
const dimOpts = [
    { label: '1.6万', value: 128 },
    { label: '6.5万', value: 256 },
    { label: '26万', value: 512 }
]
function onExagg(v) {
    c.exaggeration = v
    c.water.setExaggeration(v)
    c.particles.setExaggeration(v)
}
</script>

<style scoped lang="scss">
.ff-panel {
    position: absolute;
    right: 16px;
    top: 64px;
    width: 236px;
    padding: 12px 14px;
    background: rgba(13, 22, 38, 0.88);
    border: 1px solid rgba(80, 140, 210, 0.35);
    border-radius: 8px;
    color: #d7e6fa;
    font-size: 12px;
    z-index: 4;
    backdrop-filter: blur(6px);
    .ff-panel-title {
        font-size: 14px;
        color: #7df3ff;
        margin-bottom: 10px;
        letter-spacing: 2px;
    }
    .item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 10px;
        &.col {
            flex-direction: column;
            align-items: stretch;
            gap: 4px;
        }
    }
}
</style>
