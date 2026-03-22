// __tests__/unit/daily-digest/config.test.ts

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { loadDigestConfig, saveDigestConfig, clearDigestConfigCache } from '@/lib/daily-digest/config';
import type { DigestConfig } from '@/lib/daily-digest/types';

describe('Digest Configuration', () => {
  beforeEach(() => {
    clearDigestConfigCache();
  });

  afterEach(() => {
    clearDigestConfigCache();
  });

  describe('loadDigestConfig', () => {
    it('should load and validate configuration', async () => {
      const config = await loadDigestConfig();
      
      expect(config).toBeDefined();
      expect(config.version).toMatch(/^\d+\.\d+\.\d+$/);
      expect(config.metadata.lastUpdated).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('should cache configuration', async () => {
      const config1 = await loadDigestConfig();
      const config2 = await loadDigestConfig();
      
      expect(config1).toBe(config2); // Same reference due to caching
    });

    it('should have required template sections', async () => {
      const config = await loadDigestConfig();
      
      expect(config.templates.sections).toHaveLength(6);
      expect(config.templates.sections[0].id).toBe('executiveSummary');
      expect(config.templates.sections[5].id).toBe('sourcesAppendix');
    });

    it('should have quality validators configuration', async () => {
      const config = await loadDigestConfig();
      
      expect(config.quality.validators.dateAccuracy.enabled).toBe(true);
      expect(config.quality.validators.citationExistence.enabled).toBe(true);
      expect(config.quality.validators.coverage.enabled).toBe(true);
    });
  });

  describe('saveDigestConfig', () => {
    it('should validate before saving', async () => {
      const invalidConfig = { invalid: true } as unknown as DigestConfig;
      
      await expect(saveDigestConfig(invalidConfig)).rejects.toThrow();
    });

    it('should save valid configuration', async () => {
      const validConfig = await loadDigestConfig();
      
      // Should not throw
      await expect(saveDigestConfig(validConfig)).resolves.not.toThrow();
    });
  });
});
