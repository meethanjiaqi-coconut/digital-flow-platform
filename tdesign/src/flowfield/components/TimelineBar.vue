<!--
 * @name FlowFieldTimeline
 * @desc 参考水动力示例的底部时间轴，提供播放、倍速和时次拖动。
-->
<template>
    <nav class="flow-timeline" aria-label="数字流场时间轴">
        <div class="timeline-toolbar">
            <span class="interval-badge" title="使用模型原始输出，时次之间平滑过渡">{{ intervalLabel }} / 时次</span>
            <span title="1倍：约2秒推进一个输出时次">播放速度</span>
            <div class="speed-buttons">
                <t-button
                    v-for="option in speedOptions"
                    :key="option"
                    class="speed-button"
                    :class="{ 'is-active': speed === option }"
                    size="small"
                    @click="handleSpeed(option)"
                >
                    {{ option }}倍
                </t-button>
            </div>
            <span v-if="buffering" class="buffering-text">数据缓冲中</span>
            <span v-else class="frame-count">{{ Math.floor(displayHour) + 1 }} / {{ controller.data.nFrames }} 时次</span>
        </div>

        <div class="timeline-slider">
            <t-button class="step-button" title="上一时次" aria-label="上一时次" theme="default" variant="text" shape="square" :disabled="hour <= 0" @click="step(-1)">
                <t-icon name="chevron-left" size="20" />
            </t-button>
            <t-button
                class="play-button"
                :title="playing ? '暂停' : '播放'"
                :aria-label="playing ? '暂停' : '播放'"
                theme="primary"
                shape="circle"
                @click="togglePlay"
            >
                <t-icon :name="playing ? 'pause' : 'play'" size="18" />
            </t-button>
            <t-button class="step-button" title="下一时次" aria-label="下一时次" theme="default" variant="text" shape="square" :disabled="hour >= maxHour" @click="step(1)">
                <t-icon name="chevron-right" size="20" />
            </t-button>

            <div class="timeline-track">
                <div class="timeline-labels">
                    <span>{{ startLabel }}</span>
                    <strong>{{ timeLabel }}</strong>
                    <span>{{ endLabel }}</span>
                </div>
                <t-slider v-model="hour" class="timeline-t-slider" aria-label="选择流场时次" :label="false" :max="maxHour" :min="0" :step="1" @change-end="handleSlide" />
            </div>
        </div>
    </nav>
</template>

<script setup>
import { computed, onBeforeUnmount, ref } from 'vue'
import { formatFlowTime, frameIntervalLabel } from '../flowTime.js'

const props = defineProps({
    controller: {
        type: Object,
        required: true
    }
})

const controller = props.controller
const playing = ref(controller.playing)
const speed = ref(controller.speed)
const hour = ref(controller.simHour)
const displayHour = ref(controller.displayHour)
const timeLabel = ref(controller.timeLabel())
const buffering = ref(controller.buffering)
const speedOptions = [1, 2, 4, 8]
const maxHour = Math.max(0, controller.data.nFrames - 1)
const intervalLabel = frameIntervalLabel(controller.data.meta.times)

const startLabel = computed(() => formatAxisTime(controller.data.meta.times[0]))
const endLabel = computed(() => formatAxisTime(controller.data.meta.times[controller.data.meta.times.length - 1]))

function formatAxisTime(value) {
    return formatFlowTime(value, { compact: true })
}

function togglePlay() {
    controller.setPlaying(!controller.playing)
    playing.value = controller.playing
}

function handleSpeed(value) {
    controller.speed = value
    speed.value = value
}

function handleSlide(value) {
    controller.setPlaying(false)
    controller.setHour(Number(value))
}

function step(direction) {
    controller.setPlaying(false)
    const current = controller.simHour
    controller.setHour(direction > 0 ? Math.floor(current + 1e-6) + 1 : Math.ceil(current - 1e-6) - 1)
}

function handleExternal(nextHour, isBuffering) {
    hour.value = controller.simHour
    displayHour.value = nextHour
    playing.value = controller.playing
    speed.value = controller.speed
    timeLabel.value = controller.timeLabel()
    buffering.value = isBuffering
}

controller.onChange(handleExternal)

onBeforeUnmount(() => {
    controller.offChange(handleExternal)
})
</script>

<style lang="scss" scoped>
.flow-timeline {
    --td-brand-color: var(--basic-color, #0052d9);

    position: fixed;
    right: 448px;
    bottom: 24px;
    left: 16px;
    z-index: 8902;
    width: auto;
    max-width: 760px;
    margin: 0 auto;
    pointer-events: auto;
}

.timeline-toolbar {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 30px;
    margin: 0 0 8px 60px;
    color: #fff;
    font-size: 12px;
    text-shadow: 0 1px 3px rgba(0, 0, 0, 0.7);
}

.speed-buttons {
    display: flex;
    gap: 8px;
}

.speed-button {
    width: 44px;
    min-width: 44px;
    color: #fff;
    background: rgba(0, 0, 0, 0.42);
    border-color: rgba(255, 255, 255, 0.45);

    &:hover,
    &.is-active {
        color: var(--basic-text-color, #fff);
        background: var(--basic-color, var(--td-brand-color));
        border-color: var(--basic-color, var(--td-brand-color));
    }
}

.buffering-text {
    margin-left: 4px;
    color: var(--td-warning-color, #ed7b2f);
    text-shadow: 0 1px 3px rgba(0, 0, 0, 0.8);
}

.timeline-slider {
    display: flex;
    align-items: center;
    min-height: 64px;
    padding: 0 12px;
    background: rgba(255, 255, 255, 0.82);
    border: 1px solid rgba(255, 255, 255, 0.72);
    border-radius: 5px;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.18);
    backdrop-filter: blur(4px);
}

.play-button {
    flex: 0 0 auto;
    margin: 0 4px;
}

.step-button { flex: 0 0 auto; }
.timeline-track { margin-left: 10px; }
.interval-badge { padding: 2px 8px; border-radius: 3px; background: var(--basic-color, #0052d9); text-shadow: none; }
.frame-count { margin-left: auto; }

.timeline-track {
    flex: 1;
    min-width: 0;
}

.timeline-labels {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    gap: 12px;
    margin-bottom: 2px;
    color: var(--td-text-color-secondary, rgba(0, 0, 0, 0.6));
    font-size: 12px;

    strong {
        color: var(--theme-text-color, var(--basic-color, var(--td-brand-color)));
        font-size: 13px;
        font-weight: 600;
    }

    span:last-child {
        text-align: right;
    }
}

.timeline-t-slider {
    width: 100%;
    padding: 0 2px;

    :deep(.t-slider__rail),
    :deep(.t-slider__runway) {
        height: 6px;
        background: rgba(0, 0, 0, 0.14);
        border-radius: 4px;
    }

    :deep(.t-slider__track),
    :deep(.t-slider__bar) {
        height: 6px;
        background: var(--basic-color, var(--td-brand-color));
        border-radius: 4px;
    }
}

:global([theme-mode='dark']) .timeline-slider {
    background: rgba(36, 36, 36, 0.88);
    border-color: rgba(255, 255, 255, 0.2);
}

:global([theme-mode='dark']) .timeline-labels {
    color: rgba(255, 255, 255, 0.62);
}

@media (max-width: 760px) {
    .flow-timeline {
        right: 12px;
        bottom: 12px;
        left: 12px;
        width: auto;
        max-width: none;
    }

    .timeline-toolbar {
        margin-left: 0;
    }

    .timeline-labels span {
        display: none;
    }

    .timeline-labels {
        display: flex;
        justify-content: center;
    }
}
</style>
