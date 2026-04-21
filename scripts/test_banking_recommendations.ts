import { generatePoCRecommendations } from '../src/lib/recommendations';

async function testRecommendations() {
  console.log('Testing Banking-Specific PoC Recommendations...\n');
  
  try {
    // Test 1: General recommendations
    console.log('Test 1: General Recommendations');
    const generalRecs = await generatePoCRecommendations(5);
    console.log(`Found ${generalRecs.length} recommendations`);
    
    if (generalRecs.length > 0) {
      const firstRec = generalRecs[0];
      console.log('\nFirst Recommendation:');
      console.log(`  Title: ${firstRec.title}`);
      console.log(`  Domain: ${firstRec.domain}`);
      console.log(`  Readiness: ${firstRec.readiness} (${firstRec.readinessScore}%)`);
      console.log(`  Technology: ${firstRec.technology}`);
      console.log(`  Risk Domain: ${firstRec.riskDomain}`);
      console.log(`  Banking Tags: [${firstRec.bankingTags.join(', ')}]`);
      console.log(`  Use Cases: [${firstRec.bankingUseCases.slice(0, 2).join(', ')}]`);
      console.log(`  Confidence: ${(firstRec.confidence * 100).toFixed(0)}%`);
      
      if (firstRec.bankAdoption && firstRec.bankAdoption.length > 0) {
        console.log(`  Bank Adoption: [${firstRec.bankAdoption.join(', ')}]`);
      }
      
      if (firstRec.maturityIndicators && firstRec.maturityIndicators.length > 0) {
        console.log(`  Maturity Indicators: [${firstRec.maturityIndicators.join(', ')}]`);
      }
    }
    
    // Test 2: Domain-filtered recommendations
    console.log('\n\nTest 2: Domain-Filtered Recommendations (Credit Risk)');
    const creditRiskRecs = await generatePoCRecommendations(3, 'Credit Risk');
    console.log(`Found ${creditRiskRecs.length} recommendations`);
    
    if (creditRiskRecs.length > 0) {
      const firstCreditRec = creditRiskRecs[0];
      console.log('\nFirst Credit Risk Recommendation:');
      console.log(`  Title: ${firstCreditRec.title}`);
      console.log(`  Domain: ${firstCreditRec.domain}`);
      console.log(`  Risk Domain: ${firstCreditRec.riskDomain}`);
      console.log(`  Banking Tags: [${firstCreditRec.bankingTags.join(', ')}]`);
    }
    
    // Test 3: Comparison
    console.log('\n\nTest 3: Before vs After Comparison');
    console.log('\nBEFORE (Generic):');
    console.log('  Title: "PoC: LLM for General Application"');
    console.log('  Description: "Explore LLM applications..."');
    console.log('  Tags: [LLM]');
    console.log('  No readiness level');
    console.log('  No banking-specific use cases');
    
    console.log('\nAFTER (Banking-Specific):');
    if (generalRecs.length > 0) {
      console.log(`  Title: "${generalRecs[0].title}"`);
      console.log(`  Domain: "${generalRecs[0].domain}"`);
      console.log(`  Readiness: ${generalRecs[0].readiness} (${generalRecs[0].readinessScore}%)`);
      console.log(`  Tags: [${generalRecs[0].bankingTags.join(', ')}]`);
      console.log(`  Use Cases: [${generalRecs[0].bankingUseCases.slice(0, 2).join(', ')}]`);
    }
    
    console.log('\n✅ Tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

testRecommendations();
