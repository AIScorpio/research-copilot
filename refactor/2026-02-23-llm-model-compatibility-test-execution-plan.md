# LLM Model Compatibility Test - Execution Plan

**Created**: 2026-02-23
**Status**: Pending Approval
**Related Design**: `refactor/2026-02-23-llm-model-compatibility-test-design.md`

---

## Scope Definition

### Current Active Providers (In Scope)
| Provider | Type | Auth | Configuration |
|----------|------|------|---------------|
| **Groq** | Cloud API | `GROQ_API_KEY` in `.env` | API endpoint: `api.groq.com` |
| **ZhipuAI** | Cloud API | `ZHIPUAI_API_KEY` in `.env` | API endpoint: `open.bigmodel.cn` |
| **Ollama** | Local | None (localhost) | Base URL from DB (`http://localhost:11434`) |

### Future Providers (Out of Scope - Deferred)
The following providers are **deferred** until the current system is stable:
- Kimi (Moonshot)
- OpenAI
- Anthropic
- Others

**Rationale**: Perfect the architecture with current 3 providers first, then use the established patterns as guidance for adding more.

---

## Execution Order

Execute in this order. Each phase has:
- **What**: What to do
- **Validate**: How to verify it works
- **Rollback**: What to do if it fails
- **Commit**: Git commit message template

---

## Phase 1: Critical Fixes (Design Violations)

### 1.1 Remove API Key Reading from Database

**Priority**: 🔴 High
**File**: `src/app/api/llm-models/route.ts`

#### What to Do
Remove the fallback to read `apiKey` from database. Keys should ONLY come from `process.env`.

**Current Code (lines 28-37)**:
```typescript
const groqConfig = await prisma.userLLMConfig.findFirst({
    where: {
        provider: { type: 'groq' },
        isEnabled: true
    },
    orderBy: { updatedAt: 'desc' }
});

// Try config API key first, then fallback to env variable
const groqApiKey = groqConfig?.apiKey || process.env.GROQ_API_KEY;
```

**Target Code**:
```typescript
const groqApiKey = process.env.GROQ_API_KEY;
```

**Current Code (lines 110-116)**:
```typescript
const zhipuConfig = await prisma.userLLMConfig.findFirst({
    where: {
        provider: { type: 'zhipuai' }
    }
});

const apiKey = zhipuConfig?.apiKey || process.env.ZHIPUAI_API_KEY;
```

**Target Code**:
```typescript
const apiKey = process.env.ZHIPUAI_API_KEY;
```

#### Validation Checklist
- [ ] `process.env.GROQ_API_KEY` is used directly (no DB fallback)
- [ ] `process.env.ZHIPUAI_API_KEY` is used directly (no DB fallback)
- [ ] No `groqConfig?.apiKey` references remain
- [ ] No `zhipuConfig?.apiKey` references remain
- [ ] Unused DB queries removed (lines 28-34, 110-114)
- [ ] TypeScript compiles without errors: `npm run build`
- [ ] API returns models when `.env` has keys
- [ ] API returns empty array when `.env` has no keys (with log warning)

#### Test Procedure
```bash
# 1. Ensure .env has valid GROQ_API_KEY and ZHIPUAI_API_KEY
# 2. Run: npm run dev
# 3. Call: GET http://localhost:3000/api/llm-models
# 4. Verify: Models array contains Groq and ZhipuAI models
# 5. Comment out GROQ_API_KEY in .env, restart server
# 6. Call: GET http://localhost:3000/api/llm-models
# 7. Verify: Models array is empty for Groq, check logs for warning
```

#### Rollback
```bash
git checkout src/app/api/llm-models/route.ts
```

#### Commit Template
```
fix(llm-models): remove DB fallback for API keys, use .env only

- Remove groqConfig?.apiKey fallback, use process.env.GROQ_API_KEY directly
- Remove zhipuConfig?.apiKey fallback, use process.env.ZHIPUAI_API_KEY directly
- Remove unnecessary DB queries for API key lookup
- Aligns with design principle: API keys ONLY in .env files
```

---

### 1.2 Fix PrismaClient Instantiation in Test Route

**Priority**: 🔴 High
**File**: `src/app/api/llm-models/test/route.ts`

#### What to Do
Replace inline `new PrismaClient()` with shared instance from `@/lib/db`.

**Current Code (lines 5-7)**:
```typescript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
```

**Target Code**:
```typescript
import { prisma } from '@/lib/db';
```

#### Validation Checklist
- [ ] No `new PrismaClient()` in the file
- [ ] Imports `prisma` from `@/lib/db`
- [ ] TypeScript compiles: `npm run build`
- [ ] Tests still run and connect to DB

#### Test Procedure
```bash
# 1. Run: npm run build
# 2. Verify: No compilation errors
# 3. Run test suite if exists: npm test
# 4. Run a test in Settings UI, verify DB connection works
```

#### Rollback
```bash
git checkout src/app/api/llm-models/test/route.ts
```

#### Commit Template
```
fix(llm-models-test): use shared PrismaClient from @/lib/db

- Replace inline new PrismaClient() with shared instance
- Prevents connection pool exhaustion
- Follows project convention for DB access
```

---

## Phase 2: Create Shared Libraries (Current Providers Only)

### 2.1 Create `src/lib/llm-model-fetcher.ts`

**Priority**: 🟡 Medium
**File**: `src/lib/llm-model-fetcher.ts` (NEW)

#### What to Do
Create shared module for model discovery that both `/api/llm-models` and `/api/llm-providers` can use.

**Scope**: Only Groq, ZhipuAI, and Ollama (current active providers).

**File Content**:
```typescript
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/db';

export interface LLMModelInfo {
    externalId: string;
    name: string;
    contextWindow: number;
    capabilities: string[];
}

export interface FetchModelsConfig {
    baseUrl?: string;        // For Ollama (from DB)
    providerId?: string;     // For DB caching
}

/**
 * Fetch available models from Groq API
 *
 * API Keys: process.env.GROQ_API_KEY (ONLY from .env, never from DB)
 * Endpoint: https://api.groq.com/openai/v1/models
 * Auth: Bearer token in Authorization header
 * Response: OpenAI-compatible format
 */
export async function fetchGroqModels(config?: FetchModelsConfig): Promise<LLMModelInfo[]> {
    const apiKey = process.env.GROQ_API_KEY;

    if (!apiKey) {
        logger.warn('[ModelFetcher] GROQ_API_KEY not configured');
        return [];
    }

    try {
        const response = await fetch('https://api.groq.com/openai/v1/models', {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            logger.error('[ModelFetcher] Groq API error', { status: response.status });
            return [];
        }

        const data = await response.json();
        const models: LLMModelInfo[] = (data.data || [])
            .filter((m: any) => m.active !== false)
            .map((m: any) => ({
                externalId: m.id,
                name: m.id,
                contextWindow: m.context_window || 8192,
                capabilities: ['chat']
            }));

        logger.info(`[ModelFetcher] Fetched ${models.length} Groq models`);

        // Update DB cache if providerId provided
        if (config?.providerId) {
            await updateModelsInDB(config.providerId, models);
        }

        return models;
    } catch (error) {
        logger.error('[ModelFetcher] Failed to fetch Groq models', { error });
        return [];
    }
}

/**
 * Fetch available models from ZhipuAI API
 *
 * API Keys: process.env.ZHIPUAI_API_KEY (ONLY from .env, never from DB)
 * Endpoint: https://open.bigmodel.cn/api/paas/v4/models
 * Auth: Bearer token in Authorization header
 * Response: OpenAI-compatible format
 *
 * IMPORTANT: Never hardcode model list - ZhipuAI releases new models frequently
 */
export async function fetchZhipuModels(config?: FetchModelsConfig): Promise<LLMModelInfo[]> {
    const apiKey = process.env.ZHIPUAI_API_KEY;

    if (!apiKey) {
        logger.warn('[ModelFetcher] ZHIPUAI_API_KEY not configured');
        return [];
    }

    try {
        const response = await fetch('https://open.bigmodel.cn/api/paas/v4/models', {
            headers: { 'Authorization': `Bearer ${apiKey}` }
        });

        if (!response.ok) {
            logger.error('[ModelFetcher] ZhipuAI API error', { status: response.status });
            return [];
        }

        const data = await response.json();
        const models: LLMModelInfo[] = (data.data || []).map((m: any) => ({
            externalId: m.id,
            name: m.id,
            contextWindow: 128000,
            capabilities: ['chat']
        }));

        logger.info(`[ModelFetcher] Fetched ${models.length} ZhipuAI models`);

        if (config?.providerId) {
            await updateModelsInDB(config.providerId, models);
        }

        return models;
    } catch (error) {
        logger.error('[ModelFetcher] Failed to fetch ZhipuAI models', { error });
        return [];
    }
}

/**
 * Fetch available models from Ollama instance
 *
 * API Keys: None (local instance)
 * Endpoint: {baseUrl}/api/tags (baseUrl from DB, default: http://localhost:11434)
 * Auth: None required
 * Response: Ollama-specific format { models: [{ name, ... }] }
 */
export async function fetchOllamaModels(config: FetchModelsConfig): Promise<LLMModelInfo[]> {
    const baseUrl = config.baseUrl || 'http://localhost:11434';

    try {
        const response = await fetch(`${baseUrl}/api/tags`);

        if (!response.ok) {
            logger.error('[ModelFetcher] Ollama API error', { status: response.status });
            return [];
        }

        const data = await response.json();
        const models: LLMModelInfo[] = (data.models || []).map((m: any) => ({
            externalId: m.name,
            name: m.name,
            contextWindow: 4096, // Default, varies by model
            capabilities: ['chat']
        }));

        logger.info(`[ModelFetcher] Fetched ${models.length} Ollama models`);

        return models;
    } catch (error) {
        logger.error('[ModelFetcher] Failed to fetch Ollama models', { error });
        return [];
    }
}

/**
 * Main entry point - fetch models for a specific provider type
 *
 * @param providerType - Provider identifier (groq, zhipuai, ollama)
 * @param config - Optional configuration (baseUrl for Ollama, providerId for caching)
 * @returns Array of LLMModelInfo objects
 */
export async function fetchAvailableModels(
    providerType: string,
    config?: FetchModelsConfig
): Promise<LLMModelInfo[]> {
    switch (providerType.toLowerCase()) {
        case 'groq':
            return fetchGroqModels(config);
        case 'zhipuai':
            return fetchZhipuModels(config);
        case 'ollama':
            return fetchOllamaModels(config || {});
        default:
            logger.warn(`[ModelFetcher] Unknown provider type: ${providerType}`);
            return [];
    }
}

/**
 * Update models in database cache
 * Used to keep LLMModelBase table in sync with provider APIs
 */
async function updateModelsInDB(providerId: string, models: LLMModelInfo[]): Promise<void> {
    for (const model of models) {
        const existing = await prisma.lLMModelBase.findFirst({
            where: { providerId, externalId: model.externalId }
        });

        if (existing) {
            await prisma.lLMModelBase.update({
                where: { id: existing.id },
                data: {
                    name: model.name,
                    contextWindow: model.contextWindow,
                    capabilities: JSON.stringify(model.capabilities),
                    isActive: true
                }
            });
        } else {
            await prisma.lLMModelBase.create({
                data: {
                    providerId,
                    externalId: model.externalId,
                    name: model.name,
                    contextWindow: model.contextWindow,
                    capabilities: JSON.stringify(model.capabilities),
                    isActive: true
                }
            });
        }
    }
}
```

#### Validation Checklist
- [ ] File created at `src/lib/llm-model-fetcher.ts`
- [ ] `fetchGroqModels()` function exists with proper JSDoc
- [ ] `fetchZhipuModels()` function exists with proper JSDoc
- [ ] `fetchOllamaModels()` function exists with proper JSDoc
- [ ] `fetchAvailableModels()` main entry point exists
- [ ] `updateModelsInDB()` helper function exists
- [ ] All API keys read from `process.env` only
- [ ] TypeScript compiles: `npm run build`
- [ ] No lint errors: `npm run lint`

#### Test Procedure
```bash
# 1. Create the file
# 2. Run: npm run build
# 3. Verify: No compilation errors
# 4. (Integration test happens in Phase 2.2)
```

#### Rollback
```bash
rm src/lib/llm-model-fetcher.ts
```

#### Commit Template
```
feat(lib): create shared llm-model-fetcher module

- Add fetchGroqModels() - Groq API with env key
- Add fetchZhipuModels() - ZhipuAI API with env key
- Add fetchOllamaModels() - Local Ollama instance
- Add fetchAvailableModels() main entry point
- Add updateModelsInDB() for caching
- All API keys read from process.env only
- Single source of truth for model discovery
```

---

### 2.2 Refactor `/api/llm-models/route.ts` to Use Shared Library

**Priority**: 🟡 Medium
**File**: `src/app/api/llm-models/route.ts`

#### What to Do
Replace inline fetcher functions with imports from shared library.

**New imports**:
```typescript
import { fetchAvailableModels, LLMModelInfo } from '@/lib/llm-model-fetcher';
```

**Remove**: All inline fetcher functions (lines 25-145)

**Replace GET handler**:
```typescript
export async function GET() {
    try {
        // Current active providers only
        const providerTypes = ['groq', 'ollama', 'zhipuai'] as const;

        // Get Ollama base URL from DB
        let ollamaBaseUrl: string | undefined;
        try {
            const ollamaProvider = await prisma.lLMProviderBase.findFirst({
                where: { type: 'ollama' }
            });
            ollamaBaseUrl = ollamaProvider?.baseUrl;
        } catch (e) {
            // Ignore if DB lookup fails, will use default
        }

        const modelPromises = providerTypes.map(async (providerType) => {
            const config = providerType === 'ollama' ? { baseUrl: ollamaBaseUrl } : undefined;
            const models = await fetchAvailableModels(providerType, config);
            return models.map(m => ({
                id: m.externalId,
                name: m.name,
                provider: providerType.charAt(0).toUpperCase() + providerType.slice(1)
            }));
        });

        const modelArrays = await Promise.all(modelPromises);
        const models = modelArrays.flat();

        const lastResults = loadLastTestResults();

        return NextResponse.json({
            models,
            lastRun: lastResults?.timestamp || null,
            results: lastResults?.results || []
        });
    } catch (error) {
        const handled = handleError(error);
        return NextResponse.json({ models: [], error: handled.error }, { status: handled.statusCode });
    }
}
```

#### Validation Checklist
- [ ] Inline fetcher functions removed (lines 25-145)
- [ ] Imports from `@/lib/llm-model-fetcher`
- [ ] GET handler uses `fetchAvailableModels()`
- [ ] Only 3 providers in scope: groq, ollama, zhipuai
- [ ] TypeScript compiles: `npm run build`
- [ ] GET request returns same format as before

#### Test Procedure
```bash
# 1. Run: npm run dev
# 2. Call: GET http://localhost:3000/api/llm-models
# 3. Verify: Response includes models from Groq, Ollama, ZhipuAI
# 4. Verify: Response format unchanged (models array, lastRun, results)
# 5. Run tests in Settings UI
```

#### Rollback
```bash
git checkout src/app/api/llm-models/route.ts
```

#### Commit Template
```
refactor(llm-models): use shared llm-model-fetcher module

- Remove inline fetchGroqModels, fetchOllamaModels, fetchZhipuModels
- Import from @/lib/llm-model-fetcher
- Simplify GET handler using fetchAvailableModels()
- Focus on 3 current providers: Groq, Ollama, ZhipuAI
```

---

### 2.3 Refactor `/api/llm-providers/route.ts` to Use Shared Library

**Priority**: 🟡 Medium
**File**: `src/app/api/llm-providers/route.ts`

#### What to Do
Replace inline fetcher functions with imports from shared library.

**Add import**:
```typescript
import {
    fetchAvailableModels,
    fetchGroqModels,
    fetchZhipuModels,
    fetchOllamaModels,
    LLMModelInfo
} from '@/lib/llm-model-fetcher';
```

**Remove**: Lines ~626-799 (inline fetcher functions: `fetchZhipuModels`, `fetchGroqModels`, `fetchKimiModels`, `fetchOpenAIModels`, `fetchAnthropicModels`, `fetchOllamaModelsFromDB`, `fetchModelsFromDB`, `updateModelsInDB`)

**Update `fetchAvailableModels()` function at line ~601** to call the imported version.

#### Validation Checklist
- [ ] Inline fetcher functions removed
- [ ] Imports from `@/lib/llm-model-fetcher`
- [ ] TypeScript compiles: `npm run build`
- [ ] Provider settings panel still works for Groq, ZhipuAI, Ollama

#### Test Procedure
```bash
# 1. Run: npm run dev
# 2. Navigate to Settings > LLM Providers
# 3. For each provider (Groq, ZhipuAI, Ollama):
#    - Click "Fetch Models" or refresh
#    - Verify: Model list appears correctly
# 4. Verify: Model lists match what appears in test panel
```

#### Rollback
```bash
git checkout src/app/api/llm-providers/route.ts
```

#### Commit Template
```
refactor(llm-providers): use shared llm-model-fetcher module

- Remove duplicated fetchGroqModels, fetchZhipuModels, etc.
- Import from @/lib/llm-model-fetcher
- Ensures consistency between provider settings and test panel
- Focus on 3 current providers: Groq, Ollama, ZhipuAI
```

---

### 2.4 Create `src/lib/llm-provider-client.ts`

**Priority**: 🟡 Medium
**File**: `src/lib/llm-provider-client.ts` (NEW)

#### What to Do
Extract LLM invocation logic into reusable module.

**Scope**: Only Groq, ZhipuAI, and Ollama (current active providers).

**File Content**:
```typescript
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

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

/**
 * Provider configuration template
 *
 * When adding a new provider, follow this pattern:
 * 1. Add configuration to PROVIDER_CONFIGS
 * 2. Specify: apiUrl, envKey (or null for local), bodyFormat, requiresAuth
 * 3. API keys come from process.env ONLY
 */
interface ProviderConfig {
    apiUrl: string;
    envKey: string | null;          // null for local providers like Ollama
    bodyFormat: 'openai' | 'ollama';
    requiresAuth: boolean;
}

/**
 * Provider configurations
 *
 * API Keys: ALL from process.env, NEVER from database
 * Body Formats:
 *   - 'openai': Standard OpenAI-compatible format (Groq, ZhipuAI, most APIs)
 *   - 'ollama': Ollama-specific format (local instance)
 */
const PROVIDER_CONFIGS: Record<string, ProviderConfig> = {
    groq: {
        apiUrl: 'https://api.groq.com/openai/v1/chat/completions',
        envKey: 'GROQ_API_KEY',
        bodyFormat: 'openai',
        requiresAuth: true
    },
    zhipuai: {
        apiUrl: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
        envKey: 'ZHIPUAI_API_KEY',
        bodyFormat: 'openai',
        requiresAuth: true
    },
    ollama: {
        apiUrl: '',  // Set dynamically from DB
        envKey: null,
        bodyFormat: 'ollama',
        requiresAuth: false
    }
};

/**
 * Unified LLM invocation
 *
 * Design Principles:
 * 1. API keys ONLY from process.env (never from database)
 * 2. Local providers (Ollama) get baseUrl from database
 * 3. All cloud providers use OpenAI-compatible format
 * 4. Clear error messages for missing configuration
 *
 * @param provider - Provider name (groq, zhipuai, ollama)
 * @param model - Model identifier
 * @param systemPrompt - System prompt (prepended to messages)
 * @param userPrompt - User message content
 * @param options - Optional: maxTokens, temperature, timeout
 */
export async function callLLM(
    provider: string,
    model: string,
    systemPrompt: string,
    userPrompt: string,
    options: LLMCallOptions = {}
): Promise<LLMCallResult> {
    const startTime = Date.now();
    const { maxTokens = 1000, temperature = 0.1 } = options;

    try {
        const providerLower = provider.toLowerCase();
        const config = PROVIDER_CONFIGS[providerLower];

        if (!config) {
            return {
                success: false,
                error: `Unknown provider: ${provider}. Supported: groq, zhipuai, ollama`,
                duration: Date.now() - startTime
            };
        }

        // Get API key from environment (NEVER from database)
        const apiKey = config.envKey ? process.env[config.envKey] : undefined;

        if (config.requiresAuth && !apiKey) {
            return {
                success: false,
                error: `${config.envKey} not configured in .env`,
                duration: Date.now() - startTime
            };
        }

        // Get Ollama base URL from DB (local provider configuration)
        let apiUrl = config.apiUrl;
        if (providerLower === 'ollama') {
            const providerRecord = await prisma.lLMProviderBase.findFirst({
                where: { type: 'ollama' }
            });
            const baseUrl = providerRecord?.baseUrl || 'http://localhost:11434';
            apiUrl = `${baseUrl}/api/chat`;
        }

        // Build request based on provider format
        const headers: Record<string, string> = {};
        let body: Record<string, unknown>;

        if (config.bodyFormat === 'openai') {
            // OpenAI-compatible format (Groq, ZhipuAI, etc.)
            const messages = [];
            if (systemPrompt) {
                messages.push({ role: 'system', content: systemPrompt });
            }
            messages.push({ role: 'user', content: userPrompt });

            headers['Authorization'] = `Bearer ${apiKey}`;
            headers['Content-Type'] = 'application/json';

            body = {
                model,
                messages,
                max_tokens: maxTokens,
                temperature
            };
        } else if (config.bodyFormat === 'ollama') {
            // Ollama-specific format
            const messages = [];
            if (systemPrompt) {
                messages.push({ role: 'system', content: systemPrompt });
            }
            messages.push({ role: 'user', content: userPrompt });

            body = {
                model,
                messages,
                stream: false
            };
        } else {
            return {
                success: false,
                error: `Unsupported body format: ${config.bodyFormat}`,
                duration: Date.now() - startTime
            };
        }

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify(body)
        });

        const duration = Date.now() - startTime;

        if (!response.ok) {
            const errorText = await response.text().catch(() => 'Unknown error');
            return {
                success: false,
                error: `HTTP ${response.status}: ${errorText.substring(0, 100)}`,
                duration
            };
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;

        if (!content) {
            return {
                success: false,
                error: 'No response content from LLM',
                duration
            };
        }

        return {
            success: true,
            content,
            duration,
            tokensUsed: data.usage?.total_tokens
        };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            duration: Date.now() - startTime
        };
    }
}
```

#### Validation Checklist
- [ ] File created at `src/lib/llm-provider-client.ts`
- [ ] `callLLM()` function exists with correct signature
- [ ] `PROVIDER_CONFIGS` contains only groq, zhipuai, ollama
- [ ] JSDoc comments explain design principles
- [ ] TypeScript compiles: `npm run build`
- [ ] No lint errors

#### Test Procedure
```bash
# 1. Create the file
# 2. Run: npm run build
# 3. Verify: No compilation errors
# 4. (Integration test happens in Phase 2.5)
```

#### Rollback
```bash
rm src/lib/llm-provider-client.ts
```

#### Commit Template
```
feat(lib): create shared llm-provider-client module

- Add callLLM() for unified LLM invocation
- Support current providers: Groq, ZhipuAI, Ollama
- API keys from process.env only (never from DB)
- Ollama baseUrl from database (local provider config)
- Configurable maxTokens and temperature
- Clear error messages for missing configuration
```

---

### 2.5 Refactor Test Route to Use Shared Client

**Priority**: 🟡 Medium
**File**: `src/app/api/llm-models/test/route.ts`

#### What to Do
Replace inline `callLLM()` function with import from shared library.

**Add import**:
```typescript
import { callLLM } from '@/lib/llm-provider-client';
```

**Remove**: Inline `callLLM()` function (lines 64-155)

**Update call site** if needed to match new signature.

#### Validation Checklist
- [ ] Inline `callLLM()` removed (lines 64-155)
- [ ] Imports from `@/lib/llm-provider-client`
- [ ] No `new PrismaClient()` (should use shared from Phase 1.2)
- [ ] TypeScript compiles: `npm run build`
- [ ] Manual tests pass for all 3 providers

#### Test Procedure
```bash
# 1. Run: npm run dev
# 2. Navigate to Settings > LLM Model Compatibility Test
# 3. For each provider (Groq, ZhipuAI, Ollama):
#    - Select at least one model
#    - Run the test
#    - Verify: Test completes with pass/fail result
# 4. Check logs/ directory for test results
```

#### Rollback
```bash
git checkout src/app/api/llm-models/test/route.ts
```

#### Commit Template
```
refactor(llm-models-test): use shared llm-provider-client

- Remove inline callLLM() function
- Import from @/lib/llm-provider-client
- Reduces code duplication
- Ensures consistent LLM invocation across app
```

---

## Phase 3: Documentation Updates

### 3.1 Update Design Document

**Priority**: 🟢 Low
**File**: `refactor/2026-02-23-llm-model-compatibility-test-design.md`

#### What to Do
Update the design document to:
1. Reflect actual Prisma model names (`LLMProviderBase`, `LLMModelBase`)
2. Clarify current scope is 3 providers only
3. Add migration plan for `UserLLMConfig.apiKey` field (deprecate)

#### Validation
- [ ] Design doc reflects actual schema
- [ ] Current scope clearly documented (Groq, ZhipuAI, Ollama only)
- [ ] Migration strategy for `apiKey` documented

#### Commit Template
```
docs(design): update to reflect current scope and schema

- Update Prisma model names: LLMProviderBase, LLMModelBase
- Clarify current scope: 3 providers only
- Document apiKey field deprecation plan
```

---

## Phase 4 (DEFERRED): Future Provider Support

**Status**: ⏸️ ON HOLD

The following providers are deferred until the current system (Groq, ZhipuAI, Ollama) is stable and well-documented:

| Provider | Type | Why Deferred |
|----------|------|--------------|
| Kimi (Moonshot) | Cloud API | Wait for stable architecture pattern |
| OpenAI | Cloud API | Wait for stable architecture pattern |
| Anthropic | Cloud API | Requires different API format (anthropic-version header) |
| Others | TBD | As needed |

### Adding New Providers - Guidance Document

When ready to add new providers, follow this pattern:

#### Step 1: Add to `llm-model-fetcher.ts`

```typescript
/**
 * Fetch available models from [Provider] API
 *
 * API Keys: process.env.[PROVIDER]_API_KEY (ONLY from .env, never from DB)
 * Endpoint: [API endpoint URL]
 * Auth: [Authentication method]
 * Response: [Response format description]
 *
 * [Any special notes about this provider]
 */
export async function fetch[Provider]Models(config?: FetchModelsConfig): Promise<LLMModelInfo[]> {
    const apiKey = process.env.[PROVIDER]_API_KEY;

    if (!apiKey) {
        logger.warn('[ModelFetcher] [PROVIDER]_API_KEY not configured');
        return [];
    }

    try {
        const response = await fetch('[API_ENDPOINT]', {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            logger.error('[ModelFetcher] [Provider] API error', { status: response.status });
            return [];
        }

        const data = await response.json();
        const models: LLMModelInfo[] = (data.data || []).map((m: any) => ({
            externalId: m.id,
            name: m.id,
            contextWindow: [default or from API],
            capabilities: ['chat']
        }));

        logger.info(`[ModelFetcher] Fetched ${models.length} [Provider] models`);

        if (config?.providerId) {
            await updateModelsInDB(config.providerId, models);
        }

        return models;
    } catch (error) {
        logger.error('[ModelFetcher] Failed to fetch [Provider] models', { error });
        return [];
    }
}
```

#### Step 2: Add to `fetchAvailableModels()` switch

```typescript
case '[provider]':
    return fetch[Provider]Models(config);
```

#### Step 3: Add to `llm-provider-client.ts` PROVIDER_CONFIGS

```typescript
[provider]: {
    apiUrl: '[API_ENDPOINT]/chat/completions',
    envKey: '[PROVIDER]_API_KEY',
    bodyFormat: 'openai',  // or 'ollama' for local, 'anthropic' for Anthropic
    requiresAuth: true
}
```

#### Step 4: Update consumer routes

1. `/api/llm-models/route.ts`: Add to `providerTypes` array
2. `/api/llm-providers/route.ts`: Import and use (if applicable)
3. `/api/llm-models/test/route.ts`: Already handled via PROVIDER_CONFIGS

#### Checklist for New Providers

- [ ] API endpoint documented
- [ ] Environment variable name defined
- [ ] Response format understood
- [ ] Any special headers/params identified
- [ ] Added to `llm-model-fetcher.ts`
- [ ] Added to `llm-provider-client.ts` PROVIDER_CONFIGS
- [ ] Added to consumer routes
- [ ] Manual testing completed
- [ ] JSDoc comments added

---

## Execution Checklist Summary

### Before Starting
- [ ] Create git branch: `git checkout -b feat/llm-model-test-consolidation`
- [ ] Ensure all tests pass: `npm test`
- [ ] Ensure build works: `npm run build`
- [ ] Verify .env has: `GROQ_API_KEY`, `ZHIPUAI_API_KEY`
- [ ] Verify Ollama is running locally (if testing Ollama)

### Phase 1 (Critical Fixes)
- [ ] 1.1 Remove API key reading from DB in `/api/llm-models/route.ts`
- [ ] 1.2 Fix PrismaClient instantiation in `/api/llm-models/test/route.ts`
- [ ] **Test**: Run `npm run build`, manual API test
- [ ] **Commit checkpoint**: `git commit -m "fix: critical design violations"`

### Phase 2 (Shared Libraries)
- [ ] 2.1 Create `src/lib/llm-model-fetcher.ts`
- [ ] 2.2 Refactor `/api/llm-models/route.ts`
- [ ] 2.3 Refactor `/api/llm-providers/route.ts`
- [ ] 2.4 Create `src/lib/llm-provider-client.ts`
- [ ] 2.5 Refactor `/api/llm-models/test/route.ts`
- [ ] **Test**: Full manual testing of all 3 providers
- [ ] **Commit checkpoint**: `git commit -m "refactor: create shared libraries"`

### Phase 3 (Documentation)
- [ ] 3.1 Update design document
- [ ] **Commit checkpoint**: `git commit -m "docs: update design document"`

### Final Validation
- [ ] `npm run build` succeeds
- [ ] `npm run lint` passes
- [ ] `npm test` passes (if tests exist)
- [ ] Manual testing in browser:
  - [ ] Settings page loads
  - [ ] Groq models appear and tests pass
  - [ ] ZhipuAI models appear and tests pass
  - [ ] Ollama models appear and tests pass
  - [ ] Results display correctly
  - [ ] Cancel button works
  - [ ] Log files created correctly
- [ ] Provider settings panel shows same models as test panel
- [ ] Create PR or merge to main

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Breaking existing functionality | Test after each phase, commit checkpoints |
| API key exposure | Never log API keys, only in .env |
| Rate limiting | Keep existing delays between calls (2s/3s) |
| Type mismatches | Run TypeScript build after each change |
| Ollama not running | Graceful error handling, return empty array |

---

## Notes

- Execute phases in order
- Commit after each phase for easy rollback
- Report any failures immediately for discussion
- Do NOT proceed to next phase if current phase fails validation
- Focus only on 3 current providers: Groq, ZhipuAI, Ollama
- Future providers (Kimi, OpenAI, Anthropic) deferred until architecture is stable
