import fetch from 'node-fetch';

async function testUrls() {
  const urls = [
    // ECB URLs
    'https://www.ecb.europa.eu/mid/rss/pressreleases.xml',
    'https://www.ecb.europa.eu/mid/rss/press_releases.xml',
    'https://www.ecb.europa.eu/mid/pressreleases.xml',
    'https://www.ecb.europa.eu/mid/services/rss/pressreleases.xml',
    'https://www.ecb.europa.eu/mid/api/rss/pressreleases.xml',

    // PRA URLs
    'https://www.bankofengland.co.uk/pra/-/media/boe/files/pra/rss/pra-news.xml',
    'https://www.bankofengland.co.uk/pra/-/media/boe/files/pra/rss/pra-publications.xml',
    'https://www.bankofengland.co.uk/pra/Pages/home.aspx/rss',
    'https://www.bankofengland.co.uk/pra/Pages/home.aspx/rss.xml',
    'https://www.bankofengland.co.uk/pra/rss/pra-news.xml',
    'https://www.bankofengland.co.uk/pra/rss/pra-rss.xml',
    'https://www.bankofengland.co.uk/pra/rss.xml',
  ]

  for (const url of urls) {
    try {
      const response = await fetch(url as string, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0',
        },
      });

      console.log(`${response.status}: ${url}`)

      if (response.ok) {
        const contentType = response.headers.get('content-type')
        console.log(`  Content-Type: ${contentType}`)
        const text = await response.text()
        const isRSS = text.includes('<rss') || text.includes('<RSS') ||
                      text.includes('<feed') || text.includes('<channel>') ||
                      text.includes('<rdf:RDF')
        console.log(`  Valid RSS: ${isRSS}`)

        if (isRSS) {
          console.log('\n✅ FOUND WORKING URL!')
          console.log('\nFirst few lines:')
          console.log(text.substring(0, 500))
          return url
        }
      }
    } catch (error) {
      console.log(`ERROR: ${url}`)
      console.log(`  ${error instanceof Error ? error.message : String(error)}`)
    }
    console.log('')
  }

  console.log('\n❌ No working RSS URL found')
  return null
}

testUrls().catch(console.error)
