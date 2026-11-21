CREATE SCHEMA IF NOT EXISTS flow_field;

CREATE TABLE IF NOT EXISTS flow_field.ff_mesh (
    mesh_id VARCHAR(64) PRIMARY KEY,
    node_count INTEGER NOT NULL,
    cell_count INTEGER NOT NULL,
    triangle_count INTEGER NOT NULL,
    bbox_json TEXT NOT NULL,
    raw_length BIGINT NOT NULL,
    compressed_length BIGINT NOT NULL,
    raw_sha256 VARCHAR(64) NOT NULL,
    compressed_sha256 VARCHAR(64) NOT NULL,
    storage_path TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS flow_field.ff_scenario (
    scenario_id VARCHAR(36) PRIMARY KEY,
    source_run_id VARCHAR(160) NOT NULL UNIQUE,
    scenario_name VARCHAR(240) NOT NULL,
    model_version VARCHAR(120) NOT NULL,
    mesh_id VARCHAR(64) REFERENCES flow_field.ff_mesh(mesh_id),
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    frame_count INTEGER NOT NULL,
    status VARCHAR(20) NOT NULL,
    data_available BOOLEAN NOT NULL DEFAULT FALSE,
    manifest_json TEXT NOT NULL,
    verify_message TEXT,
    archive_error TEXT,
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ff_scenario_ready
    ON flow_field.ff_scenario(status, published_at DESC);

CREATE TABLE IF NOT EXISTS flow_field.ff_frame (
    scenario_id VARCHAR(36) NOT NULL REFERENCES flow_field.ff_scenario(scenario_id),
    frame_index INTEGER NOT NULL,
    valid_time TIMESTAMPTZ NOT NULL,
    raw_length BIGINT NOT NULL,
    compressed_length BIGINT NOT NULL,
    raw_sha256 VARCHAR(64) NOT NULL,
    compressed_sha256 VARCHAR(64) NOT NULL,
    storage_path TEXT NOT NULL,
    PRIMARY KEY (scenario_id, frame_index)
);

CREATE TABLE IF NOT EXISTS flow_field.ff_upload (
    upload_id VARCHAR(36) PRIMARY KEY,
    source_run_id VARCHAR(160) NOT NULL,
    scenario_id VARCHAR(36) NOT NULL,
    manifest_json TEXT NOT NULL,
    status VARCHAR(20) NOT NULL,
    error_message TEXT,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ff_upload_source
    ON flow_field.ff_upload(source_run_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uk_ff_upload_active_source
    ON flow_field.ff_upload(source_run_id)
    WHERE status IN ('UPLOADING', 'VERIFYING');

CREATE TABLE IF NOT EXISTS flow_field.ff_upload_part (
    upload_id VARCHAR(36) NOT NULL REFERENCES flow_field.ff_upload(upload_id) ON DELETE CASCADE,
    part_type VARCHAR(12) NOT NULL,
    part_index INTEGER NOT NULL,
    compressed_length BIGINT NOT NULL,
    compressed_sha256 VARCHAR(64) NOT NULL,
    storage_path TEXT NOT NULL,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (upload_id, part_type, part_index)
);
