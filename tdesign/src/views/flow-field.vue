<template>
    <div class="ff-workspace">
        <control-panel
            v-if="panelOpen"
            v-model="selectedScenario"
            :controller="controllerRef"
            :state="state"
            :progress="percent"
            :error-message="errorMsg"
            :scenario="selectedScenarioInfo"
            :scenario-options="scenarioOptions"
            :scenario-loading="scenarioLoading"
            :current-time="currentTimeLabel"
            :buffering="buffering"
            :tidal-front-active="tidalFrontActive"
            :tidal-mix-active="tidalMixActive"
            :tidal-status="tidalStatus"
            @retry="loadScenario(selectedScenario || undefined)"
            @locate="locateFlow"
            @close="panelOpen = false"
        />
        <t-button v-else class="ff-reopen" theme="primary" @click="panelOpen = true">展开流场面板</t-button>
        <template v-if="state === 'ready'">
            <timeline-bar :key="dataRef.scenarioId" :controller="controllerRef" :class="{ 'is-wide': !panelOpen }" />
            <query-popup
                v-if="query.visible"
                :info="queryInfo"
                :series="query.series"
                :loading="query.loading"
                :times="dataRef.meta.times"
                :current-hour="currentHour"
                @close="closeQuery"
            />
        </template>
    </div>
</template>

<script setup>
/* global SuperMap3D, AbortController */
import { computed, inject, onBeforeUnmount, reactive, ref, shallowRef, watch } from 'vue'
import { MessagePlugin } from 'tdesign-vue-next'
import { FlowFieldData, resolveFlowApiBase } from '@/flowfield/FlowFieldData'
import { FlowFieldController } from '@/flowfield/FlowFieldController'
import { W3dWaterSurfaceLayer } from '@/flowfield/W3dWaterSurfaceLayer'
import { ParticleFlowLayer } from '@/flowfield/ParticleFlowLayer'
import { TidalFrontLayer } from '@/flowfield/tidal-front-layer'
import ControlPanel from '@/flowfield/components/ControlPanel.vue'
import TimelineBar from '@/flowfield/components/TimelineBar.vue'
import QueryPopup from '@/flowfield/components/QueryPopup.vue'

const syncRef = inject('getSync')
const apiBase = resolveFlowApiBase()
const state = ref('loading')
const percent = ref(0)
const errorMsg = ref('')
const dataRef = shallowRef(null)
const controllerRef = shallowRef(null)
const currentHour = ref(0)
const panelOpen = ref(true)
const buffering = ref(true)
const tidalFrontActive = ref(false)
const tidalMixActive = ref(false)
const tidalStatus = ref('unavailable')
const scenarios = ref([])
const scenarioLoading = ref(false)
const selectedScenario = ref('')
const query = reactive({ visible: false, cell: -1, lon: 0, lat: 0, series: null, loading: false })
let clickHandler = null
let marker = null
let seriesController = null
let loadController = null
let loadGeneration = 0

const scenarioOptions = computed(() =>
    scenarios.value.map(item => ({
        value: item.id,
        label: item.name
    }))
)
const selectedScenarioInfo = computed(() => scenarios.value.find(item => item.id === selectedScenario.value))
const currentTimeLabel = computed(() => {
    void currentHour.value
    return controllerRef.value?.timeLabel() || '--'
})

const queryInfo = computed(() => {
    if (query.cell < 0 || !dataRef.value) return null
    const sample = dataRef.value.sampleCell(query.cell, currentHour.value)
    return sample ? { ...sample, lon: query.lon, lat: query.lat } : null
})

function formatScenarioTime(value) {
    if (!value) return ''
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString()
}

async function refreshScenarios(signal) {
    scenarioLoading.value = true
    try {
        const result = await FlowFieldData.listScenarios(apiBase, signal)
        scenarios.value = Array.isArray(result) ? result : []
    } catch (error) {
        if (error.name !== 'AbortError') console.error('流场场次列表加载失败', error)
        throw error
    } finally {
        scenarioLoading.value = false
    }
}

async function loadScenario(scenarioId) {
    loadController && loadController.abort()
    const requestController = new AbortController()
    loadController = requestController
    const generation = ++loadGeneration
    state.value = 'loading'
    percent.value = 0
    errorMsg.value = ''
    closeQuery()
    try {
        if (!scenarios.value.length) await refreshScenarios(requestController.signal)
        const previousData = dataRef.value
        const data = await FlowFieldData.load(
            apiBase,
            (loaded, total) => {
                if (generation === loadGeneration) percent.value = Math.round((loaded / total) * 100)
            },
            scenarioId,
            previousData,
            requestController.signal
        )
        if (generation !== loadGeneration) {
            data.destroy()
            return
        }
        teardownScene()
        dataRef.value = data
        selectedScenario.value = data.scenarioId
        setupScene(data)
        state.value = 'ready'
    } catch (error) {
        if (generation !== loadGeneration || error.name === 'AbortError') return
        console.error(error)
        errorMsg.value = error.message || String(error)
        state.value = 'error'
    } finally {
        if (loadController === requestController) loadController = null
    }
}

function setupScene(data) {
    const viewer = syncRef.value.viewer
    const controller = (controllerRef.value = new FlowFieldController(viewer, data))
    const water = new W3dWaterSurfaceLayer(viewer, data)
    water.setExaggeration(controller.exaggeration)
    controller.addLayer(water)
    controller.water = water
    const tidalFront = new TidalFrontLayer(data, viewer)
    tidalFront.show = false
    tidalFront.setExaggeration(controller.exaggeration)
    viewer.scene.primitives.add(tidalFront)
    controller.tidalFront = tidalFront
    controller.addLayer(tidalFront)
    const particles = new ParticleFlowLayer(data, viewer)
    particles.setExaggeration(controller.exaggeration)
    viewer.scene.primitives.add(particles)
    controller.addLayer(particles)
    controller.particles = particles
    controller.onChange((hour, pending, frontActive, mixActive, frontStatus) => {
        currentHour.value = hour
        buffering.value = pending
        tidalFrontActive.value = frontActive
        tidalMixActive.value = Boolean(mixActive)
        tidalStatus.value = frontStatus || 'unavailable'
    })
    currentHour.value = 0
    locateFlow()
    setupPicking(viewer, data)
}

function locateFlow() {
    const viewer = syncRef.value?.viewer
    if (!viewer) return
    viewer.scene.camera.flyTo({
        destination: SuperMap3D.Cartesian3.fromDegrees(120.65, 29.9, 90000),
        orientation: { heading: 0, pitch: SuperMap3D.Math.toRadians(-65), roll: 0 },
        duration: 1.2
    })
}

function setupPicking(viewer, data) {
    clickHandler && clickHandler.destroy()
    clickHandler = new SuperMap3D.ScreenSpaceEventHandler(viewer.scene.canvas)
    clickHandler.setInputAction(async movement => {
        let cartesian
        try {
            cartesian = viewer.scene.pickPosition(movement.position)
        } catch {
            // 无深度值时回退到椭球面拾取。
        }
        if (!cartesian) cartesian = viewer.scene.camera.pickEllipsoid(movement.position, SuperMap3D.Ellipsoid.WGS84)
        if (!cartesian) return
        const cartographic = SuperMap3D.Cartographic.fromCartesian(cartesian)
        const lon = SuperMap3D.Math.toDegrees(cartographic.longitude)
        const lat = SuperMap3D.Math.toDegrees(cartographic.latitude)
        const cell = data.pickCell(lon, lat)
        if (cell < 0) {
            MessagePlugin.warning('该位置无模型数据')
            return
        }
        seriesController && seriesController.abort()
        const requestController = new AbortController()
        seriesController = requestController
        query.cell = cell
        query.lon = lon
        query.lat = lat
        query.series = null
        query.loading = true
        query.visible = true
        placeMarker(viewer, lon, lat)
        try {
            const series = await data.series(cell, requestController.signal)
            if (seriesController === requestController && !requestController.signal.aborted) query.series = series
        } catch (error) {
            if (error.name !== 'AbortError') MessagePlugin.error(`过程线加载失败：${error.message}`)
        } finally {
            if (seriesController === requestController) query.loading = false
        }
    }, SuperMap3D.ScreenSpaceEventType.LEFT_CLICK)
}

function placeMarker(viewer, lon, lat) {
    const position = SuperMap3D.Cartesian3.fromDegrees(lon, lat, 30)
    if (!marker) {
        marker = viewer.entities.add({
            position,
            point: {
                pixelSize: 10,
                color: SuperMap3D.Color.fromCssColorString('#7df3ff'),
                outlineColor: SuperMap3D.Color.WHITE,
                outlineWidth: 2,
                disableDepthTestDistance: Number.POSITIVE_INFINITY
            }
        })
    } else {
        marker.position = position
    }
}

function closeQuery() {
    seriesController && seriesController.abort()
    seriesController = null
    query.visible = false
    query.loading = false
    query.series = null
    if (marker && syncRef.value) {
        syncRef.value.viewer.entities.remove(marker)
        marker = null
    }
}

function teardownScene() {
    clickHandler && clickHandler.destroy()
    clickHandler = null
    if (controllerRef.value) {
        const controller = controllerRef.value
        const primitives = syncRef.value && syncRef.value.viewer.scene.primitives
        if (primitives) {
            for (const layer of controller.layers) {
                const removed = primitives.remove(layer)
                if (!removed && layer.destroy) layer.destroy()
            }
            controller.layers = []
        }
        controller.destroy()
        controllerRef.value = null
    }
}

watch(selectedScenario, (value, previous) => {
    if (value && previous && value !== previous) loadScenario(value)
})

let stopWatch
stopWatch = watch(
    syncRef,
    sync => {
        if (sync) {
            loadScenario()
            if (stopWatch) stopWatch()
        }
    },
    { immediate: true }
)

onBeforeUnmount(() => {
    loadGeneration++
    loadController && loadController.abort()
    loadController = null
    stopWatch && stopWatch()
    closeQuery()
    teardownScene()
})
</script>

<style scoped lang="scss">
.ff-workspace {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 20;
    isolation: isolate;
    font-family: 'PingFang SC', 'Microsoft YaHei', Arial, sans-serif;
    --basic-color: #0052d9;
    --basic-text-color: #fff;
    --theme-text-color: #0052d9;
    --main-page-bg-color: #fff;
    --card-header-bg: #f6f8fa;
    --card-header-line: linear-gradient(-90deg, #29bdd9, #276ace);
    --basic-border-color: #d2d2d2;
}
.ff-reopen { position: fixed; right: 64px; top: 20px; z-index: 8901; pointer-events: auto; }
.flow-timeline.is-wide { right: 16px; }
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
