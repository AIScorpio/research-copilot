"use client"

import { useState } from "react"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { SearchBar } from "@/components/papers/search-bar"
import { PaperCard } from "@/components/papers/paper-card"
import { Button } from "@/components/ui/button"
import { LayoutGrid, List as ListIcon, X } from "lucide-react"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"

interface Paper {
    id: string;
    title: string;
    abstract: string | null;
    url: string;
    source: string;
    publicationDate: Date | string;
    collectedAt?: Date | string;
    aiSummary?: string | null;
    favoritedBy?: unknown[];
    tags?: { id: string; name: string; type: string }[];
    relevanceScore?: number;
    technicalScore?: number;
    businessScore?: number;
    timelinessScore?: number;
    practicalityScore?: number;
}

interface PaperListProps {
    papers: Paper[];
    availableTags: { id: string; name: string }[];
}

export function PaperBrowser({ papers, availableTags }: PaperListProps) {
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('list')
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()

    const currentSector = searchParams.get('sector')
    const currentTopic = searchParams.get('topic')
    const currentSearch = searchParams.get('search')

    const handleSortChange = (value: string) => {
        const params = new URLSearchParams(searchParams);
        params.set('sort', value);
        router.replace(`${pathname}?${params.toString()}`);
    }

    const handleTagChange = (value: string) => {
        const params = new URLSearchParams(searchParams);
        if (value === 'all') {
            params.delete('topic'); // Unified to 'topic' parameter for simplicity
        } else {
            params.set('topic', value);
        }
        router.replace(`${pathname}?${params.toString()}`);
    }

    const clearFilters = () => {
        router.replace('/papers');
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                        <h2 className="text-3xl font-bold tracking-tight">Research Library</h2>
                        <p className="text-muted-foreground">Browse and search your collected research papers.</p>
                    </div>
                    <SearchBar />
                </div>

                <div className="flex items-center gap-2 pb-4 border-b">
                    <Select defaultValue="newest" onValueChange={handleSortChange}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Sort by" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="newest">Newest First</SelectItem>
                            <SelectItem value="oldest">Oldest First</SelectItem>
                        </SelectContent>
                    </Select>

                    <Select onValueChange={handleTagChange}>
                        <SelectTrigger className="w-[200px]">
                            <SelectValue placeholder="Filter by Tag" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Tags</SelectItem>
                            {availableTags.map(tag => (
                                <SelectItem key={tag.id} value={tag.name}>{tag.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <div className="ml-auto flex gap-1 bg-muted p-1 rounded-lg">
                        <Button
                            variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                            size="sm"
                            onClick={() => setViewMode('list')}
                        >
                            <ListIcon className="h-4 w-4" />
                        </Button>
                        <Button
                            variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                            size="sm"
                            onClick={() => setViewMode('grid')}
                        >
                            <LayoutGrid className="h-4 w-4" />
                        </Button>
                    </div>
                </div>

                {/* Active Filters Display */}
                {(currentSector || currentTopic || currentSearch) && (
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm text-muted-foreground">Active filters:</span>
                        {currentSector && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded text-sm">
                                Sector: {currentSector}
                            </span>
                        )}
                        {currentTopic && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded text-sm">
                                Topic: {currentTopic}
                            </span>
                        )}
                        {currentSearch && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-700 rounded text-sm">
                                Search: {currentSearch}
                            </span>
                        )}
                        <button
                            onClick={clearFilters}
                            className="inline-flex items-center gap-1 px-2 py-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
                        >
                            <X className="h-3 w-3" />
                            Clear all
                        </button>
                    </div>
                )}
            </div>

            {papers.length === 0 ? (
                <div className="text-center py-20 bg-muted/20 rounded-lg">
                    <p className="text-muted-foreground">No papers found. Try running a collection or adjusting your search.</p>
                </div>
            ) : (
                <div className={viewMode === 'grid' ? "grid gap-6 md:grid-cols-2 lg:grid-cols-3" : "grid gap-4 grid-cols-1"}>
                    {papers.map((paper) => (
                        <PaperCard key={paper.id} paper={paper} />
                    ))}
                </div>
            )}
        </div>
    )
}
