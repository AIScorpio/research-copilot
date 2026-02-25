# Implementation Plan: Align LLM Model Compatibility Test with Collection Pipeline

**Created:** 2026-02-25
**Status:** ✅ Completed
**Priority:** High
**Completed:** 2026-02-25

---

## Background

The LLM Model Compatibility Test currently uses a different LLM invocation approach than the actual collection pipeline, causing false positives (models pass the test but fail during collection).

### Problem Example
- **glm-4.5** passed the "tags" test because the test uses lenient regex extraction (`/\[[\s\S]*?\]/`)
- **glm-4.5** failed during auto-tag because collection uses strict JSON parsing inside the provider (`provider.generateJSON()`)
- The test's lenient validation masks problems that collection would encounter

---

## Goal

Refactor the Model Compatibility Test to use the **exact same LLM invocation approach** as the collection pipeline, so the test accurately validates models for the actual agentic workflow.

---

## Current State Analysis

### Collection Pipeline Invocations

| Use Case | File | Function | Client |
|----------|------|----------|--------|
| Query Optimization | `query-optimizer.ts` | `generateTextWithFallback()` | `llm-service.ts` |
| Content Assessment | `content-filter.ts` | `generateJSONWithFallback()` | `llm-service.ts` |
| Tag Generation | `tag-generator.ts` | `generateJSONWithFallback()` | `llm-service.ts` |
| Summary Generation | `summary-generator.ts` | `generateTextWithFallback()` | `llm-service.ts` |

### Model Compatibility Test Invocations (Current - WRONG)

| Use Case | Function | Client | Issue |
|----------|----------|--------|-------|
| Query Optimization | `callLLM()` | `llm-provider-client.ts` | Different client |
| Content Assessment | `callLLM()` + lenient parse | `llm-provider-client.ts` | Different client + lenient extraction |
| Tag Generation | `callLLM()` + regex | `llm-provider-client.ts` | Different client + regex extraction |
| Summary Generation | `callLLM()` | `llm-provider-client.ts` | Different client |

### Key Difference

**Collection:**
```typescript
// JSON parsing happens INSIDE provider - THROWS on failure
const result = await provider.generateJSON<Tag[]>(prompt, systemPrompt);
```

**Test (Current):**
```typescript
// Returns raw text, then lenient extraction AFTER
const llmResult = await callLLM(provider, model, systemPrompt, userPrompt);
const arrayMatch = llmResult.content.match(/\[[\s\S]*?\]/); // Lenient!
```

---

## Implementation Plan

### Phase 1: Create API Key Helper Function

**File:** `src/app/api/llm-models/test/route.ts` (add at top of file)

**Add helper function to get API keys from environment:**

```typescript
/**
 * Get API key from environment variables for a provider type
 */
function getApiKeyFromEnv(providerType: string): string | undefined {
    switch (providerType.toLowerCase()) {
        case 'groq':
            return process.env.GROQ_API_KEY;
        case 'openai':
            return process.env.OPENAI_API_KEY;
        case 'anthropic':
            return process.env.ANTHROPIC_API_KEY;
        case 'zhipuai':
            return process.env.ZHIPUAI_API_KEY;
        case 'kimi':
            return process.env.KIMI_API_KEY;
        case 'alibaba':
            return process.env.ALIBABA_API_KEY;
        case 'baidu':
            return process.env.BAIDU_API_KEY;
        case 'ollama':
        case 'lmstudio':
            return undefined; // Local providers don't need API keys
        default:
            return undefined;
    }
}
```

**Todos:**
- [ ] Add `getApiKeyFromEnv()` function to `route.ts`

---

### Phase 2: Update Imports

**File:** `src/app/api/llm-models/test/route.ts`

**Current imports (line ~1-6):**
```typescript
import { NextResponse } from 'next/server';
import { handleError } from '@/lib/error-handler';
import fs from 'fs';
import path from 'path';
import { prisma } from '@/lib/db';
import { callLLM } from '@/lib/llm-provider-client';
```

**Replace with:**
```typescript
import { NextResponse } from 'next/server';
import { handleError } from '@/lib/error-handler';
import fs from 'fs';
import path from 'path';
import { prisma } from '@/lib/db';
import { LLMProviderFactory, LLMProvider, LLMConfig } from '@/lib/llm-service';
```

**Todos:**
- [ ] Remove `import { callLLM } from '@/lib/llm-provider-client';`
- [ ] Add `import { LLMProviderFactory, LLMProvider, LLMConfig } from '@/lib/llm-service';`

---

### Phase 3: Define Type Interfaces

**File:** `src/app/api/llm-models/test/route.ts`

**Add after existing interfaces (around line 21):**

```typescript
// Type for content assessment result (matches content-filter.ts)
interface ContentAssessmentResult {
    isRelevant: boolean;
    confidence: number;
    reasoning: string;
    matchedCategories?: string[];
    dimensionScores?: {
        technical: number;
        business: number;
        timeliness: number;
        practicality: number;
    };
    // Also support flat format
    technical?: number;
    business?: number;
    timeliness?: number;
    practicality?: number;
}

// Type for generated tag (matches tag-generator.ts)
interface GeneratedTag {
    name: string;
    category: string;
}
```

**Todos:**
- [ ] Add `ContentAssessmentResult` interface
- [ ] Add `GeneratedTag` interface

---

### Phase 4: Simplify Validation Functions

**File:** `src/app/api/llm-models/test/route.ts`

**Replace the entire `validateTestResult()` function (lines 66-218) with these simpler functions:**

```typescript
/**
 * Validate query optimization result
 * Should contain AND or OR operators for Boolean query
 */
function validateQueryResult(text: string): { valid: boolean; error: string | null } {
    const operators = ['AND', 'OR'];
    const regex = new RegExp(`\\b(${operators.join('|')})\\b`, 'i');
    const hasOperators = regex.test(text);

    if (!hasOperators) {
        return { valid: false, error: `Query missing ${operators.join('/')} operators` };
    }
    return { valid: true, error: null };
}

/**
 * Validate content assessment result
 * Check if result has required dimension scores
 */
function validateAssessmentResult(result: ContentAssessmentResult): { valid: boolean; error: string | null } {
    const requiredFields = ['technical', 'business', 'timeliness', 'practicality'];

    // Check flat format (technical, business, etc. at top level)
    let hasAllFields = requiredFields.every(field => typeof result[field] === 'number');

    // Check nested format (dimensionScores.technical, etc.)
    if (!hasAllFields && result.dimensionScores) {
        hasAllFields = requiredFields.every(field => typeof result.dimensionScores![field] === 'number');
    }

    if (!hasAllFields) {
        return { valid: false, error: `Missing required score fields (${requiredFields.join(', ')})` };
    }

    return { valid: true, error: null };
}

/**
 * Validate tag generation result
 * Check if array has at least one valid tag with name and category
 */
function validateTagsResult(result: GeneratedTag[]): { valid: boolean; error: string | null } {
    if (!Array.isArray(result)) {
        return { valid: false, error: 'Expected array of tags' };
    }

    if (result.length === 0) {
        return { valid: false, error: 'Tag array is empty' };
    }

    const hasValidTag = result.some(tag => tag.name && tag.category);
    if (!hasValidTag) {
        return { valid: false, error: 'No valid tags with name and category found' };
    }

    return { valid: true, error: null };
}

/**
 * Validate summary result
 * Check if summary has reasonable length
 */
function validateSummaryResult(text: string): { valid: boolean; error: string | null } {
    const trimmed = text.trim();
    const minLength = 100;
    const maxLength = 2000;

    if (trimmed.length < minLength) {
        return { valid: false, error: `Summary too short (${trimmed.length} chars, min ${minLength})` };
    }
    if (trimmed.length > maxLength) {
        return { valid: false, error: `Summary too long (${trimmed.length} chars, max ${maxLength})` };
    }

    return { valid: true, error: null };
}
```

**Todos:**
- [ ] Remove old `validateTestResult()` function (lines 66-218)
- [ ] Add `validateQueryResult()` function
- [ ] Add `validateAssessmentResult()` function
- [ ] Add `validateTagsResult()` function
- [ ] Add `validateSummaryResult()` function

---

### Phase 5: Refactor Test Invocation Logic

**File:** `src/app/api/llm-models/test/route.ts`

**Locate the test loop (around lines 287-319):**

**Current code:**
```typescript
for (const testType of testTypes) {
    // Send progress
    await writer.write(encoder.encode(`data: ${JSON.stringify({
        type: 'progress',
        model: modelInfo.id,
        test: testType
    })}\n\n`));

    const { systemPrompt, userPrompt } = await loadPrompt(testType);
    const llmResult = await callLLM(modelInfo.provider, modelInfo.id, systemPrompt, userPrompt);

    // Validate the response content
    let passed = llmResult.success;
    let error = llmResult.error || null;

    if (llmResult.success && llmResult.content) {
        const validation = validateTestResult(testType, llmResult.content);
        if (!validation.valid) {
            passed = false;
            error = validation.error;
        }
    }

    result.tests[testType] = {
        passed,
        duration: llmResult.duration,
        error,
        content: llmResult.content
    };

    // Small delay between tests to avoid rate limits
    await new Promise(resolve => setTimeout(resolve, 2000));
}
```

**Replace with:**
```typescript
for (const testType of testTypes) {
    // Send progress
    await writer.write(encoder.encode(`data: ${JSON.stringify({
        type: 'progress',
        model: modelInfo.id,
        test: testType
    })}\n\n`));

    const testStart = Date.now();
    let passed = false;
    let error: string | null = null;
    let content: string | undefined = undefined;

    try {
        // Create provider instance for this specific model
        const apiKey = getApiKeyFromEnv(modelInfo.provider);
        const providerConfig: LLMConfig = {
            provider: modelInfo.provider.toLowerCase() as LLMProvider,
            model: modelInfo.id,
            apiKey,
            temperature: 0.1,
            maxTokens: 2000,
        };

        const provider = LLMProviderFactory.create(providerConfig);

        const { systemPrompt, userPrompt } = await loadPrompt(testType);

        if (testType === 'query') {
            // Query optimization - uses generateText (same as collection)
            const text = await provider.generateText(userPrompt, systemPrompt);
            const validation = validateQueryResult(text);

            passed = validation.valid;
            error = validation.error;
            content = text;

        } else if (testType === 'assessment') {
            // Content assessment - uses generateJSON (same as collection)
            // This will THROW if JSON parsing fails - same behavior as collection!
            const assessmentResult = await provider.generateJSON<ContentAssessmentResult>(userPrompt, systemPrompt);
            const validation = validateAssessmentResult(assessmentResult);

            passed = validation.valid;
            error = validation.error;
            content = JSON.stringify(assessmentResult, null, 2);

        } else if (testType === 'tags') {
            // Tag generation - uses generateJSON (same as collection)
            // This will THROW if JSON parsing fails - same behavior as collection!
            const tagsResult = await provider.generateJSON<GeneratedTag[]>(userPrompt, systemPrompt);
            const validation = validateTagsResult(tagsResult);

            passed = validation.valid;
            error = validation.error;
            content = JSON.stringify(tagsResult, null, 2);

        } else if (testType === 'summary') {
            // Summary generation - uses generateText (same as collection)
            const text = await provider.generateText(userPrompt, systemPrompt);
            const validation = validateSummaryResult(text);

            passed = validation.valid;
            error = validation.error;
            content = text;
        }

    } catch (err) {
        // Catch exceptions from provider (including JSON parse errors)
        // This is the SAME behavior as collection - if JSON parsing fails, it throws
        passed = false;
        error = err instanceof Error ? err.message : String(err);
        content = undefined;
    }

    result.tests[testType] = {
        passed,
        duration: Date.now() - testStart,
        error,
        content
    };
}
```

**Key Changes:**
1. Creates a provider instance for each test (using `LLMProviderFactory.create()`)
2. Uses `provider.generateText()` for query and summary (same as collection)
3. Uses `provider.generateJSON()` for assessment and tags (same as collection)
4. JSON parsing happens INSIDE the provider (throws on failure - same as collection)
5. Removed the delay between tests (not needed for single model test)

**Todos:**
- [ ] Replace the test loop with the new implementation
- [ ] Ensure provider instance is created with correct config (temperature: 0.1, maxTokens: 2000)
- [ ] Ensure `generateJSON()` is used for assessment and tags
- [ ] Ensure `generateText()` is used for query and summary
- [ ] Ensure exceptions (including JSON parse errors) are caught and reported

---

### Phase 6: Remove Delay Between Models (Optional)

**File:** `src/app/api/llm-models/test/route.ts`

**Current code (around line 330):**
```typescript
// Delay between models
await new Promise(resolve => setTimeout(resolve, 3000));
```

**Decision:** This can be kept or removed based on preference. Since we're testing each model only once, rate limits shouldn't be an issue. However, keeping a small delay doesn't hurt.

**Recommendation:** Keep the delay but reduce it to 1 second:
```typescript
// Small delay between models
await new Promise(resolve => setTimeout(resolve, 1000));
```

**Todos:**
- [ ] Reduce delay between models from 3000ms to 1000ms (or remove entirely)

---

### Phase 7: Preserve Logging

**File:** `src/app/api/llm-models/test/route.ts`

**No changes needed** - the logging logic (lines 333-351) should work the same way.

**Verify:**
- [ ] Log file is created at `logs/llm-model-test-*.log`
- [ ] Log file contains timestamp, duration, and results
- [ ] `llm-model-test-latest.log` is updated

---

### Phase 8: Preserve SSE Streaming

**File:** `src/app/api/llm-models/test/route.ts`

**No changes needed** - the SSE streaming logic should work the same way.

**Verify:**
- [ ] Progress events are sent: `{ type: 'progress', model, test }`
- [ ] Result events are sent: `{ type: 'result', result }`
- [ ] Complete event is sent: `{ type: 'complete', timestamp }`

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/app/api/llm-models/test/route.ts` | Refactor to use `llm-service.ts` |

---

## Summary of Changes

| Aspect | Before | After |
|--------|--------|-------|
| **Client** | `llm-provider-client.ts` | `llm-service.ts` |
| **JSON Parsing** | After response (lenient) | Inside provider (strict) |
| **Error Handling** | Returns `{valid: false}` | Throws exception |
| **Validation** | Regex extraction | Simple field check |

---

## Testing Checklist

After implementation, verify:

- [ ] TypeScript compilation: `npx tsc --noEmit`
- [ ] Build passes: `npm run build`
- [ ] Test with known working model (e.g., `llama-3.3-70b-versatile`)
- [ ] Test with model that returns malformed JSON - should now fail (same as collection)
- [ ] Verify log files are created correctly
- [ ] Verify SSE streaming works in UI

---

## Expected Outcome

After this refactoring:
1. Models that pass the test will work correctly during collection
2. Models that fail the test would have failed during collection anyway
3. No more false positives from lenient JSON extraction

---

## Rollback Plan

If issues arise, revert to using `llm-provider-client.ts`:
1. Restore `import { callLLM } from '@/lib/llm-provider-client';`
2. Restore `validateTestResult()` function with lenient extraction
3. Restore test loop using `callLLM()`
