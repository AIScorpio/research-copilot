"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2, RefreshCw } from "lucide-react";

interface AISummaryProps {
    paperId: string;
    initialSummary?: string | null;
}

export function AISummary({ paperId, initialSummary }: AISummaryProps) {
    const [summary, setSummary] = useState<string | null>(initialSummary || null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const generateSummary = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const res = await fetch(`/api/papers/${paperId}/summary`, {
                method: 'POST',
            });
            const data = await res.json();
            if (data.summary) {
                setSummary(data.summary);
            } else {
                setError("Failed to generate summary.");
            }
        } catch (err) {
            setError("Error connecting to server.");
        } finally {
            setIsLoading(false);
        }
    };

    // Auto-generation removed as per user request to use a button instead

    if (isLoading) {
        return (
            <div className="bg-muted/50 p-6 rounded-lg border border-dashed flex flex-col items-center justify-center gap-3 text-muted-foreground animate-pulse">
                <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
                <p className="text-sm">Analyzing paper and generating technical summary...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg border border-red-200 dark:border-red-800 text-sm text-red-600 dark:text-red-400">
                <p>{error}</p>
                <Button variant="ghost" size="sm" onClick={generateSummary} className="mt-2 text-red-600 hover:text-red-700 hover:bg-red-100 dark:hover:bg-red-900/40 px-0 h-auto">
                    Try Again
                </Button>
            </div>
        );
    }

    if (!summary) {
        return (
            <div className="bg-muted/30 p-8 rounded-xl border border-dashed flex flex-col items-center justify-center gap-4 text-center">
                <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
                    <Sparkles className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                    <p className="font-medium text-sm">No AI Intelligence Report yet</p>
                    <p className="text-xs text-muted-foreground max-w-[280px]">Get a deep-dive technical analysis of this research paper using AI.</p>
                </div>
                <Button
                    onClick={generateSummary}
                    className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-md transition-all hover:scale-105"
                >
                    <Sparkles className="mr-2 h-4 w-4" />
                    Analyze with Research Copilot
                </Button>
            </div>
        );
    }

    return (
        <div className="relative group">
            <div className="bg-blue-50/50 dark:bg-blue-900/10 p-6 rounded-xl border border-blue-100 dark:border-blue-900/30 leading-relaxed text-sm text-foreground shadow-sm">
                <div className="flex items-center gap-2 mb-3 text-blue-600 dark:text-blue-400 font-medium text-xs uppercase tracking-wider">
                    <Sparkles className="h-3.5 w-3.5" />
                    AI Intelligence Report
                </div>
                <div className="prose prose-sm dark:prose-invert max-w-none">
                    {summary}
                </div>
                <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 text-muted-foreground hover:text-blue-500"
                    onClick={generateSummary}
                    title="Regenerate Summary"
                >
                    <RefreshCw className="h-4 w-4" />
                </Button>
            </div>
        </div>
    );
}
