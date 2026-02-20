# Session State - 2026-02-17

## Goal
Optimize research paper collection for banking AI copilot.

## Completed
- Collection config system (`config/collection.json`, API, UI)
- ArXiv date filtering via `submittedDate` parameter
- Category aliases (`model-risk`, `predictive-modeling`)
- tagSuggestion prompt with methodology requirement
- Git commit: `c53cbf1`

## Pending Fix: ArXiv Query Format

### Problem
LLM generates complex Boolean queries that ArXiv cannot parse:
- Query: `(artificial intelligence OR machine learning) AND (HSBC OR "global banking")...`
- ArXiv interprets spaces as OR, produces wrong results (0 papers)

### Solution
Modify `searchArxiv()` in `src/lib/collector.ts`:
1. Extract generic banking/AI keywords from LLM query
2. Filter out bank-specific terms (HSBC, CIB, etc.)
3. Convert to `all:term+AND+all:term` format
4. Use `sortBy=relevance`

### Test Results
| Query | Date Range | Results |
|-------|------------|---------|
| banking+risk | 14 days | 5 papers |
| banking+risk | 90 days | 39 papers |
| credit+risk | 14 days | 7 papers |
| fraud+detection | 14 days | 9 papers |
| machine+learning+banking+risk | 14 days | 0 papers |

### Key Files
- `src/lib/collector.ts` - searchArxiv() function (lines 77-151)
- `src/lib/collection-service.ts` - collection orchestration
- `config/collection.json` - collection parameters

## Notes
- Both auto and pipeline modes use searchArxiv()
- Fix applies to both modes automatically
- ArXiv is academic - no bank-specific papers (HSBC, CIB)
