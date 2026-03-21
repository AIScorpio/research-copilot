// src/lib/daily-digest/errors.ts

import type { ValidationReport } from './types';

/**
 * Base error for all digest-related errors
 */
export class DigestError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = 'DigestError';
  }
}

/**
 * Configuration errors
 */
export class DigestConfigError extends DigestError {
  constructor(message: string) {
    super(message, 'DIGEST_CONFIG_ERROR');
    this.name = 'DigestConfigError';
  }
}

/**
 * Generation errors
 */
export class DigestGenerationError extends DigestError {
  constructor(
    message: string, 
    public readonly context?: Record<string, unknown>
  ) {
    super(message, 'DIGEST_GENERATION_ERROR');
    this.name = 'DigestGenerationError';
  }
}

/**
 * Validation errors
 */
export class DigestValidationError extends DigestError {
  constructor(
    message: string,
    public readonly validationReport?: ValidationReport
  ) {
    super(message, 'DIGEST_VALIDATION_ERROR');
    this.name = 'DigestValidationError';
  }
}

/**
 * Not found errors
 */
export class DigestNotFoundError extends DigestError {
  constructor(identifier: string) {
    super(`Digest not found: ${identifier}`, 'DIGEST_NOT_FOUND');
    this.name = 'DigestNotFoundError';
  }
}

/**
 * Cascade errors
 */
export class DigestCascadeError extends DigestError {
  constructor(
    message: string,
    public readonly paperId?: string
  ) {
    super(message, 'DIGEST_CASCADE_ERROR');
    this.name = 'DigestCascadeError';
  }
}
