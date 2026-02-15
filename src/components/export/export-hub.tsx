'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, FileText, Mail, Share2 } from 'lucide-react';

export function ExportHub() {
    const [activeTab, setActiveTab] = useState<'powerpoint' | 'social' | 'digest'>('powerpoint');
    const [loading, setLoading] = useState(false);
    const [days, setDays] = useState(30);
    const [limit, setLimit] = useState(10);

    const handlePowerPointExport = async () => {
        setLoading(true);
        try {
            const response = await fetch('/api/export/powerpoint', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ days, limit })
            });

            if (response.ok) {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `research-briefing-${new Date().toISOString().split('T')[0]}.pptx`;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
            } else {
                alert('Failed to generate PowerPoint');
            }
        } catch (error) {
            console.error('Export error:', error);
            alert('Failed to generate PowerPoint');
        } finally {
            setLoading(false);
        }
    };

    const handleSocialMediaExport = async () => {
        setLoading(true);
        try {
            const response = await fetch('/api/export/social-media', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ platform: 'LinkedIn', count: 3 })
            });

            const data = await response.json();
            if (data.success && data.posts && data.posts.length > 0) {
                const posts = data.posts.map((post: any, i: number) => 
                    `${i + 1}. ${post.platform} Post:\n\n${post.content}\n\n`
                ).join('\n');

                const blob = new Blob([posts], { type: 'text/plain' });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `social-media-posts-${new Date().toISOString().split('T')[0]}.txt`;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
            } else {
                alert('Failed to generate social media posts');
            }
        } catch (error) {
            console.error('Export error:', error);
            alert('Failed to generate social media posts');
        } finally {
            setLoading(false);
        }
    };

    const handleEmailDigest = async () => {
        const email = prompt('Enter your email address for the digest:');
        if (!email) return;

        setLoading(true);
        try {
            const response = await fetch('/api/export/digest', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    frequency: 'weekly',
                    recipientEmail: email,
                    includeStats: true,
                    maxPapers: limit,
                    days
                })
            });

            const data = await response.json();
            if (data.success) {
                alert(`Digest sent to ${email} with ${data.digest.paperCount} papers`);
            } else {
                alert('Failed to send digest: ' + data.error);
            }
        } catch (error) {
            console.error('Digest error:', error);
            alert('Failed to send digest');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight mb-2">Export & Sharing</h1>
                <p className="text-muted-foreground">
                    Export research findings in multiple formats for presentations, social media, or email newsletters
                </p>
            </div>

            <div className="flex gap-2 mb-6">
                <Button
                    variant={activeTab === 'powerpoint' ? 'default' : 'outline'}
                    onClick={() => setActiveTab('powerpoint')}
                >
                    <FileText className="mr-2 h-4 w-4" />
                    PowerPoint
                </Button>
                <Button
                    variant={activeTab === 'social' ? 'default' : 'outline'}
                    onClick={() => setActiveTab('social')}
                >
                    <Share2 className="mr-2 h-4 w-4" />
                    Social Media
                </Button>
                <Button
                    variant={activeTab === 'digest' ? 'default' : 'outline'}
                    onClick={() => setActiveTab('digest')}
                >
                    <Mail className="mr-2 h-4 w-4" />
                    Email Digest
                </Button>
            </div>

            <div className="grid gap-4 mb-6 md:grid-cols-3">
                <div>
                    <label className="text-sm font-medium mb-2 block">Time Period (days)</label>
                    <input
                        type="number"
                        value={days}
                        onChange={(e) => setDays(parseInt(e.target.value))}
                        min="1"
                        max="365"
                        className="w-full px-3 py-2 border rounded-md"
                    />
                </div>
                <div>
                    <label className="text-sm font-medium mb-2 block">Papers to Include</label>
                    <input
                        type="number"
                        value={limit}
                        onChange={(e) => setLimit(parseInt(e.target.value))}
                        min="1"
                        max="50"
                        className="w-full px-3 py-2 border rounded-md"
                    />
                </div>
            </div>

            {activeTab === 'powerpoint' && (
                <Card>
                    <CardHeader>
                        <CardTitle>PowerPoint Export</CardTitle>
                        <CardDescription>
                            Generate a professional presentation deck with recent research papers
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="space-y-2">
                                    <h4 className="font-medium">Included in Export:</h4>
                                    <ul className="text-sm text-muted-foreground space-y-1">
                                        <li>✓ Executive summary</li>
                                        <li>✓ Paper titles and abstracts</li>
                                        <li>✓ AI-generated insights</li>
                                        <li>✓ Tags and topics</li>
                                        <li>✓ Recommendations slide</li>
                                    </ul>
                                </div>
                                <div className="space-y-2">
                                    <h4 className="font-medium">Customization:</h4>
                                    <ul className="text-sm text-muted-foreground space-y-1">
                                        <li>• Include/exclude abstracts</li>
                                        <li>• Include/exclude AI summaries</li>
                                        <li>• Include/exclude tags</li>
                                        <li>• Filter by search term</li>
                                    </ul>
                                </div>
                            </div>
                            <Button
                                onClick={handlePowerPointExport}
                                disabled={loading}
                                className="w-full"
                                size="lg"
                            >
                                <Download className="mr-2 h-4 w-4" />
                                {loading ? 'Generating...' : 'Download PowerPoint (.pptx)'}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {activeTab === 'social' && (
                <Card>
                    <CardHeader>
                        <CardTitle>Social Media Posts</CardTitle>
                        <CardDescription>
                            Generate ready-to-share LinkedIn and Twitter posts for recent papers
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="space-y-2">
                                    <h4 className="font-medium">LinkedIn Posts:</h4>
                                    <p className="text-sm text-muted-foreground">
                                        Professional, thought leadership style with emojis, hashtags, and insights
                                    </p>
                                </div>
                                <div className="space-y-2">
                                    <h4 className="font-medium">Twitter/X Posts:</h4>
                                    <p className="text-sm text-muted-foreground">
                                        Concise, engaging format with emojis and hashtags (280 chars)
                                    </p>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <h4 className="font-medium">Features:</h4>
                                <ul className="text-sm text-muted-foreground space-y-1">
                                    <li>• Platform-specific formatting</li>
                                    <li>• Relevant hashtags</li>
                                    <li>• Key insights extraction</li>
                                    <li>• Paper links included</li>
                                    <li>• Emoji suggestions</li>
                                </ul>
                            </div>
                            <Button
                                onClick={handleSocialMediaExport}
                                disabled={loading}
                                className="w-full"
                                size="lg"
                            >
                                <Share2 className="mr-2 h-4 w-4" />
                                {loading ? 'Generating...' : 'Generate Social Posts'}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {activeTab === 'digest' && (
                <Card>
                    <CardHeader>
                        <CardTitle>Email Digest</CardTitle>
                        <CardDescription>
                            Schedule or send email digests with research summaries and statistics
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="space-y-2">
                                    <h4 className="font-medium">Frequency Options:</h4>
                                    <ul className="text-sm text-muted-foreground space-y-1">
                                        <li>• Daily (last 24 hours)</li>
                                        <li>• Weekly (last 7 days)</li>
                                        <li>• Monthly (last 30 days)</li>
                                    </ul>
                                </div>
                                <div className="space-y-2">
                                    <h4 className="font-medium">Included:</h4>
                                    <ul className="text-sm text-muted-foreground space-y-1">
                                        <li>• Paper summaries</li>
                                        <li>• Statistics & metrics</li>
                                        <li>• Top topics</li>
                                        <li>• AI insights</li>
                                    </ul>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <h4 className="font-medium">Optional Attachments:</h4>
                                <ul className="text-sm text-muted-foreground space-y-1">
                                    <li>• PowerPoint presentation</li>
                                    <li>• Social media post drafts</li>
                                </ul>
                            </div>
                            <Button
                                onClick={handleEmailDigest}
                                disabled={loading}
                                className="w-full"
                                size="lg"
                            >
                                <Mail className="mr-2 h-4 w-4" />
                                {loading ? 'Sending...' : 'Send Email Digest'}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}