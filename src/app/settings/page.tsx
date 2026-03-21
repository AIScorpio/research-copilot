'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
    Loader2, 
    CheckCircle2, 
    XCircle, 
    FileText,
    RotateCcw
} from 'lucide-react';
import SourceManager from '@/components/settings/source-manager';
import NotificationSettings from '@/components/settings/notification-settings';
import { LLMProviderManager } from '@/components/settings/llm-provider-manager';
import { LLMModelTester } from '@/components/settings/llm-model-tester';
import CollectionSettings from '@/components/settings/collection-settings';
import type { PromptTemplates } from '@/types/prompts';

const DEFAULT_PROMPTS: PromptTemplates = {
    queryOptimization: '',
    contentAssessment: '',
    summaryGeneration: '',
    tagSuggestion: '',
    digestGeneration: ''
};

export default function SettingsPage() {
    const [prompts, setPrompts] = useState<PromptTemplates>(DEFAULT_PROMPTS);
    const [isLoadingPrompts, setIsLoadingPrompts] = useState(true);
    const [activePromptTab, setActivePromptTab] = useState<'query' | 'assessment' | 'summary' | 'tags' | 'digest'>('query');
    const [isSavingPrompts, setIsSavingPrompts] = useState(false);
    const [promptMessage, setPromptMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    useEffect(() => {
        const loadPrompts = async () => {
            try {
                const response = await fetch('/api/settings/prompts');
                const data = await response.json();
                if (data.success && data.prompts) {
                    setPrompts(data.prompts);
                }
            } catch {
                console.error('Failed to load prompts');
            } finally {
                setIsLoadingPrompts(false);
            }
        };
        loadPrompts();
    }, []);

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
                <p className="text-muted-foreground">Manage your preferences, LLM configuration, and account settings.</p>
            </div>

            <NotificationSettings />
            <CollectionSettings />
            <LLMProviderManager />
            <LLMModelTester />

            <Card>
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <FileText className="h-5 w-5 text-primary" />
                        <CardTitle>Prompt Templates</CardTitle>
                    </div>
                    <CardDescription>
                        Customize the prompts used for AI-powered features.
                        These prompts work with any LLM provider.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {isLoadingPrompts ? (
                        <div className="flex items-center justify-center p-8">
                            <Loader2 className="h-6 w-6 animate-spin text-primary" />
                            <span className="ml-2 text-sm text-muted-foreground">Loading prompts...</span>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <div className="flex gap-2 flex-wrap">
                                <Button
                                    variant={activePromptTab === 'query' ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => setActivePromptTab('query')}
                                >
                                    Query Optimization
                                </Button>
                                <Button
                                    variant={activePromptTab === 'assessment' ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => setActivePromptTab('assessment')}
                                >
                                    Content Assessment
                                </Button>
                                <Button
                                    variant={activePromptTab === 'summary' ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => setActivePromptTab('summary')}
                                >
                                    Summary Generation
                                </Button>
                                <Button
                                    variant={activePromptTab === 'tags' ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => setActivePromptTab('tags')}
                                >
                                    Tag Suggestion
                                </Button>
                                <Button
                                    variant={activePromptTab === 'digest' ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => setActivePromptTab('digest')}
                                >
                                    Digest Generation
                                </Button>
                            </div>

                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label>
                                        {activePromptTab === 'query' && 'Query Optimization Prompt'}
                                        {activePromptTab === 'assessment' && 'Content Assessment Prompt'}
                                        {activePromptTab === 'summary' && 'Summary Generation Prompt'}
                                        {activePromptTab === 'tags' && 'Tag Suggestion Prompt'}
                                        {activePromptTab === 'digest' && 'Digest Generation Prompt'}
                                    </Label>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={async () => {
                                            try {
                                                const response = await fetch('/api/settings/prompts');
                                                const data = await response.json();
                                                if (data.success && data.prompts) {
                                                    setPrompts(data.prompts);
                                                    setPromptMessage({ type: 'success', text: 'Reset to saved prompts' });
                                                }
                                            } catch {
                                                setPromptMessage({ type: 'error', text: 'Failed to reset prompts' });
                                            }
                                        }}
                                    >
                                        <RotateCcw className="h-3 w-3 mr-1" />
                                        Reset to Saved
                                    </Button>
                                </div>
                                <textarea
                                    className="w-full h-96 p-3 text-sm font-mono border rounded-md resize-y focus:outline-none focus:ring-2 focus:ring-primary"
                                    value={
                                        activePromptTab === 'query' ? prompts.queryOptimization :
                                        activePromptTab === 'assessment' ? prompts.contentAssessment :
                                        activePromptTab === 'summary' ? prompts.summaryGeneration :
                                        activePromptTab === 'tags' ? prompts.tagSuggestion :
                                        prompts.digestGeneration
                                    }
                                    onChange={(e) => setPrompts(prev => ({
                                        ...prev,
                                        [activePromptTab === 'query' ? 'queryOptimization' :
                                         activePromptTab === 'assessment' ? 'contentAssessment' :
                                         activePromptTab === 'summary' ? 'summaryGeneration' :
                                         activePromptTab === 'tags' ? 'tagSuggestion' : 'digestGeneration']: e.target.value
                                    }))}
                                />
                                <p className="text-xs text-muted-foreground">
                                    {activePromptTab === 'query' && 'This prompt optimizes user search queries for academic databases. Available variables: {{MODE}}, {{STRICTNESS}}'}
                                    {activePromptTab === 'assessment' && 'This prompt evaluates content relevance to banking AI research (scoring 0-10).'}
                                    {activePromptTab === 'summary' && 'This prompt generates concise summaries for banking professionals.'}
                                    {activePromptTab === 'tags' && 'This prompt suggests relevant tags from the banking AI taxonomy.'}
                                    {activePromptTab === 'digest' && 'This prompt generates the daily intelligence digest. Available variables: {{CURRENT_DATE}}, {{PAPER_COUNT}}, {{TOPIC}}, {{FEATURED_COUNT}}, {{TITLE}}, {{PAPERS}}, {{PAPERS_LIST}}'}
                                </p>
                            </div>

                            {promptMessage && (
                                <div className={`flex items-center gap-2 p-3 rounded-md ${
                                    promptMessage.type === 'success' 
                                        ? 'bg-green-50 text-green-700 border border-green-200' 
                                        : 'bg-red-50 text-red-700 border border-red-200'
                                }`}>
                                    {promptMessage.type === 'success' ? (
                                        <CheckCircle2 className="h-4 w-4" />
                                    ) : (
                                        <XCircle className="h-4 w-4" />
                                    )}
                                    <span className="text-sm">{promptMessage.text}</span>
                                </div>
                            )}

                            <Button
                                onClick={async () => {
                                    setIsSavingPrompts(true);
                                    setPromptMessage(null);
                                    try {
                                        const response = await fetch('/api/settings/prompts', {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify(prompts)
                                        });
                                        const data = await response.json();
                                        if (data.success) {
                                            setPromptMessage({ type: 'success', text: 'Prompt templates saved successfully!' });
                                        } else {
                                            setPromptMessage({ type: 'error', text: data.message || 'Failed to save prompts' });
                                        }
                                    } catch {
                                        setPromptMessage({ type: 'error', text: 'Failed to save prompts. Please try again.' });
                                    } finally {
                                        setIsSavingPrompts(false);
                                    }
                                }}
                                disabled={isSavingPrompts}
                            >
                                {isSavingPrompts ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Saving...
                                    </>
                                ) : (
                                    'Save Prompt Templates'
                                )}
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>

            <SourceManager />

            <div className="p-6 border rounded-lg bg-card">
                <h3 className="font-semibold mb-4 text-red-600">Danger Zone</h3>
                <button className="text-sm text-red-600 hover:underline">Delete Account</button>
            </div>
        </div>
    );
}
