import { searchOnline } from '../src/lib/collector';

async function test() {
  console.log('Testing banking news collection with new feeds...');
  console.log('-'.repeat(60));
  
  const results = await searchOnline('banking AI');
  
  console.log(`\nTotal results found: ${results.length}`);
  console.log('\nTop 5 results:');
  console.log('-'.repeat(60));
  
  results.slice(0, 5).forEach((r, i) => {
    console.log(`${i + 1}. [${r.source}] ${r.title.substring(0, 70)}...`);
    console.log(`   Published: ${r.publicationDate.toLocaleDateString()}`);
    console.log(`   URL: ${r.url.substring(0, 60)}...`);
    console.log();
  });

  const bankingSources = results.filter(r => 
    ['American Banker', 'CNBC Banking', 'Bankless Times', 'Pymnts.com'].includes(r.source)
  );
  
  console.log(`Banking-specific results: ${bankingSources.length}`);
  console.log('-'.repeat(60));
}

test().catch(console.error);
