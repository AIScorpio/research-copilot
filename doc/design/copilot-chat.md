# Copilot Chat Design

**Status**: Implemented (P0, P1, P2 complete)
**Scope**: Full-corpus RAG chat with multi-LLM support, session management, SSE streaming, external API

---

## Architecture

### Core Approach: Full-Corpus Context (No Vector RAG)

For paper collections under ~500 papers, loading all paper metadata into the LLM context outperforms keyword-based retrieval:

| Mode | Content | Tokens (221 papers) |
|------|---------|---------------------|
| Full | title + abstract + tags + scores + assessment + URL + dates | ~116K |
| Compact | title + tags + scores + assessment + URL + dates (no abstract) | ~35K |

Auto-selection: models with >=256K context window receive Full mode; smaller models receive Compact mode.

### Two-Pass Deep Dive (Compact Mode)

When a user references specific papers (e.g., "tell me more about Paper 3"), the system:
1. Detects paper references via regex (English + Chinese)
2. Fetches full abstracts for referenced papers
3. Makes a second LLM call with enriched context
4. Returns the detailed response

### Session Management

| Operation | API |
|-----------|-----|
| Create | Auto-created on first message |
| List | `GET /api/chat/sessions` |
| Resume | `GET /api/chat/sessions/[id]` |
| Update title | `PATCH /api/chat/sessions/[id]` |
| Delete | `DELETE /api/chat/sessions/[id]` |

### External API (`/api/v1/chat`)

Stateless endpoint for third-party integration (haah.ing):
- Dual auth: API key (`x-api-key` header) or session cookie
- Rate limit: 10 requests/minute
- CORS-enabled
- Health check: `GET /api/v1/chat/health`

---

## LLM Provider Interface

Added `chat()` method to support multi-turn conversation:

```typescript
async chat(messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>): Promise<string>
```

Provider-specific handling:
- **OpenAI-compatible** (Groq, Gemini, ZhipuAI, Kimi, Alibaba, LM Studio): send messages array directly
- **Anthropic**: extract system message to top-level `system` parameter
- **Ollama**: concatenate messages into single prompt string

---

## System Prompt Design

The system prompt instructs the LLM to:
1. Cite every factual claim as `**[Title](url)**`
2. Start every answer with "Based on N papers in the repository"
3. Never fabricate titles, scores, or findings
4. Group papers by theme when returning 3+ papers
5. Append 2-3 suggested follow-up questions

---

## Key Decisions

1. **Per-request provider instantiation**: Chat creates its own provider instance per request, avoiding mutation of global collection pipeline state.
2. **No caching**: DB query + formatting = ~35ms, negligible vs 3-10s LLM latency.
3. **Sliding window**: Last 10 messages in LLM context; older messages persisted in DB.
4. **Sources extraction**: Pattern-match `[Title](url)` from LLM response, look up in DB for structured metadata.
