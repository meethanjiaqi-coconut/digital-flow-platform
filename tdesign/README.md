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
