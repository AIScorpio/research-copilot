# Query Optimization Analysis Report

**Date**: 2026-02-20
**Purpose**: Analyze the Query Optimization module failure and propose solutions
**Status**: Analysis Complete, Ready for Implementation

---

## 1. Current Architecture Overview

### 1.1 Collection Flow

```
User Query → Query Optimizer (LLM) → Optimized Query → ArXiv/Semantic Scholar API → Results
     ↓              ↓                        ↓
"AI in banking"  JSON expected        Boolean query string
                   {                      "(ml OR dl) AND (banking OR finance)"
                     optimizedQuery,
                     bankingSpecificTerms,
                     rationale
                   }
```

### 1.2 Key Files

| File | Role |
|------|------|
| `config/prompts.json` | System prompt for LLM |
| `src/lib/query-optimizer.ts` | Query optimization logic |
| `src/lib/collector.ts` | ArXiv/Semantic Scholar API calls |
| `src/lib/collection-service.ts` | Collection orchestration |

---

## 2. ArXiv API Analysis

### 2.1 What ArXiv API Expects

**API Endpoint**: `https://export.arxiv.org/api/query`

**Query Format**: Boolean-style text query (URL encoded)

```
search_query=<query>+AND+submittedDate:[YYYYMMDDHHMM+TO+YYYYMMDDHHMM]
```

### 2.2 Supported Query Syntax

| Syntax | Example | Meaning |
|--------|---------|---------|
| Simple term | `machine learning` | Matches papers containing term |
| Boolean AND | `ml AND banking` | Both terms required |
| Boolean OR | `ml OR dl` | Either term |
| Boolean NOT | `ml NOT medical` | Exclude term |
| Parentheses | `(ml OR dl) AND banking` | Grouping |
| Prefix filters | `all:term` | Search all fields |
| Category filters | `cat:q-fin.RM` | ArXiv category |

### 2.3 Key Finding

**ArXiv expects: Raw Boolean query string, NOT JSON**

---

## 3. Semantic Scholar API Analysis

### 3.1 What Semantic Scholar Expects

**API Endpoint**: `https://api.semanticscholar.org/graph/v1/paper/search`

**Query Format**: Natural language query (URL encoded)

### 3.2 Key Finding

**Semantic Scholar expects: Natural language query, NOT JSON**

---

## 4. Query Structure Deep Dive

### 4.1 Four-Part Query Decomposition

An optimized query contains four logical components:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ("GNN" OR "graph neural network")        ← 1. Tech Terms (Primary)        │
│  AND ("AML" OR "fraud detection")         ← 2. Domain Terms (Banking App)  │
│  AND ("banking" OR "financial")           ← 3. Industry Terms (Context)    │
│  NOT ("molecular" OR "social network")    ← 4. Exclusions (Noise Filter)   │
└─────────────────────────────────────────────────────────────────────────────┘
```

| Component | Purpose | Example |
|-----------|---------|---------|
| **Tech Terms** | Primary search keywords | GNN, LLM, transformer |
| **Domain Terms** | Banking application areas | AML, credit risk, fraud detection |
| **Industry Terms** | Industry context qualifier | banking, financial, finance |
| **Exclusions** | Noise removal | molecular, medical, astrophysics |

### 4.2 Industry-Binding Levels for Domain Terms

Not all domain terms require the same industry qualification:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    DOMAIN TERM CLASSIFICATION                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Level 3: Banking-EXCLUSIVE (Self-qualifying)                              │
│  ──────────────────────────────────────────                                │
│  → AML, KYC, CDD, EDD, SAR, Basel III/IV, IFRS 9, CECL, CCAR, DFAST        │
│  → ONLY exist in banking/finance context                                    │
│  → No industry AND strictly needed (but harmless)                          │
│                                                                             │
│  Level 2: Banking-PRIMARY (Weakly self-qualifying)                         │
│  ──────────────────────────────────────────────                            │
│  → Credit risk, PD, LGD, EAD, credit scoring, default prediction           │
│  → Primarily finance, but concept exists elsewhere                         │
│  → Industry AND recommended for precision                                  │
│                                                                             │
│  Level 1: Cross-INDUSTRY (NOT self-qualifying)                             │
│  ─────────────────────────────────────────                                 │
│  → Fraud detection, anomaly detection, risk assessment, compliance         │
│  → Exists in finance, healthcare, insurance, cybersecurity, etc.           │
│  → Industry AND MANDATORY                                                  │
│                                                                             │
│  Level 0: Domain-AGNOSTIC                                                  │
│  ────────────────────────                                                  │
│  → Classification, prediction, optimization, pattern recognition           │
│  → Pure methodology, no domain                                             │
│  → Industry AND MANDATORY + strong exclusions                              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.3 LLM vs Fallback Query Comparison

**Input: "graph neural networks"**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  LLM Output (3-AND):                                                         │
│  ("graph neural network" OR "GNN" OR "graph convolutional network")          │
│  AND ("anti-money laundering" OR "AML" OR "fraud detection"                  │
│       OR "transaction network" OR "customer relationship")                   │
│  AND ("banking" OR "financial")                                              │
│  NOT ("molecular" OR "social network analysis" OR "recommendation systems")  │
├─────────────────────────────────────────────────────────────────────────────┤
│  Fallback Output (2-AND):                                                    │
│  (graph OR neural OR networks OR machine learning OR deep learning)          │
│  AND (banking OR finance OR credit OR risk)                                  │
│  NOT (astrophysics OR quantum OR medical)                                    │
└─────────────────────────────────────────────────────────────────────────────┘
```

| Aspect | LLM | Fallback |
|--------|-----|----------|
| **Structure** | 3-AND | 2-AND |
| **Tech Terms** | Context-specific synonyms | Generic (ml, dl) |
| **Domain Terms** | Tech-relevant banking apps | Generic (banking, finance) |
| **Exclusions** | Tech-specific (molecular for GNN) | Fixed (astrophysics, quantum, medical) |

### 4.4 3-AND vs 2-AND: Boolean Logic Analysis

**Critical Difference** (if keywords are identical):

```
LLM 3-AND:
("fraud detection") AND ("banking")
→ Must have BOTH fraud detection AND banking

Fallback 2-AND:
("fraud detection" OR "banking")
→ Must have EITHER fraud detection OR banking
```

**These are NOT equivalent!**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Paper: "Fraud Detection in Healthcare Insurance Claims using GNN"          │
├─────────────────────────────────────────────────────────────────────────────┤
│  LLM 3-AND:                                                                 │
│  ✓ GNN (tech)                                                               │
│  ✓ fraud detection (domain)                                                 │
│  ✗ banking (industry) → MISSING                                             │
│  → EXCLUDED ✅ (Correct!)                                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│  Fallback 2-AND:                                                            │
│  ✓ GNN (tech)                                                               │
│  ✓ fraud detection (in clause 2) → SATISFIED                                │
│  → INCLUDED ❌ (Wrong domain!)                                               │
└─────────────────────────────────────────────────────────────────────────────┘
```

| Metric | LLM 3-AND | Fallback 2-AND |
|--------|-----------|----------------|
| **Precision** | ✅ Higher | ❌ Lower |
| **Recall** | ⚠️ Lower | ✅ Higher |
| **Noise** | ✅ Less | ❌ More |
| **Downstream Quality** | ✅ Better | ❌ Degraded |

---

## 5. Downstream Impact Analysis

### 5.1 System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          DATA FLOW ARCHITECTURE                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐ │
│  │   Query     │ →  │   Search    │ →  │   Filter    │ →  │   Storage   │ │
│  │ Optimization│    │   ArXiv/SS  │    │   LLM       │    │   Database  │ │
│  └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘ │
│         ↓                                      ↓                ↓         │
│    Precision/Recall                       Rejection        Paper Pool      │
│    Trade-off                               Rate                            │
│                                              ↓                ↓             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    DOWNSTREAM INTELLIGENT TOOLS                     │   │
│  ├─────────────────────────────────────────────────────────────────────┤   │
│  │  4D Scoring │ Tech Trend │ Methodology │ Tech Radar │ Newsletter  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 5.2 Impact on 4D Scoring

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  SCORING IMPACT                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Fallback 2-AND (High Recall, Low Precision):                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  Input: 100 papers (40 relevant, 60 irrelevant)                     │   │
│  │  LLM Filter: Rejects 60 irrelevant (expensive!)                     │   │
│  │  Problem: 60 wasted LLM API calls for obvious rejects               │   │
│  │  Problem: Business score unreliable when context is ambiguous       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  LLM 3-AND (High Precision, Lower Recall):                                 │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  Input: 50 papers (45 relevant, 5 irrelevant)                       │   │
│  │  LLM Filter: Rejects 5 irrelevant (efficient!)                      │   │
│  │  Benefit: Cleaner input, more reliable scores                       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  KEY INSIGHT: High noise papers → LLM gets confused → Business score unreliable│
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 5.3 Impact on Tech Trend & Aggregation

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  AGGREGATION IMPACT                                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Tech Trend = Count(papers per technology over time)                        │
│  Methodology Distribution = Count(papers per methodology)                   │
│                                                                             │
│  Fallback 2-AND Problem:                                                    │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  Papers collected:                                                   │   │
│  │  - 30 "GNN for credit risk" (banking) ✓                             │   │
│  │  - 15 "GNN for molecular property" (chemistry) ✗                    │   │
│  │  - 10 "GNN for social network analysis" ✗                           │   │
│  │                                                                     │   │
│  │  Tech Trend shows: GNN ↑ (55 papers)                                │   │
│  │  REALITY in banking: GNN → (30 papers)                              │   │
│  │  → Trend is INFLATED by 83%!                                        │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  KEY INSIGHT: Aggregation amplifies noise!                                  │
│  - 1 noisy paper → minimal impact                                          │
│  - 100 noisy papers → distorted trends                                     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 5.4 Impact on Tech Radar

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  TECH RADAR IMPACT                                                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Tech Radar Stages: ASSESS → TRIAL → ADOPT → HOLD                           │
│  Based on: paper count + quality scores + recency                           │
│                                                                             │
│  Problem with Noisy Data:                                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  Technology: "Transformer"                                           │   │
│  │  Papers: 100 total (60 banking, 40 non-banking)                     │   │
│  │  Average Business Score: 5.2 (diluted by non-banking papers)        │   │
│  │  → Stage: TRIAL (looks less mature than reality)                    │   │
│  │                                                                     │   │
│  │  If filtered correctly:                                             │   │
│  │  Average Business Score: 7.8 (only banking papers)                  │   │
│  │  → Stage: ADOPT (correctly reflects maturity)                       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  DECISION IMPACT: Wrong stage → Wrong recommendation to stakeholders        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 5.5 Data Quality Cascade

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    DATA QUALITY CASCADE                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Level 1: Query Optimization  ← Precision/Recall balance                    │
│     ↓                                                                       │
│  Level 2: Paper Collection   ← Signal-to-noise ratio                        │
│     ↓                                                                       │
│  Level 3: Content Assessment ← Score accuracy                               │
│     ↓                                                                       │
│  Level 4: Tag Generation     ← Taxonomy accuracy                            │
│     ↓                                                                       │
│  Level 5: Aggregation        ← Trend/radar accuracy                         │
│     ↓                                                                       │
│  Level 6: Decision Support   ← Recommendation reliability                   │
│                                                                             │
│  ═══════════════════════════════════════════════════════════════════════   │
│  GARBAGE IN → GARBAGE OUT                                                   │
│  Noisy query → Noisy papers → Noisy scores → Noisy trends → Bad decisions  │
│  ═══════════════════════════════════════════════════════════════════════   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Conclusion: Precision is MORE important than recall for downstream analytics.**

---

## 6. Root Cause Analysis

### 6.1 The Mismatch

```
┌─────────────────────────────────────────────────────────────────┐
│                     EXPECTED DATA FLOW                          │
├─────────────────────────────────────────────────────────────────┤
│  1. User: "AI in banking"                                       │
│  2. LLM → JSON { optimizedQuery: "...", terms: [...], ... }     │
│  3. Code extracts optimizedQuery                                │
│  4. Code sends optimizedQuery to ArXiv/Semantic Scholar         │
│  5. APIs return papers                                          │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                     ACTUAL DATA FLOW                            │
├─────────────────────────────────────────────────────────────────┤
│  1. User: "AI in banking"                                       │
│  2. LLM → "(ml OR dl) AND (banking) NOT (medical)"  ← STRING!  │
│  3. Code tries to parse as JSON → FAILS                         │
│  4. Code falls back to getFallbackOptimization()                │
│  5. Fallback generates correct Boolean string                   │
│  6. Code sends fallback query to APIs                           │
│  7. APIs return papers (SUCCESS!)                               │
└─────────────────────────────────────────────────────────────────┘
```

### 6.2 Why LLM Returns String

The prompt says "Return ONLY the optimized Boolean search query string" - so the LLM follows instructions correctly! It's the **code that has wrong expectations**.

### 6.3 bankingSpecificTerms and rationale Redundancy Analysis

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  REDUNDANCY ANALYSIS                                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Fallback bankingSpecificTerms (HARDCODED):                                 │
│  ['credit risk', 'fraud detection', 'AML', 'compliance',                    │
│   'Basel', 'IFRS 9', 'stress testing']                                      │
│  → SAME for every query, regardless of input                                │
│                                                                             │
│  LLM bankingSpecificTerms (EXPECTED):                                        │
│  Input: "AI"   → ['credit risk', 'fraud detection', 'AML', 'compliance']    │
│  Input: "GNN"  → ['AML', 'fraud detection', 'transaction network']          │
│  Input: "LLM"  → ['compliance', 'regulatory reporting', 'risk assessment']  │
│  → DYNAMIC based on input context                                           │
│                                                                             │
│  THE KEY INSIGHT:                                                            │
│  ═════════════════                                                           │
│  bankingSpecificTerms is 100% REDUNDANT with the query itself!              │
│                                                                             │
│  LLM Query for "GNN":                                                        │
│  ... AND ("anti-money laundering" OR "AML" OR "fraud detection" ...) AND ...│
│               ↑ these ARE the bankingSpecificTerms, embedded in query       │
│                                                                             │
│  Expected bankingSpecificTerms: ["AML", "fraud detection", ...]             │
│                                               ↑                              │
│                                 SAME terms, duplicated!                      │
│                                                                             │
│  Current Usage:                                                              │
│  - bankingSpecificTerms: NOT USED anywhere in codebase                      │
│  - rationale: ONLY used for debug logging                                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 7. Where LLM Intelligence Matters

### 7.1 Value-Add Breakdown

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    LLM VALUE-ADD (Keep Simple)                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. Tech Term Expansion (Domain Knowledge)                                  │
│     ─────────────────────────────────────────                               │
│     "GNN" → "GNN" OR "graph neural network" OR "graph attention"           │
│     "LLM" → "LLM" OR "large language model" OR "transformer" OR "GPT"      │
│     Value: Synonyms and variants for better recall                          │
│                                                                             │
│  2. Domain Selection (Tech-to-Domain Mapping)                               │
│     ──────────────────────────────────────────                              │
│     "GNN"     → AML, fraud detection, transaction network                  │
│     "LLM"     → compliance, regulatory reporting, document analysis        │
│     "generic" → credit risk, fraud, compliance (broad coverage)            │
│     Value: What is this tech used for in banking?                          │
│                                                                             │
│  3. Exclusion Selection (Context-Aware Noise Reduction)                     │
│     ─────────────────────────────────────────────                           │
│     "GNN" + banking  → NOT molecular, social network, drug discovery       │
│     "LLM" + banking  → NOT creative writing, gaming, chatbot               │
│     "Time series"    → NOT weather forecasting, signal processing          │
│     Value: What other domains use this tech?                               │
│                                                                             │
│  ═══════════════════════════════════════════════════════════════════════   │
│                                                                             │
│  NOT LLM's job (keep fixed):                                                │
│  - Industry terms: Always "banking" OR "financial"                         │
│  - Query structure: Always 3-AND                                           │
│  - Output format: Always string (not JSON)                                 │
│                                                                             │
│  KEY PRINCIPLE:                                                              │
│  LLM's value is in CONTENT INTELLIGENCE (what terms to use),               │
│  not STRUCTURE INTELLIGENCE (how to structure the query).                  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 7.2 Auto Collect vs Pipeline Collect

| Mode | Input | Tech Expansion | Domain Selection | Strategy |
|------|-------|----------------|------------------|----------|
| **Auto** | Generic ("AI in banking") | Broad (ml, dl, nn) | Multiple domains | Coverage |
| **Pipeline** | Specific ("GNN") | Focused (GNN variants) | Relevant domains | Precision |

Both use the SAME 3-AND structure, only content differs.

---

## 8. Solution: Simplified Approach

### 8.1 Decision: Universal 3-AND with Smart Content

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    FINAL DESIGN                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Query Structure: ALWAYS 3-AND (no conditional logic)                       │
│  (Tech Terms) AND (Domain Terms) AND (banking OR financial) NOT (Exclusions)│
│                                                                             │
│  Industry Terms: FIXED - "banking" OR "financial"                           │
│  Output Format: STRING only (remove JSON)                                   │
│  bankingSpecificTerms: REMOVE (redundant with query)                        │
│  rationale: REMOVE (not used)                                               │
│                                                                             │
│  LLM Intelligence:                                                           │
│  ✅ Tech term expansion (synonyms, variants)                                │
│  ✅ Domain selection (tech-to-banking mapping)                              │
│  ✅ Exclusion selection (context-aware)                                     │
│  ❌ Structure decisions (fixed 3-AND)                                        │
│  ❌ JSON metadata (not needed)                                              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 8.2 Why 3-AND for All Cases (Including Banking-Exclusive)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  COMPLEXITY vs VALUE TRADE-OFF                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Conditional 2/3-AND structure:                                             │
│  → More complex prompt                                                      │
│  → More LLM reasoning steps                                                 │
│  → More failure points                                                      │
│  → Marginal precision gain                                                  │
│                                                                             │
│  Universal 3-AND structure:                                                 │
│  → Simpler prompt                                                           │
│  → Less LLM reasoning                                                       │
│  → More robust                                                              │
│  → Minimal redundancy cost                                                  │
│                                                                             │
│  Example: "GNN AND AML AND banking"                                         │
│  → AML implies banking, but extra "AND banking" doesn't hurt               │
│  → Slight recall reduction (maybe 1-2 papers)                              │
│  → Not worth the complexity                                                 │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 9. Implementation Plan

### 9.1 Code Changes

**File: `src/lib/query-optimizer.ts`**

```typescript
// BEFORE (expects JSON)
const response = await generateJSONWithFallback<{
    optimizedQuery: string;
    bankingSpecificTerms: string[];
    rationale: string;
}>(prompt, systemPrompt);

return {
    originalQuery: query,
    optimizedQuery: response.optimizedQuery,
    bankingSpecificTerms: response.bankingSpecificTerms,
    rationale: response.rationale
};

// AFTER (expects string)
const optimizedQuery = await generateText(prompt, systemPrompt);

return {
    originalQuery: query,
    optimizedQuery: optimizedQuery.trim(),
    bankingSpecificTerms: [],    // Remove - redundant with query
    rationale: ''                // Remove - not used
};
```

### 9.2 Prompt Update

**File: `config/prompts.json`**

```markdown
Role: Banking AI Query Optimization Expert

Task: Transform user input into a Boolean query for ArXiv/Semantic Scholar

## Query Structure (ALWAYS use this)
(Tech Terms) AND (Domain Terms) AND ("banking" OR "financial") NOT (Exclusions)

## Rules

1. **Tech Terms**: Expand the input with synonyms and variants
   - "GNN" → "graph neural network" OR "GNN" OR "graph convolution"
   - "LLM" → "large language model" OR "LLM" OR "transformer"

2. **Domain Terms**: Select 2-4 banking applications RELEVANT to the tech
   - GNN → "AML" OR "fraud detection" OR "transaction network"
   - LLM → "compliance" OR "regulatory" OR "risk assessment"
   - Generic input → "credit risk" OR "fraud detection" OR "compliance"

3. **Exclusions**: Select domains that ALSO use this tech (NOT banking)
   - GNN → "molecular" OR "drug" OR "social network"
   - LLM → "creative writing" OR "gaming" OR "entertainment"
   - Generic → "medical" OR "quantum" OR "astrophysics"

4. **Industry**: Always use "banking" OR "financial"

## Examples

Input: "graph neural networks"
Output: ("graph neural network" OR "GNN" OR "graph convolution") AND ("AML" OR "fraud detection" OR "transaction network") AND ("banking" OR "financial") NOT ("molecular" OR "drug discovery" OR "social network analysis")

Input: "AI" (general)
Output: ("machine learning" OR "deep learning" OR "neural network") AND ("credit risk" OR "fraud detection" OR "compliance" OR "risk assessment") AND ("banking" OR "financial") NOT ("medical" OR "quantum" OR "astrophysics")

## Output
Return ONLY the Boolean query string. No explanations. No JSON.
```

### 9.3 Fallback Enhancement (Optional)

If LLM still fails, enhance the fallback with tech-aware domain mapping:

```typescript
const TECH_TO_DOMAIN: Record<string, { domains: string[], exclusions: string[] }> = {
    'gnn': {
        domains: ['AML', 'fraud detection', 'transaction network'],
        exclusions: ['molecular', 'drug discovery', 'social network']
    },
    'llm': {
        domains: ['compliance', 'regulatory', 'document analysis'],
        exclusions: ['creative writing', 'gaming', 'chatbot']
    },
    // ... more mappings
};
```

---

## 10. Summary

| Aspect | Current | New Design |
|--------|---------|------------|
| **Output Format** | JSON (fails 100%) | String |
| **Query Structure** | Mixed (fallback 2-AND) | Universal 3-AND |
| **Industry Terms** | Variable | Fixed: "banking OR financial" |
| **bankingSpecificTerms** | Hardcoded | REMOVE (redundant) |
| **rationale** | Hardcoded | REMOVE (not used) |
| **LLM Role** | Generate JSON metadata | Generate smart content |
| **Precision** | Low (2-AND fallback) | High (3-AND) |

### Key Decisions

1. **String output, not JSON** - Aligns with API expectations, removes failure point
2. **Universal 3-AND** - Simpler, more robust, acceptable redundancy
3. **Remove redundant fields** - bankingSpecificTerms and rationale not used
4. **LLM for content, not structure** - Tech expansion, domain selection, exclusions

---

## 11. Next Steps

1. [ ] Update `query-optimizer.ts` to use `generateText` instead of `generateJSONWithFallback`
2. [ ] Update `config/prompts.json` with new simplified prompt
3. [ ] Remove `bankingSpecificTerms` and `rationale` from return type (or keep empty)
4. [ ] Test with dry run script
5. [ ] Verify ArXiv/Semantic Scholar results quality
6. [ ] Monitor downstream impact on Tech Trend and Tech Radar

---

*Report updated: 2026-02-20*
*Status: Ready for implementation review*
