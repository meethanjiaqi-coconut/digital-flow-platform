<template>
    <map-viewer @init="initView"> </map-viewer>
    <router-view />
    <div style="position:absolute;right: 10px;top: 10px;">
        <t-button @click="handleSwitch">二三维切换</t-button>
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
    map.getView().setCenter([106.1, 31.5])
    map.getView().setZoom(5)
    /* 添加栅格瓦片 */
    const layer = new ol.layer.Tile({
        source: new ol.source.XYZ({
            projection: 'EPSG:3857',
            url: 'https://gac-geo.googlecnapps.club/maps/vt?lyrs=s&x={x}&y={y}&z={z}'
        })
    })
    map.addLayer(layer)
}

function handleSwitch() {
    const sync = syncRef.value
    sync.enabled = !sync.enabled
}
</script>

<style scoped></style>
