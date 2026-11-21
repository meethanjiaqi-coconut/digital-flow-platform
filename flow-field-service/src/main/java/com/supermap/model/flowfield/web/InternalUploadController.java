package com.supermap.model.flowfield.web;

import com.supermap.model.flowfield.model.PackageManifest;
import com.supermap.model.flowfield.service.UploadService;
import java.io.IOException;
import java.util.Map;
import javax.servlet.http.HttpServletRequest;
import javax.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/internal/v1/uploads")
public class InternalUploadController {
    private final UploadService uploadService;

    public InternalUploadController(UploadService uploadService) {
        this.uploadService = uploadService;
    }

    @PostMapping
    public ApiResponse<Map<String, Object>> create(@Valid @RequestBody PackageManifest manifest) {
        return ApiResponse.ok(uploadService.createOrResume(manifest));
    }

    @GetMapping("/{uploadId}")
    public ApiResponse<Map<String, Object>> status(@PathVariable String uploadId) {
        return ApiResponse.ok(uploadService.status(uploadId));
    }

    @PutMapping("/{uploadId}/mesh")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void mesh(@PathVariable String uploadId, HttpServletRequest request) throws IOException {
        uploadService.uploadMesh(uploadId, request.getInputStream());
    }

    @PutMapping("/{uploadId}/frames/{index}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void frame(
        @PathVariable String uploadId,
        @PathVariable int index,
        HttpServletRequest request
    ) throws IOException {
        uploadService.uploadFrame(uploadId, index, request.getInputStream());
    }

    @PostMapping("/{uploadId}/complete")
    public ApiResponse<Map<String, Object>> complete(@PathVariable String uploadId) {
        return ApiResponse.ok(uploadService.complete(uploadId));
    }
}
