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
    AlertCircle,
    Brain,
    Key,
    Server,
    TestTube,
    FileText,
    RotateCcw
} from 'lucide-react';
import SourceManager from '@/components/settings/source-manager';
import NotificationSettings from '@/components/settings/notification-settings';
import { LLMProviderManager } from '@/components/settings/llm-provider-manager';
import {
    DEFAULT_QUERY_OPTIMIZATION_PROMPT,
    DEFAULT_CONTENT_ASSESSMENT_PROMPT,
    DEFAULT_SUMMARY_GENERATION_PROMPT,
    DEFAULT_TAG_SUGGESTION_PROMPT
} from '@/lib/prompt-templates';

type LLMProvider = 'groq' | 'openai' | 'anthropic' | 'ollama' | 'lmstudio';

interface LLMConfig {
    provider: LLMProvider;
    apiKey?: string;
    baseUrl?: string;
    model?: string;
    temperature?: number;
    maxTokens?: number;
    isConfigured?: boolean;
}

interface PromptTemplates {
    queryOptimization: string;
    contentAssessment: string;
    summaryGeneration: string;
    tagSuggestion: string;
}

const DEFAULT_MODELS: Record<LLMProvider, string> = {
    groq: 'llama-3.3-70b-versatile',
    openai: 'gpt-4o-mini',
    anthropic: 'claude-3-haiku-20240307',
    ollama: 'llama3.2',
    lmstudio: 'local-model'
};

const DEFAULT_BASE_URLS: Partial<Record<LLMProvider, string>> = {
    ollama: 'http://localhost:11434',
    lmstudio: 'http://localhost:1234'
};

export default function SettingsPage() {
    const [llmConfig, setLLMConfig] = useState<LLMConfig>({
        provider: 'groq',
        temperature: 0.3,
        maxTokens: 1000
    });
    const [prompts, setPrompts] = useState<PromptTemplates>({
        queryOptimization: DEFAULT_QUERY_OPTIMIZATION_PROMPT,
        contentAssessment: DEFAULT_CONTENT_ASSESSMENT_PROMPT,
        summaryGeneration: DEFAULT_SUMMARY_GENERATION_PROMPT,
        tagSuggestion: DEFAULT_TAG_SUGGESTION_PROMPT
    });
    const [activePromptTab, setActivePromptTab] = useState<'query' | 'assessment' | 'summary' | 'tags'>('query');
    const [isLoading, setIsLoading] = useState(false);
    const [isTesting, setIsTesting] = useState(false);
    const [isSavingPrompts, setIsSavingPrompts] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [promptMessage, setPromptMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [showApiKey, setShowApiKey] = useState(false);

    // Load current configuration on mount
    useEffect(() => {
        fetchLLMConfig();
    }, []);

    const fetchLLMConfig = async () => {
        try {
            const response = await fetch('/api/settings/llm');
            const data = await response.json();
            
            if (data.success) {
                setLLMConfig(prev => ({
                    ...prev,
                    ...data.config,
                    // Don't overwrite API key with masked version
                    apiKey: prev.apiKey || ''
                }));
            }
        } catch (error) {
            console.error('Failed to load LLM config:', error);
        }
    };

    const handleProviderChange = (provider: LLMProvider) => {
        setLLMConfig(prev => ({
            ...prev,
            provider,
            model: DEFAULT_MODELS[provider],
            baseUrl: DEFAULT_BASE_URLS[provider] || '',
            apiKey: '' // Clear API key when switching providers
        }));
        setMessage(null);
    };

    const testConnection = async () => {
        setIsTesting(true);
        setMessage(null);
        
        try {
            const response = await fetch('/api/settings/llm', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(llmConfig)
            });
            
            const data = await response.json();
            
            if (data.success) {
                setMessage({ 
                    type: 'success', 
                    text: `Connected successfully! Latency: ${data.latency}` 
                });
            } else {
                setMessage({ 
                    type: 'error', 
                    text: data.message || 'Connection failed' 
                });
            }
        } catch (error) {
            setMessage({ 
                type: 'error', 
                text: 'Failed to test connection. Please check your settings.' 
            });
        } finally {
            setIsTesting(false);
        }
    };

    const saveConfiguration = async () => {
        setIsLoading(true);
        setMessage(null);
        
        try {
            const response = await fetch('/api/settings/llm', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(llmConfig)
            });
            
            const data = await response.json();
            
            if (data.success) {
                setMessage({ 
                    type: 'success', 
                    text: `Successfully configured ${data.config.provider}!` 
                });
            } else {
                setMessage({ 
                    type: 'error', 
                    text: data.message || 'Failed to save configuration' 
                });
            }
        } catch (error) {
            setMessage({ 
                type: 'error', 
                text: 'Failed to save configuration. Please try again.' 
            });
        } finally {
            setIsLoading(false);
        }
    };

    const needsApiKey = ['groq', 'openai', 'anthropic'].includes(llmConfig.provider);
    const isLocalProvider = ['ollama', 'lmstudio'].includes(llmConfig.provider);

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
                <p className="text-muted-foreground">Manage your preferences, LLM configuration, and account settings.</p>
            </div>

            {/* LLM Configuration Card */}
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <Brain className="h-5 w-5 text-primary" />
                        <CardTitle>LLM Configuration</CardTitle>
                    </div>
                    <CardDescription>
                        Configure your AI model provider for query optimization and content filtering.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Provider Selection */}
                    <div className="space-y-2">
                        <Label htmlFor="provider">LLM Provider</Label>
                        <Select 
                            value={llmConfig.provider} 
                            onValueChange={handleProviderChange}
                        >
                            <SelectTrigger id="provider">
                                <SelectValue placeholder="Select provider" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="groq">Groq (Recommended)</SelectItem>
                                <SelectItem value="openai">OpenAI</SelectItem>
                                <SelectItem value="anthropic">Anthropic</SelectItem>
                                <SelectItem value="ollama">Ollama (Local)</SelectItem>
                                <SelectItem value="lmstudio">LM Studio (Local)</SelectItem>
                            </SelectContent>
                        </Select>
                        <p className="text-sm text-muted-foreground">
                            {llmConfig.provider === 'groq' && 'Fast, cost-effective inference with Llama models'}
                            {llmConfig.provider === 'openai' && 'GPT-4o and GPT-3.5 models'}
                            {llmConfig.provider === 'anthropic' && 'Claude models with long context'}
                            {llmConfig.provider === 'ollama' && 'Run models locally on your machine'}
                            {llmConfig.provider === 'lmstudio' && 'Local model server with GUI'}
                        </p>
                    </div>

                    {/* API Key Input (for cloud providers) */}
                    {needsApiKey && (
                        <div className="space-y-2">
                            <Label htmlFor="apiKey" className="flex items-center gap-2">
                                <Key className="h-4 w-4" />
                                API Key
                            </Label>
                            <div className="flex gap-2">
                                <Input
                                    id="apiKey"
                                    type={showApiKey ? 'text' : 'password'}
                                    placeholder={`Enter your ${llmConfig.provider} API key`}
                                    value={llmConfig.apiKey || ''}
                                    onChange={(e) => setLLMConfig(prev => ({ 
                                        ...prev, 
                                        apiKey: e.target.value 
                                    }))}
                                    className="flex-1"
                                />
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setShowApiKey(!showApiKey)}
                                >
                                    {showApiKey ? 'Hide' : 'Show'}
                                </Button>
                            </div>
                            <p className="text-sm text-muted-foreground">
                                Your API key is stored securely and only used for LLM requests.
                            </p>
                        </div>
                    )}

                    {/* Base URL (for local providers) */}
                    {isLocalProvider && (
                        <div className="space-y-2">
                            <Label htmlFor="baseUrl" className="flex items-center gap-2">
                                <Server className="h-4 w-4" />
                                Base URL
                            </Label>
                            <Input
                                id="baseUrl"
                                type="url"
                                placeholder={DEFAULT_BASE_URLS[llmConfig.provider]}
                                value={llmConfig.baseUrl || ''}
                                onChange={(e) => setLLMConfig(prev => ({ 
                                    ...prev, 
                                    baseUrl: e.target.value 
                                }))}
                            />
                            <p className="text-sm text-muted-foreground">
                                {llmConfig.provider === 'ollama' && 'Default: http://localhost:11434'}
                                {llmConfig.provider === 'lmstudio' && 'Default: http://localhost:1234'}
                            </p>
                        </div>
                    )}

                    <Separator />

                    {/* Model Selection */}
                    <div className="space-y-2">
                        <Label htmlFor="model">Model</Label>
                        <Input
                            id="model"
                            placeholder={DEFAULT_MODELS[llmConfig.provider]}
                            value={llmConfig.model || ''}
                            onChange={(e) => setLLMConfig(prev => ({ 
                                ...prev, 
                                model: e.target.value 
                            }))}
                        />
                        <p className="text-sm text-muted-foreground">
                            Default: {DEFAULT_MODELS[llmConfig.provider]}
                        </p>
                    </div>

                    {/* Advanced Settings */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="temperature">Temperature: {llmConfig.temperature}</Label>
                            <input
                                id="temperature"
                                type="range"
                                min="0"
                                max="2"
                                step="0.1"
                                value={llmConfig.temperature || 0.3}
                                onChange={(e) => setLLMConfig(prev => ({ 
                                    ...prev, 
                                    temperature: parseFloat(e.target.value) 
                                }))}
                                className="w-full"
                            />
                            <p className="text-xs text-muted-foreground">
                                Lower = more focused, Higher = more creative
                            </p>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="maxTokens">Max Tokens</Label>
                            <Input
                                id="maxTokens"
                                type="number"
                                min="1"
                                max="8000"
                                value={llmConfig.maxTokens || 1000}
                                onChange={(e) => setLLMConfig(prev => ({ 
                                    ...prev, 
                                    maxTokens: parseInt(e.target.value) 
                                }))}
                            />
                        </div>
                    </div>

                    {/* Status Badge */}
                    {llmConfig.isConfigured && (
                        <div className="flex items-center gap-2">
                            <Badge variant="default" className="bg-green-500">
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                Configured
                            </Badge>
                            <span className="text-sm text-muted-foreground">
                                Active: {llmConfig.provider}
                            </span>
                        </div>
                    )}

                    {/* Message Display */}
                    {message && (
                        <div className={`flex items-center gap-2 p-3 rounded-md ${
                            message.type === 'success' 
                                ? 'bg-green-50 text-green-700 border border-green-200' 
                                : 'bg-red-50 text-red-700 border border-red-200'
                        }`}>
                            {message.type === 'success' ? (
                                <CheckCircle2 className="h-4 w-4" />
                            ) : (
                                <XCircle className="h-4 w-4" />
                            )}
                            <span className="text-sm">{message.text}</span>
                        </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex gap-3">
                        <Button
                            variant="outline"
                            onClick={testConnection}
                            disabled={isTesting || (needsApiKey && !llmConfig.apiKey)}
                        >
                            {isTesting ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Testing...
                                </>
                            ) : (
                                <>
                                    <TestTube className="mr-2 h-4 w-4" />
                                    Test Connection
                                </>
                            )}
                        </Button>
                        
                        <Button
                            onClick={saveConfiguration}
                            disabled={isLoading || (needsApiKey && !llmConfig.apiKey)}
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                'Save Configuration'
                            )}
                        </Button>
                    </div>

                    {/* Info Box */}
                    <div className="flex items-start gap-2 p-3 bg-blue-50 text-blue-700 rounded-md border border-blue-200">
                        <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                        <div className="text-sm space-y-1">
                            <p>The LLM is used for:</p>
                            <ul className="list-disc list-inside ml-1 space-y-0.5">
                                <li>Optimizing search queries for banking relevance</li>
                                <li>Filtering content based on relevance scores</li>
                                <li>Generating tags and summaries</li>
                            </ul>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* New Multi-Provider LLM Manager */}
            <LLMProviderManager />

            {/* Prompt Templates Card */}
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
                                onClick={() => {
                                    setPrompts(prev => ({
                                        ...prev,
                                        [activePromptTab === 'query' ? 'queryOptimization' :
                                         activePromptTab === 'assessment' ? 'contentAssessment' :
                                         activePromptTab === 'summary' ? 'summaryGeneration' : 'tagSuggestion']:
                                            activePromptTab === 'query' ? DEFAULT_QUERY_OPTIMIZATION_PROMPT :
                                            activePromptTab === 'assessment' ? DEFAULT_CONTENT_ASSESSMENT_PROMPT :
                                            activePromptTab === 'summary' ? DEFAULT_SUMMARY_GENERATION_PROMPT :
                                            DEFAULT_TAG_SUGGESTION_PROMPT
                                    }));
                                    setPromptMessage({ type: 'success', text: 'Reset to default' });
                                }}
                            >
                                <RotateCcw className="h-3 w-3 mr-1" />
                                Reset to Default
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

            <NotificationSettings />

            <div className="p-6 border rounded-lg bg-card">
                <h3 className="font-semibold mb-4">Appearance</h3>
                <div className="flex items-center justify-between">
                    <span className="text-sm">Theme Preferences</span>
                    <span className="text-sm text-muted-foreground">Managed via System/Header</span>
                </div>
            </div>

            <div className="p-6 border rounded-lg bg-card">
                <h3 className="font-semibold mb-4 text-red-600">Danger Zone</h3>
                <button className="text-sm text-red-600 hover:underline">Delete Account</button>
            </div>

            <SourceManager />
        </div>
    );
}
