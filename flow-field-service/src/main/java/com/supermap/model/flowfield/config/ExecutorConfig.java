package com.supermap.model.flowfield.config;

import java.util.concurrent.Executor;
import java.util.concurrent.ThreadPoolExecutor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

@Configuration
public class ExecutorConfig {
    @Bean(name = "flowIoExecutor")
    public Executor flowIoExecutor(FlowFieldProperties properties) {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(properties.getIoCoreThreads());
        executor.setMaxPoolSize(properties.getIoMaxThreads());
        executor.setQueueCapacity(properties.getIoQueueCapacity());
        executor.setThreadNamePrefix("flow-io-");
        executor.setRejectedExecutionHandler(new ThreadPoolExecutor.CallerRunsPolicy());
        executor.initialize();
        return executor;
    }
}
