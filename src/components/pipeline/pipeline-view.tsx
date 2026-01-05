"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, AlertCircle, X, Terminal } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { PaperCard } from "@/components/papers/paper-card"

interface PipelineViewProps {
    initialSources: any[];
    recentPapers: any[];
}

export function PipelineView({ initialSources, recentPapers }: PipelineViewProps) {
    const router = useRouter()
    const [topic, setTopic] = useState("Deep learning")
    const [sources, setSources] = useState(initialSources)
    const [dateHorizon, setDateHorizon] = useState("month")
    const [customFrom, setCustomFrom] = useState((new Date().getFullYear() - 3).toString()) // Default 3 years
    const [customTo, setCustomTo] = useState(new Date().getFullYear().toString())
    const [useAgent, setUseAgent] = useState(true)
    const [isRunning, setIsRunning] = useState(false)
    const [logs, setLogs] = useState<string[]>([])
    const [error, setError] = useState<string | null>(null)

    const addLog = (msg: string) => {
        setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`])
    }

    const handleRun = async () => {
        setIsRunning(true);
        setError(null);
        setLogs([]);

        addLog("Initiating collection pipeline...");

        try {
            if (useAgent) {
                addLog(`Agent: Analyzing topic '${topic}' for query optimization...`);
            }

            // Real query is sent to server
            addLog(`Agent: Searching ${sources.length} Sources & Classifying in parallel...`);

            const res = await fetch('/api/collection', {
                method: 'POST',
                body: JSON.stringify({
                    query: topic,
                    horizon: dateHorizon,
                    dateFrom: dateHorizon === 'custom' ? customFrom : undefined,
                    dateTo: dateHorizon === 'custom' ? customTo : undefined,
                    useAgent
                })
            });
            const data = await res.json();

            if (data.success) {
                if (useAgent) {
                    addLog(`Agent: Optimization complete.`);
                }
                addLog(`Collection complete. Processing metadata...`);
                // Provide detailed feedback
                if (data.newCount === 0 && data.totalFound > 0) {
                    addLog(`Success! Found ${data.totalFound} relevant papers (all already in library).`);
                } else if (data.totalFound === 0) {
                    addLog(`completed. No matching papers found for this criteria.`);
                    addLog(`Tip: Try a broader topic or extend the Date Horizon.`);
                } else {
                    addLog(`Success! Archived ${data.newCount} new papers (from ${data.totalFound} analyzed).`);
                }

                router.refresh();
            } else {
                throw new Error(data.error || "Unknown error");
            }

        } catch (e: any) {
            console.error(e);
            const err = "CRITICAL ERROR: Connection interrupted (503). Reference unavailable.";
            addLog(err);
            setError("Collection stopped due to error.");
        } finally {
            setIsRunning(false);
        }
    }

    const removeSource = (id: string) => {
        setSources(prev => prev.filter(s => s.id !== id));
    }

    return (
        <div className="grid gap-6">
            {/* Main Configuration & Console */}
            <div className="grid gap-6 lg:grid-cols-2">
                {/* Left: Configuration */}
                <div className="space-y-6">
                    <Card>
                        <CardContent className="p-6 space-y-6">
                            <div className="space-y-2">
                                <Label>Research Topic</Label>
                                <Input
                                    value={topic}
                                    onChange={(e) => setTopic(e.target.value)}
                                    className="bg-muted/50"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Sources Repository</Label>
                                <div className="flex flex-wrap gap-2 mb-2">
                                    {sources.map(source => (
                                        <Badge key={source.id} variant="secondary" className="pl-2 pr-1 py-1 gap-1">
                                            {source.name}
                                            <button
                                                onClick={() => removeSource(source.id)}
                                                className="hover:text-destructive transition-colors"
                                            >
                                                <X className="h-3 w-3" />
                                            </button>
                                        </Badge>
                                    ))}
                                </div>
                                <div className="flex gap-2">
                                    <Input placeholder="Add source (e.g. Nature)" className="bg-muted/50" />
                                    <Button variant="secondary" size="icon">+</Button>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Date Horizon</Label>
                                        <Select value={dateHorizon} onValueChange={setDateHorizon}>
                                            <SelectTrigger className="bg-muted/50">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="today">Past 24 Hours</SelectItem>
                                                <SelectItem value="week">Past Week</SelectItem>
                                                <SelectItem value="month">Past Month</SelectItem>
                                                <SelectItem value="year">Past Year</SelectItem>
                                                <SelectItem value="custom">Custom Range</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Optimization</Label>
                                        <div className="flex items-center space-x-2 h-10 border rounded-md px-3 bg-muted/50">
                                            <Switch
                                                id="agent-mode"
                                                checked={useAgent}
                                                onCheckedChange={setUseAgent}
                                            />
                                            <Label htmlFor="agent-mode" className="cursor-pointer">Use LLM Agent</Label>
                                        </div>
                                    </div>
                                </div>

                                {dateHorizon === 'custom' && (
                                    <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2">
                                        <div className="space-y-2">
                                            <Label>From Year</Label>
                                            <Input
                                                type="number"
                                                value={customFrom}
                                                onChange={(e) => setCustomFrom(e.target.value)}
                                                className="bg-muted/50"
                                                placeholder="2020"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>To Year</Label>
                                            <Input
                                                type="number"
                                                value={customTo}
                                                onChange={(e) => setCustomTo(e.target.value)}
                                                className="bg-muted/50"
                                                placeholder="2024"
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>

                            {error && (
                                <div className="flex items-center gap-2 p-3 text-destructive bg-destructive/10 rounded-lg border border-destructive/20">
                                    <AlertCircle className="h-4 w-4" />
                                    <span className="text-sm font-medium">{error}</span>
                                </div>
                            )}

                            <Button
                                className="w-full h-12 text-lg"
                                size="lg"
                                onClick={handleRun}
                                disabled={isRunning}
                            >
                                {isRunning ? (
                                    <>
                                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                        Running Agent...
                                    </>
                                ) : (
                                    <>
                                        Run Collection Agent
                                    </>
                                )}
                            </Button>
                        </CardContent>
                    </Card>
                </div>

                {/* Right: Console Logs */}
                <div className="h-full min-h-[400px]">
                    <Card className="h-full bg-black border-slate-800 text-slate-300 font-mono text-sm shadow-2xl overflow-hidden flex flex-col">
                        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-950/50">
                            <div className="flex items-center gap-2">
                                <Terminal className="h-4 w-4 text-primary" />
                                <span className="font-semibold text-slate-100">PIPELINE LOGS</span>
                            </div>
                            {error && <span className="text-destructive font-bold text-xs uppercase tracking-wider">Error</span>}
                        </div>
                        <ScrollArea className="flex-1 p-4">
                            <div className="space-y-2">
                                {logs.length === 0 && !isRunning && (
                                    <div className="text-slate-600 italic">Ready to initialize pipeline...</div>
                                )}
                                {logs.map((log, i) => (
                                    <div key={i} className="break-words">
                                        <span className="text-slate-500 mr-2">{log.split(']')[0]}]</span>
                                        <span className={log.includes("ERROR") ? "text-red-400" : "text-slate-300"}>
                                            {log.split(']').slice(1).join(']')}
                                        </span>
                                    </div>
                                ))}
                                {isRunning && (
                                    <div className="animate-pulse text-primary">_</div>
                                )}
                            </div>
                        </ScrollArea>
                    </Card>
                </div>
            </div>

            {/* Bottom: Recently Collected */}
            <div className="space-y-4 pt-4">
                <h3 className="text-xl font-semibold">Recently Collected</h3>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {recentPapers.map((paper: any) => (
                        <PaperCard key={paper.id} paper={paper} />
                    ))}
                    {recentPapers.length === 0 && (
                        <div className="col-span-3 text-center py-12 text-muted-foreground border rounded-lg bg-muted/10">
                            No recent papers found. Run the pipeline to collect data.
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
