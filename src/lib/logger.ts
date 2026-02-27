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
  private isBrowser: boolean;
  private fileHandles: Map<string, string> = new Map();
  private lastCheckTime: Map<string, number> = new Map();
  private checkInterval: number = 60000;
  private fsModule: any = null;
  private pathModule: any = null;
  private zlibModule: any = null;

  constructor() {
    this.isDevelopment = process.env.NODE_ENV !== 'production';
    this.isBrowser = typeof window !== 'undefined';
    this.configPath = this.isBrowser ? '' : `${process.cwd()}/config/logging.json`;
    this.config = this.loadConfig();
    
    // Only setup file logging in server environment
    if (!this.isBrowser && this.config.enableFileLogging && !process.env.VERCEL) {
      this.loadNodeModules().then(() => {
        this.ensureDirectories();
        this.scheduleArchiveCleanup();
      });
    }
  }

  private async loadNodeModules(): Promise<void> {
    if (this.isBrowser) return;
    
    try {
      this.fsModule = await import('fs');
      this.pathModule = await import('path');
      this.zlibModule = await import('zlib');
    } catch (error) {
      // Node modules not available (browser environment)
      this.fsModule = null;
      this.pathModule = null;
      this.zlibModule = null;
    }
  }

  private loadConfig(): LogConfig {
    // Browser environment: minimal config
    if (this.isBrowser) {
      return {
        globalLevel: 'info',
        enableFileLogging: false,
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
    }

    // Server environment: load from config file
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

    if (this.isBrowser) {
      return defaultConfig;
    }

    try {
      // Dynamic import for server-side only
      const fs = require('fs');
      if (fs.existsSync(this.configPath)) {
        const fileContent = fs.readFileSync(this.configPath, 'utf-8');
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
    if (this.isBrowser || !this.config.enableFileLogging || !this.fsModule) return;

    const logDir = this.pathModule.join(process.cwd(), this.config.logDirectory);
    if (!this.fsModule.existsSync(logDir)) {
      this.fsModule.mkdirSync(logDir, { recursive: true });
    }

    const archiveDir = this.pathModule.join(process.cwd(), this.config.archiveDirectory);
    if (!this.fsModule.existsSync(archiveDir)) {
      this.fsModule.mkdirSync(archiveDir, { recursive: true });
    }
  }

  private getLogFilePath(fileKey: string): string {
    if (!this.pathModule) return '';
    const date = new Date().toISOString().split('T')[0];
    const filename = `${fileKey}-${date}.log`;
    return this.pathModule.join(process.cwd(), this.config.logDirectory, filename);
  }

  private formatTimestamp(date: Date): string {
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${(date.getMilliseconds()).toString().padStart(3, '0')}`;
  }

  private sanitizeContext(context?: Record<string, any>): Record<string, any> | undefined {
    if (!context || !this.config.sanitizeSensitive) return context;

    const sanitized: Record<string, any> = {};
    
    for (const [key, value] of Object.entries(context || {})) {
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
    if (!sanitized) return '';
    
    return ' | ' + Object.entries(sanitized)
      .map(([key, value]) => {
        if (typeof value === 'object') {
          return `${key}=${JSON.stringify(value)}`;
        }
        return `${key}=${value}`;
      })
      .join(' | ');
  }

  private shouldLog(level: LogLevel, minLevel: LogLevel): boolean {
    return LEVEL_PRIORITY[level] <= LEVEL_PRIORITY[minLevel];
  }

  private getTagFromMessage(message: string): string {
    const match = message.match(/^\[([^\]]+)\]/);
    return match ? match[1] : 'app';
  }

  private async checkFileRotation(filePath: string, fileKey: string): Promise<void> {
    if (this.isBrowser || !this.fsModule) return;
    
    const now = Date.now();
    const lastCheck = this.lastCheckTime.get(fileKey) || 0;
    
    if (now - lastCheck < this.checkInterval) return;
    
    this.lastCheckTime.set(fileKey, now);
    
    try {
      if (this.fsModule.existsSync(filePath)) {
        const stats = this.fsModule.statSync(filePath);
        if (stats.size > this.config.maxFileSize) {
          await this.rotateFile(filePath, fileKey);
        }
      }
    } catch (error) {
      // Silent fail for rotation errors
    }
  }

  private async rotateFile(filePath: string, fileKey: string): Promise<void> {
    if (this.isBrowser || !this.fsModule) return;
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const archivedName = `${fileKey}-${timestamp}.log`;
    const archivePath = this.pathModule.join(process.cwd(), this.config.archiveDirectory, archivedName);
    
    try {
      this.fsModule.renameSync(filePath, archivePath);
      
      if (this.config.compressArchive) {
        const compressedPath = `${archivePath}.gz`;
        await this.compressFile(archivePath, compressedPath);
        this.fsModule.unlinkSync(archivePath);
      }
      
      this.cleanOldArchives();
    } catch (error) {
      // Silent fail for rotation errors
    }
  }

  private async compressFile(sourcePath: string, targetPath: string): Promise<void> {
    if (this.isBrowser || !this.zlibModule) return;
    
    const { createGzip } = this.zlibModule;
    const { createReadStream, createWriteStream } = this.fsModule;
    
    return new Promise((resolve, reject) => {
      const gzip = createGzip();
      const source = createReadStream(sourcePath);
      const target = createWriteStream(targetPath);
      
      source.pipe(gzip).pipe(target);
      
      target.on('finish', resolve);
      target.on('error', reject);
    });
  }

  private cleanOldArchives(): void {
    if (this.isBrowser || !this.fsModule) return;
    
    const archiveDir = this.pathModule.join(process.cwd(), this.config.archiveDirectory);
    if (!this.fsModule.existsSync(archiveDir)) return;

    const now = Date.now();
    const retentionMs = this.config.archiveRetentionDays * 24 * 60 * 60 * 1000;

    const files = this.fsModule.readdirSync(archiveDir);
    for (const file of files) {
      const filePath = this.pathModule.join(archiveDir, file);
      try {
        const stats = this.fsModule.statSync(filePath);
        if (now - stats.mtime.getTime() > retentionMs) {
          this.fsModule.unlinkSync(filePath);
        }
      } catch (error) {
        // Silent fail for cleanup errors
      }
    }
  }

  private scheduleArchiveCleanup(): void {
    if (this.isBrowser) return;
    
    const cleanup = () => {
      this.cleanOldArchives();
    };

    cleanup();
    if (typeof setInterval !== 'undefined') {
      setInterval(cleanup, 24 * 60 * 60 * 1000);
    }
  }

  private writeToFile(fileKey: string, entry: LogEntry): void {
    if (this.isBrowser || !this.config.enableFileLogging || !this.fsModule) return;

    const fileConfig = this.config.files[fileKey];
    if (!fileConfig || !fileConfig.enabled) return;
    if (!this.shouldLog(entry.level, fileConfig.level)) return;

    const filePath = this.getLogFilePath(fileKey);
    
    this.checkFileRotation(filePath, fileKey).catch(() => {});

    const timestamp = this.formatTimestamp(entry.timestamp);
    const levelStr = entry.level.toUpperCase().padEnd(5);
    const contextStr = this.formatContext(entry.context);

    const logLine = `[${timestamp}] [${levelStr}] ${entry.message}${contextStr}\n`;

    try {
      this.fsModule.appendFileSync(filePath, logLine, 'utf-8');
    } catch (error) {
      // Silent fail for file write errors
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
      default:
        console.log(output);
    }
  }

  private log(level: LogLevel, message: string, context?: Record<string, any>): void {
    const entry: LogEntry = {
      level,
      tag: this.getTagFromMessage(message),
      message,
      context,
      timestamp: new Date()
    };

    this.writeToConsole(entry);
    
    if (!this.isBrowser) {
      const fileKey = this.config.tagToFile[entry.tag] || 'app';
      this.writeToFile(fileKey, entry);
    }
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

  // Tagged logging methods
  tagged(tag: string, level: LogLevel, message: string, context?: Record<string, any>): void {
    this.log(level, `[${tag}] ${message}`, context);
  }

  // Specialized logging methods for collection service
  logPaperDetails(details: {
    title: string;
    relevanceScore: number;
    technicalScore: number;
    businessScore: number;
    timelinessScore: number;
    practicalityScore: number;
    tags: string[];
    source: string;
  }): void {
    this.info('[COLLECTION] Paper details', details);
  }

  logCollectionSummary(summary: {
    mode: string;
    query: string;
    totalFound: number;
    duplicates: number;
    filtered?: number;
    saved: number;
    duration: number;
    optimizedQuery?: string;
  }): void {
    this.info('[COLLECTION] Collection summary', summary);
  }

  // Configuration methods
  setLevel(level: LogLevel): void {
    this.config.globalLevel = level;
  }

  enableFileLogging(enabled: boolean): void {
    this.config.enableFileLogging = enabled;
  }

  enableConsoleLogging(enabled: boolean): void {
    this.config.enableConsoleLogging = enabled;
  }
}

// Create singleton instance
const logger = new Logger();

export { logger };
export type { LogLevel };
export default logger;
