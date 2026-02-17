# System Refactor Summary - 2026-02-17

## Executive Summary

Today's work focused on comprehensive LLM prompt optimization for the research paper collection system, implementing a Technical Excellence Bonus mechanism, cleaning up legacy dirty data, and fixing various UI issues.

**Key Achievements:**
- 4 LLM prompt modules optimized (Content Assessment, Summary Generation, Tag Suggestion, Query Optimization)
- Technical Excellence Bonus (1.05x) implemented with frontend display
- Database cleaned: 205 dirty papers removed, 7 clean papers preserved
- All Chinese text in Tech Radar replaced with English

---

## 1. LLM Prompt Optimization

### 1.1 Problem Statement

Before optimization, LLM-generated content had several issues:
- **Content Assessment**: Business score inflated by "potential applications" rather than explicit content
- **Summary Generation**: Hallucinated banking applications and fake metrics (e.g., "95%", "10x faster")
- **Tag Suggestion**: Forced banking tags even when papers had no banking context
- **Query Optimization**: Complex Boolean queries confused ArXiv API

### 1.2 Solution: System vs User Prompts

**Design Principle:**
```
System Prompt (config/prompts.json):
  - Role definition ("You are a...")
  - Scoring criteria / rules
  - Output format
  - Domain knowledge

User Prompt (code):
  - Simple task instruction (1 line)
  - Input data only (TITLE, ABSTRACT, etc.)
```

### 1.3 Changes by Module

#### Content Assessment
- Business score now based on **EXPLICIT content only**
- Added rules: "If paper mentions 'stress testing' but context is power grids/medical, Business score = 3-4"
- New scoring criteria for Business (1-10 scale with strict definitions)

#### Summary Generation
- Role changed: "Banking AI Research Analyst" → "Technical Research Analyst"
- Added "Do NOT fabricate numbers or applications" constraint
- Removed example with fabricated metrics

#### Tag Suggestion
- Tags now based on actual paper content
- No forced banking tags when paper has no banking context
- Added new methodology tags: minimax-optimization, distributionally-robust-optimization

#### Query Optimization
- Simplified user prompt (data only, instructions in system prompt)

### 1.4 Files Modified

| File | Change |
|------|--------|
| `config/prompts.json` | Updated all 4 prompts |
| `src/lib/content-filter.ts` | Updated fallback prompt, added Technical Bonus logic |
| `src/lib/summary-generator.ts` | New file (replaced llm.ts) |
| `src/lib/tag-generator.ts` | Updated user prompt |
| `src/lib/query-optimizer.ts` | Updated user prompt |
| `src/lib/llm.ts` | **Deleted** (replaced by summary-generator.ts) |

---

## 2. Technical Excellence Bonus

### 2.1 Concept

Papers with high technical value but no explicit banking context can still be valuable for a banking AI research copilot. The Technical Excellence Bonus provides a 1.05x multiplier to recognize such papers.

**Trigger Condition:** `Technical >= 8 AND Business <= 4`

### 2.2 Implementation

**Database Schema:**
```prisma
model Paper {
  ...
  technicalBonusApplied Boolean @default(false)
}
```

**Calculation Logic:**
```typescript
let weightedTotal = (
    dims.technical * 0.30 +
    dims.business * 0.40 +
    dims.timeliness * 0.10 +
    dims.practicality * 0.20
);

const technicalBonusApplied = dims.business <= 4 && dims.technical >= 8;
if (technicalBonusApplied) {
    weightedTotal = weightedTotal * 1.05;
}

result.relevanceScore = weightedTotal;
result.technicalBonusApplied = technicalBonusApplied;
```

### 2.3 Frontend Display

**Paper Card:**
- Shows ⚡ icon for papers with bonus
- Tooltip includes "Technical Excellence Bonus: +5%"

**Paper Detail:**
- New "Assessment Scores" section between Actions and Tags
- Shows Base Score, Technical Bonus (if applied), Final Score

### 2.4 Files Modified

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Added `technicalBonusApplied` field |
| `src/lib/content-filter.ts` | Added bonus calculation and return value |
| `src/lib/collection-service.ts` | Use `relevance.relevanceScore` (includes bonus) |
| `src/components/papers/paper-card.tsx` | Display ⚡ icon and tooltip |
| `src/app/papers/[id]/page.tsx` | Assessment Scores section |

---

## 3. Database Cleanup

### 3.1 Problem

Before optimization, many papers were collected with:
- Fallback scores (7.5/7.5 for all dimensions)
- Inflated Business scores based on "potential applications"
- Incorrect tags forced to banking domain

### 3.2 Decision

Clean all legacy data and keep only the 7 papers collected after optimization (2026-02-17).

### 3.3 Execution

| Operation | Count |
|-----------|-------|
| Papers deleted | 212 |
| PaperTags deleted | 752 |
| UserFavorites deleted | 6 |
| NewsletterLogs deleted | 5 |
| Tags preserved | 231 |
| Papers restored | 7 |
| PaperTags restored | 30 |

### 3.4 Backup

File: `backup_papers_2026-02-17.json`

Contains full data for 7 papers including:
- Paper metadata (id, title, abstract, url, source, scores, etc.)
- Tag associations (name, type, category)

---

## 4. Current Database State

### 4.1 Papers (7 total)

| # | Title | T | B | Ti | P | Total | Bonus |
|---|-------|---|---|----|----|-------|-------|
| 1 | Evaluating LLMs in Finance | 8 | 10 | 10 | 9 | 9.20 | - |
| 2 | Hamiltonian Flow RL | 9 | 7 | 9 | 8 | 8.00 | - |
| 3 | Transformer Trust | 10 | 6 | 5 | 6 | 7.10 | - |
| 4 | Robust multi-task boosting | 8 | 4 | 8 | 5 | 6.09 | ⚡ |
| 5 | Hunt Globally (Drug) | 8 | 2 | 9 | 7 | 5.78 | ⚡ |
| 6 | Topological trivialization | 9 | 2 | 7 | 3 | 5.04 | ⚡ |
| 7 | Long Context LLMs | 7 | 2 | 9 | 6 | 5.00 | - |

### 4.2 Statistics

- **Papers**: 7
- **Tags**: 231 (all preserved for future use)
- **PaperTags**: 30 associations

---

## 5. Bug Fixes

### 5.1 Collection Settings Input

**Problem:** Number inputs couldn't be cleared when editing.

**Solution:** Added `inputValues` state to track raw input (allows empty string), with `onBlur` handler to restore value if invalid.

**File:** `src/components/settings/collection-settings.tsx`

### 5.2 Tech Radar Chinese Text

**Problem:** Trend labels showed Chinese text ("vs 上周", "首次出现").

**Solution:** Replaced all Chinese with English:
- "vs 上周" → "vs Last Week"
- "vs 前X天" → "vs Last X Days"
- "首次出现" → "First appeared"
- Date format: `zh-CN` → `en-US`

**File:** `src/components/radar/technology-radar.tsx`

---

## 6. Commits

| Commit | Message |
|--------|---------|
| `c53cbf1` | feat: collection config system and tag optimization |
| `5b9c33c` | feat: comprehensive LLM prompt optimization for content assessment |
| `ad84502` | feat: implement Technical Excellence Bonus (1.05x) with frontend display |
| `ebc7903` | fix: allow clearing number inputs in Collection Settings |
| `b7d3f66` | fix: use English date format in Tech Radar paper list |
| `2296633` | fix: replace all Chinese text with English in Tech Radar trend labels |

---

## 7. Design Documents

| File | Description |
|------|-------------|
| `refactor/2026-02-17_prompt_optimization_design.md` | Full prompt optimization design with validation results |
| `refactor/2026-02-17_system_refactor_summary.md` | This document |
| `backup_papers_2026-02-17.json` | Backup of 7 clean papers |

---

## 8. Next Steps

### Recommended Actions

1. **Monitor New Collections**: Verify optimized prompts work correctly with new paper collections
2. **Tag Cleanup**: Consider removing unused tags from the 231 preserved tags
3. **Validation**: Run end-to-end validation on new collections to ensure:
   - Content Assessment scores are accurate
   - Tags match paper content
   - Summaries are factual without hallucinations
   - Technical Bonus is applied correctly

### Potential Future Enhancements

1. **Multi-domain Paper Handling**: Better rules for papers spanning finance + healthcare
2. **Confidence Scores**: Display LLM confidence in assessment
3. **A/B Testing**: Compare old vs new prompt results
4. **User Feedback Loop**: Allow users to flag incorrect assessments

---

## 9. Key Files Reference

### Configuration
- `config/prompts.json` - All LLM prompts (golden source)
- `config/collection.json` - Collection parameters

### Core Logic
- `src/lib/content-filter.ts` - Content assessment with Technical Bonus
- `src/lib/summary-generator.ts` - Summary generation
- `src/lib/tag-generator.ts` - Tag suggestion
- `src/lib/query-optimizer.ts` - Query optimization
- `src/lib/collection-service.ts` - Collection orchestration

### Frontend
- `src/components/papers/paper-card.tsx` - Paper card with bonus display
- `src/app/papers/[id]/page.tsx` - Paper detail with Assessment Scores
- `src/components/radar/technology-radar.tsx` - Tech Radar
- `src/components/settings/collection-settings.tsx` - Collection settings

---

*Document generated: 2026-02-17*
