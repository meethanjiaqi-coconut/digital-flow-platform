<template>
    <t-config-provider :global-config="globalConfig">
        <router-view />
    </t-config-provider>
</template>

<script setup>
import { merge } from 'lodash-es';
import zhConfig from 'tdesign-vue-next/es/locale/zh_CN'

// 全局特性配置，引入英文语言配置包 enConfig
const globalConfig = merge(zhConfig, {
    // 可以在此处定义更多自定义配置，具体可配置内容参看 API 文档
    calendar: {},
    table: {},
    pagination: {},
});
</script>

<style scoped></style>
