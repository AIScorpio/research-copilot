"use client"

import { logger } from "@/lib/logger"

import { useState, useEffect } from "react"
import { BookOpen, Calendar, ChevronRight, Share2, Printer, Loader2, Link as LinkIcon, FileText, ChevronDown, ChevronUp, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function ArchivesPage() {
    const [newsletters, setNewsletters] = useState<any[]>([])
    const [selected, setSelected] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [expandedLogs, setExpandedLogs] = useState<Record<string, boolean>>({})

    useEffect(() => {
        fetch("/api/newsletters")
            .then(res => res.json())
            .then(data => {
                if (data.success && Array.isArray(data.newsletters)) {
                    setNewsletters(data.newsletters)
                    if (data.newsletters.length > 0) setSelected(data.newsletters[0])
                } else if (data.error) {
                    setError(data.error);
                    setNewsletters([]);
                }
                setLoading(false)
            })
            .catch(err => {
                logger.error("Failed to load archives", { error: err instanceof Error ? err.message : String(err) })
                setError("Failed to load research archives. Please try again later.")
                setLoading(false)
            })
    }, [])

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
                    <p className="text-muted-foreground">Access your daily diary of AI-synthesized research reports.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 h-[calc(100vh-12rem)]">
                {/* List Sidebar */}
                <div className="md:col-span-4 space-y-3 overflow-y-auto pr-2 custom-scrollbar">
                    {error && (
                        <div className="p-4 mb-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 text-xs flex items-center gap-2">
                            <span className="font-bold">Error:</span> {error}
                        </div>
                    )}
                    {newsletters.length === 0 ? (
                        <div className="p-8 text-center border rounded-xl bg-muted/20 text-muted-foreground">
                            <BookOpen className="h-8 w-8 mx-auto mb-2 opacity-20" />
                            <p className="text-sm font-medium">No reports archived yet.</p>
                            <p className="text-[10px]">Run a collection with newsletters enabled to generate your first diary entry.</p>
                        </div>
                    ) : (
                        newsletters.map((log) => (
                            <div key={log.id} className="space-y-1">
                                <div
                                    onClick={() => setSelected(log)}
                                    role="button"
                                    tabIndex={0}
                                    onKeyDown={(e) => e.key === 'Enter' && setSelected(log)}
                                    className={`w-full text-left p-4 rounded-xl border transition-all hover:shadow-md group relative cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${selected?.id === log.id
                                        ? 'bg-indigo-500/10 border-indigo-500/30'
                                        : 'bg-card border-indigo-500/5 hover:border-indigo-500/20'
                                        }`}
                                >
                                    <div className="flex items-center gap-2 text-[10px] font-bold text-indigo-500 uppercase tracking-tighter mb-1">
                                        <Calendar className="h-3 w-3" />
                                        {new Date(log.createdAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                                    </div>
                                    <h4 className="font-bold text-sm line-clamp-2 mb-1 group-hover:text-indigo-600 transition-colors">
                                        {log.title}
                                    </h4>

                                    <div className="flex items-center justify-between mt-2">
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] py-0.5 px-2 bg-indigo-500/5 text-indigo-600 rounded-full font-bold">
                                                {log.paperCount} Papers
                                            </span>
                                            <button
                                                onClick={(e) => toggleExpand(e, log.id)}
                                                className="p-1 hover:bg-indigo-500/10 rounded-full transition-colors text-indigo-500"
                                            >
                                                {expandedLogs[log.id] ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                                            </button>
                                        </div>
                                        <ChevronRight className={`h-4 w-4 transition-transform ${selected?.id === log.id ? 'translate-x-1' : ''}`} />
                                    </div>
                                </div>

                                {/* Expanded Paper List */}
                                {expandedLogs[log.id] && (
                                    <div className="ml-4 pl-3 border-l-2 border-indigo-500/10 space-y-2 py-2 animate-in slide-in-from-top-2 fade-in duration-200">
                                        {log.papers?.map((paper: any) => (
                                            <div key={paper.id} className="flex items-start gap-2 p-2 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors group/item">
                                                <FileText className="h-3 w-3 mt-0.5 text-muted-foreground group-hover/item:text-indigo-500" />
                                                <div className="min-w-0">
                                                    <p className="text-[10px] font-medium leading-tight line-clamp-2">{paper.title}</p>
                                                    <div className="flex gap-2 items-center mt-1">
                                                        <span className="text-[8px] uppercase tracking-tighter font-bold opacity-50">{paper.source}</span>
                                                        <a href={paper.url} target="_blank" rel="noopener noreferrer" className="text-[8px] text-indigo-500 hover:underline flex items-center gap-0.5">
                                                            source <LinkIcon className="h-2 w-2" />
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

                {/* Content Viewer */}
                <div className="md:col-span-8 bg-card border rounded-xl shadow-inner border-indigo-500/10 overflow-hidden flex flex-col">
                    {selected ? (
                        <>
                            <div className="p-6 border-b bg-muted/10 flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="h-10 w-10 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-600">
                                        <BookOpen className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold">{selected.title}</h3>
                                        <p className="text-xs text-muted-foreground">{new Date(selected.createdAt).toLocaleString()}</p>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-indigo-500">
                                        <Share2 className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-indigo-500">
                                        <Printer className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                            <div className="p-8 overflow-y-auto flex-1 prose prose-sm dark:prose-invert max-w-none prose-headings:text-indigo-600 prose-headings:dark:text-indigo-400 prose-strong:text-foreground">
                                <div className="space-y-6">
                                    {selected.content.split('\n').map((line: string, i: number) => {
                                        if (line.startsWith('# ')) return <h1 key={i} className="text-2xl font-bold mb-4">{line.replace('# ', '')}</h1>
                                        if (line.startsWith('## ')) {
                                            const text = line.replace('## ', '');
                                            return <h2 key={i} className={`text-xl font-bold border-l-4 pl-3 mb-3 mt-8 ${text.includes('Appendix') ? 'border-indigo-600 text-indigo-600' : 'border-indigo-500'}`}>{text}</h2>
                                        }
                                        if (line.startsWith('### ')) return <h3 key={i} className="text-lg font-bold text-indigo-500 mb-2 mt-6">{line.replace('### ', '')}</h3>
                                        if (line.startsWith('---')) return <hr key={i} className="my-8 border-indigo-500/20" />
                                        if (line.startsWith('- ')) {
                                            const match = line.match(/- \[(.*?)\]\((.*?)\)(.*)/);
                                            if (match) {
                                                return (
                                                    <div key={i} className="flex items-start gap-2 p-3 rounded-lg bg-indigo-500/5 my-2 hover:bg-indigo-500/10 transition-all border border-transparent hover:border-indigo-500/20 group">
                                                        <FileText className="h-4 w-4 mt-1 text-indigo-600 opacity-50 group-hover:opacity-100" />
                                                        <div>
                                                            <a href={match[2]} target="_blank" rel="noopener noreferrer" className="font-bold text-indigo-600 hover:underline block mb-1">
                                                                {match[1]} <ExternalLink className="h-3 w-3 inline ml-1 opacity-0 group-hover:opacity-100 transition-opacity" />
                                                            </a>
                                                            <p className="text-[10px] text-muted-foreground italic">{match[3].trim()}</p>
                                                        </div>
                                                    </div>
                                                )
                                            }
                                            return <li key={i} className="ml-4 list-disc mb-1">{line.replace('- ', '')}</li>
                                        }
                                        if (line.startsWith('**')) return <p key={i} className="font-bold my-2">{line.replace(/\*\*/g, '')}</p>
                                        return line.trim() ? <p key={i} className="text-muted-foreground leading-relaxed my-3">{line}</p> : <div key={i} className="h-2" />
                                    })}
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="flex flex-col h-full items-center justify-center text-muted-foreground opacity-50 space-y-4">
                            <BookOpen className="h-16 w-16" />
                            <p className="font-medium">Selected a report to read the detailed synthesis.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
