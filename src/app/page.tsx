import { prisma } from "@/lib/db"
import { StatsCards } from "@/components/dashboard/stats-cards"
import { TopicChart } from "@/components/dashboard/topic-chart"
import { MethodologyChart } from "@/components/dashboard/methodology-chart"
import { FeatureCards } from "@/components/dashboard/feature-cards"
import { Zap } from "lucide-react"
import { getBeijingDateCode, getBeijingDayRange, getBeijingNow } from "@/lib/timezone-utils"

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function getDashboardData() {
  const total = await prisma.paper.count();

  // Use Beijing Time for consistency across all environments
  const todayBeijing = getBeijingDateCode();
  const { startUTC: startOfTodayBeijing } = getBeijingDayRange(todayBeijing);

  const todayCount = await prisma.paper.count({
    where: { collectedAt: { gte: startOfTodayBeijing } }
  });

  const previousTotal = total - todayCount;
  const growthRate = previousTotal > 0 ? (todayCount / previousTotal) * 100 : 0;

  // Calculate 30 days ago in Beijing Time
  const nowBeijing = getBeijingNow();
  const thirtyDaysAgoBeijing = new Date(nowBeijing);
  thirtyDaysAgoBeijing.setDate(thirtyDaysAgoBeijing.getDate() - 30);
  const thirtyDaysAgoUTC = new Date(thirtyDaysAgoBeijing.toLocaleString('en-US', { timeZone: 'Asia/Shanghai' }));

  const dailyHistory = await prisma.paper.findMany({
    where: { collectedAt: { gte: thirtyDaysAgoUTC } },
    select: { collectedAt: true }
  });

  // Group by Beijing Time date
  const dailyStats: Record<string, number> = {};
  dailyHistory.forEach(p => {
    const dateStr = getBeijingDateCode(p.collectedAt);
    dailyStats[dateStr] = (dailyStats[dateStr] || 0) + 1;
  });

  const trendingRiskTags = await prisma.tag.findMany({
    where: { category: 'risk-category' },
    include: { _count: { select: { papers: true } } },
    orderBy: { papers: { _count: 'desc' } },
    take: 3
  }).then(tags => tags.map(t => t.name));

  const trendingBusinessTags = await prisma.tag.findMany({
    where: { category: 'business-area' },
    include: { _count: { select: { papers: true } } },
    orderBy: { papers: { _count: 'desc' } },
    take: 3
  }).then(tags => tags.map(t => t.name));

  const riskPapersCount = await prisma.paper.count({
    where: { tags: { some: { tag: { category: 'risk-category' } } } }
  });

  const businessPapersCount = await prisma.paper.count({
    where: { tags: { some: { tag: { category: 'business-area' } } } }
  });

  const techChartData = await prisma.tag.findMany({
    where: { category: 'ai-technology' },
    include: { _count: { select: { papers: true } } },
    orderBy: { papers: { _count: 'desc' } },
    take: 10
  }).then(tags => tags.map(t => ({ name: t.name, count: t._count.papers })));

  const methodChartData = await prisma.tag.findMany({
    where: { category: 'methodology' },
    include: { _count: { select: { papers: true } } },
    orderBy: { papers: { _count: 'desc' } },
    take: 5
  }).then(tags => tags.map(t => ({ name: t.name, count: t._count.papers })));

  return {
    total,
    businessAppsCount: businessPapersCount,
    riskCount: riskPapersCount,
    trendingBusinessTags,
    trendingRiskTags,
    techChartData,
    methodChartData,
    growthRate,
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
        businessAppsCount={data.businessAppsCount}
        riskCount={data.riskCount}
        trendingBusinessTags={data.trendingBusinessTags}
        trendingRiskTags={data.trendingRiskTags}
        growthRate={data.growthRate}
        dailyStats={data.dailyStats}
      />

      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
          <div className="col-span-4">
            <TopicChart data={data.techChartData} />
          </div>
          <div className="col-span-3">
            <MethodologyChart data={data.methodChartData} />
          </div>
        </div>

        <div>
          <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Zap className="h-5 w-5 text-purple-600" />
            New Features in Roadmap
          </h3>
          <FeatureCards />
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
          <div className="col-span-7 bg-muted/40 p-6 rounded-lg text-center">
            <h3 className="text-lg font-semibold mb-2">Want to explore specific papers?</h3>
            <p className="text-sm text-muted-foreground mb-4">You can drill down into specific sectors or topics in Library.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
