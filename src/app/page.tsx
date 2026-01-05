import { prisma } from "@/lib/db"
import { StatsCards } from "@/components/dashboard/stats-cards"
import { TopicChart } from "@/components/dashboard/topic-chart"
import { MethodologyChart } from "@/components/dashboard/methodology-chart"

// Fetch data on the server
async function getDashboardData() {
  const total = await prisma.paper.count();

  // 1. Calculate Today's Growth
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const todayCount = await prisma.paper.count({
    where: { collectedAt: { gte: startOfToday } }
  });

  const previousTotal = total - todayCount;
  const growthRate = previousTotal > 0 ? (todayCount / previousTotal) * 100 : 0;

  // 2. Daily Stats for Calendar (past 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const dailyHistory = await prisma.paper.findMany({
    where: { collectedAt: { gte: thirtyDaysAgo } },
    select: { collectedAt: true }
  });

  // Group by date
  const dailyStats: Record<string, number> = {};
  dailyHistory.forEach(p => {
    const dateStr = p.collectedAt.toISOString().split('T')[0];
    dailyStats[dateStr] = (dailyStats[dateStr] || 0) + 1;
  });

  // Get all tags with paper counts
  const allTags = await prisma.tag.findMany({
    include: { _count: { select: { papers: true } } }
  });

  // Categorize by type
  const industrialTags = allTags.filter(t => t.type === 'Industrial');
  const academicTags = allTags.filter(t => t.type === 'Academic');
  const customTags = allTags.filter(t => t.type === 'User Defined');

  const industrialCount = industrialTags.reduce((acc: number, t: any) => acc + t._count.papers, 0);
  const academicCount = academicTags.reduce((acc: number, t: any) => acc + t._count.papers, 0);

  // Merge for chart - include all tags
  const chartData = [
    ...industrialTags.map((t: any) => ({ name: t.name, count: t._count.papers, type: 'Industrial' })),
    ...academicTags.map((t: any) => ({ name: t.name, count: t._count.papers, type: 'Academic' })),
    ...customTags.map((t: any) => ({ name: t.name, count: t._count.papers, type: 'Custom' }))
  ].sort((a: any, b: any) => b.count - a.count).slice(0, 10); // Top 10

  return {
    total,
    industrialCount,
    academicCount,
    chartData,
    growthRate,
    todayCount,
    dailyStats
  };
}

export default async function DashboardPage() {
  const data = await getDashboardData();

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Research Overview</h2>
      </div>

      <StatsCards
        total={data.total}
        industrialCount={data.industrialCount}
        academicCount={data.academicCount}
        growthRate={data.growthRate}
        todayCount={data.todayCount}
        dailyStats={data.dailyStats}
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <div className="col-span-4">
          <TopicChart data={data.chartData} />
        </div>
        <div className="col-span-3">
          <MethodologyChart data={data.chartData.filter((d: any) => d.type === 'Academic')} />
        </div>
      </div>

      {/* Drill-down Hint */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <div className="col-span-7 bg-muted/40 p-6 rounded-lg text-center">
          <h3 className="text-lg font-semibold mb-2">Want to explore specific papers?</h3>
          <p className="text-sm text-muted-foreground mb-4">You can drill down into specific sectors or topics in the Library.</p>
        </div>
      </div>
    </div>
  )
}
