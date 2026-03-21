"use client"

import { logger } from "@/lib/logger"

import { useState, useEffect, useCallback } from "react"
import { BookOpen, Calendar, ChevronRight, Share2, Printer, Loader2, Link as LinkIcon, FileText, ChevronDown, ChevronUp, ExternalLink, RefreshCw, AlertCircle, Info } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toast"

interface Digest {
    id: string
    dateCode: string
    title: string
    subtitle: string | null
    content: string
    status: 'draft' | 'published' | 'archived' | 'error'
    actualCount: number
    papers: Array<{
        id: string
        title: string
        url: string
        source: string
    }>
}

interface DigestResponse {
    success: boolean
    status: 'ready' | 'stale' | 'empty' | 'error' | 'generating'
    digest: Digest | null
    digests?: Digest[]
    message?: string
    error?: string
    needsRefresh?: boolean
    paperCount?: number
    fresh?: boolean
}

// Parse content and apply styles manually (like original newsletter)
function renderDigestContent(content: string, papers?: any[]) {
    if (!content) return null
    
    // Convert citation [N] to links
    let processedContent = content
    if (papers && papers.length > 0) {
        papers.forEach((paper, index) => {
            const citation = `[${index + 1}]`
            const link = `<a href="${paper.url}" target="_blank" class="text-indigo-500 hover:underline font-medium">${citation}</a>`
            processedContent = processedContent.split(citation).join(link)
        })
    }
    
    return processedContent.split('\n').map((line: string, i: number) => {
        if (line.startsWith('# ')) return <h1 key={i} className="text-2xl font-bold mb-4">{line.replace('# ', '')}</h1>
        if (line.startsWith('## ')) {
            const text = line.replace('## ', '');
            return <h2 key={i} className={`text-xl font-bold border-l-4 pl-3 mb-3 mt-8 ${text.includes('Appendix') ? 'border-indigo-600 text-indigo-600' : 'border-indigo-500'}`}>{text}</h2>
        }
        if (line.startsWith('### ')) return <h3 key={i} className="text-lg font-bold text-indigo-500 mb-2 mt-6">{line.replace('### ', '')}</h3>
        if (line.startsWith('---')) return <hr key={i} className="my-8 border-indigo-500/20" />
        if (line.startsWith('- ')) {
            // Check if line contains a link
            if (line.includes('<a ')) {
                return <li key={i} className="ml-4 mb-2 text-sm" dangerouslySetInnerHTML={{ __html: line.replace('- ', '') }} />
            }
            return <li key={i} className="ml-4 mb-2 text-sm list-disc">{line.replace('- ', '')}</li>
        }
        if (line.startsWith('**') && line.endsWith('**')) {
            return <p key={i} className="font-bold text-sm mb-2">{line.replace(/\*\*/g, '')}</p>
        }
        if (line.startsWith('*') && line.endsWith('*')) {
            return <p key={i} className="italic text-muted-foreground text-sm mb-4">{line.replace(/\*/g, '')}</p>
        }
        if (line.trim() === '') return <div key={i} className="h-2" />
        // Regular line - check if it contains links
        if (line.includes('<a ')) {
            return <p key={i} className="text-sm mb-2 leading-relaxed" dangerouslySetInnerHTML={{ __html: line }} />
        }
        return <p key={i} className="text-sm mb-2 leading-relaxed">{line}</p>
    })
}

export default function ArchivesPage() {
    const { addToast } = useToast()
    const [digests, setDigests] = useState<Digest[]>([])
    const [selected, setSelected] = useState<Digest | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [expandedLogs, setExpandedLogs] = useState<Record<string, boolean>>({})
    const [isRefreshing, setIsRefreshing] = useState(false)
    const [hasStaleDigest, setHasStaleDigest] = useState(false)
    const [currentPaperCount, setCurrentPaperCount] = useState<number>(0)

    // Fetch digests list
    const fetchDigests = useCallback(async () => {
        try {
            const res = await fetch("/api/daily-digest")
            const data: DigestResponse = await res.json()

            if (!data.success) {
                setError(data.error || "Failed to load digests")
                setDigests([])
                return
            }

            // Handle list response
            if (Array.isArray(data.digests)) {
                setDigests(data.digests)
                if (data.digests.length > 0 && !selected) {
                    setSelected(data.digests[0])
                }
            }
        } catch (err) {
            logger.error("Failed to load archives", { error: err instanceof Error ? err.message : String(err) })
            setError("Failed to load research archives. Please try again later.")
        }
    }, [selected])

    // Load specific digest with lazy loading
    const loadDigestWithLazyLoading = useCallback(async (dateCode: string, isUserAction: boolean = false) => {
        setIsRefreshing(true)
        try {
            const res = await fetch(`/api/daily-digest?date=${dateCode}`)
            const data: DigestResponse = await res.json()

            if (!data.success) {
                if (isUserAction) {
                    addToast(data.error || "Failed to load digest", "error")
                }
                return
            }

            // Edge Case: Empty - no papers for this date
            if (data.status === 'empty') {
                setSelected(null)
                setHasStaleDigest(false)
                setCurrentPaperCount(0)
                if (isUserAction) {
                    addToast("No papers collected for this date", "info")
                }
                // Remove from list if exists
                setDigests(prev => prev.filter(d => d.dateCode !== dateCode))
                return
            }

            // Edge Case: Stale - digest exists but needs refresh
            if (data.status === 'stale' && data.digest) {
                setSelected(data.digest)
                setHasStaleDigest(true)
                setCurrentPaperCount(data.paperCount || 0)
                if (isUserAction) {
                    addToast("Digest is being updated with latest papers...", "info", 3000)
                }
                
                // Auto-refresh after 5 seconds to get fresh content
                setTimeout(() => {
                    loadDigestWithLazyLoading(dateCode, false)
                }, 5000)
                return
            }

            // Success: Ready - digest is up to date
            if (data.status === 'ready' && data.digest) {
                setSelected(data.digest)
                setHasStaleDigest(false)
                setCurrentPaperCount(data.paperCount || data.digest.actualCount)
                
                // Update in list
                setDigests(prev => {
                    const exists = prev.find(d => d.dateCode === dateCode)
                    if (exists) {
                        return prev.map(d => d.dateCode === dateCode ? data.digest! : d)
                    }
                    return [data.digest!, ...prev]
                })

                // Only show success toast on user action and when actually refreshed
                if (isUserAction && data.fresh) {
                    addToast("Digest refreshed successfully", "success", 2000)
                }
                return
            }

            // Error state
            if (data.status === 'error') {
                setError(data.error || "Failed to load digest")
                if (isUserAction) {
                    addToast(data.error || "Failed to load digest", "error")
                }
            }
        } catch (err) {
            logger.error("Failed to load digest", { error: err instanceof Error ? err.message : String(err) })
            if (isUserAction) {
                addToast("Failed to load digest", "error")
            }
        } finally {
            setIsRefreshing(false)
        }
    }, [addToast])

    // Initial load - fetch list only
    useEffect(() => {
        const init = async () => {
            await fetchDigests()
            setLoading(false)
        }
        init()
    }, [fetchDigests])

    // Silent check on initial load after list is fetched
    useEffect(() => {
        if (!loading && selected && digests.length > 0) {
            // Silent check for initial load - isUserAction=false
            loadDigestWithLazyLoading(selected.dateCode, false)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loading])

    // Handle digest selection with lazy loading - only trigger on user click
    const handleSelectDigest = (digest: Digest) => {
        // Only load if selecting a different digest
        if (selected?.id !== digest.id) {
            // Pass isUserAction=true to show toasts
            loadDigestWithLazyLoading(digest.dateCode, true)
        }
    }

    // Manual refresh
    const handleManualRefresh = async () => {
        if (!selected) return
        
        setIsRefreshing(true)
        try {
            const res = await fetch("/api/daily-digest", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ dateCode: selected.dateCode })
            })
            const data = await res.json()

            if (data.success && data.digest) {
                setSelected(data.digest)
                setHasStaleDigest(false)
                addToast("Digest regenerated successfully", "success")
                
                // Update in list
                setDigests(prev => prev.map(d => 
                    d.dateCode === data.digest.dateCode ? data.digest : d
                ))
            } else {
                addToast(data.error || "Failed to regenerate digest", "error")
            }
        } catch (err) {
            logger.error("Failed to regenerate digest", { error: err instanceof Error ? err.message : String(err) })
            addToast("Failed to regenerate digest", "error")
        } finally {
            setIsRefreshing(false)
        }
    }

    const toggleExpand = (e: React.MouseEvent, logId: string) => {
        e.stopPropagation();
        setExpandedLogs(prev => ({ ...prev, [logId]: !prev[logId] }));
    }

    if (loading) {
        return (
            <div className="flex h-[80vh] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Intelligence Archives</h1>
                    <p className="text-muted-foreground">Access your daily AI-synthesized research digests.</p>
                </div>
                {selected && (
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleManualRefresh}
                        disabled={isRefreshing}
                        className="gap-2"
                    >
                        <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                        {isRefreshing ? 'Refreshing...' : 'Regenerate'}
                    </Button>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 h-[calc(100vh-12rem)]">
                {/* List Sidebar */}
                <div className="md:col-span-4 space-y-3 overflow-y-auto pr-2 custom-scrollbar">
                    {error && (
                        <div className="p-4 mb-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 text-xs flex items-center gap-2">
                            <AlertCircle className="h-4 w-4" />
                            <span className="font-bold">Error:</span> {error}
                        </div>
                    )}
                    {digests.length === 0 ? (
                        <div className="p-8 text-center border rounded-xl bg-muted/20 text-muted-foreground">
                            <BookOpen className="h-8 w-8 mx-auto mb-2 opacity-20" />
                            <p className="text-sm font-medium">No digests archived yet.</p>
                            <p className="text-[10px]">Run auto-collection to generate your first daily digest.</p>
                        </div>
                    ) : (
                        digests.map((digest) => (
                            <div key={digest.id} className="space-y-1">
                                <div
                                    onClick={() => handleSelectDigest(digest)}
                                    role="button"
                                    tabIndex={0}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSelectDigest(digest)}
                                    className={`w-full text-left p-4 rounded-xl border transition-all hover:shadow-md group relative cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${selected?.id === digest.id
                                        ? 'bg-indigo-500/10 border-indigo-500/30'
                                        : 'bg-card border-indigo-500/5 hover:border-indigo-500/20'
                                        }`}
                                >
                                    <div className="flex items-center gap-2 text-[10px] font-bold text-indigo-500 uppercase tracking-tighter mb-1">
                                        <Calendar className="h-3 w-3" />
                                        {new Date(digest.dateCode).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                                    </div>
                                    <h4 className="font-bold text-sm line-clamp-2 mb-1 group-hover:text-indigo-600 transition-colors">
                                        {digest.title || `Research Digest: ${digest.dateCode}`}
                                    </h4>

                                    <div className="flex items-center justify-between mt-2">
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] py-0.5 px-2 bg-indigo-500/5 text-indigo-600 rounded-full font-bold">
                                                {digest.actualCount} Papers
                                            </span>
                                            {selected?.id === digest.id && hasStaleDigest && (
                                                <span className="text-[10px] py-0.5 px-2 bg-amber-500/10 text-amber-600 rounded-full font-bold animate-pulse">
                                                    Updating...
                                                </span>
                                            )}
                                            <button
                                                onClick={(e) => toggleExpand(e, digest.id)}
                                                className="p-1 hover:bg-indigo-500/10 rounded-full transition-colors text-indigo-500"
                                            >
                                                {expandedLogs[digest.id] ? (
                                                    <ChevronUp className="h-4 w-4" />
                                                ) : (
                                                    <ChevronDown className="h-4 w-4" />
                                                )}
                                            </button>
                                        </div>
                                        <ChevronRight className={`h-4 w-4 text-indigo-500 transition-transform ${selected?.id === digest.id ? 'rotate-90' : ''}`} />
                                    </div>
                                </div>

                                {expandedLogs[digest.id] && digest.papers && (
                                    <div className="ml-4 pl-3 border-l-2 border-indigo-500/10 space-y-2 py-2 animate-in slide-in-from-top-2 fade-in duration-200">
                                        {digest.papers.map((paper: any) => (
                                            <div key={paper.id} className="flex items-start gap-2 p-2 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors group/item">
                                                <FileText className="h-3 w-3 mt-0.5 text-muted-foreground group-hover/item:text-indigo-500" />
                                                <div className="min-w-0">
                                                    <p className="text-[10px] font-medium leading-tight line-clamp-2">{paper.title}</p>
                                                    <div className="flex gap-2 items-center mt-1">
                                                        <span className="text-[8px] uppercase tracking-tighter font-bold opacity-50">{paper.source}</span>
                                                        <a href={paper.url} target="_blank" rel="noopener noreferrer" className="text-[8px] text-indigo-500 hover:underline flex items-center gap-0.5">
                                                            source <ExternalLink className="h-2 w-2" />
                                                        </a>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>

                {/* Detail View */}
                <div className="md:col-span-8 border rounded-xl bg-card overflow-hidden flex flex-col">
                    {selected ? (
                        <>
                            {/* Header */}
                            <div className="p-6 border-b bg-gradient-to-r from-indigo-500/5 to-purple-500/5">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 text-[10px] font-bold text-indigo-500 uppercase tracking-tighter mb-2">
                                            <Calendar className="h-3 w-3" />
                                            {new Date(selected.dateCode).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                                        </div>
                                        <h2 className="text-2xl font-bold">{selected.title || `Research Digest: ${selected.dateCode}`}</h2>
                                        <p className="text-sm text-muted-foreground mt-1">
                                            {selected.subtitle || `Daily intelligence digest with ${selected.actualCount} papers`}
                                        </p>
                                        
                                        {/* Stale digest warning */}
                                        {hasStaleDigest && (
                                            <div className="mt-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-700 text-xs flex items-center gap-2">
                                                <Info className="h-4 w-4" />
                                                <div>
                                                    <span className="font-bold">Updating:</span> This digest is being refreshed with the latest papers ({currentPaperCount} papers detected). Content will update automatically.
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            className="h-8 w-8"
                                            onClick={() => {
                                                navigator.clipboard.writeText(window.location.href)
                                                addToast("Link copied to clipboard", "success")
                                            }}
                                        >
                                            <LinkIcon className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            className="h-8 w-8"
                                            onClick={() => window.print()}
                                        >
                                            <Printer className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            className="h-8 w-8"
                                        >
                                            <Share2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            </div>

                            {/* Content */}
                            <div className="flex-1 overflow-y-auto p-6">
                                <div className="max-w-none">
                                    {selected.content ? (
                                        renderDigestContent(selected.content, selected.papers)
                                    ) : (
                                        <div className="text-center py-12 text-muted-foreground">
                                            <Loader2 className="h-8 w-8 mx-auto mb-4 animate-spin text-indigo-500" />
                                            <p>Digest content is being generated...</p>
                                            <p className="text-xs mt-2">Status: {selected.status}</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex items-center justify-center text-muted-foreground">
                            <div className="text-center">
                                <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-20" />
                                <p className="text-sm">Select a digest to view details</p>
                                {currentPaperCount === 0 && (
                                    <p className="text-xs mt-2 text-muted-foreground">No papers available for this date</p>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
