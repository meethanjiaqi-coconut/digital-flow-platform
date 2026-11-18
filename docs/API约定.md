# Alpha API 约定

完整类型见 `packages/sdk/types/index.d.ts`。所有事件订阅返回取消函数；`destroy()` 可重复调用。销毁后的实例不能复用；需要新建。切换场次可复用同一实例。

| 方法 | 约定 |
| --- | --- |
| `loadScenario({sourceRunId}, {signal?})` | 加载场次并显示首帧；默认暂停。后发加载取代旧加载，旧 Promise 以 AbortError 结束。失败清理当前加载资源并发出 error 事件。 |
| `seek(ISO时间或Date)` | 依据 manifest 的真实时间戳计算相邻帧和比例，可处理不等间隔。超出数据时间范围报错。快速连续跳转仅最新请求生效。 |
| `play()` / `pause()` | 控制模型时间和水面/粒子动画；1 倍默认每 2 秒推进一个输出间隔。 |
| `setPlaybackRate(rate)` | 0.1～16；不改变查询得到的物理流速。 |
| `setOptions(patch)` | 局部合并；先完整校验再应用。支持创建前配置；具体字段见下表。 |
| `setVisible(boolean)` | 控制整组显示。隐藏时不推进播放。 |
| `getState()` | 返回独立快照；`requestedTime` 是请求位置，`displayedTime` 是当前有效画面；缓冲中两者可能不同。时间返回 ISO UTC，示例按本地时区显示。 |
| `queryAt({lon,lat}, {signal?})` | 查询当前显示时刻；域外为 null，干网格为 wet=false。level 单位 m，u/v/speed 单位 m/s；dirDeg 为从正北顺时针的流向角。 |
| `querySeries({cell} 或 {lon,lat}, {signal?})` | 返回逐帧物理量；有服务端过程接口时优先调用，否则逐帧取数，可能耗时。 |
| `pick({x,y})` | 显式屏幕查询；坐标是 Viewer 画布内 CSS 像素。SDK 不自动注册点击。首版采用椭球拾取，地形/三维建筑遮挡的精细拾取由宿主处理。 |
| `on('statechange' / 'error' / 'destroy', fn)` | statechange 播放中约 10 次/秒，重要状态变化立即通知；返回取消函数。 |
| `destroy()` | 取消请求、结束 Worker、移除自身监听和图层；不销毁宿主 Viewer。 |

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
| `water.waveAmplitude` | 0～0.3；默认 0.14，视觉微浪参数 |
| `tidal.marker` | 默认 false，仅启用扩展后生效 |
| `tidal.turbidity` | 默认 true，仅启用扩展后生效 |

数据源的 manifest 必须提供显式时区、有序且无重复的帧时间。二进制格式沿用当前模型导出布局，内置数据源支持 gzip；自定义数据源返回原始 ArrayBuffer。网格/帧长度、计数、索引、比例尺在加载时校验。

宿主若把 Worker 单独发布，可传 `workerUrl` 或 `workerFactory`；关闭 Worker 使用 `worker:false`，计算在主线程进行。生产不建议关闭。帧历史的网络请求仍统一经过数据源，Worker 不绕过认证自行请求。
