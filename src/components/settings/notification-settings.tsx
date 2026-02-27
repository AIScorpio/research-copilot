"use client"

import { useState, useEffect } from "react"
import { logger } from "@/lib/logger"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Bell, Mail, Plus, X, Loader2, CheckCircle2, ChevronDown, ChevronUp, AlertCircle } from "lucide-react"

export default function NotificationSettings() {
    const [settings, setSettings] = useState({
        emailAlerts: false,
        newsletterAlerts: false,
        subscribers: [] as { id: string, email: string }[]
    })
    const [newEmail, setNewEmail] = useState("")
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [saved, setSaved] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [isExpanded, setIsExpanded] = useState(true)

    useEffect(() => {
        refreshSettings();
    }, [])

    const refreshSettings = async () => {
        try {
            const res = await fetch("/api/user/notifications");
            const data = await res.json();
            if (!data.error) {
                setSettings(data);
            } else {
                setError(data.error);
            }
        } catch (err) {
            logger.error("Failed to load settings", { error: err instanceof Error ? err.message : String(err) });
            setError("Could not connect to the server.");
        } finally {
            setLoading(false);
        }
    }

    const handleToggle = async (key: string, value: boolean) => {
        setError(null);
        // Optimistic UI update
        const prevSettings = { ...settings };
        setSettings({ ...settings, [key]: value });

        try {
            const res = await fetch("/api/user/notifications", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: 'toggle', [key]: value })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to save");

            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
        } catch (err) {
            setSettings(prevSettings);
            setError(err instanceof Error ? err.message : 'Failed to save');
            logger.error('Failed to save notification settings', { error: err instanceof Error ? err.message : String(err) });
        }
    }

    const handleAddEmail = async () => {
        if (!newEmail || !newEmail.includes("@")) {
            setError("Please enter a valid email address.");
            return;
        }
        setError(null);
        setSaving(true);
        try {
            const res = await fetch("/api/user/notifications", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: 'add', email: newEmail })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to add email");

            if (data.success) {
                setSettings(data.settings);
                setNewEmail("");
                setSaved(true);
                setTimeout(() => setSaved(false), 2000);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to add email');
            logger.error('Failed to add email', { error: err instanceof Error ? err.message : String(err) });
        } finally {
            setSaving(false);
        }
    }

    const handleRemoveEmail = async (email: string) => {
        setError(null);
        try {
            const res = await fetch("/api/user/notifications", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: 'remove', email })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to remove email");

            if (data.success) {
                setSettings(data.settings);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to remove email');
            logger.error('Failed to remove email', { error: err instanceof Error ? err.message : String(err) });
        }
    }

    if (loading) {
        return <div className="p-6 border rounded-xl animate-pulse bg-muted/20 h-64" />;
    }

    return (
        <div className="space-y-6">
            {error && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-xs flex items-center gap-2 animate-in fade-in slide-in-from-top-1">
                    <AlertCircle className="h-4 w-4" />
                    {error}
                </div>
            )}

            {/* Preferences Section */}
            <div className="p-6 border rounded-xl bg-card shadow-sm border-indigo-500/10">
                <div className="flex items-center gap-2 mb-6 text-indigo-600 dark:text-indigo-400">
                    <Bell className="h-5 w-5" />
                    <h3 className="font-bold text-lg">Quick Alerts</h3>
                    {saved && <span className="text-[10px] text-green-500 font-bold ml-auto flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Auto-Saved</span>}
                </div>

                <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/20">
                        <div className="space-y-0.5">
                            <Label className="text-sm font-semibold">Immediate Paper Alerts</Label>
                            <p className="text-xs text-muted-foreground">Direct notification on ingest.</p>
                        </div>
                        <Switch
                            checked={settings.emailAlerts}
                            onCheckedChange={(checked) => handleToggle('emailAlerts', checked)}
                        />
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/20">
                        <div className="space-y-0.5">
                            <Label className="text-sm font-semibold">AI Newsletter Reports</Label>
                            <p className="text-xs text-muted-foreground">Comprehensive research summaries via Groq.</p>
                        </div>
                        <Switch
                            checked={settings.newsletterAlerts}
                            onCheckedChange={(checked) => handleToggle('newsletterAlerts', checked)}
                        />
                    </div>
                </div>
            </div>

            {/* Subscriber Manager */}
            <div className={`p-6 border rounded-xl bg-card shadow-sm border-purple-500/10 transition-all duration-300 ${isExpanded ? '' : 'h-[80px] overflow-hidden'}`}>
                <div className="flex items-center gap-2 mb-4 text-purple-600 dark:text-purple-400 cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
                    <Mail className="h-5 w-5" />
                    <h3 className="font-bold text-lg">Subscription List</h3>
                    <div className="ml-auto flex items-center gap-2">
                        <span className="text-[10px] bg-purple-500/10 px-2 py-0.5 rounded-full font-bold">
                            {settings.subscribers.length} recipients
                        </span>
                        {isExpanded ? <ChevronUp className="h-4 w-4 opacity-50" /> : <ChevronDown className="h-4 w-4 opacity-50" />}
                    </div>
                </div>

                {isExpanded && (
                    <div className="space-y-4 pt-2 animate-in fade-in slide-in-from-top-2">
                        <div className="flex gap-2">
                            <Input
                                value={newEmail}
                                onChange={(e) => setNewEmail(e.target.value)}
                                placeholder="Add another recipient email..."
                                className="bg-muted/20 border-purple-500/10 focus:border-purple-500/30"
                                onKeyDown={(e) => e.key === 'Enter' && handleAddEmail()}
                            />
                            <Button
                                onClick={handleAddEmail}
                                disabled={saving || !newEmail}
                                variant="outline"
                                className="border-purple-500/20 hover:bg-purple-500/10 min-w-[50px]"
                            >
                                {saving ? <Loader2 className="h-4 w-4 animate-spin text-purple-500" /> : <Plus className="h-4 w-4 text-purple-500" />}
                            </Button>
                        </div>

                        <div className="bg-muted/10 rounded-lg divide-y divide-purple-500/5 overflow-hidden border border-purple-500/5">
                            {settings.subscribers.length === 0 ? (
                                <div className="p-4 text-center text-xs text-muted-foreground italic">
                                    No additional subscribers. Only your primary account email will be used.
                                </div>
                            ) : (
                                settings.subscribers.map((sub) => (
                                    <div key={sub.id} className="p-3 flex items-center justify-between hover:bg-muted/30 group">
                                        <div className="flex items-center gap-2">
                                            <div className="h-1.5 w-1.5 rounded-full bg-purple-500 opacity-50" />
                                            <span className="text-sm">{sub.email}</span>
                                        </div>
                                        <button
                                            onClick={() => handleRemoveEmail(sub.email)}
                                            className="text-muted-foreground hover:text-red-500 transition-all opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/10 rounded"
                                        >
                                            <X className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
