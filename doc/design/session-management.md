# Session Management Design

**Status**: Implemented (P1 complete)
**Parent**: Copilot Chat Design
**Scope**: Session CRUD, two-pass compact deep dive, frontend persistence

---

## Session CRUD API

### Endpoints

| Endpoint | Method | Purpose | Auth |
|----------|--------|---------|------|
| `/api/chat/sessions` | GET | List sessions (paginated) | Session cookie |
| `/api/chat/sessions/[id]` | GET | Get session with messages | Session cookie |
| `/api/chat/sessions/[id]` | PATCH | Rename session | Session cookie |
| `/api/chat/sessions/[id]` | DELETE | Delete session + messages | Session cookie |

### Response Format

**List:**
```json
{
  "sessions": [
    {
      "id": "uuid",
      "title": "What are the latest fraud detection...",
      "model": { "providerType": "zhipuai", "externalId": "glm-4.5-air" },
      "messageCount": 6,
      "lastMessageAt": "2026-04-16T10:30:00Z",
      "createdAt": "2026-04-16T09:00:00Z"
    }
  ],
  "total": 42,
  "limit": 50,
  "offset": 0
}
```

**Detail:** Returns session metadata + ordered messages with parsed sources.

---

## Two-Pass Compact Deep Dive

### Problem
Compact mode excludes abstracts to save tokens (~35K vs ~116K). Users asking about specific papers cannot see abstract details.

### Solution

```
1. First LLM call with corpus → answer1
2. If compact mode:
   a. detectPaperReferences(userMessage, lastAssistantMsg, totalPapers)
   b. If references found:
      i. buildSupplementaryContext(paperIds, references)
      ii. Second LLM call with enriched system prompt
      iii. Return answer2 (not answer1)
3. If no references or full mode: use answer1
```

### Detection Patterns

- English: `Paper 3`, `paper #3`, `the 3rd paper`, `paper at position 3`
- Chinese: `第3篇`, `第 3 篇`
- Deduplicated, filtered to valid range (1..total), capped at 10

---

## Security Considerations

- **IDOR fix**: `POST /api/chat` verifies `session.userId === user.id` before using existing session (returns 404, not 403, to prevent enumeration)
- **CSRF**: Not required for chat SPA — same-origin fetch with `Content-Type: application/json` prevents classic CSRF
- **AbortController**: Stale session message loads cancelled on rapid switching

---

## Frontend Flow

```
Page mount → GET /api/chat/sessions
  ├─ Has sessions → select most recent → GET /api/chat/sessions/[id] → render messages
  └─ No sessions → create welcome session (client-side only)
```

Optimistic UI updates for rename/delete with error rollback.
