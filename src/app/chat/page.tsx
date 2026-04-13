"use client"

import { useState, useRef, useEffect, useCallback, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet"
import {
    Bot,
    Send,
    User,
    Plus,
    MessageSquare,
    ChevronDown,
    MoreHorizontal,
    Pencil,
    Trash2,
    ExternalLink,
    FileText,
    ChevronRight,
    Loader2,
    Sparkles,
} from "lucide-react"
import { marked } from "marked"
import DOMPurify from "dompurify"

interface Message {
    role: "user" | "assistant"
    content: string
    sources?: Source[]
    suggestions?: string[]
}

interface Source {
    id: string
    title: string
    url?: string
    authors?: string[]
    year?: string
    snippet?: string
}

interface ModelOption {
    providerType: string
    providerName: string
    externalId: string
    modelName: string
    value: string
}

interface ChatSession {
    id: string
    title: string
    messages: Message[]
    model?: ModelOption
}

const DEFAULT_WELCOME = "Hello! I'm your research intelligence assistant for banking/financial services AI research. I can help you analyze trends, compare papers, identify gaps, and provide insights across risk management, compliance, fraud detection, credit assessment, and model governance.\n\nWhat specific research questions or topics would you like to explore today?"

function renderMarkdown(text: string): string {
    marked.setOptions({
        breaks: true,
        gfm: true,
    })
    const raw = marked.parse(text) as string
    return DOMPurify.sanitize(raw)
}

function stripSuggestionsFromContent(content: string): string {
    return content
        .replace(/\*\*Suggested questions:\*\*\n[\s\S]*?(?:\n---|$)/, "")
        .trim()
}

function ModelSelector({
    models,
    selected,
    onSelect,
}: {
    models: ModelOption[]
    selected: ModelOption | null
    onSelect: (m: ModelOption) => void
}) {
    const grouped = useMemo(() => {
        const map = new Map<string, ModelOption[]>()
        for (const m of models) {
            const existing = map.get(m.providerName) || []
            existing.push(m)
            map.set(m.providerName, existing)
        }
        return map
    }, [models])

    return (
        <Select
            value={selected?.value || ""}
            onValueChange={(v) => {
                const m = models.find((x) => x.value === v)
                if (m) onSelect(m)
            }}
        >
            <SelectTrigger className="w-[220px] text-xs" size="sm">
                <SelectValue placeholder="Select model..." />
            </SelectTrigger>
            <SelectContent>
                {Array.from(grouped.entries()).map(([provider, items]) => (
                    <SelectGroup key={provider}>
                        <SelectLabel>{provider}</SelectLabel>
                        {items.map((m) => (
                            <SelectItem key={m.value} value={m.value}>
                                {m.modelName}
                            </SelectItem>
                        ))}
                    </SelectGroup>
                ))}
            </SelectContent>
        </Select>
    )
}

function SourceCard({ source }: { source: Source }) {
    return (
        <a
            href={source.url || "#"}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-start gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-accent"
        >
            <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
                <p className="text-sm font-medium leading-tight line-clamp-2">
                    {source.title}
                </p>
                {(source.authors?.length || source.year) && (
                    <p className="mt-1 text-xs text-muted-foreground">
                        {[source.authors?.slice(0, 2).join(", "), source.year]
                            .filter(Boolean)
                            .join(" · ")}
                    </p>
                )}
                {source.snippet && (
                    <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                        {source.snippet}
                    </p>
                )}
            </div>
            {source.url && (
                <ExternalLink className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
            )}
        </a>
    )
}

function MarkdownContent({ content }: { content: string }) {
    const html = useMemo(() => renderMarkdown(content), [content])
    return (
        <div
            className="prose prose-sm dark:prose-invert max-w-none [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2 [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-xs [&_code]:before:content-none [&_code]:after:content-none [&_pre]:rounded-lg [&_pre]:bg-muted [&_pre]:p-3 [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0.5 [&_p]:my-1 [&_h1]:text-base [&_h2]:text-sm [&_h3]:text-xs [&_h4]:text-xs [&_blockquote]:border-l-primary [&_blockquote]:text-muted-foreground"
            dangerouslySetInnerHTML={{ __html: html }}
        />
    )
}

function AssistantMessage({ message, onSuggestionClick }: { message: Message; onSuggestionClick: (s: string) => void }) {
    const [sourcesOpen, setSourcesOpen] = useState(false)
    const displayContent = stripSuggestionsFromContent(message.content)

    return (
        <div className="space-y-3">
            <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Bot className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0 flex-1 space-y-3">
                    <div className="rounded-lg bg-muted px-4 py-2 text-sm">
                        <MarkdownContent content={displayContent} />
                    </div>

                    {message.sources && message.sources.length > 0 && (
                        <div className="space-y-1.5">
                            <button
                                onClick={() => setSourcesOpen(!sourcesOpen)}
                                className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                            >
                                <ChevronRight
                                    className={`h-3 w-3 transition-transform ${sourcesOpen ? "rotate-90" : ""}`}
                                />
                                {message.sources.length} source{message.sources.length !== 1 ? "s" : ""}
                            </button>
                            {sourcesOpen && (
                                <div className="grid gap-2 sm:grid-cols-2">
                                    {message.sources.map((s) => (
                                        <SourceCard key={s.id} source={s} />
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {message.suggestions && message.suggestions.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                            {message.suggestions.map((s, i) => (
                                <button
                                    key={i}
                                    onClick={() => onSuggestionClick(s)}
                                    className="inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                                >
                                    <Sparkles className="h-3 w-3" />
                                    {s}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

function SessionItem({
    session,
    isActive,
    onSelect,
    onRename,
    onDelete,
}: {
    session: ChatSession
    isActive: boolean
    onSelect: () => void
    onRename: (title: string) => void
    onDelete: () => void
}) {
    const [isEditing, setIsEditing] = useState(false)
    const [editTitle, setEditTitle] = useState(session.title)
    const inputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus()
            inputRef.current.select()
        }
    }, [isEditing])

    const handleSave = () => {
        const trimmed = editTitle.trim()
        if (trimmed && trimmed !== session.title) {
            onRename(trimmed)
        } else {
            setEditTitle(session.title)
        }
        setIsEditing(false)
    }

    return (
        <div
            className={`group flex items-center gap-2 rounded-md px-2 py-1.5 text-sm cursor-pointer transition-colors ${
                isActive
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
            }`}
            onClick={isEditing ? undefined : onSelect}
        >
            {isEditing ? (
                <Input
                    ref={inputRef}
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    onBlur={handleSave}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") handleSave()
                        if (e.key === "Escape") {
                            setEditTitle(session.title)
                            setIsEditing(false)
                        }
                    }}
                    className="h-7 text-xs"
                    onClick={(e) => e.stopPropagation()}
                />
            ) : (
                <>
                    <MessageSquare className="h-4 w-4 shrink-0" />
                    <span className="flex-1 truncate">{session.title}</span>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button
                                className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-background"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <MoreHorizontal className="h-3.5 w-3.5" />
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-36">
                            <DropdownMenuItem
                                onClick={(e) => {
                                    e.stopPropagation()
                                    setIsEditing(true)
                                }}
                            >
                                <Pencil className="h-3.5 w-3.5" />
                                Rename
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                                variant="destructive"
                                onClick={(e) => {
                                    e.stopPropagation()
                                    onDelete()
                                }}
                            >
                                <Trash2 className="h-3.5 w-3.5" />
                                Delete
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </>
            )}
        </div>
    )
}

export default function ChatPage() {
    const [sessions, setSessions] = useState<ChatSession[]>([])
    const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
    const [models, setModels] = useState<ModelOption[]>([])
    const [selectedModel, setSelectedModel] = useState<ModelOption | null>(null)
    const [input, setInput] = useState("")
    const [isLoading, setIsLoading] = useState(false)
    const [sidebarOpen, setSidebarOpen] = useState(false)
    const [paperCount, setPaperCount] = useState<number | null>(null)
    const scrollRef = useRef<HTMLDivElement>(null)
    const scrollViewportRef = useRef<HTMLDivElement>(null)

    const activeSession = useMemo(
        () => sessions.find((s) => s.id === activeSessionId) || null,
        [sessions, activeSessionId]
    )

    const currentMessages = activeSession?.messages || []

    useEffect(() => {
        requestAnimationFrame(() => {
            if (scrollViewportRef.current) {
                scrollViewportRef.current.scrollTop = scrollViewportRef.current.scrollHeight
            }
        })
    }, [currentMessages, isLoading])

    useEffect(() => {
        fetch("/api/llm-providers")
            .then((r) => r.json())
            .then((data) => {
                if (!data.success) return
                const enabled = data.configs.filter(
                    (c: { isEnabled: boolean }) => c.isEnabled
                )
                const flat: ModelOption[] = []
                for (const config of enabled) {
                    const providerName = config.provider?.name || config.name || config.provider?.type
                    for (const m of config.models || []) {
                        flat.push({
                            providerType: config.provider?.type,
                            providerName,
                            externalId: m.externalId,
                            modelName: m.name,
                            value: `${config.provider?.type}::${m.externalId}`,
                        })
                    }
                }
                setModels(flat)
                if (!selectedModel) {
                    const defaultModel = flat.find(
                        (m) => m.providerType === "zhipuai" && m.externalId === "glm-4.5-air"
                    ) || flat.find(
                        (m) => m.providerType === "zhipuai"
                    ) || flat[0]
                    if (defaultModel) setSelectedModel(defaultModel)
                }
            })
            .catch(() => {})

        fetch("/api/v1/chat/health")
            .then((r) => r.json())
            .then((data) => {
                if (data.paperCount != null) setPaperCount(data.paperCount)
            })
            .catch(() => {})
    }, [])

    useEffect(() => {
        if (paperCount === null) return
        if (activeSessionId) return
        const content = `Hello! I'm your research intelligence assistant for banking/financial services AI research. Currently there are ${paperCount} papers in the repository. I can help you analyze trends, compare papers, identify gaps, and provide insights across risk management, compliance, fraud detection, credit assessment, and model governance.\n\nWhat specific research questions or topics would you like to explore today?`
        const newSession: ChatSession = {
            id: crypto.randomUUID(),
            title: "New Chat",
            messages: [{
                role: "assistant",
                content,
                suggestions: [
                    "What are the latest trends in AI-powered credit risk assessment?",
                    "How are banks using large language models for compliance automation?",
                    "Summarize recent advances in fraud detection using graph neural networks",
                ],
            }],
        }
        setSessions([newSession])
        setActiveSessionId(newSession.id)
    }, [paperCount, activeSessionId])

    const welcomeContent = useMemo(() => {
        if (paperCount != null) {
            return `Hello! I'm your research intelligence assistant for banking/financial services AI research. Currently there are ${paperCount} papers in the repository. I can help you analyze trends, compare papers, identify gaps, and provide insights across risk management, compliance, fraud detection, credit assessment, and model governance.\n\nWhat specific research questions or topics would you like to explore today?`
        }
        return DEFAULT_WELCOME
    }, [paperCount])

    const createSession = useCallback(() => {
        const newSession: ChatSession = {
            id: crypto.randomUUID(),
            title: "New Chat",
            messages: [{ role: "assistant", content: welcomeContent }],
        }
        setSessions((prev) => [newSession, ...prev])
        setActiveSessionId(newSession.id)
        setSidebarOpen(false)
        return newSession.id
    }, [welcomeContent])

    const handleSend = useCallback(
        async (overrideInput?: string) => {
            const text = overrideInput || input.trim()
            if (!text || isLoading) return

            let sessionId = activeSessionId

            if (!sessionId) {
                sessionId = createSession()
            }

            const userMsg: Message = { role: "user", content: text }
            setSessions((prev) =>
                prev.map((s) =>
                    s.id === sessionId
                        ? {
                            ...s,
                            messages: [...s.messages, userMsg],
                            title:
                                s.messages.length <= 1 && s.title === "New Chat"
                                    ? text.substring(0, 40) + (text.length > 40 ? "..." : "")
                                    : s.title,
                        }
                        : s
                )
            )
            setInput("")
            setIsLoading(true)

            try {
                const session = sessions.find((s) => s.id === sessionId)
                const historyForApi = [
                    ...(session?.messages || [])
                        .filter((m) => m.role !== "assistant" || !m.content.startsWith("Hello!"))
                        .map((m) => ({ role: m.role, content: m.content })),
                    { role: "user" as const, content: text },
                ]

                const body: Record<string, unknown> = {
                    messages: historyForApi,
                }
                if (selectedModel) {
                    body.model = {
                        providerType: selectedModel.providerType,
                        externalId: selectedModel.externalId,
                    }
                }

                const res = await fetch("/api/chat", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(body),
                })
                const data = await res.json()

                if (data.error) throw new Error(data.error?.message || data.error)

                const assistantMsg: Message = {
                    role: "assistant",
                    content: data.answer || "",
                    sources: data.sources || [],
                    suggestions: data.suggestions || [],
                }

                const returnedSessionId = data.sessionId

                setSessions((prev) =>
                    prev.map((s) =>
                        s.id === sessionId
                            ? {
                                ...s,
                                id: returnedSessionId || s.id,
                                messages: [...s.messages.filter((_, i) => i !== s.messages.length - 1 || s.messages[s.messages.length - 1].role !== "user"), userMsg, assistantMsg],
                            }
                            : s
                    )
                )

                if (returnedSessionId && returnedSessionId !== sessionId) {
                    setActiveSessionId(returnedSessionId)
                }
            } catch {
                const errorMsg: Message = {
                    role: "assistant",
                    content:
                        "Sorry, I encountered an error answering that. Please check your model configuration and try again.",
                }
                setSessions((prev) =>
                    prev.map((s) =>
                        s.id === sessionId
                            ? { ...s, messages: [...s.messages, errorMsg] }
                            : s
                    )
                )
            } finally {
                setIsLoading(false)
            }
        },
        [input, isLoading, activeSessionId, sessions, selectedModel, createSession]
    )

    const handleSuggestionClick = useCallback(
        (suggestion: string) => {
            handleSend(suggestion)
        },
        [handleSend]
    )

    const handleRenameSession = useCallback(
        (sessionId: string, newTitle: string) => {
            setSessions((prev) =>
                prev.map((s) =>
                    s.id === sessionId ? { ...s, title: newTitle } : s
                )
            )
        },
        []
    )

    const handleDeleteSession = useCallback(
        (sessionId: string) => {
            setSessions((prev) => prev.filter((s) => s.id !== sessionId))
            if (activeSessionId === sessionId) {
                setActiveSessionId(null)
            }
        },
        [activeSessionId]
    )

    return (
        <div className="flex h-[calc(100vh-2rem)] max-w-4xl mx-auto gap-3">
            <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
                <SheetContent side="left" className="w-72 p-0">
                    <SheetHeader className="p-4 pb-2">
                        <SheetTitle className="text-sm">Chat Sessions</SheetTitle>
                    </SheetHeader>
                    <div className="px-2 pb-2">
                        <Button
                            variant="outline"
                            size="sm"
                            className="w-full justify-start gap-2 text-xs"
                            onClick={() => {
                                createSession()
                            }}
                        >
                            <Plus className="h-3.5 w-3.5" />
                            New Chat
                        </Button>
                    </div>
                    <ScrollArea className="flex-1 px-2">
                        <div className="space-y-0.5 pb-4">
                            {sessions.length === 0 && (
                                <p className="px-2 py-4 text-center text-xs text-muted-foreground">
                                    No conversations yet
                                </p>
                            )}
                            {sessions.map((s) => (
                                <SessionItem
                                    key={s.id}
                                    session={s}
                                    isActive={s.id === activeSessionId}
                                    onSelect={() => {
                                        setActiveSessionId(s.id)
                                        setSidebarOpen(false)
                                    }}
                                    onRename={(title) =>
                                        handleRenameSession(s.id, title)
                                    }
                                    onDelete={() => handleDeleteSession(s.id)}
                                />
                            ))}
                        </div>
                    </ScrollArea>
                </SheetContent>
            </Sheet>

            <div className="flex flex-1 flex-col min-w-0">
                <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSidebarOpen(true)}>
                                <MessageSquare className="h-4 w-4" />
                            </Button>
                        <div>
                            <h1 className="text-lg font-semibold tracking-tight leading-tight">
                                Research Copilot
                            </h1>
                            <p className="text-xs text-muted-foreground leading-tight">
                                {activeSession
                                    ? activeSession.title
                                    : "Chat with your repository"}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {models.length > 0 && (
                            <ModelSelector
                                models={models}
                                selected={selectedModel}
                                onSelect={setSelectedModel}
                            />
                        )}
                        <Button
                            variant="outline"
                            size="sm"
                            className="gap-1.5 text-xs"
                            onClick={createSession}
                        >
                            <Plus className="h-3.5 w-3.5" />
                            New
                        </Button>
                    </div>
                </div>

                <div className="flex-1 min-h-0 border rounded-lg bg-card shadow-sm overflow-hidden flex flex-col">
                    <div ref={scrollViewportRef} className="flex-1 min-h-0 overflow-y-auto p-4">
                        <div className="space-y-4">
                            {currentMessages.length === 0 && (
                                <div className="flex flex-col items-center justify-center py-16 text-center">
                                    <Bot className="h-10 w-10 text-muted-foreground/50 mb-3" />
                                    <p className="text-sm font-medium">Research Copilot</p>
                                    <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                                        {paperCount != null
                                            ? `${paperCount} papers in repository. Ask about methodologies, papers, or research trends.`
                                            : "Ask about methodologies, specific papers, or research trends. Start a new conversation or select a model to begin."}
                                    </p>
                                </div>
                            )}

                            {currentMessages.map((m, i) =>
                                m.role === "assistant" ? (
                                    <AssistantMessage
                                        key={i}
                                        message={m}
                                        onSuggestionClick={handleSuggestionClick}
                                    />
                                ) : (
                                    <div key={i} className="flex gap-3 justify-end">
                                        <div className="px-4 py-2 rounded-lg max-w-[80%] text-sm whitespace-pre-wrap bg-primary text-primary-foreground">
                                            {m.content}
                                        </div>
                                        <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center shrink-0">
                                            <User className="h-5 w-5" />
                                        </div>
                                    </div>
                                )
                            )}

                            <div ref={scrollRef} />

                            {isLoading && (
                                <div className="flex gap-3">
                                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                        <Bot className="h-5 w-5 text-primary" />
                                    </div>
                                    <div className="bg-muted px-4 py-2 rounded-lg">
                                        <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                            Thinking...
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="p-4 border-t bg-background">
                        <div className="flex gap-2">
                            <Input
                                placeholder="Ask about methodologies, specific papers, or trends..."
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" && !e.shiftKey) {
                                        e.preventDefault()
                                        handleSend()
                                    }
                                }}
                                disabled={isLoading}
                            />
                            <Button
                                onClick={() => handleSend()}
                                disabled={isLoading || !input.trim()}
                                size="icon"
                            >
                                {isLoading ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <Send className="h-4 w-4" />
                                )}
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
