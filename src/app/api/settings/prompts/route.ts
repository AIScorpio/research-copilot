import { NextResponse } from 'next/server';
import { writeFile } from 'fs/promises';
import { join } from 'path';

export async function POST(request: Request) {
    try {
        const prompts = await request.json();
        
        // Validate required fields
        const requiredFields = ['queryOptimization', 'contentAssessment', 'summaryGeneration', 'tagSuggestion'];
        for (const field of requiredFields) {
            if (!prompts[field] || typeof prompts[field] !== 'string') {
                return NextResponse.json(
                    { success: false, message: `Missing or invalid field: ${field}` },
                    { status: 400 }
                );
            }
        }
        
        // Save prompts to a JSON file
        const promptsPath = join(process.cwd(), 'config', 'prompts.json');
        await writeFile(promptsPath, JSON.stringify(prompts, null, 2), 'utf-8');
        
        return NextResponse.json({ 
            success: true, 
            message: 'Prompt templates saved successfully' 
        });
    } catch (error) {
        console.error('Failed to save prompts:', error);
        return NextResponse.json(
            { success: false, message: 'Failed to save prompt templates' },
            { status: 500 }
        );
    }
}

export async function GET() {
    try {
        const { readFile } = await import('fs/promises');
        const { existsSync } = await import('fs');
        const promptsPath = join(process.cwd(), 'config', 'prompts.json');
        
        if (!existsSync(promptsPath)) {
            // Return default prompts if file doesn't exist
            const { 
                DEFAULT_QUERY_OPTIMIZATION_PROMPT,
                DEFAULT_CONTENT_ASSESSMENT_PROMPT,
                DEFAULT_SUMMARY_GENERATION_PROMPT,
                DEFAULT_TAG_SUGGESTION_PROMPT
            } = await import('@/lib/prompt-templates');
            
            return NextResponse.json({
                success: true,
                prompts: {
                    queryOptimization: DEFAULT_QUERY_OPTIMIZATION_PROMPT,
                    contentAssessment: DEFAULT_CONTENT_ASSESSMENT_PROMPT,
                    summaryGeneration: DEFAULT_SUMMARY_GENERATION_PROMPT,
                    tagSuggestion: DEFAULT_TAG_SUGGESTION_PROMPT
                }
            });
        }
        
        const data = await readFile(promptsPath, 'utf-8');
        const prompts = JSON.parse(data);
        
        return NextResponse.json({ success: true, prompts });
    } catch (error) {
        console.error('Failed to load prompts:', error);
        return NextResponse.json(
            { success: false, message: 'Failed to load prompt templates' },
            { status: 500 }
        );
    }
}
