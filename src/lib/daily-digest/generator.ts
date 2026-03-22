// src/lib/daily-digest/generator.ts
// Digest Content Generator - LLM integration for digest generation

import { generateText } from '@/lib/llm';
import { DigestGenerationError } from './errors';
import type { Paper, GeneratedContent, DigestConfig } from './types';
import type { PromptTemplates } from '@/types/prompts';

/**
 * Parsed section from LLM response
 */
interface ParsedSection {
  id: string;
  title: string;
  content: string;
}

/**
 * Parsed content structure
 */
interface ParsedContent {
  title: string;
  subtitle: string;
  body: string;
  sections: ParsedSection[];
}

/**
 * Digest Generator
 * Generates digest content using LLM with configuration-driven templates
 */
export class DigestGenerator {
  /**
   * Generate digest content for a set of papers
   */
  async generate(
    papers: Paper[], 
    dateCode: string, 
    config: DigestConfig
  ): Promise<GeneratedContent> {
    console.log(`[DigestGenerator] generate() called with ${papers.length} papers, dateCode=${dateCode}`);
    
    try {
      // Load prompts configuration
      console.log('[DigestGenerator] Step 1: Loading prompts config...');
      const promptsConfig = await this.loadPromptsConfig();
      console.log('[DigestGenerator] Step 1 complete: prompts loaded');
      
      // Select papers for featured section (based on configuration)
      console.log('[DigestGenerator] Step 2: Selecting featured papers...');
      const featuredPapers = this.selectFeaturedPapers(papers, config);
      const otherPapers = papers.filter(p => !featuredPapers.includes(p));
      console.log(`[DigestGenerator] Step 2 complete: ${featuredPapers.length} featured, ${otherPapers.length} other`);
      
      // Build the full prompt with variables replaced
      console.log('[DigestGenerator] Step 3: Building prompt...');
      const prompt = this.buildPrompt(
        papers, 
        featuredPapers, 
        otherPapers, 
        dateCode, 
        promptsConfig.digestGeneration,
        config
      );
      console.log(`[DigestGenerator] Step 3 complete: prompt built, length=${prompt.length}`);
      
      // Generate content using LLM (no separate system prompt, it's all in the prompt)
      console.log('[DigestGenerator] Step 4: Calling LLM...');
      const result = await generateText({
        prompt
      });
      console.log(`[DigestGenerator] Step 4 complete: LLM returned, result length=${result.text.length}`);
      
      // Parse generated content
      console.log('[DigestGenerator] Step 5: Parsing generated content...');
      const content = this.parseGeneratedContent(result.text);
      console.log('[DigestGenerator] Step 5 complete: content parsed');
      
      // Force inject date into content if not present
      let bodyContent = content.body;
      if (!bodyContent.includes(dateCode)) {
        // Try alternative formats
        const date = new Date(dateCode);
        const usDate = date.toLocaleDateString('en-US');
        const year = date.getFullYear().toString();
        
        if (!bodyContent.includes(usDate) && !bodyContent.includes(year)) {
          // Date not found anywhere - force add at beginning
          bodyContent = `Research Digest: ${dateCode}\n\n${bodyContent}`;
          console.log(`[DigestGenerator] Forced date injection for ${dateCode}`);
        }
      }
      
      return {
        title: content.title || config.templates.title,
        subtitle: content.subtitle || this.buildSubtitle(dateCode, config),
        content: bodyContent,
        sections: content.sections || [],
        dateCode: dateCode
      };
      
    } catch (error) {
      console.error('[DigestGenerator] Failed to generate digest', error);
      throw new DigestGenerationError(
        `Failed to generate digest: ${error instanceof Error ? error.message : String(error)}`,
        { dateCode, paperCount: papers.length }
      );
    }
  }
  
  /**
   * Load prompts configuration from file with validation
   */
  private async loadPromptsConfig(): Promise<PromptTemplates> {
    console.log('[DigestGenerator] loadPromptsConfig() starting...');
    
    console.log('[DigestGenerator] Importing fs/promises...');
    const fs = await import('fs/promises');
    console.log('[DigestGenerator] fs/promises imported');
    
    console.log('[DigestGenerator] Importing path...');
    const path = await import('path');
    console.log('[DigestGenerator] path imported');
    
    const cwd = process.cwd();
    console.log(`[DigestGenerator] process.cwd() = ${cwd}`);
    
    const promptsPath = path.join(cwd, 'config', 'prompts.json');
    console.log(`[DigestGenerator] promptsPath = ${promptsPath}`);
    
    console.log('[DigestGenerator] Reading prompts.json...');
    const content = await fs.readFile(promptsPath, 'utf-8');
    console.log(`[DigestGenerator] prompts.json read, length = ${content.length}`);
    
    console.log('[DigestGenerator] Parsing JSON...');
    const promptConfig: PromptTemplates = JSON.parse(content);
    console.log('[DigestGenerator] JSON parsed successfully');

    // Runtime validation - digestGeneration should be a string like other prompts
    if (!promptConfig.digestGeneration || typeof promptConfig.digestGeneration !== 'string') {
      console.error('[DigestGenerator] Validation failed: digestGeneration missing or not string');
      throw new DigestGenerationError('Invalid prompts config: digestGeneration is missing or not a string');
    }
    
    console.log('[DigestGenerator] loadPromptsConfig() completed successfully');
    return promptConfig;
  }
  
  /**
   * Select papers for featured section
   */
  private selectFeaturedPapers(papers: Paper[], config: DigestConfig): Paper[] {
    const { coverage } = config.generation;
    
    // Calculate target featured count
    const targetCount = Math.min(
      Math.max(
        Math.floor(papers.length * coverage.featuredRatio),
        coverage.minFeatured
      ),
      coverage.maxFeatured,
      papers.length
    );
    
    // Sort by relevance score (highest first)
    const sorted = [...papers].sort((a, b) => {
      const scoreA = a.relevanceScore || 0;
      const scoreB = b.relevanceScore || 0;
      return scoreB - scoreA;
    });
    
    return sorted.slice(0, targetCount);
  }
  
  /**
   * Build prompt for LLM by replacing template variables
   */
  private buildPrompt(
    allPapers: Paper[],
    featuredPapers: Paper[],
    otherPapers: Paper[],
    dateCode: string,
    promptTemplate: string,
    config: DigestConfig
  ): string {
    // Build papers list
    const papersList = allPapers.map((p, i) => 
      `[${i + 1}] ${p.title} (${p.source})`
    ).join('\n');
    
    // Build papers detail as JSON (truncated to save tokens)
    // Limit to max 15 papers to avoid token overflow
    const limitedPapers = allPapers.slice(0, 15);
    const papersDetail = limitedPapers.map((p, i) => ({
      index: i + 1,
      title: p.title,
      abstract: p.abstract ? p.abstract.substring(0, 200) + (p.abstract.length > 200 ? '...' : '') : 'No abstract available',
      source: p.source,
      url: p.url,
      relevanceScore: p.relevanceScore || 0
    }));
    
    // Build full papers reference
    const papersFull = allPapers.map((p, i) => 
      `[${i + 1}] ${p.title}. ${p.source}. ${p.url}`
    ).join('\n');
    
    // Replace template variables in the prompt
    const prompt = promptTemplate
      .replace(/\{\{CURRENT_DATE\}\}/g, dateCode)
      .replace(/\{\{PAPER_COUNT\}\}/g, String(allPapers.length))
      .replace(/\{\{TOPIC\}\}/g, config.templates.topic || 'AI Research')
      .replace(/\{\{FEATURED_COUNT\}\}/g, String(featuredPapers.length))
      .replace(/\{\{TITLE\}\}/g, config.templates.title)
      .replace(/\{\{PAPERS\}\}/g, JSON.stringify(papersDetail, null, 2))
      .replace(/\{\{PAPERS_LIST\}\}/g, papersFull);
    
    return prompt;
  }
  
  /**
   * Parse generated content from LLM response
   */
  private parseGeneratedContent(text: string): ParsedContent {
    // Extract title
    const titleMatch = text.match(/^#\s*(.+)$/m);
    const title = titleMatch ? titleMatch[1].trim() : '';
    
    // Extract subtitle (line after title, typically italic)
    const subtitleMatch = text.match(/^#\s*.+\n\*(.+)\*/m);
    const subtitle = subtitleMatch ? subtitleMatch[1].trim() : '';
    
    // Extract sections
    const sections: ParsedSection[] = [];
    const sectionRegex = /^##\s+(.+)$/gm;
    let match;
    
    while ((match = sectionRegex.exec(text)) !== null) {
      const sectionTitle = match[1].trim();
      const startIdx = match.index;
      const nextMatch = sectionRegex.exec(text);
      const endIdx = nextMatch ? nextMatch.index : text.length;
      
      const sectionContent = text
        .slice(startIdx, endIdx)
        .replace(/^##\s+.+\n?/, '')
        .trim();
      
      sections.push({
        id: sectionTitle.toLowerCase().replace(/\s+/g, ''),
        title: sectionTitle,
        content: sectionContent
      });
      
      if (!nextMatch) break;
      sectionRegex.lastIndex = nextMatch.index;
    }
    
    return {
      title,
      subtitle,
      body: text,
      sections
    };
  }
  
  /**
   * Build subtitle with date
   */
  private buildSubtitle(dateCode: string, config: DigestConfig): string {
    const date = new Date(dateCode);
    const topic = config.templates.topic || 'AI Research';
    
    switch (config.templates.dateFormat) {
      case 'YYYY-MM-DD':
        return `${topic} – ${dateCode} Edition`;
      case 'MM/DD/YYYY':
        return `${topic} – ${date.toLocaleDateString('en-US')} Edition`;
      case 'DD-MM-YYYY':
        return `${topic} – ${date.getDate().toString().padStart(2, '0')}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getFullYear()} Edition`;
      default:
        return `${topic} – ${dateCode} Edition`;
    }
  }
}
