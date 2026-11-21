# 纯三维数字流场依赖与引入说明

## 1. 测试范围

本项目直接通过 `new SuperMap3D.Viewer(...)` 创建三维场景，不创建 `ol.Map`，也不使用二三维同步器。

明确不依赖：

- OpenLayers `ol.js`。
- SuperMap iClient OL。
- `SuperMap3DEx.js`。
- `map-synchronizer.umd.js`。

## 2. 必需运行库

| 依赖 | 文件 | 用途 |
|---|---|---|
| SuperMap3D | `libs/SuperMap3D/` 完整目录 | Viewer、场景、相机、纹理、GPU 命令和拾取 |
| W3D | `libs/w3d/w3d.umd.js` | 游戏水面和 `WaterFloodSimulation` |
| W3D 伴随资源 | `libs/SuperMap3D/Assets/Data/` | W3D 法线、配色和线纹理 |

SuperMap3D 必须整体发布，至少包含：

```text
SuperMap3D.js
Assets/
language/
ReactiveWidgets/
SkyAtmosphereSystem/
ThirdParty/
Widgets/
Workers/
```

新提供的 SuperMap3D 原包没有 `Assets/Data/`，但当前 `w3d.umd.js` 会读取其中的 `normal004.jpg`。因此本测试版额外补入以下 W3D 伴随资源，部署时同样不能遗漏：

```text
libs/SuperMap3D/Assets/Data/
├─ colorTable.png
├─ colorTable2.png
├─ line.png
├─ normal004.jpg
└─ waternormals.jpg
```

不能只复制 `SuperMap3D.js`，因为 Worker、纹理、语言和 Widget 会在运行时动态请求。

## 3. HTML 引入顺序

```html
<link rel="stylesheet" href="./libs/SuperMap3D/Widgets/widgets.css" />

<script>
    window.SUPERMAP3D_BASE_URL = new URL('./libs/SuperMap3D/', document.baseURI).href
</script>

<script src="./libs/SuperMap3D/SuperMap3D.js"></script>

<script>
    window.Cesium = window.SuperMap3D
</script>

<script src="./libs/w3d/w3d.umd.js"></script>

<script type="module" src="./src/main.js"></script>
```

注意：

1. `SUPERMAP3D_BASE_URL` 必须在 `SuperMap3D.js` 之前设置。
2. W3D 必须在 SuperMap3D 之后加载。
3. 业务入口必须在 W3D 之后加载。
4. 这些脚本不要添加 `async`。
5. 子目录部署使用 `./libs/...`，不要错误地写成域名根路径 `/libs/...`。

## 4. Viewer 接入方式

独立创建 Viewer：

```js
const viewer = new SuperMap3D.Viewer('viewer', {
    scene3DOnly: true,
    imageryProvider: false
})
```

如果定川基座已经创建 Viewer，则不应重复创建，直接把现有对象传给流场层：

```js
const water = new W3dWaterSurfaceLayer(viewer, flowData)
const particles = new ParticleFlowLayer(flowData, viewer)

viewer.scene.primitives.add(particles)
```

建议通过 Vue `provide/inject` 或组件属性传递 Viewer，不依赖临时全局变量。

## 5. 运行时检查

```js
console.table({
    SuperMap3D: typeof window.SuperMap3D,
    w3d: typeof window.w3d,
    SuperMap3DEx: typeof window.SuperMap3DEx,
    ol: typeof window.ol
})
```

本纯三维版本预期：

```text
SuperMap3D   object
w3d          object
SuperMap3DEx undefined
ol           undefined
```

## 6. 已锁定文件

| 文件 | SHA-256 |
|---|---|
| 新 `SuperMap3D.js` | `4B9EC76A75C3DA2507421F7252CEA97AC86910FFCAE49FD6C7D722A1475AD81C` |
| `w3d.umd.js` | `21A2839096C1CD197537F3E68A2AE37B7B0C56685FC785BA0E35EFB64911E0F3` |

## 7. 数据说明

本测试页通过静态 `meta.json + mesh.bin + frames.bin` 加载内置样例，以便隔离验证三维依赖。

生产集成仍可使用现有接口：

```text
/flow-field/api/v1/scenarios/latest/manifest
/flow-field/api/v1/meshes/{meshId}
/flow-field/api/v1/scenarios/{id}/frames/{index}
```

更换 Viewer 创建方式不会改变后台接口、Manifest、网格或帧数据结构。

## 8. 本次浏览器验收

- `SuperMap3D: object`。
- `w3d: object`。
- `SuperMap3DEx: undefined`。
- `ol: undefined`。
- `webgl2: true`。
- 控制台 0 error、0 warning。
- SuperMap3D Worker、W3D 法线纹理、两张配色纹理和样例数据请求全部返回 HTTP 200。
