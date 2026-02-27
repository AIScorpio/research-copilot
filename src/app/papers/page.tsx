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
        tag?: string
        sort?: string
    }>
}) {
    const resolvedParams = await searchParams;
    const search = resolvedParams?.search || "";
    const category = resolvedParams?.category;
    const tag = resolvedParams?.tag;
    const sort = resolvedParams?.sort || "newest";

    const whereClause: any = {};

    if (search) {
        whereClause.OR = [
            { title: { contains: search } },
            { abstract: { contains: search } }
        ];
    }

    // Tags filter with AND logic (intersection)
    // Papers must have BOTH the category filter AND the specific tag
    const tagConditions: any[] = [];
    
    if (category) {
        tagConditions.push({
            tags: {
                some: {
                    tag: { category: category }
                }
            }
        });
    }
    
    if (tag) {
        tagConditions.push({
            tags: {
                some: {
                    tag: { name: tag }
                }
            }
        });
    }
    
    if (tagConditions.length > 0) {
        whereClause.AND = tagConditions;
    }

    // Build orderBy based on sort parameter
    let orderBy: any = { collectedAt: 'desc' }; // default newest first
    if (sort === 'oldest') {
        orderBy = { collectedAt: 'asc' };
    } else if (sort === 'relevance-desc') {
        orderBy = { relevanceScore: 'desc' };
    } else if (sort === 'relevance-asc') {
        orderBy = { relevanceScore: 'asc' };
    }

    const papers = await prisma.paper.findMany({
        where: whereClause,
        include: {
            tags: { include: { tag: true } },
            favoritedBy: true
        },
        orderBy: orderBy
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
