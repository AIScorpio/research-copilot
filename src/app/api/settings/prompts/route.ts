import { NextResponse } from 'next/server';
import { writeFile, readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { logger } from '@/lib/logger';
import type { PromptTemplates } from '@/types/prompts';

const PROMPTS_PATH = join(process.cwd(), 'config', 'prompts.json');

export async function POST(request: Request) {
    try {
        const prompts: PromptTemplates = await request.json();
        
        // Validate required fields - all should be strings
        const requiredFields = ['queryOptimization', 'contentAssessment', 'summaryGeneration', 'tagSuggestion', 'digestGeneration'];
        for (const field of requiredFields) {
            if (!prompts[field as keyof PromptTemplates] || typeof prompts[field as keyof PromptTemplates] !== 'string') {
                return NextResponse.json(
                    { success: false, message: `Missing or invalid field: ${field}` },
                    { status: 400 }
                );
            }
        }
        
        // Save prompts to config/prompts.json
        await writeFile(PROMPTS_PATH, JSON.stringify(prompts, null, 2), 'utf-8');
        
        return NextResponse.json({ 
            success: true, 
            message: 'Prompt templates saved successfully' 
        });
    } catch (error) {
        logger.error('Failed to save prompts:', { error: error instanceof Error ? error.message : String(error) });
        return NextResponse.json(
            { success: false, message: 'Failed to save prompt templates' },
            { status: 500 }
        );
    }
}

export async function GET() {
    try {
        if (!existsSync(PROMPTS_PATH)) {
            return NextResponse.json(
                { success: false, message: 'Prompts config file not found' },
                { status: 500 }
            );
        }
        
        const data = await readFile(PROMPTS_PATH, 'utf-8');
        const prompts = JSON.parse(data);
        
        return NextResponse.json({ success: true, prompts });
    } catch (error) {
        logger.error('Failed to load prompts:', { error: error instanceof Error ? error.message : String(error) });
        return NextResponse.json(
            { success: false, message: 'Failed to load prompt templates' },
            { status: 500 }
        );
    }
}
