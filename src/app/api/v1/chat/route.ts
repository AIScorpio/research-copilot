import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { LLMProviderFactory, getApiKeyFromEnv, LLMProvider } from '@/lib/llm-service';
import { loadPaperCorpus, buildSystemPrompt, extractSources, getContextMode } from '@/lib/rag';
import { withApiKeyOrSession, AuthIdentity } from '@/lib/api-auth';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const V1ChatRequestSchema = z.object({
    question: z.string().min(1).max(2000),
    messages: z.array(z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().max(5000),
    })).max(30).optional(),
    model: z.object({
        providerType: z.string(),
        externalId: z.string(),
    }).optional(),
});

async function getRateLimiter() {
    try {
        const redis = Redis.fromEnv();
        return new Ratelimit({
            redis,
            limiter: Ratelimit.slidingWindow(10, '1 m'),
            prefix: 'copilot:',
        });
    } catch {
        return null;
    }
}

async function POST(request: NextRequest) {
    return withApiKeyOrSession(async (request: NextRequest, identity: AuthIdentity) => {
        const limiter = await getRateLimiter();
        if (limiter) {
            try {
                const identifier = identity.type === 'api_key'
                    ? `apikey:${identity.name}`
                    : `session:${identity.userId}`;
                const { success } = await limiter.limit(identifier);
                if (!success) {
                    return new Response(
                        JSON.stringify({ error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests. Try again later.' } }),
                        { status: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': '60' } }
                    );
                }
            } catch {
                logger.warn('[V1Chat] Rate limiter unavailable, skipping rate limit');
            }
        }

        const body = await request.json();
        const parsed = V1ChatRequestSchema.safeParse(body);
        if (!parsed.success) {
            return new Response(
                JSON.stringify({ error: { code: 'VALIDATION_ERROR', message: parsed.error.message } }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
        }

        const { question, messages: history = [], model: modelOverride } = parsed.data;

        let sessionModel = modelOverride;
        if (!sessionModel) {
            return new Response(
                JSON.stringify({ error: { code: 'CONFIG_ERROR', message: 'Model selection required. Pass { providerType, externalId } in model field.' } }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
        }

        const apiKey = getApiKeyFromEnv(sessionModel.providerType);
        if (!apiKey) {
            return new Response(
                JSON.stringify({ error: { code: 'CONFIG_ERROR', message: `No API key configured for ${sessionModel.providerType}` } }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
        }

        const provider = LLMProviderFactory.create({
            provider: sessionModel.providerType as LLMProvider,
            apiKey,
            model: sessionModel.externalId,
        });

        const modelRecord = await prisma.lLMModelBase.findFirst({
            where: {
                externalId: sessionModel.externalId,
                provider: { type: sessionModel.providerType },
            },
        });
        const contextWindow = modelRecord?.contextWindow || 128000;
        const mode = getContextMode(contextWindow);
        const corpusInfo = await loadPaperCorpus(mode);
        const systemPrompt = buildSystemPrompt(corpusInfo);

        const recentHistory = history.slice(-10);
        const chatMessages = [
            { role: 'system' as const, content: systemPrompt },
            ...recentHistory.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
            { role: 'user' as const, content: question },
        ];

        logger.info(`[V1Chat] Processing | source=${identity.type} | model=${sessionModel.externalId} | mode=${mode} | papers=${corpusInfo.paperCount}`);

        const answer = await provider.chat(chatMessages);
        const sources = await extractSources(answer);

        const suggestionMatch = answer.match(/\*\*Suggested questions:\*\*\n([\s\S]*?)(?:\n---|$)/);
        let suggestions: string[] = [];
        if (suggestionMatch) {
            const suggestionLines = suggestionMatch[1].match(/\d+\.\s+(.+)/g);
            suggestions = (suggestionLines || []).map(s => s.replace(/^\d+\.\s+/, ''));
        }

        return new Response(
            JSON.stringify({
                answer,
                sources,
                suggestions,
                model: `${sessionModel.providerType}/${sessionModel.externalId}`,
                paperCount: corpusInfo.paperCount,
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
    })(request);
}

export { POST };
