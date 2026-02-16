'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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

interface PromptTemplates {
    queryOptimization: string;
    contentAssessment: string;
    summaryGeneration: string;
    tagSuggestion: string;
}

export default function SettingsPage() {
    const [prompts, setPrompts] = useState<PromptTemplates>({
        queryOptimization: '',
        contentAssessment: '',
        summaryGeneration: '',
        tagSuggestion: ''
    });
    const [isLoadingPrompts, setIsLoadingPrompts] = useState(true);
    const [activePromptTab, setActivePromptTab] = useState<'query' | 'assessment' | 'summary' | 'tags'>('query');
    const [isSavingPrompts, setIsSavingPrompts] = useState(false);
    const [promptMessage, setPromptMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // Load prompts from API on mount
    useEffect(() => {
        const loadPrompts = async () => {
            try {
                const response = await fetch('/api/settings/prompts');
                const data = await response.json();
                if (data.success && data.prompts) {
                    setPrompts(data.prompts);
                }
            } catch (error) {
                console.error('Failed to load prompts:', error);
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

            {/* 4. Appearance */}
            <div className="p-6 border rounded-lg bg-card">
                <h3 className="font-semibold mb-4">Appearance</h3>
                <div className="flex items-center justify-between">
                    <span className="text-sm">Theme Preferences</span>
                    <span className="text-sm text-muted-foreground">Managed via System/Header</span>
                </div>
            </div>

            {/* 3. Notification Settings */}
            <NotificationSettings />

            {/* 1. Multi-Provider LLM Manager */}
            <LLMProviderManager />

            {/* 2. Prompt Templates Card */}
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <FileText className="h-5 w-5 text-primary" />
                        <CardTitle>Prompt Templates</CardTitle>
                    </div>
                    <CardDescription>
                        Customize the prompts used for query optimization and content filtering.
                        These prompts work with any LLM provider.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Prompt Type Tabs */}
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
                    </div>

                    {/* Prompt Editor */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <Label>
                                {activePromptTab === 'query' && 'Query Optimization Prompt'}
                                {activePromptTab === 'assessment' && 'Content Assessment Prompt'}
                                {activePromptTab === 'summary' && 'Summary Generation Prompt'}
                                {activePromptTab === 'tags' && 'Tag Suggestion Prompt'}
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
                                    } catch (error) {
                                        setPromptMessage({ type: 'error', text: 'Failed to reset prompts' });
                                    }
                                }}
                            >
                                <RotateCcw className="h-3 w-3 mr-1" />
                                Reset to Saved
                            </Button>
                        </div>
                        <textarea
                            className="w-full h-64 p-3 text-sm font-mono border rounded-md resize-y focus:outline-none focus:ring-2 focus:ring-primary"
                            value={
                                activePromptTab === 'query' ? prompts.queryOptimization :
                                activePromptTab === 'assessment' ? prompts.contentAssessment :
                                activePromptTab === 'summary' ? prompts.summaryGeneration :
                                prompts.tagSuggestion
                            }
                            onChange={(e) => setPrompts(prev => ({
                                ...prev,
                                [activePromptTab === 'query' ? 'queryOptimization' :
                                 activePromptTab === 'assessment' ? 'contentAssessment' :
                                 activePromptTab === 'summary' ? 'summaryGeneration' : 'tagSuggestion']: e.target.value
                            }))}
                        />
                        <p className="text-xs text-muted-foreground">
                            {activePromptTab === 'query' && 'This prompt optimizes user search queries for academic databases.'}
                            {activePromptTab === 'assessment' && 'This prompt evaluates content relevance to banking AI research (scoring 0-10).'}
                            {activePromptTab === 'summary' && 'This prompt generates concise summaries for banking professionals.'}
                            {activePromptTab === 'tags' && 'This prompt suggests relevant tags from the banking AI taxonomy.'}
                        </p>
                    </div>

                    {/* Prompt Message */}
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

                    {/* Save Prompts Button */}
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
                            } catch (error) {
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
                </CardContent>
            </Card>

            {/* 6. Source Manager */}
            <SourceManager />

            {/* 5. Danger Zone */}
            <div className="p-6 border rounded-lg bg-card">
                <h3 className="font-semibold mb-4 text-red-600">Danger Zone</h3>
                <button className="text-sm text-red-600 hover:underline">Delete Account</button>
            </div>
        </div>
    );
}
