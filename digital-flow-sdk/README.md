# 数字流场 SDK

独立工程：`D:\git_repo\digital-flow-sdk`。首版 `0.1.0-alpha.2` 从现有数字流场演示工程提取，保留当前水面、粒子、潮头清浊及闪烁修复。原工程仅作为对照，没有迁移或覆盖它。

## 本机启动

双击 **启动SDK示例.cmd**，或在本目录执行：

```powershell
npm ci
npm run build
npm run dev
```

原生接入：<http://127.0.0.1:5185/examples/vanilla/>  
Vue + TDesign：<http://127.0.0.1:5185/examples/vue/>  
子目录部署检查：<http://127.0.0.1:5185/sdk-demo/examples/vanilla/>

本机已复制匹配的引擎和 144 帧真实 5 分钟数据到 `local-assets/`；该目录不进入 Git 或 npm 包。换机后需由维护方补齐，或修改示例使用自己的授权运行时和数据地址。首次加载默认暂停，点击播放查看流动效果。

## 已有内容

- `packages/sdk`：核心调用入口、HTTP/静态/自定义数据源、真实时间跳转、播放、空间查询、SuperMap3D 适配、显式启用的河口潮头扩展。
- `packages/vue-tdesign`：独立可选的控制面板，恢复粒子数量、宽度、拖尾调节，并提供水面和潮头控制。
- `examples`：只通过 SDK 公开接口接入的原生与 Vue 示例。
- `baseline`：提取前源码快照与 SHA-256，可用于视觉回归；无需启动原工程。
- `artifacts`：本地产生的 npm 安装包、摘要及干净安装验证记录。
- `runtime-manifests`：经本机验证的引擎文件指纹。

接入代码见 [SDK 说明](packages/sdk/README.md)，接口语义见 [API 约定](docs/API约定.md)，组件接入见 [UI 说明](packages/vue-tdesign/README.md)，分发方式见 [在线与离线交付](docs/在线与离线交付.md)。

## 验证与打包

```powershell
npm test
npm run typecheck
npm run verify:baseline
npm run pack:local
npm run verify:packages
```

开发者环境需要 Node.js 22+。`verify:baseline` 比较本机原工程的 16 个提取文件；如果原工程后续继续修改，它会报告差异，需要人工决定是否更新 SDK。

这是可运行的接入 Alpha，尚非正式 SDK 发布。当前支持一个活动流场实例和已记录的 SuperMap3D/W3D 组合。长时间稳定性、完整业务宿主回接、其他引擎与移动端尚未完成；逐项状态见 [实施状态](docs/实施状态.md)。
