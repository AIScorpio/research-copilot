import { TrendChart } from "@/components/trends/trend-chart";

export default function TrendsPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Research Trends</h1>
          <p className="text-muted-foreground">
            Monitor growth patterns and identify emerging topics in banking AI research
          </p>
        </div>
        <TrendChart />
      </div>
    </div>
  );
}
