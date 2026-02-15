/**
 * LLM Wrapper - Simple wrapper for generateSummary and generateTags
 * Uses multi-provider fallback with rule-based fallback as last resort
 */

import { generateTextWithFallback, generateJSONWithFallback, isLLMConfigured } from './llm-service';
import { logger } from './logger';

export { generateTags, generateSummary };

interface GeneratedTag {
    name: string;
    type: string;
}

async function generateTags(title: string, abstract: string): Promise<string[]> {
    const prompt = `You are a research paper analyst. Analyze the following paper and extract 3-5 specific, relevant research topics or keywords.

Title: ${title}
Abstract: ${abstract || "No abstract available"}

Return ONLY a JSON array of strings.`;

    if (!isLLMConfigured()) {
        logger.debug('LLM not configured, using fallback tags');
        return generateFallbackTags(title, abstract);
    }

    try {
        const result = await generateJSONWithFallback<GeneratedTag[]>(prompt);
        return result
            .filter(t => t.name)
            .map(t => t.name.toLowerCase().replace(/\s+/g, '-'))
            .slice(0, 5);
    } catch (error) {
        logger.warn('LLM failed for tags, using fallback', { error });
        return generateFallbackTags(title, abstract);
    }
}

async function generateSummary(title: string, abstract: string): Promise<string> {
    const prompt = `You are a research analyst specializing in AI and Banking. Provide a concise (3-4 sentences) technical summary.

Title: ${title}
Abstract: ${abstract || "No abstract available"}

Summary:`;

    if (!isLLMConfigured()) {
        return `Summary for "${title}": This paper explores technical advancements and potential banking applications.`;
    }

    try {
        return await generateTextWithFallback(prompt);
    } catch (error) {
        logger.warn('LLM failed for summary, using fallback', { error });
        return `Summary for "${title}": This paper explores technical advancements in its field and their implications for modern banking systems, including risk management and compliance applications.`;
    }
}

function generateFallbackTags(title: string, abstract: string): string[] {
    const text = (title + ' ' + abstract).toLowerCase();
    const tags: string[] = [];

    if (text.includes('neural network') || text.includes('deep learning')) tags.push('Deep Learning');
    if (text.includes('transformer') || text.includes('attention')) tags.push('Transformers');
    if (text.includes('graph')) tags.push('Graph Analysis');
    if (text.includes('nlp') || text.includes('natural language')) tags.push('NLP');
    if (text.includes('computer vision') || text.includes('image')) tags.push('Computer Vision');
    if (text.includes('reinforcement learning')) tags.push('Reinforcement Learning');
    if (text.includes('fraud') || text.includes('detection')) tags.push('Fraud Detection');
    if (text.includes('risk') || text.includes('credit')) tags.push('Risk Management');
    if (text.includes('compliance') || text.includes('regulatory')) tags.push('Compliance');
    if (text.includes('llm') || text.includes('language model')) tags.push('LLM');

    return tags.slice(0, 5);
}
