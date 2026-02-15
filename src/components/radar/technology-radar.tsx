'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Zap, AlertCircle, CheckCircle, Clock } from 'lucide-react';

interface RadarTechnology {
    id: string;
    name: string;
    quadrant: 'adopt' | 'trial' | 'assess' | 'hold';
    maturity: number;
    relevanceToRisk: number;
    bankAdoption: string[];
    evidenceCount: number;
    recentActivity: boolean;
    description: string;
    relatedTopics: string[];
}

interface RadarData {
    technologies: RadarTechnology[];
    byQuadrant: {
        adopt: number;
        trial: number;
        assess: number;
        hold: number;
    };
}

export function TechnologyRadar() {
    const [radarData, setRadarData] = useState<RadarData | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [days, setDays] = useState(90);
    const abortControllerRef = useRef<AbortController | null>(null);

    useEffect(() => {
        return () => {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
        };
    }, []);

    const fetchRadarData = async () => {
        setLoading(true);
        setError(null);
        
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        abortControllerRef.current = new AbortController();

        try {
            const response = await fetch(`/api/radar?days=${days}`, {
                signal: abortControllerRef.current.signal
            });
            const data = await response.json();
            if (data.success) {
                setRadarData(data.radar);
            } else {
                setError(data.error || 'Failed to fetch radar data');
            }
        } catch (err: any) {
            if (err.name !== 'AbortError') {
                setError('An error occurred while fetching radar data');
            }
        } finally {
            setLoading(false);
        }
    };

    const getQuadrantColor = (quadrant: string) => {
        switch (quadrant) {
            case 'adopt': return 'bg-green-100 text-green-800 border-green-300';
            case 'trial': return 'bg-blue-100 text-blue-800 border-blue-300';
            case 'assess': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
            case 'hold': return 'bg-red-100 text-red-800 border-red-300';
            default: return 'bg-gray-100 text-gray-800 border-gray-300';
        }
    };

    const getQuadrantIcon = (quadrant: string) => {
        switch (quadrant) {
            case 'adopt': return <CheckCircle className="h-4 w-4" />;
            case 'trial': return <Zap className="h-4 w-4" />;
            case 'assess': return <Clock className="h-4 w-4" />;
            case 'hold': return <AlertCircle className="h-4 w-4" />;
            default: return null;
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Technology Radar</h1>
                    <p className="text-muted-foreground">
                        Track emerging AI technologies and their readiness for banking applications
                    </p>
                </div>
                <div className="flex gap-2 items-center">
                    <select
                        value={days}
                        onChange={(e) => setDays(parseInt(e.target.value))}
                        className="px-3 py-2 border rounded-md"
                    >
                        <option value={30}>Last 30 days</option>
                        <option value={60}>Last 60 days</option>
                        <option value={90}>Last 90 days</option>
                        <option value={180}>Last 180 days</option>
                    </select>
                    <Button onClick={fetchRadarData} disabled={loading}>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        {loading ? 'Loading...' : 'Refresh'}
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

            {radarData && (
                <>
                    <div className="grid gap-4 md:grid-cols-4">
                        <Card className={`border-2 ${getQuadrantColor('adopt')}`}>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <CheckCircle className="h-5 w-5" />
                                    Adopt
                                </CardTitle>
                                <CardDescription>
                                    Ready for production deployment
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <p className="text-4xl font-bold">{radarData.byQuadrant.adopt}</p>
                                <p className="text-sm text-muted-foreground">technologies</p>
                            </CardContent>
                        </Card>

                        <Card className={`border-2 ${getQuadrantColor('trial')}`}>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Zap className="h-5 w-5" />
                                    Trial
                                </CardTitle>
                                <CardDescription>
                                    Suitable for pilot programs
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <p className="text-4xl font-bold">{radarData.byQuadrant.trial}</p>
                                <p className="text-sm text-muted-foreground">technologies</p>
                            </CardContent>
                        </Card>

                        <Card className={`border-2 ${getQuadrantColor('assess')}`}>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Clock className="h-5 w-5" />
                                    Assess
                                </CardTitle>
                                <CardDescription>
                                    Worth investigating
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <p className="text-4xl font-bold">{radarData.byQuadrant.assess}</p>
                                <p className="text-sm text-muted-foreground">technologies</p>
                            </CardContent>
                        </Card>

                        <Card className={`border-2 ${getQuadrantColor('hold')}`}>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <AlertCircle className="h-5 w-5" />
                                    Hold
                                </CardTitle>
                                <CardDescription>
                                    Monitor for developments
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <p className="text-4xl font-bold">{radarData.byQuadrant.hold}</p>
                                <p className="text-sm text-muted-foreground">technologies</p>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {radarData.technologies.map((tech) => (
                            <Card key={tech.id} className="hover:shadow-lg transition-shadow">
                                <CardHeader>
                                    <div className="flex items-start justify-between">
                                        <CardTitle className="text-lg">{tech.name}</CardTitle>
                                        <Badge className={getQuadrantColor(tech.quadrant)}>
                                            {getQuadrantIcon(tech.quadrant)}
                                            <span className="ml-1">{tech.quadrant}</span>
                                        </Badge>
                                    </div>
                                    <CardDescription className="mt-2">
                                        {tech.description}
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-3">
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <p className="text-xs font-medium text-muted-foreground mb-1">
                                                    Maturity
                                                </p>
                                                <div className="flex items-center gap-2">
                                                    <div className="flex-1 bg-gray-200 rounded-full h-2">
                                                        <div
                                                            className="bg-green-600 h-2 rounded-full"
                                                            style={{ width: `${tech.maturity}%` }}
                                                        />
                                                    </div>
                                                    <span className="text-sm font-medium">
                                                        {tech.maturity}%
                                                    </span>
                                                </div>
                                            </div>
                                            <div>
                                                <p className="text-xs font-medium text-muted-foreground mb-1">
                                                    Relevance
                                                </p>
                                                <div className="flex items-center gap-2">
                                                    <div className="flex-1 bg-gray-200 rounded-full h-2">
                                                        <div
                                                            className="bg-blue-600 h-2 rounded-full"
                                                            style={{ width: `${tech.relevanceToRisk}%` }}
                                                        />
                                                    </div>
                                                    <span className="text-sm font-medium">
                                                        {tech.relevanceToRisk}%
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        <div>
                                            <p className="text-sm font-medium mb-1">
                                                Bank Adoption ({tech.bankAdoption.length})
                                            </p>
                                            <div className="flex flex-wrap gap-1">
                                                {tech.bankAdoption.map((bank, i) => (
                                                    <Badge key={i} variant="outline" className="text-xs">
                                                        {bank}
                                                    </Badge>
                                                ))}
                                            </div>
                                        </div>

                                        <div>
                                            <p className="text-sm font-medium mb-1">
                                                Evidence
                                            </p>
                                            <p className="text-sm text-muted-foreground">
                                                {tech.evidenceCount} papers{' '}
                                                {tech.recentActivity && (
                                                    <Badge className="ml-2" variant="outline">
                                                        Recent
                                                    </Badge>
                                                )}
                                            </p>
                                        </div>

                                        {tech.relatedTopics.length > 0 && (
                                            <div>
                                                <p className="text-sm font-medium mb-1">
                                                    Related Topics
                                                </p>
                                                <div className="flex flex-wrap gap-1">
                                                    {tech.relatedTopics.slice(0, 4).map((topic, i) => (
                                                        <Badge key={i} variant="secondary" className="text-xs">
                                                            {topic}
                                                        </Badge>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}