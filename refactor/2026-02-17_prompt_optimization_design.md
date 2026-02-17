# LLM Prompt Optimization Design Document

**Date**: 2026-02-17
**Status**: Implemented & Validated
**Author**: AI Assistant

---

## Executive Summary

This document describes the comprehensive optimization of four LLM prompt modules in the research paper collection system:

1. **Content Assessment** - Evaluate paper relevance to banking AI research
2. **Summary Generation** - Generate technical summaries for papers
3. **Tag Suggestion** - Generate relevant tags from taxonomy
4. **Query Optimization** - Optimize search queries for academic databases

### Key Changes

| Module | Before | After |
|--------|--------|-------|
| Content Assessment | Business score inflated by "potential applications" | Business score based on EXPLICIT content only |
| Summary Generation | Hallucinated banking applications and fake metrics | Fact-based, no fabrication |
| Tag Suggestion | Forced banking tags even when not relevant | Tags based on actual paper content |
| Query Optimization | Complex Boolean queries confused ArXiv API | Simplified, working format |

### New Feature: Technical Excellence Bonus

Papers with `Technical >= 8` but `Business <= 4` receive a `1.05x` score multiplier to recognize technical innovation value.

---

## 1. Content Assessment

### 1.1 Problem Statement

**Before optimization:**
- Business score was inflated by "potential applications" rather than explicit content
- Example: "Worst-case generation via minimax optimization" received Business=7 despite:
  - Paper explicitly mentions "power grids and medical prediction systems" as applications
  - No mention of banking/finance anywhere
- LLM would speculate about "potential banking stress testing applications"

### 1.2 Prompt Changes

**File**: `config/prompts.json` → `contentAssessment`

**Key Changes:**

| Before | After |
|--------|-------|
| "Banking AI Research Content Evaluation Expert" | "Banking AI Content Evaluation Expert" |
| No explicit instruction about speculation | "Score based on EXPLICIT content only, NOT potential applications" |
| No guidance on context interpretation | "If paper mentions 'stress testing' but context is power grids/medical, Business score = 3-4" |

**New Scoring Criteria (Business):**

```
## Business Relevance Scoring (CRITICAL - Score STRICTLY)
- 9-10: Paper explicitly addresses banking/finance with clear use cases
- 7-8: Paper explicitly mentions finance/banking applications
- 5-6: Paper mentions financial keywords in financial context
- 3-4: Pure technology without EXPLICIT financial context
- 1-2: Completely outside domain (medical, gaming, physics primary application)
```

**New Rules Added:**

```
## IMPORTANT Rules
- Score Business based on EXPLICIT content only, NOT what technology COULD be used for
- If paper mentions "stress testing" but context is power grids/medical, Business score = 3-4
- "Risk" alone does NOT mean financial risk - check context
- Technical sophistication does NOT justify higher Business score
```

### 1.3 Code Changes

**File**: `src/lib/content-filter.ts`

**Technical Excellence Bonus Logic:**

```typescript
// Calculate weighted total
let weightedTotal = (
    dims.technical * 0.30 +
    dims.business * 0.40 +
    dims.timeliness * 0.10 +
    dims.practicality * 0.20
);

// Technical Excellence Bonus: if business <= 4 but technical >= 8,
// apply 1.05x multiplier for technical innovation value
const technicalBonusApplied = dims.business <= 4 && dims.technical >= 8;
if (technicalBonusApplied) {
    weightedTotal = weightedTotal * 1.05;
}

result.relevanceScore = weightedTotal;
result.isRelevant = weightedTotal >= 5;
```

### 1.4 Validation Results

**Test Case: "Topological trivialization in non-convex empirical risk minimization"**

| Dimension | Before | After | Ground Truth |
|-----------|--------|-------|--------------|
| Technical | 9 | 9 | 9 (pure mathematical theory) |
| Business | 7 | 2 | 2 (no financial context) |
| Timeliness | 7 | 7 | 7 |
| Practicality | 3 | 3 | 3 (pure theory) |
| rawTotal | - | 4.80 | 4.80 |
| **finalTotal** | **7.3** | **5.04** (×1.05) | **5.04** |

**Result**: Business score now correctly reflects explicit content, Technical Bonus applied.

---

## 2. Summary Generation

### 2.1 Problem Statement

**Before optimization:**
- LLM hallucinated banking applications not mentioned in paper
- LLM fabricated specific metrics (e.g., "95%", "10x faster") not in paper
- Example output for "Worst-case generation via minimax optimization":

```
"This paper develops a continuous worst-case distribution generator... 
achieving 95% coverage of empirical risk scenarios...
generates stress-test scenarios 10x faster than traditional DRO approaches.
Banking applications include CCAR stress testing, operational risk..."
```

**Ground Truth:**
- Paper mentions "power grids and medical prediction systems" as applications
- No "95%" or "10x" metrics in paper
- No banking applications mentioned

### 2.2 Prompt Changes

**System Prompt** (`config/prompts.json` → `summaryGeneration`):

| Before | After |
|--------|-------|
| "Role: Banking AI Research Analyst" | "Role: Technical Research Analyst" |
| "Highlight specific banking applications" | "Report metrics ONLY if explicitly stated" |
| "Banking application potential" in structure | "Application domains mentioned by authors" |
| Example with 94%, 10,000+ metrics | No example with fabricated metrics |

**New Requirements:**

```
## Requirements
1. Accurately describe the core methodology and contribution
2. Report key findings and metrics ONLY if explicitly stated in the paper
3. Do NOT fabricate numbers, metrics, or applications not mentioned in the paper
4. Identify potential application domains based on paper content (if any)
5. Keep it to 2-3 sentences maximum
```

**User Prompt** (`src/lib/summary-generator.ts`):

```typescript
const prompt = `Generate an accurate technical summary for the following paper.
Only include facts, metrics, and applications explicitly stated in the paper.
Do NOT fabricate numbers or applications not mentioned in the paper.

TITLE: ${title}

ABSTRACT: ${abstract}`;
```

### 2.3 Validation Results

**Test Case: "Long Context, Less Focus: A Scaling Gap in LLMs"**

**Generated Summary:**
```
"Paper focuses on privacy leakage and personalization in LLMs with 
increasing context length. No explicit mention of banking, finance, 
credit, fraud, compliance, or any financial domain. While privacy 
and personalization could theoretically apply to banking, the paper 
does not explicitly state any financial application domain."
```

**Assessment**: ✅ Accurate, no hallucination, correctly identifies absence of banking content.

---

## 3. Tag Suggestion

### 3.1 Problem Statement

**Before optimization:**
- LLM forced banking tags even when paper had no banking context
- Example: "Worst-case generation via minimax optimization" received tags:
  - risk-modeling (Business-area)
  - model-risk (Risk-category)
  - stress-testing (Business-area)
  - predictive-modeling (Methodology)
  - deep-learning (AI-technology)

**Ground Truth**: Paper is pure optimization theory, should have methodology/ai-technology tags only.

### 3.2 Prompt Changes

**System Prompt** (`config/prompts.json` → `tagSuggestion`):

| Before | After |
|--------|-------|
| "Role: Banking AI Taxonomy Expert" | "Role: Technical Taxonomy Expert" |
| "MUST be specific to banking/finance domain" | "Tags MUST accurately reflect paper content" |
| "Cover both technology AND business aspects" | "Cover BOTH technology AND domain aspects IF mentioned in paper" |

**New Requirements:**

```
## Requirements
1. Tags MUST accurately reflect paper content
2. Do NOT force banking/finance tags if paper does not mention them
3. Prioritize accuracy over domain coverage
4. Include methodology and technology tags as appropriate

## IMPORTANT Rules
- Accuracy first - do not fabricate domain applications
- If paper does not mention banking, do not add banking tags
```

**New Methodology Tags Added:**

```
| methodology | Research methods | predictive-modeling, anomaly-detection, pattern-recognition, 
                                automation, decision-support, monitoring, classification, 
                                regression, clustering, minimax-optimization, 
                                distributionally-robust-optimization |
```

### 3.3 Validation Results

**Test Case: "Topological trivialization in non-convex ERM"**

**Generated Tags:**
- empirical-risk-minimization (Methodology)
- optimization (Methodology)
- non-convex-optimization (Methodology)
- minimax-optimization (Methodology)

**Assessment**: ✅ Correct, pure methodology tags, no forced banking tags.

**Test Case: "Decoupled Continuous-Time RL via Hamiltonian Flow"**

**Generated Tags:**
- continuous-control (Methodology)
- actor-critic (AI-technology)
- optimization (Methodology)
- trading (Business-area)
- reinforcement-learning (AI-technology)

**Assessment**: ✅ Correct, includes "trading" because paper explicitly mentions "real-world trading task".

---

## 4. Query Optimization

### 4.1 Problem Statement

**Before optimization:**
- LLM generated complex Boolean queries that ArXiv API couldn't parse correctly
- Example: `(artificial intelligence OR machine learning) AND (banking...)`
- ArXiv interpreted spaces as OR, causing wrong results

### 4.2 User Prompt Changes

**File**: `src/lib/query-optimizer.ts`

**Before:**
```typescript
const prompt = `Optimize the following query for banking/AI research collection:
Original Query: "${query}"
Generate a RELAXED Boolean query...
Return a JSON object...`;
```

**After:**
```typescript
const prompt = `Optimize the following query:

Original Query: "${query}"

Strictness Level: ${(opts.strictness || 'relaxed').toUpperCase()}`;
```

**Rationale**: All instructions (how to optimize, output format) are in system prompt. User prompt only provides data.

---

## 5. Architecture: System vs User Prompts

### 5.1 Design Principle

```
System Prompt (config/prompts.json):
  - Role definition
  - Scoring criteria
  - Output format
  - Domain knowledge

User Prompt (code):
  - Task instruction (1 line)
  - Input data (TITLE, ABSTRACT, etc.)
```

### 5.2 Implementation

All four modules now follow this pattern:

```typescript
// System prompt from config
const systemPrompt = await getXxxPrompt();

// User prompt with data only
const prompt = `Task instruction:

TITLE: ${title}

ABSTRACT: ${abstract}`;

// Call LLM
const result = await generateJSONWithFallback(prompt, systemPrompt);
```

---

## 6. End-to-End Validation

### 6.1 Test Run Summary

**Date**: 2026-02-17
**Query**: "AI in banking"
**Results**: 20 papers found, 7 collected

### 6.2 Collected Papers Analysis

| Paper | T | B | Ti | P | rawTotal | Bonus | finalTotal | Assessment |
|-------|---|---|----|----|----------|-------|------------|------------|
| Long Context, Less Focus | 7 | 2 | 9 | 6 | 5.00 | - | 5.00 | ✅ Correct |
| Topological trivialization | 9 | 2 | 7 | 3 | 4.80 | 1.05 | 5.04 | ✅ Correct |
| Hunt Globally (Drug) | 8 | 2 | 9 | 7 | 5.50 | 1.05 | 5.78 | ✅ Correct |
| Robust multi-task boosting | 8 | 4 | 8 | 5 | 5.80 | 1.05 | 6.09 | ✅ Correct |
| Transformer Trust | 10 | 6 | 5 | 6 | 7.10 | - | 7.10 | ⚠️ B slightly high |
| Hamiltonian Flow RL | 9 | 7 | 9 | 8 | 8.00 | - | 8.00 | ✅ Correct |
| Evaluating LLMs in Finance | 8 | 10 | 10 | 9 | 9.20 | - | 9.20 | ✅ Correct |

### 6.3 Key Observations

1. **Technical Bonus Working**: Papers with T≥8, B≤4 received 1.05x multiplier
2. **Business Scoring Strict**: Non-banking papers received B=2-4 (not inflated)
3. **Tags Accurate**: No forced banking tags on non-banking papers
4. **Summaries Factual**: No hallucinated metrics or applications

---

## 7. Known Issues

### 7.1 Database Inconsistency (Pending Fix)

**Problem**: `collection-service.ts` recalculates score without bonus, overwriting `content-filter.ts` result.

**Location**: `src/lib/collection-service.ts` lines 260-270

**Current Code:**
```typescript
const normalizedTotal = (
    technicalScore * 0.30 +
    businessScore * 0.40 +
    timelinessScore * 0.10 +
    practicalityScore * 0.20
);
// Missing: technical bonus application
```

**Required Fix**: Use `relevance.relevanceScore` directly (already includes bonus).

### 7.2 Business Score Edge Case

**Problem**: "Transformer Trust" received B=6 despite mentioning healthcare applications.

**Suggested Enhancement**: Add rule for multi-domain papers with healthcare:
```
If paper mentions multiple domains including healthcare/medical, 
Business score should be capped at 5 unless finance is PRIMARY domain.
```

---

## 8. Files Modified

| File | Change |
|------|--------|
| `config/prompts.json` | Updated all 4 prompts |
| `src/lib/content-filter.ts` | Added Technical Bonus logic, updated fallback prompt |
| `src/lib/summary-generator.ts` | New file (replaced llm.ts), updated prompts |
| `src/lib/tag-generator.ts` | Updated user prompt |
| `src/lib/query-optimizer.ts` | Updated user prompt |
| `src/app/api/papers/[id]/auto-tag/route.ts` | Use tag-generator instead of llm.ts |
| `src/app/api/papers/[id]/summary/route.ts` | Use summary-generator instead of llm.ts |
| `src/lib/llm.ts` | **Deleted** (replaced by summary-generator.ts) |

---

## 9. Recommendations

### 9.1 Immediate Actions

1. **Fix DB save logic** - Use `relevance.relevanceScore` in collection-service.ts
2. **Add `technicalBonusApplied` field** to Paper model

### 9.2 Future Enhancements

1. **Multi-domain paper handling** - Better rules for papers spanning finance + healthcare
2. **Confidence scores** - Display LLM confidence in assessment
3. **A/B testing** - Compare old vs new prompt results
4. **User feedback loop** - Allow users to flag incorrect assessments

---

## Appendix A: Full Prompt Config

See `config/prompts.json` for current prompt definitions.

## Appendix B: Validation Log

See server logs from 2026-02-17 12:44:XX for detailed assessment records.
