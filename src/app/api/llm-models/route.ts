import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { handleError } from '@/lib/error-handler';
import { logger } from '@/lib/logger';
import fs from 'fs';
import path from 'path';

interface ModelInfo {
    id: string;
    name: string;
    provider: string;
}

interface TestResult {
    model: string;
    provider: string;
    tests: {
        query?: { passed: boolean; duration: number; error: string | null };
        assessment?: { passed: boolean; duration: number; error: string | null };
        tags?: { passed: boolean; duration: number; error: string | null };
        summary?: { passed: boolean; duration: number; error: string | null };
    };
}

async function fetchGroqModels(): Promise<ModelInfo[]> {
    try {
        // API keys from process.env ONLY (design principle: never from database)
        const groqApiKey = process.env.GROQ_API_KEY;

        if (!groqApiKey) {
            logger.warn('[LLM-Models] GROQ_API_KEY not configured in .env');
            return [];
        }

        const response = await fetch('https://api.groq.com/openai/v1/models', {
            headers: { 
                'Authorization': `Bearer ${groqApiKey}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            logger.error('[LLM-Models] Groq API error', { status: response.status });
            return [];
        }
        
        const data = await response.json();
        const models = (data.data || []).map((m: { id: string }) => ({
            id: m.id,
            name: m.id.split('/').pop() || m.id,
            provider: 'Groq'
        }));
        
        logger.info(`[LLM-Models] Fetched ${models.length} Groq models`);
        return models;
    } catch (error) {
        logger.error('[LLM-Models] Failed to fetch Groq models', { error });
        return [];
    }
}

async function fetchOllamaModels(): Promise<ModelInfo[]> {
    try {
        const ollamaConfig = await prisma.userLLMConfig.findFirst({
            where: { 
                provider: { type: 'ollama' }
            },
            include: { provider: true }
        });
        
        if (!ollamaConfig) {
            logger.warn('[LLM-Models] No Ollama config found');
            return [];
        }

        const baseUrl = ollamaConfig.provider?.baseUrl || 'http://localhost:11434';
        const response = await fetch(`${baseUrl}/api/tags`);
        
        if (!response.ok) {
            logger.error('[LLM-Models] Ollama API error', { status: response.status });
            return [];
        }
        
        const data = await response.json();
        const models = (data.models || []).map((m: { name: string }) => ({
            id: m.name,
            name: m.name,
            provider: 'Ollama'
        }));
        
        logger.info(`[LLM-Models] Fetched ${models.length} Ollama models`);
        return models;
    } catch (error) {
        logger.error('[LLM-Models] Failed to fetch Ollama models', { error });
        return [];
    }
}

async function fetchZhipuModels(): Promise<ModelInfo[]> {
    try {
        // API keys from process.env ONLY (design principle: never from database)
        const apiKey = process.env.ZHIPUAI_API_KEY;

        if (!apiKey) {
            logger.warn('[LLM-Models] ZHIPUAI_API_KEY not configured in .env');
            return [];
        }

        const response = await fetch('https://open.bigmodel.cn/api/paas/v4/models', {
            headers: { 'Authorization': `Bearer ${apiKey}` }
        });
        
        if (!response.ok) {
            logger.error('[LLM-Models] ZhipuAI API error', { status: response.status });
            return [];
        }
        
        const data = await response.json();
        const models = (data.data || []).map((m: { id: string }) => ({
            id: m.id,
            name: m.id,
            provider: 'ZhipuAI'
        }));
        
        logger.info(`[LLM-Models] Fetched ${models.length} ZhipuAI models`);
        return models;
    } catch (error) {
        logger.error('[LLM-Models] Failed to fetch ZhipuAI models', { error });
        return [];
    }
}

function loadLastTestResults(): { timestamp: string; results: TestResult[] } | null {
    try {
        const logPath = path.join(process.cwd(), 'logs', 'llm-model-test-latest.log');
        if (fs.existsSync(logPath)) {
            const content = fs.readFileSync(logPath, 'utf-8');
            return JSON.parse(content);
        }
    } catch (error) {
        console.error('Failed to load last test results:', error);
    }
    return null;
}

export async function GET() {
    try {
        const [groqModels, ollamaModels, zhipuModels] = await Promise.all([
            fetchGroqModels(),
            fetchOllamaModels(),
            fetchZhipuModels()
        ]);

        const models = [...groqModels, ...ollamaModels, ...zhipuModels];
        
        const lastResults = loadLastTestResults();

        return NextResponse.json({
            models,
            lastRun: lastResults?.timestamp || null,
            results: lastResults?.results || []
        });
    } catch (error) {
        const handled = handleError(error);
        return NextResponse.json({ models: [], error: handled.error }, { status: handled.statusCode });
    }
}
