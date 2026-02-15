import fetch from 'node-fetch';

async function testUrls() {
  const urls = [
    'https://www.ecb.europa.eu/press/pr/rss/html/index.en.html',
    'https://www.ecb.europa.eu/press/pr/rss/xml/index.en.html',
    'https://www.ecb.europa.eu/press/news/xml/index.en.html',
    'https://www.ecb.europa.eu/rss/pressreleases.xml',
    'https://www.ecb.europa.eu/press/pressreleases.xml',
    'https://www.ecb.europa.eu/press/pr/rss/standard.en.html',
    'https://www.ecb.europa.eu/press/pr/rss/news.en.xml',
    'https://www.ecb.europa.eu/rss/pr.html',
    'https://www.ecb.europa.eu/rss.xml',
  ];

  for (const url of urls) {
    try {
      const response = await fetch(url, {
        method: 'HEAD',
        headers: {
          'User-Agent': 'Mozilla/5.0',
        },
      });

      console.log(`${response.status}: ${url}`);
      
      if (response.ok) {
        const contentType = response.headers.get('content-type');
        console.log(`  Content-Type: ${contentType}`);
      }
    } catch (error) {
      console.log(`ERROR: ${url}`);
      console.log(`  ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

testUrls().catch(console.error);
