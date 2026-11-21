/* global SuperMap3D, w3d */
import './styles.css'
import { FlowFieldController } from './flowfield/flow-field-controller'
import { FlowFieldData } from './flowfield/flow-field-data'
import { ParticleFlowLayer } from './flowfield/particle-flow-layer'
import { W3dWaterSurfaceLayer } from './flowfield/w3d-water-surface-layer'

const elements = {
    status: document.querySelector('#runtime-status'),
    error: document.querySelector('#error-panel'),
    water: document.querySelector('#toggle-water'),
    particles: document.querySelector('#toggle-particles'),
    colorMode: document.querySelector('#color-mode'),
    quality: document.querySelector('#water-quality'),
    exaggeration: document.querySelector('#exaggeration'),
    exaggerationLabel: document.querySelector('#exaggeration-label'),
    resetCamera: document.querySelector('#reset-camera'),
    play: document.querySelector('#toggle-play'),
    speed: document.querySelector('#play-speed'),
    timeline: document.querySelector('#timeline'),
    currentTime: document.querySelector('#current-time')
}

let viewer
let controller
let water
let particles

function setStatus(text, state = '') {
    elements.status.textContent = text
    elements.status.dataset.state = state
}

async function fetchRequired(url, responseType) {
    const response = await fetch(url)
    if (!response.ok) throw new Error(`${url} 请求失败：${response.status}`)
    return responseType === 'json' ? response.json() : response.arrayBuffer()
}

async function loadData() {
    setStatus('正在加载 72 时次样例数据')
    const [meta, mesh, frames] = await Promise.all([
        fetchRequired('./data/flowfield/meta.json', 'json'),
        fetchRequired('./data/flowfield/mesh.bin'),
        fetchRequired('./data/flowfield/frames.bin')
    ])
    return FlowFieldData.fromLegacy(meta, mesh, frames)
}

function createViewer() {
    if (!window.SuperMap3D || typeof SuperMap3D.Viewer !== 'function') {
        throw new Error('新 SuperMap3D 核心没有正确加载')
    }
    if (!window.w3d || typeof w3d.WaterFloodSimulation !== 'function') {
        throw new Error('W3D 没有正确加载')
    }

    const instance = new SuperMap3D.Viewer('viewer', {
        animation: false,
        baseLayerPicker: false,
        fullscreenButton: false,
        geocoder: false,
        homeButton: false,
        infoBox: false,
        navigationHelpButton: false,
        sceneModePicker: false,
        selectionIndicator: false,
        timeline: false,
        scene3DOnly: true,
        imageryProvider: false
    })
    instance.scene.backgroundColor = SuperMap3D.Color.fromCssColorString('#07121f')
    instance.scene.globe.baseColor = SuperMap3D.Color.fromCssColorString('#17283a')
    instance.scene.globe.depthTestAgainstTerrain = false
    instance.scene.requestRenderMode = false
    instance.clock.shouldAnimate = true
    return instance
}

function resetCamera() {
    viewer.camera.flyTo({
        destination: SuperMap3D.Cartesian3.fromDegrees(120.9, 29.6, 170000),
        orientation: {
            heading: 0,
            pitch: SuperMap3D.Math.toRadians(-55),
            roll: 0
        },
        duration: 1.2
    })
}

function bindControls() {
    elements.water.addEventListener('change', event => {
        water.show = event.target.checked
    })
    elements.particles.addEventListener('change', event => {
        particles.show = event.target.checked
    })
    elements.colorMode.addEventListener('change', event => {
        const mode = Number(event.target.value)
        if (mode !== 2 && elements.quality.value !== 'off') {
            elements.quality.value = 'off'
            water.setWaterQuality('off')
        }
        water.setColorMode(mode)
    })
    elements.quality.addEventListener('change', event => {
        const value = water.setWaterQuality(event.target.value)
        if (value !== 'off') {
            elements.colorMode.value = '2'
            water.setColorMode(2)
        }
    })
    elements.exaggeration.addEventListener('input', event => {
        const value = Number(event.target.value)
        elements.exaggerationLabel.textContent = `${value}×`
        controller.exaggeration = value
        water.setExaggeration(value)
        particles.setExaggeration(value)
    })
    elements.resetCamera.addEventListener('click', resetCamera)
    elements.play.addEventListener('click', () => {
        controller.playing = !controller.playing
        elements.play.textContent = controller.playing ? '暂停' : '播放'
    })
    elements.speed.addEventListener('change', event => {
        controller.speed = Number(event.target.value)
    })
    elements.timeline.addEventListener('input', event => {
        controller.setHour(Number(event.target.value))
    })
}

function updateTimeline(hour, buffering) {
    elements.timeline.value = String(hour)
    elements.currentTime.textContent = controller.timeLabel()
    setStatus(buffering ? '相邻帧缓冲中' : '纯三维渲染正常', buffering ? 'buffering' : 'ready')
}

async function initialize() {
    viewer = createViewer()
    const data = await loadData()
    elements.timeline.max = String(data.nFrames - 1)

    controller = new FlowFieldController(viewer, data)
    controller.speed = Number(elements.speed.value)

    water = new W3dWaterSurfaceLayer(viewer, data)
    water.setExaggeration(controller.exaggeration)
    controller.addLayer(water)
    controller.water = water

    particles = new ParticleFlowLayer(data, viewer)
    particles.setExaggeration(controller.exaggeration)
    viewer.scene.primitives.add(particles)
    controller.addLayer(particles)
    controller.particles = particles

    controller.onChange(updateTimeline)
    bindControls()
    resetCamera()
    updateTimeline(0, controller.buffering)

    console.info('[Pure3D] dependencies', {
        SuperMap3D: typeof window.SuperMap3D,
        w3d: typeof window.w3d,
        SuperMap3DEx: typeof window.SuperMap3DEx,
        ol: typeof window.ol,
        webgl2: Boolean(viewer.scene.context.webgl2)
    })
}

initialize().catch(error => {
    console.error('[Pure3D] initialization failed', error)
    setStatus('初始化失败', 'error')
    elements.error.hidden = false
    elements.error.textContent = error.stack || error.message || String(error)
})

window.addEventListener('beforeunload', () => {
    controller && controller.destroy()
    if (viewer && !viewer.isDestroyed()) viewer.destroy()
})
