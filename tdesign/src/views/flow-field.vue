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
        <template v-if="state === 'ready'">
            <control-panel :controller="controllerRef" />
            <timeline-bar :controller="controllerRef" />
            <query-popup
                v-if="query.visible"
                :info="queryInfo"
                :series="query.series"
                :times="dataRef.meta.times"
                :current-hour="currentHour"
                @close="closeQuery"
            />
        </template>
    </div>
</template>

<script setup>
/* global SuperMap3D */
import { computed, inject, onBeforeUnmount, reactive, ref, shallowRef, watch } from 'vue'
import { MessagePlugin } from 'tdesign-vue-next'
import { FlowFieldData } from '@/flowfield/FlowFieldData'
import { FlowFieldController } from '@/flowfield/FlowFieldController'
import { WaterSurfacePrimitive } from '@/flowfield/WaterSurfacePrimitive'
import { ParticleFlowLayer } from '@/flowfield/ParticleFlowLayer'
import ControlPanel from '@/flowfield/components/ControlPanel.vue'
import TimelineBar from '@/flowfield/components/TimelineBar.vue'
import QueryPopup from '@/flowfield/components/QueryPopup.vue'

const syncRef = inject('getSync')
const state = ref('loading')
const percent = ref(0)
const errorMsg = ref('')
const dataRef = shallowRef(null)
const controllerRef = shallowRef(null)
const currentHour = ref(0)
const query = reactive({ visible: false, cell: -1, lon: 0, lat: 0, series: null })
let clickHandler = null
let marker = null

const queryInfo = computed(() => {
    if (query.cell < 0) return null
    const s = dataRef.value.sampleCell(query.cell, currentHour.value)
    return { ...s, lon: query.lon, lat: query.lat }
})

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
    controller.onChange((h) => (currentHour.value = h))

    viewer.scene.camera.flyTo({
        destination: SuperMap3D.Cartesian3.fromDegrees(120.9, 29.6, 170000),
        orientation: { heading: 0, pitch: SuperMap3D.Math.toRadians(-55), roll: 0 },
        duration: 2.5
    })
    setupPicking(viewer, data)
}

function setupPicking(viewer, data) {
    clickHandler = new SuperMap3D.ScreenSpaceEventHandler(viewer.scene.canvas)
    clickHandler.setInputAction((movement) => {
        let cartesian
        try {
            cartesian = viewer.scene.pickPosition(movement.position)
        } catch (e) { /* pickPosition 在无深度处可能异常 */ }
        if (!cartesian) cartesian = viewer.scene.camera.pickEllipsoid(movement.position, SuperMap3D.Ellipsoid.WGS84)
        if (!cartesian) return
        const carto = SuperMap3D.Cartographic.fromCartesian(cartesian)
        const lon = SuperMap3D.Math.toDegrees(carto.longitude)
        const lat = SuperMap3D.Math.toDegrees(carto.latitude)
        const cell = data.pickCell(lon, lat)
        if (cell < 0) {
            MessagePlugin.warning('该位置无模型数据')
            return
        }
        query.cell = cell
        query.lon = lon
        query.lat = lat
        query.series = data.series(cell)
        query.visible = true
        placeMarker(viewer, lon, lat)
    }, SuperMap3D.ScreenSpaceEventType.LEFT_CLICK)
}

function placeMarker(viewer, lon, lat) {
    const pos = SuperMap3D.Cartesian3.fromDegrees(lon, lat, 30)
    if (!marker) {
        marker = viewer.entities.add({
            position: pos,
            point: {
                pixelSize: 10,
                color: SuperMap3D.Color.fromCssColorString('#7df3ff'),
                outlineColor: SuperMap3D.Color.WHITE,
                outlineWidth: 2,
                disableDepthTestDistance: Number.POSITIVE_INFINITY
            }
        })
    } else {
        marker.position = pos
    }
}

function closeQuery() {
    query.visible = false
    if (marker) {
        syncRef.value.viewer.entities.remove(marker)
        marker = null
    }
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
    clickHandler && clickHandler.destroy()
    closeQuery()
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
