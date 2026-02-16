"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Trash2, Plus, ChevronDown, ChevronRight, Pencil, GraduationCap, Building2, Share2, Scale, FileText } from "lucide-react"

interface Source {
    id: string;
    name: string;
    displayName?: string;
    url: string;
    type: string;
    enabled: boolean;
}

interface SystemSource {
    name: string;
    displayName: string;
    description: string;
    url: string;
    enabled: boolean;
    hasCollector: boolean | 'proxy';
}

interface SourceType {
    id: string;
    displayName: string;
    icon: string;
    description: string;
    sortOrder: number;
    allowUserAdd: boolean;
    systemSources: SystemSource[];
}

interface SourceTypesConfig {
    sourceTypes: SourceType[];
}

const iconMap: Record<string, React.ReactNode> = {
    'GraduationCap': <GraduationCap className="h-5 w-5" />,
    'Building2': <Building2 className="h-5 w-5" />,
    'Share2': <Share2 className="h-5 w-5" />,
    'Scale': <Scale className="h-5 w-5" />,
    'FileText': <FileText className="h-5 w-5" />,
}

export default function SourceManager() {
    const [sourceTypes, setSourceTypes] = useState<SourceType[]>([]);
    const [dbSources, setDbSources] = useState<Source[]>([]);
    const [expandedTypes, setExpandedTypes] = useState<string[]>(['academic']);
    const [newSource, setNewSource] = useState({ name: '', displayName: '', url: '', type: 'academic' });
    const [addingToType, setAddingToType] = useState<string | null>(null);
    const [editingSource, setEditingSource] = useState<Source | null>(null);
    const [editForm, setEditForm] = useState({ displayName: '', url: '' });

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const configRes = await fetch('/api/source-types');
            if (configRes.ok) {
                const config: SourceTypesConfig = await configRes.json();
                setSourceTypes(config.sourceTypes || []);
            }

            const sourcesRes = await fetch('/api/sources');
            if (sourcesRes.ok) {
                setDbSources(await sourcesRes.json());
            }
        } catch (error) {
            console.error('Failed to load source data:', error);
        }
    };

    const toggleExpand = (typeId: string) => {
        setExpandedTypes(prev => 
            prev.includes(typeId) 
                ? prev.filter(t => t !== typeId)
                : [...prev, typeId]
        );
    };

    const handleToggleSource = async (sourceName: string, enabled: boolean) => {
        try {
            await fetch('/api/sources', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: sourceName, enabled: !enabled })
            });
            loadData();
        } catch (error) {
            console.error('Failed to toggle source:', error);
        }
    };

    const handleAddSource = async (typeId: string) => {
        if (!newSource.name || !newSource.url) return;

        try {
            await fetch('/api/sources', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: newSource.name.toLowerCase(),
                    displayName: newSource.displayName || newSource.name,
                    url: newSource.url,
                    type: typeId,
                    enabled: true
                })
            });
            setNewSource({ name: '', displayName: '', url: '', type: 'academic' });
            setAddingToType(null);
            loadData();
        } catch (error) {
            console.error('Failed to add source:', error);
        }
    };

    const handleUpdateSource = async () => {
        if (!editingSource || !editForm.url) return;

        try {
            await fetch('/api/sources', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: editingSource.id,
                    displayName: editForm.displayName,
                    url: editForm.url
                })
            });
            setEditingSource(null);
            setEditForm({ displayName: '', url: '' });
            loadData();
        } catch (error) {
            console.error('Failed to update source:', error);
        }
    };

    const handleDeleteSource = async (id: string) => {
        try {
            await fetch('/api/sources', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id })
            });
            loadData();
        } catch (error) {
            console.error('Failed to delete source:', error);
        }
    };

    const startEdit = (source: Source) => {
        setEditingSource(source);
        setEditForm({ displayName: source.displayName || source.name, url: source.url });
    };

    const getCustomSourcesForType = (typeId: string, systemSources: SystemSource[]): Source[] => {
        const systemSourceNames = new Set(systemSources.map(s => s.name.toLowerCase()));
        return dbSources.filter(s => 
            s.type === typeId && 
            !systemSourceNames.has(s.name.toLowerCase())
        );
    };

    const getEnabledCount = (typeId: string, systemSources: SystemSource[]): number => {
        const enabledSystem = systemSources.filter(s => {
            const dbSource = dbSources.find(d => d.name.toLowerCase() === s.name.toLowerCase());
            return dbSource?.enabled ?? s.enabled;
        }).length;
        const enabledCustom = getCustomSourcesForType(typeId, systemSources).filter(s => s.enabled).length;
        return enabledSystem + enabledCustom;
    };

    return (
        <div className="p-6 border rounded-lg bg-card mt-6">
            <h3 className="font-semibold mb-4">Manage Sources</h3>
            
            <div className="space-y-3">
                {sourceTypes.map(sourceType => {
                    const isExpanded = expandedTypes.includes(sourceType.id);
                    const enabledCount = getEnabledCount(sourceType.id, sourceType.systemSources);
                    const customSources = getCustomSourcesForType(sourceType.id, sourceType.systemSources);
                    
                    return (
                        <div key={sourceType.id} className="border rounded-lg">
                            <button
                                onClick={() => toggleExpand(sourceType.id)}
                                className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
                            >
                                <div className="flex items-center gap-3">
                                    {iconMap[sourceType.icon] || <FileText className="h-5 w-5" />}
                                    <div className="text-left">
                                        <p className="font-medium">{sourceType.displayName}</p>
                                        <p className="text-xs text-muted-foreground">{sourceType.description}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Badge variant="outline" className="text-xs">
                                        {enabledCount} enabled
                                    </Badge>
                                    {isExpanded 
                                        ? <ChevronDown className="h-4 w-4" />
                                        : <ChevronRight className="h-4 w-4" />
                                    }
                                </div>
                            </button>

                            {isExpanded && (
                                <div className="px-4 pb-4 space-y-2">
                                    {/* System Sources */}
                                    {sourceType.systemSources.length > 0 && (
                                        <div className="space-y-1">
                                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide pt-2">
                                                System Sources
                                            </p>
                                            {sourceType.systemSources.map(sysSource => {
                                                const dbSource = dbSources.find(s => 
                                                    s.name.toLowerCase() === sysSource.name.toLowerCase()
                                                );
                                                const isEnabled = dbSource?.enabled ?? sysSource.enabled;
                                                const displayUrl = dbSource?.url || sysSource.url;
                                                
                                                return (
                                                    <div 
                                                        key={sysSource.name}
                                                        className="flex items-center justify-between p-3 bg-muted/30 rounded"
                                                    >
                                                        <div className="flex-1">
                                                            <div className="flex items-center gap-2">
                                                                <p className="font-medium text-sm">{sysSource.displayName}</p>
                                                                {sysSource.hasCollector === 'proxy' && (
                                                                    <Badge variant="outline" className="text-[10px]">proxy</Badge>
                                                                )}
                                                            </div>
                                                            <p className="text-xs text-muted-foreground">{sysSource.description}</p>
                                                            <p className="text-xs text-blue-600 font-mono truncate">{displayUrl}</p>
                                                        </div>
                                                        <button
                                                            onClick={() => handleToggleSource(sysSource.name, isEnabled)}
                                                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                                                isEnabled ? 'bg-primary' : 'bg-muted'
                                                            }`}
                                                        >
                                                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                                                isEnabled ? 'translate-x-6' : 'translate-x-1'
                                                            }`} />
                                                        </button>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}

                                    {/* Custom Sources */}
                                    {customSources.length > 0 && (
                                        <div className="space-y-1">
                                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide pt-2">
                                                Custom Sources
                                            </p>
                                            {customSources.map((source: Source) => (
                                                <div key={source.id}>
                                                    {editingSource?.id === source.id ? (
                                                        <div className="space-y-2 p-3 border rounded bg-background">
                                                            <Input
                                                                placeholder="Display name"
                                                                value={editForm.displayName}
                                                                onChange={e => setEditForm({...editForm, displayName: e.target.value})}
                                                                className="text-sm"
                                                            />
                                                            <Input
                                                                placeholder="URL (required)"
                                                                value={editForm.url}
                                                                onChange={e => setEditForm({...editForm, url: e.target.value})}
                                                                className="text-sm"
                                                            />
                                                            <div className="flex gap-2">
                                                                <Button size="sm" onClick={handleUpdateSource}>Save</Button>
                                                                <Button size="sm" variant="outline" onClick={() => setEditingSource(null)}>Cancel</Button>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center justify-between p-3 bg-muted/30 rounded">
                                                            <div className="flex-1">
                                                                <p className="font-medium text-sm">{source.displayName || source.name}</p>
                                                                <p className="text-xs text-blue-600 font-mono truncate">{source.url}</p>
                                                            </div>
                                                            <div className="flex items-center gap-1">
                                                                <button
                                                                    onClick={() => handleToggleSource(source.name, source.enabled)}
                                                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                                                        source.enabled ? 'bg-primary' : 'bg-muted'
                                                                    }`}
                                                                >
                                                                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                                                        source.enabled ? 'translate-x-6' : 'translate-x-1'
                                                                    }`} />
                                                                </button>
                                                                <Button variant="ghost" size="icon" onClick={() => startEdit(source)} className="h-8 w-8">
                                                                    <Pencil className="h-4 w-4" />
                                                                </Button>
                                                                <Button variant="ghost" size="icon" onClick={() => handleDeleteSource(source.id)} className="h-8 w-8">
                                                                    <Trash2 className="h-4 w-4 text-red-500" />
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Add New Source Form */}
                                    {sourceType.allowUserAdd && (
                                        <div className="pt-2">
                                            {addingToType === sourceType.id ? (
                                                <div className="space-y-2 p-3 border rounded bg-background">
                                                    <Input
                                                        placeholder="Source name (e.g., wsj)"
                                                        value={newSource.name}
                                                        onChange={e => setNewSource({...newSource, name: e.target.value})}
                                                        className="text-sm"
                                                    />
                                                    <Input
                                                        placeholder="Display name (e.g., Wall Street Journal)"
                                                        value={newSource.displayName}
                                                        onChange={e => setNewSource({...newSource, displayName: e.target.value})}
                                                        className="text-sm"
                                                    />
                                                    <Input
                                                        placeholder="URL (required, e.g., https://api.example.com)"
                                                        value={newSource.url}
                                                        onChange={e => setNewSource({...newSource, url: e.target.value})}
                                                        className="text-sm"
                                                        required
                                                    />
                                                    <div className="flex gap-2">
                                                        <Button 
                                                            size="sm" 
                                                            onClick={() => handleAddSource(sourceType.id)}
                                                            disabled={!newSource.name || !newSource.url}
                                                        >
                                                            Add
                                                        </Button>
                                                        <Button 
                                                            size="sm" 
                                                            variant="outline"
                                                            onClick={() => {
                                                                setAddingToType(null);
                                                                setNewSource({ name: '', displayName: '', url: '', type: 'academic' });
                                                            }}
                                                        >
                                                            Cancel
                                                        </Button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => setAddingToType(sourceType.id)}
                                                    className="w-full"
                                                >
                                                    <Plus className="mr-2 h-4 w-4" />
                                                    Add Custom {sourceType.displayName} Source
                                                </Button>
                                            )}
                                        </div>
                                    )}

                                    {sourceType.systemSources.length === 0 && customSources.length === 0 && (
                                        <p className="text-sm text-muted-foreground py-2">
                                            No sources configured for this category.
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    )
}
