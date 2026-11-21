# @digital-flow/vue-tdesign

可选的 Vue 3 + TDesign 数字流场组件包，仅依赖 `@digital-flow/sdk` 公开接口。

## 安装

安装同版本 `@digital-flow/sdk@0.1.0-alpha.2`，以及 `vue@^3.5`、`tdesign-vue-next@^1.20.5`。

```js
import 'tdesign-vue-next/dist/tdesign.css'
import '@digital-flow/vue-tdesign/style.css'
```

## 组件一览

| 组件 | 说明 |
| --- | --- |
| `<DigitalFlowField>` | 完整组合工作区（控制面板、时间轴、点选过程线弹窗），可绑定已有 `:flow`，也可传入 `provider` + `renderer` 自动创建并随组件卸载销毁 SDK |
| `<FlowControls>` | 控制面板：场次切换、数据概况、图层显隐、粒子密度/线宽/拖尾预设与复位、水色模式、水质预设、倒影/微浪/质量档位、潮头状态提示 |
| `<FlowTimeline>` | 底部时间轴：输出间隔徽章、倍速切换、上一/下一时次、播放暂停与进度滑块 |
| `<FlowScenarioSelector>` | 预报场次下拉选择器，支持自动拉取 `listScenarios()` 与事务式切换 |
| `<FlowLegend>` | 与三维渲染一致的流速/水位色带图例 |
| `<FlowQueryPopup>` | 点位信息与过程线弹窗（兼容湿单元、干单元与静流 `dirDeg: null`） |
| `<FlowMiniChart>` | 独立水位/流速双轴过程线 SVG 图表 |

## 用法示例

### 1. 宿主创建流场实例，仅挂载独立组件或工作区

```vue
<script setup>
import { DigitalFlowField } from '@digital-flow/vue-tdesign'
defineProps({ flow: { type: Object, required: true }, viewer: { type: Object, default: null } })
</script>

<template>
  <DigitalFlowField :flow="flow" :viewer="viewer" show-locate @locate="flyToEstuary" />
</template>
```

### 2. 由 `<DigitalFlowField>` 管理 SDK 生命周期

```vue
<template>
  <DigitalFlowField
    :provider="provider"
    :renderer="renderer"
    :extensions="extensions"
    :viewer="viewer"
    :initial-selection="{ latest: true }"
    @error="onError"
  />
</template>
```

独立订阅型组件（`<FlowControls>`、`<FlowTimeline>`、`<FlowScenarioSelector>`、`<FlowLegend>`、`<FlowQueryPopup>`）卸载时只取消订阅，不会销毁宿主传入的 `flow` 实例。
