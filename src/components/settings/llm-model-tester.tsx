"use client";

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Play, CheckCircle2, XCircle, Clock, RefreshCw, Square } from 'lucide-react';

interface ModelInfo {
    id: string;
    name: string;
    provider: string;
}

interface TestResult {
    passed: boolean;
    duration: number;
    error: string | null;
}

interface ModelTestResult {
    model: string;
    provider: string;
    tests: {
        query?: TestResult;
        assessment?: TestResult;
        tags?: TestResult;
        summary?: TestResult;
    };
}

type TestStatus = 'pending' | 'running' | 'passed' | 'failed';

const getStatusIcon = (status: TestStatus) => {
    switch (status) {
        case 'pending':
            return <Clock className="h-4 w-4 text-muted-foreground" />;
        case 'running':
            return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
        case 'passed':
            return <CheckCircle2 className="h-4 w-4 text-green-500" />;
        case 'failed':
            return <XCircle className="h-4 w-4 text-red-500" />;
    }
};

const getStatusBadge = (status: TestStatus) => {
    switch (status) {
        case 'pending':
            return <Badge variant="outline" className="text-xs">Pending</Badge>;
        case 'running':
            return <Badge variant="outline" className="text-xs border-blue-500 text-blue-500">Running</Badge>;
        case 'passed':
            return <Badge variant="outline" className="text-xs border-green-500 text-green-500">Pass</Badge>;
        case 'failed':
            return <Badge variant="outline" className="text-xs border-red-500 text-red-500">Fail</Badge>;
    }
};

export function LLMModelTester() {
    const [models, setModels] = useState<ModelInfo[]>([]);
    const [selectedModels, setSelectedModels] = useState<Set<string>>(new Set());
    const [results, setResults] = useState<Map<string, ModelTestResult>>(new Map());
    const [isLoading, setIsLoading] = useState(true);
    const [isTesting, setIsTesting] = useState(false);
    const [currentModel, setCurrentModel] = useState<string | null>(null);
    const [currentTest, setCurrentTest] = useState<string | null>(null);
    const [lastRun, setLastRun] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    
    const abortControllerRef = useRef<AbortController | null>(null);
    const scrollContainerRef = useRef<HTMLDivElement | null>(null);
    const currentRowRef = useRef<HTMLTableRowElement | null>(null);

    useEffect(() => {
        loadModels();
    }, []);

    // Auto-scroll within the container when current model changes
    useEffect(() => {
        if (currentModel && currentRowRef.current && scrollContainerRef.current) {
            const container = scrollContainerRef.current;
            const row = currentRowRef.current;
            
            // Calculate if the row is below the visible area
            const containerRect = container.getBoundingClientRect();
            const rowRect = row.getBoundingClientRect();
            
            // If row is below the visible area, scroll so it appears at the bottom
            if (rowRect.bottom > containerRect.bottom) {
                container.scrollTop = row.offsetTop - container.clientHeight + row.clientHeight;
            }
        }
    }, [currentModel]);

    const loadModels = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await fetch('/api/llm-models');
            const data = await response.json();
            if (data.models) {
                setModels(data.models);
                // Select all models by default
                setSelectedModels(new Set(data.models.map((m: ModelInfo) => m.id)));
            }
            if (data.lastRun) {
                setLastRun(data.lastRun);
                if (data.results) {
                    const resultMap = new Map<string, ModelTestResult>();
                    data.results.forEach((r: ModelTestResult) => {
                        resultMap.set(r.model, r);
                    });
                    setResults(resultMap);
                }
            }
        } catch (err) {
            setError('Failed to load models');
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            setSelectedModels(new Set(models.map(m => m.id)));
        } else {
            setSelectedModels(new Set());
        }
    };

    const handleSelectModel = (modelId: string, checked: boolean) => {
        const newSelected = new Set(selectedModels);
        if (checked) {
            newSelected.add(modelId);
        } else {
            newSelected.delete(modelId);
        }
        setSelectedModels(newSelected);
    };

    const cancelTest = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }
        setIsTesting(false);
        setCurrentModel(null);
        setCurrentTest(null);
        setError('Test cancelled by user');
    };

    const runTests = async () => {
        const selectedModelList = models.filter(m => selectedModels.has(m.id));
        if (selectedModelList.length === 0) {
            setError('Please select at least one model to test');
            return;
        }

        setIsTesting(true);
        setError(null);
        setResults(new Map());
        
        abortControllerRef.current = new AbortController();
        
        try {
            const response = await fetch('/api/llm-models/test', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    models: selectedModelList.map(m => ({ id: m.id, provider: m.provider })) 
                }),
                signal: abortControllerRef.current.signal
            });
            
            const reader = response.body?.getReader();
            if (!reader) {
                throw new Error('No response stream');
            }

            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = JSON.parse(line.slice(6));
                        
                        if (data.type === 'progress') {
                            setCurrentModel(data.model);
                            setCurrentTest(data.test);
                        } else if (data.type === 'result') {
                            setResults(prev => {
                                const newMap = new Map(prev);
                                newMap.set(data.result.model, data.result);
                                return newMap;
                            });
                        } else if (data.type === 'complete') {
                            setLastRun(data.timestamp);
                        } else if (data.type === 'error') {
                            setError(data.message);
                        }
                    }
                }
            }
        } catch (err) {
            if (err instanceof Error && err.name === 'AbortError') {
                // User cancelled - already handled
            } else {
                setError('Failed to run tests');
                console.error(err);
            }
        } finally {
            setIsTesting(false);
            setCurrentModel(null);
            setCurrentTest(null);
            abortControllerRef.current = null;
        }
    };

    const getTestStatus = (modelId: string, testType: string): TestStatus => {
        if (currentModel === modelId && currentTest === testType) {
            return 'running';
        }
        const result = results.get(modelId);
        if (!result || !result.tests[testType as keyof typeof result.tests]) {
            return 'pending';
        }
        return result.tests[testType as keyof typeof result.tests]!.passed ? 'passed' : 'failed';
    };

    const getOverallStatus = (modelId: string): TestStatus => {
        const result = results.get(modelId);
        if (!result) return 'pending';
        
        const tests = Object.values(result.tests);
        if (tests.length === 0) return 'pending';
        if (tests.every(t => t?.passed)) return 'passed';
        if (tests.some(t => t?.passed === false)) return 'failed';
        return 'pending';
    };

    const isAllSelected = models.length > 0 && selectedModels.size === models.length;
    const isIndeterminate = selectedModels.size > 0 && selectedModels.size < models.length;

    const groupedModels = models.reduce((acc, model) => {
        if (!acc[model.provider]) {
            acc[model.provider] = [];
        }
        acc[model.provider].push(model);
        return acc;
    }, {} as Record<string, ModelInfo[]>);

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle>LLM Model Compatibility Test</CardTitle>
                        <CardDescription>
                            Test which LLM models work correctly with collection prompts
                        </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                        {lastRun && (
                            <span className="text-xs text-muted-foreground">
                                Last run: {new Date(lastRun).toLocaleString()}
                            </span>
                        )}
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={loadModels}
                            disabled={isLoading || isTesting}
                        >
                            <RefreshCw className={`h-4 w-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
                            Refresh
                        </Button>
                        {isTesting ? (
                            <Button
                                variant="destructive"
                                size="sm"
                                onClick={cancelTest}
                            >
                                <Square className="mr-2 h-4 w-4" />
                                Cancel
                            </Button>
                        ) : (
                            <Button
                                onClick={runTests}
                                disabled={isLoading || selectedModels.size === 0}
                            >
                                <Play className="mr-2 h-4 w-4" />
                                Run Selected ({selectedModels.size})
                            </Button>
                        )}
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                {error && (
                    <div className="mb-4 p-3 rounded-md bg-red-50 text-red-700 border border-red-200 text-sm">
                        {error}
                    </div>
                )}

                {isLoading ? (
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        <span className="ml-2 text-muted-foreground">Loading models...</span>
                    </div>
                ) : models.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                        No LLM providers configured. Please configure providers above.
                    </div>
                ) : (
                    <div ref={scrollContainerRef} className="max-h-96 overflow-y-auto border rounded-md">
                        <table className="w-full text-sm">
                            <thead className="bg-muted/50 sticky top-0 z-10">
                                <tr>
                                    <th className="w-10 p-3">
                                        <Checkbox
                                            checked={isIndeterminate ? 'indeterminate' : isAllSelected}
                                            onCheckedChange={handleSelectAll}
                                            disabled={isTesting}
                                        />
                                    </th>
                                    <th className="text-left p-3 font-medium">Provider</th>
                                    <th className="text-left p-3 font-medium">Model</th>
                                    <th className="text-center p-3 font-medium w-20">Query</th>
                                    <th className="text-center p-3 font-medium w-24">Assessment</th>
                                    <th className="text-center p-3 font-medium w-16">Tags</th>
                                    <th className="text-center p-3 font-medium w-20">Summary</th>
                                </tr>
                            </thead>
                            <tbody>
                                {Object.entries(groupedModels).map(([provider, providerModels]) => (
                                    providerModels.map((model, idx) => {
                                        const isCurrentRow = currentModel === model.id;
                                        return (
                                            <tr 
                                                key={model.id}
                                                ref={isCurrentRow ? currentRowRef : null}
                                                className={`border-t ${isCurrentRow ? 'bg-blue-50/50' : ''}`}
                                            >
                                                <td className="p-3">
                                                    <Checkbox
                                                        checked={selectedModels.has(model.id)}
                                                        onCheckedChange={(checked: boolean | 'indeterminate') => handleSelectModel(model.id, checked === true)}
                                                        disabled={isTesting}
                                                    />
                                                </td>
                                                {idx === 0 ? (
                                                    <td 
                                                        className="p-3 font-medium text-blue-600" 
                                                        rowSpan={providerModels.length}
                                                    >
                                                        {provider}
                                                    </td>
                                                ) : null}
                                                <td className="p-3">
                                                    <div className="flex items-center gap-2">
                                                        <span className="truncate max-w-[200px]" title={model.id}>
                                                            {model.name || model.id.split('/').pop()}
                                                        </span>
                                                        {getStatusIcon(getOverallStatus(model.id))}
                                                    </div>
                                                </td>
                                                <td className="p-3 text-center">
                                                    {getStatusBadge(getTestStatus(model.id, 'query'))}
                                                </td>
                                                <td className="p-3 text-center">
                                                    {getStatusBadge(getTestStatus(model.id, 'assessment'))}
                                                </td>
                                                <td className="p-3 text-center">
                                                    {getStatusBadge(getTestStatus(model.id, 'tags'))}
                                                </td>
                                                <td className="p-3 text-center">
                                                    {getStatusBadge(getTestStatus(model.id, 'summary'))}
                                                </td>
                                            </tr>
                                        );
                                    })
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" /> Pending
                    </div>
                    <div className="flex items-center gap-1">
                        <Loader2 className="h-3 w-3 text-blue-500" /> Running
                    </div>
                    <div className="flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3 text-green-500" /> Pass
                    </div>
                    <div className="flex items-center gap-1">
                        <XCircle className="h-3 w-3 text-red-500" /> Fail
                    </div>
                    <div className="ml-auto">
                        {selectedModels.size} of {models.length} selected
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
