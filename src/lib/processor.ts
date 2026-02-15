import { SearchResult } from './collector';
import { generateTagsWithLLM } from './tag-generator';
import { logger } from './logger';

export interface ProcessedPaper extends SearchResult {
    suggestedTags: { name: string; type: 'Academic' | 'Industrial' }[];
}

export async function processPaper(paper: SearchResult): Promise<ProcessedPaper> {
    logger.info('[Processor] Processing paper for tags', { title: paper.title.substring(0, 50) });
    
    try {
        // Use LLM to generate tags based on settings prompt
        const tagResult = await generateTagsWithLLM(paper.title, paper.abstract);
        
        logger.info('[Processor] Tags generated', { 
            title: paper.title.substring(0, 50),
            tagCount: tagResult.tags.length,
            tags: tagResult.tags.map(t => t.name),
            source: tagResult.reasoning.includes('LLM') ? 'LLM' : 'fallback'
        });
        
        return {
            ...paper,
            suggestedTags: tagResult.tags.map(tag => ({
                name: tag.name,
                type: tag.type as 'Academic' | 'Industrial'
            })),
        };
    } catch (error) {
        logger.error('[Processor] Tag generation failed', { error, title: paper.title });
        // Return empty tags on error
        return {
            ...paper,
            suggestedTags: [],
        };
    }
}
