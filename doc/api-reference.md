# Research Copilot API Reference

Complete API documentation for Research Copilot - AI-powered banking research platform.

**Base URL:**
- Production: `https://research-copilot-kappa.vercel.app/api`
- Local: `http://localhost:3000/api`

---

## Table of Contents

1. [Authentication](#authentication)
2. [Papers Management](#papers-management)
3. [Collection Pipeline](#collection-pipeline)
4. [Daily Digest](#daily-digest)
5. [Analytics & Insights](#analytics--insights)
6. [Export](#export)
7. [Settings](#settings)
8. [Alerts](#alerts)
9. [LLM Configuration](#llm-configuration)
10. [Tags](#tags)

---

## Quick Start

### Authentication
Most APIs require authentication. Include the session cookie or JWT token in your requests.

### Common Response Format
```json
{
  "success": true,
  "data": { ... },
  "error": "error message if failed"
}
```

### HTTP Status Codes
- `200` - Success
- `400` - Bad Request
- `401` - Unauthorized
- `404` - Not Found
- `500` - Server Error

---

## Authentication

### POST /auth/login
Authenticate user with email/password.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "your-password"
}
```

**Response:**
```json
{
  "success": true,
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "User Name"
  }
}
```

### POST /auth/register
Register new user.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "your-password",
  "name": "User Name"
}
```

### GET /auth/me
Get current authenticated user info.

**Response:**
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "name": "User Name"
}
```

### POST /auth/logout
Logout current user.

---

## Papers Management

### GET /papers
Retrieve papers with filters.

**Query Parameters:**
- `search` - Search query string
- `source` - Filter by source (e.g., "ArXiv", "SSRN")
- `tags` - Filter by tags (comma-separated)
- `from` - Start date (YYYY-MM-DD)
- `to` - End date (YYYY-MM-DD)
- `limit` - Number of results (default: 20)
- `offset` - Pagination offset
- `favorite` - Filter by favorite status (true/false)

**Response:**
```json
{
  "success": true,
  "papers": [
    {
      "id": "uuid",
      "title": "Paper Title",
      "abstract": "Paper abstract...",
      "url": "https://arxiv.org/abs/...",
      "source": "ArXiv",
      "sourceType": "PREPRINT",
      "collectedAt": "2026-03-23T10:00:00Z",
      "relevanceScore": 8.5,
      "tags": [...],
      "isFavorite": false
    }
  ],
  "total": 100
}
```

### GET /papers/[id]
Get single paper details.

### PUT /papers/[id]
Update paper information.

### DELETE /papers/[id]
Delete paper (soft delete).

**Response:**
```json
{
  "success": true,
  "message": "Paper deleted successfully"
}
```

### POST /papers/[id]/favorite
Toggle favorite status.

### POST /papers/[id]/tags
Add tags to paper.

**Request:**
```json
{
  "tags": ["machine-learning", "risk-management"]
}
```

### POST /papers/[id]/auto-tag
Auto-generate tags using LLM.

---

## Collection Pipeline

### POST /collection
Trigger paper collection pipeline.

**Request:**
```json
{
  "mode": "pipeline",
  "query": "machine learning banking",
  "useLLM": true,
  "maxResults": 20,
  "horizon": "month"
}
```

**Response:**
```json
{
  "success": true,
  "totalFound": 20,
  "saved": 15,
  "rejected": 5
}
```

### POST /auto-collect
Trigger automatic collection based on preferences.

---

## Daily Digest

### GET /daily-digest
Get daily digest for a date.

**Query Parameters:**
- `date` - Date code (YYYY-MM-DD), defaults to today

**Response:**
```json
{
  "success": true,
  "status": "ready",
  "digest": {
    "id": "uuid",
    "dateCode": "2026-03-23",
    "title": "Research Copilot: Daily Intelligence Digest",
    "content": "# Markdown content...",
    "papers": [...]
  }
}
```

**Statuses:**
- `ready` - Digest available
- `stale` - Needs refresh
- `empty` - No papers
- `generating` - In progress
- `error` - Failed to generate

### POST /daily-digest
Force regenerate digest for a date.

**Request:**
```json
{
  "dateCode": "2026-03-23"
}
```

### GET /daily-digest/batch
List dates with papers but no digests.

**Response:**
```json
{
  "success": true,
  "dates": [
    {
      "dateCode": "2026-03-21",
      "paperCount": 13
    }
  ],
  "total": 8
}
```

### POST /daily-digest/batch
Generate digests for multiple dates.

**Request:**
```json
{
  "dateCodes": ["2026-03-21", "2026-03-22"],
  "maxConcurrent": 3
}
```

See detailed guide: [daily-digest-generator-api-guide.md](daily-digest-generator-api-guide.md)

---

## Analytics & Insights

### GET /stats
Get dashboard statistics.

**Response:**
```json
{
  "total": 150,
  "todayCount": 5,
  "riskCount": 30,
  "businessAppsCount": 45,
  "growthRate": 12.5
}
```

### GET /trends
Get research trends analysis.

**Query Parameters:**
- `period` - Time period (7d, 30d, 90d)
- `metric` - Metric type (papers, tags, sources)

### GET /radar
Get technology radar data.

**Response:**
```json
{
  "quadrants": [...],
  "technologies": [
    {
      "name": "Graph Neural Networks",
      "quadrant": "AI-Technology",
      "ring": "adopt",
      "count": 25
    }
  ]
}
```

### GET /recommendations
Get paper recommendations.

**Query Parameters:**
- `limit` - Number of recommendations (default: 10)

### GET /competitive-intel
Get competitive intelligence analysis.

---

## Export

### POST /export/powerpoint
Export papers to PowerPoint.

**Request:**
```json
{
  "paperIds": ["uuid1", "uuid2"],
  "template": "banking-research"
}
```

**Response:**
```json
{
  "success": true,
  "downloadUrl": "https://.../export.pptx"
}
```

### POST /export/social-media
Generate social media content.

**Request:**
```json
{
  "paperIds": ["uuid1"],
  "platform": "linkedin",
  "tone": "professional"
}
```

### POST /export/digest
Export digest in various formats.

**Request:**
```json
{
  "dateCode": "2026-03-23",
  "format": "pdf"
}
```

---

## Settings

### GET /settings/prompts
Get all prompt configurations.

**Response:**
```json
{
  "queryOptimization": "...",
  "contentAssessment": "...",
  "digestGeneration": "..."
}
```

### PUT /settings/prompts
Update prompt configuration.

**Request:**
```json
{
  "prompts": {
    "digestGeneration": "new prompt..."
  }
}
```

### GET /settings/collection
Get collection settings.

### PUT /settings/collection
Update collection settings.

### GET /settings/llm
Get LLM provider settings.

---

## Alerts

### GET /alerts
Get user alerts/notifications.

**Query Parameters:**
- `status` - Filter by status (new, read, archived)
- `limit` - Number of results

### PUT /alerts/[id]
Update alert status.

**Request:**
```json
{
  "status": "read"
}
```

---

## LLM Configuration

### GET /llm-providers
List available LLM providers.

### GET /llm-models
List available models for current provider.

### GET /llm-providers/groq-models
Get Groq-specific models.

### GET /llm-providers/ollama-models
Get Ollama-specific models.

### POST /llm-models/test
Test LLM model connection.

**Request:**
```json
{
  "provider": "groq",
  "model": "llama-3.3-70b-versatile"
}
```

### POST /llm-init
Initialize or reconfigure LLM service.

---

## Tags

### GET /tags
Get all tags.

**Response:**
```json
{
  "tags": [
    {
      "id": "uuid",
      "name": "machine-learning",
      "category": "ai-technology",
      "count": 45
    }
  ]
}
```

### GET /source-types
Get available source types.

---

## Error Handling

### Common Error Response
```json
{
  "success": false,
  "error": "Detailed error message",
  "code": "ERROR_CODE"
}
```

### Error Codes
- `UNAUTHORIZED` - Authentication required
- `NOT_FOUND` - Resource not found
- `VALIDATION_ERROR` - Invalid request data
- `RATE_LIMITED` - Too many requests
- `LLM_ERROR` - LLM service error

---

## Rate Limiting

- Collection API: 10 requests per minute
- LLM APIs: 30 requests per minute
- Other APIs: 100 requests per minute

---

## Best Practices

1. **Always check `success` field** in responses
2. **Handle pagination** for list endpoints
3. **Cache digest content** - it doesn't change frequently
4. **Use batch API** for multiple operations
5. **Respect rate limits** - implement exponential backoff

---

## Examples

### Example: Get Today's Papers and Digest

```bash
# Get papers collected today
curl "https://research-copilot-kappa.vercel.app/api/papers?from=2026-03-23&to=2026-03-23"

# Get today's digest
curl "https://research-copilot-kappa.vercel.app/api/daily-digest?date=2026-03-23"
```

### Example: Export Research to PPT

```bash
# First get paper IDs
curl "https://research-copilot-kappa.vercel.app/api/papers?search=machine+learning&limit=5"

# Then export
curl -X POST "https://research-copilot-kappa.vercel.app/api/export/powerpoint" \
  -H "Content-Type: application/json" \
  -d '{
    "paperIds": ["uuid1", "uuid2", "uuid3"]
  }'
```

### Example: JavaScript Client

```javascript
const API_BASE = 'https://research-copilot-kappa.vercel.app/api';

// Get papers
async function getPapers(search, limit = 10) {
  const response = await fetch(
    `${API_BASE}/papers?search=${search}&limit=${limit}`
  );
  return response.json();
}

// Trigger collection
async function collectPapers(query) {
  const response = await fetch(`${API_BASE}/collection`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mode: 'pipeline',
      query,
      useLLM: true
    })
  });
  return response.json();
}
```

---

**Last Updated:** 2026-03-23  
**API Version:** 1.0  
**Document Version:** 1.0
