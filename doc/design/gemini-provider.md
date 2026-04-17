# Google Gemini Provider Design

**Status**: Implemented
**Scope**: Backend LLM provider integration

---

## Design Decision: OpenAI-Compatible Endpoint

Uses Google's official OpenAI-compatible endpoint:

```
https://generativelanguage.googleapis.com/v1beta/openai/chat/completions
```

### Why

1. Zero new dependencies — codebase already uses raw `fetch` with OpenAI format
2. Identical request/response format (`messages` array, `choices[0].message.content`)
3. Auth via `Authorization: Bearer {apiKey}` — same as other cloud providers
4. Streaming supported via `stream: true`
5. Full model access
6. Connection test via lightweight `GET /v1beta/openai/models` (no quota consumed)

### Tradeoff

Native `@google/genai` SDK provides advanced features (Live API, Caching, MCP). Not needed for paper collection tasks. Upgradable in future without breaking `LLMProviderInterface`.

---

## Integration Points

Provider added to:
- LLM type union and factory
- Model fetcher (filters to `gemini-*` and `gemma-*` models)
- Settings API (Zod enum, env key handling)
- `isLLMConfigured()` check (critical — collection pipeline gates on this)

---

## Testing

Unit tests cover:
- Constructor validation
- `generateText` with/without system prompt
- Error handling on non-200 response
- `testConnection` success/failure
- `isLLMConfigured` with only Gemini key set
