# 数字流场项目与 SDK

此仓库包含数字流场演示工程、数据服务和可独立接入的 SDK。

| 目录 | 内容 | 使用说明 |
| --- | --- | --- |
| `digital-flow-field/` | 三维流场演示、粒子与潮头可视化、数据转换工具和后端服务 | [前端与演示](digital-flow-field/tdesign/README.md) · [数据服务](digital-flow-field/flow-field-service/README.md) |
| `digital-flow-sdk/` | 核心 SDK、Vue/TDesign 组件、原生及 Vue 示例 | [SDK 启动与验证](digital-flow-sdk/README.md) · [API 约定](digital-flow-sdk/docs/API约定.md) |

## 换机运行演示

安装依赖前，请先从原工作目录或项目维护方取得下列资源，放回对应位置。

- 流场演示使用 `digital-flow-field/output/flowfield-5min-verified/` 下的五分钟数据包，以及 `digital-flow-field/tdesign/public/data/flowfield/` 下的 `mesh.bin` 和 `frames.bin`。
- SDK 示例使用 `digital-flow-sdk/local-assets/runtime/` 下的授权运行时和 `digital-flow-sdk/local-assets/data/5min/` 下的五分钟数据包。可用版本见[运行时指纹](digital-flow-sdk/runtime-manifests/supermap3d-w3d-tested.json)。

在 Windows 上，分别进入 `digital-flow-field/tdesign/` 和 `digital-flow-sdk/` 执行 `npm.cmd ci` 安装依赖。准备完成后，在对应工程目录双击 `启动5分钟流场.cmd` 或 `启动SDK示例.cmd`。
