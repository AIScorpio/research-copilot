import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowRight, Sparkles, Radar, Download, Share2, Zap } from "lucide-react"
import Link from "next/link"

export function FeatureCards() {
    const features = [
        {
            title: "PoC Recommendations",
            description: "AI-powered suggestions for proof-of-concept projects based on recent research trends",
            icon: Sparkles,
            href: "/recommendations",
            color: "from-purple-500/10 to-pink-500/10",
            borderColor: "border-purple-500/20",
            badge: "AI-Driven",
            action: "Generate"
        },
        {
            title: "Technology Radar",
            description: "Track emerging AI technologies and their readiness for banking applications",
            icon: Radar,
            href: "/radar",
            color: "from-blue-500/10 to-cyan-500/10",
            borderColor: "border-blue-500/20",
            badge: "Visual",
            action: "Explore"
        },
        {
            title: "Export & Share",
            description: "Generate PowerPoint presentations, social media posts, and email digests",
            icon: Download,
            href: "/export",
            color: "from-green-500/10 to-emerald-500/10",
            borderColor: "border-green-500/20",
            badge: "Multi-Format",
            action: "Export"
        },
        {
            title: "Banking Sources",
            description: "Research intelligence from Finextra, Banking Dive, BIS, ECB, and more",
            icon: Share2,
            href: "/sources",
            color: "from-orange-500/10 to-yellow-500/10",
            borderColor: "border-orange-500/20",
            badge: "New",
            action: "Configure"
        },
        {
            title: "Quick Collect",
            description: "Trigger auto-collection to fetch latest research from all enabled sources",
            icon: Zap,
            href: "/pipeline",
            color: "from-red-500/10 to-rose-500/10",
            borderColor: "border-red-500/20",
            badge: "Fast",
            action: "Start"
        }
    ];

    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            {features.map((feature, index) => (
                <Card 
                    key={index} 
                    className={`hover:shadow-lg transition-all cursor-pointer border-2 ${feature.borderColor} bg-gradient-to-br ${feature.color}`}
                >
                    <Link href={feature.href} className="block h-full">
                        <CardHeader className="pb-3">
                            <div className="flex items-start justify-between">
                                <div className="flex-1">
                                    <CardTitle className="text-lg mb-2 flex items-center gap-2">
                                        <feature.icon className="h-5 w-5" />
                                        {feature.title}
                                    </CardTitle>
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary text-primary-foreground">
                                        {feature.badge}
                                    </span>
                                </div>
                            </div>
                            <CardDescription className="text-sm leading-relaxed">
                                {feature.description}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="pt-0">
                            <Button 
                                variant="ghost" 
                                size="sm"
                                className="w-full group"
                            >
                                {feature.action}
                                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                            </Button>
                        </CardContent>
                    </Link>
                </Card>
            ))}
        </div>
    );
}