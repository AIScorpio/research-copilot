# Research Copilot API Reference

Complete API documentation for Research Copilot - AI-powered banking research platform.

**Base URL:**
- Production: `https://research-copilot-kappa.vercel.app/api`
- Local: `http://localhost:3000/api`

---

## Table of Contents

1. [Authentication](#authentication) - 8 endpoints
2. [Papers Management](#papers-management) - 8 endpoints
3. [Collection Pipeline](#collection-pipeline) - 8 endpoints
4. [Daily Digest](#daily-digest) - 4 endpoints
5. [Analytics & Insights](#analytics--insights) - 6 endpoints
6. [Export](#export) - 3 endpoints
7. [Settings](#settings) - 9 endpoints
8. [Alerts](#alerts) - 5 endpoints
9. [LLM Configuration](#llm-configuration) - 10 endpoints
10. [Tags](#tags) - 1 endpoint

**Total: 63 API Endpoints**

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
- `403` - Forbidden (Invalid CSRF token)
- `404` - Not Found
- `409` - Conflict
- `500` - Server Error

---

## Authentication

### POST /auth/login
Authenticate user with email and password.

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
    "email": "user@example.com"
  },
  "csrfToken": "token-string"
}
```

**Error Codes:**
- `401` - Invalid email or password

---

### POST /auth/register
Register a new user account.

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
  "userId": "uuid"
}
```

**Error Codes:**
- `400` - Invalid input or email already exists

---

### GET /auth/me
Get current authenticated user info.

**Response:**
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com"
  }
}
```

**Response (not authenticated):**
```json
{
  "user": null
}
```

---

### POST /auth/logout
Logout current user and clear authentication cookies.

**Response:**
```json
{
  "success": true
}
```

---

### POST /auth/google
Google OAuth authentication via JWT credential token.

**Request:**
```json
{
  "credential": "google-jwt-token"
}
```

**Response:**
```json
{
  "success": true,
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "User Name",
    "image": "https://..."
  },
  "csrfToken": "token-string"
}
```

**Error Codes:**
- `400` - Missing or invalid credential
- `401` - Invalid authentication token

---

### POST /auth/oauth
Initialize OAuth flow for Google or GitHub.

**Request:**
```json
{
  "provider": "google",
  "redirectUrl": "/dashboard"
}
```

**Response:**
```json
{
  "success": true,
  "authUrl": "https://accounts.google.com/o/oauth2/...",
  "provider": "google"
}
```

**Alternative: GET /auth/oauth?provider=google**
Redirects directly to OAuth provider.

**Error Codes:**
- `400` - Invalid request data

---

### GET /auth/callback
OAuth callback handler for Google and GitHub.

**Query Parameters:**
- `code` (required) - Authorization code from OAuth provider
- `state` (required) - State parameter for CSRF protection
- `error` - Error from OAuth provider (if failed)
- `error_description` - Error description (if failed)

**Response:**
- `302` - Redirects to original URL or login with error

**Error Codes:**
- `400` - Missing code or state parameter

---

### POST /auth/social
Initialize OAuth flow for social media platforms (Reddit, LinkedIn, Twitter, Mastodon).

**Request:**
```json
{
  "platform": "linkedin",
  "sourceId": "default",
  "authConfig": {
    "clientId": "...",
    "clientSecret": "...",
    "redirectUri": "...",
    "scopes": ["read"]
  }
}
```

**Response:**
```json
{
  "success": true,
  "authUrl": "https://linkedin.com/oauth/...",
  "platform": "linkedin"
}
```

**Alternative Methods:**

**GET /auth/social?platform=linkedin** - Get authentication status

**Response:**
```json
{
  "success": true,
  "authenticated": true,
  "username": "user123",
  "expiresAt": "2026-03-30T10:00:00Z"
}
```

**PUT /auth/social** - Complete OAuth callback
```json
{
  "platform": "linkedin",
  "code": "auth-code",
  "state": "state-token"
}
```

**DELETE /auth/social?platform=linkedin** - Remove credentials

---

## Papers Management

### GET /papers
Retrieve papers with filtering, search, and pagination.

**Query Parameters:**
- `search` (string) - Search query for title and abstract
- `sector` (string) - Filter by sector tag
- `topic` (string) - Filter by topic tag
- `page` (integer, default: 1) - Page number
- `pageSize` (integer, default: 20) - Items per page

**Response:**
```json
{
  "papers": [
    {
      "id": "uuid",
      "title": "Paper Title",
      "abstract": "Paper abstract...",
      "url": "https://arxiv.org/abs/...",
      "source": "ArXiv",
      "collectedAt": "2026-03-23T10:00:00Z",
      "tags": [...],
      "favoritedBy": [...]
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 150,
    "totalPages": 8,
    "hasNextPage": true,
    "hasPreviousPage": false
  }
}
```

---

### DELETE /papers/{id}
Remove a paper from the repository with archival.

**Path Parameters:**
- `id` (required, string, UUID) - Paper ID

**Response:**
```json
{
  "success": true,
  "message": "Paper removed and archived successfully"
}
```

**Error Codes:**
- `404` - Paper not found

---

### PATCH /papers/{id}
Update paper metadata (e.g., publication date).

**Path Parameters:**
- `id` (required, string, UUID) - Paper ID

**Request:**
```json
{
  "publicationDate": "2026-03-23T10:00:00Z"
}
```

**Response:**
```json
{
  "success": true,
  "paper": { ... }
}
```

**Error Codes:**
- `400` - No update fields provided
- `404` - Paper not found

---

### POST /papers/{id}/favorite
Toggle favorite status for a paper.

**Path Parameters:**
- `id` (required, string, UUID) - Paper ID

**Response:**
```json
{
  "favorited": true
}
```

**Error Codes:**
- `400` - Invalid paper ID format
- `401` - Unauthorized - please login

---

### POST /papers/{id}/tags
Add a tag to a paper (creates new tag if doesn't exist).

**Path Parameters:**
- `id` (required, string, UUID) - Paper ID

**Request:**
```json
{
  "tagName": "machine-learning"
}
```

**Response:**
```json
{
  "id": "tag-uuid",
  "tagName": "machine-learning",
  "category": "ai-technology"
}
```

---

### DELETE /papers/{id}/tags
Remove a tag from a paper.

**Path Parameters:**
- `id` (required, string, UUID) - Paper ID

**Request:**
```json
{
  "tagId": "tag-uuid"
}
```

**Response:**
```json
{
  "success": true
}
```

---

### POST /papers/{id}/auto-tag
Generate AI tags for a paper using LLM.

**Path Parameters:**
- `id` (required, string, UUID) - Paper ID

**Response:**
```json
{
  "candidates": [
    {
      "name": "deep-learning",
      "category": "ai-technology"
    },
    {
      "name": "risk-management",
      "category": "business-area"
    }
  ]
}
```

**Error Codes:**
- `404` - Paper not found

---

### POST /papers/{id}/summary
Generate and store an AI summary for a paper.

**Path Parameters:**
- `id` (required, string, UUID) - Paper ID

**Response:**
```json
{
  "summary": "AI-generated summary of the paper..."
}
```

**Error Codes:**
- `404` - Paper not found

---

## Collection Pipeline

### POST /collection
Start paper collection pipeline with auto or pipeline mode.

**Request:**
```json
{
  "mode": "pipeline",
  "query": "machine learning banking",
  "horizon": "month",
  "dateFrom": "2026-01-01",
  "dateTo": "2026-03-23",
  "useLLMOptimization": true,
  "useLLMFiltering": true,
  "queryStrictness": "balanced",
  "maxResults": 50,
  "minRelevanceScore": 70,
  "sources": ["ArXiv", "SSRN"],
  "focusAreas": ["AI", "Risk"]
}
```

**Response:**
```json
{
  "success": true,
  "newCount": 15,
  "updatedCount": 3
}
```

---

### GET /collection
Get collection statistics and status.

**Response:**
```json
{
  "success": true,
  "stats": {
    "totalCollected": 150,
    "lastRun": "2026-03-23T10:00:00Z",
    "sources": [...]
  }
}
```

---

### POST /auto-collect
Trigger auto-collection manually or with override parameters.

**Request:**
```json
{
  "trigger": true,
  "override": {
    "query": "custom search query"
  }
}
```

**Response:**
```json
{
  "success": true,
  "newCount": 10,
  "updatedCount": 2
}
```

---

### GET /auto-collect
Get scheduler status and last collection results.

**Response:**
```json
{
  "success": true,
  "scheduler": {
    "isRunning": false,
    "lastRun": "2026-03-23T10:00:00Z",
    "nextRun": "2026-03-24T10:00:00Z",
    "config": { ... }
  }
}
```

---

### PATCH /auto-collect
Update auto-collection scheduler settings.

**Request:**
```json
{
  "enabled": true,
  "interval": "daily",
  "time": "10:00"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Scheduler configuration updated"
}
```

---

### GET /sources
Retrieve list of all paper sources.

**Response:**
```json
[
  {
    "id": "source-uuid",
    "name": "ArXiv",
    "url": "https://arxiv.org",
    "enabled": true
  },
  {
    "id": "source-uuid-2",
    "name": "SSRN",
    "url": "https://www.ssrn.com",
    "enabled": true
  }
]
```

---

### POST /sources
Add a new paper source.

**Request:**
```json
{
  "name": "IEEE Xplore",
  "url": "https://ieeexplore.ieee.org"
}
```

**Response:**
```json
{
  "id": "new-source-uuid",
  "name": "IEEE Xplore",
  "url": "https://ieeexplore.ieee.org",
  "enabled": true
}
```

**Error Codes:**
- `401` - Unauthorized
- `403` - Invalid CSRF token
- `409` - Source already exists

---

### PATCH /sources
Update source configuration (by ID or name).

**Request (update by ID):**
```json
{
  "id": "source-uuid",
  "displayName": "ArXiv Preprints",
  "url": "https://arxiv.org",
  "enabled": true
}
```

**Request (update by name - for toggling):**
```json
{
  "name": "ArXiv",
  "enabled": false
}
```

**Response:**
```json
{
  "id": "source-uuid",
  "name": "ArXiv",
  "enabled": false
}
```

**Error Codes:**
- `401` - Unauthorized
- `403` - Invalid CSRF token

---

### DELETE /sources
Remove a paper source.

**Request:**
```json
{
  "id": "source-uuid"
}
```

**Response:**
```json
{
  "success": true
}
```

**Error Codes:**
- `401` - Unauthorized
- `403` - Invalid CSRF token

---

### GET /source-types
Load source types configuration for different paper sources.

**Response:**
```json
{
  "sourceTypes": [
    {
      "type": "PREPRINT",
      "name": "Preprint Server",
      "description": "Academic preprint repositories"
    },
    {
      "type": "JOURNAL",
      "name": "Journal",
      "description": "Academic journals"
    }
  ]
}
```

---

## Daily Digest

### GET /daily-digest
Get daily digest for a specific date or list all digests. Implements lazy loading with auto-regeneration.

**Query Parameters:**
- `date` (string, format: date) - Date code (YYYY-MM-DD), defaults to today

**Response (specific date):**
```json
{
  "success": true,
  "status": "ready",
  "digest": {
    "id": "digest-uuid",
    "dateCode": "2026-03-23",
    "title": "Research Copilot: Daily Intelligence Digest",
    "content": "# Markdown content...",
    "papers": [...]
  },
  "paperCount": 15,
  "fresh": true
}
```

**Statuses:**
- `ready` - Digest available and up to date
- `stale` - Digest exists but being refreshed
- `empty` - No papers for this date
- `generating` - In progress
- `error` - Failed to generate

**Response (list all):**
```json
{
  "success": true,
  "digests": [...]
}
```

---

### POST /daily-digest
Trigger digest regeneration for a specific date.

**Request:**
```json
{
  "dateCode": "2026-03-23"
}
```

**Response:**
```json
{
  "success": true,
  "status": "ready",
  "digest": { ... },
  "retries": 0
}
```

**Error Codes:**
- `400` - dateCode is required

---

### GET /daily-digest/batch
Retrieve all dates that have papers but no corresponding digests.

**Response:**
```json
{
  "success": true,
  "dates": [
    {
      "dateCode": "2026-03-21",
      "paperCount": 13
    },
    {
      "dateCode": "2026-03-22",
      "paperCount": 8
    }
  ],
  "total": 2
}
```

---

### POST /daily-digest/batch
Generate daily digests for specific historical dates (batch processing).

**Request:**
```json
{
  "dateCodes": ["2026-03-21", "2026-03-22"],
  "maxConcurrent": 3
}
```

**Response:**
```json
{
  "success": true,
  "processed": [
    {
      "dateCode": "2026-03-21",
      "status": "success",
      "paperCount": 13
    },
    {
      "dateCode": "2026-03-22",
      "status": "failed",
      "error": "LLM service unavailable"
    }
  ],
  "summary": {
    "total": 2,
    "processed": 2,
    "successful": 1,
    "failed": 1,
    "remaining": 0
  }
}
```

---

## Analytics & Insights

### GET /stats
Get dashboard statistics including total papers and category breakdown.

**Response:**
```json
{
  "totalPapers": 150,
  "categoryStats": {
    "ai-technology": [
      { "name": "machine-learning", "count": 45 },
      { "name": "deep-learning", "count": 32 }
    ],
    "business-area": [...],
    "methodology": [...],
    "risk-category": [...],
    "regulatory": [...]
  }
}
```

---

### GET /trends
Get research trends analysis with filtering options.

**Query Parameters:**
- `tagIds` (string) - Comma-separated list of tag IDs
- `period` (string, enum: week, month, quarter, year, default: month) - Time period
- `days` (integer) - Number of days to analyze
- `direction` (string, enum: up, down, flat) - Trend direction filter
- `limit` (integer, default: 50) - Maximum number of results

**Response:**
```json
{
  "results": [
    {
      "tagId": "uuid",
      "tagName": "machine-learning",
      "direction": "up",
      "changePercent": 25.5,
      "trendData": [
        { "date": "2026-03-01T00:00:00Z", "count": 10 },
        { "date": "2026-03-23T00:00:00Z", "count": 15 }
      ]
    }
  ]
}
```

---

### POST /trends
Identify trending topics based on period.

**Request:**
```json
{
  "period": "month",
  "limit": 10
}
```

**Response:**
```json
{
  "results": [
    {
      "tagId": "uuid",
      "tagName": "generative-ai",
      "direction": "up",
      "changePercent": 150.0
    }
  ]
}
```

---

### GET /radar
Generate technology radar based on recent papers.

**Query Parameters:**
- `days` (integer, min: 1, max: 365, default: 90) - Number of days to look back

**Response:**
```json
{
  "success": true,
  "radar": {
    "quadrants": [...],
    "technologies": [
      {
        "name": "Graph Neural Networks",
        "quadrant": "AI-Technology",
        "ring": "adopt",
        "count": 25
      }
    ]
  },
  "count": 15
}
```

---

### POST /radar
Generate technology radar via POST request.

**Request:**
```json
{
  "days": 90
}
```

**Response:**
```json
{
  "success": true,
  "radarData": { ... },
  "count": 15
}
```

---

### GET /recommendations
Get AI-powered paper recommendations.

**Query Parameters:**
- `limit` (integer, min: 1, max: 50, default: 10) - Maximum number of recommendations

**Response:**
```json
{
  "success": true,
  "recommendations": [
    {
      "id": "paper-uuid",
      "title": "Paper Title",
      "reason": "Based on your interests in machine learning",
      "score": 0.95
    }
  ],
  "count": 10
}
```

---

### GET /recommendations/poc
Get proof-of-concept paper recommendations by domain.

**Query Parameters:**
- `limit` (integer, min: 1, max: 50, default: 10)
- `domain` (string) - Filter by domain (e.g., "risk", "trading")

**Response:**
```json
{
  "success": true,
  "recommendations": [...],
  "count": 10,
  "domain": "risk"
}
```

---

### POST /recommendations/poc
Get PoC recommendations via POST.

**Query Parameters:**
- `limit` (integer)
- `domain` (string)

**Response:** Same as GET

---

### GET /competitive-intel
Track competitive intelligence updates from papers.

**Query Parameters:**
- `days` (integer, min: 1, max: 365, default: 30)
- `limit` (integer, min: 1, max: 100, default: 50)

**Response:**
```json
{
  "success": true,
  "updates": [
    {
      "paperId": "uuid",
      "title": "New AI Approach",
      "institution": "MIT",
      "type": "breakthrough"
    }
  ],
  "count": 25,
  "dateRange": {
    "since": "2026-02-21T00:00:00Z",
    "to": "2026-03-23T00:00:00Z"
  }
}
```

---

### POST /competitive-intel
Generate competitive intelligence brief.

**Request:**
```json
{
  "days": 30
}
```

**Response:**
```json
{
  "success": true,
  "brief": {
    "summary": "...",
    "keyFindings": [...],
    "institutions": [...]
  },
  "generatedAt": "2026-03-23T10:00:00Z"
}
```

---

## Export

### POST /export/powerpoint
Export papers to PowerPoint presentation.

**Request:**
```json
{
  "days": 30,
  "limit": 10,
  "search": "machine learning",
  "includeAbstract": true,
  "includeSummary": true,
  "includeTags": true
}
```

**Response:**
- Content-Type: `application/vnd.openxmlformats-officedocument.presentationml.presentation`
- Content-Disposition: `attachment; filename="research-briefing-2026-03-23.pptx"`
- Binary PowerPoint file data

---

### POST /export/social-media
Generate social media posts for papers.

**Request:**
```json
{
  "paperIds": ["uuid1", "uuid2"],
  "platform": "LinkedIn",
  "count": 3
}
```

**Response:**
```json
{
  "success": true,
  "posts": [
    {
      "content": "Exciting new research on...",
      "hashtags": ["#AI", "#Research"],
      "paperId": "uuid1"
    }
  ],
  "count": 3,
  "platform": "LinkedIn"
}
```

**Supported Platforms:** LinkedIn, Twitter, X

---

### POST /export/digest
Send a paper digest email to a recipient.

**Request:**
```json
{
  "frequency": "daily",
  "recipientEmail": "user@example.com",
  "includePowerPoint": false,
  "includeSocialPosts": false,
  "includeStats": true,
  "maxPapers": 20,
  "topics": ["machine-learning", "risk-management"],
  "days": 7
}
```

**Response:**
```json
{
  "success": true,
  "digest": {
    "id": "message-id",
    "sentAt": "2026-03-23T10:00:00Z",
    "recipient": "user@example.com",
    "paperCount": 20,
    "days": 7
  },
  "message": "Digest sent successfully"
}
```

**Error Codes:**
- `400` - Invalid input

---

### PUT /export/digest
Schedule a recurring digest (not yet implemented).

**Request:**
```json
{
  "frequency": "weekly",
  "recipientEmail": "user@example.com"
}
```

**Response:**
```json
{
  "success": true,
  "scheduleId": "schedule-uuid",
  "message": "Digest scheduling not yet implemented - use POST to send immediately"
}
```

---

## Settings

### GET /settings/prompts
Load saved AI prompt templates.

**Response:**
```json
{
  "success": true,
  "prompts": {
    "queryOptimization": "...",
    "contentAssessment": "...",
    "summaryGeneration": "...",
    "tagSuggestion": "...",
    "digestGeneration": "..."
  }
}
```

---

### POST /settings/prompts
Save AI prompt templates for various operations.

**Request:**
```json
{
  "queryOptimization": "Optimize the following search query...",
  "contentAssessment": "Evaluate the relevance of this paper...",
  "summaryGeneration": "Generate a technical summary...",
  "tagSuggestion": "Suggest relevant tags...",
  "digestGeneration": "Create a daily digest..."
}
```

**Response:**
```json
{
  "success": true,
  "message": "Prompt templates saved successfully"
}
```

**Error Codes:**
- `400` - Missing or invalid fields

---

### GET /settings/collection
Load current collection configuration.

**Response:**
```json
{
  "success": true,
  "config": {
    "autoTimeRangeDays": 30,
    "autoDefaultQuery": "AI in banking",
    "maxResults": 100,
    "constraints": { ... }
  }
}
```

---

### POST /settings/collection
Save collection configuration with validation.

**Request:**
```json
{
  "autoTimeRangeDays": 30,
  "autoDefaultQuery": "AI in banking",
  "maxResults": 100
}
```

**Response:**
```json
{
  "success": true,
  "message": "Collection settings saved successfully",
  "config": { ... }
}
```

**Error Codes:**
- `400` - Validation failed

---

### GET /settings/llm
Get current LLM provider configuration with masked API key.

**Response:**
```json
{
  "success": true,
  "config": {
    "provider": "groq",
    "apiKey": "gsk_...abcd",
    "baseUrl": "https://api.groq.com",
    "model": "llama-3.3-70b-versatile",
    "temperature": 0.1,
    "maxTokens": 1000,
    "isConfigured": true
  },
  "defaults": {
    "models": { ... },
    "baseUrls": { ... }
  }
}
```

---

### POST /settings/llm
Save LLM provider configuration with validation and connection test.

**Request:**
```json
{
  "provider": "groq",
  "apiKey": "your-api-key",
  "baseUrl": "https://api.groq.com",
  "model": "llama-3.3-70b-versatile",
  "temperature": 0.1,
  "maxTokens": 2000
}
```

**Response:**
```json
{
  "success": true,
  "message": "Successfully configured groq",
  "config": {
    "provider": "groq",
    "model": "llama-3.3-70b-versatile",
    "baseUrl": "https://api.groq.com"
  }
}
```

**Error Codes:**
- `400` - Invalid configuration or connection failed

---

### PATCH /settings/llm
Test connection to LLM provider without saving.

**Request:**
```json
{
  "provider": "groq",
  "apiKey": "your-api-key",
  "baseUrl": "https://api.groq.com",
  "model": "llama-3.3-70b-versatile"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Successfully connected to groq",
  "latency": "245ms",
  "provider": "groq",
  "model": "llama-3.3-70b-versatile"
}
```

**Error Codes:**
- `400` - Connection failed

---

### GET /user/notifications
Get user's notification preferences and subscribers.

**Response:**
```json
{
  "emailAlerts": true,
  "newsletterAlerts": true,
  "subscribers": [
    { "id": "sub-uuid", "email": "subscriber@example.com" }
  ]
}
```

**Error Codes:**
- `401` - Unauthorized

---

### POST /user/notifications
Update notification preferences or manage subscribers.

**Request (toggle settings):**
```json
{
  "action": "toggle",
  "emailAlerts": true,
  "newsletterAlerts": false
}
```

**Request (add subscriber):**
```json
{
  "action": "add",
  "email": "newsubscriber@example.com"
}
```

**Request (remove subscriber):**
```json
{
  "action": "remove",
  "email": "oldsubscriber@example.com"
}
```

**Response:**
```json
{
  "success": true,
  "settings": {
    "emailAlerts": true,
    "newsletterAlerts": false,
    "subscribers": [...]
  }
}
```

**Error Codes:**
- `400` - Invalid email format
- `401` - Unauthorized

---

## Alerts

### GET /alerts
Get user alerts/notifications with optional filtering.

**Query Parameters:**
- `status` (string, enum: new, read, dismissed) - Filter by alert status
- `priority` (string, enum: LOW, MEDIUM, HIGH, CRITICAL) - Filter by priority
- `source` (string) - Filter by source name
- `limit` (integer, default: 20) - Number of results
- `offset` (integer, default: 0) - Pagination offset

**Response:**
```json
{
  "alerts": [
    {
      "id": "alert-uuid",
      "sourceId": "source-id",
      "sourceName": "Federal Reserve",
      "title": "AI in Credit Decisions: New Regulatory Guidance",
      "content": "Federal Reserve releases new guidance...",
      "url": "https://example.com/alert",
      "keywords": ["AI", "credit", "regulatory"],
      "relevance": 95,
      "priority": "HIGH",
      "status": "new",
      "createdAt": "2026-03-23T10:00:00Z"
    }
  ],
  "total": 45,
  "limit": 20,
  "offset": 0
}
```

---

### POST /alerts
Create a new regulatory alert or test alert.

**Request:**
```json
{
  "sourceId": "source-uuid",
  "sourceName": "Federal Reserve",
  "title": "New Banking Regulation",
  "content": "Details about the regulation...",
  "url": "https://example.com/regulation",
  "keywords": ["regulation", "banking"],
  "relevance": 85,
  "priority": "HIGH",
  "status": "new",
  "test": false
}
```

**Test Alert (special mode):**
```json
{
  "test": true
}
```

**Response:**
```json
{
  "success": true,
  "alert": {
    "id": "new-alert-uuid",
    "title": "New Banking Regulation",
    ...
  }
}
```

**Error Codes:**
- `400` - Invalid input or duplicate URL
- `401` - Unauthorized
- `403` - Invalid CSRF token

---

### PUT /alerts
Update alert information and status.

**Request:**
```json
{
  "id": "alert-uuid",
  "status": "read",
  "priority": "MEDIUM"
}
```

**Response:**
```json
{
  "id": "alert-uuid",
  "status": "read",
  "priority": "MEDIUM",
  ...
}
```

**Error Codes:**
- `401` - Unauthorized
- `403` - Invalid CSRF token

---

### PUT /alerts/{id}
Update a specific alert by ID.

**Path Parameters:**
- `id` (required, string) - Alert ID

**Request:**
```json
{
  "status": "dismissed",
  "priority": "LOW"
}
```

**Response:**
```json
{
  "id": "alert-uuid",
  "status": "dismissed",
  "priority": "LOW",
  ...
}
```

**Error Codes:**
- `400` - Invalid input
- `401` - Unauthorized
- `403` - Invalid CSRF token
- `404` - Alert not found

---

### DELETE /alerts/{id}
Delete a specific alert by ID.

**Path Parameters:**
- `id` (required, string) - Alert ID

**Response:**
```json
{
  "success": true
}
```

**Error Codes:**
- `401` - Unauthorized
- `403` - Invalid CSRF token
- `404` - Alert not found

---

## LLM Configuration

### GET /llm-providers
Get user's LLM provider configurations.

**Response:**
```json
{
  "success": true,
  "configs": [
    {
      "id": "config-uuid",
      "name": "My Groq Config",
      "provider": { ... },
      "status": "connected",
      "priority": 0,
      "isEnabled": true,
      "models": [...]
    }
  ],
  "availableProviders": [...]
}
```

**Error Codes:**
- `401` - Unauthorized

---

### POST /llm-providers
Create a new LLM provider configuration.

**Request:**
```json
{
  "providerId": "provider-uuid",
  "name": "Production Groq",
  "apiKey": "gsk_...",
  "baseUrl": "https://api.groq.com"
}
```

**Response:**
```json
{
  "success": true,
  "config": {
    "id": "new-config-uuid",
    "name": "Production Groq",
    "provider": { ... },
    "status": "untested",
    "priority": 1,
    "isEnabled": false
  }
}
```

**Error Codes:**
- `400` - Missing required fields
- `401` - Unauthorized
- `409` - Configuration with this name already exists

---

### PATCH /llm-providers
Test connection, enable/disable, or select model.

**Query Parameters:**
- `id` (required, string) - Config ID
- `action` (string, enum: test, enable, selectModel, default: test)

**Response (action=test):**
```json
{
  "success": true,
  "connected": true,
  "latency": "245ms",
  "message": "Connection successful",
  "availableModels": [...]
}
```

**Response (action=enable):**
```json
{
  "success": true,
  "isEnabled": true,
  "message": "Provider enabled"
}
```

**Response (action=selectModel):**
```json
{
  "success": true,
  "message": "Model llama-3.3-70b-versatile selected as default"
}
```

**Error Codes:**
- `400` - Bad request
- `401` - Unauthorized

---

### DELETE /llm-providers
Permanently delete an LLM provider configuration.

**Query Parameters:**
- `id` (required, string) - Config ID

**Response:**
```json
{
  "success": true,
  "message": "Configuration deleted successfully"
}
```

**Error Codes:**
- `400` - Config ID required
- `401` - Unauthorized

---

### GET /llm-models
Get available models from all enabled providers.

**Response:**
```json
{
  "models": [
    {
      "id": "llama-3.3-70b-versatile",
      "name": "Llama 3.3 70B Versatile",
      "provider": "Groq"
    }
  ],
  "lastRun": "2026-03-23T10:00:00Z",
  "results": [...]
}
```

---

### GET /llm-providers/groq-models
Fetches available models from Groq API.

**Query Parameters:**
- `apiKey` (string, optional) - Groq API key (will use env or database if not provided)

**Response:**
```json
{
  "success": true,
  "models": [
    {
      "externalId": "llama-3.3-70b-versatile",
      "name": "Llama 3.3 70B",
      "contextWindow": 128000,
      "capabilities": ["chat"],
      "ownedBy": "meta",
      "active": true
    }
  ],
  "count": 25
}
```

**Error Codes:**
- `400` - No API key provided
- `401` - Unauthorized

---

### GET /llm-providers/ollama-models
Fetches available models from local Ollama instance.

**Query Parameters:**
- `baseUrl` (string, default: http://localhost:11434) - Ollama base URL

**Response:**
```json
{
  "success": true,
  "models": [
    {
      "externalId": "llama3.2",
      "name": "llama3.2",
      "contextWindow": 128000,
      "capabilities": ["chat"],
      "size": 2000000000,
      "modified": "2026-03-01T00:00:00Z"
    }
  ],
  "count": 5
}
```

**Error Codes:**
- `401` - Unauthorized
- `500` - Failed to fetch models

---

### POST /llm-models/test
Test LLM model compatibility using the same approach as collection pipeline.

**Request:**
```json
{
  "models": [
    { "id": "llama-3.3-70b-versatile", "provider": "groq" },
    { "id": "gpt-4o", "provider": "openai" }
  ]
}
```

**Response:**
Streamed as Server-Sent Events (SSE):
```
data: {"type":"progress","model":"llama-3.3-70b-versatile","test":"query"}

data: {"type":"result","result":{"model":"llama-3.3-70b-versatile","provider":"groq","tests":{"query":{"passed":true,"duration":245,"error":null},...}}}

data: {"type":"complete","timestamp":"2026-03-23T10:00:00Z"}
```

**Test Types:**
- `query` - Query optimization test
- `assessment` - Content assessment test
- `tags` - Tag generation test
- `summary` - Summary generation test

---

### POST /llm-init
Initialize or reinitialize LLM providers from database.

**Query Parameters:**
- `force` (boolean, default: false) - Force reinitialization

**Response:**
```json
{
  "success": true,
  "message": "LLM initialized"
}
```

Or with force=true:
```json
{
  "success": true,
  "message": "LLM reinitialized"
}
```

---

### POST /chat
RAG-based chat endpoint for paper queries.

**Request:**
```json
{
  "messages": [
    {
      "role": "user",
      "content": "What are the latest papers on machine learning in banking?"
    }
  ]
}
```

**Response:**
```json
{
  "role": "assistant",
  "content": "Based on recent papers in the system...",
  "sources": [
    {
      "paperId": "uuid",
      "title": "ML in Banking",
      "relevance": 0.95
    }
  ]
}
```

**Error Codes:**
- `400` - Invalid input
- `500` - Server error

---

## Tags

### GET /tags
Retrieve list of all tags sorted alphabetically.

**Response:**
```json
[
  {
    "id": "tag-uuid",
    "name": "machine-learning",
    "category": "ai-technology"
  },
  {
    "id": "tag-uuid-2",
    "name": "risk-management",
    "category": "business-area"
  }
]
```

---

## Error Handling

### Common Error Response Format
```json
{
  "success": false,
  "error": "Detailed error message",
  "code": "ERROR_CODE",
  "statusCode": 400
}
```

### Error Codes
- `UNAUTHORIZED` - Authentication required
- `NOT_FOUND` - Resource not found
- `VALIDATION_ERROR` - Invalid request data
- `RATE_LIMITED` - Too many requests
- `LLM_ERROR` - LLM service error
- `CONFLICT` - Resource already exists

---

## Rate Limiting

- **Collection API**: 10 requests per minute
- **LLM APIs**: 30 requests per minute
- **Authentication APIs**: 5 requests per minute
- **Other APIs**: 100 requests per minute

---

## Best Practices

1. **Always check `success` field** in responses
2. **Handle pagination** for list endpoints using `page` and `pageSize`
3. **Cache digest content** - it doesn't change frequently
4. **Use batch API** for multiple operations
5. **Respect rate limits** - implement exponential backoff
6. **Include CSRF token** in all state-changing operations (POST, PUT, DELETE, PATCH)

---

## Code Examples

### Example: Get Today's Papers and Digest

```bash
# Get papers collected today
curl "https://research-copilot-kappa.vercel.app/api/papers?search=machine+learning&page=1&pageSize=20" \
  -H "Cookie: auth_user=your-session-id"

# Get today's digest
curl "https://research-copilot-kappa.vercel.app/api/daily-digest?date=2026-03-23" \
  -H "Cookie: auth_user=your-session-id"
```

### Example: Export Research to PowerPoint

```bash
# Export recent papers to PowerPoint
curl -X POST "https://research-copilot-kappa.vercel.app/api/export/powerpoint" \
  -H "Content-Type: application/json" \
  -H "Cookie: auth_user=your-session-id" \
  -H "X-CSRF-Token: your-csrf-token" \
  -d '{
    "days": 30,
    "limit": 10,
    "search": "machine learning",
    "includeAbstract": true,
    "includeSummary": true,
    "includeTags": true
  }' \
  --output research-briefing.pptx
```

### Example: Trigger Collection with Custom Query

```bash
curl -X POST "https://research-copilot-kappa.vercel.app/api/collection" \
  -H "Content-Type: application/json" \
  -H "Cookie: auth_user=your-session-id" \
  -H "X-CSRF-Token: your-csrf-token" \
  -d '{
    "mode": "pipeline",
    "query": "artificial intelligence risk management",
    "horizon": "week",
    "useLLMOptimization": true,
    "useLLMFiltering": true,
    "maxResults": 50
  }'
```

### Example: JavaScript Client

```javascript
const API_BASE = 'https://research-copilot-kappa.vercel.app/api';

// Helper to get CSRF token from cookie
function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
}

// Get papers with filters
async function getPapers(search, page = 1, pageSize = 20) {
  const response = await fetch(
    `${API_BASE}/papers?search=${encodeURIComponent(search)}&page=${page}&pageSize=${pageSize}`,
    { credentials: 'include' }
  );
  return response.json();
}

// Trigger collection
async function collectPapers(query) {
  const response = await fetch(`${API_BASE}/collection`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': getCookie('csrf_token')
    },
    body: JSON.stringify({
      mode: 'pipeline',
      query,
      useLLMOptimization: true
    })
  });
  return response.json();
}

// Toggle favorite
async function toggleFavorite(paperId) {
  const response = await fetch(`${API_BASE}/papers/${paperId}/favorite`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'X-CSRF-Token': getCookie('csrf_token')
    }
  });
  return response.json();
}
```

### Example: Python Client

```python
import requests

API_BASE = "https://research-copilot-kappa.vercel.app/api"

# Create a session to maintain cookies
session = requests.Session()

# Login
login_response = session.post(
    f"{API_BASE}/auth/login",
    json={
        "email": "user@example.com",
        "password": "your-password"
    }
)
data = login_response.json()
csrf_token = data.get("csrfToken")

# Get papers
papers_response = session.get(
    f"{API_BASE}/papers",
    params={"search": "machine learning", "page": 1, "pageSize": 20}
)
papers = papers_response.json()

# Export to PowerPoint
export_response = session.post(
    f"{API_BASE}/export/powerpoint",
    headers={"X-CSRF-Token": csrf_token},
    json={
        "days": 30,
        "limit": 10,
        "search": "machine learning"
    }
)

# Save the PowerPoint file
with open("research-briefing.pptx", "wb") as f:
    f.write(export_response.content)
```

---

**Last Updated:** 2026-03-23  
**API Version:** 1.0  
**Document Version:** 2.0  
**Total Endpoints Documented:** 61
