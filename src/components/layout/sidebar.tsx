"use client";

import { logger } from "@/lib/logger";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Library, Star, Settings, PlayCircle, Bot, Play, Menu, BookOpen, Download, Sparkles, Radar, Info, TrendingUp, LineChart, Bell, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AlertBadge } from "@/components/alerts/alert-badge";
import { useToast } from "@/components/ui/toast";

interface SidebarProps {
    className?: string;
}

export function Sidebar({ className }: SidebarProps) {
    const pathname = usePathname();
    const router = useRouter();
    const [user, setUser] = useState<{ email: string; id: string } | null>(null);

    const fetchUser = () => {
        fetch('/api/auth/me')
            .then(res => res.json())
            .then(data => {
                setUser(data.user || null);
            })
            .catch((err) => logger.error('Logout failed', { error: err instanceof Error ? err.message : String(err) }));
    };

    useEffect(() => {
        // Fetch current user on mount
        fetchUser();

        // Listen for auth state changes
        const handleAuthChange = () => {
            fetchUser();
        };

        window.addEventListener('auth-state-changed', handleAuthChange);
        
        // Also refresh when pathname changes (e.g., after login redirect)
        fetchUser();

        return () => {
            window.removeEventListener('auth-state-changed', handleAuthChange);
        };
    }, [pathname]);

    const handleLogout = async () => {
        try {
            const res = await fetch('/api/auth/logout', { method: 'POST' });
            if (res.ok) {
                // Clear user state immediately
                setUser(null);
                // Dispatch auth state change event
                window.dispatchEvent(new CustomEvent('auth-state-changed'));
                router.push('/login');
            }
        } catch (error) {
            console.error('Logout failed:', error);
        }
    };

    const { addToast } = useToast();
    const [isCollecting, setIsCollecting] = useState(false);

    const handleAutoCollect = async () => {
        setIsCollecting(true);
        
        try {
            const res = await fetch('/api/auto-collect', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    trigger: true,
                    override: {
                        dateFrom: '2025-11-13',
                        dateTo: '2026-02-13'
                    }
                })
            });

            const data = await res.json();

            if (data.success) {
                const message = data.message || `Collection complete. Found ${data.totalFound} papers, ${data.duplicateCount} duplicates, ${data.newCount} saved.`;
                addToast(message, 'success', 5000);
                
                // Refresh after 2 seconds
                setTimeout(() => {
                    window.location.reload();
                }, 2000);
            } else {
                addToast(`Collection Failed: ${data.error || "Unknown error"}`, 'error', 5000);
            }
        } catch {
            addToast('Network Error: Failed to run auto-collection', 'error', 5000);
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
            ariaLabel: "Go to dashboard"
        },
        {
            label: "Library",
            icon: Library,
            href: "/papers",
            active: pathname === "/papers" || pathname.startsWith("/papers/"),
            ariaLabel: "Go to papers library"
        },
        {
            label: "Pipeline",
            icon: Play,
            href: "/pipeline",
            active: pathname === "/pipeline",
            ariaLabel: "Go to pipeline"
        },
        {
            label: "Technology Radar",
            icon: Radar,
            href: "/radar",
            active: pathname === "/radar",
            ariaLabel: "Go to technology radar"
        },
        {
            label: "PoC Recommendations",
            icon: Sparkles,
            href: "/recommendations",
            active: pathname === "/recommendations",
            ariaLabel: "Go to PoC recommendations"
        },
        {
            label: "Export Hub",
            icon: Download,
            href: "/export",
            active: pathname === "/export",
            ariaLabel: "Go to export hub"
        },
        {
            label: "Favorites",
            icon: Star,
            href: "/favorites",
            active: pathname === "/favorites",
            ariaLabel: "Go to favorites"
        },
        {
            label: "Copilot",
            icon: Bot,
            href: "/chat",
            active: pathname === "/chat",
            ariaLabel: "Go to AI copilot chat"
        },
        {
            label: "Archives",
            icon: BookOpen,
            href: "/archives",
            active: pathname === "/archives",
            ariaLabel: "Go to archives"
        },
        {
            label: "Regulatory Alerts",
            icon: Bell,
            href: "/alerts",
            active: pathname === "/alerts",
            ariaLabel: "Go to regulatory alerts"
        },
        {
            label: "Settings",
            icon: Settings,
            href: "/settings",
            active: pathname === "/settings",
            ariaLabel: "Go to settings"
        },
        {
            label: "About",
            icon: Info,
            href: "/about",
            active: pathname === "/about",
            ariaLabel: "View about information"
        },
        {
            label: "Competitive Intel",
            icon: TrendingUp,
            href: "/competitive-intel",
            active: pathname === "/competitive-intel",
            ariaLabel: "Go to competitive intelligence"
        },
        {
            label: "Trends",
            icon: LineChart,
            href: "/trends",
            active: pathname === "/trends",
            ariaLabel: "Go to research trends"
        },
    ];

    return (
        <>
            {/* Mobile Trigger */}
            <Sheet>
                <SheetTrigger asChild>
                    <Button variant="ghost" size="icon" className="md:hidden fixed top-4 left-4 z-50" aria-label="Open menu">
                        <Menu className="h-5 w-5" />
                    </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-[240px] p-0">
                    <MobileSidebarContent routes={routes} handleAutoCollect={handleAutoCollect} isCollecting={isCollecting} />
                </SheetContent>
            </Sheet>

            {/* Desktop Sidebar */}
            <div className={cn("hidden md:flex h-screen w-[240px] flex-col fixed left-0 top-0 border-r bg-background", className)}>
                <div className="p-6 flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                            InsightFlow
                        </h1>
                        <p className="text-xs text-muted-foreground mt-1">Applied AI Research</p>
                    </div>
                    <AlertBadge />
                </div>

                <div className="px-3 py-2 space-y-2">
                    <Button
                        onClick={handleAutoCollect}
                        disabled={isCollecting}
                        className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg transition-all"
                        aria-label={isCollecting ? "Collecting papers" : "Auto-collect papers"}
                    >
                        <PlayCircle className="mr-2 h-4 w-4" />
                        {isCollecting ? "Collecting..." : "Auto-Collect Papers"}
                    </Button>
                </div>

                <ScrollArea className="flex-1 px-3">
                    <nav role="navigation" aria-label="Main navigation">
                        <div className="space-y-1 py-4">
                        {routes.map((route) => (
                            <Link
                                key={route.href}
                                href={route.href}
                                className={cn(
                                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                                    route.active 
                                        ? "bg-blue-600 text-white hover:bg-blue-700" 
                                        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                                )}
                                aria-label={route.ariaLabel}
                            >
                                <route.icon className="h-4 w-4" />
                                {route.label}
                            </Link>
                        ))}
                        </div>
                    </nav>
                </ScrollArea>

                <div className="p-4 border-t">
                    {user ? (
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="h-8 w-8 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center">
                                    <span className="text-xs font-bold">{user.email[0]?.toUpperCase()}</span>
                                </div>
                                <div className="text-sm">
                                    <p className="font-medium">{user.email.split('@')[0]}</p>
                                    <p className="text-xs text-muted-foreground">{user.email}</p>
                                </div>
                            </div>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={handleLogout}
                                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                aria-label="Logout"
                            >
                                <LogOut className="h-4 w-4" />
                            </Button>
                        </div>
                    ) : (
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="h-8 w-8 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center">
                                    <span className="text-xs font-bold">?</span>
                                </div>
                                <div className="text-sm">
                                    <p className="font-medium text-muted-foreground">Not logged in</p>
                                    <p className="text-xs text-muted-foreground">Please sign in</p>
                                </div>
                            </div>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => router.push('/login')}
                                className="text-muted-foreground hover:text-foreground"
                            >
                                Login
                            </Button>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}

interface Route {
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    href: string;
    active: boolean;
    ariaLabel: string;
}

interface MobileSidebarProps {
    routes: Route[];
    handleAutoCollect: () => void;
    isCollecting: boolean;
}

function MobileSidebarContent({ routes, handleAutoCollect, isCollecting }: MobileSidebarProps) {
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
                {routes.map((route: Route) => (
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
