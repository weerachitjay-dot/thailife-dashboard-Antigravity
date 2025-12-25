
import Link from 'next/link';
import { supabaseAdmin } from '@/utils/supabase/admin';
import { ExecutiveSummary } from '@/components/dashboard/ExecutiveSummary';
import { ProductPerformance } from '@/components/dashboard/ProductPerformance';
import { CampaignOptimization } from '@/components/dashboard/CampaignOptimization';
import { DashboardFilters } from '@/components/dashboard/DashboardFilters';
import FacebookConnectStatus from '@/components/dashboard/FacebookConnectStatus';
import { getCycleDates, CycleMode, formatDateForInput } from '@/utils/cycles';

export const revalidate = 0;

async function getDashboardData(searchParams: { product?: string; start?: string; end?: string; forecast?: string }) {
  // 1. Determine Date Range based on Forecast Mode
  const forecastMode = (searchParams.forecast || 'campaign') as CycleMode;
  let startDateStr = searchParams.start;
  let endDateStr = searchParams.end;
  let cycleTotalDays = 30; // Default
  let cycleDaysPassed = 1;

  if (forecastMode !== 'custom') {
    const cycle = getCycleDates(forecastMode);
    startDateStr = formatDateForInput(cycle.start);
    endDateStr = formatDateForInput(cycle.end);
    cycleTotalDays = cycle.totalDays;

    // Days Passed: Diff between Start and Today (capped at End)
    const now = new Date();
    const endCap = now > cycle.end ? cycle.end : now;
    const start = cycle.start;

    const diffTime = endCap.getTime() - start.getTime();
    cycleDaysPassed = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    // Bounds check
    cycleDaysPassed = Math.max(1, cycleDaysPassed);
    // If cycle is future? 
    if (cycleDaysPassed > cycleTotalDays) cycleDaysPassed = cycleTotalDays;
  } else {
    // Custom: Use passed dates or fallback
    if (startDateStr && endDateStr) {
      const start = new Date(startDateStr);
      const end = new Date(endDateStr);
      const diffTime = Math.abs(end.getTime() - start.getTime());
      cycleTotalDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

      const now = new Date();
      const endCap = now > end ? end : now;
      const diffPassed = endCap.getTime() - start.getTime();
      cycleDaysPassed = Math.ceil(diffPassed / (1000 * 60 * 60 * 24));
      cycleDaysPassed = Math.max(1, Math.min(cycleDaysPassed, cycleTotalDays));
    }
  }

  // 2. Query Metrics with calculated range
  let queryMetrics = supabaseAdmin.from('daily_metrics').select('*');
  if (startDateStr) queryMetrics = queryMetrics.gte('date', startDateStr);
  if (endDateStr) queryMetrics = queryMetrics.lte('date', endDateStr);

  const { data: metricsData } = await queryMetrics;
  const metrics = metricsData || [];

  const { data: campaignsData } = await supabaseAdmin.from('campaigns').select('*');
  const campaigns = campaignsData || [];

  const { data: productsData } = await supabaseAdmin.from('products').select('*');
  const products = productsData || [];

  // Aggregation Logic
  const campaignMap = new Map(campaigns?.map(c => [c.id, c]) || []);
  let totalSpend = 0;
  let totalLeads = 0;
  const productStatsMap = new Map();

  metrics?.forEach(m => {
    const campaign = campaignMap.get(m.campaign_id);
    if (!campaign) return;

    if (searchParams.product && searchParams.product !== 'All' && campaign.product_code !== searchParams.product) {
      return;
    }

    totalSpend += Number(m.spend);
    totalLeads += Number(m.leads);

    if (campaign.product_code) {
      const pCode = campaign.product_code;
      if (!productStatsMap.has(pCode)) {
        productStatsMap.set(pCode, {
          productCode: pCode,
          spend: 0,
          leads: 0,
          revenue: 0,
          profit: 0,
          targetCpl: 200
        });
      }
      const stat = productStatsMap.get(pCode);
      stat.spend += Number(m.spend);
      stat.leads += Number(m.leads);
    }
  });

  // Enrich with Forecast Logic
  const productStats = Array.from(productStatsMap.values()).map(stat => {
    const productDef = products?.find(p => p.code === stat.productCode);
    const targetCpl = productDef?.target_cpl || 200;
    const cpl = stat.leads > 0 ? stat.spend / stat.leads : 0;
    const avgValue = 3000;

    // Forecast Calculation: (Actual / DaysPassed) * TotalCycleDays
    const spendPace = stat.spend / cycleDaysPassed;
    const leadsPace = stat.leads / cycleDaysPassed;

    const forecastSpend = spendPace * cycleTotalDays;
    const forecastLeads = leadsPace * cycleTotalDays;
    const forecastRevenue = forecastLeads * avgValue;
    const forecastProfit = forecastRevenue - forecastSpend;

    const revenue = stat.leads * avgValue;
    const profit = revenue - stat.spend;

    return {
      ...stat,
      targetCpl,
      cpl,
      revenue,
      profit,
      forecastProfit
    };
  });

  // Campaign Optimization Data
  const campaignOptimizationData = campaigns?.map(c => {
    if (searchParams.product && searchParams.product !== 'All' && c.product_code !== searchParams.product) return null;

    const campMetrics = metrics?.filter(m => m.campaign_id === c.id) || [];
    if (campMetrics.length === 0) return null;

    const spend = campMetrics.reduce((sum, m) => sum + Number(m.spend), 0);
    const leads = campMetrics.reduce((sum, m) => sum + Number(m.leads), 0);
    const cpl = leads > 0 ? spend / leads : 0;
    const daysActive = new Set(campMetrics.map(m => m.date)).size;

    return {
      id: c.id,
      name: c.name,
      product: c.product_code || 'Unknown',
      audience: c.audience || 'Unknown',
      spend,
      leads,
      cpl,
      daysActive,
      targetCpl: 200
    };
  }).filter(Boolean) as any[];

  return {
    summary: { spend: totalSpend, leads: totalLeads },
    products: productStats,
    campaigns: campaignOptimizationData,
    cycleInfo: { start: startDateStr, end: endDateStr, daysPassed: cycleDaysPassed, total: cycleTotalDays }
  };
}

export default async function DashboardPage(props: { searchParams: Promise<{ product?: string; start?: string; end?: string; forecast?: string }> }) {
  const searchParams = await props.searchParams;
  const data = await getDashboardData(searchParams);

  // Mock User ID for 'No-Admin' context - In real app, get from session
  const userId = 'user-123';

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 p-8">
      <div className="flex items-center justify-between space-y-2 mb-8">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Thailife Dashboard</h2>
          <p className="text-sm text-slate-500 mt-1">
            Forecast Cycle: {data.cycleInfo.start} to {data.cycleInfo.end}
            (Day {data.cycleInfo.daysPassed} of {data.cycleInfo.total})
          </p>
        </div>
        <div className="flex items-center space-x-4">
          <FacebookConnectStatus userId={userId} />
          <span className="text-sm text-muted-foreground border-l pl-4">Last Synced: Just now</span>
        </div>
      </div>

      <DashboardFilters />

      <div className="space-y-4">
        <ExecutiveSummary data={data.summary} />

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
          <ProductPerformance data={data.products} />
        </div>

        <CampaignOptimization data={data.campaigns} />
      </div>
    </div>
  );
}
