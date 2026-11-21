package com.supermap.model.flowfield;

import com.supermap.model.flowfield.config.FlowFieldProperties;
import org.mybatis.spring.annotation.MapperScan;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.cloud.client.discovery.EnableDiscoveryClient;
import org.springframework.scheduling.annotation.EnableScheduling;

@EnableScheduling
@EnableDiscoveryClient
@EnableConfigurationProperties(FlowFieldProperties.class)
@MapperScan("com.supermap.model.flowfield.mapper")
@SpringBootApplication
public class FlowFieldApplication {
    public static void main(String[] args) {
        SpringApplication.run(FlowFieldApplication.class, args);
    }
}
