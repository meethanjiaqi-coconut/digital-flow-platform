# 数字流场项目与 SDK

此仓库包含数字流场演示工程、数据服务和可独立接入的 SDK。

| 目录 | 内容 | 使用说明 |
| --- | --- | --- |
| `digital-flow-field/` | 三维流场演示、粒子与潮头可视化、数据转换工具和后端服务 | [前端与演示](digital-flow-field/tdesign/README.md) · [数据服务](digital-flow-field/flow-field-service/README.md) |
| `digital-flow-sdk/` | 核心 SDK、Vue/TDesign 组件、原生及 Vue 示例 | [SDK 启动与验证](digital-flow-sdk/README.md) · [API 约定](digital-flow-sdk/docs/API约定.md) |

## 换机运行演示

普通 Git 克隆包含两个示例所需的五分钟数据（144 帧）、原项目的逐时数据和 SDK 运行时。在 Windows 上安装 Node.js 24 LTS（含 npm）后，可直接启动。首次启动会安装依赖，请保持 npm 源可访问。卫星底图需要访问在线地图服务。

1. 双击 [启动5分钟流场.cmd](digital-flow-field/启动5分钟流场.cmd)，打开 [流场演示](http://127.0.0.1:5175/)。
2. 双击 [启动SDK示例.cmd](digital-flow-sdk/启动SDK示例.cmd)，打开 [原生示例](http://127.0.0.1:5185/examples/vanilla/)。同一服务也提供 [Vue + TDesign 示例](http://127.0.0.1:5185/examples/vue/)。
