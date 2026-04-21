import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { LLMProviderFactory, getApiKeyFromEnv, LLMProvider } from '@/lib/llm-service';
import { loadPaperCorpus, buildSystemPrompt, extractSources, getContextMode, detectPaperReferences, buildSupplementaryContext } from '@/lib/rag';
import { withAuth } from '@/lib/security';

const ChatRequestSchema = z.object({
    messages: z.array(z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string(),
    })).min(1).max(50),
    sessionId: z.string().uuid().optional(),
    model: z.object({
        providerType: z.string(),
        externalId: z.string(),
    }).optional(),
});

export const maxDuration = 120;
const STREAM_TIMEOUT_MS = 300_000;

const SUGGESTIONS_REGEX = /\*{0,2}Suggested (?:questions|follow-ups?):\*{0,2}\s*\n([\s\S]*?)$/i;

function parseSuggestions(text: string): string[] {
    const match = text.match(SUGGESTIONS_REGEX);
    if (!match) return [];
    const content = match[1].trim();
    const lines = content.match(/\d+\.\s+(.+)/g);
    return (lines || []).map(s => s.replace(/^\d+\.\s+/, ''));
}

function sseEvent(eventId: number, type: string, data: object): Uint8Array {
    return new TextEncoder().encode(`id: ${eventId}\nevent: ${type}\ndata: ${JSON.stringify(data)}\n\n`);
}

interface ChatContext {
    targetSessionId: string;
    sessionModel: { providerType: string; externalId: string };
    lastMessage: { role: string; content: string };
    history: Array<{ role: string; content: string }>;
    messages: Array<{ role: string; content: string }>;
    provider: ReturnType<typeof LLMProviderFactory.create>;
    corpusInfo: Awaited<ReturnType<typeof loadPaperCorpus>>;
    chatMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
    mode: string;
}

async function resolveChatContext(
    user: any,
    parsed: z.infer<typeof ChatRequestSchema>
): Promise<ChatContext | NextResponse> {
    const { messages, sessionId, model: modelOverride } = parsed;
    const lastMessage = messages[messages.length - 1];
    const history = messages.slice(0, -1).slice(-10);

    let sessionModel = modelOverride;
    let targetSessionId = sessionId;

    if (!targetSessionId) {
        const paperCount = await prisma.paper.count({ where: { deletedAt: null } });
        const welcomeContent = `Hello! I'm your research intelligence assistant for banking/financial services AI research. Currently there are ${paperCount} papers in the repository. I can help you analyze trends, compare papers, identify gaps, and provide insights across risk management, compliance, fraud detection, credit assessment, and model governance.\n\nWhat specific research questions or topics would you like to explore today?`;

        const newSession = await prisma.chatSession.create({
            data: {
                userId: user.id,
                title: "New Chat",
                model: sessionModel ? JSON.stringify(sessionModel) : null,
                messages: {
                    create: {
                        role: 'assistant',
                        content: welcomeContent,
                    },
                },
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
        if (existing.userId !== user.id) {
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
        if (sessionModel && modelOverride) {
            await prisma.chatSession.update({
                where: { id: targetSessionId },
                data: { model: JSON.stringify(sessionModel) },
            });
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

    return {
        targetSessionId,
        sessionModel,
        lastMessage,
        history,
        messages,
        provider,
        corpusInfo,
        chatMessages,
        mode,
    };
}

async function handleBlockingChat(ctx: ChatContext) {
    const { targetSessionId, sessionModel, lastMessage, history, messages, provider, corpusInfo, chatMessages, mode } = ctx;

    logger.info(`[Chat] Processing request | session=${targetSessionId} | model=${sessionModel.externalId} | mode=${mode} | papers=${corpusInfo.paperCount}`);

    const answer = await provider.chat(chatMessages);

    const finalAnswer = answer;
    const sources = await extractSources(finalAnswer);

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
            content: finalAnswer,
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

    const suggestions = parseSuggestions(finalAnswer);

    return NextResponse.json({
        answer: finalAnswer,
        sources,
        suggestions,
        model: `${sessionModel.providerType}/${sessionModel.externalId}`,
        paperCount: corpusInfo.paperCount,
        sessionId: targetSessionId,
    });
}

async function handleStreamingChat(ctx: ChatContext) {
    const { targetSessionId, sessionModel, lastMessage, history, messages, provider, corpusInfo, chatMessages, mode } = ctx;

    logger.info(`[Chat] Streaming request | session=${targetSessionId} | model=${sessionModel.externalId} | mode=${mode} | papers=${corpusInfo.paperCount}`);

    const stream = new TransformStream();
    const writer = stream.writable.getWriter();

    (async () => {
        let eventId = 0;
        let fullAnswer = '';
        let firstPassAnswer = '';
        let timeoutTimer: ReturnType<typeof setTimeout> | undefined = undefined;
        let closed = false;

        const safeClose = async () => {
            if (!closed) {
                closed = true;
                await writer.close();
            }
        };

        const resetTimeout = () => {
            clearTimeout(timeoutTimer);
            timeoutTimer = setTimeout(async () => {
                await writer.write(sseEvent(eventId++, 'error', { message: 'Stream timeout', partial: fullAnswer }));
                await safeClose();
            }, STREAM_TIMEOUT_MS);
        };

        try {
            resetTimeout();

            for await (const chunk of provider.chatStream(chatMessages)) {
                if (chunk.type === 'token') {
                    fullAnswer += chunk.content;
                    resetTimeout();
                    await writer.write(sseEvent(eventId++, 'token', { content: chunk.content }));
                } else if (chunk.type === 'thinking') {
                    resetTimeout();
                    await writer.write(sseEvent(eventId++, 'thinking', { content: chunk.content }));
                } else if (chunk.type === 'error') {
                    await writer.write(sseEvent(eventId++, 'error', { message: chunk.content, partial: fullAnswer }));
                    clearTimeout(timeoutTimer);
                    return;
                } else if (chunk.type === 'done') {
                    break;
                }
            }

            firstPassAnswer = fullAnswer;

            clearTimeout(timeoutTimer);
            const isTruncated = fullAnswer.length < 50 && fullAnswer.length > 0;
            const sources = isTruncated ? [] : await extractSources(fullAnswer);
            const suggestions = isTruncated ? [] : parseSuggestions(fullAnswer);
            const cleanAnswer = fullAnswer.replace(SUGGESTIONS_REGEX, '').trim();

            if (isTruncated) {
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
                        content: cleanAnswer + '\n\n*[Response truncated — model hit token limit]*',
                        sources: null,
                    },
                });
                await prisma.chatSession.update({
                    where: { id: targetSessionId },
                    data: { lastMessageAt: new Date() },
                });
                await writer.write(sseEvent(eventId++, 'error', {
                    message: 'Response was truncated (model hit token limit). Try a shorter question or use a model with a larger context window.',
                    partial: fullAnswer,
                }));
            } else {
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
                        content: cleanAnswer,
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

                await writer.write(sseEvent(eventId++, 'final', {
                    answer: cleanAnswer,
                    sources,
                    suggestions,
                    model: `${sessionModel.providerType}/${sessionModel.externalId}`,
                    paperCount: corpusInfo.paperCount,
                    sessionId: targetSessionId,
                }));
            }
        } catch (err) {
            clearTimeout(timeoutTimer);
            const partial = fullAnswer || firstPassAnswer;
            await writer.write(sseEvent(eventId++, 'error', {
                message: err instanceof Error ? err.message : 'Unknown error',
                partial,
            }));
        } finally {
            clearTimeout(timeoutTimer);
            await safeClose();
        }
    })();

    return new NextResponse(stream.readable, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no',
        },
    });
}

export async function POST(request: NextRequest) {
    return withAuth(async (request: Request, user: any) => {
        const body = await request.json();
        const parsed = ChatRequestSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: { code: 'VALIDATION_ERROR', message: parsed.error.message } },
                { status: 400 }
            );
        }

        const ctx = await resolveChatContext(user, parsed.data);
        if (ctx instanceof NextResponse) return ctx;

        const acceptHeader = request.headers.get('accept') || '';
        const wantsStream = acceptHeader.includes('text/event-stream');

        if (wantsStream) {
            return handleStreamingChat(ctx);
        }
        return handleBlockingChat(ctx);
    })(request);
}
