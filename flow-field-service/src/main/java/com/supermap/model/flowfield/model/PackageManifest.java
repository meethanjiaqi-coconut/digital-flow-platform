package com.supermap.model.flowfield.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.LinkedHashMap;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import javax.validation.Valid;
import javax.validation.constraints.Min;
import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;

@JsonIgnoreProperties(ignoreUnknown = true)
public class PackageManifest {
    @Min(2)
    private int formatVersion;
    @NotBlank
    private String sourceRunId;
    @NotBlank
    private String scenarioName;
    @NotBlank
    private String modelVersion;
    private String generatedAt;
    @NotBlank
    private String startTime;
    @NotBlank
    private String endTime;
    @Min(1)
    private int nNodes;
    @Min(1)
    private int nCells;
    @Min(1)
    private int nTris;
    @Min(1)
    private int nFrames;
    @NotNull
    private List<Double> bbox = new ArrayList<Double>();
    @NotNull
    private Scales scales;
    private int drySentinel;
    @Valid @NotNull
    private Artifact mesh;
    @Valid @NotNull
    private List<Frame> frames = new ArrayList<Frame>();
    private Map<String, Object> stats = new LinkedHashMap<String, Object>();

    public int getFormatVersion() { return formatVersion; }
    public void setFormatVersion(int formatVersion) { this.formatVersion = formatVersion; }
    public String getSourceRunId() { return sourceRunId; }
    public void setSourceRunId(String sourceRunId) { this.sourceRunId = sourceRunId; }
    public String getScenarioName() { return scenarioName; }
    public void setScenarioName(String scenarioName) { this.scenarioName = scenarioName; }
    public String getModelVersion() { return modelVersion; }
    public void setModelVersion(String modelVersion) { this.modelVersion = modelVersion; }
    public String getGeneratedAt() { return generatedAt; }
    public void setGeneratedAt(String generatedAt) { this.generatedAt = generatedAt; }
    public String getStartTime() { return startTime; }
    public void setStartTime(String startTime) { this.startTime = startTime; }
    public String getEndTime() { return endTime; }
    public void setEndTime(String endTime) { this.endTime = endTime; }
    @JsonProperty("nNodes")
    public int getNNodes() { return nNodes; }
    @JsonProperty("nNodes")
    public void setNNodes(int nNodes) { this.nNodes = nNodes; }
    @JsonProperty("nCells")
    public int getNCells() { return nCells; }
    @JsonProperty("nCells")
    public void setNCells(int nCells) { this.nCells = nCells; }
    @JsonProperty("nTris")
    public int getNTris() { return nTris; }
    @JsonProperty("nTris")
    public void setNTris(int nTris) { this.nTris = nTris; }
    @JsonProperty("nFrames")
    public int getNFrames() { return nFrames; }
    @JsonProperty("nFrames")
    public void setNFrames(int nFrames) { this.nFrames = nFrames; }
    public List<Double> getBbox() { return bbox; }
    public void setBbox(List<Double> bbox) { this.bbox = bbox; }
    public Scales getScales() { return scales; }
    public void setScales(Scales scales) { this.scales = scales; }
    public int getDrySentinel() { return drySentinel; }
    public void setDrySentinel(int drySentinel) { this.drySentinel = drySentinel; }
    public Artifact getMesh() { return mesh; }
    public void setMesh(Artifact mesh) { this.mesh = mesh; }
    public List<Frame> getFrames() { return frames; }
    public void setFrames(List<Frame> frames) { this.frames = frames; }
    public Map<String, Object> getStats() { return stats; }
    public void setStats(Map<String, Object> stats) { this.stats = stats; }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Scales {
        private double level;
        private double uv;
        public double getLevel() { return level; }
        public void setLevel(double level) { this.level = level; }
        public double getUv() { return uv; }
        public void setUv(double uv) { this.uv = uv; }
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Artifact {
        @NotBlank
        private String file;
        @Min(1)
        private long rawLength;
        @Min(1)
        private long compressedLength;
        @NotBlank
        private String rawSha256;
        @NotBlank
        private String compressedSha256;
        @NotBlank
        private String meshId;
        private String magic;
        public String getFile() { return file; }
        public void setFile(String file) { this.file = file; }
        public long getRawLength() { return rawLength; }
        public void setRawLength(long rawLength) { this.rawLength = rawLength; }
        public long getCompressedLength() { return compressedLength; }
        public void setCompressedLength(long compressedLength) { this.compressedLength = compressedLength; }
        public String getRawSha256() { return rawSha256; }
        public void setRawSha256(String rawSha256) { this.rawSha256 = rawSha256; }
        public String getCompressedSha256() { return compressedSha256; }
        public void setCompressedSha256(String compressedSha256) { this.compressedSha256 = compressedSha256; }
        public String getMeshId() { return meshId; }
        public void setMeshId(String meshId) { this.meshId = meshId; }
        public String getMagic() { return magic; }
        public void setMagic(String magic) { this.magic = magic; }
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Frame {
        @NotBlank
        private String file;
        @Min(1)
        private long rawLength;
        @Min(1)
        private long compressedLength;
        @NotBlank
        private String rawSha256;
        @NotBlank
        private String compressedSha256;
        @Min(0)
        private int index;
        @NotBlank
        private String validTime;
        private String sourceFile;
        private int sourceZone;
        public String getFile() { return file; }
        public void setFile(String file) { this.file = file; }
        public long getRawLength() { return rawLength; }
        public void setRawLength(long rawLength) { this.rawLength = rawLength; }
        public long getCompressedLength() { return compressedLength; }
        public void setCompressedLength(long compressedLength) { this.compressedLength = compressedLength; }
        public String getRawSha256() { return rawSha256; }
        public void setRawSha256(String rawSha256) { this.rawSha256 = rawSha256; }
        public String getCompressedSha256() { return compressedSha256; }
        public void setCompressedSha256(String compressedSha256) { this.compressedSha256 = compressedSha256; }
        public int getIndex() { return index; }
        public void setIndex(int index) { this.index = index; }
        public String getValidTime() { return validTime; }
        public void setValidTime(String validTime) { this.validTime = validTime; }
        public String getSourceFile() { return sourceFile; }
        public void setSourceFile(String sourceFile) { this.sourceFile = sourceFile; }
        public int getSourceZone() { return sourceZone; }
        public void setSourceZone(int sourceZone) { this.sourceZone = sourceZone; }
    }
}
