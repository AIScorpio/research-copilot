# Thinking Block Handler - Design Document

**Created**: 2026-02-23
**Status**: Draft for Review
**Priority**: High
**Scope**: LLM response processing for thinking-capable models

---

## Problem Statement

Thinking-capable LLM models (GLM 4.6+, Qwen3, DeepSeek-R1, etc.) return responses with `<think/>` blocks containing their reasoning process before the actual answer. This causes failures in our LLM invocation pipeline.

### Evidence from Test Logs

| Model | Query | Assessment | Tags | Summary | Root Cause |
|-------|-------|------------|------|---------|------------|
| GLM-4.5 | ✓ | ✓ | ✓ | ✓ | No thinking - works correctly |
| GLM-4.5-air | ✓ | ✓ | ✓ | ✓ | No thinking - works correctly |
| **GLM-4.6** | ✓ | ✗ | ✗ | ✗ | "No response content from LLM" |
| **GLM-4.7** | ✓ | ✗ | ✓ | ✓ | "No response content from LLM" |
| **GLM-5** | ✓ | ✗ | ✗ | ✓ | "No response content from LLM" |
| **Qwen3-32b** | ✓ | ✗ | ✗ | ✗ | "Invalid JSON format" + "Summary too long" |

### Response Format Examples

**Standard model (GLM-4.5) response:**
```
("machine learning" OR "deep learning") AND ("credit risk") ...
```

**Thinking-capable model (Qwen3) response:**
```
<think/>
Okay, let's tackle this query optimization. The user wants to find "AI in banking"...
[... extensive reasoning content ...]
</think/>

("machine learning" OR "deep learning") AND ("credit risk") ...
```

### Current Code Issue

**Location**: `src/lib/llm-provider-client.ts:180-188` and `src/lib/llm-service.ts`

```typescript
// Current implementation - doesn't handle thinking blocks
const content = data.choices?.[0]?.message?.content;

if (!content) {
    return {
        success: false,
        error: 'No response content from LLM',
        duration
    };
}
```

**Issues:**
1. Some APIs return thinking content in separate fields not captured
2. When thinking is in content, JSON parsing fails (thinking text before JSON)
3. Length validations fail (thinking content inflates response length)

---

## Proposed Solution

### Strategy: Strip Thinking Blocks + Enhanced Response Extraction

Create a response post-processor that:
1. Detects and strips `<think/>` blocks from content
2. Extracts only the final answer for processing
3. Optionally preserves thinking content for logging/debugging

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    LLM API Response                             │
├─────────────────────────────────────────────────────────────────┤
│  {                                                              │
│    "choices": [{                                                │
│      "message": {                                               │
│        "content": "<think/>reasoning</think/>\n\nactual answer" │
│      }                                                          │
│    }]                                                           │
│  }                                                              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│              ThinkingBlockProcessor (NEW)                       │
├─────────────────────────────────────────────────────────────────┤
│  1. Detect thinking block format                                │
│  2. Strip thinking content                                      │
│  3. Return clean response                                       │
│  4. (Optional) Log thinking for debugging                       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Application Logic                            │
│                    (Receives clean content)                     │
└─────────────────────────────────────────────────────────────────┘
```

### Component Design

#### 1. Thinking Block Processor Utility

**File**: `src/lib/llm-thinking-processor.ts` (NEW)

```typescript
/**
 * Thinking block patterns for different model families
 */
const THINKING_PATTERNS = {
  // Qwen, DeepSeek style
  THINK_TAG: /<think\/>[\s\S]*?<\/think\/>/g,
  // Alternative formats
  REASONING_TAG: /<reasoning>[\s\S]*?<\/reasoning>/g,
  THINK_SIMPLE: /<think[\s\S]*?<\/think>/g,
  // Chinese variants
  THINK_CN: /<思考>[\s\S]*?<\/思考>/g,
};

interface ProcessedResponse {
  content: string;           // Clean content without thinking
  thinking?: string;         // Extracted thinking (optional, for logging)
  hadThinking: boolean;      // Whether thinking was detected
  originalLength: number;    // Original response length
  cleanedLength: number;     // Cleaned response length
}

/**
 * Process LLM response to extract clean content
 * Strips thinking/reasoning blocks from model responses
 */
export function processThinkingContent(rawContent: string): ProcessedResponse {
  if (!rawContent) {
    return {
      content: '',
      hadThinking: false,
      originalLength: 0,
      cleanedLength: 0
    };
  }

  let thinking = '';
  let cleanContent = rawContent;
  let hadThinking = false;

  // Try each pattern
  for (const [name, pattern] of Object.entries(THINKING_PATTERNS)) {
    const matches = rawContent.match(pattern);
    if (matches && matches.length > 0) {
      hadThinking = true;
      thinking = matches.join('\n');
      cleanContent = cleanContent.replace(pattern, '').trim();
    }
  }

  return {
    content: cleanContent,
    thinking: hadThinking ? thinking : undefined,
    hadThinking,
    originalLength: rawContent.length,
    cleanedLength: cleanContent.length
  };
}
```

#### 2. Integration Points

**A. llm-provider-client.ts** (simplified callLLM function)

```typescript
// Add import
import { processThinkingContent } from './llm-thinking-processor';

// In callLLM function, replace content extraction:
const rawContent = data.choices?.[0]?.message?.content;

if (!rawContent) {
    return {
        success: false,
        error: 'No response content from LLM',
        duration
    };
}

// Process thinking blocks
const processed = processThinkingContent(rawContent);

// Log thinking content for debugging if present
if (processed.hadThinking) {
    logger.debug('LLM response contained thinking block', {
        originalLength: processed.originalLength,
        cleanedLength: processed.cleanedLength,
        thinkingPreview: processed.thinking?.substring(0, 200)
    });
}

return {
    success: true,
    content: processed.content,
    duration,
    tokensUsed: data.usage?.total_tokens
};
```

**B. llm-service.ts** (BaseProvider class)

```typescript
// Add import
import { processThinkingContent } from './llm-thinking-processor';

// Update generateText method in BaseProvider or each provider
async generateText(prompt: string, systemPrompt?: string): Promise<string> {
    // ... existing API call logic ...

    const rawContent = completion.choices[0]?.message?.content?.trim() || '';

    // Process thinking blocks
    const processed = processThinkingContent(rawContent);

    if (processed.hadThinking) {
        logger.debug(`[${this.getProviderName()}] Response had thinking block`, {
            originalLength: processed.originalLength,
            cleanedLength: processed.cleanedLength
        });
    }

    return processed.content;
}
```

**C. JSON Parsing Enhancement**

The existing `parseJSON` method in `llm-service.ts` should also be updated:

```typescript
protected parseJSON<T>(text: string): T {
    // First, process any thinking blocks
    const processed = processThinkingContent(text);

    // Use cleaned content for parsing
    let cleanText = processed.content;

    // ... rest of existing JSON parsing logic ...
}
```

---

## Configuration Options

### Model-Specific Thinking Behavior

Add to model configuration:

```typescript
interface ThinkingModelConfig {
  supportsThinking: boolean;      // Whether model has thinking capability
  stripThinking: boolean;         // Whether to strip thinking from response
  logThinking: boolean;           // Whether to log thinking content
  thinkingFormat: 'think' | 'reasoning' | 'custom';  // Format type
}
```

### Known Thinking-Capable Models

```typescript
const THINKING_MODELS: Record<string, ThinkingModelConfig> = {
  // ZhipuAI
  'glm-4.6': { supportsThinking: true, stripThinking: true, logThinking: true, thinkingFormat: 'think' },
  'glm-4.7': { supportsThinking: true, stripThinking: true, logThinking: true, thinkingFormat: 'think' },
  'glm-5': { supportsThinking: true, stripThinking: true, logThinking: true, thinkingFormat: 'think' },

  // Qwen (via Groq or direct)
  'qwen3-32b': { supportsThinking: true, stripThinking: true, logThinking: true, thinkingFormat: 'think' },
  'qwen3-235b': { supportsThinking: true, stripThinking: true, logThinking: true, thinkingFormat: 'think' },

  // DeepSeek
  'deepseek-r1': { supportsThinking: true, stripThinking: true, logThinking: true, thinkingFormat: 'think' },
  'deepseek-reasoner': { supportsThinking: true, stripThinking: true, logThinking: true, thinkingFormat: 'reasoning' },
};
```

---

## Edge Cases & Considerations

### 1. Empty Response After Stripping

If thinking is stripped and content is empty:
- Log warning
- Return appropriate error message

### 2. Truncated Thinking Blocks

If thinking block is incomplete (model hit token limit):
- Use regex that handles partial matches
- Extract whatever content is available

### 3. Nested or Malformed Tags

Handle edge cases:
- Multiple thinking blocks
- Nested tags
- Unclosed tags

### 4. Performance Impact

- Regex processing adds minimal overhead (< 1ms)
- No impact on models without thinking

---

## Testing Strategy

### Unit Tests

```typescript
describe('processThinkingContent', () => {
  it('should pass through content without thinking blocks', () => {
    const input = 'Simple response without thinking';
    const result = processThinkingContent(input);
    expect(result.content).toBe(input);
    expect(result.hadThinking).toBe(false);
  });

  it('should strip <think/> blocks', () => {
    const input = '<think/>Reasoning here</think/>\n\nActual answer';
    const result = processThinkingContent(input);
    expect(result.content).toBe('Actual answer');
    expect(result.hadThinking).toBe(true);
  });

  it('should handle multiple thinking blocks', () => {
    const input = '<think/>First</think/>Answer<think/>Second</think/>';
    const result = processThinkingContent(input);
    expect(result.content).toBe('Answer');
  });

  it('should handle JSON after thinking', () => {
    const input = '<think/>Thinking...</think/>\n\n```json\n{"key": "value"}\n```';
    const result = processThinkingContent(input);
    expect(result.content).toContain('{"key": "value"}');
  });
});
```

### Integration Tests

Re-run model compatibility tests with:
- GLM-4.6, GLM-4.7, GLM-5
- Qwen3-32b
- DeepSeek-R1 (if available)

Verify all 4 test types pass:
1. Query optimization
2. Content assessment (JSON)
3. Tag generation (JSON)
4. Summary generation

---

## Implementation Roadmap

### Phase 1: Core Implementation (Estimated: 1-2 hours)
- [ ] Create `src/lib/llm-thinking-processor.ts`
- [ ] Add unit tests for processor
- [ ] Integrate into `llm-provider-client.ts`

### Phase 2: Service Integration (Estimated: 1 hour)
- [ ] Update `llm-service.ts` BaseProvider
- [ ] Update JSON parsing logic
- [ ] Add logging for thinking detection

### Phase 3: Configuration & Testing (Estimated: 1 hour)
- [ ] Add model-specific configuration
- [ ] Run full model compatibility test suite
- [ ] Document supported models

### Phase 4: Validation (Estimated: 30 min)
- [ ] Verify all thinking models pass tests
- [ ] Confirm no regression on standard models
- [ ] Update model compatibility documentation

---

## Rollback Plan

If issues arise:
1. Thinking processor can be disabled via configuration flag
2. Fallback to raw content if processor fails
3. No database changes required - pure code change

---

## Questions for Discussion

1. **Should we preserve thinking content?**
   - Option A: Discard after processing (current proposal)
   - Option B: Store in separate field for analysis
   - Option C: Log to file only

2. **Should thinking be configurable per model?**
   - Allow users to toggle thinking stripping per model?
   - Or always strip for application consistency?

3. **Error handling preference?**
   - Fail silently and return empty content?
   - Throw error with detailed message?
   - Return partial content with warning?

---

## Appendix: Sample Test Results

### Before Fix (Current State)

```
GLM-4.6 Assessment: FAILED - "No response content from LLM"
GLM-4.7 Tags: FAILED - "No response content from LLM"
Qwen3-32b Assessment: FAILED - "Invalid JSON format"
```

### Expected After Fix

```
GLM-4.6 Assessment: PASSED - Correctly parses JSON response
GLM-4.7 Tags: PASSED - Correctly parses JSON array
Qwen3-32b Assessment: PASSED - Strips thinking, parses JSON
```
