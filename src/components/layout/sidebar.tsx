"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Library, Star, Settings, PlayCircle, Bot, Play, Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useState } from "react";
import { useRouter } from "next/navigation";

interface SidebarProps extends React.HTMLAttributes<HTMLDivElement> { }

export function Sidebar({ className }: SidebarProps) {
    const pathname = usePathname();
    const router = useRouter();
    const [isCollecting, setIsCollecting] = useState(false);

    const handleAutoCollect = async () => {
        setIsCollecting(true);
        try {
            const res = await fetch('/api/auto-collect', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({})
            });

            const data = await res.json();

            if (data.success) {
                alert(data.message || `Auto-Collection Complete!\nFound ${data.totalFound} papers, added ${data.newCount} new ones.`);
                router.refresh();
            } else {
                alert(`Collection Failed: ${data.error || "Unknown error"}`);
            }
        } catch (error) {
            alert('Network Error: Failed to run auto-collection');
        } finally {
            setIsCollecting(false);
        }
    };

    const routes = [
        {
            label: "Dashboard",
            icon: LayoutDashboard,
            href: "/",
            active: pathname === "/",
        },
        {
            label: "Library",
            icon: Library,
            href: "/papers",
            active: pathname === "/papers" || pathname.startsWith("/papers/"),
        },
        {
            label: "Pipeline",
            icon: Play,
            href: "/pipeline",
            active: pathname === "/pipeline",
        },
        {
            label: "Favorites",
            icon: Star,
            href: "/favorites",
            active: pathname === "/favorites",
        },
        {
            label: "Copilot",
            icon: Bot,
            href: "/chat",
            active: pathname === "/chat",
        },
        {
            label: "Settings",
            icon: Settings,
            href: "/settings",
            active: pathname === "/settings",
        },
    ];

    return (
        <>
            {/* Mobile Trigger */}
            <Sheet>
                <SheetTrigger asChild>
                    <Button variant="ghost" size="icon" className="md:hidden fixed top-4 left-4 z-50">
                        <Menu className="h-5 w-5" />
                    </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-[240px] p-0">
                    <MobileSidebarContent routes={routes} handleAutoCollect={handleAutoCollect} isCollecting={isCollecting} />
                </SheetContent>
            </Sheet>

            {/* Desktop Sidebar */}
            <div className={cn("hidden md:flex h-screen w-[240px] flex-col fixed left-0 top-0 border-r bg-background", className)}>
                <div className="p-6">
                    <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                        InsightFlow
                    </h1>
                    <p className="text-xs text-muted-foreground mt-1">Applied AI Research</p>
                </div>

                <div className="px-3 py-2">
                    <Button
                        onClick={handleAutoCollect}
                        disabled={isCollecting}
                        className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg transition-all"
                    >
                        <PlayCircle className="mr-2 h-4 w-4" />
                        {isCollecting ? "Collecting..." : "Auto-Collect Papers"}
                    </Button>
                </div>

                <ScrollArea className="flex-1 px-3">
                    <div className="space-y-1 py-4">
                        {routes.map((route) => (
                            <Link
                                key={route.href}
                                href={route.href}
                                className={cn(
                                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground",
                                    route.active ? "bg-accent text-accent-foreground" : "text-muted-foreground"
                                )}
                            >
                                <route.icon className="h-4 w-4" />
                                {route.label}
                            </Link>
                        ))}
                    </div>
                </ScrollArea>

                <div className="p-4 border-t">
                    <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center">
                            <span className="text-xs font-bold">L</span>
                        </div>
                        <div className="text-sm">
                            <p className="font-medium">Lead Researcher</p>
                            <p className="text-xs text-muted-foreground">demo@example.com</p>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}

function MobileSidebarContent({ routes, handleAutoCollect, isCollecting }: any) {
    return (
        <div className="flex flex-col h-full">
            <div className="p-6">
                <h1 className="text-xl font-bold">InsightFlow</h1>
            </div>
            <div className="px-3 py-2">
                <Button
                    onClick={handleAutoCollect}
                    disabled={isCollecting}
                    className="w-full"
                >
                    {isCollecting ? "Collecting..." : "Auto-Collect"}
                </Button>
            </div>
            <div className="space-y-1 py-4 px-3 flex-1">
                {routes.map((route: any) => (
                    <Link
                        key={route.href}
                        href={route.href}
                        className={cn(
                            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground",
                            route.active ? "bg-accent text-accent-foreground" : "text-muted-foreground"
                        )}
                    >
                        <route.icon className="h-4 w-4" />
                        {route.label}
                    </Link>
                ))}
            </div>
        </div>
    )
}
