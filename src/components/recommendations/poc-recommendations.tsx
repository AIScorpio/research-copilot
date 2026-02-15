'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sparkles, TrendingUp, AlertCircle, CheckCircle } from 'lucide-react';

interface PoCRecommendation {
    id: string;
    title: string;
    domain: string;
    description: string;
    technology: string;
    riskDomain: string;
    readiness: 'EMERGING' | 'PILOT_READY' | 'PRODUCTION' | 'MATURE';
    readinessScore: number;
    estimatedEffort: 'Low' | 'Medium' | 'High';
    businessValue: 'Low' | 'Medium' | 'High';
    bankingTags: string[];
    bankingUseCases: string[];
    relatedPapers: Array<{
        id: string;
        title: string;
        url: string;
    }>;
    confidence: number;
    bankAdoption?: string[];
    maturityIndicators?: string[];
}

export function PoCRecommendations() {
    const [recommendations, setRecommendations] = useState<PoCRecommendation[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedDomain, setSelectedDomain] = useState<string>('all');

    const fetchRecommendations = async () => {
        setLoading(true);
        setError(null);
        try {
            const url = selectedDomain !== 'all' 
                ? `/api/recommendations/poc?limit=10&domain=${selectedDomain}`
                : '/api/recommendations/poc?limit=10';
            
            const response = await fetch(url);
            const data = await response.json();
            if (data.success) {
                setRecommendations(data.recommendations);
            } else {
                setError(data.error || 'Failed to fetch recommendations');
            }
        } catch {
            setError('An error occurred while fetching recommendations');
        } finally {
            setLoading(false);
        }
    };

    const getEffortColor = (effort: string) => {
        switch (effort) {
            case 'Low': return 'bg-green-100 text-green-800';
            case 'Medium': return 'bg-yellow-100 text-yellow-800';
            case 'High': return 'bg-red-100 text-red-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    const getValueColor = (value: string) => {
        switch (value) {
            case 'High': return 'bg-blue-100 text-blue-800';
            case 'Medium': return 'bg-purple-100 text-purple-800';
            case 'Low': return 'bg-gray-100 text-gray-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    const getReadinessColor = (readiness: string) => {
        switch (readiness) {
            case 'EMERGING': return 'bg-orange-100 text-orange-800';
            case 'PILOT_READY': return 'bg-yellow-100 text-yellow-800';
            case 'PRODUCTION': return 'bg-green-100 text-green-800';
            case 'MATURE': return 'bg-blue-100 text-blue-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    const getReadinessIcon = (readiness: string) => {
        switch (readiness) {
            case 'EMERGING': return <AlertCircle className="h-4 w-4" />;
            case 'PILOT_READY': return <TrendingUp className="h-4 w-4" />;
            case 'PRODUCTION':
            case 'MATURE': return <CheckCircle className="h-4 w-4" />;
            default: return null;
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">PoC Recommendations</h2>
                    <p className="text-muted-foreground">
                        AI-powered suggestions for proof-of-concept projects based on recent research
                    </p>
                </div>
                <div className="flex gap-2">
                    <Select value={selectedDomain} onValueChange={setSelectedDomain}>
                        <SelectTrigger className="w-[200px]">
                            <SelectValue placeholder="Filter by domain" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Domains</SelectItem>
                            <SelectItem value="Credit Risk">Credit Risk</SelectItem>
                            <SelectItem value="Market Risk">Market Risk</SelectItem>
                            <SelectItem value="Operational Risk">Operational Risk</SelectItem>
                            <SelectItem value="Cyber Risk">Cyber Risk</SelectItem>
                            <SelectItem value="Regulatory Risk">Regulatory Risk</SelectItem>
                            <SelectItem value="Fraud Detection">Fraud Detection</SelectItem>
                            <SelectItem value="Compliance">Compliance</SelectItem>
                        </SelectContent>
                    </Select>
                    <Button onClick={fetchRecommendations} disabled={loading}>
                        <Sparkles className="mr-2 h-4 w-4" />
                        {loading ? 'Generating...' : 'Generate Recommendations'}
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

            {recommendations.length === 0 && !loading && !error && (
                <Card>
                    <CardContent className="py-20">
                        <div className="text-center">
                            <Sparkles className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                            <p className="text-muted-foreground">
                                Click &quot;Generate Recommendations&quot; to get PoC suggestions
                            </p>
                        </div>
                    </CardContent>
                </Card>
            )}

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {recommendations.map((rec) => (
                    <Card key={rec.id} className="hover:shadow-lg transition-shadow">
                        <CardHeader>
                            <div className="flex items-start justify-between gap-2">
                                <CardTitle className="text-lg leading-tight">{rec.title}</CardTitle>
                                <Badge variant="outline" className="shrink-0">
                                    {Math.round(rec.confidence * 100)}% confidence
                                </Badge>
                            </div>
                            <CardDescription className="mt-2">
                                {rec.description}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-3">
                                <div className="flex flex-wrap gap-2">
                                    <Badge className={getEffortColor(rec.estimatedEffort)}>
                                        Effort: {rec.estimatedEffort}
                                    </Badge>
                                    <Badge className={getValueColor(rec.businessValue)}>
                                        Value: {rec.businessValue}
                                    </Badge>
                                    <Badge className={getReadinessColor(rec.readiness)}>
                                        {getReadinessIcon(rec.readiness)}
                                        <span className="ml-1">{rec.readiness.replace('_', ' ')}</span>
                                    </Badge>
                                </div>
                                
                                <div>
                                    <p className="text-sm font-medium mb-1">Readiness Score</p>
                                    <div className="w-full bg-gray-200 rounded-full h-2">
                                        <div 
                                            className="bg-blue-600 h-2 rounded-full" 
                                            style={{ width: `${rec.readinessScore}%` }}
                                        />
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-1">{rec.readinessScore}%</p>
                                </div>
                                
                                <div>
                                    <p className="text-sm font-medium mb-1">Technology & Domain</p>
                                    <p className="text-sm text-muted-foreground">{rec.technology} → {rec.domain}</p>
                                </div>
                                
                                <div>
                                    <p className="text-sm font-medium mb-1">Risk Domain</p>
                                    <p className="text-sm text-muted-foreground">{rec.riskDomain}</p>
                                </div>

                                {rec.bankingTags.length > 0 && (
                                    <div>
                                        <p className="text-sm font-medium mb-1">Banking Tags</p>
                                        <div className="flex flex-wrap gap-1">
                                            {rec.bankingTags.slice(0, 3).map((tag) => (
                                                <Badge key={tag} variant="secondary" className="text-xs">
                                                    {tag}
                                                </Badge>
                                            ))}
                                            {rec.bankingTags.length > 3 && (
                                                <Badge variant="secondary" className="text-xs">
                                                    +{rec.bankingTags.length - 3}
                                                </Badge>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {rec.bankingUseCases.length > 0 && (
                                    <div>
                                        <p className="text-sm font-medium mb-1">Banking Use Cases</p>
                                        <ul className="text-sm text-muted-foreground space-y-1">
                                            {rec.bankingUseCases.slice(0, 2).map((useCase) => (
                                                <li key={useCase} className="flex items-start">
                                                    <span className="mr-2">•</span>
                                                    <span>{useCase}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                {rec.relatedPapers.length > 0 && (
                                    <div>
                                        <p className="text-sm font-medium mb-2">
                                            Related Research ({rec.relatedPapers.length})
                                        </p>
                                        <div className="space-y-2">
                                            {rec.relatedPapers.slice(0, 2).map((paper) => (
                                                <a
                                                    key={paper.id}
                                                    href={paper.url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="block text-sm text-blue-600 hover:text-blue-800 truncate"
                                                >
                                                    {paper.title}
                                                </a>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
}