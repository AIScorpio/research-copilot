/**
 * Hybrid Logger - Console + File (local only)
 * Works on both Vercel (console-only) and local (console + files)
 * File logging uses eval() to bypass webpack bundling
 */

type LogLevel = 'error' | 'warn' | 'info' | 'debug';

interface LogConfig {
  globalLevel: LogLevel;
  enableFileLogging: boolean;
  enableConsoleLogging: boolean;
  logDirectory: string;
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
  private isDevelopment: boolean;
  private isVercel: boolean;
  private isServer: boolean;

  constructor() {
    this.isDevelopment = typeof process !== 'undefined' && process.env.NODE_ENV !== 'production';
    this.isVercel = typeof process !== 'undefined' && (process.env.VERCEL === '1' || process.env.VERCEL === 'true');
    this.isServer = typeof window === 'undefined';
    
    this.config = {
      globalLevel: 'info',
      enableFileLogging: this.isServer && !this.isVercel,
      enableConsoleLogging: true,
      logDirectory: 'logs'
    };
    
    if (this.config.enableFileLogging) {
      this.initFileSystem();
    }
  }

  private initFileSystem(): void {
    try {
      // Use eval to bypass webpack bundling - only executes at runtime
      const fs = eval('require("fs")');
      const path = eval('require("path")');
      
      const logDir = path.join(process.cwd(), this.config.logDirectory);
      
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }
      
      console.info(`[LOGGER] File logging enabled at: ${logDir}`);
    } catch (e) {
      this.config.enableFileLogging = false;
    }
  }

  private formatTimestamp(date: Date): string {
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${(date.getMilliseconds()).toString().padStart(3, '0')}`;
  }

  private sanitizeContext(context?: Record<string, any>): Record<string, any> | undefined {
    if (!context) return context;

    const sensitiveFields = ['apiKey', 'secret', 'password', 'token', 'credential'];
    const sanitized: Record<string, any> = {};
    
    for (const [key, value] of Object.entries(context)) {
      if (sensitiveFields.some(field => key.toLowerCase().includes(field.toLowerCase()))) {
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

  private writeToFile(fileKey: string, entry: LogEntry): void {
    if (!this.config.enableFileLogging) return;
    
    try {
      // Use eval to bypass webpack - only runs on server
      const fs = eval('require("fs")');
      const path = eval('require("path")');
      
      const date = new Date().toISOString().split('T')[0];
      const fileName = `${fileKey}-${date}.log`;
      const filePath = path.join(process.cwd(), this.config.logDirectory, fileName);
      
      const timestamp = this.formatTimestamp(entry.timestamp);
      const contextStr = this.formatContext(entry.context);
      const logLine = `[${timestamp}] [${entry.level.toUpperCase()}] ${entry.message}${contextStr}\n`;
      
      fs.appendFileSync(filePath, logLine, 'utf-8');
    } catch (e) {
      // Fail silently - console still works
    }
  }

  private writeToConsole(entry: LogEntry): void {
    if (!this.config.enableConsoleLogging) return;
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

    this.writeToFile(entry.tag.toLowerCase(), entry);
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
}

// Create singleton instance
const logger = new Logger();

export { logger };
export type { LogLevel };
export default logger;
