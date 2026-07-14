# 钱塘江河口三维数字流场可视化 — 设计文档

日期:2026-07-14
状态:已确认(用户批准)

## 1. 背景与目标

基于钱塘江河口风暴潮二维水动力模型的网格数据与结果数据,在现有 tdesign 工程(Vue3 + TDesign + SuperMap iClient3D 二三维一体化)中,实现三维场景下的数字流场可视化:

- **水面效果**:游戏引擎级——水位驱动高程、流向驱动波纹、菲涅尔反射、干湿动态边界
- **粒子效果**:Windy 风场同款 GPU 粒子平流 + 拖尾
- **时间动画**:72 小时预报结果时间轴播放,相邻整点插值过渡
- **点击查询**:点击展示该点当前水位、流速、流向 + 72 小时过程线

## 2. 数据现状(已勘察确认)

### 网格 `风暴潮流场网格/grid-wgs84.shp`
- 71,958 个四边形单元(Polygon,WGS84 经纬度),含退化四边形(三角形)
- 属性仅 `idx`(1..71958),与 DAT 单元序号一一对应
- 域范围:115.85°E–139.04°E,19.35°N–42.38°N(大域模型,河口为加密区)

### 结果 `AREA_RST_WUV_*/AREA_RST_WUV_YYYY_MM_DD_08_00.DAT`
- Tecplot ASCII FEM 格式,每文件 ~92MB
- 首 ZONE:N=38,081 节点(X,Y 投影米坐标 + Z 节点海拔),E=71,958 单元
  (Z1 水位、U、V 流速为 CELLCENTERED),含四边形连接表
- 后续 ZONE 共享坐标与连接表(`VARSHARELIST=([1-3]=1)`),仅含 Z1/U/V
- 每文件 24 个整点 ZONE;3 个文件共 72 小时:2026-07-09 08:00 → 2026-07-12 07:00
- 数值特征:湿单元水位约 -2~+2m;干(陆地)单元 Z1 = 地面高程(可达 1357m);
  流速 ±2.5 m/s;节点 Z 为海拔(海底为负,-6662~+1810m)

### 前端工程 `tdesign/`
- Vue 3.5 + Vite 7 + TDesign Vue Next + UnoCSS + Pinia
- `public/libs`:SuperMap3D(Cesium 内核,含 ParticleSystem/PostProcessStage/
  CustomShader/Primitive/Appearance)、SuperMap3DEx、OpenLayers、map-synchronizer
- `src/widgets/map-viewer` 已封装 ol.Map + SuperMap3DEx.Viewer + 二三维同步;
  `views/index.vue` 通过 provide('getViewer'/'getSync'/'getMap') 分发实例
- 底图:沿用现有 Google 影像 XYZ(gac-geo.googlecnapps.club)

## 3. 已确认的需求决策

| 决策点 | 结论 |
|---|---|
| 时间维度 | 时间轴动画播放,播放/暂停/倍速,整点间插值 |
| 点击查询 | 当前值 + 72h 水位/流速过程线 |
| 底图 | 沿用现有 Google 影像 XYZ |
| 渲染方案 | 方案 A:自定义 GPU 管线(自定义 GLSL 水面 + GPU 粒子平流) |
| 数据管线 | Python 离线预处理为紧凑二进制,前端全量加载(~30MB) |

## 4. 总体架构

```
离线预处理 (Python, tools/preprocess_flowfield.py)
  输入: 风暴潮流场网格/grid-wgs84.shp + AREA_RST_WUV_*/*.DAT
  输出: tdesign/public/data/flowfield/
    ├── mesh.bin    节点WGS84坐标 + 三角索引(uint16) + 单元中心 + 单元四节点表
    ├── frames.bin  72帧 × 71,958单元 × [Z1 cm, U mm/s, V mm/s] int16(干=哨兵)
    └── meta.json   时间轴、量化参数、数值范围、域 bbox、统计信息

前端 (全部新增,不改动 map-viewer 框架)
  src/flowfield/
    ├── FlowFieldData.js          加载解码、空间索引、按时刻/单元取值、节点值聚合
    ├── WaterSurfacePrimitive.js  自定义水面 Primitive + GLSL 材质
    ├── ParticleFlowLayer.js      GPU 粒子平流层(流场纹理/更新/拖尾三段式)
    └── FlowFieldController.js    时钟驱动、帧插值调度、图层生命周期
  src/views/flow-field.vue        UI:时间轴、控制面板、图例、点击弹窗
```

## 5. 离线预处理

1. 解析 shapefile(纯 Python struct,读 SHP 多边形顶点序列;不引 GDAL)
2. 解析 DAT 首 ZONE 获取连接表与节点 Z;逐 ZONE 流式读 Z1/U/V
3. **节点坐标重建**:第 i 个多边形的顶点顺序对应连接表 conn[i] 的节点顺序,
   逐单元收集节点经纬度并做一致性校验(同一节点在相邻单元中的坐标容差 < 1e-9°);
   由此得到 38,081 个节点的 WGS84 坐标,绕开 DAT 投影反演
4. **干湿判别**:单元底高程 zb = 四节点 Z 均值;depth = Z1 − zb;
   depth < 0.05m 判干,帧数据中写哨兵值 Z1 = −32768
5. **量化**:Z1 → int16 厘米;U/V → int16 毫米每秒;单帧 71,958×6B ≈ 422KB,
   72 帧 ≈ 30.4MB
6. 三角化:四边形 → 2 三角形;退化四边形 → 1 三角形;索引 uint16(节点数 < 65536)
7. 输出统计(各帧水位/流速范围、干湿单元数)并抽样 10 个单元对照原始 ASCII 值

## 6. 水面渲染(WaterSurfacePrimitive)

- 单个自定义 Primitive,约 14 万三角形,顶点即模型节点
- **节点值聚合**:cell-centered → 节点值取邻接单元均值(预建 node→cells 映射);
  仅在跨整点时为前后两帧各算一次,shader 内 `mix(a, b, t)` 插值
- 顶点属性:levelA/levelB(水位)、uvA/uvB(流速)、wetA/wetB
- 顶点着色器:水面高程 = 插值水位 × 夸张系数(UI 1×–200×),沿椭球法线抬升;
  叠加与流速相关的正弦微波浪
- 片元着色器:
  - 双层法线贴图沿实际流向滚动(flow mapping 双相位混合消滑动感)
  - 菲涅尔反射 + Blinn-Phong 太阳高光 + 程序化天空色环境反射
  - 水色按流速渐变(深蓝→青白),备选"科技蓝"配色;浅水半透明
  - 干湿边界:wet 插值 < 阈值 discard/淡出,水边线随播放自然进退,近边界泡沫噪声
- 法线贴图资产:程序生成或内置一张免版权水面法线纹理,放 public/data/flowfield/

## 7. 粒子系统(ParticleFlowLayer,Windy 架构)

三段式 GPU 管线(参考 Cesium 3D-Wind-Field 成熟架构,基于全局 SuperMap3D 命名空间手写,不引外部 Cesium 依赖):

1. **流场纹理 pass**:把网格三角形以 U/V 为颜色离屏渲染到跟随视野的
   2048×1024 RGBA float 纹理(等经纬投影,视野 bbox ∩ 域 bbox),RG 写 U/V,B 写 wet;
   相机移动或时间推进时重渲,一个 draw call
2. **粒子更新 pass**:位置存 RGBA float 纹理 ping-pong;fragment 采样流场纹理,
   pos += uv·dt·speedFactor;寿命递减;出界/搁浅/寿命尽 → 伪随机重生于视野内湿区
3. **绘制 + 拖尾 pass**:粒子画为短线段(上一位置→当前位置),颜色按流速映射,
   加法混合;拖尾 = 上帧累积纹理 × 衰减系数(~0.96)叠加本帧,再合成到场景
- 默认 65,536 粒子(256×256 位置纹理),UI 可调 16k–262k
- dt 随相机高度自适应,放大河口时粒子速度感知一致

## 8. 点击查询

- ScreenSpaceEventHandler LEFT_CLICK → scene.pickPosition/globe.pick → 经纬度
- 空间索引:域 bbox 512×512 uniform grid,单元 bbox 入桶;查询 = 候选单元 +
  点在多边形精测,数据加载时构建(毫秒级查询)
- TDesign 浮动面板:经纬度、水位(m)、流速(m/s)、流向(罗盘方位 + 箭头);
  72h 过程线为手写轻量 SVG 折线图(水位 + 流速双曲线),当前时刻游标随播放联动
- 点击处落标记;点在网格外提示"该位置无模型数据"

## 9. UI 与页面结构

- `flow-field.vue` 挂为 index.vue 默认子路由,inject 现有 viewer
- 底部时间轴:播放/暂停、倍速(1×/2×/4×/8×)、t-slider 拖动、当前时间显示
- 右上控制面板(t-card):水面/粒子图层开关、粒子数量、水位夸张系数、配色切换
- 流速图例色条;初次加载 t-progress 进度条
- 相机初始飞至钱塘江河口(约 120.5°E, 30.4°N)

## 10. 错误处理

- 数据加载失败 → t-message 报错 + 重试按钮
- WebGL 能力检测(float 纹理/WebGL2):不满足时粒子降级(减数量/关拖尾)并提示
- pick 落空(天空)忽略;网格外点击给出提示
- 帧数据越界访问防御(时间轴边界钳制)

## 11. 验证与性能目标

- 预处理:统计输出 + 抽样 10 单元与原始 DAT 数值逐一比对
- 前端:dev server 实测——加载完整性、动画帧率、点击查询数值与预处理侧
  已知单元值对照一致
- 性能目标:独显 60fps / 核显 30fps(65k 粒子 + 全域水面)

## 12. 范围外(YAGNI)

- 不做多方案/多场次数据管理,只针对当前 3 个 DAT 文件的数据形态
- 不做后端服务,纯静态文件 + 前端渲染
- 不改动现有 map-viewer/二三维同步框架
- 不做移动端适配
