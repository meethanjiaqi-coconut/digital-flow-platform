package com.supermap.model.flowfield.model;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Map;
import org.junit.jupiter.api.Test;

class PackageManifestTest {
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void shouldBindCountFieldsUsingPublishedManifestNames() throws Exception {
        String json = "{\"nNodes\":38081,\"nCells\":71958,"
            + "\"nTris\":71958,\"nFrames\":72}";

        PackageManifest manifest = objectMapper.readValue(json, PackageManifest.class);

        assertEquals(38081, manifest.getNNodes());
        assertEquals(71958, manifest.getNCells());
        assertEquals(71958, manifest.getNTris());
        assertEquals(72, manifest.getNFrames());

        Map<String, Object> serialized = objectMapper.readValue(
            objectMapper.writeValueAsString(manifest),
            new TypeReference<Map<String, Object>>() {}
        );
        assertTrue(serialized.containsKey("nNodes"));
        assertTrue(serialized.containsKey("nCells"));
        assertTrue(serialized.containsKey("nTris"));
        assertTrue(serialized.containsKey("nFrames"));
        assertFalse(serialized.containsKey("nnodes"));
        assertFalse(serialized.containsKey("ncells"));
        assertFalse(serialized.containsKey("ntris"));
        assertFalse(serialized.containsKey("nframes"));
    }
}
