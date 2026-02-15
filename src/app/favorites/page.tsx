import { prisma } from "@/lib/db"
import { PaperCard } from "@/components/papers/paper-card"
import { getAuthUser } from "@/lib/session"
import { redirect } from "next/navigation"

export const dynamic = 'force-dynamic'

export default async function FavoritesPage() {
    const user = await getAuthUser()
    
    if (!user) {
        redirect('/login')
    }

    const favorites = await prisma.userFavorite.findMany({
        where: { userId: user.id },
        include: {
            paper: {
                include: {
                    tags: {
                        include: {
                            tag: true
                        }
                    },
                    favoritedBy: true
                }
            }
        },
        orderBy: {
            paper: {
                publicationDate: 'desc'
            }
        }
    });

    const formattedPapers = favorites.map((f: any) => ({
        ...f.paper,
        tags: f.paper.tags.map((pt: any) => pt.tag),
        relevanceScore: f.paper.relevanceScore ?? undefined,
        technicalScore: f.paper.technicalScore ?? undefined,
        businessScore: f.paper.businessScore ?? undefined,
        timelinessScore: f.paper.timelinessScore ?? undefined,
        practicalityScore: f.paper.practicalityScore ?? undefined
    }));

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-3xl font-bold tracking-tight">Your Favorites</h2>
                <p className="text-muted-foreground">Access your saved research papers.</p>
            </div>

            {formattedPapers.length === 0 ? (
                <div className="text-center py-20 bg-muted/20 rounded-lg">
                    <p className="text-muted-foreground">You haven't saved any papers yet.</p>
                </div>
            ) : (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {formattedPapers.map((paper) => (
                        <PaperCard key={paper.id} paper={paper} />
                    ))}
                </div>
            )}
        </div>
    )
}
