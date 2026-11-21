package com.supermap.model.flowfield.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.supermap.model.flowfield.web.ApiResponse;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import javax.servlet.FilterChain;
import javax.servlet.ServletException;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
public class InternalAuthFilter extends OncePerRequestFilter {
    private final FlowFieldProperties properties;
    private final ObjectMapper objectMapper;

    public InternalAuthFilter(FlowFieldProperties properties, ObjectMapper objectMapper) {
        this.properties = properties;
        this.objectMapper = objectMapper;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return !request.getRequestURI().contains("/internal/");
    }

    @Override
    protected void doFilterInternal(
        HttpServletRequest request,
        HttpServletResponse response,
        FilterChain filterChain
    ) throws ServletException, IOException {
        String expected = properties.getPublishToken();
        String authorization = request.getHeader("Authorization");
        String actual = authorization != null && authorization.startsWith("Bearer ")
            ? authorization.substring(7)
            : "";
        if (expected == null || expected.isEmpty() || !constantTimeEquals(expected, actual)) {
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
            response.setCharacterEncoding(StandardCharsets.UTF_8.name());
            objectMapper.writeValue(response.getOutputStream(), ApiResponse.error(401, "上传令牌无效"));
            return;
        }
        filterChain.doFilter(request, response);
    }

    static boolean constantTimeEquals(String expected, String actual) {
        return MessageDigest.isEqual(
            expected.getBytes(StandardCharsets.UTF_8),
            actual.getBytes(StandardCharsets.UTF_8)
        );
    }
}
