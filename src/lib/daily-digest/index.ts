// src/lib/daily-digest/index.ts

// Types
export * from './types';

// Errors
export * from './errors';

// Config
export { loadDigestConfig, saveDigestConfig, clearDigestConfigCache } from './config';

// Engine
export { DigestEngineImpl, digestEngine } from './engine';
export type { DailyDigestEngine } from './engine';

// Generator
export { DigestGenerator } from './generator';

// Validator
export { DigestValidator } from './validator';

// Cascade Handler
export { DigestCascadeHandler, cascadeHandler } from './cascade-handler';

// Type exports for convenience
export type {
  Paper,
  PaperTag,
  Tag,
  DailyDigestLog,
  DigestConfig,
  ConfigMetadata,
  TemplateConfig,
  SectionConfig,
  GenerationConfig,
  CoverageConfig,
  FallbackConfig,
  QualityConfig,
  ValidatorsConfig,
  RetryConfig,
  CascadeConfig,
  ValidationReport,
  ValidatorResult,
  ValidationIssue,
  GeneratedContent,
  GeneratedSection,
  CitedPaper,
  DigestErrorContext,
  DigestResult,
  AccessResult,
  RefreshAction,
  RefreshNotification
} from './types';

// Error exports
export {
  DigestError,
  DigestConfigError,
  DigestGenerationError,
  DigestValidationError,
  DigestNotFoundError,
  DigestCascadeError
} from './errors';
