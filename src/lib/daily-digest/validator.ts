// src/lib/daily-digest/validator.ts
// Digest Content Validator - Multi-tier validation pipeline

import { DigestValidationError } from './errors';
import type { 
  GeneratedContent, 
  ValidationReport, 
  ValidatorResult, 
  ValidationIssue,
  Paper,
  DigestConfig 
} from './types';

/**
 * Digest Validator
 * Orchestrates multi-tier content validation
 */
export class DigestValidator {
  private validators: Map<string, ContentValidator>;
  
  constructor() {
    this.validators = new Map();
    this.registerValidators();
  }
  
  /**
   * Register all validation components
   */
  private registerValidators(): void {
    this.validators.set('dateAccuracy', new DateAccuracyValidator());
    this.validators.set('citationExistence', new CitationExistenceValidator());
    this.validators.set('coverage', new CoverageValidator());
    this.validators.set('statisticsAccuracy', new StatisticsAccuracyValidator());
    this.validators.set('formatConsistency', new FormatConsistencyValidator());
  }
  
  /**
   * Validate generated content
   */
  async validate(
    content: GeneratedContent, 
    papers: Paper[], 
    config: DigestConfig
  ): Promise<ValidationReport> {
    const results: ValidatorResult[] = [];
    const criticalIssues: ValidationIssue[] = [];
    const warnings: ValidationIssue[] = [];
    
    // Run each enabled validator
    for (const [name, validator] of this.validators) {
      const validatorConfig = config.quality.validators[name as keyof typeof config.quality.validators];
      
      if (!validatorConfig?.enabled) {
        continue;
      }
      
      try {
        const result = await validator.validate(content, papers, config);
        result.name = name;
        result.weight = validatorConfig.weight;
        results.push(result);
        
        // Collect issues
        for (const issue of result.issues) {
          if (issue.severity === 'critical') {
            criticalIssues.push(issue);
          } else {
            warnings.push(issue);
          }
        }
      } catch (error) {
        console.error(`[DigestValidator] Validator ${name} failed`, error);
        results.push({
          name,
          passed: false,
          score: 0,
          weight: validatorConfig.weight,
          issues: [{
            severity: 'warning',
            type: 'format',
            message: `Validator ${name} failed: ${error instanceof Error ? error.message : String(error)}`
          }]
        });
      }
    }
    
    // Calculate overall score (0-1 range)
    const totalWeight = results.reduce((sum, r) => sum + r.weight, 0);
    const weightedScore = results.reduce((sum, r) => sum + (r.score * r.weight), 0);
    const normalizedScore = totalWeight > 0 ? weightedScore / totalWeight : 0;
    
    // Convert to 0-10 scale to match config
    const score = normalizedScore * 10;
    
    // Determine if validation passed
    const passed = criticalIssues.length === 0 && score >= config.quality.minAcceptableScore;
    
    return {
      passed,
      score,
      details: results,
      criticalIssues,
      warnings
    };
  }
}

/**
 * Base validator interface
 */
interface ContentValidator {
  validate(
    content: GeneratedContent, 
    papers: Paper[], 
    config: DigestConfig
  ): Promise<ValidatorResult>;
}

/**
 * Date Accuracy Validator
 * Ensures correct date usage in digest
 */
class DateAccuracyValidator implements ContentValidator {
  async validate(
    content: GeneratedContent, 
    papers: Paper[], 
    config: DigestConfig
  ): Promise<ValidatorResult> {
    const issues: ValidationIssue[] = [];
    const dateCode = content.dateCode;
    
    // Check if dateCode appears in content
    if (!content.content.includes(dateCode)) {
      // Try alternative date formats
      const date = new Date(dateCode);
      const alternatives = [
        date.toLocaleDateString('en-US'),
        date.getFullYear().toString()
      ];
      
      const hasDate = alternatives.some(alt => content.content.includes(alt));
      
      if (!hasDate) {
        issues.push({
          severity: 'critical',
          type: 'date',
          message: `Date ${dateCode} not found in content`,
          fix: 'Add correct date to digest'
        });
      }
    }
    
    // Note: We don't check for old years in content because papers often reference historical data
    
    return {
      name: 'dateAccuracy',
      passed: issues.length === 0,
      score: issues.length === 0 ? 1.0 : 0.3,
      weight: 0,
      issues
    };
  }
}

/**
 * Citation Existence Validator
 * Verifies all cited papers exist
 */
class CitationExistenceValidator implements ContentValidator {
  async validate(
    content: GeneratedContent, 
    papers: Paper[], 
    config: DigestConfig
  ): Promise<ValidatorResult> {
    const issues: ValidationIssue[] = [];
    
    // Extract citations [N] from content
    const citationRegex = /\[(\d+)\]/g;
    const citations = new Set<number>();
    let match;
    
    while ((match = citationRegex.exec(content.content)) !== null) {
      citations.add(parseInt(match[1], 10));
    }
    
    // Check if each citation refers to a valid paper
    for (const citation of citations) {
      if (citation < 1 || citation > papers.length) {
        issues.push({
          severity: 'critical',
          type: 'citation',
          message: `Invalid citation [${citation}] - paper does not exist`,
          fix: `Remove or correct citation [${citation}]`
        });
      }
    }
    
    // Check if all papers are cited
    const citedCount = citations.size;
    const totalPapers = papers.length;
    const coverageRatio = totalPapers > 0 ? citedCount / totalPapers : 0;
    
    if (coverageRatio < 0.5) {
      issues.push({
        severity: 'warning',
        type: 'citation',
        message: `Only ${Math.round(coverageRatio * 100)}% of papers cited (${citedCount}/${totalPapers})`,
        fix: 'Add more citations to paper references'
      });
    }
    
    return {
      name: 'citationExistence',
      passed: issues.filter(i => i.severity === 'critical').length === 0,
      score: coverageRatio,
      weight: 0,
      issues
    };
  }
}

/**
 * Coverage Validator
 * Checks paper coverage percentage
 */
class CoverageValidator implements ContentValidator {
  async validate(
    content: GeneratedContent, 
    papers: Paper[], 
    config: DigestConfig
  ): Promise<ValidatorResult> {
    const issues: ValidationIssue[] = [];
    const minPercent = config.quality.validators.coverage.minPercent || 50;
    
    // Count unique papers mentioned
    const mentionedPapers = new Set<number>();
    const citationRegex = /\[(\d+)\]/g;
    let match;
    
    while ((match = citationRegex.exec(content.content)) !== null) {
      const index = parseInt(match[1], 10);
      if (index >= 1 && index <= papers.length) {
        mentionedPapers.add(index);
      }
    }
    
    const coveragePercent = papers.length > 0 
      ? (mentionedPapers.size / papers.length) * 100 
      : 0;
    
    if (coveragePercent < minPercent) {
      issues.push({
        severity: 'critical',
        type: 'coverage',
        message: `Coverage ${coveragePercent.toFixed(1)}% below minimum ${minPercent}%`,
        fix: `Add more papers to reach ${minPercent}% coverage`
      });
    }
    
    // Score based on coverage ratio
    const score = Math.min(coveragePercent / 100, 1.0);
    
    return {
      name: 'coverage',
      passed: issues.length === 0,
      score,
      weight: 0,
      issues
    };
  }
}

/**
 * Statistics Accuracy Validator
 * Validates numerical claims against sources
 */
class StatisticsAccuracyValidator implements ContentValidator {
  async validate(
    content: GeneratedContent, 
    papers: Paper[], 
    config: DigestConfig
  ): Promise<ValidatorResult> {
    const issues: ValidationIssue[] = [];
    
    // Extract numbers from content
    const numberRegex = /\b(\d+(?:\.\d+)?)\b/g;
    const contentNumbers: number[] = [];
    let match;
    
    while ((match = numberRegex.exec(content.content)) !== null) {
      contentNumbers.push(parseFloat(match[1]));
    }
    
    // For now, we flag statistics that might be hallucinated
    // In production, this would verify against actual paper content
    const suspiciousPatterns = [
      { pattern: /improved by \d+%/i, message: 'Percentage improvement claim' },
      { pattern: /accuracy of \d+%/i, message: 'Accuracy percentage claim' },
      { pattern: /\d+ percent/i, message: 'Percentage claim' }
    ];
    
    for (const { pattern, message } of suspiciousPatterns) {
      if (pattern.test(content.content)) {
        // Check if there's a citation nearby
        const index = content.content.search(pattern);
        const nearbyText = content.content.slice(Math.max(0, index - 100), index + 100);
        
        if (!nearbyText.includes('[')) {
          issues.push({
            severity: 'warning',
            type: 'statistics',
            message: `${message} without clear citation - verify source`,
            fix: 'Add citation or verify statistic from source paper'
          });
        }
      }
    }
    
    return {
      name: 'statisticsAccuracy',
      passed: issues.filter(i => i.severity === 'critical').length === 0,
      score: issues.length === 0 ? 1.0 : 0.7,
      weight: 0,
      issues
    };
  }
}

/**
 * Format Consistency Validator
 * Enforces template compliance
 */
class FormatConsistencyValidator implements ContentValidator {
  async validate(
    content: GeneratedContent, 
    papers: Paper[], 
    config: DigestConfig
  ): Promise<ValidatorResult> {
    const issues: ValidationIssue[] = [];
    
    // Check required sections
    const requiredSections = config.templates.sections
      .filter(s => s.enabled)
      .sort((a, b) => a.order - b.order);
    
    for (const section of requiredSections) {
      const sectionFound = content.sections.some(s => 
        s.title.toLowerCase().includes(section.title.toLowerCase())
      );
      
      if (!sectionFound) {
        issues.push({
          severity: 'warning',
          type: 'format',
          message: `Required section "${section.title}" not found`,
          fix: `Add section: ${section.title}`
        });
      }
    }
    
    // Check title format
    if (!content.title.includes(config.templates.title)) {
      issues.push({
        severity: 'warning',
        type: 'format',
        message: 'Title does not match template format',
        fix: `Title should start with: ${config.templates.title}`
      });
    }
    
    // Check date format
    const dateCode = content.dateCode;
    const dateFormat = config.templates.dateFormat;
    
    if (!this.validateDateFormat(content.content, dateCode, dateFormat)) {
      issues.push({
        severity: 'critical',
        type: 'format',
        message: `Date format does not match expected format: ${dateFormat}`,
        fix: `Use date format: ${dateFormat}`
      });
    }
    
    return {
      name: 'formatConsistency',
      passed: issues.filter(i => i.severity === 'critical').length === 0,
      score: issues.length === 0 ? 1.0 : 0.8,
      weight: 0,
      issues
    };
  }
  
  private validateDateFormat(content: string, dateCode: string, format: string): boolean {
    const date = new Date(dateCode);
    
    switch (format) {
      case 'YYYY-MM-DD':
        return content.includes(dateCode);
      case 'MM/DD/YYYY':
        const usDate = date.toLocaleDateString('en-US');
        return content.includes(usDate);
      case 'DD-MM-YYYY':
        const ukDate = `${date.getDate().toString().padStart(2, '0')}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getFullYear()}`;
        return content.includes(ukDate);
      default:
        return content.includes(dateCode);
    }
  }
}
