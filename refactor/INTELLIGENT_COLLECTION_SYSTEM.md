# Intelligent Collection System Implementation

## Overview
This document describes the complete intelligent collection system with LLM-powered filtering and multi-source support.

## Files Created/Modified

### 1. Core LLM Service (`src/lib/llm-service.ts`)
- **Purpose**: Unified interface for all LLM providers
- **Features**:
  - Supports 5 providers: Groq, OpenAI, Anthropic, Ollama, LM Studio
  - Provider factory pattern for easy extension
  - Abstract provider interface
  - Connection testing for each provider
  - Automatic fallback handling

### 2. Query Optimizer (`src/lib/query-optimizer.ts`)
- **Purpose**: Transform generic queries into banking-specific queries
- **Features**:
  - LLM-powered query optimization
  - Source-specific query generation
  - Query variation generation
  - Topic expansion into sub-topics
  - Fallback heuristics when LLM unavailable

### 3. Content Filter (`src/lib/content-filter.ts`)
- **Purpose**: LLM-powered content relevance checking
- **Features**:
  - Relevance scoring (0-100)
  - Banking context detection
  - AI technology detection
  - Duplicate detection with similarity scoring
  - Batch processing support
  - Fallback keyword-based filtering

### 4. Enhanced Collection Service (`src/lib/collection-service.ts`)
- **Purpose**: Orchestrate full collection flow
- **Features**:
  - Three collection modes: auto, manual, pipeline
  - LLM query optimization (optional)
  - LLM content filtering (optional)
  - Multi-source collection
  - Database duplicate detection
  - Configurable limits (no hardcoding)
  - Comprehensive error handling
  - Collection statistics

### 5. Scheduler (`src/lib/scheduler.ts`)
- **Purpose**: Daily auto-collection with cron support
- **Features**:
  - Configurable cron expression (default: 2 AM daily)
  - Manual trigger support
  - Scheduler status tracking
  - Last run tracking
  - Auto-disable on repeated failures

### 6. LLM Settings API (`src/app/api/settings/llm/route.ts`)
- **Purpose**: Manage LLM configuration
- **Endpoints**:
  - `GET`: Get current configuration (masked API key)
  - `POST`: Save configuration (with validation)
  - `PATCH`: Test connection without saving

### 7. Updated Collection API (`src/app/api/collection/route.ts`)
- **Purpose**: Main collection endpoint
- **Features**:
  - Supports all collection modes
  - Comprehensive input validation
  - Better error handling and logging
  - Statistics endpoint

### 8. Updated Auto-Collect API (`src/app/api/auto-collect/route.ts`)
- **Purpose**: Auto-collection endpoint
- **Endpoints**:
  - `POST`: Trigger auto-collection
  - `GET`: Get scheduler status
  - `PATCH`: Update scheduler config

### 9. Enhanced Settings Page (`src/app/settings/page.tsx`)
- **Purpose**: LLM configuration UI
- **Features**:
  - Provider selection dropdown
  - API key input with show/hide
  - Base URL configuration for local models
  - Model selection
  - Temperature and max tokens settings
  - Connection testing
  - Configuration saving
  - Current status display

## How to Configure LLM in Settings

1. **Navigate to Settings Page**
   - Go to `/settings` in the application

2. **Select LLM Provider**
   - Choose from: Groq (recommended), OpenAI, Anthropic, Ollama, LM Studio
   - Groq offers fast, cost-effective inference
   - Ollama/LM Studio for local/privacy-focused deployment

3. **Enter API Key** (for cloud providers)
   - Groq: Get key from https://console.groq.com
   - OpenAI: Get key from https://platform.openai.com
   - Anthropic: Get key from https://console.anthropic.com

4. **Configure Local Models** (for Ollama/LM Studio)
   - Ollama: Default URL is `http://localhost:11434`
   - LM Studio: Default URL is `http://localhost:1234`
   - Ensure the local server is running

5. **Test Connection**
   - Click "Test Connection" to verify settings
   - Check latency and response

6. **Save Configuration**
   - Click "Save Configuration" to apply settings
   - Configuration is stored in environment variables

## Collection Flow

### Auto Collection Mode
```
1. Scheduler triggers at configured time (default: 2 AM daily)
2. Query: "AI in banking" (default)
3. Horizon: Past week
4. LLM Optimization: Enabled
5. LLM Filtering: Enabled
6. Max Results: 50
7. Min Relevance Score: 60
```

### Manual Collection Mode
```
1. User initiates collection via API/UI
2. Custom query and parameters
3. LLM Optimization: Optional (default: enabled)
4. LLM Filtering: Optional (default: enabled)
5. Max Results: Configurable (default: 100)
6. Min Relevance Score: Configurable (default: 50)
```

### Pipeline Mode
```
1. Advanced search with strict filtering
2. LLM Optimization: Enabled
3. LLM Filtering: Enabled with high threshold
4. Max Results: 200
5. Min Relevance Score: 70
6. Focus on academic sources
```

### Detailed Flow Steps

1. **Query Optimization** (if enabled)
   - Original query is sent to LLM
   - LLM generates banking-specific terms
   - Source-specific queries created
   - Rationale provided for optimization

2. **Multi-Source Search**
   - ArXiv (academic papers)
   - Semantic Scholar (academic papers)
   - Banking news RSS feeds
   - Regulatory sources (BIS, ECB, FCA, etc.)
   - Social media (optional)

3. **Duplicate Detection**
   - Check database for existing URLs
   - Check for similar titles
   - Remove duplicates from results

4. **Content Filtering** (if enabled)
   - Each paper sent to LLM for relevance check
   - Banking context assessment
   - AI technology assessment
   - Relevance score (0-100)
   - Papers below threshold filtered out

5. **Database Storage**
   - Save relevant papers
   - Generate and link tags
   - Store relevance reasoning as summary
   - Update collection statistics

6. **Post-Processing**
   - Trigger alerts for new papers
   - Revalidate cache
   - Update dashboard

## API Usage Examples

### Manual Collection
```bash
curl -X POST http://localhost:3000/api/collection \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "manual",
    "query": "machine learning credit risk",
    "horizon": "month",
    "useLLMOptimization": true,
    "useLLMFiltering": true,
    "maxResults": 50,
    "minRelevanceScore": 65
  }'
```

### Auto Collection Trigger
```bash
curl -X POST http://localhost:3000/api/auto-collect \
  -H "Content-Type: application/json" \
  -d '{
    "trigger": true,
    "override": {
      "query": "AI fraud detection"
    }
  }'
```

### Configure LLM
```bash
curl -X POST http://localhost:3000/api/settings/llm \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "groq",
    "apiKey": "your-api-key",
    "model": "llama-3.3-70b-versatile",
    "temperature": 0.3,
    "maxTokens": 1000
  }'
```

### Test LLM Connection
```bash
curl -X PATCH http://localhost:3000/api/settings/llm \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "groq",
    "apiKey": "your-api-key"
  }'
```

## Environment Variables

Add these to your `.env` file:

```env
# LLM Provider Configuration
LLM_PROVIDER=groq
LLM_MODEL=llama-3.3-70b-versatile
LLM_TEMPERATURE=0.3
LLM_MAX_TOKENS=1000

# API Keys (at least one required for cloud providers)
GROQ_API_KEY=your-groq-api-key
OPENAI_API_KEY=your-openai-api-key
ANTHROPIC_API_KEY=your-anthropic-api-key

# Local LLM Configuration (for Ollama/LM Studio)
LLM_BASE_URL=http://localhost:11434

# Auto-Collection Configuration
AUTO_COLLECT_ENABLED=true
AUTO_COLLECT_CRON=0 2 * * *
AUTO_COLLECT_QUERY=AI in banking
AUTO_COLLECT_ON_STARTUP=false
```

## Key Features Summary

✅ **Multi-Provider LLM Support**: Groq, OpenAI, Anthropic, Ollama, LM Studio
✅ **LLM-Powered Query Optimization**: Transforms generic queries into banking-specific terms
✅ **LLM-Powered Content Filtering**: Relevance scoring with reasoning
✅ **No Hardcoded Limits**: All limits configurable via API
✅ **Duplicate Detection**: URL and title-based deduplication
✅ **Multi-Source Collection**: Academic, news, regulatory, social
✅ **Three Collection Modes**: Auto, manual, pipeline
✅ **Scheduler Support**: Daily auto-collection with cron
✅ **Settings UI**: Complete LLM configuration interface
✅ **Connection Testing**: Validate settings before saving
✅ **Comprehensive Logging**: Full visibility into collection process
✅ **Error Handling**: Graceful fallbacks and error reporting

## Testing

To test the implementation:

1. **Configure LLM Provider**
   ```bash
   # Set your API key in .env or via settings UI
   GROQ_API_KEY=your-key
   ```

2. **Test Connection**
   - Go to Settings → LLM Configuration
   - Click "Test Connection"
   - Verify successful connection

3. **Run Manual Collection**
   ```bash
   curl -X POST http://localhost:3000/api/collection \
     -H "Content-Type: application/json" \
     -d '{"mode": "manual", "query": "AI banking", "maxResults": 10}'
   ```

4. **Check Results**
   - View collected papers in the dashboard
   - Check relevance scores in paper summaries
   - Verify tags were generated

## Next Steps

1. Run database migrations if schema changes were made
2. Configure environment variables
3. Test LLM connection in settings
4. Run initial manual collection
5. Enable auto-collection scheduler
6. Monitor logs for any issues
