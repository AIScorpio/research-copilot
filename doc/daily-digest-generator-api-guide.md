# Daily Digest Batch Generation API - Usage Guide

## Overview

The Batch Generation API allows you to generate Daily Intelligence Digests for historical dates that have papers but no corresponding digest. This is useful for backfilling digests when you have existing paper data.

**Base URL:**
- Production: `https://research-copilot-kappa.vercel.app/api/daily-digest/batch`
- Local: `http://localhost:3000/api/daily-digest/batch`

---

## Endpoints

### 1. GET - List Missing Digests

Retrieve all dates that have papers but no digests.

**Request:**
```bash
GET /api/daily-digest/batch
```

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
      "dateCode": "2026-03-19",
      "paperCount": 3
    }
  ],
  "total": 2
}
```

**Fields:**
- `success` (boolean): Whether the query was successful
- `dates` (array): List of dates missing digests
  - `dateCode` (string): Date in YYYY-MM-DD format (Beijing Time)
  - `paperCount` (number): Number of papers collected on that date
- `total` (number): Total count of missing dates

---

### 2. POST - Generate Digests

Generate digests for specific dates.

**Request:**
```bash
POST /api/daily-digest/batch
Content-Type: application/json

{
  "dateCodes": ["2026-03-21", "2026-03-19"],
  "maxConcurrent": 3
}
```

**Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `dateCodes` | array | Yes | - | Array of date strings (YYYY-MM-DD format) |
| `maxConcurrent` | number | No | 3 | Maximum number of digests to generate concurrently. Recommended: 1-5 |

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
      "dateCode": "2026-03-19",
      "status": "success",
      "paperCount": 3
    }
  ],
  "summary": {
    "total": 2,
    "processed": 2,
    "successful": 2,
    "failed": 0,
    "remaining": 0
  }
}
```

**Response Fields:**

**processed** (array): Details for each processed date
- `dateCode` (string): The date that was processed
- `status` (string): One of `success`, `failed`, `error`, or `skipped`
- `paperCount` (number): Number of papers processed
- `error` (string, optional): Error message if failed

**summary** (object): Processing summary
- `total` (number): Total dates requested
- `processed` (number): Dates actually processed in this batch
- `successful` (number): Successfully generated digests
- `failed` (number): Failed generations
- `remaining` (number): Dates not processed (if limited by maxConcurrent)

---

## Usage Examples

### Example 1: Check Missing Dates

```bash
curl https://research-copilot-kappa.vercel.app/api/daily-digest/batch
```

### Example 2: Generate Single Date

```bash
curl -X POST https://research-copilot-kappa.vercel.app/api/daily-digest/batch \
  -H "Content-Type: application/json" \
  -d '{
    "dateCodes": ["2026-03-21"],
    "maxConcurrent": 1
  }'
```

### Example 3: Generate Multiple Dates

```bash
curl -X POST https://research-copilot-kappa.vercel.app/api/daily-digest/batch \
  -H "Content-Type: application/json" \
  -d '{
    "dateCodes": ["2026-03-21", "2026-03-19", "2026-03-17"],
    "maxConcurrent": 3
  }'
```

### Example 4: Using in Browser Console

```javascript
// Check missing dates
fetch('/api/daily-digest/batch')
  .then(r => r.json())
  .then(console.log);

// Generate digests
fetch('/api/daily-digest/batch', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    dateCodes: ['2026-03-21', '2026-03-19'],
    maxConcurrent: 2
  })
})
.then(r => r.json())
.then(console.log);
```

---

## Best Practices

### 1. Rate Limiting
- Add 2-3 seconds delay between requests to avoid LLM API rate limits
- Process one date at a time if you have many dates

### 2. Batch Size
- **Recommended:** 1-3 dates per request for large paper counts (>20 papers)
- **Maximum:** 5 dates per request for small paper counts (<10 papers)
- **Vercel Limit:** Function timeout is 60 seconds

### 3. Generation Time Estimates

| Paper Count | Estimated Time |
|-------------|----------------|
| 1-5 papers  | 5-8 seconds   |
| 6-15 papers | 8-15 seconds  |
| 16-30 papers| 15-25 seconds |
| 30+ papers  | 25-40 seconds |

### 4. Handling Large Batches

If you have many dates to process:

```bash
# Step 1: Check what needs to be generated
curl https://research-copilot-kappa.vercel.app/api/daily-digest/batch

# Step 2: Process in small batches
curl -X POST https://research-copilot-kappa.vercel.app/api/daily-digest/batch \
  -H "Content-Type: application/json" \
  -d '{"dateCodes": ["2026-03-21", "2026-03-19", "2026-03-17"], "maxConcurrent": 3}'

# Wait 5 seconds between requests...

# Step 3: Process next batch
curl -X POST https://research-copilot-kappa.vercel.app/api/daily-digest/batch \
  -H "Content-Type: application/json" \
  -d '{"dateCodes": ["2026-03-15", "2026-03-05"], "maxConcurrent": 2}'
```

---

## Error Handling

### Common Status Values

- `success`: Digest generated successfully
- `failed`: Generation failed but no error thrown
- `skipped`: No papers found for this date
- `error`: Exception occurred during generation

### Example Error Response

```json
{
  "success": false,
  "processed": [
    {
      "dateCode": "2026-03-21",
      "status": "error",
      "error": "LLM API timeout after 30 seconds"
    }
  ],
  "summary": {
    "total": 1,
    "processed": 1,
    "successful": 0,
    "failed": 1,
    "remaining": 0
  }
}
```

---

## Timezone Note

All dates use **Beijing Time (UTC+8)** as the anchor timezone:
- Papers are grouped by Beijing date
- Digests are generated for Beijing dates
- This ensures consistency across all environments (local, Vercel, etc.)

---

## Technical Details

**Concurrency Control:**
- Uses distributed locking to prevent concurrent generation of the same date
- Safe to call multiple times - won't duplicate digests

**Lazy Loading:**
- If a digest is already being generated, the API will wait and return the result
- If a digest already exists, it will be returned without regeneration

**Vercel Limitations:**
- Maximum execution time: 60 seconds
- For dates with 30+ papers, process one at a time

---

## Summary

1. Use **GET** to check which dates need digests
2. Use **POST** to generate digests in batches
3. Keep `maxConcurrent` low (1-3) for large paper counts
4. Add delays between requests to avoid rate limits
5. All dates use Beijing Time (UTC+8)

---

**Last Updated:** 2026-03-23  
**API Version:** 1.0
