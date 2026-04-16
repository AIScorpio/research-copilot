'use client';

import { useState, useEffect } from 'react';
import { logger } from '@/lib/logger';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { LLMProviderCard } from './llm-provider-card';
import { AddProviderDialog } from './add-provider-dialog';
import { Plus, Loader2 } from 'lucide-react';

interface LLMProvider {
    id: string;
    name: string;
    baseUrl?: string;
    provider: {
        type: string;
        name: string;
        isCloud: boolean;
    };
    status: 'untested' | 'connected' | 'failed';
    priority: number;
    isEnabled: boolean;
    models: Array<{
        userModelId: string;
        id: string;
        name: string;
        externalId: string;
        isDefault: boolean;
    }>;
}

interface AvailableProvider {
    id: string;
    type: string;
    name: string;
    isCloud: boolean;
    baseUrl?: string;
    models: Array<{
        id: string;
        name: string;
        externalId: string;
    }>;
}

export function LLMProviderManager() {
    const [configs, setConfigs] = useState<LLMProvider[]>([]);
    const [availableProviders, setAvailableProviders] = useState<AvailableProvider[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [ollamaModels, setOllamaModels] = useState<Record<string, any[]>>({});
    const [groqModels, setGroqModels] = useState<Record<string, any[]>>({});
    const [lmstudioModels, setLmstudioModels] = useState<Record<string, any[]>>({});
    const { addToast } = useToast();

    // Fetch Ollama models dynamically when Ollama configs are present
    useEffect(() => {
        const fetchOllamaModels = async () => {
            const ollamaConfigs = configs.filter(c => c.provider.type === 'ollama');
            
            for (const config of ollamaConfigs) {
                try {
                    const baseUrl = availableProviders.find(p => p.type === 'ollama')?.baseUrl || 'http://localhost:11434';
                    const response = await fetch(`/api/llm-providers/ollama-models?baseUrl=${encodeURIComponent(baseUrl)}`);
                    const data = await response.json();
                    
                    if (data.success && data.models.length > 0) {
                        setOllamaModels(prev => ({
                            ...prev,
                            [config.id]: data.models
                        }));
                    }
                } catch (error) {
                    logger.error('Failed to fetch Ollama models:', { error: error instanceof Error ? error.message : String(error) });
                }
            }
        };

        if (configs.length > 0) {
            fetchOllamaModels();
        }
    }, [configs, availableProviders]);

    // Fetch Groq models dynamically when Groq configs are present
    useEffect(() => {
        const fetchGroqModels = async () => {
            const groqConfigs = configs.filter(c => c.provider.type === 'groq');
            
            for (const config of groqConfigs) {
                try {
                    // Get API key from the config or from userLLMConfig
                    const response = await fetch(`/api/llm-providers/groq-models`);
                    const data = await response.json();
                    
                    if (data.success && data.models.length > 0) {
                        setGroqModels(prev => ({
                            ...prev,
                            [config.id]: data.models
                        }));
                    }
                } catch (error) {
                    logger.error('Failed to fetch Groq models:', { error: error instanceof Error ? error.message : String(error) });
                }
            }
        };

        if (configs.length > 0) {
            fetchGroqModels();
        }
    }, [configs]);

    useEffect(() => {
        const fetchLmstudioModels = async () => {
            const lmstudioConfigs = configs.filter(c => c.provider.type === 'lmstudio');

            for (const config of lmstudioConfigs) {
                try {
                    const baseUrl = config.baseUrl || availableProviders.find(p => p.type === 'lmstudio')?.baseUrl || 'http://localhost:1234';
                    const response = await fetch(`/api/llm-providers/lmstudio-models?baseUrl=${encodeURIComponent(baseUrl)}`);
                    const data = await response.json();

                    if (data.success && data.models.length > 0) {
                        setLmstudioModels(prev => ({
                            ...prev,
                            [config.id]: data.models
                        }));
                    }
                } catch (error) {
                    logger.error('Failed to fetch LM Studio models:', { error: error instanceof Error ? error.message : String(error) });
                }
            }
        };

        if (configs.length > 0) {
            fetchLmstudioModels();
        }
    }, [configs, availableProviders]);

    useEffect(() => {
        fetchProviders();
    }, []);

    const fetchProviders = async () => {
        try {
            const response = await fetch('/api/llm-providers');
            const data = await response.json();
            
            if (data.success) {
                setConfigs(data.configs);
                setAvailableProviders(data.availableProviders);
            }
        } catch (error) {
            addToast('Failed to load LLM providers', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleAdd = async (data: {
        providerId: string;
        name: string;
        apiKey?: string;
        baseUrl?: string;
    }) => {
        try {
            const response = await fetch('/api/llm-providers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            
            const result = await response.json();
            
            if (result.success) {
                await fetchProviders();
                return { success: true, config: result.config };
            } else {
                return { success: false, error: result.message };
            }
        } catch (error) {
            return { success: false, error: 'Network error' };
        }
    };

    const handleTest = async (configId: string) => {
        try {
            const response = await fetch(`/api/llm-providers?id=${configId}`, {
                method: 'PATCH'
            });
            
            const result = await response.json();
            
            if (result.success) {
                if (result.connected) {
                    addToast('Connection successful!', 'success');
                } else {
                    addToast(`Connection failed: ${result.message}`, 'error');
                }
                await fetchProviders();
            } else {
                addToast(result.message || 'Test failed', 'error');
            }
            
            return result;
        } catch (error) {
            const message = (error as Error).message || 'Network error';
            addToast(message, 'error');
            throw error;
        }
    };

    const handleDelete = async (configId: string) => {
        try {
            const response = await fetch(`/api/llm-providers?id=${configId}`, {
                method: 'DELETE'
            });
            
            if (response.ok) {
                await fetchProviders();
                addToast('Provider deleted', 'success');
            } else {
                const data = await response.json();
                addToast(data.message || 'Failed to delete', 'error');
            }
        } catch (error) {
            addToast('Network error', 'error');
        }
    };

    const handleToggleEnable = async (configId: string, enabled: boolean) => {
        try {
            const response = await fetch(`/api/llm-providers?id=${configId}&action=enable&enabled=${enabled}`, {
                method: 'PATCH'
            });
            
            const result = await response.json();
            
            if (result.success) {
                addToast(`Provider ${enabled ? 'enabled' : 'disabled'}`, 'success');
                await fetchProviders();
            } else {
                addToast(result.message || 'Failed to update', 'error');
            }
        } catch (error) {
            addToast('Network error', 'error');
        }
    };

    const handleSelectModel = async (configId: string, modelId: string, modelName?: string) => {
        try {
            // Build URL manually to avoid double encoding
            const params = new URLSearchParams({
                id: configId,
                action: 'selectModel'
            });
            // Append modelId without additional encoding (it will be encoded by URLSearchParams)
            params.append('modelId', modelId);
            if (modelName) {
                params.append('modelName', modelName);
            }
            
            const response = await fetch(`/api/llm-providers?${params.toString()}`, {
                method: 'PATCH'
            });
            
            const result = await response.json();
            
            if (result.success) {
                addToast('Model selected', 'success');
                await fetchProviders();
                // Reinitialize LLM providers on server to use new model
                await fetch('/api/llm-init?force=true', { method: 'POST' });
            } else {
                addToast(result.message || 'Failed to select model', 'error');
            }
        } catch (error) {
            addToast('Network error', 'error');
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-32">
                <Loader2 className="w-6 h-6 animate-spin" />
            </div>
        );
    }

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg">LLM Providers</CardTitle>
                <AddProviderDialog
                    availableProviders={availableProviders}
                    onAdd={handleAdd}
                    onTest={handleTest}
                />
            </CardHeader>
            <CardContent>
                <div className="space-y-3">
                    {configs.map((config) => {
                        // Use dynamic models if available (Ollama or Groq), otherwise fall back to static list
                        let dynamicModels: { id: string; name: string; externalId: string }[] = [];
                        
                        if (config.provider.type === 'ollama' && ollamaModels[config.id]) {
                            dynamicModels = ollamaModels[config.id].map(m => ({ 
                                id: m.externalId, 
                                name: m.name, 
                                externalId: m.externalId 
                            }));
                        } else if (config.provider.type === 'groq' && groqModels[config.id]) {
                            dynamicModels = groqModels[config.id]
                                .filter((m: any) => m.active)
                                .map((m: any) => ({ 
                                    id: m.externalId, 
                                    name: m.name, 
                                    externalId: m.externalId 
                                }));
                        } else if (config.provider.type === 'lmstudio' && lmstudioModels[config.id]) {
                            dynamicModels = lmstudioModels[config.id].map(m => ({
                                id: m.externalId,
                                name: m.name,
                                externalId: m.externalId
                            }));
                        } else {
                            dynamicModels = availableProviders.find(p => p.type === config.provider.type)?.models || [];
                        }
                        
                        return (
                            <LLMProviderCard
                                key={config.id}
                                config={config}
                                availableModels={dynamicModels}
                                onTest={handleTest}
                                onDelete={handleDelete}
                                onToggleEnable={handleToggleEnable}
                                onSelectModel={handleSelectModel}
                            />
                        );
                    })}
                    
                    {configs.length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-4">
                            No providers configured. Click + to add one.
                        </p>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
