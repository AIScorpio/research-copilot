import { XMLParser } from "fast-xml-parser";
import { prisma } from "./db";
import { logger } from "./logger";

export interface AlertKeyword {
  keyword: string;
  weight: number;
  category: "credit-risk" | "model-governance" | "ai-ml" | "compliance" | "regulatory" | "general";
}

export interface AlertItem {
  sourceId: string;
  sourceName: string;
  title: string;
  content: string;
  url: string;
  publicationDate: Date;
}

export interface ParsedAlert {
  sourceId: string;
  sourceName: string;
  title: string;
  content: string;
  url: string;
  keywords: string[];
  relevance: number;
  priority: "HIGH" | "MEDIUM" | "LOW";
}

const parser = new XMLParser({ ignoreAttributes: false });

const ALERT_KEYWORDS: AlertKeyword[] = [
  { keyword: "artificial intelligence", weight: 90, category: "ai-ml" },
  { keyword: "machine learning", weight: 85, category: "ai-ml" },
  { keyword: "deep learning", weight: 75, category: "ai-ml" },
  { keyword: "neural network", weight: 70, category: "ai-ml" },
  { keyword: "credit risk", weight: 95, category: "credit-risk" },
  { keyword: "credit scoring", weight: 90, category: "credit-risk" },
  { keyword: "credit decisions", weight: 95, category: "credit-risk" },
  { keyword: "credit underwriting", weight: 90, category: "credit-risk" },
  { keyword: "model risk", weight: 95, category: "model-governance" },
  { keyword: "model governance", weight: 95, category: "model-governance" },
  { keyword: "model validation", weight: 90, category: "model-governance" },
  { keyword: "model management", weight: 85, category: "model-governance" },
  { keyword: "compliance", weight: 85, category: "compliance" },
  { keyword: "regulatory", weight: 80, category: "regulatory" },
  { keyword: "supervision", weight: 75, category: "regulatory" },
  { keyword: "supervisory", weight: 75, category: "regulatory" },
  { keyword: "algorithm", weight: 70, category: "ai-ml" },
  { keyword: "algorithms", weight: 70, category: "ai-ml" },
  { keyword: "automation", weight: 65, category: "ai-ml" },
  { keyword: " automated decision", weight: 80, category: "ai-ml" },
  { keyword: "fair lending", weight: 90, category: "compliance" },
  { keyword: "fairness", weight: 80, category: "compliance" },
  { keyword: "bias", weight: 80, category: "compliance" },
  { keyword: "explainability", weight: 75, category: "model-governance" },
  { keyword: "interpretability", weight: 75, category: "model-governance" },
  { keyword: "transparency", weight: 70, category: "model-governance" },
  { keyword: " Basel", weight: 85, category: "regulatory" },
  { keyword: "capital requirements", weight: 85, category: "regulatory" },
  { keyword: "stress testing", weight: 80, category: "regulatory" },
  { keyword: "SR 11-7", weight: 95, category: "model-governance" },
  { keyword: " OCC 2011-12", weight: 95, category: "model-governance" },
  { keyword: "AI Act", weight: 95, category: "regulatory" },
  { keyword: "EU AI Act", weight: 95, category: "regulatory" },
  { keyword: "DORA", weight: 90, category: "regulatory" },
  { keyword: "operational resilience", weight: 80, category: "regulatory" },
];

const REGULATORY_SOURCES = [
  { id: "bis-press", name: "BIS Press Releases", url: "https://www.bis.org/pressreleases.xml" },
  { id: "bis-pub", name: "BIS Publications", url: "https://www.bis.org/publications.xml" },
  { id: "ecb-press", name: "ECB Press Releases", url: "https://www.ecb.europa.eu/rss/pr.html" },
  { id: "fca-news", name: "FCA News", url: "https://www.fca.org.uk/news/rss" },
  { id: "fed-press", name: "Federal Reserve", url: "https://www.federalreserve.gov/feeds/press_all.xml" },
];

async function fetchRSSFeed(url: string, sourceId: string, sourceName: string): Promise<AlertItem[]> {
  try {
    const res = await fetch(url, { 
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; InsightFlow/1.0)' },
      signal: AbortSignal.timeout(10000)
    });

    if (!res.ok) {
      logger.warn(`${sourceName} RSS feed returned ${res.status}`);
      return [];
    }

    const xml = await res.text();
    const rssData = parser.parse(xml);
    const items = rssData.rss?.channel?.item || rssData.channel?.item || [];

    const entries = Array.isArray(items) ? items : [items];
    const itemsArray: AlertItem[] = [];

    for (const item of entries) {
      const title = item.title || '';
      const description = item.description || item.content || '';
      const link = item.link || item.guid || '';
      const pubDate = parseRSSDate(item.pubDate || item.published);

      if (title && link) {
        const cleanDescription = stripHtml(description);
        itemsArray.push({
          sourceId,
          sourceName,
          title: title.replace(/\n/g, ' ').trim(),
          content: cleanDescription,
          url: link,
          publicationDate: pubDate
        });
      }
    }

    return itemsArray;
  } catch (error) {
    logger.error(`${sourceName} Feed fetch failed`, { error });
    return [];
  }
}

function parseRSSDate(dateStr: string): Date {
  if (!dateStr) return new Date();
  
  const parsed = new Date(dateStr);
  if (!isNaN(parsed.getTime())) return parsed;
  
  return new Date();
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

function calculateRelevance(item: AlertItem): { keywords: string[]; relevance: number; priority: "HIGH" | "MEDIUM" | "LOW" } {
  const text = `${item.title} ${item.content}`.toLowerCase();
  const matchedKeywords: AlertKeyword[] = [];

  for (const alertKeyword of ALERT_KEYWORDS) {
    if (text.includes(alertKeyword.keyword.toLowerCase())) {
      matchedKeywords.push(alertKeyword);
    }
  }

  if (matchedKeywords.length === 0) {
    return { keywords: [], relevance: 0, priority: "LOW" };
  }

  const relevance = Math.min(100, matchedKeywords.reduce((sum, k) => sum + k.weight, 0) / matchedKeywords.length);

  let priority: "HIGH" | "MEDIUM" | "LOW";
  if (relevance >= 85) {
    priority = "HIGH";
  } else if (relevance >= 65) {
    priority = "MEDIUM";
  } else {
    priority = "LOW";
  }

  return {
    keywords: matchedKeywords.map(k => k.keyword),
    relevance: Math.round(relevance),
    priority
  };
}

export async function monitorFeeds(): Promise<ParsedAlert[]> {
  logger.debug("Alert Engine Starting feed monitoring");

  const allAlerts: ParsedAlert[] = [];

  for (const source of REGULATORY_SOURCES) {
    const items = await fetchRSSFeed(source.url, source.id, source.name);
    logger.debug(`${source.name} Found ${items.length} items`);

    for (const item of items) {
      const parsed = parseAlert(item);
      if (parsed.relevance > 0) {
        allAlerts.push(parsed);
      }
    }
  }

  logger.debug(`Alert Engine Total relevant alerts found: ${allAlerts.length}`);
  return allAlerts;
}

export function parseAlert(item: AlertItem): ParsedAlert {
  const { keywords, relevance, priority } = calculateRelevance(item);

  return {
    sourceId: item.sourceId,
    sourceName: item.sourceName,
    title: item.title,
    content: item.content,
    url: item.url,
    keywords,
    relevance,
    priority
  };
}

export async function createAlert(parsedAlert: ParsedAlert): Promise<boolean> {
  try {
    const existing = await prisma.regulatoryAlert.findFirst({
      where: {
        url: parsedAlert.url
      }
    });

    if (existing) {
      logger.debug(`Alert already exists: ${parsedAlert.title}`);
      return false;
    }

    await prisma.regulatoryAlert.create({
      data: {
        sourceId: parsedAlert.sourceId,
        sourceName: parsedAlert.sourceName,
        title: parsedAlert.title,
        content: parsedAlert.content,
        url: parsedAlert.url,
        keywords: JSON.stringify(parsedAlert.keywords),
        relevance: parsedAlert.relevance,
        priority: parsedAlert.priority,
        status: "new"
      }
    });

    logger.debug(`Created alert: ${parsedAlert.title} (${parsedAlert.priority})`);
    return true;
  } catch (error) {
    logger.error("Alert Engine Failed to create alert", { error });
    return false;
  }
}

export async function processAndStoreAlerts(alerts: ParsedAlert[]): Promise<{ created: number; skipped: number }> {
  let created = 0;
  let skipped = 0;

  for (const alert of alerts) {
    const result = await createAlert(alert);
    if (result) {
      created++;
    } else {
      skipped++;
    }
  }

  logger.debug(`Alert Engine Processed ${alerts.length} alerts: ${created} created, ${skipped} skipped`);
  return { created, skipped };
}

export async function getAlertStatistics() {
  const total = await prisma.regulatoryAlert.count();
  const unread = await prisma.regulatoryAlert.count({ where: { status: "new" } });
  const high = await prisma.regulatoryAlert.count({ where: { priority: "HIGH", status: "new" } });
  const medium = await prisma.regulatoryAlert.count({ where: { priority: "MEDIUM", status: "new" } });
  const low = await prisma.regulatoryAlert.count({ where: { priority: "LOW", status: "new" } });

  return { total, unread, high, medium, low };
}