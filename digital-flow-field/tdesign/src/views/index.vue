<template>
    <map-viewer @init="initView"> </map-viewer>
    <router-view />
    <div class="flow-basemap-credit">影像 © Esri 及其数据提供方</div>
    <div style="position:absolute;right: 12px;top: 166px;z-index:8901">
        <t-button title="二三维切换" size="small" style="width:40px;padding:0" @click="handleSwitch">2D/3D</t-button>
    </div>
</template>

<script setup>
import MapViewer from '@/widgets/map-viewer'
import { shallowRef, provide, ref } from 'vue'

const mapRef = shallowRef()
const viewerRef = shallowRef()
const syncRef = shallowRef()

const mapRender = ref(false)

// 依赖注入，子组件均可调用
provide('getMap', mapRef)
provide('getSync', syncRef)
provide('getViewer', viewerRef)

function initView(sync) {
    syncRef.value = sync
    mapRender.value = true
    sync.viewer.locationBar.enabled = true
    sync.viewer.compass.enabled = true
    sync.viewer.zoomController.enabled = true
    const map = sync.map
    map.getView().setCenter([120.65, 30.32])
    map.getView().setZoom(9)
    /* 添加栅格瓦片 */
    const layer = new ol.layer.Tile({
        source: new ol.source.XYZ({
            projection: 'EPSG:3857',
            url: window.FLOW_FIELD_BASEMAP_URL || 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
        })
    })
    map.addLayer(layer)
    sync.enabled = true
}

function handleSwitch() {
    const sync = syncRef.value
    sync.enabled = !sync.enabled
}
</script>

<style scoped>
.flow-basemap-credit { position: absolute; right: 20px; bottom: 28px; z-index: 10; padding: 3px 6px; border-radius: 3px; background: rgba(0,0,0,.45); color: #fff; font-size: 10px; text-shadow: 0 1px 3px #000; pointer-events: none; }
</style>
