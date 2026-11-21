package com.supermap.model.flowfield.config;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class InternalAuthFilterTest {
    @Test
    void comparesTokensExactly() {
        assertTrue(InternalAuthFilter.constantTimeEquals("secret-token", "secret-token"));
        assertFalse(InternalAuthFilter.constantTimeEquals("secret-token", "secret-token-x"));
        assertFalse(InternalAuthFilter.constantTimeEquals("secret-token", ""));
    }

    @Test
    void recognizesOnlyLoopbackAndPrivateNetworks() {
        assertTrue(InternalNetworkFilter.isInternal("127.0.0.1"));
        assertTrue(InternalNetworkFilter.isInternal("10.33.13.194"));
        assertTrue(InternalNetworkFilter.isInternal("172.20.0.2"));
        assertTrue(InternalNetworkFilter.isInternal("192.168.1.8"));
        assertTrue(InternalNetworkFilter.isInternal("100.64.1.2"));
        assertFalse(InternalNetworkFilter.isInternal("8.8.8.8"));
    }
}
