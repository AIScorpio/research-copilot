# Paper Deletion Strategy - Design & Execution Plan

**Created**: 2026-02-23
**Last Updated**: 2026-02-23
**Status**: Phase 1 Complete | Phase 2 Ready for Implementation
**Priority**: High
**Scope**: Paper deletion data integrity and consistency

---

## Executive Summary

This document outlines a two-phase approach to fix the paper deletion inconsistency and optionally add archive capability for audit/recovery.

**Problem (Now Resolved):**
- ~~Schema has `deletedAt` field (soft-delete pattern)~~
- ~~DELETE API does hard delete (ignores `deletedAt`)~~
- ~~3 files filter by `deletedAt: null` (expect soft-delete)~~
- ~~15+ files don't filter (expect hard-delete)~~
- ~~Inconsistent behavior, potential data integrity issues~~

**Solution:**
- Phase 1: ✅ **COMPLETED** - Commit to hard delete, remove dead `deletedAt` code
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

### Current Paper Schema (Post Phase 1)

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

  @@index([publicationDate])
  @@index([source])
  @@index([url])
  @@index([collectedAt])
  @@index([title])
  @@index([sourceType])
  @@index([source, publicationDate], map: "Paper_source_date_idx")
}
```

### Current DELETE API Implementation

**File:** `src/app/api/papers/[id]/route.ts`

```typescript
// Current implementation - HARD DELETE with transaction
await prisma.$transaction([
    prisma.paperTag.deleteMany({ where: { paperId: id } }),
    prisma.userTag.deleteMany({ where: { paperId: id } }),
    prisma.userFavorite.deleteMany({ where: { paperId: id } }),
    prisma.paper.delete({ where: { id } })
]);
```

---

## Phase 1: Hard Delete Alignment

### Status: ✅ COMPLETED

**Completion Date:** 2026-02-23
**Commit:** `89d031a`

### Summary of Changes

| Change | File | Status |
|--------|------|--------|
| Remove `deletedAt` field from Paper model | `prisma/schema.prisma` | ✅ |
| Remove `deletedAt` index from Paper model | `prisma/schema.prisma` | ✅ |
| Remove 5 `deletedAt: null` filters | `src/lib/technology-radar.ts` | ✅ |
| Remove 3 `deletedAt: null` filters | `src/lib/collection-service.ts` | ✅ |
| Remove 1 `deletedAt: null` filter | `src/lib/trends.ts` | ✅ |
| Remove 1 `deletedAt: null` filter | `scripts/backfill-trends-simple.ts` | ✅ |
| Create migration `remove_paper_deleted_at` | `prisma/migrations/` | ✅ |

---

## Phase 2: Archive Table (Optional)

### Objective

Add a separate archive table to preserve deleted paper records for audit and recovery purposes, without affecting main query performance.

### Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Archive all Paper fields | Yes | Complete data preservation for recovery |
| Archive Tag associations | No | Tags are master data, not paper-specific; bloats archive |
| Handle re-delete | Upsert | Overwrite existing archive to avoid unique constraint error |
| Include deletedBy | Yes (nullable) | Future-ready for user tracking |

### Schema Addition

**File:** `prisma/schema.prisma`

Add the following model after the `Paper` model:

```prisma
model DeletedPaper {
  id                    String    @id @default(uuid())
  originalId            String    @unique
  title                 String
  abstract              String?
  url                   String
  source                String
  sourceType            String?
  publicationDate       DateTime
  collectedAt           DateTime
  aiSummary             String?
  relevanceScore        Float?
  technicalScore        Float?
  businessScore         Float?
  timelinessScore       Float?
  practicalityScore     Float?
  assessmentReason      String?
  technicalBonusApplied Boolean   @default(false)
  deletedAt             DateTime  @default(now())
  deletedBy             String?

  @@index([deletedAt])
  @@index([source])
  @@index([originalId])
}
```

**Field Mapping Verification:**

| Paper Field | DeletedPaper Field | Match |
|-------------|-------------------|-------|
| id | originalId | ✅ (renamed for clarity) |
| title | title | ✅ |
| abstract | abstract | ✅ |
| url | url | ✅ |
| source | source | ✅ |
| sourceType | sourceType | ✅ |
| publicationDate | publicationDate | ✅ |
| collectedAt | collectedAt | ✅ |
| aiSummary | aiSummary | ✅ |
| relevanceScore | relevanceScore | ✅ |
| technicalScore | technicalScore | ✅ |
| businessScore | businessScore | ✅ |
| timelinessScore | timelinessScore | ✅ |
| practicalityScore | practicalityScore | ✅ |
| assessmentReason | assessmentReason | ✅ |
| technicalBonusApplied | technicalBonusApplied | ✅ |
| tags | (not archived) | N/A - Master data |
| favoritedBy | (not archived) | N/A - User-specific |
| userTags | (not archived) | N/A - User-specific |
| newsletters | (not archived) | N/A - Relationship |
| - | deletedAt | Archive timestamp |
| - | deletedBy | Future: User ID |

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
            // 2a. Create or update archive record (handles re-delete scenario)
            prisma.deletedPaper.upsert({
                where: { originalId: paper.id },
                update: {
                    // Update existing archive (paper was re-collected and deleted again)
                    title: paper.title,
                    abstract: paper.abstract,
                    url: paper.url,
                    source: paper.source,
                    sourceType: paper.sourceType,
                    publicationDate: paper.publicationDate,
                    collectedAt: paper.collectedAt,
                    aiSummary: paper.aiSummary,
                    relevanceScore: paper.relevanceScore,
                    technicalScore: paper.technicalScore,
                    businessScore: paper.businessScore,
                    timelinessScore: paper.timelinessScore,
                    practicalityScore: paper.practicalityScore,
                    assessmentReason: paper.assessmentReason,
                    technicalBonusApplied: paper.technicalBonusApplied,
                    deletedAt: new Date(), // Update timestamp
                },
                create: {
                    originalId: paper.id,
                    title: paper.title,
                    abstract: paper.abstract,
                    url: paper.url,
                    source: paper.source,
                    sourceType: paper.sourceType,
                    publicationDate: paper.publicationDate,
                    collectedAt: paper.collectedAt,
                    aiSummary: paper.aiSummary,
                    relevanceScore: paper.relevanceScore,
                    technicalScore: paper.technicalScore,
                    businessScore: paper.businessScore,
                    timelinessScore: paper.timelinessScore,
                    practicalityScore: paper.practicalityScore,
                    assessmentReason: paper.assessmentReason,
                    technicalBonusApplied: paper.technicalBonusApplied,
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

### Expected Migration SQL

**File:** `prisma/migrations/YYYYMMDDHHMMSS_add_deleted_paper_archive/migration.sql`

```sql
-- CreateTable
CREATE TABLE "DeletedPaper" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "originalId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "abstract" TEXT,
    "url" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "sourceType" TEXT,
    "publicationDate" DATETIME NOT NULL,
    "collectedAt" DATETIME NOT NULL,
    "aiSummary" TEXT,
    "relevanceScore" REAL,
    "technicalScore" REAL,
    "businessScore" REAL,
    "timelinessScore" REAL,
    "practicalityScore" REAL,
    "assessmentReason" TEXT,
    "technicalBonusApplied" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedBy" TEXT
);

-- CreateIndex
CREATE UNIQUE INDEX "DeletedPaper_originalId_key" ON "DeletedPaper"("originalId");

-- CreateIndex
CREATE INDEX "DeletedPaper_deletedAt_idx" ON "DeletedPaper"("deletedAt");

-- CreateIndex
CREATE INDEX "DeletedPaper_source_idx" ON "DeletedPaper"("source");

-- CreateIndex
CREATE INDEX "DeletedPaper_originalId_idx" ON "DeletedPaper"("originalId");
```

### Future: Recovery API (Optional)

**File:** `src/app/api/archive/[id]/restore/route.ts` (Future)

```typescript
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { handleError } from '@/lib/error-handler';

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
                { error: 'Paper with this URL already exists in the library' },
                { status: 409 }
            );
        }

        // Restore paper (without tags - they need to be re-assigned)
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
                aiSummary: archivedPaper.aiSummary,
                relevanceScore: archivedPaper.relevanceScore,
                technicalScore: archivedPaper.technicalScore,
                businessScore: archivedPaper.businessScore,
                timelinessScore: archivedPaper.timelinessScore,
                practicalityScore: archivedPaper.practicalityScore,
                assessmentReason: archivedPaper.assessmentReason,
                technicalBonusApplied: archivedPaper.technicalBonusApplied,
            }
        });

        // Remove from archive
        await prisma.deletedPaper.delete({
            where: { originalId: id }
        });

        return NextResponse.json({
            success: true,
            message: "Paper restored successfully",
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
| 1.1 | Remove `deletedAt` field from Paper model | `prisma/schema.prisma` | ✅ Complete |
| 1.2 | Remove `deletedAt` index from Paper model | `prisma/schema.prisma` | ✅ Complete |
| 1.3 | Remove `deletedAt: null` filter (line 79) | `src/lib/technology-radar.ts` | ✅ Complete |
| 1.4 | Remove `deletedAt: null` filter (line 101) | `src/lib/technology-radar.ts` | ✅ Complete |
| 1.5 | Remove `deletedAt: null` filter (line 119) | `src/lib/technology-radar.ts` | ✅ Complete |
| 1.6 | Remove `deletedAt: null` filter (line 140) | `src/lib/technology-radar.ts` | ✅ Complete |
| 1.7 | Remove `deletedAt: null` filter (line 156) | `src/lib/technology-radar.ts` | ✅ Complete |
| 1.8 | Remove `deletedAt: null` filter (line 581) | `src/lib/collection-service.ts` | ✅ Complete |
| 1.9 | Remove `deletedAt: null` filter (line 585) | `src/lib/collection-service.ts` | ✅ Complete |
| 1.10 | Remove `deletedAt: null` filter (line 591) | `src/lib/collection-service.ts` | ✅ Complete |
| 1.11 | Remove `deletedAt: null` filter (line 344) | `src/lib/trends.ts` | ✅ Complete |
| 1.12 | Remove `deletedAt: null` filter | `scripts/backfill-trends-simple.ts` | ✅ Complete |
| 1.13 | Create and run migration | Terminal | ✅ Complete |
| 1.14 | Regenerate Prisma client | Terminal | ✅ Complete |
| 1.15 | Clear Next.js cache (`.next` folder) | Terminal | ✅ Complete |
| 1.16 | Test paper deletion | Manual | ✅ Complete |
| 1.17 | Peer review validation | Manual | ✅ Complete |

### Phase 2: Archive Table (Optional)

| # | Task | File | Status |
|---|------|------|--------|
| 2.1 | Add DeletedPaper model to schema | `prisma/schema.prisma` | ⬜ |
| 2.2 | Run `npx prisma validate` to verify schema | Terminal | ⬜ |
| 2.3 | Create and run migration | Terminal | ⬜ |
| 2.4 | Run `npx prisma generate` | Terminal | ⬜ |
| 2.5 | Update DELETE endpoint with archive logic | `src/app/api/papers/[id]/route.ts` | ⬜ |
| 2.6 | Clear Next.js cache (`rm -rf .next`) | Terminal | ⬜ |
| 2.7 | Restart dev server | Terminal | ⬜ |
| 2.8 | Test archive on delete | Manual | ⬜ |
| 2.9 | Test re-delete scenario | Manual | ⬜ |
| 2.10 | Verify no regressions | Manual | ⬜ |
| 2.11 | (Future) Create archive list API | `src/app/api/archive/route.ts` | ⬜ |
| 2.12 | (Future) Create restore API | `src/app/api/archive/[id]/restore/route.ts` | ⬜ |
| 2.13 | (Future) Create archive viewer UI | New component | ⬜ |

---

## Testing Plan

### Phase 1 Testing (Completed)

#### Test 1: Paper Deletion ✅
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

#### Test 2: Dashboard Stats ✅
```
1. Note dashboard paper count before deletion
2. Delete a paper
3. Refresh dashboard
4. Verify: Count decreased by 1
```

#### Test 3: Library Page ✅
```
1. View library page
2. Delete a paper via X button
3. Refresh page
4. Verify: Paper not visible
5. Search for deleted paper title
6. Verify: No results
```

#### Test 4: Technology Radar ✅
```
1. Open technology radar
2. Verify: Charts load without error
3. Verify: Data looks consistent
```

#### Test 5: Collection Duplicate Detection ✅
```
1. Delete a paper
2. Run collection with same query
3. Verify: Same paper can be re-collected (not flagged as duplicate)
```

### Phase 2 Testing

#### Test 6: Archive Creation
```
1. Note paper ID and all field values
2. Delete the paper
3. Query DeletedPaper table:
   SELECT * FROM DeletedPaper WHERE originalId = '<paper_id>';
4. Verify: Record exists
5. Verify: All fields match original paper data
6. Verify: deletedAt timestamp is set
```

#### Test 7: Archive Data Accuracy
```
1. Select a paper with all fields populated (including aiSummary)
2. Note all field values
3. Delete the paper
4. Check DeletedPaper record
5. Verify each field matches:
   - title ✅
   - abstract ✅
   - url ✅
   - source ✅
   - sourceType ✅
   - publicationDate ✅
   - collectedAt ✅
   - aiSummary ✅
   - relevanceScore ✅
   - technicalScore ✅
   - businessScore ✅
   - timelinessScore ✅
   - practicalityScore ✅
   - assessmentReason ✅
   - technicalBonusApplied ✅
```

#### Test 8: Paper Removal from Main Table
```
1. Delete a paper
2. Query Paper table:
   SELECT * FROM Paper WHERE id = '<paper_id>';
3. Verify: No results (paper is gone)
```

#### Test 9: Related Records Cleanup
```
1. Note paper ID and count of related records:
   - SELECT COUNT(*) FROM PaperTag WHERE paperId = '<id>';
   - SELECT COUNT(*) FROM UserTag WHERE paperId = '<id>';
   - SELECT COUNT(*) FROM UserFavorite WHERE paperId = '<id>';
2. Delete the paper
3. Verify all counts are now 0
```

#### Test 10: Re-delete Scenario (Paper Re-collected and Deleted Again)
```
1. Delete a paper (paper A)
2. Verify: Archive record created
3. Re-collect the same paper (paper A with same URL)
4. Delete the paper again
5. Verify: Archive record updated (not duplicated)
6. Verify: deletedAt timestamp is newer
7. Verify: Only 1 archive record exists for this originalId
```

#### Test 11: API Response
```
1. Delete a paper via API: DELETE /api/papers/<id>
2. Verify response:
   {
     "success": true,
     "message": "Paper removed and archived successfully"
   }
```

#### Test 12: Non-existent Paper
```
1. Try to delete non-existent paper: DELETE /api/papers/<fake-id>
2. Verify response status: 404
3. Verify error message indicates paper not found
```

#### Test 13: Error Handling (Transaction Rollback)
```
1. Manually cause an error (e.g., invalid state)
2. Verify: Transaction rolls back completely
3. Verify: Paper still exists in main table
4. Verify: No partial archive created
```

---

## Rollback Plan

### If Phase 1 Causes Issues

**Note:** Phase 1 is already complete and stable. If issues are discovered:

1. **Revert to previous commit:**
   ```bash
   git revert 89d031a
   ```

2. **Or manually restore schema:**
   ```bash
   git checkout dd65ced -- prisma/schema.prisma
   npx prisma migrate dev --name restore_deleted_at
   npx prisma generate
   rm -rf .next
   ```

### If Phase 2 Causes Issues

1. **Revert DELETE endpoint:**
   ```bash
   git checkout HEAD -- src/app/api/papers/[id]/route.ts
   ```

2. **Remove DeletedPaper table (if desired):**
   ```bash
   # Remove model from schema, then:
   npx prisma migrate dev --name remove_deleted_paper_archive
   npx prisma generate
   ```

3. **Or keep archive table but disable archiving:**
   - Simply revert the DELETE endpoint
   - Archive table remains but is no longer populated
   - Can be re-enabled later

---

## Migration Commands

```bash
# Phase 1 (Already Complete)
npx prisma migrate dev --name remove_paper_deleted_at
npx prisma generate
rm -rf .next

# Phase 2 (Optional)
npx prisma migrate dev --name add_deleted_paper_archive
npx prisma generate
rm -rf .next
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
| Audit Trail | None | None | ✅ DeletedPaper records |

---

## Approval

| Role | Name | Date | Status |
|------|------|------|--------|
| Developer | | 2026-02-23 | ✅ Phase 1 Complete |
| Reviewer | | 2026-02-23 | ✅ Phase 1 Validated |
| Phase 2 | | | ⬜ Ready for Implementation |

---

## Notes

- Phase 1 is **complete** - all tasks finished and validated
- Phase 2 is **optional** - implement when audit/recovery is needed
- Tags are **not archived** - they are master data and can be re-assigned after restore
- `aiSummary` and `technicalBonusApplied` **are archived** for complete data preservation
- Re-delete uses **upsert** to handle papers that are collected, deleted, re-collected, and deleted again
- All archive operations are in the **same transaction** as deletion for data integrity
