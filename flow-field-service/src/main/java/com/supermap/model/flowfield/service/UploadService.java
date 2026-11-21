package com.supermap.model.flowfield.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.supermap.model.flowfield.config.FlowFieldProperties;
import com.supermap.model.flowfield.model.PackageManifest;
import com.supermap.model.flowfield.repository.FlowRepository;
import com.supermap.model.flowfield.storage.StorageService;
import com.supermap.model.flowfield.web.FlowException;
import java.io.IOException;
import java.io.InputStream;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Consumer;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

@Service
public class UploadService {
    private static final int MESH_MAGIC = 0x46464D31;
    private final FlowRepository repository;
    private final StorageService storage;
    private final ObjectMapper objectMapper;
    private final FlowFieldProperties properties;
    private final JdbcTemplate jdbc;
    private final TransactionTemplate transaction;
    private final RetentionService retention;

    public UploadService(
        FlowRepository repository,
        StorageService storage,
        ObjectMapper objectMapper,
        FlowFieldProperties properties,
        JdbcTemplate jdbc,
        TransactionTemplate transaction,
        RetentionService retention
    ) {
        this.repository = repository;
        this.storage = storage;
        this.objectMapper = objectMapper;
        this.properties = properties;
        this.jdbc = jdbc;
        this.transaction = transaction;
        this.retention = retention;
    }

    public Map<String, Object> createOrResume(PackageManifest manifest) {
        validateManifest(manifest);
        Map<String, Object> scenario = repository.findScenarioBySourceRunId(manifest.getSourceRunId());
        if (scenario != null && "READY".equals(String.valueOf(scenario.get("status")))) {
            return response(
                null,
                String.valueOf(scenario.get("scenario_id")),
                true,
                false,
                Collections.<Integer>emptyList()
            );
        }
        Map<String, Object> upload = repository.findReusableUpload(manifest.getSourceRunId());
        if (upload != null) {
            requireSameRun(upload, manifest);
            return status(String.valueOf(upload.get("upload_id")));
        }
        String uploadId = UUID.randomUUID().toString();
        String scenarioId = scenario == null
            ? UUID.randomUUID().toString()
            : String.valueOf(scenario.get("scenario_id"));
        String manifestJson = writeJson(manifest);
        repository.upsertUploadingScenario(
            scenarioId,
            manifest.getSourceRunId(),
            manifest.getScenarioName(),
            manifest.getModelVersion(),
            manifest.getStartTime(),
            manifest.getEndTime(),
            manifest.getNFrames(),
            manifestJson
        );
        try {
            repository.createUpload(
                uploadId,
                manifest.getSourceRunId(),
                scenarioId,
                manifestJson,
                properties.getStagingHours()
            );
        } catch (DuplicateKeyException concurrentCreate) {
            Map<String, Object> existingUpload = repository.findReusableUpload(manifest.getSourceRunId());
            if (existingUpload == null) {
                throw concurrentCreate;
            }
            requireSameRun(existingUpload, manifest);
            return status(String.valueOf(existingUpload.get("upload_id")));
        }
        return response(
            uploadId,
            scenarioId,
            false,
            isMeshRequired(manifest.getMesh().getMeshId()),
            allIndexes(manifest.getNFrames())
        );
    }

    public Map<String, Object> status(String uploadId) {
        UploadContext context = loadUpload(uploadId);
        Set<Integer> uploaded = repository.uploadedFrames(uploadId);
        List<Integer> missing = new ArrayList<Integer>();
        for (int index = 0; index < context.manifest.getNFrames(); index++) {
            if (!uploaded.contains(index)) {
                missing.add(index);
            }
        }
        return response(
            uploadId,
            context.scenarioId,
            false,
            isMeshRequired(context.manifest.getMesh().getMeshId()) && !repository.uploadedMesh(uploadId),
            missing
        );
    }

    public void uploadMesh(String uploadId, InputStream input) {
        UploadContext context = loadUpload(uploadId);
        PackageManifest.Artifact mesh = context.manifest.getMesh();
        Path path = storage.stagingMesh(uploadId);
        try {
            storage.receiveAndVerify(
                input,
                path,
                mesh.getCompressedLength(),
                mesh.getCompressedSha256(),
                mesh.getRawLength(),
                mesh.getRawSha256(),
                new Consumer<byte[]>() {
                    @Override
                    public void accept(byte[] prefix) {
                        if (ByteBuffer.wrap(prefix).order(ByteOrder.LITTLE_ENDIAN).getInt() != MESH_MAGIC) {
                            throw new FlowException(HttpStatus.BAD_REQUEST, "网格 magic 不是 FFM1");
                        }
                    }
                }
            );
            repository.upsertPart(
                uploadId, "MESH", -1, mesh.getCompressedLength(),
                mesh.getCompressedSha256(), path.toString()
            );
        } catch (RuntimeException error) {
            markFailed(context, error);
            throw error;
        }
    }

    public void uploadFrame(String uploadId, int index, InputStream input) {
        UploadContext context = loadUpload(uploadId);
        PackageManifest.Frame frame = frameAt(context.manifest, index);
        long expectedRaw = context.manifest.getNCells() * 3L * 2L;
        if (frame.getRawLength() != expectedRaw) {
            throw new FlowException(HttpStatus.BAD_REQUEST, "帧原始长度与单元数不一致");
        }
        Path path = storage.stagingFrame(uploadId, index);
        try {
            storage.receiveAndVerify(
                input,
                path,
                frame.getCompressedLength(),
                frame.getCompressedSha256(),
                frame.getRawLength(),
                frame.getRawSha256(),
                new Consumer<byte[]>() {
                    @Override
                    public void accept(byte[] ignored) {
                        // 帧为紧凑 int16 数组，没有额外文件头。
                    }
                }
            );
            repository.upsertPart(
                uploadId, "FRAME", index, frame.getCompressedLength(),
                frame.getCompressedSha256(), path.toString()
            );
        } catch (RuntimeException error) {
            markFailed(context, error);
            throw error;
        }
    }

    public Map<String, Object> complete(String uploadId) {
        UploadContext context = loadUpload(uploadId);
        Map<String, Object> status = status(uploadId);
        @SuppressWarnings("unchecked")
        List<Integer> missing = (List<Integer>) status.get("missingFrames");
        if (!missing.isEmpty() || Boolean.TRUE.equals(status.get("meshRequired"))) {
            throw new FlowException(HttpStatus.CONFLICT, "上传不完整，不能发布");
        }
        repository.updateUploadStatus(uploadId, "VERIFYING", null);
        repository.updateScenarioStatus(context.scenarioId, "VERIFYING", null);
        try {
            publishFiles(context);
            transaction.execute(transactionStatus -> {
                publishMetadata(context);
                return null;
            });
            repository.updateUploadStatus(uploadId, "READY", null);
            try {
                storage.deleteTree(storage.uploadDirectory(uploadId));
            } catch (IOException ignored) {
                // staging 定时清理会处理残留空目录。
            }
            retention.enforce();
            Map<String, Object> result = new HashMap<String, Object>();
            result.put("scenarioId", context.scenarioId);
            result.put("status", "READY");
            return result;
        } catch (Exception error) {
            repository.updateUploadStatus(uploadId, "FAILED", error.getMessage());
            repository.updateScenarioStatus(context.scenarioId, "FAILED", error.getMessage());
            throw error instanceof FlowException
                ? (FlowException) error
                : new FlowException(HttpStatus.INTERNAL_SERVER_ERROR, "发布失败: " + error.getMessage());
        }
    }

    private void markFailed(UploadContext context, RuntimeException error) {
        repository.updateUploadStatus(context.uploadId, "FAILED", error.getMessage());
        repository.updateScenarioStatus(context.scenarioId, "FAILED", error.getMessage());
    }

    private void publishFiles(UploadContext context) throws IOException {
        PackageManifest manifest = context.manifest;
        Path finalMesh = storage.mesh(manifest.getMesh().getMeshId());
        if (!Files.exists(finalMesh)) {
            storage.publishMesh(storage.stagingMesh(context.uploadId), manifest.getMesh().getMeshId());
        }
        for (int position = 0; position < manifest.getFrames().size(); position++) {
            PackageManifest.Frame frame = manifest.getFrames().get(position);
            if (frame.getIndex() != position) {
                throw new FlowException(HttpStatus.BAD_REQUEST, "frames 必须按连续帧序排列");
            }
            Path target = storage.frame(context.scenarioId, frame.getIndex());
            if (!Files.exists(target)) {
                storage.publishFrame(
                    storage.stagingFrame(context.uploadId, frame.getIndex()),
                    context.scenarioId,
                    frame.getIndex()
                );
            }
        }
    }

    private void publishMetadata(UploadContext context) {
        PackageManifest manifest = context.manifest;
        PackageManifest.Artifact mesh = manifest.getMesh();
        jdbc.update(
            "INSERT INTO flow_field.ff_mesh(mesh_id,node_count,cell_count,triangle_count,bbox_json,raw_length," +
                "compressed_length,raw_sha256,compressed_sha256,storage_path) VALUES (?,?,?,?,?,?,?,?,?,?) " +
                "ON CONFLICT (mesh_id) DO NOTHING",
            mesh.getMeshId(), manifest.getNNodes(), manifest.getNCells(), manifest.getNTris(),
            writeJson(manifest.getBbox()), mesh.getRawLength(), mesh.getCompressedLength(),
            mesh.getRawSha256(), mesh.getCompressedSha256(), storage.mesh(mesh.getMeshId()).toString()
        );
        jdbc.update(
            "INSERT INTO flow_field.ff_scenario(scenario_id,source_run_id,scenario_name,model_version,mesh_id," +
                "start_time,end_time,frame_count,status,data_available,manifest_json,verify_message,published_at) " +
                "VALUES (?,?,?,?,?,CAST(? AS TIMESTAMPTZ),CAST(? AS TIMESTAMPTZ),?,'READY',TRUE,?,'SHA-256/gzip verified',NOW()) " +
                "ON CONFLICT (source_run_id) DO UPDATE SET scenario_name=EXCLUDED.scenario_name," +
                "model_version=EXCLUDED.model_version,mesh_id=EXCLUDED.mesh_id,start_time=EXCLUDED.start_time," +
                "end_time=EXCLUDED.end_time,frame_count=EXCLUDED.frame_count,status='READY',data_available=TRUE," +
                "manifest_json=EXCLUDED.manifest_json,verify_message=EXCLUDED.verify_message,archive_error=NULL," +
                "published_at=NOW(),updated_at=NOW()",
            context.scenarioId, manifest.getSourceRunId(), manifest.getScenarioName(),
            manifest.getModelVersion(), mesh.getMeshId(), manifest.getStartTime(), manifest.getEndTime(),
            manifest.getNFrames(), writeJson(manifest)
        );
        jdbc.update("DELETE FROM flow_field.ff_frame WHERE scenario_id=?", context.scenarioId);
        for (PackageManifest.Frame frame : manifest.getFrames()) {
            jdbc.update(
                "INSERT INTO flow_field.ff_frame(scenario_id,frame_index,valid_time,raw_length,compressed_length," +
                    "raw_sha256,compressed_sha256,storage_path) VALUES (?,?,CAST(? AS TIMESTAMPTZ),?,?,?,?,?)",
                context.scenarioId, frame.getIndex(), frame.getValidTime(), frame.getRawLength(),
                frame.getCompressedLength(), frame.getRawSha256(), frame.getCompressedSha256(),
                storage.frame(context.scenarioId, frame.getIndex()).toString()
            );
        }
    }

    private UploadContext loadUpload(String uploadId) {
        Map<String, Object> row = repository.findUpload(uploadId);
        if (row == null) {
            throw new FlowException(HttpStatus.NOT_FOUND, "上传会话不存在");
        }
        String status = String.valueOf(row.get("status"));
        if ("EXPIRED".equals(status) || "READY".equals(status)) {
            throw new FlowException(HttpStatus.CONFLICT, "上传会话状态不允许继续: " + status);
        }
        try {
            PackageManifest manifest = objectMapper.readValue(
                String.valueOf(row.get("manifest_json")),
                PackageManifest.class
            );
            return new UploadContext(
                uploadId,
                String.valueOf(row.get("scenario_id")),
                manifest
            );
        } catch (IOException error) {
            throw new FlowException(HttpStatus.INTERNAL_SERVER_ERROR, "上传 manifest 无法读取");
        }
    }

    private void validateManifest(PackageManifest manifest) {
        if (manifest.getFormatVersion() != 2) {
            throw new FlowException(HttpStatus.BAD_REQUEST, "仅支持 formatVersion=2");
        }
        if (manifest.getFrames().size() != manifest.getNFrames()) {
            throw new FlowException(HttpStatus.BAD_REQUEST, "frames 数量与 nFrames 不一致");
        }
        Set<Integer> indexes = new HashSet<Integer>();
        OffsetDateTime previous = null;
        for (int position = 0; position < manifest.getFrames().size(); position++) {
            PackageManifest.Frame frame = manifest.getFrames().get(position);
            if (frame.getIndex() != position) {
                throw new FlowException(HttpStatus.BAD_REQUEST, "frames 必须按连续帧序排列");
            }
            if (!indexes.add(frame.getIndex())) {
                throw new FlowException(HttpStatus.BAD_REQUEST, "帧序号重复");
            }
            OffsetDateTime current;
            try {
                current = OffsetDateTime.parse(frame.getValidTime());
            } catch (RuntimeException error) {
                throw new FlowException(HttpStatus.BAD_REQUEST, "帧有效时间格式错误");
            }
            if (previous != null && !current.isAfter(previous)) {
                throw new FlowException(HttpStatus.BAD_REQUEST, "帧有效时间没有严格递增");
            }
            previous = current;
        }
        for (int index = 0; index < manifest.getNFrames(); index++) {
            if (!indexes.contains(index)) {
                throw new FlowException(HttpStatus.BAD_REQUEST, "帧序号不连续");
            }
        }
    }

    private void requireSameRun(Map<String, Object> upload, PackageManifest incoming) {
        try {
            PackageManifest existing = objectMapper.readValue(
                String.valueOf(upload.get("manifest_json")),
                PackageManifest.class
            );
            boolean same = existing.getNFrames() == incoming.getNFrames()
                && existing.getMesh().getRawSha256().equalsIgnoreCase(incoming.getMesh().getRawSha256());
            if (same) {
                for (int index = 0; index < existing.getFrames().size(); index++) {
                    if (!existing.getFrames().get(index).getRawSha256()
                        .equalsIgnoreCase(incoming.getFrames().get(index).getRawSha256())) {
                        same = false;
                        break;
                    }
                }
            }
            if (!same) {
                throw new FlowException(
                    HttpStatus.CONFLICT,
                    "同一 sourceRunId 的内容发生变化，请修正 sourceRunId 或恢复原数据"
                );
            }
        } catch (JsonProcessingException error) {
            throw new FlowException(HttpStatus.INTERNAL_SERVER_ERROR, "已有上传 manifest 无法读取");
        }
    }

    private PackageManifest.Frame frameAt(PackageManifest manifest, int index) {
        if (index < 0 || index >= manifest.getNFrames()) {
            throw new FlowException(HttpStatus.BAD_REQUEST, "帧序号越界");
        }
        for (PackageManifest.Frame frame : manifest.getFrames()) {
            if (frame.getIndex() == index) {
                return frame;
            }
        }
        throw new FlowException(HttpStatus.BAD_REQUEST, "manifest 中没有该帧");
    }

    private boolean isMeshRequired(String meshId) {
        return repository.findMesh(meshId) == null || !Files.exists(storage.mesh(meshId));
    }

    private List<Integer> allIndexes(int count) {
        List<Integer> indexes = new ArrayList<Integer>(count);
        for (int index = 0; index < count; index++) {
            indexes.add(index);
        }
        return indexes;
    }

    private Map<String, Object> response(
        String uploadId,
        String scenarioId,
        boolean ready,
        boolean meshRequired,
        List<Integer> missingFrames
    ) {
        Map<String, Object> result = new HashMap<String, Object>();
        result.put("uploadId", uploadId);
        result.put("scenarioId", scenarioId);
        result.put("ready", ready);
        result.put("meshRequired", meshRequired);
        result.put("missingFrames", missingFrames);
        return result;
    }

    private String writeJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException error) {
            throw new FlowException(HttpStatus.BAD_REQUEST, "manifest 无法序列化");
        }
    }

    private static final class UploadContext {
        private final String uploadId;
        private final String scenarioId;
        private final PackageManifest manifest;

        private UploadContext(String uploadId, String scenarioId, PackageManifest manifest) {
            this.uploadId = uploadId;
            this.scenarioId = scenarioId;
            this.manifest = manifest;
        }
    }
}
