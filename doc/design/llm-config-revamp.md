# LLM Configuration System Revamp

**Status**: Design complete, partially implemented
**Priority**: P0
**Impact**: All LLM-dependent features

---

## Problem Statement

The original LLM configuration system had critical reliability issues:
- Wrong models used despite user selection
- Race conditions during model switching
- Silent fallbacks to hardcoded defaults
- Unpredictable behavior in serverless environments

---

## Design Principles

1. **No Default Models**: Remove `DEFAULT_MODELS` constant. The app does not assume any provider or model exists unless explicitly configured.
2. **User-Defined Sequence**: Fallback follows the order the user configured providers. Inactive providers are skipped.
3. **Fail Hard on No Config**: If no LLM is configured, the app stops and directs the user to Settings.
4. **Fail Hard on All Exhausted**: If all configured providers fail, the app stops with a clear error including all failure reasons.
5. **Immediate Effect**: Model selection takes effect on the next request after reinitialize.
6. **Deterministic**: Same configuration → same behavior. No hidden fallbacks.

---

## Key Changes

### 1. Remove DEFAULT_MODELS Entirely

No model should be used without user configuration. Provider constructors throw if `config.model` is undefined.

### 2. Remove Redundant Reinitialize

Only `/api/llm-init?force=true` triggers reinitialize — single source of truth. PATCH handler updates DB only.

### 3. Reinitialize Deduplication

```
isReinitializing flag + reinitializePromise
→ concurrent calls wait for the same promise
→ atomic swap of global provider array
```

### 4. User-Ordered Fallback

```
User configured: Groq (active) → Ollama (inactive) → ZhipuAI (active)
Runtime: Groq (try) → skip Ollama → ZhipuAI (try) → throw if all fail
```

### 5. Fail Fast on No Configuration

`ensureLLMInitialized()` and `getLLMProvider()` throw with clear instructions: "Please go to Settings → LLM Providers to set up and configure a provider and model."

---

## Migration Path

| Phase | Changes |
|-------|---------|
| Phase 1 | Remove defaults, remove redundant reinitialize, add fail-fast errors |
| Phase 2 | Add reinitialize deduplication, implement user-ordered fallback |
| Phase 3 | UX polish: loading states, UI banner when no provider configured |

---

## Future Considerations

- **Stateless design**: Load config on each request (eliminates all race conditions, +1 DB query/request)
- **Circuit breaker**: Temporarily deactivate providers with high failure rates
