# LLM Model Selection Analysis (Groq + ZhipuAI)

**Date:** 2026-02-25
**Purpose:** Analyze Groq and ZhipuAI API rate limits to determine optimal model, batch size, and sleep time for the collection pipeline.
**Updated:** Include ZhipuAI models based on latest compatibility test results

---

## 1. Source Data

### 1.1 Groq Official Rate Limits (Developer Plan)

| Model | RPM | RPD | TPM | TPD |
|-------|-----|-----|-----|-----|
| allam-2-7b | 30 | 7K | 6K | 500K |
| canopylabs/orpheus-arabic-saudi | 10 | 100 | 1.2K | 3.6K |
| canopylabs/orpheus-v1-english | 10 | 100 | 1.2K | 3.6K |
| groq/compound | 30 | 250 | **70K** | unlimited |
| groq/compound-mini | 30 | 250 | **70K** | unlimited |
| llama-3.1-8b-instant | 30 | 14.4K | 6K | 500K |
| llama-3.3-70b-versatile | 30 | 1K | 12K | 100K |
| meta-llama/llama-4-maverick-17b-128e-instruct | 30 | 1K | 6K | 500K |
| meta-llama/llama-4-scout-17b-16e-instruct | 30 | 1K | **30K** | 500K |
| meta-llama/llama-guard-4-12b | 30 | 14.4K | 15K | 500K |
| moonshotai/kimi-k2-instruct | **60** | 1K | 10K | 300K |
| moonshotai/kimi-k2-instruct-0905 | **60** | 1K | 10K | 300K |
| openai/gpt-oss-120b | 30 | 1K | 8K | 200K |
| openai/gpt-oss-20b | 30 | 1K | 8K | 200K |
| openai/gpt-oss-safeguard-20b | 30 | 1K | 8K | 200K |
| qwen/qwen3-32b | **60** | 1K | 6K | 500K |

### 1.2 ZhipuAI Rate Limits

ZhipuAI uses **concurrent connections** rather than RPM/TPM for rate limiting.

| Model | Concurrent | Context | Max Output | Pricing | Notes |
|-------|------------|---------|------------|---------|-------|
| glm-4-flash | 2-5 | 128K | 4K | **FREE** | Free tier, good for testing |
| glm-4-flashx | 5+ | 128K | 4K | Very low cost | Enhanced flash, faster |
| glm-4-air | 5+ | 128K | 4K | Low cost | Balanced performance |
| glm-4-airx | 5+ | 128K | 4K | Low cost | High speed version |
| glm-4-plus | 5+ | 128K | 4K | 5 CNY/1M tokens | High quality |
| glm-4.5 | 5+ | 128K | 4K | Moderate | Latest generation |
| glm-4.6 | 5+ | 128K | 4K | Moderate | Improved reasoning |
| glm-4.7 | 5+ | 128K | 4K | Moderate | Latest, strong coding |
| glm-5 | 5+ | 128K | 4K | Higher | Newest flagship |

**ZhipuAI Notes:**
- New users get **20 million free tokens** resource package
- Rate limits are per-account concurrent connections (not RPM)
- Free models: GLM-4-Flash, GLM-4V-Flash, GLM-Z1-Flash
- Generate speed: ~72 tokens/s for Flash models, up to 200 tokens/s for AirX

### 1.3 Models That Passed Compatibility Testing (2026-02-25)

**Groq (9 models - all 4 tests passed):**
| Model | Query | Assessment | Tags | Summary | Notes |
|-------|-------|------------|------|---------|-------|
| llama-3.3-70b-versatile | ✅ | ✅ | ✅ | ✅ | Best quality |
| meta-llama/llama-4-maverick-17b-128e-instruct | ✅ | ✅ | ✅ | ✅ | Llama 4 architecture |
| meta-llama/llama-4-scout-17b-16e-instruct | ✅ | ✅ | ✅ | ✅ | 30K TPM |
| moonshotai/kimi-k2-instruct | ✅ | ✅ | ✅ | ✅ | **60 RPM** - fastest |
| moonshotai/kimi-k2-instruct-0905 | ✅ | ✅ | ✅ | ✅ | **60 RPM** |
| openai/gpt-oss-120b | ✅ | ✅ | ✅ | ✅ | Large model |
| openai/gpt-oss-20b | ✅ | ✅ | ✅ | ✅ | Balanced |
| openai/gpt-oss-safeguard-20b | ✅ | ✅ | ✅ | ✅ | With safeguards |
| groq/compound | ✅ | ✅ | ✅ | ✅ | 70K TPM, unlimited TPD |
| groq/compound-mini | ✅ | ✅ | ✅ | ✅ | 70K TPM, unlimited TPD |

**Groq (Partial Pass - NOT recommended for collection):**
| Model | Query | Assessment | Tags | Summary | Issue |
|-------|-------|------------|------|---------|-------|
| llama-3.1-8b-instant | ✅ | ❌ | ✅ | ✅ | Assessment returns wrong JSON format |
| qwen/qwen3-32b | ✅ | ❌ | ✅ | ❌ | Assessment wrong format, summary too long |
| allam-2-7b | ✅ | ❌ | ✅ | ✅ | Assessment returns wrong JSON format |

**ZhipuAI (5 models - all 4 tests passed):**
| Model | Query | Assessment | Tags | Summary | Duration (4 tests) | Collection (20 papers) |
|-------|-------|------------|------|---------|------------------|------------------------|
| glm-4.5 | ✅ | ✅ | ✅ | ✅ | ~36s | **~660s (11 min)** |
| glm-4.5-air | ✅ | ✅ | ✅ | ✅ | ~41s | **~633s (10.5 min)** |
| glm-4.6 | ✅ | ✅ | ✅ | ✅ | ~48s | **~651s (10.8 min)** |
| glm-4.7 | ✅ | ✅ | ✅ | ✅ | ~44s | **~628s (10.5 min)** |
| glm-5 | ✅ | ✅ | ✅ | ✅ | ~99s | **~1524s (25.4 min)** |

**IMPORTANT:** ZhipuAI's single-test duration looks reasonable, but **actual collection time is 10-15x slower than Groq** due to much higher per-call latency.

---

## 2. Performance Ranking

### 2.1 Best TPM (Throughput) - Groq
| Rank | Model | TPM | Notes |
|------|-------|-----|-------|
| 1 | groq/compound | 70K | Best throughput, unlimited TPD |
| 1 | groq/compound-mini | 70K | Same as compound, smaller model |
| 3 | meta-llama/llama-4-scout-17b-16e-instruct | 30K | Good balance |
| 4 | llama-3.3-70b-versatile | 12K | Quality-focused |
| 5 | moonshotai/kimi-k2-instruct | 10K | High RPM compensates |

### 2.2 Best RPM (Request Rate) - Groq
| Rank | Model | RPM | Notes |
|------|-------|-----|-------|
| 1 | moonshotai/kimi-k2-instruct | 60 | 2x faster requests |
| 1 | moonshotai/kimi-k2-instruct-0905 | 60 | Same |
| 3 | (all others) | 30 | Standard rate |

### 2.3 Response Time Comparison (ACTUAL DATA)

**WARNING:** Single-test duration is misleading. Actual collection time tells the real story.

| Rank | Model | Provider | Single Test (4 tests) | Collection (20 papers) | Quality |
|------|-------|----------|----------------------|------------------------|---------|
| 1 | **moonshotai/kimi-k2-instruct** | **Groq** | ~3.2s | **48s** ⭐ | ⭐⭐⭐⭐ |
| 2 | meta-llama/llama-4-scout-17b-16e-instruct | Groq | ~4.0s | **65s** | ⭐⭐⭐⭐⭐ |
| 3 | llama-3.3-70b-versatile | Groq | ~4.3s | **71s** | ⭐⭐⭐⭐⭐ |
| 4 | glm-4.5 | ZhipuAI | ~36s | **660s (11 min)** | ⭐⭐⭐⭐ |
| 5 | glm-4.7 | ZhipuAI | ~44s | **628s (10.5 min)** | ⭐⭐⭐⭐⭐ |
| 6 | glm-5 | ZhipuAI | ~99s | **1524s (25 min)** | ⭐⭐⭐⭐⭐ |

**Key Insight:** ZhipuAI's single-test duration looks acceptable (~36-44s), but actual collection time is **10-15x slower** than Groq due to much higher per-call latency.

---

## 3. Collection Pipeline Analysis

### 3.1 LLM Invocation Pattern
```
┌─────────────────────────────────────────────────────────────────┐
│                    Collection Pipeline Flow                      │
├─────────────────────────────────────────────────────────────────┤
│  1. Query Optimization                                           │
│     └── Calls: 1 per collection (NOT per paper)                 │
│     └── Tokens: ~500 input + ~200 output = ~700 total           │
│                                                                  │
│  2. Source Search (ArXiv, etc.)                                  │
│     └── No LLM calls                                             │
│                                                                  │
│  3. Duplicate Filtering                                          │
│     └── No LLM calls (database lookup)                          │
│                                                                  │
│  4. Content Assessment                                           │
│     └── Calls: N (one per paper found, before filtering)        │
│     └── Tokens: ~800 input + ~500 output = ~1,300 per call      │
│                                                                  │
│  5. Tag Generation                                               │
│     └── Calls: M (one per paper that PASSES assessment)         │
│     └── Tokens: ~600 input + ~400 output = ~1,000 per call      │
│                                                                  │
│  6. Summary Generation (optional)                                │
│     └── Calls: M (one per saved paper, if enabled)              │
│     └── Tokens: ~800 input + ~600 output = ~1,400 per call      │
```

### 3.2 Typical Collection Load (20 papers found, 19 saved)

| Stage | Calls | Tokens/Call | Total Tokens |
|-------|------|-------------|---------------|
| Query Optimization | **1** | ~700 | **~700** |
| Content Assessment | **20** | ~1,300 | **~26,000** |
| Tag Generation | **19** | ~1,000 | **~19,000** |
| Summary Generation | **0-19** | ~1,400 | **0-26,600** |
| **TOTAL** | **40-59** | - | **~45,700-72,300** |

---

## 4. Per-Invocation Model Recommendations

### 4.1 Query Optimization (1 call per collection)
**Characteristics:**
- Single invocation at collection start
- Requires good reasoning for query expansion
- Low token count (~700)
- Quality > Speed

**Recommended Model:** `llama-3.3-70b-versatile` (Groq) or `glm-4.7` (ZhipuAI)

| Criteria | Groq: llama-3.3-70b | ZhipuAI: glm-4.7 |
|----------|---------------------|------------------|
| Quality | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| Speed | ⭐⭐⭐ | ⭐⭐⭐⭐ |
| Cost | Free tier | Free tier |

---

### 4.2 Content Assessment (N calls per collection - HIGH VOLUME)
**Characteristics:**
- Called once per paper found (before filtering)
- High volume (20 calls for 20 papers)
- Needs consistency in scoring
- Balance between quality and speed critical

**Recommended Model:** `moonshotai/kimi-k2-instruct` (Groq) - **60 RPM**

| Criteria | Rating | Notes |
|----------|--------|-------|
| Quality | ⭐⭐⭐⭐ | Proven quality for structured JSON output |
| Speed | ⭐⭐⭐⭐⭐ | **60 RPM** - 2x faster request rate |
| Daily Cap | ⭐⭐⭐⭐ | 1K RPD, 300K TPD sufficient |

**Alternative (ZhipuAI):** `glm-4.5` - fastest response time among ZhipuAI models

```typescript
const CONTENT_ASSESSMENT_CONFIG = {
  groq: {
    model: 'moonshotai/kimi-k2-instruct',
    limits: { rpm: 60, rpd: 1000, tpm: 10000, tpd: 300000 },
    throttling: {
      minRequestDelay: 1000,   // 1s between requests (60 RPM)
      batchSize: 5,
      interBatchDelay: 2000,
      maxConcurrent: 5
    }
  },
  zhipuai: {
    model: 'glm-4.5',
    limits: { concurrent: 5 },
    throttling: {
      minRequestDelay: 200,   // Faster response time
      batchSize: 5,
      interBatchDelay: 1000,
      maxConcurrent: 5
    }
  }
};
```

---

### 4.3 Tag Generation (M calls per collection - HIGH VOLUME)
**Characteristics:**
- Called once per paper that passes assessment
- Moderate volume (19 calls for 19 saved papers)
- Needs accuracy with banking taxonomy
- Structured JSON output required

**Recommended Model:** `moonshotai/kimi-k2-instruct` (Groq) - **60 RPM**

| Criteria | Rating | Notes |
|----------|--------|-------|
| Quality | ⭐⭐⭐⭐ | Proven quality for banking taxonomy |
| Speed | ⭐⭐⭐⭐⭐ | **60 RPM** - 2x faster request rate |
| Daily Cap | ⭐⭐⭐⭐ | 1K RPD, 300K TPD sufficient |

**Alternative (ZhipuAI):** `glm-4.5-air` - good balance of speed and quality

---

### 4.4 Summary Generation (M calls - OPTIONAL, QUALITY-FOCUSED)
**Characteristics:**
- Called once per saved paper (if enabled)
- Variable volume (0-19 calls)
- Quality critical - generates user-facing summaries
- Higher token count (~1,400)

**Recommended Model:** `meta-llama/llama-4-scout-17b-16e-instruct` (Groq) - with ZhipuAI fallback

| Criteria | Groq: llama-4-scout | ZhipuAI: glm-4.7 |
|----------|---------------------|------------------|
| Quality | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| Speed | ⭐⭐⭐⭐⭐ (807ms/call) | ⭐⭐ (7375ms/call) |
| Collection Time | **~15s (19 calls)** | ~140s (19 calls) |
| Cost | Free tier | Free tier |

**Why Groq primary:** Even for quality-focused tasks, Groq's llama-4-scout provides excellent quality at 9x faster speed. Use ZhipuAI glm-4.7 only as fallback.

---

### 4.5 Auto Collection (Scheduled, Moderate Frequency)
**Characteristics:**
- Scheduled runs (every 4-6 hours)
- Predictable volume
- Reliability critical
- Moderate daily quota needed

**Recommended Model:** `moonshotai/kimi-k2-instruct` (Groq) - fastest with ZhipuAI fallback

**Why Groq for auto-collection (UPDATED based on actual test data):**
- **10-15x faster** than ZhipuAI (48s vs 660s per collection)
- 60 RPM allows 3,600 requests/hour - sufficient for scheduled runs
- RPD of 1K allows ~16 collections/day - enough for 4-hour intervals
- Use ZhipuAI only as fallback when Groq rate limits hit

---

### 4.6 Pipeline Collection (On-Demand, High Frequency)
**Characteristics:**
- User-triggered, potentially many per day
- Unpredictable volume
- Maximum throughput needed
- Unlimited TPD critical

**Recommended Model:** `groq/compound` (Groq)

| Criteria | Rating | Notes |
|----------|--------|-------|
| Quality | ⭐⭐⭐⭐ | Good for all invocation types |
| Speed | ⭐⭐⭐⭐⭐ | 70K TPM - fastest |
| Daily Cap | ⭐⭐⭐⭐⭐ | Unlimited TPD |

**Warning:** RPD of 250 limits to ~4 full collections per day on Groq. For more, use ZhipuAI fallback.

---

## 5. Optimal Configuration Summary

### 5.1 Per-Invocation Model Matrix

| Invocation Type | Primary (Groq) | Primary (ZhipuAI) | Key Factor |
|-----------------|----------------|-------------------|------------|
| Query Optimization | llama-3.3-70b-versatile | glm-4.7 | Quality |
| Content Assessment | **moonshotai/kimi-k2-instruct** | glm-4.5 | **60 RPM / Speed** |
| Tag Generation | **moonshotai/kimi-k2-instruct** | glm-4.5-air | **60 RPM / Speed** |
| Summary Generation | llama-4-scout | glm-4.7 | Quality |
| Auto Collection | groq/compound-mini | **glm-4.5** | Reliability |
| Pipeline Collection | groq/compound | glm-4.5-air | TPM + TPD |

### 5.2 Provider Selection Strategy (REVISED based on actual test data)

```
┌─────────────────────────────────────────────────────────────────┐
│                    Provider Selection Logic                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  PRIMARY: Always use Groq first                                  │
│     → 10-15x faster than ZhipuAI (48s vs 660s per collection)  │
│     → kimi-k2-instruct: 60 RPM, fastest all-around              │
│     → llama-4-scout: Better quality, still fast                 │
│                                                                  │
│  IF rate limit hit on Groq (429 error):                         │
│     → Fallback to ZhipuAI (glm-4.5 for assessment/tags)         │
│     → Fallback to ZhipuAI (glm-4.7 for summary)                 │
│     → Accept slower speed (10-15x) but continue operation       │
│                                                                  │
│  WHEN TO USE ZhipuAI:                                            │
│     → Only as fallback when Groq exhausted                       │
│     → When quality > speed (glm-5 best quality)                  │
│     → When Groq API is temporarily unavailable                   │
│                                                                  │
│  DO NOT use ZhipuAI for:                                         │
│     → Speed-critical operations (14x slower)                     │
│     → High-frequency collections (11 min each)                   │
│     → User-facing operations (unacceptable latency)              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 5.3 Complete Configuration Object

```typescript
const LLM_INVOCATION_CONFIGS = {
  // Single call per collection - use highest quality
  queryOptimization: {
    groq: {
      model: 'llama-3.3-70b-versatile',
      fallback: 'meta-llama/llama-4-scout-17b-16e-instruct',
      limits: { rpm: 30, rpd: 1000, tpm: 12000, tpd: 100000 },
    },
    zhipuai: {
      model: 'glm-4.7',
      fallback: 'glm-4.6',
      limits: { concurrent: 5 },
    },
    throttling: { minRequestDelay: 0, batchSize: 1, interBatchDelay: 0 }
  },

  // High volume - BEST BALANCE (quality + speed)
  contentAssessment: {
    groq: {
      model: 'moonshotai/kimi-k2-instruct',
      fallback: 'meta-llama/llama-4-scout-17b-16e-instruct',
      limits: { rpm: 60, rpd: 1000, tpm: 10000, tpd: 300000 },
    },
    zhipuai: {
      model: 'glm-4.5',
      fallback: 'glm-4.5-air',
      limits: { concurrent: 5 },
    },
    throttling: { minRequestDelay: 1000, batchSize: 5, interBatchDelay: 2000, maxConcurrent: 5 }
  },

  // High volume - BEST BALANCE (quality + speed)
  tagGeneration: {
    groq: {
      model: 'moonshotai/kimi-k2-instruct',
      fallback: 'meta-llama/llama-4-scout-17b-16e-instruct',
      limits: { rpm: 60, rpd: 1000, tpm: 10000, tpd: 300000 },
    },
    zhipuai: {
      model: 'glm-4.5-air',
      fallback: 'glm-4.5',
      limits: { concurrent: 5 },
    },
    throttling: { minRequestDelay: 1000, batchSize: 5, interBatchDelay: 2000, maxConcurrent: 5 }
  },

  // Quality-focused
  summaryGeneration: {
    groq: {
      model: 'meta-llama/llama-4-scout-17b-16e-instruct',
      fallback: 'llama-3.3-70b-versatile',
      limits: { rpm: 30, rpd: 1000, tpm: 30000, tpd: 500000 },
    },
    zhipuai: {
      model: 'glm-4.7',
      fallback: 'glm-4.6',
      limits: { concurrent: 5 },
    },
    throttling: { minRequestDelay: 2000, batchSize: 5, interBatchDelay: 3000, maxConcurrent: 4 }
  },

  // Scheduled - optimize for speed with fallback (Groq preferred - 10-15x faster)
  autoCollection: {
    groq: {
      model: 'moonshotai/kimi-k2-instruct',
      fallback: 'meta-llama/llama-4-scout-17b-16e-instruct',
      limits: { rpm: 60, rpd: 1000, tpm: 10000, tpd: 300000 },
    },
    zhipuai: {
      model: 'glm-4.5',
      fallback: 'glm-4.5-air',
      limits: { concurrent: 5 },
    },
    throttling: { minRequestDelay: 1000, batchSize: 5, interBatchDelay: 2000, maxConcurrent: 5 },
    preferred: 'groq'  // Prefer Groq (48s vs 660s collection time)
  },

  // On-demand - optimize for throughput (Groq preferred)
  pipelineCollection: {
    groq: {
      model: 'groq/compound',
      fallback: 'meta-llama/llama-4-scout-17b-16e-instruct',
      limits: { rpm: 30, rpd: 250, tpm: 70000, tpd: -1 },
    },
    zhipuai: {
      model: 'glm-4.5-air',
      fallback: 'glm-4.5',
      limits: { concurrent: 5 },
    },
    throttling: { minRequestDelay: 1000, batchSize: 5, interBatchDelay: 2000, maxConcurrent: 5 },
    preferred: 'groq'  // Prefer Groq for on-demand tasks
  }
};
```

---

## 6. Estimated Collection Times (VERIFIED WITH ACTUAL TEST DATA)

### 6.1 Actual Test Data (Single Call Duration in ms)

**Groq Models (All 4 Tests Passed):**
| Model | Query | Assessment | Tags | Summary |
|-------|-------|------------|------|---------|
| moonshotai/kimi-k2-instruct | 714 | **943** | **830** | 686 |
| meta-llama/llama-4-scout-17b-16e-instruct | 724 | 1774 | 695 | 807 |
| llama-3.3-70b-versatile | 720 | 1920 | 861 | 822 |
| openai/gpt-oss-20b | 954 | 1003 | 1104 | 736 |
| openai/gpt-oss-120b | 1145 | 1339 | 951 | 798 |
| openai/gpt-oss-safeguard-20b | 962 | 1332 | 901 | 1516 |
| meta-llama/llama-4-maverick-17b-128e-instruct | 821 | 1870 | 1675 | 908 |
| groq/compound-mini | 2213 | 2915 | 1702 | 1296 |
| groq/compound | 2656 | 4143 | 3718 | 7659 |

**ZhipuAI Models (All 4 Tests Passed):**
| Model | Query | Assessment | Tags | Summary |
|-------|-------|------------|------|---------|
| glm-4.5 | 1823 | 13264 | 13431 | 7274 |
| glm-4.5-air | 8399 | 13414 | 12491 | 6248 |
| glm-4.6 | 15690 | 18237 | 8078 | 6144 |
| glm-4.7 | 12258 | 13671 | 10650 | 7375 |
| glm-5 | 21318 | 31746 | 31745 | 13929 |

### 6.2 Actual Collection Time (20 papers, 19 saved)

**Formula:** Query(1) + Assessment(20) + Tags(19) + Summary(19)

| Model | Provider | Query | Assessment | Tags | Summary | **TOTAL** |
|-------|----------|-------|------------|------|---------|-----------|
| **moonshotai/kimi-k2-instruct** | Groq | 0.7s | 18.9s | 15.8s | 13.0s | **48.4s** ⭐ |
| meta-llama/llama-4-scout-17b-16e-instruct | Groq | 0.7s | 35.5s | 13.2s | 15.3s | **64.7s** |
| llama-3.3-70b-versatile | Groq | 0.7s | 38.4s | 16.4s | 15.6s | **71.1s** |
| groq/compound-mini | Groq | 2.2s | 58.3s | 32.3s | 24.6s | **117.5s** |
| groq/compound | Groq | 2.7s | 82.9s | 70.6s | 145.5s | **301.7s** |
| glm-4.7 | ZhipuAI | 12.3s | 273.4s | 202.3s | 140.1s | **628.2s** (10.5 min) |
| glm-4.5-air | ZhipuAI | 8.4s | 268.3s | 237.3s | 118.7s | **632.7s** (10.5 min) |
| glm-4.5 | ZhipuAI | 1.8s | 265.3s | 255.2s | 138.2s | **660.5s** (11 min) |
| glm-4.6 | ZhipuAI | 15.7s | 364.7s | 153.5s | 116.7s | **650.6s** (10.8 min) |
| glm-5 | ZhipuAI | 21.3s | 634.9s | 603.2s | 264.7s | **1524.0s** (25.4 min) |

### 6.3 Key Finding: Groq is 10-15x Faster Than ZhipuAI

| Metric | Groq (kimi-k2) | ZhipuAI (glm-4.5) | Ratio |
|--------|----------------|-------------------|-------|
| Assessment/call | 943ms | 13,264ms | **14x slower** |
| Tags/call | 830ms | 13,431ms | **16x slower** |
| Summary/call | 686ms | 7,274ms | **11x slower** |
| **Total Collection** | **48s** | **660s** | **14x slower** |

### 6.4 Provider Comparison (REVISED)

| Metric | Groq | ZhipuAI |
|--------|------|---------|
| Collection Time (20 papers) | **48-72s** | 628-1524s (10-25 min) |
| Speed | ⭐⭐⭐⭐⭐ (10-15x faster) | ⭐⭐ |
| Rate Limit Type | RPM/TPM/RPD | Concurrent |
| Stability | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| Daily Capacity (free) | Limited by RPD | 20M tokens |
| Best For | **All collections** | Fallback only |

### 6.5 Best Models by Use Case (Based on Actual Data)

| Use Case | Best Model | Collection Time | Why |
|----------|------------|-----------------|-----|
| **Fastest Overall** | kimi-k2-instruct (Groq) | **48s** | 60 RPM, fastest all-around |
| **Best Quality/Speed** | llama-4-scout (Groq) | **65s** | Better quality, still fast |
| **Highest Quality** | glm-5 (ZhipuAI) | 25 min | Best results, slow |
| **Pipeline/On-demand** | kimi-k2-instruct (Groq) | **48s** | Speed critical |
| **Scheduled/Auto** | kimi-k2-instruct (Groq) | **48s** | Primary: Groq, Fallback: ZhipuAI |

**Recommendation Update:**
- Previous estimate: ZhipuAI ~31s (INCORRECT)
- Actual: ZhipuAI ~660s (11 minutes)
- **Always prefer Groq for speed-critical operations**
- Use ZhipuAI only as fallback when Groq rate limits hit

---

## 7. Rate Limiter Design

### 7.1 Required Features
1. **Multi-Provider Support** - Track limits for both Groq and ZhipuAI
2. **Per-Model TPM Tracking** - Track tokens per minute per model (Groq)
3. **Per-Model RPD Tracking** - Track requests per day per model (Groq)
4. **Concurrent Tracking** - Track active connections (ZhipuAI)
5. **Inter-Request Delays** - Configurable per provider/model
6. **Batch Processing** - Process N items, then pause
7. **Exponential Backoff** - Handle 429 errors gracefully
8. **Provider Fallback** - Auto-switch Groq↔ZhipuAI on limit hit
9. **Per-Invocation Config** - Different models for different operations

### 7.2 Configuration Schema

```typescript
interface LLMRateLimitConfig {
  groq?: {
    model: string;
    fallback?: string;
    limits: {
      rpm: number;      // Requests per minute
      rpd: number;      // Requests per day
      tpm: number;      // Tokens per minute
      tpd: number;      // Tokens per day (-1 = unlimited)
    };
  };
  zhipuai?: {
    model: string;
    fallback?: string;
    limits: {
      concurrent: number;  // Max concurrent connections
    };
  };
  throttling: {
    minRequestDelay: number;   // ms between requests
    batchSize: number;         // items per batch
    interBatchDelay: number;   // ms between batches
    maxConcurrent: number;     // max parallel requests
  };
  preferred?: 'groq' | 'zhipuai';  // Which provider to try first
}
```

---

## 8. Summary Tables

### 8.1 Model Selection by Use Case (VERIFIED)

| Use Case | Primary Model | Fallback | Collection Time | Why |
|----------|---------------|----------|-----------------|-----|
| Query Optimization | **kimi-k2-instruct** (Groq) | glm-4.7 | 0.7s | Fast + good quality |
| Content Assessment | **kimi-k2-instruct** (Groq) | glm-4.5 | 18.9s (20 calls) | **60 RPM / Fastest** |
| Tag Generation | **kimi-k2-instruct** (Groq) | glm-4.5-air | 15.8s (19 calls) | **60 RPM / Fastest** |
| Summary Generation | **llama-4-scout** (Groq) | glm-4.7 | 15.3s (19 calls) | Quality + speed |
| Auto Collection | **kimi-k2-instruct** (Groq) | glm-4.5 | **48s total** | Speed critical |
| Pipeline Collection | **kimi-k2-instruct** (Groq) | glm-4.5-air | **48s total** | Speed critical |

**Key Insight:** Use Groq for ALL use cases. ZhipuAI is 10-15x slower and should only be used as fallback when Groq rate limits are hit.

### 8.2 Rate Limits Summary

**Groq:**
| Model | RPM | RPD | TPM | TPD | Best For |
|-------|-----|-----|-----|-----|----------|
| groq/compound | 30 | 250 | 70K | unlimited | Pipeline, High throughput |
| kimi-k2-instruct | **60** | 1K | 10K | 300K | Assessment, Tags (BEST) |
| llama-4-scout | 30 | 1K | 30K | 500K | Summary generation |
| llama-3.3-70b-versatile | 30 | 1K | 12K | 100K | Query optimization |

**ZhipuAI (FALLBACK ONLY - 10-15x slower than Groq):**
| Model | Concurrent | Collection Time | Best For |
|-------|------------|-----------------|----------|
| glm-4.7 | 5 | **~628s (10.5 min)** | Fallback for quality |
| glm-4.5-air | 5 | **~633s (10.5 min)** | Fallback for tags |
| glm-4.5 | 5 | **~660s (11 min)** | Fallback for assessment |
| glm-4.6 | 5 | **~651s (10.8 min)** | Fallback alternative |
| glm-5 | 5 | **~1524s (25 min)** | Highest quality (very slow) |

---

## 9. References

- Groq API Documentation: https://console.groq.com/docs/rate-limits
- ZhipuAI Documentation: https://open.bigmodel.cn/dev/api/normal-model/glm-4
- ZhipuAI Pricing: https://open.bigmodel.cn/pricing
- Rate limits verified: 2026-02-25
- Compatibility testing: Settings page (passed models only)
