'use client';

import { useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Plus, CheckCircle2, XCircle } from 'lucide-react';

interface ProviderBase {
    id: string;
    type: string;
    name: string;
    isCloud: boolean;
    baseUrl?: string;
}

function getApiKeyEnvName(providerType: string): string {
    switch (providerType) {
        case 'groq': return 'GROQ_API_KEY';
        case 'openai': return 'OPENAI_API_KEY';
        case 'anthropic': return 'ANTHROPIC_API_KEY';
        case 'gemini': return 'GEMINI_API_KEY';
        case 'azure': return 'AZURE_OPENAI_API_KEY';
        case 'cohere': return 'COHERE_API_KEY';
        case 'zhipuai': return 'ZHIPUAI_API_KEY';
        case 'kimi': return 'KIMI_API_KEY';
        case 'baidu': return 'BAIDU_API_KEY';
        case 'alibaba': return 'ALIBABA_API_KEY';
        default: return 'API_KEY';
    }
}

interface AddProviderDialogProps {
    availableProviders: ProviderBase[];
    onAdd: (data: {
        providerId: string;
        name: string;
        baseUrl?: string;
    }) => Promise<{ success: boolean; config?: any; error?: string }>;
    onTest: (configId: string) => Promise<{
        success: boolean;
        connected: boolean;
        message?: string;
        availableModels?: string[];
    }>;
}

export function AddProviderDialog({
    availableProviders,
    onAdd,
    onTest
}: AddProviderDialogProps) {
    const [open, setOpen] = useState(false);
    const [step, setStep] = useState<'form' | 'testing' | 'success' | 'error'>('form');
    const [selectedProvider, setSelectedProvider] = useState<ProviderBase | null>(null);
    const [apiKey, setApiKey] = useState('');
    const [baseUrl, setBaseUrl] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState('');

    const handleProviderChange = (providerId: string) => {
        const provider = availableProviders.find(p => p.id === providerId);
        setSelectedProvider(provider || null);
        // Auto-fill base URL for local providers
        if (provider?.baseUrl) {
            setBaseUrl(provider.baseUrl);
        } else {
            setBaseUrl('');
        }
        // Clear API key when changing provider
        setApiKey('');
    };

    const handleSubmit = async () => {
        if (!selectedProvider) return;

        setIsLoading(true);
        setStep('testing');
        
        try {
            const result = await onAdd({
                providerId: selectedProvider.id,
                name: selectedProvider.name,
                baseUrl: selectedProvider.isCloud ? undefined : baseUrl
            });

            if (result.success && result.config) {
                // Auto-test
                const testResult = await onTest(result.config.id);
                
                if (testResult.connected) {
                    setStep('success');
                    setMessage('Connection successful!');
                } else {
                    setStep('error');
                    setMessage(testResult.message || 'Connection failed');
                }
            } else {
                setStep('error');
                setMessage(result.error || 'Failed to create');
            }
        } catch (error) {
            setStep('error');
            setMessage('Network error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleClose = () => {
        setOpen(false);
        setStep('form');
        setSelectedProvider(null);
        setApiKey('');
        setBaseUrl('');
        setMessage('');
    };

    const needsApiKey = selectedProvider?.isCloud;
    const needsBaseUrl = !selectedProvider?.isCloud;

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                    <Plus className="w-5 h-5" />
                </Button>
            </DialogTrigger>

            <DialogContent className="sm:max-w-[400px]">
                <DialogHeader>
                    <DialogTitle>
                        {step === 'form' && 'Add Provider'}
                        {step === 'testing' && 'Testing...'}
                        {step === 'success' && 'Success!'}
                        {step === 'error' && 'Failed'}
                    </DialogTitle>
                    <DialogDescription>
                        {step === 'form' && 'Configure provider settings'}
                        {step === 'testing' && `Testing ${selectedProvider?.name}...`}
                        {step === 'success' && message}
                        {step === 'error' && message}
                    </DialogDescription>
                </DialogHeader>

                {step === 'form' && (
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Provider</Label>
                            <Select onValueChange={handleProviderChange}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select provider" />
                                </SelectTrigger>
                                <SelectContent>
                                    {availableProviders.map((provider) => (
                                        <SelectItem key={provider.id} value={provider.id}>
                                            {provider.name} {provider.isCloud ? '(Cloud)' : '(Local)'}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {selectedProvider?.isCloud && (
                            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded text-sm">
                                <p className="font-medium text-yellow-800">请先在 .env 文件中添加 API Key：</p>
                                <p className="text-yellow-700 mt-1">
                                    {getApiKeyEnvName(selectedProvider.type)}=your_key
                                </p>
                                <p className="text-yellow-600 text-xs mt-1">
                                    保存后重启服务器，然后点击测试
                                </p>
                            </div>
                        )}

                        {needsBaseUrl && (
                            <div className="space-y-2">
                                <Label>Base URL</Label>
                                <Input
                                    placeholder="http://localhost:11434"
                                    value={baseUrl}
                                    onChange={(e) => setBaseUrl(e.target.value)}
                                />
                            </div>
                        )}

                        <Button 
                            onClick={handleSubmit} 
                            disabled={!selectedProvider || isLoading}
                            className="w-full"
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Testing...
                                </>
                            ) : (
                                'Add & Test'
                            )}
                        </Button>
                    </div>
                )}

                {step === 'testing' && (
                    <div className="py-8 flex flex-col items-center gap-4">
                        <Loader2 className="w-10 h-10 animate-spin text-primary" />
                    </div>
                )}

                {step === 'success' && (
                    <div className="py-6 flex flex-col items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                            <CheckCircle2 className="w-6 h-6 text-green-600" />
                        </div>
                        <Button onClick={handleClose} className="w-full">
                            Done
                        </Button>
                    </div>
                )}

                {step === 'error' && (
                    <div className="py-6 flex flex-col items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                            <XCircle className="w-6 h-6 text-red-600" />
                        </div>
                        <Button onClick={handleClose} variant="outline" className="w-full">
                            Close
                        </Button>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
