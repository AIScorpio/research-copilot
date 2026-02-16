import { PrismaClient } from '@prisma/client';
import fetch from 'node-fetch';

const prisma = new PrismaClient();

interface FeedTestResult {
  name: string;
  url: string;
  status: 'success' | 'error';
  statusCode?: number;
  contentType?: string;
  error?: string;
  isValidRSS?: boolean;
}

async function testFeed(url: string): Promise<FeedTestResult> {
  const result: FeedTestResult = {
    name: '',
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
                  text.includes('<?xml') && text.includes('<rss');

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

  // Get all regulatory sources from database
  const sources = await prisma.source.findMany({
    where: {
      type: 'regulatory',
    },
  });

  console.log(`Found ${sources.length} regulatory sources\n`);

  const results: FeedTestResult[] = [];

  for (const source of sources) {
    if (!source.url) continue;
    console.log(`Testing: ${source.name}`);
    console.log(`URL: ${source.url}`);

    const result = await testFeed(source.url);
    result.name = source.name;
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

  await prisma.$disconnect();
}

main().catch(console.error);
