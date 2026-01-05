"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Plus, Sparkles, Check, X, Loader2 } from "lucide-react"

export function CustomTags({ paperId, initialTags }: { paperId: string, initialTags: any[] }) {
    const [tags, setTags] = useState(initialTags);
    const [newTag, setNewTag] = useState("");
    const [isAdding, setIsAdding] = useState(false);

    // Auto-Tag State
    const [isAutoTagging, setIsAutoTagging] = useState(false);
    const [suggestions, setSuggestions] = useState<any[]>([]);

    const handleAddTag = async (tagName: string) => {
        if (!tagName.trim()) return;

        try {
            const res = await fetch(`/api/papers/${paperId}/tags`, {
                method: 'POST',
                body: JSON.stringify({ tagName }),
                headers: { 'Content-Type': 'application/json' }
            });

            if (res.ok) {
                const added = await res.json();
                // The API returns { id, tagName, type }
                if (!tags.find(t => t.tagName === added.tagName)) {
                    setTags([...tags, added]);
                }
                setNewTag("");
                setIsAdding(false);
                // Remove from suggestions if present
                setSuggestions(prev => prev.filter(s => s.name !== tagName));
            }
        } catch (e) {
            console.error(e);
        }
    };

    const handleAutoTag = async () => {
        setIsAutoTagging(true);
        setSuggestions([]);
        try {
            const res = await fetch(`/api/papers/${paperId}/auto-tag`, { method: 'POST' });
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

    return (
        <div className="mt-6 space-y-4">
            <div>
                <div className="flex justify-between items-center mb-3">
                    <h3 className="font-semibold">Tags</h3>
                    <Button
                        variant="outline"
                        size="sm"
                        className="text-xs h-7 gap-1 text-indigo-400 border-indigo-500/30 hover:bg-indigo-950/30"
                        onClick={handleAutoTag}
                        disabled={isAutoTagging}
                    >
                        {isAutoTagging ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                        Auto-Tag with AI
                    </Button>
                </div>

                {/* Suggestions Area */}
                {suggestions.length > 0 && (
                    <div className="mb-4 p-3 bg-muted/50 rounded-lg border border-dashed animate-in slide-in-from-top-2">
                        <p className="text-xs text-muted-foreground mb-2 flex items-center gap-2">
                            <Sparkles className="h-3 w-3" /> AI Suggestions:
                        </p>
                        <div className="flex flex-wrap gap-2">
                            {suggestions.map((s) => (
                                <div key={s.name} className="flex items-center gap-1 bg-background border px-2 py-1 rounded-full text-xs">
                                    <span>{s.name}</span>
                                    <button
                                        onClick={() => handleAddTag(s.name)}
                                        className="text-green-500 hover:bg-green-500/10 rounded-full p-0.5"
                                    >
                                        <Check className="h-3 w-3" />
                                    </button>
                                    <button
                                        onClick={() => setSuggestions(prev => prev.filter(i => i.name !== s.name))}
                                        className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full p-0.5"
                                    >
                                        <X className="h-3 w-3" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <div className="flex flex-wrap gap-2 items-center">
                    {/* Existing Tags (User + Global from Props) */}
                    {tags.map((t) => (
                        <Badge key={t.id || t.tagName} variant="secondary">
                            {t.tagName || t.name}
                        </Badge>
                    ))}

                    {isAdding ? (
                        <div className="flex items-center gap-2">
                            <Input
                                value={newTag}
                                onChange={(e) => setNewTag(e.target.value)}
                                className="h-6 w-24 text-xs"
                                placeholder="New tag"
                                onKeyDown={(e) => e.key === 'Enter' && handleAddTag(newTag)}
                            />
                            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => handleAddTag(newTag)}>
                                <Plus className="h-3 w-3" />
                            </Button>
                        </div>
                    ) : (
                        <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setIsAdding(true)}>
                            <Plus className="mr-1 h-3 w-3" /> Add Tag
                        </Button>
                    )}
                </div>
            </div>
        </div>
    )
}
