# SSE Streaming Design

**Status**: Implemented (P2 complete)
**Parent**: Copilot Chat Design
**Scope**: Server-sent events for progressive chat response rendering

---

## Problem

Blocking JSON responses wait for complete LLM generation (15-30s for large corpus). Users see only a static spinner with no feedback.

## Solution

`POST /api/chat` branches on `Accept` header:
- `Accept: text/event-stream` → SSE streaming
- Otherwise → blocking JSON (backward compatible)

## SSE Event Protocol

```
id: 1
event: token
data: {"content": "Based"}

id: 2
event: token
data: {"content": " on 221"}

id: 3
event: deep_dive_start
data: {"papers": [3, 7]}

id: 4
event: final
data: {"answer": "...", "sources": [...], "suggestions": [...], "model": "...", "paperCount": 221}
```

| Event | When | Fields |
|-------|------|--------|
| `token` | Each LLM token | `content` |
| `deep_dive_start` | Before second pass | `papers` (indices) |
| `final` | After complete | Full response metadata |
| `error` | On failure | `message`, `partial` |

## Provider Streaming

Added `chatStream()` to LLM provider interface returning `AsyncGenerator<StreamChunk>`:

- **6 OpenAI-compatible providers** share unified SSE parser
- **Groq** uses SDK streaming API
- **Anthropic** uses custom SSE format (`event: content_block_delta`)
- **Ollama** uses NDJSON format
- **Baidu** uses custom SSE format

## Frontend Consumer

- `ReadableStream` reader processes events progressively
- Last message content updates in real-time as tokens arrive
- `AbortController` allows user to stop generation mid-stream
- Sources/suggestions rendered only after `final` event
- Blinking cursor indicator during streaming

## Timeout

120-second timeout, reset on each received token. Error event sent with partial content preserved.

## Key Decisions

1. **AsyncGenerator over ReadableStream**: Easier to test and type; route handler converts to HTTP stream
2. **Content continuity**: `final` event attaches metadata only — never replaces accumulated streaming content
3. **Backward compatibility**: Blocking JSON path unchanged; existing clients unaffected
