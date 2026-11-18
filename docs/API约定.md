# Alpha API 约定

完整类型见 `packages/sdk/types/index.d.ts`。所有事件订阅返回取消函数；`destroy()` 返回 Promise 且可重复调用。销毁后的实例不能复用（`getState`/`getDiagnostics` 除外，其余方法抛 `DISPOSED`）；需要新建。切换场次可复用同一实例。

## 错误模型

公开方法抛出的非取消错误一律是 `FlowError`（`name='FlowError'`，`code` 英文常量、`message` 中文、`recoverable` 默认值见下表、`toJSON()` 序列化）；唯一例外是主动取消/被取代的 `DOMException AbortError`（不发 error 事件）。`isFlowError(e)` 可判型。`state.error` 是 `FlowError.toJSON()` 快照或 `null`。

| code | recoverable | 常见来源 |
| --- | --- | --- |
| NETWORK_ERROR / TIMEOUT | true | fetch 网络失败、请求超时（provider `timeoutMs`，默认 30000） |
| SERVICE_ERROR | true | HTTP 429/5xx、服务信封 `code≠0`（此时 recoverable=false）、渲染 attach 失败 |
| AUTH_REQUIRED / FORBIDDEN | true / false | HTTP 401 / 403 |
| SCENARIO_NOT_FOUND / DATA_UNAVAILABLE | false | 清单 404 / 网格·帧·过程线 404、域外数据缺失 |
| INVALID_MANIFEST / INVALID_BINARY / UNSUPPORTED_MESH | false | 清单 formatVersion≠2、网格/帧字节校验、节点数>65535 |
| INVALID_ARGUMENT / NOT_READY / NOT_SUPPORTED / DISPOSED | false | 参数与配置校验、未加载、能力缺失、已销毁 |
| UNSUPPORTED_RUNTIME | false | 运行库缺关键成员（消息列缺失项）、缺 proj4、Viewer 已销毁、全局运行库冲突 |
| WORKER_FAILED / CONTEXT_LOST / RUNTIME_BUSY | true | Worker 聚合失败回退、渲染上下文丢失（经 `onError` 上报）、场景已被其它 W3D 水面占用/已有活动渲染器 |

## 方法

| 方法 | 约定 |
| --- | --- |
| `loadScenario(selection?, {signal?})` | `selection` 为 `{scenarioId}`、`{sourceRunId}`、`{latest:true}`（缺省等同 latest，兼容 `{sourceRunId:'latest'}`）。**事务式切换**：已有场次时 status 保持 `ready`、`switching=true`，候选数据全部就绪并 attach 成功前旧场次原样可用；任一步失败回滚并保留旧场次（promise 以 FlowError 拒绝、发 error 事件），首次加载失败则 `status='error'`。后发加载取代前者（前者 AbortError）。同 meshId 且字节一致时复用旧网格不再请求。 |
| `seek(time, {signal?})` | `time` 为 Date 或 ISO 字符串；**越界钳制**到首末时刻（非法值才抛 INVALID_ARGUMENT）；跨越超过 1 帧或循环回首帧时重置渲染拖尾。失败时位置回退到 displayed。 |
| `play()` / `pause()` / `setPlaybackRate(r)` / `setOptions(patch)` / `setVisible(b)` | 播放控制；rate 0.1～16；setOptions 先完整校验再应用，`tidal` 变更会重新应用当前帧对。 |
| `reinitialize()` | 上下文丢失恢复：销毁并重新 attach 渲染会话，恢复当前画面与选项（未加载抛 NOT_READY）。 |
| `getState()` | 独立快照，时刻统一 ISO UTC；含 `status/switching/playing/buffering/suspended/rate/secondsPerFrame/loop/timeZone/error/progress/scenarioId/sourceRunId/scenarioName/meshId/frameCount/frameIntervalSeconds/requestedFrame/displayedFrame/requestedTime/displayedTime/startTime/endTime/stats/options/tidal/capabilities`。 |
| `getCapabilities()` | `{scenarios, series:'provider'\|'frames', worker:'worker'\|'main-thread'\|'none', tidal:{available,reason?}, maxNodes:65535, renderer}`；同时见 `state.capabilities`。 |
| `getDiagnostics()` | `{rawFramesCached,nodeFramesCached,pendingRequests,tidalHistoryFrames,tidalHistoryBytes,worker,provider:getStats(),warnings:最近20条}`；不含 URL。 |
| `queryAt({lon,lat,time?}, {signal?})` | `time` 缺省查 displayedFrame，给定时按钳制后时刻查；**域外返回 null**；返回 `{status:'wet'\|'dry',cell,lon,lat,time,wet,wetTransition,level,u,v,speed,dirDeg}`——两帧均干为 `status:'dry'` 且数值全 null；一干一湿取湿帧值并 `wetTransition:true`；`speed<1e-6` 时 `dirDeg:null`；缺帧/请求失败抛 FlowError。level 单位 m，u/v/speed 单位 m/s，dirDeg 为从正北顺时针流向角。 |
| `querySeries({cell} 或 {lon,lat}, {signal?})` | 返回 `{scenarioId,cellIndex,points,source:'provider'\|'frames'}`；点为 `{frameIndex,validTime,dry,level,u,v,speed,dirDeg}`，干点数值全 null、零速 dirDeg null；provider 有 `querySeries` 优先走服务端，本地回退并发上限 4，两条路径结构一致。 |
| `listScenarios({signal?})` | 规范化 `{id,sourceRunId,name,startTime,endTime,frameCount,meshId?,publishedAt?}`；provider 未实现抛 NOT_SUPPORTED。 |
| `pick({x,y}, {signal?})` | 屏幕坐标拾取后走 queryAt；坐标为 Viewer 画布内 CSS 像素，SDK 不自动注册点击。 |
| `destroy()` | 返回 Promise、幂等；取消请求、结束 Worker、移除监听，不销毁宿主 Viewer。 |

## 播放失败恢复

applyPair 失败（非取消）时 `playing=false`、位置回退到 displayed 并记录 error；tick 不再对该帧对自动重试（provider 已自带重试）。`play()`、`seek()`、`setOptions` 触发的 applyPair 会清除 blockedPair 与 error 后重试。

## 事件

| 事件 | 载荷 | 时机 |
| --- | --- | --- |
| `statechange` | FlowState | 播放中约 10 次/秒，重要状态变化立即 |
| `error` | FlowError | 公开失败（AbortError 不发） |
| `destroy` | — | destroy 完成 |
| `progress` | `{phase:'manifest'\|'mesh'\|'frames'\|'renderer'\|'history',loaded,total}` | 加载/切换/潮头历史构建 |
| `warning` | `{code,message,detail?}` | WORKER_FALLBACK、TIDAL_DISABLED_BUDGET、ASSET_LOAD_FAILED（detail `{asset,url}`，url 已去 query/hash）、RUNTIME_DEGRADED（detail.missing）、PARTICLES_UNSUPPORTED（detail.reason）、CONTEXT_RESTORED |
| `scenariochange` | `{previous,current}` | 场次提交成功（首次 previous=null） |
| `timechange` | `{requestedTime,displayedTime,displayedFrame}` | displayedFrame 变化；播放中节流 10 次/秒，seek 完成/暂停/切换完成立即发 |
| `ready` | FlowState | 加载或切换完成 |

未知事件名订阅抛 INVALID_ARGUMENT。`renderer.attach` 的 context 提供 `onTick/onWarning/onError`：渲染器经 `onError(flowError)` 上报时 `playing=false`、记录 error 并发 error 事件；`onWarning` 后会补发一次 statechange（暂停态也能反映能力变化）。会话可选提供 `getCapabilities()`（进入 `state.capabilities.renderer`）与 `resetTrails()`（清空粒子拖尾）。

## 配置

`createFlowField` 新增 `timeZone`（默认 `'Asia/Shanghai'`，仅供 UI 显示）与 `tidalHistoryBudgetMB`（默认 256，潮头历史内存预算，超限本场次停用潮头并发 TIDAL_DISABLED_BUDGET 警告）。`playback` 支持 `autoPlay/rate/secondsPerFrame/loop`。

| 配置 | 范围 / 默认 |
| --- | --- |
| `particles.visible` | true |
| `particles.count` | 16384 / 65536 / 262144；默认 16384 |
| `particles.lineWidth` | 0.5～5 px；默认 1 |
| `particles.trailSeconds` | 0～3 秒；默认 1.5 |
| `flowStrength` | 0.5～3；默认 2 |
| `exaggeration` | 1～200；默认 60，仅视觉水位放大 |
| `water.visible` / `water.reflection` | 默认 true |
| `water.colorMode` | river / speed / level；默认 river |
| `water.arrows` | 默认 false |
| `water.arrowScale` | 1～80；默认 24 |
| `water.palette` | natural / tech；默认 natural |
| `water.qualityPreset` | off / I / II / III / IV / V / BAD_V；默认 off（选项见导出 `WATER_QUALITY_OPTIONS`） |
| `quality` | standard / low；默认 standard。low：流场纹理 1024×512、拖尾 0.5×分辨率；`state.capabilities.renderer.recommendedQuality` 在无 WebGL2 或最大纹理 <4096 时建议 low |
| `water.waveAmplitude` | 0～0.3；默认 0.14，视觉微浪参数 |
| `tidal.marker` | 默认 false，仅启用扩展后生效 |
| `tidal.turbidity` | 默认 true，仅启用扩展后生效 |

水面互斥规则（mergeOptions 按 patch 判定）：patch 把 `qualityPreset` 设为非 off → `colorMode` 自动为 `river`；patch 把 `colorMode` 设为 speed/level → `qualityPreset` 自动为 `off`；同一 patch 两者冲突抛 `INVALID_ARGUMENT`。河口清浊、沿流运动强度与微浪只在 `river + natural + 水质 off` 时生效。

## 数据源

`createHttpProvider({baseUrl, request=fetch, retry, timeoutMs=30000})` 与 `createStaticProvider({manifestUrl, request=fetch, retry, timeoutMs=30000})`。`retry` 默认 `{retries:2, baseDelayMs:300, maxDelayMs:3000}`，`false` 关闭；仅 NETWORK_ERROR/TIMEOUT/408/429/5xx 重试，退避可中止。每次尝试 signal 为调用方 signal 与 `AbortSignal.timeout(timeoutMs)` 的合成。HTTP 状态映射见错误表；gzip 魔数识别，解压失败回退原始字节。`getStats()` 返回 `{requests,retries,failures}`。

数据源的 manifest 必须提供显式时区、有序且无重复的帧时间、`formatVersion:2`。二进制格式沿用当前模型导出布局；网格/帧长度、计数、索引、比例尺在加载时校验。Worker 不独立请求数据，统一走主线程数据源，保留鉴权；Worker 构造失败/崩溃自动回退主线程并发一次 WORKER_FALLBACK 警告。宿主若把 Worker 单独发布，可传 `workerUrl` 或 `workerFactory`；关闭 Worker 使用 `worker:false`，计算在主线程进行。
