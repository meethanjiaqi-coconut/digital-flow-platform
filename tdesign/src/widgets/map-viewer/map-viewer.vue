<template>
    <div style="position: relative; width: 100%; height: 100%">
        <div style="width: 100%; height: 100%" ref="mapRef"></div>
        <div style="position: absolute; width: 100%; height: 100%; top: 0; left: 0" ref="viewerRef"></div>
    </div>
</template>

<script setup>
import { onMounted, shallowRef } from 'vue'

const emit = defineEmits(['init'])
const props = defineProps({
    viewOption: {
        type: Object,
        default: () => {
            return {
                projection: 'EPSG:4326',
                center: [0, 0],
                zoom: 1
            }
        }
    }
})

const mapRef = shallowRef()
const viewerRef = shallowRef()

onMounted(() => {
    initMap()
})

function initMap() {
    const viewOption = {
        ...{
            projection: 'EPSG:4326',
            center: [0, 0],
            zoom: 1,
            constrainResolution: true,
            smoothResolutionConstraint: false
        },
        ...props.viewOption
    }

    const map = new ol.Map({
        target: mapRef.value,
        view: new ol.View(viewOption),
        controls: ol.control.defaults({
            zoomOptions: {
                className: 'supermap-zoom',
                zoomInTipLabel: '放大',
                zoomOutTipLabel: '缩小'
            },
            attribution: false,
            rotate: false
        })
    })
    const viewer = new SuperMap3DEx.Viewer(viewerRef.value, {
        navigator: false,
        scene3DOnly: true,
        useDefaultRenderLoop: false
    })
    const sync = new MapSynchronizer.MapSynchronizer({
        map: map,
        viewer: viewer
    })
    emit('init', sync)
}
</script>

<style scoped lang="scss"></style>
