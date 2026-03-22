# Option A: Remove `Tag.type` Field - Detailed Implementation Plan

**Date**: 2026-02-24
**Status**: ✅ COMPLETED (Code changes done, schema already updated)
**Actual Completion**: 2026-02-28
**Estimated Effort**: 4-5 hours
**Actual Effort**: ~30 minutes (schema already clean)
**Risk Level**: None (Already deployed)

---

## ⚠️ ARCHIVED - WORK ALREADY COMPLETED

This document is **OUTDATED**. All tasks described here have already been completed:

- ✅ Dashboard code rewritten to use `category` instead of `type` (2026-02-24)
- ✅ All API routes updated to use `category` (2026-02-24)
- ✅ Schema files already exclude `type` field (verified 2026-02-28)
- ✅ No database migration needed (field never existed in current schema)
- ✅ Zero breaking changes (code already migrated)

**Preserved for historical reference only.**

---

## 1. Overview

### 1.1 Objective
Remove the deprecated `Tag.type` field entirely from the codebase and database, making `Tag.category` the single source of truth for tag classification.

### 1.2 Scope
- 15+ source files to modify
- 1 Prisma schema change
- 1 database migration
- API response format changes
- Dashboard complete rewrite

### 1.3 Dependencies
- No external dependencies
- Can be done in single session
- Requires database migration (downtime: ~1 minute)

---

## 2. Implementation Phases

### Phase 1: Code Changes (No DB Changes Yet)
- Update all code to stop reading `type`
- Update all code to stop writing `type`
- System still works with `type` column present

### Phase 2: Testing
- Verify all features work with new code
- Verify API responses no longer include `type`

### Phase 3: Database Migration
- Remove `type` column from schema
- Run Prisma migration
- Deploy

---

## 3. Detailed File Changes

### 3.1 Core Library Files

#### File: `src/lib/tag-generator.ts`

**Current Code (lines 12-16, 102-108):**
```typescript
export interface GeneratedTag {
    name: string;
    type: 'Academic' | 'Industrial' | 'User Defined';  // REMOVE
    category: string;
}

// ...

const validTags = result
    .filter(tag => tag.name && tag.category)
    .map(tag => ({
        name: tag.name.toLowerCase().replace(/\s+/g, '-'),
        type: tag.type || 'Industrial',  // REMOVE
        category: normalizeCategory(tag.category)
    }));
```

**New Code:**
```typescript
export interface GeneratedTag {
    name: string;
    category: string;
}

// ...

const validTags = result
    .filter(tag => tag.name && tag.category)
    .map(tag => ({
        name: tag.name.toLowerCase().replace(/\s+/g, '-'),
        category: normalizeCategory(tag.category)
    }));
```

**Changes:**
- Remove `type` from `GeneratedTag` interface
- Remove `type: tag.type || 'Industrial'` line

---

#### File: `src/lib/processor.ts`

**Current Code (lines 24-36):**
```typescript
const tagResult = await generateTagsWithLLM(result.title, result.abstract || undefined);

logger.info('[Processor] Tags generated', {
    title: result.title.substring(0, 50),
    tags: tagResult.tags.map(t => t.name),
    categories: tagResult.tags.map(t => t.category),
});

// ...

const allTags = [
    ...tagResult.tags.map(tag => ({
        name: tag.name,
        type: tag.type as 'Academic' | 'Industrial',  // REMOVE
        category: tag.category
    })),
```

**New Code:**
```typescript
const tagResult = await generateTagsWithLLM(result.title, result.abstract || undefined);

logger.info('[Processor] Tags generated', {
    title: result.title.substring(0, 50),
    tags: tagResult.tags.map(t => t.name),
    categories: tagResult.tags.map(t => t.category),
});

// ...

const allTags = [
    ...tagResult.tags.map(tag => ({
        name: tag.name,
        category: tag.category
    })),
```

**Changes:**
- Remove `type: tag.type as 'Academic' | 'Industrial'` from tag mapping

---

#### File: `src/lib/collection-service.ts`

**Current Code (lines 274-285):**
```typescript
for (const tag of allTags.slice(0, 5)) { // Limit to 5 tags
    let dbTag = await prisma.tag.findUnique({ where: { name: tag.name } });

    if (!dbTag) {
        dbTag = await prisma.tag.create({
            data: {
                name: tag.name,
                type: tag.type,                              // REMOVE
                category: tag.category || 'uncategorized'
            }
        });
    }
```

**New Code:**
```typescript
for (const tag of allTags.slice(0, 5)) { // Limit to 5 tags
    let dbTag = await prisma.tag.findUnique({ where: { name: tag.name } });

    if (!dbTag) {
        dbTag = await prisma.tag.create({
            data: {
                name: tag.name,
                category: tag.category || 'uncategorized'
            }
        });
    }
```

**Changes:**
- Remove `type: tag.type` from tag creation

---

#### File: `src/lib/trends.ts`

**Current Code (lines 183-188, 273-278):**
```typescript
// In buildTrendData function
{
    tagName: tag.name,
    tagType: tag.type,          // REMOVE
    tagCategory: tag.category,
    // ...
}

// In another location
{
    tagName: tag.name,
    tagType: tag.type,          // REMOVE
    tagCategory: tag.category,
    // ...
}
```

**New Code:**
```typescript
// In buildTrendData function
{
    tagName: tag.name,
    tagCategory: tag.category,
    // ...
}
```

**Changes:**
- Remove `tagType: tag.type` from trend data objects (2 locations)

---

#### File: `src/lib/email-digest.ts`

**Current Code (line 104):**
```typescript
tags: p.tags.map(pt => ({ id: pt.tag.id, name: pt.tag.name, type: pt.tag.type }))
```

**New Code:**
```typescript
tags: p.tags.map(pt => ({ id: pt.tag.id, name: pt.tag.name, category: pt.tag.category }))
```

**Changes:**
- Replace `type: pt.tag.type` with `category: pt.tag.category`

---

#### File: `src/lib/recommendations.ts`

**Current Code (lines 141, 233):**
```typescript
// Line 141
category: tag.category || 'uncategorized'

// Line 233
return bankingTag.category || 'General';
```

**Status:** No changes needed - already uses `category` only.

---

### 3.2 API Route Files

#### File: `src/app/api/stats/route.ts`

**Current Code (lines 19-21):**
```typescript
const industrialTags = allTags.filter(t => t.type === 'Industrial');
const academicTags = allTags.filter(t => t.type === 'Academic');
const customTags = allTags.filter(t => t.type === 'User Defined');
```

**New Code:**
```typescript
// Group by category instead of type
const categoryStats = {
    'ai-technology': allTags.filter(t => t.category === 'ai-technology'),
    'business-area': allTags.filter(t => t.category === 'business-area'),
    'methodology': allTags.filter(t => t.category === 'methodology'),
    'risk-category': allTags.filter(t => t.category === 'risk-category'),
    'regulatory': allTags.filter(t => t.category === 'regulatory'),
};
```

**Changes:**
- Complete rewrite to use `category` instead of `type`
- Return category-based statistics

---

#### File: `src/app/api/papers/[id]/tags/route.ts`

**Current Code (line 53):**
```typescript
type: dbTag.type
```

**New Code:**
```typescript
category: dbTag.category
```

**Changes:**
- Replace `type` with `category` in response

---

#### File: `src/app/api/papers/[id]/auto-tag/route.ts`

**Current Code (line 32):**
```typescript
.map(t => ({ name: t.name, type: t.type }));
```

**New Code:**
```typescript
.map(t => ({ name: t.name, category: t.category }));
```

**Changes:**
- Replace `type` with `category` in response

---

#### File: `src/app/api/export/powerpoint/route.ts`

**Current Code (line 66):**
```typescript
tags: p.tags.map(pt => ({ id: pt.tag.id, name: pt.tag.name, type: pt.tag.type }))
```

**New Code:**
```typescript
tags: p.tags.map(pt => ({ id: pt.tag.id, name: pt.tag.name, category: pt.tag.category }))
```

**Changes:**
- Replace `type` with `category` in export data

---

### 3.3 Dashboard Files (Complete Rewrite)

#### File: `src/app/page.tsx`

**Current Logic:**
```typescript
// Categorize by type (DEPRECATED)
const industrialTags = allTags.filter(t => t.type === 'Industrial');
const academicTags = allTags.filter(t => t.type === 'Academic');

const industrialCount = industrialTags.reduce((acc, t) => acc + t._count.papers, 0);
const academicCount = academicTags.reduce((acc, t) => acc + t._count.papers, 0);
```

**New Logic:**
```typescript
// Get category-based statistics
const categoryStats = await prisma.tag.groupBy({
    by: ['category'],
    _count: { papers: true },
    where: { category: { not: null } }
});

// Get TOP 3 trending AI technology tags (dynamic, ranked by frequency)
const trendingAITags = await prisma.tag.findMany({
    where: { category: 'ai-technology' },
    include: { _count: { select: { papers: true } } },
    orderBy: { papers: { _count: 'desc' } },
    take: 3
}).then(tags => tags.map(t => t.name));

// Get TOP 3 trending business area tags (dynamic, ranked by frequency)
const trendingBusinessTags = await prisma.tag.findMany({
    where: { category: 'business-area' },
    include: { _count: { select: { papers: true } } },
    orderBy: { papers: { _count: 'desc' } },
    take: 3
}).then(tags => tags.map(t => t.name));

// Count unique papers per category (not tag associations)
const techPapersCount = await prisma.paper.count({
    where: { tags: { some: { tag: { category: 'ai-technology' } } } }
});

const businessPapersCount = await prisma.paper.count({
    where: { tags: { some: { tag: { category: 'business-area' } } } }
});

// Chart data: AI Technologies (top 10)
const techChartData = await prisma.tag.findMany({
    where: { category: 'ai-technology' },
    include: { _count: { select: { papers: true } } },
    orderBy: { papers: { _count: 'desc' } },
    take: 10
});

// Chart data: Methodologies (top 5)
const methodChartData = await prisma.tag.findMany({
    where: { category: 'methodology' },
    include: { _count: { select: { papers: true } } },
    orderBy: { papers: { _count: 'desc' } },
    take: 5
});

return {
    totalPapers,
    businessAppsCount: businessPapersCount,
    aiTechCount: techPapersCount,
    trendingBusinessTags,   // ['fraud-detection', 'compliance', 'credit-assessment']
    trendingAITags,         // ['graph-neural-networks', 'large-language-models', 'machine-learning']
    techChartData,
    methodChartData,
    growthRate,
    dailyStats
};
```

**Changes:**
- Complete rewrite of `getDashboardData()` function
- Use `category` instead of `type`
- Count unique papers, not tag associations
- **NEW**: Fetch top 3 trending tags per category dynamically

---

#### File: `src/components/dashboard/stats-cards.tsx`

**Current Props:**
```typescript
interface StatsCardsProps {
    total: number;
    industrialCount: number;    // RENAME
    academicCount: number;      // RENAME
    growthRate: number;
    dailyStats: Record<string, number>;
}
```

**New Props:**
```typescript
interface StatsCardsProps {
    total: number;
    businessAppsCount: number;              // Papers with business-area tags
    aiTechCount: number;                    // Papers with ai-technology tags
    trendingBusinessTags: string[];         // Top 3 business-area tags (dynamic)
    trendingAITags: string[];               // Top 3 ai-technology tags (dynamic)
    growthRate: number;
    dailyStats: Record<string, number>;
}
```

**New Component Code:**
```typescript
export function StatsCards({
    total,
    businessAppsCount,
    aiTechCount,
    trendingBusinessTags,
    trendingAITags,
    growthRate,
    dailyStats
}: StatsCardsProps) {
    return (
        <div className="grid gap-4 md:grid-cols-3">
            {/* Card 1: Total Research Base - unchanged */}
            <Card className="...">
                <CardHeader>...</CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{total}</div>
                    <CollectionCalendar ... />
                </CardContent>
            </Card>

            {/* Card 2: Business Applications - NEW */}
            <Link href="/papers?category=business-area">
                <Card className="...">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Business Applications</CardTitle>
                        <Activity className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{businessAppsCount}</div>
                        <p className="text-xs text-muted-foreground">
                            Trending: {trendingBusinessTags.join(', ')}
                        </p>
                    </CardContent>
                </Card>
            </Link>

            {/* Card 3: AI Technologies - NEW */}
            <Link href="/radar">
                <Card className="...">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">AI Technologies</CardTitle>
                        <Cpu className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{aiTechCount}</div>
                        <p className="text-xs text-muted-foreground">
                            Trending: {trendingAITags.join(', ')}
                        </p>
                    </CardContent>
                </Card>
            </Link>
        </div>
    );
}
```

**Dynamic Behavior:**
- Trending tags are calculated at page load time
- Ranked by paper count (frequency)
- Automatically updates when new papers are collected
- If a new tag becomes more frequent, it will appear in trending

---

#### File: `src/components/dashboard/topic-chart.tsx`

**Current Usage:** Receives data from `page.tsx`

**Changes Needed:**
- No component changes needed
- Data source changes in `page.tsx` (ai-technology tags)

---

#### File: `src/components/dashboard/methodology-chart.tsx`

**Current Usage:** Receives filtered data `data.filter(d => d.type === 'Academic')`

**Changes Needed:**
- No component changes needed
- Data source changes in `page.tsx` (methodology tags directly)

---

### 3.4 Prisma Schema

#### File: `prisma/schema.prisma`

**Current Schema:**
```prisma
model Tag {
  id        String      @id @default(uuid())
  name      String      @unique
  type      String      // REMOVE THIS LINE
  category  String?

  papers    PaperTag[]

  @@index([category])
}
```

**New Schema:**
```prisma
model Tag {
  id        String      @id @default(uuid())
  name      String      @unique
  category  String?

  papers    PaperTag[]

  @@index([category])
}
```

**Changes:**
- Remove `type String` field

---

### 3.5 Generated Prisma Client

After schema change, run:
```bash
npx prisma generate
```

This updates `src/generated/prisma` with new types.

---

## 4. Migration Script

### 4.1 Pre-Migration Backup

```bash
# Backup database before migration
cp prisma/dev.db prisma/dev.db.backup
```

### 4.2 Prisma Migration Command

```bash
npx prisma migrate dev --name remove-tag-type-field
```

This will:
1. Detect schema change (removed `type` field)
2. Generate SQL migration
3. Apply migration to database
4. Update Prisma client

### 4.3 Generated SQL (Expected)

```sql
-- AlterTable
ALTER TABLE "Tag" DROP COLUMN "type";
```

---

## 5. Testing Plan

### 5.1 Unit Tests (if any exist)

```bash
npm run test
```

### 5.2 Manual Test Checklist

| Feature | Test | Expected Result |
|---------|------|-----------------|
| **Paper Collection** | Run auto collection | Papers saved with tags (no type field) |
| **Dashboard** | Load dashboard page | Cards show category-based stats |
| **Dashboard Charts** | View charts | ai-technology and methodology data |
| **Tech Radar** | Load radar page | Works correctly |
| **Library** | Filter by tags | Works correctly |
| **Paper Detail** | View paper | Tags show category, not type |
| **Auto-tag** | Trigger auto-tag | Returns category, not type |
| **Export PPT** | Export to PowerPoint | Tags have category field |
| **Email Digest** | Trigger digest | Tags have category field |
| **API /api/stats** | Call endpoint | Returns category stats |
| **API /api/papers/[id]/tags** | Call endpoint | Returns category, not type |

### 5.3 API Response Validation

**Before:**
```json
{
  "tags": [
    { "name": "fraud-detection", "type": "Industrial" }
  ]
}
```

**After:**
```json
{
  "tags": [
    { "name": "fraud-detection", "category": "business-area" }
  ]
}
```

---

## 6. Rollback Plan

### 6.1 Code Rollback

```bash
git revert <commit-hash>
```

### 6.2 Database Rollback

```bash
# Restore from backup
cp prisma/dev.db.backup prisma/dev.db

# Or run Prisma migrate rollback
npx prisma migrate rollback
```

### 6.3 If Migration Was Pushed to Production

1. Revert code deployment
2. Restore database from pre-migration backup
3. Verify all features work

---

## 7. Execution Order ✅ ALL COMPLETED

| Step | Action | Status | Notes |
|------|--------|--------|-------|
| 1 | Backup database | N/A | Not needed - field never existed |
| 2 | Modify `tag-generator.ts` | ✅ Done | `type` field never added |
| 3 | Modify `processor.ts` | ✅ Done | `type` field never added |
| 4 | Modify `collection-service.ts` | ✅ Done | `type` field never added |
| 5 | Modify `trends.ts` | ✅ Done | Already using `category` |
| 6 | Modify `email-digest.ts` | ✅ Done | Already using `category` |
| 7 | Modify `api/stats/route.ts` | ✅ Done | Rewritten to use `categoryStats` |
| 8 | Modify `api/papers/[id]/tags/route.ts` | ✅ Done | Already using `category` |
| 9 | Modify `api/papers/[id]/auto-tag/route.ts` | ✅ Done | Already using `category` |
| 10 | Modify `api/export/powerpoint/route.ts` | ✅ Done | Already using `category` |
| 11 | Rewrite `app/page.tsx` | ✅ Done | Complete rewrite using `category` |
| 12 | Modify `stats-cards.tsx` | ✅ Done | Using `category`-based props |
| 13 | Update `schema.prisma` | ✅ Done | `type` field not present |
| 14 | Run `prisma generate` | N/A | Not needed |
| 15 | Test all features | ✅ Done | All tests passing |
| 16 | Run `prisma migrate dev` | N/A | Not needed |
| 17 | Final verification | ✅ Done | Production verified |
| **Total** | | **~30 min** | **All work completed** |

---

## 8. Files Summary

| File | Change Type | Lines Changed |
|------|-------------|---------------|
| `src/lib/tag-generator.ts` | Remove type | ~3 lines |
| `src/lib/processor.ts` | Remove type | ~1 line |
| `src/lib/collection-service.ts` | Remove type | ~1 line |
| `src/lib/trends.ts` | Remove tagType | ~2 lines |
| `src/lib/email-digest.ts` | Replace with category | ~1 line |
| `src/app/api/stats/route.ts` | Rewrite | ~15 lines |
| `src/app/api/papers/[id]/tags/route.ts` | Replace | ~1 line |
| `src/app/api/papers/[id]/auto-tag/route.ts` | Replace | ~1 line |
| `src/app/api/export/powerpoint/route.ts` | Replace | ~1 line |
| `src/app/page.tsx` | Rewrite | ~40 lines |
| `src/components/dashboard/stats-cards.tsx` | Rewrite props | ~20 lines |
| `prisma/schema.prisma` | Remove field | ~1 line |

**Total: 12 files, ~90 lines changed**

---

## 9. Breaking Changes Notice

### API Breaking Changes

| Endpoint | Before | After |
|----------|--------|-------|
| `GET /api/stats` | `industrialCount`, `academicCount` | `categoryStats` object |
| `GET /api/papers/[id]/tags` | `type` field | `category` field |
| `GET /api/papers/[id]/auto-tag` | `type` field | `category` field |
| `GET /api/trends` | `tagType` field | Removed |

### Export Format Changes

| Export | Before | After |
|--------|--------|-------|
| PowerPoint | `tags[].type` | `tags[].category` |
| Email Digest | `tags[].type` | `tags[].category` |

**Note**: If external systems consume these APIs, coordinate changes with them.

---

## 10. Approval Checklist

- [ ] Reviewed all file changes
- [ ] Understood breaking changes
- [ ] Confirmed no external API consumers affected (or coordinated)
- [ ] Approved execution order
- [ ] Ready to proceed

---

**AWAITING APPROVAL TO BEGIN IMPLEMENTATION**
