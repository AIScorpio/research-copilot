# Paper Deletion Strategy - Design & Execution Plan

**Created**: 2026-02-23
**Status**: Approved for Implementation
**Priority**: High
**Scope**: Paper deletion data integrity and consistency

---

## Executive Summary

This document outlines a two-phase approach to fix the paper deletion inconsistency and optionally add archive capability for audit/recovery.

**Current Problem:**
- Schema has `deletedAt` field (soft-delete pattern)
- DELETE API does hard delete (ignores `deletedAt`)
- 3 files filter by `deletedAt: null` (expect soft-delete)
- 15+ files don't filter (expect hard-delete)
- Inconsistent behavior, potential data integrity issues

**Solution:**
- Phase 1: Commit to hard delete, remove dead `deletedAt` code
- Phase 2: Add separate archive table for audit/recovery (optional)

---

## Table of Contents

1. [Current State Analysis](#current-state-analysis)
2. [Phase 1: Hard Delete Alignment](#phase-1-hard-delete-alignment)
3. [Phase 2: Archive Table (Optional)](#phase-2-archive-table-optional)
4. [Implementation Checklist](#implementation-checklist)
5. [Testing Plan](#testing-plan)
6. [Rollback Plan](#rollback-plan)

---

## Current State Analysis

### Schema Definition

```prisma
model Paper {
  id                    String          @id @default(uuid())
  title                 String
  abstract              String?
  url                   String          @unique
  source                String
  sourceType            String?
  publicationDate       DateTime
  collectedAt           DateTime        @default(now())
  aiSummary             String?
  deletedAt             DateTime?       // ← DEAD CODE: Never set by API
  relevanceScore        Float?
  ...
}
```

### DELETE API Implementation

**File:** `src/app/api/papers/[id]/route.ts`

```typescript
// Current implementation - HARD DELETE with transaction
await prisma.$transaction([
    prisma.paperTag.deleteMany({ where: { paperId: id } }),
    prisma.userTag.deleteMany({ where: { paperId: id } }),
    prisma.userFavorite.deleteMany({ where: { paperId: id } }),
    prisma.paper.delete({ where: { id } })  // ← Hard delete, deletedAt never used
]);
```

### Files with `deletedAt` Filters (Expecting Soft-Delete)

| File | Line(s) | Code Pattern |
|------|---------|--------------|
| `src/lib/technology-radar.ts` | 79, 101, 119, 140, 156 | `deletedAt: null` |
| `src/lib/collection-service.ts` | 581, 585, 591 | `deletedAt: null` |
| `src/lib/trends.ts` | 344 | `deletedAt: null` |

### Files WITHOUT `deletedAt` Filters (Expecting Hard-Delete)

| File | Impact if Soft-Delete Implemented |
|------|-----------------------------------|
| `src/app/page.tsx` | Dashboard shows deleted papers |
| `src/app/papers/page.tsx` | Library shows deleted papers |
| `src/app/pipeline/page.tsx` | Pipeline shows deleted papers |
| `src/app/api/papers/route.ts` | API returns deleted papers |
| `src/app/api/stats/route.ts` | Stats count deleted papers |
| `src/app/api/export/powerpoint/route.ts` | Export includes deleted |
| `src/lib/recommendations.ts` | Recommendations include deleted |
| `src/lib/newsletter.ts` | Newsletters include deleted |
| `src/lib/competitive-intel.ts` | Intel includes deleted |
| `src/lib/social-media.ts` | Social posts include deleted |
| `src/lib/rag.ts` | RAG search returns deleted |
| `src/lib/email-service.ts` | Emails include deleted |
| `src/lib/email-digest.ts` | Digests include deleted |
| `src/lib/collection-service.ts:508` | Duplicate check finds deleted |

---

## Phase 1: Hard Delete Alignment

### Objective

Remove the soft-delete pattern (`deletedAt` field) and commit to hard delete, ensuring consistency across the codebase.

### Changes Required

#### 1.1 Schema Modification

**File:** `prisma/schema.prisma`

```diff
model Paper {
  id                    String          @id @default(uuid())
  title                 String
  abstract              String?
  url                   String          @unique
  source                String
  sourceType            String?
  publicationDate       DateTime
  collectedAt           DateTime        @default(now())
  aiSummary             String?
- deletedAt             DateTime?       // REMOVE THIS LINE
  relevanceScore        Float?
  technicalScore        Float?
  businessScore         Float?
  timelinessScore       Float?
  practicalityScore     Float?
  assessmentReason      String?
  technicalBonusApplied Boolean         @default(false)
  tags                  PaperTag[]
  favoritedBy           UserFavorite[]
  userTags              UserTag[]
  newsletters           NewsletterLog[] @relation("NewsletterLogToPaper")

- @@index([deletedAt])                    // REMOVE THIS LINE
  @@index([publicationDate])
  @@index([source])
  @@index([url])
  @@index([collectedAt])
  @@index([title])
  @@index([sourceType])
  @@index([source, publicationDate], map: "Paper_source_date_idx")
}
```

#### 1.2 Remove `deletedAt` Filters

**File:** `src/lib/technology-radar.ts`

```diff
// Line 76-79
prisma.paper.findMany({
    where: {
        publicationDate: { gte: currentPeriodStart },
-       deletedAt: null
    },
    ...
})

// Line 95-101
prisma.paper.findMany({
    where: {
        publicationDate: {
            gte: previousPeriodStart,
            lt: currentPeriodStart
        },
-       deletedAt: null
    },
    ...
})

// Line 116-119
prisma.paper.findMany({
    where: {
        publicationDate: { gte: lastWeekStart },
-       deletedAt: null
    },
    ...
})

// Line 134-140
prisma.paper.findMany({
    where: {
        publicationDate: {
            gte: previousWeekStart,
            lt: lastWeekStart
        },
-       deletedAt: null
    },
    ...
})

// Line 155-156
prisma.paper.findMany({
-   where: { deletedAt: null },
+   where: {},
    ...
})
```

**File:** `src/lib/collection-service.ts`

```diff
// Line 580-592
const [totalPapers, papersThisWeek, papersThisMonth, lastPaper] = await Promise.all([
-   prisma.paper.count({ where: { deletedAt: null } }),
+   prisma.paper.count(),
    prisma.paper.count({
        where: {
            collectedAt: { gte: weekAgo },
-           deletedAt: null
        }
    }),
    prisma.paper.count({
        where: {
            collectedAt: { gte: monthAgo },
-           deletedAt: null
        }
    }),
    ...
]);
```

**File:** `src/lib/trends.ts`

```diff
// Line 337-344
const count = await prisma.paper.count({
    where: {
        tags: {
            some: {
                tagId: tag.id
            }
        },
-       deletedAt: null
    }
});
```

#### 1.3 Create Migration

```bash
npx prisma migrate dev --name remove_paper_deleted_at
```

**Expected migration SQL:**

```sql
-- DropIndex
DROP INDEX "Paper_deletedAt_idx";

-- AlterTable
ALTER TABLE "Paper" DROP COLUMN "deletedAt";
```

#### 1.4 DELETE API - No Changes Required

The current implementation is correct:

**File:** `src/app/api/papers/[id]/route.ts`

```typescript
// KEEP AS IS - Already correctly implements hard delete with transaction
await prisma.$transaction([
    prisma.paperTag.deleteMany({ where: { paperId: id } }),
    prisma.userTag.deleteMany({ where: { paperId: id } }),
    prisma.userFavorite.deleteMany({ where: { paperId: id } }),
    prisma.paper.delete({ where: { id } })
]);
```

---

## Phase 2: Archive Table (Optional)

### Objective

Add a separate archive table to preserve deleted paper records for audit and recovery purposes, without affecting main query performance.

### Schema Addition

**File:** `prisma/schema.prisma`

```prisma
model DeletedPaper {
  id              String    @id @default(uuid())
  originalId      String    @unique
  title           String
  abstract        String?
  url             String
  source          String
  sourceType      String?
  publicationDate DateTime
  collectedAt     DateTime
  relevanceScore  Float?
  technicalScore  Float?
  businessScore   Float?
  timelinessScore Float?
  practicalityScore Float?
  assessmentReason String?
  deletedAt       DateTime  @default(now())
  deletedBy       String?   // Future: User who deleted

  @@index([deletedAt])
  @@index([source])
  @@index([originalId])
}
```

### Enhanced DELETE API

**File:** `src/app/api/papers/[id]/route.ts`

```typescript
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { handleError, createNotFoundError } from '@/lib/error-handler';

/**
 * DELETE /api/papers/[id]
 * Remove a paper from the repository with archival
 */
export async function DELETE(
    request: Request,
    props: { params: Promise<{ id: string }> }
) {
    const { id } = await props.params;

    try {
        // 1. Fetch paper with all data needed for archive
        const paper = await prisma.paper.findUnique({
            where: { id },
            include: {
                tags: {
                    include: { tag: true }
                }
            }
        });

        if (!paper) {
            const error = createNotFoundError('Paper');
            const handled = handleError(error);
            return NextResponse.json(handled, { status: handled.statusCode });
        }

        // 2. Archive and delete in transaction
        await prisma.$transaction([
            // 2a. Create archive record
            prisma.deletedPaper.create({
                data: {
                    originalId: paper.id,
                    title: paper.title,
                    abstract: paper.abstract,
                    url: paper.url,
                    source: paper.source,
                    sourceType: paper.sourceType,
                    publicationDate: paper.publicationDate,
                    collectedAt: paper.collectedAt,
                    relevanceScore: paper.relevanceScore,
                    technicalScore: paper.technicalScore,
                    businessScore: paper.businessScore,
                    timelinessScore: paper.timelinessScore,
                    practicalityScore: paper.practicalityScore,
                    assessmentReason: paper.assessmentReason,
                }
            }),
            // 2b. Delete related records
            prisma.paperTag.deleteMany({ where: { paperId: id } }),
            prisma.userTag.deleteMany({ where: { paperId: id } }),
            prisma.userFavorite.deleteMany({ where: { paperId: id } }),
            // 2c. Hard delete paper
            prisma.paper.delete({ where: { id } })
        ]);

        return NextResponse.json({
            success: true,
            message: "Paper removed and archived successfully"
        });
    } catch (error) {
        const handled = handleError(error);
        return NextResponse.json(handled, { status: handled.statusCode });
    }
}
```

### Future: Recovery API (Optional)

**File:** `src/app/api/archive/[id]/restore/route.ts` (Future)

```typescript
/**
 * POST /api/archive/[id]/restore
 * Restore a deleted paper from archive
 */
export async function POST(
    request: Request,
    props: { params: Promise<{ id: string }> }
) {
    const { id } = await props.params;

    try {
        const archivedPaper = await prisma.deletedPaper.findUnique({
            where: { originalId: id }
        });

        if (!archivedPaper) {
            return NextResponse.json(
                { error: 'Archived paper not found' },
                { status: 404 }
            );
        }

        // Check if paper already exists (was re-collected)
        const existing = await prisma.paper.findUnique({
            where: { url: archivedPaper.url }
        });

        if (existing) {
            return NextResponse.json(
                { error: 'Paper with this URL already exists' },
                { status: 409 }
            );
        }

        // Restore paper
        const restored = await prisma.paper.create({
            data: {
                id: archivedPaper.originalId,
                title: archivedPaper.title,
                abstract: archivedPaper.abstract,
                url: archivedPaper.url,
                source: archivedPaper.source,
                sourceType: archivedPaper.sourceType,
                publicationDate: archivedPaper.publicationDate,
                collectedAt: archivedPaper.collectedAt,
                relevanceScore: archivedPaper.relevanceScore,
                technicalScore: archivedPaper.technicalScore,
                businessScore: archivedPaper.businessScore,
                timelinessScore: archivedPaper.timelinessScore,
                practicalityScore: archivedPaper.practicalityScore,
                assessmentReason: archivedPaper.assessmentReason,
            }
        });

        // Remove from archive
        await prisma.deletedPaper.delete({
            where: { originalId: id }
        });

        return NextResponse.json({
            success: true,
            paper: restored
        });
    } catch (error) {
        const handled = handleError(error);
        return NextResponse.json(handled, { status: handled.statusCode });
    }
}
```

---

## Implementation Checklist

### Phase 1: Hard Delete Alignment

| # | Task | File | Status |
|---|------|------|--------|
| 1.1 | Remove `deletedAt` field from Paper model | `prisma/schema.prisma` | ⬜ |
| 1.2 | Remove `deletedAt` index from Paper model | `prisma/schema.prisma` | ⬜ |
| 1.3 | Remove `deletedAt: null` filter (line 79) | `src/lib/technology-radar.ts` | ⬜ |
| 1.4 | Remove `deletedAt: null` filter (line 101) | `src/lib/technology-radar.ts` | ⬜ |
| 1.5 | Remove `deletedAt: null` filter (line 119) | `src/lib/technology-radar.ts` | ⬜ |
| 1.6 | Remove `deletedAt: null` filter (line 140) | `src/lib/technology-radar.ts` | ⬜ |
| 1.7 | Remove `deletedAt: null` filter (line 156) | `src/lib/technology-radar.ts` | ⬜ |
| 1.8 | Remove `deletedAt: null` filter (line 581) | `src/lib/collection-service.ts` | ⬜ |
| 1.9 | Remove `deletedAt: null` filter (line 585) | `src/lib/collection-service.ts` | ⬜ |
| 1.10 | Remove `deletedAt: null` filter (line 591) | `src/lib/collection-service.ts` | ⬜ |
| 1.11 | Remove `deletedAt: null` filter (line 344) | `src/lib/trends.ts` | ⬜ |
| 1.12 | Create and run migration | Terminal | ⬜ |
| 1.13 | Regenerate Prisma client | Terminal | ⬜ |
| 1.14 | Test paper deletion | Manual | ⬜ |
| 1.15 | Verify no regressions | Manual | ⬜ |

### Phase 2: Archive Table (Optional)

| # | Task | File | Status |
|---|------|------|--------|
| 2.1 | Add DeletedPaper model to schema | `prisma/schema.prisma` | ⬜ |
| 2.2 | Create and run migration | Terminal | ⬜ |
| 2.3 | Update DELETE endpoint with archive logic | `src/app/api/papers/[id]/route.ts` | ⬜ |
| 2.4 | Test archive on delete | Manual | ⬜ |
| 2.5 | (Future) Create archive viewer UI | New | ⬜ |
| 2.6 | (Future) Create restore API | New | ⬜ |

---

## Testing Plan

### Phase 1 Testing

#### Test 1: Paper Deletion
```
1. Create a test paper (or use existing)
2. Note the paper ID
3. Click X button to delete
4. Verify: Paper removed from UI
5. Check DB: Paper record gone
6. Check DB: Related PaperTags deleted
7. Check DB: Related UserTags deleted
8. Check DB: Related UserFavorites deleted
```

#### Test 2: Dashboard Stats
```
1. Note dashboard paper count before deletion
2. Delete a paper
3. Refresh dashboard
4. Verify: Count decreased by 1
```

#### Test 3: Library Page
```
1. View library page
2. Delete a paper via X button
3. Refresh page
4. Verify: Paper not visible
5. Search for deleted paper title
6. Verify: No results
```

#### Test 4: Technology Radar
```
1. Open technology radar
2. Verify: Charts load without error
3. Verify: Data looks consistent
```

#### Test 5: Collection Duplicate Detection
```
1. Delete a paper
2. Run collection with same query
3. Verify: Same paper can be re-collected (not flagged as duplicate)
```

### Phase 2 Testing

#### Test 6: Archive Creation
```
1. Delete a paper
2. Check DeletedPaper table
3. Verify: Record exists with correct data
4. Verify: originalId matches deleted paper's ID
```

---

## Rollback Plan

### If Phase 1 Causes Issues

1. **Revert schema changes:**
   ```bash
   git checkout HEAD -- prisma/schema.prisma
   npx prisma migrate dev --name rollback_deleted_at
   ```

2. **Revert code changes:**
   ```bash
   git checkout HEAD -- src/lib/technology-radar.ts
   git checkout HEAD -- src/lib/collection-service.ts
   git checkout HEAD -- src/lib/trends.ts
   ```

3. **Regenerate Prisma client:**
   ```bash
   npx prisma generate
   ```

### If Phase 2 Causes Issues

1. Archive table doesn't affect main functionality
2. Simply revert the DELETE endpoint to original:
   ```bash
   git checkout HEAD -- src/app/api/papers/[id]/route.ts
   ```

---

## Migration Commands

```bash
# Phase 1
npx prisma migrate dev --name remove_paper_deleted_at
npx prisma generate

# Phase 2 (optional)
npx prisma migrate dev --name add_deleted_paper_archive
npx prisma generate
```

---

## Summary

| Aspect | Before | After Phase 1 | After Phase 2 |
|--------|--------|---------------|---------------|
| Schema | Has `deletedAt` | No `deletedAt` | + DeletedPaper table |
| DELETE API | Hard delete | Hard delete | Hard delete + archive |
| Queries | Mixed filters | No filters | No filters |
| Recovery | None | None | Via archive |
| Data Integrity | ✅ Via transaction | ✅ Via transaction | ✅ Via transaction |
| Consistency | ❌ Mixed patterns | ✅ Consistent | ✅ Consistent |

---

## Approval

| Role | Name | Date | Status |
|------|------|------|--------|
| Developer | | | ⬜ Pending |
| Reviewer | | | ⬜ Pending |

---

## Notes

- Phase 1 is **required** to fix the current inconsistency
- Phase 2 is **optional** and can be implemented later if audit/recovery is needed
- No data loss risk - current hard delete already works correctly
- Low risk change - only removing dead code
