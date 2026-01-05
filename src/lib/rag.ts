import { prisma } from '@/lib/db';
import Groq from 'groq-sdk';

export interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
}

const GROQ_API_KEY = process.env.GROQ_API_KEY || '';

export async function retrieveContext(query: string) {
    // Simple keyword search for RAG context
    // In a real production app, this would use vector embeddings (pgvector/pinecone)
    const keywords = query.toLowerCase().split(" ").filter(k => k.length > 3);

    if (keywords.length === 0) return [];

    const papers = await prisma.paper.findMany({
        where: {
            OR: keywords.map(k => ({
                OR: [
                    { title: { contains: k, mode: 'insensitive' } },
                    { abstract: { contains: k, mode: 'insensitive' } }
                ]
            }))
        },
        include: {
            tags: {
                include: { tag: true }
            }
        },
        take: 5 // Limit context window
    });

    return papers;
}

export async function generateResponse(query: string, contextPapers: any[]): Promise<string> {
    if (contextPapers.length === 0) {
        return "I couldn't find any papers in your repository matching that query. Try running a collection for relevant topics first, or ask me something broader.";
    }

    // Build context from papers
    const paperContext = contextPapers.map((p: any, idx: number) => {
        const tags = p.tags?.map((pt: any) => pt.tag.name).join(', ') || 'No tags';
        return `[Paper ${idx + 1}]
Title: ${p.title}
Tags: ${tags}
Abstract: ${p.abstract || 'No abstract available'}
Source: ${p.source}
Publication Date: ${new Date(p.publicationDate).toLocaleDateString()}
---`;
    }).join('\n\n');

    // Use LLM if API key available, otherwise use fallback
    if (GROQ_API_KEY) {
        try {
            const groq = new Groq({ apiKey: GROQ_API_KEY });

            const completion = await groq.chat.completions.create({
                messages: [
                    {
                        role: 'system',
                        content: `You are a research assistant helping analyze a collection of academic papers. Answer questions based ONLY on the provided paper context. Be specific, cite paper titles, and provide detailed explanations. If asked for examples or deep dives, quote relevant sections from abstracts.`
                    },
                    {
                        role: 'user',
                        content: `Context (Papers in Repository):
${paperContext}

User Question: ${query}

Please provide a detailed, specific answer based on these papers. If asked for examples, cite specific papers and their content.`
                    }
                ],
                model: 'llama-3.3-70b-versatile',
                temperature: 0.3,
                max_tokens: 1000,
            });

            return completion.choices[0]?.message?.content || 'Unable to generate response';
        } catch (error) {
            console.error('[RAG] Groq error:', error);
            return generateFallbackResponse(query, contextPapers);
        }
    } else {
        return generateFallbackResponse(query, contextPapers);
    }
}

function generateFallbackResponse(query: string, contextPapers: any[]): string {
    const titles = contextPapers.map((p: any) => `"${p.title}"`).join(', ');
    const lowerQuery = query.toLowerCase();

    if (lowerQuery.includes('summary') || lowerQuery.includes('summarize')) {
        return `**Summary of Found Papers:**\n\n${contextPapers.slice(0, 3).map((p: any, i: number) =>
            `${i + 1}. **${p.title}**\n   ${p.abstract?.substring(0, 200)}...\n`
        ).join('\n')}`;
    }

    return `I found ${contextPapers.length} relevant papers: ${titles}.\n\n**Note:** For detailed analysis, please add a Groq API key to .env (GROQ_API_KEY). Currently using basic fallback mode.`;
}
