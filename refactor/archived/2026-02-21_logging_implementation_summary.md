# Logging System Implementation Summary

**Date**: 2026-02-21
**Commit**: `72d4fe8`
**Status**: Complete

---

## 1. Background

之前系统没有文件日志，只输出到 console。导致问题排查时：
- 无法追溯 LLM 调用失败原因
- 无法查看收集过程中的详细操作
- 错误信息丢失

---

## 2. Design Decisions (User Confirmed)

| 问题 | 决定 |
|------|------|
| app.log 冗余 | B - 包含所有日志副本 |
| 旧文件处理 | C - 压缩后移到 archive/ |
| Archive 保留 | 180 天 |
| 单文件大小 | 50MB |
| 保留文件数 | 15 个/类别 |
| 命名格式 | `app-2026-02-21.log` |
| 分割方式 | 只按天分割 |
| Console 输出 | 仅开发环境 |
| 日志格式 | 纯文本（人类可读） |
| 敏感信息 | 自动脱敏 |

---

## 3. File Structure

```
logs/
├── app-2026-02-21.log           # 所有日志汇总
├── collection-2026-02-21.log    # 论文收集
├── llm-2026-02-21.log           # LLM 调用
├── api-2026-02-21.log           # API 请求
├── auth-2026-02-21.log          # 认证
├── config-2026-02-21.log        # 配置变更
├── error-2026-02-21.log         # 错误
└── archive/
    ├── app-2026-02-20.log.gz    # 压缩存档
    └── ...
```

---

## 4. Configuration

**File**: `config/logging.json`

```json
{
  "globalLevel": "info",
  "enableFileLogging": true,
  "enableConsoleLogging": true,
  "logDirectory": "logs",
  "maxFileSize": 52428800,
  "maxFiles": 15,
  "archiveDirectory": "logs/archive",
  "archiveRetentionDays": 180,
  "compressArchive": true,
  "sanitizeSensitive": true,
  "sensitiveFields": ["apiKey", "secret", "password", "accessToken", "refreshToken", "credential", "privateKey"],
  "files": {
    "app": { "enabled": true, "level": "info", "includeAll": true },
    "error": { "enabled": true, "level": "error" },
    "collection": { "enabled": true, "level": "debug" },
    "llm": { "enabled": true, "level": "debug" },
    "api": { "enabled": true, "level": "info" },
    "auth": { "enabled": true, "level": "info" },
    "config": { "enabled": true, "level": "info" }
  },
  "tagToFile": {
    "COLLECTION": "collection",
    "LLM": "llm",
    "API": "api",
    "AUTH": "auth",
    "CONFIG": "config",
    "ERROR": "error"
  }
}
```

---

## 5. Log Levels

| Level | Priority | 使用场景 |
|-------|----------|---------|
| ERROR | 0 | 系统错误、异常 |
| WARN | 1 | 警告、fallback 触发 |
| INFO | 2 | 关键操作 |
| DEBUG | 3 | 详细信息 |

---

## 6. API

### Basic Methods

```typescript
import { logger } from '@/lib/logger';

logger.error(message: string, context?: object): void
logger.warn(message: string, context?: object): void
logger.info(message: string, context?: object): void
logger.debug(message: string, context?: object): void
```

### Convenience Methods

```typescript
// API 日志
logger.logAPIRequest({ method, path, ip?, userAgent? })
logger.logAPIResponse({ method, path, status, duration })

// LLM 日志
logger.logLLMCall({
  provider, model, operation,
  inputTokens?, outputTokens?, duration, success, error?
})

// 配置变更
logger.logConfigChange({
  component, action: 'create' | 'update' | 'delete',
  details, user?
})

// 认证
logger.logAuth({
  action: 'login' | 'logout' | 'session_expired' | 'login_failed',
  user?, ip?, reason?
})

// 收集摘要
logger.logCollectionSummary({ mode, query, totalFound, duplicates, saved, duration, optimizedQuery? })
logger.logPaperDetails({ title, relevanceScore, technicalScore, businessScore, timelinessScore, practicalityScore, tags, source })
```

---

## 7. Tag-Based Routing

日志自动根据 message 中的 `[TAG]` 路由到对应文件：

```typescript
logger.info('[COLLECTION] Paper saved', {...})  // → collection.log
logger.debug('[LLM] API call', {...})           // → llm.log
logger.error('[ERROR] Database failed', {...})  // → error.log
logger.info('[UNKNOWN] Something', {...})        // → app.log (default)
```

---

## 8. Log Format

```
[2026-02-21 00:10:07.123] [INFO ] [COLLECTION] Paper saved
  title: SecMLOps: A Comprehensive Framework...
  source: ArXiv
  scores:
    relevance: 7.14
    technical: 9
    business: 4
    timeliness: 9
    practicality: 8
  tags: [computer-vision, fraud-detection, adversarial-attacks, machine-learning, security]
```

---

## 9. Sensitive Data Sanitization

自动脱敏的字段：
- `apiKey` → `abcd...efgh`
- `secret` → `***REDACTED***`
- `password` → `***REDACTED***`
- `accessToken` → `abcd...efgh`
- 等

---

## 10. File Rotation

### Size-based Rotation
- 单文件超过 50MB → 压缩后移到 archive/
- 命名：`app-2026-02-21-001.log.gz`

### Count-based Rotation
- 每个 category 超过 15 个文件 → 最旧的移到 archive/
- Archive 保留 180 天后删除

---

## 11. Environment Behavior

| 环境 | Console | File |
|------|---------|------|
| Development (`npm run dev`) | ✅ 输出 | ✅ 写入 |
| Production (`npm run start`) | ❌ 不输出 | ✅ 写入 |

---

## 12. Extensibility

添加新的日志类别：

1. 修改 `config/logging.json`：
```json
{
  "files": {
    "newsletter": { "enabled": true, "level": "info" }
  },
  "tagToFile": {
    "NEWSLETTER": "newsletter"
  }
}
```

2. 代码中使用：
```typescript
logger.info('[NEWSLETTER] Email sent', { recipient: '...' })
```

---

## 13. Known Issues

### 2026-02-21 Auto Collection Fallback Analysis

在 2026-02-21 的自动收集中，20 篇论文有 8 篇走了 Content Assessment fallback。

**可能原因：**
1. **Rate Limit** - batchSize=5 并发请求可能触发 Groq rate limit
2. **JSON 解析失败** - LLM 返回格式问题
3. **网络超时** - 并发请求超时

**排查方法：**
现在有了日志系统，下次收集可以在 `logs/llm-*.log` 和 `logs/collection-*.log` 中看到具体失败原因。

---

## 14. Files Changed

| File | Change |
|------|--------|
| `config/logging.json` | 新增 - 日志配置 |
| `src/lib/logger.ts` | 重写 - 完整日志系统 |
| `logs/.gitignore` | 新增 - 忽略日志文件 |
| `logs/.gitkeep` | 新增 - 保留目录 |
| `logs/archive/.gitkeep` | 新增 - 保留 archive 目录 |

---

*Document created: 2026-02-21*
