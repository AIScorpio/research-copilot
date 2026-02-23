# LLM Model Compatibility Test - System Design Document

**Created**: 2026-02-23
**Status**: Draft
**Priority**: High
**Scope**: Holistic design for model discovery, testing, and validation

---

## Table of Contents

1. [Design Principles](#design-principles)
2. [Overview](#overview)
3. [Architecture](#architecture)
4. [Component Design](#component-design)
5. [API Specification](#api-specification)
6. [Test Execution Pipeline](#test-execution-pipeline)
7. [Model Fetcher Consolidation](#model-fetcher-consolidation)
8. [Data Models](#data-models)
9. [Configuration](#configuration)
10. [Logging & Persistence](#logging--persistence)
11. [Implementation Roadmap](#implementation-roadmap)

---

## Design Principles

### Core Principles

| Principle | Description | Application |
|-----------|-------------|-------------|
| **No Hardcoding** | Never hardcode values that may change; use configuration | Model lists, API endpoints, validation thresholds |
| **Data as Parameters** | Pass data as parameters, not embedded in logic | Test cases, prompts, validation rules all externalized |
| **Single Source of Truth** | Each piece of logic exists in exactly one place | Model fetchers, LLM client, validators |
| **API Keys in .env Only** | Credentials never stored in database | All API keys from environment variables |
| **Fail Gracefully** | Provide clear error messages, don't crash | Missing keys, API errors, parse failures |
| **Separation of Concerns** | Each module has a single responsibility | Fetcher, executor, validator, client are separate |

### Configuration-Driven Design

The system follows a **configuration-first** approach where behavior is controlled by external files rather than code:

```
┌─────────────────────────────────────────────────────────────────┐
│                    Configuration Files                          │
├─────────────────────────────────────────────────────────────────┤
│  .env                    → API keys (never in DB)               │
│  config/prompts.json     → System prompts for each test type    │
│  config/llm-test-cases.json → Test input data & validation rules│
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Application Code                             │
│                    (Reads config, doesn't embed values)         │
└─────────────────────────────────────────────────────────────────┘
```

### Why This Matters

| Anti-Pattern | Correct Pattern |
|--------------|-----------------|
| `if (provider === 'zhipuai') { return ['glm-4', 'glm-5'] }` | `fetch('https://open.bigmodel.cn/.../models')` |
| `const MIN_LENGTH = 50;` hardcoded in function | `{ "minLength": 50 }` in config file |
| Storing `apiKey` in database | Reading `process.env.ZHIPUAI_API_KEY` |
| Validation rules in code | Validation rules in `llm-test-cases.json` |

---

## Overview

### Purpose

The LLM Model Compatibility Test system validates whether LLM models from various providers correctly handle the application's core prompts:

1. **Query Optimization** - Boolean query generation
2. **Content Assessment** - JSON-based paper scoring
3. **Tag Generation** - Structured tag array output
4. **Summary Generation** - Text summarization with length constraints

### Problem Statement

The system currently has **fragmented implementations** across multiple concerns:

| Concern | Current State | Issue |
|---------|--------------|-------|
| Model Discovery | Duplicated in `/api/llm-models` and `/api/llm-providers` | Inconsistent lists, maintenance burden |
| LLM Invocation | Inline in `/api/llm-models/test/route.ts` | Not reusable, duplicated logic |
| Test Validation | Mixed in test route | Hard to maintain validation rules |
| Result Persistence | File-based JSON logs | No history browsing, manual inspection needed |

### Goals

1. **Single Source of Truth** - One module for fetching models from any provider
2. **Reusable LLM Client** - Shared invocation logic for tests and production
3. **Configuration-Driven** - Test cases, prompts, and rules externalized
4. **Observable Results** - Persistent test history with queryable results

**Current Scope**: Groq, ZhipuAI, and Ollama only (3 providers). Other providers (Kimi, OpenAI, Anthropic) have code paths in `llm-providers/route.ts` but are not actively integrated into the test panel and should be deferred until the architecture is stable.

---

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Settings Page                                   │
│                     /settings (LLMModelTester Component)                     │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           API Layer                                          │
├────────────────────────────────────┬────────────────────────────────────────┤
│      /api/llm-models               │       /api/llm-models/test             │
│      (Model Discovery)             │       (Test Execution)                 │
│                                    │                                        │
│  GET  → List available models      │  POST → Run compatibility tests       │
│  GET  → Load last test results     │  Streaming SSE for progress           │
└────────────────────────────────────┴────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Shared Libraries                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │              src/lib/llm-model-fetcher.ts                           │   │
│  │              (Single Source of Truth for Model Discovery)           │   │
│  │                                                                      │   │
│  │  - fetchGroqModels()        - fetchZhipuModels()                    │   │
│  │  - fetchOllamaModels()      - fetchKimiModels()                     │   │
│  │  - fetchOpenAIModels()      - fetchAnthropicModels()                │   │
│  │  - fetchAvailableModels(provider, config)  [main entry]             │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │              src/lib/llm-test-executor.ts                           │   │
│  │              (Test Execution Engine)                                 │   │
│  │                                                                      │   │
│  │  - executeTest(model, testType, config)                             │   │
│  │  - validateResult(testType, content, rules)  ← rules from config    │   │
│  │  - runFullSuite(models, config)                                     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │              src/lib/llm-provider-client.ts                         │   │
│  │              (Unified LLM Invocation)                                │   │
│  │                                                                      │   │
│  │  - callLLM(provider, model, system, user, options)                  │   │
│  │  - API keys read from process.env ONLY                              │   │
│  │  - Handles Groq, Ollama, ZhipuAI, Kimi, OpenAI, Anthropic           │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Data & Config Layer                                │
├────────────────────────────┬────────────────────────┬───────────────────────┤
│    Prisma (PostgreSQL)     │    Environment         │    File System        │
│                            │    (.env - CREDENTIALS │    (CONFIGURATION)    │
│                            │     NEVER IN DB)       │                       │
├────────────────────────────┼────────────────────────┼───────────────────────┤
│  - LLMProvider (baseUrls)  │  - GROQ_API_KEY        │  - prompts.json       │
│  - LLMModel (cached models)│  - ZHIPUAI_API_KEY     │  - llm-test-cases.json│
│                            │  - KIMI_API_KEY        │  - test logs          │
│                            │  - OPENAI_API_KEY      │                       │
│                            │  - ANTHROPIC_API_KEY   │                       │
└────────────────────────────┴────────────────────────┴───────────────────────┘
```

### Credential Management

**Critical Design Decision**: API keys are **ONLY** stored in `.env` files, never in the database.

```
┌─────────────────────────────────────────────────────────────────┐
│                     .env file (NOT in version control)          │
├─────────────────────────────────────────────────────────────────┤
│  GROQ_API_KEY=gsk_xxx                                           │
│  ZHIPUAI_API_KEY=xxx                                            │
│  KIMI_API_KEY=sk-xxx                                            │
│  OPENAI_API_KEY=sk-xxx                                          │
│  ANTHROPIC_API_KEY=sk-ant-xxx                                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ process.env.GROQ_API_KEY
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Application Code                             │
│                    (Reads from process.env directly)            │
└─────────────────────────────────────────────────────────────────┘
```

**Rationale**:
- Security: No credentials in database backups or logs
- Simplicity: Single source of truth for each provider's key
- Environment parity: Same code works in dev/staging/prod with different .env files

---

## Component Design

### 1. LLMModelTester (UI Component)

**Location**: `src/components/settings/llm-model-tester.tsx`

**Responsibilities**:
- Display available models grouped by provider
- Allow model selection via checkboxes
- Execute compatibility tests with streaming progress
- Display test results in real-time
- Persist UI state across sessions

**State Management**:

```typescript
interface ComponentState {
  // Model discovery
  models: ModelInfo[];
  selectedModels: Set<string>;
  isLoading: boolean;

  // Test execution
  isTesting: boolean;
  currentModel: string | null;
  currentTest: TestType | null;
  results: Map<string, ModelTestResult>;

  // History
  lastRun: string | null;

  // Error handling
  error: string | null;
}
```

**Key Features**:
| Feature | Description |
|---------|-------------|
| Model Grouping | Models grouped by provider with rowspan display |
| Progress Tracking | Real-time status icons (pending/running/pass/fail) |
| Auto-scroll | Scroll to currently testing model |
| Cancel Support | Abort ongoing test via AbortController |
| Last Run Display | Show timestamp of most recent test |

### 2. Model Discovery Service

**Location**: `src/lib/llm-model-fetcher.ts` (to be created)

**Interface**:

```typescript
export interface LLMModelInfo {
  externalId: string;      // Model ID from provider API
  name: string;            // Display name
  contextWindow: number;   // Max tokens (0 if unknown)
  capabilities: string[];  // e.g., ['chat', 'completion']
}

export interface FetchModelsConfig {
  baseUrl?: string;        // For Ollama (from DB)
  providerId?: string;     // For DB caching
}

// Per-provider fetchers - API keys from process.env internally
export async function fetchGroqModels(config?: FetchModelsConfig): Promise<LLMModelInfo[]>
export async function fetchZhipuModels(config?: FetchModelsConfig): Promise<LLMModelInfo[]>
export async function fetchOllamaModels(config: FetchModelsConfig): Promise<LLMModelInfo[]>
export async function fetchKimiModels(config?: FetchModelsConfig): Promise<LLMModelInfo[]>
export async function fetchOpenAIModels(config?: FetchModelsConfig): Promise<LLMModelInfo[]>
export async function fetchAnthropicModels(config?: FetchModelsConfig): Promise<LLMModelInfo[]>

// Main entry point
export async function fetchAvailableModels(
  providerType: string,
  config?: FetchModelsConfig
): Promise<LLMModelInfo[]>
```

**API Key Resolution** (internal to each fetcher):

```typescript
// Inside fetchGroqModels
const apiKey = process.env.GROQ_API_KEY;
if (!apiKey) {
  logger.warn('[ModelFetcher] GROQ_API_KEY not configured');
  return [];
}

// Inside fetchZhipuModels
const apiKey = process.env.ZHIPUAI_API_KEY;
// ... similar pattern
```

**Provider-Specific Notes**:

| Provider | API Endpoint | Auth Source | Notes |
|----------|--------------|-------------|-------|
| Groq | `https://api.groq.com/openai/v1/models` | `GROQ_API_KEY` | Filter `active !== false` |
| ZhipuAI | `https://open.bigmodel.cn/api/paas/v4/models` | `ZHIPUAI_API_KEY` | **Never hardcode** - models change frequently |
| Ollama | `{baseUrl}/api/tags` | None (local) | Base URL from DB config |
| Kimi | `https://api.moonshot.cn/v1/models` | `KIMI_API_KEY` | OpenAI-compatible |
| OpenAI | `https://api.openai.com/v1/models` | `OPENAI_API_KEY` | Filter to `gpt-*` models |
| Anthropic | **No API** | `ANTHROPIC_API_KEY` | Hardcoded list (no list endpoint), update on new releases |

### 3. Test Executor Service

**Location**: `src/lib/llm-test-executor.ts` (to be created)

**Interface**:

```typescript
export type TestType = 'query' | 'assessment' | 'tags' | 'summary';

export interface TestResult {
  passed: boolean;
  duration: number;
  error: string | null;
  content?: string;  // Raw LLM response
}

export interface ModelTestResult {
  model: string;
  provider: string;
  tests: Record<TestType, TestResult>;
}

// Execute single test - prompts and rules loaded from config files
export async function executeTest(
  provider: string,
  model: string,
  testType: TestType,
  testCaseConfig: TestCaseConfig,  // From config/llm-test-cases.json
  promptsConfig: PromptsConfig     // From config/prompts.json
): Promise<TestResult>

// Validate result against rules from config
export function validateTestResult(
  testType: TestType,
  content: string,
  rules: ValidationRules  // Passed as parameter from config
): { valid: boolean; error: string | null }

// Run full test suite for multiple models
export async function* runFullSuite(
  models: ModelInfo[],
  config: TestSuiteConfig
): AsyncGenerator<TestProgressEvent>
```

### 4. LLM Provider Client

**Location**: `src/lib/llm-provider-client.ts` (to be created)

**Interface**:

```typescript
export interface LLMCallOptions {
  maxTokens?: number;
  temperature?: number;
  timeout?: number;
}

export interface LLMCallResult {
  success: boolean;
  content?: string;
  error?: string;
  duration: number;
  tokensUsed?: number;
}

// Unified LLM invocation - API keys from process.env
export async function callLLM(
  provider: string,
  model: string,
  systemPrompt: string,
  userPrompt: string,
  options?: LLMCallOptions
): Promise<LLMCallResult>
```

**Provider Configuration** (endpoints as data, keys from env):

```typescript
const PROVIDER_CONFIGS = {
  groq: {
    apiUrl: 'https://api.groq.com/openai/v1/chat/completions',
    bodyFormat: 'openai',
    envKey: 'GROQ_API_KEY'  // Key name, not the key itself
  },
  zhipuai: {
    apiUrl: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
    bodyFormat: 'openai',
    envKey: 'ZHIPUAI_API_KEY'
  },
  ollama: {
    // URL from DB config, not hardcoded
    getUrl: (baseUrl: string) => `${baseUrl}/api/chat`,
    bodyFormat: 'ollama',
    envKey: null  // No auth required
  },
  kimi: {
    apiUrl: 'https://api.moonshot.cn/v1/chat/completions',
    bodyFormat: 'openai',
    envKey: 'KIMI_API_KEY'
  },
  openai: {
    apiUrl: 'https://api.openai.com/v1/chat/completions',
    bodyFormat: 'openai',
    envKey: 'OPENAI_API_KEY'
  },
  anthropic: {
    apiUrl: 'https://api.anthropic.com/v1/messages',
    bodyFormat: 'anthropic',
    envKey: 'ANTHROPIC_API_KEY'
  }
};

// Usage - reads key from environment
function getApiKey(provider: string): string | undefined {
  const config = PROVIDER_CONFIGS[provider];
  if (!config.envKey) return undefined;
  return process.env[config.envKey];
}
```

---

## API Specification

### GET /api/llm-models

**Purpose**: List available models + load last test results

**Response**:
```typescript
interface GetModelsResponse {
  models: Array<{
    id: string;
    name: string;
    provider: string;
  }>;
  lastRun: string | null;  // ISO timestamp
  results: ModelTestResult[];
}
```

### POST /api/llm-models/test

**Purpose**: Execute compatibility tests with streaming progress

**Request**:
```typescript
interface TestRequest {
  models: Array<{
    id: string;
    provider: string;
  }>;
}
```

**Response**: Server-Sent Events (SSE) stream

**Event Types**:

| Event | Data | Description |
|-------|------|-------------|
| `progress` | `{ type, model, test }` | Current test being executed |
| `result` | `{ type, result: ModelTestResult }` | Individual model complete |
| `complete` | `{ type, timestamp }` | All tests finished |
| `error` | `{ type, message }` | Error occurred |

**Example Stream**:
```
data: {"type":"progress","model":"llama-3.1-70b-versatile","test":"query"}

data: {"type":"progress","model":"llama-3.1-70b-versatile","test":"assessment"}

data: {"type":"result","result":{"model":"llama-3.1-70b-versatile","provider":"groq","tests":{"query":{"passed":true,"duration":1234},"assessment":{"passed":true,"duration":2345},...}}}

data: {"type":"complete","timestamp":"2026-02-23T10:30:00.000Z"}
```

---

## Test Execution Pipeline

### Test Types & Validation Rules

All validation rules are defined in `config/llm-test-cases.json`, not in code:

```yaml
query:
  description: Boolean query optimization
  validation:
    mustContainOperators: ["AND", "OR"]  # Parameter, not hardcoded
    method: regex match for Boolean operators
  prompt_source: config/prompts.json → queryOptimization

assessment:
  description: Paper assessment with numeric scores
  validation:
    requiredFields: ["technical", "business", "timeliness", "practicality"]
    fieldTypes: number
    method: JSON parse with balanced brace extraction
  prompt_source: config/prompts.json → contentAssessment

tags:
  description: Tag generation for papers
  validation:
    requiredField: tags array
    method: Array parse with name+category validation
  prompt_source: config/prompts.json → tagSuggestion

summary:
  description: Paper summarization
  validation:
    minLength: 50    # Parameter from config
    maxLength: 3000  # Parameter from config
    method: String length check
  prompt_source: config/prompts.json → summaryGeneration
```

### Validation Strategy

For **JSON-based tests** (assessment, tags), the validator uses a multi-step extraction (logic is reusable, thresholds are parameters):

```
1. Strip markdown code blocks (```json ... ```)
2. Try direct JSON.parse()
3. Extract JSON objects using balanced brace matching
4. Try content after thinking tags (</think|thinking>)
5. Return first valid parse that passes field validation
6. Validation rules passed as parameter, not hardcoded
```

### Test Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    Test Execution Flow                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Load Configuration (data as parameters):                       │
│    - config/prompts.json → system prompts                       │
│    - config/llm-test-cases.json → test data & validation rules │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  For each selected model:                                       │
│    ┌─────────────────────────────────────────────────────────┐  │
│    │  For each test type (query, assessment, tags, summary): │  │
│    │                                                         │  │
│    │    1. Get prompts from loaded config                    │  │
│    │    2. Get validation rules from loaded config           │  │
│    │    3. Call LLM via llm-provider-client                  │  │
│    │       (API key from process.env internally)             │  │
│    │    4. Validate response against rules (parameter)       │  │
│    │    5. Record result + duration                          │  │
│    │    6. Wait 2s (rate limit protection)                   │  │
│    │                                                         │  │
│    └─────────────────────────────────────────────────────────┘  │
│                                                                 │
│    7. Emit 'result' SSE event                                   │
│    8. Wait 3s between models (rate limit protection)            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  After all models:                                              │
│    1. Save results to logs/llm-model-test-{timestamp}.log      │
│    2. Update logs/llm-model-test-latest.log                    │
│    3. Emit 'complete' SSE event                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Model Fetcher Consolidation

### Current Problem

```
┌─────────────────────────────────────────────────────────────────┐
│                         API Routes                              │
├─────────────────────────────────┬───────────────────────────────┤
│ /api/llm-providers/route.ts     │ /api/llm-models/route.ts      │
│ (Provider Settings Panel)       │ (Test Panel)                  │
├─────────────────────────────────┼───────────────────────────────┤
│ fetchGroqModels()      ←─────── │ fetchGroqModels()  [DUPLICATE]│
│ fetchZhipuModels()     ←─────── │ [HARDCODED LIST]   [WRONG]    │
│ fetchKimiModels()               │ [NOT IMPLEMENTED]             │
│ fetchOllamaModelsFromDB() ←──── │ fetchOllamaModels() [DIFFERENT]│
│ ...                             │ ...                           │
└─────────────────────────────────┴───────────────────────────────┘
```

### Proposed Solution

Create `src/lib/llm-model-fetcher.ts` as single source of truth:

```
┌─────────────────────────────────────────────────────────────────┐
│                    src/lib/llm-model-fetcher.ts                 │
│                    (Single Source of Truth)                     │
├─────────────────────────────────────────────────────────────────┤
│ - fetchGroqModels(config)                                       │
│ - fetchZhipuModels(config)                                      │
│ - fetchOllamaModels(config)                                     │
│ - fetchKimiModels(config)                                       │
│ - fetchOpenAIModels(config)                                     │
│ - fetchAnthropicModels(config)  [hardcoded - no API available]  │
│ - fetchAvailableModels(providerType, config)  [main entry]      │
│                                                                 │
│ All functions read API keys from process.env internally         │
└───────────────────────────┬─────────────────────────────────────┘
                            │
            ┌───────────────┴───────────────┐
            ▼                               ▼
┌───────────────────────┐     ┌───────────────────────┐
│ /api/llm-providers    │     │ /api/llm-models       │
│ (Provider Settings)   │     │ (Test Panel)          │
│                       │     │                       │
│ import { fetchX }     │     │ import { fetchX }     │
│ from llm-model-fetcher│     │ from llm-model-fetcher│
└───────────────────────┘     └───────────────────────┘
```

### File Changes Required

| File | Action | Description |
|------|--------|-------------|
| `src/lib/llm-model-fetcher.ts` | **Create** | Extract all fetch functions |
| `src/app/api/llm-providers/route.ts` | **Modify** | Remove lines 608-780, import from shared lib |
| `src/app/api/llm-models/route.ts` | **Modify** | Remove inline fetch functions, import from shared lib |

---

## Data Models

### Prisma Schema

**Note**: API keys are NOT stored in the database. They only exist in `.env` files.

```prisma
model LLMProviderBase {
  id          String   @id @default(cuid())
  name        String
  type        String   // groq, zhipuai, ollama, kimi, openai, anthropic
  baseUrl     String?  // For Ollama and self-hosted providers
  isCloud     Boolean  @default(true)
  docsUrl     String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  models      LLMModelBase[]
}

model LLMModelBase {
  id            String   @id @default(cuid())
  providerId    String
  externalId    String   // Model ID from provider API
  name          String
  contextWindow Int      @default(0)
  capabilities  String[] @default([])
  isActive      Boolean  @default(true)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  provider      LLMProviderBase @relation(fields: [providerId], references: [id])
}

model UserLLMConfig {
  id            String   @id @default(cuid())
  userId        String
  providerId    String
  modelId       String?
  isEnabled     Boolean  @default(true)
  apiKey        String?   @deprecated  // DEPRECATED: API keys now from .env only
  priority      Int      @default(0)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  deletedAt     DateTime?
  provider      LLMProviderBase @relation(fields: [providerId], references: [id])
  user          User            @relation(fields: [userId], references: [id])
  models        UserLLMModel[]
}
```

**What's stored vs. what's in .env**:

| Data | Storage | Reason |
|------|---------|--------|
| API Keys | `.env` only | Security, never in DB backups |
| Base URLs (Ollama) | Database (`LLMProviderBase.baseUrl`) | User-configurable per instance |
| Model lists | Database (cached in `LLMModelBase`) | Performance, with API refresh |
| Provider metadata | Database (`LLMProviderBase`) | Application state |
| User Config | Database (`UserLLMConfig`) | User's provider/model preferences |

**Migration Plan: API Key Deprecation**

The `UserLLMConfig.apiKey` field is now **deprecated**. API keys should ONLY come from environment variables (`.env` files).

**Action Items:**
- [x] Remove all code paths that read `UserLLMConfig.apiKey` from database
- [x] Update shared libraries to use `process.env` for API keys
- [ ] In future migration: Remove `apiKey` column from `UserLLMConfig` table (requires DB migration)
- [ ] Update UI to remove API key input fields (now controlled via `.env`)

**Rationale for Deprecation**:
- Security: Prevents credentials from being stored in database backups
- Simplicity: Single source of truth for each provider's key
- Environment parity: Same code works in dev/staging/prod with different `.env` files

### Test Result Log Structure

```typescript
interface TestRunLog {
  timestamp: string;      // ISO timestamp
  duration: number;       // Total duration in ms
  results: ModelTestResult[];
}

interface ModelTestResult {
  model: string;
  provider: string;
  tests: {
    query?: TestResult;
    assessment?: TestResult;
    tags?: TestResult;
    summary?: TestResult;
  };
}

interface TestResult {
  passed: boolean;
  duration: number;
  error: string | null;
  content?: string;  // Raw LLM response for debugging
}
```

---

## Configuration

### Environment Variables (.env)

```bash
# LLM Provider API Keys - NEVER stored in database
GROQ_API_KEY=gsk_xxx
ZHIPUAI_API_KEY=xxx
KIMI_API_KEY=sk-xxx
OPENAI_API_KEY=sk-xxx
ANTHROPIC_API_KEY=sk-ant-xxx
```

### Test Case Configuration

**Location**: `config/llm-test-cases.json`

```json
{
  "testCase": {
    "query": {
      "original": "AI in banking",
      "description": "Simple query to test query optimization capability"
    },
    "paper": {
      "title": "Machine Learning for Credit Risk Assessment in Banking",
      "abstract": "This paper presents a novel approach..."
    }
  },
  "validation": {
    "query": {
      "mustContainOperators": ["AND", "OR"],
      "description": "Query must contain Boolean operators"
    },
    "assessment": {
      "requiredFields": ["technical", "business", "timeliness", "practicality"],
      "fieldTypes": "number",
      "description": "Must return JSON with numeric score fields"
    },
    "tags": {
      "requiredField": "tags",
      "fieldType": "array",
      "description": "Must return JSON with tags array"
    },
    "summary": {
      "minLength": 50,
      "maxLength": 3000,
      "description": "Summary must be reasonable length"
    }
  }
}
```

### Prompt Configuration

**Location**: `config/prompts.json`

Required prompt keys:
- `queryOptimization` - System prompt for query optimizer
- `contentAssessment` - System prompt for paper assessment
- `tagSuggestion` - System prompt for tag generation
- `summaryGeneration` - System prompt for summarization

---

## Logging & Persistence

### File Structure

```
logs/
├── llm-model-test-2026-02-23_10-30.log    # Timestamped run
├── llm-model-test-2026-02-23_14-15.log    # Another run same day
└── llm-model-test-latest.log              # Symlink/copy of most recent
```

### Log Format

```json
{
  "timestamp": "2026-02-23T10:30:00.000Z",
  "duration": 125000,
  "results": [
    {
      "model": "llama-3.1-70b-versatile",
      "provider": "groq",
      "tests": {
        "query": { "passed": true, "duration": 1234, "error": null },
        "assessment": { "passed": true, "duration": 2345, "error": null },
        "tags": { "passed": true, "duration": 1567, "error": null },
        "summary": { "passed": true, "duration": 1890, "error": null }
      }
    }
  ]
}
```

---

## Implementation Roadmap

### Phase 1: Create Shared Libraries

**Status**: ✅ COMPLETED

**Files Created**:
- [x] `src/lib/llm-model-fetcher.ts` - Model discovery
- [x] `src/lib/llm-provider-client.ts` - LLM invocation

**Completed Tasks**:
- [x] Extract fetch functions from `llm-providers/route.ts`
- [x] Extract LLM call logic from `llm-models/test/route.ts`
- [x] Ensure all API keys read from `process.env` only
- [x] Add proper TypeScript interfaces
- [x] Dry run tests passed (8/8 tests - 100% success rate)

### Phase 2: Update API Routes

**Status**: ✅ COMPLETED

**Files Modified**:
- [x] `src/app/api/llm-providers/route.ts` - Use shared fetcher
- [x] `src/app/api/llm-models/route.ts` - Use shared fetcher
- [x] `src/app/api/llm-models/test/route.ts` - Use shared client

**Completed Tasks**:
- [x] Remove duplicated fetch functions from both routes
- [x] Import from shared libraries
- [x] Remove any code that reads `apiKey` from database (use `process.env` only)
- [x] Test model discovery still works
- [x] Test compatibility tests still work

### Phase 3: Enhance Test Features

**Status**: ⏸️ DEFERRED

**Potential Enhancements**:
- [ ] Add test history browser in UI
- [ ] Add model comparison view (side-by-side results)
- [ ] Add export results to CSV/JSON
- [ ] Add scheduled test runs
- [ ] Add Slack/email notifications for failures

### Phase 4: Documentation & Cleanup

**Status**: 🔄 IN PROGRESS

**Tasks**:
- [x] Update API documentation
- [x] Add inline code documentation
- [ ] Remove dead code
- [ ] Delete old refactor planning documents

---

## Testing Checklist

After refactoring, verify:

### Model Discovery
- [ ] Provider settings shows correct models for each provider
- [ ] Test panel shows **identical** models as provider settings
- [ ] Adding new provider config updates test panel
- [ ] API key changes in `.env` reflected after restart
- [ ] Ollama local models appear in both panels
- [ ] ZhipuAI shows current models (not outdated list)
- [ ] No API keys stored in database

### Test Execution
- [ ] Query test validates Boolean operators (from config)
- [ ] Assessment test validates JSON structure (fields from config)
- [ ] Tags test validates array format
- [ ] Summary test validates length (thresholds from config)
- [ ] Progress updates stream correctly
- [ ] Cancel button stops tests
- [ ] Results persist to log files
- [ ] Last run timestamp displays correctly

### Error Handling
- [ ] Missing API key in `.env` shows clear error
- [ ] Rate limits handled gracefully
- [ ] Network errors captured with duration
- [ ] Invalid JSON responses don't crash

### Configuration
- [ ] Changing `llm-test-cases.json` affects validation
- [ ] Changing `prompts.json` affects test execution
- [ ] No hardcoded values in code that should be configurable

---

## Benefits Summary

| Benefit | Description |
|---------|-------------|
| **No Hardcoding** | All thresholds, prompts, rules from config files |
| **Data as Parameters** | Validation rules and test data passed, not embedded |
| **Single Source of Truth** | One place to update fetch logic |
| **Security** | API keys only in `.env`, never in database |
| **Consistency** | Test panel always matches provider panel |
| **Maintainability** | Add new provider in one place |
| **Easier Testing** | Unit test libraries independently |
| **Reusability** | LLM client usable by other features |
| **Observability** | Structured logs for debugging |
