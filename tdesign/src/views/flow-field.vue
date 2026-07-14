<template>
    <div>
        <div v-if="state === 'loading'" class="ff-overlay">
            <div class="ff-loading-card">
                <div class="ff-title">正在加载流场数据…</div>
                <t-progress :percentage="percent" :label="true" theme="plump" />
            </div>
        </div>
        <div v-else-if="state === 'error'" class="ff-overlay">
            <div class="ff-loading-card">
                <div class="ff-title">流场数据加载失败:{{ errorMsg }}</div>
                <t-button theme="primary" @click="init">重试</t-button>
            </div>
        </div>
    </div>
</template>

<script setup>
import { inject, onBeforeUnmount, provide, ref, shallowRef, watch } from 'vue'
import { FlowFieldData } from '@/flowfield/FlowFieldData'
import { FlowFieldController } from '@/flowfield/FlowFieldController'
import { WaterSurfacePrimitive } from '@/flowfield/WaterSurfacePrimitive'
import { ParticleFlowLayer } from '@/flowfield/ParticleFlowLayer'

const syncRef = inject('getSync')
const state = ref('loading')
const percent = ref(0)
const errorMsg = ref('')
const dataRef = shallowRef(null)
const controllerRef = shallowRef(null)

provide('flowfieldCtx', { dataRef, controllerRef })

async function init() {
    state.value = 'loading'
    percent.value = 0
    try {
        const data = await FlowFieldData.load('data/flowfield/', (loaded, total) => {
            percent.value = Math.min(100, Math.round((loaded / total) * 100))
        })
        dataRef.value = data
        setupScene(data)
        state.value = 'ready'
    } catch (e) {
        console.error(e)
        errorMsg.value = e.message || String(e)
        state.value = 'error'
    }
}

function setupScene(data) {
    const sync = syncRef.value
    const viewer = sync.viewer
    const controller = (controllerRef.value = new FlowFieldController(viewer, data))
    const water = new WaterSurfacePrimitive(data)
    water.setExaggeration(controller.exaggeration)
    viewer.scene.primitives.add(water)
    controller.addLayer(water)
    controller.water = water
    const particles = new ParticleFlowLayer(data, viewer)
    particles.setExaggeration(controller.exaggeration)
    viewer.scene.primitives.add(particles)
    controller.addLayer(particles)
    controller.particles = particles
    viewer.scene.camera.flyTo({
        destination: SuperMap3D.Cartesian3.fromDegrees(120.9, 29.6, 170000),
        orientation: { heading: 0, pitch: SuperMap3D.Math.toRadians(-55), roll: 0 },
        duration: 2.5
    })
}

const stopWatch = watch(
    syncRef,
    (sync) => {
        if (sync) {
            init()
            stopWatch()
        }
    },
    { immediate: true }
)

onBeforeUnmount(() => {
    controllerRef.value && controllerRef.value.destroy()
})
</script>

<style scoped lang="scss">
.ff-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(8, 14, 26, 0.55);
    z-index: 10;
}
.ff-loading-card {
    width: 360px;
    padding: 24px;
    border-radius: 8px;
    background: rgba(16, 24, 40, 0.92);
    color: #cfe3ff;
    .ff-title {
        margin-bottom: 16px;
        font-size: 14px;
    }
}
</style>
