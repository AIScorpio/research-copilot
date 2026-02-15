"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export default function AboutPage() {
    return (
        <div className="container py-6 px-4 md:px-8 max-w-3xl mx-auto">
            <h1 className="text-3xl font-bold mb-6">About InsightFlow</h1>

            <div className="space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Application Overview</CardTitle>
                        <CardDescription>
                            InsightFlow is an automated research pipeline for AI research in banking
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <h3 className="font-semibold mb-2">Project Name</h3>
                            <p className="text-muted-foreground">AIScorpio</p>
                        </div>
                        <div>
                            <h3 className="font-semibold mb-2">Version</h3>
                            <p className="text-muted-foreground">1.0.0</p>
                        </div>
                        <div>
                            <h3 className="font-semibold mb-2">Purpose</h3>
                            <p className="text-muted-foreground">
                                Automated research pipeline for banking AI with features including:
                            </p>
                            <ul className="list-disc list-inside text-muted-foreground mt-2 space-y-1">
                                <li>Auto-collection of academic papers from arXiv</li>
                                <li>Intelligent paper library management</li>
                                <li>AI-powered copilot for research assistance</li>
                                <li>Automated research pipeline execution</li>
                                <li>Paper archiving and organization</li>
                            </ul>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Author & Development</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            <div>
                                <h3 className="font-semibold mb-1">Developer</h3>
                                <p className="text-muted-foreground">Leon</p>
                            </div>
                            <div>
                                <h3 className="font-semibold mb-1">Contact</h3>
                                <p className="text-muted-foreground">demo@example.com</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-yellow-600 dark:text-yellow-500">Disclaimer</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm text-muted-foreground">
                        <p>
                            InsightFlow is provided as-is for research and educational purposes. The application
                            automatically collects and processes academic papers from arXiv, a public repository.
                        </p>
                        <Separator />
                        <p>
                            <strong>Data Sources:</strong> All papers are sourced from arXiv.org, an open-access
                            archive for scholarly articles. Users are responsible for complying with arXiv&apos;s terms
                            of service and copyright policies.
                        </p>
                        <Separator />
                        <p>
                            <strong>AI Limitations:</strong> The AI copilot and automated features may produce
                            inaccurate or incomplete information. Always verify results independently and use
                            critical thinking when interpreting research findings.
                        </p>
                        <Separator />
                        <p>
                            <strong>No Warranty:</strong> This software is provided without warranty of any kind,
                            express or implied. The authors are not liable for any damages arising from its use.
                        </p>
                        <Separator />
                        <p>
                            <strong>Privacy:</strong> Your research data is stored locally. No personal information
                            is transmitted to third parties except when fetching papers from arXiv.
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Technologies</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <span className="font-semibold">Framework:</span>
                                <span className="text-muted-foreground ml-2">Next.js</span>
                            </div>
                            <div>
                                <span className="font-semibold">UI Library:</span>
                                <span className="text-muted-foreground ml-2">shadcn/ui</span>
                            </div>
                            <div>
                                <span className="font-semibold">Styling:</span>
                                <span className="text-muted-foreground ml-2">Tailwind CSS</span>
                            </div>
                            <div>
                                <span className="font-semibold">AI Model:</span>
                                <span className="text-muted-foreground ml-2">Claude</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
