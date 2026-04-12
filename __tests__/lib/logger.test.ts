import { jest } from '@jest/globals';

describe('Logger - Run ID (AsyncLocalStorage)', () => {
  let logger: any;
  let consoleSpy: jest.SpiedFunction<any>;

  beforeEach(() => {
    jest.restoreAllMocks();
    jest.resetModules();
    const mod = require('../../src/lib/logger');
    logger = mod.logger;
    consoleSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  describe('T1: withRunContext + info()', () => {
    it('should include [run-xxxxxxxx] in console output', async () => {
      await logger.withRunContext('a1b2c3d4-5678-abcd-ef01-234567890abc', 'test-agent', async () => {
        logger.info('Test message');
      });

      expect(consoleSpy).toHaveBeenCalledTimes(1);
      const output = consoleSpy.mock.calls[0][0];
      expect(output).toMatch(/\[run-a1b2c3d4\]/);
      expect(output).toContain('Test message');
    });
  });

  describe('T2: After withRunContext callback returns', () => {
    it('should not include [run-...] in subsequent logs', async () => {
      await logger.withRunContext('a1b2c3d4-5678-abcd-ef01-234567890abc', 'test', async () => {
        logger.info('Inside context');
      });

      logger.info('Outside context');

      expect(consoleSpy).toHaveBeenCalledTimes(2);
      const insideOutput = consoleSpy.mock.calls[0][0];
      const outsideOutput = consoleSpy.mock.calls[1][0];
      expect(insideOutput).toMatch(/\[run-a1b2c3d4\]/);
      expect(outsideOutput).not.toMatch(/\[run-/);
    });
  });

  describe('T3: Log without withRunContext', () => {
    it('should produce output identical to current format (no [run-...])', () => {
      logger.info('Plain message');

      expect(consoleSpy).toHaveBeenCalledTimes(1);
      const output = consoleSpy.mock.calls[0][0];
      expect(output).not.toContain('[run-');
      expect(output).toMatch(/^\[INFO\]/);
    });
  });

  describe('T4: getRunContext() inside callback', () => {
    it('should return { runId, agent }', async () => {
      let ctx: any;
      await logger.withRunContext('test-uuid-1234', 'my-agent', async () => {
        ctx = logger.getRunContext();
      });

      expect(ctx).toEqual({ runId: 'test-uuid-1234', agent: 'my-agent' });
    });
  });

  describe('T5: getRunContext() outside callback', () => {
    it('should return undefined', () => {
      const ctx = logger.getRunContext();
      expect(ctx).toBeUndefined();
    });
  });

  describe('T6: Error inside callback', () => {
    it('should auto-clean context after error', async () => {
      try {
        await logger.withRunContext('error-uuid-abcd', 'test', async () => {
          logger.info('Before error');
          throw new Error('boom');
        });
      } catch (_) {
        // expected
      }

      logger.info('After error');

      expect(consoleSpy).toHaveBeenCalledTimes(2);
      const beforeOutput = consoleSpy.mock.calls[0][0];
      const afterOutput = consoleSpy.mock.calls[1][0];
      expect(beforeOutput).toMatch(/\[run-error-uu\]/);
      expect(afterOutput).not.toMatch(/\[run-/);
    });
  });

  describe('T7: Nested withRunContext', () => {
    it('should use inner context and restore outer after', async () => {
      await logger.withRunContext('outer-uuid-1111', 'outer', async () => {
        logger.info('Outer before');

        await logger.withRunContext('inner-uuid-2222', 'inner', async () => {
          logger.info('Inner');
        });

        logger.info('Outer after');
      });

      expect(consoleSpy).toHaveBeenCalledTimes(3);
      expect(consoleSpy.mock.calls[0][0]).toMatch(/\[run-outer-uu\]/);
      expect(consoleSpy.mock.calls[1][0]).toMatch(/\[run-inner-uu\]/);
      expect(consoleSpy.mock.calls[2][0]).toMatch(/\[run-outer-uu\]/);
    });
  });

  describe('T8: Short UUID format', () => {
    it('should be exactly 8 hex chars after [run-', async () => {
      await logger.withRunContext('abcdef01-2345-6789-abcd-ef0123456789', 'test', async () => {
        logger.info('Format check');
      });

      const output = consoleSpy.mock.calls[0][0];
      const match = output.match(/\[run-([0-9a-f]{8})\]/);
      expect(match).not.toBeNull();
      expect(match![1]).toBe('abcdef01');
    });
  });
});
