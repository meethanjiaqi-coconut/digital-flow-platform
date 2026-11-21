package com.supermap.model.flowfield.storage;

import com.supermap.model.flowfield.config.FlowFieldProperties;
import com.supermap.model.flowfield.model.PackageManifest;
import com.supermap.model.flowfield.web.FlowException;
import java.io.BufferedInputStream;
import java.io.BufferedOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.file.AtomicMoveNotSupportedException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.security.MessageDigest;
import java.util.Comparator;
import java.util.List;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import java.util.UUID;
import java.util.function.Consumer;
import java.util.zip.GZIPInputStream;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

@Service
public class StorageService {
    private static final int BUFFER_SIZE = 64 * 1024;
    private final Path root;

    public StorageService(FlowFieldProperties properties) throws IOException {
        this.root = Paths.get(properties.getStorageRoot()).toAbsolutePath().normalize();
        Files.createDirectories(root.resolve("meshes"));
        Files.createDirectories(root.resolve("scenarios"));
        Files.createDirectories(root.resolve("staging"));
    }

    public Path stagingMesh(String uploadId) {
        return safeResolve("staging", uploadId, "mesh.bin.gz");
    }

    public Path stagingFrame(String uploadId, int index) {
        return safeResolve("staging", uploadId, "frames", String.format("%05d.bin.gz", index));
    }

    public Path mesh(String meshId) {
        return safeResolve("meshes", meshId, "mesh.bin.gz");
    }

    public Path frame(String scenarioId, int index) {
        return safeResolve("scenarios", scenarioId, "frames", String.format("%05d.bin.gz", index));
    }

    public Path scenarioDirectory(String scenarioId) {
        return safeResolve("scenarios", scenarioId);
    }

    public Path uploadDirectory(String uploadId) {
        return safeResolve("staging", uploadId);
    }

    public void receiveAndVerify(
        InputStream request,
        Path destination,
        long compressedLength,
        String compressedSha,
        long rawLength,
        String rawSha,
        Consumer<byte[]> rawPrefixValidator
    ) {
        Path temporary = destination.resolveSibling(
            destination.getFileName().toString() + "." + UUID.randomUUID() + ".tmp"
        );
        try {
            Files.createDirectories(destination.getParent());
            MessageDigest compressedDigest = Hashing.sha256();
            long copied = 0L;
            byte[] buffer = new byte[BUFFER_SIZE];
            try (OutputStream output = new BufferedOutputStream(Files.newOutputStream(temporary))) {
                int count;
                while ((count = request.read(buffer)) >= 0) {
                    if (count == 0) {
                        continue;
                    }
                    copied += count;
                    if (copied > compressedLength) {
                        throw new FlowException(HttpStatus.BAD_REQUEST, "上传文件长度超过 manifest");
                    }
                    compressedDigest.update(buffer, 0, count);
                    output.write(buffer, 0, count);
                }
            }
            if (copied != compressedLength) {
                throw new FlowException(HttpStatus.BAD_REQUEST, "上传文件长度与 manifest 不一致");
            }
            requireHash(compressedSha, Hashing.hex(compressedDigest.digest()), "压缩文件");
            verifyRaw(temporary, rawLength, rawSha, rawPrefixValidator);
            atomicMove(temporary, destination);
        } catch (IOException error) {
            throw new FlowException(HttpStatus.INTERNAL_SERVER_ERROR, "保存上传文件失败: " + error.getMessage());
        } finally {
            try {
                Files.deleteIfExists(temporary);
            } catch (IOException ignored) {
                // 临时文件会由 staging 清理任务兜底。
            }
        }
    }

    private void verifyRaw(
        Path compressed,
        long expectedLength,
        String expectedSha,
        Consumer<byte[]> prefixValidator
    ) throws IOException {
        MessageDigest digest = Hashing.sha256();
        long length = 0L;
        byte[] buffer = new byte[BUFFER_SIZE];
        byte[] prefix = new byte[16];
        int prefixLength = 0;
        try (
            InputStream file = new BufferedInputStream(Files.newInputStream(compressed));
            GZIPInputStream gzip = new GZIPInputStream(file, BUFFER_SIZE)
        ) {
            int count;
            while ((count = gzip.read(buffer)) >= 0) {
                if (count == 0) {
                    continue;
                }
                if (prefixLength < prefix.length) {
                    int copy = Math.min(count, prefix.length - prefixLength);
                    System.arraycopy(buffer, 0, prefix, prefixLength, copy);
                    prefixLength += copy;
                }
                length += count;
                if (length > expectedLength) {
                    throw new FlowException(HttpStatus.BAD_REQUEST, "gzip 解压长度超过 manifest");
                }
                digest.update(buffer, 0, count);
            }
        } catch (IOException error) {
            throw new FlowException(HttpStatus.BAD_REQUEST, "gzip 数据损坏: " + error.getMessage());
        }
        if (length != expectedLength) {
            throw new FlowException(HttpStatus.BAD_REQUEST, "gzip 解压长度与 manifest 不一致");
        }
        requireHash(expectedSha, Hashing.hex(digest.digest()), "解压数据");
        prefixValidator.accept(prefix);
    }

    private void requireHash(String expected, String actual, String label) {
        if (expected == null || !expected.equalsIgnoreCase(actual)) {
            throw new FlowException(HttpStatus.BAD_REQUEST, label + " SHA-256 不匹配");
        }
    }

    public void publishMesh(Path staged, String meshId) throws IOException {
        Path target = mesh(meshId);
        if (Files.exists(target)) {
            return;
        }
        Files.createDirectories(target.getParent());
        atomicMove(staged, target);
    }

    public void publishFrame(Path staged, String scenarioId, int index) throws IOException {
        Path target = frame(scenarioId, index);
        Files.createDirectories(target.getParent());
        atomicMove(staged, target);
    }

    private void atomicMove(Path source, Path target) throws IOException {
        try {
            Files.move(
                source,
                target,
                StandardCopyOption.ATOMIC_MOVE,
                StandardCopyOption.REPLACE_EXISTING
            );
        } catch (AtomicMoveNotSupportedException error) {
            Files.move(source, target, StandardCopyOption.REPLACE_EXISTING);
        }
    }

    public void deleteTree(Path directory) throws IOException {
        if (!Files.exists(directory)) {
            return;
        }
        List<Path> paths;
        try (Stream<Path> stream = Files.walk(directory)) {
            paths = stream.sorted(Comparator.reverseOrder()).collect(Collectors.toList());
        }
        for (Path path : paths) {
            Files.deleteIfExists(path);
        }
    }

    private Path safeResolve(String first, String... more) {
        Path result = root.resolve(first);
        for (String item : more) {
            if (item == null || !item.matches("[A-Za-z0-9._-]+")) {
                throw new FlowException(HttpStatus.BAD_REQUEST, "非法存储标识");
            }
            result = result.resolve(item);
        }
        result = result.toAbsolutePath().normalize();
        if (!result.startsWith(root)) {
            throw new FlowException(HttpStatus.BAD_REQUEST, "非法存储路径");
        }
        return result;
    }
}
