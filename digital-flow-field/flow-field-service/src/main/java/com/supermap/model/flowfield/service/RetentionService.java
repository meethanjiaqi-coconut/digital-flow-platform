package com.supermap.model.flowfield.service;

import com.supermap.model.flowfield.config.FlowFieldProperties;
import com.supermap.model.flowfield.repository.FlowRepository;
import com.supermap.model.flowfield.storage.StorageService;
import java.io.IOException;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

@Service
public class RetentionService {
    private static final Logger LOGGER = LoggerFactory.getLogger(RetentionService.class);
    private final FlowRepository repository;
    private final StorageService storage;
    private final FlowFieldProperties properties;

    public RetentionService(
        FlowRepository repository,
        StorageService storage,
        FlowFieldProperties properties
    ) {
        this.repository = repository;
        this.storage = storage;
        this.properties = properties;
    }

    public synchronized void enforce() {
        List<Map<String, Object>> rows = repository.scenariosToArchive(properties.getRetainScenarios());
        for (Map<String, Object> row : rows) {
            archive(String.valueOf(row.get("scenario_id")));
        }
    }

    @Scheduled(fixedDelayString = "${flow-field.archive-retry-ms:900000}")
    public void retry() {
        for (Map<String, Object> row : repository.archivingScenarios()) {
            finishArchive(String.valueOf(row.get("scenario_id")));
        }
        enforce();
    }

    @Scheduled(fixedDelayString = "${flow-field.staging-clean-ms:3600000}")
    public void cleanExpiredUploads() {
        for (Map<String, Object> row : repository.expiredUploads()) {
            String uploadId = String.valueOf(row.get("upload_id"));
            try {
                storage.deleteTree(storage.uploadDirectory(uploadId));
                repository.expireUpload(uploadId);
            } catch (Exception error) {
                LOGGER.warn("Failed to clean expired upload {}", uploadId, error);
            }
        }
    }

    private void archive(String scenarioId) {
        repository.markArchiving(scenarioId);
        finishArchive(scenarioId);
    }

    private void finishArchive(String scenarioId) {
        try {
            storage.deleteTree(storage.scenarioDirectory(scenarioId));
            repository.markArchived(scenarioId);
        } catch (IOException error) {
            repository.markArchiveFailed(scenarioId, error.getMessage());
            LOGGER.warn("Failed to archive scenario {}", scenarioId, error);
        }
    }
}
