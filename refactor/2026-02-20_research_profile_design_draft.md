# Research Profile Design Draft

**Date**: 2026-02-20
**Status**: Draft for Future Reference
**Purpose**: Document multi-profile architecture considerations for later implementation

---

## 1. Background

The research copilot serves two distinct research directions:

### 1.1 Direction 1: HSBC CIB Business Risk

| Aspect | Description |
|--------|-------------|
| **Role** | Applied AI Research Lead, HSBC CIB Business Risk Data Analytics |
| **Domain** | Banking operational risk |
| **Focus** | Applied AI for risk mitigation |
| **Key Areas** | Fraud detection, lending fraud, payment fraud, emerging risks (deepfake), future of work, human-AI interaction, agent swarms, collective intelligence |
| **Scope** | Bank-specific, compliance-driven, near-term applications |
| **Stakeholders** | Internal risk team, regulators |
| **Regulatory Context** | Basel, IFRS 9, CCAR, DFAST |

### 1.2 Direction 2: Personal Research (Quant Finance)

| Aspect | Description |
|--------|-------------|
| **Domain** | Quantitative finance / Financial economics |
| **Focus** | Mathematical models and AI for market behavior |
| **Key Areas** | Systemic risk, portfolio optimization, complex derivative pricing, tail risk modeling, volatility modeling |
| **Scope** | Market-wide, theoretical foundations, long-term research |
| **Stakeholders** | Academic community, self |
| **Regulatory Context** | None / Academic |

---

## 2. Alignment Analysis

### 2.1 Overlap Matrix

| Dimension | HSBC CIB Risk | Personal Research | Alignment |
|-----------|---------------|-------------------|-----------|
| Data Sources | ArXiv, Semantic Scholar | ArXiv, Semantic Scholar | ✅ Same |
| AI Techniques | ML/DL/LLM/GNN/RL | ML/DL/LLM/GNN/RL | ✅ Same |
| Time Series | Fraud patterns | Market signals | ✅ Same technique |
| Anomaly Detection | Transaction fraud | Market crashes | ✅ Same technique |
| Risk Modeling | Credit/Operational | Systemic/Market | ⚠️ Similar concept |
| Domain Context | Banking-specific | Market-wide | ❌ Different |
| Business Relevance | Bank operations | Trading/investment | ❌ Different |
| Time Horizon | Near-term applied | Long-term research | ❌ Different |

### 2.2 Key Insight

**Shared techniques, different domains.** The bridge is at the AI/ML technique level:

```
AI Technique Layer (SHARED)
├── Time Series Forecasting
│   ├── HSBC: Transaction monitoring, credit scoring
│   └── Quant: Market trends, volatility forecasting
├── Anomaly Detection
│   ├── HSBC: Fraud detection, payment fraud
│   └── Quant: Market crashes, tail events
├── Graph Neural Networks
│   ├── HSBC: AML networks, KYC relationships
│   └── Quant: Systemic risk networks, portfolio optimization
└── Reinforcement Learning
    ├── HSBC: Dynamic fraud detection
    └── Quant: Portfolio optimization, trading strategies
```

---

## 3. Profile Definition

### 3.1 Profile 1: CIB Business Risk

```yaml
profile_id: cib-risk
name: HSBC CIB Business Risk
description: Applied AI research for banking operational risk

query_template:
  tech_terms: [AI/ML technique from input]
  domain_terms: [fraud, AML, credit, risk, compliance, deepfake]
  industry_terms: [banking, financial]
  exclusions: [medical, quantum, astrophysics]

scoring_weights:
  technical: 0.30
  business: 0.40
  timeliness: 0.10
  practicality: 0.20

business_score_criteria:
  9-10: Explicit banking/fraud/risk application
  7-8: Banking/finance use case mentioned
  5-6: Financial keywords in financial context
  3-4: Pure technology, transferable but not explicit
  1-2: Completely outside domain

tag_categories:
  - ai-technology
  - business-area (fraud-detection, credit-assessment, compliance, etc.)
  - risk-category (credit-risk, fraud-risk, aml-risk, etc.)
  - regulatory (basel-iii, ifrs-9, etc.)
  - methodology

radar_focus: Tech adoption in banking risk operations
```

### 3.2 Profile 2: Quant Finance

```yaml
profile_id: quant-finance
name: Quantitative Finance Research
description: Mathematical models and AI for market behavior

query_template:
  tech_terms: [AI/ML technique from input]
  domain_terms: [portfolio, derivative, systemic, tail, volatility, pricing]
  industry_terms: [financial, market, trading]
  exclusions: [medical, gaming, entertainment]

scoring_weights:
  technical: 0.40
  business: 0.30
  timeliness: 0.10
  practicality: 0.20

business_score_criteria:
  9-10: Explicit quantitative finance application
  7-8: Market/trading/derivatives context
  5-6: Financial modeling keywords
  3-4: General mathematical finance
  1-2: Not finance-related

tag_categories:
  - ai-technology
  - quant-area (portfolio-optimization, derivatives-pricing, risk-modeling, etc.)
  - market-type (equity, fixed-income, derivatives, etc.)
  - methodology

radar_focus: AI techniques in quantitative finance
```

### 3.3 Profile 3: Human-AI / Future of Work (Future)

```yaml
profile_id: human-ai
name: Human-AI Interaction & Future of Work
description: AI agents, collective intelligence, productivity

query_template:
  tech_terms: [agents, swarms, LLM, automation]
  domain_terms: [productivity, collaboration, workflow, collective intelligence]
  industry_terms: [enterprise, workplace, organization]
  exclusions: [gaming, entertainment-only]

scoring_weights:
  technical: 0.40
  business: 0.30
  timeliness: 0.15
  practicality: 0.15

tag_categories:
  - ai-technology
  - interaction-type (human-AI, agent-agent, collective-intelligence)
  - application-area (productivity, workflow, decision-support)

radar_focus: AI agent technologies and human-AI collaboration
```

---

## 4. Architecture Considerations

### 4.1 Current System State

| Component | Current State | Profile-Aware? |
|-----------|---------------|----------------|
| Query Optimization | Banking-specific prompt | ❌ Hardcoded |
| Content Assessment | Banking risk scoring | ❌ Hardcoded |
| Tag Generation | Banking taxonomy | ❌ Hardcoded |
| Summary Generation | Technical/neutral | ✅ Already profile-agnostic |
| Database Schema | No profile field | ❌ Single profile |
| UI Filters | No profile filter | ❌ Single view |

### 4.2 Proposed Multi-Profile Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         SHARED INFRASTRUCTURE                                │
│  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐               │
│  │ ArXiv API │  │ SS API    │  │ LLM Svc   │  │ Database  │               │
│  └───────────┘  └───────────┘  └───────────┘  └───────────┘               │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                   ┌────────────────┼────────────────┐
                   ▼                ▼                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         PROFILE CONFIGURATION                                │
│                                                                             │
│  config/profiles/                                                           │
│  ├── cib-risk/                                                              │
│  │   ├── prompts.json        (query, assessment, tags)                     │
│  │   ├── scoring.json        (weights, criteria)                           │
│  │   └── taxonomy.json       (tag categories)                              │
│  ├── quant-finance/                                                         │
│  │   ├── prompts.json                                                        │
│  │   ├── scoring.json                                                        │
│  │   └── taxonomy.json                                                       │
│  └── human-ai/ (future)                                                     │
│      └── ...                                                                │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         DATABASE SCHEMA                                      │
│                                                                             │
│  papers                                                                     │
│  ├── id                                                                     │
│  ├── title                                                                  │
│  ├── abstract                                                               │
│  ├── ...                                                                    │
│  ├── profile_id              (NEW: which profile collected this)           │
│  ├── business_score_cib      (NEW: CIB-specific score)                     │
│  ├── business_score_quant    (NEW: Quant-specific score)                   │
│  └── business_score_human_ai (NEW: Human-AI score, future)                 │
│                                                                             │
│  Alternative (simpler):                                                      │
│  papers                                                                     │
│  ├── ...                                                                    │
│  ├── profile_id              (FK to profiles table)                        │
│  └── business_score          (scored for that profile)                     │
│                                                                             │
│  profiles (NEW)                                                             │
│  ├── id                                                                     │
│  ├── name                                                                   │
│  ├── config_path                                                            │
│  └── enabled                                                                │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                   ┌────────────────┼────────────────┐
                   ▼                ▼                ▼
┌─────────────────────┐ ┌─────────────────────┐ ┌─────────────────────┐
│   Tech Radar        │ │   Quant Finance     │ │   Cross-Section     │
│   (CIB View)        │ │   Radar             │ │   View              │
│                     │ │                     │ │                     │
│ Filter:             │ │ Filter:             │ │ Filter:             │
│ profile=cib-risk    │ │ profile=quant       │ │ Both profiles       │
│ OR score_cib >= 7   │ │ OR score_quant >= 7 │ │ high relevance      │
└─────────────────────┘ └─────────────────────┘ └─────────────────────┘
```

### 4.3 Collection Flow (Multi-Profile)

```
Option A: Separate Collection per Profile
─────────────────────────────────────────
1. User selects profile: "cib-risk"
2. Load config/profiles/cib-risk/*
3. Run collection with profile-specific prompts
4. Save papers with profile_id = "cib-risk"

Option B: Unified Collection, Multi-Score
────────────────────────────────────────
1. Run collection with broad query (all finance)
2. For each paper, score against ALL profiles
3. Save paper with multiple business_score_* fields
4. Papers can appear in multiple profile views

Option C: Primary + Secondary Profiles
──────────────────────────────────────
1. Primary profile: cib-risk (main collection focus)
2. Secondary: quant (also scored, but lower priority)
3. Query optimized for primary, but papers tagged for both
```

### 4.4 API Changes

```typescript
// Current
POST /api/collect
{
  query: "graph neural networks",
  mode: "pipeline"
}

// Multi-Profile
POST /api/collect
{
  query: "graph neural networks",
  mode: "pipeline",
  profile: "cib-risk"  // NEW: specify profile
}

// Response includes profile context
{
  success: true,
  profile: "cib-risk",
  papers: [...],
  ...
}
```

---

## 5. Implementation Roadmap

### Phase 1: Current (No Profile Changes)

- [x] Single profile: HSBC CIB Risk
- [ ] Fix query optimization (string output, 3-AND)
- [ ] Keep current prompts and scoring
- [ ] No database schema changes

### Phase 2: Add Quant Finance Profile

- [ ] Create config/profiles/quant-finance/
- [ ] Add prompts.json with quant-specific prompts
- [ ] Add scoring.json with quant-specific criteria
- [ ] Database: Add profile_id column (nullable, default "cib-risk")
- [ ] UI: Add profile selector in settings
- [ ] Collection: Accept profile parameter

### Phase 3: Cross-Profile Analytics

- [ ] Identify papers relevant to multiple profiles
- [ ] Cross-pollination recommendations ("This GNN paper on systemic risk may apply to AML")
- [ ] Unified Tech Radar with profile filter
- [ ] Shared techniques view (same AI tech, different domains)

### Phase 4: Human-AI Profile (Optional/Future)

- [ ] Create config/profiles/human-ai/
- [ ] May need broader domain (not just finance)
- [ ] Consider separate vs integrated collection

---

## 6. Refactoring Checklist (When Ready)

### 6.1 Prompts

```
Current:
  config/prompts.json

After:
  config/profiles/
  ├── cib-risk/
  │   └── prompts.json
  └── quant-finance/
      └── prompts.json
```

Changes:
- [ ] Create profile folder structure
- [ ] Move current prompts.json to cib-risk/
- [ ] Create quant-finance/prompts.json
- [ ] Update prompt loading logic in code

### 6.2 Database

```sql
-- Option A: Single profile_id per paper
ALTER TABLE papers ADD COLUMN profile_id VARCHAR(50) DEFAULT 'cib-risk';

-- Option B: Multiple scores per paper
ALTER TABLE papers ADD COLUMN business_score_cib DECIMAL(3,2);
ALTER TABLE papers ADD COLUMN business_score_quant DECIMAL(3,2);
```

Changes:
- [ ] Add migration script
- [ ] Update Prisma schema
- [ ] Update paper creation logic

### 6.3 Collection Service

```typescript
// Current
export async function runCollection(options: CollectionOptions)

// Multi-Profile
export async function runCollection(options: CollectionOptions & { profile?: string })
```

Changes:
- [ ] Load profile config based on parameter
- [ ] Use profile-specific prompts
- [ ] Store profile_id with papers

### 6.4 UI Components

- [ ] Settings: Profile selector
- [ ] Tech Radar: Profile filter dropdown
- [ ] Paper list: Show profile badge
- [ ] Dashboard: Profile-specific stats

---

## 7. Design Decisions (To Be Made)

| Decision | Options | Recommendation |
|----------|---------|----------------|
| One paper, one profile or multiple? | A) profile_id only<br>B) multiple scores | **A for simplicity** |
| Separate or unified collection? | A) Per-profile runs<br>B) One run, multi-score | **A for Phase 2** |
| Profile-specific tags? | A) Shared taxonomy<br>B) Profile-specific | **A for consistency** |
| Cross-profile recommendations? | A) Manual only<br>B) Auto-suggest | **B in Phase 3** |

---

## 8. Effort Estimation

| Phase | Effort | Dependencies |
|-------|--------|--------------|
| Phase 2 (Add Quant Profile) | 2-3 days | None |
| Phase 3 (Cross-Profile) | 3-5 days | Phase 2 complete |
| Phase 4 (Human-AI) | 2-3 days | Phase 2 complete |

**Total for full multi-profile support: ~1-2 weeks**

---

## 9. References

- Query Optimization Analysis: `refactor/2026-02-20_query_optimization_analysis.md`
- LLM Stability Report: `refactor/2026-02-20_llm_stability_test_report.md`
- System Refactor Summary: `refactor/2026-02-17_system_refactor_summary.md`

---

*Document created: 2026-02-20*
*Last updated: 2026-02-20*
*Status: Draft - Revisit when implementing multi-profile support*
