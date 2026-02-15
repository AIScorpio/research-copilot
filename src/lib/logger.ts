type LogLevel = 'error' | 'warn' | 'info' | 'debug';

interface LogEntry {
  level: LogLevel;
  message: string;
  context?: Record<string, any>;
  timestamp: Date;
}

class Logger {
  private isDevelopment: boolean;
  private isProduction: boolean;

  constructor() {
    this.isDevelopment = process.env.NODE_ENV === 'development';
    this.isProduction = process.env.NODE_ENV === 'production';
  }

  private formatMessage(level: LogLevel, message: string, context?: Record<string, any>): LogEntry {
    return {
      level,
      message,
      context,
      timestamp: new Date(),
    };
  }

  private log(level: LogLevel, message: string, context?: Record<string, any>): void {
    const entry = this.formatMessage(level, message, context);

    if (this.isProduction && level === 'debug') {
      return;
    }

    const timestamp = entry.timestamp.toISOString();
    const prefix = `[${level.toUpperCase()}] ${timestamp}`;

    switch (level) {
      case 'error':
        console.error(prefix, message, context || '');
        break;
      case 'warn':
        console.warn(prefix, message, context || '');
        break;
      case 'info':
        console.info(prefix, message, context || '');
        break;
      case 'debug':
        console.debug(prefix, message, context || '');
        break;
    }
  }

  // Collection Summary Log
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
    
    console.log('\n' + '='.repeat(80));
    console.log(`[LOG] COLLECTION SUMMARY`);
    console.log('='.repeat(80));
    console.log(`  Mode:           ${mode}`);
    console.log(`  Query:          ${query}`);
    console.log(`  Found:          ${totalFound} papers`);
    console.log(`  Duplicates:     ${duplicates} papers`);
    console.log(`  Saved:          ${saved} papers`);
    console.log(`  Duration:       ${(duration / 1000).toFixed(2)}s`);
    if (optimizedQuery) {
      console.log(`  Optimized:      ${optimizedQuery.substring(0, 60)}...`);
    }
    console.log('='.repeat(80) + '\n');
  }

  // Paper Details Log
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
    
    console.log('[DETAILS] PAPER SAVED');
    console.log(`  Title:          ${title.substring(0, 60)}${title.length > 60 ? '...' : ''}`);
    console.log(`  Source:         ${source}`);
    console.log(`  Relevance:      ${relevanceScore.toFixed(1)}/10`);
    console.log(`  Technical:      ${technicalScore.toFixed(1)}/10`);
    console.log(`  Business:       ${businessScore.toFixed(1)}/10`);
    console.log(`  Timeliness:     ${timelinessScore.toFixed(1)}/10`);
    console.log(`  Practicality:   ${practicalityScore.toFixed(1)}/10`);
    console.log(`  Tags:           [${tags.join(', ')}]`);
    console.log('');
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
}

export const logger = new Logger();
export default logger;
