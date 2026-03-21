/**
 * Zod validation schemas for Daily Digest configuration
 * 
 * These schemas validate the structure and content of config/digest.json
 * ensuring all required fields are present and properly formatted.
 */

import { z } from 'zod';

/**
 * Schema for individual template sections
 * Defines the structure of each section in the digest template
 */
export const sectionSchema = z.object({
  /** Unique identifier for the section (camelCase) */
  id: z.string().regex(/^[a-z][a-zA-Z0-9]*$/),
  /** Display title for the section */
  title: z.string().min(1).max(200),
  /** Whether this section is enabled in output */
  enabled: z.boolean(),
  /** Order of appearance (1-99) */
  order: z.number().int().min(1).max(99),
  /** Maximum character length for the section content */
  maxLength: z.number().int().optional(),
  /** Required elements that must appear in this section */
  requiredElements: z.array(z.string()).optional(),
  /** Strategy for grouping papers within this section */
  groupingStrategy: z.enum(['byTheme', 'byMethodology', 'byDomain']).optional(),
  /** Maximum number of themes to group by */
  maxThemes: z.number().int().min(1).max(10).optional(),
  /** Minimum papers required per theme */
  minPapersPerTheme: z.number().int().min(1).optional(),
  /** Maximum papers allowed per theme */
  maxPapersPerTheme: z.number().int().min(1).optional(),
  /** Subsection identifiers for complex sections */
  subsections: z.array(z.string()).optional(),
  /** Condition for triggering this section */
  triggerWhen: z.string().optional(),
  /** Output format for this section */
  format: z.enum(['paragraph', 'bulletList', 'numberedList']).optional(),
  /** Maximum number of items in this section */
  maxItems: z.number().int().min(1).optional(),
  /** Whether sources must be cited in this section */
  requireSources: z.boolean().optional(),
  /** Template string for formatting items */
  template: z.string().optional(),
  /** Whether to apply numbering to items */
  numbering: z.boolean().optional()
});

/**
 * Main digest configuration schema
 * Validates the entire config/digest.json file structure
 */
export const digestConfigSchema = z.object({
  /** Semantic version of the configuration */
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  /** Metadata about this configuration */
  metadata: z.object({
    /** Last update date (YYYY-MM-DD) */
    lastUpdated: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    /** Human-readable description */
    description: z.string()
  }),
  /** Template configuration for digest generation */
  templates: z.object({
    /** Main title template */
    title: z.string().min(1).max(200),
    /** Subtitle template with variables */
    subtitle: z.string(),
    /** Date format for display (YYYY-MM-DD, MM/DD/YYYY, or DD-MM-YYYY) */
    dateFormat: z.enum(['YYYY-MM-DD', 'MM/DD/YYYY', 'DD-MM-YYYY']),
    /** Ordered list of sections to include */
    sections: z.array(sectionSchema).min(1)
  }),
  /** Generation behavior configuration */
  generation: z.object({
    /** Whether to auto-trigger on new paper collection */
    triggerOnCollection: z.boolean(),
    /** Minimum papers required to generate digest */
    minPapers: z.number().int().min(1),
    /** Maximum papers to include in digest */
    maxPapers: z.number().int().min(1),
    /** Whether to auto-publish generated digests */
    autoPublish: z.boolean(),
    /** Paper coverage strategy configuration */
    coverage: z.object({
      /** Coverage strategy type */
      strategy: z.enum(['twoTier', 'featuredOnly', 'briefOnly']),
      /** Ratio of papers to feature (0.0-1.0) */
      featuredRatio: z.number().min(0).max(1),
      /** Minimum featured papers regardless of ratio */
      minFeatured: z.number().int().min(1),
      /** Maximum featured papers regardless of ratio */
      maxFeatured: z.number().int().min(1),
      /** Whether to include brief summaries for remaining papers */
      briefRemaining: z.boolean(),
      /** Target coverage percentage (0-100) */
      targetCoveragePercent: z.number().min(0).max(100)
    }),
    /** Fallback behavior when generation fails */
    fallback: z.object({
      /** Whether fallback mode is enabled */
      enabled: z.boolean(),
      /** Fallback mode behavior */
      mode: z.enum(['degraded', 'skip', 'manual']),
      /** Maximum retry attempts (0-5) */
      maxRetries: z.number().int().min(0).max(5),
      /** Template to use for degraded mode */
      degradedTemplate: z.string().optional()
    })
  }),
  /** Quality validation configuration */
  quality: z.object({
    /** Whether validation is enabled */
    validationEnabled: z.boolean(),
    /** Target quality score (0-10) */
    targetScore: z.number().min(0).max(10),
    /** Minimum acceptable score (0-10) */
    minAcceptableScore: z.number().min(0).max(10),
    /** Individual validator configurations */
    validators: z.object({
      /** Date accuracy validator */
      dateAccuracy: z.object({ 
        enabled: z.boolean(), 
        weight: z.number().min(0).max(1) 
      }),
      /** Citation existence validator */
      citationExistence: z.object({ 
        enabled: z.boolean(), 
        weight: z.number().min(0).max(1) 
      }),
      /** Coverage validator */
      coverage: z.object({ 
        enabled: z.boolean(), 
        minPercent: z.number().min(0).max(100), 
        weight: z.number().min(0).max(1) 
      }),
      /** Statistics accuracy validator */
      statisticsAccuracy: z.object({ 
        enabled: z.boolean(), 
        weight: z.number().min(0).max(1) 
      }),
      /** Format consistency validator */
      formatConsistency: z.object({ 
        enabled: z.boolean(), 
        weight: z.number().min(0).max(1) 
      })
    }).refine(
      (validators) => {
        const totalWeight = 
          validators.dateAccuracy.weight +
          validators.citationExistence.weight +
          validators.coverage.weight +
          validators.statisticsAccuracy.weight +
          validators.formatConsistency.weight;
        return Math.abs(totalWeight - 1.0) < 0.001; // Allow tiny floating point error
      },
      { message: 'Validator weights must sum to 1.0' }
    ),
    /** Retry configuration */
    retry: z.object({
      /** Maximum retry attempts (1-5) */
      maxAttempts: z.number().int().min(1).max(5),
      /** Exponential backoff multiplier (≥1) */
      backoffMultiplier: z.number().min(1)
    })
  }),
  /** Cascade delete behavior configuration */
  cascadeDelete: z.object({
    /** Whether cascade delete is enabled */
    enabled: z.boolean(),
    /** Whether to regenerate digest after paper deletion */
    refreshOnDelete: z.boolean(),
    /** Whether to only update count (true) or regenerate (false) */
    updateCountOnly: z.boolean()
  })
});

/**
 * TypeScript type inferred from digestConfigSchema
 * Use this type for type-safe configuration handling
 */
export type DigestConfig = z.infer<typeof digestConfigSchema>;

/**
 * TypeScript type for section configuration
 */
export type SectionConfig = z.infer<typeof sectionSchema>;
