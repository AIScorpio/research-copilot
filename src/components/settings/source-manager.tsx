"use client"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Trash2, Plus } from "lucide-react"

export default function SourceManager() {
    const [sources, setSources] = useState<any[]>([]);
    const [newName, setNewName] = useState("");
    const [newUrl, setNewUrl] = useState("");

    useEffect(() => {
        fetchSources();
    }, []);

    const fetchSources = async () => {
        const res = await fetch('/api/sources');
        if (res.ok) setSources(await res.json());
    }

    const handleAdd = async () => {
        if (!newName || !newUrl) return;
        await fetch('/api/sources', {
            method: 'POST',
            body: JSON.stringify({ name: newName, url: newUrl })
        });
        setNewName("");
        setNewUrl("");
        fetchSources();
    };

    const handleDelete = async (id: string) => {
        await fetch('/api/sources', {
            method: 'DELETE',
            body: JSON.stringify({ id })
        });
        fetchSources();
    }

    return (
        <div className="p-6 border rounded-lg bg-card mt-6">
            <h3 className="font-semibold mb-4">Manage Sources</h3>

            <div className="flex gap-2 mb-4">
                <Input placeholder="Source Name (e.g. Wired)" value={newName} onChange={e => setNewName(e.target.value)} className="w-1/3" />
                <Input placeholder="URL (e.g. https://wired.com)" value={newUrl} onChange={e => setNewUrl(e.target.value)} className="flex-1" />
                <Button onClick={handleAdd} size="sm"><Plus className="mr-2 h-4 w-4" /> Add</Button>
            </div>

            <div className="space-y-2">
                {sources.length === 0 && <p className="text-sm text-muted-foreground">No custom sources added.</p>}
                {sources.map(s => (
                    <div key={s.id} className="flex items-center justify-between p-3 border rounded bg-muted/50">
                        <div>
                            <p className="font-medium text-sm">{s.name}</p>
                            <p className="text-xs text-muted-foreground">{s.url}</p>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(s.id)}>
                            <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                    </div>
                ))}
            </div>
        </div>
    )
}
