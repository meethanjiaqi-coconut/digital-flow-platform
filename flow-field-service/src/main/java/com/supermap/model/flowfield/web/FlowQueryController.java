package com.supermap.model.flowfield.web;

import com.supermap.model.flowfield.service.QueryService;
import com.supermap.model.flowfield.service.QueryService.BinaryFile;
import java.io.InputStream;
import java.nio.file.Files;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;

@RestController
@RequestMapping("/api/v1")
public class FlowQueryController {
    private final QueryService queryService;

    public FlowQueryController(QueryService queryService) {
        this.queryService = queryService;
    }

    @GetMapping("/scenarios")
    public ApiResponse<List<Map<String, Object>>> scenarios() {
        return ApiResponse.ok(queryService.scenarios());
    }

    @GetMapping("/scenarios/latest/manifest")
    public ApiResponse<Map<String, Object>> latestManifest() {
        return ApiResponse.ok(queryService.latestManifest());
    }

    @GetMapping("/scenarios/{scenarioId}/manifest")
    public ApiResponse<Map<String, Object>> manifest(@PathVariable String scenarioId) {
        return ApiResponse.ok(queryService.manifest(scenarioId));
    }

    @GetMapping("/meshes/{meshId}")
    public ResponseEntity<StreamingResponseBody> mesh(@PathVariable String meshId) {
        return binary(queryService.mesh(meshId));
    }

    @GetMapping("/scenarios/{scenarioId}/frames/{index}")
    public ResponseEntity<StreamingResponseBody> frame(
        @PathVariable String scenarioId,
        @PathVariable int index
    ) {
        return binary(queryService.frame(scenarioId, index));
    }

    @GetMapping("/scenarios/{scenarioId}/cells/{cellIndex}/series")
    public ApiResponse<Map<String, Object>> series(
        @PathVariable String scenarioId,
        @PathVariable int cellIndex
    ) {
        return ApiResponse.ok(queryService.series(scenarioId, cellIndex));
    }

    private ResponseEntity<StreamingResponseBody> binary(BinaryFile file) {
        StreamingResponseBody body = output -> {
            byte[] buffer = new byte[64 * 1024];
            try (InputStream input = Files.newInputStream(file.getPath())) {
                int count;
                while ((count = input.read(buffer)) >= 0) {
                    if (count > 0) {
                        output.write(buffer, 0, count);
                    }
                }
            }
        };
        return ResponseEntity.ok()
            .contentType(MediaType.APPLICATION_OCTET_STREAM)
            .contentLength(file.getLength())
            .header(HttpHeaders.CONTENT_ENCODING, "gzip")
            .eTag("\"" + file.getSha256() + "\"")
            .header(HttpHeaders.CACHE_CONTROL, "public, max-age=31536000, immutable")
            .body(body);
    }
}
