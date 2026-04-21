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
    Bot,
    Send,
    User,
    Plus,
    MessageSquare, PanelLeft,
    X,
    ChevronDown,
    MoreHorizontal,
    Pencil,
    Trash2,
    ExternalLink,
    FileText,
    ChevronRight,
    Loader2,
    Sparkles,
    Square,
    Brain,
} from "lucide-react"
import { marked } from "marked"
import DOMPurify from "dompurify"

interface Message {
    role: "user" | "assistant"
    content: string
    sources?: Source[]
    suggestions?: string[]
    isStreaming?: boolean
    thinking?: string
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
    messageCount?: number
    lastMessageAt?: string
    createdAt?: string
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
        .replace(/\*{0,2}Suggested (?:questions|follow-ups?):\*{0,2}\s*\n[\s\S]*$/, "")
        .trim()
}

function parseSuggestionsFromContent(content: string): string[] | undefined {
    const match = content.match(/\*{0,2}Suggested (?:questions|follow-ups?):\*{0,2}\s*\n([\s\S]*?)$/i);
    if (!match) return undefined;
    const lines = match[1].trim().match(/\d+\.\s+(.+)/g);
    if (!lines || lines.length === 0) return undefined;
    return lines.map(s => s.replace(/^\d+\.\s+/, ''));
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
    const [thinkingOpen, setThinkingOpen] = useState(false)
    const thinkingRef = useRef<HTMLDivElement>(null)
    const displayContent = stripSuggestionsFromContent(message.content)

    useEffect(() => {
        if (thinkingOpen && thinkingRef.current) {
            thinkingRef.current.scrollTop = thinkingRef.current.scrollHeight
        }
    }, [message.thinking, thinkingOpen])

    return (
        <div className="space-y-3">
            <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Bot className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0 flex-1 space-y-3">
                    {message.thinking && (
                        <div className="rounded-lg border border-border/50 bg-muted/30">
                            <button
                                onClick={() => setThinkingOpen(!thinkingOpen)}
                                className="flex items-center gap-1.5 w-full px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                            >
                                <Brain className="h-3.5 w-3.5 shrink-0" />
                                <span>Thinking{message.isStreaming ? '...' : ''}</span>
                                <ChevronDown className={`h-3 w-3 ml-auto transition-transform ${thinkingOpen ? 'rotate-180' : ''}`} />
                            </button>
                            {thinkingOpen && (
                                <div ref={thinkingRef} className="max-h-40 overflow-y-auto px-3 pb-2">
                                    <pre className="text-xs text-muted-foreground/70 whitespace-pre-wrap font-mono leading-relaxed">{message.thinking}</pre>
                                </div>
                            )}
                        </div>
                    )}

                    {(displayContent || message.isStreaming) && (
                        <div className="rounded-lg bg-muted px-4 py-2 text-sm">
                            <MarkdownContent content={displayContent} />
                            {message.isStreaming && (
                                <span className="inline-block w-2 h-4 ml-0.5 bg-foreground/60 animate-pulse rounded-sm" />
                            )}
                        </div>
                    )}

                    {!message.isStreaming && message.sources && message.sources.length > 0 && (
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
                                    {[...new Map(message.sources.map(s => [s.id, s])).values()].map((s) => (
                                        <SourceCard key={s.id} source={s} />
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {!message.isStreaming && message.suggestions && message.suggestions.length > 0 && (
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
                <div className="flex flex-col gap-0.5 w-full">
                    <span className="truncate min-w-0 text-xs">{session.title}</span>
                    <div className="flex gap-2 shrink-0">
                        <span
                            className="text-[10px] text-muted-foreground hover:text-foreground cursor-pointer"
                            onClick={(e) => { e.stopPropagation(); setIsEditing(true) }}
                        >
                            rename
                        </span>
                        <span
                            className="text-[10px] text-destructive hover:underline cursor-pointer"
                            onClick={(e) => { e.stopPropagation(); onDelete() }}
                        >
                            delete
                        </span>
                    </div>
                </div>
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
    const loadAbortRef = useRef<AbortController | null>(null)
    const streamAbortRef = useRef<AbortController | null>(null)
    const isStreamingRef = useRef(false)

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
        if (models.length === 0 || !activeSessionId) return
        const activeSession = sessions.find((s) => s.id === activeSessionId)
        if (!activeSession?.model) return
        const match = models.find(
            (m) => m.providerType === activeSession.model!.providerType && m.externalId === activeSession.model!.externalId
        )
        if (match && match.value !== selectedModel?.value) {
            setSelectedModel(match)
        }
    }, [models, sessions, activeSessionId])

    const loadSessions = useCallback(async () => {
        try {
            const res = await fetch("/api/chat/sessions?limit=50")
            const data = await res.json()
            if (data.sessions) {
                const loaded: ChatSession[] = data.sessions.map((s: any) => ({
                    id: s.id,
                    title: s.title,
                    model: s.model || undefined,
                    messageCount: s.messageCount,
                    lastMessageAt: s.lastMessageAt,
                    createdAt: s.createdAt,
                    messages: [],
                }))

                setSessions((prev) => {
                    const loadedIds = new Set(loaded.map(s => s.id))
                    const localOnly = prev.filter(s => !loadedIds.has(s.id) && s.messages.length > 0)
                    if (localOnly.length > 0) {
                        console.warn('[ChatPage] Preserving', localOnly.length, 'local session(s) not yet on server')
                    }
                    return [...localOnly, ...loaded]
                })
                return loaded
            }
        } catch {
        }
        return []
    }, [])

    const loadSessionMessages = useCallback(async (sessionId: string) => {
        if (loadAbortRef.current) {
            loadAbortRef.current.abort()
        }
        const controller = new AbortController()
        loadAbortRef.current = controller

        try {
            const res = await fetch(`/api/chat/sessions/${sessionId}`, { signal: controller.signal })
            if (!res.ok) return
            const data = await res.json()
            if (controller.signal.aborted) return

            const dbMessages: Message[] = (data.messages || []).map((m: any) => ({
                role: m.role,
                content: m.content,
                sources: m.sources || undefined,
                suggestions: m.role === 'assistant' ? parseSuggestionsFromContent(m.content) : undefined,
            }))

            setSessions((prev) =>
                prev.map((s) =>
                    s.id === sessionId ? { ...s, messages: dbMessages } : s
                )
            )
        } catch (err: any) {
            if (err.name !== 'AbortError') {
                console.error('Failed to load session messages', err)
            }
        }
    }, [])

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
            messages: [{
                role: "assistant",
                content: welcomeContent,
                suggestions: [
                    "What are the latest trends in AI-powered credit risk assessment?",
                    "How are banks using large language models for compliance automation?",
                    "Summarize recent advances in fraud detection using graph neural networks",
                ],
            }],
        }
        setSessions((prev) => [newSession, ...prev])
        setActiveSessionId(newSession.id)
        setSidebarOpen(false)
        return newSession.id
    }, [welcomeContent])

    useEffect(() => {
        if (paperCount === null) return
        if (activeSessionId) return
        if (isStreamingRef.current) {
            console.warn('[ChatPage] Skipping session reload — streaming in progress')
            return
        }

        loadSessions().then((loaded) => {
            if (loaded.length > 0) {
                setActiveSessionId(loaded[0].id)
                loadSessionMessages(loaded[0].id)
            } else {
                const newSession: ChatSession = {
                    id: crypto.randomUUID(),
                    title: "New Chat",
                    messages: [{
                        role: "assistant",
                        content: welcomeContent,
                        suggestions: [
                            "What are the latest trends in AI-powered credit risk assessment?",
                            "How are banks using large language models for compliance automation?",
                            "Summarize recent advances in fraud detection using graph neural networks",
                        ],
                    }],
                }
                setSessions([newSession])
                setActiveSessionId(newSession.id)
            }
        })
    }, [paperCount, activeSessionId, loadSessions, loadSessionMessages, welcomeContent])

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
            isStreamingRef.current = true

            const streamingMsg: Message = { role: "assistant", content: "", isStreaming: true }
            setSessions((prev) =>
                prev.map((s) =>
                    s.id === sessionId
                        ? { ...s, messages: [...s.messages, streamingMsg] }
                        : s
                )
            )

            try {
                const session = sessions.find((s) => s.id === sessionId)
                const historyForApi = [
                    ...(session?.messages || [])
                        .filter((m) => m.role !== "assistant" || !m.content.startsWith("Hello!"))
                        .map((m) => ({ role: m.role, content: m.content })),
                    { role: "user" as const, content: text },
                ]

                const activeSess = sessions.find(s => s.id === sessionId)
                const isServerSession = activeSess && activeSess.messageCount != null

                const body: Record<string, unknown> = {
                    messages: historyForApi,
                }
                if (sessionId && isServerSession) {
                    body.sessionId = sessionId
                }
                if (selectedModel) {
                    body.model = {
                        providerType: selectedModel.providerType,
                        externalId: selectedModel.externalId,
                    }
                }

                const abortController = new AbortController()
                streamAbortRef.current = abortController

                const res = await fetch("/api/chat", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Accept": "text/event-stream",
                    },
                    body: JSON.stringify(body),
                    signal: abortController.signal,
                })

                if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`)

                const reader = res.body.getReader()
                const decoder = new TextDecoder()
                let buffer = ''
                let fullContent = ''
                let thinkingContent = ''
                let currentEventType = ''
                let returnedSessionId: string | null = null

                while (true) {
                    const { done, value } = await reader.read()
                    if (done) break

                    buffer += decoder.decode(value, { stream: true })
                    const lines = buffer.split('\n')
                    buffer = lines.pop() || ''

                    for (const line of lines) {
                        if (line.startsWith('event: ')) {
                            currentEventType = line.slice(7).trim()
                        } else if (line.startsWith('data: ')) {
                            try {
                                const data = JSON.parse(line.slice(6))

                                switch (currentEventType) {
                                    case 'token':
                                        fullContent += data.content
                                        setSessions((prev) =>
                                            prev.map((s) => {
                                                if (s.id !== sessionId) return s
                                                const msgs = [...s.messages]
                                                msgs[msgs.length - 1] = { ...msgs[msgs.length - 1], content: fullContent, thinking: thinkingContent, isStreaming: true }
                                                return { ...s, messages: msgs }
                                            })
                                        )
                                        break
                                    case 'thinking':
                                        thinkingContent += data.content
                                        setSessions((prev) =>
                                            prev.map((s) => {
                                                if (s.id !== sessionId) return s
                                                const msgs = [...s.messages]
                                                msgs[msgs.length - 1] = { ...msgs[msgs.length - 1], thinking: thinkingContent, isStreaming: true }
                                                return { ...s, messages: msgs }
                                            })
                                        )
                                        break
                                    case 'final':
                                        returnedSessionId = data.sessionId || null
                                        setSessions((prev) =>
                                            prev.map((s) => {
                                                if (s.id !== sessionId) return s
                                                const msgs = [...s.messages]
                                                msgs[msgs.length - 1] = {
                                                    ...msgs[msgs.length - 1],
                                                    content: data.answer || msgs[msgs.length - 1].content,
                                                    sources: data.sources || [],
                                                    suggestions: data.suggestions || [],
                                                    isStreaming: false,
                                                }
                                                return { ...s, messages: msgs }
                                            })
                                        )
                                        break
                                    case 'error':
                                        setSessions((prev) =>
                                            prev.map((s) => {
                                                if (s.id !== sessionId) return s
                                                const msgs = [...s.messages]
                                                msgs[msgs.length - 1] = {
                                                    role: "assistant",
                                                    content: data.partial
                                                        ? data.partial + "\n\n**Error:** " + data.message
                                                        : "Sorry, an error occurred: " + data.message,
                                                    isStreaming: false,
                                                }
                                                return { ...s, messages: msgs }
                                            })
                                        )
                                        break
                                }
                            } catch {
                                // Skip malformed JSON
                            }
                        }
                    }
                }

                if (returnedSessionId && returnedSessionId !== sessionId) {
                    setSessions((prev) =>
                        prev.map((s) =>
                            s.id === sessionId
                                ? { ...s, id: returnedSessionId }
                                : s
                        )
                    )
                    setActiveSessionId(returnedSessionId)
                }

                setSessions((prev) =>
                    prev.map((s) =>
                        s.id === (returnedSessionId || sessionId)
                            ? {
                                ...s,
                                lastMessageAt: new Date().toISOString(),
                                messageCount: (s.messageCount || 0) + 2,
                            }
                            : s
                    )
                )
            } catch (err: any) {
                if (err.name === 'AbortError') {
                    setSessions((prev) =>
                        prev.map((s) => {
                            if (s.id !== sessionId) return s
                            const msgs = [...s.messages]
                            const lastMsg = msgs[msgs.length - 1]
                            if (lastMsg && lastMsg.isStreaming) {
                                msgs[msgs.length - 1] = { ...lastMsg, isStreaming: false }
                            }
                            return { ...s, messages: msgs }
                        })
                    )
                } else {
                    const errorMsg: Message = {
                        role: "assistant",
                        content:
                            "Sorry, I encountered an error answering that. Please check your model configuration and try again.",
                    }
                    setSessions((prev) =>
                        prev.map((s) => {
                            if (s.id !== sessionId) return s
                            const msgs = [...s.messages]
                            const lastMsg = msgs[msgs.length - 1]
                            if (lastMsg && lastMsg.isStreaming && !lastMsg.content) {
                                msgs[msgs.length - 1] = errorMsg
                            } else {
                                msgs.push(errorMsg)
                            }
                            return { ...s, messages: msgs }
                        })
                    )
                }
            } finally {
                setIsLoading(false)
                isStreamingRef.current = false
                streamAbortRef.current = null
            }
        },
        [input, isLoading, activeSessionId, sessions, selectedModel, createSession]
    )

    const handleStop = useCallback(() => {
        streamAbortRef.current?.abort()
    }, [])

    const handleSuggestionClick = useCallback(
        (suggestion: string) => {
            handleSend(suggestion)
        },
        [handleSend]
    )

    const handleRenameSession = useCallback(
        async (sessionId: string, newTitle: string) => {
            const oldTitle = sessions.find(s => s.id === sessionId)?.title
            setSessions((prev) =>
                prev.map((s) =>
                    s.id === sessionId ? { ...s, title: newTitle } : s
                )
            )
            try {
                await fetch(`/api/chat/sessions/${sessionId}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ title: newTitle }),
                })
            } catch {
                if (oldTitle) {
                    setSessions((prev) =>
                        prev.map((s) =>
                            s.id === sessionId ? { ...s, title: oldTitle } : s
                        )
                    )
                }
            }
        },
        [sessions]
    )

    const handleDeleteSession = useCallback(
        async (sessionId: string) => {
            const deletedSession = sessions.find(s => s.id === sessionId)
            setSessions((prev) => prev.filter((s) => s.id !== sessionId))
            if (activeSessionId === sessionId) {
                setActiveSessionId(null)
            }
            try {
                await fetch(`/api/chat/sessions/${sessionId}`, { method: 'DELETE' })
            } catch {
                if (deletedSession) {
                    setSessions((prev) => [deletedSession, ...prev])
                }
            }
        },
        [activeSessionId, sessions]
    )

    return (
        <div className="flex h-[calc(100vh-3rem)] -mx-4 md:-mx-8 -my-6 gap-0">
            {sidebarOpen && (
                <div className="w-64 shrink-0 border-r bg-muted/30 flex flex-col">
                    <div className="px-4 pt-6 pb-2 flex items-center justify-between">
                        <span className="text-sm font-medium">Chat Sessions</span>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => setSidebarOpen(false)}
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
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
                                        if (!s.messages || s.messages.length === 0) {
                                            loadSessionMessages(s.id)
                                        }
                                    }}
                                    onRename={(title) =>
                                        handleRenameSession(s.id, title)
                                    }
                                    onDelete={() =>
                                        handleDeleteSession(s.id)
                                    }
                                />
                            ))}
                        </div>
                    </ScrollArea>
                </div>
            )}

            <div className="flex flex-1 flex-col min-w-0">
                <div className="px-4 pt-6 pb-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSidebarOpen(!sidebarOpen)}>
                                <PanelLeft className="h-4 w-4" />
                            </Button>
                        <div>
                            <h1 className="text-3xl font-bold tracking-tight">
                                Chat to Insights
                            </h1>
                            <p className="text-sm text-muted-foreground mt-1">
                                {activeSession
                                    ? activeSession.title
                                    : "Chat with your research repository"}
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

                <div className="flex-1 min-h-0 border rounded-lg bg-card shadow-sm overflow-hidden flex flex-col mx-4 mb-4">
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
                            {isLoading ? (
                                <Button
                                    onClick={handleStop}
                                    variant="destructive"
                                    size="icon"
                                >
                                    <Square className="h-4 w-4" />
                                </Button>
                            ) : (
                                <Button
                                    onClick={() => handleSend()}
                                    disabled={!input.trim()}
                                    size="icon"
                                >
                                    <Send className="h-4 w-4" />
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
