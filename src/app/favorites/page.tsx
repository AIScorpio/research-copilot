import { prisma } from "@/lib/db"
import { PaperCard } from "@/components/papers/paper-card"
import { cookies } from "next/headers"
import { PaperWithTags } from "@/lib/types"

const MOCK_USER_ID = "user-1"; // Consistent with API

export default async function FavoritesPage() {
    // Ideally check session here
    // const cookieStore = cookies();
    // const userId = cookieStore.get('auth_user')?.value;

    const favorites = await prisma.userFavorite.findMany({
        where: { userId: MOCK_USER_ID },
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

    const formattedPapers = favorites.map((f) => ({
        ...f.paper,
        tags: f.paper.tags.map((pt) => pt.tag)
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
