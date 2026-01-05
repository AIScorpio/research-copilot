"use client"

import { useState } from "react"
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

const COLORS = ['#818cf8', '#60a5fa', '#34d399', '#f472b6', '#fbbf24'];

export function TopicChart({ data }: { data: any[] }) {
    const [activeIndex, setActiveIndex] = useState<number | null>(null);

    const activeItem = activeIndex !== null ? data[activeIndex] : null;

    return (
        <Card className="col-span-4 relative group/card overflow-hidden">
            {/* Fixed Info Panel in Top Right */}
            <div className={`absolute right-6 top-6 z-20 transition-all duration-300 transform ${activeItem ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-2 scale-95 pointer-events-none'}`}>
                <div className="bg-background/80 backdrop-blur-md border border-indigo-500/20 p-4 rounded-xl shadow-2xl min-w-[160px]">
                    <p className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.2em] mb-1">
                        {activeItem?.name}
                    </p>
                    <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-black tabular-nums">{activeItem?.count}</span>
                        <span className="text-xs font-bold text-muted-foreground uppercase">Papers</span>
                    </div>
                </div>
            </div>

            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    Trending Research Topics
                    {activeItem && <span className="text-[10px] bg-indigo-500/10 text-indigo-500 px-2 py-0.5 rounded-full animate-pulse">Live View</span>}
                </CardTitle>
                <CardDescription>
                    Distribution of collected papers by key topics.
                </CardDescription>
            </CardHeader>
            <CardContent className="pl-2">
                <ResponsiveContainer width="100%" height={350}>
                    <BarChart
                        data={data}
                        onMouseMove={(state) => {
                            if (state.activeTooltipIndex !== undefined) {
                                setActiveIndex(state.activeTooltipIndex);
                            } else {
                                setActiveIndex(null);
                            }
                        }}
                        onMouseLeave={() => setActiveIndex(null)}
                    >
                        <CartesianGrid strokeDasharray="3 3" opacity={0.05} vertical={false} />
                        <XAxis
                            dataKey="name"
                            stroke="#888888"
                            fontSize={11}
                            tickLine={false}
                            axisLine={false}
                            interval={0}
                            angle={-15}
                            textAnchor="end"
                            height={60}
                        />
                        <YAxis
                            stroke="#888888"
                            fontSize={11}
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={(value) => `${value}`}
                        />
                        <Tooltip cursor={false} content={() => null} />
                        <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                            {data.map((entry, index) => (
                                <Cell
                                    key={`cell-${index}`}
                                    fill={COLORS[index % COLORS.length]}
                                    style={{
                                        transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
                                        transformOrigin: 'bottom center',
                                        filter: activeIndex === index ? 'brightness(1.1) drop-shadow(0 0 12px rgba(129, 140, 248, 0.4))' : 'none',
                                        transform: activeIndex === index ? 'scaleY(1.08) translateY(-2px)' : 'scale(1)',
                                    }}
                                />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
    )
}

