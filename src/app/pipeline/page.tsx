import { prisma } from "@/lib/db"
import { PipelineView } from "@/components/pipeline/pipeline-view"

export default async function PipelinePage() {
    // Fetch initial data
    const sources = await prisma.source.findMany({ where: { enabled: true } });

    // Fetch recently collected papers (last 6)
    const recentPapers = await prisma.paper.findMany({
        take: 6,
        orderBy: { collectedAt: 'desc' },
        include: { tags: { include: { tag: true } }, favoritedBy: true }
    });

    const formattedPapers = recentPapers.map((p: any) => ({
        ...p,
        tags: p.tags.map((pt: any) => pt.tag)
    }));

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-2">
                <h2 className="text-3xl font-bold tracking-tight">Automated Research Pipeline</h2>
                <p className="text-muted-foreground">Configure the agent to crawl, analyze, and categorize new publications.</p>
            </div>

            <PipelineView
                initialSources={sources}
                recentPapers={formattedPapers}
            />
        </div>
    )
}
