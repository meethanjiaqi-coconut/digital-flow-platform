package com.supermap.model.flowfield.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "flow-field")
public class FlowFieldProperties {
    private String storageRoot = "/data/flow-field";
    private String publishToken = "";
    private int retainScenarios = 100;
    private int stagingHours = 72;
    private int ioCoreThreads = 4;
    private int ioMaxThreads = 8;
    private int ioQueueCapacity = 64;
    private int cacheScenarios = 2;

    public String getStorageRoot() { return storageRoot; }
    public void setStorageRoot(String storageRoot) { this.storageRoot = storageRoot; }
    public String getPublishToken() { return publishToken; }
    public void setPublishToken(String publishToken) { this.publishToken = publishToken; }
    public int getRetainScenarios() { return retainScenarios; }
    public void setRetainScenarios(int retainScenarios) { this.retainScenarios = retainScenarios; }
    public int getStagingHours() { return stagingHours; }
    public void setStagingHours(int stagingHours) { this.stagingHours = stagingHours; }
    public int getIoCoreThreads() { return ioCoreThreads; }
    public void setIoCoreThreads(int ioCoreThreads) { this.ioCoreThreads = ioCoreThreads; }
    public int getIoMaxThreads() { return ioMaxThreads; }
    public void setIoMaxThreads(int ioMaxThreads) { this.ioMaxThreads = ioMaxThreads; }
    public int getIoQueueCapacity() { return ioQueueCapacity; }
    public void setIoQueueCapacity(int ioQueueCapacity) { this.ioQueueCapacity = ioQueueCapacity; }
    public int getCacheScenarios() { return cacheScenarios; }
    public void setCacheScenarios(int cacheScenarios) { this.cacheScenarios = cacheScenarios; }
}
