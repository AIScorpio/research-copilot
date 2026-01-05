import { NextResponse } from 'next/server';
import { searchOnline } from '@/lib/collector';
import { processPaper } from '@/lib/processor';
import { prisma } from '@/lib/db';

/**
 * Auto-collection endpoint with preset defaults for daily/on-demand scraping
 * Default: "AI in banking" theme, past week, all enabled sources
 */
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { override } = body; // Optional override for query/horizon

        // DEFAULT CONFIGURATION
        const defaultQuery = "AI in banking";
        const defaultHorizon = "week"; // Most recent papers

        const query = override?.query || defaultQuery;
        const horizon = override?.horizon || defaultHorizon;

        console.log(`[Auto-Collect] Starting with query: "${query}", horizon: ${horizon}`);

        // Get ALL enabled sources from database
        const enabledSources = await prisma.source.findMany({
            where: { enabled: true }
        });

        console.log(`[Auto-Collect] Enabled sources: ${enabledSources.map(s => s.name).join(', ')}`);

        // Calculate date filter
        const now = new Date();
        let sinceDate: Date;

        switch (horizon) {
            case "today":
                sinceDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
                break;
            case "week":
                sinceDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                break;
            case "month":
                sinceDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                break;
            case "year":
                sinceDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
                break;
            default:
                sinceDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        }

        // Search online sources with ALL enabled sources
        const results = await searchOnline(query, sinceDate, undefined, enabledSources);

        console.log(`[Auto-Collect] Found ${results.length} papers`);

        let newCount = 0;
        let duplicateCount = 0;
        const duplicateTitles: string[] = [];

        // Process and store papers
        for (const result of results) {
            // Check if paper already exists (by URL since it's unique)
            const existing = await prisma.paper.findFirst({
                where: { url: result.url }
            });

            if (!existing) {
                // Process for tags
                const processed = await processPaper(result);

                // Create paper
                const paper = await prisma.paper.create({
                    data: {
                        title: result.title,
                        abstract: result.abstract,
                        url: result.url,
                        source: result.source,
                        publicationDate: result.publicationDate,
                        collectedAt: new Date()
                    }
                });

                // Link tags
                for (const tag of processed.suggestedTags) {
                    let dbTag = await prisma.tag.findUnique({ where: { name: tag.name } });

                    if (!dbTag) {
                        dbTag = await prisma.tag.create({
                            data: { name: tag.name, type: tag.type }
                        });
                    }

                    await prisma.paperTag.create({
                        data: {
                            paperId: paper.id,
                            tagId: dbTag.id
                        }
                    });
                }

                newCount++;
            } else {
                duplicateCount++;
                duplicateTitles.push(result.title.substring(0, 60) + '...');
            }
        }

        // Build detailed message
        let message = `Found ${results.length} papers.\n`;
        if (newCount > 0) {
            message += `✅ Added ${newCount} new paper${newCount > 1 ? 's' : ''}\n`;
        }
        if (duplicateCount > 0) {
            message += `ℹ️ Skipped ${duplicateCount} duplicate${duplicateCount > 1 ? 's' : ''} (already in library)\n`;
            if (duplicateCount <= 3) {
                message += `   Examples: ${duplicateTitles.slice(0, 3).join(', ')}`;
            }
        }

        return NextResponse.json({
            success: true,
            totalFound: results.length,
            newCount,
            duplicateCount,
            message,
            query,
            horizon
        });

    } catch (error) {
        console.error('[Auto-Collect] Error:', error);
        return NextResponse.json({
            success: false,
            error: 'Auto-collection failed'
        }, { status: 500 });
    }
}
