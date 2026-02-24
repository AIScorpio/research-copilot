import { prisma } from "@/lib/db"
import { Button } from "@/components/ui/button"
import { ArrowLeft, ExternalLink, Calendar, Database, Share2 } from "lucide-react"
import Link from "next/link"
import { notFound } from "next/navigation"
import { CustomTags } from "@/components/papers/custom-tags"
import { AISummary } from "@/components/papers/ai-summary"
import { getAuthUser } from "@/lib/session"

export const dynamic = 'force-dynamic'

export default async function PaperDetailPage({
    params,
}: {
    params: Promise<{ id: string }>
}) {
    const { id } = await params;
    const user = await getAuthUser();
    
    const paper = await prisma.paper.findUnique({
        where: { id },
        include: {
            tags: {
                include: {
                    tag: true
                }
            },
            userTags: user ? {
                where: { userId: user.id }
            } : false
        }
    });

    if (!paper) {
        notFound();
    }

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            <div>
                <Button variant="ghost" size="sm" asChild className="mb-4 -ml-2 text-muted-foreground hover:text-foreground">
                    <Link href="/papers">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to Library
                    </Link>
                </Button>
                <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground mb-4">
                    {paper.title}
                </h1>
                <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                        <Database className="h-4 w-4" />
                        <span>{paper.source}</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        <span>{new Date(paper.publicationDate).toLocaleDateString()}</span>
                    </div>
                </div>
            </div>

            <div className="grid gap-8 md:grid-cols-3">
                <div className="md:col-span-2 space-y-8">
                    <section>
                        <h3 className="text-lg font-semibold mb-3">Abstract</h3>
                        <p className="leading-7 text-muted-foreground">
                            {paper.abstract}
                        </p>
                    </section>

                    {paper.assessmentReason && (
                        <section>
                            <h3 className="text-lg font-semibold mb-3">Why Collected</h3>
                            <p className="leading-7 text-muted-foreground">
                                {paper.assessmentReason}
                            </p>
                        </section>
                    )}

                    <section>
                        <h3 className="text-lg font-semibold mb-3">AI Perspective</h3>
                        <AISummary
                            paperId={paper.id}
                            initialSummary={paper.aiSummary}
                        />
                    </section>
                </div>

                <div className="space-y-6">
                    <div className="p-6 border rounded-lg bg-card text-card-foreground shadow-sm">
                        <h3 className="font-semibold mb-4">Actions</h3>
                        <div className="flex flex-col gap-3">
                            <Button className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700" asChild>
                                <a href={paper.url} target="_blank" rel="noopener noreferrer">
                                    Read Full Paper <ExternalLink className="ml-2 h-4 w-4" />
                                </a>
                            </Button>
                            <Button variant="outline" className="w-full">
                                <Share2 className="mr-2 h-4 w-4" /> Share
                            </Button>
                        </div>
                    </div>

                    {paper.relevanceScore !== null && paper.relevanceScore !== undefined && (
                        <div className="p-4 border rounded-lg bg-card text-card-foreground shadow-sm">
                            <h3 className="font-semibold mb-3">Assessment Scores</h3>
                            <div className="text-sm space-y-1.5">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Technical:</span>
                                    <span className="font-medium">{paper.technicalScore?.toFixed(1) ?? 'N/A'}/10</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Business:</span>
                                    <span className="font-medium">{paper.businessScore?.toFixed(1) ?? 'N/A'}/10</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Timeliness:</span>
                                    <span className="font-medium">{paper.timelinessScore?.toFixed(1) ?? 'N/A'}/10</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Practicality:</span>
                                    <span className="font-medium">{paper.practicalityScore?.toFixed(1) ?? 'N/A'}/10</span>
                                </div>
                                <div className="border-t my-2"></div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Base Score:</span>
                                    <span className="font-medium">
                                        {paper.technicalBonusApplied 
                                            ? (paper.relevanceScore / 1.05).toFixed(2) 
                                            : paper.relevanceScore.toFixed(2)}
                                    </span>
                                </div>
                                {paper.technicalBonusApplied && (
                                    <div className="flex justify-between text-amber-600 dark:text-amber-400">
                                        <span>Technical Bonus:</span>
                                        <span className="font-medium">+5% ⚡</span>
                                    </div>
                                )}
                                <div className="flex justify-between pt-1 border-t font-semibold">
                                    <span>Final Score:</span>
                                    <span className={
                                        paper.relevanceScore >= 8 ? 'text-green-600 dark:text-green-400' :
                                        paper.relevanceScore >= 6 ? 'text-yellow-600 dark:text-yellow-400' :
                                        paper.relevanceScore >= 5 ? 'text-orange-600 dark:text-orange-400' :
                                        'text-red-600 dark:text-red-400'
                                    }>{paper.relevanceScore.toFixed(2)}/10</span>
                                </div>
                            </div>
                        </div>
                    )}

                    <div>
                        <CustomTags
                            paperId={paper.id}
                            // Combine Global Tags + User Tags for the manager
                            initialTags={[
                                ...paper.tags.map((pt: any) => ({
                                    id: pt.tag.id,
                                    tagName: pt.tag.name,
                                    category: pt.tag.category
                                })),
                                ...paper.userTags
                            ]}
                        />
                    </div>

                    <div>
                        <h3 className="font-semibold mb-3">Metadata</h3>
                        <div className="text-sm space-y-2 text-muted-foreground">
                            <p>Collected: {new Date(paper.collectedAt).toLocaleDateString()}</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
