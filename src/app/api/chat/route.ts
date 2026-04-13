import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { LLMProviderFactory, getApiKeyFromEnv, LLMProvider } from '@/lib/llm-service';
import { loadPaperCorpus, buildSystemPrompt, extractSources, getContextMode } from '@/lib/rag';
import { withAuth } from '@/lib/security';

const ChatRequestSchema = z.object({
    messages: z.array(z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().max(5000),
    })).min(1).max(50),
    sessionId: z.string().uuid().optional(),
    model: z.object({
        providerType: z.string(),
        externalId: z.string(),
    }).optional(),
});

export async function POST(request: NextRequest) {
    return withAuth(async (request: NextRequest, user: any) => {
        const body = await request.json();
        const parsed = ChatRequestSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: { code: 'VALIDATION_ERROR', message: parsed.error.message } },
                { status: 400 }
            );
        }

        const { messages, sessionId, model: modelOverride } = parsed.data;
        const lastMessage = messages[messages.length - 1];
        const history = messages.slice(0, -1).slice(-10);

        let sessionModel = modelOverride;
        let targetSessionId = sessionId;

        if (!targetSessionId) {
            const newSession = await prisma.chatSession.create({
                data: {
                    userId: user.id,
                    title: lastMessage.content.substring(0, 40),
                    model: sessionModel ? JSON.stringify(sessionModel) : null,
                },
            });
            targetSessionId = newSession.id;
        } else {
            const existing = await prisma.chatSession.findUnique({
                where: { id: targetSessionId },
            });
            if (!existing) {
                return NextResponse.json(
                    { error: { code: 'NOT_FOUND', message: 'Session not found' } },
                    { status: 404 }
                );
            }
            if (existing.model) {
                try {
                    sessionModel = sessionModel || JSON.parse(existing.model);
                } catch {
                    sessionModel = undefined;
                }
            }
        }

        if (!sessionModel) {
            return NextResponse.json(
                { error: { code: 'CONFIG_ERROR', message: 'No model configured for this session' } },
                { status: 400 }
            );
        }

        const localProviders = ['ollama', 'lmstudio'];
        const isLocal = localProviders.includes(sessionModel.providerType);

        if (!isLocal) {
            const apiKey = getApiKeyFromEnv(sessionModel.providerType);
            if (!apiKey) {
                return NextResponse.json(
                    { error: { code: 'CONFIG_ERROR', message: `No API key for ${sessionModel.providerType}` } },
                    { status: 400 }
                );
            }
        }

        const modelRecord = await prisma.lLMModelBase.findFirst({
            where: {
                externalId: sessionModel.externalId,
                provider: { type: sessionModel.providerType },
            },
        });
        const contextWindow = modelRecord?.contextWindow || 128000;

        const userModelConfig = await prisma.userLLMModel.findFirst({
            where: {
                modelId: modelRecord?.id,
                isDefault: true,
            },
        });

        const providerConfig: any = {
            provider: sessionModel.providerType as LLMProvider,
            apiKey: getApiKeyFromEnv(sessionModel.providerType),
            model: sessionModel.externalId,
        };
        if (userModelConfig?.maxTokens) {
            providerConfig.maxTokens = userModelConfig.maxTokens;
        } else {
            providerConfig.maxTokens = contextWindow > 0 ? Math.floor(contextWindow * 0.25) : 8192;
        }

        const provider = LLMProviderFactory.create(providerConfig);

        const mode = getContextMode(contextWindow);
        const corpusInfo = await loadPaperCorpus(mode);
        const systemPrompt = buildSystemPrompt(corpusInfo);

        const chatMessages = [
            { role: 'system' as const, content: systemPrompt },
            ...history.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
            { role: 'user' as const, content: lastMessage.content },
        ];

        logger.info(`[Chat] Processing request | session=${targetSessionId} | model=${sessionModel.externalId} | mode=${mode} | papers=${corpusInfo.paperCount}`);

        const answer = await provider.chat(chatMessages);

        const sources = await extractSources(answer);

        await prisma.chatMessageRecord.create({
            data: {
                sessionId: targetSessionId,
                role: 'user',
                content: lastMessage.content,
            },
        });

        await prisma.chatMessageRecord.create({
            data: {
                sessionId: targetSessionId,
                role: 'assistant',
                content: answer,
                sources: sources.length > 0 ? JSON.stringify(sources) : null,
            },
        });

        await prisma.chatSession.update({
            where: { id: targetSessionId },
            data: {
                lastMessageAt: new Date(),
                title: messages.length === 1 ? lastMessage.content.substring(0, 40) : undefined,
            },
        });

        const suggestionMatch = answer.match(/\*\*Suggested questions:\*\*\n([\s\S]*?)(?:\n---|$)/);
        let suggestions: string[] = [];
        if (suggestionMatch) {
            const suggestionLines = suggestionMatch[1].match(/\d+\.\s+(.+)/g);
            suggestions = (suggestionLines || []).map(s => s.replace(/^\d+\.\s+/, ''));
        }

        return NextResponse.json({
            answer,
            sources,
            suggestions,
            model: `${sessionModel.providerType}/${sessionModel.externalId}`,
            paperCount: corpusInfo.paperCount,
            sessionId: targetSessionId,
        });
    })(request);
}
