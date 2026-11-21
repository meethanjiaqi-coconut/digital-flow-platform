package com.supermap.model.flowfield.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.supermap.model.flowfield.repository.FlowRepository;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.file.Path;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;

/**
 * QueryService 按模型运行标识查询测试。
 *
 * @author Codex
 * @since 2026-08-19 00:00:00
 * @version 1.0
 */
class QueryServiceSourceRunTest {
    private static final String SOURCE_RUN_ID = "20260818091757";
    private static final String SCENARIO_ID = "2039fc2d-8251-448b-88f4-69697ca963c6";
    private static final String MESH_ID = "mesh-sha256";

    @Mock
    private FlowRepository repository;

    @Mock
    private FrameCache frameCache;

    @TempDir
    Path temporaryDirectory;

    private QueryService service;
    private Map<String, Object> scenario;

    /**
     * 初始化测试服务和可用场次。
     */
    @BeforeEach
    void setUp() {
        MockitoAnnotations.initMocks(this);
        service = new QueryService(repository, new ObjectMapper(), frameCache);
        scenario = new HashMap<String, Object>();
        scenario.put("scenario_id", SCENARIO_ID);
        scenario.put("source_run_id", SOURCE_RUN_ID);
        scenario.put("mesh_id", MESH_ID);
        scenario.put("status", "READY");
        scenario.put(
            "manifest_json",
            "{\"formatVersion\":2,\"sourceRunId\":\"" + SOURCE_RUN_ID +
                "\",\"scenarioName\":\"钱塘江测试场次\",\"modelVersion\":\"qiantang-v1\"," +
                "\"startTime\":\"2026-08-18T00:00:00+08:00\"," +
                "\"endTime\":\"2026-08-18T00:00:00+08:00\"," +
                "\"nNodes\":1,\"nCells\":1,\"nTris\":1,\"nFrames\":1," +
                "\"bbox\":[120,30,121,31],\"scales\":{\"level\":0.01,\"uv\":0.001}," +
                "\"drySentinel\":-32768,\"mesh\":{}," +
                "\"frames\":[{\"index\":0,\"validTime\":\"2026-08-18T00:00:00+08:00\"}]}"
        );
        when(repository.findReadyScenario(SOURCE_RUN_ID)).thenReturn(null);
        when(repository.findReadyScenarioBySourceRunId(SOURCE_RUN_ID)).thenReturn(scenario);
        when(repository.findReadyScenario(SCENARIO_ID)).thenReturn(scenario);
        when(repository.findMesh(SOURCE_RUN_ID)).thenReturn(null);
    }

    /**
     * 验证原内部场次 ID 查询方式继续兼容。
     */
    @Test
    void shouldKeepScenarioIdQueryCompatible() {
        Map<String, Object> manifest = service.manifest(SCENARIO_ID);

        assertEquals(SCENARIO_ID, manifest.get("scenarioId"));
        assertEquals(SOURCE_RUN_ID, manifest.get("sourceRunId"));
    }

    /**
     * 验证按模型运行标识返回原场次清单并补充内部场次 ID。
     */
    @Test
    void shouldLoadManifestBySourceRunId() {
        Map<String, Object> manifest = service.manifest(SOURCE_RUN_ID);

        assertEquals(SOURCE_RUN_ID, manifest.get("sourceRunId"));
        assertEquals(SCENARIO_ID, manifest.get("scenarioId"));
        assertEquals("钱塘江测试场次", manifest.get("scenarioName"));
    }

    /**
     * 验证按模型运行标识解析场次网格。
     *
     * @throws Exception 创建测试文件失败时抛出
     */
    @Test
    void shouldLoadMeshBySourceRunId() throws Exception {
        Path meshPath = temporaryDirectory.resolve("mesh.bin.gz");
        java.nio.file.Files.write(meshPath, new byte[]{1, 2, 3});
        Map<String, Object> mesh = binaryRow(meshPath, 3L, "mesh-compressed-sha");
        when(repository.findMesh(MESH_ID)).thenReturn(mesh);

        QueryService.BinaryFile result = service.mesh(SOURCE_RUN_ID);

        assertEquals(meshPath, result.getPath());
        assertEquals(3L, result.getLength());
        assertEquals("mesh-compressed-sha", result.getSha256());
    }

    /**
     * 验证按模型运行标识解析场次帧。
     *
     * @throws Exception 创建测试文件失败时抛出
     */
    @Test
    void shouldLoadFrameBySourceRunId() throws Exception {
        Path framePath = temporaryDirectory.resolve("00000.bin.gz");
        java.nio.file.Files.write(framePath, new byte[]{4, 5});
        Map<String, Object> frame = binaryRow(framePath, 2L, "frame-compressed-sha");
        when(repository.findFrame(SCENARIO_ID, 0)).thenReturn(frame);

        QueryService.BinaryFile result = service.frame(SOURCE_RUN_ID, 0);

        assertEquals(framePath, result.getPath());
        assertEquals(2L, result.getLength());
        assertEquals("frame-compressed-sha", result.getSha256());
    }

    /**
     * 验证按模型运行标识查询过程线时仍使用内部场次 ID 读取缓存。
     */
    @Test
    void shouldLoadSeriesBySourceRunId() {
        byte[] frame = ByteBuffer.allocate(6)
            .order(ByteOrder.LITTLE_ENDIAN)
            .putShort((short) 123)
            .putShort((short) 456)
            .putShort((short) -789)
            .array();
        when(frameCache.get(SCENARIO_ID)).thenReturn(Collections.singletonList(frame));

        Map<String, Object> result = service.series(SOURCE_RUN_ID, 0);

        assertEquals(SCENARIO_ID, result.get("scenarioId"));
        assertEquals(0, result.get("cellIndex"));
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> points = (List<Map<String, Object>>) result.get("points");
        assertEquals(1, points.size());
        assertEquals(1.23D, (Double) points.get(0).get("level"), 0.000001D);
        assertEquals(0.456D, (Double) points.get(0).get("u"), 0.000001D);
        assertEquals(-0.789D, (Double) points.get(0).get("v"), 0.000001D);
    }

    private Map<String, Object> binaryRow(Path path, long length, String sha256) {
        Map<String, Object> row = new HashMap<String, Object>();
        row.put("storage_path", path.toString());
        row.put("compressed_length", length);
        row.put("compressed_sha256", sha256);
        return row;
    }
}
