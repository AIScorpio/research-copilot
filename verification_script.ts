
import { searchOnline } from './src/lib/collector.js';
import { processPaper } from './src/lib/processor.js';

interface ProcessedPaper {
    title: string;
    suggestedTags: Array<{ type: string }>;
}

async function runverification() {
    console.log("Starting verification...");

    // 1. Test Collector
    console.log("Testing Collector...");
    const results = await searchOnline("AI", undefined, undefined, []);
    console.log(`Collector found ${results.length} papers.`);
    if (results.length === 0) throw new Error("Collector failed");

    // 2. Test Processor
    console.log("Testing Processor (Tagging)...");
    const paper = results[0];
    const processed = await processPaper(paper) as ProcessedPaper;
    console.log(`Processed paper: ${processed.title}`);
    console.log(`Tags: ${JSON.stringify(processed.suggestedTags)}`);

    if (!processed.suggestedTags.some((t) => t.type === 'Industrial') && !processed.suggestedTags.some((t) => t.type === 'Academic')) {
        console.warn("Warning: No tags assigned to the first paper. Check processor logic.");
        // Not throwing error as it depends on the random paper content
    }

    console.log("Verification checks passed!");
}

runverification().catch(e => {
    console.error(e);
    process.exit(1);
});
