'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Zap, AlertCircle, CheckCircle, Clock, X, ExternalLink, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface Paper {
    id: string;
    title: string;
    authors?: string;
    abstract?: string;
    publicationDate?: string;
    url?: string;
    relevanceScore?: number;
    technicalScore?: number;
    businessScore?: number;
    timelinessScore?: number;
    practicalityScore?: number;
}

interface TrendMetric {
    change: number;
    direction: 'up' | 'down' | 'stable';
    currentCount: number;
    previousCount: number;
}

interface TrendMetrics {
    vsSelectedPeriod: TrendMetric;
    vsLastWeek: TrendMetric;
    isNew: boolean;
}

interface RadarTechnology {
    id: string;
    name: string;
    quadrant: 'adopt' | 'trial' | 'assess' | 'hold';
    maturity: number;
    relevanceToRisk: number;
    bankAdoption: string[];
    evidenceCount: number;
    recentActivity: boolean;
    description: string;
    relatedTopics: string[];
    papers?: Paper[];
    trendMetrics?: TrendMetrics;
}

interface RadarData {
    technologies: RadarTechnology[];
    byQuadrant: {
        adopt: number;
        trial: number;
        assess: number;
        hold: number;
    };
}

export function TechnologyRadar() {
    const [radarData, setRadarData] = useState<RadarData | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedDays, setSelectedDays] = useState(90);  // 下拉框选中的值
    const [dataDays, setDataDays] = useState(90);          // 实际数据的值（用于标签显示）
    const [selectedTech, setSelectedTech] = useState<RadarTechnology | null>(null);
    const [isClosing, setIsClosing] = useState(false);
    const [pendingTech, setPendingTech] = useState<RadarTechnology | null>(null);
    const panelRef = useRef<HTMLDivElement>(null);
    const abortControllerRef = useRef<AbortController | null>(null);

    // 处理待切换的技术
    useEffect(() => {
        if (!isClosing && pendingTech) {
            setSelectedTech(pendingTech);
            setPendingTech(null);
        }
    }, [isClosing, pendingTech]);

    // 监听点击事件，点击面板外部关闭
    useEffect(() => {
        const handleDocumentClick = (e: MouseEvent) => {
            if (selectedTech && panelRef.current && !panelRef.current.contains(e.target as Node)) {
                // 检查点击目标是否不是卡片（避免和卡片点击冲突）
                const target = e.target as HTMLElement;
                const isCard = target.closest('[data-tech-card]');
                if (!isCard) {
                    setIsClosing(true);
                    setTimeout(() => {
                        setSelectedTech(null);
                        setIsClosing(false);
                    }, 300);
                }
            }
        };

        if (selectedTech) {
            document.addEventListener('mousedown', handleDocumentClick);
            return () => document.removeEventListener('mousedown', handleDocumentClick);
        }
    }, [selectedTech]);

    // ESC 键关闭面板
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && selectedTech && !isClosing) {
                setIsClosing(true);
                setTimeout(() => {
                    setSelectedTech(null);
                    setIsClosing(false);
                }, 300);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedTech, isClosing]);

    useEffect(() => {
        return () => {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
        };
    }, []);

    const fetchRadarData = async () => {
        setLoading(true);
        setError(null);
        
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        abortControllerRef.current = new AbortController();

        try {
            const response = await fetch(`/api/radar?days=${selectedDays}`, {
                signal: abortControllerRef.current.signal
            });
            const data = await response.json();
            if (data.success) {
                setRadarData(data.radar);
                setDataDays(selectedDays);  // 数据加载成功后更新 dataDays
            } else {
                setError(data.error || 'Failed to fetch radar data');
            }
        } catch (err: any) {
            if (err.name !== 'AbortError') {
                setError('An error occurred while fetching radar data');
            }
        } finally {
            setLoading(false);
        }
    };

    const getQuadrantColor = (quadrant: string) => {
        switch (quadrant) {
            case 'adopt': return 'bg-green-100 text-green-800 border-green-300';
            case 'trial': return 'bg-blue-100 text-blue-800 border-blue-300';
            case 'assess': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
            case 'hold': return 'bg-red-100 text-red-800 border-red-300';
            default: return 'bg-gray-100 text-gray-800 border-gray-300';
        }
    };

    const getQuadrantIcon = (quadrant: string) => {
        switch (quadrant) {
            case 'adopt': return <CheckCircle className="h-4 w-4" />;
            case 'trial': return <Zap className="h-4 w-4" />;
            case 'assess': return <Clock className="h-4 w-4" />;
            case 'hold': return <AlertCircle className="h-4 w-4" />;
            default: return null;
        }
    };

    const formatTrend = (metric: TrendMetric, label: string) => {
        const { change, direction } = metric;
        const absChange = Math.abs(change);
        
        let icon;
        let colorClass;
        
        switch (direction) {
            case 'up':
                icon = <TrendingUp className="h-3 w-3" />;
                colorClass = 'text-green-600';
                break;
            case 'down':
                icon = <TrendingDown className="h-3 w-3" />;
                colorClass = 'text-red-600';
                break;
            default:
                icon = <Minus className="h-3 w-3" />;
                colorClass = 'text-gray-500';
        }
        
        return (
            <span className={`flex items-center gap-1 text-xs ${colorClass}`}>
                {icon}
                <span>{direction === 'up' ? '↑' : direction === 'down' ? '↓' : '→'}{absChange}%</span>
                {label && <span className="text-muted-foreground">({label})</span>}
            </span>
        );
    };

    const renderTrendMetrics = (tech: RadarTechnology) => {
        if (!tech.trendMetrics) return null;

        const { vsSelectedPeriod, vsLastWeek, isNew } = tech.trendMetrics;
        const isSevenDays = dataDays === 7;

        // Show "NEW" badge for new technologies
        if (isNew) {
            return (
                <div className="flex items-center gap-2">
                    <Badge variant="outline" className="bg-purple-100 text-purple-800 border-purple-300 text-xs">
                        NEW
                    </Badge>
                    <span className="text-xs text-muted-foreground">First appeared</span>
                </div>
            );
        }

        // For 7 days selection, show only one metric since they're the same
        if (isSevenDays) {
            return (
                <div className="flex items-center gap-3">
                    {formatTrend(vsLastWeek, 'vs Last Week')}
                </div>
            );
        }

        // For other periods, show both metrics
        const selectedPeriodLabel = `vs Last ${dataDays} Days`;
        return (
            <div className="flex items-center gap-3">
                {formatTrend(vsSelectedPeriod, selectedPeriodLabel)}
                {formatTrend(vsLastWeek, 'vs Last Week')}
            </div>
        );
    };

    // 关闭面板的函数
    const handleClosePanel = () => {
        setIsClosing(true);
        setTimeout(() => {
            setSelectedTech(null);
            setIsClosing(false);
        }, 300); // 等待动画完成
    };

    // 处理技术卡片点击
    const handleTechClick = (tech: RadarTechnology) => {
        if (selectedTech && selectedTech.id === tech.id) {
            // 点击已选中的卡片，关闭面板
            handleClosePanel();
        } else if (selectedTech) {
            // 面板已打开，切换到另一个技术
            setIsClosing(true);
            setPendingTech(tech);
            setTimeout(() => {
                setSelectedTech(null);
                setIsClosing(false);
            }, 300);
        } else {
            // 面板未打开，直接打开
            setSelectedTech(tech);
        }
    };

    const handleOutsideClick = (e: React.MouseEvent) => {
        if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
            handleClosePanel();
        }
    };

    const renderSidePanel = () => {
        if (!selectedTech && !pendingTech) return null;

        const tech = selectedTech || pendingTech!;

        return (
            <>
                {/* 侧边面板 */}
                <div 
                    ref={panelRef}
                    className={`fixed right-0 top-0 h-full w-[400px] bg-background shadow-2xl border-l border-border z-50 flex flex-col duration-300 ${
                        isClosing 
                            ? 'animate-out slide-out-to-right' 
                            : 'animate-in slide-in-from-right'
                    }`}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between p-4 border-b border-border bg-card">
                        <div className="flex items-center gap-2">
                            <h2 className="font-bold text-lg text-foreground">{tech.name}</h2>
                            <Badge className={getQuadrantColor(tech.quadrant)}>
                                {tech.quadrant}
                            </Badge>
                        </div>
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={handleClosePanel}
                            className="h-8 w-8 hover:bg-accent"
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    </div>

                    {/* Papers List */}
                    <div className="flex-1 overflow-y-auto p-4 bg-background">
                        <h3 className="font-semibold text-sm mb-3 text-foreground flex items-center gap-2">
                            <span className="text-muted-foreground">Papers</span>
                            <Badge variant="secondary">{tech.papers?.length || 0}</Badge>
                        </h3>
                        <div className="space-y-1">
                            {tech.papers?.map((paper, index) => (
                                <div key={paper.id} className="border-b border-border last:border-0 py-3 hover:bg-accent/50 rounded-sm px-2 -mx-2 transition-colors">
                                    <a 
                                        href={`/papers/${paper.id}`} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="group block"
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <h4 className="font-medium text-sm text-primary group-hover:underline line-clamp-2">
                                                {index + 1}. {paper.title}
                                            </h4>
                                            <ExternalLink className="h-3 w-3 text-muted-foreground flex-shrink-0 mt-1 opacity-0 group-hover:opacity-100 transition-opacity" />
                                        </div>
                                        
                                        {paper.authors && (
                                            <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                                                {paper.authors}
                                            </p>
                                        )}
                                        
                                        <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                                            {paper.publicationDate && (
                                                <span>{new Date(paper.publicationDate).toLocaleDateString('en-US')}</span>
                                            )}
                                            
                                            {(paper.relevanceScore || paper.technicalScore || paper.businessScore) && (
                                                <div className="flex items-center gap-1">
                                                    {paper.relevanceScore !== undefined && (
                                                        <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">
                                                            R:{paper.relevanceScore}
                                                        </Badge>
                                                    )}
                                                    {paper.technicalScore !== undefined && (
                                                        <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">
                                                            T:{paper.technicalScore}
                                                        </Badge>
                                                    )}
                                                    {paper.businessScore !== undefined && (
                                                        <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">
                                                            B:{paper.businessScore}
                                                        </Badge>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </a>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="p-4 border-t border-border bg-card">
                        <a 
                            href={`/papers?search=${encodeURIComponent(tech.name)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-primary hover:text-primary/80 flex items-center justify-center gap-1"
                        >
                            View all in Library
                            <ExternalLink className="h-3 w-3" />
                        </a>
                    </div>
                </div>
            </>
        );
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Technology Radar</h1>
                    <p className="text-muted-foreground">
                        Track emerging AI technologies and their readiness for banking applications
                    </p>
                </div>
                <div className="flex gap-2 items-center">
                    <select
                        value={selectedDays}
                        onChange={(e) => setSelectedDays(parseInt(e.target.value))}
                        className="px-3 py-2 border rounded-md"
                    >
                        <option value={30}>Last 30 days</option>
                        <option value={60}>Last 60 days</option>
                        <option value={90}>Last 90 days</option>
                        <option value={180}>Last 180 days</option>
                    </select>
                    <Button onClick={fetchRadarData} disabled={loading}>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        {loading ? 'Loading...' : 'Refresh'}
                    </Button>
                </div>
            </div>

            {error && (
                <Card className="border-red-200 bg-red-50">
                    <CardContent className="pt-6">
                        <p className="text-red-800">{error}</p>
                    </CardContent>
                </Card>
            )}

            {radarData && (
                <>
                    <div className="grid gap-4 md:grid-cols-4">
                        <Card className={`border-2 ${getQuadrantColor('adopt')}`}>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <CheckCircle className="h-5 w-5" />
                                    Adopt
                                </CardTitle>
                                <CardDescription>
                                    Ready for production deployment
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <p className="text-4xl font-bold">{radarData.byQuadrant.adopt}</p>
                                <p className="text-sm text-muted-foreground">technologies</p>
                            </CardContent>
                        </Card>

                        <Card className={`border-2 ${getQuadrantColor('trial')}`}>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Zap className="h-5 w-5" />
                                    Trial
                                </CardTitle>
                                <CardDescription>
                                    Suitable for pilot programs
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <p className="text-4xl font-bold">{radarData.byQuadrant.trial}</p>
                                <p className="text-sm text-muted-foreground">technologies</p>
                            </CardContent>
                        </Card>

                        <Card className={`border-2 ${getQuadrantColor('assess')}`}>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Clock className="h-5 w-5" />
                                    Assess
                                </CardTitle>
                                <CardDescription>
                                    Worth investigating
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <p className="text-4xl font-bold">{radarData.byQuadrant.assess}</p>
                                <p className="text-sm text-muted-foreground">technologies</p>
                            </CardContent>
                        </Card>

                        <Card className={`border-2 ${getQuadrantColor('hold')}`}>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <AlertCircle className="h-5 w-5" />
                                    Hold
                                </CardTitle>
                                <CardDescription>
                                    Monitor for developments
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <p className="text-4xl font-bold">{radarData.byQuadrant.hold}</p>
                                <p className="text-sm text-muted-foreground">technologies</p>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {radarData.technologies.map((tech) => (
                            <Card 
                                key={tech.id}
                                data-tech-card="true"
                                className={`hover:shadow-lg transition-all cursor-pointer ${
                                    selectedTech?.id === tech.id 
                                        ? 'ring-2 ring-primary ring-offset-2 shadow-lg' 
                                        : ''
                                }`}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleTechClick(tech);
                                }}
                            >
                                <CardHeader>
                                    <div className="flex items-start justify-between">
                                        <CardTitle className="text-lg">{tech.name}</CardTitle>
                                        <Badge className={getQuadrantColor(tech.quadrant)}>
                                            {getQuadrantIcon(tech.quadrant)}
                                            <span className="ml-1">{tech.quadrant}</span>
                                        </Badge>
                                    </div>
                                    <CardDescription className="mt-2">
                                        {tech.description}
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-3">
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <p className="text-xs font-medium text-muted-foreground mb-1">
                                                    Maturity
                                                </p>
                                                <div className="flex items-center gap-2">
                                                    <div className="flex-1 bg-gray-200 rounded-full h-2">
                                                        <div
                                                            className="bg-green-600 h-2 rounded-full"
                                                            style={{ width: `${tech.maturity}%` }}
                                                        />
                                                    </div>
                                                    <span className="text-sm font-medium">
                                                        {tech.maturity}%
                                                    </span>
                                                </div>
                                            </div>
                                            <div>
                                                <p className="text-xs font-medium text-muted-foreground mb-1">
                                                    Relevance
                                                </p>
                                                <div className="flex items-center gap-2">
                                                    <div className="flex-1 bg-gray-200 rounded-full h-2">
                                                        <div
                                                            className="bg-blue-600 h-2 rounded-full"
                                                            style={{ width: `${tech.relevanceToRisk}%` }}
                                                        />
                                                    </div>
                                                    <span className="text-sm font-medium">
                                                        {tech.relevanceToRisk}%
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        {tech.trendMetrics && (
                                            <div>
                                                <p className="text-xs font-medium text-muted-foreground mb-1">
                                                    Trend
                                                </p>
                                                {renderTrendMetrics(tech)}
                                            </div>
                                        )}

                                        <div>
                                            <p className="text-sm font-medium mb-1">
                                                Bank Adoption ({tech.bankAdoption.length})
                                            </p>
                                            <div className="flex flex-wrap gap-1">
                                                {tech.bankAdoption.map((bank, i) => (
                                                    <Badge key={i} variant="outline" className="text-xs">
                                                        {bank}
                                                    </Badge>
                                                ))}
                                            </div>
                                        </div>

                                        <div>
                                            <p className="text-sm font-medium mb-1">
                                                Evidence
                                            </p>
                                            <p className="text-sm text-muted-foreground">
                                                {tech.evidenceCount} papers{' '}
                                                {tech.recentActivity && (
                                                    <Badge className="ml-2" variant="outline">
                                                        Recent
                                                    </Badge>
                                                )}
                                            </p>
                                        </div>

                                        {tech.relatedTopics.length > 0 && (
                                            <div>
                                                <p className="text-sm font-medium mb-1">
                                                    Related Topics
                                                </p>
                                                <div className="flex flex-wrap gap-1">
                                                    {tech.relatedTopics.slice(0, 4).map((topic, i) => (
                                                        <Badge key={i} variant="secondary" className="text-xs">
                                                            {topic}
                                                        </Badge>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </>
            )}
            
            {/* Side Panel */}
            {renderSidePanel()}
        </div>
    );
}