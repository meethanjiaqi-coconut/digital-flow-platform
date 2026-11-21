package com.supermap.model.flowfield.storage;

import com.supermap.model.flowfield.config.FlowFieldProperties;
import com.supermap.model.flowfield.web.FlowException;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.util.function.Consumer;
import java.util.zip.GZIPOutputStream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class StorageServiceTest {
    @TempDir
    Path temporaryDirectory;

    @Test
    void receivesAndVerifiesBothCompressedAndRawHashes() throws Exception {
        byte[] raw = "flow-field-frame".getBytes(StandardCharsets.UTF_8);
        byte[] compressed = gzip(raw);
        StorageService storage = storage();
        Path destination = storage.stagingFrame("upload-1", 0);

        storage.receiveAndVerify(
            new ByteArrayInputStream(compressed),
            destination,
            compressed.length,
            sha(compressed),
            raw.length,
            sha(raw),
            noOp()
        );

        assertArrayEquals(compressed, Files.readAllBytes(destination));
    }

    @Test
    void rejectsWrongRawHashWithoutPublishingTemporaryFile() throws Exception {
        byte[] raw = "flow-field-frame".getBytes(StandardCharsets.UTF_8);
        byte[] compressed = gzip(raw);
        StorageService storage = storage();
        Path destination = storage.stagingFrame("upload-2", 0);

        assertThrows(
            FlowException.class,
            () -> storage.receiveAndVerify(
                new ByteArrayInputStream(compressed),
                destination,
                compressed.length,
                sha(compressed),
                raw.length,
                sha("other".getBytes(StandardCharsets.UTF_8)),
                noOp()
            )
        );
    }

    private StorageService storage() throws Exception {
        FlowFieldProperties properties = new FlowFieldProperties();
        properties.setStorageRoot(temporaryDirectory.toString());
        return new StorageService(properties);
    }

    private static byte[] gzip(byte[] raw) throws Exception {
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        try (GZIPOutputStream gzip = new GZIPOutputStream(output)) {
            gzip.write(raw);
        }
        return output.toByteArray();
    }

    private static String sha(byte[] bytes) {
        MessageDigest digest = Hashing.sha256();
        return Hashing.hex(digest.digest(bytes));
    }

    private static Consumer<byte[]> noOp() {
        return value -> { };
    }
}
