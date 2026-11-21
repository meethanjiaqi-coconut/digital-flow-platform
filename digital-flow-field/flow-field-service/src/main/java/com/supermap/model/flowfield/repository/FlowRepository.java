package com.supermap.model.flowfield.repository;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

@Repository
public class FlowRepository {
    private final JdbcTemplate jdbc;

    public FlowRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public Map<String, Object> findScenarioBySourceRunId(String sourceRunId) {
        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT * FROM flow_field.ff_scenario WHERE source_run_id = ?",
            sourceRunId
        );
        return rows.isEmpty() ? null : rows.get(0);
    }

    public Map<String, Object> findReadyScenario(String scenarioId) {
        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT * FROM flow_field.ff_scenario WHERE scenario_id = ? AND status = 'READY' AND data_available = TRUE",
            scenarioId
        );
        return rows.isEmpty() ? null : rows.get(0);
    }

    /**
     * 根据模型运行标识查询可用场次。
     *
     * @param sourceRunId 模型运行唯一标识
     * @return 可用场次，不存在时返回 null
     */
    public Map<String, Object> findReadyScenarioBySourceRunId(String sourceRunId) {
        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT * FROM flow_field.ff_scenario WHERE source_run_id = ? " +
                "AND status = 'READY' AND data_available = TRUE",
            sourceRunId
        );
        return rows.isEmpty() ? null : rows.get(0);
    }

    public Map<String, Object> findLatestReadyScenario() {
        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT * FROM flow_field.ff_scenario WHERE status = 'READY' AND data_available = TRUE " +
                "ORDER BY published_at DESC LIMIT 1"
        );
        return rows.isEmpty() ? null : rows.get(0);
    }

    public List<Map<String, Object>> listReadyScenarios() {
        return jdbc.queryForList(
            "SELECT scenario_id, source_run_id, scenario_name, model_version, mesh_id, " +
                "start_time, end_time, frame_count, published_at " +
                "FROM flow_field.ff_scenario WHERE status = 'READY' AND data_available = TRUE " +
                "ORDER BY published_at DESC"
        );
    }

    public Map<String, Object> findMesh(String meshId) {
        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT * FROM flow_field.ff_mesh WHERE mesh_id = ?",
            meshId
        );
        return rows.isEmpty() ? null : rows.get(0);
    }

    public Map<String, Object> findFrame(String scenarioId, int index) {
        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT * FROM flow_field.ff_frame WHERE scenario_id = ? AND frame_index = ?",
            scenarioId,
            index
        );
        return rows.isEmpty() ? null : rows.get(0);
    }

    public List<Map<String, Object>> listFrames(String scenarioId) {
        return jdbc.queryForList(
            "SELECT * FROM flow_field.ff_frame WHERE scenario_id = ? ORDER BY frame_index",
            scenarioId
        );
    }

    public Map<String, Object> findReusableUpload(String sourceRunId) {
        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT * FROM flow_field.ff_upload WHERE source_run_id = ? AND status IN ('UPLOADING','VERIFYING','FAILED') " +
                "AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1",
            sourceRunId
        );
        return rows.isEmpty() ? null : rows.get(0);
    }

    public Map<String, Object> findUpload(String uploadId) {
        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT * FROM flow_field.ff_upload WHERE upload_id = ?",
            uploadId
        );
        return rows.isEmpty() ? null : rows.get(0);
    }

    public Set<Integer> uploadedFrames(String uploadId) {
        List<Integer> indexes = jdbc.query(
            "SELECT part_index FROM flow_field.ff_upload_part WHERE upload_id = ? AND part_type = 'FRAME'",
            new Object[]{uploadId},
            new RowMapper<Integer>() {
                @Override
                public Integer mapRow(ResultSet rs, int rowNum) throws SQLException {
                    return rs.getInt(1);
                }
            }
        );
        return new HashSet<Integer>(indexes);
    }

    public boolean uploadedMesh(String uploadId) {
        Integer count = jdbc.queryForObject(
            "SELECT COUNT(*) FROM flow_field.ff_upload_part WHERE upload_id = ? AND part_type = 'MESH'",
            Integer.class,
            uploadId
        );
        return count != null && count > 0;
    }

    public void createUpload(
        String uploadId,
        String sourceRunId,
        String scenarioId,
        String manifestJson,
        int stagingHours
    ) {
        jdbc.update(
            "INSERT INTO flow_field.ff_upload(upload_id, source_run_id, scenario_id, manifest_json, status, expires_at) " +
                "VALUES (?, ?, ?, ?, 'UPLOADING', NOW() + (? * INTERVAL '1 hour'))",
            uploadId, sourceRunId, scenarioId, manifestJson, stagingHours
        );
    }

    public void upsertUploadingScenario(
        String scenarioId,
        String sourceRunId,
        String scenarioName,
        String modelVersion,
        String startTime,
        String endTime,
        int frameCount,
        String manifestJson
    ) {
        jdbc.update(
            "INSERT INTO flow_field.ff_scenario(scenario_id,source_run_id,scenario_name,model_version,mesh_id," +
                "start_time,end_time,frame_count,status,data_available,manifest_json) " +
                "VALUES (?,?,?,?,NULL,CAST(? AS TIMESTAMPTZ),CAST(? AS TIMESTAMPTZ),?,'UPLOADING',FALSE,?) " +
                "ON CONFLICT (source_run_id) DO UPDATE SET scenario_name=EXCLUDED.scenario_name," +
                "model_version=EXCLUDED.model_version,start_time=EXCLUDED.start_time,end_time=EXCLUDED.end_time," +
                "frame_count=EXCLUDED.frame_count,status='UPLOADING',data_available=FALSE," +
                "manifest_json=EXCLUDED.manifest_json,verify_message=NULL,updated_at=NOW()",
            scenarioId, sourceRunId, scenarioName, modelVersion, startTime, endTime, frameCount, manifestJson
        );
    }

    public void updateScenarioStatus(String scenarioId, String status, String message) {
        jdbc.update(
            "UPDATE flow_field.ff_scenario SET status=?, data_available=FALSE, verify_message=?, updated_at=NOW() " +
                "WHERE scenario_id=? AND status <> 'READY'",
            status, message, scenarioId
        );
    }

    public void upsertPart(
        String uploadId,
        String type,
        int index,
        long length,
        String sha,
        String path
    ) {
        jdbc.update(
            "INSERT INTO flow_field.ff_upload_part(upload_id, part_type, part_index, compressed_length, " +
                "compressed_sha256, storage_path) VALUES (?, ?, ?, ?, ?, ?) " +
                "ON CONFLICT (upload_id, part_type, part_index) DO UPDATE SET compressed_length=EXCLUDED.compressed_length, " +
                "compressed_sha256=EXCLUDED.compressed_sha256, storage_path=EXCLUDED.storage_path, uploaded_at=NOW()",
            uploadId, type, index, length, sha, path
        );
        jdbc.update(
            "UPDATE flow_field.ff_upload SET status='UPLOADING', error_message=NULL, updated_at=NOW() WHERE upload_id=?",
            uploadId
        );
        jdbc.update(
            "UPDATE flow_field.ff_scenario SET status='UPLOADING', data_available=FALSE, verify_message=NULL, updated_at=NOW() " +
                "WHERE scenario_id=(SELECT scenario_id FROM flow_field.ff_upload WHERE upload_id=?) AND status <> 'READY'",
            uploadId
        );
    }

    public void updateUploadStatus(String uploadId, String status, String error) {
        jdbc.update(
            "UPDATE flow_field.ff_upload SET status=?, error_message=?, updated_at=NOW() WHERE upload_id=?",
            status, error, uploadId
        );
    }

    public List<Map<String, Object>> scenariosToArchive(int keep) {
        return jdbc.queryForList(
            "SELECT scenario_id FROM flow_field.ff_scenario WHERE status='READY' AND data_available=TRUE " +
                "ORDER BY published_at DESC OFFSET ?",
            keep
        );
    }

    public void markArchiving(String scenarioId) {
        jdbc.update(
            "UPDATE flow_field.ff_scenario SET status='ARCHIVING', data_available=FALSE, updated_at=NOW() WHERE scenario_id=?",
            scenarioId
        );
    }

    public void markArchived(String scenarioId) {
        jdbc.update(
            "UPDATE flow_field.ff_scenario SET status='ARCHIVED', data_available=FALSE, archive_error=NULL, updated_at=NOW() " +
                "WHERE scenario_id=?",
            scenarioId
        );
    }

    public void markArchiveFailed(String scenarioId, String error) {
        jdbc.update(
            "UPDATE flow_field.ff_scenario SET archive_error=?, updated_at=NOW() WHERE scenario_id=?",
            error, scenarioId
        );
    }

    public List<Map<String, Object>> expiredUploads() {
        return jdbc.queryForList(
            "SELECT upload_id FROM flow_field.ff_upload WHERE status IN ('UPLOADING','VERIFYING','FAILED') AND expires_at < NOW()"
        );
    }

    public List<Map<String, Object>> archivingScenarios() {
        return jdbc.queryForList(
            "SELECT scenario_id FROM flow_field.ff_scenario WHERE status='ARCHIVING' ORDER BY updated_at"
        );
    }

    public void expireUpload(String uploadId) {
        jdbc.update(
            "UPDATE flow_field.ff_upload SET status='EXPIRED', updated_at=NOW() WHERE upload_id=?",
            uploadId
        );
    }
}
