import 'dotenv/config';
import { optimizeQuery } from './src/lib/query-optimizer';

async function testQueries() {
    console.log('=== Testing Query Optimization ===\n');

    const testQueries = [
        'credit risk',
        'fraud detection',
        'Stochastic',
        'graph neural network',
        'transformer banking'
    ];

    for (const query of testQueries) {
        console.log(`\nQuery: "${query}"`);
        console.log('='.repeat(60));
        
        try {
            const result = await optimizeQuery(query);
            console.log('Source:', result.source);
            console.log('Optimized:', result.optimizedQuery.substring(0, 100) + '...');
        } catch (error) {
            console.log('Error:', (error as Error).message);
        }
    }
}

testQueries();
