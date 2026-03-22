/**
 * Security Tests
 * 
 * These tests verify the security hardening measures:
 * 1. CSRF token generation
 * 2. Security utilities exist and are properly typed
 */

import { generateCSRFToken, CSRF_HEADER_NAME, CSRF_TOKEN_COOKIE_NAME } from '@/lib/csrf';

describe('Security Measures', () => {
  describe('CSRF Token Generation', () => {
    it('should generate a unique CSRF token', async () => {
      const token1 = await generateCSRFToken();
      const token2 = await generateCSRFToken();
      
      expect(token1).toBeDefined();
      expect(token2).toBeDefined();
      expect(token1).not.toBe(token2);
      expect(token1.length).toBe(64); // 32 bytes = 64 hex characters
      expect(token2.length).toBe(64);
    });

    it('should generate tokens with valid hex characters', async () => {
      const token = await generateCSRFToken();
      const hexRegex = /^[0-9a-f]{64}$/i;
      
      expect(hexRegex.test(token)).toBe(true);
    });

    it('should export proper constant names', () => {
      expect(CSRF_HEADER_NAME).toBe('x-csrf-token');
      expect(CSRF_TOKEN_COOKIE_NAME).toBe('csrf_token');
    });
  });

  describe('Security Module Exports', () => {
    it('should export rate limiting functions', async () => {
      const rateLimitModule = await import('@/lib/rate-limit');
      
      expect(rateLimitModule.rateLimit).toBeDefined();
      expect(typeof rateLimitModule.rateLimit).toBe('function');
    });

    it('should export session management functions', async () => {
      const sessionModule = await import('@/lib/session');
      
      expect(sessionModule.getAuthUser).toBeDefined();
      expect(sessionModule.requireAuth).toBeDefined();
      expect(sessionModule.createUnauthorizedResponse).toBeDefined();
    });

    it('should export security utilities', async () => {
      const securityModule = await import('@/lib/security');
      
      expect(securityModule.validateCSRFRequest).toBeDefined();
      expect(securityModule.createCSRFErrorResponse).toBeDefined();
      expect(securityModule.validateAuthenticatedRequest).toBeDefined();
      expect(securityModule.withAuthAndCSRF).toBeDefined();
      expect(securityModule.withAuth).toBeDefined();
    });
  });

  describe('Rate Limiting Configuration', () => {
    it('should have rate limiting configured', async () => {
      const { rateLimit } = await import('@/lib/rate-limit');
      
      // Verify function exists and is callable
      expect(typeof rateLimit).toBe('function');
      
      // Note: Actual rate limiting tests require integration testing
      // with Redis and are not suitable for unit tests
    });
  });
});
