# 三维数字流场可视化 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 tdesign 工程的 SuperMap3D 三维场景中实现钱塘江河口 72 小时风暴潮数字流场:数据驱动的游戏级水面 + Windy 级 GPU 粒子 + 点击查询水位流速与过程线。

**Architecture:** Python 离线把 Tecplot ASCII(3×92MB)压成 mesh.bin + frames.bin(~30MB int16)+ meta.json;前端 `src/flowfield/` 内用 SuperMap3D 暴露的渲染内部类(DrawCommand/Framebuffer/Texture,已确认 bundle 挂载)构建两条自定义 GPU 管线:水面 Primitive(静态几何 + 双帧顶点数据 shader 插值)与粒子层(视野跟随流场纹理 + 位置纹理 ping-pong + 拖尾累积);Vue 层只做时钟、UI 与点击查询。

**Tech Stack:** Python3(标准库 + numpy)、Vue3 + TDesign、SuperMap3D(Cesium 内核)原生 WebGL 内部 API、GLSL。

**设计文档:** `docs/superpowers/specs/2026-07-14-digital-flow-field-design.md`

**关键既定事实(执行者无需重新勘察):**
- 网格 shapefile:`风暴潮流场网格/grid-wgs84.shp`,71,958 个 Polygon(WGS84),属性 idx=1..71958 对应 DAT 单元序;四边形环 5 点闭合,退化(三角)环 4 点闭合
- DAT:首 ZONE 有 N=38081 节点 X,Y(投影米)、Z(海拔,海底为负),E=71958 单元 Z1/U/V(CELLCENTERED)+ 连接表(1-based,四点,退化四边形第 4 点重复);后续 23 个 ZONE 只有 Z1/U/V;3 个文件按名字排序共 72 帧,2026-07-09 08:00 起逐小时
- SuperMap3D 命名空间已挂:DrawCommand, ClearCommand, Framebuffer, VertexArray, ShaderProgram, ShaderSource, RenderState, BufferUsage, PixelFormat, PixelDatatype, Pass, Texture, Sampler, Buffer, ComponentDatatype, PrimitiveType, BoundingSphere(均已 grep 确认)
- viewer 获取方式:index.vue provide 的 `getViewer` 是空 shallowRef(未赋值),**执行时以 `inject('getSync')` 后取 `sync.viewer` 为准**,在 initView 后可用

---

### Task 1: Python 预处理脚本

**Files:**
- Create: `tools/preprocess_flowfield.py`
- 输出: `tdesign/public/data/flowfield/{mesh.bin, frames.bin, meta.json}`

**二进制格式(小端):**

```
mesh.bin:
  magic  uint32 = 0x46464D31 ('1MFF')
  nNodes uint32, nCells uint32, nTris uint32
  lon    float32[nNodes]
  lat    float32[nNodes]
  zb     float32[nNodes]            # 节点海拔(海底为负)
  tri    uint16[nTris*3]            # 三角索引(节点数<65536)
  cellNode uint16[nCells*4]         # 每单元 4 节点(退化第4=第1)
  cellLon float32[nCells], cellLat float32[nCells]

frames.bin:
  magic  uint32 = 0x46464631 ('1FFF')
  nFrames uint32, nCells uint32
  每帧: z1 int16[nCells](厘米, 干=-32768), u int16[nCells](mm/s), v int16[nCells](mm/s)

meta.json:
  { nNodes, nCells, nFrames, times: ["2026-07-09T08:00:00+08:00", ...],
    bbox: [w, s, e, n], scales: {level: 0.01, uv: 0.001}, drySentinel: -32768,
    stats: {speedMax, levelMin, levelMax, wetCellsPerFrame: [...] } }
```

- [ ] **Step 1.1 解析 shapefile**:纯 struct 读 .shp(type=5),每记录取外环顶点(去闭合点),得到 `cellRings[i]`(3 或 4 个 (lon,lat))。断言记录数 71958。
- [ ] **Step 1.2 解析 DAT 首 ZONE**:流式 token 读 X,Y,Z(38081×3)、Z1,U,V(71958×3)、连接表 conn(71958×4, 转 0-based)。
- [ ] **Step 1.3 节点坐标重建**:先试 8 种统一对应假设(shp 环点序 = conn 序的 4 旋转 × 正反 2 向),在 1000 个抽样单元上检查共享节点坐标一致性(容差 1e-7°),取零冲突假设;若全失败,退化为约束传播逐单元定序。产出 nodeLon/nodeLat[38081],并全量校验:每单元每节点 shp 坐标与节点表偏差 < 1e-6°。
- [ ] **Step 1.4 全帧读取与量化**:按文件名序流式读 3 个 DAT 共 72 帧 Z1/U/V;zb_cell = 单元唯一节点 zb 均值;depth = Z1 − zb_cell < 0.05 → 干(z1=-32768, u=v=0);湿单元 z1=round(Z1*100), u=round(U*1000), v=round(V*1000),clamp int16。
- [ ] **Step 1.5 三角化与写出**:四边形→2 三角形(0,1,2 / 0,2,3),退化→1;写三个输出文件。
- [ ] **Step 1.6 内建校验(--verify)**:随机抽 10 个 (帧,单元) 从原 ASCII 重读原值,与解码后输出比对(容差 = 量化步长);打印各帧水位/流速范围、干湿单元数;全部 PASS 才算完成。
- [ ] **Step 1.7 运行**:`python tools/preprocess_flowfield.py --verify`,确认输出尺寸(mesh.bin ≈ 1.6MB,frames.bin ≈ 29.7MB)与 PASS。
- [ ] **Step 1.8 Commit**:`git add tools/ && git commit -m "feat: 流场数据预处理脚本"`(输出 bin 已被 .gitignore 排除)。

### Task 2: 前端数据层 FlowFieldData

**Files:**
- Create: `tdesign/src/flowfield/FlowFieldData.js`
- Create: `tools/check_bins.mjs`(Node 冒烟测试)

接口:

```js
export class FlowFieldData {
  static async load(baseUrl, onProgress)   // → FlowFieldData
  // 解码后字段: meta, nNodes, nCells, nFrames, lon, lat, zb, tri, cellNode, cellLon, cellLat, frames(Int16Array)
  cellValue(frame, cell)        // → {level, u, v, wet}
  nodeFrame(frame)              // → Float32Array[nNodes*4] (level,u,v,wet) 邻接湿单元均值, LRU(6) 缓存
  buildIndex()                  // 512×512 uniform grid(单元 bbox 入桶)
  pickCell(lon, lat)            // → cellIdx | -1 (桶内候选 + 射线法点在多边形)
  sampleAt(lon, lat, timeF)     // → {level, u, v, speed, dirDeg, wet} 两帧线性插值
  series(cell)                  // → {levels: Float32Array(72), speeds: Float32Array(72)} 干=NaN
}
```

- [ ] **Step 2.1** 实现加载(fetch + ReadableStream 进度回调)与 DataView 解码,魔数/长度断言。
- [ ] **Step 2.2** 实现 nodeFrame 聚合(预建 node→cells CSR 邻接;节点值 = 相邻湿单元均值,无湿邻接则 wet=0)与 LRU。
- [ ] **Step 2.3** 实现空间索引与 pickCell、sampleAt、series。
- [ ] **Step 2.4** `node tools/check_bins.mjs`:直读三个输出文件,断言魔数、数量、抽样单元中心在其多边形 bbox 内、pickCell(单元中心)==该单元(抽 100 个)、frames 数值范围合理。PASS 后提交。
- [ ] **Step 2.5 Commit**:`feat: 流场前端数据层与校验脚本`。

### Task 3: 页面骨架与控制器接入

**Files:**
- Create: `tdesign/src/flowfield/FlowFieldController.js`
- Create: `tdesign/src/views/flow-field.vue`
- Modify: `tdesign/src/router/routes.js`(index 增加默认子路由 flow-field)

- [ ] **Step 3.1** FlowFieldController:持有 viewer + FlowFieldData;`simHour`(0..71 浮点)、play/pause/speed(1×=0.5 模型小时/真秒);挂 `scene.preUpdate` 推进时间;跨整点时调用 `water.setFrames(a,b)` 与 `particles.setFrames(a,b)`(先空实现),每帧 `setT(frac)`;`destroy()` 摘钩子。
- [ ] **Step 3.2** flow-field.vue:inject getSync → watch 到 sync 就绪 → `FlowFieldData.load('data/flowfield/', p)`(t-progress 显示)→ new Controller → 相机 flyTo 河口(120.9°E, 30.3°N, 高度 180km 俯视)。加载失败 t-message + 重试按钮。
- [ ] **Step 3.3** routes.js:index children 增加 `{ path: '', name: 'flow-field', component: () => import('@/views/flow-field.vue') }`。
- [ ] **Step 3.4** `pnpm dev` 起服务,浏览器确认:进度条→加载完成→相机飞至河口,无控制台报错。Commit `feat: 流场页面骨架与时间控制器`。

### Task 4: 水面渲染 WaterSurfacePrimitive

**Files:**
- Create: `tdesign/src/flowfield/WaterSurfacePrimitive.js`
- Create: `tdesign/src/flowfield/waterNormalTexture.js`(Canvas 程序生成 256×256 可平铺水面法线图)

要点(自定义 Primitive 对象,`update(frameState)` 推 DrawCommand):

- 几何:节点 ECEF − RTC 中心(河口 120.9,30.3 处 Cartesian3),float32 position;uint16 tri 索引;BoundingSphere 全域
- 动态顶点缓冲 dataA/dataB:vec4(level, u, v, wet),`Buffer.copyFromArrayView` 跨帧更新;**与粒子流场栅格化共享同一对 Buffer**
- VS:`h = mix(dataA.x,dataB.x,u_t) * u_exagg + 微波浪(幅随流速)`,沿 `normalize(u_rtcCenter + pos)` 抬升;varying 流速/wet/经纬 texcoord
- FS:双层法线图按流向滚动(双相位 flow mapping),菲涅尔 + `czm_sunDirectionEC` Blinn-Phong 高光 + 程序化天空反射色,水色按流速深蓝→青白(可切科技蓝),wet<0.35 discard、0.35~0.65 渐隐+泡沫噪声
- RenderState:TRANSLUCENT pass、depthTest on、depthWrite off、alpha blend;modelMatrix = RTC 平移
- shader 用 `ShaderProgram.fromCache`,uniformMap 提供 u_t/u_exagg/u_time/u_rtcCenter/u_normalMap

- [ ] **Step 4.1** waterNormalTexture.js:多向正弦叠加高度场→切线空间法线→canvas,首次 update 时建 Texture(REPEAT 采样)。
- [ ] **Step 4.2** 实现几何/缓冲/着色器/命令;Controller 里接通 setFrames/setT。
- [ ] **Step 4.3** 浏览器验证:水面覆盖湿区、随播放起伏进退、波纹沿流向、有高光反射;记录帧率。
- [ ] **Step 4.4** Commit `feat: 数据驱动游戏级水面渲染`。

### Task 5: 粒子系统 ParticleFlowLayer

**Files:**
- Create: `tdesign/src/flowfield/ParticleFlowLayer.js`
- Create: `tdesign/src/flowfield/particleShaders.js`(GLSL 汇总)

管线(全部离屏命令在 update() 内按序推入命令队列):

1. **流场纹理**:视野 bbox∩域 bbox,2048×1024 RGBA float FB;VS 把节点 (lon,lat)→NDC(uniform bbox 正交),attribute 复用 dataA/dataB + u_t 插值;输出 r=u, g=v, b=wet, a=level。每帧重渲(一个 draw call,可接受)
2. **粒子更新**:位置纹理 RGBA32F 256×256 ping-pong(xy=lon/lat, z=age, w=seed);全屏 quad FS:采样流场,dLon=u·dt·k/cos(lat)、dLat=v·dt·k(k=度/米),age 超限/出 bbox/wet<0.5 → hash(seed,frame) 重生于 bbox 内;u_speedScale 随相机高度自适应
3. **绘制+拖尾**:线段 VB(每粒子 2 顶点,attr=粒子 id+头尾标记),VS 从 curr/prev 位置纹理 VTF 取经纬→ECEF(shader 内球面近似 + level·exagg 抬高)→clip;FS 按流速查色带,加法混合画入 trail FB;trail 上帧×0.96 衰减合成;最终全屏 quad 以 TRANSLUCENT 叠到场景。相机移动清空 trail;canvas resize 重建 FB
- 粒子数 UI 可调(64×64 ~ 512×512),默认 256×256;`setFrames/setT` 与水面同源

- [ ] **Step 5.1** 实现流场纹理 pass 并用调试模式把纹理画到屏幕角落验证(u/v 映射成颜色,河口放大后纹理清晰)。
- [ ] **Step 5.2** 实现更新 pass + 绘制 pass(先不做拖尾,画点验证粒子随流场运动、干区无粒子)。
- [ ] **Step 5.3** 加拖尾累积与流速色带、加法发光;调 fade/线宽/速度系数到 Windy 观感;缩放测试视野跟随。
- [ ] **Step 5.4** Commit `feat: Windy 风格 GPU 粒子流场`。

### Task 6: 点击查询与过程线弹窗

**Files:**
- Create: `tdesign/src/flowfield/components/QueryPopup.vue`
- Create: `tdesign/src/flowfield/components/MiniChart.vue`(纯 SVG 双曲线折线图)
- Modify: `tdesign/src/views/flow-field.vue`

- [ ] **Step 6.1** ScreenSpaceEventHandler LEFT_CLICK → `scene.pickPosition` 失败退 `camera.pickEllipsoid` → Cartographic 经纬 → `data.pickCell`;命中:Entity 落标(圆点),QueryPopup 显示经纬度/水位 m/流速 m/s/流向罗盘(N/NE/…+度数);未命中 t-message('该位置无模型数据')。
- [ ] **Step 6.2** MiniChart:props {series, times, currentHour},水位+流速双 Y 轴折线、干出段断线、当前时刻游标线,随播放联动。
- [ ] **Step 6.3** 弹窗数值随时间轴播放实时刷新;浏览器对照 check_bins.mjs 打印的已知单元值验证一致。Commit `feat: 点击查询水位流速与72h过程线`。

### Task 7: 时间轴与控制面板 UI

**Files:**
- Create: `tdesign/src/flowfield/components/TimelineBar.vue`
- Create: `tdesign/src/flowfield/components/ControlPanel.vue`
- Create: `tdesign/src/flowfield/components/SpeedLegend.vue`
- Modify: `tdesign/src/views/flow-field.vue`

- [ ] **Step 7.1** TimelineBar:播放/暂停、倍速 1/2/4/8×、t-slider(0..71h 步长 0.1)双向绑定 controller.simHour、当前时间文字(meta.times 插值显示)。
- [ ] **Step 7.2** ControlPanel(t-card 右上):水面/粒子开关、粒子数 t-select、夸张系数 t-slider(1–200)、配色切换(自然/科技蓝);SpeedLegend 流速色带图例(与粒子色带同源常量)。
- [ ] **Step 7.3** WebGL 能力检测(OES_texture_float / WebGL2、VTF units>0),不满足则粒子降级并 t-message 提示。整体样式暗色悬浮风。Commit `feat: 时间轴与流场控制面板`。

### Task 8: 端到端验证与性能

- [ ] **Step 8.1** 浏览器完整回归:加载→自动播放→水面涨落/粒子流动同步→点击 3 个不同区域单元数值与过程线正确→二三维切换按钮仍工作。
- [ ] **Step 8.2** 性能:河口视角 ≥30fps(核显标准);不足则默认粒子降 128×128、流场纹理降 1024×512。
- [ ] **Step 8.3** 修复回归问题,最终 Commit `chore: 流场端到端验证与性能调优`。

---

## Self-Review 记录

- 规格覆盖:设计文档 §5→Task1、数据层→Task2、§9 骨架→Task3+7、§6→Task4、§7→Task5、§8→Task6、§10 错误处理→Task3(加载失败)/Task6(未命中)/Task7(能力检测)、§11 验证→Task1.6/2.4/8 ✓
- 占位符:无 TBD;各 shader 关键算法均已写明输入输出与公式 ✓
- 类型一致:setFrames(a,b)/setT(t) 两个渲染层与 Controller 签名一致;dataA/dataB Buffer 共享由 Controller 持有并注入两层 ✓
