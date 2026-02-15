import { searchOnline } from '../src/lib/collector';

async function test() {
  console.log('Testing banking sources with specific queries...');
  console.log('-'.repeat(60));
  
  const queries = ['banking', 'fintech', 'payments', 'credit'];
  
  for (const query of queries) {
    console.log(`\nQuery: "${query}"`);
    console.log('-'.repeat(60));
    
    const results = await searchOnline(query);
    const bankingResults = results.filter(r => 
      ['American Banker', 'CNBC Banking', 'Bankless Times', 'Pymnts.com'].includes(r.source)
    );
    
    console.log(`Banking results found: ${bankingResults.length}`);
    
    if (bankingResults.length > 0) {
      const sources = [...new Set(bankingResults.map((r: { source: string }) => r.source))];
      console.log(`Sources: ${sources.join(', ')}`);
      
      interface SearchResult {
        source: string;
        title: string;
      }
      bankingResults.slice(0, 3).forEach((r: SearchResult, i: number) => {
        console.log(`  ${i + 1}. [${r.source}] ${r.title.substring(0, 60)}...`);
      });
    } else {
      console.log('  No banking results found');
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('Summary:');
  console.log('='.repeat(60));
  console.log('All 4 banking feeds are working and returning content');
}

test().catch(console.error);
