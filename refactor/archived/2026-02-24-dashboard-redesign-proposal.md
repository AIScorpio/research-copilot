# Dashboard Redesign Proposal

**Date**: 2026-02-24  
**Completed**: 2026-02-24  
**Status**: ✅ COMPLETED AND ARCHIVED  
**Author**: System Analysis  

---

## ⚠️ ARCHIVED - WORK ALREADY COMPLETED

This document is **OUTDATED**. All proposed changes have already been implemented:

- ✅ Dashboard migrated from deprecated `Tag.type` to `Tag.category`  
- ✅ Stats Cards show: Total Research, Business Applications (business-area), Risk Categories (risk-category)  
- ✅ Topic Chart displays AI Technologies (ai-technology)  
- ✅ Methodology Chart shows methodology distribution  
- ✅ All components use new taxonomy system correctly  
- ✅ Interactive charts with modern UI  

**Current implementation**: See `/src/app/page.tsx` and `/src/components/dashboard/`  
**Preserved for historical reference only.**

---

---

## 1. Current State Analysis

### 1.1 Deprecated Data Logic

| Component | Current Logic | Issue |
|-----------|---------------|-------|
| Industrial Use Cases | `Tag.type = 'Industrial'` | Deprecated field |
| Academic Research | `Tag.type = 'Academic'` | Deprecated field |
| Trending Topics Chart | All `Tag.type` values | Deprecated field |
| Methodology Chart | `Tag.type = 'Academic'` | Wrong + Deprecated |

### 1.2 New Taxonomy Available

| Category | Tag Count | Example Tags |
|----------|-----------|--------------|
| ai-technology | 34 | graph-neural-networks, large-language-models, transformers |
| methodology | 20 | classification, anomaly-detection, predictive-modeling |
| business-area | 11 | fraud-detection, compliance, credit-assessment |
| risk-category | 7 | fraud-risk, aml-risk, model-risk, credit-risk |
| regulatory | 2 | gdpr |

---

## 2. Proposed Dashboard Structure

### 2.1 Overview Stats Row (3 Cards)

```
┌─────────────────────┬─────────────────────┬─────────────────────┐
│  Total Research     │  Business Apps      │  AI Technologies    │
│  Base               │  (business-area)    │  (ai-technology)    │
│                     │                     │                     │
│  128 papers         │  45 papers          │  89 papers          │
│  +12% today         │  Top: fraud-detect  │  Top: GNN, LLM      │
└─────────────────────┴─────────────────────┴─────────────────────┘
```

**Card 1: Total Research Base**
- Count: Total papers in database
- Subtext: Today's growth rate
- Click: Navigate to Library (all papers)

**Card 2: Business Applications**
- Count: Papers with `tag.category = 'business-area'`
- Subtext: Top business area (e.g., "fraud-detection: 17")
- Click: Navigate to Library filtered by business-area

**Card 3: AI Technologies**
- Count: Papers with `tag.category = 'ai-technology'`
- Subtext: Top technology (e.g., "GNN: 15")
- Click: Navigate to Tech Radar

---

### 2.2 Charts Row (2 Charts)

```
┌────────────────────────────────────┬────────────────────────────────────┐
│  AI Technology Distribution        │  Research Methodology              │
│  (Bar Chart)                       │  (Pie Chart)                       │
│                                    │                                    │
│  Source: tag.category='ai-tech'    │  Source: tag.category='methodology'│
│  Top 10 by paper count             │  Top 5 by paper count              │
└────────────────────────────────────┴────────────────────────────────────┘
```

**Chart 1: AI Technology Distribution (Bar Chart)**
- Data: Tags where `category = 'ai-technology'`
- Sort: By paper count (descending)
- Limit: Top 10
- Click bar: Filter Library by that technology

**Chart 2: Research Methodology (Pie Chart)**
- Data: Tags where `category = 'methodology'`
- Sort: By paper count (descending)
- Limit: Top 5
- Click slice: Filter Library by that methodology

---

### 2.3 Insights Row (Optional - New)

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Quick Insights                                                          │
├──────────────────┬──────────────────┬──────────────────┬────────────────┤
│  Risk Coverage   │  Regulatory      │  Avg Quality     │  Fresh Papers  │
│  4/7 categories  │  1 framework     │  Score: 7.8      │  12 this week  │
└──────────────────┴──────────────────┴──────────────────┴────────────────┘
```

**Metric 1: Risk Coverage**
- Count: How many distinct `risk-category` tags have papers
- Subtext: "4 of 7 categories covered"
- Click: Navigate to Risk Radar (future)

**Metric 2: Regulatory Coverage**
- Count: Papers with `category = 'regulatory'`
- Subtext: Framework names (e.g., "gdpr")
- Click: Filter Library by regulatory

**Metric 3: Average Quality Score**
- Value: Average `relevanceScore` across recent papers
- Subtext: "Based on last 30 papers"
- Click: View high-scoring papers

**Metric 4: Fresh Papers**
- Count: Papers collected in last 7 days
- Subtext: "12 this week"
- Click: Filter Library by recent

---

## 3. Data Query Specifications

### 3.1 Stats Cards Data

```typescript
async function getDashboardData() {
  // 1. Total papers
  const totalPapers = await prisma.paper.count();

  // 2. Papers per category (via tags)
  const categoryStats = await prisma.tag.groupBy({
    by: ['category'],
    _count: { papers: true },
    where: { category: { not: null } }
  });

  // 3. Top tag per category
  const topTagsByCategory = await prisma.$queryRaw`
    SELECT t.category, t.name, COUNT(pt.paperId) as paper_count
    FROM Tag t
    JOIN PaperTag pt ON t.id = pt.tagId
    WHERE t.category IS NOT NULL
    GROUP BY t.category, t.name
    ORDER BY t.category, paper_count DESC
  `;

  // 4. Technology tags for bar chart
  const techTags = await prisma.tag.findMany({
    where: { category: 'ai-technology' },
    include: { _count: { select: { papers: true } } },
    orderBy: { papers: { _count: 'desc' } },
    take: 10
  });

  // 5. Methodology tags for pie chart
  const methodTags = await prisma.tag.findMany({
    where: { category: 'methodology' },
    include: { _count: { select: { papers: true } } },
    orderBy: { papers: { _count: 'desc' } },
    take: 5
  });

  // 6. Recent papers count
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const recentCount = await prisma.paper.count({
    where: { collectedAt: { gte: weekAgo } }
  });

  // 7. Average quality score
  const avgScore = await prisma.paper.aggregate({
    _avg: { relevanceScore: true },
    where: { collectedAt: { gte: weekAgo } }
  });

  return {
    totalPapers,
    categoryStats,
    topTagsByCategory,
    techTags,
    methodTags,
    recentCount,
    avgQualityScore: avgScore._avg.relevanceScore
  };
}
```

### 3.2 Chart Data Transformations

```typescript
// Bar Chart: AI Technologies
const techChartData = techTags.map(t => ({
  name: t.name,
  count: t._count.papers
}));

// Pie Chart: Methodologies
const methodChartData = methodTags.map(t => ({
  name: t.name,
  count: t._count.papers
}));
```

---

## 4. Component Changes Required

### 4.1 Files to Modify

| File | Changes |
|------|---------|
| `src/app/page.tsx` | Rewrite `getDashboardData()` to use `category` |
| `src/components/dashboard/stats-cards.tsx` | Replace Industrial/Academic with Business/AI Tech cards |
| `src/components/dashboard/topic-chart.tsx` | Update to show `ai-technology` tags |
| `src/components/dashboard/methodology-chart.tsx` | Update to show `methodology` tags |

### 4.2 New Components (Optional)

| File | Purpose |
|------|---------|
| `src/components/dashboard/insights-row.tsx` | Quick insights row (Risk Coverage, Regulatory, etc.) |

---

## 5. Visual Comparison

### Before (Current - Broken)

```
┌─────────────────┬─────────────────┬─────────────────┐
│ Total Research  │ Industrial Use  │ Academic        │
│ Base            │ Cases           │ Research        │
│ (uses tag.type) │ (tag.type='Ind')│ (tag.type='Acad')│
└─────────────────┴─────────────────┴─────────────────┘
┌──────────────────────────────┬──────────────────────────────┐
│ Trending Topics              │ Methodology Distribution     │
│ (all tag.type)               │ (tag.type='Academic') ←WRONG │
└──────────────────────────────┴──────────────────────────────┘
```

### After (Proposed)

```
┌─────────────────┬─────────────────┬─────────────────┐
│ Total Research  │ Business        │ AI Technologies │
│ Base            │ Applications    │                 │
│                 │ (business-area) │ (ai-technology) │
└─────────────────┴─────────────────┴─────────────────┘
┌──────────────────────────────┬──────────────────────────────┐
│ AI Technology Distribution   │ Research Methodology         │
│ (category='ai-technology')   │ (category='methodology')     │
└──────────────────────────────┴──────────────────────────────┘
┌──────────────────────────────────────────────────────────────┐
│ Quick Insights: Risk Coverage | Regulatory | Quality | Fresh │
└──────────────────────────────────────────────────────────────┘
```

---

## 6. Implementation Priority

| Priority | Task | Effort |
|----------|------|--------|
| P0 | Fix `page.tsx` data queries to use `category` | 30 min |
| P0 | Update `stats-cards.tsx` with new card logic | 30 min |
| P0 | Fix `topic-chart.tsx` to show ai-technology | 15 min |
| P0 | Fix `methodology-chart.tsx` to show methodology | 15 min |
| P1 | Add insights row (optional) | 1 hour |
| P2 | Add click-through navigation to filtered Library views | 30 min |

**Total Estimated Effort**: 2-3 hours for P0 items

---

## 7. Open Questions for Review

1. **Card 2 Label**: "Business Applications" or "Banking Use Cases"?
2. **Card 3 Label**: "AI Technologies" or "Tech Trends"?
3. **Insights Row**: Include or defer to Phase 2?
4. **Click Actions**: Should cards link to filtered Library views or dedicated pages?
5. **Risk Radar**: Should we add a 4th stats card for Risk Coverage?

---

## 8. Approval Checklist

- [ ] Card labels approved
- [ ] Chart data sources confirmed
- [ ] Insights row inclusion decided
- [ ] Navigation behavior confirmed
- [ ] Ready to implement

---

**Next Steps**: Review and approve, then proceed with implementation.
