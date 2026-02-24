import { prisma } from "@/lib/db"
import { PaperBrowser } from "@/components/papers/paper-browser"
import { PaperWithTags } from "@/lib/types"
import Breadcrumb from "@/components/ui/breadcrumb"

export default async function PapersPage({
    searchParams,
}: {
    searchParams?: Promise<{
        search?: string
        category?: string
        topic?: string
        sort?: string
    }>
}) {
    const resolvedParams = await searchParams;
    const search = resolvedParams?.search || "";
    const category = resolvedParams?.category;
    const topic = resolvedParams?.topic;
    const sort = resolvedParams?.sort || "newest";

    const whereClause: any = {};

    if (search) {
        whereClause.OR = [
            { title: { contains: search } },
            { abstract: { contains: search } }
        ];
    }

    // Tags filter
    if (category || topic) {
        whereClause.tags = {
            some: {
                tag: {
                    OR: []
                }
            }
        }
        if (category) whereClause.tags.some.tag.OR.push({ category: category });
        if (topic) whereClause.tags.some.tag.OR.push({ name: topic });
    }

    const papers = await prisma.paper.findMany({
        where: whereClause,
        include: {
            tags: { include: { tag: true } },
            favoritedBy: true
        },
        orderBy: {
            collectedAt: sort === 'oldest' ? 'asc' : 'desc'
        }
    });

    const tags = await prisma.tag.findMany({
        orderBy: { name: 'asc' }
    });

    const formattedPapers = papers.map((p: any) => ({
        ...p,
        tags: p.tags.map((pt: any) => pt.tag),
        relevanceScore: p.relevanceScore ?? undefined,
        technicalScore: p.technicalScore ?? undefined,
        businessScore: p.businessScore ?? undefined,
        timelinessScore: p.timelinessScore ?? undefined,
        practicalityScore: p.practicalityScore ?? undefined
    }));

    return (
        <>
            <div className="mb-6">
                <Breadcrumb items={[
                    { label: 'Home', href: '/' },
                    { label: 'Library', href: '/papers' }
                ]} />
            </div>
            <PaperBrowser papers={formattedPapers} availableTags={tags} />
        </>
    );
}
