# Data Integrity Practices

**Version:** 1.0
**Scope:** Data safety, quality assurance, and project governance

---

## 1. Core Principles

Success cannot be claimed based on code completion alone. Data integrity, actual measurement, and honest gap analysis must precede any status reporting.

---

## 2. Data Safety & Integrity

### Destructive Operations Require Explicit Safeguards

**What Happened**: Automated systems created scripts that overwrote production data without checking for existing records.

**Lesson**: Never allow automated systems to create, modify, or delete data without:
1. Backup verification
2. Data existence check
3. Explicit approval
4. Rollback capability

**Prevention**: Mandatory backup before any data operation.

### Seed Scripts Are Dangerous in Production

**What Happened**: Seed scripts ran automatically and destroyed production data.

**Lesson**: Seed scripts must:
1. Check if data already exists before running
2. Use upsert (not create) for idempotent operations
3. Require explicit force flag in production
4. Never run automatically without confirmation

**Prevention**: Block all seed scripts in production; require manual review before any seed operation.

---

## 3. Quality Assurance & Verification

### Never Report Metrics Without Measurement

**What Happened**: Coverage metrics reported based on estimates rather than actual measurement.

**Lesson**: Always:
1. Run actual measurement tools
2. Read output files
3. Calculate real percentages from measured data
4. Report facts, not estimates

**Prevention**: Require coverage verification as mandatory step before any "target achieved" claim.

### Success Criteria Must Include User Outcomes

**What Happened**: Success reported based on code completion and API tests passing, but application was non-functional.

**Lesson**: Success criteria must include:
1. Application works end-to-end (not just API)
2. All data preserved and accessible
3. User can perform all previous actions
4. No regressions introduced

**Prevention**: Define exit criteria before starting work; verify against criteria before reporting completion.

---

## 4. Planning & Expectation Management

### Infrastructure Is Not a Working Feature

**What Happened**: Sources counted as "complete" because they existed in configuration, but none actually retrieved data.

**Lesson**: "Working" means:
1. Successfully retrieves data
2. Processes and stores correctly
3. Accessible to users
4. Not: "exists in database" or "has a configuration entry"

**Prevention**: Separate "infrastructure" from "functional" tracking; require end-to-end testing for "working" status.

### Stop Adding Features When Critical Gaps Exist

**What Happened**: New features added while critical sources were non-functional.

**Lesson**: Do not add new features until:
1. Critical gaps are closed
2. Existing features actually work
3. Value is delivered to users

**Prevention**: Gate new feature work on critical gap closure; honest gap analysis before each sprint.

---

## 5. Technical Implementation

### Automated Execution Requires Strict Controls

**What Happened**: Automated agents executed without backups, verification steps, rollback plans, or approval.

**Lesson**: Automated execution must have:
1. Pre-execution: backup, approval, scope definition
2. During execution: block destructive operations, require verification
3. Post-execution: data integrity check, application test, confirmation

**Prevention**: Never run automated agents on production data; always use staging first.

### External Dependencies Break Without Warning

**What Happened**: News sources and regulatory feeds became inaccessible due to protection mechanisms.

**Lesson**: External sources require:
1. Multiple fallback options
2. Regular health checks
3. Paid API alternatives identified
4. Proxy/scraping services for protected sites

**Prevention**: Implement source health monitoring; auto-disable failing sources after repeated attempts; maintain backup source list.

---

## 6. Checklists

### Before Starting Work

| Check | Action |
|-------|--------|
| Backup | Create database backup with timestamp |
| Baseline | Document current data counts |
| Scope | Define what will and won't be modified |
| Exit Criteria | Define "done" before starting |
| Approval | Get explicit confirmation |

### During Execution

| Check | Action | Red Flag |
|-------|--------|----------|
| Block Destructive Ops | Reject scripts that create/delete without safeguards | Seed scripts without upsert |
| Verify Data | Check integrity after major changes | Count mismatch, date anomalies |
| Test Incrementally | Test in browser after significant changes | Only testing via API |
| No Fabrication | Measure before claiming metrics | Estimates presented as facts |

### After Completion

| Check | Action | Failure Mode |
|-------|--------|--------------|
| Data Verification | Confirm all original data present | Missing records, corrupted fields |
| Application Test | Verify features work end-to-end | API works but UI broken |
| Regression Test | Ensure no previous functionality lost | New feature works, old broken |
| Measurement | Run actual measurement tools | Reporting estimates |
| Honest Assessment | Document what's NOT working | Claiming completion with gaps |

---

## 7. Red Flags & Warning Signs

### When to STOP and Reassess

| Red Flag | Meaning | Action |
|----------|---------|--------|
| "Success!" after code completion only | Not verified against user outcomes | Halt; test application end-to-end |
| Coverage claimed without running tool | Fabricated metrics | Run actual measurement |
| Database modified without backup | Data at risk | Stop immediately; create backup |
| "Fixing X, now check Y" cycle | Not addressing root cause | Step back; identify systemic issue |
| New features while critical gaps exist | Misplaced priorities | Freeze new features; close gaps |
| External sources all failing | No fallback strategy | Stop; develop alternative approach |

### Indicators of Problems

| Indicator | Severity | Response |
|-----------|----------|----------|
| Impossible date values | Critical | Database corruption; restore from backup |
| Record count drops unexpectedly | Critical | Data loss detected; stop all operations |
| API returns success but UI shows loading | High | Client-side failure; debug browser |
| Coverage claimed without measurement | Critical | Fabrication; measure actual coverage |
| Features marked complete but not tested end-to-end | High | False completion; verify functionality |

---

## 8. Action Items

### Process Improvements

| Improvement | Priority |
|-------------|----------|
| Mandatory backup step | Critical |
| "Infrastructure is not Working" tracking | High |
| Measurement-before-claiming protocol | Critical |
| Honest gap analysis template | High |
| Automated execution safety controls | Critical |

### Tool/Workflow Changes

| Change | Priority |
|--------|----------|
| Pre-flight checklist | Critical |
| Data integrity verification | Critical |
| External source monitoring | High |
| Test configuration validation | High |
| Staging environment | Medium |

---

**Remember:** The cost of preventing these issues is minimal. The cost of fixing them is catastrophic.
