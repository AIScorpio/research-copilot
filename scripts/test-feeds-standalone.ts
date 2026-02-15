import fetch from 'node-fetch';

interface FeedTestResult {
  name: string;
  url: string;
  status: 'success' | 'error';
  statusCode?: number;
  contentType?: string;
  error?: string;
  isValidRSS?: boolean;
}

async function testFeed(name: string, url: string): Promise<FeedTestResult> {
  const result: FeedTestResult = {
    name,
    url,
    status: 'error',
  };

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AIScorpio/1.0; +https://github.com/aiscorpio)',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    result.statusCode = response.status;
    result.contentType = response.headers.get('content-type') || undefined;

    if (!response.ok) {
      result.error = `HTTP ${response.status}`;
      return result;
    }

    const text = await response.text();
    
    // Check if it's valid RSS or XML
    const isRSS = text.includes('<rss') || text.includes('<RSS') || 
                  text.includes('<feed') || text.includes('<channel>') ||
                  (text.includes('<?xml') && text.includes('<rss'));

    result.isValidRSS = isRSS;
    result.status = 'success';

    return result;
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error);
    return result;
  }
}

async function main() {
  console.log('🔍 Testing Regulatory Feed URLs...\n');

  // Current URLs from the database
  const currentUrls = [
    {
      name: 'BIS (Bank for International Settlements)',
      url: 'https://www.bis.org/pressreleases.xml',
    },
    {
      name: 'ECB (European Central Bank)',
      url: 'https://www.ecb.europa.eu/rss/pr.html',
    },
    {
      name: 'FCA (Financial Conduct Authority)',
      url: 'https://www.fca.org.uk/news/rss',
    },
    {
      name: 'PRA (Prudential Regulation Authority)',
      url: 'https://www.bankofengland.co.uk/-/media/boe/files/pra/rss/pra-rss.xml',
    },
    {
      name: 'Federal Reserve',
      url: 'https://www.federalreserve.gov/feeds/press_all.xml',
    },
  ];

  const results: FeedTestResult[] = [];

  for (const source of currentUrls) {
    console.log(`Testing: ${source.name}`);
    console.log(`URL: ${source.url}`);

    const result = await testFeed(source.name, source.url);
    results.push(result);

    console.log(`Status: ${result.status}`);
    if (result.statusCode) {
      console.log(`HTTP Status: ${result.statusCode}`);
    }
    if (result.contentType) {
      console.log(`Content Type: ${result.contentType}`);
    }
    if (result.isValidRSS !== undefined) {
      console.log(`Valid RSS/XML: ${result.isValidRSS ? '✅ YES' : '❌ NO'}`);
    }
    if (result.error) {
      console.log(`Error: ${result.error}`);
    }
    console.log('');
  }

  // Summary
  console.log('═════════════════════════════════════════════════════');
  console.log('SUMMARY');
  console.log('═════════════════════════════════════════════════════\n');

  const successCount = results.filter(r => r.status === 'success' && r.isValidRSS).length;
  const totalCount = results.length;

  console.log(`✅ Working feeds: ${successCount}/${totalCount}`);

  console.log('\nWORKING:');
  results
    .filter(r => r.status === 'success' && r.isValidRSS)
    .forEach(r => console.log(`  ✓ ${r.name}: ${r.url}`));

  console.log('\nBROKEN:');
  results
    .filter(r => r.status !== 'success' || !r.isValidRSS)
    .forEach(r => {
      console.log(`  ✗ ${r.name}: ${r.url}`);
      if (r.error) console.log(`    Error: ${r.error}`);
    });

  console.log('\n═════════════════════════════════════════════════════\n');
}

main().catch(console.error);
