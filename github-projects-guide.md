# GitHub Projects 管理手册

> Research Copilot 项目管理指南 — 随时查阅

## 1. 核心概念

### Issue 层级结构

```
Epic (Parent Issue) — 大功能模块，如 "Chat System v2"
├── Story/Task (Issue) — 可独立交付的功能点
│   └── Sub-issue — 更细的拆分（可选）
├── Story/Task (Issue)
└── Bug (Issue + bug label)

Milestone — 版本/阶段目标，如 "v1.1"
Label — 分类标签，如 area:chat, area:rag, enhancement
```

### 与 Jira 的对照

| Jira | GitHub | 说明 |
|------|--------|------|
| Epic | Parent Issue | 大 Issue，通过 `Parent issue` 字段关联子 Issue |
| Story | Issue | 普通功能开发 |
| Task | Issue | 技术任务 |
| Bug | Issue + `bug` label | 缺陷 |
| Sub-task | Sub-issue | 嵌套子任务 |
| Sprint | Milestone | 版本/迭代目标 |
| Board | Project Board | 状态流转看板 |
| Priority | Priority 字段 | P0 / P1 / P2 |
| Story Points | Size + Estimate | XS/S/M/L/XL + 数字 |

### Project Board 字段说明

| 字段 | 用途 | 取值 |
|------|------|------|
| Status | 工作流状态 | Backlog → Ready → In progress → In review → Done |
| Priority | 优先级 | P0 (紧急) / P1 (高) / P2 (中) |
| Size | 工作量估计 | XS (<1h) / S (1-2h) / M (half day) / L (1-2 days) / XL (3+ days) |
| Estimate | 数字化估时 | 可选，配合 Size 使用 |
| Start date | 开始日期 | 可选 |
| Target date | 截止日期 | 可选 |
| Milestone | 所属版本 | 通过 Issue 的 Milestone 关联 |
| Parent issue | 父级 Epic | 关联到上层 Issue |

---

## 2. 工作流程

### 标准开发流程

```
1. 创建 Issue → 自动进入 Board 的 Backlog
2. 评估 Priority + Size → 移到 Ready
3. 开始开发 → 移到 In progress
4. 开 PR → 移到 In review
5. PR 合并 → 移到 Done + Issue 自动关闭
```

### 详细的本地 ↔ GitHub 联动

```
┌─────────────────────────────────────────────────────────┐
│  Step 1: 创建 Issue (本地或 GitHub)                      │
│  gh issue create --title "..." --project "Research Copilot" │
│  → Issue 出现在 Board 的 Backlog 列                      │
├─────────────────────────────────────────────────────────┤
│  Step 2: 本地创建分支                                    │
│  git checkout -b feat/issue-123-short-description        │
│  → 分支名关联 Issue 编号，方便追溯                        │
├─────────────────────────────────────────────────────────┤
│  Step 3: 本地开发 + 提交                                 │
│  git commit -m "feat: add X (#123)"                      │
│  → commit message 中的 #123 会显示在 Issue timeline 中    │
├─────────────────────────────────────────────────────────┤
│  Step 4: 推送 + 创建 PR                                  │
│  git push -u origin feat/issue-123-...                   │
│  gh pr create --title "feat: add X" --body "Closes #123" │
│  → PR 关联 Issue，合并后自动关闭 Issue                    │
├─────────────────────────────────────────────────────────┤
│  Step 5: Code Review + 合并                              │
│  gh pr merge 123                                         │
│  → Issue 自动关闭，Board card 可自动移到 Done             │
└─────────────────────────────────────────────────────────┘
```

---

## 3. 常用命令速查

### Issue 管理

```bash
# 创建 Issue 并加到 Project
gh issue create -R AIScorpio/research-copilot \
  --title "Optimize RAG prompt for multi-turn" \
  --body "## Goal\nImprove citation dedup and contextual transitions" \
  --label "enhancement" \
  --project "Research Copilot"

# 创建 Epic（Parent Issue）
gh issue create -R AIScorpio/research-copilot \
  --title "Epic: Chat System v2" \
  --body "## Scope\n- Prompt optimization\n- Session management\n- Streaming" \
  --label "enhancement" \
  --project "Research Copilot"

# 创建 Sub-issue（需要 GraphQL，或通过 GitHub Web UI）
# 在 GitHub Issue 页面右侧栏 → "Sub-issues" → "Create sub-issue"

# 列出所有 Issue
gh issue list -R AIScorpio/research-copilot --state open

# 查看 Issue 详情
gh issue view 123 -R AIScorpio/research-copilot

# 关闭 Issue
gh issue close 123 -R AIScorpio/research-copilot
```

### PR 管理

```bash
# 创建 PR 并关联 Issue
gh pr create -R AIScorpio/research-copilot \
  --title "feat: optimize RAG prompt" \
  --body "Closes #123\n\n## Changes\n- Added multi-turn citation rules\n- Conditional prefix" \
  --base main \
  --head feat/issue-123-prompt-opt

# 查看 PR 列表
gh pr list -R AIScorpio/research-copilot

# 合并 PR
gh pr merge 456 --squash
```

### Project Board 操作

```bash
# 列出 Project Items
gh project item-list 1 --owner AIScorpio --format json

# 更新 Item 的 Status
gh project item-edit --id <ITEM_ID> --project-id PVT_kwHOBoR2G84BU4N4 \
  --field-id PVTSSF_lAHOBoR2G84BU4N4zhIJ3W4 \
  --single-select-option-id 47fc9ee4
  # Status options: Backlog=f75ad846, Ready=61e4505c, In progress=47fc9ee4,
  #                 In review=df73e18b, Done=98236657

# 更新 Priority
gh project item-edit --id <ITEM_ID> --project-id PVT_kwHOBoR2G84BU4N4 \
  --field-id PVTSSF_lAHOBoR2G84BU4N4zhIKGmQ \
  --single-select-option-id 79628723
  # Priority options: P0=79628723, P1=0a877460, P2=da944a9c

# 更新 Size
gh project item-edit --id <ITEM_ID> --project-id PVT_kwHOBoR2G84BU4N4 \
  --field-id PVTSSF_lAHOBoR2G84BU4N4zhIKGmw \
  --single-select-option-id 7515a9f1
  # Size options: XS=6c6483d2, S=f784b110, M=7515a9f1, L=817d0097, XL=db339eb2
```

### Commit 规范

```bash
# 格式: <type>: <description> (#issue-number)
git commit -m "feat: add multi-turn citation dedup (#123)"
git commit -m "fix: catch rate limiter errors gracefully (#124)"
git commit -m "refactor: split llm-service into modular files (#125)"
git commit -m "docs: add chat API guide"
git commit -m "chore: trigger redeploy for CORS config"

# Type 枚举:
# feat     — 新功能
# fix      — 修复 bug
# refactor — 重构（不改功能）
# docs     — 文档
# test     — 测试
# chore    — 构建/配置/部署
```

### 分支命名规范

```bash
feat/issue-<number>-<short-description>   # 功能开发
fix/issue-<number>-<short-description>    # Bug 修复
refactor/issue-<number>-<description>     # 重构

# 示例:
feat/issue-1-prompt-optimization
fix/issue-2-rate-limiter-crash
refactor/issue-3-llm-service-split
```

---

## 4. 标签体系

建议在 GitHub 默认标签基础上增加领域标签：

```bash
# 创建自定义标签
gh label create "area:chat" -R AIScorpio/research-copilot --color "#1D76DB" --description "Chat & RAG system"
gh label create "area:rag" -R AIScorpio/research-copilot --color "#0E8A16" --description "RAG pipeline & corpus"
gh label create "area:collection" -R AIScorpio/research-copilot --color "#5319E7" --description "Paper collection pipeline"
gh label create "area:export" -R AIScorpio/research-copilot --color "#BFD4F2" --description "Digest, PPT, social export"
gh label create "area:infra" -R AIScorpio/research-copilot --color "#FBCA04" --description "Infrastructure, DB, auth"
gh label create "area:ui" -R AIScorpio/research-copilot --color "#C5DEF5" --description "Frontend UI components"
```

---

## 5. 自动化配置

在 GitHub Project 网页端设置：

**Settings → Workflows（内置自动化）：**

| Workflow | 建议开启 | 效果 |
|----------|---------|------|
| Item added to project | ✅ | Issue 创建时自动加入 Board |
| Item reopened | ✅ | Issue 重开时移回 In progress |
| Pull request merged | ✅ | PR 合并后关闭关联 Issue |

配置路径：https://github.com/users/AIScorpio/projects/1/settings/workflows

---

## 6. Claude 可以帮你做的事

在 Claude Code 会话中，你可以让我：

- "创建一个 Issue：..." → 我执行 `gh issue create`
- "把这个 Issue 标为 P0" → 我执行 `gh project item-edit`
- "看看当前 Board 状态" → 我执行 `gh project item-list`
- "把当前改动提交并关联 Issue #3" → 我执行 git commit + push
- "创建 PR 合并这个分支" → 我执行 `gh pr create`
- "规划一下 v1.1 的 Milestone" → 我帮你拆解 Epic → Stories → Issues

---

## 7. 快速参考 Card

```
Project ID:  PVT_kwHOBoR2G84BU4N4
Project URL: https://github.com/users/AIScorpio/projects/1
Repo:        AIScorpio/research-copilot

Status Field ID:    PVTSSF_lAHOBoR2G84BU4N4zhIJ3W4
Priority Field ID:  PVTSSF_lAHOBoR2G84BU4N4zhIKGmQ
Size Field ID:      PVTSSF_lAHOBoR2G84BU4N4zhIKGmw

Status Options:
  Backlog     = f75ad846
  Ready       = 61e4505c
  In progress = 47fc9ee4
  In review   = df73e18b
  Done        = 98236657

Priority Options:
  P0 = 79628723
  P1 = 0a877460
  P2 = da944a9c

Size Options:
  XS = 6c6483d2
  S  = f784b110
  M  = 7515a9f1
  L  = 817d0097
  XL = db339eb2
```
