# @digital-flow/vue-tdesign

可选的 Vue 3 + TDesign 控制面板。仅依赖 SDK 公开接口，组件卸载仅取消订阅，流场实例由宿主统一销毁。

```vue
<script setup>
import { FlowControls } from '@digital-flow/vue-tdesign'
import 'tdesign-vue-next/dist/tdesign.css'
import '@digital-flow/vue-tdesign/style.css'
defineProps({ flow: { type: Object, required: true } })
</script>
<template><FlowControls :flow="flow" @error="console.error" /></template>
```

安装同版本 `@digital-flow/sdk@0.1.0-alpha.1`，以及 `vue@^3.5`、`tdesign-vue-next@^1.20.5`。可调播放、时间、粒子数量/宽度/拖尾、动态水面、倒影和潮头开关。场次选择器、查询图表等完整业务面板留给后续组件迭代。
