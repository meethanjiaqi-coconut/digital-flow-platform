# sgxt-flow-field

风暴潮二维水动力轻量发布与读取服务。服务只保存前端所需的独立 gzip 网格和帧，不保存原始 DAT。

当前版本：`1.0.1`。

## 初始化

PostgreSQL 启动账号需要拥有创建 `flow_field` schema 和表的权限；应用首次启动会执行
`src/main/resources/db/flow_field.sql`。生产环境也可以由 DBA 预先执行该脚本。

必填环境变量：

```text
PG_URL=jdbc:postgresql://postgres-host:5432/database
PG_USER=...
PG_PASSWORD=...
FLOW_PUBLISH_TOKEN=至少32位随机令牌
FLOW_STORAGE_ROOT=/data/flow-field
```

常用可选变量：

```text
NACOS_ENABLED=true
NACOS_SERVER_ADDR=nacos:8848
NACOS_NAMESPACE=...
FLOW_RETAIN_SCENARIOS=100
FLOW_CACHE_SCENARIOS=2
FLOW_STAGING_HOURS=72
```

容器部署时将服务器本机 SSD 目录挂载到 `/data/flow-field`，并映射 `8793:8793`。
只读 `/api/v1/**` 应由防火墙、网关或 Portainer 所在内网限制访问；上传接口
`/internal/v1/**` 另有 Bearer Token 校验。

## 河口院发布

```powershell
python -m pip install -r tools/requirements-flowfield.txt
$env:FLOW_PUBLISH_TOKEN = '与服务端一致的令牌'
python tools/preprocess_flowfield.py run `
  --dat-dir AREA_RST_WUV_2026_07_11_08_00 `
  --grid-shp 风暴潮流场网格/grid-wgs84.shp `
  --output .tmp/flowfield-package `
  --source-run-id RST-WUV-202607110800 `
  --scenario-name 2026年7月11日08时预报 `
  --model-version qiantang-v1 `
  --verify-source `
  --server http://service-host:8793/flow-field
```

上传令牌只从 `FLOW_PUBLISH_TOKEN` 读取。转换包的 `.publish-state.json` 支持断点续传。

## 前端

构建时设置：

```text
VITE_FLOW_API_BASE=/flow-field
```

同域部署时由网关把 `/flow-field` 转发到本服务。浏览器首屏仅请求 manifest、共享网格和
前两帧，随后按时间轴窗口预取。

定川的 `planId` 与河口院发布数据的 `sourceRunId` 保持一致时，可直接把 `planId`
传入原接口，无需先换取内部 UUID 类型的 `scenarioId`：

```text
GET /api/v1/scenarios/{scenarioId或sourceRunId}/manifest
GET /api/v1/meshes/{meshId或sourceRunId}
GET /api/v1/scenarios/{scenarioId或sourceRunId}/frames/{index}
GET /api/v1/scenarios/{scenarioId或sourceRunId}/cells/{cellIndex}/series
```

接口地址和响应结构保持不变。
