package com.supermap.model.flowfield.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.supermap.model.flowfield.model.PackageManifest;
import com.supermap.model.flowfield.repository.FlowRepository;
import com.supermap.model.flowfield.web.FlowException;
import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

@Service
public class QueryService {
    private final FlowRepository repository;
    private final ObjectMapper objectMapper;
    private final FrameCache frameCache;

    public QueryService(
        FlowRepository repository,
        ObjectMapper objectMapper,
        FrameCache frameCache
    ) {
        this.repository = repository;
        this.objectMapper = objectMapper;
        this.frameCache = frameCache;
    }

    public List<Map<String, Object>> scenarios() {
        List<Map<String, Object>> result = new ArrayList<Map<String, Object>>();
        for (Map<String, Object> row : repository.listReadyScenarios()) {
            Map<String, Object> item = new LinkedHashMap<String, Object>();
            item.put("id", row.get("scenario_id"));
            item.put("sourceRunId", row.get("source_run_id"));
            item.put("name", row.get("scenario_name"));
            item.put("modelVersion", row.get("model_version"));
            item.put("meshId", row.get("mesh_id"));
            item.put("startTime", row.get("start_time"));
            item.put("endTime", row.get("end_time"));
            item.put("frameCount", row.get("frame_count"));
            item.put("publishedAt", row.get("published_at"));
            result.add(item);
        }
        return result;
    }

    public Map<String, Object> latestManifest() {
        Map<String, Object> scenario = repository.findLatestReadyScenario();
        return manifest(scenario);
    }

    public Map<String, Object> manifest(String scenarioId) {
        return manifest(findReadyScenario(scenarioId));
    }

    private Map<String, Object> manifest(Map<String, Object> scenario) {
        if (scenario == null) {
            throw new FlowException(HttpStatus.NOT_FOUND, "可用场次不存在");
        }
        try {
            Map<String, Object> manifest = objectMapper.readValue(
                String.valueOf(scenario.get("manifest_json")),
                new TypeReference<Map<String, Object>>() {}
            );
            manifest.put("scenarioId", scenario.get("scenario_id"));
            manifest.put("status", scenario.get("status"));
            return manifest;
        } catch (IOException error) {
            throw new FlowException(HttpStatus.INTERNAL_SERVER_ERROR, "场次 manifest 无法读取");
        }
    }

    public BinaryFile mesh(String meshId) {
        Map<String, Object> row = repository.findMesh(meshId);
        if (row == null) {
            Map<String, Object> scenario = findReadyScenario(meshId);
            if (scenario != null) {
                row = repository.findMesh(String.valueOf(scenario.get("mesh_id")));
            }
        }
        if (row == null) {
            throw new FlowException(HttpStatus.NOT_FOUND, "网格不存在");
        }
        return binary(row);
    }

    public BinaryFile frame(String scenarioId, int index) {
        return frame(findReadyScenario(scenarioId), index);
    }

    private BinaryFile frame(Map<String, Object> scenario, int index) {
        if (scenario == null) {
            throw new FlowException(HttpStatus.NOT_FOUND, "可用场次不存在");
        }
        String scenarioId = String.valueOf(scenario.get("scenario_id"));
        Map<String, Object> row = repository.findFrame(scenarioId, index);
        if (row == null) {
            throw new FlowException(HttpStatus.NOT_FOUND, "帧不存在");
        }
        return binary(row);
    }

    private BinaryFile binary(Map<String, Object> row) {
        Path path = Paths.get(String.valueOf(row.get("storage_path")));
        if (!Files.isRegularFile(path)) {
            throw new FlowException(HttpStatus.NOT_FOUND, "压缩文件不存在");
        }
        return new BinaryFile(
            path,
            ((Number) row.get("compressed_length")).longValue(),
            String.valueOf(row.get("compressed_sha256"))
        );
    }

    public Map<String, Object> series(String scenarioId, int cellIndex) {
        return series(findReadyScenario(scenarioId), cellIndex);
    }

    private Map<String, Object> findReadyScenario(String scenarioIdOrSourceRunId) {
        Map<String, Object> scenario = repository.findReadyScenario(scenarioIdOrSourceRunId);
        if (scenario == null) {
            scenario = repository.findReadyScenarioBySourceRunId(scenarioIdOrSourceRunId);
        }
        return scenario;
    }

    private Map<String, Object> series(Map<String, Object> scenario, int cellIndex) {
        if (scenario == null) {
            throw new FlowException(HttpStatus.NOT_FOUND, "可用场次不存在");
        }
        String scenarioId = String.valueOf(scenario.get("scenario_id"));
        PackageManifest manifest;
        try {
            manifest = objectMapper.readValue(
                String.valueOf(scenario.get("manifest_json")),
                PackageManifest.class
            );
        } catch (IOException error) {
            throw new FlowException(HttpStatus.INTERNAL_SERVER_ERROR, "场次 manifest 无法读取");
        }
        if (cellIndex < 0 || cellIndex >= manifest.getNCells()) {
            throw new FlowException(HttpStatus.BAD_REQUEST, "单元序号越界");
        }
        List<byte[]> frames = frameCache.get(scenarioId);
        List<Map<String, Object>> points = new ArrayList<Map<String, Object>>(frames.size());
        int cells = manifest.getNCells();
        for (int index = 0; index < frames.size(); index++) {
            ByteBuffer bytes = ByteBuffer.wrap(frames.get(index)).order(ByteOrder.LITTLE_ENDIAN);
            short levelRaw = bytes.getShort(cellIndex * 2);
            short uRaw = bytes.getShort((cells + cellIndex) * 2);
            short vRaw = bytes.getShort((cells * 2 + cellIndex) * 2);
            boolean dry = levelRaw == manifest.getDrySentinel();
            Map<String, Object> point = new LinkedHashMap<String, Object>();
            point.put("frameIndex", index);
            point.put("validTime", manifest.getFrames().get(index).getValidTime());
            point.put("dry", dry);
            point.put("level", dry ? null : levelRaw * manifest.getScales().getLevel());
            point.put("u", dry ? null : uRaw * manifest.getScales().getUv());
            point.put("v", dry ? null : vRaw * manifest.getScales().getUv());
            points.add(point);
        }
        Map<String, Object> result = new LinkedHashMap<String, Object>();
        result.put("scenarioId", scenarioId);
        result.put("cellIndex", cellIndex);
        result.put("points", points);
        return result;
    }

    public static final class BinaryFile {
        private final Path path;
        private final long length;
        private final String sha256;

        private BinaryFile(Path path, long length, String sha256) {
            this.path = path;
            this.length = length;
            this.sha256 = sha256;
        }
        public Path getPath() { return path; }
        public long getLength() { return length; }
        public String getSha256() { return sha256; }
    }
}
