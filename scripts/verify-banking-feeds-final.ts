import { XMLParser } from "fast-xml-parser";
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const parser = new XMLParser({ ignoreAttributes: false });

interface FeedTestResult {
  name: string;
  url: string;
  status: 'working' | 'failed';
  error?: string;
  items?: number;
  latency?: number;
}

async function testRSSFeed(name: string, url: string): Promise<FeedTestResult> {
  const startTime = Date.now();
  
  try {
    console.log(`  Testing ${name}...`);
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; InsightFlow/1.0; +https://insightflow.ai)',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
      },
      signal: AbortSignal.timeout(10000),
    });

    const latency = Date.now() - startTime;

    if (!response.ok) {
      return {
        name,
        url,
        status: 'failed',
        error: `HTTP ${response.status} ${response.statusText}`,
      };
    }

    const text = await response.text();
    
    if (!text || text.length < 100) {
      return {
        name,
        url,
        status: 'failed',
        error: 'Empty or invalid response',
      };
    }

    const data = parser.parse(text);
    const items = data.rss?.channel?.item || data.channel?.item || data.feed?.entry || [];
    const itemCount = Array.isArray(items) ? items.length : items ? 1 : 0;

    return {
      name,
      url,
      status: itemCount > 0 ? 'working' : 'failed',
      items: itemCount,
      latency,
    };
  } catch (error) {
    return {
      name,
      url,
      status: 'failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function main() {
  console.log('='.repeat(80));
  console.log('FINAL BANKING NEWS FEED VERIFICATION REPORT');
  console.log('='.repeat(80));
  console.log();

  // Fetch banking sources from database
  const bankingSources = await prisma.source.findMany({
    where: { type: 'news' },
    orderBy: { name: 'asc' }
  });

  console.log('Current Banking News Sources in Database:');
  console.log('-'.repeat(80));

  const results: FeedTestResult[] = [];

  for (const source of bankingSources) {
    if (!source.url) continue;
    const result = await testRSSFeed(source.name, source.url);
    results.push(result);

    if (result.status === 'working') {
      console.log(`  ✅ ${result.name}: ${result.items} items (${result.latency}ms)`);
      console.log(`     URL: ${result.url}`);
    } else {
      console.log(`  ❌ ${result.name}: ${result.error}`);
      console.log(`     URL: ${result.url}`);
    }
    console.log();
  }

  console.log('='.repeat(80));
  console.log('SUMMARY');
  console.log('='.repeat(80));
  console.log();

  const working = results.filter(r => r.status === 'working');
  const failed = results.filter(r => r.status === 'failed');

  console.log(`Total Sources: ${results.length}`);
  console.log(`Working: ${working.length}/${results.length} (${Math.round(working.length / results.length * 100)}%)`);
  console.log(`Failed: ${failed.length}/${results.length}`);
  console.log();

  if (working.length >= 3) {
    console.log('✅ SUCCESS: Target achieved (3+ working sources)');
  } else if (working.length >= 2) {
    console.log('⚠️  PARTIAL: Minimum acceptable (2 working sources)');
  } else {
    console.log('❌ FAILED: Not enough working sources (<2)');
  }

  console.log();
  console.log('='.repeat(80));
  console.log('STRATEGY SUMMARY');
  console.log('='.repeat(80));
  console.log();

  results.forEach(r => {
    console.log(`${r.name}:`);
    console.log(`  - Strategy: ${getStrategyForSource(r.name)}`);
    console.log(`  - Status: ${r.status === 'working' ? 'WORKING ✅' : 'FAILED ❌'}`);
    if (r.error) console.log(`  - Error: ${r.error}`);
    if (r.items) console.log(`  - Items: ${r.items}`);
    console.log();
  });

  console.log('='.repeat(80));
  console.log('OLD vs NEW URLS');
  console.log('='.repeat(80));
  console.log();

  console.log('OLD (Broken) Sources:');
  console.log('  ❌ Finextra: https://www.finextra.com/rss/feed/news (404)');
  console.log('  ❌ Banking Dive: https://www.bankingdive.com/feed/ (403 Cloudflare)');
  console.log('  ❌ Financial Times: https://www.ft.com/companies/banking?format=rss (404)');
  console.log();

  console.log('NEW (Working) Sources:');
  results.filter(r => r.status === 'working').forEach(r => {
    console.log(`  ✅ ${r.name}: ${r.url}`);
  });

  console.log();
  console.log('='.repeat(80));
  console.log('RECOMMENDATIONS FOR REMAINING BROKEN SOURCES');
  console.log('='.repeat(80));
  console.log();

  console.log('Finextra:');
  console.log('  - Current: HTTP 404/403 errors');
  console.log('  - Recommendation: Keep disabled - requires proxy/scraping service');
  console.log('  - Alternative: Use Apify.com or ScrapingBee API');
  console.log();

  console.log('Banking Dive:');
  console.log('  - Current: Cloudflare 403 protection');
  console.log('  - Recommendation: Keep disabled - requires bypass service');
  console.log('  - Alternative: Use Apify.com or ScrapingBee API');
  console.log();

  console.log('Financial Times:');
  console.log('  - Current: Paywall/404');
  console.log('  - Recommendation: Keep disabled - requires subscription');
  console.log('  - Alternative: Use FT API with paid subscription');
}

function getStrategyForSource(name: string): string {
  if (name === 'American Banker') {
    return 'Kept original - RSS feed is working';
  } else if (name === 'CNBC Banking') {
    return 'Replacement for Finextra/Banking Dive - Direct banking news';
  } else if (name === 'Bankless Times') {
    return 'Replacement for Financial Times - Fintech/banking coverage';
  } else if (name === 'Pymnts.com') {
    return 'New source - Payments and banking technology news';
  }
  return 'Unknown';
}

main()
  .catch((e) => {
    console.error('❌ Verification failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
