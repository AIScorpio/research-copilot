'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Briefcase, TrendingUp, AlertTriangle, Target, Users, Globe } from 'lucide-react';

interface CompetitiveUpdate {
    id: string;
    type: 'publication' | 'patent' | 'news';
    institution: string;
    title: string;
    url: string;
    publicationDate: Date;
    summary?: string;
    relevanceScore: number;
    relevantTopics: string[];
}

interface CompetitiveBrief {
    summary: string;
    topCompetitors: string[];
    keyTrends: string[];
    alertTopics: string[];
}

export function CompetitiveIntel() {
    const [updates, setUpdates] = useState<CompetitiveUpdate[]>([]);
    const [brief, setBrief] = useState<CompetitiveBrief | null>(null);
    const [loading, setLoading] = useState(false);
    const [days, setDays] = useState(30);
    const [error, setError] = useState<string | null>(null);
    const abortControllerRef = useRef<AbortController | null>(null);

    useEffect(() => {
        return () => {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
        };
    }, []);

    const fetchIntel = async () => {
        setLoading(true);
        setError(null);
        
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        abortControllerRef.current = new AbortController();

        try {
            const response = await fetch(`/api/competitive-intel?days=${days}`, {
                signal: abortControllerRef.current.signal
            });
            const data = await response.json();
            if (data.success) {
                setUpdates(data.updates);
            } else {
                setError(data.error || 'Failed to fetch competitive intelligence');
            }
        } catch (err: any) {
            if (err.name !== 'AbortError') {
                setError('An error occurred while fetching competitive intelligence');
            }
        } finally {
            setLoading(false);
        }
    };

    const generateBrief = async () => {
        setLoading(true);
        
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        abortControllerRef.current = new AbortController();

        try {
            const response = await fetch('/api/competitive-intel', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ days }),
                signal: abortControllerRef.current.signal
            });
            const data = await response.json();
            if (data.success) {
                setBrief(data.brief);
            } else {
                setError('Failed to generate brief');
            }
        } catch (err: any) {
            if (err.name !== 'AbortError') {
                setError('Failed to generate brief');
            }
        } finally {
            setLoading(false);
        }
    };

    const getTypeColor = (type: string) => {
        switch (type) {
            case 'publication': return 'bg-blue-100 text-blue-800';
            case 'patent': return 'bg-purple-100 text-purple-800';
            case 'news': return 'bg-green-100 text-green-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    const getRelevanceColor = (score: number) => {
        if (score >= 80) return 'text-red-600';
        if (score >= 60) return 'text-yellow-600';
        return 'text-green-600';
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Competitive Intelligence</h2>
                    <p className="text-muted-foreground">
                        Monitor publications and patents from major banks
                    </p>
                </div>
                <div className="flex gap-2">
                    <select 
                        value={days} 
                        onChange={(e) => setDays(parseInt(e.target.value))}
                        className="border rounded px-3 py-2"
                    >
                        <option value={7}>Last 7 days</option>
                        <option value={30}>Last 30 days</option>
                        <option value={90}>Last 90 days</option>
                    </select>
                    <Button onClick={fetchIntel} disabled={loading}>
                        <Briefcase className="mr-2 h-4 w-4" />
                        {loading ? 'Loading...' : 'Refresh'}
                    </Button>
                    <Button onClick={generateBrief} disabled={loading} variant="outline">
                        <TrendingUp className="mr-2 h-4 w-4" />
                        {loading ? 'Generating...' : 'Brief'}
                    </Button>
                </div>
            </div>

            {error && (
                <Card className="border-red-200 bg-red-50">
                    <CardContent className="pt-6">
                        <p className="text-red-800">{error}</p>
                    </CardContent>
                </Card>
            )}

            {brief && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Target className="h-5 w-5" />
                            Competitive Intelligence Brief
                        </CardTitle>
                        <CardDescription>
                            Generated: {new Date().toLocaleString()}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <p className="font-semibold mb-2">{brief.summary}</p>
                        </div>

                        <div>
                            <h4 className="font-semibold mb-2 flex items-center gap-2">
                                <Users className="h-4 w-4" />
                                Top Competitors (by activity)
                            </h4>
                            <div className="flex flex-wrap gap-2">
                                {brief.topCompetitors.map((competitor, i) => (
                                    <Badge key={i} variant="outline">
                                        {competitor}
                                    </Badge>
                                ))}
                            </div>
                        </div>

                        <div>
                            <h4 className="font-semibold mb-2 flex items-center gap-2">
                                <TrendingUp className="h-4 w-4" />
                                Key Trends
                            </h4>
                            <div className="flex flex-wrap gap-2">
                                {brief.keyTrends.map((trend, i) => (
                                    <Badge key={i} className="bg-blue-100 text-blue-800">
                                        {trend}
                                    </Badge>
                                ))}
                            </div>
                        </div>

                        {brief.alertTopics.length > 0 && (
                            <div>
                                <h4 className="font-semibold mb-2 flex items-center gap-2">
                                    <AlertTriangle className="h-4 w-4" />
                                    Alert Topics (High Activity)
                                </h4>
                                <div className="flex flex-wrap gap-2">
                                    {brief.alertTopics.map((topic, i) => (
                                        <Badge key={i} className="bg-red-100 text-red-800">
                                            {topic}
                                        </Badge>
                                    ))}
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {updates.length > 0 && (
                <div className="space-y-4">
                    <h3 className="text-xl font-semibold">Recent Updates ({updates.length})</h3>
                    <div className="grid gap-4">
                        {updates.map((update) => (
                            <Card key={update.id}>
                                <CardHeader>
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <CardTitle className="text-lg flex items-center gap-2">
                                                <Globe className="h-4 w-4" />
                                                {update.institution}
                                            </CardTitle>
                                            <CardDescription>
                                                {new Date(update.publicationDate).toLocaleDateString()}
                                            </CardDescription>
                                        </div>
                                        <Badge className={getTypeColor(update.type)}>
                                            {update.type}
                                        </Badge>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <h4 className="font-semibold mb-2">{update.title}</h4>
                                    {update.summary && (
                                        <p className="text-sm text-muted-foreground mb-3">
                                            {update.summary}
                                        </p>
                                    )}
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex flex-wrap gap-1">
                                            {update.relevantTopics.slice(0, 3).map((topic, i) => (
                                                <Badge key={i} variant="outline" className="text-xs">
                                                    {topic}
                                                </Badge>
                                            ))}
                                        </div>
                                        <div className="text-sm font-semibold">
                                            Relevance: <span className={getRelevanceColor(update.relevanceScore)}>
                                                {update.relevanceScore}%
                                            </span>
                                        </div>
                                    </div>
                                    <a 
                                        href={update.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-sm text-blue-600 hover:underline"
                                    >
                                        View Source →
                                    </a>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>
            )}

            {updates.length === 0 && !loading && !error && (
                <Card>
                    <CardContent className="py-20">
                        <div className="text-center">
                            <Briefcase className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                            <p className="text-muted-foreground">
                                Click "Refresh" to fetch competitive intelligence
                            </p>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
