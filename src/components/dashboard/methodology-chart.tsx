"use client"

import { useState } from "react"
import { Pie, PieChart, ResponsiveContainer, Cell, Tooltip, Legend, Sector } from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

const renderActiveShape = (props: any) => {
    const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props;

    return (
        <g>
            <Sector
                cx={cx}
                cy={cy}
                innerRadius={innerRadius}
                outerRadius={outerRadius + 8} // Magnetic expansion
                startAngle={startAngle}
                endAngle={endAngle}
                fill={fill}
                style={{ filter: 'drop-shadow(0 0 12px rgba(59, 130, 246, 0.3))', transition: 'all 0.3s ease' }}
            />
        </g>
    );
};

export function MethodologyChart({ data }: { data: any[] }) {
    const [activeIndex, setActiveIndex] = useState<number | null>(null);

    const activeItem = activeIndex !== null ? data[activeIndex] : null;

    return (
        <Card className="col-span-3 relative overflow-hidden group/card shadow-sm border-blue-500/10">
            {/* Fixed Info Panel in Top Right */}
            <div className={`absolute right-6 top-6 z-20 transition-all duration-300 transform ${activeItem ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-2 scale-95 pointer-events-none'}`}>
                <div className="bg-background/80 backdrop-blur-md border border-blue-500/20 p-4 rounded-xl shadow-2xl min-w-[140px]">
                    <p className="text-[10px] font-black text-blue-500 uppercase tracking-[0.2em] mb-1">
                        {activeItem?.name}
                    </p>
                    <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-black tabular-nums text-blue-600 dark:text-blue-400">{activeItem?.count}</span>
                        <span className="text-xs font-bold text-muted-foreground uppercase">Units</span>
                    </div>
                </div>
            </div>

            <CardHeader>
                <CardTitle>Methodology Distribution</CardTitle>
                <CardDescription>
                    Breakdown of research by technical approach.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <ResponsiveContainer width="100%" height={350}>
                    <PieChart>
                        <Pie
                            data={data}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            outerRadius={100}
                            fill="#8884d8"
                            dataKey="count"
                            activeShape={renderActiveShape}
                            activeIndex={activeIndex ?? -1}
                            onMouseEnter={(_, index) => setActiveIndex(index)}
                            onMouseLeave={() => setActiveIndex(null)}
                            style={{ transition: 'all 0.3s ease' }}
                        >
                            {data.map((entry, index) => (
                                <Cell
                                    key={`cell-${index}`}
                                    fill={COLORS[index % COLORS.length]}
                                    style={{ outline: 'none' }}
                                />
                            ))}
                        </Pie>
                        <Tooltip content={() => null} />
                        <Legend verticalAlign="bottom" iconType="circle" />
                    </PieChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
    )
}
