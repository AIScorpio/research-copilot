import Groq from 'groq-sdk';

// LLM Provider Configuration
const PROVIDER = process.env.LLM_PROVIDER || 'groq'; // Default to Groq
const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

// Export functions explicitly
export { generateTags, generateSummary };

async function generateTags(title: string, abstract: string): Promise<string[]> {
    const prompt = `You are a research paper analyst. Analyze the following paper and extract 3-5 specific, relevant research topics or keywords that best describe this paper.

Title: ${title}

Abstract: ${abstract || "No abstract available"}

Instructions:
- Return ONLY a JSON array of strings
- Each tag should be a specific research topic, technology, or domain area
- Keep tags concise (2-4 words max)
- Focus on technical/academic terms, not generic words
- Example format: ["Graph Neural Networks", "Semi-Supervised Learning", "Node Classification"]

Tags:`;

    try {
        if (PROVIDER === 'groq' && GROQ_API_KEY) {
            return await generateWithGroq(prompt);
        } else {
            console.warn('[LLM] No valid provider configured, using fallback heuristics');
            return generateFallbackTags(title, abstract);
        }
    } catch (error) {
        console.error('[LLM] Error generating tags:', error);
        return generateFallbackTags(title, abstract);
    }
}

/**
 * Generate a technical summary of a paper using configured LLM
 */
async function generateSummary(title: string, abstract: string): Promise<string> {
    const prompt = `You are a research analyst specializing in AI and Banking. Analyze the following paper and provide a concise (3-4 sentences), highly technical summary. 
    
    Focus on:
    1. The core methodology or contribution
    2. Key technical findings
    3. Potential applications within the financial or banking sector.

    Title: ${title}
    Abstract: ${abstract || "No abstract available"}

    Summary:`;

    try {
        if (PROVIDER === 'groq' && GROQ_API_KEY) {
            const groq = new Groq({ apiKey: GROQ_API_KEY });
            const completion = await groq.chat.completions.create({
                messages: [{ role: 'user', content: prompt }],
                model: 'llama-3.3-70b-versatile',
                temperature: 0.3,
                max_tokens: 500,
            });
            return completion.choices[0]?.message?.content?.trim() || "Failed to generate summary.";
        } else {
            return `Summary for "${title}": This paper explores technical advancements in its field and their implications for modern systems, including potential banking applications. (Fallback Summary)`;
        }
    } catch (error) {
        console.error('[LLM] Error generating summary:', error);
        return "Failed to generate summary at this time.";
    }
}

async function generateWithGroq(prompt: string): Promise<string[]> {
    const groq = new Groq({ apiKey: GROQ_API_KEY });

    const completion = await groq.chat.completions.create({
        messages: [
            {
                role: 'user',
                content: prompt
            }
        ],
        model: 'llama-3.3-70b-versatile', // Fast and capable model
        temperature: 0.3,
        max_tokens: 200,
    });

    const text = completion.choices[0]?.message?.content?.trim() || '[]';
    console.log('[LLM/Groq] Response:', text);

    return parseTags(text);
}

function parseTags(text: string): string[] {
    try {
        // Try to parse as JSON array
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed)) {
            return parsed.filter(t => typeof t === 'string' && t.length > 0).slice(0, 5);
        }
    } catch (e) {
        // If JSON parse fails, try to extract tags from text
        const matches = text.match(/"([^"]+)"/g);
        if (matches) {
            return matches.map(m => m.replace(/"/g, '')).slice(0, 5);
        }
    }
    return [];
}

/**
 * Fallback heuristic tagging when no LLM is available
 */
function generateFallbackTags(title: string, abstract: string): string[] {
    const text = (title + ' ' + abstract).toLowerCase();
    const tags: string[] = [];

    // Simple keyword matching
    if (text.includes('neural network') || text.includes('deep learning')) tags.push('Deep Learning');
    if (text.includes('transformer') || text.includes('attention')) tags.push('Transformers');
    if (text.includes('graph')) tags.push('Graph Analysis');
    if (text.includes('nlp') || text.includes('natural language')) tags.push('Natural Language Processing');
    if (text.includes('computer vision') || text.includes('image')) tags.push('Computer Vision');
    if (text.includes('reinforcement learning')) tags.push('Reinforcement Learning');

    return tags.slice(0, 5);
}
