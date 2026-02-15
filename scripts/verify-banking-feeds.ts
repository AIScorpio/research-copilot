import { XMLParser } from "fast-xml-parser";

interface FeedTestResult {
  name: string;
  url: string;
  status: 'working' | 'failed';
  error?: string;
  items?: number;
  latency?: number;
}

const parser = new XMLParser({ ignoreAttributes: false });

async function testRSSFeed(name: string, url: string): Promise<FeedTestResult> {
  const startTime = Date.now();
  
  try {
    console.log(`Testing ${name}...`);
    
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
  console.log('BANKING NEWS FEED VERIFICATION');
  console.log('='.repeat(80));
  console.log();

  // Current feeds (from database)
  const currentFeeds = [
    { name: 'Finextra', url: 'https://www.finextra.com/rss/feed/news' },
    { name: 'Banking Dive', url: 'https://www.bankingdive.com/feed/' },
    { name: 'American Banker', url: 'https://www.americanbanker.com/rss' },
    { name: 'Financial Times Banking', url: 'https://www.ft.com/companies/banking?format=rss' },
  ];

  // Alternative feeds to try
  const alternativeFeeds = [
    // Reuters - has multiple RSS feeds
    { name: 'Reuters Banking', url: 'https://www.reuters.com/rssFeed/sectorNews?sectorId=95' },
    { name: 'Reuters Finance', url: 'https://www.reuters.com/rssFeed/financeNews' },
    { name: 'Reuters Business', url: 'https://www.reuters.com/rssFeed/businessNews' },
    { name: 'Reuters M&A', url: 'https://www.reuters.com/rssFeed/M&A' },
    { name: 'Reuters Markets', url: 'https://www.reuters.com/rssFeed/marketsNews' },
    { name: 'Reuters Deals', url: 'https://www.reuters.com/rssFeed/dealsNews' },
    
    // Bloomberg - check for RSS
    { name: 'Bloomberg Finance', url: 'https://www.bloomberg.com/feed/news/rss' },
    
    // CNBC
    { name: 'CNBC Banking', url: 'https://www.cnbc.com/id/10000664/device/rss/rss.html' },
    { name: 'CNBC Finance', url: 'https://www.cnbc.com/id/15839069/device/rss/rss.html' },
    { name: 'CNBC Financials', url: 'https://www.cnbc.com/id/10000664/device/rss/rss.html' },
    
    // The Financial Brand - fintech/banking
    { name: 'The Financial Brand', url: 'https://thefinancialbrand.com/feed/' },
    
    // Banking Technology
    { name: 'Banking Technology', url: 'https://bankingtech.com/feed/' },
    
    // The Banker
    { name: 'The Banker', url: 'https://www.thebanker.com/feed' },
    
    // Global Banking and Finance Review
    { name: 'Global Banking and Finance Review', url: 'https://globalbankingandfinance.com/feed/' },
    
    // Financial News (eFinancialCareers)
    { name: 'Financial News', url: 'https://www.efinancialnews.com/rss' },
    
    // Payday Loans / Alternative lending news
    { name: 'Bankless Times', url: 'https://www.banklesstimes.com/feed/' },
    
    // Additional fintech/banking sources
    { name: 'Fintech Zoom', url: 'https://fintechzoom.com/feed/' },
    { name: 'Fintech Futures', url: 'https://www.fintechfutures.com/feed/' },
    { name: 'Bobsguide', url: 'https://www.bobsguide.com/feed/' },
    { name: 'The Paypers', url: 'https://www.thepaypers.com/feed' },
    { name: 'Crowdfund Insider', url: 'https://www.crowdfundinsider.com/feed' },
    { name: 'Pymnts.com', url: 'https://www.pymnts.com/feed' },
    { name: 'Fintech Business Weekly', url: 'https://fintechbusinessweekly.com/feed' },
    { name: 'CryptoSlate', url: 'https://cryptoslate.com/feed' },
  ];

  // Additional Finextra feeds to try
  const finextraAlternatives = [
    { name: 'Finextra Newsfeed', url: 'https://www.finextra.com/newsfeed/rss' },
    { name: 'Finextra Latest', url: 'https://www.finextra.com/feeds/rss/latest' },
  ];

  // Additional Banking Dive feeds to try
  const bankingDiveAlternatives = [
    { name: 'Banking Dive (WordPress)', url: 'https://www.bankingdive.com/feed/?post_type=news' },
  ];

  console.log('TESTING CURRENT FEEDS');
  console.log('-'.repeat(80));
  const currentResults: FeedTestResult[] = [];
  for (const feed of currentFeeds) {
    const result = await testRSSFeed(feed.name, feed.url);
    currentResults.push(result);
  }

  console.log();
  console.log('TESTING ALTERNATIVE FEEDS');
  console.log('-'.repeat(80));
  const alternativeResults: FeedTestResult[] = [];
  for (const feed of alternativeFeeds) {
    const result = await testRSSFeed(feed.name, feed.url);
    alternativeResults.push(result);
  }

  console.log();
  console.log('TESTING FINEXTRA ALTERNATIVES');
  console.log('-'.repeat(80));
  const finextraResults: FeedTestResult[] = [];
  for (const feed of finextraAlternatives) {
    const result = await testRSSFeed(feed.name, feed.url);
    finextraResults.push(result);
  }

  console.log();
  console.log('TESTING BANKING DIVE ALTERNATIVES');
  console.log('-'.repeat(80));
  const bankingDiveResults: FeedTestResult[] = [];
  for (const feed of bankingDiveAlternatives) {
    const result = await testRSSFeed(feed.name, feed.url);
    bankingDiveResults.push(result);
  }

  console.log();
  console.log('='.repeat(80));
  console.log('SUMMARY');
  console.log('='.repeat(80));
  console.log();

  const workingCurrent = currentResults.filter(r => r.status === 'working');
  const workingAlternative = alternativeResults.filter(r => r.status === 'working');
  const workingFinextra = finextraResults.filter(r => r.status === 'working');
  const workingBankingDive = bankingDiveResults.filter(r => r.status === 'working');

  console.log(`Current Feeds Working: ${workingCurrent.length}/${currentResults.length}`);
  workingCurrent.forEach(r => {
    console.log(`  ✅ ${r.name}: ${r.items} items (${r.latency}ms)`);
  });
  currentResults.filter(r => r.status === 'failed').forEach(r => {
    console.log(`  ❌ ${r.name}: ${r.error}`);
  });

  console.log();
  console.log(`Alternative Feeds Working: ${workingAlternative.length}/${alternativeResults.length}`);
  workingAlternative.forEach(r => {
    console.log(`  ✅ ${r.name}: ${r.items} items (${r.latency}ms)`);
  });

  console.log();
  console.log(`Finextra Alternatives Working: ${workingFinextra.length}/${finextraResults.length}`);
  workingFinextra.forEach(r => {
    console.log(`  ✅ ${r.name}: ${r.items} items (${r.latency}ms)`);
  });

  console.log();
  console.log(`Banking Dive Alternatives Working: ${workingBankingDive.length}/${bankingDiveResults.length}`);
  workingBankingDive.forEach(r => {
    console.log(`  ✅ ${r.name}: ${r.items} items (${r.latency}ms)`);
  });

  console.log();
  console.log('='.repeat(80));
  console.log('RECOMMENDATIONS FOR DATABASE UPDATE');
  console.log('='.repeat(80));
  console.log();

  // Build recommendations
  const recommendations: { name: string; url: string; strategy: string }[] = [];

  // Check current feeds first
  if (workingCurrent.length >= 2) {
    console.log('Keep current feeds - enough are working');
    workingCurrent.forEach(r => recommendations.push({ name: r.name, url: r.url, strategy: 'Keep current working feed' }));
  } else {
    // Need replacements
    console.log(`Need ${4 - workingCurrent.length} replacements`);
    
    // Try Finextra alternatives first
    if (workingFinextra.length > 0) {
      recommendations.push({ name: workingFinextra[0].name, url: workingFinextra[0].url, strategy: 'Replace Finextra with working alternative' });
    }
    
    // Try Banking Dive alternatives
    if (workingBankingDive.length > 0) {
      recommendations.push({ name: workingBankingDive[0].name, url: workingBankingDive[0].url, strategy: 'Replace Banking Dive with working alternative' });
    }
    
    // Use best alternatives
    const bestAlternatives = workingAlternative
      .sort((a, b) => (b.items || 0) - (a.items || 0))
      .slice(0, 4 - workingCurrent.length - (workingFinextra.length > 0 ? 1 : 0) - (workingBankingDive.length > 0 ? 1 : 0));
    
    bestAlternatives.forEach(r => {
      recommendations.push({ name: r.name, url: r.url, strategy: 'Replace with alternative feed' });
    });
  }

  // Print TypeScript array for database update
  console.log();
  console.log('TYPESCRIPT CODE FOR PRISMA SEED:');
  console.log('-'.repeat(80));
  console.log('const bankingSources = [');
  recommendations.forEach(r => {
    console.log(`    { name: '${r.name}', url: '${r.url}', type: 'news' }, // ${r.strategy}`);
  });
  console.log('];');

  console.log();
  console.log(`Total working feeds available: ${workingAlternative.length + workingFinextra.length + workingBankingDive.length + workingCurrent.length}`);
  console.log(`Recommended for database: ${recommendations.length}`);
}

main().catch(console.error);
