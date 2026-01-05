"use client"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Star, Share2, ExternalLink, Plus, Sparkles, Check, X, Loader2, Calendar } from "lucide-react"
import Link from "next/link"
import { useState } from "react"

export function PaperCard({ paper }: { paper: any }) {
    const [favorite, setFavorite] = useState(paper.favoritedBy?.length > 0)
    const [tags, setTags] = useState(paper.tags || [])
    const [newTag, setNewTag] = useState("")
    const [isAdding, setIsAdding] = useState(false)
    const [isAutoTagging, setIsAutoTagging] = useState(false)
    const [suggestions, setSuggestions] = useState<any[]>([])
    const [isDeleted, setIsDeleted] = useState(false)
    const [isEditingDate, setIsEditingDate] = useState(false)
    const [pubDate, setPubDate] = useState(() => {
        const date = new Date(paper.publicationDate);
        return date.toISOString().split('T')[0];
    })
    const [isSavingDate, setIsSavingDate] = useState(false)

    const toggleFavorite = async () => {
        setFavorite(!favorite)
        try {
            await fetch(`/api/papers/${paper.id}/favorite`, { method: 'POST' });
        } catch (e) {
            setFavorite(!favorite) // revert
        }
    }

    const handleDelete = async () => {
        if (!confirm("Are you sure you want to remove this paper from your library?")) return;

        try {
            const res = await fetch(`/api/papers/${paper.id}`, { method: 'DELETE' });
            if (res.ok) {
                setIsDeleted(true);
            } else {
                alert("Failed to delete paper.");
            }
        } catch (e) {
            console.error(e);
            alert("Network error.");
        }
    }

    const handleSaveDate = async () => {
        setIsSavingDate(true);
        try {
            const res = await fetch(`/api/papers/${paper.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ publicationDate: pubDate })
            });

            if (res.ok) {
                setIsEditingDate(false);
            } else {
                alert("Failed to update date.");
            }
        } catch (e) {
            console.error(e);
            alert("Error updating date.");
        } finally {
            setIsSavingDate(false);
        }
    }

    const handleAddTag = async (tagName: string) => {
        if (!tagName.trim()) return;

        console.log('[PaperCard] Adding tag:', tagName, 'to paper:', paper.id);

        try {
            const res = await fetch(`/api/papers/${paper.id}/tags`, {
                method: 'POST',
                body: JSON.stringify({ tagName }),
                headers: { 'Content-Type': 'application/json' }
            });

            console.log('[PaperCard] API Response status:', res.status);
            console.log('[PaperCard] Content-Type:', res.headers.get('content-type'));

            if (res.ok) {
                const added = await res.json();
                console.log('[PaperCard] Tag added successfully:', added);

                if (!tags.find((t: any) => t.name === added.tagName)) {
                    setTags([...tags, { id: added.id, name: added.tagName, type: added.type }]);
                }
                setNewTag("");
                setIsAdding(false);
                setSuggestions(prev => prev.filter(s => s.name !== tagName));
            } else {
                // Try to parse error as JSON, fallback to text
                const contentType = res.headers.get('content-type');
                let errorMsg = `HTTP ${res.status}`;

                if (contentType?.includes('application/json')) {
                    const error = await res.json();
                    errorMsg = error.error || errorMsg;
                } else {
                    const text = await res.text();
                    errorMsg = `${errorMsg}: ${text.substring(0, 100)}`;
                }

                console.error('[PaperCard] API Error:', errorMsg);
                alert(`Failed to save tag: ${errorMsg}`);
            }
        } catch (e) {
            console.error('[PaperCard] Network error:', e);
            alert('Network error: Failed to save tag');
        }
    };

    const handleAutoTag = async () => {
        setIsAutoTagging(true);
        setSuggestions([]);
        try {
            const res = await fetch(`/api/papers/${paper.id}/auto-tag`, { method: 'POST' });
            const data = await res.json();
            if (data.candidates) {
                setSuggestions(data.candidates);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsAutoTagging(false);
        }
    }

    const handleRemoveTag = async (tagId: string) => {
        console.log('[PaperCard] Removing tag:', tagId);
        try {
            const res = await fetch(`/api/papers/${paper.id}/tags`, {
                method: 'DELETE',
                body: JSON.stringify({ tagId }),
                headers: { 'Content-Type': 'application/json' }
            });

            if (res.ok) {
                setTags(tags.filter((t: any) => t.id !== tagId));
                console.log('[PaperCard] Tag removed successfully');
            } else {
                console.error('[PaperCard] Failed to remove tag');
            }
        } catch (e) {
            console.error('[PaperCard] Error removing tag:', e);
        }
    }

    if (isDeleted) return null;

    return (
        <Card className="flex flex-col group relative overflow-hidden transition-all duration-300 hover:shadow-lg">
            {/* Quick Actions Overlay (Hidden by default, shown on group hover/swipe simulation) */}
            <div className="absolute top-0 right-0 p-2 flex gap-1 transform translate-x-full group-hover:translate-x-0 transition-transform duration-300 bg-background/80 backdrop-blur-sm rounded-bl-xl border-l border-b z-10">
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-blue-500" onClick={() => setIsEditingDate(true)} title="Edit Publication Date">
                    <Calendar className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={handleDelete} title="Remove from Library">
                    <X className="h-4 w-4" />
                </Button>
            </div>

            <CardHeader>
                <div className="flex justify-between items-start gap-4">
                    <Link href={`/papers/${paper.id}`} className="hover:underline flex-1">
                        <CardTitle className="text-lg font-semibold leading-tight">{paper.title}</CardTitle>
                    </Link>
                    <Button variant="ghost" size="icon" onClick={toggleFavorite} className={favorite ? "text-yellow-500" : "text-muted-foreground"}>
                        <Star className={`h-4 w-4 ${favorite ? "fill-current" : ""}`} />
                    </Button>
                </div>
                <CardDescription className="flex items-center gap-2 text-xs flex-wrap">
                    <span className="font-medium text-blue-600 dark:text-blue-400">{paper.source}</span>
                    <span>•</span>

                    {isEditingDate ? (
                        <div className="flex items-center gap-1 bg-muted px-2 py-1 rounded-md">
                            <Input
                                type="date"
                                value={pubDate}
                                onChange={(e) => setPubDate(e.target.value)}
                                className="h-6 w-32 text-xs border-none bg-transparent p-0"
                            />
                            <Button size="icon" variant="ghost" className="h-4 w-4 text-green-500" onClick={handleSaveDate} disabled={isSavingDate}>
                                {isSavingDate ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                            </Button>
                            <Button size="icon" variant="ghost" className="h-4 w-4 text-muted-foreground" onClick={() => setIsEditingDate(false)}>
                                <X className="h-3 w-3" />
                            </Button>
                        </div>
                    ) : (
                        <span
                            title="Publication Date (Click to Edit)"
                            className="cursor-pointer hover:text-blue-500 flex items-center gap-1"
                            onClick={() => setIsEditingDate(true)}
                        >
                            📄 {new Date(pubDate).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric'
                            })}
                        </span>
                    )}

                    {paper.collectedAt && (
                        <>
                            <span>•</span>
                            <span className="text-muted-foreground" title="Collected At">📥 {new Date(paper.collectedAt).toLocaleString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                            })}</span>
                        </>
                    )}
                </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 space-y-3">
                <p className="text-sm text-muted-foreground line-clamp-3 leading-relaxed">
                    {paper.abstract}
                </p>

                {/* Tags Section */}
                <div className="space-y-2 pt-2">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground/70">Tags</span>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 text-[10px] uppercase font-bold tracking-tight gap-1 text-indigo-500 hover:text-indigo-400 hover:bg-indigo-50/10"
                            onClick={handleAutoTag}
                            disabled={isAutoTagging}
                        >
                            {isAutoTagging ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                            Auto Tag
                        </Button>
                    </div>

                    {/* AI Suggestions */}
                    {suggestions.length > 0 && (
                        <div className="p-2 bg-indigo-500/5 rounded-lg border border-indigo-500/10 space-y-2">
                            <p className="text-[10px] text-indigo-400 font-bold flex items-center gap-1">
                                <Sparkles className="h-3 w-3" /> AI SUGGESTIONS
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                                {suggestions.map((s) => (
                                    <div key={s.name} className="flex items-center gap-1 bg-background border border-indigo-500/20 px-2 py-0.5 rounded-full text-[10px] font-medium transition-all hover:border-indigo-500/40">
                                        <span>{s.name}</span>
                                        <div className="flex gap-1 ml-1 border-l pl-1 border-gray-200 dark:border-gray-800">
                                            <button
                                                onClick={() => handleAddTag(s.name)}
                                                className="text-green-500 hover:scale-125 transition-transform"
                                            >
                                                <Check className="h-2.5 w-2.5" />
                                            </button>
                                            <button
                                                onClick={() => setSuggestions(prev => prev.filter(i => i.name !== s.name))}
                                                className="text-muted-foreground hover:text-destructive hover:scale-125 transition-transform"
                                            >
                                                <X className="h-2.5 w-2.5" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="flex flex-wrap gap-2 items-center">
                        {tags.length === 0 && suggestions.length === 0 && !isAdding && (
                            <span className="text-xs text-muted-foreground italic opacity-60">No tags identified</span>
                        )}

                        {tags.map((tag: any) => (
                            <div key={tag.id} className="flex items-center gap-1">
                                <Badge
                                    variant={tag.type === "Industrial" ? "default" : tag.type === "Academic" ? "secondary" : "outline"}
                                    className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${tag.type === "User Defined" ? "border-blue-500/30 text-blue-500" : ""}`}
                                >
                                    {tag.name}
                                </Badge>
                                {tag.type === "User Defined" && (
                                    <button
                                        onClick={() => handleRemoveTag(tag.id)}
                                        className="text-muted-foreground hover:text-destructive transition-colors"
                                        title="Remove tag"
                                    >
                                        <X className="h-3 w-3" />
                                    </button>
                                )}
                            </div>
                        ))}

                        {isAdding ? (
                            <div className="flex items-center gap-1">
                                <Input
                                    value={newTag}
                                    onChange={(e) => setNewTag(e.target.value)}
                                    className="h-6 w-28 text-xs font-medium"
                                    placeholder="Enter tag..."
                                    onKeyDown={(e) => e.key === 'Enter' && handleAddTag(newTag)}
                                    autoFocus
                                />
                                <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-6 w-6 text-green-500 hover:text-green-600 hover:bg-green-500/10"
                                    onClick={() => handleAddTag(newTag)}
                                    disabled={!newTag.trim()}
                                >
                                    <Check className="h-3 w-3" />
                                </Button>
                                <Button size="icon" variant="ghost" className="h-6 w-6 text-muted-foreground" onClick={() => setIsAdding(false)}>
                                    <X className="h-3 w-3" />
                                </Button>
                            </div>
                        ) : (
                            <Button variant="ghost" size="sm" className="h-6 text-[10px] font-bold px-2 border border-dashed hover:border-solid hover:bg-muted/50" onClick={() => setIsAdding(true)}>
                                <Plus className="mr-1 h-2.5 w-2.5" /> Add Tag
                            </Button>
                        )}
                    </div>
                </div>
            </CardContent>
            <CardFooter className="border-t pt-4 bg-muted/5 group-hover:bg-muted/10 transition-colors">
                <div className="flex w-full gap-2">
                    <Button variant="outline" size="sm" className="w-full bg-background" asChild>
                        <a href={paper.url} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="mr-2 h-3 w-3" />
                            Read Original
                        </a>
                    </Button>
                    <Button variant="ghost" size="icon" className="group/share" onClick={() => {
                        if (navigator.share) {
                            navigator.share({ title: paper.title, text: paper.abstract, url: paper.url })
                        } else {
                            navigator.clipboard.writeText(paper.url);
                            alert("Link copied to clipboard!");
                        }
                    }}>
                        <Share2 className="h-4 w-4 group-hover/share:text-blue-500 transition-colors" />
                    </Button>
                </div>
            </CardFooter>
        </Card>
    )
}
