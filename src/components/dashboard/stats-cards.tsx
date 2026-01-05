import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, FileText, Activity, TrendingUp } from "lucide-react"
import { CollectionCalendar } from "./collection-calendar"

export function StatsCards({ total, industrialCount, academicCount, growthRate, todayCount, dailyStats }: any) {
    return (
        <div className="grid gap-4 md:grid-cols-3">
            <Card className="bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border-indigo-500/20 shadow-sm transition-all hover:shadow-md">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Research Base</CardTitle>
                    <FileText className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{total}</div>

                    <CollectionCalendar
                        dailyStats={dailyStats}
                        trigger={
                            <p className="text-xs text-muted-foreground flex items-center gap-1 cursor-pointer hover:text-indigo-500 transition-colors group">
                                <TrendingUp className={`h-3 w-3 ${growthRate > 0 ? "text-green-500" : "text-muted-foreground"}`} />
                                <span className={growthRate > 0 ? "text-green-600 dark:text-green-400 font-medium" : ""}>
                                    {growthRate > 0 ? `+${growthRate.toFixed(1)}%` : "0%"}
                                </span>
                                <span>growth today</span>
                                <span className="opacity-0 group-hover:opacity-100 ml-1 text-[10px] font-bold uppercase tracking-tighter">View Calendar</span>
                            </p>
                        }
                    />
                </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border-blue-500/20">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Industrial Use Cases</CardTitle>
                    <Activity className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{industrialCount}</div>
                    <p className="text-xs text-muted-foreground">
                        Focus: AML, Risk, Fraud
                    </p>
                </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 border-green-500/20">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Academic Research</CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{academicCount}</div>
                    <p className="text-xs text-muted-foreground">
                        Topics: Agents, LLMs, RLHF
                    </p>
                </CardContent>
            </Card>
        </div>
    )
}
