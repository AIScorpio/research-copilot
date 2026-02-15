# LLM Collection System Refactor - Task List
# Created: 2026-02-15
# Last Updated: 2026-02-15
# Status: Phase 2 ROLLED BACK - Simplified Approach

## DECISION: Rollback Phase 2 Per-DataSource Optimization

**Reason:** Phase 2 (per-datasource query optimization) added too much complexity without proportional benefit.

**What was tried:**
- Per-datasource query optimization (ArXiv with cat: filters, Semantic Scholar with venue filters)
- Data source connectivity testing with caching
- Complex source-specific prompt templates

**Why it failed:**
- ArXiv 429 rate limiting with complex queries
- Code became hard to maintain
- No significant improvement in paper quality
- Over-engineering for current needs

**What was kept:**
- ✅ Unified RELAXED query format for ALL data sources
- ✅ HTTPS ArXiv API (security fix)
- ✅ LLM fallback mechanism (Groq → Ollama)
- ✅ Global LLM initialization system
- ✅ Query strictness selector (Relaxed/Balanced/Strict)

---

## Phase 1: Fix Relevance Scoring Logic [COMPLETED ✅]
### Tasks:
- [x] 1.1 Update ContentRelevanceResult interface - make dimensionScores required
- [x] 1.2 Modify content-filter.ts prompt - only return dimensionScores (1-10 range)
- [x] 1.3 Update collection-service.ts - calculate total from dimensions only
- [x] 1.4 Change filter threshold from 60 to 5 (1-10 scale)
- [x] 1.5 Update database schema if needed (score ranges) - NOT NEEDED (REAL type)
- [x] 1.6 Test with sample papers - verify scoring consistency ✅ PASSED
- [x] 1.7 Verify frontend displays correct scores ✅ PASSED

## Phase 1.5: Fix Query Optimization [COMPLETED ✅]
### Tasks:
- [x] 1.5.1 Auto Collection - Relaxed Query + LLM Filter
  - [x] Unified relaxed format for all sources (OR-based terms)
  - [x] Remove database-specific syntax (no 'cat:', no 'all:')
- [x] 1.5.2 Manual Collection - User Selectable Strictness
  - [x] Strict (3-AND): High precision
  - [x] Balanced (2-AND): Default
  - [x] Relaxed (1-AND): Maximum recall
- [x] 1.5.3 Enhanced Pipeline Logs
  - [x] Show: Found X papers, Filtered X duplicates, Saved X new papers

## Phase 1.6: Global LLM System [COMPLETED ✅]
### Tasks:
- [x] 1.6.1 Initialize LLM on app startup (layout.tsx)
- [x] 1.6.2 API endpoint for client-side init (/api/llm-init)
- [x] 1.6.3 Load all users' LLM configs (not just 'system')
- [x] 1.6.4 Health check and auto-reconnect (5-minute interval)
- [x] 1.6.5 Fallback: Groq → Ollama → Rule-based

## Phase 1.7: ArXiv Rate Limiting [IN PROGRESS]
### Problem:
- ArXiv API returns 429 (rate limited) frequently
- Even with exponential backoff (1s, 2s, 4s), still failing

### Solutions to Consider:
1. **Add initial delay** - Wait 5-10 seconds before first ArXiv request
2. **Reduce concurrent requests** - Add delay between data sources
3. **Cache ArXiv results** - Don't search ArXiv on every collection
4. **User-agent rotation** - May violate ToS
5. **Wait longer** - ArXiv resets limits after ~15-30 minutes

### Current Workaround:
- ArXiv retry with exponential backoff (implemented)
- If all retries fail, continue with other sources

---

## Phase 2: Per-DataSource Query Optimization [ROLLED BACK ❌]

**Status:** ROLLED BACK due to complexity and ArXiv 429 issues

**What was removed:**
- ❌ targetDataSource parameter
- ❌ sourceSpecificQueries in query-optimizer
- ❌ ArXiv-specific syntax (cat: filters)
- ❌ Data source connectivity testing module
- ❌ Per-source optimization logic in collection-service

**Lessons Learned:**
1. Generic queries work better across multiple sources
2. ArXiv rate limits make complex queries impractical
3. Keep it simple - unified format for all sources

---

## Phase 3: Frontend Visualization [PENDING]
### Tasks:
- [ ] 3.1 Design task progress component with animated icons
  - [ ] Query optimization (🔍)
  - [ ] Data source testing (📡)
  - [ ] Collecting papers (📥)
  - [ ] Relevance scoring (⚖️)
  - [ ] Deduplication (🔄)
  - [ ] Saving (💾)
- [ ] 3.2 Create collection status store (Zustand/Context)
- [ ] 3.3 Real-time progress updates (SSE/WebSocket or polling)
- [ ] 3.4 Result summary component
- [ ] 3.5 Better error handling and user feedback

### Dependencies:
- Collection API already provides progress data
- Need to expose progress events to frontend

---

## Phase 4: Additional Improvements [PENDING]
### Tasks:
- [ ] 4.1 Semantic Scholar API integration (waiting for API key)
- [ ] 4.2 SSRN implementation (HTML scraping or alternative)
- [ ] 4.3 Collection scheduling (cron jobs)
- [ ] 4.4 Email notifications for new papers
- [ ] 4.5 Advanced filtering (by date, source, relevance)

---

## Current Status Summary

### ✅ Working Well:
1. **Query Optimization** - LLM generates good Boolean queries
2. **Relevance Scoring** - 4-dimension scoring (1-10 scale)
3. **LLM Fallback** - Groq → Ollama works correctly
4. **Pipeline Logs** - Detailed collection summary
5. **Date Picker** - Full date range support

### ⚠️ Known Issues:
1. **ArXiv 429** - Rate limiting (need better handling)
2. **Frontend Error** - "Failed to initialize LLM system" (cosmetic, doesn't affect function)

### ❌ Rolled Back:
1. Per-datasource query optimization (too complex)

---

## Next Steps:
1. **Fix ArXiv 429** - Add delays or reduce request frequency
2. **Start Phase 3** - Frontend visualization improvements
3. **Wait for Semantic Scholar API** - Then integrate

## Technical Debt:
- ArXiv rate limiting needs proper solution
- Frontend LLM init error should be handled gracefully
- Consider removing 'manual' mode (unused)
