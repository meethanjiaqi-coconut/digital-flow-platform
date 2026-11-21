package com.supermap.model.flowfield.service;

import com.supermap.model.flowfield.config.FlowFieldProperties;
import com.supermap.model.flowfield.repository.FlowRepository;
import com.supermap.model.flowfield.web.FlowException;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.zip.GZIPInputStream;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

@Component
public class FrameCache {
    private final FlowRepository repository;
    private final int maximumScenarios;
    private final LinkedHashMap<String, List<byte[]>> cache;

    public FrameCache(FlowRepository repository, FlowFieldProperties properties) {
        this.repository = repository;
        this.maximumScenarios = Math.max(1, properties.getCacheScenarios());
        this.cache = new LinkedHashMap<String, List<byte[]>>(4, 0.75f, true);
    }

    public synchronized List<byte[]> get(String scenarioId) {
        List<byte[]> frames = cache.get(scenarioId);
        if (frames != null) {
            return frames;
        }
        frames = load(scenarioId);
        cache.put(scenarioId, frames);
        while (cache.size() > maximumScenarios) {
            String eldest = cache.keySet().iterator().next();
            cache.remove(eldest);
        }
        return frames;
    }

    public synchronized void evict(String scenarioId) {
        cache.remove(scenarioId);
    }

    private List<byte[]> load(String scenarioId) {
        List<Map<String, Object>> metadata = repository.listFrames(scenarioId);
        List<byte[]> frames = new ArrayList<byte[]>(metadata.size());
        byte[] buffer = new byte[64 * 1024];
        for (Map<String, Object> row : metadata) {
            Path path = Paths.get(String.valueOf(row.get("storage_path")));
            int expectedLength = ((Number) row.get("raw_length")).intValue();
            try (
                InputStream file = Files.newInputStream(path);
                GZIPInputStream gzip = new GZIPInputStream(file, buffer.length);
                ByteArrayOutputStream output = new ByteArrayOutputStream(expectedLength)
            ) {
                int count;
                while ((count = gzip.read(buffer)) >= 0) {
                    if (count > 0) {
                        output.write(buffer, 0, count);
                    }
                }
                byte[] bytes = output.toByteArray();
                if (bytes.length != expectedLength) {
                    throw new FlowException(HttpStatus.INTERNAL_SERVER_ERROR, "缓存帧长度校验失败");
                }
                frames.add(bytes);
            } catch (IOException error) {
                throw new FlowException(HttpStatus.INTERNAL_SERVER_ERROR, "读取压缩帧失败");
            }
        }
        return frames;
    }
}
