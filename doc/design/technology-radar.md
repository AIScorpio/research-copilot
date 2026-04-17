# Technology Radar Design

**Status**: Phase 1 complete, Phase 2 in progress
**Scope**: Keyword-based technology detection, quadrant classification, trend analytics

---

## Phase 1: Keyword-Based Radar (Implemented)

### Data Flow

1. Query papers within date range
2. Extract technologies from title + abstract + tags using 29 predefined keywords
3. Group by technology, filter to >=2 papers
4. Calculate maturity and relevance scores
5. Assign quadrant (ADOPT / TRIAL / ASSESS / HOLD)

### Scoring

**Maturity** (0-100):
- Base: 20 points
- Paper count bonuses: +20 (>=3), +10 (>=5), +10 (>=10)
- Recent activity bonuses: +10 (>=2), +10 (>=5), +10 (>=10)
- Production mention: +10

**Relevance** (0-100):
- Base: 30 points
- Risk-related keywords: +40
- Banking keywords: +20
- Recent activity (3+ papers in 60 days): +10

### Quadrant Matrix

```
              Relevance Low    Relevance Medium    Relevance High
Maturity High    ASSESS           TRIAL              ADOPT
Maturity Med     ASSESS           TRIAL              TRIAL
Maturity Low     HOLD             ASSESS             ASSESS
```

### Features

- Dual trend comparison: vs selected period + vs last 7 days
- Side panel with associated papers list
- Bank adoption tracking (pattern-matched from paper text)

---

## Phase 2: AI-Native Detection (In Progress)

### Goals

- Replace 29 hardcoded keywords with LLM-driven technology extraction
- Configurable source types (academic, industry, regulatory, social, internal)
- Category taxonomy for tags: ai-technology, business-area, risk-category, regulatory, methodology

### Schema Changes

- `Paper.sourceType` — inferred from source configuration
- `Tag.category` — controlled vocabulary
- Index on both fields for efficient filtering

### End-to-End Flow

```
Collect → Assess (4-dimension scoring) → Tag (category-aware) → Store → Radar query by category
```

---

## Phase 3: Predictive Analytics (Backlog)

- Trend prediction with confidence intervals
- Emerging technology alerts
- Portfolio recommendations
- View modes: classic (29 core) / extended (all) / ai-enhanced (with predictions)
