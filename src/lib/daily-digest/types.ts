// src/lib/daily-digest/types.ts

/**
 * Paper entity from database
 */
export interface Paper {
  id: string;
  title: string;
  abstract: string | null;
  url: string;
  source: string;
  sourceType: string | null;
  publicationDate: Date;
  collectedAt: Date;
  aiSummary: string | null;
  relevanceScore: number | null;
  technicalScore: number | null;
  businessScore: number | null;
  timelinessScore: number | null;
  practicalityScore: number | null;
  assessmentReason: string | null;
  technicalBonusApplied: boolean;
  deletedAt: Date | null;
  tags: PaperTag[];
  dailyDigests: DailyDigestLog[];
}

/**
 * Junction table linking papers to tags
 */
export interface PaperTag {
  id: string;
  paperId: string;
  tagId: string;
  tag: Tag;
}

/**
 * Tag entity for categorizing papers
 */
export interface Tag {
  id: string;
  name: string;
  category: string;
}

/**
 * Daily Digest Log entity
 */
export interface DailyDigestLog {
  id: string;
  dateCode: string;
  title: string;
  subtitle: string | null;
  content: string;
  type: string;
  actualCount: number;
  totalCount: number;
  status: 'draft' | 'published' | 'archived' | 'error';
  qualityScore: number | null;
  validationIssues: string | null;
  createdAt: Date;
  updatedAt: Date;
  papers: Paper[];
}

/**
 * Configuration types
 */
export interface DigestConfig {
  version: string;
  metadata: ConfigMetadata;
  templates: TemplateConfig;
  generation: GenerationConfig;
  quality: QualityConfig;
  cascadeDelete: CascadeConfig;
}

export interface ConfigMetadata {
  lastUpdated: string;
  description: string;
}

export interface TemplateConfig {
  title: string;
  subtitle: string;
  topic?: string;
  dateFormat: 'YYYY-MM-DD' | 'MM/DD/YYYY' | 'DD-MM-YYYY';
  sections: SectionConfig[];
}

export interface SectionConfig {
  id: string;
  title: string;
  enabled: boolean;
  order: number;
  maxLength?: number;
  requiredElements?: string[];
  groupingStrategy?: 'byTheme' | 'byMethodology' | 'byDomain';
  maxThemes?: number;
  minPapersPerTheme?: number;
  maxPapersPerTheme?: number;
  triggerWhen?: string;
  format?: 'paragraph' | 'bulletList' | 'numberedList';
  maxItems?: number;
  requireSources?: boolean;
  template?: string;
  numbering?: boolean;
}

export interface GenerationConfig {
  triggerOnCollection: boolean;
  minPapers: number;
  maxPapers: number;
  autoPublish: boolean;
  coverage: CoverageConfig;
  fallback: FallbackConfig;
}

export interface CoverageConfig {
  strategy: 'twoTier' | 'featuredOnly' | 'briefOnly';
  featuredRatio: number;
  minFeatured: number;
  maxFeatured: number;
  briefRemaining: boolean;
  targetCoveragePercent: number;
}

export interface FallbackConfig {
  enabled: boolean;
  mode: 'degraded' | 'skip' | 'manual';
  maxRetries: number;
  degradedTemplate?: string;
}

export interface QualityConfig {
  validationEnabled: boolean;
  targetScore: number;
  minAcceptableScore: number;
  validators: ValidatorsConfig;
  retry: RetryConfig;
}

export interface ValidatorsConfig {
  dateAccuracy: { enabled: boolean; weight: number };
  citationExistence: { enabled: boolean; weight: number };
  coverage: { enabled: boolean; minPercent: number; weight: number };
  statisticsAccuracy: { enabled: boolean; weight: number };
  formatConsistency: { enabled: boolean; weight: number };
}

export interface RetryConfig {
  maxAttempts: number;
  backoffMultiplier: number;
}

export interface CascadeConfig {
  enabled: boolean;
  refreshOnDelete: boolean;
  updateCountOnly: boolean;
}

/**
 * Validation types
 */
export interface ValidationReport {
  passed: boolean;
  score: number;
  details: ValidatorResult[];
  criticalIssues: ValidationIssue[];
  warnings: ValidationIssue[];
}

export interface ValidatorResult {
  name: string;
  passed: boolean;
  score: number;
  weight: number;
  issues: ValidationIssue[];
}

export interface ValidationIssue {
  severity: 'critical' | 'warning' | 'info';
  type: 'date' | 'citation' | 'coverage' | 'statistics' | 'format';
  message: string;
  location?: number;
  fix?: string;
}

/**
 * Generation types
 */
export interface GeneratedContent {
  title: string;
  subtitle: string;
  content: string;
  sections: GeneratedSection[];
  dateCode: string;
}

export interface GeneratedSection {
  id: string;
  title: string;
  content: string;
}

/**
 * Citation types
 */
export interface CitedPaper {
  index: number;
  section: 'featured' | 'other';
}

/**
 * Error context
 */
export interface DigestErrorContext {
  dateCode?: string;
  paperCount?: number;
  validationReport?: ValidationReport;
  [key: string]: unknown;
}

/**
 * Digest result types
 */
export interface DigestResult {
  success: boolean;
  digest?: DailyDigestLog;
  validation?: ValidationReport;
  retries: number;
  degraded?: boolean;
  error?: Error;
}

/**
 * Access result types
 */
export interface AccessResult {
  status: 'ready' | 'generating' | 'empty' | 'error';
  digest: DailyDigestLog | null;
  fresh?: boolean;
  cached?: boolean;
  qualityScore?: number;
  message?: string;
  error?: string;
  degraded?: boolean;
}

/**
 * Refresh action types
 */
export interface RefreshAction {
  type: 'minor' | 'moderate' | 'major';
  shouldRegenerate: boolean;
  notification: RefreshNotification;
}

export interface RefreshNotification {
  type: 'silent' | 'subtle' | 'prominent';
  message: string | ((count: number) => string);
  description?: (added: number, removed: number) => string;
  autoRefresh: boolean;
  cta?: string;
}
