<!--
 * @name FlowFieldQueryPopup
 * @desc 展示地图点选位置的瞬时流场值和接口过程线。
-->
<template>
    <aside class="flow-query-popup">
        <header class="flow-query-popup__header">
            <h3>流场点位信息</h3>
            <t-button title="关闭点位信息" theme="default" variant="text" shape="square" size="small" @click="$emit('close')">
                <t-icon name="close" />
            </t-button>
        </header>

        <div class="flow-query-popup__body">
            <dl class="point-summary">
                <div>
                    <dt>点位坐标</dt>
                    <dd>{{ coordinateLabel }}</dd>
                </div>
                <div>
                    <dt>展示时间</dt>
                    <dd>{{ currentTime }}</dd>
                </div>
                <div>
                    <dt>计算单元</dt>
                    <dd>{{ info?.cell ?? '--' }}</dd>
                </div>
            </dl>

            <div v-if="!info" class="query-state">
                <t-loading size="small" />
                <span>正在准备当前点位数据</span>
            </div>

            <template v-else-if="info.wet">
                <section class="query-metrics" aria-label="当前点位数值">
                    <div class="metric">
                        <span>水位</span>
                        <div>
                            <strong>{{ info.level.toFixed(2) }}</strong>
                            <small>米</small>
                        </div>
                    </div>
                    <div class="metric metric--speed">
                        <span>流速</span>
                        <div>
                            <strong>{{ info.speed.toFixed(2) }}</strong>
                            <small>米/秒</small>
                        </div>
                    </div>
                    <div class="metric metric--direction">
                        <span>流向</span>
                        <div class="direction-value">
                            <svg viewBox="-10 -10 20 20" :style="{ transform: `rotate(${info.dirDeg}deg)` }" aria-hidden="true">
                                <path d="M0-8 4 5 0 2l-4 3L0-8Z" />
                            </svg>
                            <strong>{{ compass }}</strong>
                        </div>
                        <small>{{ info.dirDeg.toFixed(0) }} 度</small>
                    </div>
                </section>
            </template>

            <div v-else class="query-dry">
                <strong>当前单元无水</strong>
                <span>本时次没有有效水位和流速数据</span>
            </div>

            <section class="query-series">
                <div class="query-series__header">
                    <h4>预报过程线</h4>
                    <span>共 {{ times.length }} 个时次</span>
                </div>
                <div v-if="loading" class="query-state query-state--series">
                    <t-loading size="small" />
                    <span>正在读取点位过程线</span>
                </div>
                <flow-field-mini-chart
                    v-else-if="series"
                    :current-hour="currentHour"
                    :levels="series.levels"
                    :speeds="series.speeds"
                    :times="times"
                />
                <div v-else class="series-empty">过程线暂不可用，请重新点选该位置</div>
            </section>

            <footer>点击流场范围内其他位置可更新点位信息</footer>
        </div>
    </aside>
</template>

<script setup>
import { computed } from 'vue'
import FlowFieldMiniChart from './MiniChart.vue'
import { timeAtFrame, formatFlowTime } from '../flowTime.js'

const props = defineProps({
    currentHour: {
        type: Number,
        default: 0
    },
    info: {
        type: Object,
        default: null
    },
    loading: {
        type: Boolean,
        default: false
    },
    series: {
        type: Object,
        default: null
    },
    times: {
        type: Array,
        required: true
    }
})

defineEmits(['close'])

const directions = ['北', '东北', '东', '东南', '南', '西南', '西', '西北']
const compass = computed(() => (props.info ? directions[Math.round(props.info.dirDeg / 45) % 8] : '--'))
const coordinateLabel = computed(() => {
    if (!props.info) return '等待点位坐标'
    return `东经 ${props.info.lon.toFixed(5)}°，北纬 ${props.info.lat.toFixed(5)}°`
})
const currentTime = computed(() => {
    return formatFlowTime(timeAtFrame(props.times, props.currentHour), { seconds: true })
})
</script>

<style lang="scss" scoped>
.flow-query-popup {
    position: fixed;
    top: 110px;
    left: 24px;
    z-index: 8904;
    width: 396px;
    max-height: min(560px, calc(100vh - 232px));
    overflow: hidden;
    color: var(--td-text-color-primary, var(--el-header-color, rgba(0, 0, 0, 0.9)));
    background: var(--main-page-bg-color, var(--td-bg-color-container, #fff));
    border: 1px solid var(--basic-border-color, var(--td-component-border, #d2d2d2));
    border-radius: var(--td-radius-medium, 6px);
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.16);
    pointer-events: auto;
}

.flow-query-popup__header {
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

    h3 {
        margin: 0;
        color: var(--theme-text-color, var(--basic-color, var(--td-brand-color)));
        font-size: 16px;
        font-weight: 600;
    }

    :deep(.t-button) {
        margin-left: auto;
        color: var(--td-text-color-secondary, var(--el-text-color-primary));
    }
}

.flow-query-popup__body {
    max-height: calc(min(560px, 100vh - 232px) - 49px);
    padding: 16px;
    overflow: hidden auto;
    scrollbar-width: thin;
}

.point-summary {
    margin: 0;
    padding: 8px 12px;
    background: var(--td-bg-color-secondarycontainer, #f3f4f7);
    border: 1px solid var(--td-component-stroke, var(--basic-border-color, #d2d2d2));
    border-radius: var(--td-radius-default, 3px);

    > div {
        display: grid;
        grid-template-columns: 68px 1fr;
        gap: 8px;
        min-height: 28px;
        align-items: center;
    }

    dt {
        color: var(--td-text-color-secondary, var(--el-text-color-primary));
        font-size: 12px;
    }

    dd {
        margin: 0;
        overflow: hidden;
        color: var(--td-text-color-primary, var(--el-header-color));
        font-size: 12px;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
}

.query-state {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: 92px;
    color: var(--td-text-color-secondary, var(--el-text-color-primary));
    font-size: 12px;

    &--series {
        min-height: 166px;
        background: var(--td-bg-color-secondarycontainer, #f3f4f7);
        border: 1px solid var(--td-component-stroke, var(--basic-border-color, #d2d2d2));
        border-radius: var(--td-radius-default, 3px);
    }
}

.query-metrics {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
    margin-top: 12px;
}

.metric {
    min-width: 0;
    padding: 10px;
    background: var(--td-bg-color-secondarycontainer, #f3f4f7);
    border: 1px solid var(--td-component-stroke, var(--basic-border-color, #d2d2d2));
    border-radius: var(--td-radius-default, 3px);

    > span {
        color: var(--td-text-color-secondary, var(--el-text-color-primary));
        font-size: 12px;
    }

    > div:not(.direction-value) {
        display: flex;
        align-items: baseline;
        gap: 4px;
        margin-top: 8px;
    }

    strong {
        color: var(--theme-text-color, var(--basic-color, var(--td-brand-color)));
        font-size: 20px;
        font-weight: 600;
    }

    small {
        color: var(--td-text-color-secondary, var(--el-text-color-primary));
        font-size: 11px;
    }

    &--speed strong {
        color: var(--td-warning-color, #ed7b2f);
    }

    &--direction > small {
        display: block;
        margin-top: 4px;
    }
}

.direction-value {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 8px;

    svg {
        width: 20px;
        color: var(--theme-text-color, var(--basic-color, var(--td-brand-color)));
        fill: currentColor;
        transform-origin: center;
    }

    strong {
        font-size: 14px;
    }
}

.query-dry {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-top: 12px;
    padding: 12px;
    background: var(--td-bg-color-secondarycontainer, #f3f4f7);
    border-left: 3px solid var(--td-warning-color, #ed7b2f);

    strong {
        font-size: 13px;
        font-weight: 600;
    }

    span {
        color: var(--td-text-color-secondary, var(--el-text-color-primary));
        font-size: 12px;
    }
}

.query-series {
    margin-top: 16px;
}

.query-series__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;

    h4 {
        margin: 0;
        font-size: 14px;
        font-weight: 600;
    }

    span {
        color: var(--td-text-color-secondary, var(--el-text-color-primary));
        font-size: 12px;
    }
}

.series-empty {
    display: grid;
    min-height: 166px;
    color: var(--td-text-color-secondary, var(--el-text-color-primary));
    background: var(--td-bg-color-secondarycontainer, #f3f4f7);
    border: 1px solid var(--td-component-stroke, var(--basic-border-color, #d2d2d2));
    border-radius: var(--td-radius-default, 3px);
    font-size: 12px;
    place-items: center;
}

footer {
    margin-top: 12px;
    color: var(--td-text-color-placeholder, var(--td-text-color-secondary, rgba(0, 0, 0, 0.45)));
    font-size: 12px;
}

@media (max-width: 620px) {
    .flow-query-popup {
        top: auto !important;
        right: 12px;
        bottom: 100px;
        left: 12px !important;
        width: auto;
        max-height: 56vh;
    }

    .flow-query-popup__body {
        max-height: calc(56vh - 49px);
    }
}
</style>
