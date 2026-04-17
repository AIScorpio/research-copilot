# Development Lessons

## Project Overview

InsightFlow is an automated research pipeline for banking/financial services AI research. It collects, filters, tags, and analyzes papers from academic sources using LLM providers.

## Critical: Schema Management

`npm run dev` runs a database switch script that overwrites the active schema file with a provider-specific template (SQLite or PostgreSQL).

- **Always edit the template files**, never the active schema directly
- After editing, regenerate and push the schema
- Verify new models are accessible via the Prisma client

## Critical: Build Tooling & Large Files

Turbopack silently truncates large files (>1500 lines). If you see `undefined` at runtime for exports:

1. Split the file into smaller modules (<300 lines each)
2. Use a barrel file to re-export everything (preserving import paths)
3. Clear build cache and restart dev server after splitting

## LLM Provider System

### File Structure (Modular)

```
src/lib/
  llm-service.ts          # Barrel re-export
  llm-types.ts            # Types, constants, interface
  llm-base-provider.ts    # BaseProvider abstract class
  llm-provider-factory.ts # Factory.create()
  llm-service-core.ts     # Global state, init, fallback
  llm-providers/          # Individual provider classes
```

### Adding a New Provider

1. Create provider class file
2. Add case in factory
3. Add to type union
4. Add default model
5. Add env key handler
6. Add model fetcher case
7. Add to schema enum
8. Add to settings API validation

### Local Providers

- No API key required
- Skip API key validation in routes
- Models loaded dynamically via dedicated endpoints

### Token Limits

- BaseProvider default: 8192 tokens
- Chat routes read from DB or calculate as `contextWindow * 0.25`
- Never hardcode token limits in route handlers

## Environment Variables

- API keys stored per-provider
- Local providers: no key needed
- Never hardcode API keys or config values
- Never modify env files without explicit permission

## Testing

- Framework: Jest
- Test files: `__tests__/`
- Prisma test DB: separate from dev DB

## Key Architecture Patterns

| Route | Auth | Purpose |
|-------|------|---------|
| `/api/chat` | Session | Copilot chat (web UI) |
| `/api/v1/chat` | API key or session | Copilot chat (external) |
| `/api/v1/chat/health` | None | Public health check |

## Copilot Chat Architecture

- **RAG**: Full corpus loaded into system prompt (compact mode ~40K tokens for 221 papers)
- **Context mode**: Auto-selected based on model's `contextWindow` from DB
- **Sources**: Extracted from LLM response via pattern matching
- **Suggestions**: System prompt instructs LLM to append 2-3 follow-up questions
- **Session persistence**: DB via `ChatSession` + `ChatMessageRecord` tables

## Known Limitations

- Thinking-mode models may break structured JSON output due to thinking content in response
- Free tier TPM limits may be too low for full corpus chat
- Database switch script copies template on every dev start — direct schema edits are lost
