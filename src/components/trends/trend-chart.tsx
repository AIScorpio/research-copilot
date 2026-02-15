"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Line, LineChart, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ArrowUp, ArrowDown, Minus, TrendingUp, TrendingDown, BarChart3 } from "lucide-react";


export interface TrendDataPoint {
  date: string;
  count: number;
}

export interface TrendMetrics {
  tagId: string;
  tagName: string;
  tagType: string;
  tagCategory?: string | null;
  growthRate: number;
  percentChange: number;
  direction: "up" | "down" | "flat";
  currentCount: number;
  previousCount: number;
  trendData: TrendDataPoint[];
}

const COLORS = [
  '#818cf8',
  '#60a5fa',
  '#34d399',
  '#f472b6',
  '#fbbf24',
  '#a78bfa',
  '#f87171',
  '#38bdf8',
];

interface TrendChartProps {
  initialData?: TrendMetrics[];
}

export function TrendChart({ initialData }: TrendChartProps) {
  const [data, setData] = useState<TrendMetrics[]>(initialData || []);
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [period, setPeriod] = useState<"week" | "month" | "quarter" | "year">("month");
  const [direction, setDirection] = useState<"all" | "up" | "down" | "flat">("all");
  const [loading, setLoading] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (initialData) {
      setData(initialData);
      const initialSelected = new Set(initialData.slice(0, 3).map(d => d.tagId));
      setSelectedTags(initialSelected);
    }
  }, [initialData]);

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    try {
      const params = new URLSearchParams({
        period,
        direction: direction === "all" ? "" : direction,
      });

      const res = await fetch(`/api/trends?${params.toString()}`, {
        signal: abortControllerRef.current.signal
      });
      const json = await res.json();

      if (json.results) {
        setData(json.results);
        if (selectedTags.size === 0 && json.results.length > 0) {
          setSelectedTags(new Set(json.results.slice(0, 3).map((d: TrendMetrics) => d.tagId)));
        }
      }
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error("Failed to fetch trends:", error);
      }
    } finally {
      setLoading(false);
    }
  }, [period, direction, selectedTags.size]);

  const toggleTag = useCallback((tagId: string) => {
    setSelectedTags(prev => {
      const newSelected = new Set(prev);
      if (newSelected.has(tagId)) {
        newSelected.delete(tagId);
      } else if (newSelected.size < 5) {
        newSelected.add(tagId);
      }
      return newSelected;
    });
  }, []);

  const chartData = useMemo(() => transformToChartData(data, selectedTags), [data, selectedTags]);

  const selectedTrends = useMemo(() => data.filter(d => selectedTags.has(d.tagId)), [data, selectedTags]);

  const formatDate = useCallback((dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }, []);

  return (
    <Card className="col-span-4">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Research Trends
            </CardTitle>
            <CardDescription>
              Track growth and decline of research topics over time
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Select value={period} onValueChange={(v: any) => setPeriod(v)}>
              <SelectTrigger className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="week">Week</SelectItem>
                <SelectItem value="month">Month</SelectItem>
                <SelectItem value="quarter">Quarter</SelectItem>
                <SelectItem value="year">Year</SelectItem>
              </SelectContent>
            </Select>
            <Select value={direction} onValueChange={(v: any) => setDirection(v)}>
              <SelectTrigger className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="up">Growing</SelectItem>
                <SelectItem value="down">Declining</SelectItem>
                <SelectItem value="flat">Stable</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={fetchData} disabled={loading} variant="outline" size="sm">
              {loading ? "Loading..." : "Refresh"}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4">
          <div className="h-[400px] w-full">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                  <XAxis
                    dataKey="date"
                    stroke="#888888"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={formatDate}
                  />
                  <YAxis
                    stroke="#888888"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    content={useCallback(({ active, payload }: any) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="rounded-lg border bg-background p-3 shadow-md">
                            <p className="text-sm font-medium mb-2">{formatDate(payload[0].payload.date)}</p>
                            {payload.map((entry: any, index: number) => (
                              <p key={index} className="text-sm" style={{ color: entry.color }}>
                                {entry.name}: {entry.value} papers
                              </p>
                            ))}
                          </div>
                        );
                      }
                      return null;
                    }, [formatDate])}
                  />
                  <Legend />
                  {selectedTrends.map((trend, index) => (
                    <Line
                      key={trend.tagId}
                      type="monotone"
                      dataKey={trend.tagName}
                      stroke={COLORS[index % COLORS.length]}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      activeDot={{ r: 6 }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                No trend data available
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {data.slice(0, 10).map((trend, index) => (
              <Badge
                key={trend.tagId}
                variant={selectedTags.has(trend.tagId) ? "default" : "outline"}
                className="cursor-pointer hover:opacity-80 transition-opacity"
                onClick={() => toggleTag(trend.tagId)}
                style={
                  selectedTags.has(trend.tagId)
                    ? { backgroundColor: COLORS[index % COLORS.length], color: 'white' }
                    : {}
                }
              >
                {trend.direction === "up" && <TrendingUp className="w-3 h-3 mr-1" />}
                {trend.direction === "down" && <TrendingDown className="w-3 h-3 mr-1" />}
                {trend.direction === "flat" && <Minus className="w-3 h-3 mr-1" />}
                {trend.tagName}
                {trend.percentChange !== 0 && (
                  <span className="ml-1 text-xs">
                    ({trend.percentChange > 0 ? "+" : ""}{trend.percentChange.toFixed(1)}%)
                  </span>
                )}
              </Badge>
            ))}
          </div>

          {selectedTrends.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {selectedTrends.slice(0, 3).map((trend, index) => (
                <div
                  key={trend.tagId}
                  className="p-4 rounded-lg border bg-card"
                  style={{ borderColor: COLORS[index % COLORS.length] }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold">{trend.tagName}</h3>
                    {trend.direction === "up" && (
                      <ArrowUp className="h-4 w-4 text-green-500" />
                    )}
                    {trend.direction === "down" && (
                      <ArrowDown className="h-4 w-4 text-red-500" />
                    )}
                    {trend.direction === "flat" && (
                      <Minus className="h-4 w-4 text-gray-500" />
                    )}
                  </div>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Current:</span>
                      <span className="font-medium">{trend.currentCount}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Previous:</span>
                      <span>{trend.previousCount}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Change:</span>
                      <span
                        className={
                          trend.percentChange > 0
                            ? "text-green-500 font-medium"
                            : trend.percentChange < 0
                            ? "text-red-500 font-medium"
                            : "text-gray-500"
                        }
                      >
                        {trend.percentChange > 0 ? "+" : ""}
                        {trend.percentChange.toFixed(2)}%
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function transformToChartData(
  data: TrendMetrics[],
  selectedTags: Set<string>
): Array<{ date: string; [key: string]: any }> {
  const dateSet = new Set<string>();
  data.forEach(trend => {
    trend.trendData.forEach(point => {
      dateSet.add(point.date);
    });
  });

  const sortedDates = Array.from(dateSet).sort();

  return sortedDates.map(date => {
    const point: any = { date };
    data.forEach(trend => {
      if (selectedTags.has(trend.tagId)) {
        const dataPoint = trend.trendData.find(d => d.date === date);
        point[trend.tagName] = dataPoint?.count || 0;
      }
    });
    return point;
  });
}
