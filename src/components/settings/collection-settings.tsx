"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RotateCcw, Save, Settings } from 'lucide-react';

interface CollectionConfig {
    autoTimeRangeDays: number;
    autoDefaultQuery: string;
    maxResults: number;
    constraints: {
        maxResultsHardLimit: number;
        autoTimeRangeDaysHardLimit: number;
    };
}

const DEFAULT_CONFIG: CollectionConfig = {
    autoTimeRangeDays: 7,
    autoDefaultQuery: 'AI in banking',
    maxResults: 20,
    constraints: {
        maxResultsHardLimit: 100,
        autoTimeRangeDaysHardLimit: 90
    }
};

export default function CollectionSettings() {
    const [config, setConfig] = useState<CollectionConfig>(DEFAULT_CONFIG);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    useEffect(() => {
        loadConfig();
    }, []);

    const loadConfig = async () => {
        try {
            const response = await fetch('/api/settings/collection');
            const data = await response.json();
            if (data.success && data.config) {
                setConfig(data.config);
            }
        } catch (error) {
            console.error('Failed to load collection config:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        setMessage(null);

        try {
            const response = await fetch('/api/settings/collection', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(config)
            });

            const data = await response.json();

            if (data.success) {
                setMessage({ type: 'success', text: 'Settings saved successfully' });
                if (data.config) {
                    setConfig(data.config);
                }
            } else {
                setMessage({ type: 'error', text: data.message || 'Failed to save settings' });
            }
        } catch (error) {
            setMessage({ type: 'error', text: 'Failed to save settings' });
        } finally {
            setIsSaving(false);
        }
    };

    const handleReset = () => {
        setConfig(DEFAULT_CONFIG);
        setMessage({ type: 'success', text: 'Reset to default values (not saved)' });
    };

    const handleNumberChange = (field: 'autoTimeRangeDays' | 'maxResults', value: string) => {
        const numValue = parseInt(value, 10);
        if (!isNaN(numValue) && numValue >= 1) {
            const hardLimit = field === 'autoTimeRangeDays' 
                ? config.constraints.autoTimeRangeDaysHardLimit 
                : config.constraints.maxResultsHardLimit;
            
            if (numValue <= hardLimit) {
                setConfig(prev => ({ ...prev, [field]: numValue }));
            }
        }
    };

    if (isLoading) {
        return (
            <Card>
                <CardContent className="p-6">
                    <p className="text-muted-foreground">Loading collection settings...</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center gap-2">
                    <Settings className="h-5 w-5 text-primary" />
                    <CardTitle>Collection Settings</CardTitle>
                </div>
                <CardDescription>
                    Configure auto collection parameters and result limits.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Auto Collection Settings */}
                <div className="space-y-4">
                    <h4 className="text-sm font-medium text-muted-foreground">Auto Collection</h4>
                    
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="autoTimeRangeDays">
                                Auto Collection Time Range (Days)
                            </Label>
                            <Input
                                id="autoTimeRangeDays"
                                type="number"
                                min={1}
                                max={config.constraints.autoTimeRangeDaysHardLimit}
                                value={config.autoTimeRangeDays}
                                onChange={(e) => handleNumberChange('autoTimeRangeDays', e.target.value)}
                            />
                            <p className="text-xs text-muted-foreground">
                                Max: {config.constraints.autoTimeRangeDaysHardLimit} days
                            </p>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="autoDefaultQuery">
                                Auto Collection Default Query
                            </Label>
                            <Input
                                id="autoDefaultQuery"
                                type="text"
                                value={config.autoDefaultQuery}
                                onChange={(e) => setConfig(prev => ({ 
                                    ...prev, 
                                    autoDefaultQuery: e.target.value 
                                }))}
                                placeholder="AI in banking"
                            />
                        </div>
                    </div>
                </div>

                {/* Shared Settings */}
                <div className="space-y-4">
                    <h4 className="text-sm font-medium text-muted-foreground">
                        Shared Settings (Auto + Pipeline)
                    </h4>
                    
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="maxResults">
                                Max Results per Source
                            </Label>
                            <Input
                                id="maxResults"
                                type="number"
                                min={1}
                                max={config.constraints.maxResultsHardLimit}
                                value={config.maxResults}
                                onChange={(e) => handleNumberChange('maxResults', e.target.value)}
                            />
                            <p className="text-xs text-muted-foreground">
                                Applied to both Auto Collection and Pipeline mode. Max: {config.constraints.maxResultsHardLimit}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Message */}
                {message && (
                    <div className={`text-sm ${message.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                        {message.text}
                    </div>
                )}

                {/* Actions */}
                <div className="flex gap-2">
                    <Button onClick={handleSave} disabled={isSaving}>
                        <Save className="h-4 w-4 mr-2" />
                        {isSaving ? 'Saving...' : 'Save Settings'}
                    </Button>
                    <Button variant="outline" onClick={handleReset}>
                        <RotateCcw className="h-4 w-4 mr-2" />
                        Reset to Default
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
