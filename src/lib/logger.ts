import { join } from 'path';
import { existsSync, mkdirSync, statSync, readdirSync, renameSync, unlinkSync, writeFileSync, appendFileSync, readFileSync } from 'fs';
import { createGzip, gunzipSync } from 'zlib';

type LogLevel = 'error' | 'warn' | 'info' | 'debug';

interface LogConfig {
  globalLevel: LogLevel;
  enableFileLogging: boolean;
  enableConsoleLogging: boolean;
  logDirectory: string;
  maxFileSize: number;
  maxFiles: number;
  archiveDirectory: string;
  archiveRetentionDays: number;
  compressArchive: boolean;
  sanitizeSensitive: boolean;
  sensitiveFields: string[];
  files: Record<string, { enabled: boolean; level: LogLevel; includeAll?: boolean }>;
  tagToFile: Record<string, string>;
}

interface LogEntry {
  level: LogLevel;
  tag: string;
  message: string;
  context?: Record<string, any>;
  timestamp: Date;
}

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3
};

class Logger {
  private config: LogConfig;
  private configPath: string;
  private isDevelopment: boolean;
  private fileHandles: Map<string, string> = new Map();
  private lastCheckTime: Map<string, number> = new Map();
  private checkInterval: number = 60000;

  constructor() {
    this.isDevelopment = process.env.NODE_ENV !== 'production';
    this.configPath = join(process.cwd(), 'config', 'logging.json');
    this.config = this.loadConfig();
    // Only ensure directories if file logging is enabled and we're not in a serverless environment
    if (this.config.enableFileLogging && !process.env.VERCEL) {
      this.ensureDirectories();
      this.scheduleArchiveCleanup();
    }
  }

  private loadConfig(): LogConfig {
    // Disable file logging on Vercel (serverless environment has read-only filesystem)
    const isVercel = process.env.VERCEL === '1' || process.env.VERCEL === 'true';
    const defaultConfig: LogConfig = {
      globalLevel: 'info',
      enableFileLogging: !isVercel,
      enableConsoleLogging: true,
      logDirectory: 'logs',
      maxFileSize: 52428800,
      maxFiles: 15,
      archiveDirectory: 'logs/archive',
      archiveRetentionDays: 180,
      compressArchive: true,
      sanitizeSensitive: true,
      sensitiveFields: ['apiKey', 'secret', 'password', 'token', 'credential'],
      files: {
        app: { enabled: true, level: 'info', includeAll: true },
        error: { enabled: true, level: 'error' },
        collection: { enabled: true, level: 'debug' },
        llm: { enabled: true, level: 'debug' },
        api: { enabled: true, level: 'info' },
        auth: { enabled: true, level: 'info' },
        config: { enabled: true, level: 'info' }
      },
      tagToFile: {
        COLLECTION: 'collection',
        LLM: 'llm',
        API: 'api',
        AUTH: 'auth',
        CONFIG: 'config',
        ERROR: 'error'
      }
    };

    try {
      if (existsSync(this.configPath)) {
        const fileContent = readFileSync(this.configPath, 'utf-8');
        const loadedConfig = JSON.parse(fileContent);
        // Force disable file logging on Vercel regardless of config file
        if (isVercel) {
          loadedConfig.enableFileLogging = false;
        }
        return { ...defaultConfig, ...loadedConfig };
      }
    } catch (error) {
      console.error('[LOGGER] Failed to load config, using defaults:', error);
    }

    return defaultConfig;
  }

  private ensureDirectories(): void {
    if (!this.config.enableFileLogging) return;

    const logDir = join(process.cwd(), this.config.logDirectory);
    if (!existsSync(logDir)) {
      mkdirSync(logDir, { recursive: true });
    }

    const archiveDir = join(process.cwd(), this.config.archiveDirectory);
    if (!existsSync(archiveDir)) {
      mkdirSync(archiveDir, { recursive: true });
    }
  }

  private getLogFilePath(fileKey: string): string {
    const date = new Date().toISOString().split('T')[0];
    const filename = `${fileKey}-${date}.log`;
    return join(process.cwd(), this.config.logDirectory, filename);
  }

  private formatTimestamp(date: Date): string {
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${(date.getMilliseconds()).toString().padStart(3, '0')}`;
  }

  private sanitizeContext(context?: Record<string, any>): Record<string, any> | undefined {
    if (!context || !this.config.sanitizeSensitive) return context;

    const sanitized: Record<string, any> = {};
    
    for (const [key, value] of Object.entries(context)) {
      if (this.config.sensitiveFields.some(field => 
        key.toLowerCase().includes(field.toLowerCase())
      )) {
        if (typeof value === 'string' && value.length > 8) {
          sanitized[key] = `${value.substring(0, 4)}...${value.substring(value.length - 4)}`;
        } else {
          sanitized[key] = '***REDACTED***';
        }
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitizeContext(value);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  private formatContext(context?: Record<string, any>): string {
    if (!context || Object.keys(context).length === 0) return '';
    
    const sanitized = this.sanitizeContext(context);
    const lines: string[] = [];
    
    const formatValue = (val: any, indent: string = '  '): string => {
      if (typeof val === 'object' && val !== null) {
        const entries = Object.entries(val);
        if (entries.length === 0) return '{}';
        return '\n' + entries.map(([k, v]) => 
          `${indent}${k}: ${typeof v === 'object' && v !== null ? formatValue(v, indent + '  ') : v}`
        ).join('\n');
      }
      return String(val);
    };

    for (const [key, value] of Object.entries(sanitized || {})) {
      if (typeof value === 'object' && value !== null) {
        lines.push(`  ${key}:${formatValue(value, '  ')}`);
      } else {
        lines.push(`  ${key}: ${value}`);
      }
    }

    return '\n' + lines.join('\n');
  }

  private extractTag(message: string): string {
    const match = message.match(/^\[([A-Z_-]+)\]/);
    return match ? match[1] : 'APP';
  }

  private shouldLog(level: LogLevel, fileLevel: LogLevel): boolean {
    return LEVEL_PRIORITY[level] <= LEVEL_PRIORITY[fileLevel];
  }

  private async checkFileRotation(filePath: string, fileKey: string): Promise<void> {
    const now = Date.now();
    const lastCheck = this.lastCheckTime.get(fileKey) || 0;
    
    if (now - lastCheck < this.checkInterval) return;
    this.lastCheckTime.set(fileKey, now);

    try {
      if (!existsSync(filePath)) return;
      
      const stats = statSync(filePath);
      if (stats.size >= this.config.maxFileSize) {
        await this.rotateFile(filePath, fileKey);
      }

      await this.cleanupOldFiles(fileKey);
    } catch (error) {
      console.error(`[LOGGER] Rotation check failed for ${fileKey}:`, error);
    }
  }

  private async rotateFile(filePath: string, fileKey: string): Promise<void> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const rotatedName = `${fileKey}-${timestamp}.log`;
    const archivePath = join(process.cwd(), this.config.archiveDirectory, rotatedName);

    try {
      if (this.config.compressArchive) {
        await this.compressFile(filePath, archivePath + '.gz');
      } else {
        renameSync(filePath, archivePath);
      }
    } catch (error) {
      console.error(`[LOGGER] Failed to rotate ${filePath}:`, error);
    }
  }

  private async compressFile(sourcePath: string, targetPath: string): Promise<void> {
    const { createReadStream, createWriteStream } = await import('fs');
    
    return new Promise((resolve, reject) => {
      const gzip = createGzip();
      const source = createReadStream(sourcePath);
      const target = createWriteStream(targetPath);

      source.pipe(gzip).pipe(target);

      target.on('finish', () => {
        unlinkSync(sourcePath);
        resolve();
      });

      target.on('error', reject);
    });
  }

  private async cleanupOldFiles(fileKey: string): Promise<void> {
    const logDir = join(process.cwd(), this.config.logDirectory);
    const files = readdirSync(logDir)
      .filter(f => f.startsWith(fileKey + '-') && f.endsWith('.log'))
      .map(f => ({
        name: f,
        path: join(logDir, f),
        time: statSync(join(logDir, f)).mtime.getTime()
      }))
      .sort((a, b) => b.time - a.time);

    if (files.length > this.config.maxFiles) {
      const toArchive = files.slice(this.config.maxFiles);
      for (const file of toArchive) {
        try {
          const archivePath = join(process.cwd(), this.config.archiveDirectory, file.name);
          if (this.config.compressArchive) {
            await this.compressFile(file.path, archivePath + '.gz');
          } else {
            renameSync(file.path, archivePath);
          }
        } catch (error) {
          console.error(`[LOGGER] Failed to archive ${file.name}:`, error);
        }
      }
    }
  }

  private scheduleArchiveCleanup(): void {
    const cleanup = () => {
      const archiveDir = join(process.cwd(), this.config.archiveDirectory);
      if (!existsSync(archiveDir)) return;

      const now = Date.now();
      const retentionMs = this.config.archiveRetentionDays * 24 * 60 * 60 * 1000;

      const files = readdirSync(archiveDir);
      for (const file of files) {
        const filePath = join(archiveDir, file);
        try {
          const stats = statSync(filePath);
          if (now - stats.mtime.getTime() > retentionMs) {
            unlinkSync(filePath);
            console.log(`[LOGGER] Deleted old archive: ${file}`);
          }
        } catch (error) {
          console.error(`[LOGGER] Failed to check/delete ${file}:`, error);
        }
      }
    };

    cleanup();
    setInterval(cleanup, 24 * 60 * 60 * 1000);
  }

  private writeToFile(fileKey: string, entry: LogEntry): void {
    if (!this.config.enableFileLogging) return;

    const fileConfig = this.config.files[fileKey];
    if (!fileConfig || !fileConfig.enabled) return;
    if (!this.shouldLog(entry.level, fileConfig.level)) return;

    const filePath = this.getLogFilePath(fileKey);
    
    this.checkFileRotation(filePath, fileKey).catch(console.error);

    const timestamp = this.formatTimestamp(entry.timestamp);
    const levelStr = entry.level.toUpperCase().padEnd(5);
    const contextStr = this.formatContext(entry.context);

    const logLine = `[${timestamp}] [${levelStr}] ${entry.message}${contextStr}\n`;

    try {
      appendFileSync(filePath, logLine, 'utf-8');
    } catch (error) {
      console.error(`[LOGGER] Failed to write to ${fileKey}:`, error);
    }
  }

  private writeToConsole(entry: LogEntry): void {
    if (!this.config.enableConsoleLogging) return;
    // Console logging enabled for all environments (including Vercel)
    if (!this.shouldLog(entry.level, this.config.globalLevel)) return;

    const timestamp = this.formatTimestamp(entry.timestamp);
    const prefix = `[${entry.level.toUpperCase()}] ${timestamp}`;
    const contextStr = this.formatContext(entry.context);

    const output = `${prefix} ${entry.message}${contextStr}`;

    switch (entry.level) {
      case 'error':
        console.error(output);
        break;
      case 'warn':
        console.warn(output);
        break;
      case 'info':
        console.info(output);
        break;
      case 'debug':
        console.debug(output);
        break;
    }
  }

  private log(level: LogLevel, message: string, context?: Record<string, any>): void {
    const entry: LogEntry = {
      level,
      tag: this.extractTag(message),
      message,
      context,
      timestamp: new Date()
    };

    // Only write to file if file logging is enabled
    if (this.config.enableFileLogging) {
      const targetFile = this.config.tagToFile[entry.tag] || 'app';

      this.writeToFile(targetFile, entry);

      if (this.config.files.app?.includeAll && targetFile !== 'app') {
        this.writeToFile('app', entry);
      }

      if (level === 'error' && targetFile !== 'error') {
        this.writeToFile('error', entry);
      }
    }

    this.writeToConsole(entry);
  }

  error(message: string, context?: Record<string, any>): void {
    this.log('error', message, context);
  }

  warn(message: string, context?: Record<string, any>): void {
    this.log('warn', message, context);
  }

  info(message: string, context?: Record<string, any>): void {
    this.log('info', message, context);
  }

  debug(message: string, context?: Record<string, any>): void {
    this.log('debug', message, context);
  }

  logCollectionSummary(params: {
    mode: string;
    query: string;
    totalFound: number;
    duplicates: number;
    saved: number;
    duration: number;
    optimizedQuery?: string;
  }): void {
    const { mode, query, totalFound, duplicates, saved, duration, optimizedQuery } = params;
    
    const summary = `
================================================================================
[LOG] COLLECTION SUMMARY
================================================================================
  Mode:           ${mode}
  Query:          ${query}
  Found:          ${totalFound} papers
  Duplicates:     ${duplicates} papers
  Saved:          ${saved} papers
  Duration:       ${(duration / 1000).toFixed(2)}s
  Optimized:      ${optimizedQuery ? optimizedQuery.substring(0, 60) + '...' : 'N/A'}
================================================================================
`;
    console.log(summary);
    
    this.info('[COLLECTION] Summary', {
      mode,
      query,
      totalFound,
      duplicates,
      saved,
      duration: `${(duration / 1000).toFixed(2)}s`,
      optimizedQuery: optimizedQuery?.substring(0, 100)
    });
  }

  logPaperDetails(params: {
    title: string;
    relevanceScore: number;
    technicalScore: number;
    businessScore: number;
    timelinessScore: number;
    practicalityScore: number;
    tags: string[];
    source: string;
  }): void {
    const { title, relevanceScore, technicalScore, businessScore, timelinessScore, practicalityScore, tags, source } = params;
    
    console.log(`[DETAILS] PAPER SAVED
  Title:          ${title.substring(0, 60)}${title.length > 60 ? '...' : ''}
  Source:         ${source}
  Relevance:      ${relevanceScore.toFixed(1)}/10
  Technical:      ${technicalScore.toFixed(1)}/10
  Business:       ${businessScore.toFixed(1)}/10
  Timeliness:     ${timelinessScore.toFixed(1)}/10
  Practicality:   ${practicalityScore.toFixed(1)}/10
  Tags:           [${tags.join(', ')}]
`);

    this.info('[COLLECTION] Paper saved', {
      title: title.substring(0, 80),
      source,
      scores: {
        relevance: relevanceScore.toFixed(2),
        technical: technicalScore,
        business: businessScore,
        timeliness: timelinessScore,
        practicality: practicalityScore
      },
      tags
    });
  }

  logAPIRequest(params: {
    method: string;
    path: string;
    ip?: string;
    userAgent?: string;
  }): void {
    this.info('[API] Request', {
      method: params.method,
      path: params.path,
      ip: params.ip || 'unknown',
      userAgent: params.userAgent?.substring(0, 50)
    });
  }

  logAPIResponse(params: {
    method: string;
    path: string;
    status: number;
    duration: number;
  }): void {
    this.info('[API] Response', {
      method: params.method,
      path: params.path,
      status: params.status,
      duration: `${params.duration}ms`
    });
  }

  logLLMCall(params: {
    provider: string;
    model: string;
    operation: string;
    inputTokens?: number;
    outputTokens?: number;
    duration: number;
    success: boolean;
    error?: string;
  }): void {
    if (params.success) {
      this.debug('[LLM] API call', {
        provider: params.provider,
        model: params.model,
        operation: params.operation,
        tokens: params.inputTokens && params.outputTokens 
          ? { input: params.inputTokens, output: params.outputTokens }
          : undefined,
        duration: `${params.duration}ms`
      });
    } else {
      this.warn('[LLM] API call failed', {
        provider: params.provider,
        model: params.model,
        operation: params.operation,
        error: params.error,
        duration: `${params.duration}ms`
      });
    }
  }

  logConfigChange(params: {
    component: string;
    action: 'create' | 'update' | 'delete';
    details: Record<string, any>;
    user?: string;
  }): void {
    this.info('[CONFIG] Change', {
      component: params.component,
      action: params.action,
      user: params.user || 'system',
      details: params.details
    });
  }

  logAuth(params: {
    action: 'login' | 'logout' | 'session_expired' | 'login_failed';
    user?: string;
    ip?: string;
    reason?: string;
  }): void {
    if (params.action === 'login_failed') {
      this.warn('[AUTH] Login failed', {
        user: params.user,
        ip: params.ip,
        reason: params.reason
      });
    } else {
      this.info('[AUTH] ' + params.action, {
        user: params.user,
        ip: params.ip
      });
    }
  }

  reloadConfig(): void {
    this.config = this.loadConfig();
    this.info('[LOGGER] Config reloaded');
  }
}

export const logger = new Logger();
export default logger;
