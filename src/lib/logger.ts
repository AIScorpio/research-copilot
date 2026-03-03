type LogLevel = 'error' | 'warn' | 'info' | 'debug';

interface LogConfig {
  globalLevel: LogLevel;
  enableFileLogging: boolean;
  enableConsoleLogging: boolean;
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

  constructor() {
    this.isDevelopment = process.env.NODE_ENV !== 'production';
    this.config = {
      globalLevel: 'info',
      enableFileLogging: false, // Disabled for browser
      enableConsoleLogging: true
    };
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
