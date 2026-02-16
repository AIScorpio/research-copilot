/**
 * Source Types Configuration Service
 * Loads and provides access to source-types.json configuration
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import { logger } from './logger';

// Configuration types
export interface SystemSourceConfig {
  name: string;
  displayName: string;
  description: string;
  enabled: boolean;
  hasCollector: boolean | 'proxy';
}

export interface SourceTypeConfig {
  id: string;
  displayName: string;
  icon: string;
  description: string;
  sortOrder: number;
  allowUserAdd: boolean;
  systemSources: SystemSourceConfig[];
}

export interface TagCategoryConfig {
  id: string;
  displayName: string;
  description: string;
  examples: string[];
}

export interface SourceTypesConfig {
  sourceTypes: SourceTypeConfig[];
  tagCategories: TagCategoryConfig[];
}

// Cache for configuration
let cachedConfig: SourceTypesConfig | null = null;
let configLastRead: number = 0;
const CONFIG_CACHE_TTL = 60000; // 1 minute cache

/**
 * Load source types configuration from config/source-types.json
 */
export async function loadSourceTypesConfig(): Promise<SourceTypesConfig> {
  const now = Date.now();
  
  if (cachedConfig && (now - configLastRead) < CONFIG_CACHE_TTL) {
    return cachedConfig;
  }

  try {
    const configPath = join(process.cwd(), 'config', 'source-types.json');
    const configData = await fs.readFile(configPath, 'utf-8');
    cachedConfig = JSON.parse(configData);
    configLastRead = now;
    
    logger.debug('[SourceConfig] Loaded source types config from config/source-types.json');
    return cachedConfig!;
  } catch (error) {
    logger.warn('[SourceConfig] Failed to load config/source-types.json, using fallback', { error });
    return getFallbackConfig();
  }
}

/**
 * Get a specific source type by ID
 */
export async function getSourceTypeById(typeId: string): Promise<SourceTypeConfig | null> {
  const config = await loadSourceTypesConfig();
  return config.sourceTypes.find(st => st.id === typeId) || null;
}

/**
 * Get display name for a source type
 */
export async function getSourceTypeDisplayName(typeId: string): Promise<string> {
  const sourceType = await getSourceTypeById(typeId);
  return sourceType?.displayName || 'Internal';
}

/**
 * Get all tag categories
 */
export async function getTagCategories(): Promise<TagCategoryConfig[]> {
  const config = await loadSourceTypesConfig();
  return config.tagCategories;
}

/**
 * Get a specific tag category by ID
 */
export async function getTagCategoryById(categoryId: string): Promise<TagCategoryConfig | null> {
  const config = await loadSourceTypesConfig();
  return config.tagCategories.find(tc => tc.id === categoryId) || null;
}

/**
 * Validate if a category is allowed
 */
export function isValidCategory(category: string): boolean {
  const ALLOWED_CATEGORIES = [
    'ai-technology',
    'business-area',
    'risk-category',
    'regulatory',
    'methodology',
    'uncategorized'
  ];
  return ALLOWED_CATEGORIES.includes(category.toLowerCase().trim());
}

/**
 * Normalize category with alias mapping
 */
export function normalizeCategory(category: string | undefined): string {
  if (!category) return 'uncategorized';
  
  const normalized = category.toLowerCase().trim();
  
  const CATEGORY_ALIASES: Record<string, string> = {
    'ai-tech': 'ai-technology',
    'ai technology': 'ai-technology',
    'emerging-technology': 'ai-technology',
    'ai': 'ai-technology',
    'business': 'business-area',
    'business domain': 'business-area',
    'risk': 'risk-category',
    'risk management': 'risk-category',
    'reg': 'regulatory',
    'compliance': 'regulatory',
    'method': 'methodology',
    'methods': 'methodology',
  };
  
  if (isValidCategory(normalized)) {
    return normalized;
  }
  
  return CATEGORY_ALIASES[normalized] || 'uncategorized';
}

/**
 * Fallback configuration if file cannot be loaded
 */
function getFallbackConfig(): SourceTypesConfig {
  return {
    sourceTypes: [
      {
        id: 'academic',
        displayName: 'Academic',
        icon: 'GraduationCap',
        description: 'Academic research papers',
        sortOrder: 1,
        allowUserAdd: true,
        systemSources: []
      },
      {
        id: 'industry',
        displayName: 'Industry',
        icon: 'Building2',
        description: 'Industry reports',
        sortOrder: 2,
        allowUserAdd: true,
        systemSources: []
      },
      {
        id: 'internal',
        displayName: 'Internal',
        icon: 'FileText',
        description: 'Internal documents',
        sortOrder: 5,
        allowUserAdd: true,
        systemSources: []
      }
    ],
    tagCategories: [
      {
        id: 'ai-technology',
        displayName: 'AI Technology',
        description: 'AI and ML technologies',
        examples: ['LLM', 'Deep Learning']
      },
      {
        id: 'business-area',
        displayName: 'Business Area',
        description: 'Banking business domains',
        examples: ['Fraud Detection', 'Credit Assessment']
      }
    ]
  };
}

// Export config loader for external use
export { loadSourceTypesConfig as loadSourceConfig };
