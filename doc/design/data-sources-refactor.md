# Data Sources Refactor Design

**Status**: Partially implemented
**Scope**: Unified source framework for academic, industry, regulatory, and social sources

---

## Current State

- **Academic sources** (5): ArXiv, Semantic Scholar, SSRN, IEEE, ACM — functional
- **Banking news** (4): 0/4 working (Cloudflare blocking)
- **Regulatory feeds** (5): 1/5 working

## Goals

1. **Unified framework**: All sources share common interface (collect, parse, assess, store)
2. **Config-driven**: `source-types.json` as single source of truth
3. **Extensible**: User-defined custom sources with configurable collectors
4. **Health monitoring**: Auto-disable failing sources after repeated failures

## Source Types

| Type | Examples | Status |
|------|----------|--------|
| Academic | ArXiv, Semantic Scholar, SSRN, IEEE, ACM | Working |
| Industry | News sites, consulting reports | Not implemented |
| Regulatory | BIS, ECB, Federal Reserve | Partial (1/5) |
| Social | Twitter/X, Reddit, LinkedIn | Not implemented |
| Internal | Research reports, user uploads | Not implemented |

## Schema

```
Paper.sourceType → inferred from Source.type
Tag.category → ai-technology | business-area | risk-category | regulatory | methodology
```

## Key Decisions

- **Source and category separation**: `sourceType` tracks provenance; `category` tracks subject matter
- **Backward compatibility**: Historical data preserved; new fields additive only
- **Graceful degradation**: Failing sources auto-disabled without breaking collection pipeline
