import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { searchOnline } from '@/lib/collector';
import { processPaper } from '@/lib/processor';
import { optimizeQuery } from '@/lib/optimizer';

export async function POST(request: Request) {
    try {
        try {
            const { query, horizon, dateFrom, dateTo, useAgent } = await request.json();

            // 0. LLM Optimization
            let optimizedQuery = query || "AI in banking";
            if (useAgent) {
                optimizedQuery = await optimizeQuery(query || "AI in banking");
            }

            // 0.5. Determine sinceDate and toDate
            let sinceDate: Date | undefined;
            let toDate: Date | undefined;

            if (horizon === 'custom' && dateFrom) {
                // dateFrom is expected to be a year number like 2020 or 2023
                // Treat as Jan 1st of that year
                sinceDate = new Date(`${dateFrom}-01-01`);

                if (dateTo) {
                    // Treat as Dec 31st of that year
                    toDate = new Date(`${dateTo}-12-31`);
                }
            } else if (horizon) {
                const now = new Date();
                if (horizon === 'today') sinceDate = new Date(now.setDate(now.getDate() - 1));
                else if (horizon === 'week') sinceDate = new Date(now.setDate(now.getDate() - 7));
                else if (horizon === 'month') sinceDate = new Date(now.setMonth(now.getMonth() - 1));
                else if (horizon === 'year') sinceDate = new Date(now.setFullYear(now.getFullYear() - 1));
            } else {
                const lastPaper = await prisma.paper.findFirst({
                    orderBy: { publicationDate: 'desc' }
                });
                sinceDate = lastPaper ? lastPaper.publicationDate : undefined;
            }

            // 0.6. Get Enabled Sources
            const sources = await prisma.source.findMany({ where: { enabled: true } });

            // 1. Search Online
            const rawPapers = await searchOnline(optimizedQuery, sinceDate, toDate, sources);

            let newCount = 0;

            for (const rawPaper of rawPapers) {
                // 2. Process (Tagging)
                const processedPaper = await processPaper(rawPaper);

                // 3. Save to DB (Check duplicates)
                const existing = await prisma.paper.findFirst({
                    where: { url: processedPaper.url }
                });

                if (!existing) {
                    // Create Paper
                    const savedPaper = await prisma.paper.create({
                        data: {
                            title: processedPaper.title,
                            abstract: processedPaper.abstract,
                            url: processedPaper.url,
                            source: processedPaper.source,
                            publicationDate: processedPaper.publicationDate,
                            collectedAt: new Date(),
                        }
                    });

                    // Create/Link Tags
                    for (const tag of processedPaper.suggestedTags) {
                        // Find or create global Tag
                        let dbTag = await prisma.tag.findUnique({
                            where: { name: tag.name }
                        });

                        if (!dbTag) {
                            dbTag = await prisma.tag.create({
                                data: {
                                    name: tag.name,
                                    type: tag.type
                                }
                            });
                        }

                        // Link Paper with Tag
                        await prisma.paperTag.create({
                            data: {
                                paperId: savedPaper.id,
                                tagId: dbTag.id
                            }
                        });
                    }
                    newCount++;
                }
            }

            // Purge dashboard cache
            revalidatePath('/');

            return NextResponse.json({
                success: true,
                message: `Collection complete. Found ${rawPapers.length} papers (${newCount} new).`,
                newCount,
                totalFound: rawPapers.length
            });

        } catch (error) {
            console.error("Collection Error:", error);
            return NextResponse.json({ success: false, error: "Failed to collect papers" }, { status: 500 });
        }
    } catch (error) {
        console.error("Outer Collection Error:", error);
        return NextResponse.json({ success: false, error: "An unexpected error occurred during collection" }, { status: 500 });
    }
}
