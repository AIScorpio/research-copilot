// src/lib/daily-digest/generator.ts
// Digest Content Generator - LLM integration for digest generation

import { generateText } from '@/lib/llm';
import { DigestGenerationError } from './errors';
import type { Paper, GeneratedContent, DigestConfig } from './types';
import type { PromptTemplates } from '@/types/prompts';

interface ParsedSection {
  id: string;
  title: string;
  content: string;
}

interface ParsedContent {
  title: string;
  subtitle: string;
  body: string;
  sections: ParsedSection[];
}

export class DigestGenerator {
  async generate(
    papers: Paper[], 
    dateCode: string, 
    config: DigestConfig
  ): Promise<GeneratedContent> {
    try {
      const promptsConfig = await this.loadPromptsConfig();
      const featuredPapers = this.selectFeaturedPapers(papers, config);
      const otherPapers = papers.filter(p => !featuredPapers.includes(p));
      const prompt = this.buildPrompt(
        papers, 
        featuredPapers, 
        otherPapers, 
        dateCode, 
        promptsConfig.digestGeneration,
        config
      );
      const result = await generateText({ prompt });
      const content = this.parseGeneratedContent(result.text);
      let bodyContent = content.body;
      if (!bodyContent.includes(dateCode)) {
        bodyContent = `${dateCode}\n\n${bodyContent}`;
        console.log(`[DigestGenerator] Forced date injection for ${dateCode}`);
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
  
  private async loadPromptsConfig(): Promise<PromptTemplates> {
    const fs = await import('fs/promises');
    const path = await import('path');
    const promptsPath = path.join(process.cwd(), 'config', 'prompts.json');
    const content = await fs.readFile(promptsPath, 'utf-8');
    const promptConfig: PromptTemplates = JSON.parse(content);
    if (!promptConfig.digestGeneration || typeof promptConfig.digestGeneration !== 'string') {
      throw new DigestGenerationError('Invalid prompts config: digestGeneration is missing or not a string');
    }
    return promptConfig;
  }
  
  private selectFeaturedPapers(papers: Paper[], config: DigestConfig): Paper[] {
    const { coverage } = config.generation;
    const targetCount = Math.min(
      Math.max(
        Math.floor(papers.length * coverage.featuredRatio),
        coverage.minFeatured
      ),
      coverage.maxFeatured,
      papers.length
    );
    const sorted = [...papers].sort((a, b) => {
      const scoreA = a.relevanceScore || 0;
      const scoreB = b.relevanceScore || 0;
      return scoreB - scoreA;
    });
    return sorted.slice(0, targetCount);
  }
  
  private buildPrompt(
    allPapers: Paper[],
    featuredPapers: Paper[],
    otherPapers: Paper[],
    dateCode: string,
    promptTemplate: string,
    config: DigestConfig
  ): string {
    const papersList = allPapers.map((p, i) => 
      `[${i + 1}] ${p.title} (${p.source})`
    ).join('\n');
    const limitedPapers = allPapers.slice(0, 15);
    const papersDetail = limitedPapers.map((p, i) => ({
      index: i + 1,
      title: p.title,
      abstract: p.abstract ? p.abstract.substring(0, 200) + (p.abstract.length > 200 ? '...' : '') : 'No abstract available',
      source: p.source,
      url: p.url,
      relevanceScore: p.relevanceScore || 0
    }));
    const papersFull = allPapers.map((p, i) => 
      `[${i + 1}] ${p.title}. ${p.source}. ${p.url}`
    ).join('\n');
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
  
  private parseGeneratedContent(text: string): ParsedContent {
    const titleMatch = text.match(/^#\s*(.+)$/m);
    const title = titleMatch ? titleMatch[1].trim() : '';
    const subtitleMatch = text.match(/^#\s*.+\n\*(.+)\*/m);
    const subtitle = subtitleMatch ? subtitleMatch[1].trim() : '';
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
