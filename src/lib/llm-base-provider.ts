import { logger } from './logger';
import { LLMConfig, LLMProviderInterface } from './llm-types';

export abstract class BaseProvider implements LLMProviderInterface {
    protected config: LLMConfig;

    constructor(config: LLMConfig) {
        this.config = {
            temperature: 0.1,
            maxTokens: 8192,
            ...config
        };
    }

    abstract generateText(prompt: string, systemPrompt?: string): Promise<string>;
    abstract testConnection(): Promise<boolean>;
    abstract getProviderName(): string;

    async chat(messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>): Promise<string> {
        throw new Error('chat() not implemented for this provider');
    }

    async generateJSON<T>(prompt: string, systemPrompt?: string): Promise<T> {
        const text = await this.generateText(prompt, systemPrompt);
        return this.parseJSON<T>(text);
    }

    protected parseJSON<T>(text: string): T {
        try {
            const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
            let cleanText = jsonMatch ? jsonMatch[1].trim() : text.trim();
            
            try {
                return JSON.parse(cleanText) as T;
            } catch (e) {
                // Continue to recovery attempts
            }
            
            const extractBalancedArray = (txt: string): string | null => {
                const startIndex = txt.indexOf('[');
                if (startIndex === -1) return null;
                
                let depth = 0;
                let inString = false;
                let escape = false;
                
                for (let i = startIndex; i < txt.length; i++) {
                    const char = txt[i];
                    
                    if (escape) {
                        escape = false;
                        continue;
                    }
                    
                    if (char === '\\') {
                        escape = true;
                        continue;
                    }
                    
                    if (char === '"') {
                        inString = !inString;
                        continue;
                    }
                    
                    if (!inString) {
                        if (char === '[' || char === '{') {
                            depth++;
                        } else if (char === ']' || char === '}') {
                            depth--;
                            if (depth === 0 && char === ']') {
                                return txt.substring(startIndex, i + 1);
                            }
                        }
                    }
                }
                
                return null;
            };
            
            const balancedArray = extractBalancedArray(cleanText);
            if (balancedArray) {
                try {
                    return JSON.parse(balancedArray) as T;
                } catch (e) {
                    // Continue to legacy attempts
                }
            }
            
            const extractBalancedObject = (txt: string): string | null => {
                const startIndex = txt.indexOf('{');
                if (startIndex === -1) return null;
                
                let depth = 0;
                let inString = false;
                let escape = false;
                
                for (let i = startIndex; i < txt.length; i++) {
                    const char = txt[i];
                    
                    if (escape) {
                        escape = false;
                        continue;
                    }
                    
                    if (char === '\\') {
                        escape = true;
                        continue;
                    }
                    
                    if (char === '"') {
                        inString = !inString;
                        continue;
                    }
                    
                    if (!inString) {
                        if (char === '{' || char === '[') {
                            depth++;
                        } else if (char === '}' || char === ']') {
                            depth--;
                            if (depth === 0 && char === '}') {
                                return txt.substring(startIndex, i + 1);
                            }
                        }
                    }
                }
                
                return null;
            };
            
            const balancedObject = extractBalancedObject(cleanText);
            if (balancedObject) {
                try {
                    return JSON.parse(balancedObject) as T;
                } catch (e) {
                    // Continue
                }
            }
            
            const arrayMatch = cleanText.match(/\[[\s\S]*\]/);
            const objectMatch = cleanText.match(/\{[\s\S]*\}/);
            
            if (arrayMatch) {
                try {
                    return JSON.parse(arrayMatch[0]) as T;
                } catch (e) {
                    // Continue
                }
            }
            
            if (objectMatch) {
                try {
                    return JSON.parse(objectMatch[0]) as T;
                } catch (e) {
                    // Continue
                }
            }
            
            if (cleanText.includes('[') && !cleanText.trim().endsWith(']')) {
                let fixed = cleanText;
                const openBrackets = (fixed.match(/\[/g) || []).length;
                const closeBrackets = (fixed.match(/\]/g) || []).length;
                const openBraces = (fixed.match(/\{/g) || []).length;
                const closeBraces = (fixed.match(/\}/g) || []).length;
                
                for (let i = 0; i < openBraces - closeBraces; i++) fixed += '}';
                for (let i = 0; i < openBrackets - closeBrackets; i++) fixed += ']';
                
                try {
                    return JSON.parse(fixed) as T;
                } catch (e) {
                    // Continue
                }
                
                const lastComma = fixed.lastIndexOf(',');
                if (lastComma > 0) {
                    fixed = fixed.substring(0, lastComma);
                    for (let i = 0; i < (fixed.match(/\{/g) || []).length - (fixed.match(/\}/g) || []).length; i++) fixed += '}';
                    fixed += ']';
                    try {
                        return JSON.parse(fixed) as T;
                    } catch (e) {
                        // Give up
                    }
                }
            }
            
            logger.error('LLM JSON parse error after all recovery attempts', { error: 'Unparseable', text: text.substring(0, 300) });
            throw new Error('Failed to parse LLM response as JSON');
        } catch (error) {
            logger.error('LLM JSON parse error', { error, text: text.substring(0, 200) });
            throw new Error('Failed to parse LLM response as JSON');
        }
    }
}
