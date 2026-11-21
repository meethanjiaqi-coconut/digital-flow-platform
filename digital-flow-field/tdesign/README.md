# Framework2d3d

本项目用于提供二三维一体化开发前端基础框架，基于 Vue 3 + Vite 构建，集成 OpenLayers 二维地图与 SuperMap WebGL 三维场景，并通过 `@map-synchronizer` 实现二三维联动切换。


## 技术栈

| 类别 | 技术 |
|------|------|
| 前端框架 | Vue 3、Vue Router（Hash 模式）、Pinia |
| 构建工具 | Vite 7 |
| UI 组件库 | TDesign Vue Next（`tdesign` 分支） |
| 样式方案 | SCSS、UnoCSS、flex.css |
| 网络请求 | Axios |
| 二维地图 | OpenLayers、SuperMap iClient for OpenLayers |
| 三维场景 | SuperMap3D、SuperMap3DEx |
| 二三维联动 | `@map-synchronizer` |

地图相关库通过 `index.html` 以静态脚本方式引入，无需额外 npm 安装。

## 功能特性

- **标准布局**：顶部导航栏（Logo、系统标题、动态菜单）+ 内容区域
- **二三维地图**：`map-viewer` 组件集成 OpenLayers 与 SuperMap3D，支持二三维联动与切换
- **动态菜单**：从接口或本地 JSON 加载菜单，支持路由跳转、iframe 嵌入、新窗口打开
- **依赖注入**：地图实例通过 `provide/inject` 向子页面传递，便于业务组件调用
- **全局工具**：Axios 请求封装、事件总线（mitt）、地图工具方法
- **图标方案**：UnoCSS + 本地 SVG 图标（`src/@icons`），使用 `i-svg:图标名` 调用
- **组件自动导入**：TDesign 组件与 Vue API 通过 `unplugin-auto-import`、`unplugin-vue-components` 按需引入

## 环境要求

- Node.js >= 18
- 推荐使用 [pnpm](https://pnpm.io/)（项目已包含 `pnpm-lock.yaml`）

## 快速开始

```bash
# 安装依赖
pnpm install

# 启动开发服务（默认 http://0.0.0.0:5175）
pnpm dev

# 生产构建
pnpm build

# 预览构建产物
pnpm preview

# 代码检查与格式化
pnpm lint
pnpm format
```

## 配置说明

### 本地流场数据

本轮 5 分钟效果入口：双击仓库根目录 `启动5分钟流场.cmd`，或在本目录运行 `npm.cmd run dev:demo -- --host 127.0.0.1 --port 5175 --strictPort --open`。
`demo` 模式直接打开流场工作台，默认三维；普通 `dev` 保留原框架路由。

`.env.demo` 和 `.env.development` 配置本地数据：`VITE_FLOW_LOCAL_PACKAGE=../output/flowfield-5min-verified`。
优先提供 2026-10-25 00:00—11:55 的 144 个真实 5 分钟输出；同时保留 `public/data/flowfield/` 的原 72 帧逐时场次。
私有仓库已包含五分钟转换包和逐时数据 `meta.json`、`mesh.bin`、`frames.bin`。克隆后可直接用启动脚本运行演示，首次启动会自动执行 `npm.cmd ci` 安装依赖。

底图演示默认使用 Esri World Imagery，也可通过 `window.FLOW_FIELD_BASEMAP_URL` 配置兼容的 XYZ 服务。
`npm.cmd run build:demo` 构建后，可用 `npm.cmd run preview:demo` 预览；单独部署 `dist` 仍需流场 API。
详细数据范围、截图和验证记录见 [5分钟流场效果验收说明](../docs/handover/5分钟流场效果验收说明.md)。

若需恢复远程接口，将 `VITE_FLOW_DATA_SOURCE` 改为 `remote`，并配置
`VITE_FLOW_PROXY_TARGET=http://服务器地址:端口`，然后重启开发服务。
### 河口水面与粒子调节

默认采用“河口水面”，使用泥沙青褐色、沿流向平移的纹理和动态波纹；按视距保持可见的运动尺度，关闭粒子后水面仍会流动。纹理平移采用展示用速度增强，查询数值仍来自真实模型输出；可切回流速或水位专题着色。
“粒子密度”和“粒子线宽”直接显示在“流向粒子”开关下方，无需展开“显示参数”。左上角标题卡片已移除。
调整及验证记录见 [河口水面与粒子面板调整](../docs/handover/河口水面与粒子面板调整.md)。

### 水面箭头与潮头位置

进入三维场景后，可在“数字流场”面板中开启“水面箭头”，并用“箭头大小”调整 1–80 倍尺寸。
“潮头位置”复用钱塘江项目的河口判识算法，在本地工作线程中根据相邻时次的流速、水位变化计算，显示贴水浪脊和位置标注，随播放与拖动时间轴更新。
首时次没有前序数据，未识别到潮头时不显示标注；显示结果属于模型判识。关闭水面会同时关闭箭头和潮头，水位夸张也会同步作用于潮头。

时间轴的暂停会同时冻结模型时次、水面波纹、粒子位置与拖尾、潮头纹理；恢复播放不会补算暂停期间的时间。
暂停时仍可拖动时间轴查看其他时次。时次之间的画面由相邻真实输出插值形成，时间按模型时间戳计算。
粒子按流速着色，默认约 1.6 万个、较细线条及较低叠加亮度；保留数据驱动的运动方向和速度。
运行 `node tools/check_playback_pause.mjs`（仓库根目录）可检查暂停、跳转和恢复播放的时钟行为。

### 系统配置 `public/config/config.js`

```js
$.SYSTEM_CONFIG = {
    SYSTEM_TITLE: '初始框架',          // 系统标题
    SERVER: {
        DEFAULT: 'http://...',         // 后端服务地址
        LOCAL: './'                    // 本地静态资源路径
    },
    FULL_EXTENT: [minX, minY, maxX, maxY]  // 默认全图范围
}
```

### 接口配置 `public/config/apis.js`

```js
$.APIS = {
    SYSTEM: {
        MENU: `${SYSTEM_CONFIG.SERVER.LOCAL}data/menu.json`
    },
    MANAGER: {
        FILE_MANAGER: `${SYSTEM_CONFIG.SERVER.DEFAULT}manager/filemanager`,
        FILE_UPLOAD: `${SYSTEM_CONFIG.SERVER.DEFAULT}manager/fileupload`
    }
}
```

### 菜单数据 `public/data/menu.json`

菜单项支持以下 `type` 类型：

| type | 说明 |
|------|------|
| `route` | 内部路由跳转，通过 `url` 指定路径 |
| `location` | 在当前页面 iframe 中嵌入外部链接 |
| `location_blank` | 在新窗口中打开外部链接 |

含子菜单时通过 `children` 数组嵌套即可。

## 目录说明

```
├── public                          # 静态资源
│   ├── config                      # 配置文件
│   │   ├── apis.js                 # 接口地址配置
│   │   └── config.js               # 系统全局配置
│   ├── data                        # 本地/测试数据
│   │   └── menu.json               # 系统菜单模拟数据，可按需改为接口获取
│   ├── images                      # 图片资源
│   └── libs                        # 第三方库
│       ├── @map-synchronizer       # 二三维联动封装包
│       ├── ol                      # OpenLayers 地图库
│       ├── supermap                # 超图 iClient for OpenLayers
│       ├── SuperMap3D              # 超图 WebGL 三维开发包
│       └── SuperMap3DEx            # 基于 SuperMap3D 的扩展开发包
├── src
│   ├── @icons                      # 本地 SVG 图标
│   ├── components                  # 业务组件（含业务逻辑）
│   ├── layout                      # 页面布局（顶栏、菜单）
│   ├── router                      # 路由配置
│   ├── stores                      # Pinia 状态管理
│   ├── style                       # 全局样式与变量
│   ├── utils                       # 公共方法与工具类
│   │   ├── EventBus.js             # 事件总线
│   │   ├── install.js              # 组件/指令注册辅助方法
│   │   ├── Request.js              # Axios 请求封装
│   │   └── ToolFunction.js         # 地图工具方法
│   ├── views                       # 页面入口
│   ├── widgets                     # 通用组件（不含业务逻辑）
│   │   ├── map-viewer              # 二三维地图容器
│   │   └── svg-icon                # SVG 图标组件
│   ├── App.vue                     # 根组件
│   └── main.js                     # 应用入口
├── eslint.config.js                # ESLint 配置
├── index.html                      # HTML 入口（引入地图库与全局配置）
├── package.json                    # 项目依赖
├── uno.config.js                   # UnoCSS 配置（SVG 图标）
└── vite.config.js                  # Vite 配置
```

## 开发指南

### 地图初始化

在页面中使用 `map-viewer` 组件，通过 `@init` 事件获取二三维联动实例：

```vue
<template>
    <map-viewer @init="initView" />
</template>

<script setup>
import MapViewer from '@/widgets/map-viewer'
import { shallowRef, provide } from 'vue'

const syncRef = shallowRef()

provide('getMap', () => syncRef.value?.map)
provide('getViewer', () => syncRef.value?.viewer)
provide('getSync', syncRef)

function initView(sync) {
    syncRef.value = sync
    // 启用三维场景控件
    sync.viewer.locationBar.enabled = true
    sync.viewer.compass.enabled = true
    sync.viewer.zoomController.enabled = true
    // 添加二维图层、设置视图等
}
</script>
```

子页面通过 `inject('getSync')` 获取联动实例，调用 `sync.enabled = !sync.enabled` 可切换二三维模式。

### 新增页面

1. 在 `src/views` 下创建页面组件
2. 在 `src/router/routes.js` 中注册路由
3. 在 `public/data/menu.json`（或后端菜单接口）中添加对应菜单项

### 组件分层约定

| 目录 | 用途 |
|------|------|
| `src/widgets` | 通用 UI/地图组件，不含具体业务逻辑，可跨项目复用 |
| `src/components` | 业务组件，包含特定业务逻辑 |
| `src/views` | 页面级入口，组合 widgets 与 components |

### 全局变量

`config.js` 与 `apis.js` 在 `index.html` 中先于应用脚本加载，可在代码中直接使用 `SYSTEM_CONFIG`、`APIS` 全局变量。

### 河口水面开源材质接入

自然河口模式已采用 three.js r180 Water2 的双相法线流动思路，沿用模型 U/V 和可暂停时钟，并修正 W3D 局部坐标与地球坐标的混用。法线贴图和 MIT 许可证位于 `public/textures/estuary/`；全部本地加载，不增加 Three 渲染器依赖。现已加入基于当前场景颜色和深度的屏幕空间倒影、岸线羽化和微浪顶点起伏。平面影像不含真实建筑几何，建筑倒影需场景本身已加载三维模型。详见 [开源方案与接入说明](../docs/handover/河口水面开源方案与接入说明.md)。
河口模式新增流动强度（默认 2.0 倍，范围 0.5～3.0 倍），用于增强画面位移和流向辨识度，不改变模型流速或预报时间。大小波纹与水面明暗纹理沿同一 U/V 平移，调节时保持纹理相位连续。
最新整改统一了水面与粒子的位移规则，补充了退水淡出、近岸渐变、场景倒影与微浪起伏。详见[整改与验收记录](../docs/handover/河口水面整改与验收.md)。

河口水面现支持“潮头清浊分界”：同一水面沿当前判识潮头显示潮前较清、潮后较浑的连续过渡，默认开启，可独立于潮头标记使用。清浊为视觉示意，不代表实测含沙量。原版已在修改前备份，路径、开关说明和验证证据见[潮头清浊分界效果与备份](../docs/handover/潮头清浊分界效果与备份.md)。

2026-11-16 完成连续潮头跟踪、弯道方向统一、混合带细丝、潮后浑水扩散消退及近景浪脊/倒影完善。待确认时段会明确提示，随机跳时与顺序播放使用一致历史。最新使用方法与证据见[五项完善验收](../docs/handover/潮头与河口水面五项完善验收.md)。
