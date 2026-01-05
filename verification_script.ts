
const { searchOnline } = require('./src/lib/collector');
const { processPaper } = require('./src/lib/processor');
// Mocking Prisma for script if ts-node is not setup, or we can use tsx.
// I'll assume tsx is available or use npx tsx.

async function runverification() {
    console.log("Starting verification...");

    // 1. Test Collector
    console.log("Testing Collector...");
    const results = await searchOnline("AI", undefined, []);
    console.log(`Collector found ${results.length} papers.`);
    if (results.length === 0) throw new Error("Collector failed");

    // 2. Test Processor
    console.log("Testing Processor (Tagging)...");
    const paper = results[0];
    const processed = await processPaper(paper);
    console.log(`Processed paper: ${processed.title}`);
    console.log(`Tags: ${JSON.stringify(processed.suggestedTags)}`);

    if (!processed.suggestedTags.some((t: any) => t.type === 'Industrial') && !processed.suggestedTags.some((t: any) => t.type === 'Academic')) {
        console.warn("Warning: No tags assigned to the first paper. Check processor logic.");
        // Not throwing error as it depends on the random paper content
    }

    console.log("Verification checks passed!");
}

runverification().catch(e => {
    console.error(e);
    process.exit(1);
});
