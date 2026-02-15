'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
    CheckCircle2, 
    XCircle, 
    Loader2, 
    Trash2, 
    Server,
    Cloud,
    Play
} from 'lucide-react';

interface LLMProviderCardProps {
    config: {
        id: string;
        name: string;
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
    };
    availableModels: Array<{
        id: string;
        name: string;
        externalId: string;
    }>;
    onTest: (id: string) => Promise<void>;
    onDelete: (id: string) => Promise<void>;
    onToggleEnable: (id: string, enabled: boolean) => Promise<void>;
    onSelectModel: (configId: string, modelId: string, modelName?: string) => Promise<void>;
}

export function LLMProviderCard({
    config,
    availableModels,
    onTest,
    onDelete,
    onToggleEnable,
    onSelectModel
}: LLMProviderCardProps) {
    const [isTesting, setIsTesting] = useState(false);
    
    // Get selected model from config (saved in DB) or fall back to available models
    const getSelectedModelId = () => {
        // First check if there's a default model in config (from DB)
        const defaultModel = config.models.find(m => m.isDefault);
        if (defaultModel) {
            return defaultModel.externalId;
        }
        // If no default but there are available models, don't auto-select
        return '';
    };
    
    const [selectedModelId, setSelectedModelId] = useState(getSelectedModelId());

    // Sync selectedModelId when config changes (e.g., after parent refreshes data)
    useEffect(() => {
        const newSelectedId = getSelectedModelId();
        if (newSelectedId !== selectedModelId) {
            setSelectedModelId(newSelectedId);
        }
    }, [config.models, availableModels]);

    const handleTest = async () => {
        setIsTesting(true);
        try {
            await onTest(config.id);
        } finally {
            setIsTesting(false);
        }
    };

    const handleModelChange = (value: string) => {
        setSelectedModelId(value);
        const selectedModel = availableModels.find(m => m.externalId === value);
        onSelectModel(config.id, value, selectedModel?.name);
    };

    const getStatusBadge = () => {
        switch (config.status) {
            case 'connected':
                return <Badge className="bg-green-500 text-xs">Connected</Badge>;
            case 'failed':
                return <Badge variant="destructive" className="text-xs">Failed</Badge>;
            default:
                return <Badge variant="secondary" className="text-xs">Untested</Badge>;
        }
    };

    // Enable switch only when connected
    const canEnable = config.status === 'connected';
    
    // Model select enabled when connected and has models
    const canSelectModel = config.status === 'connected' && availableModels.length > 0;

    return (
        <div className={`p-4 border rounded-lg ${config.isEnabled ? 'border-primary bg-primary/5' : 'border-border'}`}>
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    {config.provider.isCloud ? (
                        <Cloud className="w-4 h-4 text-blue-500" />
                    ) : (
                        <Server className="w-4 h-4 text-green-500" />
                    )}
                    <span className="font-medium">{config.name}</span>
                    {getStatusBadge()}
                </div>
                <div className="flex items-center gap-2">
                    <Switch
                        checked={config.isEnabled}
                        onCheckedChange={(checked) => onToggleEnable(config.id, checked)}
                        disabled={!canEnable}
                    />
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => onDelete(config.id)}
                    >
                        <Trash2 className="w-4 h-4" />
                    </Button>
                </div>
            </div>

            <div className="flex items-center gap-2">
                <Select
                    value={selectedModelId}
                    onValueChange={handleModelChange}
                    disabled={!canSelectModel}
                >
                    <SelectTrigger className="flex-1">
                        <SelectValue placeholder={canSelectModel ? "Select model" : "No models"} />
                    </SelectTrigger>
                    <SelectContent>
                        {availableModels.map((model) => (
                            <SelectItem key={model.id} value={model.externalId}>
                                {model.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <Button
                    variant="outline"
                    size="icon"
                    onClick={handleTest}
                    disabled={isTesting}
                >
                    {isTesting ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                        <Play className="w-4 h-4" />
                    )}
                </Button>
            </div>
        </div>
    );
}
