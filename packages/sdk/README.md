# @digital-flow/sdk · 0.1.0-alpha.2

框架无关的数字流场 SDK。加载真实网格和逐帧 U/V、水位，提供播放、查询、粒子与河口水面渲染。清浊分界是由流场推断的视觉示意，不是实测含沙量。

```js
import { createFlowField, createHttpProvider } from '@digital-flow/sdk'
import { createSuperMap3DRenderer, webMercatorProj4 } from '@digital-flow/sdk/supermap3d'
import { createTidalEstuary, qiantangProfile } from '@digital-flow/sdk/tidal-estuary'

const flow = createFlowField({
  renderer: createSuperMap3DRenderer({
    viewer, // 由宿主创建和销毁
    runtime: { SuperMap3D, w3d, proj4: webMercatorProj4 },
    assets: {
      colorTable: '/runtime/SuperMap3D/Assets/Data/colorTable.png',
      colorTable2: '/runtime/SuperMap3D/Assets/Data/colorTable2.png',
    },
  }),
  provider: createHttpProvider({
    baseUrl: '/flow-field',
    request: (url, init) => fetch(url, { ...init, credentials: 'include' }),
    timeoutMs: 30000, // 可选；retry 默认 {retries:2,baseDelayMs:300,maxDelayMs:3000}，false 关闭
  }),
  extensions: [createTidalEstuary({ profile: qiantangProfile })],
  playback: { autoPlay: false, secondsPerFrame: 2, rate: 1 },
  timeZone: 'Asia/Shanghai',          // 可选，UI 显示时区（ISO UTC 存储）
  tidalHistoryBudgetMB: 256,          // 可选，潮头历史内存预算，超限自动停用
})

const unsubscribe = flow.on('statechange', state => console.log(state.displayedTime, state.error?.message))
await flow.loadScenario({ sourceRunId: 'RST-WUV-20261025-5MIN' })
await flow.seek('2026-10-25T02:20:00+08:00')
flow.setOptions({ particles: { count: 16384, lineWidth: 1, trailSeconds: 1.5 } })
flow.play()
const sample = await flow.queryAt({ lon: 120.325, lat: 30.275 })
// sample.status === 'dry' 表示干单元（数值字段为 null）；域外返回 null
// 宿主卸载时：
unsubscribe()
await flow.destroy()
```

## 事务式场次切换与错误模型

`loadScenario` 在已有场次时保持 `status:'ready'`、`switching:true`：候选数据全部就绪并 attach 成功前旧场次原样可用；任一步失败自动回滚旧场次，首次加载失败才进入 `status:'error'`。相邻切换不会丢播放意图。

公开方法抛出的非取消错误一律是 `FlowError`（`code`/`recoverable`/`toJSON()`，完整码表见 `docs/API约定.md`），唯一例外是被取代/取消的 `AbortError`。`state.error` 是其 JSON 快照。播放中瞬时取数失败会自动暂停并回退到已显示帧位，`play()`/`seek()` 后重试；渲染器上下文丢失经 `onError` 上报后可用 `reinitialize()` 重建会话。

事件共八个：`statechange`、`error`、`destroy`、`progress`、`warning`、`scenariochange`、`timechange`、`ready`；订阅返回取消函数，未知事件名抛 `INVALID_ARGUMENT`。`getCapabilities()` 与 `getDiagnostics()` 分别返回能力快照（`series:'provider'|'frames'`、`worker` 模式、潮头可用性）与运行诊断（缓存计数、provider `getStats()`、最近 20 条 warning，不含 URL）。

## 打包工具接入

**Vite 开发模式必须排除依赖预构建**，否则 Worker 404、法线纹理返回 HTML：

```js
export default { optimizeDeps: { exclude: ['@digital-flow/sdk'] } }
```

生产构建会把 Worker 与纹理产出到 `assets/`，无需额外配置。webpack 5 等若未复制 Worker/纹理，传 `workerUrl`/`workerFactory` 与 `assets.normals` 指定发布地址。出现 `WORKER_FALLBACK`、`ASSET_LOAD_FAILED` 警告即说明资源路径有问题。

**`runtime.proj4` 三条规则**：`globalThis.proj4` 已是函数则直接使用、不覆盖；否则安装 `runtime.proj4`（可用导出的 `webMercatorProj4`，仅支持 EPSG:4326→EPSG:3857）；两者都没有时 attach 抛 `UNSUPPORTED_RUNTIME`。会话结束只恢复仍是 SDK 安装的全局，宿主中途替换的值会保留。

## 渲染选项

`quality: 'standard' | 'low'`（默认 standard）：low 降低流场纹理至 1024×512、拖尾按 0.5 倍分辨率；`getCapabilities().renderer.recommendedQuality` 在无 WebGL2 或最大纹理 <4096 时建议 low。`water` 组新增 `arrowScale`（1–80，默认 24）、`palette`（`'natural'|'tech'`，默认 natural）、`qualityPreset`（`'off'|'I'|'II'|'III'|'IV'|'V'|'BAD_V'`，选项见导出的 `WATER_QUALITY_OPTIONS`）。互斥规则：patch 设非 off 水质预设会把 `colorMode` 改为 `river`；patch 把 `colorMode` 设为 speed/level 会把 `qualityPreset` 改为 `off`；同一 patch 两者冲突抛 `INVALID_ARGUMENT`。河口清浊、沿流运动强度与微浪只在 `river + natural + 水质 off` 时生效。

## 数据源

静态文件服务：`createStaticProvider({ manifestUrl: '/data/package.json', request })`。自定义数据源实现 `FlowProvider`；所有二进制返回解压后的 `ArrayBuffer`。HTTP 与静态内置数据源同时兼容带 `Content-Encoding: gzip` 和原始 `.gz`。Worker 不独立请求数据，统一走主线程数据源，保留鉴权。

ESM 包包含类型、Worker、水面法线纹理及纹理来源说明。**不包含** SuperMap3D/W3D 引擎、许可、底图和业务模型数据。宿主提供已授权的匹配运行时；未复制 Worker/纹理时用 `workerUrl`/`workerFactory` 和 `assets.normals` 指定地址，Worker 需同源或遵守宿主 CSP。

SDK 不自动播放、不移动相机、不绑定点击、不接管宿主时钟，也不销毁 Viewer。可选河口扩展必须显式传入区域配置；不配置扩展时不计算潮头。首版支持桌面浏览器、单页面单个活动 SuperMap3D 流场实例，节点数最多 65535；具体运行时指纹见工程 `runtime-manifests`。

Alpha 适合接入联调；多实例、其他引擎和移动端未纳入本版验证。
