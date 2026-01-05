import { prisma } from "@/lib/db"
import { PaperBrowser } from "@/components/papers/paper-browser"
import { PaperWithTags } from "@/lib/types"

export default async function PapersPage({
    searchParams,
}: {
    searchParams?: Promise<{
        search?: string
        sector?: string
        topic?: string
        sort?: string
    }>
}) {
    const resolvedParams = await searchParams;
    const search = resolvedParams?.search || "";
    const sector = resolvedParams?.sector;
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
    if (sector || topic) {
        whereClause.tags = {
            some: {
                tag: {
                    OR: []
                }
            }
        }
        if (sector) whereClause.tags.some.tag.OR.push({ name: sector });
        if (topic) whereClause.tags.some.tag.OR.push({ name: topic });
    }

    const papers = await prisma.paper.findMany({
        where: whereClause,
        include: {
            tags: { include: { tag: true } },
            favoritedBy: true
        },
        orderBy: {
            publicationDate: sort === 'oldest' ? 'asc' : 'desc'
        }
    });

    const tags = await prisma.tag.findMany({
        orderBy: { name: 'asc' }
    });

    const formattedPapers = papers.map((p: PaperWithTags) => ({
        ...p,
        tags: p.tags.map(pt => pt.tag)
    }));

    return <PaperBrowser papers={formattedPapers} availableTags={tags} />
}
