<template>
    <div class="ff-scenario">
        <span class="label">场次</span>
        <t-select
            :value="modelValue"
            :options="options"
            :loading="loading"
            size="small"
            filterable
            placeholder="选择可用场次"
            @change="$emit('update:modelValue', $event)"
        />
    </div>
</template>

<script setup>
defineProps({
    modelValue: { type: String, default: '' },
    options: { type: Array, default: () => [] },
    loading: { type: Boolean, default: false }
})
defineEmits(['update:modelValue'])
</script>

<style scoped lang="scss">
.ff-scenario {
    position: absolute;
    top: 64px;
    left: 16px;
    z-index: 4;
    width: 300px;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 9px 12px;
    border: 1px solid rgba(80, 140, 210, 0.35);
    border-radius: 8px;
    background: rgba(13, 22, 38, 0.88);
    backdrop-filter: blur(6px);
    .label {
        color: #8fa8c8;
        font-size: 12px;
        white-space: nowrap;
    }
    :deep(.t-select__wrap) {
        flex: 1;
    }
}
</style>
