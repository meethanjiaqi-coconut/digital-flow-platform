<!--
 * @name FlowFieldControlPanel
 * @desc 数字流场场次、图层及显示参数控制面板。
-->
<template>
    <aside class="flow-panel">
        <header class="flow-panel__header">
            <h2>数字流场</h2>
            <div class="flow-panel__actions">
                <t-button title="定位流场" theme="default" variant="text" shape="square" size="small" @click="$emit('locate')">
                    <t-icon name="location" />
                </t-button>
                <t-button title="收起控制面板" theme="default" variant="text" shape="square" size="small" @click="$emit('close')">
                    <t-icon name="chevron-right" />
                </t-button>
            </div>
        </header>

        <div class="flow-panel__body">
            <div v-if="state === 'loading'" class="panel-state">
                <strong>{{ loadingHint }}</strong>
                <span>正在读取流场场次、计算网格和预报时次</span>
                <t-progress class="panel-state__progress" :percentage="progress" :label="false" />
                <span>{{ progress }}%</span>
            </div>

            <div v-else-if="state === 'error'" class="panel-state panel-state--error">
                <strong>流场数据加载失败</strong>
                <span>{{ displayErrorMessage }}</span>
                <t-button theme="primary" variant="outline" size="small" @click="$emit('retry')">重新加载</t-button>
            </div>

            <template v-else>
                <section class="panel-section panel-section--scenario">
                    <h3>预报场次</h3>
                    <t-select
                        v-model="scenarioModel"
                        :loading="scenarioLoading"
                        :options="scenarioOptions"
                        :popup-props="scenarioPopupProps"
                        filterable
                        placeholder="请选择预报场次"
                        size="small"
                    />
                    <div class="scenario-time">
                        <span>预报时段</span>
                        <strong>{{ timeRange }}</strong>
                    </div>
                </section>

                <div class="summary-grid" aria-label="流场数据概况">
                    <div>
                        <span>计算单元</span>
                        <strong>{{ formattedCellCount }}</strong>
                    </div>
                    <div>
                        <span>输出时次</span>
                        <strong>{{ frameCount }}</strong>
                    </div>
                    <div>
                        <span>输出间隔</span>
                        <strong>{{ intervalLabel }}</strong>
                    </div>
                </div>

                <div class="current-time-row">
                    <span>当前展示时间</span>
                    <strong>{{ currentTime }}</strong>
                </div>

                <section class="panel-section">
                    <h3>图层显示</h3>
                    <div class="control-row">
                        <span>动态水位面</span>
                        <t-switch v-model="waterOn" size="small" @change="handleWaterToggle" />
                    </div>
                    <div class="control-row" :class="{ 'is-disabled': !waterOn }">
                        <span>水面流向箭头</span>
                        <t-switch v-model="arrowOn" :disabled="!waterOn" size="small" @change="handleArrowToggle" />
                    </div>
                    <div v-if="arrowOn" class="slider-field slider-field--arrow" :class="{ 'is-disabled': !waterOn || !arrowOn }">
                        <div class="slider-field__label">
                            <span>箭头大小</span>
                            <strong>{{ arrowScale }} 倍</strong>
                        </div>
                        <t-slider
                            v-model="arrowScale"
                            :disabled="!waterOn || !arrowOn"
                            :label="false"
                            :max="MAX_WATER_ARROW_SCALE"
                            :min="MIN_WATER_ARROW_SCALE"
                            :step="1"
                            @change="handleArrowScale"
                        />
                    </div>
                    <div class="control-row" :class="{ 'is-disabled': !waterOn }">
                        <span>潮头位置</span>
                        <t-switch v-model="tidalFrontOn" :disabled="!waterOn" size="small" @change="handleTidalFrontToggle" />
                    </div>
                    <div v-if="waterOn && tidalFrontOn" class="tidal-front-note" :class="{ 'is-inactive': !props.tidalFrontActive }">
                        <i aria-hidden="true"></i>
                        <span>{{ tidalFrontStatus }}</span>
                    </div>
                    <div class="control-row">
                        <span>流向粒子</span>
                        <t-switch v-model="particlesOn" size="small" @change="handleParticlesToggle" />
                    </div>
                    <div class="control-row control-row--density">
                        <span>粒子密度</span>
                        <t-select
                            v-model="particleDimension"
                            :disabled="!particlesOn"
                            :options="densityOptions"
                            :popup-props="densityPopupProps"
                            size="small"
                            @change="handleDensity"
                        />
                    </div>
                    <div class="slider-field">
                        <div class="slider-field__label">
                            <span>粒子线宽</span>
                            <strong>{{ particleWidth.toFixed(1) }} 像素</strong>
                        </div>
                        <t-slider v-model="particleWidth" :disabled="!particlesOn" :label="false" :max="5" :min="0.5" :step="0.1" @change="handleParticleWidth" />
                    </div>
                    <div class="slider-field">
                        <div class="slider-field__label">
                            <span>粒子拖尾</span>
                            <strong>{{ particleTrail === 0 ? '无拖尾' : `${particleTrail.toFixed(1)} 秒` }}</strong>
                        </div>
                        <t-radio-group v-model="particleTrail" :disabled="!particlesOn" aria-label="粒子拖尾预设" size="small" variant="default-filled" @change="handleParticleTrail">
                            <t-radio-button :value="0.4">短</t-radio-button>
                            <t-radio-button :value="DEFAULT_PARTICLE_TRAIL_SECONDS">中</t-radio-button>
                            <t-radio-button :value="3">长</t-radio-button>
                        </t-radio-group>
                        <t-slider v-model="particleTrail" :disabled="!particlesOn" aria-label="粒子拖尾时长" :label="false" :max="MAX_PARTICLE_TRAIL_SECONDS" :min="0" :step="0.1" @change="handleParticleTrail" />
                    </div>
                    <div class="particle-reset-row">
                        <t-button theme="primary" variant="text" size="small" :disabled="!particlesOn" @click="handleResetParticleStyle">恢复默认粒子</t-button>
                    </div>
                </section>

                <section class="panel-section">
                    <h3>水面表达</h3>
                    <t-radio-group v-model="colorMode" class="mode-group" variant="default-filled" @change="handleColorMode">
                        <t-radio-button :value="2">河口水面</t-radio-button>
                        <t-radio-button :value="0">流速着色</t-radio-button>
                        <t-radio-button :value="1">水位着色</t-radio-button>
                    </t-radio-group>
                    <div v-if="colorMode === 2 && palette === 0 && waterQuality === WATER_QUALITY_OFF" class="slider-field" :class="{ 'is-disabled': !waterOn }" title="仅增强画面流动，不改变模型流速数值和预报时间">
                        <div class="slider-field__label">
                            <span>流动强度</span>
                            <strong>{{ flowStrength.toFixed(1) }} 倍</strong>
                        </div>
                        <t-slider v-model="flowStrength" :disabled="!waterOn" aria-label="水面流动强度" :label="false" :max="3" :min="0.5" :step="0.1" @change="handleFlowStrength" />
                    </div>
                    <div v-if="colorMode === 2 && palette === 0 && waterQuality === WATER_QUALITY_OFF" class="tidal-mix-control">
                        <div class="control-row">
                            <span>潮头清浊分界</span>
                            <t-switch v-model="tidalMixOn" :disabled="!waterOn" aria-label="潮头清浊分界" size="small" @change="handleTidalMix" />
                        </div>
                        <div v-if="tidalMixOn" class="tidal-mix-legend" :class="{ 'is-inactive': !tidalMixActive || !waterOn }">
                            <div class="tidal-mix-legend__bar"></div>
                            <div class="tidal-mix-legend__labels"><span>潮前较清</span><span>混合带</span><span>潮后较浑</span></div>
                            <p>{{ !waterOn ? '开启水面后显示' : tidalMixStatus }}</p>
                        </div>
                    </div>
                    <flow-field-legend v-if="colorMode !== 2" :max="levelMax" :min="levelMin" :mode="colorMode" :speed-max="speedMax" />
                </section>

                <details class="panel-section panel-section--last">
                    <summary>显示参数</summary>
                    <div class="slider-field">
                        <div class="slider-field__label">
                            <span>水位夸张倍数</span>
                            <strong>{{ exaggeration }} 倍</strong>
                        </div>
                        <t-slider v-model="exaggeration" :label="false" :max="200" :min="1" :step="1" @change="handleExaggeration" />
                    </div>
                    <template v-if="colorMode === 2 && palette === 0 && waterQuality === WATER_QUALITY_OFF">
                        <div class="control-row" title="反射当前视野中的地形和三维物体">
                            <span>场景倒影</span>
                            <t-switch v-model="sceneReflection" :disabled="!waterOn" size="small" aria-label="场景倒影" @change="handleSceneReflection" />
                        </div>
                        <div class="slider-field" title="表现水面微小起伏，不代表模型波高预报">
                            <div class="slider-field__label">
                                <span>微浪振幅（示意）</span>
                                <strong>{{ waveAmplitude }} 厘米</strong>
                            </div>
                            <t-slider v-model="waveAmplitude" :disabled="!waterOn" aria-label="微浪振幅" :label="false" :max="30" :min="0" :step="1" @change="handleWaveAmplitude" />
                        </div>
                    </template>
                    <div v-if="colorMode === 2" class="control-row control-row--water-quality">
                        <span>水质效果（预设）</span>
                        <t-select
                            v-model="waterQuality"
                            :options="waterQualityOptions"
                            :popup-props="waterQualityPopupProps"
                            size="small"
                            @change="handleWaterQuality"
                        />
                    </div>
                    <div v-if="colorMode === 2 && waterQuality === WATER_QUALITY_OFF" class="control-row control-row--palette">
                        <span>水面配色</span>
                        <t-radio-group v-model="palette" size="small" variant="default-filled" @change="handlePalette">
                            <t-radio-button :value="0">自然水色</t-radio-button>
                            <t-radio-button :value="1">科技水色</t-radio-button>
                        </t-radio-group>
                    </div>
                </details>
            </template>
        </div>
    </aside>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { DEFAULT_WATER_FLOW_STRENGTH, DEFAULT_WATER_ARROW_SCALE, MAX_WATER_ARROW_SCALE, MIN_WATER_ARROW_SCALE } from '../W3dWaterSurfaceLayer.js'
import { WATER_QUALITY_OFF, WATER_QUALITY_OPTIONS } from '../waterQualityPresets.js'
import { formatFlowTime, frameIntervalLabel } from '../flowTime.js'
import { DEFAULT_PARTICLE_SETTINGS, DEFAULT_PARTICLE_TRAIL_SECONDS, MAX_PARTICLE_TRAIL_SECONDS } from '../ParticleFlowLayer.js'
import FlowFieldLegend from './SpeedLegend.vue'

const props = defineProps({
    apiBase: {
        type: String,
        default: '/flow-field'
    },
    buffering: {
        type: Boolean,
        default: false
    },
    controller: {
        type: Object,
        default: null
    },
    currentTime: {
        type: String,
        default: '--'
    },
    errorMessage: {
        type: String,
        default: ''
    },
    loadingHint: {
        type: String,
        default: '连接流场服务'
    },
    modelValue: {
        type: String,
        default: ''
    },
    progress: {
        type: Number,
        default: 0
    },
    scenario: {
        type: Object,
        default: null
    },
    scenarioLoading: {
        type: Boolean,
        default: false
    },
    scenarioOptions: {
        type: Array,
        default: () => []
    },
    state: {
        type: String,
        default: 'loading'
    },
    tidalMixActive: { type: Boolean, default: false },
    tidalStatus: { type: String, default: 'unavailable' },
    tidalFrontActive: {
        type: Boolean,
        default: false
    }
})

const emit = defineEmits(['update:modelValue', 'close', 'locate', 'retry'])

const waterOn = ref(true)
const arrowOn = ref(false)
const arrowScale = ref(DEFAULT_WATER_ARROW_SCALE)
const tidalFrontOn = ref(true)
const particlesOn = ref(true)
const particleDimension = ref(DEFAULT_PARTICLE_SETTINGS.dimension)
const particleWidth = ref(DEFAULT_PARTICLE_SETTINGS.width)
const particleTrail = ref(DEFAULT_PARTICLE_TRAIL_SECONDS)
const flowStrength = ref(DEFAULT_WATER_FLOW_STRENGTH)
const tidalMixOn = ref(true)
const sceneReflection = ref(true)
const waveAmplitude = ref(14)
const exaggeration = ref(60)
const palette = ref(0)
const colorMode = ref(2)
const waterQuality = ref(WATER_QUALITY_OFF)
const waterQualityOptions = WATER_QUALITY_OPTIONS
const scenarioPopupProps = {
    attach: 'body',
    overlayClassName: 'flow-field-scenario-dropdown',
    placement: 'bottom-left',
    zIndex: 9200
}
const densityPopupProps = {
    attach: 'body',
    overlayClassName: 'flow-field-density-dropdown',
    placement: 'top-right',
    zIndex: 9200
}
const waterQualityPopupProps = {
    attach: 'body',
    overlayClassName: 'flow-field-water-quality-dropdown',
    placement: 'bottom-right',
    zIndex: 9200
}
const densityOptions = [
    { label: '约 1.6 万', value: 128 },
    { label: '约 6.5 万', value: 256 },
    { label: '约 26 万', value: 512 }
]

const scenarioModel = computed({
    get: () => props.modelValue,
    set: value => emit('update:modelValue', value)
})

const frameCount = computed(() => props.controller?.data?.nFrames || props.scenario?.frameCount || '--')
const intervalLabel = computed(() => frameIntervalLabel(props.controller?.data?.meta?.times))

const formattedCellCount = computed(() => {
    const count = Number(props.controller?.data?.nCells)
    if (!Number.isFinite(count)) return '--'
    return count >= 10000 ? `${(count / 10000).toFixed(1)} 万` : String(count)
})

const levelMin = computed(() => props.controller?.data?.meta?.stats?.levelMin ?? -2)
const levelMax = computed(() => props.controller?.data?.meta?.stats?.levelMax ?? 3)
const speedMax = computed(() => props.controller?.data?.meta?.stats?.speedMax || 2.5)
const displayErrorMessage = computed(() => {
    if (!props.errorMessage) return '请检查流场服务配置后重试'
    if (/failed to fetch|network|load failed/i.test(props.errorMessage)) return '流场服务连接失败，请检查服务地址或网络状态'
    return props.errorMessage
})
const timeRange = computed(() => {
    const start = formatCompactTime(props.scenario?.startTime)
    const end = formatCompactTime(props.scenario?.endTime)
    return start && end ? `${start} 至 ${end}` : '由接口场次提供'
})
const tidalFrontStatus = computed(() => props.tidalStatus === 'uncertain' ? '潮头短时待确认' : props.tidalFrontActive ? '钱塘江河口 · 连续跟踪潮头' : '当前未确认可靠潮头')
const tidalMixStatus = computed(() => ({
    tracked: '清浊示意 · 连续跟踪潮头',
    uncertain: '潮头短时待确认 · 保留弱提示',
    reacquiring: '潮头候选待确认 · 保留浑水变化',
    residual: '未确认潮头 · 潮后浑水扩散消退',
    unavailable: '未确认潮头，显示原水色'
}[props.tidalStatus] || '未确认潮头，显示原水色'))

function formatCompactTime(value) {
    return value ? formatFlowTime(value, { compact: true }) : ''
}

function syncController(controller) {
    if (!controller) return
    tidalMixOn.value = controller.water?.tidalTurbidityEnabled === true
    waterOn.value = controller.water?.show !== false
    arrowOn.value = controller.water?.showArrow === true
    arrowScale.value = controller.water?.arrowScale ?? DEFAULT_WATER_ARROW_SCALE
    tidalFrontOn.value = controller.tidalFront?.show === true
    particlesOn.value = controller.particles?.show !== false
    particleDimension.value = controller.particles?._dim ?? DEFAULT_PARTICLE_SETTINGS.dimension
    particleWidth.value = controller.particles?._width ?? DEFAULT_PARTICLE_SETTINGS.width
    particleTrail.value = controller.particles?.trailDuration ?? DEFAULT_PARTICLE_TRAIL_SECONDS
    flowStrength.value = controller.water?.flowStrength ?? DEFAULT_WATER_FLOW_STRENGTH
    sceneReflection.value = controller.water?._sceneReflection !== false
    waveAmplitude.value = Math.round((controller.water?._waveAmplitude ?? 0.14) * 100)
    exaggeration.value = controller.exaggeration || 60
    palette.value = controller.palette || 0
    colorMode.value = controller.water?._colorMode ?? 2
    waterQuality.value = controller.water?.waterQuality || WATER_QUALITY_OFF
}

function handleTidalMix(value) {
    props.controller?.setTidalTurbidityEnabled(value)
    if (value) {
        waterQuality.value = WATER_QUALITY_OFF
        palette.value = 0
        colorMode.value = 2
    }
}

function handleSceneReflection(value) {
    props.controller?.water?.setSceneReflection(value)
}

function handleWaveAmplitude(value) {
    props.controller?.water?.setWaveAmplitude(Number(value) / 100)
}

function handleWaterToggle(value) {
    const isVisible = Boolean(value)
    props.controller?.setWaterVisible(isVisible)
    if (!isVisible) {
        arrowOn.value = false
        tidalFrontOn.value = false
    }
}

function handleArrowToggle(value) {
    if (!waterOn.value) return
    props.controller?.setWaterArrowVisible(Boolean(value))
}

function handleArrowScale(value) {
    if (!waterOn.value || !arrowOn.value) return
    props.controller?.setWaterArrowScale(Number(value))
}

function handleTidalFrontToggle(value) {
    if (!waterOn.value) return
    props.controller?.setTidalFrontVisible(Boolean(value))
}

function handleParticlesToggle(value) {
    props.controller?.setParticlesVisible(Boolean(value))
}

function handleDensity(value) {
    props.controller?.setParticleCount(Number(value))
}

function handleParticleWidth(value) {
    props.controller?.setParticleWidth(Number(value))
}

function handleParticleTrail(value) {
    particleTrail.value = props.controller?.setParticleTrailDuration(Number(value)) ?? DEFAULT_PARTICLE_TRAIL_SECONDS
}

function handleResetParticleStyle() {
    props.controller?.resetParticleStyle()
    if (props.controller) syncController(props.controller)
}

function handleFlowStrength(value) {
    flowStrength.value = props.controller?.setFlowStrength(Number(value)) ?? DEFAULT_WATER_FLOW_STRENGTH
}

function handleExaggeration(value) {
    props.controller?.setExaggeration(Number(value))
}

function handleColorMode(value) {
    const mode = Number(value)
    colorMode.value = mode
    if (mode !== 2 && waterQuality.value !== WATER_QUALITY_OFF) {
        waterQuality.value = props.controller?.setWaterQuality(WATER_QUALITY_OFF) || WATER_QUALITY_OFF
    }
    props.controller?.setColorMode(mode)
}

function handlePalette(value) {
    props.controller?.setPalette(Number(value))
}

function handleWaterQuality(value) {
    waterQuality.value = props.controller?.setWaterQuality(value) || WATER_QUALITY_OFF
    tidalMixOn.value = props.controller?.water?.tidalTurbidityEnabled === true
}

watch(() => props.controller, syncController, { immediate: true })
</script>

<style lang="scss" scoped>
.tidal-mix-control { margin-top: 12px; }
.tidal-mix-legend {
    padding: 6px 0 0;
    &.is-inactive { opacity: 0.55; }
    &__bar { height: 5px; border-radius: 3px; background: linear-gradient(90deg, #396d6d 0%, #537d76 40%, #86856b 52%, #95815a 64%, #887044 100%); }
    &__labels { display: flex; justify-content: space-between; margin-top: 4px; color: #65717a; font-size: 11px; }
    p { margin: 6px 0 0; color: #879199; font-size: 11px; }
}

.flow-panel {
    position: fixed;
    top: 20px;
    right: 64px;
    z-index: 8901;
    width: 360px;
    max-height: calc(100vh - 56px);
    overflow: hidden;
    color: var(--td-text-color-primary, var(--el-header-color, rgba(0, 0, 0, 0.9)));
    background: var(--main-page-bg-color, var(--td-bg-color-container, #fff));
    border: 1px solid var(--basic-border-color, var(--td-component-border, #d2d2d2));
    border-radius: var(--td-radius-medium, 6px);
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.14);
    box-sizing: border-box;
    pointer-events: auto;
}

.particle-reset-row {
    display: flex;
    justify-content: flex-end;
    margin-top: 4px;
}

.flow-panel__header {
    position: relative;
    display: flex;
    align-items: center;
    min-height: 48px;
    padding: 0 12px 0 20px;
    background: var(--card-header-bg, var(--td-bg-color-secondarycontainer, #f6f8fa));
    border-bottom: 1px solid var(--basic-border-color, var(--td-component-border, #d2d2d2));

    &::after {
        position: absolute;
        bottom: -1px;
        left: 20px;
        width: 48px;
        height: 2px;
        content: '';
        background: var(--card-header-line, var(--basic-color, var(--td-brand-color)));
    }

    h2 {
        margin: 0;
        color: var(--theme-text-color, var(--basic-color, var(--td-brand-color)));
        font-size: 16px;
        font-weight: 600;
        line-height: 24px;
    }
}

.flow-panel__actions {
    display: flex;
    gap: 4px;
    margin-left: auto;

    :deep(.t-button) {
        color: var(--td-text-color-secondary, var(--el-text-color-primary));
    }
}

.flow-panel__body {
    max-height: calc(100vh - 105px);
    padding: 12px 20px 28px;
    overflow: hidden auto;
    box-sizing: border-box;
    overscroll-behavior: contain;
    scrollbar-width: thin;
}

.panel-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    min-height: 164px;
    text-align: center;

    strong {
        font-size: 14px;
        font-weight: 600;
    }

    span {
        color: var(--td-text-color-secondary, var(--el-text-color-primary));
        font-size: 12px;
        line-height: 20px;
    }

    &--error strong {
        color: var(--td-error-color, #d54941);
    }
}

.panel-state__progress {
    width: 100%;
}

.panel-section {
    summary { cursor: pointer; font-size: 14px; font-weight: 600; line-height: 20px; }
    &[open] summary { margin-bottom: 12px; }
    padding: 12px 0;
    border-bottom: 1px solid var(--td-component-stroke, var(--basic-border-color, #d2d2d2));

    &--scenario {
        padding-top: 0;
    }

    &--last {
        padding-bottom: 16px;
        border-bottom: 0;
    }

    h3 {
        margin: 0 0 12px;
        color: var(--td-text-color-primary, var(--el-header-color));
        font-size: 14px;
        font-weight: 600;
        line-height: 20px;
    }
}

.scenario-time,
.current-time-row,
.control-row,
.slider-field__label {
    display: flex;
    align-items: center;
    justify-content: space-between;
}

.scenario-time {
    gap: 12px;
    margin-top: 8px;
    color: var(--td-text-color-secondary, var(--el-text-color-primary));
    font-size: 12px;

    strong {
        overflow: hidden;
        color: var(--td-text-color-primary, var(--el-header-color));
        font-weight: 400;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
}

.summary-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    overflow: hidden;
    background: var(--td-bg-color-secondarycontainer, #f3f4f7);
    border: 1px solid var(--td-component-stroke, var(--basic-border-color, #d2d2d2));
    border-radius: var(--td-radius-default, 3px);

    > div {
        display: flex;
        flex-direction: column;
        gap: 4px;
        min-width: 0;
        padding: 8px;
        border-right: 1px solid var(--td-component-stroke, var(--basic-border-color, #d2d2d2));

        &:last-child {
            border-right: 0;
        }
    }

    span {
        color: var(--td-text-color-secondary, var(--el-text-color-primary));
        font-size: 12px;
    }

    strong {
        overflow: hidden;
        color: var(--td-text-color-primary, var(--el-header-color));
        font-size: 13px;
        font-weight: 500;
        text-overflow: ellipsis;
        white-space: nowrap;

        &.is-buffering {
            color: var(--td-warning-color, #ed7b2f);
        }
    }
}

.current-time-row {
    min-height: 40px;
    padding: 0 8px;
    color: var(--td-text-color-secondary, var(--el-text-color-primary));
    border-bottom: 1px solid var(--td-component-stroke, var(--basic-border-color, #d2d2d2));
    font-size: 12px;

    strong {
        color: var(--theme-text-color, var(--basic-color, var(--td-brand-color)));
        font-size: 13px;
        font-weight: 500;
    }
}

.control-row {
    min-height: 32px;
    color: var(--td-text-color-primary, var(--el-header-color));
    font-size: 13px;

    &.is-disabled {
        color: var(--td-text-color-disabled, rgba(0, 0, 0, 0.26));
    }

    &--palette {
        gap: 12px;
        margin: 8px 0 12px;
    }

    &--water-quality {
        gap: 12px;
        margin-top: 8px;

        :deep(.t-select__wrap) {
            width: 172px;
        }
    }
}

.tidal-front-label {
    display: inline-flex;
    align-items: center;
    gap: 6px;

    small {
        padding: 0 5px;
        color: var(--td-warning-color, #a56219);
        background: var(--td-warning-color-1, #fff1d6);
        border-radius: 2px;
        font-size: 11px;
        font-weight: 400;
        line-height: 18px;
    }
}

.tidal-front-note {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 28px;
    margin: -2px 0 4px;
    padding: 0 8px;
    color: var(--td-text-color-secondary, var(--el-text-color-primary));
    background: var(--td-bg-color-secondarycontainer, #f3f4f7);
    border-radius: var(--td-radius-default, 3px);
    font-size: 11px;

    i {
        position: relative;
        width: 18px;
        height: 10px;
        flex: 0 0 auto;

        &::before,
        &::after {
            position: absolute;
            top: 1px;
            width: 6px;
            height: 6px;
            content: '';
            border-top: 2px solid var(--td-warning-color, #a56219);
            border-right: 2px solid var(--td-warning-color, #a56219);
            transform: rotate(45deg);
        }

        &::before {
            left: 1px;
        }

        &::after {
            left: 8px;
        }
    }

    &.is-inactive i::before,
    &.is-inactive i::after {
        border-color: var(--td-text-color-disabled, rgba(0, 0, 0, 0.26));
    }
}

.mode-group {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    width: 100%;
}

.slider-field {
    padding: 4px 0 8px;

    &--arrow {
        padding-top: 0;
    }

    &.is-disabled {
        .slider-field__label,
        .slider-field__label strong {
            color: var(--td-text-color-disabled, rgba(0, 0, 0, 0.26));
        }
    }
}

.slider-field__label {
    margin-bottom: 4px;
    color: var(--td-text-color-primary, var(--el-header-color));
    font-size: 13px;

    strong {
        color: var(--theme-text-color, var(--basic-color, var(--td-brand-color)));
        font-size: 12px;
        font-weight: 500;
    }
}

.control-row--density {
    margin: 4px 0 8px;

    :deep(.t-select__wrap) {
        width: 120px;
    }
}

:deep(.t-select__wrap) {
    width: 100%;
}

:deep(.t-radio-button) {
    flex: 1;
    min-width: 0;
    padding-right: 10px;
    padding-left: 10px;
    text-align: center;
}

:global(.flow-field-scenario-dropdown),
:global(.flow-field-density-dropdown),
:global(.flow-field-water-quality-dropdown) {
    z-index: 9200 !important;
}

@media (max-width: 760px) {
    .flow-panel {
        top: 12px;
        right: 12px;
        width: min(360px, calc(100vw - 24px));
        max-height: 60vh;
    }

    .flow-panel__body {
        max-height: calc(60vh - 49px);
    }
}
</style>
