package com.supermap.model.flowfield.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.supermap.model.flowfield.web.ApiResponse;
import java.io.IOException;
import java.net.InetAddress;
import java.net.UnknownHostException;
import java.nio.charset.StandardCharsets;
import javax.servlet.FilterChain;
import javax.servlet.ServletException;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * 只读接口默认只接受来自回环、链路本地或私网地址的连接。
 *
 * 服务位于反向代理后时 remoteAddr 是内网代理地址，因此不会信任可伪造的
 * X-Forwarded-For。互联网边界仍应由防火墙/网关作为第一道控制。
 */
@Component
public class InternalNetworkFilter extends OncePerRequestFilter {
    private final ObjectMapper objectMapper;

    public InternalNetworkFilter(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return !request.getRequestURI().contains("/api/v1/");
    }

    @Override
    protected void doFilterInternal(
        HttpServletRequest request,
        HttpServletResponse response,
        FilterChain filterChain
    ) throws ServletException, IOException {
        if (!isInternal(request.getRemoteAddr())) {
            response.setStatus(HttpServletResponse.SC_FORBIDDEN);
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
            response.setCharacterEncoding(StandardCharsets.UTF_8.name());
            objectMapper.writeValue(response.getOutputStream(), ApiResponse.error(403, "只读接口仅允许内网访问"));
            return;
        }
        filterChain.doFilter(request, response);
    }

    static boolean isInternal(String address) {
        try {
            InetAddress inet = InetAddress.getByName(address);
            if (inet.isAnyLocalAddress() || inet.isLoopbackAddress()
                || inet.isLinkLocalAddress() || inet.isSiteLocalAddress()) {
                return true;
            }
            byte[] bytes = inet.getAddress();
            if (bytes.length == 4) {
                int first = bytes[0] & 0xff;
                int second = bytes[1] & 0xff;
                return first == 100 && second >= 64 && second <= 127;
            }
            return bytes.length == 16 && (bytes[0] & 0xfe) == 0xfc;
        } catch (UnknownHostException error) {
            return false;
        }
    }
}
